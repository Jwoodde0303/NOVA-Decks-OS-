import type { DeckAnalysis, DeckDesignModel } from "@/modules/design/model";
import { fmtFtIn, type FramingResult } from "@/modules/framing/generate";
import { ACCENT, DrawingBuilder, INK, MUTED, SLATE, fitScale, scaleLabelFor, snapScale, type Drawing } from "./model";

/**
 * Pure drawing generators. Every sheet in the permit planset and the framing plan on the web
 * come from these functions, fed by the same design model and framing result.
 * Boxes are in points; real-world inches are scaled to an architectural scale when they fit.
 */

export interface DrawingInputs {
  model: DeckDesignModel;
  analysis: DeckAnalysis;
  framing: FramingResult;
  product?: { manufacturer: string; productLine: string; color: string | null; name: string; effectiveWidthIn: number; widthActualIn: number | null } | null;
}

export interface Box {
  w: number;
  h: number;
}

const DEFAULT_BOX: Box = { w: 744, h: 470 };
const GUARD_HEIGHT_IN = 36;
const DECKING_T_IN = 1;

function scaled(realW: number, realH: number, box: Box, pad: { l: number; r: number; t: number; b: number }, snap = true) {
  const raw = fitScale(realW, realH, box.w - pad.l - pad.r, box.h - pad.t - pad.b);
  const s = snap ? snapScale(raw) : raw;
  const ox = pad.l + (box.w - pad.l - pad.r - realW * s) / 2;
  const oy = pad.t + (box.h - pad.t - pad.b - realH * s) / 2;
  return { s, ox, oy, label: snap ? scaleLabelFor(s) : "NTS" };
}

/* ------------------------------ Framing plan ------------------------------ */

