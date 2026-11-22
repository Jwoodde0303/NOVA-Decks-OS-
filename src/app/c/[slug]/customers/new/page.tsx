import { requireCompanyContext } from "@/lib/request-context";
import { ActionForm } from "@/components/ActionForm";
import { Card, Field, PageHeader } from "@/components/ui";
import { createCustomerAction } from "../../actions";

export default async function NewCustomerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireCompanyContext(slug);
  return (
    <>
      <PageHeader eyebrow="CRM" title="New customer" />
      <div className="max-w-[720px]">
        <ActionForm action={createCustomerAction.bind(null, slug)} submitLabel="Create customer">
          <div className="space-y-5">
            <Card title="Customer">
              <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
                <Field label="Name">
                  <input name="displayName" required className="field" placeholder="Household or business name" />
                </Field>
                <Field label="Type">
                  <select name="kind" className="field" defaultValue="residential">
                    <option value="residential">Residential</option>
                    <option value="commercial">Commercial</option>
                  </select>
                </Field>
              </div>
              <div className="mt-4">
                <Field label="Notes">
                  <textarea name="notes" rows={2} className="field" />
                </Field>
              </div>
            </Card>
            <Card title="Primary contact">
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Name">
                  <input name="contactName" className="field" />
                </Field>
                <Field label="Phone">
                  <input name="contactPhone" className="field" />
                </Field>
                <Field label="Email">
                  <input name="contactEmail" type="email" className="field" />
                </Field>
              </div>
            </Card>
            <Card title="Project address">
              <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
                <Field label="Street">
                  <input name="line1" className="field" />
                </Field>
                <Field label="Unit / line 2">
                  <input name="line2" className="field" />
                </Field>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
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
          </div>
        </ActionForm>
      </div>
    </>
  );
}
