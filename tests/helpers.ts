import { inject } from "vitest";
import { sql } from "drizzle-orm";
import { closeDb, getDb, type Db } from "@/db/client";
import { buildCompanyContext } from "@/modules/core/context";
import { SEED_WORKSPACES, seedAll } from "@/db/seed";

export const TEST_PASSWORD = "correct-horse-battery";

/** Fresh database state + both seeded workspaces (no sample CRM rows). */
export async function freshSeededDb(): Promise<Db> {
  process.env.DATABASE_URL = inject("databaseUrl");
  const db = getDb();
  await db.execute(sql`
    truncate table estimate_revisions, estimates, deck_designs, activities, tasks, jobs, opportunities,
      customer_addresses, customer_contacts, customers, company_product_prices, suppliers, pipeline_stages,
      memberships, companies, catalog_products, session, account, verification, "user" restart identity cascade
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

export async function stageId(db: Db, companyId: string, name: string) {
  const r = await db.execute<{ id: string }>(sql`select id from pipeline_stages where company_id = ${companyId} and name = ${name}`);
  return r.rows[0]!.id;
}

export async function productId(db: Db, sku: string) {
  const r = await db.execute<{ id: string }>(sql`select id from catalog_products where sku = ${sku}`);
  return r.rows[0]!.id;
}

export { closeDb };
