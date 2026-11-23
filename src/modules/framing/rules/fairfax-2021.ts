/**
 * Fairfax County, Virginia — Typical Deck Details, Version 2021.0 (1/5/2024),
 * based on the 2021 Virginia Residential Code.
 * https://www.fairfaxcounty.gov/landdevelopment/sites/landdevelopment/files/assets/documents/pdf/publications/deck-details.pdf
 *
 * Every value here was transcribed from that document; the table/figure numbers are the
 * county's. Framing members in the county tables are designed for 40 PSF live / 10 PSF dead,
 * wet service, preservative-treated Southern Pine #2 or better.
 *
 * This file is a design aid. It does not replace the county's plan review, the inspector,
 * or an engineered design where the typical details do not apply.
 */

export const RULESET = {
  id: "fairfax-county-va-2021.0",
  title: "Fairfax County, Virginia — Typical Deck Details",
  version: "2021.0 (1/5/2024)",
  basis: "2021 Virginia Residential Code",
  sourceUrl: "https://www.fairfaxcounty.gov/landdevelopment/sites/landdevelopment/files/assets/documents/pdf/publications/deck-details.pdf",
  designLoads: "40 PSF live, 10 PSF dead, wet service; deflection L/360 main spans, L/180 overhangs with 220 lb point load",
  lumber: "Preservative-treated Southern Pine, grade #2 or better; ground-contact rated where required (UC4A if buried)",
} as const;

/* ------------------------------ Lumber sizes ------------------------------ */

export const JOIST_SIZES = ["2x6", "2x8", "2x10", "2x12"] as const;
export type JoistSize = (typeof JOIST_SIZES)[number];
export const JOIST_SPACINGS = [12, 16, 24] as const;
export type JoistSpacing = (typeof JOIST_SPACINGS)[number];

/** Actual (dressed) depth of 2x members, inches. */
export const ACTUAL_DEPTH_IN: Record<JoistSize, number> = { "2x6": 5.5, "2x8": 7.25, "2x10": 9.25, "2x12": 11.25 };
export const PLY_THICKNESS_IN = 1.5;
export const POST_ACTUAL_IN = { "4x4": 3.5, "6x6": 5.5 } as const;

/* ------------------------- TABLE 2: joist spans --------------------------- */

/** Joist-span columns used by the allowable-overhang half of Table 2, feet. */
export const OVERHANG_SPAN_COLUMNS_FT = [4, 6, 8, 10, 12, 14, 16, 18] as const;

export interface JoistRow {
  /** Allowable joist span (inches) by spacing. */
  span: Record<JoistSpacing, number>;
  /** Allowable overhang (inches) by joist-span column; null = NP (not permitted). */
  overhang: Record<(typeof OVERHANG_SPAN_COLUMNS_FT)[number], number | null>;
}

/** TABLE 2: MAXIMUM JOIST SPAN LENGTH. Overhang shall also never exceed 1/4 of the actual joist span. */
export const TABLE_2_JOISTS: Record<JoistSize, JoistRow> = {
  "2x6": {
    span: { 12: 119, 16: 108, 24: 91 }, // 9'-11", 9'-0", 7'-7"
    overhang: { 4: 12, 6: 18, 8: 17, 10: null, 12: null, 14: null, 16: null, 18: null },
  },
  "2x8": {
    span: { 12: 157, 16: 142, 24: 116 }, // 13'-1", 11'-10", 9'-8"
    overhang: { 4: 12, 6: 18, 8: 24, 10: 30, 12: 27, 14: null, 16: null, 18: null },
  },
  "2x10": {
    span: { 12: 194, 16: 168, 24: 137 }, // 16'-2", 14'-0", 11'-5"
    overhang: { 4: 12, 6: 18, 8: 24, 10: 30, 12: 36, 14: 40, 16: 40, 18: null },
  },
  "2x12": {
    span: { 12: 216, 16: 198, 24: 162 }, // 18'-0", 16'-6", 13'-6"
    overhang: { 4: 12, 6: 18, 8: 24, 10: 30, 12: 36, 14: 42, 16: 48, 18: 49 },
  },
};

/* -------------------------- TABLE 3: beam sizes --------------------------- */

export const BEAM_SPAN_COLUMNS_FT = [6, 8, 10, 12, 14, 16, 18] as const;
export type BeamSpanColumn = (typeof BEAM_SPAN_COLUMNS_FT)[number];

