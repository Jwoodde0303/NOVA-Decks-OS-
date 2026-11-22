import { and, eq } from "drizzle-orm";
import type { Db } from "./client";
import { account, catalogProducts, companies, companyProductPrices, memberships, pipelineStages, suppliers, user, type Role } from "./schema";
import { getAuth } from "@/lib/auth";
import { buildCompanyContext } from "@/modules/core/context";
import { addAddress, addContact, addTask, createCustomer, createOpportunity, addNote } from "@/modules/crm/service";
import { saveDesign } from "@/modules/design/service";
import { DEFAULT_DECK_DESIGN } from "@/modules/design/model";
import { createDraftRevision } from "@/modules/estimating/service";

export const SEED_STAGES = [
  { name: "New Inquiry", kind: "open" },
  { name: "Consultation Scheduled", kind: "open" },
  { name: "Estimating", kind: "open" },
  { name: "Proposal Sent", kind: "open" },
  { name: "Won", kind: "won" },
  { name: "Lost", kind: "lost" },
] as const;

/** Fictional manufacturer catalog. Prices are NOT here; they are company-specific. */
export const SEED_CATALOG = [
  { manufacturer: "Northline Composites", productLine: "Harbor", name: "Harbor Grey 20 ft", sku: "NL-HBR-GRY-20", stockLengthIn: 240, effectiveWidthIn: 6, dataSource: "fictional-seed" },
  { manufacturer: "Northline Composites", productLine: "Harbor", name: "Harbor Grey 10 ft", sku: "NL-HBR-GRY-10", stockLengthIn: 120, effectiveWidthIn: 6, dataSource: "fictional-seed" },
  { manufacturer: "Ridgewood Boards", productLine: "Cedar Tone", name: "Cedar Tone 16 ft", sku: "RW-CT-16", stockLengthIn: 192, effectiveWidthIn: 6, dataSource: "fictional-seed" },
];

export interface SeedWorkspace {
  slug: string;
  name: string;
  users: { email: string; name: string; role: Role }[];
  supplier: string;
  prices: Record<string, number>; // sku → cents
}

export const SEED_WORKSPACES: SeedWorkspace[] = [
  {
    slug: "nova",
    name: "NOVA Decks & Exteriors (demo)",
    users: [
      { email: "owner@nova.example", name: "Jordan Owner", role: "owner_admin" },
      { email: "sam@nova.example", name: "Sam Estimator", role: "member" },
    ],
    supplier: "Tidewater Building Supply (fictional)",
    prices: { "NL-HBR-GRY-20": 6000, "NL-HBR-GRY-10": 3400, "RW-CT-16": 5200 },
  },
  {
    slug: "blue-ridge",
    name: "Blue Ridge Outdoor Living (demo)",
    users: [
      { email: "owner@blueridge.example", name: "Casey Owner", role: "owner_admin" },
      { email: "pat@blueridge.example", name: "Pat Crew Lead", role: "member" },
    ],
    supplier: "Mountain Lumber Co. (fictional)",
    prices: { "NL-HBR-GRY-20": 6400, "NL-HBR-GRY-10": 3600 },
  },
];

export async function ensureUser(db: Db, u: { email: string; name: string }, password: string) {
  const [existing] = await db.select().from(user).where(eq(user.email, u.email));
  if (existing) return existing;
  const ctx = await getAuth().$context;
  const hash = await ctx.password.hash(password);
  const id = crypto.randomUUID();
  const [created] = await db.insert(user).values({ id, email: u.email, name: u.name, emailVerified: true }).returning();
  await db.insert(account).values({ id: crypto.randomUUID(), userId: id, providerId: "credential", accountId: id, password: hash });
  return created!;
}

export async function ensureCompany(db: Db, w: { slug: string; name: string }) {
  const [existing] = await db.select().from(companies).where(eq(companies.slug, w.slug));
  if (existing) return existing;
  const [c] = await db.insert(companies).values({ slug: w.slug, name: w.name }).returning();
  return c!;
}

export async function ensureMembership(db: Db, companyId: string, userId: string, role: Role) {
  await db.insert(memberships).values({ companyId, userId, role }).onConflictDoNothing();
}

export async function ensureStages(db: Db, companyId: string) {
  for (const [i, s] of SEED_STAGES.entries()) {
    await db.insert(pipelineStages).values({ companyId, name: s.name, position: i + 1, kind: s.kind }).onConflictDoNothing();
  }
  return db.select().from(pipelineStages).where(eq(pipelineStages.companyId, companyId)).orderBy(pipelineStages.position);
}

export async function ensureCatalog(db: Db) {
  for (const p of SEED_CATALOG) {
    await db.insert(catalogProducts).values({ category: "decking", ...p }).onConflictDoNothing();
  }
  return db.select().from(catalogProducts);
}

