# Functionality Audit — Solid Databox

> Survey of produced functionality versus documented functionality.
> Generated to identify documentation gaps across the gh-pages landing page, MkDocs site, and README.md.

## Method

A full-tree inventory was performed of `src/databox/`, `smithy-admin/`, `native/`, `rust/`, `org-mobile-apps/`, `apps/`, `docs/`, `documentation/`, `databox/`, `config/databox/`, `scripts/`, and `test/`. Each subsystem was classified by area, its source files listed, and its current documentation coverage assessed.

---

## 1. Core Databox Engine (`src/databox/`)

### 1.1 Agent (`src/databox/agent/`)

| File | Purpose |
|---|---|
| `AgentTypes.ts` | Agent role types, acting-agent vs represented-person separation |
| `ConsumerConnectionRegistry.ts` | Registry of consumer connection credentials per agent |
| `InertRecord.ts` | Inert (non-actionable) record type for pass-through storage |
| `LocalKnowledgeStore.ts` | Consumer-side local copy store |
| `OdrlTermsPresenter.ts` | Human-readable presentation of ODRL terms for the consumer |
| `ReferenceConsumerAgent.ts` | Reference implementation of a consumer-pod agent |
| `ScopedSubmission.ts` | Scoped consumer submission type |

**Documented:** README mentions "reference consumer agent" in the repository guide table. Developer guide mentions it in architecture-and-design.md. Not documented in gh-pages or MkDocs.

### 1.2 Authorization (`src/databox/authorization/`)

| File | Purpose |
|---|---|
| `AuthorizationReasonCodes.ts` | Reason codes for authorization decisions |
| `ComposedAuthorizationEngine.ts` | Composed authorization engine combining multiple readers |
| `ComposedDataboxPermissionReader.ts` | Permission reader integrating Databox policy with WAC/ACP |
| `DataboxAuthorizationInput.ts` | Authorization input assembly (context + resource + action) |
| `DataboxAuthorizer.ts` | Main Databox authorizer component |
| `SafeStepUpResponse.ts` | Step-up authentication response handling |

**Documented:** README "What it does" section mentions assurance checks and step-up. ADR-0003 and ADR-0006 cover the design. Not in gh-pages or MkDocs.

### 1.3 Bridge (`src/databox/bridge/`)

| File | Purpose |
|---|---|
| `BridgeTypes.ts` | Bridge interfaces, source-event types, customer reference types |
| `DataboxBridge.ts` | Synthetic institutional bridge: source-event → record → deposit |
| `InstitutionalRecordBuilder.ts` | Transforms source events into signed institutional records |
| `RelationshipResolver.ts` | Resolves protected customer references to opaque Databox relationships |
| `SourceOutbox.ts` | Transactional source-outbox consumption with cursor |

**Documented:** README mentions "institutional bridge" in the repository guide. Developer guide mentions it. Architecture doc covers the integration plane. Not in gh-pages or MkDocs.

### 1.4 IPMS — Content Management System (`src/databox/ipms/`)

| File | Purpose |
|---|---|
| `BuiltInModules.ts` | Registry and definitions of all 50+ built-in IPMS modules |
| `CashRegisterStore.ts` | Cash register state store |
| `IpmsHttpHandler.ts` | Main IPMS HTTP handler — serves all IPMS routes, module APIs, admin panel |
| `IpmsHttpUtils.ts` | HTTP utilities for IPMS handler |
| `IpmsMigrationProof.ts` | Migration proof for IPMS from legacy handler |
| `IpmsModuleRouter.ts` | Routes requests to enabled IPMS modules |
| `CustomerDisplayStore.ts` | Customer-facing display state (kiosk/promotional) |
| `DataboxModuleRegistry.ts` | Module registry: enable/disable, capability declarations |
| `ModuleConfigShapes.ts` | SHACL shapes for module configuration |
| `ModuleConfigStore.ts` | Per-module configuration storage |
| `ModuleManifestDiscovery.ts` | Discovers module manifests from filesystem |
| `ModuleManifestRdf.ts` | RDF manifest parsing for modules |
| `OrgAppApi.ts` | Org-app boot API for mobile container |
| `OrgAppManifest.ts` | RDF manifest for org mobile apps |
| `OxigraphIpmsHydration.ts` | Oxigraph-backed IPMS hydration |
| `OxigraphIpmsSync.ts` | IPMS ↔ Oxigraph synchronisation |
| `OxigraphIpmsSyncComposition.ts` | Components.js composition for Oxigraph sync |
| `PortableIpmsWorks.ts` | Portable IPMS works — migration proof, compatibility layer |
| `PosOrderStore.ts` | POS order state store |
| `PublicWebsiteStore.ts` | Public website content store (Schema.org, sitemap, SEO) |
| `SolidModuleManifest.ts` | Solid module manifest type |
| `TableSessionStore.ts` | Table session state for restaurant POS |
| `VerticalProfile.ts` | Industry vertical profile system (restaurant, welfare, retail, etc.) |

