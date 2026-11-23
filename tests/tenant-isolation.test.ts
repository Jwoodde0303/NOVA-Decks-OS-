import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { buildCompanyContext, listUserCompanies, type CompanyContext } from "@/modules/core/context";
import { ForbiddenError, NotFoundError } from "@/modules/core/errors";
import { DEFAULT_DECK_DESIGN } from "@/modules/design/model";
import { getDesign, saveDesign } from "@/modules/design/service";
import { getPriceBook, getPricedProduct } from "@/modules/estimating/pricing";
import { createRevision, exportRevisionCsv, getEstimate, getRevision, setEstimateStatus } from "@/modules/estimating/service";
import { listIntegrations, upsertIntegration } from "@/modules/integrations/service";
import { archiveProject, createProject, getProject, listProjects, updateProject } from "@/modules/projects/service";
import { closeDb, ctxFor, freshSeededDb, getPool, productId } from "./helpers";

let db: Db;
let nova: CompanyContext;
let blue: CompanyContext;
let novaData: { projectId: string; designId: string; estimateId: string; revisionId: string };

beforeAll(async () => {
  db = await freshSeededDb();
  nova = await ctxFor(db, "nova");
  blue = await ctxFor(db, "blue-ridge");
  const pid = await productId(db, "SR010616TG01");
  const p = await createProject(nova, { name: "NOVA only project", clientName: "NOVA Client" });
  const design = await saveDesign(nova, { projectId: p.id, name: "d", model: { ...DEFAULT_DECK_DESIGN, deckingProductId: pid } });
  const rev = await createRevision(nova, { designId: design.id });
  await upsertIntegration(nova, { provider: "jobtread", enabled: true, credentialRef: "JOBTREAD_API_KEY_NOVA", settings: {} });
  novaData = { projectId: p.id, designId: design.id, estimateId: rev.estimateId, revisionId: rev.id };
});
afterAll(closeDb);

describe("company isolation", () => {
  it("a user only gets a context for companies they belong to", async () => {
    await expect(buildCompanyContext(blue.userId, "nova", db)).rejects.toThrow(ForbiddenError);
    await expect(buildCompanyContext(undefined, "nova", db)).rejects.toThrow(/Sign in/);
    expect((await listUserCompanies(nova.userId, db)).map((c) => c.slug)).toEqual(["nova"]);
  });

  it("lists and searches never include another company's records", async () => {
    expect(await listProjects(blue, { includeArchived: true })).toHaveLength(0);
    expect(await listProjects(blue, { q: "NOVA" })).toHaveLength(0);
    expect((await listIntegrations(blue)).find((i) => i.provider === "jobtread")!.row).toBeNull();
    expect((await listIntegrations(nova)).find((i) => i.provider === "jobtread")!.row?.credentialRef).toBe("JOBTREAD_API_KEY_NOVA");
  });

  it("direct reads by ID from another company return not found", async () => {
    await expect(getProject(blue, novaData.projectId)).rejects.toThrow(NotFoundError);
    await expect(getDesign(blue, novaData.designId)).rejects.toThrow(NotFoundError);
    await expect(getEstimate(blue, novaData.estimateId)).rejects.toThrow(NotFoundError);
    await expect(getRevision(blue, novaData.revisionId)).rejects.toThrow(NotFoundError);
  });

  it("writes against another company's records are rejected and leave no trace", async () => {
    await expect(updateProject(blue, novaData.projectId, { name: "Hijacked" })).rejects.toThrow(NotFoundError);
    await expect(archiveProject(blue, novaData.projectId)).rejects.toThrow(NotFoundError);
    await expect(saveDesign(blue, { id: novaData.designId, projectId: novaData.projectId, name: "x", model: DEFAULT_DECK_DESIGN })).rejects.toThrow(NotFoundError);
    await expect(saveDesign(blue, { projectId: novaData.projectId, name: "x", model: DEFAULT_DECK_DESIGN })).rejects.toThrow(NotFoundError);
    await expect(createRevision(blue, { designId: novaData.designId })).rejects.toThrow(NotFoundError);
    await expect(setEstimateStatus(blue, novaData.estimateId, "accepted")).rejects.toThrow(NotFoundError);
    const p = await getProject(nova, novaData.projectId);
    expect(p.name).toBe("NOVA only project");
    expect(p.status).toBe("active");
    expect(p.events).toHaveLength(3);
  });

  it("exports from another company are rejected", async () => {
    await expect(exportRevisionCsv(blue, novaData.revisionId)).rejects.toThrow(NotFoundError);
    expect((await exportRevisionCsv(nova, novaData.revisionId)).csv).toContain("Spiced Rum");
  });

  it("cannot link records across companies even with a valid foreign ID", async () => {
    const blueProject = await createProject(blue, { name: "Blue project" });
    await expect(saveDesign(nova, { projectId: blueProject.id, name: "x", model: DEFAULT_DECK_DESIGN })).rejects.toThrow(NotFoundError);
    // A raw insert that bypasses the service is blocked by the composite foreign key.
    await expect(getPool().query(`insert into deck_designs (company_id, project_id, name, model) values ($1, $2, 'raw', '{}'::jsonb)`, [blue.companyId, novaData.projectId])).rejects.toThrow(/designs_project_fk/);
  });

  it("company pricing and price books are independent", async () => {
    const pid = await productId(db, "SR010616TG01");
    expect((await getPricedProduct(nova, pid)).unitPriceCents).toBe(7900);
    expect((await getPricedProduct(blue, pid)).unitPriceCents).toBe(8300);
    expect((await getPricedProduct(blue, await productId(db, "LCGV5420P"))).unitPriceCents).toBeNull();
    expect((await getPriceBook(blue)).get("labor.deck-sqft")!.unitPriceCents).toBe(Math.round(2400 * 1.08));
    expect((await getPriceBook(nova)).get("labor.deck-sqft")!.unitPriceCents).toBe(2400);
  });

  it("a user with memberships in two companies sees each company's data only in that context", async () => {
    await db.execute(sql`insert into memberships (company_id, user_id, role) values (${blue.companyId}, ${nova.userId}, 'member')`);
    const asBlue = await buildCompanyContext(nova.userId, "blue-ridge", db);
    expect(asBlue.role).toBe("member");
    expect((await listProjects(asBlue)).map((r) => r.project.name)).toEqual(["Blue project"]);
    await expect(getProject(asBlue, novaData.projectId)).rejects.toThrow(NotFoundError);
    await expect(upsertIntegration(asBlue, { provider: "acculynx", enabled: true, credentialRef: "X_KEY", settings: {} })).rejects.toThrow(ForbiddenError);
    expect((await listUserCompanies(nova.userId, db)).map((c) => c.slug).sort()).toEqual(["blue-ridge", "nova"]);
  });
});
