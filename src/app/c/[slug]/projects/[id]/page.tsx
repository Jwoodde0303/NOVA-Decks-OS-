import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCompanyContext } from "@/lib/request-context";
import { getProject } from "@/modules/projects/service";
import { NotFoundError } from "@/modules/core/errors";
import { PROVIDER_LABEL } from "@/modules/integrations/adapters";
import { ActionForm, InlineAction } from "@/components/ActionForm";
import { ProjectFields } from "@/components/ProjectForm";
import { Card, Chip, DateText, Empty, LinkButton, Money, PageHeader } from "@/components/ui";
import { archiveProjectAction, updateProjectAction } from "../../actions";

const EVENT_LABEL: Record<string, string> = { project_created: "Project created", project_updated: "Project updated", design_saved: "Design saved", estimate_revision: "Estimate revision", estimate_status: "Estimate status" };

export default async function ProjectPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const ctx = await requireCompanyContext(slug);
  let p: Awaited<ReturnType<typeof getProject>>;
  try {
    p = await getProject(ctx, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const base = `/c/${slug}`;
  const here = `${base}/projects/${id}`;
  return (
    <>
      <PageHeader
        eyebrow={`Project ${p.projectNumber}${p.status === "archived" ? " · archived" : ""}`}
        title={p.name}
        actions={
          <>
            {ctx.can("projects.delete") && (
              <InlineAction action={archiveProjectAction.bind(null, slug, id, p.status !== "archived")} className="btn btn-ghost btn-sm" confirm={p.status === "archived" ? undefined : "Archive this project? It stays available with 'Include archived'."}>
                {p.status === "archived" ? "Restore" : "Archive"}
              </InlineAction>
            )}
            <LinkButton href={`${here}/design/new`} variant="primary">
              New deck design
            </LinkButton>
          </>
        }
      >
        {p.clientName && <span className="font-medium text-ink">{p.clientName}</span>}
        {p.siteLine1 && (
          <>
            {" "}
            · {p.siteLine1}, {p.siteCity}, {p.siteRegion} {p.sitePostalCode}
          </>
        )}{" "}
        · {p.jurisdiction}
        {p.externalCrm && (
          <>
            {" "}
            ·{" "}
            {p.externalCrm.url ? (
              <a href={p.externalCrm.url} target="_blank" rel="noreferrer" className="text-slate hover:underline">
                {PROVIDER_LABEL[p.externalCrm.provider]} job {p.externalCrm.externalId} ↗
              </a>
            ) : (
              <span>
                {PROVIDER_LABEL[p.externalCrm.provider]} job {p.externalCrm.externalId}
              </span>
            )}
          </>
        )}
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-5">
          <Card title="Deck designs">
            {p.designs.length === 0 ? (
              <Empty>No designs yet. Start a deck design to generate framing and an estimate.</Empty>
            ) : (
              <ul className="divide-y divide-line/70">
                {p.designs.map((d) => (
                  <li key={d.id} className="flex items-center justify-between py-2.5">
                    <Link href={`${here}/design/${d.id}`} className="font-medium hover:underline">
                      {d.name}
                    </Link>
                    <span className="text-[12px] text-ink-3">
                      v{d.version} · <DateText value={d.updatedAt} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Estimates">
            {p.estimates.length === 0 ? (
              <Empty>No estimates yet. Open a design and save an estimate revision.</Empty>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Estimate</th>
                    <th>Status</th>
                    <th className="text-right">Revisions</th>
                    <th className="text-right">Latest total</th>
                  </tr>
                </thead>
                <tbody>
                  {p.estimates.map((e) => (
                    <tr key={e.estimate.id}>
                      <td>
                        <Link href={`${base}/estimates/${e.estimate.id}`} className="font-medium hover:underline">
                          {e.estimate.title}
                        </Link>
                      </td>
                      <td>
                        <Chip tone={e.estimate.status === "accepted" ? "moss" : e.estimate.status === "declined" ? "brick" : e.estimate.status === "sent" ? "amber" : "ink"}>{e.estimate.status}</Chip>
                      </td>
                      <td className="num text-right">{e.revisions}</td>
                      <td className="text-right">{e.latestTotalCents != null ? <Money cents={Number(e.latestTotalCents)} /> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          <Card title="History">
            <ol className="relative space-y-3 border-l border-line pl-5">
              {p.events.map((ev) => (
                <li key={ev.event.id} className="relative">
                  <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-line-strong" />
                  <div className="text-[12px] text-ink-3">
                    <span className="font-medium text-ink-2">{ev.actorName ?? "System"}</span> · {EVENT_LABEL[ev.event.kind] ?? ev.event.kind} ·{" "}
                    <span className="num">{new Date(ev.event.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                  </div>
                  <div className="text-[14px]">{ev.event.body}</div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
        <div>
          <ActionForm action={updateProjectAction.bind(null, slug, id)} submitLabel="Save project">
            <ProjectFields p={p} />
          </ActionForm>
        </div>
      </div>
    </>
  );
}
