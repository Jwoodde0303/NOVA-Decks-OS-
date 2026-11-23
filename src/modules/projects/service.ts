import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { companies, deckDesigns, estimateRevisions, estimates, projectEvents, projects, user, CRM_PROVIDERS } from "@/db/schema";
import type { Tx } from "@/db/client";
import type { CompanyContext } from "@/modules/core/context";
import { NotFoundError } from "@/modules/core/errors";

export const projectInput = z.object({
  name: z.string().trim().min(1).max(200),
  clientName: z.string().trim().max(200).optional().nullable(),
  clientPhone: z.string().trim().max(50).optional().nullable(),
  clientEmail: z.string().trim().email().optional().nullable().or(z.literal("")),
  siteLine1: z.string().trim().max(200).optional().nullable(),
  siteLine2: z.string().trim().max(200).optional().nullable(),
  siteCity: z.string().trim().max(100).optional().nullable(),
  siteRegion: z.string().trim().max(50).optional().nullable(),
  sitePostalCode: z.string().trim().max(20).optional().nullable(),
  jurisdiction: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(5000).optional().nullable(),
  externalCrm: z
    .object({
      provider: z.enum(CRM_PROVIDERS),
      externalId: z.string().trim().min(1).max(200),
      url: z.string().trim().url().optional().nullable().or(z.literal("")),
      label: z.string().trim().max(200).optional().nullable(),
    })
    .optional()
    .nullable(),
});
export type ProjectInput = z.infer<typeof projectInput>;

export async function logProjectEvent(db: Tx | CompanyContext["db"], ctx: CompanyContext, projectId: string, kind: string, body: string, metadata: Record<string, unknown> = {}) {
  await db.insert(projectEvents).values({ companyId: ctx.companyId, projectId, actorUserId: ctx.userId, kind, body, metadata });
}

export async function createProject(ctx: CompanyContext, raw: unknown) {
  ctx.require("projects.write");
  const input = projectInput.parse(raw);
  return ctx.db.transaction(async (tx) => {
    const [co] = await tx.select({ next: companies.nextProjectNumber }).from(companies).where(eq(companies.id, ctx.companyId)).for("update");
    await tx.update(companies).set({ nextProjectNumber: co!.next + 1 }).where(eq(companies.id, ctx.companyId));
    const [p] = await tx
      .insert(projects)
      .values({ companyId: ctx.companyId, projectNumber: `P-${co!.next}`, ...input, clientEmail: input.clientEmail || null, externalCrm: input.externalCrm ? { ...input.externalCrm, url: input.externalCrm.url || null } : null, createdBy: ctx.userId })
      .returning();
    await logProjectEvent(tx, ctx, p!.id, "project_created", `Project ${p!.projectNumber} "${p!.name}" created`);
    return p!;
  });
}

export async function updateProject(ctx: CompanyContext, id: string, raw: unknown) {
  ctx.require("projects.write");
  const input = projectInput.partial().parse(raw);
  const [p] = await ctx.db
    .update(projects)
    .set({ ...input, clientEmail: input.clientEmail === "" ? null : input.clientEmail, externalCrm: input.externalCrm === undefined ? undefined : input.externalCrm ? { ...input.externalCrm, url: input.externalCrm.url || null } : null, updatedAt: new Date() })
    .where(and(eq(projects.companyId, ctx.companyId), eq(projects.id, id)))
    .returning();
  if (!p) throw new NotFoundError("Project");
  await logProjectEvent(ctx.db, ctx, id, "project_updated", "Project details updated");
  return p;
}

export async function archiveProject(ctx: CompanyContext, id: string, archived = true) {
  ctx.require("projects.delete");
  const [p] = await ctx.db
    .update(projects)
    .set({ status: archived ? "archived" : "active", updatedAt: new Date() })
    .where(and(eq(projects.companyId, ctx.companyId), eq(projects.id, id)))
    .returning();
  if (!p) throw new NotFoundError("Project");
  return p;
}

export async function listProjects(ctx: CompanyContext, opts: { q?: string; includeArchived?: boolean } = {}) {
  ctx.require("projects.read");
  const conds: SQL[] = [eq(projects.companyId, ctx.companyId)];
  if (!opts.includeArchived) conds.push(eq(projects.status, "active"));
  if (opts.q) conds.push(or(ilike(projects.name, `%${opts.q}%`), ilike(projects.clientName, `%${opts.q}%`), ilike(projects.projectNumber, `%${opts.q}%`))!);
  return ctx.db
    .select({
      project: projects,
      designs: sql<number>`(select count(*) from ${deckDesigns} d where d.company_id = "projects"."company_id" and d.project_id = "projects"."id")`.mapWith(Number),
      estimates: sql<number>`(select count(*) from ${estimates} e where e.company_id = "projects"."company_id" and e.project_id = "projects"."id")`.mapWith(Number),
      latestTotalCents: sql<number | null>`(select r.total_cents from ${estimateRevisions} r join ${estimates} e on e.id = r.estimate_id where e.company_id = "projects"."company_id" and e.project_id = "projects"."id" order by r.created_at desc limit 1)`,
    })
    .from(projects)
    .where(and(...conds))
    .orderBy(desc(projects.updatedAt));
}

export async function getProject(ctx: CompanyContext, id: string) {
  ctx.require("projects.read");
  const [p] = await ctx.db
    .select()
    .from(projects)
    .where(and(eq(projects.companyId, ctx.companyId), eq(projects.id, id)))
    .limit(1);
  if (!p) throw new NotFoundError("Project");
  const [designs, estimateList, events] = await Promise.all([
    ctx.db
      .select({ id: deckDesigns.id, name: deckDesigns.name, version: deckDesigns.version, updatedAt: deckDesigns.updatedAt })
      .from(deckDesigns)
      .where(and(eq(deckDesigns.companyId, ctx.companyId), eq(deckDesigns.projectId, id)))
      .orderBy(desc(deckDesigns.updatedAt)),
    ctx.db
      .select({
        estimate: estimates,
        revisions: sql<number>`(select count(*) from ${estimateRevisions} r where r.estimate_id = "estimates"."id")`.mapWith(Number),
        latestTotalCents: sql<number | null>`(select r.total_cents from ${estimateRevisions} r where r.estimate_id = "estimates"."id" order by r.revision_number desc limit 1)`,
      })
      .from(estimates)
      .where(and(eq(estimates.companyId, ctx.companyId), eq(estimates.projectId, id)))
      .orderBy(desc(estimates.createdAt)),
    ctx.db
      .select({ event: projectEvents, actorName: user.name })
      .from(projectEvents)
      .leftJoin(user, eq(user.id, projectEvents.actorUserId))
      .where(and(eq(projectEvents.companyId, ctx.companyId), eq(projectEvents.projectId, id)))
      .orderBy(asc(projectEvents.createdAt)),
  ]);
  return { ...p, designs, estimates: estimateList, events };
}
