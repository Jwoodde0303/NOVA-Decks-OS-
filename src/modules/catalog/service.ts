import { and, asc, eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { catalogProducts } from "@/db/schema";
import { allCatalogRows, type InstallationRules } from "@/db/catalog";
import type { CompanyContext } from "@/modules/core/context";
import { NotFoundError } from "@/modules/core/errors";

export type CatalogProduct = Omit<typeof catalogProducts.$inferSelect, "installation"> & { installation: InstallationRules };

export function parseInstallation(raw: Record<string, unknown>): InstallationRules | null {
  return raw && typeof raw.maxJoistSpacingPerpendicularIn === "number" ? (raw as unknown as InstallationRules) : null;
}

/** Upsert every catalog row (by manufacturer + sku). Idempotent; safe to re-run after data updates. */
export async function syncCatalog(db: Db) {
  const rows = allCatalogRows();
  let inserted = 0;
  for (const r of rows) {
    const res = await db
      .insert(catalogProducts)
      .values({ ...r, installation: r.installation as unknown as Record<string, unknown> })
      .onConflictDoUpdate({
        target: [catalogProducts.manufacturer, catalogProducts.sku],
        set: {
          productLine: r.productLine,
          name: r.name,
          color: r.color,
          colorHex: r.colorHex,
          profile: r.profile,
          material: r.material,
          thicknessIn: r.thicknessIn,
          widthActualIn: r.widthActualIn,
          stockLengthIn: r.stockLengthIn,
          effectiveWidthIn: r.effectiveWidthIn,
          installation: r.installation as unknown as Record<string, unknown>,
          attributes: r.attributes,
          dataSource: r.dataSource,
          dataEffectiveOn: r.dataEffectiveOn,
          active: true,
        },
      })
      .returning({ id: catalogProducts.id, createdAt: catalogProducts.createdAt });
    if (res[0] && Date.now() - res[0].createdAt.getTime() < 5000) inserted++;
  }
  return { total: rows.length, inserted };
}

export async function getCatalogProduct(ctx: CompanyContext, id: string): Promise<CatalogProduct> {
  ctx.require("projects.read");
  const [p] = await ctx.db.select().from(catalogProducts).where(and(eq(catalogProducts.id, id), eq(catalogProducts.active, true))).limit(1);
  if (!p) throw new NotFoundError("Catalog product");
  return { ...p, installation: parseInstallation(p.installation)! };
}

/** The whole active decking catalog, slimmed for the picker. */
export async function listDeckingCatalog(ctx: CompanyContext) {
  ctx.require("projects.read");
  return ctx.db
    .select({
      id: catalogProducts.id,
      manufacturer: catalogProducts.manufacturer,
      productLine: catalogProducts.productLine,
      color: catalogProducts.color,
      colorHex: catalogProducts.colorHex,
      profile: catalogProducts.profile,
      material: catalogProducts.material,
      thicknessIn: catalogProducts.thicknessIn,
      widthActualIn: catalogProducts.widthActualIn,
      stockLengthIn: catalogProducts.stockLengthIn,
      effectiveWidthIn: catalogProducts.effectiveWidthIn,
      sku: catalogProducts.sku,
      name: catalogProducts.name,
      verified: catalogProducts.verified,
    })
    .from(catalogProducts)
    .where(and(eq(catalogProducts.category, "decking"), eq(catalogProducts.active, true)))
    .orderBy(asc(catalogProducts.manufacturer), asc(catalogProducts.productLine), asc(catalogProducts.color), asc(catalogProducts.profile), asc(catalogProducts.widthActualIn), asc(catalogProducts.stockLengthIn));
}

/** Manufacturer → line summary with installation rules (one row per line). */
export async function listCatalogLines(ctx: CompanyContext) {
  ctx.require("projects.read");
  const rows = await ctx.db
    .select({
      manufacturer: catalogProducts.manufacturer,
      productLine: catalogProducts.productLine,
      material: catalogProducts.material,
      colors: sql<string>`string_agg(distinct ${catalogProducts.color}, ', ' order by ${catalogProducts.color})`,
      skus: sql<number>`count(*)`.mapWith(Number),
      verified: sql<number>`sum(case when ${catalogProducts.verified} then 1 else 0 end)`.mapWith(Number),
      installation: sql<Record<string, unknown>>`min(${catalogProducts.installation}::text)::jsonb`,
      dataSource: sql<string>`min(${catalogProducts.dataSource})`,
      attributes: sql<Record<string, unknown>>`min(${catalogProducts.attributes}::text)::jsonb`,
    })
    .from(catalogProducts)
    .where(and(eq(catalogProducts.category, "decking"), eq(catalogProducts.active, true)))
    .groupBy(catalogProducts.manufacturer, catalogProducts.productLine, catalogProducts.material)
    .orderBy(asc(catalogProducts.manufacturer), asc(catalogProducts.productLine));
  return rows.map((r) => ({ ...r, installation: parseInstallation(r.installation) }));
}
