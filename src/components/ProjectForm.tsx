import { CRM_PROVIDERS, type projects } from "@/db/schema";
import { PROVIDER_LABEL } from "@/modules/integrations/adapters";
import { Card, Field } from "@/components/ui";

type Project = typeof projects.$inferSelect;

/** Shared field set for creating and editing a project (used inside an ActionForm). */
export function ProjectFields({ p }: { p?: Project | null }) {
  return (
    <div className="space-y-5">
      <Card title="Project">
        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <Field label="Project name">
            <input name="name" required defaultValue={p?.name ?? ""} className="field" placeholder="Chen residence — rear composite deck" />
          </Field>
          <Field label="Jurisdiction" hint="Framing rules are generated for this jurisdiction.">
            <input name="jurisdiction" defaultValue={p?.jurisdiction ?? "Fairfax County, VA"} className="field" />
          </Field>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Field label="Client name">
            <input name="clientName" defaultValue={p?.clientName ?? ""} className="field" />
          </Field>
          <Field label="Client phone">
            <input name="clientPhone" defaultValue={p?.clientPhone ?? ""} className="field" />
          </Field>
          <Field label="Client email">
            <input name="clientEmail" type="email" defaultValue={p?.clientEmail ?? ""} className="field" />
          </Field>
        </div>
      </Card>
      <Card title="Site address">
        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <Field label="Street">
            <input name="siteLine1" defaultValue={p?.siteLine1 ?? ""} className="field" />
          </Field>
          <Field label="Line 2">
            <input name="siteLine2" defaultValue={p?.siteLine2 ?? ""} className="field" />
          </Field>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Field label="City">
            <input name="siteCity" defaultValue={p?.siteCity ?? ""} className="field" />
          </Field>
          <Field label="State">
            <input name="siteRegion" defaultValue={p?.siteRegion ?? ""} className="field" />
          </Field>
          <Field label="ZIP">
            <input name="sitePostalCode" defaultValue={p?.sitePostalCode ?? ""} className="field" />
          </Field>
        </div>
      </Card>
      <Card title="CRM link">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_2fr]">
          <Field label="CRM">
            <select name="crmProvider" className="field" defaultValue={p?.externalCrm?.provider ?? ""}>
              <option value="">Not linked</option>
              {CRM_PROVIDERS.map((c) => (
                <option key={c} value={c}>
                  {PROVIDER_LABEL[c]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Job ID in the CRM">
            <input name="crmExternalId" defaultValue={p?.externalCrm?.externalId ?? ""} className="field num" />
          </Field>
          <Field label="Job URL (optional)">
            <input name="crmUrl" type="url" defaultValue={p?.externalCrm?.url ?? ""} className="field" placeholder="https://app.jobtread.com/jobs/…" />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Notes">
            <textarea name="notes" rows={2} defaultValue={p?.notes ?? ""} className="field" />
          </Field>
        </div>
      </Card>
    </div>
  );
}