export function framingPlanDrawing(i: DrawingInputs, box: Box = DEFAULT_BOX): Drawing {
  const { model: m, framing: f } = i;
  const W = m.widthIn;
  const D = m.depthIn;
  const stairRun = Math.max(f.stair.horizontalSpanIn, 24);
  const pad = { l: 60, r: 110, t: 48, b: 70 };
  const { s, ox, oy, label } = scaled(W, D + stairRun, box, pad);
  const b = new DrawingBuilder(box.w, box.h);
  const X = (x: number) => ox + x * s;
  const Y = (y: number) => oy + y * s;
  const beamY = f.beam.centerlineFromHouseIn;
  const beamHalf = Math.max((f.beam.widthIn * s) / 2, 2);
  const jw = Math.max(1.5 * s, 1.2);
  const joistEnd = f.beam.type === "dropped" ? D : D - f.beam.widthIn;
  const stairLeft = Math.min(m.stair.offsetIn, W);

  // House + ledger
  b.rect(X(0) - 10, Y(0) - 10, W * s + 20, 9, { fill: SLATE, color: SLATE });
  b.text(X(W / 2), Y(0) - 13, "EXISTING HOUSE", { anchor: "middle", size: 6, color: SLATE, weight: "bold" });
  b.rect(X(0), Y(0) - 1.5, W * s, Math.max(1.5 * s, 2.5), { fill: ACCENT, color: ACCENT });
  b.text(X(W) + 6, Y(0) + 3, `${f.ledger.size} LEDGER`, { size: 6, color: ACCENT, weight: "bold" });

  // Joists
  f.joists.positionsIn.forEach((x, idx) => {
    const end = idx === 0 || idx === f.joists.positionsIn.length - 1;
    b.rect(X(x) - jw / 2, Y(0), jw, joistEnd * s, { fill: end ? INK : "#8c7352", color: end ? INK : "#8c7352", width: 0.3 });
  });
  if (f.joists.rimJoist) b.rect(X(0), Y(D) - Math.max(1.5 * s, 2.5), W * s, Math.max(1.5 * s, 2.5), { fill: INK, color: INK });
  if (f.joists.blockingOverBeam) {
    const xs = f.joists.positionsIn;
    for (let k = 0; k < xs.length - 1; k++) b.rect(X(xs[k]!) + jw / 2, Y(beamY) - 1, (xs[k + 1]! - xs[k]!) * s - jw, 2, { fill: MUTED, color: MUTED });
  }
  // Beam
  b.rect(X(0), Y(beamY) - beamHalf, W * s, beamHalf * 2, { hatch: true, color: SLATE, width: 1 });
  // Posts + footings
  for (const x of f.posts.positionsIn) {
    const r = ((f.footings.roundIn ?? 16) / 2) * s;
    const ps = Math.max((f.posts.size === "6x6" ? 5.5 : 3.5) * s, 6);
    b.circle(X(x), Y(beamY), r, { color: MUTED, width: 0.6, dash: "2 1.5" });
    b.rect(X(x) - ps / 2, Y(beamY) - ps / 2, ps, ps, { fill: INK, color: INK });
  }
  // Tension ties
  for (const j of f.posts.lateral.tensionTieJoistIndexes) {
    const x = X(f.joists.positionsIn[j]!);
    b.path(`M${x - 4},${Y(0) + 1.5} L${x + 4},${Y(0) + 1.5} L${x},${Y(0) + 9} Z`, { fill: ACCENT, color: ACCENT });
  }
  // Guard posts
  for (const p of f.guards.posts) b.rect(X(p.x) - 3, Y(p.y) - 3, 6, 6, { color: ACCENT, width: 1 });
  // Stair stringers
  for (let k = 0; k < f.stair.stringerCount; k++) {
    const x = stairLeft + k * f.stair.stringerSpacingIn;
    if (x > W + 0.01) break;
    b.line(X(x), Y(D), X(x), Y(D + stairRun), { color: INK, width: Math.max(1.5 * s, 1.5) });
    b.rect(X(x) - 3, Y(D + stairRun) - 1.5, 6, 4.5, { color: MUTED, width: 0.5 });
  }
  b.text(X(stairLeft + m.stair.widthIn / 2), Y(D + stairRun) + 12, `${f.stair.stringerCount} x 2x12 ${f.stair.stringerType.toUpperCase()} STRINGERS @ ${f.stair.stringerSpacingIn.toFixed(1)}" O.C. MAX ${f.stair.stringerMaxSpacingIn}"`, { anchor: "middle", size: 6, mono: true });

  // Dimensions
  b.hdim(X(0), X(W), Y(0) - 24, fmtFtIn(W), { above: true });
  b.vdim(X(W) + 34, Y(0), Y(beamY), `JOIST SPAN ${fmtFtIn(f.joists.spanIn)}`);
  if (f.joists.overhangIn > 0) b.vdim(X(W) + 34, Y(beamY), Y(D), `OVERHANG ${fmtFtIn(f.joists.overhangIn)}`);
  const xs = f.posts.positionsIn;
  const dy = Y(beamY) + 16;
  if (xs[0]! > 0) b.hdim(X(0), X(xs[0]!), dy, fmtFtIn(xs[0]!), { size: 6 });
  xs.slice(0, -1).forEach((x, k) => b.hdim(X(x), X(xs[k + 1]!), dy, fmtFtIn(xs[k + 1]! - x), { size: 6 }));
  if (W - xs.at(-1)! > 0) b.hdim(X(xs.at(-1)!), X(W), dy, fmtFtIn(W - xs.at(-1)!), { size: 6 });

  // Callouts
  const mid = f.joists.positionsIn[Math.floor(f.joists.positionsIn.length / 2)]!;
  b.leader(X(mid) + 1, Y(D * 0.12), X(W) + 34, Y(0) - 6, `${f.joists.size} JOISTS @ ${f.joists.spacingIn}" O.C.`);
  b.leader(X(W * 0.25), Y(beamY), X(W * 0.25) - 20, Y(D + stairRun) + 30, `(${f.beam.plies})${f.beam.size} ${f.beam.type.toUpperCase()} BEAM`, { anchor: "end" });
  b.leader(X(xs[0]!) + 3, Y(beamY) + 3, X(0) - 12, Y(D + stairRun) + 42, `${f.posts.count} - ${f.posts.size} POSTS ON TYPE ${f.footings.type ?? "?"} FOOTINGS (${f.footings.roundIn}" RD / ${f.footings.squareIn}" SQ x ${f.footings.thicknessIn}")`, { anchor: "start" });

  // Legend
  const lx = box.w - pad.r + 8;
  let ly = Y(D) + 20;
  const legend: [string, string][] = [
    ["LEGEND", ""],
    [`${f.ledger.size} ledger`, f.ledger.spacingIn ? `${f.ledger.fastenerLabel} @ ${f.ledger.spacingIn}" o.c. staggered` : f.ledger.fastenerLabel],
    ["Triangle", f.posts.lateral.required === "none" ? "no lateral method required" : "tension tie (Method 1)"],
    ["Square (red)", f.guards.required ? "4x4 guard post, hold-down" : "guards not required"],
    ["Dashed circle", "footing, 24\" min below grade"],
  ];
  for (const [k, v] of legend) {
    b.text(lx, ly, k, { size: 5.5, weight: k === "LEGEND" ? "bold" : "normal" });
    if (v) b.text(lx, ly + 6.5, v, { size: 5, color: MUTED });
    ly += v ? 15 : 9;
  }
  return b.build("FRAMING PLAN", label, `${f.ruleset.title} v${f.ruleset.version}`);
}

