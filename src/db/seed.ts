import { and, eq } from "drizzle-orm";
import type { Db } from "./client";
import { account, catalogProducts, companies, companyProductPrices, memberships, priceBookItems, suppliers, user, DEFAULT_COMPANY_SETTINGS, type ExternalCrmLink, type Role } from "./schema";
import { getAuth } from "@/lib/auth";
import { buildCompanyContext } from "@/modules/core/context";
import { syncCatalog } from "@/modules/catalog/service";
import { PRICE_BOOK_CATALOG } from "@/modules/estimating/pricing";
import { createProject } from "@/modules/projects/service";
import { saveDesign } from "@/modules/design/service";
import { DEFAULT_DECK_DESIGN } from "@/modules/design/model";
import { createRevision } from "@/modules/estimating/service";

export interface SeedWorkspace {
  slug: string;
  name: string;
  users: { email: string; name: string; role: Role }[];
  supplier: string;
  /** Decking prices by manufacturer SKU, cents. Fictional. */
  productPrices: Record<string, number>;
  /** Price book multiplier against the fictional base prices below. */
  priceBookFactor: number;
}

/** Fictional base prices for the price book (cents per unit). Companies override these. */
export const BASE_PRICE_BOOK: Record<string, number> = {
  "lumber.pt.2x6": 125,
  "lumber.pt.2x8": 165,
  "lumber.pt.2x10": 230,
  "lumber.pt.2x12": 310,
  "lumber.pt.4x4": 160,
  "lumber.pt.6x6": 420,
  "lumber.pt.2x4": 90,
  "hardware.joist-hanger": 275,
  "hardware.hurricane-tie": 120,
  "hardware.ledger-fastener": 210,
  "hardware.tension-tie": 1900,
  "hardware.post-base": 2400,
  "hardware.post-cap": 1800,
  "hardware.through-bolt": 350,
  "hardware.hold-down": 3200,
  "hardware.stringer-hanger": 1400,
  "hardware.flashing-lf": 260,
  "fastener.hidden-clip-sqft": 95,
  "fastener.deck-screw-sqft": 55,
  "fastener.framing-lot": 8500,
  "concrete.80lb-bag": 780,
  "railing.guard-lf": 5200,
  "railing.stair-guard-lf": 6400,
  "riser.board-lf": 650,
  "labor.deck-sqft": 2400,
  "labor.ledger-lf": 1800,
  "labor.footing-each": 14500,
  "labor.stair-riser": 9500,
  "labor.guard-lf": 2200,
};

