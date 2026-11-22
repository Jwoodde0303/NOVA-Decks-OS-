import { describe, expect, it } from "vitest";
import { analyzeDeck, DEFAULT_DECK_DESIGN, validateDeckDesign, type DeckingProductSpec } from "@/modules/design/model";
import { computeTakeoff, takeoffToCsv, type PricedProduct } from "@/modules/estimating/takeoff";
import { ValidationError } from "@/modules/core/errors";

const productA: PricedProduct = {
  id: "a",
  name: "Product A",
  sku: "A-20",
  manufacturer: "Test",
  stockLengthIn: 240,
  effectiveWidthIn: 6,
  unitPriceCents: 6000,
  priceSource: "test",
  priceEffectiveOn: "2026-01-01",
  supplierName: null,
};
const productB: PricedProduct = { ...productA, id: "b", name: "Product B", sku: "B-10", stockLengthIn: 120, unitPriceCents: 3400 };

const fixture = DEFAULT_DECK_DESIGN; // 20' × 12', 4' high, 6' stair at 4' offset

describe("deck fixture: 20 ft × 12 ft, boards parallel to house, 6 in effective width", () => {
  it("Product A (20 ft boards @ $60): 24 boards, $1,440", () => {
    const t = computeTakeoff(fixture, productA);
    expect(t.analysis.decking).toMatchObject({ rows: 24, piecesPerRow: 1, totalPieces: 24 });
    expect(t.lineItems[0]!.quantity).toBe(24);
    expect(t.subtotalCents).toBe(144_000);
    expect(t.scopeLabel).toBe("Draft · Decking materials only");
  });

  it("Product B (10 ft boards @ $34): 48 boards, $1,632", () => {
    const t = computeTakeoff(fixture, productB);
    expect(t.analysis.decking).toMatchObject({ rows: 24, piecesPerRow: 2, totalPieces: 48 });
    expect(t.subtotalCents).toBe(163_200);
  });

  it("Product B at 13 ft depth: 52 boards, $1,768", () => {
    const t = computeTakeoff({ ...fixture, depthIn: 13 * 12 }, productB);
    expect(t.analysis.decking!.totalPieces).toBe(52);
    expect(t.subtotalCents).toBe(176_800);
  });

  it("stair offset 7 ft: outer-edge segments 7 ft each, open perimeter 38 ft", () => {
    const a = analyzeDeck({ ...fixture, stair: { ...fixture.stair, offsetIn: 7 * 12 } }, null);
    expect(a.valid).toBe(true);
    expect(a.outerEdge).toEqual({ leftSegmentIn: 84, stairOpeningIn: 72, rightSegmentIn: 84 });
    expect(a.openPerimeterIn).toBe(38 * 12);
  });

  it("original fixture (4 ft offset) has 4 ft and 10 ft remaining segments", () => {
    const a = analyzeDeck(fixture, null);
    expect(a.outerEdge).toEqual({ leftSegmentIn: 48, stairOpeningIn: 72, rightSegmentIn: 120 });
    expect(a.openPerimeterIn).toBe(38 * 12);
  });

  it("16 ft offset with a 6 ft opening exceeds the edge: validation error, export blocked", () => {
    const bad = { ...fixture, stair: { widthIn: 72, offsetIn: 16 * 12 } };
    const issues = validateDeckDesign(bad);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.field).toBe("stair.offsetIn");
    expect(issues[0]!.message).toMatch(/2 ft past the right corner/);
    expect(analyzeDeck(bad, productA).valid).toBe(false);
    expect(() => computeTakeoff(bad, productA)).toThrow(ValidationError);
  });

  it("partial rows and partial pieces round up", () => {
    const spec: DeckingProductSpec = { ...productA, effectiveWidthIn: 5, stockLengthIn: 192 };
    const a = analyzeDeck({ ...fixture, widthIn: 193, depthIn: 101 }, spec);
    expect(a.decking).toMatchObject({ rows: 21, piecesPerRow: 2, totalPieces: 42 });
  });

  it("stair schematic derives risers from height", () => {
    const a = analyzeDeck(fixture, null);
    expect(a.stairSchematic.risers).toBe(6); // 48 / 8.25 (Fairfax max riser) → 5.8 → 6
    expect(a.stairSchematic.riserHeightIn).toBe(8);
    expect(a.stairSchematic.treads).toBe(5);
    expect(a.stairSchematic.totalRunIn).toBe(50);
  });

  it("CSV export contains the scope label, quantities and totals, with quoting", () => {
    const t = computeTakeoff(fixture, { ...productB, name: 'Board "Pro", 10 ft' });
    const csv = takeoffToCsv({ scopeLabel: t.scopeLabel, title: "Chen deck", revisionNumber: 1, lineItems: t.lineItems, subtotalCents: t.subtotalCents });
    expect(csv).toContain("Scope,Draft · Decking materials only");
    expect(csv).toContain('"Test Board ""Pro"", 10 ft — 10 ft board"');
    expect(csv).toContain(",48,each,34.00,1632.00,");
    expect(csv).toContain("Subtotal,1632.00");
  });
});
