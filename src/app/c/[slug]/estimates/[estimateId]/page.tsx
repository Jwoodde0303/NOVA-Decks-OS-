import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCompanyContext } from "@/lib/request-context";
import { getEstimate } from "@/modules/estimating/service";
import { NotFoundError } from "@/modules/core/errors";
import { formatFeetInches } from "@/modules/core/units";
import { Card, Chip, DateText, Money, PageHeader } from "@/components/ui";

export default async function EstimatePage({ params }: { params: Promise<{ slug: string; estimateId: string }> }) {
  const { slug, estimateId } = await params;
  const ctx = await requireCompanyContext(slug);
  let e: Awaited<ReturnType<typeof getEstimate>>;
  try {
    e = await getEstimate(ctx, estimateId);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const base = `/c/${slug}`;
  return (
    <>
      <PageHeader eyebrow="Estimate" title={e.title}>
        <Link href={`${base}/opportunities/${e.opportunityId}`} className="text-slate hover:underline">
          Back to opportunity
        </Link>
        {e.designId && (
          <>
            {" "}
            ·{" "}
            <Link href={`${base}/opportunities/${e.opportunityId}/design/${e.designId}`} className="text-slate hover:underline">
              Open design
            </Link>
          </>
        )}
      </PageHeader>
      <div className="space-y-5">
        {e.revisions.map((r) => (
          <Card
            key={r.id}
            title={
              <span>
                Revision {r.revisionNumber} <Chip tone="amber">{r.scopeLabel}</Chip>
              </span>
            }
            aside={
              <div className="flex items-center gap-3 text-[13px] text-ink-3">
                <span>
                  Design v{r.designVersion} · <DateText value={r.createdAt} />
                </span>
                {ctx.can("crm.export") && (
                  <a href={`/api/c/${slug}/revisions/${r.id}/csv`} className="btn btn-secondary btn-sm">
                    Export CSV
                  </a>
                )}
              </div>
            }
          >
            <div className="mb-3 text-[13px] text-ink-2">
              Deck {formatFeetInches(r.designSnapshot.widthIn)} × {formatFeetInches(r.designSnapshot.depthIn)}, {formatFeetInches(r.designSnapshot.heightIn)} high · stair {formatFeetInches(r.designSnapshot.stair.widthIn)} wide at{" "}
              {formatFeetInches(r.designSnapshot.stair.offsetIn)} · {r.productSnapshot.manufacturer} {r.productSnapshot.name} @ <Money cents={r.productSnapshot.unitPriceCents} /> ({r.productSnapshot.priceSource}, effective{" "}
              <DateText value={r.productSnapshot.priceEffectiveOn} />)
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>SKU</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Unit</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {r.lineItems.map((l) => (
                  <tr key={l.code}>
                    <td>
                      <div className="font-medium">{l.description}</div>
                      <div className="text-[12px] text-ink-3">{l.detail}</div>
                    </td>
                    <td className="num">{l.sku}</td>
                    <td className="num text-right">{l.quantity}</td>
                    <td className="text-right">
                      <Money cents={l.unitPriceCents} />
                    </td>
                    <td className="text-right">
                      <Money cents={l.totalCents} />
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={4} className="text-right font-medium">
                    Subtotal
                  </td>
                  <td className="text-right text-[16px] font-semibold">
                    <Money cents={r.subtotalCents} />
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
