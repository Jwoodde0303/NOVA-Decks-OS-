"use client";
import { splitFeetInches, toInches } from "@/modules/core/units";

export function FeetInches({ label, value, onChange, error, compact }: { label: string; value: number; onChange: (inches: number) => void; error?: boolean; compact?: boolean }) {
  const { feet, inches } = splitFeetInches(value);
  const cls = `field num ${compact ? "h-8 py-1 text-[13px]" : ""} ${error ? "border-brick ring-2 ring-brick/15" : ""}`;
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
