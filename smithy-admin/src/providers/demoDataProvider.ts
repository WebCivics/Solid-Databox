//
// NOTE on the @ts-nocheck above (pre-existing): Refine's `DataProvider` methods are
// generic over a caller-chosen `TData extends BaseRecord`, so no concrete provider can
// satisfy them without casts at every return. The `DataProvider` annotation below
// declares the contract this object implements (and is what `<Refine>` typechecks
// against in App.tsx); runtime conformance is covered by driving the app.
//
// DEMO data provider — a fully in-memory, backend-free implementation used ONLY
// for the static GitHub Pages demo build (selected via VITE_DEMO in App.tsx).
//
// It never talks to the CSS Databox Smithy. The live app keeps using the real
// `dataProvider.ts` (which posts to http://localhost:3000/.databox/smithy); this
// file does not modify or import it. Everything here is synthetic sample data.

import { createPosOperationsSnapshot } from "../data/posOperations";

const SYNTHETIC_JWS =
  "eyJhbGciOiJFUzI1NiIsImtpZCI6ImRlbW8ja2V5LTEifQ." +
  "eyJpc3MiOiJodHRwczovL2RhdGFib3guZGVtby5leGFtcGxlL2lzc3VlciIsInN1YiI6InVybjp1dWlkOmRlbW8iLCJkZW1vIjp0cnVlfQ." +
  "SYNTHETIC-SIGNATURE-for-demo-only-not-a-real-signature";

// ── Seed: registered programs ───────────────────────────────────────────────
let mockPrograms = [
  {
    id: "prog-seraphim-welfare",
    profileId: "prog-seraphim-welfare",
    principalLegalName: "Seraphim Welfare Demonstrator (SYNTHETIC)",
    principalJurisdiction: "AU",
    programUri: "https://databox.demo.example/seraphim/program",
    databoxBaseUrl: "https://databox.demo.example/seraphim/boxes/",
    recordClasses: ["rc-case-note"],
    submissionClasses: [],
    recordClassBindings: [
      { id: "rc-case-note", label: "Case note", legalBasis: "lb-public-task", purposes: ["p-casework"] },
    ],
    legalComplianceClaimed: false,
  },
  {
    id: "prog-megamart-rewards-loyalty",
    profileId: "prog-megamart-rewards-loyalty",
    principalLegalName: "MegaMart Rewards Pty Ltd (SYNTHETIC)",
    principalJurisdiction: "AU",
    programUri: "https://databox.demo.example/megamart/program",
    databoxBaseUrl: "https://databox.demo.example/megamart/boxes/",
    recordClasses: ["rc-receipt", "rc-warranty", "rc-recall", "rc-rewards"],
    submissionClasses: ["sc-correction", "sc-warranty-claim", "sc-dietary-pref"],
    // Mirrors the loyalty profile's record-class → legal basis / purpose bindings.
    recordClassBindings: [
      { id: "rc-receipt", label: "Digital receipt", legalBasis: "lb-contract", purposes: ["p-account"] },
      { id: "rc-warranty", label: "Warranty record", legalBasis: "lb-contract", purposes: ["p-warranty"] },
      { id: "rc-recall", label: "Product recall notice", legalBasis: "lb-legal-obligation", purposes: ["p-safety"] },
      { id: "rc-rewards", label: "Rewards statement", legalBasis: "lb-contract", purposes: ["p-rewards"] },
    ],
    legalComplianceClaimed: false,
  },
];

