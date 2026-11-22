import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import type { CompanyContext } from "@/modules/core/context";
import { ForbiddenError, ValidationError } from "@/modules/core/errors";
import * as crm from "@/modules/crm/service";
import { saveDesign } from "@/modules/design/service";
import { DEFAULT_DECK_DESIGN } from "@/modules/design/model";
import { createDraftRevision, exportRevisionCsv, getEstimate } from "@/modules/estimating/service";
import { setProductPrice } from "@/modules/estimating/pricing";
import { closeDb, ctxFor, freshSeededDb, productId, stageId } from "./helpers";

let db: Db;
let owner: CompanyContext;
let member: CompanyContext;

beforeAll(async () => {
  db = await freshSeededDb();
  owner = await ctxFor(db, "nova", "owner");
  member = await ctxFor(db, "nova", "member");
});
afterAll(closeDb);

async function createLead(ctx: CompanyContext, title = "Backyard deck") {
  const customer = await crm.createCustomer(ctx, { displayName: "Taylor Homeowner" });
  const address = await crm.addAddress(ctx, customer.id, { line1: "1 Demo St", city: "Fairfax", region: "VA", postalCode: "22030" });
  const opp = await crm.createOpportunity(ctx, {
    customerId: customer.id,
    addressId: address.id,
    title,
    serviceType: "deck",
    leadSource: "website",
    assigneeUserId: member.userId,
    nextFollowUpOn: "2026-11-25",
  });
  return { customer, address, opp };
}

describe("lead → estimate → job workflow", () => {
  it("creates an inquiry in New Inquiry with activity recorded", async () => {
    const { opp } = await createLead(member);
    const full = await crm.getOpportunity(member, opp.id);
    expect(full.stage.name).toBe("New Inquiry");
    expect(full.assigneeName).toBe("Sam Estimator");
    expect(full.timeline.map((t) => t.activity.kind)).toEqual(["opportunity_created"]);
    expect(full.timeline[0]!.actorName).toBe("Sam Estimator");
  });

  it("tracks stage changes, follow-ups, notes and tasks chronologically with the actor", async () => {
    const { opp } = await createLead(member);
    await crm.updateOpportunity(member, opp.id, { stageId: await stageId(db, owner.companyId, "Consultation Scheduled"), nextFollowUpOn: "2026-11-28" });
    await crm.addNote(owner, opp.id, "Spoke with homeowner, wants cedar look.");
    const task = await crm.addTask(owner, opp.id, { title: "Site visit", ownerUserId: member.userId, dueOn: "2026-11-27" });
    await crm.completeTask(member, task.id);
    const full = await crm.getOpportunity(member, opp.id);
    expect(full.timeline.map((t) => `${t.activity.kind}:${t.actorName}`)).toEqual([
      "opportunity_created:Sam Estimator",
      "stage_changed:Sam Estimator",
      "follow_up_changed:Sam Estimator",
      "note:Jordan Owner",
      "task_added:Jordan Owner",
      "task_completed:Sam Estimator",
    ]);
    expect(full.tasks[0]!.task.completedAt).not.toBeNull();
  });

  it("filters by stage, assignee and overdue follow-up", async () => {
    const { opp: overdue } = await createLead(owner, "Overdue lead");
    await crm.updateOpportunity(owner, overdue.id, { nextFollowUpOn: "2020-01-01" });
    const { opp: unassigned } = await createLead(owner, "Unassigned lead");
    await crm.updateOpportunity(owner, unassigned.id, { assigneeUserId: null });

    const overdueList = await crm.listOpportunities(owner, { overdueOnly: true });
    expect(overdueList.map((r) => r.opp.id)).toContain(overdue.id);
    expect(overdueList.map((r) => r.opp.id)).not.toContain(unassigned.id);

    const unassignedList = await crm.listOpportunities(owner, { assigneeUserId: "unassigned" });
    expect(unassignedList.map((r) => r.opp.id)).toEqual([unassigned.id]);

    const searched = await crm.listOpportunities(owner, { q: "overdue" });
    expect(searched.map((r) => r.opp.title)).toEqual(["Overdue lead"]);

    const consult = await crm.listOpportunities(owner, { stageId: await stageId(db, owner.companyId, "Consultation Scheduled") });
    expect(consult.every((r) => r.stage.name === "Consultation Scheduled")).toBe(true);
  });

  it("rejects assigning to someone outside the company", async () => {
    const other = await ctxFor(db, "blue-ridge", "owner");
    const { opp } = await createLead(owner);
    await expect(crm.updateOpportunity(owner, opp.id, { assigneeUserId: other.userId })).rejects.toThrow(ValidationError);
  });

  it("converts a won opportunity to a job once, preserving links; repeat conversion returns the same job", async () => {
    const { opp, customer, address } = await createLead(member);
    const pid = await productId(db, "NL-HBR-GRY-20");
    const design = await saveDesign(member, { opportunityId: opp.id, name: "Main deck", model: { ...DEFAULT_DECK_DESIGN, deckingProductId: pid } });
    const rev = await createDraftRevision(member, { designId: design.id, catalogProductId: pid });

    await expect(crm.convertToJob(owner, opp.id)).rejects.toThrow(/Only opportunities in a Won stage/);
    await crm.updateOpportunity(member, opp.id, { stageId: await stageId(db, owner.companyId, "Won") });
    await expect(crm.convertToJob(member, opp.id)).rejects.toThrow(ForbiddenError); // Team Member cannot convert

    const first = await crm.convertToJob(owner, opp.id);
    expect(first.created).toBe(true);
    expect(first.job.jobNumber).toBe("J-1001");
    expect(first.job.customerId).toBe(customer.id);
    expect(first.job.addressId).toBe(address.id);

    const [again, concurrent] = await Promise.all([crm.convertToJob(owner, opp.id), crm.convertToJob(owner, opp.id)]);
    expect(again.created).toBe(false);
    expect(concurrent.created).toBe(false);
    expect(again.job.id).toBe(first.job.id);
    expect((await crm.listJobs(owner)).filter((j) => j.job.opportunityId === opp.id)).toHaveLength(1);

    const job = await crm.getJob(owner, first.job.id);
    expect(job.designs.map((d) => d.id)).toEqual([design.id]);
    expect(job.estimates.map((e) => e.id)).toEqual([rev.estimateId]);
    expect(job.timeline.map((t) => t.activity.kind)).toContain("opportunity_created");
    expect(job.timeline.at(-1)!.activity.body).toBe("Converted to job J-1001");

    const second = await createLead(owner, "Second won");
    await crm.updateOpportunity(owner, second.opp.id, { stageId: await stageId(db, owner.companyId, "Won") });
    expect((await crm.convertToJob(owner, second.opp.id)).job.jobNumber).toBe("J-1002");
  });
});

