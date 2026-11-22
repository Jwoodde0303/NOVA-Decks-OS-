import type { InstallationRules, ProductLineSpec } from "./types";

/**
 * Deckorators® decking — collections, colours, widths and lengths from the Deckorators 2026 Decking
 * Overview brochure (15799, 12/25) and the 2026 Vista sell sheet (15830, 4/26). Deckorators does not
 * publish item numbers in those brochures, so SKUs here are synthesized (DKR-…) and must be replaced
 * with the distributor's item numbers before ordering.
 */

const OVERVIEW = {
  title: "Deckorators 2026 Decking Overview brochure (15799_12/25)",
  url: "https://www.deckorators.com/cdn/shop/files/15799_2026DeckingOverviewBrochure_Final_LR_3.pdf",
  retrieved: "2026-11-22",
};

/** Surestone / mineral-based composite (Voyage, Summit, Picture Frame Board): Mineral-Based Composite Installation Guide. */
const MINERAL_RULES: InstallationRules = {
  maxJoistSpacingPerpendicularIn: 16,
  maxJoistSpacingDiagonalIn: 12,
  maxJoistSpacingCommercialIn: 12,
  maxStairStringerSpacingIn: 9,
  minStringersAt36In: 5,
  minStringersOver36In: 5,
  sideGapIn: 0.125,
  endGap: 'End-to-end 1/16" above 32°F, 1/8" below 32°F; abutting solid objects 1/8" / 1/4"',
  maxBoardOverhangIn: null,
  maxTreadOverhangIn: 0.5,
  blockingRowsMaxIn: null,
  hiddenFastenerSystems: ["Deckorators Stowaway hidden fasteners (grooved boards)", "Deckorators Pro Plug system (face screws)"],
  fastening: 'Two reverse-thread composite screws (2-1/2" min, 1-1/4" penetration) per board at each joist; screws 3/8"–1" from board edges and ends',
  notes: [
    "Joist spacing, stair-stringer spacing and fastener requirements are the same for all mineral-based board widths (3.5\", 5.5\", 7.25\", 9.25\").",
    "Stair treads fastened over a minimum of 5 stringers; 11\" minimum tread depth; 1/8\" minimum gap between tread boards (1/4\"–3/8\" where code requires).",
    "Not for structural use (posts, joists, beams or stringers).",
  ],
  source: {
    title: "Deckorators Mineral-Based Composite Installation Guide (Voyage, Summit, Vault, Excursion)",
    url: "https://pdf.lowes.com/productdocuments/9556224f-dbb4-46aa-9099-6e56d7c9a0f6/68633013.pdf",
    retrieved: "2026-11-22",
  },
};

/** Traditional composite (Vista, Venture): Deckorators solid/grooved decking instructions and Vista stair instructions. */
const TRADITIONAL_RULES: InstallationRules = {
  maxJoistSpacingPerpendicularIn: 16,
  maxJoistSpacingDiagonalIn: 12,
  maxJoistSpacingCommercialIn: 12,
  maxStairStringerSpacingIn: 8,
  sideGapIn: 0.25,
  endGap: 'Board-end gap by installation temperature vs. warmest expected (1/8" to 5/16" per the Deckorators chart); 1/4" from any permanent structure or post',
  maxBoardOverhangIn: 1,
  maxTreadOverhangIn: null,
  blockingRowsMaxIn: 72,
  hiddenFastenerSystems: ["Deckorators Stowaway hidden fasteners (grooved boards)"],
  fastening: 'Two 2-1/2" corrosion-resistant composite deck screws per board at each joist; pre-drill within 1-1/2" of board ends',
  notes: [
    "Unsupported stair stringers (stair joists only): 8\" o.c. max; with riser-supported/fully supported treads (2x4 kick plate) 16\" o.c. max; commercial stairs 8\" o.c.",
    "Solid blocking every 4'–6' between joists; decking must be screwed (not hidden-fastened) when used as stair treads.",
    "Not for structural use (posts, joists, beams or stringers).",
  ],
  source: {
    title: "Deckorators Vista Decking Installation Instructions (15557, 4/26) and Deckorators solid/grooved decking installation instructions",
    url: "https://www.deckorators.com/cdn/shop/files/15557_VistaDeckingInstallationInstructions_International_Metric_04.09.26.pdf",
    retrieved: "2026-11-22",
  },
};

const T = 0.9375; // Deckorators composite/mineral boards are nominally 15/16" thick (verify per collection)

