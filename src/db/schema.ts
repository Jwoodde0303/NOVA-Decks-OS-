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
  text,
  timestamp,
  unique,
  uniqueIndex,
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

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    timezone: text("timezone").notNull().default("America/New_York"),
    nextJobNumber: integer("next_job_number").notNull().default(1001),
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
/* CRM                                                                         */
/* -------------------------------------------------------------------------- */

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    kind: text("kind", { enum: ["residential", "commercial"] }).notNull().default("residential"),
    notes: text("notes"),
    createdBy: text("created_by").references(() => user.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("customers_company_id_uq").on(t.companyId, t.id),
    index("customers_company_name_idx").on(t.companyId, t.displayName),
  ],
);

export const customerContacts = pgTable(
  "customer_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull(),
    customerId: uuid("customer_id").notNull(),
    name: text("name").notNull(),
    role: text("role"),
    email: text("email"),
    phone: text("phone"),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    foreignKey({
      name: "contacts_customer_fk",
      columns: [t.companyId, t.customerId],
      foreignColumns: [customers.companyId, customers.id],
    }).onDelete("cascade"),
    index("contacts_customer_idx").on(t.companyId, t.customerId),
  ],
);

export const customerAddresses = pgTable(
  "customer_addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull(),
    customerId: uuid("customer_id").notNull(),
    label: text("label").notNull().default("Project site"),
    line1: text("line1").notNull(),
    line2: text("line2"),
    city: text("city").notNull(),
    region: text("region").notNull(),
    postalCode: text("postal_code").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("addresses_company_customer_id_uq").on(t.companyId, t.customerId, t.id),
    foreignKey({
      name: "addresses_customer_fk",
      columns: [t.companyId, t.customerId],
      foreignColumns: [customers.companyId, customers.id],
    }).onDelete("cascade"),
  ],
);

export const STAGE_KINDS = ["open", "won", "lost"] as const;

export const pipelineStages = pgTable(
  "pipeline_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull(),
    kind: text("kind", { enum: STAGE_KINDS }).notNull().default("open"),
  },
  (t) => [
    unique("stages_company_id_uq").on(t.companyId, t.id),
    unique("stages_company_name_uq").on(t.companyId, t.name),
  ],
);

export const SERVICE_TYPES = ["deck", "sunroom", "patio", "exterior_renovation", "other"] as const;
export const LEAD_SOURCES = [
  "referral",
  "website",
  "google",
  "social",
  "repeat_customer",
  "yard_sign",
  "home_show",
  "other",
] as const;