/* -------------------------------- Deck plan ------------------------------- */

export function deckPlanDrawing(i: DrawingInputs, box: Box = DEFAULT_BOX): Drawing {
  const { model: m, analysis: a, framing: f, product } = i;
  const W = m.widthIn;
  const D = m.depthIn;
  const stairRun = Math.max(f.stair.horizontalSpanIn, 24);
  const pad = { l: 60, r: 90, t: 48, b: 60 };
  const { s, ox, oy, label } = scaled(W, D + stairRun, box, pad);
  const b = new DrawingBuilder(box.w, box.h);
  const X = (x: number) => ox + x * s;
  const Y = (y: number) => oy + y * s;
  const pitch = (product?.effectiveWidthIn ?? a.decking?.effectiveWidthIn ?? 6) * s;

  b.rect(X(0) - 10, Y(0) - 10, W * s + 20, 9, { fill: SLATE, color: SLATE });
  b.text(X(W / 2), Y(0) - 13, "EXISTING HOUSE", { anchor: "middle", size: 6, color: SLATE, weight: "bold" });
  b.rect(X(0), Y(0), W * s, D * s, { fill: "#f6efe4", color: INK, width: 1.2 });
  for (let y = pitch; y < D * s - 0.5; y += pitch) b.line(X(0), Y(0) + y, X(W), Y(0) + y, { color: "#c9b79a", width: 0.4 });
  // Guards (open perimeter) heavy lines
  const left = a.outerEdge.leftSegmentIn;
  const open = a.outerEdge.stairOpeningIn;
  if (f.guards.required) {
    b.line(X(0), Y(0), X(0), Y(D), { color: ACCENT, width: 2 });
    b.line(X(W), Y(0), X(W), Y(D), { color: ACCENT, width: 2 });
    b.line(X(0), Y(D), X(left), Y(D), { color: ACCENT, width: 2 });
    b.line(X(left + open), Y(D), X(W), Y(D), { color: ACCENT, width: 2 });
  }
  // Stair treads
  const treads = Math.max(1, f.stair.treads);
  const th = (stairRun * s) / treads;
  b.rect(X(left), Y(D), open * s, stairRun * s, { color: INK, width: 0.9 });
  for (let k = 1; k < treads; k++) b.line(X(left), Y(D) + th * k, X(left + open), Y(D) + th * k, { color: MUTED, width: 0.5 });
  b.text(X(left + open / 2), Y(D + stairRun) + 9, `DN ${f.stair.risers}R @ ${f.stair.riserHeightIn.toFixed(2)}" / ${f.stair.treads}T @ ${f.stair.treadRunIn}"`, { anchor: "middle", size: 6, mono: true });
  // Dims
  b.hdim(X(0), X(W), Y(0) - 24, fmtFtIn(W), { above: true });
  b.vdim(X(W) + 30, Y(0), Y(D), fmtFtIn(D));
  b.hdim(X(0), X(left), Y(D) + 14, fmtFtIn(left), { size: 6 });
  b.hdim(X(left), X(left + open), Y(D) + 14, fmtFtIn(open), { size: 6, color: ACCENT });
  if (W - left - open > 0) b.hdim(X(left + open), X(W), Y(D) + 14, fmtFtIn(W - left - open), { size: 6 });
  const productText = product ? `${product.manufacturer} ${product.productLine} ${product.color ?? ""} decking, ${product.widthActualIn ?? ""}" boards at ${product.effectiveWidthIn}" installed width, parallel to house` : "Decking per schedule";
  b.text(X(0), Y(D + stairRun) + 30, productText.toUpperCase(), { size: 6 });
  b.text(X(0), Y(D + stairRun) + 40, `DECK SURFACE ${fmtFtIn(m.heightIn)} ABOVE GRADE - OPEN PERIMETER (GUARD) ${fmtFtIn(a.openPerimeterIn)} - GUARD ${f.guards.required ? "REQUIRED, 36\" MIN" : "NOT REQUIRED"} - 4\" SPHERE RULE`, { size: 6 });
  return b.build("DECK PLAN", label);
}