// ── Seed: corrections / access-requests / consumer-ledger (mirrors the mocks
// already used by the live provider for these resources) ───────────────────
let mockCorrections = [
  { id: "req-1001", consumerUrn: "urn:uuid:1111-2222-3333-4444", targetRecord: "https://synthetic-corp.example/profiles/derived/ad_propensity", field: "derived:advertising_profile:income_bracket", currentValue: "$150k+", requestedCorrection: "$80k-$100k", status: "pending", submittedAt: new Date(Date.now() - 2 * 86400000).toISOString(), dueDate: new Date(Date.now() + 8 * 86400000).toISOString(), dispositionReason: "" },
  { id: "req-1002", consumerUrn: "urn:uuid:5555-6666-7777-8888", targetRecord: "https://synthetic-corp.example/financial/ledger/tx-999", field: "financial:ledger:transaction_amount", currentValue: "50.00", requestedCorrection: "5.00", status: "more-information-required", submittedAt: new Date(Date.now() - 5 * 86400000).toISOString(), dueDate: new Date(Date.now() + 5 * 86400000).toISOString(), dispositionReason: "Please provide a copy of the receipt." },
  { id: "req-1003", consumerUrn: "urn:uuid:9999-0000-1111-2222", targetRecord: "https://synthetic-corp.example/identity/core", field: "identity:core:legal_name", currentValue: "John Doe", requestedCorrection: "Jonathan Doe", status: "corrected", submittedAt: new Date(Date.now() - 15 * 86400000).toISOString(), dueDate: new Date(Date.now() - 5 * 86400000).toISOString(), dispositionReason: "Name updated successfully." },
];

let mockAccessRequests = [
  { id: "ar-2001", consumerUrn: "urn:uuid:1111-2222-3333-4444", scope: ["behavioral:location_history", "behavioral:search_history", "derived:advertising_profile", "social:graph_connections"], status: "pending", submittedAt: new Date(Date.now() - 3 * 86400000).toISOString(), dueDate: new Date(Date.now() + 7 * 86400000).toISOString(), regulatoryBasis: "CDR Rules Schedule 4, rule 7.22", dispositionReason: "" },
  { id: "ar-2002", consumerUrn: "urn:uuid:5555-6666-7777-8888", scope: ["identity:core", "financial:payment_instruments", "financial:transaction_ledger", "ugc:media_files"], status: "granted", submittedAt: new Date(Date.now() - 12 * 86400000).toISOString(), dueDate: new Date(Date.now() - 2 * 86400000).toISOString(), regulatoryBasis: "Privacy Act 1988, APP 12", dispositionReason: "Payload packaged and delivered via Databox broker." },
  { id: "ar-2003", consumerUrn: "urn:uuid:9999-0000-1111-2222", scope: ["health:biometrics:sleep_data", "health:biometrics:heart_rate"], status: "refused", submittedAt: new Date(Date.now() - 5 * 86400000).toISOString(), dueDate: new Date(Date.now() + 5 * 86400000).toISOString(), regulatoryBasis: "Privacy Act 1988, APP 12", dispositionReason: "Exception 12.3(a) - Access would pose a serious threat to the life, health or safety of any individual." },
];

let mockLedger = [
  { id: "urn:uuid:1111-2222-3333-4444", consumerName: "Alice Smith", dataPoints: [{ field: "behavioral:location_history", value: "[124,532 GPS points retained]", source: "Mobile App Telemetry", policy: "Consent: Service Provision" }, { field: "derived:advertising_profile", value: "{ income: 'High', propensity_score: 0.84, segments: ['Tech', 'Travel'] }", source: "Algorithmic Inference Engine", policy: "Consent: Marketing" }, { field: "social:graph_connections", value: "[482 Edge connections]", source: "Social Feed", policy: "Consent: Service Provision" }], lastActive: new Date().toISOString() },
  { id: "urn:uuid:5555-6666-7777-8888", consumerName: "Bob Jones", dataPoints: [{ field: "financial:transaction_ledger", value: "[$14,203.44 lifetime spend across 42 orders]", source: "Payment Gateway", policy: "Legal Obligation (Tax Retention)" }, { field: "financial:payment_instruments", value: "[Tokenized Visa ending in 4422]", source: "Vault", policy: "Contractual Obligation" }], lastActive: new Date(Date.now() - 1 * 86400000).toISOString() },
];

