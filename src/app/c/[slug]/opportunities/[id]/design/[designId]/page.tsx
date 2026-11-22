import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCompanyContext } from "@/lib/request-context";
import { getOpportunity } from "@/modules/crm/service";
import { getDesign } from "@/modules/design/service";
import { DEFAULT_DECK_DESIGN } from "@/modules/design/model";
import { listPricedDeckingProducts } from "@/modules/estimating/pricing";
import { listEstimatesForOpportunity } from "@/modules/estimating/service";
import { NotFoundError } from "@/modules/core/errors";
import type { CompanyContext } from "@/modules/core/context";
import { DeckEditor } from "@/modules/design/components/DeckEditor";

async function load(ctx: CompanyContext, opportunityId: string, designId: string) {
  try {
    const [opp, products, estimates] = await Promise.all([getOpportunity(ctx, opportunityId), listPricedDeckingProducts(ctx), listEstimatesForOpportunity(ctx, opportunityId)]);
    const design = designId === "new" ? null : await getDesign(ctx, designId);
    if (design && design.opportunityId !== opportunityId) return null;
    return { opp, products, estimates, design };
  } catch (e) {
    if (e instanceof NotFoundError) return null;
    throw e;
  }
}

export default async function DesignPage({ params }: { params: Promise<{ slug: string; id: string; designId: string }> }) {
  const { slug, id, designId } = await params;
  const ctx = await requireCompanyContext(slug);
  const data = await load(ctx, id, designId);
  if (!data) notFound();
  const { opp, products, estimates, design } = data;
  const base = `/c/${slug}`;
  const initialModel = design?.model ?? { ...DEFAULT_DECK_DESIGN, deckingProductId: products[0]?.id ?? null };

  return (
    <>
      <div className="mb-4 flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.1em] text-ink-3">
        <Link href={`${base}/opportunities`} className="hover:underline">
          Pipeline
        </Link>
        <span>/</span>
        <Link href={`${base}/opportunities/${id}`} className="hover:underline">
          {opp.opp.title}
        </Link>
        <span>/</span>
        <span>Deck design</span>
      </div>
      <DeckEditor
        slug={slug}
        opportunityId={id}
        design={design ? { id: design.id, name: design.name, version: design.version } : null}
        initialModel={initialModel}
        products={products}
        estimates={estimates.filter((e) => !design || e.estimate.designId === design.id).map((e) => ({ id: e.estimate.id, title: e.estimate.title, revisions: e.revisions.length }))}
        canEstimate={ctx.can("estimate.write")}
        canExport={ctx.can("crm.export")}
      />
    </>
  );
}
