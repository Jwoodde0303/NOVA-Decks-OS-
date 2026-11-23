import { describe, expect, it } from "vitest";
import { ALL_LINES, allCatalogRows, catalogSummary } from "@/db/catalog";
import { TREX_LINES } from "@/db/catalog/trex";
import { TIMBERTECH_LINES } from "@/db/catalog/timbertech";
import { DECKORATORS_LINES } from "@/db/catalog/deckorators";

const rows = allCatalogRows();

describe("manufacturer catalog", () => {
  it("expands every line into unique SKUs with installation rules", () => {
    const keys = new Set(rows.map((r) => `${r.manufacturer}|${r.sku}`));
    expect(keys.size).toBe(rows.length);
    for (const r of rows) {
      expect(r.installation.maxJoistSpacingPerpendicularIn).toBeGreaterThan(0);
      expect(r.installation.maxStairStringerSpacingIn).toBeGreaterThan(0);
      expect(r.effectiveWidthIn).toBeGreaterThan(0);
      expect(r.stockLengthIn % 12).toBe(0);
      expect(r.colorHex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("covers the three manufacturers' current decking collections", () => {
    const summary = Object.fromEntries(catalogSummary(rows).map((s) => [s.manufacturer, s]));
    expect(summary.Trex!.lines).toBe(TREX_LINES.length);
    expect(summary.TimberTech!.lines).toBe(TIMBERTECH_LINES.length);
    expect(summary.Deckorators!.lines).toBe(DECKORATORS_LINES.length);
    expect(summary.Trex!.colors).toBeGreaterThanOrEqual(30);
    expect(summary.TimberTech!.colors).toBeGreaterThanOrEqual(35);
    expect(summary.Deckorators!.colors).toBeGreaterThanOrEqual(16);
    expect(ALL_LINES.map((l) => l.line)).toEqual(expect.arrayContaining(["Transcend Lineage", "Signature", "Select", "Enhance Naturals", "Vintage Collection", "Legacy Collection", "Prime+ Collection", "Voyage", "Vista", "Venture", "Summit"]));
  });

  it("builds Trex and TimberTech item numbers in the manufacturers' formats", () => {
    const bySku = new Map(rows.map((r) => [r.sku, r]));
    expect(bySku.get("BC010616TLG01")).toMatchObject({ manufacturer: "Trex", productLine: "Transcend Lineage", color: "Biscayne", profile: "grooved", stockLengthIn: 192, widthActualIn: 5.5, thicknessIn: 0.94 });
    expect(bySku.get("PG010620SS01")).toMatchObject({ productLine: "Select", color: "Pebble Grey", profile: "square-edge", thicknessIn: 0.82 });
    expect(bySku.get("MY010616S2G01")).toMatchObject({ color: "Malted Barley" });
    expect(bySku.get("HG020616TS01")).toMatchObject({ productLine: "Transcend Tropicals", thicknessIn: 1.3 });
    expect(bySku.get("AGB15512CS")).toMatchObject({ manufacturer: "TimberTech", productLine: "Vintage Collection", color: "Coastline", profile: "grooved", stockLengthIn: 144 });
    expect(bySku.get("ADB25520CS")).toMatchObject({ productLine: "Vintage Collection MAX", thicknessIn: 1.5 });
    expect(bySku.get("LCGV5416P")).toMatchObject({ productLine: "Legacy Collection", color: "Pecan", widthActualIn: 5.36 });
    expect(bySku.get("RCGV5420DR-FR")).toMatchObject({ productLine: "Reserve Collection", color: "Dark Roast" });
    expect(bySku.get("DEC-VOYAGE-KHAYA-G5.5-16")).toMatchObject({ manufacturer: "Deckorators", productLine: "Voyage", color: "Khaya" });
    expect(bySku.get("ADB15516KOAAT")).toMatchObject({ color: "Kona" });
    expect(bySku.get("AGB15512KOAAT")).toBeUndefined(); // Kona has no grooved SKU
  });

  it("carries manufacturer installation rules that differ by line", () => {
    const find = (sku: string) => rows.find((r) => r.sku === sku)!.installation;
    expect(find("SR010616TG01").maxStairStringerSpacingIn).toBe(12); // Transcend 1x6
    expect(find("PG010616SG01").maxStairStringerSpacingIn).toBe(9); // Select scalloped
    expect(find("CC010616E2G01").maxStairStringerSpacingIn).toBe(9); // Enhance
    expect(find("AGB15516CS").maxStairStringerSpacingIn).toBe(10); // Advanced PVC
    expect(find("ADB25520CS").maxJoistSpacingPerpendicularIn).toBe(24); // PVC MAX
    expect(find("LCGV5416P").maxStairStringerSpacingIn).toBe(10); // Legacy
    expect(find("EFGV5416DT").maxStairStringerSpacingIn).toBe(9); // Premier
    expect(find("DEC-VOYAGE-KHAYA-G5.5-16")).toMatchObject({ maxStairStringerSpacingIn: 9, minStringersAt36In: 5, sideGapIn: 0.125 });
    expect(find("DEC-VISTA-IRONWO-G5.5-16")).toMatchObject({ maxStairStringerSpacingIn: 8, sideGapIn: 0.25, blockingRowsMaxIn: 72 });
    expect(rows.find((r) => r.sku === "SR010616TG01")!.effectiveWidthIn).toBe(5.688);
  });
});