let mockOutboundRequests = [
  { id: "obr-3001", platformId: "con-google", platformName: "Google", category: "Consumer", persona: "natural-person", requesterId: "urn:uuid:9999-0000-1111-2222", scope: ["behavioral:location_history", "behavioral:search_history", "identity:core"], regulatoryBasis: "GDPR Art. 20 (Data Portability)", status: "sent", submittedAt: new Date(Date.now() - 4 * 86400000).toISOString(), dueDate: new Date(Date.now() + 26 * 86400000).toISOString() },
  { id: "obr-3002", platformId: "ent-salesforce", platformName: "Salesforce", category: "Enterprise", persona: "organisation", requesterId: "urn:uuid:org-smithy-0001", scope: ["identity:core", "financial:transaction_ledger"], regulatoryBasis: "CDR (Consumer Data Right)", status: "pending", submittedAt: new Date(Date.now() - 1 * 86400000).toISOString(), dueDate: new Date(Date.now() + 29 * 86400000).toISOString() },
];

const mockIpmsModules = [
  {
    id: "hosting",
    name: "Hosting",
    version: "0.1.0",
    description: "Guided domain, DNS and launch-configuration planning for the IPMS profile.",
    capabilities: ["ipms:hosting", "ipms:dns-plan"],
    routes: ["POST /.databox/ipms/hosting/plan"],
    enabled: true,
    capabilityMode: "css-enhanced",
    adminUi: { navLabel: "Hosting", path: "/hosting" },
  },
  {
    id: "receipt",
    name: "Receipt Writer",
    version: "0.1.0",
    description: "Printable receipt documents with QR links to the consumer RDF/VC receipt in the pod.",
    capabilities: [
      "ipms:receipt-document",
      "ipms:portable-core-receipt-doc",
      "ipms:css-enhanced-receipt-build-route",
      "ipms:native-edge-print-job-descriptor",
    ],
    routes: ["POST /.databox/ipms/receipt/build"],
    enabled: true,
    capabilityMode: "css-enhanced",
    adminUi: { navLabel: "Receipts", path: "/receipts" },
  },
  {
    id: "pos-operations",
    name: "POS Operations",
    version: "0.1.0",
    description: "Admin proof surfaces for counter POS, waiter ordering, self-order table sessions, and customer display frames.",
    capabilities: [
      "ipms:portable-core-schema-order",
      "ipms:portable-core-table-session",
      "ipms:portable-core-schema-offer",
      "ipms:css-enhanced-kitchen-display-intent",
      "ipms:native-edge-payment-and-printer-boundary",
    ],
    routes: [],
    enabled: true,
    capabilityMode: "css-enhanced",
    adminUi: { navLabel: "POS Terminal", path: "/pos" },
  },
];

const verticalModule = (moduleId: string, rationale: string, defaultConfig?: string) => ({
  moduleId,
  required: true,
  enabledByDefault: true,
  rationale,
  ...(defaultConfig
    ? { defaultConfig: { contentType: "text/turtle", turtle: defaultConfig } }
    : {}),
});

const withDemoAvailability = (profile: any) => {
  const installed = new Map(mockIpmsModules.map((module) => [module.id, module]));
  const modules = profile.modules.map((module: any) => {
    const manifest = installed.get(module.moduleId);
    return manifest
      ? {
          ...module,
          available: true,
          enabled: manifest.enabled,
          capabilityMode: manifest.capabilityMode,
          manifest,
        }
      : {
          ...module,
          available: false,
          enabled: false,
          capabilityMode: "unavailable",
          unavailableReason: "Synthetic demo: this horizontal module is not installed in the demo registry.",
        };
  });
  const missingModules = modules.filter((module: any) => !module.available).map((module: any) => module.moduleId);
  return {
    ...profile,
    modules,
    capabilityMode: "css-enhanced",
    controlPlaneAvailable: true,
    canApply: missingModules.length === 0,
    missingModules,
    unavailableModules: missingModules,
    degradationReason: missingModules.length > 0 ? `Missing horizontal modules: ${missingModules.join(", ")}.` : undefined,
  };
};

