import type { CrmProvider } from "@/db/schema";

/**
 * CRM integration contract. The CAD/estimating app never owns the sales pipeline: a Project links to
 * a job in the company's CRM, and finished estimates can be pushed back as documents/line items.
 *
 * Adapters are server-side only. Credentials come from the secret named by `credentialRef`
 * (an environment variable in this version), never from the database.
 */
export interface CrmJobSummary {
  externalId: string;
  name: string;
  clientName?: string | null;
  address?: { line1?: string | null; city?: string | null; region?: string | null; postalCode?: string | null } | null;
  url?: string | null;
  updatedAt?: string | null;
}

export interface CrmEstimatePush {
  externalJobId: string;
  title: string;
  revisionNumber: number;
  totalCents: number;
  lines: { description: string; qty: number; unit: string; unitPriceCents: number; totalCents: number; section: string }[];
  /** Optional PDF/CSV attachment bytes with filename. */
  attachments?: { filename: string; contentType: string; bytes: Uint8Array }[];
}

export interface CrmAdapter {
  readonly provider: CrmProvider;
  readonly displayName: string;
  /** Documentation for the operator: what to configure and what the adapter maps. */
  readonly setup: { credentialEnvHint: string; docsUrl: string; mapping: string[] };
  /** Verify credentials and connectivity. */
  ping(): Promise<{ ok: boolean; detail: string }>;
  /** Search jobs to link a project to. */
  searchJobs(query: string): Promise<CrmJobSummary[]>;
  /** Fetch one job. */
  getJob(externalId: string): Promise<CrmJobSummary | null>;
  /** Push an estimate revision to the job. Returns the external document/estimate id. */
  pushEstimate(input: CrmEstimatePush): Promise<{ externalDocumentId: string; url?: string | null }>;
}

export class IntegrationNotConfiguredError extends Error {
  constructor(provider: string, detail: string) {
    super(`${provider} integration is not configured: ${detail}`);
    this.name = "IntegrationNotConfiguredError";
  }
}
