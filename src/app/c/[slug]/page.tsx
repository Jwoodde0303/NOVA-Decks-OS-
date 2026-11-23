import Link from "next/link";
import { requireCompanyContext } from "@/lib/request-context";
import { listProjects } from "@/modules/projects/service";
import { PROVIDER_LABEL } from "@/modules/integrations/adapters";
import { Chip, DateText, Empty, LinkButton, Money, PageHeader } from "@/components/ui";

export default async function ProjectsPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ q?: string; archived?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const ctx = await requireCompanyContext(slug);
  const rows = await listProjects(ctx, { q: sp.q || undefined, includeArchived: sp.archived === "1" });
  const base = `/c/${slug}`;
  return (
    <>
      <PageHeader eyebrow={ctx.companyName} title="Projects" actions={<LinkButton href={`${base}/projects/new`} variant="primary">New project</LinkButton>}>
        Each project holds the deck designs and estimate revisions for one job in your CRM.
      </PageHeader>
      <form className="mb-4 flex flex-wrap items-end gap-3" method="get">
        <div className="w-[280px]">
          <label className="lbl">Search</label>
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Project, client or number" className="field" />
        </div>
        <label className="flex h-9 items-center gap-2 text-[14px]">
          <input type="checkbox" name="archived" value="1" defaultChecked={sp.archived === "1"} className="accent-cedar" /> Include archived
        </label>
        <button className="btn btn-secondary" type="submit">
          Filter
        </button>
      </form>
      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-4">
            <Empty>No projects yet. Create one and link it to the job in your CRM.</Empty>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>#</th>
                <th>Project</th>
                <th>Client</th>
                <th>CRM</th>
                <th className="text-right">Designs</th>
                <th className="text-right">Estimates</th>
                <th className="text-right">Latest total</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.project.id}>
                  <td className="num text-slate">{r.project.projectNumber}</td>
                  <td>
                    <Link href={`${base}/projects/${r.project.id}`} className="font-medium hover:underline">
                      {r.project.name}
                    </Link>
                    {r.project.status === "archived" && (
                      <span className="ml-2">
                        <Chip tone="ink">archived</Chip>
                      </span>
                    )}
                    <div className="text-[12px] text-ink-3">{[r.project.siteCity, r.project.siteRegion].filter(Boolean).join(", ")}</div>
                  </td>
                  <td>{r.project.clientName ?? <span className="text-ink-3">—</span>}</td>
                  <td>
                    {r.project.externalCrm ? (
                      <Chip tone="slate">
                        {PROVIDER_LABEL[r.project.externalCrm.provider]} · {r.project.externalCrm.externalId}
                      </Chip>
                    ) : (
                      <span className="text-ink-3">not linked</span>
                    )}
                  </td>
                  <td className="num text-right">{r.designs}</td>
                  <td className="num text-right">{r.estimates}</td>
                  <td className="text-right">{r.latestTotalCents != null ? <Money cents={Number(r.latestTotalCents)} /> : <span className="text-ink-3">—</span>}</td>
                  <td>
                    <DateText value={r.project.updatedAt} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
