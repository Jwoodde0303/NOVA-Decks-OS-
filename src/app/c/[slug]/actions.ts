"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import type { ActionState } from "@/components/ActionForm";
import { getSessionUser } from "@/lib/request-context";
import { buildCompanyContext, type CompanyContext } from "@/modules/core/context";
import { AppError, ValidationError } from "@/modules/core/errors";
import * as crm from "@/modules/crm/service";
import { saveDesign } from "@/modules/design/service";
import { createDraftRevision } from "@/modules/estimating/service";

async function withCtx<T>(slug: string, fn: (ctx: CompanyContext) => Promise<T>): Promise<T | ActionState> {
  try {
    const user = await getSessionUser();
    const ctx = await buildCompanyContext(user?.id, slug);
    return await fn(ctx);
  } catch (e) {
    if (e instanceof ZodError) return { error: "Please check the highlighted fields.", issues: e.issues.map((i) => `${i.path.join(".") || "form"}: ${i.message}`) };
    if (e instanceof ValidationError) return { error: e.message, issues: e.issues.filter((i) => i !== e.message) };
    if (e instanceof AppError) return { error: e.message };
    throw e;
  }
}

const str = (fd: FormData, k: string) => (fd.get(k) == null ? undefined : String(fd.get(k)).trim());
const opt = (fd: FormData, k: string) => (str(fd, k) ? str(fd, k) : null);

/* ------------------------------ customers --------------------------------- */

export async function createCustomerAction(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const r = await withCtx(slug, async (ctx) => {
    const c = await crm.createCustomer(ctx, { displayName: str(fd, "displayName"), kind: str(fd, "kind") || "residential", notes: opt(fd, "notes") });
    const line1 = str(fd, "line1");
    if (line1) {
      await crm.addAddress(ctx, c.id, { label: str(fd, "label") || "Project site", line1, line2: opt(fd, "line2"), city: str(fd, "city"), region: str(fd, "region"), postalCode: str(fd, "postalCode") });
    }
    const contactName = str(fd, "contactName");
    if (contactName) {
      await crm.addContact(ctx, c.id, { name: contactName, email: opt(fd, "contactEmail"), phone: opt(fd, "contactPhone"), isPrimary: true });
    }
    return c.id;
  });
  if (typeof r === "string") redirect(`/c/${slug}/customers/${r}`);
  return r;
}

export async function updateCustomerAction(slug: string, id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const r = await withCtx(slug, async (ctx) => {
    await crm.updateCustomer(ctx, id, { displayName: str(fd, "displayName"), kind: str(fd, "kind"), notes: opt(fd, "notes") });
    revalidatePath(`/c/${slug}/customers/${id}`);
    return { ok: true };
  });
  return r;
}

export async function addContactAction(slug: string, customerId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return withCtx(slug, async (ctx) => {
    await crm.addContact(ctx, customerId, { name: str(fd, "name"), role: opt(fd, "role"), email: opt(fd, "email"), phone: opt(fd, "phone"), isPrimary: fd.get("isPrimary") === "on" });
    revalidatePath(`/c/${slug}/customers/${customerId}`);
    return { ok: true };
  });
}

export async function addAddressAction(slug: string, customerId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return withCtx(slug, async (ctx) => {
    await crm.addAddress(ctx, customerId, { label: str(fd, "label") || "Project site", line1: str(fd, "line1"), line2: opt(fd, "line2"), city: str(fd, "city"), region: str(fd, "region"), postalCode: str(fd, "postalCode") });
    revalidatePath(`/c/${slug}/customers/${customerId}`);
    return { ok: true };
  });
}

/* ---------------------------- opportunities ------------------------------- */