export interface BeamOption {
  plies: 2 | 3;
  size: JoistSize;
}
const B = (plies: 2 | 3, size: JoistSize): BeamOption => ({ plies, size });

/**
 * TABLE 3: MINIMUM BEAM SIZE. Indexed by beam influence width (ft, "less than or equal to")
 * then by beam-span column. Each cell lists the county's acceptable options (2-ply first);
 * null cells are the shaded, prohibited conditions.
 */
export const TABLE_3_BEAMS: Record<number, Record<BeamSpanColumn, BeamOption[] | null>> = {
  2: { 6: [B(2, "2x6")], 8: [B(2, "2x6")], 10: [B(2, "2x6")], 12: [B(2, "2x8")], 14: [B(2, "2x10")], 16: [B(2, "2x12")], 18: [B(3, "2x10")] },
  3: { 6: [B(2, "2x6")], 8: [B(2, "2x6")], 10: [B(2, "2x6")], 12: [B(2, "2x10")], 14: [B(2, "2x10")], 16: [B(3, "2x10")], 18: [B(3, "2x12")] },
  4: { 6: [B(2, "2x6")], 8: [B(2, "2x6")], 10: [B(2, "2x8"), B(3, "2x6")], 12: [B(2, "2x10")], 14: [B(2, "2x12")], 16: [B(3, "2x12")], 18: null },
  5: { 6: [B(2, "2x6")], 8: [B(2, "2x6")], 10: [B(2, "2x8"), B(3, "2x6")], 12: [B(2, "2x10"), B(3, "2x8")], 14: [B(3, "2x12")], 16: null, 18: null },
  6: { 6: [B(2, "2x6")], 8: [B(2, "2x8"), B(3, "2x6")], 10: [B(2, "2x10"), B(3, "2x8")], 12: [B(2, "2x12"), B(3, "2x10")], 14: null, 16: null, 18: null },
  7: { 6: [B(2, "2x8"), B(3, "2x6")], 8: [B(2, "2x10"), B(3, "2x8")], 10: [B(2, "2x12"), B(3, "2x10")], 12: [B(3, "2x12")], 14: null, 16: null, 18: null },
  8: { 6: [B(2, "2x8"), B(3, "2x6")], 8: [B(2, "2x10"), B(3, "2x8")], 10: [B(2, "2x12"), B(3, "2x10")], 12: null, 14: null, 16: null, 18: null },
  9: { 6: [B(2, "2x8"), B(3, "2x6")], 8: [B(2, "2x12"), B(3, "2x10")], 10: [B(3, "2x10")], 12: null, 14: null, 16: null, 18: null },
  10: { 6: [B(2, "2x8"), B(3, "2x6")], 8: [B(2, "2x12"), B(3, "2x10")], 10: [B(3, "2x10")], 12: null, 14: null, 16: null, 18: null },
  11: { 6: [B(2, "2x8"), B(3, "2x6")], 8: [B(2, "2x12"), B(3, "2x10")], 10: null, 12: null, 14: null, 16: null, 18: null },
  12: { 6: [B(2, "2x8"), B(3, "2x6")], 8: [B(2, "2x12"), B(3, "2x10")], 10: null, 12: null, 14: null, 16: null, 18: null },
  13: { 6: [B(2, "2x10"), B(3, "2x8")], 8: [B(2, "2x12"), B(3, "2x10")], 10: null, 12: null, 14: null, 16: null, 18: null },
  14: { 6: [B(2, "2x10"), B(3, "2x8")], 8: [B(2, "2x12"), B(3, "2x10")], 10: null, 12: null, 14: null, 16: null, 18: null },
  15: { 6: [B(2, "2x10"), B(3, "2x8")], 8: [B(3, "2x12")], 10: null, 12: null, 14: null, 16: null, 18: null },
  16: { 6: [B(2, "2x10"), B(3, "2x8")], 8: [B(3, "2x12")], 10: null, 12: null, 14: null, 16: null, 18: null },
  17: { 6: [B(2, "2x12"), B(3, "2x10")], 8: [B(3, "2x12")], 10: null, 12: null, 14: null, 16: null, 18: null },
  18: { 6: [B(2, "2x12"), B(3, "2x10")], 8: null, 10: null, 12: null, 14: null, 16: null, 18: null },
};
export const MAX_INFLUENCE_WIDTH_FT = 18;

/* ----------------------- TABLE 4 / 5: footings & posts -------------------- */

