import { eq } from "drizzle-orm";
import { z } from "zod";
import { companies, DEFAULT_COMPANY_SETTINGS, type CompanySettings } from "@/db/schema";
import type { CompanyContext } from "./context";

export const companySettingsInput = z.object({
  wastePct: z.number().min(0).max(50),
  markupPct: z.number().min(0).max(200),
  materialTaxPct: z.number().min(0).max(30),
  framingRuleset: z.string().min(1).default(DEFAULT_COMPANY_SETTINGS.framingRuleset),
});

export async function getCompanySettings(ctx: CompanyContext): Promise<CompanySettings> {
  const [c] = await ctx.db.select({ settings: companies.settings }).from(companies).where(eq(companies.id, ctx.companyId));
  return { ...DEFAULT_COMPANY_SETTINGS, ...(c?.settings ?? {}) };
}

export async function updateCompanySettings(ctx: CompanyContext, raw: unknown): Promise<CompanySettings> {
  ctx.require("company.manage_settings");
  const input = companySettingsInput.parse(raw);
  const [c] = await ctx.db.update(companies).set({ settings: input, updatedAt: new Date() }).where(eq(companies.id, ctx.companyId)).returning({ settings: companies.settings });
  return c!.settings;
}
