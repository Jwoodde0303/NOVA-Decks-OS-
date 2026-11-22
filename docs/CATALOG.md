# Manufacturer decking catalog

The shared catalog (`catalog_products`) holds manufacturer product data: collection, colour, profile, dimensions, available lengths, the manufacturer's item number where published, and the **installation rules** the framing generator applies for that product. It contains no prices; each company prices the SKUs it buys on the Pricing page.

Source files: [src/db/catalog/trex.ts](../src/db/catalog/trex.ts), [timbertech.ts](../src/db/catalog/timbertech.ts), [deckorators.ts](../src/db/catalog/deckorators.ts), expanded by [types.ts](../src/db/catalog/types.ts) into one row per colour × format × length and synced into the database by `npm run db:seed` (idempotent upsert by manufacturer + SKU).

## What was transcribed (retrieved 2026-11-22)
| Manufacturer | Collections | Catalog source | Installation source |
| --- | --- | --- | --- |
| Trex | Signature, Transcend Lineage, Transcend Tropicals, Transcend Earth Tones, Select, Enhance Naturals, Enhance Basics, Refuge (PVC) | Trex 2026 Full Product Guide (Kuiken Brothers edition), decking specification pages: colours, item-number patterns, actual dimensions and lengths | Trex Decking Installation Guide (trex.com): span chart, gapping, overhang, stair stringer spacing chart |
| TimberTech | Advanced PVC: Vintage (+MAX), Landmark, Harvest (+MAX), Harvest+; Composite: Legacy, Reserve (+FR), Terrain+, Terrain, Premier+, Prime+, Prime, Premier | TimberTech 2026 Product Guide pp. 4–11: model numbers per colour/profile/length, profiles and dimensions | TimberTech Advanced PVC and Composite Installation & Maintenance Guides: joist spacing (incl. MAX), gapping, blocking, stair stringer spacing chart |
| Deckorators | Surestone: Voyage, Summit, Picture Frame Board; Traditional composite: Vista, Venture | Deckorators 2026 Decking Overview brochure and 2026 Vista sell sheet: colours, widths, lengths, profiles | Mineral-Based Composite Installation Guide (Voyage/Summit) and Vista Decking Installation Instructions (4/26): joist spacing, gapping, stringer spacing, tread overhang |

Not included: porch flooring (T&G), fascia/riser boards, railing, lighting and fasteners as catalog items; Deckorators Altitude (2026 regional launch, no installation sheet found); discontinued lines (Vault, Frontier, Trailhead).

## Verification status
Every row is stored with `verified = false` and the UI shows **"verify vs. data sheet"** until someone checks it against the manufacturer's current sheet. Known assumptions, also recorded in each line's `installation.notes`:
- Trex Signature, Transcend Lineage and Refuge stair-stringer spacing is not listed in the installation guide edition obtained; 12" (as Transcend 1x6) is assumed.
- Deckorators board thickness is set to 15/16" for all collections; confirm per collection.
- Deckorators item numbers are not published in the brochures; SKUs are synthesized (`DEC-…`) and must be replaced with distributor item numbers before ordering.
- Colour hex values are approximations for the 3D preview, not manufacturer colour specifications.

## Installation rules carried per line
`maxJoistSpacingPerpendicularIn`, `maxJoistSpacingDiagonalIn`, `maxJoistSpacingCommercialIn`, `maxStairStringerSpacingIn`, `minStringersAt36In` / `minStringersOver36In`, `sideGapIn` (drives the installed width used for board counts), `endGap`, `maxBoardOverhangIn`, `maxTreadOverhangIn`, `blockingRowsMaxIn`, `minJoistsSpanned`, `hiddenFastenerSystems`, `fastening`, `notes`, `source`.

The framing generator (`generateFraming(model, product)`) rejects joist spacing above the manufacturer maximum, sizes stair stringers at the lesser of the county (18") and manufacturer limits with the manufacturer's minimum count, and lists every rule it applied on the framing panel and in the estimate's framing snapshot.

## Updating the catalog
Edit the manufacturer file, run `npm test` (catalog integrity tests check SKU uniqueness, formats and sample item numbers), then `npm run db:seed` to upsert. Add a line to this file's table with the new source and retrieval date.
