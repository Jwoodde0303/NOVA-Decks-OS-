import { requireCompanyContext } from "@/lib/request-context";
import { listCustomers, listMembers, listStages } from "@/modules/crm/service";
import { LEAD_SOURCES, SERVICE_TYPES } from "@/db/schema";
import { ActionForm } from "@/components/ActionForm";
import { Card, Field, PageHeader } from "@/components/ui";
import { createOpportunityAction } from "../../actions";
import { SERVICE_LABEL, SOURCE_LABEL } from "@/modules/crm/labels";

export default async function NewOpportunityPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ customer?: string }> }) {
  const { slug } = await params;
  const { customer } = await searchParams;
  const ctx = await requireCompanyContext(slug);
  const [customers, members, stages] = await Promise.all([listCustomers(ctx), listMembers(ctx), listStages(ctx)]);
  const action = createOpportunityAction.bind(null, slug);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader eyebrow="CRM" title="New inquiry">Capture the lead now; details can be filled in later.</PageHeader>
      <div className="max-w-[760px]">
        <ActionForm action={action} submitLabel="Create inquiry">
          <div className="grid gap-5 md:grid-cols-2">
            <Card title="Customer" className="md:col-span-2">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Existing customer">
                  <select name="customerId" className="field" defaultValue={customer ?? ""}>
                    <option value="">— New customer —</option>
                    {customers.map((c) => (
                      <option key={c.customer.id} value={c.customer.id}>
                        {c.customer.displayName}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Or new customer name">
                  <input name="newCustomerName" className="field" placeholder="e.g. Avery & Morgan Chen" />
                </Field>
                <Field label="Phone">
                  <input name="contactPhone" className="field" />
                </Field>
                <Field label="Email">
                  <input name="contactEmail" type="email" className="field" />
                </Field>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-[2fr_1fr_1fr_1fr]">
                <Field label="Project address" hint="Optional now; required before a job.">
                  <input name="line1" className="field" placeholder="Street" />
                </Field>
                <Field label="City">
                  <input name="city" className="field" />
                </Field>
                <Field label="State">
                  <input name="region" className="field" />
                </Field>
                <Field label="ZIP">
                  <input name="postalCode" className="field" />
                </Field>
              </div>
            </Card>
            <Card title="Opportunity" className="md:col-span-2">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Title">
                  <input name="title" required className="field" placeholder="Backyard composite deck" />
                </Field>
                <Field label="Service type">
                  <select name="serviceType" className="field" defaultValue="deck">
                    {SERVICE_TYPES.map((s) => (
                      <option key={s} value={s}>
                        {SERVICE_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Lead source">
                  <select name="leadSource" className="field" defaultValue="referral">
                    {LEAD_SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {SOURCE_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Stage">
                  <select name="stageId" className="field" defaultValue={stages[0]?.id}>
                    {stages.filter((s) => s.kind === "open").map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Assign to">
                  <select name="assigneeUserId" className="field" defaultValue={ctx.userId}>
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Next follow-up">
                  <input name="nextFollowUpOn" type="date" className="field num" defaultValue={today} />
                </Field>
              </div>
            </Card>
          </div>
        </ActionForm>
      </div>
    </>
  );
}