/* ------------------------------- Elevation -------------------------------- */

export function elevationDrawing(i: DrawingInputs, box: Box = DEFAULT_BOX): Drawing {
  const { model: m, analysis: a, framing: f } = i;
  const W = m.widthIn;
  const H = m.heightIn;
  const frost = f.footings.depthBelowGradeIn;
  const topY = H + GUARD_HEIGHT_IN + 6; // above grade
  const totalH = topY + frost + 6;
  const pad = { l: 70, r: 90, t: 40, b: 50 };
  const { s, ox, oy, label } = scaled(W + 24, totalH, box, pad);
  const b = new DrawingBuilder(box.w, box.h);
  const X = (x: number) => ox + (x + 12) * s;
  const Y = (elev: number) => oy + (topY - elev) * s; // elevation above grade → y
  const jd = f.joists.depthIn;
  const bd = f.beam.depthIn;
  const deckTop = H;
  const joistTop = H - DECKING_T_IN;
  const beamTop = f.beam.type === "dropped" ? joistTop - jd : joistTop;
  const beamBottom = beamTop - bd;

  // Grade + earth
  b.line(X(-12), Y(0), X(W + 12), Y(0), { color: INK, width: 1.2 });
  for (let x = -12; x < W + 12; x += 8) b.line(X(x), Y(0), X(x - 4), Y(-4), { color: MUTED, width: 0.4 });
  b.text(X(-12), Y(0) - 3, "GRADE", { size: 6, color: MUTED });
  // Footings (dashed) + posts
  for (const x of f.posts.positionsIn) {
    const fw = f.footings.roundIn ?? 16;
    const ft = f.footings.thicknessIn ?? 8;
    b.rect(X(x - 6), Y(0), 12 * s, (frost - ft) * s, { color: MUTED, width: 0.6, dash: "2 1.5" });
    b.rect(X(x - fw / 2), Y(-(frost - ft)), fw * s, ft * s, { color: MUTED, width: 0.6, dash: "2 1.5" });
    const pw = f.posts.size === "6x6" ? 5.5 : 3.5;
    b.rect(X(x - pw / 2), Y(beamBottom), pw * s, (beamBottom - 0) * s, { fill: "#d9c7a8", color: INK, width: 0.7 });
  }
  // Beam (dropped shows below rim)
  b.rect(X(0), Y(beamTop), W * s, bd * s, { fill: "#cdb48e", color: INK, width: 0.8 });
  // Rim joist / band + decking
  b.rect(X(0), Y(joistTop), W * s, jd * s, { fill: "#e3d2b3", color: INK, width: 0.8 });
  b.rect(X(0), Y(deckTop), W * s, DECKING_T_IN * s, { fill: "#b98a5a", color: INK, width: 0.6 });
  // Guard
  if (f.guards.required) {
    const posts = f.guards.posts.filter((p) => Math.abs(p.y - m.depthIn) < 0.5).map((p) => p.x).sort((p, q) => p - q);
    for (const x of posts) b.rect(X(x - 1.75), Y(deckTop + GUARD_HEIGHT_IN), 3.5 * s, GUARD_HEIGHT_IN * s, { fill: INK, color: INK });
    const runs = [
      [0, a.outerEdge.leftSegmentIn],
      [a.outerEdge.leftSegmentIn + a.outerEdge.stairOpeningIn, W],
    ];
    for (const [x1, x2] of runs) {
      if (x2! - x1! < 1) continue;
      b.rect(X(x1!), Y(deckTop + GUARD_HEIGHT_IN), (x2! - x1!) * s, 1.5 * s, { fill: INK, color: INK });
      b.line(X(x1!), Y(deckTop + 3), X(x2!), Y(deckTop + 3), { color: INK, width: 0.8 });
      for (let x = x1! + 4.5; x < x2!; x += 4.5) b.line(X(x), Y(deckTop + 3), X(x), Y(deckTop + GUARD_HEIGHT_IN - 1.5), { color: INK, width: 0.35 });
    }
    b.vdim(X(W) + 16, Y(deckTop + GUARD_HEIGHT_IN), Y(deckTop), `GUARD ${GUARD_HEIGHT_IN}" MIN`);
  }
  // Stair in elevation (riser faces stacked, seen from the front)
  const sl = a.outerEdge.leftSegmentIn;
  const sw = a.outerEdge.stairOpeningIn;
  const rise = f.stair.riserHeightIn;
  for (let k = 0; k < f.stair.risers; k++) {
    const top = deckTop - k * rise;
    b.rect(X(sl), Y(top), sw * s, rise * s, { fill: k === 0 ? "none" : "#f1e7d6", color: INK, width: 0.5 });
  }
  // Dims
  b.vdim(X(-12) - 10, Y(deckTop), Y(0), `${fmtFtIn(H)} TO DECK SURFACE`, { left: true });
  b.vdim(X(W) + 16, Y(0), Y(-frost), `${frost}" MIN FROST DEPTH`);
  const xs = f.posts.positionsIn;
  const dy = Y(-frost) + 14;
  xs.slice(0, -1).forEach((x, k) => b.hdim(X(x), X(xs[k + 1]!), dy, fmtFtIn(xs[k + 1]! - x), { size: 6 }));
  b.hdim(X(0), X(W), dy + 14, fmtFtIn(W));
  // Callouts
  b.leader(X(W * 0.6), Y(beamTop - bd / 2), X(W) + 16, Y(beamTop - bd / 2) + 14, `(${f.beam.plies})${f.beam.size} ${f.beam.type.toUpperCase()} BEAM`);
  b.leader(X(W * 0.15), Y(joistTop - jd / 2), X(-12) - 10, Y(joistTop + GUARD_HEIGHT_IN) - 2, `${f.joists.rimJoist ? f.joists.rimJoist.size + " RIM JOIST" : "FLUSH BEAM"} / ${f.joists.size} JOISTS BEHIND`, { anchor: "end" });
  b.leader(X(xs[0]!), Y(beamBottom / 2), X(xs[0]!) - 40, Y(beamBottom / 2) + 10, `${f.posts.size} POST, ${fmtFtIn(f.posts.heightIn)}`, { anchor: "end" });
  b.leader(X(xs[0]! - 4), Y(-(frost - (f.footings.thicknessIn ?? 8) / 2)), X(xs[0]!) - 50, Y(-frost) - 6, `TYPE ${f.footings.type ?? "?"} FOOTING ${f.footings.roundIn}" RD x ${f.footings.thicknessIn}" ON 12" STEM`, { anchor: "end" });
  return b.build("FRONT ELEVATION", label, "Viewed from the yard toward the house");
}