describe("estimate revisions stay intact", () => {
  it("keeps saved revisions unchanged when the design or price changes later", async () => {
    const { opp } = await createLead(member);
    const pid = await productId(db, "NL-HBR-GRY-10");
    const design = await saveDesign(member, { opportunityId: opp.id, name: "Rev test", model: { ...DEFAULT_DECK_DESIGN, deckingProductId: pid } });
    const rev1 = await createDraftRevision(member, { designId: design.id, catalogProductId: pid });
    expect(rev1.revisionNumber).toBe(1);
    expect(rev1.subtotalCents).toBe(163_200);
    expect(rev1.designVersion).toBe(1);

    // Change the design (depth 13 ft) and the company price ($34 → $40) after rev 1 is saved.
    await saveDesign(member, { id: design.id, opportunityId: opp.id, name: "Rev test", model: { ...design.model, depthIn: 13 * 12 } });
    await setProductPrice(owner, { catalogProductId: pid, unitPriceCents: 4000, source: "test:price-increase", effectiveOn: "2026-01-02" });
    await expect(setProductPrice(member, { catalogProductId: pid, unitPriceCents: 1, source: "x", effectiveOn: "2026-01-03" })).rejects.toThrow(ForbiddenError);

    const rev2 = await createDraftRevision(member, { designId: design.id, catalogProductId: pid, estimateId: rev1.estimateId });
    expect(rev2.revisionNumber).toBe(2);
    expect(rev2.designVersion).toBe(2);
    expect(rev2.lineItems[0]!.quantity).toBe(52);
    expect(rev2.subtotalCents).toBe(52 * 4000);

    const est = await getEstimate(member, rev1.estimateId);
    const stored1 = est.revisions.find((r) => r.revisionNumber === 1)!;
    expect(stored1.subtotalCents).toBe(163_200);
    expect(stored1.lineItems[0]!.quantity).toBe(48);
    expect(stored1.designSnapshot.depthIn).toBe(144);
    expect(stored1.productSnapshot.unitPriceCents).toBe(3400);

    const { csv, filename } = await exportRevisionCsv(member, stored1.id);
    expect(filename).toMatch(/rev1\.csv$/);
    expect(csv).toContain("Subtotal,1632.00");
  });

  it("blocks estimating and export for an invalid design", async () => {
    const { opp } = await createLead(member);
    const pid = await productId(db, "NL-HBR-GRY-20");
    const design = await saveDesign(member, { opportunityId: opp.id, name: "Bad stair", model: { ...DEFAULT_DECK_DESIGN, stair: { widthIn: 72, offsetIn: 192 }, deckingProductId: pid } });
    await expect(createDraftRevision(member, { designId: design.id, catalogProductId: pid })).rejects.toMatchObject({
      issues: [expect.stringMatching(/past the right corner/)],
    });
  });
});
