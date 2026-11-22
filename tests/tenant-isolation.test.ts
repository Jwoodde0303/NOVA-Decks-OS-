import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { getPool, type Db } from "@/db/client";
import { buildCompanyContext, listUserCompanies, type CompanyContext } from "@/modules/core/context";
import { ForbiddenError, NotFoundError } from "@/modules/core/errors";
import * as crm from "@/modules/crm/service";
import { getDesign, saveDesign } from "@/modules/design/service";
import { DEFAULT_DECK_DESIGN } from "@/modules/design/model";
import { createDraftRevision, exportRevisionCsv, getEstimate, getRevision } from "@/modules/estimating/service";
import { getPricedProduct } from "@/modules/estimating/pricing";
import { closeDb, ctxFor, freshSeededDb, productId, stageId } from "./helpers";

let db: Db;
let nova: CompanyContext;
let blue: CompanyContext;
let novaData: { customerId: string; oppId: string; designId: string; estimateId: string; revisionId: string; taskId: string; jobId: string };

beforeAll(async () => {
  db = await freshSeededDb();
  nova = await ctxFor(db, "nova");
  blue = await ctxFor(db, "blue-ridge");
  const c = await crm.createCustomer(nova, { displayName: "NOVA Only Customer" });
  const opp = await crm.createOpportunity(nova, { customerId: c.id, title: "NOVA deck", serviceType: "deck", leadSource: "referral" });
  const pid = await productId(db, "NL-HBR-GRY-20");
  const design = await saveDesign(nova, { opportunityId: opp.id, name: "d", model: { ...DEFAULT_DECK_DESIGN, deckingProductId: pid } });
  const rev = await createDraftRevision(nova, { designId: design.id, catalogProductId: pid });
  const task = await crm.addTask(nova, opp.id, { title: "t", ownerUserId: nova.userId, dueOn: "2026-12-01" });
  await crm.updateOpportunity(nova, opp.id, { stageId: await stageId(db, nova.companyId, "Won") });
  const { job } = await crm.convertToJob(nova, opp.id);
  novaData = { customerId: c.id, oppId: opp.id, designId: design.id, estimateId: rev.estimateId, revisionId: rev.id, taskId: task.id, jobId: job.id };
});
afterAll(closeDb);