/* --------------------------------- Section -------------------------------- */

export function sectionDrawing(i: DrawingInputs, box: Box = DEFAULT_BOX): Drawing {
  const { model: m, framing: f } = i;
  const D = m.depthIn;
  const H = m.heightIn;
  const frost = f.footings.depthBelowGradeIn;
  const topY = H + GUARD_HEIGHT_IN + 6;
  const totalH = topY + frost + 6;
  const pad = { l: 90, r: 110, t: 40, b: 50 };
  const { s, ox, oy, label } = scaled(D + 30, totalH, box, pad);
  const b = new DrawingBuilder(box.w, box.h);
  const X = (x: number) => ox + (x + 18) * s; // x = distance from house face
  const Y = (elev: number) => oy + (topY - elev) * s;
  const jd = f.joists.depthIn;
  const bd = f.beam.depthIn;
  const deckTop = H;
  const joistTop = H - DECKING_T_IN;
  const beamTop = f.beam.type === "dropped" ? joistTop - jd : joistTop;
  const beamBottom = beamTop - bd;
  const beamX = f.beam.centerlineFromHouseIn;
  const bw = f.beam.widthIn;

  // House wall
  b.rect(X(-18), Y(topY), 18 * s, (topY + frost) * s, { hatch: true, color: SLATE, width: 0.8 });
  b.text(X(-9), Y(topY) + 10, "HOUSE", { anchor: "middle", size: 6, color: SLATE, weight: "bold", rotate: 0 });
  // Grade
  b.line(X(0), Y(0), X(D + 12), Y(0), { color: INK, width: 1.2 });
  for (let x = 0; x < D + 12; x += 8) b.line(X(x), Y(0), X(x - 4), Y(-4), { color: MUTED, width: 0.4 });
  b.text(X(D + 12), Y(0) - 3, "GRADE", { anchor: "end", size: 6, color: MUTED });
  // Ledger (section) + flashing
  b.rect(X(0), Y(joistTop), 1.5 * s, jd * s, { fill: "#cdb48e", color: INK, width: 0.8 });
  b.line(X(-1), Y(joistTop + 2), X(2.5), Y(joistTop + 2), { color: ACCENT, width: 0.8 });
  // Ledger fasteners (2 rows staggered, shown as two circles)
  const rowOff = ({ "2x8": 5.5, "2x10": 6.5, "2x12": 7.5 } as Record<string, number>)[f.ledger.size] ?? 5.5;
  b.circle(X(0.75), Y(joistTop - 2), 1.2, { fill: INK, color: INK });
  b.circle(X(0.75), Y(joistTop - rowOff), 1.2, { fill: INK, color: INK });
  // Joist (side view) from ledger to end
  const joistEnd = f.beam.type === "dropped" ? D - 1.5 : D - bw;
  b.rect(X(1.5), Y(joistTop), (joistEnd - 1.5) * s, jd * s, { fill: "#e3d2b3", color: INK, width: 0.8 });
  if (f.joists.rimJoist) b.rect(X(D - 1.5), Y(joistTop), 1.5 * s, jd * s, { fill: "#cdb48e", color: INK, width: 0.8 });
  // Joist hanger at ledger
  b.rect(X(1.5), Y(joistTop - jd * 0.2), 1 * s, jd * 0.6 * s, { color: MUTED, width: 0.6 });
  // Decking
  b.rect(X(0.25), Y(deckTop), (D - 0.25) * s, DECKING_T_IN * s, { fill: "#b98a5a", color: INK, width: 0.6 });
  // Beam (end view) + post + footing
  b.rect(X(beamX - bw / 2), Y(beamTop), bw * s, bd * s, { fill: "#cdb48e", color: INK, width: 0.9 });
  const pw = f.posts.size === "6x6" ? 5.5 : 3.5;
  b.rect(X(beamX - pw / 2), Y(beamBottom), pw * s, beamBottom * s, { fill: "#d9c7a8", color: INK, width: 0.8 });
  const fw = f.footings.roundIn ?? 16;
  const ft = f.footings.thicknessIn ?? 8;
  b.rect(X(beamX - 6), Y(0), 12 * s, (frost - ft) * s, { fill: "#e8e6e1", color: INK, width: 0.7 });
  b.rect(X(beamX - fw / 2), Y(-(frost - ft)), fw * s, ft * s, { fill: "#e8e6e1", color: INK, width: 0.7 });
  b.line(X(beamX - pw / 2 - 1), Y(1), X(beamX + pw / 2 + 1), Y(1), { color: MUTED, width: 1.2 }); // post base
  // Guard at outer edge
  if (f.guards.required) {
    b.rect(X(D - 3.5), Y(deckTop + GUARD_HEIGHT_IN), 3.5 * s, GUARD_HEIGHT_IN * s, { fill: INK, color: INK });
    b.rect(X(D - 3.5), Y(deckTop + GUARD_HEIGHT_IN), 3.5 * s, 1.5 * s, { fill: INK, color: INK });
    b.vdim(X(D) + 14, Y(deckTop + GUARD_HEIGHT_IN), Y(deckTop), `${GUARD_HEIGHT_IN}" MIN`);
    b.leader(X(D - 1.75), Y(deckTop + GUARD_HEIGHT_IN / 2), X(D) + 60, Y(deckTop + GUARD_HEIGHT_IN) - 14, `4x4 GUARD POST, (2) 1/2" THRU-BOLTS + 1,800 LB HOLD-DOWN`);
  }
  // Tension tie
  if (f.posts.lateral.methods.includes("method-1-tension-ties")) {
    b.rect(X(2.5), Y(joistTop - jd + 1.5), 6 * s, 1.5 * s, { fill: MUTED, color: MUTED });
    b.leader(X(5.5), Y(joistTop - jd + 0.75), X(0), Y(-frost) + 16, "TENSION TIE (DTT1Z/LTS, 750 LB MIN), 4 TOTAL, FASTENERS 3\" INTO SILL/TOP PLATE");
  }
  // Dims
  b.hdim(X(0), X(beamX), Y(beamBottom) + 24, `JOIST SPAN ${fmtFtIn(f.joists.spanIn)}`);
  if (f.joists.overhangIn > 0) b.hdim(X(beamX), X(D), Y(deckTop) - 8, `OH ${fmtFtIn(f.joists.overhangIn)}`, { size: 5.5, above: true });
  b.hdim(X(0), X(D), Y(beamBottom) + 40, fmtFtIn(D));
  b.vdim(X(D) + 36, Y(deckTop), Y(0), `${fmtFtIn(H)} TO DECK`);
  b.vdim(X(beamX) - fw / 2 * s - 12, Y(0), Y(-frost), `${frost}" MIN`, { left: true });
  b.vdim(X(beamX) + pw / 2 * s + 8, Y(beamBottom), Y(0), `POST ${fmtFtIn(f.posts.heightIn)}`);
  // Callouts
  b.leader(X(0.75), Y(joistTop - rowOff / 2), X(-18), Y(topY) - 8, `${f.ledger.size} LEDGER, ${f.ledger.fastenerLabel.toUpperCase()} @ ${f.ledger.spacingIn ?? "?"}" O.C., 2 ROWS STAGGERED, CONT. FLASHING`);
  b.leader(X(D / 2), Y(joistTop - jd / 2), X(D) + 60, Y(deckTop + GUARD_HEIGHT_IN) + 10, `${f.joists.size} JOISTS @ ${f.joists.spacingIn}" O.C., HANGERS AT LEDGER, ${f.beam.type === "dropped" ? "HURRICANE TIE AT BEAM" : "HANGERS AT FLUSH BEAM"}`);
  b.leader(X(beamX + bw / 2), Y(beamTop - bd / 2), X(D) + 60, Y(beamBottom) - 2, `(${f.beam.plies})${f.beam.size} BEAM, ${f.posts.size === "4x4" || f.beam.plies === 3 ? "POST CAP" : "NOTCHED 6x6 W/ (2) 1/2\" THRU-BOLTS"}`);
  b.leader(X(beamX + fw / 2), Y(-(frost - ft / 2)), X(D) + 60, Y(-frost) + 2, `TYPE ${f.footings.type ?? "?"} FOOTING ${f.footings.roundIn}" RD / ${f.footings.squareIn}" SQ x ${f.footings.thicknessIn}", 3,000 PSI, 12" STEM, 1" MIN POST BASE`);
  return b.build("SECTION A-A", label, "Through a post, perpendicular to the house");
}

