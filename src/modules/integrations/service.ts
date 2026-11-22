import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { integrations, CRM_PROVIDERS } from "@/db/schema";
import type { CompanyContext } from "@/modules/core/context";
import { adapterFor } from "./adapters";

export const integrationInput = z.object({
  provider: z.enum(CRM_PROVIDERS),
  enabled: z.boolean(),
  /** Name of the environment variable / secret holding the API key. Never the key itself. */
  credentialRef: z
    .string()
    .trim()
    .regex(/^[A-Z][A-Z0-9_]{2,80}$/, "Use an environment variable name like JOBTREAD_API_KEY_NOVA")
    .optional()
    .nullable(),
  settings: z.record(z.string(), z.unknown()).default({}),
});

export async function listIntegrations(ctx: CompanyContext) {
  ctx.require("projects.read");
  const rows = await ctx.db.select().from(integrations).where(eq(integrations.companyId, ctx.companyId));
  return CRM_PROVIDERS.map((provider) => {
    const row = rows.find((r) => r.provider === provider) ?? null;
    const adapter = adapterFor(provider, row?.credentialRef ?? null);
    return { provider, displayName: adapter.displayName, setup: adapter.setup, row };
  });
}

export async function upsertIntegration(ctx: CompanyContext, raw: unknown) {
  ctx.require("integrations.manage");
  const input = integrationInput.parse(raw);
  if (input.credentialRef && /key|secret|token/i.test(input.credentialRef) && input.credentialRef.length > 60) throw new Error("credentialRef must be a variable name, not a secret value");
  const [row] = await ctx.db
    .insert(integrations)
    .values({ companyId: ctx.companyId, provider: input.provider, enabled: input.enabled, credentialRef: input.credentialRef ?? null, settings: input.settings })
    .onConflictDoUpdate({ target: [integrations.companyId, integrations.provider], set: { enabled: input.enabled, credentialRef: input.credentialRef ?? null, settings: input.settings, updatedAt: new Date() } })
    .returning();
  return row!;
}

export async function pingIntegration(ctx: CompanyContext, provider: (typeof CRM_PROVIDERS)[number]) {
  ctx.require("integrations.manage");
  const [row] = await ctx.db.select().from(integrations).where(and(eq(integrations.companyId, ctx.companyId), eq(integrations.provider, provider)));
  return adapterFor(provider, row?.credentialRef ?? null).ping();
}
