import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCompanyContext } from "@/lib/request-context";
import { getProject } from "@/modules/projects/service";
import { getDesign } from "@/modules/design/service";
import { DEFAULT_DECK_DESIGN } from "@/modules/design/model";
import { listCatalogLines, listDeckingCatalog } from "@/modules/catalog/service";
import { currentProductPrices } from "@/modules/estimating/pricing";
import { listEstimatesForProject } from "@/modules/estimating/service";
import { NotFoundError } from "@/modules/core/errors";
import type { CompanyContext } from "@/modules/core/context";
import { DeckEditor } from "@/modules/design/components/DeckEditor";

async function load(ctx: CompanyContext, projectId: string, designId: string) {
  try {
    const [project, catalog, lines, prices, estimates] = await Promise.all([getProject(ctx, projectId), listDeckingCatalog(ctx), listCatalogLines(ctx), currentProductPrices(ctx), listEstimatesForProject(ctx, projectId)]);
    const design = designId === "new" ? null : await getDesign(ctx, designId);
    if (design && design.projectId !== projectId) return null;
    return { project, catalog, lines, prices, estimates, design };
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
  const { project, catalog, lines, prices, estimates, design } = data;
  const base = `/c/${slug}`;
  const pricedIds = [...prices.keys()];
  const defaultProduct = catalog.find((c) => pricedIds.includes(c.id) && c.material !== "fictional") ?? catalog.find((c) => pricedIds.includes(c.id)) ?? null;
  const initialModel = design?.model ?? { ...DEFAULT_DECK_DESIGN, deckingProductId: defaultProduct?.id ?? null };

  return (
    <>
      <div className="mb-4 flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.1em] text-ink-3">
        <Link href={base} className="hover:underline">
          Projects
        </Link>
        <span>/</span>
        <Link href={`${base}/projects/${id}`} className="hover:underline">
          {project.projectNumber} · {project.name}
        </Link>
        <span>/</span>
        <span>Deck design</span>
      </div>
      <DeckEditor
        slug={slug}
        projectId={id}
        design={design ? { id: design.id, name: design.name, version: design.version } : null}
        initialModel={initialModel}
        catalog={catalog}
        lines={lines.map((l) => ({ manufacturer: l.manufacturer, productLine: l.productLine, installation: l.installation }))}
        prices={Object.fromEntries([...prices.entries()].map(([k, v]) => [k, v.unitPriceCents]))}
        estimates={estimates.filter((e) => !design || e.estimate.designId === design.id).map((e) => ({ id: e.estimate.id, title: e.estimate.title, revisions: e.revisions }))}
        canEstimate={ctx.can("estimate.write")}
      />
    </>
  );
}