export type FootingType = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";
export interface FootingCell {
  type: FootingType;
  /** Maximum post height, feet (top of footing to underside of beam). */
  maxPostHeightFt: number;
}
const F = (type: FootingType, maxPostHeightFt: number): FootingCell => ({ type, maxPostHeightFt });

/** TABLE 4: FOOTING TYPE (and maximum post height). null = prohibited. */
export const TABLE_4_FOOTINGS: Record<number, Record<BeamSpanColumn, FootingCell | null>> = {
  2: { 6: F("A", 14), 8: F("A", 14), 10: F("A", 14), 12: F("A", 14), 14: F("A", 14), 16: F("B", 14), 18: F("B", 14) },
  3: { 6: F("A", 14), 8: F("A", 14), 10: F("B", 14), 12: F("B", 14), 14: F("B", 14), 16: F("B", 14), 18: F("C", 14) },
  4: { 6: F("A", 14), 8: F("B", 14), 10: F("B", 14), 12: F("B", 14), 14: F("C", 14), 16: F("D", 14), 18: null },
  5: { 6: F("B", 14), 8: F("B", 14), 10: F("C", 14), 12: F("D", 14), 14: F("E", 14), 16: null, 18: null },
  6: { 6: F("B", 14), 8: F("B", 14), 10: F("D", 14), 12: F("E", 14), 14: null, 16: null, 18: null },
  7: { 6: F("B", 14), 8: F("C", 14), 10: F("E", 14), 12: F("E", 13), 14: null, 16: null, 18: null },
  8: { 6: F("B", 14), 8: F("C", 14), 10: F("E", 13), 12: null, 14: null, 16: null, 18: null },
  9: { 6: F("C", 14), 8: F("D", 14), 10: F("E", 12), 12: null, 14: null, 16: null, 18: null },
  10: { 6: F("D", 14), 8: F("E", 13), 10: F("F", 11), 12: null, 14: null, 16: null, 18: null },
  11: { 6: F("D", 14), 8: F("E", 13), 10: null, 12: null, 14: null, 16: null, 18: null },
  12: { 6: F("E", 14), 8: F("F", 12), 10: null, 12: null, 14: null, 16: null, 18: null },
  13: { 6: F("E", 14), 8: F("F", 11), 10: null, 12: null, 14: null, 16: null, 18: null },
  14: { 6: F("E", 13), 8: F("F", 10), 10: null, 12: null, 14: null, 16: null, 18: null },
  15: { 6: F("F", 12), 8: F("G", 9), 10: null, 12: null, 14: null, 16: null, 18: null },
  16: { 6: F("F", 12), 8: F("H", 9), 10: null, 12: null, 14: null, 16: null, 18: null },
  17: { 6: F("G", 11), 8: F("H", 9), 10: null, 12: null, 14: null, 16: null, 18: null },
  18: { 6: F("G", 11), 8: null, 10: null, 12: null, 14: null, 16: null, 18: null },
};

/** TABLE 5: FOOTING SIZE (inches). */
export const TABLE_5_FOOTING_SIZE: Record<FootingType, { squareIn: number; roundIn: number; thicknessIn: number }> = {
  A: { squareIn: 12, roundIn: 14, thicknessIn: 6 },
  B: { squareIn: 14, roundIn: 16, thicknessIn: 6 },
  C: { squareIn: 16, roundIn: 18, thicknessIn: 6 },
  D: { squareIn: 18, roundIn: 20, thicknessIn: 6 },
  E: { squareIn: 20, roundIn: 22, thicknessIn: 8 },
  F: { squareIn: 22, roundIn: 24, thicknessIn: 8 },
  G: { squareIn: 24, roundIn: 27, thicknessIn: 9 },
  H: { squareIn: 26, roundIn: 29, thicknessIn: 10 },
};

export const FOOTING_RULES = {
  minDepthBelowGradeIn: 24, // frost depth; deeper if solid ground is not found
  nearHouseIn: 60, // footings closer than 5 ft to the house wall must bear at the house footing elevation (Figure 16)
  minConcretePsi: 3000,
  postBaseMinIn: 1, // post anchors shall have a 1-inch minimum base (Figure 17)
  /** Posts shall be 6x6; a post 2.5 ft or less may be 4x4 (4x4 may not carry a 3-ply beam). */
  max4x4PostHeightIn: 30,
  maxPostHeightFt: 14, // beyond Table 4
} as const;

/* ----------------------- TABLE 6: ledger fasteners ------------------------ */

