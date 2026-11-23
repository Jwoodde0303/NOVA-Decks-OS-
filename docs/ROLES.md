# Roles and permissions

Access is derived from the signed-in user's **membership** in a company. A user can hold a membership in several companies, each with its own role. There is no cross-company role.

| Capability | Owner/Admin | Team Member |
| --- | :-: | :-: |
| View projects, designs, estimates, catalog, price book | ✅ | ✅ |
| Create/edit projects and link them to a CRM job | ✅ | ✅ |
| Save deck designs (CAD + framing options) | ✅ | ✅ |
| Create estimate revisions, export CSV / plansets | ✅ | ✅ |
| Change estimate status (sent / accepted / declined) | ✅ | ❌ |
| Delete projects | ✅ | ❌ |
| Manage catalog product prices and the price book | ✅ | ❌ |
| Manage CRM integrations (JobTread, AccuLynx, …) | ✅ | ❌ |
| Manage members and company settings (waste, markup, tax, ruleset) | ✅ | ❌ |

Enforcement lives in `src/modules/core/permissions.ts` and is called by every service through `ctx.require("...")`. Role checks happen on the server only; the UI hides controls as a courtesy, not as a control.

Company isolation is separate from roles: every query is filtered by the company resolved from the user's membership, and child tables use composite foreign keys `(company_id, parent_id)` so the database rejects cross-company links.
