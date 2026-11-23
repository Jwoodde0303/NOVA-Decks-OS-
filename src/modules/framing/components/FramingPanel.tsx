"use client";
import type { DeckDesignModel, FramingOptions } from "@/modules/design/model";
import { fmtFtIn, type FramingResult } from "@/modules/framing/generate";
import { TABLE_6_LEDGER_FASTENERS } from "@/modules/framing/rules/fairfax-2021";
import { FeetInches } from "@/modules/design/components/FeetInches";
import { FramingPlan } from "./FramingPlan";

const BAND_BOARD_LABEL: Record<FramingOptions["bandBoard"], string> = {
  "2x-lumber": "2x lumber band board",
  ewp: '1" min. engineered wood (EWP) band',
  "solid-masonry": "Concrete / solid masonry wall",
  "hollow-masonry": "Hollow masonry (block) wall",
};

export function FramingPanel({ model, framing, onChange }: { model: DeckDesignModel; framing: FramingResult; onChange: (patch: Partial<FramingOptions>) => void }) {
  const o = model.framing;
  const errors = framing.issues.filter((i) => i.severity === "error");
  const warnings = framing.issues.filter((i) => i.severity === "warning");
  const notes = framing.issues.filter((i) => i.severity === "note");

  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <div>
          <h2 className="text-[14px] font-semibold">Framing details</h2>
          <div className="text-[12px] text-ink-3">Auto-generated to {framing.ruleset.title}, v{framing.ruleset.version}</div>
        </div>
        <span className={`chip ${framing.ok ? "border-moss/25 bg-moss-soft text-moss" : "border-brick/25 bg-brick-soft text-brick"}`}>{framing.ok ? "Fits the typical details" : `${errors.length} blocking issue${errors.length === 1 ? "" : "s"}`}</span>
      </div>

      <div className="grid gap-6 p-4 lg:grid-cols-[260px_1fr]">
        {/* Options */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="lbl">Joist spacing</label>
              <select className="field h-8 py-1 text-[13px]" value={o.joistSpacingIn} onChange={(e) => onChange({ joistSpacingIn: Number(e.target.value) as 12 | 16 | 24 })}>
                {[12, 16, 24].map((s) => (
                  <option key={s} value={s}>
                    {`${s}" o.c.`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="lbl">Joist size</label>
              <select className="field h-8 py-1 text-[13px]" value={o.joistSize} onChange={(e) => onChange({ joistSize: e.target.value as FramingOptions["joistSize"] })}>
                <option value="auto">Auto (smallest)</option>
                {["2x6", "2x8", "2x10", "2x12"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="lbl">Outside beam</label>
            <select className="field h-8 py-1 text-[13px]" value={o.beamType} onChange={(e) => onChange({ beamType: e.target.value as "dropped" | "flush" })}>
              <option value="dropped">Dropped (joists bear on top, may overhang)</option>
              <option value="flush">Flush (joists hang from beam at the edge)</option>
            </select>
          </div>
          {o.beamType === "dropped" && <FeetInches compact label="Joist overhang past beam" value={o.joistOverhangIn} onChange={(v) => onChange({ joistOverhangIn: v })} error={errors.some((i) => i.code === "joist-np" || i.code === "overhang-too-large")} />}
          <FeetInches compact label="Beam overhang past end posts" value={o.beamOverhangIn} onChange={(v) => onChange({ beamOverhangIn: v })} error={errors.some((i) => i.code === "beam-overhang")} />
          <div>
            <label className="lbl">Posts</label>
            <select className="field h-8 py-1 text-[13px]" value={o.postCount ?? "auto"} onChange={(e) => onChange({ postCount: e.target.value === "auto" ? null : Number(e.target.value) })}>
              <option value="auto">Auto (fewest that work)</option>
              {Array.from({ length: 11 }, (_, i) => i + 2).map((n) => (
                <option key={n} value={n}>
                  {n} posts
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="lbl">House band board</label>
            <select className="field h-8 py-1 text-[13px]" value={o.bandBoard} onChange={(e) => onChange({ bandBoard: e.target.value as FramingOptions["bandBoard"] })}>
              {(Object.keys(BAND_BOARD_LABEL) as FramingOptions["bandBoard"][]).map((k) => (
                <option key={k} value={k}>
                  {BAND_BOARD_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="lbl">Ledger fastener</label>
            <select className="field h-8 py-1 text-[13px]" value={o.ledgerFastener} onChange={(e) => onChange({ ledgerFastener: e.target.value as FramingOptions["ledgerFastener"] })}>
              {Object.values(TABLE_6_LEDGER_FASTENERS).map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="lbl">Lateral support (when either method is allowed)</label>
            <select className="field h-8 py-1 text-[13px]" value={o.lateralPreference} onChange={(e) => onChange({ lateralPreference: e.target.value as FramingOptions["lateralPreference"] })}>
              <option value="tension-ties">Method 1 — tension ties</option>
              <option value="knee-bracing">Method 2 — knee bracing at beam</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" className="accent-cedar" checked={o.hiddenDeckingFasteners} onChange={(e) => onChange({ hiddenDeckingFasteners: e.target.checked })} />
            Hidden decking fasteners
          </label>

          {errors.length > 0 && (
            <div className="rounded-[var(--radius-md)] border border-brick/30 bg-brick-soft p-3 text-[13px] text-brick">
              <div className="font-semibold">Not permitted by the typical details</div>
              <ul className="mt-1 list-disc pl-5">
                {errors.map((i) => (
                  <li key={i.code + i.message}>
                    {i.message} {i.ref && <span className="text-[11px] opacity-80">({i.ref})</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {warnings.length > 0 && (
            <div className="rounded-[var(--radius-md)] border border-amber/30 bg-amber-soft p-3 text-[13px] text-amber">
              <ul className="list-disc pl-5">
                {warnings.map((i) => (
                  <li key={i.code}>
                    {i.message} {i.ref && <span className="text-[11px] opacity-80">({i.ref})</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Plan + schedule */}
        <div className="space-y-4">
          <div className="rounded-[var(--radius-sm)] border border-line bg-surface p-2">
            <FramingPlan model={model} framing={framing} />
          </div>

          <div className="grid gap-5 md:grid-cols-[2fr_3fr]">
            <div>
              <div className="lbl">Complete-my-deck worksheet (county form, p. 27)</div>
              <table className="tbl text-[13px]">
                <tbody>
                  {framing.worksheet.map((w) => (
                    <tr key={w.label}>
                      <td className="text-ink-2">{w.label}</td>
                      <td className="num text-right">{w.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <div className="lbl">Framing materials (counts only, not priced)</div>
              <table className="tbl text-[13px]">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="text-right">Qty</th>
                    <th>Size / unit</th>
                  </tr>
                </thead>
                <tbody>
                  {framing.materials.map((m) => (
                    <tr key={m.item}>
                      <td>
                        {m.item}
                        {m.note && <div className="text-[11px] text-ink-3">{m.note}</div>}
                      </td>
                      <td className="num text-right font-medium">{m.qty}</td>
                      <td className="num text-ink-2">{m.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-x-6 gap-y-2 text-[13px] md:grid-cols-2">
            <Detail title="Joists" body={`${framing.joists.size} @ ${framing.joists.spacingIn}" o.c., span ${fmtFtIn(framing.joists.spanIn)} (allowable ${fmtFtIn(framing.joists.allowableSpanIn)})${framing.joists.overhangIn ? `, overhang ${fmtFtIn(framing.joists.overhangIn)} (allowable ${framing.joists.allowableOverhangIn === null ? "NP" : fmtFtIn(framing.joists.allowableOverhangIn)})` : ""}. ${framing.joists.joistToBeam}. Rim: ${framing.joists.rimJoist ? `${framing.joists.rimJoist.size}, (3)10d nails per joist` : "none (flush beam)"}.${framing.joists.blockingOverBeam ? " Blocking between joists over the beam." : ""}`} cite="Table 2, Figures 5/6, 11, 12" />
            <Detail title="Beam" body={`(${framing.beam.plies})${framing.beam.size} ${framing.beam.type}, influence width ${fmtFtIn(framing.beam.influenceWidthIn)} (table ${framing.beam.influenceWidthTableFt} ft), span ${fmtFtIn(framing.beam.spanIn)}, overhang ${fmtFtIn(framing.beam.overhangIn)} (max ${fmtFtIn(framing.beam.maxOverhangIn)}).${framing.beam.alternatives.length > 1 ? ` County alternatives: ${framing.beam.alternatives.join(" or ")}.` : ""} ${framing.beam.plyFastening}.`} cite="Table 3, Figures 13–15" />
            <Detail title="Posts & footings" body={`${framing.posts.count} × ${framing.posts.size} posts, ${fmtFtIn(framing.posts.heightIn)} tall (max ${framing.posts.maxHeightIn ? fmtFtIn(framing.posts.maxHeightIn) : "—"}). ${framing.beam.beamToPost}. Footings ${framing.footings.type ? `type ${framing.footings.type}: ${framing.footings.squareIn}" square or ${framing.footings.roundIn}" round, ${framing.footings.thicknessIn}" thick` : "—"}, bearing ${framing.footings.depthBelowGradeIn}" min. below grade on solid ground; 3,000 PSI concrete; 1" min. post base.${framing.footings.withinFiveFeetOfHouse ? " Within 5 ft of the house: bear at the house footing elevation." : ""}`} cite="Tables 4–5, Figures 16–19" />
            <Detail title="Ledger" body={`${framing.ledger.size} on ${BAND_BOARD_LABEL[framing.ledger.bandBoard].toLowerCase()}: ${framing.ledger.fastenerLabel}${framing.ledger.spacingIn ? ` @ ${framing.ledger.spacingIn}" o.c. (joist span ≤ ${framing.ledger.spanColumnFt} ft column)` : ""}; ${framing.ledger.pattern}. ${framing.ledger.hangerCount} joist hangers ≥ ${framing.ledger.hangerMinDepthIn.toFixed(2)}" deep with manufacturer screws. Siding removed; top of ledger flush with top of joists.`} cite="Table 6, Figures 22–27" />
            <Detail title="Lateral support" body={framing.posts.lateral.description} cite="Table 8, Figures 28–33" />
            <Detail title="Guards" body={framing.guards.required ? `Required (deck > 30" above grade): 36" min. height, 4x4 posts at ≤ 6' o.c. (${framing.guards.posts.length} posts) with (2) ½" through-bolts and 1,800 lb hold-downs, blocking at posts, 2x2 balusters, 4" sphere rule.` : 'Not required (deck ≤ 30" above grade).'} cite="Figures 34–38" />
            <Detail title="Stair" body={`${fmtFtIn(framing.stair.widthIn)} wide, ${framing.stair.risers} risers @ ${framing.stair.riserHeightIn.toFixed(2)}" (max 8¼"), ${framing.stair.treads} treads @ ${framing.stair.treadRunIn}" run (min 9"), horizontal span ${fmtFtIn(framing.stair.horizontalSpanIn)} (max ${fmtFtIn(framing.stair.maxStringerSpanIn)} for ${framing.stair.stringerType} stringers). ${framing.stair.stringerCount} × 2x12 stringers ≤ 18" o.c.; ${framing.stair.footing}; ${framing.stair.upperBearing}.${framing.stair.guardRequired ? " Stair guard 34–38\" above nosings." : ""}${framing.stair.handrailRequired ? " Handrail on one side, 34–38\", returned at ends." : ""}`} cite="Figures 39–45" />
            {framing.manufacturerRules && (
              <div className="md:col-span-2 rounded-[var(--radius-sm)] border border-slate/20 bg-slate-soft/50 p-3">
                <div className="font-semibold">
                  Manufacturer installation rules applied <span className="text-[11px] font-normal text-ink-3">{framing.manufacturerRules.manufacturer} {framing.manufacturerRules.productLine} · {framing.manufacturerRules.rules.source.title}</span>
                </div>
                <ul className="mt-1 list-disc pl-5 text-ink-2">
                  {framing.manufacturerRules.applied.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                  {framing.manufacturerRules.rules.notes.map((n) => (
                    <li key={n} className="text-ink-3">{n}</li>
                  ))}
                </ul>
              </div>
            )}
            {framing.underJoistBracingRequired && <Detail title="Under-joist bracing" body="Hidden decking fasteners with posts over 2.5 ft: 2x6 bracing under the joists at 45°–60°, continuous, attached to every joist." cite="Figures 2–3" />}
          </div>

          {notes.length > 0 && (
            <ul className="list-disc pl-5 text-[12px] text-ink-2">
              {notes.map((n) => (
                <li key={n.code}>
                  {n.message} {n.ref && <span className="text-ink-3">({n.ref})</span>}
                </li>
              ))}
            </ul>
          )}
          <details className="text-[12px] text-ink-3">
            <summary className="cursor-pointer">Assumptions and limits</summary>
            <ul className="mt-1 list-disc pl-5">
              {framing.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
              <li>Design loads: {framing.ruleset.designLoads}. Lumber: {framing.ruleset.lumber}.</li>
              <li>
                Source:{" "}
                <a href={framing.ruleset.sourceUrl} target="_blank" rel="noreferrer" className="text-slate underline">
                  {framing.ruleset.title}
                </a>
                , {framing.ruleset.basis}. Verify against the current edition; the county&apos;s plan review and inspections still apply.
              </li>
            </ul>
          </details>
        </div>
      </div>
    </section>
  );
}

function Detail({ title, body, cite }: { title: string; body: string; cite: string }) {
  return (
    <div>
      <div className="font-semibold">
        {title} <span className="text-[11px] font-normal text-ink-3">{cite}</span>
      </div>
      <div className="text-ink-2">{body}</div>
    </div>
  );
}
