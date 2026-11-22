# Roles and permissions

Access is derived from the signed-in user's **membership** in a company. A user can hold a membership in several companies, each with its own role. There is no cross-company role.

| Capability | Owner/Admin | Team Member |
| --- | :-: | :-: |
| View customers, opportunities, jobs, tasks, activity, designs, estimates | ✅ | ✅ |
| Create/edit customers, contacts, addresses, opportunities, tasks, notes | ✅ | ✅ |
| Save deck designs and draft estimate revisions | ✅ | ✅ |
| Export estimate CSV | ✅ | ✅ |
| Delete customers | ✅ | ❌ |
| Convert a won opportunity into a job | ✅ | ❌ |
| Manage company product pricing | ✅ | ❌ |
| Manage members and company settings | ✅ | ❌ |

Enforcement lives in `src/modules/core/permissions.ts` and is called by every service through `ctx.require("...")`. Role checks happen on the server only; the UI hides controls as a courtesy, not as a control.

Company isolation is separate from roles: every query is filtered by the company resolved from the user's membership, and child tables use composite foreign keys `(company_id, parent_id)` so the database rejects cross-company links.
