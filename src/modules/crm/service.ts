import { and, asc, desc, eq, ilike, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import {
  activities,
  companies,
  customerAddresses,
  customerContacts,
  customers,
  deckDesigns,
  estimates,
  jobs,
  memberships,
  opportunities,
  pipelineStages,
  tasks,
  user,
  LEAD_SOURCES,
  SERVICE_TYPES,
} from "@/db/schema";
import type { Tx } from "@/db/client";
import { z } from "zod";
import type { CompanyContext } from "@/modules/core/context";
import { NotFoundError, ValidationError } from "@/modules/core/errors";

/* ----------------------------- input schemas ------------------------------ */

export const customerInput = z.object({
  displayName: z.string().trim().min(1).max(200),
  kind: z.enum(["residential", "commercial"]).default("residential"),
  notes: z.string().trim().max(5000).optional().nullable(),
});
export const contactInput = z.object({
  name: z.string().trim().min(1).max(200),
  role: z.string().trim().max(100).optional().nullable(),
  email: z.string().trim().email().optional().nullable().or(z.literal("")),
  phone: z.string().trim().max(50).optional().nullable(),
  isPrimary: z.boolean().default(false),
});
export const addressInput = z.object({
  label: z.string().trim().min(1).max(100).default("Project site"),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().min(1).max(100),
  region: z.string().trim().min(1).max(50),
  postalCode: z.string().trim().min(1).max(20),
});
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
export const opportunityInput = z.object({
  customerId: z.string().uuid(),
  addressId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(1).max(200),
  serviceType: z.enum(SERVICE_TYPES),
  leadSource: z.enum(LEAD_SOURCES),
  stageId: z.string().uuid().optional(),
  assigneeUserId: z.string().optional().nullable(),
  nextFollowUpOn: dateString.optional().nullable(),
});
export const opportunityUpdate = opportunityInput.partial().extend({ lostReason: z.string().trim().max(500).optional().nullable() });
export const taskInput = z.object({
  title: z.string().trim().min(1).max(200),
  ownerUserId: z.string().min(1),
  dueOn: dateString,
});

export type CustomerInput = z.infer<typeof customerInput>;
export type OpportunityInput = z.infer<typeof opportunityInput>;

/* ------------------------------- helpers ---------------------------------- */

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

async function logActivity(
  db: Tx | CompanyContext["db"],
  ctx: CompanyContext,
  a: { customerId: string; opportunityId?: string | null; jobId?: string | null; kind: string; body: string; metadata?: Record<string, unknown> },
) {
  await db.insert(activities).values({
    companyId: ctx.companyId,
    customerId: a.customerId,
    opportunityId: a.opportunityId ?? null,
    jobId: a.jobId ?? null,
    actorUserId: ctx.userId,
    kind: a.kind,
    body: a.body,
    metadata: a.metadata ?? {},
  });
}

async function assertMember(ctx: CompanyContext, userId: string | null | undefined) {
  if (!userId) return;
  const [m] = await ctx.db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.companyId, ctx.companyId), eq(memberships.userId, userId)))
    .limit(1);
  if (!m) throw new ValidationError("Assignee must be a member of this workspace.");
}

/* ------------------------------- members ---------------------------------- */

export async function listMembers(ctx: CompanyContext) {
  ctx.require("crm.read");
  return ctx.db
    .select({ userId: user.id, name: user.name, email: user.email, role: memberships.role })
    .from(memberships)
    .innerJoin(user, eq(user.id, memberships.userId))
    .where(eq(memberships.companyId, ctx.companyId))
    .orderBy(user.name);
}

export async function listStages(ctx: CompanyContext) {
  ctx.require("crm.read");
  return ctx.db.select().from(pipelineStages).where(eq(pipelineStages.companyId, ctx.companyId)).orderBy(pipelineStages.position);
}

/* ------------------------------ customers --------------------------------- */

