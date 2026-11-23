import type { CatalogColor, InstallationRules, ProductLineSpec } from "./types";

/**
 * TimberTech® (AZEK) decking — collections, colours, profiles and model numbers from the
 * TimberTech 2026 Product Guide (pp. 4–11); installation rules from the TimberTech Advanced PVC and
 * TimberTech Composite Decking Installation & Maintenance Guides.
 */

const GUIDE = {
  title: "TimberTech 2026 Product Guide — Decking (pp. 4–11)",
  url: "https://assets.timbertech.com/content/dam/wp-content/Timbertech-Product-Guide-2026-web.pdf",
  retrieved: "2026-11-22",
};
const PVC_INSTALL = {
  title: "TimberTech Advanced PVC Decking Installation & Maintenance Guide",
  url: "https://pdf.lowes.com/productdocuments/0f9cd167-c011-4e7b-b55f-1e0c5f5af47d/69511650.pdf",
  retrieved: "2026-11-22",
};
const COMPOSITE_INSTALL = {
  title: "TimberTech Composite and Specialty Decking Installation & Maintenance Guide",
  url: "https://pdf.lowes.com/productdocuments/f2029efd-065d-4db8-9efe-3b8d15bc9788/70210455.pdf",
  retrieved: "2026-11-22",
};

const PVC_RULES: InstallationRules = {
  maxJoistSpacingPerpendicularIn: 16,
  maxJoistSpacingDiagonalIn: 12,
  maxJoistSpacingCommercialIn: 12,
  maxStairStringerSpacingIn: 10,
  sideGapIn: 0.125,
  endGap: "Do not gap butt joints/splices/miters (PVC); boards expand and contract with temperature — see guide",
  maxBoardOverhangIn: null,
  maxTreadOverhangIn: null,
  blockingRowsMaxIn: 72,
  hiddenFastenerSystems: ["CONCEALoc (grooved boards)", "FUSIONLoc (grooved boards)", "Cortex concealed screws (square-shoulder)", "TOPLoc colour-matched screws (square-shoulder)", "SIDELoc"],
  fastening: "Square-shoulder boards: Cortex or TOPLoc; grooved boards: CONCEALoc/FUSIONLoc; 2 screws per stringer on stair treads",
  notes: [
    'Joist spacing never over 16" o.c. (24" for 1.5" MAX boards); 12" for diagonal or commercial; 1/8"–1/4" side gap.',
    "Solid blocking between joists in rows every 4'–6'; joists doubled at butt joints with hidden clips.",
    'Stair stringers 10" o.c. maximum (14" with MAX boards), 26" minimum stair width in the guide figure; treads need a 2x4 treated support centered under each tread per Figure 2 when stringers exceed the limit.',
  ],
  source: PVC_INSTALL,
};
const PVC_MAX_RULES: InstallationRules = { ...PVC_RULES, maxJoistSpacingPerpendicularIn: 24, maxJoistSpacingDiagonalIn: 16, maxStairStringerSpacingIn: 14, notes: ['MAX 1.5" boards: joists up to 24" o.c. (16" diagonal); stringers up to 14" o.c.', ...PVC_RULES.notes.slice(1)] };

function compositeRules(stringerIn: number, veneerOnly = false): InstallationRules {
  return {
    maxJoistSpacingPerpendicularIn: 16,
    maxJoistSpacingDiagonalIn: 12,
    maxJoistSpacingCommercialIn: 12,
    maxStairStringerSpacingIn: stringerIn,
    sideGapIn: 0.125,
    endGap: 'Butt joints 3/16" at ≤ 32°F, 1/8" at 33–74°F, 1/32" at ≥ 75°F; 3/16" minimum to any adjoining structure',
    maxBoardOverhangIn: null,
    maxTreadOverhangIn: null,
    blockingRowsMaxIn: 72,
    hiddenFastenerSystems: ["CONCEALoc (grooved boards)", "Cortex concealed screws (square-shoulder, not Terrain)", "TOPLoc screws"],
    fastening: "Two screws per board at each joist for square-shoulder boards; CONCEALoc clip at each joist for grooved boards",
    notes: [
      'Joist spacing never over 16" o.c.; 12" for diagonal/commercial; side gap 1/8"–3/16".',
      "TimberTech does not recommend installing boards on steps without a riser board; stringer step must be at least two full boards plus gap deep.",
      ...(veneerOnly ? ['Scalloped boards (Terrain, Prime, Prime+) must be used as a veneer over a 2x6 support in stair treads; 16" o.c. stringers when so supported.'] : [`Stair stringers ${stringerIn}" o.c. maximum (TimberTech Stair Stringer Spacing Chart).`]),
    ],
    source: COMPOSITE_INSTALL,
  };
}

