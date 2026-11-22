import Link from "next/link";
import { requireCompanyContext } from "@/lib/request-context";
import { dashboard } from "@/modules/crm/service";
import { Card, Chip, DateText, Empty, LinkButton, PageHeader, isOverdue, stageTone } from "@/components/ui";
import { TaskToggle } from "@/components/TaskToggle";

export default async function DashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireCompanyContext(slug);
  const d = await dashboard(ctx);
  const base = `/c/${slug}`;
  const byStage = new Map<string, number>();
  for (const o of d.open) byStage.set(o.stage.name, (byStage.get(o.stage.name) ?? 0) + 1);

  return (
    <>
      <PageHeader eyebrow={ctx.companyName} title="Today" actions={<LinkButton href={`${base}/opportunities/new`} variant="primary">New inquiry</LinkButton>}>
        {d.open.length} open opportunities · {d.overdue.length} overdue follow-ups · {d.jobs.filter((j) => j.job.status === "active").length} active jobs
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[...byStage.entries()].map(([name, n]) => (
          <div key={name} className="card px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">{name}</div>
            <div className="num mt-1 text-[26px] font-medium leading-none">{n}</div>
          </div>
        ))}
        {byStage.size === 0 && <div className="col-span-full text-[14px] text-ink-3">No open opportunities yet.</div>}
      </div>

      <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        <Card title="Overdue follow-ups" aside={<Link href={`${base}/opportunities?overdue=1`} className="text-[13px] text-slate hover:underline">View all</Link>}>
          {d.overdue.length === 0 ? (
            <Empty>Nothing overdue. Nice.</Empty>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Opportunity</th>
                  <th>Stage</th>
                  <th>Assignee</th>
                  <th>Follow-up</th>
                </tr>
              </thead>
              <tbody>
                {d.overdue.map((r) => (
                  <tr key={r.opp.id}>
                    <td>
                      <Link href={`${base}/opportunities/${r.opp.id}`} className="font-medium hover:underline">
                        {r.opp.title}
                      </Link>
                      <div className="text-[12px] text-ink-3">{r.customerName}</div>
                    </td>
                    <td><Chip tone={stageTone(r.stage.kind)}>{r.stage.name}</Chip></td>
                    <td>{r.assigneeName ?? <span className="text-ink-3">Unassigned</span>}</td>
                    <td className="text-brick"><DateText value={r.opp.nextFollowUpOn} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card title="My open tasks">
          {d.myTasks.length === 0 ? (
            <Empty>No open tasks assigned to you.</Empty>
          ) : (
            <ul className="divide-y divide-line/70">
              {d.myTasks.map((t) => (
                <li key={t.task.id} className="flex items-start gap-3 py-2.5">
                  <TaskToggle slug={slug} taskId={t.task.id} completed={false} backTo={base} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-medium">{t.task.title}</div>
                    <div className="text-[12px] text-ink-3">
                      {t.task.opportunityId && (
                        <Link href={`${base}/opportunities/${t.task.opportunityId}`} className="hover:underline">
                          {t.opportunityTitle}
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className={`text-[12px] ${isOverdue(t.task.dueOn) ? "text-brick" : "text-ink-3"}`}>
                    <DateText value={t.task.dueOn} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
