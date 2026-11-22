import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { companies, estimateRevisions, estimates, ESTIMATE_STATUSES } from "@/db/schema";
import type { CompanyContext } from "@/modules/core/context";
import { NotFoundError } from "@/modules/core/errors";
import { getDesign } from "@/modules/design/service";
import { deckDesignModelSchema } from "@/modules/design/model";
import { generateFraming, type FramingResult } from "@/modules/framing/generate";
import { logProjectEvent } from "@/modules/projects/service";
import { buildEstimate, estimateToCsv, type EstimateBuild, type EstimateSection } from "./engine";
import { getPriceBook, getPricedProduct } from "./pricing";
import type { PricedProduct } from "./takeoff";

/**
 * Create a new estimate revision for a saved design: runs the framing generator and the estimating
 * engine with the company's current prices and settings, then snapshots everything.
 */
export async function createRevision(ctx: CompanyContext, input: { designId: string; catalogProductId?: string | null; estimateId?: string | null; title?: string }) {
  ctx.require("estimate.write");
  const design = await getDesign(ctx, input.designId);
  const productId = input.catalogProductId ?? design.model.deckingProductId;
  if (!productId) throw new NotFoundError("Decking product (choose one in the design)");
  const product = await getPricedProduct(ctx, productId);
  const framing = generateFraming(design.model, product);
  const [co] = await ctx.db.select({ settings: companies.settings }).from(companies).where(eq(companies.id, ctx.companyId));
  const priceBook = await getPriceBook(ctx);
  const build = buildEstimate({ model: design.model, product, framing, priceBook, settings: co!.settings });

  return ctx.db.transaction(async (tx) => {
    let estimateId = input.estimateId ?? null;
    if (estimateId) {
      const [e] = await tx
        .select({ id: estimates.id })
        .from(estimates)
        .where(and(eq(estimates.companyId, ctx.companyId), eq(estimates.id, estimateId), eq(estimates.projectId, design.projectId)));
      if (!e) throw new NotFoundError("Estimate");
    } else {
      const [e] = await tx
        .insert(estimates)
        .values({ companyId: ctx.companyId, projectId: design.projectId, designId: design.id, title: input.title?.trim() || `${design.name} — deck estimate`, createdBy: ctx.userId })
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
        scopeLabel: build.scopeLabel,
        designVersion: design.version,
        designSnapshot: design.model,
        framingSnapshot: framing,
        productSnapshot: product,
        settings: build.settings,
        sections: build.sections,
        warnings: build.warnings,
        materialsCents: build.materialsCents,
        laborCents: build.laborCents,
        markupCents: build.markupCents,
        taxCents: build.taxCents,
        totalCents: build.totalCents,
        createdBy: ctx.userId,
      })
      .returning();
    await tx.update(estimates).set({ updatedAt: new Date() }).where(eq(estimates.id, estimateId));
    await logProjectEvent(tx, ctx, design.projectId, "estimate_revision", `Estimate revision ${next} saved — ${(build.totalCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })}${build.warnings.length ? ` (${build.warnings.length} pricing warning${build.warnings.length === 1 ? "" : "s"})` : ""}`, { estimateId, revisionId: rev!.id });
    return { ...parseRevision(rev!), estimateId };
  });
}

export async function setEstimateStatus(ctx: CompanyContext, estimateId: string, status: (typeof ESTIMATE_STATUSES)[number]) {
  ctx.require("estimate.status");
  z.enum(ESTIMATE_STATUSES).parse(status);
  const [e] = await ctx.db
    .update(estimates)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(estimates.companyId, ctx.companyId), eq(estimates.id, estimateId)))
    .returning();
  if (!e) throw new NotFoundError("Estimate");
  await logProjectEvent(ctx.db, ctx, e.projectId, "estimate_status", `Estimate "${e.title}" marked ${status}`);
  return e;
}

export async function getEstimate(ctx: CompanyContext, estimateId: string) {
  ctx.require("projects.read");
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

export async function listEstimatesForProject(ctx: CompanyContext, projectId: string) {
  ctx.require("projects.read");
  return ctx.db
    .select({ estimate: estimates, revisions: sql<number>`(select count(*) from ${estimateRevisions} r where r.estimate_id = "estimates"."id")`.mapWith(Number) })
    .from(estimates)
    .where(and(eq(estimates.companyId, ctx.companyId), eq(estimates.projectId, projectId)))
    .orderBy(asc(estimates.createdAt));
}

export async function getRevision(ctx: CompanyContext, revisionId: string) {
  ctx.require("projects.read");
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
  ctx.require("estimate.export");
  const rev = await getRevision(ctx, revisionId);
  const csv = estimateToCsv({ title: rev.estimate.title, revisionNumber: rev.revisionNumber, build: rev });
  const filename = `${rev.estimate.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-rev${rev.revisionNumber}.csv`;
  return { csv, filename };
}

export function parseRevision(r: typeof estimateRevisions.$inferSelect) {
  return {
    ...r,
    designSnapshot: deckDesignModelSchema.parse(r.designSnapshot),
    framingSnapshot: r.framingSnapshot as FramingResult,
    productSnapshot: r.productSnapshot as PricedProduct,
    settings: r.settings as EstimateBuild["settings"],
    sections: r.sections as EstimateSection[],
  };
}