export const DECKORATORS_LINES: ProductLineSpec[] = [
  {
    manufacturer: "Deckorators",
    line: "Voyage",
    family: "Surestone (mineral-based composite)",
    material: "mineral-composite",
    colors: [
      { name: "Tundra", hex: "#8f8a80" },
      { name: "Sierra", hex: "#a68a6c" },
      { name: "Sedona", hex: "#8c5a3f" },
      { name: "Mesa", hex: "#7d6a5a" },
      { name: "Khaya", hex: "#7a4e37" },
      { name: "Costa", hex: "#a39784" },
    ],
    formats: [
      { profile: "grooved", thicknessIn: T, widthActualIn: 5.5, nominal: "1x6", lengthsFt: [12, 16, 20] },
      { profile: "grooved", thicknessIn: T, widthActualIn: 3.5, nominal: "1x4", lengthsFt: [20] },
      { profile: "grooved", thicknessIn: T, widthActualIn: 7.25, nominal: "1x8", lengthsFt: [20] },
      { profile: "square-edge", thicknessIn: T, widthActualIn: 5.5, nominal: "1x6", lengthsFt: [16, 20] },
      { profile: "square-edge", thicknessIn: T, widthActualIn: 3.5, nominal: "1x4", lengthsFt: [20] },
      { profile: "square-edge", thicknessIn: T, widthActualIn: 7.25, nominal: "1x8", lengthsFt: [20] },
      { profile: "square-edge", thicknessIn: T, widthActualIn: 9.25, nominal: "1x10", lengthsFt: [20] },
    ],
    installation: MINERAL_RULES,
    warranty: "50-year structural / 25-year stain & fade / 25-year removal & replacement limited",
    attributes: { stepTreadColors: ["Khaya", "Tundra"] },
    catalogSource: OVERVIEW,
  },
  {
    manufacturer: "Deckorators",
    line: "Summit",
    family: "Surestone (mineral-based composite)",
    material: "mineral-composite",
    colors: [
      { name: "Boulder", hex: "#8a8378" },
      { name: "Cliffside", hex: "#a08f78" },
      { name: "Glacier", hex: "#b3aea3" },
    ],
    formats: [
      { profile: "grooved", thicknessIn: T, widthActualIn: 5.5, nominal: "1x6", lengthsFt: [12, 16, 20] },
      { profile: "square-edge", thicknessIn: T, widthActualIn: 5.5, nominal: "1x6", lengthsFt: [16, 20] },
    ],
    installation: MINERAL_RULES,
    warranty: "25-year structural / 25-year stain & fade limited",
    catalogSource: OVERVIEW,
  },
  {
    manufacturer: "Deckorators",
    line: "Picture Frame Board",
    family: "Surestone (mineral-based composite)",
    material: "mineral-composite",
    colors: [{ name: "Dark Slate", hex: "#4b4d4f" }],
    formats: [
      { profile: "grooved", thicknessIn: T, widthActualIn: 3.5, nominal: "1x4", lengthsFt: [21] },
      { profile: "square-edge", thicknessIn: T, widthActualIn: 3.5, nominal: "1x4", lengthsFt: [21] },
      { profile: "square-edge", thicknessIn: T, widthActualIn: 5.5, nominal: "1x6", lengthsFt: [21] },
      { profile: "square-edge", thicknessIn: T, widthActualIn: 7.25, nominal: "1x8", lengthsFt: [21] },
    ],
    installation: MINERAL_RULES,
    warranty: "50-year structural / 25-year stain & fade / 25-year removal & replacement limited",
    catalogSource: OVERVIEW,
  },
  {
    manufacturer: "Deckorators",
    line: "Vista",
    family: "Traditional composite",
    material: "capped-wood-composite",
    colors: [
      { name: "Ironwood", hex: "#6b4a37" },
      { name: "Dunewood", hex: "#a68d6e" },
      { name: "Driftwood", hex: "#8c857b" },
      { name: "Silverwood", hex: "#9a9b98" },
    ],
    formats: [
      { profile: "grooved", thicknessIn: T, widthActualIn: 5.5, nominal: "1x6", lengthsFt: [12, 16, 20] },
      { profile: "square-edge", thicknessIn: T, widthActualIn: 5.5, nominal: "1x6", lengthsFt: [12, 16, 20] },
    ],
    installation: TRADITIONAL_RULES,
    warranty: "25-year structural / 25-year stain & fade limited",
    attributes: { flameSpread: "Class B", wui: true },
    catalogSource: { title: "Deckorators 2026 Vista Decking sell sheet (15830_4/26)", url: "https://www.deckorators.com/cdn/shop/files/15830_2026VistaDeckingSellSheet_LR_1.pdf", retrieved: "2026-11-22" },
  },
  {
    manufacturer: "Deckorators",
    line: "Venture",
    family: "Traditional composite",
    material: "capped-wood-composite",
    colors: [
      { name: "Shoreline", hex: "#8a6e55" },
      { name: "Saltwater", hex: "#8e9196" },
      { name: "Sandbar", hex: "#b39d7e" },
    ],
    formats: [
      { profile: "grooved", thicknessIn: T, widthActualIn: 5.5, nominal: "1x6", lengthsFt: [12, 16, 20] },
      { profile: "square-edge", thicknessIn: T, widthActualIn: 5.5, nominal: "1x6", lengthsFt: [12, 16, 20] },
    ],
    installation: TRADITIONAL_RULES,
    warranty: "25-year structural / 25-year stain & fade limited",
    catalogSource: OVERVIEW,
  },
];
