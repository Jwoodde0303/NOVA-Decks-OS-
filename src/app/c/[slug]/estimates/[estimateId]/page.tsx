import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCompanyContext } from "@/lib/request-context";
import { getEstimate } from "@/modules/estimating/service";
import { getProject } from "@/modules/projects/service";
import { NotFoundError } from "@/modules/core/errors";
import { ESTIMATE_STATUSES } from "@/db/schema";
import { InlineAction } from "@/components/ActionForm";
import { Card, Chip, DateText, Money, PageHeader } from "@/components/ui";
import { fmtFtIn } from "@/modules/framing/generate";
import { setEstimateStatusAction } from "../../actions";

export default async function EstimatePage({ params }: { params: Promise<{ slug: string; estimateId: string }> }) {
  const { slug, estimateId } = await params;
  const ctx = await requireCompanyContext(slug);
  let e: Awaited<ReturnType<typeof getEstimate>>;
  let project: Awaited<ReturnType<typeof getProject>>;
  try {
    e = await getEstimate(ctx, estimateId);
    project = await getProject(ctx, e.projectId);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const base = `/c/${slug}`;
  const tone = e.status === "accepted" ? "moss" : e.status === "declined" ? "brick" : e.status === "sent" ? "amber" : "ink";
  return (
    <>
      <PageHeader
        eyebrow={`Estimate · ${project.projectNumber} ${project.name}`}
        title={e.title}
        actions={
          <div className="flex items-center gap-2">
            <Chip tone={tone}>{e.status}</Chip>
            {ctx.can("estimate.status") &&
              ESTIMATE_STATUSES.filter((s) => s !== e.status).map((s) => (
                <InlineAction key={s} action={setEstimateStatusAction.bind(null, slug, e.id, s)} className="btn btn-ghost btn-sm">
                  Mark {s}
                </InlineAction>
              ))}
          </div>
        }
      >
        <Link href={`${base}/projects/${e.projectId}`} className="text-slate hover:underline">
          Back to project
        </Link>
        {e.designId && (
          <>
            {" "}
            ·{" "}
            <Link href={`${base}/projects/${e.projectId}/design/${e.designId}`} className="text-slate hover:underline">
              Open design
            </Link>
          </>
        )}
      </PageHeader>

      <div className="space-y-6">
        {e.revisions.map((r) => (
          <Card
            key={r.id}
            title={
              <span>
                Revision {r.revisionNumber} <span className="ml-2 text-[12px] font-normal text-ink-3">{r.scopeLabel}</span>
              </span>
            }
            aside={
              <div className="flex items-center gap-3 text-[13px] text-ink-3">
                <span>
                  Design v{r.designVersion} · <DateText value={r.createdAt} />
                </span>
                {ctx.can("estimate.export") && (
                  <a href={`/api/c/${slug}/revisions/${r.id}/csv`} className="btn btn-secondary btn-sm">
                    Export CSV
                  </a>
                )}
              </div>
            }
          >
            <div className="mb-3 text-[13px] text-ink-2">
              Deck {fmtFtIn(r.designSnapshot.widthIn)} × {fmtFtIn(r.designSnapshot.depthIn)}, {fmtFtIn(r.designSnapshot.heightIn)} high · stair {fmtFtIn(r.designSnapshot.stair.widthIn)} wide · {r.productSnapshot.manufacturer} {r.productSnapshot.productLine} {r.productSnapshot.color} ({r.productSnapshot.sku}) · framing {`${r.framingSnapshot.joists.size} @ ${r.framingSnapshot.joists.spacingIn}" o.c., (${r.framingSnapshot.beam.plies})${r.framingSnapshot.beam.size} beam on ${r.framingSnapshot.posts.count} posts`} · waste {r.settings.wastePct}% · markup {r.settings.markupPct}% · material tax {r.settings.materialTaxPct}%
            </div>
            {r.warnings.length > 0 && (
              <div className="mb-3 rounded-[var(--radius-sm)] border border-amber/30 bg-amber-soft px-3 py-2 text-[13px] text-amber">
                <div className="font-semibold">Pricing warnings</div>
                <ul className="list-disc pl-5">
                  {r.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            <table className="tbl">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>SKU / key</th>
                  <th className="text-right">Qty</th>
                  <th>Unit</th>
                  <th className="text-right">Unit price</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {r.sections.map((sec) => (
                  <SectionRows key={sec.key} title={sec.title} lines={sec.lines} subtotalCents={sec.subtotalCents} />
                ))}
                <tr>
                  <td colSpan={5} className="text-right text-ink-2">
                    Materials
                  </td>
                  <td className="text-right">
                    <Money cents={r.materialsCents} />
                  </td>
                </tr>
                <tr>
                  <td colSpan={5} className="text-right text-ink-2">
                    Labor
                  </td>
                  <td className="text-right">
                    <Money cents={r.laborCents} />
                  </td>
                </tr>
                <tr>
                  <td colSpan={5} className="text-right text-ink-2">
                    Markup {r.settings.markupPct}%
                  </td>
                  <td className="text-right">
                    <Money cents={r.markupCents} />
                  </td>
                </tr>
                <tr>
                  <td colSpan={5} className="text-right text-ink-2">
                    Material tax {r.settings.materialTaxPct}%
                  </td>
                  <td className="text-right">
                    <Money cents={r.taxCents} />
                  </td>
                </tr>
                <tr>
                  <td colSpan={5} className="text-right text-[15px] font-semibold">
                    Total
                  </td>
                  <td className="text-right text-[17px] font-semibold">
                    <Money cents={r.totalCents} />
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>
        ))}
      </div>
    </>
  );
}

function SectionRows({ title, lines, subtotalCents }: { title: string; lines: { key: string; description: string; sku?: string; qty: number; unit: string; unitPriceCents: number; totalCents: number; priced: boolean; detail?: string }[]; subtotalCents: number }) {
  return (
    <>
      <tr>
        <td colSpan={6} className="bg-paper-2/60 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">
          {title}
        </td>
      </tr>
      {lines.map((l) => (
        <tr key={l.key + l.description}>
          <td>
            <div className={l.priced ? "" : "text-brick"}>{l.description}</div>
            {l.detail && <div className="text-[11px] text-ink-3">{l.detail}</div>}
          </td>
          <td className="num text-[12px] text-ink-3">{l.sku ?? l.key}</td>
          <td className="num text-right">{l.qty}</td>
          <td className="text-ink-2">{l.unit}</td>
          <td className="text-right">{l.priced ? <Money cents={l.unitPriceCents} /> : <span className="text-brick">no price</span>}</td>
          <td className="text-right">
            <Money cents={l.totalCents} />
          </td>
        </tr>
      ))}
      <tr>
        <td colSpan={5} className="text-right text-[12px] text-ink-3">
          {title} subtotal
        </td>
        <td className="text-right text-[13px]">
          <Money cents={subtotalCents} />
        </td>
      </tr>
    </>
  );
}