const mockVerticalProfiles = [
  withDemoAvailability({
    id: "food.restaurant",
    name: "Food / Restaurant",
    version: "0.1.0",
    description: "Small restaurant bundle for menus, commerce, reservations, receipts, and public SEO.",
    useCases: ["FOOD"],
    modules: [
      verticalModule("menu", "Menus are the public food offer and allergen-facing catalogue surface."),
      verticalModule("catalogue", "Catalogue resources hold products, modifiers, variants, and publishable item metadata.", '<> <https://schema.org/itemListOrder> "menu-section" .'),
      verticalModule("stock", "Stock keeps menu availability honest for a small operator."),
      verticalModule("payments", "Payments handles checkout adapters while keeping payment secrets out of portable works."),
      verticalModule("pos-operations", "POS operations compose counter checkout, waiter ordering, table self-order, and display frames from portable order resources.", '<> <urn:solid-server:databox:ipms#posProfile> "restaurant-service" .'),
      verticalModule("receipt", "Receipts produce RDF-backed proof of purchase and the printable QR payload.", '<> <urn:solid-server:databox:ipms#receiptProfile> "consumer-digital-receipt" .'),
      verticalModule("bookings", "Bookings supports table reservations, deposits, cancellation and rescheduling."),
      verticalModule("events", "Events covers special sittings, tastings, and venue programming."),
      verticalModule("opening-hours", "Opening hours provides ordinary schema.org availability for public discovery.", '<> <https://schema.org/servesCuisine> "local" .'),
      verticalModule("website-seo", "Website SEO publishes JSON-LD and discovery metadata without requiring CSS routes."),
    ],
  }),
  withDemoAvailability({
    id: "health.privacy-consent",
    name: "Health / Privacy Consent",
    version: "0.1.0",
    description: "Health privacy bundle for consent, access, correction, governance, delegation, and emergency access.",
    useCases: ["HEALTH"],
    modules: [
      verticalModule("consent", "Consent records purpose-limited processing decisions as RDF policy state.", '<> <urn:solid-server:databox:ipms#defaultPurpose> "care-provision" .'),
      verticalModule("access-request", "Access requests support patient rights over held records."),
      verticalModule("correction-request", "Correction requests support amendment workflows without destructive edits."),
      verticalModule("governance", "Governance supplies approval gates and auditable resolutions for sensitive handling.", '<> <urn:solid-server:databox:ipms#approvalMode> "dual-control-for-sensitive-data" .'),
      verticalModule("delegation", "Delegation gives carers and guardians scoped revocable authority."),
      verticalModule("break-glass", "Break-glass access is temporary, conditional, and audited for emergencies."),
      verticalModule("credential-gate", "Credential gates verify qualifications or care roles with minimal disclosure."),
    ],
  }),
];

const list = (data: unknown[]) => ({ data, total: data.length });

const planHosting = (input: any) => {
  const apex = input.apexDomain.trim();
  const origin = input.originTarget.trim();
  if (!apex.includes(".") || origin.length === 0) {
    throw new Error("A hosting plan needs an apex domain and origin target.");
  }
  const label = input.databoxLabel || "databox";
  const databoxHost = `${label}.${apex}`;
  const devicesHost = `devices.${apex}`;
  const wwwHost = input.wwwEnabled ? `www.${apex}` : undefined;
  const type = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(origin) ? "A" : origin.includes(":") ? "AAAA" : "CNAME";
  const proxied = input.proxied ?? true;
  const dnsRecords = [
    { type, name: databoxHost, content: origin, proxied, ttl: 1 },
    { type, name: devicesHost, content: origin, proxied: false, ttl: 1 },
  ];
  if (wwwHost) dnsRecords.push({ type, name: wwwHost, content: origin, proxied, ttl: 1 });
  const baseUrl = `https://${databoxHost}/`;
  return {
    id: Date.now(),
    databoxHost,
    wwwHost,
    devicesHost,
    baseUrl,
    dnsRecords,
    launchCommand: `npm run start:ipms -- --baseUrl ${baseUrl} --ipmsControlToken <32+ byte token>`,
  };
};