/* ------------------------------ Stair section ----------------------------- */

export function stairSectionDrawing(i: DrawingInputs, box: Box = DEFAULT_BOX): Drawing {
  const { model: m, framing: f } = i;
  const H = m.heightIn;
  const run = f.stair.treadRunIn;
  const totalRun = f.stair.horizontalSpanIn;
  const rise = f.stair.riserHeightIn;
  const pad = { l: 80, r: 120, t: 40, b: 50 };
  const totalW = totalRun + 36 + 12;
  const topY = H + 40;
  const { s, ox, oy, label } = scaled(totalW, topY + 18, box, pad);
  const b = new DrawingBuilder(box.w, box.h);
  const X = (x: number) => ox + (x + 24) * s; // x from the deck edge toward the yard
  const Y = (elev: number) => oy + (topY - elev) * s;
  const jd = f.joists.depthIn;

  // Deck edge: rim/beam + decking at top-left
  b.rect(X(-24), Y(H - 1), 24 * s, jd * s, { fill: "#e3d2b3", color: INK, width: 0.8 });
  b.rect(X(-24), Y(H), 24 * s, 1 * s, { fill: "#b98a5a", color: INK, width: 0.6 });
  b.text(X(-12), Y(H - 1 - jd) + 12, "DECK RIM / BEAM", { anchor: "middle", size: 5.5, color: MUTED });
  // Grade
  b.line(X(-24), Y(0), X(totalRun + 24), Y(0), { color: INK, width: 1.2 });
  for (let x = -24; x < totalRun + 24; x += 8) b.line(X(x), Y(0), X(x - 4), Y(-4), { color: MUTED, width: 0.4 });
  // Stringer: sawtooth top edge from (0, H) down to (totalRun, 0); bottom edge offset by 11.25" perpendicular-ish
  const pts: string[] = [];
  let x = 0;
  let y = H;
  pts.push(`M${X(x)},${Y(y)}`);
  for (let k = 0; k < f.stair.risers; k++) {
    y -= rise;
    pts.push(`L${X(x)},${Y(y)}`);
    if (k < f.stair.risers - 1) {
      x += run;
      pts.push(`L${X(x)},${Y(y)}`);
    }
  }
  const stringerDepth = 11.25;
  const angle = Math.atan2(H, totalRun || 1);
  const dx = stringerDepth * Math.sin(angle);
  const dy = stringerDepth * Math.cos(angle);
  pts.push(`L${X(x)},${Y(0)}`);
  pts.push(`L${X(x - dx + 2)},${Y(0)}`);
  pts.push(`L${X(-dx)},${Y(H - dy)}`);
  pts.push(`L${X(0)},${Y(H - dy)}`);
  pts.push("Z");
  b.path(pts.join(" "), { fill: "#e3d2b3", color: INK, width: 0.9 });
  // Treads (2 boards) + risers
  x = 0;
  y = H;
  for (let k = 0; k < f.stair.treads; k++) {
    y -= rise;
    b.rect(X(x), Y(y + 1), run * s, 1 * s, { fill: "#b98a5a", color: INK, width: 0.5 });
    b.line(X(x + run / 2), Y(y + 1), X(x + run / 2), Y(y), { color: INK, width: 0.4 });
    b.rect(X(x) - 0.75 * s, Y(y + 1), 0.75 * s, (rise + 1) * s, { fill: "#cdb48e", color: INK, width: 0.4 });
    x += run;
  }
  // Footing at bottom
  b.rect(X(totalRun - 5), Y(0), 10 * s, 12 * s, { fill: "#e8e6e1", color: INK, width: 0.7 });
  b.leader(X(totalRun), Y(-6), X(totalRun) + 30, Y(-6), `8" SQ OR 10" RD x 12" DEEP FOOTING AT EACH STRINGER (FIG. 40)`);
  // Guard/handrail
  if (f.stair.guardRequired || f.stair.handrailRequired) {
    const hh = 36;
    b.line(X(0), Y(H + hh), X(totalRun), Y(hh), { color: INK, width: 1.4 });
    b.rect(X(0) - 1.75 * s, Y(H + hh), 3.5 * s, hh * s, { fill: INK, color: INK });
    b.rect(X(totalRun) - 1.75 * s, Y(hh), 3.5 * s, hh * s, { fill: INK, color: INK });
    b.leader(X(totalRun / 2), Y(H / 2 + hh), X(totalRun / 2) + 30, Y(H + hh) - 6, `STAIR GUARD 34"-38" ABOVE NOSINGS; HANDRAIL ONE SIDE, GRASPABLE, RETURNED (FIG. 43-45)`);
  }
  // Dims
  b.vdim(X(-24) - 12, Y(H), Y(0), `TOTAL RISE ${fmtFtIn(H)} (${f.stair.risers} @ ${rise.toFixed(2)}")`, { left: true });
  b.hdim(X(0), X(totalRun), Y(-12) + 16, `TOTAL RUN ${fmtFtIn(totalRun)} (${f.stair.treads} @ ${run}") - MAX ${fmtFtIn(f.stair.maxStringerSpanIn)} ${f.stair.stringerType.toUpperCase()} STRINGER`);
  b.hdim(X(0), X(run), Y(H - rise) - 8, `${run}"`, { size: 6, above: true });
  b.vdim(X(run) + 6, Y(H), Y(H - rise), `${rise.toFixed(2)}"`, { size: 6 });
  b.leader(X(totalRun * 0.45), Y(H - rise * (f.stair.risers * 0.45)) - 8, X(totalRun) + 30, Y(H * 0.6), `${f.stair.stringerCount} - 2x12 ${f.stair.stringerType.toUpperCase()} STRINGERS @ ${f.stair.stringerSpacingIn.toFixed(1)}" O.C. (MAX ${f.stair.stringerMaxSpacingIn}")`);
  b.text(X(totalRun) + 32, Y(H * 0.6) + 11, `5-1/4" MIN THROAT; SLOPED HANGER AT TOP (FIG. 40-41)`, { size: 6 });
  return b.build("STAIR SECTION", label, `Risers max 8-1/4", treads min 9" (Fig. 39)`);
}

export function allDrawings(i: DrawingInputs, box: Box = DEFAULT_BOX) {
  return {
    deckPlan: deckPlanDrawing(i, box),
    framingPlan: framingPlanDrawing(i, box),
    elevation: elevationDrawing(i, box),
    section: sectionDrawing(i, box),
    stairSection: stairSectionDrawing(i, box),
  };
}
