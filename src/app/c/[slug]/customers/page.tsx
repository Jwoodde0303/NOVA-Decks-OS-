import Link from "next/link";
import { requireCompanyContext } from "@/lib/request-context";
import { listCustomers } from "@/modules/crm/service";
import { Empty, LinkButton, PageHeader } from "@/components/ui";

export default async function CustomersPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ q?: string }> }) {
  const { slug } = await params;
  const { q } = await searchParams;
  const ctx = await requireCompanyContext(slug);
  const rows = await listCustomers(ctx, q || undefined);
  const base = `/c/${slug}`;
  return (
    <>
      <PageHeader eyebrow="CRM" title="Customers" actions={<LinkButton href={`${base}/customers/new`} variant="primary">New customer</LinkButton>} />
      <form className="mb-4 flex gap-2" method="get">
        <input name="q" defaultValue={q ?? ""} placeholder="Search by name" className="field max-w-[320px]" />
        <button className="btn btn-secondary" type="submit">
          Search
        </button>
      </form>
      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-4">
            <Empty>No customers found.</Empty>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Type</th>
                <th className="text-right">Open opportunities</th>
                <th className="text-right">Jobs</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.customer.id}>
                  <td>
                    <Link href={`${base}/customers/${r.customer.id}`} className="font-medium hover:underline">
                      {r.customer.displayName}
                    </Link>
                  </td>
                  <td className="capitalize">{r.customer.kind}</td>
                  <td className="num text-right">{r.openOpportunities}</td>
                  <td className="num text-right">{r.jobs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