**Documented:** README mentions "IPMS Modules" in the gh-pages landing page feature list. Smithy-admin README mentions modules page. Not documented in MkDocs. The full scope of the IPMS (50+ modules, Oxigraph sync, vertical profiles, module manifests) is not documented anywhere public-facing.

### 1.5 IPMS Modules (`src/databox/ipms/modules/`) — 50+ modules

| Module | Key files | Purpose |
|---|---|---|
| `a11y/` | A11yApi, Audit, Contrast | Accessibility auditing, contrast checking |
| `access/` | AccessApi, CredentialGate | Credential-gated access control |
| `accounting/` | AccountingApi, AccountingBridge | Accounting bridge (20KB), ledger integration |
| `allergy-profile/` | AllergenMatcher, AllergyProfile, AllergyProfileApi, IngredientDeclaration | Allergen matching, ingredient declarations, allergy profiles |
| `backups/` | BackupApi, BackupManager | Backup management |
| `barcode/` | BarcodeApi, BarcodeScanner | Barcode scanning (13KB) |
| `bookings/` | Availability, BookingsApi, Reservation | Booking/reservation system |
| `business/` | BusinessApi, OpeningHours | Business info, opening hours |
| `catalogue/` | CatalogueApi, Variants | Product catalogue with variants |
| `concessions/` | Concessions, ConcessionsApi | Concession/entitlement management |
| `consent/` | Consent, ConsentApi | Consent management |
| `consumer/` | AccessRequest, ConsumerApi, CorrectionRequest | Consumer access/correction requests |
| `credentials/` | Attestation, CredentialApi, CredentialLifecycle | W3C VC issuance, verification, lifecycle |
| `delegation/` | Delegation, DelegationApi | Delegation management |
| `delivery/` | DeliveryApi, DeliveryRequest, DriverManagement, DriverManagementApi | Delivery management, driver dispatch |
| `device-auth/` | DeviceAuth, DeviceAuthApi | Device authentication |
| `discounts/` | Discounts, DiscountsApi | Discount engine (9KB) |
| `donations/` | Donations, DonationsApi | Privacy-shielded donations |
| `eftpos/` | EftposApi, EftposTerminal | EFTPOS terminal integration (8KB) |
| `emergency/` | BreakGlass, EmergencyApi | Emergency break-glass access |
| `events/` | Event, EventsApi | Event management |
| `feeds/` | FeedsApi, ProductFeed | Product feeds |
| `governance/` | Governance, GovernanceApi, Resolution | Governance, role bindings, resolution workflows |
| `hosting/` | CloudflareApi, HostingApi, HostingConfig | Cloudflare DNS/tunnel, hosting setup |
| `household/` | Household, HouseholdApi | Household management |
| `hr/` | Hr, HrApi | HR module (11KB) |
| `i18n/` | Catalog, I18nApi, LocaleNegotiation | Internationalisation, locale negotiation |
| `integration/` | ConnectorContract, ConnectorRuntimePlan, IntegrationApi, R2rml | ODBC/LDAP connector contracts, R2RML mapping, runtime plans |
| `inventory/` | InventoryApi, Stock | Inventory management |
| `jobs/` | JobsApi, WorkOrder | Job/work-order management |
| `licensing/` | Licence, LicensingApi | Licensing management |
| `loyalty/` | Loyalty, LoyaltyApi | Loyalty program management |
| `mcp/` | McpServerApi | Model Context Protocol server API |
| `menu/` | Menu, MenuApi | Menu management |
| `notifications/` | Notifications, NotificationsApi | Notification management (7KB) |
| `orgnetwork/` | OrgNetworkApi, OrgUnit | Org network/unit management |
| `payments/` | PaymentsApi, Receipt, Refund, Split, Subscription, Tax | Payments, refunds, splits, subscriptions, tax |
| `pos/` | Cart, CashRegister, CustomerDisplay, CustomerOrdering, Discount, NativePosDeviceContract, Order, PosApi, PosValidation, Promotion, TableSession, Ticket | Full POS: cart, cash register (30KB), customer display (26KB), customer ordering (17KB), native device contract (43KB), order management (21KB), promotions, table sessions, tickets |
| `pricing/` | PricingApi, Wholesale | Pricing, wholesale pricing |
| `print/` | PrintShop, PrintShopApi | Print shop management (9KB) |
| `profile/` | LdnInbox, MemberInteraction, MemberPod, PersonProfile, ProfileApi | Member profiles, LDN inbox, pod provisioning, member interaction |
| `provenance/` | Provenance, ProvenanceApi | Provenance tracking |
| `quotations/` | QuotationApi, QuotationRenderer | Quotation management and rendering |
| `receipt/` | ReceiptApi, ReceiptDoc | Receipt documents |
| `records/` | RecordEntry, RecordsApi | Record entries |
| `reputation/` | Reputation, ReputationApi | Reputation management |
| `social/` | Note, SocialApi | Social notes |
| `tax/` | Tax, TaxApi | Tax engine (7KB) |
| `theming/` | ThemingApi, Tokens | Theming tokens (23KB) |
| `ticketing/` | Ticket, TicketingApi | Ticketing |
| `website/` | CustomerDisplayRenderer, PublicFeedRenderer, Seo, SitemapRobots, WebsiteApi | Public website: customer display renderer (49KB), public feed renderer (31KB), SEO, sitemap/robots |