export async function createCustomer(ctx: CompanyContext, raw: unknown) {
  ctx.require("crm.write");
  const input = customerInput.parse(raw);
  return ctx.db.transaction(async (tx) => {
    const [c] = await tx
      .insert(customers)
      .values({ companyId: ctx.companyId, ...input, createdBy: ctx.userId })
      .returning();
    await logActivity(tx, ctx, { customerId: c!.id, kind: "customer_created", body: `Customer "${c!.displayName}" created` });
    return c!;
  });
}

export async function updateCustomer(ctx: CompanyContext, id: string, raw: unknown) {
  ctx.require("crm.write");
  const input = customerInput.partial().parse(raw);
  const [c] = await ctx.db
    .update(customers)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(customers.companyId, ctx.companyId), eq(customers.id, id)))
    .returning();
  if (!c) throw new NotFoundError("Customer");
  return c;
}

export async function deleteCustomer(ctx: CompanyContext, id: string) {
  ctx.require("crm.delete");
  const [c] = await ctx.db
    .delete(customers)
    .where(and(eq(customers.companyId, ctx.companyId), eq(customers.id, id)))
    .returning({ id: customers.id });
  if (!c) throw new NotFoundError("Customer");
}

export async function getCustomer(ctx: CompanyContext, id: string) {
  ctx.require("crm.read");
  const [c] = await ctx.db
    .select()
    .from(customers)
    .where(and(eq(customers.companyId, ctx.companyId), eq(customers.id, id)))
    .limit(1);
  if (!c) throw new NotFoundError("Customer");
  const [contacts, addresses, opps, jobList] = await Promise.all([
    ctx.db
      .select()
      .from(customerContacts)
      .where(and(eq(customerContacts.companyId, ctx.companyId), eq(customerContacts.customerId, id)))
      .orderBy(desc(customerContacts.isPrimary), asc(customerContacts.name)),
    ctx.db
      .select()
      .from(customerAddresses)
      .where(and(eq(customerAddresses.companyId, ctx.companyId), eq(customerAddresses.customerId, id)))
      .orderBy(asc(customerAddresses.createdAt)),
    ctx.db
      .select({ opp: opportunities, stage: pipelineStages })
      .from(opportunities)
      .innerJoin(pipelineStages, eq(pipelineStages.id, opportunities.stageId))
      .where(and(eq(opportunities.companyId, ctx.companyId), eq(opportunities.customerId, id)))
      .orderBy(desc(opportunities.createdAt)),
    ctx.db
      .select()
      .from(jobs)
      .where(and(eq(jobs.companyId, ctx.companyId), eq(jobs.customerId, id)))
      .orderBy(desc(jobs.createdAt)),
  ]);
  return { ...c, contacts, addresses, opportunities: opps, jobs: jobList };
}

export async function listCustomers(ctx: CompanyContext, q?: string) {
  ctx.require("crm.read");
  const where = q
    ? and(eq(customers.companyId, ctx.companyId), ilike(customers.displayName, `%${q}%`))
    : eq(customers.companyId, ctx.companyId);
  return ctx.db
    .select({
      customer: customers,
      openOpportunities: sql<number>`(select count(*) from ${opportunities} o join ${pipelineStages} s on s.id = o.stage_id where o.company_id = "customers"."company_id" and o.customer_id = "customers"."id" and s.kind = 'open')`.mapWith(Number),
      jobs: sql<number>`(select count(*) from ${jobs} j where j.company_id = "customers"."company_id" and j.customer_id = "customers"."id")`.mapWith(Number),
    })
    .from(customers)
    .where(where)
    .orderBy(asc(customers.displayName));
}

export async function addContact(ctx: CompanyContext, customerId: string, raw: unknown) {
  ctx.require("crm.write");
  const input = contactInput.parse(raw);
  await getCustomer(ctx, customerId);
  const [row] = await ctx.db
    .insert(customerContacts)
    .values({ companyId: ctx.companyId, customerId, ...input, email: input.email || null })
    .returning();
  return row!;
}

