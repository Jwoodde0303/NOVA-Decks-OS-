"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import type { ActionState } from "@/components/ActionForm";
import { getSessionUser } from "@/lib/request-context";
import { buildCompanyContext, type CompanyContext } from "@/modules/core/context";
import { AppError, ValidationError } from "@/modules/core/errors";
import { updateCompanySettings } from "@/modules/core/company";
import { archiveProject, createProject, updateProject } from "@/modules/projects/service";
import { saveDesign } from "@/modules/design/service";
import { createRevision, setEstimateStatus } from "@/modules/estimating/service";
import { PRICE_BOOK_CATALOG, setPriceBookItem, setProductPrice } from "@/modules/estimating/pricing";
import { pingIntegration, upsertIntegration } from "@/modules/integrations/service";
import type { CRM_PROVIDERS, ESTIMATE_STATUSES } from "@/db/schema";

async function withCtx<T>(slug: string, fn: (ctx: CompanyContext) => Promise<T>): Promise<T | ActionState> {
  try {
    const user = await getSessionUser();
    const ctx = await buildCompanyContext(user?.id, slug);
    return await fn(ctx);
  } catch (e) {
    if (e instanceof ZodError) return { error: "Please check the highlighted fields.", issues: e.issues.map((i) => `${i.path.join(".") || "form"}: ${i.message}`) };
    if (e instanceof ValidationError) return { error: e.message, issues: e.issues.filter((i) => i !== e.message) };
    if (e instanceof AppError) return { error: e.message };
    if (e instanceof Error && e.name === "IntegrationNotConfiguredError") return { error: e.message };
    throw e;
  }
}

const str = (fd: FormData, k: string) => (fd.get(k) == null ? undefined : String(fd.get(k)).trim());
const opt = (fd: FormData, k: string) => (str(fd, k) ? str(fd, k) : null);
const num = (fd: FormData, k: string) => Number(String(fd.get(k) ?? "").replace(/[$,]/g, ""));
const cents = (fd: FormData, k: string) => Math.round(num(fd, k) * 100);

/* ------------------------------- projects --------------------------------- */

function projectFields(fd: FormData) {
  const provider = opt(fd, "crmProvider") as (typeof CRM_PROVIDERS)[number] | null;
  const externalId = opt(fd, "crmExternalId");
  return {
    name: str(fd, "name"),
    clientName: opt(fd, "clientName"),
    clientPhone: opt(fd, "clientPhone"),
    clientEmail: opt(fd, "clientEmail"),
    siteLine1: opt(fd, "siteLine1"),
    siteLine2: opt(fd, "siteLine2"),
    siteCity: opt(fd, "siteCity"),
    siteRegion: opt(fd, "siteRegion"),
    sitePostalCode: opt(fd, "sitePostalCode"),
    jurisdiction: str(fd, "jurisdiction") || undefined,
    notes: opt(fd, "notes"),
    externalCrm: provider && externalId ? { provider, externalId, url: opt(fd, "crmUrl"), label: opt(fd, "crmLabel") } : null,
  };
}

export async function createProjectAction(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const r = await withCtx(slug, async (ctx) => (await createProject(ctx, projectFields(fd))).id);
  if (typeof r === "string") redirect(`/c/${slug}/projects/${r}`);
  return r;
}

export async function updateProjectAction(slug: string, id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return withCtx(slug, async (ctx) => {
    await updateProject(ctx, id, projectFields(fd));
    revalidatePath(`/c/${slug}/projects/${id}`);
    return { ok: true };
  });
}

export async function archiveProjectAction(slug: string, id: string, archived: boolean): Promise<ActionState> {
  return withCtx(slug, async (ctx) => {
    await archiveProject(ctx, id, archived);
    revalidatePath(`/c/${slug}`);
    revalidatePath(`/c/${slug}/projects/${id}`);
    return { ok: true };
  });
}

/* ----------------------------- design / estimate -------------------------- */

export async function saveDesignAction(slug: string, input: { id: string | null; projectId: string; name: string; model: unknown }): Promise<{ id: string; version: number } | ActionState> {
  return withCtx(slug, async (ctx) => {
    const d = await saveDesign(ctx, input);
    revalidatePath(`/c/${slug}/projects/${input.projectId}`);
    return { id: d.id, version: d.version };
  });
}

export async function createRevisionAction(slug: string, input: { designId: string; estimateId?: string | null }): Promise<{ estimateId: string; revisionNumber: number; warnings: string[]; totalCents: number } | ActionState> {
  return withCtx(slug, async (ctx) => {
    const rev = await createRevision(ctx, input);
    revalidatePath(`/c/${slug}/estimates/${rev.estimateId}`);
    return { estimateId: rev.estimateId, revisionNumber: rev.revisionNumber, warnings: rev.warnings, totalCents: rev.totalCents };
  });
}

export async function setEstimateStatusAction(slug: string, estimateId: string, status: (typeof ESTIMATE_STATUSES)[number]): Promise<ActionState> {
  return withCtx(slug, async (ctx) => {
    await setEstimateStatus(ctx, estimateId, status);
    revalidatePath(`/c/${slug}/estimates/${estimateId}`);
    return { ok: true };
  });
}

/* --------------------------------- pricing -------------------------------- */

export async function setProductPriceAction(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return withCtx(slug, async (ctx) => {
    await setProductPrice(ctx, { catalogProductId: str(fd, "catalogProductId"), unitPriceCents: cents(fd, "price"), source: str(fd, "source") || "manual", effectiveOn: str(fd, "effectiveOn") });
    revalidatePath(`/c/${slug}/pricing`);
    return { ok: true };
  });
}

export async function setPriceBookItemAction(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return withCtx(slug, async (ctx) => {
    const key = str(fd, "key");
    const def = PRICE_BOOK_CATALOG.find((i) => i.key === key);
    await setPriceBookItem(ctx, { key, category: str(fd, "category") || def?.category, description: str(fd, "description") || def?.description, unit: str(fd, "unit") || def?.unit, unitPriceCents: cents(fd, "price"), source: str(fd, "source") || "manual", effectiveOn: str(fd, "effectiveOn") });
    revalidatePath(`/c/${slug}/pricing`);
    return { ok: true };
  });
}

export async function updateCompanySettingsAction(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return withCtx(slug, async (ctx) => {
    await updateCompanySettings(ctx, { wastePct: num(fd, "wastePct"), markupPct: num(fd, "markupPct"), materialTaxPct: num(fd, "materialTaxPct"), framingRuleset: str(fd, "framingRuleset") || undefined });
    revalidatePath(`/c/${slug}/pricing`);
    return { ok: true };
  });
}

/* ------------------------------ integrations ------------------------------ */

export async function upsertIntegrationAction(slug: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return withCtx(slug, async (ctx) => {
    await upsertIntegration(ctx, { provider: str(fd, "provider"), enabled: fd.get("enabled") === "on", credentialRef: opt(fd, "credentialRef"), settings: {} });
    revalidatePath(`/c/${slug}/integrations`);
    return { ok: true };
  });
}

export async function pingIntegrationAction(slug: string, provider: (typeof CRM_PROVIDERS)[number]): Promise<ActionState> {
  return withCtx(slug, async (ctx) => {
    const r = await pingIntegration(ctx, provider);
    return r.ok ? { ok: true } : { error: r.detail };
  });
}
