"use client";
import { useMemo } from "react";

export interface CatalogPickerItem {
  id: string;
  manufacturer: string;
  productLine: string;
  color: string | null;
  colorHex: string | null;
  profile: "square-edge" | "grooved" | "tongue-and-groove";
  material: string;
  thicknessIn: number | null;
  widthActualIn: number | null;
  stockLengthIn: number;
  effectiveWidthIn: number;
  sku: string;
  name: string;
  verified: boolean;
}

const PROFILE_LABEL = { "square-edge": "Square edge", grooved: "Grooved", "tongue-and-groove": "T&G" } as const;

/**
 * Cascading decking picker: manufacturer → collection → colour → profile/width → length.
 * Changing an upstream choice re-selects the closest matching downstream SKU.
 */
export function ProductPicker({ items, prices, value, onChange }: { items: CatalogPickerItem[]; prices: Record<string, number>; value: string | null; onChange: (id: string | null) => void }) {
  const current = items.find((i) => i.id === value) ?? null;
  const manufacturers = useMemo(() => [...new Set(items.map((i) => i.manufacturer))], [items]);
  const mfr = current?.manufacturer ?? manufacturers[0] ?? "";
  const lines = useMemo(() => [...new Set(items.filter((i) => i.manufacturer === mfr).map((i) => i.productLine))], [items, mfr]);
  const line = current?.productLine ?? lines[0] ?? "";
  const colors = useMemo(() => {
    const seen = new Map<string, string | null>();
    for (const i of items) if (i.manufacturer === mfr && i.productLine === line && i.color) seen.set(i.color, i.colorHex);
    return [...seen.entries()];
  }, [items, mfr, line]);
  const color = current?.color ?? colors[0]?.[0] ?? "";
  const formats = useMemo(() => {
    const seen = new Map<string, { profile: CatalogPickerItem["profile"]; widthActualIn: number | null; thicknessIn: number | null }>();
    for (const i of items) if (i.manufacturer === mfr && i.productLine === line && i.color === color) seen.set(`${i.profile}|${i.widthActualIn}|${i.thicknessIn}`, { profile: i.profile, widthActualIn: i.widthActualIn, thicknessIn: i.thicknessIn });
    return [...seen.entries()];
  }, [items, mfr, line, color]);
  const formatKey = current ? `${current.profile}|${current.widthActualIn}|${current.thicknessIn}` : (formats[0]?.[0] ?? "");
  const lengths = useMemo(() => items.filter((i) => i.manufacturer === mfr && i.productLine === line && i.color === color && `${i.profile}|${i.widthActualIn}|${i.thicknessIn}` === formatKey).sort((a, b) => a.stockLengthIn - b.stockLengthIn), [items, mfr, line, color, formatKey]);

  /** Pick the best SKU for a partial selection, preferring priced + grooved + 16 ft. */
  function pick(f: { manufacturer?: string; productLine?: string; color?: string; formatKey?: string; lengthIn?: number }) {
    const m = f.manufacturer ?? mfr;
    const l = f.productLine ?? (f.manufacturer ? undefined : line);
    const c = f.color ?? (f.manufacturer || f.productLine ? undefined : color);
    const fk = f.formatKey ?? (f.manufacturer || f.productLine || f.color ? undefined : formatKey);
    const candidates = items.filter((i) => i.manufacturer === m && (!l || i.productLine === l) && (!c || i.color === c) && (!fk || `${i.profile}|${i.widthActualIn}|${i.thicknessIn}` === fk) && (!f.lengthIn || i.stockLengthIn === f.lengthIn));
    const score = (i: CatalogPickerItem) => (prices[i.id] ? 100 : 0) + (i.profile === "grooved" ? 10 : 0) + (i.stockLengthIn === 192 ? 5 : 0) + (i.widthActualIn && i.widthActualIn >= 5 && i.widthActualIn < 6 ? 3 : 0);
    const best = candidates.sort((a, b) => score(b) - score(a))[0];
    onChange(best?.id ?? null);
  }

  const sel = "field h-8 py-1 text-[13px]";
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="lbl">Manufacturer</label>
          <select className={sel} value={mfr} onChange={(e) => pick({ manufacturer: e.target.value })}>
            {manufacturers.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="lbl">Collection</label>
          <select className={sel} value={line} onChange={(e) => pick({ productLine: e.target.value })}>
            {lines.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="lbl">Colour</label>
        <div className="flex flex-wrap gap-1.5">
          {colors.map(([name, hex]) => (
            <button key={name} type="button" title={name} onClick={() => pick({ color: name })} className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[12px] ${name === color ? "border-ink bg-surface font-medium" : "border-line bg-paper-2/50 text-ink-2 hover:border-line-strong"}`}>
              <span className="inline-block h-3.5 w-3.5 rounded-full border border-black/10" style={{ background: hex ?? "#999" }} />
              {name}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="lbl">Profile · width</label>
          <select className={sel} value={formatKey} onChange={(e) => pick({ formatKey: e.target.value })}>
            {formats.map(([k, f]) => (
              <option key={k} value={k}>
                {`${PROFILE_LABEL[f.profile]} · ${f.widthActualIn}" × ${f.thicknessIn}"`}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="lbl">Length</label>
          <select className={sel} value={current?.stockLengthIn ?? ""} onChange={(e) => pick({ lengthIn: Number(e.target.value) })}>
            {lengths.map((i) => (
              <option key={i.id} value={i.stockLengthIn}>
                {i.stockLengthIn / 12} ft{prices[i.id] ? ` · $${(prices[i.id]! / 100).toFixed(2)}` : " · no price"}
              </option>
            ))}
          </select>
        </div>
      </div>
      {current && (
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-3">
          <span className="num">{current.sku}</span>
          <span>{`· ${current.effectiveWidthIn}" installed width`}</span>
          {prices[current.id] ? <span className="num text-ink">· ${(prices[current.id]! / 100).toFixed(2)} each</span> : <span className="text-brick">· no company price set</span>}
          {!current.verified && <span className="chip border-amber/25 bg-amber-soft text-amber">verify vs. data sheet</span>}
        </div>
      )}
    </div>
  );
}
