import type { DeckDesignModel, FramingOptions } from "@/modules/design/model";
import { STAIR_SCHEMATIC, validateDeckDesign } from "@/modules/design/model";
import {
  ACTUAL_DEPTH_IN,
  BEAM_SPAN_COLUMNS_FT,
  CONNECTION_RULES,
  FOOTING_RULES,
  GUARD_RULES,
  JOIST_SIZES,
  KNEE_BRACING,
  LEDGER_RULES,
  LEDGER_SPAN_COLUMNS_FT,
  MAX_INFLUENCE_WIDTH_FT,
  OVERHANG_SPAN_COLUMNS_FT,
  PLY_THICKNESS_IN,
  RULESET,
  STAIR_RULES,
  TABLE_2_JOISTS,
  TABLE_3_BEAMS,
  TABLE_4_FOOTINGS,
  TABLE_5_FOOTING_SIZE,
  TABLE_6_LEDGER_FASTENERS,
  TENSION_TIES,
  lateralRequirementSingleSpan,
  type BeamOption,
  type BeamSpanColumn,
  type FootingType,
  type JoistSize,
  type LateralMethod,
} from "./rules/fairfax-2021";

/* --------------------------------- Types ---------------------------------- */

export interface FramingIssue {
  severity: "error" | "warning" | "note";
  code: string;
  message: string;
  /** County table/figure reference. */
  ref?: string;
}

export interface FramingResult {
  ruleset: typeof RULESET;
  /** True when no `error` issues: the layout fits the county's prescriptive tables. */
  ok: boolean;
  issues: FramingIssue[];
  assumptions: string[];
  deckType: "single-span attached deck";
  ledger: {
    size: JoistSize;
    lengthIn: number;
    bandBoard: FramingOptions["bandBoard"];
    fastenerKey: FramingOptions["ledgerFastener"];
    fastenerLabel: string;
    spacingIn: number | null;
    spanColumnFt: number | null;
    approxFastenerCount: number | null;
    pattern: string;
    hangerCount: number;
    hangerMinDepthIn: number;
  };
  joists: {
    size: JoistSize;
    depthIn: number;
    spacingIn: number;
    count: number;
    positionsIn: number[];
    spanIn: number;
    allowableSpanIn: number;
    overhangIn: number;
    allowableOverhangIn: number | null;
    overhangColumnFt: number | null;
    lengthIn: number;
    blockingOverBeam: boolean;
    rimJoist: { size: JoistSize; lengthIn: number } | null;
    joistToBeam: string;
  };
  beam: {
    type: "dropped" | "flush";
    plies: 2 | 3;
    size: JoistSize;
    depthIn: number;
    widthIn: number;
    lengthIn: number;
    /** Distance from house face to beam centreline. */
    centerlineFromHouseIn: number;
    spanIn: number;
    spanColumnFt: number | null;
    overhangIn: number;
    maxOverhangIn: number;
    influenceWidthIn: number;
    influenceWidthTableFt: number;
    alternatives: string[];
    plyFastening: string;
    beamToPost: string;
  };
  posts: {
    count: number;
    size: "4x4" | "6x6";
    heightIn: number;
    maxHeightIn: number | null;
    positionsIn: number[];
    lateral: {
      required: "none" | "either" | "both";
      methods: LateralMethod[];
      tensionTieJoistIndexes: number[];
      description: string;
    };
  };
  footings: {
    type: FootingType | null;
    squareIn: number | null;
    roundIn: number | null;
    thicknessIn: number | null;
    count: number;
    depthBelowGradeIn: number;
    withinFiveFeetOfHouse: boolean;
  };
  guards: {
    required: boolean;
    heightIn: number;
    /** Guard post plan positions (x along house, y out from house). */
    posts: { x: number; y: number }[];
    runs: { from: { x: number; y: number }; to: { x: number; y: number }; label: string }[];
  };
  stair: {
    widthIn: number;
    offsetIn: number;
    totalRiseIn: number;
    risers: number;
    riserHeightIn: number;
    treads: number;
    treadRunIn: number;
    horizontalSpanIn: number;
    stringerType: "cut" | "solid";
    maxStringerSpanIn: number;
    stringerCount: number;
    stringerSpacingIn: number;
    guardRequired: boolean;
    handrailRequired: boolean;
    footing: string;
    upperBearing: string;
  };
  underJoistBracingRequired: boolean;
  /** Mirrors Section 10 "Complete My Deck" on page 27 of the county document. */
  worksheet: { label: string; value: string }[];
  materials: { item: string; qty: number; unit: string; note?: string }[];
}

