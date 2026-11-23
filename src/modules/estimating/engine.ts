import type { CompanySettings } from "@/db/schema";
import { analyzeDeck, type DeckDesignModel } from "@/modules/design/model";
import { ValidationError } from "@/modules/core/errors";
import type { FramingResult } from "@/modules/framing/generate";
import { ACTUAL_DEPTH_IN } from "@/modules/framing/rules/fairfax-2021";
import type { PriceBook } from "./pricing";
import type { PricedProduct } from "./takeoff";

/**
 * Estimating engine: design + framing + manufacturer product + company price book + settings → a
 * sectioned estimate with totals. Pure; the service snapshots its output into a revision.
 *
 * Money is integer cents. Quantities are rounded up to whole purchasable units (boards, pieces,
 * bags). Lumber is priced per linear foot of stock, rounded up to 2 ft stock increments per piece.
 */

export const FULL_SCOPE_LABEL = "Estimate · Decking, framing, footings, stairs, guards and labor";

export interface EstimateLine {
  key: string;
  description: string;
  sku?: string;
  qty: number;
  unit: string;
  unitPriceCents: number;
  totalCents: number;
  /** false when the price book has no entry: the line is shown at $0 and the estimate is flagged. */
  priced: boolean;
  detail?: string;
  source: "catalog" | "price-book";
}

export interface EstimateSection {
  key: "decking" | "framing" | "hardware" | "footings" | "stairs" | "guards" | "labor";
  title: string;
  lines: EstimateLine[];
  subtotalCents: number;
}

export interface EstimateSettings {
  wastePct: number;
  markupPct: number;
  materialTaxPct: number;
}