describe("company isolation", () => {
  it("a user only gets a context for companies they belong to", async () => {
    await expect(buildCompanyContext(blue.userId, "nova", db)).rejects.toThrow(ForbiddenError);
    await expect(buildCompanyContext(undefined, "nova", db)).rejects.toThrow(/Sign in/);
    expect((await listUserCompanies(nova.userId, db)).map((c) => c.slug)).toEqual(["nova"]);
  });

  it("lists and searches never include another company's records", async () => {
    expect(await crm.listCustomers(blue)).toHaveLength(0);
    expect(await crm.listCustomers(blue, "NOVA")).toHaveLength(0);
    expect(await crm.listOpportunities(blue, { includeClosed: true, q: "NOVA" })).toHaveLength(0);
    expect(await crm.listJobs(blue)).toHaveLength(0);
    expect(await crm.listActivity(blue, { customerId: novaData.customerId })).toHaveLength(0);
    expect((await crm.dashboard(blue)).open).toHaveLength(0);
  });

  it("direct reads by ID from another company return not found", async () => {
    await expect(crm.getCustomer(blue, novaData.customerId)).rejects.toThrow(NotFoundError);
    await expect(crm.getOpportunity(blue, novaData.oppId)).rejects.toThrow(NotFoundError);
    await expect(crm.getJob(blue, novaData.jobId)).rejects.toThrow(NotFoundError);
    await expect(getDesign(blue, novaData.designId)).rejects.toThrow(NotFoundError);
    await expect(getEstimate(blue, novaData.estimateId)).rejects.toThrow(NotFoundError);
    await expect(getRevision(blue, novaData.revisionId)).rejects.toThrow(NotFoundError);
  });

  it("writes against another company's records are rejected and leave no trace", async () => {
    await expect(crm.updateCustomer(blue, novaData.customerId, { displayName: "Hijacked" })).rejects.toThrow(NotFoundError);
    await expect(crm.deleteCustomer(blue, novaData.customerId)).rejects.toThrow(NotFoundError);
    await expect(crm.updateOpportunity(blue, novaData.oppId, { title: "Hijacked" })).rejects.toThrow(NotFoundError);
    await expect(crm.addNote(blue, novaData.oppId, "intruder")).rejects.toThrow(NotFoundError);
    await expect(crm.addTask(blue, novaData.oppId, { title: "x", ownerUserId: blue.userId, dueOn: "2026-12-01" })).rejects.toThrow(NotFoundError);
    await expect(crm.completeTask(blue, novaData.taskId)).rejects.toThrow(NotFoundError);
    await expect(crm.convertToJob(blue, novaData.oppId)).rejects.toThrow(NotFoundError);
    await expect(crm.addContact(blue, novaData.customerId, { name: "x" })).rejects.toThrow(NotFoundError);
    await expect(crm.addAddress(blue, novaData.customerId, { line1: "x", city: "y", region: "z", postalCode: "1" })).rejects.toThrow(NotFoundError);
    await expect(saveDesign(blue, { id: novaData.designId, opportunityId: novaData.oppId, name: "x", model: DEFAULT_DECK_DESIGN })).rejects.toThrow(NotFoundError);
    await expect(saveDesign(blue, { opportunityId: novaData.oppId, name: "x", model: DEFAULT_DECK_DESIGN })).rejects.toThrow(NotFoundError);
    await expect(createDraftRevision(blue, { designId: novaData.designId, catalogProductId: await productId(db, "NL-HBR-GRY-20") })).rejects.toThrow(NotFoundError);

    const nv = await crm.getOpportunity(nova, novaData.oppId);
    expect(nv.opp.title).toBe("NOVA deck");
    expect(nv.customer.displayName).toBe("NOVA Only Customer");
    expect(nv.timeline.some((t) => t.activity.body === "intruder")).toBe(false);
  });

  it("exports from another company are rejected", async () => {
    await expect(exportRevisionCsv(blue, novaData.revisionId)).rejects.toThrow(NotFoundError);
    expect((await exportRevisionCsv(nova, novaData.revisionId)).csv).toContain("Subtotal,1440.00");
  });

  it("cannot link records across companies even with a valid foreign ID", async () => {
    const blueCustomer = await crm.createCustomer(blue, { displayName: "Blue Customer" });
    // Blue's customer id passed into NOVA's context → not found (customer is scoped).
    await expect(crm.createOpportunity(nova, { customerId: blueCustomer.id, title: "x", serviceType: "deck", leadSource: "other" })).rejects.toThrow(NotFoundError);
    // NOVA stage id passed into Blue's context → rejected.
    const novaStage = await stageId(db, nova.companyId, "Won");
    await expect(crm.createOpportunity(blue, { customerId: blueCustomer.id, title: "x", serviceType: "deck", leadSource: "other", stageId: novaStage })).rejects.toThrow(/Unknown stage/);
    // Even a raw insert that bypasses the service is blocked by the composite foreign key.
    await expect(
      getPool().query(
        `insert into opportunities (company_id, customer_id, title, service_type, lead_source, stage_id)
         values ($1, $2, 'raw', 'deck', 'other', (select id from pipeline_stages where company_id = $1 limit 1))`,
        [blue.companyId, novaData.customerId],
      ),
    ).rejects.toThrow(/opps_customer_fk/);
  });

  it("company pricing is independent: same catalog product, different price per company", async () => {
    const pid = await productId(db, "NL-HBR-GRY-20");
    expect((await getPricedProduct(nova, pid)).unitPriceCents).toBe(6000);
    expect((await getPricedProduct(blue, pid)).unitPriceCents).toBe(6400);
    await expect(getPricedProduct(blue, await productId(db, "RW-CT-16"))).rejects.toThrow(NotFoundError);
  });

  it("a user with memberships in two companies sees each company's data only in that context", async () => {
    await db.execute(sql`insert into memberships (company_id, user_id, role) values (${blue.companyId}, ${nova.userId}, 'member')`);
    const asBlue = await buildCompanyContext(nova.userId, "blue-ridge", db);
    expect(asBlue.role).toBe("member");
    expect((await crm.listCustomers(asBlue)).map((c) => c.customer.displayName)).toEqual(["Blue Customer"]);
    await expect(crm.getOpportunity(asBlue, novaData.oppId)).rejects.toThrow(NotFoundError);
    expect((await listUserCompanies(nova.userId, db)).map((c) => c.slug).sort()).toEqual(["blue-ridge", "nova"]);
  });
});
