import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { DEFAULT_DECK_DESIGN } from "@/modules/design/model";
import { analyzeDeck } from "@/modules/design/model";
import { generateFraming } from "@/modules/framing/generate";
import { allDrawings, framingPlanDrawing, sectionDrawing, stairSectionDrawing } from "@/modules/drawing/deck-drawings";
import { buildPlansetData } from "@/modules/planset/data";
import { PlansetDocument, PLANSET_DRAW_BOX, pdfText } from "@/modules/planset/pdf";
import type { PricedProduct } from "@/modules/estimating/takeoff";
import { TREX_LINES } from "@/db/catalog/trex";
import { ValidationError } from "@/modules/core/errors";

const trex = TREX_LINES.find((l) => l.line === "Transcend Tropicals")!;
const product: PricedProduct = {
  id: "p1",
  name: "Transcend Tropicals Spiced Rum 1x6 grooved 16'",
  sku: "SR010616TG01",
  manufacturer: "Trex",
  productLine: "Transcend Tropicals",
  color: "Spiced Rum",
  colorHex: "#7a4f33",
  profile: "grooved",
  stockLengthIn: 192,
  effectiveWidthIn: 5.688,
  widthActualIn: 5.5,
  thicknessIn: 0.94,
  installation: trex.installation,
  unitPriceCents: 7900,
  priceSource: "test",
  priceEffectiveOn: "2026-01-01",
  supplierName: null,
};
const model = { ...DEFAULT_DECK_DESIGN, deckingProductId: "p1" };
const inputs = { model, analysis: analyzeDeck(model, product), framing: generateFraming(model, product), product };
const texts = (d: { primitives: { kind: string; text?: string }[] }) => d.primitives.filter((p) => p.kind === "text").map((p) => p.text!);

describe("drawing generators", () => {
  it("framing plan carries the generated members and dimensions", () => {
    const d = framingPlanDrawing(inputs, PLANSET_DRAW_BOX);
    expect(d.scaleLabel).toMatch(/= 1'-0"/);
    const t = texts(d);
    expect(t).toContain("20'");
    expect(t).toContain("JOIST SPAN 11'");
    expect(t).toContain("OVERHANG 1'");
    expect(t.some((x) => x.includes("2x8 JOISTS @ 16\" O.C."))).toBe(true);
    expect(t.some((x) => x.includes("(2)2x12 DROPPED BEAM"))).toBe(true);
    expect(t.some((x) => x.includes("7 x 2x12 CUT STRINGERS"))).toBe(true);
    expect(d.primitives.filter((p) => p.kind === "circle" && p.dash).length).toBe(3); // footings
    expect(d.primitives.every((p) => (p.kind === "text" ? p.x >= 0 && p.x <= d.width : true))).toBe(true);
  });

  it("section and stair section carry footing, ledger and stair dimensions", () => {
    const s = texts(sectionDrawing(inputs, PLANSET_DRAW_BOX));
    expect(s.some((x) => x.includes("JOIST SPAN 11'"))).toBe(true);
    expect(s.some((x) => x.includes("24\" MIN"))).toBe(true);
    expect(s.some((x) => x.includes("2x8 LEDGER") && x.includes("15\" O.C."))).toBe(true);
    expect(s.some((x) => x.includes("TYPE E FOOTING 22\" RD"))).toBe(true);
    const st = texts(stairSectionDrawing(inputs, PLANSET_DRAW_BOX));
    expect(st.some((x) => x.includes("TOTAL RISE 4'") && x.includes("6 @ 8.00\""))).toBe(true);
    expect(st.some((x) => x.includes("TOTAL RUN 4' 2\""))).toBe(true);
    expect(st.some((x) => x.includes("7 - 2x12 CUT STRINGERS @ 12.0\" O.C."))).toBe(true);
  });

  it("every drawing stays inside its box", () => {
    for (const d of Object.values(allDrawings(inputs, PLANSET_DRAW_BOX))) {
      for (const p of d.primitives) {
        if (p.kind === "line") for (const v of [p.x1, p.x2]) expect(v).toBeGreaterThanOrEqual(-40);
        if (p.kind === "rect") expect(p.y + p.h).toBeLessThanOrEqual(d.height + 1);
      }
    }
  });
});

describe("planset", () => {
  it("builds nine sheets with the county worksheet and manufacturer notes, and renders a PDF", async () => {
    const data = buildPlansetData({
      company: { name: "NOVA Decks & Exteriors (demo)" },
      project: { projectNumber: "P-1001", name: "Chen residence — rear composite deck", clientName: "Avery & Morgan Chen", siteAddress: "123 Example Ln, Fairfax, VA, 00000", jurisdiction: "Fairfax County, VA" },
      designName: "Main deck",
      designVersion: 3,
      model,
      product,
      drawBox: PLANSET_DRAW_BOX,
      now: new Date("2026-11-22T12:00:00Z"),
    });
    expect(data.sheets.map((s) => s.no)).toEqual(["G-001", "G-002", "A-101", "S-101", "S-201", "S-301", "S-302", "S-401", "G-003"]);
    expect(data.framing.worksheet.find((w) => w.label === "Beam plies / size")!.value).toBe("(2)2x12");
    expect(data.notes.find((n) => n.title === "Decking (manufacturer)")!.items[0]).toContain("Trex Transcend Tropicals: joists 16\" o.c. max");
    expect(data.summary.lines.some((l) => l.startsWith("Manufacturer installation rules applied (Trex"))).toBe(true);

    const buf = await renderToBuffer(PlansetDocument({ data }));
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    const pages = (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    expect(pages).toBe(9);
    expect(buf.length).toBeGreaterThan(20_000);
  }, 60_000);

  it("refuses to build a planset for a design that fails validation or the typical details", () => {
    const bad = { ...model, stair: { widthIn: 72, offsetIn: 192 } };
    expect(() => buildPlansetData({ company: { name: "x" }, project: { projectNumber: "P-1", name: "x", clientName: null, siteAddress: "", jurisdiction: "" }, designName: "d", designVersion: 1, model: bad, product, drawBox: PLANSET_DRAW_BOX })).toThrow(ValidationError);
    const tall = { ...model, heightIn: 108 }; // stair run exceeds the cut-stringer span
    expect(() => buildPlansetData({ company: { name: "x" }, project: { projectNumber: "P-1", name: "x", clientName: null, siteAddress: "", jurisdiction: "" }, designName: "d", designVersion: 1, model: tall, product, drawBox: PLANSET_DRAW_BOX })).toThrow(/typical details/);
  });

  it("sanitises text for the built-in PDF fonts", () => {
    expect(pdfText('½" lag screws ≥ 4 · 2x8 — ¾"')).toBe('1/2" lag screws >= 4 - 2x8 - 3/4"');
  });
});