export async function addAddress(ctx: CompanyContext, customerId: string, raw: unknown) {
  ctx.require("crm.write");
  const input = addressInput.parse(raw);
  await getCustomer(ctx, customerId);
  const [row] = await ctx.db.insert(customerAddresses).values({ companyId: ctx.companyId, customerId, ...input }).returning();
  return row!;
}

/* ---------------------------- opportunities ------------------------------- */

export interface OpportunityFilters {
  q?: string;
  stageId?: string;
  assigneeUserId?: string | "unassigned";
  overdueOnly?: boolean;
  includeClosed?: boolean;
}

export async function listOpportunities(ctx: CompanyContext, f: OpportunityFilters = {}) {
  ctx.require("crm.read");
  const conds: SQL[] = [eq(opportunities.companyId, ctx.companyId)];
  if (f.stageId) conds.push(eq(opportunities.stageId, f.stageId));
  if (f.assigneeUserId === "unassigned") conds.push(isNull(opportunities.assigneeUserId));
  else if (f.assigneeUserId) conds.push(eq(opportunities.assigneeUserId, f.assigneeUserId));
  if (f.overdueOnly) {
    conds.push(lt(opportunities.nextFollowUpOn, todayIso()));
    conds.push(eq(pipelineStages.kind, "open"));
  } else if (!f.includeClosed && !f.stageId) {
    conds.push(eq(pipelineStages.kind, "open"));
  }
  if (f.q) conds.push(or(ilike(opportunities.title, `%${f.q}%`), ilike(customers.displayName, `%${f.q}%`))!);

  return ctx.db
    .select({
      opp: opportunities,
      stage: pipelineStages,
      customerName: customers.displayName,
      assigneeName: user.name,
      jobId: jobs.id,
      jobNumber: jobs.jobNumber,
    })
    .from(opportunities)
    .innerJoin(pipelineStages, eq(pipelineStages.id, opportunities.stageId))
    .innerJoin(customers, eq(customers.id, opportunities.customerId))
    .leftJoin(user, eq(user.id, opportunities.assigneeUserId))
    .leftJoin(jobs, eq(jobs.opportunityId, opportunities.id))
    .where(and(...conds))
    .orderBy(asc(pipelineStages.position), asc(opportunities.nextFollowUpOn), desc(opportunities.createdAt));
}

export async function getOpportunity(ctx: CompanyContext, id: string) {
  ctx.require("crm.read");
  const [row] = await ctx.db
    .select({
      opp: opportunities,
      stage: pipelineStages,
      customer: customers,
      address: customerAddresses,
      assigneeName: user.name,
      job: jobs,
    })
    .from(opportunities)
    .innerJoin(pipelineStages, eq(pipelineStages.id, opportunities.stageId))
    .innerJoin(customers, eq(customers.id, opportunities.customerId))
    .leftJoin(customerAddresses, eq(customerAddresses.id, opportunities.addressId))
    .leftJoin(user, eq(user.id, opportunities.assigneeUserId))
    .leftJoin(jobs, eq(jobs.opportunityId, opportunities.id))
    .where(and(eq(opportunities.companyId, ctx.companyId), eq(opportunities.id, id)))
    .limit(1);
  if (!row) throw new NotFoundError("Opportunity");
  const [taskList, timeline, designs, estimateList] = await Promise.all([
    ctx.db
      .select({ task: tasks, ownerName: user.name })
      .from(tasks)
      .innerJoin(user, eq(user.id, tasks.ownerUserId))
      .where(and(eq(tasks.companyId, ctx.companyId), eq(tasks.opportunityId, id)))
      .orderBy(asc(tasks.completedAt), asc(tasks.dueOn)),
    listActivity(ctx, { opportunityId: id }),
    ctx.db
      .select({ id: deckDesigns.id, name: deckDesigns.name, version: deckDesigns.version, updatedAt: deckDesigns.updatedAt })
      .from(deckDesigns)
      .where(and(eq(deckDesigns.companyId, ctx.companyId), eq(deckDesigns.opportunityId, id)))
      .orderBy(desc(deckDesigns.updatedAt)),
    ctx.db
      .select({ id: estimates.id, title: estimates.title, designId: estimates.designId, createdAt: estimates.createdAt })
      .from(estimates)
      .where(and(eq(estimates.companyId, ctx.companyId), eq(estimates.opportunityId, id)))
      .orderBy(desc(estimates.createdAt)),
  ]);
  return { ...row, tasks: taskList, timeline, designs, estimates: estimateList };
}

