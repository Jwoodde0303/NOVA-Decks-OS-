CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"manufacturer" text NOT NULL,
	"product_line" text NOT NULL,
	"name" text NOT NULL,
	"sku" text NOT NULL,
	"color" text,
	"color_hex" text,
	"profile" text DEFAULT 'square-edge' NOT NULL,
	"material" text DEFAULT 'fictional' NOT NULL,
	"thickness_in" real,
	"width_actual_in" real,
	"stock_length_in" integer NOT NULL,
	"effective_width_in" real NOT NULL,
	"installation" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"data_source" text NOT NULL,
	"data_effective_on" date,
	"verified" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_mfr_sku_uq" UNIQUE("manufacturer","sku"),
	CONSTRAINT "catalog_positive_dims" CHECK ("catalog_products"."stock_length_in" > 0 and "catalog_products"."effective_width_in" > 0)
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"settings" jsonb DEFAULT '{"wastePct":10,"markupPct":25,"materialTaxPct":0,"framingRuleset":"fairfax-county-va-2021.0"}'::jsonb NOT NULL,
	"next_project_number" integer DEFAULT 1001 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_slug_unique" UNIQUE("slug"),
	CONSTRAINT "companies_slug_format" CHECK ("companies"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
CREATE TABLE "company_product_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"catalog_product_id" uuid NOT NULL,
	"supplier_id" uuid,
	"unit_price_cents" integer NOT NULL,
	"unit" text DEFAULT 'each' NOT NULL,
	"source" text NOT NULL,
	"effective_on" date NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prices_nonneg" CHECK ("company_product_prices"."unit_price_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "deck_designs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"model" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "designs_company_id_uq" UNIQUE("company_id","id")
);
--> statement-breakpoint
CREATE TABLE "estimate_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"estimate_id" uuid NOT NULL,
	"revision_number" integer NOT NULL,
	"scope_label" text NOT NULL,
	"design_version" integer NOT NULL,
	"design_snapshot" jsonb NOT NULL,
	"framing_snapshot" jsonb NOT NULL,
	"product_snapshot" jsonb NOT NULL,
	"settings" jsonb NOT NULL,
	"sections" jsonb NOT NULL,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"materials_cents" integer NOT NULL,
	"labor_cents" integer NOT NULL,
	"markup_cents" integer NOT NULL,
	"tax_cents" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "revisions_estimate_number_uq" UNIQUE("estimate_id","revision_number")
);
--> statement-breakpoint
CREATE TABLE "estimates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"design_id" uuid,
	"title" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "estimates_company_id_uq" UNIQUE("company_id","id")
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"credential_ref" text,
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integrations_company_provider_uq" UNIQUE("company_id","provider")
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_company_user_uq" UNIQUE("company_id","user_id"),
	CONSTRAINT "memberships_role_ck" CHECK ("memberships"."role" in ('owner_admin','member'))
);
--> statement-breakpoint
CREATE TABLE "price_book_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"key" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"unit" text NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"source" text NOT NULL,
	"effective_on" date NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_book_company_key_date_uq" UNIQUE("company_id","key","effective_on"),
	CONSTRAINT "price_book_nonneg" CHECK ("price_book_items"."unit_price_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "project_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"actor_user_id" text,
	"kind" text NOT NULL,
	"body" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_number" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"client_name" text,
	"client_phone" text,
	"client_email" text,
	"site_line1" text,
	"site_line2" text,
	"site_city" text,
	"site_region" text,
	"site_postal_code" text,
	"jurisdiction" text DEFAULT 'Fairfax County, VA' NOT NULL,
	"external_crm" jsonb,
	"notes" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_company_id_uq" UNIQUE("company_id","id"),
	CONSTRAINT "projects_company_number_uq" UNIQUE("company_id","project_number")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suppliers_company_id_uq" UNIQUE("company_id","id")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_product_prices" ADD CONSTRAINT "company_product_prices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_product_prices" ADD CONSTRAINT "company_product_prices_catalog_product_id_catalog_products_id_fk" FOREIGN KEY ("catalog_product_id") REFERENCES "public"."catalog_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_product_prices" ADD CONSTRAINT "company_product_prices_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_product_prices" ADD CONSTRAINT "prices_supplier_fk" FOREIGN KEY ("company_id","supplier_id") REFERENCES "public"."suppliers"("company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_designs" ADD CONSTRAINT "deck_designs_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_designs" ADD CONSTRAINT "deck_designs_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_designs" ADD CONSTRAINT "designs_project_fk" FOREIGN KEY ("company_id","project_id") REFERENCES "public"."projects"("company_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_revisions" ADD CONSTRAINT "estimate_revisions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_revisions" ADD CONSTRAINT "revisions_estimate_fk" FOREIGN KEY ("company_id","estimate_id") REFERENCES "public"."estimates"("company_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_project_fk" FOREIGN KEY ("company_id","project_id") REFERENCES "public"."projects"("company_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_design_fk" FOREIGN KEY ("company_id","design_id") REFERENCES "public"."deck_designs"("company_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_book_items" ADD CONSTRAINT "price_book_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_book_items" ADD CONSTRAINT "price_book_items_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_events" ADD CONSTRAINT "project_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_events" ADD CONSTRAINT "project_events_project_fk" FOREIGN KEY ("company_id","project_id") REFERENCES "public"."projects"("company_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "catalog_browse_idx" ON "catalog_products" USING btree ("category","manufacturer","product_line","color");--> statement-breakpoint
CREATE INDEX "prices_lookup_idx" ON "company_product_prices" USING btree ("company_id","catalog_product_id","effective_on");--> statement-breakpoint
CREATE INDEX "designs_project_idx" ON "deck_designs" USING btree ("company_id","project_id");--> statement-breakpoint
CREATE INDEX "estimates_project_idx" ON "estimates" USING btree ("company_id","project_id");--> statement-breakpoint
CREATE INDEX "memberships_user_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "price_book_lookup_idx" ON "price_book_items" USING btree ("company_id","key","effective_on");--> statement-breakpoint
CREATE INDEX "project_events_project_idx" ON "project_events" USING btree ("company_id","project_id","created_at");--> statement-breakpoint
CREATE INDEX "projects_company_name_idx" ON "projects" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");