**Documented:** gh-pages landing page mentions POS Terminal, Waiter Ordering, Customer Self-Order, Promotional Display, Receipt Management, IPMS Modules, Connector Mappings, Event Dispatcher, Program Management, Hosting Setup, Governance, Verifiable Credentials, Member Management, Operations, Access Requests, Correction Requests, Consumer Ledger, Data Portability. However, the full breadth of 50+ modules is not enumerated. Many modules (allergy-profile, barcode, bookings, concessions, delivery, discounts, donations, eftpos, emergency, household, hr, inventory, jobs, licensing, loyalty, mcp, print, quotations, reputation, social, tax, theming, ticketing, provenance, etc.) are not mentioned anywhere in public-facing documentation.

### 1.6 Compliance (`src/databox/compliance/`)

| File | Purpose |
|---|---|
| `AustralianComplianceRegistry.ts` | AU legislation registry, pinned sources |
| `ComplianceDigest.ts` | Compliance digest computation |
| `ComplianceEngine.ts` | Compliance evaluation engine |
| `ComplianceTypes.ts` | Compliance types, control mappings |
| `ComplianceViews.ts` | Compliance projection views |

**Documented:** README "What it does" section mentions compliance decision support. Not in gh-pages or MkDocs.

### 1.7 Connection Credentials (`src/databox/credential/`)

| File | Purpose |
|---|---|
| `BitstringStatusList.ts` | W3C Bitstring Status List for credential revocation |
| `ConnectionCredentialIssuer.ts` | Issues holder-bound connection credentials (JWS) |
| `ConnectionCredentialRegistry.ts` | Registry of issued credentials, rotation, revocation |
| `ConnectionCredentialTypes.ts` | Credential type definitions |
| `ConnectionCredentialValidator.ts` | Validates connection credentials, holder-key proof |
| `Es256.ts` | ES256 signing/verification |
| `HolderKeyProof.ts` | Holder key proof (DPoP-bound) |
| `ProvisionalTokenExchange.ts` | RFC 8693 token exchange |

**Documented:** README mentions connection credentials. Developer guide mentions them. ADR-0007 covers the format. Not in gh-pages or MkDocs.

### 1.8 Evidence (`src/databox/evidence/`)

| File | Purpose |
|---|---|
| `AuditEvidence.ts` | Audit evidence collection |
| `AuditProjection.ts` | Audit projection for consumer-facing views |
| `Evidence.ts` | Evidence types |
| `EvidenceChain.ts` | Evidence chain linking |
| `EvidenceLedgerStore.ts` | Append-only evidence ledger store |

**Documented:** README mentions evidence chain. Developer guide mentions it. Not in gh-pages or MkDocs.

### 1.9 Feed (`src/databox/feed/`)

| File | Purpose |
|---|---|
| `CursorFeed.ts` | Cursor-based recovery feed with pagination |

**Documented:** README mentions "recovery feeds". Not in gh-pages or MkDocs.

### 1.10 Smithy (`src/databox/smithy/`)

| File | Purpose |
|---|---|
| `MappingSmithy.ts` | Core mapping smithy: program registration, mapping, event dispatch |
| `MappingSmithyHttpApi.ts` | HTTP API for the smithy control plane |

**Documented:** README documents the smithy API endpoints. Developer guide has a smithy-api.md. gh-pages landing page mentions the smithy. Well documented.