export async function createOpportunityAction(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const r = await withCtx(slug, async (ctx) => {
    let customerId = str(fd, "customerId");
    if (!customerId && str(fd, "newCustomerName")) {
      const c = await crm.createCustomer(ctx, { displayName: str(fd, "newCustomerName") });
      customerId = c.id;
      if (str(fd, "contactPhone") || str(fd, "contactEmail")) {
        await crm.addContact(ctx, c.id, { name: str(fd, "newCustomerName")!, phone: opt(fd, "contactPhone"), email: opt(fd, "contactEmail"), isPrimary: true });
      }
    }
    if (!customerId) throw new ValidationError("Choose an existing customer or enter a new customer name.");
    let addressId = opt(fd, "addressId");
    if (!addressId && str(fd, "line1")) {
      const a = await crm.addAddress(ctx, customerId, { line1: str(fd, "line1"), city: str(fd, "city"), region: str(fd, "region"), postalCode: str(fd, "postalCode") });
      addressId = a.id;
    }
    const opp = await crm.createOpportunity(ctx, {
      customerId,
      addressId,
      title: str(fd, "title"),
      serviceType: str(fd, "serviceType"),
      leadSource: str(fd, "leadSource"),
      stageId: opt(fd, "stageId") ?? undefined,
      assigneeUserId: opt(fd, "assigneeUserId"),
      nextFollowUpOn: opt(fd, "nextFollowUpOn"),
    });
    return opp.id;
  });
  if (typeof r === "string") redirect(`/c/${slug}/opportunities/${r}`);
  return r;
}

export async function updateOpportunityAction(slug: string, id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return withCtx(slug, async (ctx) => {
    const patch: Record<string, unknown> = {};
    for (const k of ["title", "serviceType", "leadSource", "stageId"]) if (fd.has(k)) patch[k] = str(fd, k);
    for (const k of ["assigneeUserId", "nextFollowUpOn", "lostReason", "addressId"]) if (fd.has(k)) patch[k] = opt(fd, k);
    await crm.updateOpportunity(ctx, id, patch);
    revalidatePath(`/c/${slug}/opportunities/${id}`);
    revalidatePath(`/c/${slug}/opportunities`);
    return { ok: true };
  });
}

export async function addNoteAction(slug: string, id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return withCtx(slug, async (ctx) => {
    await crm.addNote(ctx, id, str(fd, "body") ?? "");
    revalidatePath(`/c/${slug}/opportunities/${id}`);
    return { ok: true };
  });
}

export async function addTaskAction(slug: string, id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return withCtx(slug, async (ctx) => {
    await crm.addTask(ctx, id, { title: str(fd, "title"), ownerUserId: str(fd, "ownerUserId"), dueOn: str(fd, "dueOn") });
    revalidatePath(`/c/${slug}/opportunities/${id}`);
    return { ok: true };
  });
}

export async function toggleTaskAction(slug: string, taskId: string, completed: boolean, backTo: string): Promise<ActionState> {
  return withCtx(slug, async (ctx) => {
    await crm.completeTask(ctx, taskId, completed);
    revalidatePath(backTo);
    return { ok: true };
  });
}

export async function convertToJobAction(slug: string, id: string): Promise<ActionState> {
  const r = await withCtx(slug, async (ctx) => (await crm.convertToJob(ctx, id)).job.id);
  if (typeof r === "string") {
    revalidatePath(`/c/${slug}/opportunities/${id}`);
    redirect(`/c/${slug}/jobs/${r}`);
  }
  return r;
}

/* ----------------------------- design / estimate -------------------------- */

export async function saveDesignAction(slug: string, input: { id: string | null; opportunityId: string; name: string; model: unknown }): Promise<{ id: string; version: number } | ActionState> {
  return withCtx(slug, async (ctx) => {
    const d = await saveDesign(ctx, input);
    revalidatePath(`/c/${slug}/opportunities/${input.opportunityId}`);
    return { id: d.id, version: d.version };
  });
}

export async function createRevisionAction(slug: string, input: { designId: string; catalogProductId: string; estimateId?: string | null }): Promise<{ estimateId: string; revisionNumber: number } | ActionState> {
  return withCtx(slug, async (ctx) => {
    const rev = await createDraftRevision(ctx, input);
    revalidatePath(`/c/${slug}/estimates/${rev.estimateId}`);
    return { estimateId: rev.estimateId, revisionNumber: rev.revisionNumber };
  });
}
