import type { CatalogColor, InstallationRules, ProductLineSpec } from "./types";

/**
 * Trex® decking — lines, colours, formats and item numbers from the Trex 2026 Full Product Guide
 * (Kuiken Brothers edition, pp. 51–52) and installation rules from the Trex Decking Installation Guide.
 * Item numbers follow Trex's pattern: <colour prefix><thickness><width><length><line><edge>01,
 * e.g. BC010616TLG01 = Biscayne 1x6x16' Transcend Lineage grooved.
 */

const CATALOG = {
  title: "Trex 2026 Full Product Guide (Kuiken Brothers full-line catalog), decking specifications",
  url: "https://www.kuikenbrothers.com/wp-content/uploads/KUIKEN-BROTHERS-TREX-2026-FULL-LINE-CATALOG.pdf",
  retrieved: "2026-11-22",
};
const INSTALL_GUIDE = {
  title: "Trex Decking Installation Guide (trex.com)",
  url: "https://images.trex.com/is/content/trexcompany/decking-installation-guidepdf",
  retrieved: "2026-11-22",
};

/** Rules common to all 1" (and Select 7/8") Trex boards. */
function rules(stringerIn: number, extra: Partial<InstallationRules> = {}): InstallationRules {
  return {
    maxJoistSpacingPerpendicularIn: 16,
    maxJoistSpacingDiagonalIn: 12,
    maxJoistSpacingCommercialIn: 12,
    maxStairStringerSpacingIn: stringerIn,
    minStringersAt36In: 4,
    minStringersOver36In: 5,
    sideGapIn: 0.1875,
    endGap: '1/8" above 40°F, 3/16" below 40°F; abutting solid objects 1/4" (>40°F) / 1/2" (<40°F)',
    maxBoardOverhangIn: 0.5,
    maxTreadOverhangIn: 0.75,
    blockingRowsMaxIn: null,
    minJoistsSpanned: 3,
    hiddenFastenerSystems: ["Trex Hideaway Universal Hidden Fastener (grooved boards)", "TigerClaw TC-G"],
    fastening: "Two Trex-recommended composite deck screws per joist for square-edge boards; stair treads face-fastened or routed for hidden fasteners",
    notes: [
      "Trex Decking Span Chart: 1\" and 7/8\" boards 16\" o.c. residential (12\" commercial); at 45° reduce by 4\" (12\" residential).",
      "Stair treads: 36\" stair needs 4 stringers, over 36\" needs 5; treads 11\" min deep; 1/4\"–3/8\" gap between tread boards.",
      'Minimum width-to-width gap 3/16"; 3/8" recommended for docks/heavily wooded areas; never exceed 1/2".',
    ],
    source: INSTALL_GUIDE,
    ...extra,
  };
}

const sku = (line: string, edge: "S" | "G") => (c: CatalogColor, L: number, thick = "01", width = "06") => `${c.code}${thick}${width}${String(L).padStart(2, "0")}${line}${edge}01`;

