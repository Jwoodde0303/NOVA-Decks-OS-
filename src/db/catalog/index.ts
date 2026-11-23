import { DECKORATORS_LINES } from "./deckorators";
import { TIMBERTECH_LINES } from "./timbertech";
import { TREX_LINES } from "./trex";
import { expandLine, type CatalogProductRow, type InstallationRules, type ProductLineSpec } from "./types";

export type { CatalogProductRow, InstallationRules, ProductLineSpec };

/** Fictional products used by tests and demos (6" effective width, whole-foot lengths). */
const FICTIONAL_RULES: InstallationRules = {
  maxJoistSpacingPerpendicularIn: 16,
  maxJoistSpacingDiagonalIn: 12,
  maxJoistSpacingCommercialIn: 12,
  maxStairStringerSpacingIn: 12,
  sideGapIn: 0,
  endGap: "n/a (fictional)",
  maxBoardOverhangIn: null,
  maxTreadOverhangIn: null,
  blockingRowsMaxIn: null,
  hiddenFastenerSystems: [],
  fastening: "fictional",
  notes: ["Fictional product for demos and tests."],
  source: { title: "fictional-seed", url: "", retrieved: "2026-01-01" },
};

export const FICTIONAL_LINES: ProductLineSpec[] = [
  {
    manufacturer: "Northline Composites",
    line: "Harbor",
    material: "fictional",
    colors: [{ name: "Harbor Grey", code: "GRY", hex: "#8c8f8c" }],
    formats: [{ profile: "square-edge", thicknessIn: 1, widthActualIn: 6, nominal: "1x6", lengthsFt: [10, 20], sku: (c, L) => `NL-HBR-${c.code}-${L}` }],
    installation: FICTIONAL_RULES,
    catalogSource: { title: "fictional-seed", url: "", retrieved: "2026-01-01" },
  },
  {
    manufacturer: "Ridgewood Boards",
    line: "Cedar Tone",
    material: "fictional",
    colors: [{ name: "Cedar Tone", code: "CT", hex: "#b07a4a" }],
    formats: [{ profile: "square-edge", thicknessIn: 1, widthActualIn: 6, nominal: "1x6", lengthsFt: [16], sku: (c, L) => `RW-${c.code}-${L}` }],
    installation: FICTIONAL_RULES,
    catalogSource: { title: "fictional-seed", url: "", retrieved: "2026-01-01" },
  },
];

export const ALL_LINES: ProductLineSpec[] = [...TREX_LINES, ...TIMBERTECH_LINES, ...DECKORATORS_LINES, ...FICTIONAL_LINES];

/** Every catalog row, expanded. Names for fictional products keep their legacy short form. */
export function allCatalogRows(): CatalogProductRow[] {
  const rows = ALL_LINES.flatMap(expandLine);
  for (const r of rows) {
    if (r.material === "fictional") {
      r.name = `${r.color} ${r.stockLengthIn / 12} ft`;
      r.verified = true;
    }
  }
  return rows;
}

export function catalogSummary(rows = allCatalogRows()) {
  const byMfr = new Map<string, { lines: Set<string>; colors: Set<string>; skus: number }>();
  for (const r of rows) {
    const m = byMfr.get(r.manufacturer) ?? { lines: new Set(), colors: new Set(), skus: 0 };
    m.lines.add(r.productLine);
    m.colors.add(`${r.productLine}/${r.color}`);
    m.skus++;
    byMfr.set(r.manufacturer, m);
  }
  return [...byMfr.entries()].map(([manufacturer, m]) => ({ manufacturer, lines: m.lines.size, colors: m.colors.size, skus: m.skus }));
}
