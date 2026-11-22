import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCompanyContext } from "@/lib/request-context";
import { getOpportunity, listMembers, listStages } from "@/modules/crm/service";
import { listEstimatesForOpportunity } from "@/modules/estimating/service";
import { NotFoundError } from "@/modules/core/errors";
import { ACTIVITY_LABEL, SERVICE_LABEL, SOURCE_LABEL } from "@/modules/crm/labels";
import { ActionForm, InlineAction } from "@/components/ActionForm";
import { Card, Chip, DateText, Empty, Field, LinkButton, Money, isOverdue, stageTone } from "@/components/ui";
import { TaskToggle } from "@/components/TaskToggle";
import { addNoteAction, addTaskAction, convertToJobAction, updateOpportunityAction } from "../../actions";

export default async function OpportunityPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const ctx = await requireCompanyContext(slug);
  let o: Awaited<ReturnType<typeof getOpportunity>>;
  try {
    o = await getOpportunity(ctx, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const [stages, members, estimateGroups] = await Promise.all([listStages(ctx), listMembers(ctx), listEstimatesForOpportunity(ctx, id)]);
  const base = `/c/${slug}`;
  const here = `${base}/opportunities/${id}`;
  const update = updateOpportunityAction.bind(null, slug, id);
  const canConvert = ctx.can("crm.convert_job") && o.stage.kind === "won" && !o.job;

  return (
    <>
      <header className="mb-6 border-b border-line pb-5">
        <div className="mb-1 flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.1em] text-ink-3">
          <Link href={`${base}/opportunities`} className="hover:underline">
            Pipeline
          </Link>
          <span>/</span>
          <span>{SERVICE_LABEL[o.opp.serviceType]}</span>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[28px] leading-tight">{o.opp.title}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[14px] text-ink-2">
              <Link href={`${base}/customers/${o.customer.id}`} className="font-medium text-ink hover:underline">
                {o.customer.displayName}
              </Link>
              {o.address && (
                <span>
                  · {o.address.line1}, {o.address.city}
                </span>
              )}
              <span>· Source: {SOURCE_LABEL[o.opp.leadSource]}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Chip tone={stageTone(o.stage.kind)}>{o.stage.name}</Chip>
            {o.job && (
              <Link href={`${base}/jobs/${o.job.id}`} className="btn btn-secondary btn-sm">
                Job <span className="num">{o.job.jobNumber}</span>
              </Link>
            )}
            {canConvert && (
              <InlineAction action={convertToJobAction.bind(null, slug, id)} className="btn btn-primary btn-sm" confirm="Convert this won opportunity into a job?">
                Convert to job
              </InlineAction>
            )}
          </div>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-5">
          <Card title="Deck designs & estimates" aside={<LinkButton href={`${here}/design/new`} variant="primary">New deck design</LinkButton>}>
            {o.designs.length === 0 && estimateGroups.length === 0 ? (
              <Empty>No designs yet. Start a deck design to produce a draft materials estimate.</Empty>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="lbl">Designs</div>
                  <ul className="divide-y divide-line/70">
                    {o.designs.map((d) => (
                      <li key={d.id} className="flex items-center justify-between py-2">
                        <Link href={`${here}/design/${d.id}`} className="font-medium hover:underline">
                          {d.name}
                        </Link>
                        <span className="text-[12px] text-ink-3">
                          v{d.version} · <DateText value={d.updatedAt} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="lbl">Estimates</div>
                  {estimateGroups.length === 0 ? (
                    <div className="py-2 text-[13px] text-ink-3">None saved yet.</div>
                  ) : (
                    <ul className="divide-y divide-line/70">
                      {estimateGroups.map((g) => {
                        const latest = g.revisions.at(-1);
                        return (
                          <li key={g.estimate.id} className="flex items-center justify-between py-2">
                            <Link href={`${base}/estimates/${g.estimate.id}`} className="font-medium hover:underline">
                              {g.estimate.title}
                            </Link>
                            <span className="text-[12px] text-ink-3">
                              {g.revisions.length} rev · {latest ? <Money cents={latest.subtotalCents} /> : "—"}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </Card>

          <Card title="Tasks">
            {o.tasks.length === 0 ? (
              <Empty>No follow-up tasks.</Empty>
            ) : (
              <ul className="mb-4 divide-y divide-line/70">
                {o.tasks.map((t) => (
                  <li key={t.task.id} className="flex items-start gap-3 py-2">
                    <TaskToggle slug={slug} taskId={t.task.id} completed={!!t.task.completedAt} backTo={here} />
                    <div className={`flex-1 text-[14px] ${t.task.completedAt ? "text-ink-3 line-through" : ""}`}>{t.task.title}</div>
                    <div className="text-[12px] text-ink-3">{t.ownerName}</div>
                    <div className={`text-[12px] ${!t.task.completedAt && isOverdue(t.task.dueOn) ? "text-brick" : "text-ink-3"}`}>
                      <DateText value={t.task.dueOn} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <ActionForm action={addTaskAction.bind(null, slug, id)} submitLabel="Add task" resetOnSuccess>
              <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
                <input name="title" required className="field" placeholder="Task" />
                <select name="ownerUserId" className="field" defaultValue={ctx.userId}>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <input name="dueOn" type="date" required className="field num" />
              </div>
            </ActionForm>
          </Card>

          <Card title="Activity">
            <ActionForm action={addNoteAction.bind(null, slug, id)} submitLabel="Add note" resetOnSuccess className="mb-5">
              <textarea name="body" required rows={2} className="field" placeholder="Add a note…" />
            </ActionForm>
            <ol className="relative space-y-4 border-l border-line pl-5">
              {o.timeline.map((t) => (
                <li key={t.activity.id} className="relative">
                  <span className={`absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface ${t.activity.kind === "note" ? "bg-cedar" : "bg-line-strong"}`} />
                  <div className="text-[12px] text-ink-3">
                    <span className="font-medium text-ink-2">{t.actorName ?? "System"}</span> · {ACTIVITY_LABEL[t.activity.kind] ?? t.activity.kind} ·{" "}
                    <span className="num">{new Date(t.activity.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                  </div>
                  <div className="mt-0.5 whitespace-pre-wrap text-[14px]">{t.activity.body}</div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Status">
            <ActionForm action={update} submitLabel="Update">
              <div className="space-y-4">
                <Field label="Stage">
                  <select name="stageId" className="field" defaultValue={o.stage.id} disabled={!!o.job}>
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Assignee">
                  <select name="assigneeUserId" className="field" defaultValue={o.opp.assigneeUserId ?? ""}>
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Next follow-up">
                  <input name="nextFollowUpOn" type="date" className="field num" defaultValue={o.opp.nextFollowUpOn ?? ""} />
                </Field>
                {o.stage.kind === "lost" && (
                  <Field label="Lost reason">
                    <input name="lostReason" className="field" defaultValue={o.opp.lostReason ?? ""} />
                  </Field>
                )}
              </div>
            </ActionForm>
            {o.stage.kind === "won" && !o.job && !ctx.can("crm.convert_job") && <p className="mt-3 text-[12px] text-ink-3">An Owner/Admin can convert this into a job.</p>}
          </Card>
          <Card title="Customer">
            <div className="text-[14px]">
              <div className="font-medium">{o.customer.displayName}</div>
              {o.address ? (
                <div className="mt-1 text-ink-2">
                  {o.address.line1}
                  {o.address.line2 && <>, {o.address.line2}</>}
                  <br />
                  {o.address.city}, {o.address.region} {o.address.postalCode}
                </div>
              ) : (
                <div className="mt-1 text-ink-3">No project address on this opportunity.</div>
              )}
              <Link href={`${base}/customers/${o.customer.id}`} className="mt-2 inline-block text-[13px] text-slate hover:underline">
                Open customer record →
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