export const LEDGER_SPAN_COLUMNS_FT = [6, 8, 10, 12, 14, 16, 18] as const;
export type BandBoard = "2x-lumber" | "ewp" | "solid-masonry" | "hollow-masonry";
export type LedgerFastenerKey =
  | "lag-screw"
  | "through-bolt"
  | "fastenmaster-ledgerlok"
  | "mitek-ws-ext"
  | "simpson-sdws"
  | "spax-powerlag"
  | "expansion-anchor"
  | "adhesive-anchor";

export interface LedgerFastener {
  key: LedgerFastenerKey;
  label: string;
  /** Spacing (inches o.c.) by joist-span column for a 1" minimum EWP band board; null = not applicable. */
  ewp: number[] | null;
  /** Spacing for a 2x lumber band board. */
  lumber: number[] | null;
  /** Spacing when anchored to masonry/concrete (expansion: concrete or solid masonry; adhesive: also hollow masonry). */
  masonry: number[] | null;
  hollowMasonry: boolean;
}

/** TABLE 6: LEDGER BOARD FASTENER SPACING, INCHES ON CENTER (2 rows, staggered per Figure 26). */
export const TABLE_6_LEDGER_FASTENERS: Record<LedgerFastenerKey, LedgerFastener> = {
  "lag-screw": { key: "lag-screw", label: '½" lag screws', ewp: [24, 18, 14, 12, 10, 9, 8], lumber: [30, 23, 18, 15, 13, 11, 10], masonry: null, hollowMasonry: false },
  "through-bolt": { key: "through-bolt", label: '½" through-bolts', ewp: [24, 18, 14, 12, 10, 9, 8], lumber: [36, 36, 34, 29, 24, 21, 19], masonry: null, hollowMasonry: false },
  "fastenmaster-ledgerlok": { key: "fastenmaster-ledgerlok", label: 'FastenMaster ¼" LedgerLOK', ewp: [25, 19, 15, 12, 10, 9, 8], lumber: [24, 18, 14, 12, 10, 9, 8], masonry: null, hollowMasonry: false },
  "mitek-ws-ext": { key: "mitek-ws-ext", label: 'MiTek ¼" WS-EXT / WSWH-EXT', ewp: [22, 16, 12, 11, 9, 7, 7], lumber: [23, 17, 13, 11, 10, 8, 7], masonry: null, hollowMasonry: false },
  "simpson-sdws": { key: "simpson-sdws", label: 'Simpson Strong-Tie ¼" SDWS', ewp: [14, 10, 8, 7, 6, 5, 5], lumber: [22, 16, 13, 11, 9, 8, 7], masonry: null, hollowMasonry: false },
  "spax-powerlag": { key: "spax-powerlag", label: 'Spax 5/16" HCR PowerLag', ewp: [23, 17, 16, 13, 12, 11, 9], lumber: [30, 22, 18, 12, 10, 9, 8], masonry: null, hollowMasonry: false },
  "expansion-anchor": { key: "expansion-anchor", label: '½" expansion anchors', ewp: null, lumber: null, masonry: [36, 36, 34, 29, 24, 21, 19], hollowMasonry: false },
  "adhesive-anchor": { key: "adhesive-anchor", label: '½" adhesive anchors (Red Head Epcon A7+ or Hilti HY-270)', ewp: null, lumber: null, masonry: [32, 32, 32, 24, 24, 16, 16], hollowMasonry: true },
};

export const LEDGER_RULES = {
  minSize: "2x8" as JoistSize, // ledger depth ≥ joist depth, never less than 2x8
  fastenersEachEnd: 4, // Figure 26
  endClearanceIn: 2,
  rowClearanceByLedger: { "2x8": 5.5, "2x10": 6.5, "2x12": 7.5 } as Record<string, number>, // Figure 26 row offsets
  flashingRequired: true,
} as const;

/* ------------------------ TABLE 8: lateral support ------------------------ */

export type LateralMethod = "method-1-tension-ties" | "method-2-knee-bracing-at-beam" | "method-3-knee-bracing-at-joists";

/**
 * TABLE 8 for single-span attached decks (the only deck type this generator produces):
 * post height ≤ 2.5 ft: none; ≤ 11 ft: Method 1 OR Method 2; ≤ 14 ft: Method 1 AND Method 2.
 */
export function lateralRequirementSingleSpan(postHeightIn: number): { required: "none" | "either" | "both"; limitFt: number } {
  if (postHeightIn <= 30) return { required: "none", limitFt: 2.5 };
  if (postHeightIn <= 11 * 12) return { required: "either", limitFt: 11 };
  return { required: "both", limitFt: 14 };
}

