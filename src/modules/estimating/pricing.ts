import { and, desc, eq, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { catalogProducts, companyProductPrices, priceBookItems, suppliers, PRICE_BOOK_CATEGORIES, PRICE_UNITS, type PriceUnit } from "@/db/schema";
import { parseInstallation } from "@/modules/catalog/service";
import type { CompanyContext } from "@/modules/core/context";
import { NotFoundError } from "@/modules/core/errors";
import type { PricedProduct } from "./takeoff";

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/* --------------------------- catalog product prices ------------------------ */

/** A catalog product with the company's current price (latest effective on/before `asOf`), or null price. */
export async function getPricedProduct(ctx: CompanyContext, catalogProductId: string, asOf: string = today()): Promise<PricedProduct> {
  ctx.require("projects.read");
  const [p] = await ctx.db.select().from(catalogProducts).where(and(eq(catalogProducts.id, catalogProductId), eq(catalogProducts.active, true))).limit(1);
  if (!p) throw new NotFoundError("Catalog product");
  const [price] = await ctx.db
    .select({ price: companyProductPrices, supplierName: suppliers.name })
    .from(companyProductPrices)
    .leftJoin(suppliers, and(eq(suppliers.id, companyProductPrices.supplierId), eq(suppliers.companyId, ctx.companyId)))
    .where(and(eq(companyProductPrices.companyId, ctx.companyId), eq(companyProductPrices.catalogProductId, catalogProductId), lte(companyProductPrices.effectiveOn, asOf)))
    .orderBy(desc(companyProductPrices.effectiveOn), desc(companyProductPrices.createdAt))
    .limit(1);
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    manufacturer: p.manufacturer,
    productLine: p.productLine,
    color: p.color,
    colorHex: p.colorHex,
    profile: p.profile,
    stockLengthIn: p.stockLengthIn,
    effectiveWidthIn: p.effectiveWidthIn,
    widthActualIn: p.widthActualIn,
    thicknessIn: p.thicknessIn,
    installation: parseInstallation(p.installation),
    unitPriceCents: price?.price.unitPriceCents ?? null,
    priceSource: price?.price.source ?? null,
    priceEffectiveOn: price?.price.effectiveOn ?? null,
    supplierName: price?.supplierName ?? null,
  };
}

/** Current price per catalog product for this company (map productId → price row). */
export async function currentProductPrices(ctx: CompanyContext, asOf: string = today()) {
  ctx.require("projects.read");
  const rows = await ctx.db
    .select({ catalogProductId: companyProductPrices.catalogProductId, unitPriceCents: companyProductPrices.unitPriceCents, effectiveOn: companyProductPrices.effectiveOn, source: companyProductPrices.source })
    .from(companyProductPrices)
    .where(and(eq(companyProductPrices.companyId, ctx.companyId), lte(companyProductPrices.effectiveOn, asOf)))
    .orderBy(desc(companyProductPrices.effectiveOn), desc(companyProductPrices.createdAt));
  const map = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!map.has(r.catalogProductId)) map.set(r.catalogProductId, r);
  return map;
}

export const productPriceInput = z.object({
  catalogProductId: z.string().uuid(),
  unitPriceCents: z.number().int().nonnegative(),
  source: z.string().trim().min(1).max(200),
  effectiveOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  supplierId: z.string().uuid().optional().nullable(),
});

export async function setProductPrice(ctx: CompanyContext, raw: unknown) {
  ctx.require("pricing.manage");
  const input = productPriceInput.parse(raw);
  const [row] = await ctx.db
    .insert(companyProductPrices)
    .values({ companyId: ctx.companyId, ...input, supplierId: input.supplierId ?? null, createdBy: ctx.userId })
    .returning();
  return row!;
}

/* -------------------------------- price book ------------------------------- */

export interface PriceBookEntry {
  key: string;
  category: (typeof PRICE_BOOK_CATEGORIES)[number];
  description: string;
  unit: PriceUnit;
  unitPriceCents: number;
  effectiveOn: string;
  source: string;
}
export type PriceBook = Map<string, PriceBookEntry>;

/**
 * Every item the estimating engine may ask for, with the unit it expects. Companies price these in
 * their price book; seeded defaults are fictional. Keys are stable identifiers.
 */
