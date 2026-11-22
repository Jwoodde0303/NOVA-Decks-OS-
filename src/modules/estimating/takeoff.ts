import { analyzeDeck, type DeckAnalysis, type DeckDesignModel, type DeckingProductSpec } from "@/modules/design/model";
import { ValidationError } from "@/modules/core/errors";

export const DRAFT_SCOPE_LABEL = "Draft · Decking materials only";

export interface PricedProduct extends DeckingProductSpec {
  unitPriceCents: number;
  priceSource: string;
  priceEffectiveOn: string;
  supplierName: string | null;
}

export interface EstimateLineItem {
  code: string;
  description: string;
  sku: string;
  quantity: number;
  unit: "each";
  unitPriceCents: number;
  totalCents: number;
  detail: string;
}

export interface Takeoff {
  scopeLabel: string;
  analysis: DeckAnalysis;
  lineItems: EstimateLineItem[];
  subtotalCents: number;
}

/** Pure: design + priced product → line items. Throws ValidationError for an invalid design. */
export function computeTakeoff(model: DeckDesignModel, product: PricedProduct): Takeoff {
  const analysis = analyzeDeck(model, product);
  if (!analysis.valid) {
    throw new ValidationError(
      "Design has validation errors; fix them before estimating.",
      analysis.issues.map((i) => i.message),
    );
  }
  const d = analysis.decking!;
  const quantity = d.totalPieces;
  const totalCents = quantity * product.unitPriceCents;
  const lineItems: EstimateLineItem[] = [
    {
      code: "DECKING",
      description: `${product.manufacturer} ${product.name} — ${d.stockLengthIn / 12} ft board`,
      sku: product.sku,
      quantity,
      unit: "each",
      unitPriceCents: product.unitPriceCents,
      totalCents,
      detail: `${d.rows} rows × ${d.piecesPerRow} piece(s) per ${d.rowLengthIn / 12} ft row · ${d.effectiveWidthIn} in effective width · no waste factor`,
    },
  ];
  return { scopeLabel: DRAFT_SCOPE_LABEL, analysis, lineItems, subtotalCents: totalCents };
}

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function takeoffToCsv(input: {
  scopeLabel: string;
  title: string;
  revisionNumber: number;
  lineItems: EstimateLineItem[];
  subtotalCents: number;
}): string {
  const rows: (string | number)[][] = [
    ["Estimate", input.title],
    ["Revision", input.revisionNumber],
    ["Scope", input.scopeLabel],
    [],
    ["Code", "Description", "SKU", "Qty", "Unit", "Unit price", "Total", "Detail"],
    ...input.lineItems.map((l) => [
      l.code,
      l.description,
      l.sku,
      l.quantity,
      l.unit,
      (l.unitPriceCents / 100).toFixed(2),
      (l.totalCents / 100).toFixed(2),
      l.detail,
    ]),
    [],
    ["", "", "", "", "", "Subtotal", (input.subtotalCents / 100).toFixed(2), ""],
  ];
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