export async function createOpportunity(ctx: CompanyContext, raw: unknown) {
  ctx.require("crm.write");
  const input = opportunityInput.parse(raw);
  await getCustomer(ctx, input.customerId);
  await assertMember(ctx, input.assigneeUserId);
  const stages = await listStages(ctx);
  const stageId = input.stageId ?? stages[0]?.id;
  if (!stageId || !stages.some((s) => s.id === stageId)) throw new ValidationError("Unknown stage.");
  return ctx.db.transaction(async (tx) => {
    const [opp] = await tx
      .insert(opportunities)
      .values({ companyId: ctx.companyId, ...input, stageId, createdBy: ctx.userId })
      .returning();
    await logActivity(tx, ctx, {
      customerId: opp!.customerId,
      opportunityId: opp!.id,
      kind: "opportunity_created",
      body: `Inquiry "${opp!.title}" created in ${stages.find((s) => s.id === stageId)!.name}`,
    });
    return opp!;
  });
}

export async function updateOpportunity(ctx: CompanyContext, id: string, raw: unknown) {
  ctx.require("crm.write");
  const input = opportunityUpdate.parse(raw);
  const current = await getOpportunity(ctx, id);
  if (input.assigneeUserId !== undefined) await assertMember(ctx, input.assigneeUserId);
  const stages = await listStages(ctx);
  if (input.stageId && !stages.some((s) => s.id === input.stageId)) throw new ValidationError("Unknown stage.");
  if (input.customerId && input.customerId !== current.opp.customerId) throw new ValidationError("An opportunity cannot be moved to another customer.");

  return ctx.db.transaction(async (tx) => {
    const [opp] = await tx
      .update(opportunities)
      .set({ ...input, customerId: undefined, updatedAt: new Date() })
      .where(and(eq(opportunities.companyId, ctx.companyId), eq(opportunities.id, id)))
      .returning();
    if (!opp) throw new NotFoundError("Opportunity");
    const base = { customerId: opp.customerId, opportunityId: opp.id };
    if (input.stageId && input.stageId !== current.opp.stageId) {
      const to = stages.find((s) => s.id === input.stageId)!;
      await logActivity(tx, ctx, { ...base, kind: "stage_changed", body: `Stage changed: ${current.stage.name} → ${to.name}`, metadata: { from: current.stage.id, to: to.id } });
    }
    if (input.assigneeUserId !== undefined && input.assigneeUserId !== current.opp.assigneeUserId) {
      const members = await listMembers(ctx);
      const name = members.find((m) => m.userId === input.assigneeUserId)?.name ?? "Unassigned";
      await logActivity(tx, ctx, { ...base, kind: "assigned", body: `Assigned to ${name}` });
    }
    if (input.nextFollowUpOn !== undefined && input.nextFollowUpOn !== current.opp.nextFollowUpOn) {
      await logActivity(tx, ctx, { ...base, kind: "follow_up_changed", body: input.nextFollowUpOn ? `Next follow-up set to ${input.nextFollowUpOn}` : "Follow-up cleared" });
    }
    return opp;
  });
}

/* --------------------------------- tasks ---------------------------------- */

export async function addTask(ctx: CompanyContext, opportunityId: string, raw: unknown) {
  ctx.require("crm.write");
  const input = taskInput.parse(raw);
  const opp = await getOpportunity(ctx, opportunityId);
  await assertMember(ctx, input.ownerUserId);
  return ctx.db.transaction(async (tx) => {
    const [t] = await tx
      .insert(tasks)
      .values({ companyId: ctx.companyId, opportunityId, jobId: opp.job?.id ?? null, ...input, createdBy: ctx.userId })
      .returning();
    await logActivity(tx, ctx, { customerId: opp.opp.customerId, opportunityId, kind: "task_added", body: `Task added: "${t!.title}" due ${t!.dueOn}` });
    return t!;
  });
}