/* -------------------------------- Helpers --------------------------------- */

const ft = (inches: number) => inches / 12;
export function fmtFtIn(inches: number): string {
  const sign = inches < 0 ? "-" : "";
  const abs = Math.abs(inches);
  const f = Math.floor(abs / 12);
  const i = Math.round((abs - f * 12) * 4) / 4;
  const iStr = i === 0 ? "" : ` ${i}"`;
  return `${sign}${f}'${iStr}`.trim();
}
const beamLabel = (b: BeamOption) => `(${b.plies})${b.size}`;

function spanColumn<T extends readonly number[]>(columnsFt: T, spanIn: number): T[number] | null {
  for (const c of columnsFt) if (spanIn <= c * 12) return c;
  return null;
}

function beamDepthIn(b: BeamOption) {
  return ACTUAL_DEPTH_IN[b.size];
}

/* ------------------------------- Generator -------------------------------- */

export function generateFraming(model: DeckDesignModel): FramingResult {
  const issues: FramingIssue[] = [];
  const assumptions: string[] = [
    "Single-level deck attached to the house with a ledger; joists bear on the ledger and one outside beam (Figures 5/6).",
    "Grade is level across the deck footprint; deck height is the walking surface above grade.",
    `Decking is ${CONNECTION_RULES.deckingThicknessAssumedIn}" thick; post height is measured from a footing/post base at grade to the underside of the beam.`,
    "Existing house band board is capable of supporting the deck and is not one of the prohibited conditions in Figure 25 (open-web trusses, brick/stone veneer, chimney, bay window).",
  ];
  const o = model.framing;
  const W = model.widthIn;
  const D = model.depthIn;
  const H = model.heightIn;

  for (const v of validateDeckDesign(model)) issues.push({ severity: "error", code: "design", message: v.message });

  const guardRequired = H > GUARD_RULES.requiredAboveGradeIn;

  /* ---- Joists (Table 2) ---- */
  const beamType = o.beamType;
  const joistOverhangIn = beamType === "dropped" ? o.joistOverhangIn : 0;
  if (beamType === "flush" && o.joistOverhangIn > 0) issues.push({ severity: "note", code: "flush-no-overhang", message: "Joists cannot overhang a flush beam; overhang set to 0.", ref: "Figure 6" });
  const joistSpanIn = D - joistOverhangIn; // ledger to beam centreline (dropped) / to beam (flush, conservative)
  if (joistSpanIn <= 0) issues.push({ severity: "error", code: "overhang-too-large", message: "Joist overhang leaves no joist span." });

  const overhangCol = spanColumn(OVERHANG_SPAN_COLUMNS_FT, joistSpanIn);
  const candidateSizes: JoistSize[] = o.joistSize === "auto" ? [...JOIST_SIZES] : [o.joistSize];
  let joistSize: JoistSize | null = null;
  let joistFailure: string | null = null;
  for (const size of candidateSizes) {
    const row = TABLE_2_JOISTS[size];
    const allowableSpan = row.span[o.joistSpacingIn];
    if (size === "2x6" && guardRequired) {
      joistFailure = "2x6 joists are not permitted where a guard is required (guards cannot attach to 2x6 framing).";
      continue;
    }
    if (joistSpanIn > allowableSpan) {
      joistFailure = `${size} @ ${o.joistSpacingIn}" o.c. allows a ${fmtFtIn(allowableSpan)} span; this deck needs ${fmtFtIn(joistSpanIn)}.`;
      continue;
    }
    if (joistOverhangIn > 0) {
      const allowedOverhang = overhangCol ? row.overhang[overhangCol] : null;
      if (allowedOverhang === null) {
        joistFailure = `${size} joists may not overhang at a ${fmtFtIn(joistSpanIn)} span (Table 2: NP).`;
        continue;
      }
      const limit = Math.min(allowedOverhang, joistSpanIn / 4);
      if (joistOverhangIn > limit) {
        joistFailure = `${size} overhang limited to ${fmtFtIn(limit)} at a ${fmtFtIn(joistSpanIn)} span; requested ${fmtFtIn(joistOverhangIn)}.`;
        continue;
      }
    }
    joistSize = size;
    joistFailure = null;
    break;
  }
  if (!joistSize) {
    issues.push({ severity: "error", code: "joist-np", message: `No joist in Table 2 works: ${joistFailure ?? "unknown"} Reduce depth/overhang, tighten spacing, or use a multi-span or engineered design.`, ref: "Table 2" });
    joistSize = o.joistSize === "auto" ? "2x12" : o.joistSize; // continue with a placeholder so the drawing still renders
  }
  const joistRow = TABLE_2_JOISTS[joistSize];
  const allowableOverhangIn = joistOverhangIn > 0 && overhangCol ? joistRow.overhang[overhangCol] : null;
  const joistDepth = ACTUAL_DEPTH_IN[joistSize];
  const joistCount = Math.floor(W / o.joistSpacingIn) + 1 + (W % o.joistSpacingIn === 0 ? 0 : 1);
  const joistPositions: number[] = [];
  for (let x = 0; x < W; x += o.joistSpacingIn) joistPositions.push(x);
  joistPositions.push(W); // end joist at the far edge
  const blockingOverBeam = joistOverhangIn > CONNECTION_RULES.blockingOverBeamWhenOverhangExceedsIn;

  /* ---- Beam (Table 3) ---- */
  const influenceWidthIn = beamType === "dropped" ? joistSpanIn / 2 + joistOverhangIn : joistSpanIn / 2; // Figure 14
  const iwFt = Math.max(2, Math.ceil(ft(influenceWidthIn)));
  if (iwFt > MAX_INFLUENCE_WIDTH_FT) issues.push({ severity: "error", code: "iw-np", message: `Beam influence width ${fmtFtIn(influenceWidthIn)} exceeds the ${MAX_INFLUENCE_WIDTH_FT} ft covered by Table 3.`, ref: "Table 3" });

  const beamOverhangIn = o.beamOverhangIn;
  let postCount = o.postCount ?? 2;
  let beamSpanIn = 0;
  let beamCol: BeamSpanColumn | null = null;
  let beamOptions: BeamOption[] | null = null;
  let footingCell: ReturnType<typeof footingFor> = null;
  let postHeightIn = 0;
  let chosenBeam: BeamOption | null = null;
  const postHeightFor = (b: BeamOption) => H - CONNECTION_RULES.deckingThicknessAssumedIn - (beamType === "dropped" ? joistDepth + beamDepthIn(b) : beamDepthIn(b));

  const tryLayout = (n: number) => {
    const span = (W - 2 * beamOverhangIn) / (n - 1);
    const col = spanColumn(BEAM_SPAN_COLUMNS_FT, span);
    const opts = col && iwFt <= MAX_INFLUENCE_WIDTH_FT ? TABLE_3_BEAMS[iwFt]![col] : null;
    if (!opts || !col) return null;
    const beam = pickBeam(opts, beamType, joistSize!);
    if (!beam) return null;
    const foot = footingFor(iwFt, col);
    if (!foot) return null;
    const ph = postHeightFor(beam);
    if (ph > foot.maxPostHeightFt * 12) return null;
    if (beamOverhangIn > span / 4) return null;
    return { span, col, opts, beam, foot, ph };
  };

  if (o.postCount) {
    const r = tryLayout(o.postCount);
    beamSpanIn = (W - 2 * beamOverhangIn) / (o.postCount - 1);
    beamCol = spanColumn(BEAM_SPAN_COLUMNS_FT, beamSpanIn);
    if (r) ({ beam: chosenBeam, foot: footingCell, ph: postHeightIn, opts: beamOptions } = r);
  } else {
    for (let n = 2; n <= 12; n++) {
      const r = tryLayout(n);
      if (r) {
        postCount = n;
        ({ span: beamSpanIn, col: beamCol, beam: chosenBeam, foot: footingCell, ph: postHeightIn, opts: beamOptions } = r);
        break;
      }
    }
    if (!chosenBeam) {
      postCount = 2;
      beamSpanIn = W - 2 * beamOverhangIn;
      beamCol = spanColumn(BEAM_SPAN_COLUMNS_FT, beamSpanIn);
    }
  }
  if (!chosenBeam) {
    const why = !beamCol
      ? `beam span ${fmtFtIn(beamSpanIn)} exceeds the 18 ft covered by Table 3`
      : `no beam/footing combination in Tables 3–4 for a ${iwFt} ft influence width at a ${fmtFtIn(beamSpanIn)} span (or post height exceeds Table 4)`;
    issues.push({ severity: "error", code: "beam-np", message: `Beam layout not permitted: ${why}. Add posts, reduce the joist span/overhang, or use an engineered design.`, ref: "Tables 3 & 4" });
    chosenBeam = { plies: 2, size: joistSize };
    postHeightIn = postHeightFor(chosenBeam);
  }
  if (beamOverhangIn > beamSpanIn / 4) issues.push({ severity: "error", code: "beam-overhang", message: `Beam overhang ${fmtFtIn(beamOverhangIn)} exceeds one-quarter of the ${fmtFtIn(beamSpanIn)} beam span.`, ref: "Figure 13" });
  const beamWidthIn = chosenBeam.plies * PLY_THICKNESS_IN;
  const beamCenterlineFromHouseIn = beamType === "dropped" ? joistSpanIn : D - beamWidthIn / 2;
  const postPositions = Array.from({ length: postCount }, (_, i) => beamOverhangIn + i * beamSpanIn);

  /* ---- Posts & footings (Tables 4/5) ---- */
  if (postHeightIn <= 0) issues.push({ severity: "error", code: "post-height", message: `Deck is too low for a ${beamType} beam under ${joistSize} joists (post height ${fmtFtIn(postHeightIn)}). Raise the deck, use a flush beam, or a shallower beam.`, ref: "Figure 5/6" });
  if (postHeightIn > FOOTING_RULES.maxPostHeightFt * 12) issues.push({ severity: "error", code: "post-too-tall", message: `Post height ${fmtFtIn(postHeightIn)} exceeds the ${FOOTING_RULES.maxPostHeightFt} ft maximum of the typical details.`, ref: "Table 4" });
  const postSize: "4x4" | "6x6" = postHeightIn <= FOOTING_RULES.max4x4PostHeightIn && chosenBeam.plies === 2 ? "4x4" : "6x6";
  const footingSize = footingCell ? TABLE_5_FOOTING_SIZE[footingCell.type] : null;
  const withinFiveFeetOfHouse = beamCenterlineFromHouseIn - (footingSize?.squareIn ?? 0) / 2 < FOOTING_RULES.nearHouseIn;
  if (withinFiveFeetOfHouse) issues.push({ severity: "warning", code: "footing-near-house", message: "Footings within 5 ft of the house wall must bear at the same elevation as the existing house footings.", ref: "Figure 16" });

  /* ---- Lateral support (Table 8) ---- */
  const lat = lateralRequirementSingleSpan(postHeightIn);
  const methods: LateralMethod[] =
    lat.required === "none" ? [] : lat.required === "both" ? ["method-1-tension-ties", "method-2-knee-bracing-at-beam"] : o.lateralPreference === "knee-bracing" ? ["method-2-knee-bracing-at-beam"] : ["method-1-tension-ties"];
  const tensionTieJoistIndexes = methods.includes("method-1-tension-ties") ? tensionTieJoists(joistPositions, W) : [];
  const lateralDescription =
    lat.required === "none"
      ? "Posts 2.5 ft or less: no lateral support method required."
      : methods.map((m) => (m === "method-1-tension-ties" ? `Method 1: ${TENSION_TIES.count} tension ties (${TENSION_TIES.minCapacityLb} lb min; ${TENSION_TIES.approved.join(", ")}) at each end joist and two equally spaced inside joists` : `Method 2: ${KNEE_BRACING.member}, ${fmtFtIn(KNEE_BRACING.legIn)} legs at ${KNEE_BRACING.angleDeg}°`)).join("; ");

  /* ---- Ledger (Table 6, Figure 26) ---- */
  const ledgerSize: JoistSize = ACTUAL_DEPTH_IN[joistSize] < ACTUAL_DEPTH_IN[LEDGER_RULES.minSize] ? LEDGER_RULES.minSize : joistSize;
  const fastener = TABLE_6_LEDGER_FASTENERS[o.ledgerFastener];
  const ledgerCol = spanColumn(LEDGER_SPAN_COLUMNS_FT, joistSpanIn);
  const ledgerColIdx = ledgerCol ? LEDGER_SPAN_COLUMNS_FT.indexOf(ledgerCol) : -1;
  let spacingRow: number[] | null = null;
  if (o.bandBoard === "2x-lumber") spacingRow = fastener.lumber;
  else if (o.bandBoard === "ewp") spacingRow = fastener.ewp;
  else if (o.bandBoard === "solid-masonry") spacingRow = fastener.masonry;
  else spacingRow = fastener.hollowMasonry ? fastener.masonry : null;
  if (!spacingRow) issues.push({ severity: "error", code: "ledger-fastener", message: `${fastener.label} are not an approved ledger fastener for a ${o.bandBoard.replace("-", " ")} band board.`, ref: "Table 6" });
  const ledgerSpacingIn = spacingRow && ledgerColIdx >= 0 ? spacingRow[ledgerColIdx]! : null;
  const approxFastenerCount = ledgerSpacingIn ? 2 * LEDGER_RULES.fastenersEachEnd + Math.ceil(Math.max(0, W - 24) / ledgerSpacingIn) : null;

  /* ---- Guards (Section 8) ---- */
  const stairLeft = Math.min(model.stair.offsetIn, W);
  const stairRight = Math.min(W, model.stair.offsetIn + model.stair.widthIn);
  const guardRuns: FramingResult["guards"]["runs"] = guardRequired
    ? [
        { from: { x: 0, y: 0 }, to: { x: 0, y: D }, label: "left side (end joist)" },
        { from: { x: W, y: 0 }, to: { x: W, y: D }, label: "right side (end joist)" },
        ...(stairLeft > 0 ? [{ from: { x: 0, y: D }, to: { x: stairLeft, y: D }, label: "outer edge, left of stair (rim)" }] : []),
        ...(W - stairRight > 0 ? [{ from: { x: stairRight, y: D }, to: { x: W, y: D }, label: "outer edge, right of stair (rim)" }] : []),
      ]
    : [];
  const guardPosts = guardRequired ? guardPostPositions(guardRuns) : [];

  /* ---- Stair (Section 9) ---- */
  const risers = Math.max(1, Math.ceil(H / STAIR_SCHEMATIC.maxRiserIn));
  const riserHeightIn = H / risers;
  const treads = Math.max(0, risers - 1);
  const horizontalSpanIn = treads * STAIR_SCHEMATIC.treadRunIn;
  const solidException = model.stair.widthIn === STAIR_RULES.minWidthIn && horizontalSpanIn > STAIR_RULES.maxCutStringerSpanIn;
  const stringerType: "cut" | "solid" = solidException ? "solid" : "cut";
  const maxStringerSpanIn = solidException ? STAIR_RULES.maxSolidStringerSpanIn : STAIR_RULES.maxCutStringerSpanIn;
  if (H > STAIR_RULES.landingRequiredAboveRiseIn) issues.push({ severity: "error", code: "stair-landing", message: `Total stair rise ${fmtFtIn(H)} exceeds 12 ft; an intermediate landing built as a free-standing deck is required (not generated here).`, ref: "Stair Landing, p. 23" });
  else if (horizontalSpanIn > maxStringerSpanIn)
    issues.push({ severity: "error", code: "stringer-span", message: `Stair run ${fmtFtIn(horizontalSpanIn)} exceeds the ${fmtFtIn(maxStringerSpanIn)} maximum ${stringerType} stringer span. Add an intermediate landing${model.stair.widthIn !== 36 ? ", or use a 36\"-wide stair with solid stringers (13'-3\" max)" : ""}.`, ref: "Figure 41" });
  const stringerCount = Math.ceil(model.stair.widthIn / STAIR_RULES.maxStringerSpacingIn) + 1;
  const stringerSpacingIn = model.stair.widthIn / (stringerCount - 1);
  const stairGuardRequired = H > STAIR_RULES.guardRequiredAboveRiseIn;
  const handrailRequired = risers >= STAIR_RULES.handrailMinRisers;

  /* ---- Hidden-fastener bracing (Figures 2/3) ---- */
  const underJoistBracingRequired = o.hiddenDeckingFasteners && postHeightIn > FOOTING_RULES.max4x4PostHeightIn;
  if (underJoistBracingRequired) issues.push({ severity: "note", code: "hidden-fastener-bracing", message: CONNECTION_RULES.hiddenFastenerBracing, ref: "Figures 2 & 3" });
  if (blockingOverBeam) issues.push({ severity: "note", code: "blocking", message: `Overhang exceeds 2 ft: provide 2x blocking (≥ 60% of joist depth) between joists over the beam.`, ref: "Section 3" });
  if (postSize === "4x4") issues.push({ severity: "note", code: "post-4x4", message: "Posts are 2.5 ft or less, so 4x4 posts are permitted (post cap connection only). 6x6 is always acceptable.", ref: "Post Size & Maximum Height, p. 14" });

  const ok = !issues.some((i) => i.severity === "error");

  /* ---- Worksheet (Section 10) ---- */
  const beamText = beamLabel(chosenBeam);
  const worksheet = [
    { label: "Joist size / spacing", value: `${joistSize} @ ${o.joistSpacingIn}" o.c.` },
    { label: "Joist longest span / overhang", value: `${fmtFtIn(joistSpanIn)} / ${fmtFtIn(joistOverhangIn)}` },
    { label: "Rim joist", value: beamType === "dropped" ? joistSize : "not applicable (flush beam)" },
    { label: "Beam plies / size", value: beamText },
    { label: "Beam influence width / longest span / overhang", value: `${fmtFtIn(influenceWidthIn)} (use ${iwFt} ft) / ${fmtFtIn(beamSpanIn)} / ${fmtFtIn(beamOverhangIn)}` },
    { label: "Footing size / thickness", value: footingSize ? `Type ${footingCell!.type}: ${footingSize.squareIn}" square or ${footingSize.roundIn}" round, ${footingSize.thicknessIn}" thick` : "—" },
    { label: "Post size / height", value: `${postSize} / ${fmtFtIn(postHeightIn)}` },
    { label: "Ledger board size / fastener / spacing", value: `${ledgerSize} / ${fastener.label} / ${ledgerSpacingIn ? `${ledgerSpacingIn}" o.c.` : "—"}` },
    { label: "Lateral support", value: lat.required === "none" ? "None required" : methods.map((m) => (m === "method-1-tension-ties" ? "Method 1" : "Method 2")).join(" and ") },
  ];

  /* ---- Materials (counts only) ---- */
  const joistLengthIn = D;
  const materials: FramingResult["materials"] = [
    { item: `${ledgerSize} ledger board`, qty: 1, unit: `pc × ${fmtFtIn(W)}` },
    { item: `${joistSize} joists`, qty: joistPositions.length, unit: `pcs × ${fmtFtIn(joistLengthIn)}` },
    ...(beamType === "dropped" ? [{ item: `${joistSize} rim joist`, qty: 1, unit: `pc × ${fmtFtIn(W)}` }] : []),
    { item: `${chosenBeam.size} beam plies`, qty: chosenBeam.plies, unit: `pcs × ${fmtFtIn(W)}`, note: `${beamText} ${beamType} beam` },
    { item: `${postSize} posts`, qty: postCount, unit: `pcs × ${fmtFtIn(postHeightIn)}` },
    { item: footingSize ? `Footings, type ${footingCell!.type}` : "Footings", qty: postCount, unit: footingSize ? `${footingSize.roundIn}" round or ${footingSize.squareIn}" sq × ${footingSize.thicknessIn}"` : "ea" },
    { item: `Joist hangers (≥ ${Math.ceil(joistDepth * CONNECTION_RULES.joistHangerMinDepthFraction * 4) / 4}" deep) at ledger${beamType === "flush" ? " and flush beam" : ""}`, qty: joistPositions.length * (beamType === "flush" ? 2 : 1), unit: "ea" },
    ...(beamType === "dropped" ? [{ item: "Hurricane clips / joist-to-beam connectors (100 lb)", qty: joistPositions.length, unit: "ea" }] : []),
    ...(ledgerSpacingIn ? [{ item: `${fastener.label} (ledger)`, qty: approxFastenerCount!, unit: "ea", note: "approximate; 2 rows staggered, 4 at each end" }] : []),
    ...(methods.includes("method-1-tension-ties") ? [{ item: "Tension ties (750 lb min)", qty: TENSION_TIES.count, unit: "ea" }] : []),
    ...(methods.includes("method-2-knee-bracing-at-beam") ? [{ item: "2x6 knee braces at beam", qty: postCount * 2, unit: `pcs × ${fmtFtIn(KNEE_BRACING.braceLengthIn)}` }] : []),
    ...(guardRequired ? [{ item: "4x4 guard posts with 1,800 lb hold-downs", qty: guardPosts.length, unit: "ea" }] : []),
    { item: "2x12 stair stringers", qty: stringerCount, unit: "ea", note: `${stringerType}, ≤ 18" o.c.` },
    { item: 'Stair footings 8" sq / 10" rd × 12" deep', qty: stringerCount, unit: "ea" },
  ];

  return {
    ruleset: RULESET,
    ok,
    issues,
    assumptions,
    deckType: "single-span attached deck",
    ledger: {
      size: ledgerSize,
      lengthIn: W,
      bandBoard: o.bandBoard,
      fastenerKey: o.ledgerFastener,
      fastenerLabel: fastener.label,
      spacingIn: ledgerSpacingIn,
      spanColumnFt: ledgerCol,
      approxFastenerCount,
      pattern: `2 rows staggered, ${LEDGER_RULES.fastenersEachEnd} fasteners at each end, 2" min end clearance, continuous flashing (Figures 22 & 26)`,
      hangerCount: joistPositions.length,
      hangerMinDepthIn: joistDepth * CONNECTION_RULES.joistHangerMinDepthFraction,
    },
    joists: {
      size: joistSize,
      depthIn: joistDepth,
      spacingIn: o.joistSpacingIn,
      count: Math.max(joistCount, joistPositions.length),
      positionsIn: joistPositions,
      spanIn: joistSpanIn,
      allowableSpanIn: joistRow.span[o.joistSpacingIn],
      overhangIn: joistOverhangIn,
      allowableOverhangIn: allowableOverhangIn === null ? null : Math.min(allowableOverhangIn, joistSpanIn / 4),
      overhangColumnFt: overhangCol,
      lengthIn: joistLengthIn,
      blockingOverBeam,
      rimJoist: beamType === "dropped" ? { size: joistSize, lengthIn: W } : null,
      joistToBeam: beamType === "dropped" ? CONNECTION_RULES.joistToBeam : "joist hangers into flush beam (Figure 6)",
    },
    beam: {
      type: beamType,
      plies: chosenBeam.plies,
      size: chosenBeam.size,
      depthIn: beamDepthIn(chosenBeam),
      widthIn: beamWidthIn,
      lengthIn: W,
      centerlineFromHouseIn: beamCenterlineFromHouseIn,
      spanIn: beamSpanIn,
      spanColumnFt: beamCol,
      overhangIn: beamOverhangIn,
      maxOverhangIn: beamSpanIn / 4,
      influenceWidthIn,
      influenceWidthTableFt: iwFt,
      alternatives: (beamOptions ?? []).map(beamLabel),
      plyFastening: CONNECTION_RULES.beamPlyFastening,
      beamToPost: postSize === "4x4" ? CONNECTION_RULES.beamToPost4x4 : CONNECTION_RULES.beamToPost6x6,
    },
    posts: {
      count: postCount,
      size: postSize,
      heightIn: postHeightIn,
      maxHeightIn: footingCell ? footingCell.maxPostHeightFt * 12 : null,
      positionsIn: postPositions,
      lateral: { required: lat.required, methods, tensionTieJoistIndexes, description: lateralDescription },
    },
    footings: {
      type: footingCell?.type ?? null,
      squareIn: footingSize?.squareIn ?? null,
      roundIn: footingSize?.roundIn ?? null,
      thicknessIn: footingSize?.thicknessIn ?? null,
      count: postCount,
      depthBelowGradeIn: FOOTING_RULES.minDepthBelowGradeIn,
      withinFiveFeetOfHouse,
    },
    guards: { required: guardRequired, heightIn: GUARD_RULES.minHeightIn, posts: guardPosts, runs: guardRuns },
    stair: {
      widthIn: model.stair.widthIn,
      offsetIn: model.stair.offsetIn,
      totalRiseIn: H,
      risers,
      riserHeightIn,
      treads,
      treadRunIn: STAIR_SCHEMATIC.treadRunIn,
      horizontalSpanIn,
      stringerType,
      maxStringerSpanIn,
      stringerCount,
      stringerSpacingIn,
      guardRequired: stairGuardRequired,
      handrailRequired,
      footing: STAIR_RULES.footing,
      upperBearing: STAIR_RULES.upperBearing,
    },
    underJoistBracingRequired,
    worksheet,
    materials,
  };
}

/* ------------------------------ Sub-helpers ------------------------------- */

function footingFor(iwFt: number, col: BeamSpanColumn) {
  return TABLE_4_FOOTINGS[iwFt]?.[col] ?? null;
}

/** Prefer the county's first-listed (2-ply) option; flush beams must be at least as deep as the joists. */
function pickBeam(options: BeamOption[], beamType: "dropped" | "flush", joistSize: JoistSize): BeamOption | null {
  if (beamType === "dropped") return options[0] ?? null;
  const joistDepth = ACTUAL_DEPTH_IN[joistSize];
  const deepEnough = options.find((b) => ACTUAL_DEPTH_IN[b.size] >= joistDepth);
  if (deepEnough) return deepEnough;
  const first = options[0];
  return first ? { plies: first.plies, size: joistSize } : null; // upsize the same ply count to the joist depth (a larger member than the table minimum)
}

/** Method 1: one tie at each end joist plus two inside joists equally spaced along the deck width (Figure 28). */
function tensionTieJoists(positions: number[], widthIn: number): number[] {
  const nearest = (target: number) => {
    let best = 0;
    for (let i = 0; i < positions.length; i++) if (Math.abs(positions[i]! - target) < Math.abs(positions[best]! - target)) best = i;
    return best;
  };
  const a = nearest(widthIn / 3);
  const b = nearest((2 * widthIn) / 3);
  return [...new Set([0, a, b, positions.length - 1])].sort((x, y) => x - y);
}

/** Guard posts at run ends and at most 6 ft o.c., corners shared (Figure 35). */
function guardPostPositions(runs: FramingResult["guards"]["runs"]): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const push = (p: { x: number; y: number }) => {
    if (!out.some((q) => Math.abs(q.x - p.x) < 1 && Math.abs(q.y - p.y) < 1)) out.push(p);
  };
  for (const r of runs) {
    const len = Math.hypot(r.to.x - r.from.x, r.to.y - r.from.y);
    const n = Math.max(1, Math.ceil(len / GUARD_RULES.maxPostSpacingIn));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      push({ x: r.from.x + (r.to.x - r.from.x) * t, y: r.from.y + (r.to.y - r.from.y) * t });
    }
  }
  return out;
}
