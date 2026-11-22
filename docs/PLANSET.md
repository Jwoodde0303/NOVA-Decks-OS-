# Permit-ready planset

Every saved design can be printed as a permit planset PDF (letter landscape, 9 sheets) from the project page, the design editor or an estimate: `GET /api/c/{company}/designs/{designId}/planset`. It is generated on demand from the design model, so it always matches the current saved version (the design version is printed in the title block and a `planset_generated` event is recorded on the project).

## Sheets
| No. | Sheet | Content |
| --- | --- | --- |
| G-001 | Cover sheet & index | Project, client, site, jurisdiction, contractor, design summary (decking, joists, beam, posts/footings, lateral, guards, stair, manufacturer rules applied), sheet index, applicable requirements, required inspections, design-aid disclaimer |
| G-002 | Site plan | Placeholder with instructions: attach the owner's plat with the deck drawn and dimensioned to property lines, setbacks, easements, utilities |
| A-101 | Deck plan | Decking rows at the installed width, stair with riser/tread counts, guard runs, dimensions, product and open-perimeter notes |
| S-101 | Framing plan | Ledger, joists, rim, beam, posts, footings, tension ties, guard posts, stringers; joist span/overhang and post spacing dimensions; callouts and legend |
| S-201 | Front elevation | Decking, rim, beam, posts, footings below grade (frost depth), guard with posts/rails/balusters, stair risers; height and spacing dimensions |
| S-301 | Section A-A | House wall, ledger with staggered fasteners and flashing, hanger, joist to beam, post, post base, footing and stem, guard post, tension tie; span/overhang/height/footing dimensions and callouts |
| S-302 | Stair section | Stringer profile with risers and treads, footing, guard/handrail, rise/run/stringer-count dimensions and span check |
| S-401 | Schedules & county worksheet | Fairfax County Section 10 "Complete My Deck" values, decking schedule (product, installed width, manufacturer spacing rules, fastening), framing & hardware schedule |
| G-003 | General notes | General, materials, joists & beam, posts & footings, ledger, lateral support, guards, stairs, decking (manufacturer), other — generated from the county rule set and the selected product's installation rules |

## How it is built
- `src/modules/drawing/model.ts` — a renderer-neutral drawing model (lines, rects, circles, paths, text, dimension helpers) with architectural scale snapping.
- `src/modules/drawing/deck-drawings.ts` — pure generators for the deck plan, framing plan, elevation, section and stair section from the design model + framing result (+ product).
- `src/modules/drawing/DrawingSvg.tsx` renders the model on the web (the framing panel uses it); `src/modules/planset/pdf.tsx` renders the same model into PDF sheets with `@react-pdf/renderer`, so the editor and the printed set cannot disagree. Drawings are placed 1:1 in points, so the scale in the title block is true when printed at 100%.
- `src/modules/planset/data.ts` assembles all sheet content purely (testable without a database); `service.ts` loads the design/project/product and renders the buffer.

## Limits
- Not a sealed engineering drawing: the title block and cover say so. The set documents a deck that conforms to the county's pre-approved typical details; the county's plan review and inspections still apply.
- The site plan must come from the owner's plat; the sheet is a placeholder with instructions.
- Single-span attached rectangular decks with one straight stair (the scope of the framing generator). Multi-span, free-standing and landings are future work.
- Plansets are generated on demand and not stored; archive the PDF with the permit application (CRM push is part of the integrations roadmap).
