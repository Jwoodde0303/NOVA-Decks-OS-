# Estimating engine

`src/modules/estimating/engine.ts` turns one saved design into a sectioned estimate. Inputs: the deck design model, the selected decking product (with the company's current price and the manufacturer's installation rules), the generated framing, the company price book and the company settings (waste %, markup %, material tax %). It is pure; the service snapshots its whole output into an immutable `estimate_revisions` row.

## Sections and quantity rules
| Section | Lines | Quantity rule |
| --- | --- | --- |
| Decking | Deck boards; stair tread boards; hidden clips or deck screws per sq ft | Boards = rows (depth ÷ installed width, rounded up) × pieces per row (width ÷ stock length, rounded up), × (1 + waste). Treads: 2 boards per tread, cut from stock, × (1 + waste). Installed width = actual width + manufacturer side gap. |
| Framing lumber | Ledger, joists, rim joist (dropped beam), beam plies, posts, blocking over beam (if overhang > 2'), knee braces (Method 2), framing fastener lot | Linear feet of stock, each piece rounded up to a 2' increment (8' minimum); posts get a 6" trim allowance. Sizes come from the Fairfax County generator. |
| Hardware & fasteners | Joist hangers (×2 for flush beams), hurricane ties (dropped beams), ledger fasteners (approximate count at the Table 6 spacing), flashing, post bases, post caps (4x4 or 3-ply) or through-bolts (notched 6x6, 2 per post), tension ties (Method 1), guard hold-downs, stringer hangers | Counts from the framing result. |
| Footings | 80 lb concrete bags | Pad volume (round diameter × thickness) + 12" stem to grade (24" − thickness) per footing, plus 10" × 12" stair footings per stringer; 0.6 ft³ per bag. |
| Stairs | 2x12 stringers (hypotenuse + 12"), 2x4 tread supports when the manufacturer requires them, riser boards | From the framing stair result. |
| Guards & railing | Guard per linear foot of open perimeter; stair guard per linear foot (both sides) | Only when guards are required (deck > 30" / stair rise > 30"). |
| Labor | Deck per sq ft, ledger per lf, footings each (beam + stair), stairs per riser, guards per lf | Rates from the price book. |

Totals: `materials` = all non-labor sections; `markup` = (materials + labor) × markup %; `tax` = materials × material tax %; `total` = materials + labor + markup + tax. Money is integer cents.

## Price book
Everything that is not a manufacturer decking SKU is priced through the company price book (`price_book_items`), keyed by stable item keys listed in `PRICE_BOOK_CATALOG` (`src/modules/estimating/pricing.ts`). Prices are append-only by effective date; the engine uses the latest entry on or before today. Missing keys do not fail the estimate: the line is shown at $0, flagged, and the revision carries a warning. Seeded prices are fictional.

## Revisions
Each revision stores the design model, framing result, product (with price), settings, sections, warnings and totals. Changing the design, catalog, prices or settings afterwards never changes a saved revision; create a new revision to re-price. CSV export reads the stored snapshot.

## Not yet covered
Fascia, picture-frame borders, multiple decking products per design, manual line items and overrides, per-line markup, proposal PDF, change orders. See [ROADMAP.md](ROADMAP.md).
