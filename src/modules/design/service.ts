import { and, desc, eq } from "drizzle-orm";
import { activities, deckDesigns, opportunities } from "@/db/schema";
import type { CompanyContext } from "@/modules/core/context";
import { NotFoundError, ValidationError } from "@/modules/core/errors";
import { deckDesignModelSchema, type DeckDesignModel } from "./model";

export async function getDesign(ctx: CompanyContext, id: string) {
  ctx.require("crm.read");
  const [d] = await ctx.db
    .select()
    .from(deckDesigns)
    .where(and(eq(deckDesigns.companyId, ctx.companyId), eq(deckDesigns.id, id)))
    .limit(1);
  if (!d) throw new NotFoundError("Design");
  return { ...d, model: deckDesignModelSchema.parse(d.model) };
}

export async function listDesigns(ctx: CompanyContext, opportunityId: string) {
  ctx.require("crm.read");
  return ctx.db
    .select()
    .from(deckDesigns)
    .where(and(eq(deckDesigns.companyId, ctx.companyId), eq(deckDesigns.opportunityId, opportunityId)))
    .orderBy(desc(deckDesigns.updatedAt));
}

/** Create or update a design. Saving bumps `version`; estimate revisions record which version they priced. */
export async function saveDesign(
  ctx: CompanyContext,
  input: { id?: string | null; opportunityId: string; name: string; model: unknown },
) {
  ctx.require("design.write");
  const parsed = deckDesignModelSchema.safeParse(input.model);
  if (!parsed.success) throw new ValidationError("Invalid design model", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
  const model: DeckDesignModel = parsed.data;
  const name = input.name.trim() || "Deck design";

  const [opp] = await ctx.db
    .select({ id: opportunities.id, customerId: opportunities.customerId })
    .from(opportunities)
    .where(and(eq(opportunities.companyId, ctx.companyId), eq(opportunities.id, input.opportunityId)))
    .limit(1);
  if (!opp) throw new NotFoundError("Opportunity");

  return ctx.db.transaction(async (tx) => {
    let row: typeof deckDesigns.$inferSelect | undefined;
    if (input.id) {
      [row] = await tx
        .update(deckDesigns)
        .set({ name, model, version: (await currentVersion(ctx, input.id)) + 1, updatedBy: ctx.userId, updatedAt: new Date() })
        .where(and(eq(deckDesigns.companyId, ctx.companyId), eq(deckDesigns.id, input.id), eq(deckDesigns.opportunityId, opp.id)))
        .returning();
      if (!row) throw new NotFoundError("Design");
    } else {
      const [jobRow] = await tx
        .select({ jobId: deckDesigns.jobId })
        .from(deckDesigns)
        .where(and(eq(deckDesigns.companyId, ctx.companyId), eq(deckDesigns.opportunityId, opp.id)))
        .limit(1);
      [row] = await tx
        .insert(deckDesigns)
        .values({ companyId: ctx.companyId, opportunityId: opp.id, jobId: jobRow?.jobId ?? null, name, model, createdBy: ctx.userId, updatedBy: ctx.userId })
        .returning();
    }
    await tx.insert(activities).values({
      companyId: ctx.companyId,
      customerId: opp.customerId,
      opportunityId: opp.id,
      jobId: row!.jobId,
      actorUserId: ctx.userId,
      kind: "design_saved",
      body: `Saved deck design "${row!.name}" (v${row!.version})`,
      metadata: { designId: row!.id, version: row!.version },
    });
    return { ...row!, model };
  });
}

async function currentVersion(ctx: CompanyContext, id: string) {
  const [d] = await ctx.db
    .select({ version: deckDesigns.version })
    .from(deckDesigns)
    .where(and(eq(deckDesigns.companyId, ctx.companyId), eq(deckDesigns.id, id)));
  if (!d) throw new NotFoundError("Design");
  return d.version;
}
