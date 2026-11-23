/**
 * Seeds two fictional workspaces with demo users, stages, catalog products, prices and sample CRM data.
 * Safe to re-run: existing rows are reused by slug/email/sku.
 */
import { closeDb, getDb } from "@/db/client";
import { seedAll } from "@/db/seed";

const password = process.env.SEED_DEMO_PASSWORD;
if (!password || password.startsWith("REPLACE")) {
  console.error("Set SEED_DEMO_PASSWORD in .env before seeding.");
  process.exit(1);
}
const result = await seedAll(getDb(), { password });
console.log("Seeded workspaces:");
for (const w of result.workspaces) {
  console.log(`  ${w.name} (/c/${w.slug})`);
  for (const u of w.users) console.log(`    ${u.role.padEnd(12)} ${u.email}`);
}
console.log(`Demo password: (SEED_DEMO_PASSWORD from .env)`);
await closeDb();
