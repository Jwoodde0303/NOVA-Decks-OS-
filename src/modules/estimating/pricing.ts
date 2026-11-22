import { and, desc, eq, lte } from "drizzle-orm";
import { catalogProducts, companyProductPrices, suppliers } from "@/db/schema";
import type { CompanyContext } from "@/modules/core/context";
import { NotFoundError } from "@/modules/core/errors";
import type { PricedProduct } from "./takeoff";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Current company price for a catalog product: the latest effective price on or before `asOf`. */
export async function getPricedProduct(
  ctx: CompanyContext,
  catalogProductId: string,
  asOf: string = today(),
): Promise<PricedProduct> {
  const [row] = await ctx.db
    .select({
      product: catalogProducts,
      price: companyProductPrices,
      supplierName: suppliers.name,
    })
    .from(catalogProducts)
    .innerJoin(
      companyProductPrices,
      and(
        eq(companyProductPrices.catalogProductId, catalogProducts.id),
        eq(companyProductPrices.companyId, ctx.companyId),
        lte(companyProductPrices.effectiveOn, asOf),
      ),
    )
    .leftJoin(suppliers, and(eq(suppliers.id, companyProductPrices.supplierId), eq(suppliers.companyId, ctx.companyId)))
    .where(eq(catalogProducts.id, catalogProductId))
    .orderBy(desc(companyProductPrices.effectiveOn), desc(companyProductPrices.createdAt))
    .limit(1);
  if (!row) throw new NotFoundError("Priced product");
  return {
    id: row.product.id,
    name: row.product.name,
    sku: row.product.sku,
    manufacturer: row.product.manufacturer,
    stockLengthIn: row.product.stockLengthIn,
    effectiveWidthIn: row.product.effectiveWidthIn,
    unitPriceCents: row.price.unitPriceCents,
    priceSource: row.price.source,
    priceEffectiveOn: row.price.effectiveOn,
    supplierName: row.supplierName,
  };
}

/** Decking products this company has a price for, with the current price. */
export async function listPricedDeckingProducts(ctx: CompanyContext, asOf: string = today()): Promise<PricedProduct[]> {
  ctx.require("crm.read");
  const products = await ctx.db
    .select()
    .from(catalogProducts)
    .where(eq(catalogProducts.category, "decking"))
    .orderBy(catalogProducts.manufacturer, catalogProducts.name);
  const priced: PricedProduct[] = [];
  for (const p of products) {
    try {
      priced.push(await getPricedProduct(ctx, p.id, asOf));
    } catch (e) {
      if (!(e instanceof NotFoundError)) throw e;
    }
  }
  return priced;
}

export async function setProductPrice(
  ctx: CompanyContext,
  input: { catalogProductId: string; unitPriceCents: number; source: string; effectiveOn: string; supplierId?: string | null },
) {
  ctx.require("pricing.manage");
  const [row] = await ctx.db
    .insert(companyProductPrices)
    .values({
      companyId: ctx.companyId,
      catalogProductId: input.catalogProductId,
      unitPriceCents: input.unitPriceCents,
      source: input.source,
      effectiveOn: input.effectiveOn,
      supplierId: input.supplierId ?? null,
      createdBy: ctx.userId,
    })
    .returning();
  return row!;
}