### 1.11 Gateway (`src/databox/gateway/`)

| File | Purpose |
|---|---|
| `BinaryEvidenceQuarantine.ts` | Binary evidence quarantine for untrusted payloads |
| `DepositSubmissionGateway.ts` | Deposit/submission gateway (15KB) |
| `GatewayReasonCodes.ts` | Gateway reason codes |
| `GatewayTypes.ts` | Gateway types |
| `IdempotencyRegistry.ts` | Idempotency registry for deposits |
| `RdfShapeValidator.ts` | RDF shape validation for deposits |
| `RealEvidenceScanners.ts` | Real evidence scanners (12KB) |

**Documented:** README mentions idempotency, reconciliation, evidence. Not in gh-pages or MkDocs.

### 1.12 Identifiers (`src/databox/identifiers/`)

| File | Purpose |
|---|---|
| `OpaqueIdentifierGenerator.ts` | 128-bit cryptographically secure opaque ID generation |

**Documented:** README mentions "opaque, program-scoped Databox URLs". Not in gh-pages or MkDocs.

### 1.13 Integration (`src/databox/integration/`)

| File | Purpose |
|---|---|
| `CssDataboxStore.ts` | CSS-backed Databox store |
| `LiveDataboxHttpHandler.ts` | Live HTTP handler for DBX-25 integration |

**Documented:** README mentions live CSS integration. Developer guide covers it. gh-pages mentions it.

### 1.14 Notification (`src/databox/notification/`)

| File | Purpose |
|---|---|
| `EndpointValidator.ts` | SSRF-guarded notification endpoint validation |
| `NotificationDelivery.ts` | Notification delivery interface |
| `NotificationHint.ts` | Notification hint types |
| `OutboundNotificationChannel.ts` | Outbound notification channel management |
| `OutboxDrainer.ts` | Transactional outbox drainer with cursor recovery (11KB) |

**Documented:** README mentions notifications and recovery. Not in gh-pages or MkDocs.

### 1.15 ODRL (`src/databox/odrl/`)

| File | Purpose |
|---|---|
| `TermSupport.ts` | ODRL term support helpers |
| `terms.ts` | ODRL vocabulary terms |

**Documented:** README mentions ODRL. Developer guide has policies-and-odrl.md. Not in gh-pages or MkDocs.

### 1.16 Policy (`src/databox/policy/`)

| File | Purpose |
|---|---|
| `BundleAdmission.ts` | Policy bundle admission control |
| `ComplexityGuard.ts` | Policy complexity guard |
| `ConflictStrategy.ts` | ODRL conflict resolution strategy (7KB) |
| `ConstraintEvaluation.ts` | Constraint evaluation |
| `DutyEngine.ts` | ODRL duty engine (14KB) |
| `DutyHandlers.ts` | Duty handlers |
| `DutyStateMachine.ts` | Duty state machine |
| `PolicyBundle.ts` | Versioned policy bundle (9KB) |
| `PolicyEngine.ts` | Policy engine entry point |
| `PolicyEvaluator.ts` | Policy evaluator (8KB) |
| `PolicyRegistry.ts` | Policy registry |

**Documented:** README mentions ODRL policies, duties, conflict strategy. Developer guide covers it. Not in gh-pages or MkDocs.

### 1.17 Profile (`src/databox/profile/`)

| File | Purpose |
|---|---|
| `InstitutionProfile.ts` | Institution profile type (18KB) |
| `InstitutionProfileSchema.ts` | JSON schema for institution profiles (13KB) |
| `InstitutionProfileValidator.ts` | Profile validator (28KB) |

**Documented:** README mentions institution profiles. Developer guide has institution-profile.md. Not in gh-pages or MkDocs.

### 1.18 Proof (`src/databox/proof/`)

| File | Purpose |
|---|---|
| `Canonicalization.ts` | RDF canonicalization for proof verification |
| `IssuerTrustStore.ts` | Issuer trust store |
| `OfflineVerification.ts` | Offline proof verification |
| `RecordProofTypes.ts` | Record proof types (12KB) |
| `RecordProofValidator.ts` | Record proof validator (12KB) |

**Documented:** README mentions "record-proof validation". Not in gh-pages or MkDocs.

### 1.19 Provisioning (`src/databox/provisioning/`)

| File | Purpose |
|---|---|
| `DataboxProvisioner.ts` | Databox provisioner (11KB) |
| `ProvisioningTypes.ts` | Provisioning types |
| `RelationshipMappingRegistry.ts` | Relationship mapping registry |

**Documented:** README mentions provisioning. Developer guide covers it. gh-pages mentions it.