const LINEAGE: CatalogColor[] = [
  { name: "Biscayne", code: "BC", hex: "#9c8f80" },
  { name: "Carmel", code: "CL", hex: "#a6866a" },
  { name: "Hatteras", code: "HT", hex: "#8f8678" },
  { name: "Island Mist", code: "IM", hex: "#8a8d8c" },
  { name: "Jasper", code: "JA", hex: "#8b6a4f" },
  { name: "Rainier", code: "RN", hex: "#b2ab9f" },
  { name: "Salt Flat", code: "SF", hex: "#c9c2b4" },
];
const TROPICALS: CatalogColor[] = [
  { name: "Havana Gold", code: "HG", hex: "#b4824c" },
  { name: "Island Mist", code: "IM", hex: "#8a8d8c" },
  { name: "Lava Rock", code: "LR", hex: "#4f4a45" },
  { name: "Spiced Rum", code: "SR", hex: "#7a4f33" },
  { name: "Tiki Torch", code: "TT", hex: "#a0582e" },
];
const EARTH_TONES: CatalogColor[] = [{ name: "Rope Swing", code: "RS", hex: "#a08a6a" }];
const SIGNATURE: CatalogColor[] = [
  { name: "Ocracoke", code: "OC", hex: "#8b7d6b" },
  { name: "Whidbey", code: "WY", hex: "#6f6c66" },
];
const SELECT_A: CatalogColor[] = [
  { name: "Pebble Grey", code: "PG", hex: "#8e8f8b" },
  { name: "Saddle", code: "SD", hex: "#9a7249" },
];
const SELECT_B: CatalogColor[] = [
  { name: "Malted Barley", code: "MY", hex: "#b89a6f" },
  { name: "Millstone", code: "MS", hex: "#7f7a73" },
  { name: "Whiskey Barrel", code: "WL", hex: "#7c5538" },
];
const ENHANCE_NATURALS: CatalogColor[] = [
  { name: "Cinnamon Cove", code: "CC", hex: "#9b623d" },
  { name: "Foggy Wharf", code: "FW", hex: "#8e8b84" },
  { name: "Golden Hour", code: "GH", hex: "#b48a5a" },
  { name: "Honey Grove", code: "HY", hex: "#a97e51" },
  { name: "Rocky Harbor", code: "RH", hex: "#8c8a85" },
  { name: "Toasted Sand", code: "TS", hex: "#b8a07c" },
];
const ENHANCE_BASICS: CatalogColor[] = [
  { name: "Clam Shell", code: "CS", hex: "#9d9790" },
  { name: "Pebble Beach", code: "PB", hex: "#a39a8b" },
  { name: "Saddle", code: "SD", hex: "#9a7249" },
  { name: "Tide Pool", code: "TP", hex: "#8a8e8a" },
];
const REFUGE: CatalogColor[] = [
  { name: "Martis Valley", code: "MV", hex: "#8a7560" },
  { name: "Point Reyes", code: "PR", hex: "#8e8a83" },
];

const ONE_BY_SIX = { thicknessIn: 0.94, widthActualIn: 5.5, nominal: "1x6" };

