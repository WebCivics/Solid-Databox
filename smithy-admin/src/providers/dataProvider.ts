//
// NOTE on the @ts-nocheck above (pre-existing): Refine's `DataProvider` methods are
// generic over a caller-chosen `TData extends BaseRecord`, so no concrete provider can
// satisfy them without casts at every return. The `DataProvider` annotation below
// declares the contract this object implements (and is what `<Refine>` typechecks
// against in App.tsx).

import type { BaseKey } from "@refinedev/core";
import { createPosOperationsSnapshot } from "../data/posOperations";

// Defaults target the local Track B preset; override for a server on another
// origin. The token is the preset's demonstration control boundary, not IAM.
const API_URL = import.meta.env.VITE_FORGE_API_URL ?? "http://localhost:3000/.databox/smithy";
const TOKEN = import.meta.env.VITE_FORGE_TOKEN ?? "12345678901234567890123456789012";
const CMS_API_URL = import.meta.env.VITE_CMS_API_URL ?? "http://localhost:3000/.databox/ipms";
const CMS_TOKEN = import.meta.env.VITE_CMS_TOKEN ?? TOKEN;

const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${TOKEN}`);
  headers.set("Content-Type", "application/json");

  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || `HTTP ${response.status}`);
  }

  return data;
};

const fetchIpmsWithAuth = async (url: string, options: RequestInit = {}) => {
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${CMS_TOKEN}`);
  headers.set("Content-Type", "application/json");

  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || `HTTP ${response.status}`);
  }

  return data;
};

// Mock data for corrections
let mockCorrections = [
  {
    id: "req-1001",
    consumerUrn: "urn:uuid:1111-2222-3333-4444",
    targetRecord: "https://synthetic-corp.example/profiles/derived/ad_propensity",
    field: "derived:advertising_profile:income_bracket",
    currentValue: "$150k+",
    requestedCorrection: "$80k-$100k",
    status: "pending",
    submittedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    dueDate: new Date(Date.now() + 8 * 86400000).toISOString(),
    dispositionReason: "",
  },
  {
    id: "req-1002",
    consumerUrn: "urn:uuid:5555-6666-7777-8888",
    targetRecord: "https://synthetic-corp.example/financial/ledger/tx-999",
    field: "financial:ledger:transaction_amount",
    currentValue: "50.00",
    requestedCorrection: "5.00",
    status: "more-information-required",
    submittedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    dueDate: new Date(Date.now() + 5 * 86400000).toISOString(),
    dispositionReason: "Please provide a copy of the receipt.",
  },
  {
    id: "req-1003",
    consumerUrn: "urn:uuid:9999-0000-1111-2222",
    targetRecord: "https://synthetic-corp.example/identity/core",
    field: "identity:core:legal_name",
    currentValue: "John Doe",
    requestedCorrection: "Jonathan Doe",
    status: "corrected",
    submittedAt: new Date(Date.now() - 15 * 86400000).toISOString(),
    dueDate: new Date(Date.now() - 5 * 86400000).toISOString(),
    dispositionReason: "Name updated successfully.",
  }
];

// Mock data for access requests
let mockAccessRequests = [
  {
    id: "ar-2001",
    consumerUrn: "urn:uuid:1111-2222-3333-4444",
    scope: [
      "behavioral:location_history",
      "behavioral:search_history",
      "derived:advertising_profile",
      "social:graph_connections"
    ],
    status: "pending",
    submittedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
    regulatoryBasis: "CDR Rules Schedule 4, rule 7.22",
    dispositionReason: "",
  },
  {
    id: "ar-2002",
    consumerUrn: "urn:uuid:5555-6666-7777-8888",
    scope: [
      "identity:core",
      "financial:payment_instruments",
      "financial:transaction_ledger",
      "ugc:media_files"
    ],
    status: "granted",
    submittedAt: new Date(Date.now() - 12 * 86400000).toISOString(),
    dueDate: new Date(Date.now() - 2 * 86400000).toISOString(),
    regulatoryBasis: "Privacy Act 1988, APP 12",
    dispositionReason: "Payload packaged and delivered via Databox broker.",
  },
  {
    id: "ar-2003",
    consumerUrn: "urn:uuid:9999-0000-1111-2222",
    scope: ["health:biometrics:sleep_data", "health:biometrics:heart_rate"],
    status: "refused",
    submittedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    dueDate: new Date(Date.now() + 5 * 86400000).toISOString(),
    regulatoryBasis: "Privacy Act 1988, APP 12",
    dispositionReason: "Exception 12.3(a) - Access would pose a serious threat to the life, health or safety of any individual.",
  }
];

