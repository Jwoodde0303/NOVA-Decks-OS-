import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCompanyContext } from "@/lib/request-context";
import { getJob } from "@/modules/crm/service";
import { NotFoundError } from "@/modules/core/errors";
import { ACTIVITY_LABEL, SERVICE_LABEL } from "@/modules/crm/labels";
import { Card, Chip, DateText, Empty, PageHeader } from "@/components/ui";
import { TaskToggle } from "@/components/TaskToggle";

export default async function JobPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const ctx = await requireCompanyContext(slug);
  let j: Awaited<ReturnType<typeof getJob>>;
  try {
    j = await getJob(ctx, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const base = `/c/${slug}`;
  const here = `${base}/jobs/${id}`;
  return (
    <>
      <PageHeader eyebrow={`Job ${j.job.jobNumber}`} title={j.job.title} actions={<Chip tone={j.job.status === "active" ? "moss" : "ink"}>{j.job.status}</Chip>}>
        <Link href={`${base}/customers/${j.customer.id}`} className="font-medium text-ink hover:underline">
          {j.customer.displayName}
        </Link>
        {j.address && (
          <>
            {" "}
            · {j.address.line1}, {j.address.city}, {j.address.region}
          </>
        )}{" "}
        · {SERVICE_LABEL[j.job.serviceType]} ·{" "}
        <Link href={`${base}/opportunities/${j.opportunity.id}`} className="text-slate hover:underline">
          From opportunity
        </Link>
      </PageHeader>
      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-5">
          <Card title="Designs & estimates carried over">
            {j.designs.length === 0 && j.estimates.length === 0 ? (
              <Empty>No designs or estimates were attached to the opportunity.</Empty>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 text-[14px]">
                <div>
                  <div className="lbl">Designs</div>
                  <ul className="divide-y divide-line/70">
                    {j.designs.map((d) => (
                      <li key={d.id} className="py-2">
                        <Link href={`${base}/opportunities/${j.opportunity.id}/design/${d.id}`} className="font-medium hover:underline">
                          {d.name}
                        </Link>{" "}
                        <span className="text-[12px] text-ink-3">v{d.version}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="lbl">Estimates</div>
                  <ul className="divide-y divide-line/70">
                    {j.estimates.map((e) => (
                      <li key={e.id} className="py-2">
                        <Link href={`${base}/estimates/${e.id}`} className="font-medium hover:underline">
                          {e.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </Card>
          <Card title="History">
            <ol className="relative space-y-4 border-l border-line pl-5">
              {j.timeline.map((t) => (
                <li key={t.activity.id} className="relative">
                  <span className={`absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface ${t.activity.kind === "note" ? "bg-cedar" : "bg-line-strong"}`} />
                  <div className="text-[12px] text-ink-3">
                    <span className="font-medium text-ink-2">{t.actorName ?? "System"}</span> · {ACTIVITY_LABEL[t.activity.kind] ?? t.activity.kind} · <DateText value={t.activity.createdAt} />
                  </div>
                  <div className="mt-0.5 whitespace-pre-wrap text-[14px]">{t.activity.body}</div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
        <Card title="Tasks">
          {j.tasks.length === 0 ? (
            <Empty>No tasks.</Empty>
          ) : (
            <ul className="divide-y divide-line/70">
              {j.tasks.map((t) => (
                <li key={t.task.id} className="flex items-start gap-3 py-2">
                  <TaskToggle slug={slug} taskId={t.task.id} completed={!!t.task.completedAt} backTo={here} />
                  <div className={`flex-1 text-[14px] ${t.task.completedAt ? "text-ink-3 line-through" : ""}`}>{t.task.title}</div>
                  <div className="text-[12px] text-ink-3">
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