/** TimberTech model numbers: <prefix><nominal><length><colour code>. */
const pvc = (profilePrefix: string, nominalCode: string) => (c: CatalogColor, L: number) => `${profilePrefix}${nominalCode}${L}${c.code}`;
const comp = (linePrefix: string, edge: "GV" | "") => (c: CatalogColor, L: number) => `${linePrefix}${edge}54${L}${c.code}`;

const STD_PVC = { thicknessIn: 1, widthActualIn: 5.5, nominal: "1x6" };
const STD_COMP = { thicknessIn: 0.94, widthActualIn: 5.36, nominal: "1x6" };
const STD_COMP_089 = { thicknessIn: 0.89, widthActualIn: 5.36, nominal: "1x6" };

export const TIMBERTECH_LINES: ProductLineSpec[] = [
  {
    manufacturer: "TimberTech",
    line: "Vintage Collection",
    family: "Advanced PVC",
    material: "capped-pvc",
    colors: [
      { name: "Coastline", code: "CS", hex: "#a39a8c" },
      { name: "English Walnut", code: "EW", hex: "#6a4a35" },
      { name: "Weathered Teak", code: "WT", hex: "#8c7a66" },
      { name: "Mahogany", code: "MH", hex: "#7a3f2b" },
      { name: "Dark Hickory", code: "DH", hex: "#5a4232" },
      { name: "Cypress", code: "CY", hex: "#b59a76" },
    ],
    formats: [
      { ...STD_PVC, profile: "square-edge", lengthsFt: [16, 20], sku: pvc("ADB", "155") },
      { ...STD_PVC, profile: "grooved", lengthsFt: [12, 16, 20], sku: pvc("AGB", "155") },
      { thicknessIn: 1, widthActualIn: 3.5, nominal: "1x4", profile: "square-edge", lengthsFt: [16, 20], sku: pvc("ADB", "135") },
      { thicknessIn: 1, widthActualIn: 7.25, nominal: "1x8", profile: "square-edge", lengthsFt: [16, 20], sku: pvc("ADB", "1725") },
    ],
    installation: PVC_RULES,
    warranty: "Lifetime limited product / 50-year fade & stain",
    attributes: { wui: true, flameSpread: "Class A" },
    catalogSource: GUIDE,
  },
  {
    manufacturer: "TimberTech",
    line: "Vintage Collection MAX",
    family: "Advanced PVC",
    material: "capped-pvc",
    colors: [{ name: "Coastline", code: "CS", hex: "#a39a8c" }],
    formats: [{ thicknessIn: 1.5, widthActualIn: 5.5, nominal: "2x6", profile: "square-edge", lengthsFt: [12, 16, 20], sku: pvc("ADB", "255") }],
    installation: PVC_MAX_RULES,
    warranty: "Lifetime limited product / 50-year fade & stain",
    catalogSource: GUIDE,
  },
  {
    manufacturer: "TimberTech",
    line: "Landmark Collection",
    family: "Advanced PVC",
    material: "capped-pvc",
    colors: [
      { name: "Castle Gate", code: "CG", hex: "#7d7a74" },
      { name: "American Walnut", code: "AW", hex: "#6b4c3b" },
      { name: "French White Oak", code: "FW", hex: "#b4a48b" },
      { name: "Boardwalk", code: "BD", hex: "#9b8668" },
    ],
    formats: [
      { ...STD_PVC, profile: "square-edge", lengthsFt: [16, 20], sku: pvc("ADB", "155") },
      { ...STD_PVC, profile: "grooved", lengthsFt: [12, 16, 20], sku: pvc("AGB", "155") },
    ],
    installation: PVC_RULES,
    warranty: "Lifetime limited product / 50-year fade & stain",
    attributes: { wui: true, flameSpread: "Class A" },
    catalogSource: GUIDE,
  },
  {
    manufacturer: "TimberTech",
    line: "Harvest Collection",
    family: "Advanced PVC",
    material: "capped-pvc",
    colors: [
      { name: "Brownstone", code: "BS", hex: "#7b5a44" },
      { name: "Slate Gray", code: "SG", hex: "#7f8285" },
      { name: "Kona", code: "KOAAT", hex: "#4e3b31" },
    ],
    formats: [
      { ...STD_PVC, profile: "square-edge", lengthsFt: [12, 16, 20], sku: (c, L) => (c.code === "KOAAT" ? `ADB155${L}KOAAT` : `ADCB155${L}${c.code}`), lengthsByColor: { Kona: [16, 20] } },
      { ...STD_PVC, profile: "grooved", lengthsFt: [12, 16, 20], sku: pvc("AGB", "155"), colors: ["Brownstone", "Slate Gray"] },
      { thicknessIn: 1, widthActualIn: 7.25, nominal: "1x8", profile: "square-edge", lengthsFt: [16, 20], sku: pvc("ADCB", "1725"), colors: ["Brownstone", "Slate Gray"] },
    ],
    installation: PVC_RULES,
    warranty: "Lifetime limited product / 50-year fade & stain",
    attributes: { wui: true, flameSpread: "Class A" },
    catalogSource: GUIDE,
  },
  {
    manufacturer: "TimberTech",
    line: "Harvest Collection MAX",
    family: "Advanced PVC",
    material: "capped-pvc",
    colors: [{ name: "Slate Gray", code: "SG", hex: "#7f8285" }],
    formats: [{ thicknessIn: 1.5, widthActualIn: 5.5, nominal: "2x6", profile: "square-edge", lengthsFt: [12, 16, 20], sku: pvc("ADCB", "255") }],
    installation: PVC_MAX_RULES,
    warranty: "Lifetime limited product / 50-year fade & stain",
    catalogSource: GUIDE,
  },
  {
    manufacturer: "TimberTech",
    line: "Harvest+ Collection",
    family: "Advanced PVC",
    material: "capped-pvc",
    colors: [
      { name: "Toasted Wheat", code: "TWH", hex: "#b89b74" },
      { name: "Timber Gray", code: "TBG", hex: "#8a8a86" },
    ],
    formats: [
      { ...STD_PVC, profile: "square-edge", lengthsFt: [16, 20], sku: pvc("ADB", "155") },
      { ...STD_PVC, profile: "grooved", lengthsFt: [12, 16, 20], sku: pvc("AGB", "155") },
    ],
    installation: PVC_RULES,
    warranty: "Lifetime limited product / 50-year fade & stain",
    attributes: { wui: true, flameSpread: "Class B" },
    catalogSource: GUIDE,
  },
  {
    manufacturer: "TimberTech",
    line: "Legacy Collection",
    family: "Composite",
    material: "capped-wood-composite",
    colors: [
      { name: "Espresso", code: "E", hex: "#4a3a30" },
      { name: "Whitewash Cedar", code: "WC", hex: "#b8ab97" },
      { name: "Mocha", code: "M", hex: "#6e5240" },
      { name: "Pecan", code: "P", hex: "#9c7a56" },
      { name: "Tigerwood", code: "TW", hex: "#9a5f3a" },
      { name: "Ashwood", code: "AW", hex: "#8e8578" },
    ],
    formats: [
      { ...STD_COMP, profile: "grooved", lengthsFt: [12, 16, 20], sku: comp("LC", "GV") },
      { ...STD_COMP, profile: "square-edge", lengthsFt: [16, 20], sku: comp("LC", "") },
    ],
    installation: compositeRules(10),
    warranty: "30-year product, fade & stain limited",
    catalogSource: GUIDE,
  },
  {
    manufacturer: "TimberTech",
    line: "Reserve Collection",
    family: "Composite",
    material: "capped-wood-composite",
    colors: [
      { name: "Driftwood", code: "DW", hex: "#8f8a80" },
      { name: "Antique Leather", code: "AL", hex: "#8a5f3f" },
      { name: "Dark Roast", code: "DR", hex: "#4f3b2e" },
      { name: "Reclaimed Chestnut", code: "RC", hex: "#7a5a44" },
    ],
    formats: [
      { ...STD_COMP, profile: "grooved", lengthsFt: [12, 16, 20], sku: comp("RC", "GV") },
      { ...STD_COMP, profile: "square-edge", lengthsFt: [16, 20], sku: comp("RC", "") },
      { ...STD_COMP, profile: "grooved", lengthsFt: [12, 16, 20], sku: (c, L) => `RCGV54${L}${c.code}-FR`, note: "Fire-rated (FR) SKU" },
      { ...STD_COMP, profile: "square-edge", lengthsFt: [16, 20], sku: (c, L) => `RC54${L}${c.code}-FR`, note: "Fire-rated (FR) SKU" },
    ],
    installation: compositeRules(10),
    warranty: "30-year product, fade & stain limited",
    catalogSource: GUIDE,
  },
  {
    manufacturer: "TimberTech",
    line: "Terrain+ Collection",
    family: "Composite",
    material: "capped-wood-composite",
    colors: [
      { name: "Natural White Oak", code: "NW", hex: "#b7a88e" },
      { name: "Weathered Oak", code: "WO", hex: "#8f8577" },
      { name: "Dark Oak", code: "DO", hex: "#5e4a3b" },
    ],
    formats: [
      { ...STD_COMP, profile: "grooved", lengthsFt: [12, 16, 20], sku: comp("TC", "GV") },
      { ...STD_COMP, profile: "square-edge", lengthsFt: [16, 20], sku: comp("TC", "") },
    ],
    installation: compositeRules(16, true),
    warranty: "30-year product, fade & stain limited",
    attributes: { scalloped: true },
    catalogSource: GUIDE,
  },
  {
    manufacturer: "TimberTech",
    line: "Terrain Collection",
    family: "Composite",
    material: "capped-wood-composite",
    colors: [
      { name: "Brown Oak", code: "BO", hex: "#7a5c43" },
      { name: "Silver Maple", code: "SM", hex: "#9a9893" },
    ],
    formats: [
      { ...STD_COMP, profile: "grooved", lengthsFt: [12, 16, 20], sku: comp("TC", "GV") },
      { ...STD_COMP, profile: "square-edge", lengthsFt: [16, 20], sku: comp("TC", "") },
    ],
    installation: { ...compositeRules(16, true), hiddenFastenerSystems: ["CONCEALoc (grooved boards)", "TOPLoc screws"], notes: [...compositeRules(16, true).notes, "Cortex is not compatible with the Terrain Collection."] },
    warranty: "30-year product, fade & stain limited",
    attributes: { scalloped: true },
    catalogSource: GUIDE,
  },
  {
    manufacturer: "TimberTech",
    line: "Premier+ Collection",
    family: "Composite",
    material: "capped-wood-composite",
    colors: [{ name: "Natural Oak", code: "NO", hex: "#a98f6c" }],
    formats: [
      { ...STD_COMP_089, profile: "grooved", lengthsFt: [12, 16, 20], sku: comp("PRP", "GV") },
      { ...STD_COMP_089, profile: "square-edge", lengthsFt: [16, 20], sku: comp("PRP", "") },
    ],
    installation: compositeRules(16, true),
    warranty: "30-year product, fade & stain limited",
    catalogSource: GUIDE,
  },
  {
    manufacturer: "TimberTech",
    line: "Prime+ Collection",
    family: "Composite",
    material: "capped-wood-composite",
    colors: [
      { name: "Coconut Husk", code: "CH", hex: "#a08a6a" },
      { name: "Sea Salt Gray", code: "ST", hex: "#9c9d9a" },
      { name: "Dark Cocoa", code: "DC", hex: "#5a463a" },
    ],
    formats: [
      { ...STD_COMP, profile: "grooved", lengthsFt: [12, 16, 20], sku: comp("PR", "GV") },
      { ...STD_COMP, profile: "square-edge", lengthsFt: [16, 20], sku: comp("PR", "") },
    ],
    installation: compositeRules(16, true),
    warranty: "25-year product, fade & stain limited",
    attributes: { scalloped: true },
    catalogSource: GUIDE,
  },
  {
    manufacturer: "TimberTech",
    line: "Prime Collection",
    family: "Composite",
    material: "capped-wood-composite",
    colors: [
      { name: "Dark Teak", code: "DT", hex: "#6b4f3c" },
      { name: "Maritime Gray", code: "MG", hex: "#8a8d90" },
    ],
    formats: [
      { ...STD_COMP, profile: "grooved", lengthsFt: [12, 16, 20], sku: comp("ES", "GV") },
      { ...STD_COMP, profile: "square-edge", lengthsFt: [16, 20], sku: comp("ES", "") },
    ],
    installation: compositeRules(16, true),
    warranty: "25-year product, fade & stain limited",
    attributes: { scalloped: true },
    catalogSource: GUIDE,
  },
  {
    manufacturer: "TimberTech",
    line: "Premier Collection",
    family: "Composite",
    material: "capped-wood-composite",
    colors: [
      { name: "Dark Teak", code: "DT", hex: "#6b4f3c" },
      { name: "Maritime Gray", code: "MG", hex: "#8a8d90" },
    ],
    formats: [
      { ...STD_COMP_089, profile: "grooved", lengthsFt: [12, 16, 20], sku: comp("EF", "GV") },
      { ...STD_COMP_089, profile: "square-edge", lengthsFt: [16, 20], sku: comp("EF", "") },
    ],
    installation: compositeRules(9),
    warranty: "25-year product, fade & stain limited",
    attributes: { regionalAvailability: "varies by region" },
    catalogSource: GUIDE,
  },
];
