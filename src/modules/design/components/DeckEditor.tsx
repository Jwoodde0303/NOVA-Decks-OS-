"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { createRevisionAction, saveDesignAction } from "@/app/c/[slug]/actions";
import { formatFeetInches, splitFeetInches, toInches } from "@/modules/core/units";
import { analyzeDeck, type DeckDesignModel } from "@/modules/design/model";
import { DRAFT_SCOPE_LABEL, type PricedProduct } from "@/modules/estimating/takeoff";
import { PlanView } from "./PlanView";

const Deck3D = dynamic(() => import("./Deck3D").then((m) => m.Deck3D), { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-[13px] text-ink-3">Loading 3D preview…</div> });

interface Props {
  slug: string;
  opportunityId: string;
  design: { id: string; name: string; version: number } | null;
  initialModel: DeckDesignModel;
  products: PricedProduct[];
  estimates: { id: string; title: string; revisions: number }[];
  canEstimate: boolean;
  canExport: boolean;
}

export function DeckEditor({ slug, opportunityId, design, initialModel, products, estimates, canEstimate }: Props) {
  const router = useRouter();
  const [model, setModel] = useState<DeckDesignModel>(initialModel);
  const [name, setName] = useState(design?.name ?? "Main deck");
  const [designId, setDesignId] = useState<string | null>(design?.id ?? null);
  const [version, setVersion] = useState(design?.version ?? 0);
  const [dirty, setDirty] = useState(design === null);
  const [estimateTarget, setEstimateTarget] = useState<string>(estimates[0]?.id ?? "");
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string; issues?: string[] } | null>(null);
  const [pending, start] = useTransition();

  const product = useMemo(() => products.find((p) => p.id === model.deckingProductId) ?? null, [products, model.deckingProductId]);
  const analysis = useMemo(() => analyzeDeck(model, product), [model, product]);
  const totalCents = analysis.decking && product ? analysis.decking.totalPieces * product.unitPriceCents : null;

  function patch(p: Partial<DeckDesignModel>) {
    setModel((m) => ({ ...m, ...p }));
    setDirty(true);
    setMessage(null);
  }

  function save() {
    start(async () => {
      const r = await saveDesignAction(slug, { id: designId, opportunityId, name, model });
      if (!r || ("error" in r && r.error)) {
        setMessage({ tone: "err", text: r?.error ?? "Request failed", issues: r?.issues });
        return;
      }
      const saved = r as { id: string; version: number };
      setDesignId(saved.id);
      setVersion(saved.version);
      setDirty(false);
      setMessage({ tone: "ok", text: `Design saved (v${saved.version}).` });
      if (!designId) router.replace(`/c/${slug}/opportunities/${opportunityId}/design/${saved.id}`);
    });
  }

  function saveEstimate() {
    if (!designId || !product) return;
    start(async () => {
      const r = await createRevisionAction(slug, { designId, catalogProductId: product.id, estimateId: estimateTarget || null });
      if (!r || ("error" in r && r.error)) {
        setMessage({ tone: "err", text: r?.error ?? "Request failed", issues: r?.issues });
        return;
      }
      const rev = r as { estimateId: string; revisionNumber: number };
      router.push(`/c/${slug}/estimates/${rev.estimateId}`);
    });
  }

  const exportBlocked = !analysis.valid;

  return (
    <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
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
          <label className="lbl">Product</label>
          <select className="field" value={model.deckingProductId ?? ""} onChange={(e) => patch({ deckingProductId: e.target.value || null })}>
            <option value="">— choose —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · ${(p.unitPriceCents / 100).toFixed(2)} · {p.stockLengthIn / 12} ft
              </option>
            ))}
          </select>
          {product && (
            <div className="mt-2 text-[12px] text-ink-3">
              {product.manufacturer} · {product.effectiveWidthIn} in effective width · {product.priceSource}
              {product.supplierName ? ` · ${product.supplierName}` : ""}
            </div>
          )}
          <div className="mt-2 text-[12px] text-ink-3">Boards run parallel to the house.</div>
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
          {canEstimate && (
            <div className="card p-3">
              <div className="mb-2 text-[12px] font-medium uppercase tracking-[0.08em] text-ink-3">Draft estimate</div>
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
              <button className="btn btn-secondary w-full" onClick={saveEstimate} disabled={pending || !designId || dirty || !product || exportBlocked} title={!designId || dirty ? "Save the design first" : exportBlocked ? "Fix validation errors first" : undefined}>
                Save draft estimate revision
              </button>
              <div className="mt-1.5 text-[11px] text-ink-3">{!designId || dirty ? "Save the design first." : exportBlocked ? "Blocked by validation errors." : "Snapshots this design and today's price."}</div>
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
              <span className="text-[12px] text-ink-3">Drag to rotate · scroll to zoom</span>
            </div>
            <div className="h-[360px] bg-[#e9eef2]">
              <Deck3D model={model} analysis={analysis} />
            </div>
          </section>
        </div>

        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
            <h2 className="text-[14px] font-semibold">Takeoff</h2>
            <span className="chip border-amber/25 bg-amber-soft text-amber">{DRAFT_SCOPE_LABEL}</span>
          </div>
          <div className="grid gap-4 p-4 md:grid-cols-[1fr_1fr]">
            <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 text-[14px]">
              <Row k="Deck footprint" v={`${formatFeetInches(model.widthIn)} × ${formatFeetInches(model.depthIn)}`} />
              <Row k="Outer edge left of stair" v={formatFeetInches(analysis.outerEdge.leftSegmentIn)} />
              <Row k="Stair opening" v={formatFeetInches(analysis.outerEdge.stairOpeningIn)} />
              <Row k="Outer edge right of stair" v={formatFeetInches(analysis.outerEdge.rightSegmentIn)} />
              <Row k="Open perimeter" v={formatFeetInches(analysis.openPerimeterIn)} strong />
              <dd className="col-span-2 -mt-1 text-[12px] text-ink-3">Both sides plus outer edge, excluding the house edge and stair opening.</dd>
              <dt className="text-ink-2">Stair (schematic)</dt>
              <dd className="num text-right">{analysis.stairSchematic.risers} risers · {analysis.stairSchematic.treads} treads</dd>
              <dd className="col-span-2 -mt-1 text-[12px] text-ink-3">{formatFeetInches(analysis.stairSchematic.totalRunIn)} total run at 11 in per tread · structural sizing comes in a later milestone.</dd>
            </dl>
            <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 text-[14px]">
              {analysis.decking && product ? (
                <>
                  <Row k="Rows" v={`${analysis.decking.rows} @ ${analysis.decking.effectiveWidthIn} in`} />
                  <Row k="Pieces per row" v={`${analysis.decking.piecesPerRow} × ${analysis.decking.stockLengthIn / 12} ft`} />
                  <Row k="Boards" v={`${analysis.decking.totalPieces}`} strong />
                  <Row k="Unit price" v={`$${(product.unitPriceCents / 100).toFixed(2)}`} />
                  <Row k="Decking subtotal" v={`$${((totalCents ?? 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`} strong />
                  <dd className="col-span-2 text-[12px] text-ink-3">Excludes waste, cut reuse, fasteners, framing, railing and add-ons.</dd>
                </>
              ) : (
                <dd className="col-span-2 text-ink-3">Choose a decking product to see board counts and price.</dd>
              )}
            </dl>
          </div>
        </section>
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

function FeetInches({ label, value, onChange, error }: { label: string; value: number; onChange: (inches: number) => void; error?: boolean }) {
  const { feet, inches } = splitFeetInches(value);
  const cls = `field num ${error ? "border-brick ring-2 ring-brick/15" : ""}`;
  return (
    <div>
      <label className="lbl">{label}</label>
      <div className="grid grid-cols-2 gap-2">
        <div className="relative">
          <input type="number" min={0} step={1} className={cls} value={feet} onChange={(e) => onChange(toInches(Math.max(0, Number(e.target.value) || 0), inches))} aria-label={`${label} feet`} />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-ink-3">ft</span>
        </div>
        <div className="relative">
          <input type="number" min={0} max={11} step={1} className={cls} value={inches} onChange={(e) => onChange(toInches(feet, Math.min(11, Math.max(0, Number(e.target.value) || 0))))} aria-label={`${label} inches`} />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-ink-3">in</span>
        </div>
      </div>
    </div>
  );
}