### 1.20 Receipt (`src/databox/receipt/`)

| File | Purpose |
|---|---|
| `AcceptanceReceiptSigner.ts` | Signed acceptance receipt issuer (12KB) |
| `AcceptanceReceiptVerifier.ts` | Receipt verifier (9KB) |
| `DurableCommit.ts` | Durable commit before receipt issuance |
| `ReceiptStateProgression.ts` | Receipt state progression |
| `ReceiptTypes.ts` | Receipt types (8KB) |

**Documented:** README mentions signed receipts. Developer guide covers it. gh-pages mentions "Cryptographic Receipts".

### 1.21 Review (`src/databox/review/`)

| File | Purpose |
|---|---|
| `AppendOnlyDispositionStore.ts` | Append-only disposition store |
| `DispositionWorkflow.ts` | Governed review/disposition workflow (19KB) |
| `GovernedReviewQueue.ts` | Governed review queue (9KB) |
| `ReviewAssurance.ts` | Review assurance checks |
| `ReviewTypes.ts` | Review types (10KB) |
| `SignedDisposition.ts` | Signed disposition (7KB) |

**Documented:** README mentions review and disposition workflows. Not in gh-pages or MkDocs.

### 1.22 Storage (`src/databox/storage/`)

| File | Purpose |
|---|---|
| `AppendOnlyEvidence.ts` | Append-only evidence storage |
| `AppendOnlyStore.ts` | Append-only store (11KB) |
| `AppendOnlySupersession.ts` | Supersession handling |
| `AppendOnlyTombstone.ts` | Tombstone handling |

**Documented:** README mentions append-only, supersession, tombstone. Not in gh-pages or MkDocs.

### 1.23 Tenant (`src/databox/tenant/`)

| File | Purpose |
|---|---|
| `TenantBindingRegistry.ts` | Tenant binding registry |
| `TenantContext.ts` | Tenant context |
| `TenantIsolationGuard.ts` | Tenant isolation guard |
| `TenantResolver.ts` | Tenant resolver (9KB) |

**Documented:** README mentions tenant isolation. ADR-0002 covers it. Not in gh-pages or MkDocs.

### 1.24 Context (`src/databox/context/`)

| File | Purpose |
|---|---|
| `AssuranceCrosswalk.ts` | Assurance crosswalk between IdP claims and Databox levels (12KB) |
| `AuthenticatedContextExtractor.ts` | Authenticated context extractor (9KB) |
| `DataboxRequestContext.ts` | Request context assembly |

**Documented:** README mentions assurance checks. ADR-0010 covers it. Not in gh-pages or MkDocs.

---

## 2. Smithy Admin Console (`smithy-admin/`)

A Refine/React 19 / Vite 8 / Tailwind v4 single-page application.

### 2.1 Pages (24 routes)

| Page | Route | Purpose |
|---|---|---|
| Programs List | `/programs` | List registered programs |
| Onboard Organization | `/programs/create` | Register institution profile |
| Mappings Simulator | `/mappings` | Provision relationship mapping |
| Mapping Builder | `/mappings/builder` | Guided mapping builder |
| Event Dispatcher | `/events` | Dispatch source events |
| Organization Set-up | `/setup` | Rich onboarding with ANZSIC classification |
| Data Portability | `/data-portability` | ~345-platform portability registry |
| IPMS Modules | `/ipms/modules` | Module enable/disable management |
| Hosting | `/hosting` | Cloudflare DNS/tunnel setup |
| Governance | `/governance` | Role bindings, ODRL policy management |
| Credentials | `/credentials` | VC issuance, verification, revocation |
| Members | `/members` | Member pod provisioning, LDN notifications |
| Operations | `/operations` | Phase 3 operational horizontals |
| Receipts | `/receipts` | Receipt browsing and search |
| POS Terminal | `/pos` | Full point-of-sale interface |
| Waiter Orders | `/waiter` | Table-side order management |
| Customer Self-Order | `/pos/customer` | Kiosk-style self-service |
| Promotion Display | `/pos/display` | Digital signage preview |
| Corrections | `/corrections` | Consumer correction requests |
| Access Requests | `/access-requests` | Consumer access requests |
| Consumer Ledger | `/consumer-ledger` | Per-consumer data ledger |
| Tax | `/tax` | Tax management |
| Concessions | `/concessions` | Concession management |
| Discounts | `/discounts` | Discount management |
| Donations | `/donations` | Donation management |

### 2.2 Data Providers