export interface EstimateBuild {
  scopeLabel: string;
  settings: EstimateSettings;
  sections: EstimateSection[];
  warnings: string[];
  deckAreaSqFt: number;
  materialsCents: number;
  laborCents: number;
  markupCents: number;
  taxCents: number;
  totalCents: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
/** Round a piece length up to a 2 ft stock increment, minimum 8 ft. */
const stockFt = (inches: number) => Math.max(8, Math.ceil(inches / 24) * 2);

export function buildEstimate(input: { model: DeckDesignModel; product: PricedProduct; framing: FramingResult; priceBook: PriceBook; settings: CompanySettings }): EstimateBuild {
  const { model, product, framing, priceBook } = input;
  const settings: EstimateSettings = { wastePct: input.settings.wastePct, markupPct: input.settings.markupPct, materialTaxPct: input.settings.materialTaxPct };
  const warnings: string[] = [];
  const analysis = analyzeDeck(model, product);
  if (!analysis.valid) throw new ValidationError("Design has validation errors; fix them before estimating.", analysis.issues.map((i) => i.message));
  if (!framing.ok) throw new ValidationError("Framing is not permitted by the typical details; fix the blocking issues before estimating.", framing.issues.filter((i) => i.severity === "error").map((i) => i.message));
  if (product.unitPriceCents === null) warnings.push(`No company price for ${product.manufacturer} ${product.name} (${product.sku}); decking priced at $0.`);

  const W = model.widthIn;
  const D = model.depthIn;
  const deckAreaSqFt = r2((W * D) / 144);
  const waste = 1 + settings.wastePct / 100;

  const line = (key: string, qty: number, description?: string, detail?: string): EstimateLine => {
    const pb = priceBook.get(key);
    if (!pb) warnings.push(`Price book has no entry for "${key}"${description ? ` (${description})` : ""}.`);
    const unitPriceCents = pb?.unitPriceCents ?? 0;
    return { key, description: description ?? pb?.description ?? key, qty, unit: pb?.unit ?? "each", unitPriceCents, totalCents: Math.round(qty * unitPriceCents), priced: !!pb, detail, source: "price-book" };
  };
  const lumber = (size: keyof typeof ACTUAL_DEPTH_IN | "4x4" | "6x6" | "2x4", pieces: number, pieceLengthIn: number, what: string): EstimateLine => {
    const perPieceFt = stockFt(pieceLengthIn);
    return line(`lumber.pt.${size}`, pieces * perPieceFt, `${size} PT — ${what}`, `${pieces} × ${perPieceFt}' stock (${(pieceLengthIn / 12).toFixed(2)}' each)`);
  };

  /* ---- Decking ---- */
  const d = analysis.decking!;
  const boardsNet = d.totalPieces;
  const boardsGross = Math.ceil(boardsNet * waste);
  const piecesPerBoardForTreads = Math.max(1, Math.floor(product.stockLengthIn / model.stair.widthIn));
  const treadBoardsNet = Math.ceil((framing.stair.treads * 2) / piecesPerBoardForTreads);
  const treadBoardsGross = Math.ceil(treadBoardsNet * waste);
  const unit = product.unitPriceCents ?? 0;
  const decking: EstimateSection = {
    key: "decking",
    title: "Decking",
    lines: [
      {
        key: "catalog.decking",
        description: `${product.manufacturer} ${product.name}`,
        sku: product.sku,
        qty: boardsGross,
        unit: "each",
        unitPriceCents: unit,
        totalCents: boardsGross * unit,
        priced: product.unitPriceCents !== null,
        detail: `${d.rows} rows × ${d.piecesPerRow} piece(s) per ${(d.rowLengthIn / 12).toFixed(2)}' row = ${boardsNet} boards + ${settings.wastePct}% waste · ${d.effectiveWidthIn}" installed width`,
        source: "catalog",
      },
      {
        key: "catalog.decking.treads",
        description: `Stair treads — same decking, 2 boards per tread`,
        sku: product.sku,
        qty: treadBoardsGross,
        unit: "each",
        unitPriceCents: unit,
        totalCents: treadBoardsGross * unit,
        priced: product.unitPriceCents !== null,
        detail: `${framing.stair.treads} treads × 2 boards × ${(model.stair.widthIn / 12).toFixed(2)}' = ${treadBoardsNet} stock boards + waste`,
        source: "catalog",
      },
      line(product.installation?.hiddenFastenerSystems.length && product.profile === "grooved" ? "fastener.hidden-clip-sqft" : "fastener.deck-screw-sqft", Math.ceil(deckAreaSqFt), undefined, product.profile === "grooved" ? `Hidden fasteners (${product.installation?.hiddenFastenerSystems[0] ?? "manufacturer system"})` : "Face-screwed"),
    ],
    subtotalCents: 0,
  };

  /* ---- Framing lumber ---- */
  const j = framing.joists;
  const b = framing.beam;
  const p = framing.posts;
  const framingLines: EstimateLine[] = [
    lumber(framing.ledger.size, 1, framing.ledger.lengthIn, "ledger"),
    lumber(j.size, j.positionsIn.length, j.lengthIn, `joists @ ${j.spacingIn}" o.c.`),
    ...(j.rimJoist ? [lumber(j.rimJoist.size, 1, j.rimJoist.lengthIn, "rim joist")] : []),
    lumber(b.size, b.plies, b.lengthIn, `(${b.plies})${b.size} ${b.type} beam`),
    lumber(p.size, p.count, p.heightIn + 6, `${p.size} posts (6" trim allowance)`),
    ...(j.blockingOverBeam ? [lumber(j.size, j.positionsIn.length - 1, j.spacingIn, "blocking over beam")] : []),
    ...(framing.posts.lateral.methods.includes("method-2-knee-bracing-at-beam") ? [lumber("2x6", p.count * 2, 43, "knee braces")] : []),
    line("fastener.framing-lot", 1, undefined, "nails, screws, hanger nails"),
  ];

  /* ---- Hardware ---- */
  const hardware: EstimateLine[] = [
    line("hardware.joist-hanger", framing.ledger.hangerCount * (b.type === "flush" ? 2 : 1), undefined, `≥ ${framing.ledger.hangerMinDepthIn.toFixed(2)}" deep`),
    ...(b.type === "dropped" ? [line("hardware.hurricane-tie", j.positionsIn.length)] : []),
    ...(framing.ledger.approxFastenerCount ? [line("hardware.ledger-fastener", framing.ledger.approxFastenerCount, undefined, `${framing.ledger.fastenerLabel} @ ${framing.ledger.spacingIn}" o.c. staggered (approx.)`)] : []),
    line("hardware.flashing-lf", Math.ceil(W / 12)),
    line("hardware.post-base", p.count),
    ...(p.size === "4x4" || b.plies === 3 ? [line("hardware.post-cap", p.count)] : [line("hardware.through-bolt", p.count * 2, undefined, "notched 6x6, (2) ½\" bolts per post")]),
    ...(framing.posts.lateral.methods.includes("method-1-tension-ties") ? [line("hardware.tension-tie", 4)] : []),
    ...(framing.guards.required ? [line("hardware.hold-down", framing.guards.posts.length, undefined, "guard posts")] : []),
    line("hardware.stringer-hanger", framing.stair.stringerCount),
  ];

  /* ---- Footings ---- */
  const ftg = framing.footings;
  const stemDiaIn = 12;
  const stemHeightIn = Math.max(0, ftg.depthBelowGradeIn - (ftg.thicknessIn ?? 8));
  const padVol = ftg.roundIn ? Math.PI * (ftg.roundIn / 2) ** 2 * (ftg.thicknessIn ?? 8) : 0;
  const stemVol = Math.PI * (stemDiaIn / 2) ** 2 * stemHeightIn;
  const stairFootVol = Math.PI * 5 ** 2 * 12; // 10" round × 12" deep per stringer bearing
  const cubicFt = (ftg.count * (padVol + stemVol) + framing.stair.stringerCount * stairFootVol) / 1728;
  const bags = Math.ceil(cubicFt / 0.6);
  const footings: EstimateLine[] = [line("concrete.80lb-bag", bags, undefined, `${ftg.count} × type ${ftg.type ?? "?"} (${ftg.roundIn}" rd × ${ftg.thicknessIn}" + 12" stem) + ${framing.stair.stringerCount} stair footings ≈ ${cubicFt.toFixed(1)} ft³`)];

  /* ---- Stairs ---- */
  const s = framing.stair;
  const stringerLenIn = Math.hypot(s.horizontalSpanIn, s.totalRiseIn) + 12;
  const stairs: EstimateLine[] = [
    lumber("2x12", s.stringerCount, stringerLenIn, `${s.stringerType} stringers`),
    ...(product.installation && product.installation.notes.some((n) => /veneer|2x4 treated|2 x 4/i.test(n)) ? [lumber("2x4", s.treads, model.stair.widthIn, "tread supports (manufacturer requirement)")] : []),
    line("riser.board-lf", Math.ceil((s.risers * model.stair.widthIn) / 12), undefined, `${s.risers} risers × ${(model.stair.widthIn / 12).toFixed(2)}'`),
  ];

  /* ---- Guards ---- */
  const guardLf = framing.guards.required ? Math.ceil(analysis.openPerimeterIn / 12) : 0;
  const stairGuardLf = s.guardRequired ? Math.ceil((stringerLenIn * 2) / 12) : 0;
  const guards: EstimateLine[] = [
    ...(guardLf ? [line("railing.guard-lf", guardLf, undefined, `${framing.guards.posts.length} posts; open perimeter`)] : []),
    ...(stairGuardLf ? [line("railing.stair-guard-lf", stairGuardLf, undefined, "both sides of stair")] : []),
  ];

  /* ---- Labor ---- */
  const labor: EstimateLine[] = [
    line("labor.deck-sqft", Math.ceil(deckAreaSqFt)),
    line("labor.ledger-lf", Math.ceil(W / 12)),
    line("labor.footing-each", ftg.count + s.stringerCount, undefined, "beam footings + stair footings"),
    line("labor.stair-riser", s.risers),
    ...(guardLf + stairGuardLf ? [line("labor.guard-lf", guardLf + stairGuardLf)] : []),
  ];

  const all: EstimateSection[] = [
    decking,
    { key: "framing", title: "Framing lumber", lines: framingLines, subtotalCents: 0 },
    { key: "hardware", title: "Hardware & fasteners", lines: hardware, subtotalCents: 0 },
    { key: "footings", title: "Footings", lines: footings, subtotalCents: 0 },
    { key: "stairs", title: "Stairs", lines: stairs, subtotalCents: 0 },
    { key: "guards", title: "Guards & railing", lines: guards, subtotalCents: 0 },
    { key: "labor", title: "Labor", lines: labor, subtotalCents: 0 },
  ];
  const sections = all.filter((sec) => sec.lines.length > 0);
  for (const sec of sections) sec.subtotalCents = sec.lines.reduce((a, l) => a + l.totalCents, 0);

  const materialsCents = sections.filter((x) => x.key !== "labor").reduce((a, x) => a + x.subtotalCents, 0);
  const laborCents = sections.find((x) => x.key === "labor")?.subtotalCents ?? 0;
  const markupCents = Math.round(((materialsCents + laborCents) * settings.markupPct) / 100);
  const taxCents = Math.round((materialsCents * settings.materialTaxPct) / 100);
  const totalCents = materialsCents + laborCents + markupCents + taxCents;

  return { scopeLabel: FULL_SCOPE_LABEL, settings, sections, warnings: [...new Set(warnings)], deckAreaSqFt, materialsCents, laborCents, markupCents, taxCents, totalCents };
}

export function estimateToCsv(input: { title: string; revisionNumber: number; build: Pick<EstimateBuild, "scopeLabel" | "sections" | "materialsCents" | "laborCents" | "markupCents" | "taxCents" | "totalCents" | "settings"> }): string {
  const cell = (v: string | number) => {
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  const money = (c: number) => (c / 100).toFixed(2);
  const rows: (string | number)[][] = [["Estimate", input.title], ["Revision", input.revisionNumber], ["Scope", input.build.scopeLabel], [], ["Section", "Item", "SKU", "Qty", "Unit", "Unit price", "Total", "Priced", "Detail"]];
  for (const sec of input.build.sections) {
    for (const l of sec.lines) rows.push([sec.title, l.description, l.sku ?? "", l.qty, l.unit, money(l.unitPriceCents), money(l.totalCents), l.priced ? "yes" : "NO PRICE", l.detail ?? ""]);
    rows.push([sec.title, "Subtotal", "", "", "", "", money(sec.subtotalCents), "", ""]);
  }
  rows.push([], ["", "Materials", "", "", "", "", money(input.build.materialsCents)], ["", "Labor", "", "", "", "", money(input.build.laborCents)], ["", `Markup ${input.build.settings.markupPct}%`, "", "", "", "", money(input.build.markupCents)], ["", `Material tax ${input.build.settings.materialTaxPct}%`, "", "", "", "", money(input.build.taxCents)], ["", "Total", "", "", "", "", money(input.build.totalCents)]);
  return rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
