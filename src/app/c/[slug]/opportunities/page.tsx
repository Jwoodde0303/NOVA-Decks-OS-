import Link from "next/link";
import { requireCompanyContext } from "@/lib/request-context";
import { listMembers, listOpportunities, listStages } from "@/modules/crm/service";
import { Chip, DateText, Empty, LinkButton, PageHeader, isOverdue, stageTone } from "@/components/ui";

const SERVICE_LABEL: Record<string, string> = { deck: "Deck", sunroom: "Sunroom", patio: "Patio", exterior_renovation: "Exterior", other: "Other" };

export default async function PipelinePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const ctx = await requireCompanyContext(slug);
  const [stages, members] = await Promise.all([listStages(ctx), listMembers(ctx)]);
  const rows = await listOpportunities(ctx, {
    q: sp.q || undefined,
    stageId: sp.stage || undefined,
    assigneeUserId: sp.assignee || undefined,
    overdueOnly: sp.overdue === "1",
    includeClosed: sp.closed === "1",
  });
  const base = `/c/${slug}`;

  return (
    <>
      <PageHeader eyebrow="CRM" title="Pipeline" actions={<LinkButton href={`${base}/opportunities/new`} variant="primary">New inquiry</LinkButton>}>
        Every inquiry from first call to job.
      </PageHeader>

      <form className="mb-4 flex flex-wrap items-end gap-3" method="get">
        <div className="w-[240px]">
          <label className="lbl">Search</label>
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Title or customer" className="field" />
        </div>
        <div className="w-[200px]">
          <label className="lbl">Stage</label>
          <select name="stage" defaultValue={sp.stage ?? ""} className="field">
            <option value="">All open stages</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="w-[200px]">
          <label className="lbl">Assignee</label>
          <select name="assignee" defaultValue={sp.assignee ?? ""} className="field">
            <option value="">Anyone</option>
            <option value="unassigned">Unassigned</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <label className="flex h-9 items-center gap-2 text-[14px]">
          <input type="checkbox" name="overdue" value="1" defaultChecked={sp.overdue === "1"} className="accent-cedar" /> Overdue follow-up
        </label>
        <label className="flex h-9 items-center gap-2 text-[14px]">
          <input type="checkbox" name="closed" value="1" defaultChecked={sp.closed === "1"} className="accent-cedar" /> Include won/lost
        </label>
        <button className="btn btn-secondary" type="submit">
          Filter
        </button>
        <Link href={`${base}/opportunities`} className="btn btn-ghost">
          Clear
        </Link>
      </form>

      <div className="card overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-4">
            <Empty>No opportunities match these filters.</Empty>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Opportunity</th>
                <th>Service</th>
                <th>Stage</th>
                <th>Assignee</th>
                <th>Next follow-up</th>
                <th>Job</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.opp.id}>
                  <td>
                    <Link href={`${base}/opportunities/${r.opp.id}`} className="font-medium hover:underline">
                      {r.opp.title}
                    </Link>
                    <div className="text-[12px] text-ink-3">{r.customerName}</div>
                  </td>
                  <td>{SERVICE_LABEL[r.opp.serviceType]}</td>
                  <td>
                    <Chip tone={stageTone(r.stage.kind)}>{r.stage.name}</Chip>
                  </td>
                  <td>{r.assigneeName ?? <span className="text-ink-3">Unassigned</span>}</td>
                  <td className={isOverdue(r.opp.nextFollowUpOn) && r.stage.kind === "open" ? "text-brick" : ""}>
                    <DateText value={r.opp.nextFollowUpOn} />
                  </td>
                  <td>
                    {r.jobId ? (
                      <Link href={`${base}/jobs/${r.jobId}`} className="num text-slate hover:underline">
                        {r.jobNumber}
                      </Link>
                    ) : (
                      <span className="text-ink-3">—</span>
                    )}
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
