"use client";
import { formatFeetInches } from "@/modules/core/units";
import type { DeckAnalysis, DeckDesignModel } from "@/modules/design/model";

/**
 * Dimensioned overhead plan. House along the top; deck below; stair projecting from the outer edge.
 * Pure function of the design model + analysis so it always agrees with the takeoff.
 */
export function PlanView({ model, analysis }: { model: DeckDesignModel; analysis: DeckAnalysis }) {
  const W = 520;
  const pad = { l: 56, r: 56, t: 44, b: 40 };
  const stairRun = Math.max(analysis.stairSchematic.totalRunIn, 24);
  const totalDepthIn = model.depthIn + stairRun;
  const scale = Math.min((W - pad.l - pad.r) / model.widthIn, 260 / totalDepthIn);
  const dw = model.widthIn * scale;
  const dd = model.depthIn * scale;
  const H = pad.t + dd + stairRun * scale + pad.b + 20;
  const x0 = pad.l;
  const y0 = pad.t;
  const stairX = x0 + Math.min(model.stair.offsetIn, model.widthIn) * scale;
  const stairW = analysis.outerEdge.stairOpeningIn * scale;
  const overflowIn = Math.max(0, model.stair.offsetIn + model.stair.widthIn - model.widthIn);
  const stairYTop = y0 + dd;
  const treads = Math.max(1, analysis.stairSchematic.treads);
  const treadH = (stairRun * scale) / treads;
  const boardW = 6 * scale; // visual board spacing only

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Deck plan view">
      <defs>
        <pattern id="boards" width="4" height={boardW} patternUnits="userSpaceOnUse">
          <rect width="4" height={boardW} fill="#f3e9dc" />
          <line x1="0" y1={boardW - 0.5} x2="4" y2={boardW - 0.5} stroke="#d9c6ad" strokeWidth="0.8" />
        </pattern>
      </defs>

      {/* House */}
      <rect x={x0 - 12} y={y0 - 16} width={dw + 24} height={14} fill="#2f4858" />
      <text x={x0 + dw / 2} y={y0 - 20} textAnchor="middle" className="plan-dim" fill="#2f4858" fontWeight={600}>
        HOUSE
      </text>

      {/* Deck */}
      <rect x={x0} y={y0} width={dw} height={dd} fill="url(#boards)" stroke="#1c1f24" strokeWidth={1.5} />

      {/* Outer edge segments (guard runs) */}
      <line x1={x0} y1={y0 + dd} x2={stairX} y2={y0 + dd} stroke="#c3521f" strokeWidth={3} />
      <line x1={stairX + stairW} y1={y0 + dd} x2={x0 + dw} y2={y0 + dd} stroke="#c3521f" strokeWidth={3} />
      <line x1={x0} y1={y0} x2={x0} y2={y0 + dd} stroke="#c3521f" strokeWidth={3} />
      <line x1={x0 + dw} y1={y0} x2={x0 + dw} y2={y0 + dd} stroke="#c3521f" strokeWidth={3} />

      {/* Stair (schematic) */}
      <g>
        <rect x={stairX} y={stairYTop} width={Math.max(stairW, 1)} height={stairRun * scale} fill={overflowIn > 0 ? "#f6dcdb" : "#fffdf9"} stroke={overflowIn > 0 ? "#a3302e" : "#1c1f24"} strokeWidth={1.2} strokeDasharray={overflowIn > 0 ? "4 3" : undefined} />
        {Array.from({ length: treads - 1 }, (_, i) => (
          <line key={i} x1={stairX} y1={stairYTop + treadH * (i + 1)} x2={stairX + stairW} y2={stairYTop + treadH * (i + 1)} stroke="#7b8089" strokeWidth={0.8} />
        ))}
        {/* down arrow */}
        <line x1={stairX + stairW / 2} y1={stairYTop + 6} x2={stairX + stairW / 2} y2={stairYTop + stairRun * scale - 8} stroke="#4a4f58" strokeWidth={1} markerEnd="url(#arrow)" />
        <text x={stairX + stairW / 2} y={stairYTop + stairRun * scale + 12} textAnchor="middle" className="plan-dim">
          DN {analysis.stairSchematic.risers}R
        </text>
        {overflowIn > 0 && (
          <g>
            <rect x={x0 + dw} y={stairYTop} width={overflowIn * scale} height={stairRun * scale} fill="#f6dcdb" stroke="#a3302e" strokeWidth={1.2} strokeDasharray="4 3" />
            <text x={x0 + dw + (overflowIn * scale) / 2} y={stairYTop - 6} textAnchor="middle" className="plan-dim" fill="#a3302e" fontWeight={600}>
              +{formatFeetInches(overflowIn)} over
            </text>
          </g>
        )}
      </g>
      <defs>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="5" orient="auto">
          <path d="M0,0 L6,0 L3,6 z" fill="#4a4f58" />
        </marker>
      </defs>

      {/* Width dimension (bottom) */}
      <Dim x1={x0} x2={x0 + dw} y={H - 14} label={formatFeetInches(model.widthIn)} />
      {/* Depth dimension (right) */}
      <DimV x={x0 + dw + 30} y1={y0} y2={y0 + dd} label={formatFeetInches(model.depthIn)} />
      {/* Stair offset / width / remainder dims along outer edge */}
      <Dim x1={x0} x2={stairX} y={y0 + dd + 16} label={formatFeetInches(analysis.outerEdge.leftSegmentIn)} small />
      <Dim x1={stairX} x2={stairX + stairW} y={y0 + dd + 16} label={formatFeetInches(analysis.outerEdge.stairOpeningIn)} small accent />
      {analysis.outerEdge.rightSegmentIn > 0 && <Dim x1={stairX + stairW} x2={x0 + dw} y={y0 + dd + 16} label={formatFeetInches(analysis.outerEdge.rightSegmentIn)} small />}
      {/* Height note */}
      <text x={x0} y={y0 + 14} className="plan-dim" fill="#4a4f58">
        ▲ {formatFeetInches(model.heightIn)} above grade
      </text>
    </svg>
  );
}

function Dim({ x1, x2, y, label, small, accent }: { x1: number; x2: number; y: number; label: string; small?: boolean; accent?: boolean }) {
  if (x2 - x1 < 1) return null;
  const c = accent ? "#c3521f" : "#4a4f58";
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={c} strokeWidth={0.8} />
      <line x1={x1} y1={y - 4} x2={x1} y2={y + 4} stroke={c} strokeWidth={0.8} />
      <line x1={x2} y1={y - 4} x2={x2} y2={y + 4} stroke={c} strokeWidth={0.8} />
      <rect x={(x1 + x2) / 2 - label.length * 3.4 - 3} y={y - 7} width={label.length * 6.8 + 6} height={14} fill="#fffdf9" />
      <text x={(x1 + x2) / 2} y={y + 3.5} textAnchor="middle" className="plan-dim" fill={c} fontSize={small ? 10 : 11}>
        {label}
      </text>
    </g>
  );
}

function DimV({ x, y1, y2, label }: { x: number; y1: number; y2: number; label: string }) {
  return (
    <g>
      <line x1={x} y1={y1} x2={x} y2={y2} stroke="#4a4f58" strokeWidth={0.8} />
      <line x1={x - 4} y1={y1} x2={x + 4} y2={y1} stroke="#4a4f58" strokeWidth={0.8} />
      <line x1={x - 4} y1={y2} x2={x + 4} y2={y2} stroke="#4a4f58" strokeWidth={0.8} />
      <text x={x + 6} y={(y1 + y2) / 2 + 4} className="plan-dim">
        {label}
      </text>
    </g>
  );
}