| Provider | Mode | Purpose |
|---|---|---|
| `dataProvider.ts` | Live | Talks to Smithy API at `/.databox/smithy` |
| `demoDataProvider.ts` | Demo | Fully in-memory, backendless (GitHub Pages) |
| `standardSolidDataProvider.ts` | Standard Solid | Portable-core mode using Solid resource operations |

### 2.3 Internationalisation

- **41 languages** with full translation files in `src/locales/`
- Language selector with preference persistence
- Covers European, South American, Asian, and Middle Eastern regions

### 2.4 Reference Data

- `informationCategories.ts` (94KB) — 219 information categories across 14 groups, 14 sector packs, AU/EU/Standards layered basis
- `institutionProfile.ts` — Institution profile reference data
- `posOperations.ts` — POS operations reference data
- `baseline-institution-profile.json` — Baseline profile fixture

**Documented:** smithy-admin/README.md is comprehensive. gh-pages landing page covers many features. MkDocs does not mention it.

---

## 3. Native / Rust Components

### 3.1 POS Edge (`native/pos-edge/`)

Rust native POS edge component for direct hardware integration.

| File | Purpose |
|---|---|
| `main.rs` | Entry point, HTTP server |
| `http.rs` | HTTP server (5KB) |
| `ipc.rs` | Inter-process communication (3KB) |
| `printer.rs` | ESC/POS thermal printer support (3KB) |
| `qr.rs` | QR code generation (2KB) |
| `jobs.rs` | Print job queue (3KB) |
| `hardware/` | Hardware abstraction (4 files) |

**Documented:** gh-pages landing page mentions "Native POS Edge" with Rust hardware bridge, thermal printer, cash drawer, HTTP & IPC. Not in README or MkDocs.

### 3.2 Installer (`native/installer/`)

Cross-platform installer (macOS-focused).

| File | Purpose |
|---|---|
| `main.rs` | Entry point (4KB) |
| `config.rs` | Configuration (5KB) |
| `deploy.rs` | Deployment (5KB) |
| `deps.rs` | Dependency management |
| `handoff.rs` | Handoff to installed service |
| `handshake.rs` | Handshake protocol |
| `node.rs` | Node.js binary provisioning (8KB) |
| `preflight.rs` | Pre-flight checks (3KB) |
| `service.rs` | Service registration via launchd (6KB) |
| `shape.rs` | Installation shape/validation (3KB) |

**Documented:** gh-pages landing page mentions "Cross-Platform Installer" with macOS support, platform-aware Node.js provisioning, native service registration. Not in README or MkDocs.

### 3.3 Rust Components (`rust/`)

| Component | Purpose |
|---|---|
| `connector-sidecar/` | Connector sidecar for IPMS integration (ODBC/LDAP) |
| `pos-edge-proxy/` | POS edge proxy |
| `tray-supervisor/` | System tray supervisor for desktop management |

**Documented:** Not documented anywhere public-facing.

---

## 4. Org Mobile Apps (`org-mobile-apps/`)

A unified WASM/PWA container that fetches its identity, features, and permissions from the IPMS at runtime.

### 4.1 App Profiles (6 profiles)

| Profile | Network scope | Purpose |
|---|---|---|
| `waiter-app.ttl` | local-only | Table-side order management |
| `driver-app.ttl` | remote-capable | Delivery driver app |
| `tradie-app.ttl` | local-only | Tradie/trade app |
| `print-app.ttl` | local-only | Print shop app |
| `scorekeeper-app.ttl` | local-only | Scorekeeper app |
| `referee-app.ttl` | local-only | Referee app |

### 4.2 Container (`org-mobile-apps/container/`)

- Vite/React PWA shell with service worker
- Solid-OIDC authentication
- Dynamic UI module loader from IPMS
- Network scope enforcement via service worker
- Per-install VC licensing

**Documented:** org-mobile-apps/README.md is comprehensive. Not mentioned in gh-pages, README.md, or MkDocs.

---

## 5. Tradie App (`apps/tradie-app/`)

Separate Vite/React application.

**Documented:** Not mentioned in gh-pages, README.md, or MkDocs.

---

## 6. GitHub Pages (`docs/`)

### 6.1 Landing Page (`docs/index.html`)

- Three.js animated background
- Hero section with "Solid for Organisations" messaging
- Key features (4 items), developer resources
- ESG governance section
- Platform features grid (Commerce & POS, Infrastructure & Hosting, Governance & Credentials, Consumer Rights)
- 41-language international support section
- Cross-platform installer section
- Native POS Edge section
- Industry applications (dynamic from `use-cases.json`)
- Interactive demonstrators: Seraphim Consumer Portal, Seraphim Admin Panel, MegaMart Loyalty Smithy
- QR code provisioning demos

