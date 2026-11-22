"use client";
import type { DeckDesignModel } from "@/modules/design/model";
import { fmtFtIn, type FramingResult } from "@/modules/framing/generate";

/**
 * Auto-generated framing plan (decking removed, looking down). House along the top.
 * Everything drawn comes from `generateFraming`, so the drawing and the schedule cannot disagree.
 */
export function FramingPlan({ model, framing }: { model: DeckDesignModel; framing: FramingResult }) {
  const W = model.widthIn;
  const D = model.depthIn;
  const stairRun = Math.max(framing.stair.horizontalSpanIn, 24);
  const VW = 760;
  const pad = { l: 70, r: 90, t: 74, b: 60 };
  const scale = Math.min((VW - pad.l - pad.r) / W, 300 / (D + stairRun));
  const sx = (x: number) => pad.l + x * scale;
  const sy = (y: number) => pad.t + y * scale;
  const VH = pad.t + (D + stairRun) * scale + pad.b + 70;
  const beamY = framing.beam.centerlineFromHouseIn;
  const beamHalf = Math.max(framing.beam.widthIn * scale, 4) / 2;
  const joistW = Math.max(1.5 * scale, 1.5);
  const joistEndY = framing.beam.type === "dropped" ? D : D - framing.beam.widthIn;
  const stairLeft = Math.min(model.stair.offsetIn, W);
  const invalid = !framing.ok;
  const ink = "#1c1f24";
  const slate = "#2f4858";
  const cedar = "#c3521f";
  const muted = "#7b8089";

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className="h-auto w-full" role="img" aria-label="Auto-generated deck framing plan">
      <defs>
        <pattern id="beamHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke={slate} strokeWidth="1.5" />
        </pattern>
        <marker id="fArrow" markerWidth="6" markerHeight="6" refX="3" refY="5" orient="auto">
          <path d="M0,0 L6,0 L3,6 z" fill={muted} />
        </marker>
      </defs>

      {/* Title */}
      <text x={pad.l} y={18} fontFamily="var(--font-display)" fontSize="13" fontWeight="600" fill={ink}>
        FRAMING PLAN
      </text>
      <text x={pad.l} y={32} className="plan-dim" fill={muted}>
        {framing.ruleset.title} · v{framing.ruleset.version} · design aid, not a sealed drawing
      </text>

      {/* House + ledger */}
      <rect x={sx(0) - 14} y={sy(0) - 14} width={W * scale + 28} height={12} fill={slate} />
      <rect x={sx(0)} y={sy(0) - 2} width={W * scale} height={Math.max(1.5 * scale, 3)} fill={cedar} />
      <text x={sx(W) + 8} y={sy(0) + 4} className="plan-dim" fill={cedar}>
        {framing.ledger.size} ledger
      </text>

      {/* Joists */}
      {framing.joists.positionsIn.map((x, i) => (
        <rect key={i} x={sx(x) - joistW / 2} y={sy(0)} width={joistW} height={(joistEndY - 0) * scale} fill={i === 0 || i === framing.joists.positionsIn.length - 1 ? ink : "#6b5236"} />
      ))}
      {/* Rim joist (dropped) */}
      {framing.joists.rimJoist && <rect x={sx(0)} y={sy(D) - Math.max(1.5 * scale, 3)} width={W * scale} height={Math.max(1.5 * scale, 3)} fill={ink} />}

      {/* Blocking over beam */}
      {framing.joists.blockingOverBeam &&
        framing.joists.positionsIn.slice(0, -1).map((x, i) => {
          const next = framing.joists.positionsIn[i + 1]!;
          return <rect key={`b${i}`} x={sx(x) + joistW / 2} y={sy(beamY) - 1.5} width={(next - x) * scale - joistW} height={3} fill={muted} />;
        })}

      {/* Beam */}
      <rect x={sx(0)} y={sy(beamY) - beamHalf} width={W * scale} height={beamHalf * 2} fill="url(#beamHatch)" stroke={slate} strokeWidth={1.2} />

      {/* Footings + posts */}
      {framing.posts.positionsIn.map((x, i) => {
        const r = ((framing.footings.roundIn ?? 16) / 2) * scale;
        const ps = Math.max((framing.posts.size === "6x6" ? 5.5 : 3.5) * scale, 8);
        return (
          <g key={`p${i}`}>
            <circle cx={sx(x)} cy={sy(beamY)} r={r} fill="none" stroke={muted} strokeWidth={1} strokeDasharray="3 2" />
            <rect x={sx(x) - ps / 2} y={sy(beamY) - ps / 2} width={ps} height={ps} fill={invalid ? "#a3302e" : ink} />
          </g>
        );
      })}

      {/* Tension ties (Method 1) */}
      {framing.posts.lateral.tensionTieJoistIndexes.map((j) => {
        const x = sx(framing.joists.positionsIn[j]!);
        return <path key={`t${j}`} d={`M${x - 5},${sy(0) + 2} L${x + 5},${sy(0) + 2} L${x},${sy(0) + 12} z`} fill={cedar} />;
      })}

      {/* Guard posts */}
      {framing.guards.posts.map((p, i) => (
        <rect key={`g${i}`} x={sx(p.x) - 4} y={sy(p.y) - 4} width={8} height={8} fill="none" stroke={cedar} strokeWidth={1.5} />
      ))}

      {/* Stair stringers */}
      {Array.from({ length: framing.stair.stringerCount }, (_, i) => {
        const x = stairLeft + i * framing.stair.stringerSpacingIn;
        if (x > W + 0.01) return null;
        return (
          <g key={`s${i}`}>
            <line x1={sx(x)} y1={sy(D)} x2={sx(x)} y2={sy(D + stairRun)} stroke={framing.stair.horizontalSpanIn > framing.stair.maxStringerSpanIn ? "#a3302e" : ink} strokeWidth={Math.max(1.5 * scale, 2)} />
            <rect x={sx(x) - 4} y={sy(D + stairRun) - 2} width={8} height={6} fill="none" stroke={muted} strokeWidth={1} />
          </g>
        );
      })}
      <text x={sx(stairLeft + model.stair.widthIn / 2)} y={sy(D + stairRun) + 18} textAnchor="middle" className="plan-dim">
        {`${framing.stair.stringerCount} × 2x12 ${framing.stair.stringerType} stringers · ${framing.stair.risers}R @ ${framing.stair.riserHeightIn.toFixed(2)}"`}
      </text>

      {/* Dimensions */}
      <HDim x1={sx(0)} x2={sx(W)} y={sy(0) - 24} label={fmtFtIn(W)} />
      <VDim x={sx(W) + 40} y1={sy(0)} y2={sy(beamY)} label={`joist span ${fmtFtIn(framing.joists.spanIn)}`} />
      {framing.joists.overhangIn > 0 && <VDim x={sx(W) + 40} y1={sy(beamY)} y2={sy(D)} label={`overhang ${fmtFtIn(framing.joists.overhangIn)}`} />}
      {(() => {
        const y = sy(beamY) + 22;
        const xs = framing.posts.positionsIn;
        return (
          <g>
            {xs[0]! > 0 && <HDim x1={sx(0)} x2={sx(xs[0]!)} y={y} label={fmtFtIn(xs[0]!)} small />}
            {xs.slice(0, -1).map((x, i) => (
              <HDim key={i} x1={sx(x)} x2={sx(xs[i + 1]!)} y={y} label={fmtFtIn(xs[i + 1]! - x)} small />
            ))}
            {W - xs.at(-1)! > 0 && <HDim x1={sx(xs.at(-1)!)} x2={sx(W)} y={y} label={fmtFtIn(W - xs.at(-1)!)} small />}
          </g>
        );
      })()}

      {/* Notes */}
      {[
        `${framing.joists.size} joists @ ${framing.joists.spacingIn}" o.c. · ${framing.joists.rimJoist ? `${framing.joists.rimJoist.size} rim joist` : "flush beam at edge"} · hangers ≥ ${framing.ledger.hangerMinDepthIn.toFixed(2)}" at ledger`,
        `(${framing.beam.plies})${framing.beam.size} ${framing.beam.type} beam · ${framing.posts.count} × ${framing.posts.size} posts @ ${fmtFtIn(framing.beam.spanIn)} · ${framing.footings.type ? `type ${framing.footings.type} footings ${framing.footings.roundIn}" rd / ${framing.footings.squareIn}" sq × ${framing.footings.thicknessIn}"` : "footing n/a"}`,
        `Ledger ${framing.ledger.size}: ${framing.ledger.fastenerLabel}${framing.ledger.spacingIn ? ` @ ${framing.ledger.spacingIn}" o.c. staggered` : ""} · ${framing.posts.lateral.required === "none" ? "no lateral method required" : framing.posts.lateral.methods.map((m) => (m === "method-1-tension-ties" ? "▲ tension ties" : "knee braces")).join(" + ")}${framing.guards.required ? " · □ 4x4 guard posts ≤ 6' o.c." : ""}`,
      ].map((t, i) => (
        <text key={i} x={pad.l} y={VH - 44 + i * 14} className="plan-dim" fill={ink}>
          {t}
        </text>
      ))}
    </svg>
  );
}

