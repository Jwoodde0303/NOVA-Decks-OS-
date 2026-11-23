# Auto-generated framing details (Fairfax County)

The design editor generates a framing plan, member schedule, materials count and the county "Complete My Deck" worksheet for every deck design, live, from the same design model that drives the plan view, 3D preview and decking takeoff.

**Rule set:** Fairfax County, Virginia — *Typical Deck Details*, Version 2021.0 (1/5/2024), based on the 2021 Virginia Residential Code. Source: <https://www.fairfaxcounty.gov/landdevelopment/sites/landdevelopment/files/assets/documents/pdf/publications/deck-details.pdf>. Table values are transcribed in [src/modules/framing/rules/fairfax-2021.ts](../src/modules/framing/rules/fairfax-2021.ts) with the county's table and figure numbers, and spot-checked by tests.

> This is a design aid for contractors already familiar with the county document. It does not replace the county's plan review, the required footing/framing/final inspections, or an engineered design where the typical details do not apply. Deviation from the typical details requires county approval before construction.

## What is generated
| Element | How it is sized | County reference |
| --- | --- | --- |
| Joists | Smallest size (or the chosen size) whose allowable span at the chosen spacing ≥ ledger-to-beam span; overhang ≤ table value for the next larger span column and ≤ ¼ span; 2x6 excluded where a guard is required | Table 2, Figures 5–6 |
| Blocking | Required between overhanging joists over the beam when the overhang exceeds 2 ft | Section 3 |
| Beam | Influence width = ½ joist span + overhang (dropped) or ½ joist span (flush), rounded up to the table row; fewest posts whose beam span is allowed (or the chosen post count); first-listed (2-ply) option, flush beams at least as deep as the joists; overhang past end posts ≤ ¼ span | Table 3, Figures 13–15 |
| Posts & footings | Footing type and maximum post height from the beam influence width and span; sizes from Table 5; 6x6 posts, or 4x4 when ≤ 2.5 ft and the beam is 2-ply; 24" minimum depth; 5 ft house-footing rule flagged | Tables 4–5, Figures 16–19 |
| Ledger | Depth ≥ joist depth and ≥ 2x8; fastener spacing by joist-span column and band-board type; anchors only on masonry; 2 rows staggered, 4 at each end | Table 6, Figures 22–27 |
| Lateral support | None ≤ 2.5 ft posts; Method 1 or 2 ≤ 11 ft (user preference); both ≤ 14 ft; tension-tie joists located per Figure 28 | Table 8, Figures 28–33 |
| Guards | Required when the deck surface is > 30" above grade; 4x4 posts at ≤ 6 ft o.c. along both sides and the outer edge each side of the stair opening | Figures 34–38 |
| Stair | Risers ≤ 8¼", 10" run; 2x12 stringers ≤ 18" o.c.; cut stringer span ≤ 6'-9" (solid stringer 13'-3" only for 36"-wide stairs); 8" sq / 10" rd × 12" footings; intermediate landing when rise > 12 ft; stair guard > 30" rise; handrail ≥ 4 risers | Figures 39–45 |
| Hidden fasteners | Under-joist 2x6 bracing when hidden decking fasteners are used and any post exceeds 2.5 ft | Figures 2–3 |

Conditions in the county's shaded (prohibited) cells, overhangs beyond the limits, post heights beyond Table 4, and stair runs beyond the stringer limits are reported as blocking issues. The drawing still renders so the problem is visible.

## Assumptions
- Single-level deck attached with a ledger; joists bear on the ledger and one outside beam (single-span). Multi-span and free-standing decks are not generated yet.
- Level grade; deck height is the walking surface above grade. Post height = height − 1" decking − joist depth − beam depth (dropped) or − beam depth (flush), measured from a post base at grade. Adjust if the footing top is below grade.
- The existing band board is sound and not a prohibited condition (open-web trusses, brick/stone veneer, chimney, bay window) — Figure 25.
- Ledger fastener counts are approximate (2 staggered rows at the table spacing plus 4 at each end).
- Composite decking: joist spacing defaults to 16" o.c.; the manufacturer's maximum governs (Table 1).

## Not yet covered
Multi-span and free-standing layouts, joist framing at chimneys/bay windows (Figure 10), beam splices, knee-brace geometry drawing, safety glazing checks, electrical, intermediate stair landings, and permit drawing export. These are tracked in [ROADMAP.md](ROADMAP.md).