const buildReceiptDocument = (input: any) => {
  const lines = input.lines.map((line: any) => ({
    name: line.name,
    quantity: Number(line.quantity),
    amount: (Number(line.quantity) * Number(line.unitPrice)).toFixed(2),
  }));
  const subtotalNum = input.lines.reduce(
    (total: number, line: any) => total + Number(line.quantity) * Number(line.unitPrice),
    0
  );
  const subtotal = subtotalNum.toFixed(2);
  const tax =
    input.taxPercent === undefined || input.taxPercent === ""
      ? undefined
      : (Math.round(subtotalNum * Number(input.taxPercent)) / 100).toFixed(2);
  const total = tax === undefined ? subtotal : (subtotalNum + Number(tax)).toFixed(2);
  const qr = {
    payload: new URL(input.digitalReceiptUrl).href,
    caption: "Scan for your digital receipt",
  };
  const document = {
    id: input.receiptId,
    org: input.org,
    receiptId: input.receiptId,
    date: input.date,
    currency: input.currency,
    lines,
    subtotal,
    ...(tax === undefined ? {} : { tax }),
    total,
    qr,
  };

  return {
    ...document,
    nativeEdgePrintJob: {
      "@context": {
        schema: "https://schema.org/",
        ipms: "urn:solid-server:databox:ipms#",
        nativeEdge: "urn:solid-server:databox:native-edge#",
      },
      type: "DataboxNativeReceiptPrintJob",
      id: `urn:solid-server:databox:native-edge:receipt-print-job:${encodeURIComponent(input.receiptId)}`,
      capability: "native-edge:thermal-receipt-print",
      status: "unavailable",
      unavailableReason: "No Rust/native-edge printer connector is attached to this IPMS control plane.",
      target: {
        kind: "thermal-printer",
        protocol: "escpos",
      },
      payload: {
        format: "databox.receipt.v1",
        receiptId: input.receiptId,
        date: input.date,
        currency: input.currency,
        lines,
        subtotal,
        ...(tax === undefined ? {} : { tax }),
        total,
        qr: {
          ...qr,
          render: "native-edge",
        },
      },
      boundary: {
        hardwareIo: "native-edge-only",
        browserAction: "generate-descriptor-only",
      },
    },
  };
};