### 6.2 Admin Console Demo (`docs/admin/`)

- Static build of smithy-admin in demo mode
- Published at `/admin/`

### 6.3 Smithy Control Panel (`docs/smithy/`)

- Minimal dependency-free Programs/Mappings/Events console
- Published at `/smithy/`

**Documented:** The landing page itself is the documentation. However, it is missing coverage of: the full 50+ IPMS module list, org mobile apps, tradie app, Rust components (connector-sidecar, pos-edge-proxy, tray-supervisor), the compliance engine, the evidence ledger, the policy engine, the review/disposition workflow, the connection credential lifecycle, and the test suite.

---

## 7. MkDocs Documentation (`documentation/`)

### 7.1 Current State

- **Site name:** "Community Solid Server" (not updated to Solid Databox)
- **Repo URL:** points to upstream CSS
- **Content:** Entirely upstream CSS documentation
- **Nav:** Welcome, Features, Usage, Architecture, Contributing, API
- **No Databox-specific content** anywhere in the MkDocs site

### 7.2 What Exists

| Path | Content |
|---|---|
| `markdown/README.md` | Welcome page (CSS-oriented) |
| `markdown/features.md` | CSS features (authentication, authorization, Solid protocol, accounts, pods, notifications) |
| `markdown/usage/` | 13 CSS usage docs |
| `markdown/architecture/` | CSS architecture docs (overview, DI, core, features) |
| `markdown/contributing/` | CSS contributing docs |

### 7.3 What's Missing

- Databox overview / what it is
- Databox architecture (control plane / data plane, resource layout, topology)
- Databox features (provisioning, credentials, policy, evidence, receipts, review, compliance)
- IPMS module system and module catalog
- Smithy Admin console
- Native/Rust components
- Org mobile apps
- Developer guide (getting started, smithy API, institution profile, records/receipts/evidence, policies/ODRL)
- ADR index
- Threat model
- Conformance requirements
- Deployment guides

---

## 8. Design Corpus (`databox/`)

### 8.1 Documents

| Document | Size | Documented in README? |
|---|---|---|
| `README.md` | 12KB | Yes (linked) |
| `architecture.md` | 8KB | Yes (linked) |
| `compliance/` | 3 items | Partially |
| `decisions/` | 26 ADRs + README | Yes (linked) |
| `deployment/ipms/` | Docker, K8s, secrets | No |
| `devdocs/` | 58 documents | Partially |
| `fixtures/` | 34 items | No |
| `smithy-plan/` | 14 documents | Yes (linked) |
| `guide/` | 7 documents | Yes (linked) |
| `ontologies/` | 5 TTL files | No |
| `vocab/` | 14 items | No |

### 8.2 Developer Guide (`databox/guide/`)

| Document | Purpose |
|---|---|
| `README.md` | Guide index |
| `getting-started.md` | From checkout to live flow |
| `smithy-api.md` | Smithy control-plane API reference |
| `institution-profile.md` | Institution profile definition |
| `records-receipts-evidence.md` | Deposits, receipts, evidence |
| `policies-and-odrl.md` | ODRL policy model |
| `architecture-and-design.md` | Architecture overview and deep-spec links |

**Documented:** README links to the guide. gh-pages links to the guide. Well documented.

---

## 9. Test Coverage

### 9.1 Unit Tests (`test/unit/databox/`)

188 test files across 24 subdirectories:

| Area | Test count |
|---|---|
| `agent/` | 5 |
| `authorization/` | 4 |
| `bridge/` | 5 |
| `ipms/` | 99 |
| `compliance/` | 1 |
| `context/` | 2 |
| `credential/` | 8 |
| `evidence/` | 6 |
| `feed/` | 1 |
| `fixtures/` | 1 |
| `smithy/` | 1 |
| `gateway/` | 6 |
| `identifiers/` | 1 |
| `notification/` | 6 |
| `odrl/` | 1 |
| `policy/` | 12 |
| `profile/` | 3 |
| `proof/` | 6 |
| `provisioning/` | 2 |
| `receipt/` | 6 |
| `review/` | 6 |
| `storage/` | 1 |
| `tenant/` | 4 |
| `FailClosedStubs.test.ts` | 1 |

### 9.2 Integration Tests

| Test | Purpose |
|---|---|
| `DataboxLive.test.ts` | Live CSS/OIDC/WAC integration |
| `DataboxIpms.test.ts` | IPMS handler integration (29KB) |
| `DataboxIpmsA11y.test.ts` | IPMS accessibility |
| `DataboxIpmsOxigraph.test.ts` | IPMS Oxigraph sync |
| `DataboxIpmsVanilla.test.ts` | IPMS vanilla mode |
| `DataboxIpmsVertical.test.ts` | IPMS vertical profiles |