export async function completeTask(ctx: CompanyContext, taskId: string, completed = true) {
  ctx.require("crm.write");
  return ctx.db.transaction(async (tx) => {
    const [t] = await tx
      .update(tasks)
      .set({ completedAt: completed ? new Date() : null, completedBy: completed ? ctx.userId : null, updatedAt: new Date() })
      .where(and(eq(tasks.companyId, ctx.companyId), eq(tasks.id, taskId)))
      .returning();
    if (!t) throw new NotFoundError("Task");
    if (t.opportunityId) {
      const [opp] = await tx.select({ customerId: opportunities.customerId }).from(opportunities).where(eq(opportunities.id, t.opportunityId));
      await logActivity(tx, ctx, { customerId: opp!.customerId, opportunityId: t.opportunityId, kind: completed ? "task_completed" : "task_reopened", body: `${completed ? "Completed" : "Reopened"} task "${t.title}"` });
    }
    return t;
  });
}

export async function listMyOpenTasks(ctx: CompanyContext) {
  ctx.require("crm.read");
  return ctx.db
    .select({ task: tasks, opportunityTitle: opportunities.title })
    .from(tasks)
    .leftJoin(opportunities, eq(opportunities.id, tasks.opportunityId))
    .where(and(eq(tasks.companyId, ctx.companyId), eq(tasks.ownerUserId, ctx.userId), isNull(tasks.completedAt)))
    .orderBy(asc(tasks.dueOn));
}

/* -------------------------------- activity -------------------------------- */

export async function addNote(ctx: CompanyContext, opportunityId: string, body: string) {
  ctx.require("crm.write");
  const text = z.string().trim().min(1).max(5000).parse(body);
  const opp = await getOpportunity(ctx, opportunityId);
  await logActivity(ctx.db, ctx, { customerId: opp.opp.customerId, opportunityId, jobId: opp.job?.id ?? null, kind: "note", body: text });
}

export async function listActivity(ctx: CompanyContext, scope: { opportunityId?: string; customerId?: string; jobId?: string }) {
  ctx.require("crm.read");
  const conds: SQL[] = [eq(activities.companyId, ctx.companyId)];
  if (scope.opportunityId) conds.push(eq(activities.opportunityId, scope.opportunityId));
  if (scope.customerId) conds.push(eq(activities.customerId, scope.customerId));
  if (scope.jobId) conds.push(eq(activities.jobId, scope.jobId));
  return ctx.db
    .select({ activity: activities, actorName: user.name })
    .from(activities)
    .leftJoin(user, eq(user.id, activities.actorUserId))
    .where(and(...conds))
    .orderBy(asc(activities.createdAt));
}

/* ------------------------------ conversion -------------------------------- */

/**
 * Convert a won opportunity into a job. Idempotent: repeated calls return the existing job.
 * Two concurrent calls are serialised by the company row lock and the unique index on opportunity_id.
 */
