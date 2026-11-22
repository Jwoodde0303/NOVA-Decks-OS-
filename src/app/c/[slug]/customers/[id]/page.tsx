import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCompanyContext } from "@/lib/request-context";
import { getCustomer } from "@/modules/crm/service";
import { NotFoundError } from "@/modules/core/errors";
import { ActionForm } from "@/components/ActionForm";
import { Card, Chip, DateText, Empty, Field, LinkButton, PageHeader, stageTone } from "@/components/ui";
import { addAddressAction, addContactAction, updateCustomerAction } from "../../actions";

export default async function CustomerPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const ctx = await requireCompanyContext(slug);
  let c: Awaited<ReturnType<typeof getCustomer>>;
  try {
    c = await getCustomer(ctx, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const base = `/c/${slug}`;
  return (
    <>
      <PageHeader eyebrow="Customer" title={c.displayName} actions={<LinkButton href={`${base}/opportunities/new?customer=${c.id}`} variant="primary">New inquiry</LinkButton>}>
        <span className="capitalize">{c.kind}</span> · since <DateText value={c.createdAt} />
      </PageHeader>
      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-5">
          <Card title="Opportunities">
            {c.opportunities.length === 0 ? (
              <Empty>No opportunities yet.</Empty>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Stage</th>
                    <th>Follow-up</th>
                  </tr>
                </thead>
                <tbody>
                  {c.opportunities.map((r) => (
                    <tr key={r.opp.id}>
                      <td>
                        <Link href={`${base}/opportunities/${r.opp.id}`} className="font-medium hover:underline">
                          {r.opp.title}
                        </Link>
                      </td>
                      <td>
                        <Chip tone={stageTone(r.stage.kind)}>{r.stage.name}</Chip>
                      </td>
                      <td>
                        <DateText value={r.opp.nextFollowUpOn} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          <Card title="Jobs">
            {c.jobs.length === 0 ? (
              <Empty>No jobs yet.</Empty>
            ) : (
              <ul className="divide-y divide-line/70">
                {c.jobs.map((j) => (
                  <li key={j.id} className="flex items-center justify-between py-2">
                    <Link href={`${base}/jobs/${j.id}`} className="font-medium hover:underline">
                      <span className="num mr-2 text-slate">{j.jobNumber}</span>
                      {j.title}
                    </Link>
                    <Chip tone={j.status === "active" ? "moss" : "ink"}>{j.status}</Chip>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Details">
            <ActionForm action={updateCustomerAction.bind(null, slug, id)} submitLabel="Save details">
              <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
                <Field label="Name">
                  <input name="displayName" defaultValue={c.displayName} required className="field" />
                </Field>
                <Field label="Type">
                  <select name="kind" defaultValue={c.kind} className="field">
                    <option value="residential">Residential</option>
                    <option value="commercial">Commercial</option>
                  </select>
                </Field>
              </div>
              <div className="mt-4">
                <Field label="Notes">
                  <textarea name="notes" rows={3} defaultValue={c.notes ?? ""} className="field" />
                </Field>
              </div>
            </ActionForm>
          </Card>
        </div>
        <div className="space-y-5">
          <Card title="Contacts">
            {c.contacts.length === 0 ? (
              <div className="mb-3 text-[13px] text-ink-3">No contacts.</div>
            ) : (
              <ul className="mb-4 divide-y divide-line/70 text-[14px]">
                {c.contacts.map((ct) => (
                  <li key={ct.id} className="py-2">
                    <div className="font-medium">
                      {ct.name} {ct.isPrimary && <Chip tone="cedar">Primary</Chip>}
                    </div>
                    <div className="text-[13px] text-ink-2">
                      {ct.role && <div>{ct.role}</div>}
                      {ct.phone && <div className="num">{ct.phone}</div>}
                      {ct.email && <div>{ct.email}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <ActionForm action={addContactAction.bind(null, slug, id)} submitLabel="Add contact" resetOnSuccess>
              <div className="space-y-2">
                <input name="name" required placeholder="Name" className="field" />
                <input name="role" placeholder="Role (e.g. spouse, property manager)" className="field" />
                <input name="phone" placeholder="Phone" className="field" />
                <input name="email" type="email" placeholder="Email" className="field" />
                <label className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" name="isPrimary" className="accent-cedar" /> Primary contact
                </label>
              </div>
            </ActionForm>
          </Card>
          <Card title="Project addresses">
            {c.addresses.length === 0 ? (
              <div className="mb-3 text-[13px] text-ink-3">No addresses.</div>
            ) : (
              <ul className="mb-4 divide-y divide-line/70 text-[14px]">
                {c.addresses.map((a) => (
                  <li key={a.id} className="py-2">
                    <div className="text-[12px] uppercase tracking-[0.08em] text-ink-3">{a.label}</div>
                    <div>
                      {a.line1}
                      {a.line2 && <>, {a.line2}</>}
                    </div>
                    <div>
                      {a.city}, {a.region} {a.postalCode}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <ActionForm action={addAddressAction.bind(null, slug, id)} submitLabel="Add address" resetOnSuccess>
              <div className="space-y-2">
                <input name="label" placeholder="Label (Project site)" className="field" />
                <input name="line1" required placeholder="Street" className="field" />
                <div className="grid grid-cols-[2fr_1fr_1fr] gap-2">
                  <input name="city" required placeholder="City" className="field" />
                  <input name="region" required placeholder="ST" className="field" />
                  <input name="postalCode" required placeholder="ZIP" className="field" />
                </div>
              </div>
            </ActionForm>
          </Card>
        </div>
      </div>
    </>
  );
}