export const demoDataProvider = {
  getList: async ({ resource }: any) => {
    switch (resource) {
      case "programs": return list(mockPrograms);
      case "corrections": return list(mockCorrections);
      case "access-requests": return list(mockAccessRequests);
      case "consumer-ledger": return list(mockLedger);
      case "outbound-requests": return list(mockOutboundRequests);
      case "ipms-modules": return list(mockIpmsModules);
      case "ipms-vertical-profiles": return list(mockVerticalProfiles);
      case "pos-operations": return list([createPosOperationsSnapshot("demo", "css-enhanced", true)]);
      default: return list([]);
    }
  },

  getOne: async ({ resource, id }: any) => {
    const pick = (arr: any[]) => {
      const record = arr.find((r) => r.id === id);
      if (!record) throw new Error(`${resource} not found in demo data.`);
      return { data: record };
    };
    switch (resource) {
      case "corrections": return pick(mockCorrections);
      case "access-requests": return pick(mockAccessRequests);
      case "consumer-ledger": return pick(mockLedger);
      case "outbound-requests": return pick(mockOutboundRequests);
      case "ipms-modules": return pick(mockIpmsModules);
      case "ipms-vertical-profiles": return pick(mockVerticalProfiles);
      default: throw new Error(`getOne not supported for '${resource}' in demo mode.`);
    }
  },

  create: async ({ resource, variables }: any) => {
    if (resource === "programs") {
      // Mirrors the Smithy: the profile is the source of truth for id and principal.
      const profile = variables.profile ?? {};
      const profileId = profile.profileId || `prog-demo-${Date.now()}`;
      const principal = profile.program?.principal ?? {};
      const record = {
        id: profileId,
        profileId,
        profileVersion: profile.profileVersion || "1.0.0",
        principalLegalName: principal.legalName || "New Demo Program (SYNTHETIC)",
        principalJurisdiction: principal.jurisdiction || "AU",
        programUri: variables.programUri || `https://databox.demo.example/programs/${encodeURIComponent(profileId)}`,
        databoxBaseUrl: variables.databoxBaseUrl || "https://databox.demo.example/boxes/",
        recordClasses: (profile.recordClasses ?? []).map((r: any) => r.id ?? r),
        submissionClasses: (profile.submissionClasses ?? []).map((s: any) => s.id ?? s),
        recordClassBindings: (profile.recordClasses ?? []).map((r: any) => ({
          id: r.id ?? r,
          label: r.label ?? r.id ?? r,
          legalBasis: r.legalBasis ?? "",
          purposes: r.purposes ?? [],
        })),
        legalComplianceClaimed: false,
      };
      mockPrograms = [record, ...mockPrograms.filter((p) => p.profileId !== profileId)];
      return { data: record };
    }

    if (resource === "mappings") {
      const pairwiseWebId = variables.pairwiseWebId || "https://consumer-pod.example/profile/card#demo";
      const databox = "https://databox.demo.example/boxes/opaque-" + Math.random().toString(16).slice(2, 10) + "/";
      return {
        data: {
          provisioning: { relationship: { relationshipId: "rel-demo-" + Date.now() }, databox: { root: databox } },
          credential: {
            jws: SYNTHETIC_JWS,
            connectionId: "conn-demo-" + Date.now(),
            credential: {
              issuer: "https://databox.demo.example/issuer",
              credentialSubject: {
                id: pairwiseWebId,
                connection: {
                  program: "https://databox.demo.example/program",
                  databox,
                  storageDescription: `${databox}.well-known/solid`,
                  accessGrant: `${databox}access-grant`,
                  relationship: "rel-demo",
                },
              },
            },
          },
        },
      };
    }

    if (resource === "source-events" || resource === "events") {
      const acceptedResource = "https://databox.demo.example/boxes/opaque-demo/records/" + Math.random().toString(16).slice(2, 10);
      return {
        data: {
          status: "reconciled",
          reconciliation: { sourceEventId: variables.sourceEventId || "demo", acceptedResource },
          receipt: { jws: SYNTHETIC_JWS },
        },
      };
    }

    if (resource === "outbound-requests") {
      const now = Date.now();
      const record = { id: `obr-${now}`, status: "pending", ...variables, submittedAt: new Date(now).toISOString(), dueDate: new Date(now + 30 * 86400000).toISOString() };
      mockOutboundRequests = [record, ...mockOutboundRequests];
      return { data: record };
    }

    if (resource === "hosting-plans") {
      return { data: planHosting(variables) };
    }

    if (resource === "receipt-documents") {
      return { data: buildReceiptDocument(variables) };
    }

    if (resource === "ipms-vertical-profile-applications") {
      const profile = mockVerticalProfiles.find((item) => item.id === variables.profileId);
      if (!profile) throw new Error("Vertical profile not found in demo data.");
      const operation = variables.operation === "apply" ? "apply" : "preview";
      if (operation === "apply" && !profile.canApply) {
        throw new Error(profile.degradationReason || "This vertical profile cannot be applied in the demo registry.");
      }
      return {
        data: {
          id: `${profile.id}:${operation}`,
          ...profile,
          operation,
          persisted: operation === "apply",
          defaults: profile.modules.map((module: any) => ({
            moduleId: module.moduleId,
            enabled: module.enabledByDefault,
            contentType: module.defaultConfig?.contentType ?? "text/turtle",
            configTurtle: module.defaultConfig?.turtle ?? "",
          })),
        },
      };
    }

    return { data: { id: Date.now(), ...variables } };
  },

  update: async ({ resource, id, variables }: any) => {
    const patch = (arr: any[]) => {
      const index = arr.findIndex((r) => r.id === id);
      if (index === -1) throw new Error(`${resource} not found in demo data.`);
      arr[index] = { ...arr[index], ...variables };
      return { data: arr[index] };
    };
    switch (resource) {
      case "corrections": return patch(mockCorrections);
      case "access-requests": return patch(mockAccessRequests);
      case "outbound-requests": return patch(mockOutboundRequests);
      case "ipms-modules": return patch(mockIpmsModules);
      default: throw new Error(`update not supported for '${resource}' in demo mode.`);
    }
  },

  deleteOne: async ({ id }: any) => ({ data: { id } }) as any,

  getApiUrl: () => "demo://in-memory",
};
