import { requireCompanyContext } from "@/lib/request-context";
import { listIntegrations } from "@/modules/integrations/service";
import { ActionForm, InlineAction } from "@/components/ActionForm";
import { Card, Chip, Field, PageHeader } from "@/components/ui";
import { pingIntegrationAction, upsertIntegrationAction } from "../actions";

export default async function IntegrationsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireCompanyContext(slug);
  const items = await listIntegrations(ctx);
  const canManage = ctx.can("integrations.manage");
  return (
    <>
      <PageHeader eyebrow={ctx.companyName} title="CRM integrations">
        This app does not run your pipeline. Projects link to jobs in your CRM, and finished estimates can be pushed back. API keys are never stored in the database: each integration names the environment variable that holds its key.
      </PageHeader>
      <div className="grid gap-5 lg:grid-cols-3">
        {items.map((i) => (
          <Card key={i.provider} title={i.displayName} aside={i.row?.enabled ? <Chip tone="moss">enabled</Chip> : <Chip tone="ink">off</Chip>}>
            <ul className="mb-4 list-disc pl-5 text-[13px] text-ink-2">
              {i.setup.mapping.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
            {i.setup.docsUrl && (
              <a href={i.setup.docsUrl} target="_blank" rel="noreferrer" className="text-[13px] text-slate hover:underline">
                API documentation ↗
              </a>
            )}
            {canManage ? (
              <ActionForm action={upsertIntegrationAction.bind(null, slug)} submitLabel="Save" className="mt-4">
                <input type="hidden" name="provider" value={i.provider} />
                <label className="mb-3 flex items-center gap-2 text-[14px]">
                  <input type="checkbox" name="enabled" defaultChecked={!!i.row?.enabled} className="accent-cedar" /> Enabled
                </label>
                {i.provider !== "other" && (
                  <Field label="Credential environment variable" hint={`e.g. ${i.setup.credentialEnvHint.replace("<company>", ctx.companySlug.toUpperCase().replace(/-/g, "_"))}`}>
                    <input name="credentialRef" defaultValue={i.row?.credentialRef ?? ""} className="field num" pattern="[A-Z][A-Z0-9_]{2,80}" />
                  </Field>
                )}
              </ActionForm>
            ) : (
              <div className="mt-3 text-[13px] text-ink-3">{i.row?.credentialRef ? `Credential: ${i.row.credentialRef}` : "Not configured."}</div>
            )}
            {canManage && i.provider !== "other" && (
              <div className="mt-3">
                <InlineAction action={pingIntegrationAction.bind(null, slug, i.provider)} className="btn btn-ghost btn-sm">
                  Test connection
                </InlineAction>
              </div>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
