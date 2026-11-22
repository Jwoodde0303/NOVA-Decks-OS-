# NOVA Decks OS

Deck CAD + estimating software for deck and exterior contractors, built to be hosted as private company workspaces. It designs the deck, generates code-compliant framing (Fairfax County, VA *Typical Deck Details* today), applies the decking manufacturer's own installation rules, prices everything from the company's price book, produces immutable estimate revisions, and prints a permit-ready planset. It plugs into the contractor's CRM (JobTread, AccuLynx, …) rather than running a pipeline of its own.

**Status:** milestone 4 (CAD + estimating + permit plansets). Not deployed. Manufacturer catalog data is transcribed from current published guides and flagged until verified; all prices are fictional.

## Stack
Next.js 16 (App Router, React 19) · TypeScript · PostgreSQL · Drizzle ORM + SQL migrations · Better Auth · Tailwind CSS 4 · three.js · Vitest

Docs: [Implementation plan](docs/IMPLEMENTATION_PLAN.md) · [Permit planset](docs/PLANSET.md) · [Roles](docs/ROLES.md) · [Framing generator](docs/FRAMING.md) · [Catalog](docs/CATALOG.md) · [Estimating engine](docs/ESTIMATING.md) · [CRM integrations](docs/INTEGRATIONS.md) · [Deployment](docs/DEPLOYMENT.md) · [Roadmap](docs/ROADMAP.md)

## Requirements
- Node.js 22.12+ (developed on 26 LTS)
- PostgreSQL 15+ — **or nothing**: `npm run db:local` runs an embedded PostgreSQL in `.data/` for local development.

## Commands
| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies |
| `cp .env.example .env` | Create local config (fill in the placeholders) |
| `npm run db:local` | Start the embedded local PostgreSQL (leave running) |
| `npm run db:migrate` | Apply SQL migrations in `drizzle/` to `DATABASE_URL` |
| `npm run db:seed` | Sync the manufacturer catalog and seed two fictional workspaces, demo users, price books and sample projects (idempotent) |
| `npm run dev` | Start the app on http://localhost:3000 |
| `npm test` | Run the test suite against a throwaway embedded PostgreSQL (or `TEST_DATABASE_URL`) |
| `npm run lint` / `npm run typecheck` | ESLint / `tsc --noEmit` |
| `npm run build` / `npm run start` | Production build / serve |
| `npm run check` | lint + typecheck + test + build (what CI runs) |
| `npm run db:generate` | Generate a migration after editing `src/db/schema.ts` |

## Local run (first time)
```bash
npm install
cp .env.example .env     # set LOCAL_DB_PASSWORD, DATABASE_URL (same password), BETTER_AUTH_SECRET, SEED_DEMO_PASSWORD
npm run db:local         # terminal 1 — keeps running
npm run db:migrate       # terminal 2
npm run db:seed
npm run dev
```
Sign in at http://localhost:3000 (password = `SEED_DEMO_PASSWORD` from your `.env`):

| Workspace | Owner/Admin | Team Member |
| --- | --- | --- |
| NOVA Decks & Exteriors (demo) — `/c/nova` | `owner@nova.example` | `sam@nova.example` |
| Blue Ridge Outdoor Living (demo) — `/c/blue-ridge` | `owner@blueridge.example` | `pat@blueridge.example` |

Self-service sign-up is disabled (`ALLOW_SIGNUP=false`).

## Walkthrough
1. **Project.** Sign in as `owner@nova.example`. *Projects → New project*: name it, enter the site address, pick *JobTread* and a job id to link it. The project page shows designs, estimates and history.
2. **Design.** *New deck design*. The editor opens with the fixture (20' × 12', 4' high, 6' stair at 4'). Pick decking with the cascading picker — e.g. Trex → Transcend Tropicals → Spiced Rum → grooved 5.5" → 16 ft; the 3D preview takes the colour. The takeoff shows rows at the *installed* width (5.5" + Trex's 3/16" gap).
3. **Framing.** Below, the framing panel is generated live to Fairfax County's *Typical Deck Details* (2x8 @ 16", (2)2x12 beam on 3 posts, type E footings, ½" lags @ 15", guards, stair) and lists the manufacturer rules it applied (Trex: 12" stringer spacing, 5 stringers over 36"). Set joist spacing to 24": the panel blocks it because Trex 1" boards allow 16" maximum. Switch to TimberTech Vintage *MAX* (1.5" boards) and 24" is accepted.
4. **Estimate.** *Save design*, then *Save estimate revision*. The estimate page shows decking with waste, framing lumber, hardware, footings (concrete bags), stairs, guards and labor, with materials/labor/markup/tax totals; unpriced items are flagged. Export CSV. Change the design or a price and save another revision: revision 1 is unchanged.
5. **Permit planset.** On the design (or project/estimate page) click *Permit planset (PDF)*: a 9-sheet letter-landscape set opens — cover/index, site-plan placeholder, deck plan, framing plan, front elevation, section A-A, stair section, schedules with the county *Complete My Deck* worksheet, and general notes (county + manufacturer). The framing plan on screen is the same drawing as sheet S-101.
6. **Pricing & catalog.** *Pricing* holds the estimate settings (waste 10%, markup 25%, tax), the price book (all keys the engine uses) and per-SKU decking prices; search the catalog to price a new board. *Catalog* lists every collection with its installation rules and sources.
7. **Integrations.** *Integrations* shows JobTread/AccuLynx cards: enable, name the environment variable that holds the API key, test the connection (reports what is missing — the live API clients are the next step).
8. **Isolation.** Sign in as `owner@blueridge.example`: only Blue Ridge projects, prices (the same Trex board is $83 there) and integrations are visible; any NOVA URL returns 404.

## Tests
`npm test` covers: the drawing generators and the 9-sheet planset PDF, the deck fixture numbers (board counts, perimeter, validation), Fairfax County table transcriptions and the framing generator, manufacturer catalog integrity and item-number formats, manufacturer rules in framing (joist spacing limits, stringer spacing/minimums), the estimating engine (quantities, totals, unpriced warnings, blocked estimates), project → design → estimate revisions staying intact after design/price changes, role limits, and cross-company reads/writes/exports by ID (including a raw insert blocked by a composite foreign key).

## Security notes
- Company context is derived on the server from the signed-in user's membership and the URL slug; no company id is accepted from the client. Every query filters by company, including lookups by id; "not yours" returns the same 404 as "does not exist".
- Child tables use composite foreign keys `(company_id, parent_id)`, so the database rejects cross-company links even if application code is bypassed.
- CRM API keys are never stored: integrations reference an environment variable by name.
- Secrets live in `.env` (git-ignored). `.env.example` has placeholders only.