export const TENSION_TIES = {
  count: 4,
  minCapacityLb: 750,
  approved: ["FastenMaster LTS", "Simpson Strong-Tie DTT1Z", "MiTek LTS19-TZ", "MiTek ADTT-TZ"],
  minPenetrationIn: 3,
} as const;

export const KNEE_BRACING = { member: "2x6 at each post-beam location (or 6x6 at end posts and both sides of every other interior post)", legIn: 24, braceLengthIn: 43, angleDeg: 45 } as const; // Figure 30: 2'-0" legs, 3'-7" brace

/* --------------------------------- Guards --------------------------------- */

export const GUARD_RULES = {
  requiredAboveGradeIn: 30, // measured 36" out from the deck edge (Figure 34)
  minHeightIn: 36,
  postSize: "4x4",
  maxPostSpacingIn: 72,
  postBolts: '(2) ½" through-bolts with washers',
  holdDownMinLb: 1800,
  maxOpeningSphereIn: 4,
  balusters: '2x2 balusters, 2½"–5" from top and bottom runners',
  cap: '2x6 or "five-quarter" board, (3)16d nails or (3)#12 screws to each post',
  minRimForGuard: "2x8" as JoistSize, // guards cannot be attached to decks framed with 2x6 joists
} as const;

/* --------------------------------- Stairs --------------------------------- */

export const STAIR_RULES = {
  minWidthIn: 36,
  maxRiserIn: 8.25, // Figure 39
  minTreadIn: 9,
  nosingIn: [0.75, 1.25] as const,
  maxVariationIn: 0.375,
  stringer: "2x12 sawn (cut) or solid",
  maxStringerSpacingIn: 18,
  maxCutStringerSpanIn: 81, // 6'-9" horizontally projected (Figure 41)
  maxSolidStringerSpanIn: 159, // 13'-3", only for stairways exactly 36" wide, 2x wood treads (Figure 41/42)
  minThroatIn: 5.25,
  footing: '8" square or 10" round, 12" deep, at each stringer bearing (Figure 40)',
  upperBearing: "sloped joist hanger to beam or outside joist, 3\" minimum bearing (Figure 40)",
  landingRequiredAboveRiseIn: 144, // total rise > 12 ft requires an intermediate landing built as a free-standing deck
  guardRequiredAboveRiseIn: 30,
  guardHeightFromNosingIn: [34, 38] as const,
  handrailMinRisers: 4,
  handrailHeightIn: [34, 38] as const,
  treadSpanMaxIn: 18,
} as const;

/* ---------------------------- Other connections --------------------------- */

export const CONNECTION_RULES = {
  joistHangerMinDepthFraction: 0.6, // hanger depth ≥ 60% of joist depth (Figure 11)
  joistHangerFasteners: "hanger manufacturer's screws into ledger/flush beam; nails elsewhere",
  rimToJoist: '(3)10d nails or (3)#10 × 3" screws per joist',
  joistToBeam: "mechanical connector or hurricane clip, 100 lb uplift and lateral, each joist (Figure 12)",
  blockingOverBeamWhenOverhangExceedsIn: 24, // 2x blocking ≥ 60% joist depth between overhanging joists over the beam
  beamPlyFastening: '10d nails or #10 × 3" screws, 2 rows staggered @ 16" o.c., 2 at each end and splice (Figure 15)',
  beamToPost6x6: 'notched 6x6 with (2) ½" through-bolts (2-ply beams) or listed post cap (Figure 18/19)',
  beamToPost4x4: "listed post cap only (Figure 19); 4x4 may not carry a 3-ply beam",
  hardwareCoating: "G-185 galvanized (Zmax / Triple Zinc / Gold Coat) or stainless; fasteners hot-dipped galvanized or stainless",
  hiddenFastenerBracing: '2x6 bracing under joists at 45°–60°, continuous, attached to every joist with (2)#8 × 3" screws or (2)12d nails (Figures 2/3) when hidden decking fasteners are used and any post exceeds 2.5 ft',
  deckingThicknessAssumedIn: 1,
} as const;

/** TABLE 1: maximum joist spacing by decking material (inches), perpendicular / angled. */
export const TABLE_1_DECKING = {
  "five-quarter": { perpendicular: 16, angular: 12 },
  "2x": { perpendicular: 24, angular: 16 },
  composite: { perpendicular: null, angular: null }, // per manufacturer
} as const;
