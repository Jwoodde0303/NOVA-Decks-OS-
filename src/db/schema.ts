import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () => ts("updated_at").notNull().defaultNow();

/* -------------------------------------------------------------------------- */
/* Better Auth tables (names/columns follow Better Auth's core schema)         */
/* -------------------------------------------------------------------------- */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: ts("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: ts("access_token_expires_at"),
    refreshTokenExpiresAt: ts("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: ts("expires_at").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/* -------------------------------------------------------------------------- */
/* Workspaces & access                                                         */
/* -------------------------------------------------------------------------- */

export interface CompanySettings {
  /** Default decking waste factor applied to board counts, percent. */
  wastePct: number;
  /** Default markup on all material and labor lines, percent. */
  markupPct: number;
  /** Sales tax applied to materials, percent. */
  materialTaxPct: number;
  /** Jurisdiction rule set for framing, e.g. "fairfax-county-va-2021.0". */
  framingRuleset: string;
}

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = { wastePct: 10, markupPct: 25, materialTaxPct: 0, framingRuleset: "fairfax-county-va-2021.0" };

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    timezone: text("timezone").notNull().default("America/New_York"),
    settings: jsonb("settings").$type<CompanySettings>().notNull().default(DEFAULT_COMPANY_SETTINGS),
    nextProjectNumber: integer("next_project_number").notNull().default(1001),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [check("companies_slug_format", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`)],
);

export const ROLES = ["owner_admin", "member"] as const;
export type Role = (typeof ROLES)[number];

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role", { enum: ROLES }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique("memberships_company_user_uq").on(t.companyId, t.userId),
    index("memberships_user_idx").on(t.userId),
    check("memberships_role_ck", sql`${t.role} in ('owner_admin','member')`),
  ],
);

/* -------------------------------------------------------------------------- */
/* Projects (the link to the contractor's CRM job)                             */
/* -------------------------------------------------------------------------- */

export const CRM_PROVIDERS = ["jobtread", "acculynx", "other"] as const;
export type CrmProvider = (typeof CRM_PROVIDERS)[number];

export interface ExternalCrmLink {
  provider: CrmProvider;
  externalId: string;
  url?: string | null;
  label?: string | null;
}

/**
 * A project is the minimal record an estimate hangs off: a name, the site address and a pointer
 * to the job in whatever CRM the company runs (JobTread, AccuLynx, …). No pipeline lives here.
 */
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    projectNumber: text("project_number").notNull(),
    name: text("name").notNull(),
    status: text("status", { enum: ["active", "archived"] }).notNull().default("active"),
    clientName: text("client_name"),
    clientPhone: text("client_phone"),
    clientEmail: text("client_email"),
    siteLine1: text("site_line1"),
    siteLine2: text("site_line2"),
    siteCity: text("site_city"),
    siteRegion: text("site_region"),
    sitePostalCode: text("site_postal_code"),
    jurisdiction: text("jurisdiction").notNull().default("Fairfax County, VA"),
    externalCrm: jsonb("external_crm").$type<ExternalCrmLink | null>(),
    notes: text("notes"),
    createdBy: text("created_by").references(() => user.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("projects_company_id_uq").on(t.companyId, t.id),
    unique("projects_company_number_uq").on(t.companyId, t.projectNumber),
    index("projects_company_name_idx").on(t.companyId, t.name),
  ],
);

/** Lightweight history: who saved what, on which project. */
export const projectEvents = pgTable(
  "project_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull(),
    projectId: uuid("project_id").notNull(),
    actorUserId: text("actor_user_id").references(() => user.id),
    kind: text("kind").notNull(),
    body: text("body").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({ name: "project_events_project_fk", columns: [t.companyId, t.projectId], foreignColumns: [projects.companyId, projects.id] }).onDelete("cascade"),
    index("project_events_project_idx").on(t.companyId, t.projectId, t.createdAt),
  ],
);

/* -------------------------------------------------------------------------- */
/* Catalog & pricing                                                           */
/* -------------------------------------------------------------------------- */

export const DECKING_PROFILES = ["square-edge", "grooved", "tongue-and-groove"] as const;
export const DECKING_MATERIALS = ["capped-wood-composite", "capped-pvc", "mineral-composite", "wood", "fictional"] as const;

/**
 * Manufacturer catalog data. Shared across workspaces; contains no pricing.
 * `installation` carries the manufacturer's installation requirements that the framing generator honours.
 */
export const catalogProducts = pgTable(
  "catalog_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    category: text("category", { enum: ["decking"] }).notNull(),
    manufacturer: text("manufacturer").notNull(),
    productLine: text("product_line").notNull(),
    name: text("name").notNull(),
    sku: text("sku").notNull(),
    color: text("color"),
    /** Approximate sRGB hex for previews; not a manufacturer colour specification. */
    colorHex: text("color_hex"),
    profile: text("profile", { enum: DECKING_PROFILES }).notNull().default("square-edge"),
    material: text("material", { enum: DECKING_MATERIALS }).notNull().default("fictional"),
    thicknessIn: real("thickness_in"),
    widthActualIn: real("width_actual_in"),
    stockLengthIn: integer("stock_length_in").notNull(),
    /** Installed width per row = actual width + manufacturer side gap. */
    effectiveWidthIn: real("effective_width_in").notNull(),
    installation: jsonb("installation").$type<Record<string, unknown>>().notNull().default({}),
    attributes: jsonb("attributes").$type<Record<string, unknown>>().notNull().default({}),
    dataSource: text("data_source").notNull(),
    dataEffectiveOn: date("data_effective_on"),
    /** False until someone checks the row against the manufacturer's current data sheet. */
    verified: boolean("verified").notNull().default(false),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    unique("catalog_mfr_sku_uq").on(t.manufacturer, t.sku),
    index("catalog_browse_idx").on(t.category, t.manufacturer, t.productLine, t.color),
    check("catalog_positive_dims", sql`${t.stockLengthIn} > 0 and ${t.effectiveWidthIn} > 0`),
  ],
);

export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique("suppliers_company_id_uq").on(t.companyId, t.id)],
);

/** Company-specific price for a catalog product, append-only by effective date. */
export const companyProductPrices = pgTable(
  "company_product_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    catalogProductId: uuid("catalog_product_id")
      .notNull()
      .references(() => catalogProducts.id),
    supplierId: uuid("supplier_id"),
    unitPriceCents: integer("unit_price_cents").notNull(),
    unit: text("unit", { enum: ["each"] }).notNull().default("each"),
    source: text("source").notNull(),
    effectiveOn: date("effective_on").notNull(),
    createdBy: text("created_by").references(() => user.id),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({ name: "prices_supplier_fk", columns: [t.companyId, t.supplierId], foreignColumns: [suppliers.companyId, suppliers.id] }),
    index("prices_lookup_idx").on(t.companyId, t.catalogProductId, t.effectiveOn),
    check("prices_nonneg", sql`${t.unitPriceCents} >= 0`),
  ],
);

export const PRICE_BOOK_CATEGORIES = ["lumber", "hardware", "fastener", "concrete", "railing", "labor", "other"] as const;
export const PRICE_UNITS = ["each", "lf", "sqft", "bag", "hour", "riser", "footing"] as const;
export type PriceUnit = (typeof PRICE_UNITS)[number];

/**
 * Company price book for everything that is not a manufacturer decking SKU: treated lumber,
 * hangers, fasteners, concrete, railing, labor rates. Keyed by a stable item key the estimating
 * engine asks for (e.g. "lumber.pt.2x8"). Append-only by effective date.
 */
export const priceBookItems = pgTable(
  "price_book_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    category: text("category", { enum: PRICE_BOOK_CATEGORIES }).notNull(),
    description: text("description").notNull(),
    unit: text("unit", { enum: PRICE_UNITS }).notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    source: text("source").notNull(),
    effectiveOn: date("effective_on").notNull(),
    createdBy: text("created_by").references(() => user.id),
    createdAt: createdAt(),
  },
  (t) => [
    unique("price_book_company_key_date_uq").on(t.companyId, t.key, t.effectiveOn),
    index("price_book_lookup_idx").on(t.companyId, t.key, t.effectiveOn),
    check("price_book_nonneg", sql`${t.unitPriceCents} >= 0`),
  ],
);

/* -------------------------------------------------------------------------- */
/* Design & estimating                                                         */
/* -------------------------------------------------------------------------- */

export const deckDesigns = pgTable(
  "deck_designs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull(),
    projectId: uuid("project_id").notNull(),
    name: text("name").notNull(),
    model: jsonb("model").notNull(),
    version: integer("version").notNull().default(1),
    createdBy: text("created_by").references(() => user.id),
    updatedBy: text("updated_by").references(() => user.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("designs_company_id_uq").on(t.companyId, t.id),
    foreignKey({ name: "designs_project_fk", columns: [t.companyId, t.projectId], foreignColumns: [projects.companyId, projects.id] }).onDelete("cascade"),
    index("designs_project_idx").on(t.companyId, t.projectId),
  ],
);

export const ESTIMATE_STATUSES = ["draft", "sent", "accepted", "declined"] as const;

export const estimates = pgTable(
  "estimates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull(),
    projectId: uuid("project_id").notNull(),
    designId: uuid("design_id"),
    title: text("title").notNull(),
    status: text("status", { enum: ESTIMATE_STATUSES }).notNull().default("draft"),
    createdBy: text("created_by").references(() => user.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("estimates_company_id_uq").on(t.companyId, t.id),
    foreignKey({ name: "estimates_project_fk", columns: [t.companyId, t.projectId], foreignColumns: [projects.companyId, projects.id] }).onDelete("cascade"),
    foreignKey({ name: "estimates_design_fk", columns: [t.companyId, t.designId], foreignColumns: [deckDesigns.companyId, deckDesigns.id] }),
    index("estimates_project_idx").on(t.companyId, t.projectId),
  ],
);

/**
 * Immutable once written. Holds full snapshots (design, framing, product, prices, settings) so later
 * design, catalog or price changes never alter a saved revision.
 */
export const estimateRevisions = pgTable(
  "estimate_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull(),
    estimateId: uuid("estimate_id").notNull(),
    revisionNumber: integer("revision_number").notNull(),
    scopeLabel: text("scope_label").notNull(),
    designVersion: integer("design_version").notNull(),
    designSnapshot: jsonb("design_snapshot").notNull(),
    framingSnapshot: jsonb("framing_snapshot").notNull(),
    productSnapshot: jsonb("product_snapshot").notNull(),
    settings: jsonb("settings").notNull(),
    sections: jsonb("sections").notNull(),
    warnings: jsonb("warnings").$type<string[]>().notNull().default([]),
    materialsCents: integer("materials_cents").notNull(),
    laborCents: integer("labor_cents").notNull(),
    markupCents: integer("markup_cents").notNull(),
    taxCents: integer("tax_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    createdBy: text("created_by").references(() => user.id),
    createdAt: createdAt(),
  },
  (t) => [
    unique("revisions_estimate_number_uq").on(t.estimateId, t.revisionNumber),
    foreignKey({ name: "revisions_estimate_fk", columns: [t.companyId, t.estimateId], foreignColumns: [estimates.companyId, estimates.id] }).onDelete("cascade"),
  ],
);

/* -------------------------------------------------------------------------- */
/* Integrations                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Per-company CRM integration settings. Secrets are never stored here: `credentialRef` names the
 * environment variable / secret-manager entry that holds the API key for this company+provider.
 */
export const integrations = pgTable(
  "integrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: CRM_PROVIDERS }).notNull(),
    enabled: boolean("enabled").notNull().default(false),
    settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
    credentialRef: text("credential_ref"),
    lastSyncAt: ts("last_sync_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique("integrations_company_provider_uq").on(t.companyId, t.provider)],
);
