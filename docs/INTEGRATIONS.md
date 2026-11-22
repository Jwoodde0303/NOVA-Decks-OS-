# CRM integrations

NOVA Decks OS is deck CAD + estimating software. It does **not** run a sales pipeline. A **Project** is the minimal record an estimate hangs off: a name, the site address, the jurisdiction, and a link to the job in whatever CRM the company runs. Finished estimates (and, next, permit plansets) are pushed back to that job.

## Adapter contract
`src/modules/integrations/types.ts` defines `CrmAdapter`:

| Method | Purpose |
| --- | --- |
| `ping()` | Verify the credential and connectivity; surfaces what is missing. |
| `searchJobs(query)` | Find jobs to link a project to. |
| `getJob(externalId)` | Pull the job (client name/address) when linking. |
| `pushEstimate(input)` | Create an estimate/document on the job from an estimate revision: one line per estimate line, grouped by section, with CSV/PDF attachments. |

Adapters live in `src/modules/integrations/adapters.ts`. Every adapter is server-side only and reads its API key from the **environment variable named by the company's `credentialRef`** (set on the Integrations page by an Owner/Admin). API keys are never stored in the database and never sent to the browser.

## Status by provider
| Provider | Status |
| --- | --- |
| JobTread | Link-only today (job id + URL on the project). Adapter stub with the field mapping documented in the UI; `ping` reports the missing credential or that the API client is not yet implemented. Implementing requires a JobTread API key and confirming the current Pave API schema for Jobs and Documents. |
| AccuLynx | Link-only today. Adapter stub as above. Implementing requires an AccuLynx API key and confirming the current Jobs/Estimates/Documents endpoints. |
| Other | Link-only (external id + URL). No API. |

## Proposed field mapping
- **Project ↔ Job**: `projects.external_crm = { provider, externalId, url, label }`. Client name/phone/email and site address are copied from the job on link and remain editable in the project.
- **Estimate revision → CRM estimate/document**: title = estimate title + "rev N"; lines = `sections[].lines[]` (description, qty, unit, unit price, total); totals = materials, labor, markup, tax, total; attachments = CSV export (and the planset PDF once available).
- **Status**: when an estimate is marked accepted here, the adapter may update the CRM job stage; this is off by default.

## Adding a provider
1. Add the provider key to `CRM_PROVIDERS` in `src/db/schema.ts` (migration).
2. Implement `CrmAdapter` in `adapters.ts` and register it in `adapterFor`.
3. Add tests under `tests/` for the mapping with recorded fixtures (no live calls in CI).