export const PRICE_BOOK_CATALOG: { key: string; category: PriceBookEntry["category"]; description: string; unit: PriceUnit }[] = [
  { key: "lumber.pt.2x6", category: "lumber", description: "2x6 pressure-treated SYP #2 (ground-contact where required)", unit: "lf" },
  { key: "lumber.pt.2x8", category: "lumber", description: "2x8 pressure-treated SYP #2", unit: "lf" },
  { key: "lumber.pt.2x10", category: "lumber", description: "2x10 pressure-treated SYP #2", unit: "lf" },
  { key: "lumber.pt.2x12", category: "lumber", description: "2x12 pressure-treated SYP #2 (beams, stringers)", unit: "lf" },
  { key: "lumber.pt.4x4", category: "lumber", description: "4x4 pressure-treated post (ground-contact)", unit: "lf" },
  { key: "lumber.pt.6x6", category: "lumber", description: "6x6 pressure-treated post (ground-contact)", unit: "lf" },
  { key: "lumber.pt.2x4", category: "lumber", description: "2x4 pressure-treated (tread supports, kick plates)", unit: "lf" },
  { key: "hardware.joist-hanger", category: "hardware", description: "Joist hanger, G-185 galvanized, with manufacturer screws", unit: "each" },
  { key: "hardware.hurricane-tie", category: "hardware", description: "Hurricane tie / joist-to-beam connector (100 lb)", unit: "each" },
  { key: "hardware.ledger-fastener", category: "hardware", description: "Ledger fastener (½\" lag/bolt or listed structural screw) with washer", unit: "each" },
  { key: "hardware.tension-tie", category: "hardware", description: "Tension tie (DTT1Z / LTS, 750 lb min) with fasteners", unit: "each" },
  { key: "hardware.post-base", category: "hardware", description: "Post base with 1\" standoff + anchor", unit: "each" },
  { key: "hardware.post-cap", category: "hardware", description: "Post cap for 2- or 3-ply beam", unit: "each" },
  { key: "hardware.through-bolt", category: "hardware", description: "½\" galvanized through-bolt with nut and washers", unit: "each" },
  { key: "hardware.hold-down", category: "hardware", description: "Guard post hold-down anchor (1,800 lb) with fasteners", unit: "each" },
  { key: "hardware.stringer-hanger", category: "hardware", description: "Sloped stair stringer hanger", unit: "each" },
  { key: "hardware.flashing-lf", category: "hardware", description: "Ledger flashing (G-185, stainless or copper)", unit: "lf" },
  { key: "fastener.hidden-clip-sqft", category: "fastener", description: "Hidden deck fastener clips + screws, per square foot of decking", unit: "sqft" },
  { key: "fastener.deck-screw-sqft", category: "fastener", description: "Colour-matched composite deck screws, per square foot of decking", unit: "sqft" },
  { key: "fastener.framing-lot", category: "fastener", description: "Framing nails/screws, hanger nails, blocking fasteners (per deck)", unit: "each" },
  { key: "concrete.80lb-bag", category: "concrete", description: "80 lb concrete mix, 3,000 PSI", unit: "bag" },
  { key: "railing.guard-lf", category: "railing", description: "Deck guard system (posts, rails, balusters, cap), installed material cost", unit: "lf" },
  { key: "railing.stair-guard-lf", category: "railing", description: "Stair guard/handrail system, material cost", unit: "lf" },
  { key: "riser.board-lf", category: "other", description: "Riser / fascia board (manufacturer riser or fascia)", unit: "lf" },
  { key: "labor.deck-sqft", category: "labor", description: "Labor: framing + decking per square foot of deck", unit: "sqft" },
  { key: "labor.ledger-lf", category: "labor", description: "Labor: ledger prep, flashing and attachment per linear foot", unit: "lf" },
  { key: "labor.footing-each", category: "labor", description: "Labor: dig, inspect and pour each footing", unit: "footing" },
  { key: "labor.stair-riser", category: "labor", description: "Labor: stairs per riser", unit: "riser" },
  { key: "labor.guard-lf", category: "labor", description: "Labor: guard install per linear foot", unit: "lf" },
];

/** Current price book (latest effective entry per key on/before asOf). */
export async function getPriceBook(ctx: CompanyContext, asOf: string = today()): Promise<PriceBook> {
  ctx.require("projects.read");
  const rows = await ctx.db
    .select()
    .from(priceBookItems)
    .where(and(eq(priceBookItems.companyId, ctx.companyId), lte(priceBookItems.effectiveOn, asOf)))
    .orderBy(desc(priceBookItems.effectiveOn), desc(priceBookItems.createdAt));
  const book: PriceBook = new Map();
  for (const r of rows) if (!book.has(r.key)) book.set(r.key, { key: r.key, category: r.category, description: r.description, unit: r.unit, unitPriceCents: r.unitPriceCents, effectiveOn: r.effectiveOn, source: r.source });
  return book;
}

export const priceBookInput = z.object({
  key: z.string().trim().min(1).max(100),
  category: z.enum(PRICE_BOOK_CATEGORIES),
  description: z.string().trim().min(1).max(300),
  unit: z.enum(PRICE_UNITS),
  unitPriceCents: z.number().int().nonnegative(),
  source: z.string().trim().min(1).max(200),
  effectiveOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function setPriceBookItem(ctx: CompanyContext, raw: unknown) {
  ctx.require("pricing.manage");
  const input = priceBookInput.parse(raw);
  const [row] = await ctx.db
    .insert(priceBookItems)
    .values({ companyId: ctx.companyId, ...input, createdBy: ctx.userId })
    .onConflictDoUpdate({ target: [priceBookItems.companyId, priceBookItems.key, priceBookItems.effectiveOn], set: { unitPriceCents: input.unitPriceCents, description: input.description, unit: input.unit, category: input.category, source: input.source, createdBy: ctx.userId } })
    .returning();
  return row!;
}

/** Count of price book keys priced vs. expected (for the pricing page). */
export async function priceBookCoverage(ctx: CompanyContext) {
  const book = await getPriceBook(ctx);
  const missing = PRICE_BOOK_CATALOG.filter((i) => !book.has(i.key)).map((i) => i.key);
  return { priced: PRICE_BOOK_CATALOG.length - missing.length, total: PRICE_BOOK_CATALOG.length, missing };
}

export const _sql = sql;