function HDim({ x1, x2, y, label, small }: { x1: number; x2: number; y: number; label: string; small?: boolean }) {
  if (x2 - x1 < 2) return null;
  const c = "#4a4f58";
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={c} strokeWidth={0.8} />
      <line x1={x1} y1={y - 4} x2={x1} y2={y + 4} stroke={c} strokeWidth={0.8} />
      <line x1={x2} y1={y - 4} x2={x2} y2={y + 4} stroke={c} strokeWidth={0.8} />
      <rect x={(x1 + x2) / 2 - label.length * 3.2 - 2} y={y - 7} width={label.length * 6.4 + 4} height={14} fill="#fffdf9" />
      <text x={(x1 + x2) / 2} y={y + 3.5} textAnchor="middle" className="plan-dim" fill={c} fontSize={small ? 10 : 11}>
        {label}
      </text>
    </g>
  );
}

function VDim({ x, y1, y2, label }: { x: number; y1: number; y2: number; label: string }) {
  if (y2 - y1 < 2) return null;
  const c = "#4a4f58";
  return (
    <g>
      <line x1={x} y1={y1} x2={x} y2={y2} stroke={c} strokeWidth={0.8} />
      <line x1={x - 4} y1={y1} x2={x + 4} y2={y1} stroke={c} strokeWidth={0.8} />
      <line x1={x - 4} y1={y2} x2={x + 4} y2={y2} stroke={c} strokeWidth={0.8} />
      <text x={x + 6} y={(y1 + y2) / 2 + 4} className="plan-dim" fontSize={10}>
        {label}
      </text>
    </g>
  );
}