export const SEED_WORKSPACES: SeedWorkspace[] = [
  {
    slug: "nova",
    name: "NOVA Decks & Exteriors (demo)",
    users: [
      { email: "owner@nova.example", name: "Jordan Owner", role: "owner_admin" },
      { email: "sam@nova.example", name: "Sam Estimator", role: "member" },
    ],
    supplier: "Tidewater Building Supply (fictional)",
    productPrices: {
      "NL-HBR-GRY-20": 6000,
      "NL-HBR-GRY-10": 3400,
      "RW-CT-16": 5200,
      // Fictional prices for real manufacturer SKUs so the demo estimates price out.
      SR010616TG01: 7900, // Trex Transcend Tropicals Spiced Rum 1x6x16 grooved
      SR010620TG01: 9850,
      SR010616TS01: 7900,
      LCGV5416P: 8200, // TimberTech Legacy Pecan 1x6x16 grooved
      LCGV5420P: 10250,
      AGB15516CS: 9900, // TimberTech Vintage Coastline 1x6x16 grooved
      "DEC-VOYAGE-KHAYA-G5.5-16": 8600, // Deckorators Voyage Khaya 1x6x16 grooved
      "DEC-VOYAGE-KHAYA-G5.5-20": 10750,
      "DEC-VISTA-IRONWO-G5.5-16": 6400,
    },
    priceBookFactor: 1,
  },
  {
    slug: "blue-ridge",
    name: "Blue Ridge Outdoor Living (demo)",
    users: [
      { email: "owner@blueridge.example", name: "Casey Owner", role: "owner_admin" },
      { email: "pat@blueridge.example", name: "Pat Crew Lead", role: "member" },
    ],
    supplier: "Mountain Lumber Co. (fictional)",
    productPrices: { "NL-HBR-GRY-20": 6400, "NL-HBR-GRY-10": 3600, SR010616TG01: 8300, LCGV5416P: 8600 },
    priceBookFactor: 1.08,
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
  const [c] = await db.insert(companies).values({ slug: w.slug, name: w.name, settings: DEFAULT_COMPANY_SETTINGS }).returning();
  return c!;
}

export async function ensureMembership(db: Db, companyId: string, userId: string, role: Role) {
  await db.insert(memberships).values({ companyId, userId, role }).onConflictDoNothing();
}

export async function ensurePrices(db: Db, companyId: string, supplierName: string, prices: Record<string, number>, effectiveOn = "2026-01-01") {
  let [sup] = await db.select().from(suppliers).where(and(eq(suppliers.companyId, companyId), eq(suppliers.name, supplierName)));
  if (!sup) [sup] = await db.insert(suppliers).values({ companyId, name: supplierName }).returning();
  for (const [sku, cents] of Object.entries(prices)) {
    const [product] = await db.select({ id: catalogProducts.id }).from(catalogProducts).where(eq(catalogProducts.sku, sku));
    if (!product) continue;
    const [existing] = await db
      .select({ id: companyProductPrices.id })
      .from(companyProductPrices)
      .where(and(eq(companyProductPrices.companyId, companyId), eq(companyProductPrices.catalogProductId, product.id), eq(companyProductPrices.effectiveOn, effectiveOn)));
    if (!existing) await db.insert(companyProductPrices).values({ companyId, catalogProductId: product.id, supplierId: sup!.id, unitPriceCents: cents, source: "seed:fictional", effectiveOn });
  }
}

export async function ensurePriceBook(db: Db, companyId: string, factor: number, effectiveOn = "2026-01-01") {
  for (const item of PRICE_BOOK_CATALOG) {
    const base = BASE_PRICE_BOOK[item.key];
    if (base === undefined) continue;
    await db
      .insert(priceBookItems)
      .values({ companyId, key: item.key, category: item.category, description: item.description, unit: item.unit, unitPriceCents: Math.round(base * factor), source: "seed:fictional", effectiveOn })
      .onConflictDoNothing();
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
  await ensurePrices(db, company.id, w.supplier, w.productPrices);
  await ensurePriceBook(db, company.id, w.priceBookFactor);
  return { company, users };
}

export async function seedAll(db: Db, opts: { password: string; sampleData?: boolean }) {
  const catalog = await syncCatalog(db);
  const workspaces = [];
  for (const w of SEED_WORKSPACES) {
    const { company, users } = await seedWorkspace(db, w, opts.password);
    if (opts.sampleData ?? true) await seedSampleProjects(db, w, users[0]!.id);
    workspaces.push({ slug: w.slug, name: w.name, users: w.users, companyId: company.id });
  }
  return { workspaces, catalog };
}

/** A couple of fictional projects per workspace with a design and a priced estimate. Skips if projects exist. */
async function seedSampleProjects(db: Db, w: SeedWorkspace, ownerId: string) {
  const ctx = await buildCompanyContext(ownerId, w.slug, db);
  const { projects } = await import("./schema");
  const [any] = await db.select({ id: projects.id }).from(projects).where(eq(projects.companyId, ctx.companyId)).limit(1);
  if (any) return;
  const isNova = w.slug === "nova";
  type Sample = { name: string; client: string; city: string; sku: string; crm: ExternalCrmLink | null; height?: number };
  const samples: Sample[] = isNova
    ? [
        { name: "Chen residence — rear composite deck", client: "Avery & Morgan Chen", city: "Fairfax", sku: "SR010616TG01", crm: { provider: "jobtread" as const, externalId: "JT-48213", url: "https://app.jobtread.com/jobs/JT-48213", label: "JobTread job 48213" } },
        { name: "Thompson — elevated deck with stair", client: "Riley Thompson", city: "Leesburg", sku: "LCGV5416P", crm: null, height: 66 },
      ]
    : [{ name: "Harper cabin deck", client: "Harper Family", city: "Asheville", sku: "SR010616TG01", crm: { provider: "acculynx" as const, externalId: "AL-9921", url: null, label: null } }];
  for (const s of samples) {
    const project = await createProject(ctx, { name: s.name, clientName: s.client, siteLine1: "123 Example Ln", siteCity: s.city, siteRegion: isNova ? "VA" : "NC", sitePostalCode: "00000", externalCrm: s.crm });
    const [product] = await db.select({ id: catalogProducts.id }).from(catalogProducts).where(eq(catalogProducts.sku, s.sku));
    const design = await saveDesign(ctx, { projectId: project.id, name: "Main deck", model: { ...DEFAULT_DECK_DESIGN, heightIn: s.height ?? DEFAULT_DECK_DESIGN.heightIn, deckingProductId: product?.id ?? null } });
    if (product) {
      try {
        await createRevision(ctx, { designId: design.id });
      } catch (e) {
        console.warn(`Seed: could not create a sample estimate for "${s.name}": ${(e as Error).message}`);
      }
    }
  }
}