export async function ensurePrices(db: Db, companyId: string, supplierName: string, prices: Record<string, number>, effectiveOn = "2026-01-01") {
  let [sup] = await db.select().from(suppliers).where(and(eq(suppliers.companyId, companyId), eq(suppliers.name, supplierName)));
  if (!sup) [sup] = await db.insert(suppliers).values({ companyId, name: supplierName }).returning();
  const catalog = await ensureCatalog(db);
  for (const [sku, cents] of Object.entries(prices)) {
    const product = catalog.find((c) => c.sku === sku)!;
    const [existing] = await db
      .select()
      .from(companyProductPrices)
      .where(and(eq(companyProductPrices.companyId, companyId), eq(companyProductPrices.catalogProductId, product.id), eq(companyProductPrices.effectiveOn, effectiveOn)));
    if (!existing) {
      await db.insert(companyProductPrices).values({ companyId, catalogProductId: product.id, supplierId: sup!.id, unitPriceCents: cents, source: "seed:supplier-quote", effectiveOn });
    }
  }
}

export async function seedWorkspace(db: Db, w: SeedWorkspace, password: string) {
  const company = await ensureCompany(db, w);
  const users = [];
  for (const u of w.users) {
    const row = await ensureUser(db, u, password);
    await ensureMembership(db, company.id, row.id, u.role);
    users.push({ ...u, id: row.id });
  }
  await ensureStages(db, company.id);
  await ensurePrices(db, company.id, w.supplier, w.prices);
  return { company, users };
}

export async function seedAll(db: Db, opts: { password: string; sampleData?: boolean }) {
  const sample = opts.sampleData ?? true;
  const workspaces = [];
  for (const w of SEED_WORKSPACES) {
    const { company, users } = await seedWorkspace(db, w, opts.password);
    if (sample) await seedSampleCrm(db, w, users[0]!.id, users[1]!.id);
    workspaces.push({ slug: w.slug, name: w.name, users: w.users, companyId: company.id });
  }
  return { workspaces };
}

/** A few fictional customers/opportunities per workspace so the pipeline is not empty. Skips if data exists. */
async function seedSampleCrm(db: Db, w: SeedWorkspace, ownerId: string, memberId: string) {
  const ctx = await buildCompanyContext(ownerId, w.slug, db);
  const { customers: customersTable } = await import("./schema");
  const [any] = await db.select({ id: customersTable.id }).from(customersTable).where(eq(customersTable.companyId, ctx.companyId)).limit(1);
  if (any) return;
  const stages = await db.select().from(pipelineStages).where(eq(pipelineStages.companyId, ctx.companyId)).orderBy(pipelineStages.position);
  const stage = (name: string) => stages.find((s) => s.name === name)!.id;
  const isNova = w.slug === "nova";
  const samples = isNova
    ? [
        { customer: "Avery & Morgan Chen", city: "Fairfax", st: "VA", title: "Backyard composite deck", stage: "Estimating", days: -2, assignee: memberId, design: true },
        { customer: "Riley Thompson", city: "Leesburg", st: "VA", title: "Screened sunroom addition", stage: "Consultation Scheduled", days: 3, assignee: ownerId, service: "sunroom" as const },
        { customer: "Dana Okafor", city: "Ashburn", st: "VA", title: "Paver patio + fire pit", stage: "New Inquiry", days: 0, assignee: null, service: "patio" as const },
      ]
    : [
        { customer: "Harper Family", city: "Asheville", st: "NC", title: "Elevated deck with stair", stage: "Proposal Sent", days: 1, assignee: memberId, design: true },
        { customer: "Blue Ridge Cabins LLC", city: "Boone", st: "NC", title: "Cabin porch rebuild", stage: "New Inquiry", days: -5, assignee: null },
      ];
  for (const s of samples) {
    const c = await createCustomer(ctx, { displayName: s.customer });
    await addContact(ctx, c.id, { name: s.customer.split(" & ")[0]!, email: `${c.id.slice(0, 6)}@example.com`, phone: "555-0100", isPrimary: true });
    const a = await addAddress(ctx, c.id, { line1: "123 Example Ln", city: s.city, region: s.st, postalCode: "00000" });
    const due = new Date(Date.now() + s.days * 86_400_000).toISOString().slice(0, 10);
    const opp = await createOpportunity(ctx, {
      customerId: c.id,
      addressId: a.id,
      title: s.title,
      serviceType: "service" in s && s.service ? s.service : "deck",
      leadSource: "referral",
      stageId: stage(s.stage),
      assigneeUserId: s.assignee,
      nextFollowUpOn: due,
    });
    await addNote(ctx, opp.id, "Initial call: homeowner wants to start this season. (fictional seed note)");
    await addTask(ctx, opp.id, { title: "Send consultation confirmation", ownerUserId: s.assignee ?? ownerId, dueOn: due });
    if ("design" in s && s.design) {
      const products = await db.select().from(catalogProducts).where(eq(catalogProducts.sku, "NL-HBR-GRY-20"));
      const design = await saveDesign(ctx, { opportunityId: opp.id, name: "Main deck", model: { ...DEFAULT_DECK_DESIGN, deckingProductId: products[0]!.id } });
      await createDraftRevision(ctx, { designId: design.id, catalogProductId: products[0]!.id });
    }
  }
}