// Mock data for consumer ledger
let mockLedger = [
  {
    id: "urn:uuid:1111-2222-3333-4444",
    consumerName: "Alice Smith",
    dataPoints: [
      { field: "behavioral:location_history", value: "[124,532 GPS points retained]", source: "Mobile App Telemetry", policy: "Consent: Service Provision" },
      { field: "derived:advertising_profile", value: "{ income: 'High', propensity_score: 0.84, segments: ['Tech', 'Travel'] }", source: "Algorithmic Inference Engine", policy: "Consent: Marketing" },
      { field: "social:graph_connections", value: "[482 Edge connections]", source: "Social Feed", policy: "Consent: Service Provision" }
    ],
    lastActive: new Date().toISOString(),
  },
  {
    id: "urn:uuid:5555-6666-7777-8888",
    consumerName: "Bob Jones",
    dataPoints: [
      { field: "financial:transaction_ledger", value: "[$14,203.44 lifetime spend across 42 orders]", source: "Payment Gateway", policy: "Legal Obligation (Tax Retention)" },
      { field: "financial:payment_instruments", value: "[Tokenized Visa ending in 4422]", source: "Vault", policy: "Contractual Obligation" },
    ],
    lastActive: new Date(Date.now() - 1 * 86400000).toISOString(),
  }
];

// Mock data for OUTBOUND data-portability requests.
// These are requests WE (an organisation acting as a consumer, or a natural
// person) send TO a third-party platform to pull our own data back into the
// Databox. This is the inverse of `access-requests`, which are inbound
// requests other parties make about data we hold.
let mockOutboundRequests: any[] = [
  {
    id: "obr-3001",
    platformId: "con-google",
    platformName: "Google",
    category: "Consumer",
    persona: "natural-person",
    requesterId: "urn:uuid:9999-0000-1111-2222",
    scope: ["behavioral:location_history", "behavioral:search_history", "identity:core"],
    regulatoryBasis: "GDPR Art. 20 (Data Portability)",
    status: "sent",
    submittedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    dueDate: new Date(Date.now() + 26 * 86400000).toISOString(),
  },
  {
    id: "obr-3002",
    platformId: "ent-salesforce",
    platformName: "Salesforce",
    category: "Enterprise",
    persona: "organisation",
    requesterId: "urn:uuid:org-smithy-0001",
    scope: ["identity:core", "financial:transaction_ledger"],
    regulatoryBasis: "CDR (Consumer Data Right)",
    status: "pending",
    submittedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    dueDate: new Date(Date.now() + 29 * 86400000).toISOString(),
  }
];