export const opportunities = pgTable(
  "opportunities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull(),
    customerId: uuid("customer_id").notNull(),
    addressId: uuid("address_id"),
    title: text("title").notNull(),
    serviceType: text("service_type", { enum: SERVICE_TYPES }).notNull(),
    leadSource: text("lead_source", { enum: LEAD_SOURCES }).notNull(),
    stageId: uuid("stage_id").notNull(),
    assigneeUserId: text("assignee_user_id"),
    nextFollowUpOn: date("next_follow_up_on"),
    lostReason: text("lost_reason"),
    createdBy: text("created_by").references(() => user.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("opps_company_id_uq").on(t.companyId, t.id),
    foreignKey({
      name: "opps_customer_fk",
      columns: [t.companyId, t.customerId],
      foreignColumns: [customers.companyId, customers.id],
    }),
    foreignKey({
      name: "opps_address_fk",
      columns: [t.companyId, t.customerId, t.addressId],
      foreignColumns: [customerAddresses.companyId, customerAddresses.customerId, customerAddresses.id],
    }),
    foreignKey({
      name: "opps_stage_fk",
      columns: [t.companyId, t.stageId],
      foreignColumns: [pipelineStages.companyId, pipelineStages.id],
    }),
    foreignKey({
      name: "opps_assignee_member_fk",
      columns: [t.companyId, t.assigneeUserId],
      foreignColumns: [memberships.companyId, memberships.userId],
    }),
    index("opps_company_stage_idx").on(t.companyId, t.stageId),
    index("opps_company_followup_idx").on(t.companyId, t.nextFollowUpOn),
  ],
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull(),
    opportunityId: uuid("opportunity_id").notNull(),
    customerId: uuid("customer_id").notNull(),
    addressId: uuid("address_id"),
    jobNumber: text("job_number").notNull(),
    title: text("title").notNull(),
    serviceType: text("service_type", { enum: SERVICE_TYPES }).notNull(),
    status: text("status", { enum: ["active", "complete", "cancelled"] }).notNull().default("active"),
    createdBy: text("created_by").references(() => user.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // One job per opportunity: the backstop that makes conversion idempotent.
    uniqueIndex("jobs_opportunity_uq").on(t.opportunityId),
    unique("jobs_company_id_uq").on(t.companyId, t.id),
    unique("jobs_company_number_uq").on(t.companyId, t.jobNumber),
    foreignKey({
      name: "jobs_opportunity_fk",
      columns: [t.companyId, t.opportunityId],
      foreignColumns: [opportunities.companyId, opportunities.id],
    }),
    foreignKey({
      name: "jobs_customer_fk",
      columns: [t.companyId, t.customerId],
      foreignColumns: [customers.companyId, customers.id],
    }),
    foreignKey({
      name: "jobs_address_fk",
      columns: [t.companyId, t.customerId, t.addressId],
      foreignColumns: [customerAddresses.companyId, customerAddresses.customerId, customerAddresses.id],
    }),
  ],
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull(),
    opportunityId: uuid("opportunity_id"),
    jobId: uuid("job_id"),
    title: text("title").notNull(),
    ownerUserId: text("owner_user_id").notNull(),
    dueOn: date("due_on").notNull(),
    completedAt: ts("completed_at"),
    completedBy: text("completed_by").references(() => user.id),
    createdBy: text("created_by").references(() => user.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    foreignKey({
      name: "tasks_opportunity_fk",
      columns: [t.companyId, t.opportunityId],
      foreignColumns: [opportunities.companyId, opportunities.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "tasks_job_fk",
      columns: [t.companyId, t.jobId],
      foreignColumns: [jobs.companyId, jobs.id],
    }),
    foreignKey({
      name: "tasks_owner_member_fk",
      columns: [t.companyId, t.ownerUserId],
      foreignColumns: [memberships.companyId, memberships.userId],
    }),
    index("tasks_company_owner_due_idx").on(t.companyId, t.ownerUserId, t.dueOn),
  ],
);

/** Chronological history: notes plus system-recorded major changes, always with the actor. */
export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull(),
    customerId: uuid("customer_id").notNull(),
    opportunityId: uuid("opportunity_id"),
    jobId: uuid("job_id"),
    actorUserId: text("actor_user_id").references(() => user.id),
    kind: text("kind").notNull(),
    body: text("body").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [
    foreignKey({
      name: "activities_customer_fk",
      columns: [t.companyId, t.customerId],
      foreignColumns: [customers.companyId, customers.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "activities_opportunity_fk",
      columns: [t.companyId, t.opportunityId],
      foreignColumns: [opportunities.companyId, opportunities.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "activities_job_fk",
      columns: [t.companyId, t.jobId],
      foreignColumns: [jobs.companyId, jobs.id],
    }),
    index("activities_opp_idx").on(t.companyId, t.opportunityId, t.createdAt),
    index("activities_customer_idx").on(t.companyId, t.customerId, t.createdAt),
  ],
);

/* -------------------------------------------------------------------------- */
/* Catalog & pricing                                                           */
/* -------------------------------------------------------------------------- */

/** Manufacturer catalog data. Shared across workspaces; contains no pricing. */
export const catalogProducts = pgTable(
  "catalog_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    category: text("category", { enum: ["decking"] }).notNull(),
    manufacturer: text("manufacturer").notNull(),
    productLine: text("product_line").notNull(),
    name: text("name").notNull(),
    sku: text("sku").notNull(),
    stockLengthIn: integer("stock_length_in").notNull(),
    effectiveWidthIn: integer("effective_width_in").notNull(),
    attributes: jsonb("attributes").$type<Record<string, unknown>>().notNull().default({}),
    dataSource: text("data_source").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique("catalog_mfr_sku_uq").on(t.manufacturer, t.sku),
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
    foreignKey({
      name: "prices_supplier_fk",
      columns: [t.companyId, t.supplierId],
      foreignColumns: [suppliers.companyId, suppliers.id],
    }),
    index("prices_lookup_idx").on(t.companyId, t.catalogProductId, t.effectiveOn),
    check("prices_nonneg", sql`${t.unitPriceCents} >= 0`),
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
    opportunityId: uuid("opportunity_id").notNull(),
    jobId: uuid("job_id"),
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
    foreignKey({
      name: "designs_opportunity_fk",
      columns: [t.companyId, t.opportunityId],
      foreignColumns: [opportunities.companyId, opportunities.id],
    }),
    foreignKey({
      name: "designs_job_fk",
      columns: [t.companyId, t.jobId],
      foreignColumns: [jobs.companyId, jobs.id],
    }),
  ],
);

export const estimates = pgTable(
  "estimates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull(),
    opportunityId: uuid("opportunity_id").notNull(),
    jobId: uuid("job_id"),
    designId: uuid("design_id"),
    title: text("title").notNull(),
    createdBy: text("created_by").references(() => user.id),
    createdAt: createdAt(),
  },
  (t) => [
    unique("estimates_company_id_uq").on(t.companyId, t.id),
    foreignKey({
      name: "estimates_opportunity_fk",
      columns: [t.companyId, t.opportunityId],
      foreignColumns: [opportunities.companyId, opportunities.id],
    }),
    foreignKey({
      name: "estimates_job_fk",
      columns: [t.companyId, t.jobId],
      foreignColumns: [jobs.companyId, jobs.id],
    }),
    foreignKey({
      name: "estimates_design_fk",
      columns: [t.companyId, t.designId],
      foreignColumns: [deckDesigns.companyId, deckDesigns.id],
    }),
  ],
);

/** Immutable once written. Holds full snapshots so later design/catalog/price edits never change it. */
export const estimateRevisions = pgTable(
  "estimate_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull(),
    estimateId: uuid("estimate_id").notNull(),
    revisionNumber: integer("revision_number").notNull(),
    status: text("status", { enum: ["draft"] }).notNull().default("draft"),
    scopeLabel: text("scope_label").notNull(),
    designVersion: integer("design_version").notNull(),
    designSnapshot: jsonb("design_snapshot").notNull(),
    productSnapshot: jsonb("product_snapshot").notNull(),
    lineItems: jsonb("line_items").notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    createdBy: text("created_by").references(() => user.id),
    createdAt: createdAt(),
  },
  (t) => [
    unique("revisions_estimate_number_uq").on(t.estimateId, t.revisionNumber),
    foreignKey({
      name: "revisions_estimate_fk",
      columns: [t.companyId, t.estimateId],
      foreignColumns: [estimates.companyId, estimates.id],
    }).onDelete("cascade"),
  ],
);
