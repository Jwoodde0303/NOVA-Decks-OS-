import { inject } from "vitest";
import { sql } from "drizzle-orm";
import { closeDb, getDb, getPool, type Db } from "@/db/client";
import { buildCompanyContext } from "@/modules/core/context";
import { SEED_WORKSPACES, seedAll } from "@/db/seed";

export const TEST_PASSWORD = "correct-horse-battery";

/** Fresh database state + both seeded workspaces, catalog and price books (no sample projects). */
export async function freshSeededDb(): Promise<Db> {
  process.env.DATABASE_URL = inject("databaseUrl");
  const db = getDb();
  await db.execute(sql`
    truncate table estimate_revisions, estimates, deck_designs, project_events, projects, integrations,
      price_book_items, company_product_prices, suppliers, memberships, companies, catalog_products,
      session, account, verification, "user" restart identity cascade
  `);
  await seedAll(db, { password: TEST_PASSWORD, sampleData: false });
  return db;
}

export async function ctxFor(db: Db, slug: "nova" | "blue-ridge", who: "owner" | "member" = "owner") {
  const w = SEED_WORKSPACES.find((x) => x.slug === slug)!;
  const email = who === "owner" ? w.users[0]!.email : w.users[1]!.email;
  const [u] = await db.execute<{ id: string }>(sql`select id from "user" where email = ${email}`).then((r) => r.rows);
  return buildCompanyContext(u!.id, slug, db);
}

export async function productId(db: Db, sku: string) {
  const r = await db.execute<{ id: string }>(sql`select id from catalog_products where sku = ${sku}`);
  if (!r.rows[0]) throw new Error(`No catalog product with sku ${sku}`);
  return r.rows[0].id;
}

export { closeDb, getPool };
