# NOVA Decks OS

A multi-company web application for deck, sunroom, patio and exterior renovation contractors: CRM, deck design and estimating in one deployable app. NOVA Decks & Exteriors is the first workspace; every company gets its own private workspace, users, customers, projects, pricing and settings.

**Status:** Milestone 1 (CRM + deck design tied to a job). Not deployed. JobTread and QuickBooks stay the operating systems while this is validated. All product data and prices are fictional.

## Stack
Next.js 16 (App Router, React 19) · TypeScript · PostgreSQL · Drizzle ORM + SQL migrations · Better Auth · Tailwind CSS 4 · three.js · Vitest

Module layout and design notes: [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md). Roles: [docs/ROLES.md](docs/ROLES.md). Hosting: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Future work: [docs/ROADMAP.md](docs/ROADMAP.md).

## Requirements
- Node.js 22.12+ (developed on 26 LTS)
- PostgreSQL 15+ — **or nothing**: `npm run db:local` runs an embedded PostgreSQL in `.data/` for local development, no Homebrew/Docker needed.

## Commands
| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies |
| `cp .env.example .env` | Create local config (fill in the placeholders) |
| `npm run db:local` | Start the embedded local PostgreSQL (leave running; Ctrl+C stops it) |
| `npm run db:migrate` | Apply SQL migrations in `drizzle/` to `DATABASE_URL` |
| `npm run db:seed` | Seed two fictional workspaces, demo users, stages, catalog, prices and sample CRM data (safe to re-run) |
| `npm run dev` | Start the app on http://localhost:3000 |
| `npm test` | Run the test suite against a throwaway embedded PostgreSQL (or `TEST_DATABASE_URL` if set) |
| `npm run lint` / `npm run typecheck` | ESLint / `tsc --noEmit` |
| `npm run build` / `npm run start` | Production build / serve |
| `npm run check` | lint + typecheck + test + build (what CI runs) |
| `npm run db:generate` | Generate a new migration after editing `src/db/schema.ts` |

## Local run (first time)
```bash
npm install
cp .env.example .env     # set LOCAL_DB_PASSWORD, DATABASE_URL (same password), BETTER_AUTH_SECRET, SEED_DEMO_PASSWORD
npm run db:local         # terminal 1 — keeps running
npm run db:migrate       # terminal 2
npm run db:seed
npm run dev
```
Open http://localhost:3000 and sign in with a seeded user (password = `SEED_DEMO_PASSWORD` from your `.env`):

| Workspace | Owner/Admin | Team Member |
| --- | --- | --- |
| NOVA Decks & Exteriors (demo) — `/c/nova` | `owner@nova.example` | `sam@nova.example` |
| Blue Ridge Outdoor Living (demo) — `/c/blue-ridge` | `owner@blueridge.example` | `pat@blueridge.example` |

Self-service sign-up is disabled (`ALLOW_SIGNUP=false`).

## Walkthrough: lead → deck estimate → job, and company isolation
1. **Create a lead.** Sign in as `owner@nova.example`. Dashboard → **New inquiry**. Enter a new customer name, a project address, title "Rear composite deck", service *Deck*, source *Referral*, assign to Sam, follow-up date today. Create. You land on the opportunity; the Activity timeline shows "Inquiry created" with your name.
2. **Work the lead.** Change stage to *Consultation Scheduled* and update. Add a note and a task for Sam. The timeline records each change with who did it. Pipeline → filter by assignee *Sam Estimator* or tick *Overdue follow-up*.
3. **Design the deck.** On the opportunity, **New deck design**. The editor opens with the seeded fixture: 20 ft × 12 ft, 4 ft high, 6 ft stair at a 4 ft offset. Choose *Northline Harbor Grey 20 ft* ($60): the takeoff shows **24 boards, $1,440**. Switch to the *10 ft* board ($34): **48 boards, $1,632**. Set depth to 13 ft: **52 boards, $1,768**. Set depth back to 12 ft and stair offset to 7 ft: plan and 3D update, each remaining outer-edge segment reads 7', open perimeter reads 38'. Set the offset to 16 ft: a red validation error appears, the plan highlights the overrun, and "Save draft estimate" is blocked. Set it back to 7 ft.
4. **Save design and estimate.** **Save design**, then **Save draft estimate revision**. The estimate page shows revision 1 labelled *Draft · Decking materials only* with **Export CSV**. Go back to the design, change depth to 13 ft, save, and add a second revision: revision 1 is unchanged.
5. **Convert to a job.** On the opportunity, set stage to *Won* and update, then **Convert to job** (Owner/Admin only; Sam sees a note instead). The job page shows the customer, address, carried-over design and estimate, and the full history ending with "Converted to job J-1001". Press back and click *Convert* again, or reload the opportunity: it links to the same job; no duplicate is created.
6. **Verify isolation.** Copy the opportunity URL. Sign out, sign in as `owner@blueridge.example`. Their pipeline shows only Blue Ridge data. Paste the NOVA URL (or swap `/c/blue-ridge/` into it): **404**. Try the CSV URL from step 4: **404**. Blue Ridge's price for the same 20 ft board is $64, so the same design there prices at $1,536.

## Tests
`npm test` covers: the deck fixture numbers above (board counts, totals, segments, perimeter, validation blocking export), CSV output, lead → job workflow with activity history and filters, repeat/concurrent conversion returning one job, estimate revisions staying intact after design and price changes, Team Member permission limits, and cross-company reads/writes/exports by ID (including a raw SQL insert blocked by the composite foreign key).

## Security notes
- Company context is derived on the server from the signed-in user's membership and the URL slug; no company id is accepted from the client. Every query filters by company, including lookups by id, and "not yours" returns the same 404 as "does not exist".
- Child tables use composite foreign keys `(company_id, parent_id)`, so the database rejects cross-company links even if application code is bypassed.
- Secrets live in `.env` (git-ignored). `.env.example` has placeholders only.
