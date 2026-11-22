import type { CrmProvider } from "@/db/schema";
import { IntegrationNotConfiguredError, type CrmAdapter, type CrmEstimatePush, type CrmJobSummary } from "./types";

/**
 * Adapter implementations. Each one reads its API credential from the environment variable named
 * by the company's `credentialRef`. Until a credential is supplied and the vendor API contract is
 * confirmed against their current docs, the adapters are honest stubs: `ping` reports what is
 * missing and the data methods throw IntegrationNotConfiguredError.
 */

abstract class EnvCredentialAdapter implements CrmAdapter {
  abstract readonly provider: CrmProvider;
  abstract readonly displayName: string;
  abstract readonly setup: CrmAdapter["setup"];
  constructor(protected readonly credentialRef: string | null) {}

  protected credential(): string {
    const v = this.credentialRef ? process.env[this.credentialRef] : undefined;
    if (!v) throw new IntegrationNotConfiguredError(this.displayName, `set the ${this.credentialRef ?? "credential"} environment variable`);
    return v;
  }
  async ping() {
    try {
      this.credential();
    } catch (e) {
      return { ok: false, detail: (e as Error).message };
    }
    return { ok: false, detail: `${this.displayName}: credential present; API client not yet implemented (see docs/INTEGRATIONS.md).` };
  }
  async searchJobs(query: string): Promise<CrmJobSummary[]> {
    void query;
    this.credential();
    throw new IntegrationNotConfiguredError(this.displayName, "job search is not implemented yet");
  }
  async getJob(externalId: string): Promise<CrmJobSummary | null> {
    void externalId;
    this.credential();
    throw new IntegrationNotConfiguredError(this.displayName, "job lookup is not implemented yet");
  }
  async pushEstimate(input: CrmEstimatePush): Promise<{ externalDocumentId: string; url?: string | null }> {
    void input;
    this.credential();
    throw new IntegrationNotConfiguredError(this.displayName, "estimate push is not implemented yet");
  }
}

export class JobTreadAdapter extends EnvCredentialAdapter {
  readonly provider = "jobtread" as const;
  readonly displayName = "JobTread";
  readonly setup = {
    credentialEnvHint: "JOBTREAD_API_KEY_<company>",
    docsUrl: "https://app.jobtread.com/api",
    mapping: [
      "Project ↔ JobTread Job (externalId = job id; URL stored for one-click open).",
      "Estimate revision → JobTread Document (estimate) with one line per estimate line, grouped by section; totals carried as-is.",
      "Client name/address are imported from the job on link; the app never writes contacts back.",
    ],
  };
}

export class AccuLynxAdapter extends EnvCredentialAdapter {
  readonly provider = "acculynx" as const;
  readonly displayName = "AccuLynx";
  readonly setup = {
    credentialEnvHint: "ACCULYNX_API_KEY_<company>",
    docsUrl: "https://api.acculynx.com",
    mapping: [
      "Project ↔ AccuLynx Job (externalId = job id).",
      "Estimate revision → AccuLynx Estimate/Document attached to the job (CSV + planset PDF as attachments).",
      "Client name/address imported from the job on link.",
    ],
  };
}

export class GenericLinkAdapter extends EnvCredentialAdapter {
  readonly provider = "other" as const;
  readonly displayName = "Other CRM (link only)";
  readonly setup = { credentialEnvHint: "n/a", docsUrl: "", mapping: ["Stores an external job id and URL on the project; no API calls."] };
  async ping() {
    return { ok: true, detail: "Link-only: no API access required." };
  }
}

export function adapterFor(provider: CrmProvider, credentialRef: string | null): CrmAdapter {
  switch (provider) {
    case "jobtread":
      return new JobTreadAdapter(credentialRef);
    case "acculynx":
      return new AccuLynxAdapter(credentialRef);
    default:
      return new GenericLinkAdapter(credentialRef);
  }
}

export const PROVIDER_LABEL: Record<CrmProvider, string> = { jobtread: "JobTread", acculynx: "AccuLynx", other: "Other CRM" };