export async function convertToJob(ctx: CompanyContext, opportunityId: string): Promise<{ job: typeof jobs.$inferSelect; created: boolean }> {
  ctx.require("crm.convert_job");
  const opp = await getOpportunity(ctx, opportunityId);
  if (opp.job) return { job: opp.job, created: false };
  if (opp.stage.kind !== "won") throw new ValidationError(`Only opportunities in a Won stage can be converted (currently "${opp.stage.name}").`);

  return ctx.db.transaction(async (tx) => {
    // Serialise conversions per company and reserve the next job number.
    const [co] = await tx.select({ next: companies.nextJobNumber }).from(companies).where(eq(companies.id, ctx.companyId)).for("update");
    const [existing] = await tx.select().from(jobs).where(and(eq(jobs.companyId, ctx.companyId), eq(jobs.opportunityId, opportunityId)));
    if (existing) return { job: existing, created: false };

    const jobNumber = `J-${co!.next}`;
    await tx.update(companies).set({ nextJobNumber: co!.next + 1 }).where(eq(companies.id, ctx.companyId));
    const [job] = await tx
      .insert(jobs)
      .values({
        companyId: ctx.companyId,
        opportunityId,
        customerId: opp.opp.customerId,
        addressId: opp.opp.addressId,
        jobNumber,
        title: opp.opp.title,
        serviceType: opp.opp.serviceType,
        createdBy: ctx.userId,
      })
      .returning();
    await tx.update(deckDesigns).set({ jobId: job!.id }).where(and(eq(deckDesigns.companyId, ctx.companyId), eq(deckDesigns.opportunityId, opportunityId)));
    await tx.update(estimates).set({ jobId: job!.id }).where(and(eq(estimates.companyId, ctx.companyId), eq(estimates.opportunityId, opportunityId)));
    await tx.update(tasks).set({ jobId: job!.id }).where(and(eq(tasks.companyId, ctx.companyId), eq(tasks.opportunityId, opportunityId)));
    await tx.update(activities).set({ jobId: job!.id }).where(and(eq(activities.companyId, ctx.companyId), eq(activities.opportunityId, opportunityId)));
    await logActivity(tx, ctx, {
      customerId: opp.opp.customerId,
      opportunityId,
      jobId: job!.id,
      kind: "converted_to_job",
      body: `Converted to job ${jobNumber}`,
      metadata: { jobId: job!.id },
    });
    return { job: job!, created: true };
  });
}

/* ---------------------------------- jobs ---------------------------------- */

export async function listJobs(ctx: CompanyContext) {
  ctx.require("crm.read");
  return ctx.db
    .select({ job: jobs, customerName: customers.displayName })
    .from(jobs)
    .innerJoin(customers, eq(customers.id, jobs.customerId))
    .where(eq(jobs.companyId, ctx.companyId))
    .orderBy(desc(jobs.createdAt));
}

export async function getJob(ctx: CompanyContext, id: string) {
  ctx.require("crm.read");
  const [row] = await ctx.db
    .select({ job: jobs, customer: customers, address: customerAddresses, opportunity: opportunities })
    .from(jobs)
    .innerJoin(customers, eq(customers.id, jobs.customerId))
    .innerJoin(opportunities, eq(opportunities.id, jobs.opportunityId))
    .leftJoin(customerAddresses, eq(customerAddresses.id, jobs.addressId))
    .where(and(eq(jobs.companyId, ctx.companyId), eq(jobs.id, id)))
    .limit(1);
  if (!row) throw new NotFoundError("Job");
  const [timeline, designs, estimateList, taskList] = await Promise.all([
    listActivity(ctx, { jobId: id }),
    ctx.db.select().from(deckDesigns).where(and(eq(deckDesigns.companyId, ctx.companyId), eq(deckDesigns.jobId, id))),
    ctx.db.select().from(estimates).where(and(eq(estimates.companyId, ctx.companyId), eq(estimates.jobId, id))),
    ctx.db
      .select({ task: tasks, ownerName: user.name })
      .from(tasks)
      .innerJoin(user, eq(user.id, tasks.ownerUserId))
      .where(and(eq(tasks.companyId, ctx.companyId), eq(tasks.jobId, id)))
      .orderBy(asc(tasks.dueOn)),
  ]);
  return { ...row, timeline, designs, estimates: estimateList, tasks: taskList };
}

/* ------------------------------- dashboard -------------------------------- */

export async function dashboard(ctx: CompanyContext) {
  ctx.require("crm.read");
  const [open, overdue, myTasks, jobList] = await Promise.all([
    listOpportunities(ctx),
    listOpportunities(ctx, { overdueOnly: true }),
    listMyOpenTasks(ctx),
    listJobs(ctx),
  ]);
  return { open, overdue, myTasks, jobs: jobList };
}