**Documented:** README mentions test locations in the repository guide table. Not in gh-pages or MkDocs.

---

## 10. Configuration (`config/databox/`)

| File | Purpose |
|---|---|
| `experimental.json` | Experimental preset entry point |
| `live-handler.json` | Live handler Components.js configuration |
| `live-variables.json` | Live variables configuration |
| `live.json` | Live preset configuration |
| `preset/` | Preset sub-configurations |

**Documented:** README mentions `config/databox/` in the repository guide. Not in gh-pages or MkDocs.

---

## 11. Scripts (`scripts/`)

| Script | Purpose |
|---|---|
| `add-smithy-link.js` | Add smithy link to templates |
| `build-databox-demo.mjs` | Build databox demo |
| `build-docs.js` | Build MkDocs documentation |
| `build-smithy-ui.js` | Build embedded smithy UI (16KB) |
| `build-usecases.js` | Build use-cases JSON for gh-pages |
| `databoxMappingSmithyDemo.ts` | Databox mapping smithy demo |
| `finalizeRelease.ts` | Release finalization |
| `formatChangelog.ts` | Changelog formatting |
| `oxigraph-wasm-server.mjs` | Oxigraph WASM server |
| `patch-demos.js` | Patch demo builds (8KB) |
| `run-ipms-migration-proof.mjs` | IPMS migration proof runner (19KB) |
| `run-ipms-oxigraph-smoke.mjs` | IPMS Oxigraph smoke test (10KB) |
| `run-eslint.mjs` | ESLint runner |
| `seraphimForgeDemo.ts` | Seraphim smithy demo |
| `test-api.js` | API testing |
| `update-workflows.js` | Workflow updater |
| `upgradeConfig.ts` | Config upgrader |
| `validate-ipms-deployment.mjs` | IPMS deployment validator (9KB) |

**Documented:** `build-smithy-ui.js` mentioned in README. Others not documented publicly.

---

## 12. Deployment (`databox/deployment/ipms/`)

| Item | Purpose |
|---|---|
| `.env.example` | Environment variable template |
| `README.md` | Deployment guide |
| `docker-compose.ipms.yml` | Docker Compose for IPMS deployment |
| `kubernetes/` | Kubernetes manifests (8 items) |
| `secrets/` | Secret management templates |

**Documented:** Not mentioned in README, gh-pages, or MkDocs.

---

## Summary: Documentation Gap Matrix

| Area | README.md | gh-pages | MkDocs | smithy-admin README | databox/ README | guide/ |
|---|---|---|---|---|---|---|
| Core Databox engine (24 subsystems) | Partial | Minimal | None | N/A | Good | Good |
| IPMS (50+ modules) | Minimal | Partial | None | Partial | None | None |
| Smithy Admin (24 pages) | Brief | Good | None | Comprehensive | Brief | None |
| Native POS Edge (Rust) | None | Good | None | N/A | None | None |
| Native Installer (Rust) | None | Good | None | N/A | None | None |
| Rust components (3) | None | None | None | N/A | None | None |
| Org Mobile Apps (6 profiles) | None | None | None | N/A | None | None |
| Tradie App | None | None | None | N/A | None | None |
| Compliance engine | Brief | None | None | N/A | Brief | None |
| Test coverage (188 unit + 6 integration) | Brief | None | None | N/A | Brief | None |
| Deployment (Docker/K8s) | None | None | None | N/A | None | None |
| Design corpus (58 devdocs, 26 ADRs) | Linked | None | None | N/A | Linked | Linked |

### Key Gaps

1. **MkDocs** is entirely upstream CSS — zero Databox content, wrong site name, wrong repo URL.
2. **gh-pages landing page** is missing: full IPMS module catalog, org mobile apps, tradie app, Rust sidecar/proxy/supervisor, compliance engine, evidence ledger, policy engine, review workflow, credential lifecycle, deployment guides, test coverage.
3. **README.md** is missing: IPMS module system, native/Rust components, org mobile apps, tradie app, deployment guides, test coverage detail.
4. **Org mobile apps** and **tradie app** are not mentioned in any public-facing documentation outside their own READMEs.
5. **Rust components** (connector-sidecar, pos-edge-proxy, tray-supervisor) are not documented anywhere.
6. **Deployment guides** (Docker, Kubernetes) are not linked from README or gh-pages.