export const dataProvider = {
  getList: async ({ resource }: { resource: string }) => {
    if (resource === "programs") {
      const data = await fetchWithAuth(`${API_URL}/programs`);
      // GET /programs serializes listPrograms() directly, so the body is a bare
      // array. Older/proxied deployments may wrap it as { programs: [...] }.
      const items = Array.isArray(data) ? data : data.programs ?? [];
      // Refine requires an 'id' field for each record
      const formattedItems = items.map((p: any) => ({
        ...p,
        id: p.profileId,
      }));
      return {
        data: formattedItems,
        total: formattedItems.length,
      };
    }
    
    if (resource === "corrections") {
      return {
        data: mockCorrections,
        total: mockCorrections.length,
      };
    }
    
    if (resource === "access-requests") {
      return {
        data: mockAccessRequests,
        total: mockAccessRequests.length,
      };
    }

    if (resource === "consumer-ledger") {
      return {
        data: mockLedger,
        total: mockLedger.length,
      };
    }

    if (resource === "outbound-requests") {
      return {
        data: mockOutboundRequests,
        total: mockOutboundRequests.length,
      };
    }

    if (resource === "ipms-modules") {
      const data = await fetchIpmsWithAuth(`${CMS_API_URL}/modules`);
      const items = (Array.isArray(data) ? data : []).map((module: any) =>
        typeof module === "string"
          ? { id: module, name: module, enabled: true, capabilities: [], routes: [] }
          : { ...module, id: module.id }
      );
      return {
        data: items,
        total: items.length,
      };
    }

    if (resource === "ipms-vertical-profiles") {
      const data = await fetchIpmsWithAuth(`${CMS_API_URL}/vertical-profiles`);
      const items = (Array.isArray(data) ? data : []).map((profile: any) => ({
        ...profile,
        id: profile.id,
      }));
      return {
        data: items,
        total: items.length,
        meta: {
          providerMode: "css-enhanced",
          capabilityMode: "css-enhanced",
          controlPlaneAvailable: true,
        },
      };
    }

    if (resource === "pos-operations") {
      const snapshot = createPosOperationsSnapshot("live-ui-proof", "css-enhanced", true);
      return {
        data: [snapshot],
        total: 1,
        meta: {
          providerMode: "live-ui-proof",
          capabilityMode: "css-enhanced",
          controlPlaneAvailable: true,
          degradationReason: snapshot.degradationReason,
        },
      };
    }

    throw new Error(`Unsupported getList resource: ${resource}`);
  },

  getOne: async ({ resource, id }: { resource: string; id: BaseKey }) => {
    if (resource === "corrections") {
      const record = mockCorrections.find((c) => c.id === id);
      if (!record) throw new Error("Correction not found");
      return { data: record };
    }
    
    if (resource === "access-requests") {
      const record = mockAccessRequests.find((r) => r.id === id);
      if (!record) throw new Error("Access request not found");
      return { data: record };
    }

    if (resource === "consumer-ledger") {
      const record = mockLedger.find((l) => l.id === id);
      if (!record) throw new Error("Consumer ledger not found");
      return { data: record };
    }

    if (resource === "outbound-requests") {
      const record = mockOutboundRequests.find((r) => r.id === id);
      if (!record) throw new Error("Outbound request not found");
      return { data: record };
    }

    if (resource === "ipms-modules") {
      const data = await fetchIpmsWithAuth(`${CMS_API_URL}/modules/${encodeURIComponent(String(id))}`);
      return { data: { ...data, id: data.id } };
    }

    if (resource === "ipms-vertical-profiles") {
      const data = await fetchIpmsWithAuth(`${CMS_API_URL}/vertical-profiles/${encodeURIComponent(String(id))}`);
      return { data: { ...data, id: data.id } };
    }

    throw new Error("getOne not implemented for Smithy API");
  },

  update: async ({ resource, id, variables }: { resource: string; id: BaseKey; variables: Record<string, unknown> }) => {
    if (resource === "corrections") {
      const index = mockCorrections.findIndex((c) => c.id === id);
      if (index === -1) throw new Error("Correction not found");
      
      mockCorrections[index] = {
        ...mockCorrections[index],
        ...variables,
      };
      
      return { data: mockCorrections[index] };
    }
    
    if (resource === "access-requests") {
      const index = mockAccessRequests.findIndex((r) => r.id === id);
      if (index === -1) throw new Error("Access request not found");
      
      mockAccessRequests[index] = {
        ...mockAccessRequests[index],
        ...variables,
      };

      return { data: mockAccessRequests[index] };
    }

    if (resource === "outbound-requests") {
      const index = mockOutboundRequests.findIndex((r) => r.id === id);
      if (index === -1) throw new Error("Outbound request not found");

      mockOutboundRequests[index] = {
        ...mockOutboundRequests[index],
        ...variables,
      };

      return { data: mockOutboundRequests[index] };
    }

    if (resource === "ipms-modules") {
      const data = await fetchIpmsWithAuth(`${CMS_API_URL}/modules/${encodeURIComponent(String(id))}`, {
        method: "PUT",
        body: JSON.stringify(variables),
      });
      return { data: { ...data, id: data.id } };
    }

    throw new Error("update not implemented for Smithy API");
  },

  create: async ({ resource, variables, meta }: { resource: string; variables: Record<string, unknown>; meta?: Record<string, unknown> }) => {
    if (resource === "programs") {
      const data = await fetchWithAuth(`${API_URL}/programs`, {
        method: "POST",
        body: JSON.stringify(variables),
      });
      // Refine keys records by `id`; the Smithy's stable key is profileId.
      return { data: { ...data, id: data.profileId } as any };
    }
    if (resource === "mappings") {
      const data = await fetchWithAuth(`${API_URL}/mappings`, {
        method: "POST",
        body: JSON.stringify(variables),
      });
      return { data: { id: Date.now(), ...data } as any };
    }
    if (resource === "source-events") {
      const data = await fetchWithAuth(`${API_URL}/source-events`, {
        method: "POST",
        body: JSON.stringify(variables),
      });
      return { data: { id: Date.now(), ...data } as any };
    }
    if (resource === "outbound-requests") {
      const now = Date.now();
      const record = {
        id: `obr-${now}`,
        status: "pending",
        ...variables,
        submittedAt: new Date(now).toISOString(),
        // Statutory portability responses are typically due within ~30 days.
        dueDate: new Date(now + 30 * 86400000).toISOString(),
      };
      mockOutboundRequests = [record, ...mockOutboundRequests];
      return { data: record };
    }
    if (resource === "hosting-plans") {
      const data = await fetchIpmsWithAuth(`${CMS_API_URL}/hosting/plan`, {
        method: "POST",
        body: JSON.stringify(variables),
      });
      return { data: { id: Date.now(), ...data } as any };
    }
    if (resource === "receipt-documents") {
      const data = await fetchIpmsWithAuth(`${CMS_API_URL}/receipt/build`, {
        method: "POST",
        body: JSON.stringify(variables),
      });
      return { data: { id: data.receiptId, ...data } as any };
    }
    if (resource === "ipms-vertical-profile-applications") {
      const vars = variables as Record<string, unknown>;
      const profileId = vars.profileId;
      const operation = vars.operation === "apply" ? "apply" : "preview";
      const data = await fetchIpmsWithAuth(
        `${CMS_API_URL}/vertical-profiles/${encodeURIComponent(String(profileId))}/${operation}`,
        { method: "POST", body: JSON.stringify({}) }
      );
      return { data: { id: `${profileId}:${operation}`, ...data } as any };
    }

    const ipmsModuleRoutes: Record<string, Record<string, string>> = {
      governance: {
        "role-bind": "/governance/role/bind",
        "odrl-policy": "/governance/odrl/policy",
        "approval-gate": "/governance/approval-gate",
        "resolution": "/governance/resolution",
      },
      credentials: {
        "issue": "/credentials/issue",
        "verify": "/credentials/verify",
        "revoke": "/credentials/revoke",
      },
      members: {
        "provision": "/members/provision",
        "lifecycle": "/members/lifecycle",
        "notify": "/members/notify",
        "notify-organisation": "/members/notify-organisation",
        "access-grant": "/members/access-grant",
        "profile-build": "/profile/build",
        "ldn-notification": "/ldn/notification",
        "ldn-inbox-create": "/ldn/inbox/create",
        "ldn-send": "/ldn/send",
      },
      consent: { "build": "/consent/build" },
      delegation: { "build": "/delegation/build", "validate": "/delegation/validate" },
      emergency: { "break-glass": "/emergency/break-glass" },
      household: { "build": "/household/build" },
      inventory: { "check": "/inventory/check", "record": "/inventory/record" },
      loyalty: { "apply": "/loyalty/apply", "record": "/loyalty/record" },
      orgnetwork: { "unit": "/orgnetwork/unit" },
      pricing: { "wholesale": "/pricing/wholesale" },
      a11y: { "audit": "/a11y/audit" },
      business: { "hours-build": "/business/hours/build", "hours-check": "/business/hours/check" },
      consumer: { "access-request": "/consumer/access-request", "correction-request": "/consumer/correction-request" },
      i18n: { "negotiate": "/i18n/negotiate" },
      integration: { "manifest-validate": "/integration/manifest/validate", "job-validate": "/integration/job/validate" },
      theming: { "validate": "/theming/validate", "css": "/theming/css", "smithy-tokens": "/theming/smithy-tokens" },
      events: { "event": "/events/event" },
      ticketing: { "ticket": "/ticketing/ticket" },
      provenance: { "build": "/provenance" },
      social: { "note": "/social/note" },
      records: { "entry": "/records/entry" },
      licensing: { "licence": "/licensing/licence", "permit": "/licensing/permit" },
      reputation: { "aggregate": "/reputation/aggregate" },
      delivery: { "request": "/delivery/request" },
      access: { "evaluate": "/access/evaluate" },
      quotations: { "build": "/quotations/build" },
      "mcp.server": { "tools-list": "/mcp/tools/list", "tools-call": "/mcp/tools/call" },
    };

    const moduleRoutes = ipmsModuleRoutes[resource];
    if (moduleRoutes) {
      const actionKey = (meta as any)?.action ?? "build";
      const routePath = moduleRoutes[actionKey];
      if (routePath) {
        const data = await fetchIpmsWithAuth(`${CMS_API_URL}${routePath}`, {
          method: "POST",
          body: JSON.stringify(variables),
        });
        return { data: { id: Date.now(), ...data } as any };
      }
    }

    throw new Error(`Unsupported create resource: ${resource}`);
  },

  deleteOne: async () => {
    throw new Error("deleteOne not implemented for Smithy API");
  },

  getApiUrl: () => API_URL,
};
