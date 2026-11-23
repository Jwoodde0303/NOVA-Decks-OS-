"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { createRevisionAction, saveDesignAction } from "@/app/c/[slug]/actions";
import type { InstallationRules } from "@/db/catalog/types";
import { formatFeetInches } from "@/modules/core/units";
import { analyzeDeck, type DeckDesignModel, type FramingOptions } from "@/modules/design/model";
import { generateFraming } from "@/modules/framing/generate";
import { FramingPanel } from "@/modules/framing/components/FramingPanel";
import type { PricedProduct } from "@/modules/estimating/takeoff";
import { FeetInches } from "./FeetInches";
import { PlanView } from "./PlanView";
import { ProductPicker, type CatalogPickerItem } from "./ProductPicker";

const Deck3D = dynamic(() => import("./Deck3D").then((m) => m.Deck3D), { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-[13px] text-ink-3">Loading 3D preview…</div> });

interface Props {
  slug: string;
  projectId: string;
  design: { id: string; name: string; version: number } | null;
  initialModel: DeckDesignModel;
  catalog: CatalogPickerItem[];
  lines: { manufacturer: string; productLine: string; installation: InstallationRules | null }[];
  prices: Record<string, number>;
  estimates: { id: string; title: string; revisions: number }[];
  canEstimate: boolean;
}

export function DeckEditor({ slug, projectId, design, initialModel, catalog, lines, prices, estimates, canEstimate }: Props) {
  const router = useRouter();
  const [model, setModel] = useState<DeckDesignModel>(initialModel);
  const [name, setName] = useState(design?.name ?? "Main deck");
  const [designId, setDesignId] = useState<string | null>(design?.id ?? null);
  const [version, setVersion] = useState(design?.version ?? 0);
  const [dirty, setDirty] = useState(design === null);
  const [estimateTarget, setEstimateTarget] = useState<string>(estimates[0]?.id ?? "");
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string; issues?: string[] } | null>(null);
  const [pending, start] = useTransition();

  const product: PricedProduct | null = useMemo(() => {
    const item = catalog.find((c) => c.id === model.deckingProductId);
    if (!item) return null;
    const line = lines.find((l) => l.manufacturer === item.manufacturer && l.productLine === item.productLine);
    return {
      id: item.id,
      name: item.name,
      sku: item.sku,
      manufacturer: item.manufacturer,
      productLine: item.productLine,
      color: item.color,
      colorHex: item.colorHex,
      profile: item.profile,
      stockLengthIn: item.stockLengthIn,
      effectiveWidthIn: item.effectiveWidthIn,
      widthActualIn: item.widthActualIn,
      thicknessIn: item.thicknessIn,
      installation: line?.installation ?? null,
      unitPriceCents: prices[item.id] ?? null,
      priceSource: null,
      priceEffectiveOn: null,
      supplierName: null,
    };
  }, [catalog, lines, prices, model.deckingProductId]);
  const analysis = useMemo(() => analyzeDeck(model, product), [model, product]);
  const framing = useMemo(() => generateFraming(model, product), [model, product]);
  const totalCents = analysis.decking && product?.unitPriceCents != null ? analysis.decking.totalPieces * product.unitPriceCents : null;

  function patch(p: Partial<DeckDesignModel>) {
    setModel((m) => ({ ...m, ...p }));
    setDirty(true);
    setMessage(null);
  }
  function patchFraming(p: Partial<FramingOptions>) {
    patch({ framing: { ...model.framing, ...p } });
  }

  function save() {
    start(async () => {
      const r = await saveDesignAction(slug, { id: designId, projectId, name, model });
      if (!r || ("error" in r && r.error)) {
        setMessage({ tone: "err", text: r?.error ?? "Request failed", issues: r?.issues });
        return;
      }
      const saved = r as { id: string; version: number };
      setDesignId(saved.id);
      setVersion(saved.version);
      setDirty(false);
      setMessage({ tone: "ok", text: `Design saved (v${saved.version}).` });
      if (!designId) router.replace(`/c/${slug}/projects/${projectId}/design/${saved.id}`);
    });
  }

  function saveEstimate() {
    if (!designId || !product) return;
    start(async () => {
      const r = await createRevisionAction(slug, { designId, estimateId: estimateTarget || null });
      if (!r || ("error" in r && r.error)) {
        setMessage({ tone: "err", text: r?.error ?? "Request failed", issues: r?.issues });
        return;
      }
      const rev = r as { estimateId: string };
      router.push(`/c/${slug}/estimates/${rev.estimateId}`);
    });
  }

  const blocked = !analysis.valid || !framing.ok;

  return (
    <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
      <aside className="space-y-4">
        <div className="card p-4">
          <label className="lbl">Design name</label>
          <input
            className="field"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setDirty(true);
            }}
          />
          <div className="mt-1 text-[12px] text-ink-3">{designId ? `Saved version ${version}${dirty ? " · unsaved changes" : ""}` : "Not saved yet"}</div>
        </div>

        <div className="card p-4">
          <h2 className="mb-3 text-[15px] font-semibold">Deck</h2>
          <div className="space-y-3">
            <FeetInches label="Width (along house)" value={model.widthIn} onChange={(v) => patch({ widthIn: v })} />
            <FeetInches label="Depth (out from house)" value={model.depthIn} onChange={(v) => patch({ depthIn: v })} />
            <FeetInches label="Height above grade" value={model.heightIn} onChange={(v) => patch({ heightIn: v })} />
          </div>
        </div>

        <div className="card p-4">
          <h2 className="mb-1 text-[15px] font-semibold">Stair</h2>
          <p className="mb-3 text-[12px] text-ink-3">One straight stair on the edge opposite the house. Offset is measured from the left corner.</p>
          <div className="space-y-3">
            <FeetInches label="Stair width" value={model.stair.widthIn} onChange={(v) => patch({ stair: { ...model.stair, widthIn: v } })} error={analysis.issues.some((i) => i.field === "stair.widthIn")} />
            <FeetInches label="Offset from left corner" value={model.stair.offsetIn} onChange={(v) => patch({ stair: { ...model.stair, offsetIn: v } })} error={analysis.issues.some((i) => i.field === "stair.offsetIn")} />
          </div>
        </div>

        <div className="card p-4">
          <h2 className="mb-3 text-[15px] font-semibold">Decking</h2>
          <ProductPicker items={catalog} prices={prices} value={model.deckingProductId} onChange={(id) => patch({ deckingProductId: id })} />
          <div className="mt-2 text-[12px] text-ink-3">Boards run parallel to the house. The manufacturer&apos;s installation rules are applied to the framing below.</div>
        </div>

        {analysis.issues.length > 0 && (
          <div className="rounded-[var(--radius-md)] border border-brick/30 bg-brick-soft p-4 text-[13px] text-brick">
            <div className="font-semibold">Fix before estimating</div>
            <ul className="mt-1 list-disc pl-5">
              {analysis.issues.map((i) => (
                <li key={i.field + i.message}>{i.message}</li>
              ))}
            </ul>
          </div>
        )}

        {message && (
          <div className={`rounded-[var(--radius-md)] border p-3 text-[13px] ${message.tone === "ok" ? "border-moss/30 bg-moss-soft text-moss" : "border-brick/30 bg-brick-soft text-brick"}`}>
            {message.text}
            {message.issues && message.issues.length > 0 && (
              <ul className="mt-1 list-disc pl-5">
                {message.issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button className="btn btn-primary" onClick={save} disabled={pending || !dirty}>
            {pending ? "Working…" : designId ? "Save design changes" : "Save design"}
          </button>
          {designId && !dirty && !blocked && (
            <a href={`/api/c/${slug}/designs/${designId}/planset`} target="_blank" rel="noreferrer" className="btn btn-secondary">
              Permit planset (PDF) · 9 sheets
            </a>
          )}
          {canEstimate && (
            <div className="card p-3">
              <div className="mb-2 text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3">Estimate</div>
              {estimates.length > 0 && (
                <select className="field mb-2" value={estimateTarget} onChange={(e) => setEstimateTarget(e.target.value)}>
                  <option value="">New estimate</option>
                  {estimates.map((e) => (
                    <option key={e.id} value={e.id}>
                      Add revision to “{e.title}” ({e.revisions})
                    </option>
                  ))}
                </select>
              )}
              <button className="btn btn-secondary w-full" onClick={saveEstimate} disabled={pending || !designId || dirty || !product || blocked} title={!designId || dirty ? "Save the design first" : blocked ? "Fix the blocking issues first" : undefined}>
                Save estimate revision
              </button>
              <div className="mt-1.5 text-[11px] text-ink-3">{!designId || dirty ? "Save the design first." : blocked ? "Blocked by design or framing issues." : "Prices decking, framing, hardware, footings, stairs, guards and labor from today's price book and snapshots it."}</div>
            </div>
          )}
        </div>
      </aside>

      <div className="space-y-5">
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <h2 className="text-[14px] font-semibold">Plan view</h2>
              <span className="text-[12px] text-ink-3">Dimensions in ft-in</span>
            </div>
            <div className="bg-surface p-3">
              <PlanView model={model} analysis={analysis} />
            </div>
          </section>
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <h2 className="text-[14px] font-semibold">3D preview</h2>
              <span className="text-[12px] text-ink-3">{product?.color ? `${product.manufacturer} ${product.color} · ` : ""}drag to rotate · scroll to zoom</span>
            </div>
            <div className="h-[360px] bg-[#e9eef2]">
              <Deck3D model={model} analysis={analysis} framing={framing} boardColor={product?.colorHex ?? undefined} />
            </div>
          </section>
        </div>

        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
            <h2 className="text-[14px] font-semibold">Decking takeoff</h2>
            <span className="text-[12px] text-ink-3">Board count before waste · the estimate adds waste, framing, hardware, footings, stairs, guards and labor</span>
          </div>
          <div className="grid gap-4 p-4 md:grid-cols-[1fr_1fr]">
            <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 text-[14px]">
              <Row k="Deck footprint" v={`${formatFeetInches(model.widthIn)} × ${formatFeetInches(model.depthIn)} · ${((model.widthIn * model.depthIn) / 144).toFixed(0)} sq ft`} />
              <Row k="Outer edge left of stair" v={formatFeetInches(analysis.outerEdge.leftSegmentIn)} />
              <Row k="Stair opening" v={formatFeetInches(analysis.outerEdge.stairOpeningIn)} />
              <Row k="Outer edge right of stair" v={formatFeetInches(analysis.outerEdge.rightSegmentIn)} />
              <Row k="Open perimeter" v={formatFeetInches(analysis.openPerimeterIn)} strong />
              <dd className="col-span-2 -mt-1 text-[12px] text-ink-3">Both sides plus outer edge, excluding the house edge and stair opening.</dd>
            </dl>
            <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 text-[14px]">
              {analysis.decking && product ? (
                <>
                  <Row k="Rows" v={`${analysis.decking.rows} @ ${analysis.decking.effectiveWidthIn}"`} />
                  <Row k="Pieces per row" v={`${analysis.decking.piecesPerRow} × ${analysis.decking.stockLengthIn / 12} ft`} />
                  <Row k="Boards (no waste)" v={`${analysis.decking.totalPieces}`} strong />
                  <Row k="Unit price" v={product.unitPriceCents != null ? `$${(product.unitPriceCents / 100).toFixed(2)}` : "no price"} />
                  <Row k="Decking boards" v={totalCents != null ? `$${(totalCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"} strong />
                </>
              ) : (
                <dd className="col-span-2 text-ink-3">Choose a decking product to see board counts and price.</dd>
              )}
            </dl>
          </div>
        </section>
      </div>

      <div className="xl:col-span-2">
        <FramingPanel model={model} framing={framing} onChange={patchFraming} />
      </div>
    </div>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <>
      <dt className="text-ink-2">{k}</dt>
      <dd className={`num text-right ${strong ? "font-semibold text-ink" : ""}`}>{v}</dd>
    </>
  );
}
