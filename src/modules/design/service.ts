import { and, desc, eq } from "drizzle-orm";
import { deckDesigns, projects } from "@/db/schema";
import type { CompanyContext } from "@/modules/core/context";
import { NotFoundError, ValidationError } from "@/modules/core/errors";
import { logProjectEvent } from "@/modules/projects/service";
import { deckDesignModelSchema, type DeckDesignModel } from "./model";

export async function getDesign(ctx: CompanyContext, id: string) {
  ctx.require("projects.read");
  const [d] = await ctx.db
    .select()
    .from(deckDesigns)
    .where(and(eq(deckDesigns.companyId, ctx.companyId), eq(deckDesigns.id, id)))
    .limit(1);
  if (!d) throw new NotFoundError("Design");
  return { ...d, model: deckDesignModelSchema.parse(d.model) };
}

export async function listDesigns(ctx: CompanyContext, projectId: string) {
  ctx.require("projects.read");
  return ctx.db
    .select()
    .from(deckDesigns)
    .where(and(eq(deckDesigns.companyId, ctx.companyId), eq(deckDesigns.projectId, projectId)))
    .orderBy(desc(deckDesigns.updatedAt));
}

/** Create or update a design. Saving bumps `version`; estimate revisions record which version they priced. */
export async function saveDesign(ctx: CompanyContext, input: { id?: string | null; projectId: string; name: string; model: unknown }) {
  ctx.require("design.write");
  const parsed = deckDesignModelSchema.safeParse(input.model);
  if (!parsed.success) throw new ValidationError("Invalid design model", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
  const model: DeckDesignModel = parsed.data;
  const name = input.name.trim() || "Deck design";

  const [project] = await ctx.db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.companyId, ctx.companyId), eq(projects.id, input.projectId)))
    .limit(1);
  if (!project) throw new NotFoundError("Project");

  return ctx.db.transaction(async (tx) => {
    let row: typeof deckDesigns.$inferSelect | undefined;
    if (input.id) {
      const [cur] = await tx
        .select({ version: deckDesigns.version })
        .from(deckDesigns)
        .where(and(eq(deckDesigns.companyId, ctx.companyId), eq(deckDesigns.id, input.id), eq(deckDesigns.projectId, project.id)));
      if (!cur) throw new NotFoundError("Design");
      [row] = await tx
        .update(deckDesigns)
        .set({ name, model, version: cur.version + 1, updatedBy: ctx.userId, updatedAt: new Date() })
        .where(and(eq(deckDesigns.companyId, ctx.companyId), eq(deckDesigns.id, input.id)))
        .returning();
    } else {
      [row] = await tx
        .insert(deckDesigns)
        .values({ companyId: ctx.companyId, projectId: project.id, name, model, createdBy: ctx.userId, updatedBy: ctx.userId })
        .returning();
    }
    await logProjectEvent(tx, ctx, project.id, "design_saved", `Saved deck design "${row!.name}" (v${row!.version})`, { designId: row!.id, version: row!.version });
    return { ...row!, model };
  });
}
