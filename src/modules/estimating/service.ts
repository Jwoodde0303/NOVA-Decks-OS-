import { and, asc, desc, eq, sql } from "drizzle-orm";
import { activities, estimateRevisions, estimates, opportunities } from "@/db/schema";
import type { CompanyContext } from "@/modules/core/context";
import { NotFoundError } from "@/modules/core/errors";
import { getDesign } from "@/modules/design/service";
import { deckDesignModelSchema } from "@/modules/design/model";
import { getPricedProduct } from "./pricing";
import { computeTakeoff, takeoffToCsv, type EstimateLineItem, type PricedProduct } from "./takeoff";

/**
 * Create a new draft estimate revision for a saved design.
 * Snapshots the design model, product and price so later edits never change this revision.
 */
export async function createDraftRevision(
  ctx: CompanyContext,
  input: { designId: string; catalogProductId: string; estimateId?: string | null; title?: string },
) {
  ctx.require("estimate.write");
  const design = await getDesign(ctx, input.designId);
  const product = await getPricedProduct(ctx, input.catalogProductId);
  const takeoff = computeTakeoff(design.model, product); // throws ValidationError when the design is invalid

  const [opp] = await ctx.db
    .select({ customerId: opportunities.customerId })
    .from(opportunities)
    .where(and(eq(opportunities.companyId, ctx.companyId), eq(opportunities.id, design.opportunityId)));
  if (!opp) throw new NotFoundError("Opportunity");

  return ctx.db.transaction(async (tx) => {
    let estimateId = input.estimateId ?? null;
    if (estimateId) {
      const [e] = await tx
        .select({ id: estimates.id })
        .from(estimates)
        .where(and(eq(estimates.companyId, ctx.companyId), eq(estimates.id, estimateId), eq(estimates.opportunityId, design.opportunityId)));
      if (!e) throw new NotFoundError("Estimate");
    } else {
      const [e] = await tx
        .insert(estimates)
        .values({
          companyId: ctx.companyId,
          opportunityId: design.opportunityId,
          jobId: design.jobId,
          designId: design.id,
          title: input.title?.trim() || `${design.name} — decking`,
          createdBy: ctx.userId,
        })
        .returning({ id: estimates.id });
      estimateId = e!.id;
    }
    const [nextRow] = await tx
      .select({ next: sql<number>`coalesce(max(${estimateRevisions.revisionNumber}), 0) + 1`.mapWith(Number) })
      .from(estimateRevisions)
      .where(eq(estimateRevisions.estimateId, estimateId));
    const next = nextRow!.next;

    const [rev] = await tx
      .insert(estimateRevisions)
      .values({
        companyId: ctx.companyId,
        estimateId,
        revisionNumber: next,
        scopeLabel: takeoff.scopeLabel,
        designVersion: design.version,
        designSnapshot: design.model,
        productSnapshot: product,
        lineItems: takeoff.lineItems,
        subtotalCents: takeoff.subtotalCents,
        createdBy: ctx.userId,
      })
      .returning();
    await tx.insert(activities).values({
      companyId: ctx.companyId,
      customerId: opp.customerId,
      opportunityId: design.opportunityId,
      jobId: design.jobId,
      actorUserId: ctx.userId,
      kind: "estimate_revision",
      body: `Saved draft estimate revision ${next} — ${(takeoff.subtotalCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })}`,
      metadata: { estimateId, revisionId: rev!.id },
    });
    return { ...rev!, estimateId, lineItems: takeoff.lineItems };
  });
}

export async function getEstimate(ctx: CompanyContext, estimateId: string) {
  ctx.require("crm.read");
  const [e] = await ctx.db
    .select()
    .from(estimates)
    .where(and(eq(estimates.companyId, ctx.companyId), eq(estimates.id, estimateId)))
    .limit(1);
  if (!e) throw new NotFoundError("Estimate");
  const revisions = await ctx.db
    .select()
    .from(estimateRevisions)
    .where(and(eq(estimateRevisions.companyId, ctx.companyId), eq(estimateRevisions.estimateId, estimateId)))
    .orderBy(desc(estimateRevisions.revisionNumber));
  return { ...e, revisions: revisions.map(parseRevision) };
}

export async function listEstimatesForOpportunity(ctx: CompanyContext, opportunityId: string) {
  ctx.require("crm.read");
  const rows = await ctx.db
    .select({ estimate: estimates, revision: estimateRevisions })
    .from(estimates)
    .leftJoin(estimateRevisions, eq(estimateRevisions.estimateId, estimates.id))
    .where(and(eq(estimates.companyId, ctx.companyId), eq(estimates.opportunityId, opportunityId)))
    .orderBy(asc(estimates.createdAt), asc(estimateRevisions.revisionNumber));
  const byId = new Map<string, { estimate: typeof estimates.$inferSelect; revisions: ReturnType<typeof parseRevision>[] }>();
  for (const r of rows) {
    const entry = byId.get(r.estimate.id) ?? { estimate: r.estimate, revisions: [] };
    if (r.revision) entry.revisions.push(parseRevision(r.revision));
    byId.set(r.estimate.id, entry);
  }
  return [...byId.values()];
}

export async function getRevision(ctx: CompanyContext, revisionId: string) {
  ctx.require("crm.read");
  const [row] = await ctx.db
    .select({ revision: estimateRevisions, estimate: estimates })
    .from(estimateRevisions)
    .innerJoin(estimates, eq(estimates.id, estimateRevisions.estimateId))
    .where(and(eq(estimateRevisions.companyId, ctx.companyId), eq(estimateRevisions.id, revisionId)))
    .limit(1);
  if (!row) throw new NotFoundError("Estimate revision");
  return { ...parseRevision(row.revision), estimate: row.estimate };
}

/** CSV export of a saved revision. Uses the stored snapshot, never a recalculation. */
export async function exportRevisionCsv(ctx: CompanyContext, revisionId: string) {
  ctx.require("crm.export");
  const rev = await getRevision(ctx, revisionId);
  const csv = takeoffToCsv({
    scopeLabel: rev.scopeLabel,
    title: rev.estimate.title,
    revisionNumber: rev.revisionNumber,
    lineItems: rev.lineItems,
    subtotalCents: rev.subtotalCents,
  });
  const filename = `${rev.estimate.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-rev${rev.revisionNumber}.csv`;
  return { csv, filename };
}

function parseRevision(r: typeof estimateRevisions.$inferSelect) {
  return {
    ...r,
    designSnapshot: deckDesignModelSchema.parse(r.designSnapshot),
    productSnapshot: r.productSnapshot as PricedProduct,
    lineItems: r.lineItems as EstimateLineItem[],
  };
}