export const TREX_LINES: ProductLineSpec[] = [
  {
    manufacturer: "Trex",
    line: "Signature",
    material: "mineral-composite",
    colors: SIGNATURE,
    formats: [
      { ...ONE_BY_SIX, profile: "square-edge", lengthsFt: [16, 20], sku: sku("N", "S") },
      { ...ONE_BY_SIX, profile: "grooved", lengthsFt: [12, 16, 20], sku: sku("N", "G") },
    ],
    installation: rules(12, { notes: ["Stringer spacing for Signature is not listed in the installation guide edition used; 12\" (full-profile 1\" board) assumed — verify with Trex."] }),
    warranty: "50-year limited residential",
    catalogSource: CATALOG,
  },
  {
    manufacturer: "Trex",
    line: "Transcend Lineage",
    material: "capped-wood-composite",
    colors: LINEAGE,
    formats: [
      { ...ONE_BY_SIX, profile: "square-edge", lengthsFt: [12, 16, 20], sku: sku("TL", "S") },
      { ...ONE_BY_SIX, profile: "grooved", lengthsFt: [12, 16, 20], sku: sku("TL", "G") },
      { thicknessIn: 0.94, widthActualIn: 3.5, nominal: "1x4", profile: "square-edge", lengthsFt: [16], sku: (c, L) => `${c.code}0104${L}TLS01` },
    ],
    installation: rules(12, { notes: ["Stringer spacing for Transcend Lineage is not listed in the installation guide edition used; 12\" (as Transcend 1x6) assumed — verify with Trex."] }),
    warranty: "50-year limited residential",
    catalogSource: CATALOG,
  },
  {
    manufacturer: "Trex",
    line: "Transcend Tropicals",
    material: "capped-wood-composite",
    colors: TROPICALS,
    formats: [
      { ...ONE_BY_SIX, profile: "square-edge", lengthsFt: [16, 20], sku: sku("T", "S") },
      { ...ONE_BY_SIX, profile: "grooved", lengthsFt: [12, 16, 20], sku: sku("T", "G") },
      { thicknessIn: 1.3, widthActualIn: 5.5, nominal: "2x6", profile: "square-edge", lengthsFt: [12, 16, 20], sku: (c, L) => `${c.code}0206${L}TS01`, note: "2x6 boards: 24\" o.c. joists (16\" commercial); stringers 12\" o.c." },
      { thicknessIn: 1.3, widthActualIn: 3.4, nominal: "2x4", profile: "square-edge", lengthsFt: [16], sku: (c, L) => `${c.code}0204${L}TS01` },
    ],
    installation: rules(12),
    warranty: "50-year limited residential",
    catalogSource: CATALOG,
  },
  {
    manufacturer: "Trex",
    line: "Transcend Earth Tones",
    material: "capped-wood-composite",
    colors: EARTH_TONES,
    formats: [
      { ...ONE_BY_SIX, profile: "square-edge", lengthsFt: [16, 20], sku: sku("T2", "S") },
      { ...ONE_BY_SIX, profile: "grooved", lengthsFt: [12, 16, 20], sku: sku("T2", "G") },
    ],
    installation: rules(12),
    warranty: "50-year limited residential",
    catalogSource: CATALOG,
  },
  {
    manufacturer: "Trex",
    line: "Select",
    material: "capped-wood-composite",
    colors: [...SELECT_A, ...SELECT_B],
    formats: [
      { thicknessIn: 0.82, widthActualIn: 5.5, nominal: "7/8x6", profile: "square-edge", lengthsFt: [12, 16, 20], sku: (c, L) => `${c.code}0106${L}${SELECT_B.some((x) => x.code === c.code) ? "S2" : "S"}S01` },
      { thicknessIn: 0.82, widthActualIn: 5.5, nominal: "7/8x6", profile: "grooved", lengthsFt: [12, 16, 20], sku: (c, L) => `${c.code}0106${L}${SELECT_B.some((x) => x.code === c.code) ? "S2" : "S"}G01` },
      { thicknessIn: 1.3, widthActualIn: 5.5, nominal: "2x6", profile: "square-edge", lengthsFt: [12, 16, 20], sku: (c, L) => `${c.code}0206${L}${SELECT_B.some((x) => x.code === c.code) ? "S2" : "S"}S01`, note: "2x6 boards: 24\" o.c. joists (16\" commercial); stringers 12\" o.c." },
    ],
    installation: rules(9, { notes: ["Select (scalloped bottom) 1x6: stair stringers 9\" o.c. max; 2x6 Select: 12\" o.c."] }),
    warranty: "35-year limited residential",
    catalogSource: CATALOG,
  },
  {
    manufacturer: "Trex",
    line: "Enhance Naturals",
    material: "capped-wood-composite",
    colors: ENHANCE_NATURALS,
    formats: [
      { ...ONE_BY_SIX, profile: "square-edge", lengthsFt: [16, 20], sku: sku("E2", "S") },
      { ...ONE_BY_SIX, profile: "grooved", lengthsFt: [12, 16, 20], sku: sku("E2", "G") },
    ],
    installation: rules(9, { hiddenFastenerSystems: ["Trex Hideaway Universal Hidden Fastener (grooved boards)", "TigerClaw TC-G"], notes: ["Enhance (scalloped bottom): stair stringers 9\" o.c. max.", "Do not use plug-based hidden fasteners (e.g. Cortex) with Trex Enhance."] }),
    warranty: "25-year limited residential",
    attributes: { scalloped: true },
    catalogSource: CATALOG,
  },
  {
    manufacturer: "Trex",
    line: "Enhance Basics",
    material: "capped-wood-composite",
    colors: ENHANCE_BASICS,
    formats: [
      { ...ONE_BY_SIX, profile: "square-edge", lengthsFt: [16, 20], sku: sku("E2", "S") },
      { ...ONE_BY_SIX, profile: "grooved", lengthsFt: [12, 16, 20], sku: sku("E2", "G") },
    ],
    installation: rules(9, { notes: ["Enhance (scalloped bottom): stair stringers 9\" o.c. max.", "Do not use plug-based hidden fasteners (e.g. Cortex) with Trex Enhance."] }),
    warranty: "25-year limited residential",
    attributes: { scalloped: true },
    catalogSource: CATALOG,
  },
  {
    manufacturer: "Trex",
    line: "Refuge",
    family: "PVC",
    material: "capped-pvc",
    colors: REFUGE,
    formats: [{ ...ONE_BY_SIX, profile: "square-edge", lengthsFt: [16, 20], sku: sku("R", "S") }],
    installation: rules(12, { notes: ["Refuge (PVC) has its own installation guide; stringer spacing assumed 12\" — verify with the Trex Refuge Decking Installation Guide."] }),
    warranty: "50-year limited residential",
    catalogSource: CATALOG,
  },
];
