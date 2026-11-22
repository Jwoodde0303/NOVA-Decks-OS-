# Roadmap and future work

JobTread and QuickBooks remain the operating systems while this first version is validated. Items below are tracked, not started.

## Next
- **Invitations & onboarding**: owner invites a user by email; user sets a password; membership created on acceptance.
- **Lost-stage flow**: require a lost reason when moving to Lost; report on lost reasons.
- **Design**: multiple decks per opportunity on one plan, board direction options, picture-frame borders, railing takeoff, stair stringer/riser outputs, fascia and fasteners as separate takeoff lines.
- **Estimating**: waste factors per product, labor lines, markup/margin, customer-facing proposal PDF, non-draft statuses (Sent / Accepted).

## Later
- **Scheduling**: crew calendar, job phases, weather holds.
- **Change orders**: scoped to a job, linked to a new estimate revision, approval trail.
- **Live supplier feeds**: import supplier price files into `company_product_prices` with source + effective date; manufacturer catalog sync into `catalog_products`.
- **Customer portal**: read-only proposal/approval and photo updates.
- **Accounting**: QuickBooks customer/invoice sync; JobTread import/export until fully replaced.
- **Structural & permits**: joist/beam/post sizing tables, footing layout, permit drawing exports.
- **Platform**: Postgres row-level security, audit log export, per-company feature flags, billing.
