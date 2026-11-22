# NOVA Decks OS — Implementation Plan

**Product:** deck CAD + estimating software for exterior contractors, sold as hosted workspaces. It designs the deck, generates code-compliant framing, applies the decking manufacturer's installation rules, prices everything from the company's price book, and produces estimates (and, next, permit-ready plansets). It plugs into the contractor's CRM (JobTread, AccuLynx, …) instead of running a pipeline of its own.

## Stack
- **One deployable app:** Next.js 16 (App Router, React 19, server actions + route handlers), TypeScript.
- **Database:** PostgreSQL. Drizzle ORM schema in `src/db/schema.ts`; SQL migrations in `drizzle/` applied by `npm run db:migrate`.
- **Auth:** Better Auth (email + password, database sessions, httpOnly cookies). Public sign-up is off unless `ALLOW_SIGNUP=true`.
- **Tests:** Vitest against a real PostgreSQL (embedded locally, service container in CI).

## Modules
| Module | Path | Owns |
| --- | --- | --- |
| core | `src/modules/core` | Company context, roles & permissions, company settings, errors, units |
| projects | `src/modules/projects` | Projects (CRM job link, site, client), project history |
| catalog | `src/modules/catalog` + `src/db/catalog` | Manufacturer decking catalog with installation rules; sync |
| design | `src/modules/design` | Deck design model (pure), validation, plan view, 3D preview, product picker |
| framing | `src/modules/framing` | Jurisdiction rule sets (Fairfax County 2021.0), framing generator, framing plan drawing |
| estimating | `src/modules/estimating` | Company product prices, price book, estimating engine, revisions, CSV |
| integrations | `src/modules/integrations` | CRM adapter contract and provider adapters |

One pure design model drives every output (`analyzeDeck`, `generateFraming`, `buildEstimate`), so the plan, 3D, framing and estimate cannot disagree.

## Tenancy
- `companies` → `memberships(company_id, user_id, role)` → Better Auth `user`.
- Every tenant table has `company_id NOT NULL`; child rows use composite foreign keys `(company_id, parent_id)` so the database rejects cross-company links.
- The active company is resolved server-side from the URL slug and the signed-in user's membership on every request; no company id is accepted from the client. Lookups by id are filtered by company and misses return 404.

## Milestones
1. ✅ Workspaces, roles, isolation; deck design editor (plan, 3D, takeoff, CSV); immutable estimate revisions.
2. ✅ Framing generator per Fairfax County Typical Deck Details (joists, beam, posts, footings, ledger, lateral, guards, stairs), drawn and reflected in 3D.
3. ✅ Pivot to CAD + estimating: projects with CRM links, Trex/TimberTech/Deckorators catalog with installation rules honoured by the framing generator, company price book, full estimating engine (decking, framing, hardware, footings, stairs, guards, labor; waste/markup/tax), pricing/catalog/integration pages, adapters (stubs).
4. ⏭ Permit-ready planset PDF: cover, framing plan, deck plan, elevations/sections, stair section, county worksheet + sketch sheet, notes, schedules; plat placeholder.
5. Later: live CRM adapters (JobTread, AccuLynx), proposal PDF, manual line items, multi-span/free-standing framing, other jurisdictions, railing/fascia catalogs.
