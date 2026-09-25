# Web Civics Databox

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D24-43853d.svg)](package.json)
[![Solid](https://img.shields.io/badge/Built_on-Solid-7C4DFF.svg)](https://solidproject.org/)

**Live demo:** [Landing](https://mediaprophet.github.io/Solid-CSS-Databox/) ·
[Admin console](https://mediaprophet.github.io/Solid-CSS-Databox/admin/) ·
[Smithy control panel](https://mediaprophet.github.io/Solid-CSS-Databox/smithy/) ·
[Developer guide](databox/guide/README.md)

Web Civics Databox is **community-made software built for civics purposes** — a **next-generation web server** on
open W3C standards, implemented as a Solid-based data vault by refactoring and extending
[Community Solid Server](https://github.com/CommunitySolidServer/CommunitySolidServer) (CSS) 7.1.9.

It is designed to work in a **decentralised** way: rather than one company's platform holding everyone's
information, each **individual, family, household, business or organisation** keeps their own vault, and the
community of vaults *is* the platform — **people as the platform**. On it you can:

- **store and share information and knowledge** — each participant retains control of their own data and grants
  access on a permissions basis, able to change or withdraw it at any time;
- **form social and linked applications** — groups, feeds, shops and services that connect across vaults by
  permission rather than platform ownership; and
- **work with AI on your own data** — privacy-preserving intelligent tooling that reads and reasons over your
  information using advanced underlying data-science techniques (Linked Data, RDF/SHACL, Solid).

It is not a government product and was not funded by any government — it is open community software anyone can
inspect, run and improve.

An organisation-hosted Databox still provides a governed, relationship-specific Solid data space for providing
information to a person and receiving deliberate, purpose-bound information from them; the person connects through
an independent Solid Pod, vault, wallet or compatible personal knowledge environment of their choice. The same
server also runs as a **personal databox** on an individual's own machine or mobile device, and weaves many
participants into a shared community fabric.

Web Civics Databox is not an official upstream Community Solid Server distribution. It retains the modular CSS
runtime, Solid HTTP surface and Components.js composition while adding the Databox identity, policy, evidence,
exchange and organisation-tailoring layers in this repository.

It is the **reference implementation** of the
[Solid-Databox specification](https://github.com/mediaprophet/solid-databox) — the vocabulary, protocol and
deployment kit, together with the person-side consumer agent (Seraphim), live in that project.

## The model

A Databox is technically a Solid Pod, but it represents the organisation's governed view of one relationship. It is
not presented as the consumer's general-purpose Pod and does not give the organisation access to the consumer's
independent storage.

```mermaid
flowchart LR
    SOR["Organisation systems of record"] --> BRIDGE["Institutional bridge"]
    BRIDGE --> BOX["Organisation-hosted relationship Databox"]
    BOX <--> APP["Consumer-selected application"]
    APP <--> POD["Independent consumer Pod or vault"]
    BOX --> REVIEW["Human review and correction workflow"]
    BOX --> PROVIDER["Purpose-bound recipient or service provider"]
```

The organisation can provide records, credentials, notices, receipts, menus, vouchers and service information. The
consumer can explicitly return corrections, claims, preferences, evidence, orders or selected personal facts. Each
accepted exchange produces auditable state and, where applicable, a signed receipt that can be retained outside the
organisation's system.

## What it does

### Relationship-specific Solid data spaces

- Provisions opaque, program-scoped Databox URLs without customer identifiers in paths.
- Creates separate security boundaries for each organisation program and consumer relationship.
- Uses the normal CSS Solid HTTP, LDP, Solid-OIDC and WAC processing path.
- Supports connection credentials that are holder-bound, program-specific, revocable and rotatable.
- Prevents a Databox connection from becoming authority to browse the consumer's independent Pod.

### Two-way governed data exchange

- Transforms organisation source events into signed institutional records.
- Commits exact accepted bytes before issuing an acceptance receipt.
- Accepts deliberate consumer submissions without granting the organisation general Pod-reading rights.
- Preserves append-only evidence, supersession links, correction history and disposition state.
- Supports notifications, recovery feeds, idempotency and reconciliation boundaries.

### Policy, assurance and evidence

- Applies record-class, purpose, legal-basis and authentication-assurance checks.
- Carries versioned ODRL permissions, prohibitions and duties with exchanged records.
- Records signed receipts, evidence-chain events and visible duty outcomes.
- Provides governed review and signed disposition workflows for corrections and contested records.
- Fails closed when required identity, tenant, policy, proof or evidence inputs cannot be verified.

### Mapping Smithy and organisation tailoring

- Registers and validates versioned institution profiles.
- Maps protected source-system customer references to opaque Databox relationships.
- Defines a backplane for industry packs, organisation manifests, program blueprints and immutable releases.
- Separates private Databox data from optional public-presence tooling such as website Schema.org/JSON-LD and
  business-listing reconciliation.
- Provides planning and synthetic fixtures for welfare coordination, restaurants, loyalty programs, donations,
  budgeting, resource pools and inter-organisational claims.

### IPMS module system

The Databox IPMS (`src/databox/ipms/`) is a dynamic module system with **60+ built-in industry modules**, each with
capability declarations, route management, and enable/disable toggles. Modules are organised into industry verticals
(restaurant, welfare, retail, loyalty, print, trade) and can be tailored per organisation profile. The IPMS HTTP
handler serves module APIs, an admin panel, and Oxigraph-backed synchronisation.

| Group | Modules |
|---|---|
| Commerce & retail | POS (cart, cash register, customer ordering, table sessions, promotions, tickets, native device contract), menu, catalogue, pricing, discounts, loyalty, barcode, EFTPOS, payments (refunds, splits, subscriptions) |
| Food & health safety | Allergy profile (allergen matching, ingredient declarations), concessions, emergency break-glass, consent, delegation, device auth |
| Operations & logistics | Delivery (driver dispatch, driver management), inventory, bookings, jobs, events, feeds, print shop, quotations |
| Governance & identity | Governance (role bindings, ODRL policy management, resolution), credentials (W3C VC issuance/verification/revocation), access, consumer rights, provenance, reputation, licensing, org network |
| Infrastructure & integration | Hosting (Cloudflare DNS/tunnel), integration (ODBC/LDAP connectors, R2RML), backups, accounting bridge, tax engine, notifications, i18n, a11y, theming |
| Web & social | Website (customer display renderer, public feed renderer, SEO, sitemap/robots), social, business, HR, household, records, receipt, ticketing, MCP |

### Compliance decision support

The compliance workstream maps pinned legislation and human-rights sources to technical controls, evidence and
consumer-facing information obligations. It is decision support: it does not self-certify that an organisation or
deployment is legally compliant. Applicability, exceptions and publication claims remain subject to qualified human
review.

### Native and Rust components

The Databox ecosystem includes native components for hardware integration, system management, and connector bridging:

- **POS Edge** (`native/pos-edge/`) — Rust native POS edge with ESC/POS thermal printer support, cash drawer control,
  QR code generation, local HTTP server, IPC, and hardware abstraction.
- **Installer** (`native/installer/`) — Cross-platform installer with pre-flight checks, a private checksum-verified
  Node.js runtime, locked dependency installation, platform/architecture validation, and deployment handoff.
- **POS Edge Proxy** (`rust/pos-edge-proxy/`) — Proxy layer for POS edge communication.
- **Tray Supervisor** (`rust/tray-supervisor/`) — System tray supervisor for desktop lifecycle management.
- **Connector Sidecar** (`rust/connector-sidecar/`) — Connector sidecar for IPMS integration with ODBC/LDAP bridging
  and RDF mapping.

### Org mobile apps

A unified WASM/PWA container (`org-mobile-apps/`) fetches its identity, features, and permissions from the IPMS at
runtime based on the org's vertical profile and the app's purpose. Instead of building separate apps per purpose, one
container dynamically loads UI component bundles from the IPMS. Six app profiles are defined: waiter, driver, tradie,
print, scorekeeper, and referee. Each app install receives a Verifiable Credential licence binding app, organisation,
device, scope, and permissions. Network scope (local-only vs remote-capable) is enforced via service worker.

A full survey of produced functionality versus documented coverage is in the
[functionality audit](databox/functionality-audit.md).

## Demonstrator journeys

### Seraphim and Charles James

The welfare demonstrator models Seraphim, a synthetic homelessness registration and coordination service, and
Charles James, a synthetic participant using an independent Flutter-based Solid application. The planned journey
includes:

- correction of a false and potentially defamatory organisational assertion with file or URI evidence;
- residency, concession, disability-support, health-needs and voucher credentials;
- goals, stages, dependencies, diary entries, events and completed or outstanding tasks;
- consent-scoped referrals and coordinated communications with service providers;
- privacy-shielded donations and aggregate donor reporting;
- consumer budgeting, receipt evidence and organisation/service economic reporting; and
- pairwise voucher redemption and claims between participating Databox organisations.

All people, credentials, organisations, entitlements, keys and transactions used by the demonstrator are synthetic.
Imported provider-directory rows remain unverified until reviewed.

### Restaurant menu and ordering

The restaurant journey demonstrates an organisation publishing a menu into a consumer's selected Solid environment.
The consumer creates an order locally and shares only the selected order and relevant dietary information back to
the organisation. The acknowledgement, status events and receipt can then be retained by the consumer.

## Live CSS integration

The experimental live preset mounts the Mapping Smithy inside the CSS Components.js composition. Provisioned Databox
resources are stored in CSS and retrieved through the ordinary Solid authorization route.

Build the project:

```shell
npm install
npm run build
```

Start the memory-backed live demonstration with a control token containing at least 32 bytes:

```powershell
$token = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
npm.cmd run start:databox-live -- --databoxControlToken $token --baseUrl http://localhost:3000/ --port 3000
```

The protected demonstration control plane is mounted at `/.databox/smithy`:

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/.databox/smithy/programs` | List registered program summaries |
| `POST` | `/.databox/smithy/programs` | Register a validated institution profile |
| `POST` | `/.databox/smithy/mappings` | Provision a relationship and issue its connection credential |
| `POST` | `/.databox/smithy/source-events` | Transform and commit an institutional event and issue its receipt |

See the [live CSS integration guide](databox/live-css-integration.md) for operation, verification and current
limitations.

### Operator consoles

Two operator front-ends drive this control plane:

- **Smithy Admin console** — a Refine / React single-page app under [`smithy-admin/`](smithy-admin/README.md) for
  onboarding programs, provisioning relationship mappings, dispatching events, declaring an organisation's
  information-provision obligations against an ANZSIC-tailored, AU / multi-jurisdiction / standards (DPV · GDPR ·
  ODRL) taxonomy, running a data-portability registry, and handling inbound access and correction requests. It runs
  against the live Smithy API, or fully in-memory (`VITE_DEMO=true`) as a backendless demo — the latter is published
  at [`/admin/`](https://mediaprophet.github.io/Solid-CSS-Databox/admin/).
- **Embedded `/smithy` UI** — a minimal, dependency-free Programs / Mappings / Events console the running server
  serves at `/smithy` (generated by [`scripts/build-smithy-ui.js`](scripts/build-smithy-ui.js)); also published at
  [`/smithy/`](https://mediaprophet.github.io/Solid-CSS-Databox/smithy/).

## Repository guide

| Location | Contents |
|---|---|
| [`src/databox/`](src/databox/) | Databox identity, provisioning, policy, bridge, evidence, review and Smithy code |
| [`src/databox/ipms/`](src/databox/ipms/) | IPMS HTTP handler, 60+ industry modules, vertical profiles, Oxigraph sync |
| [`config/databox/`](config/databox/) | Experimental live Components.js configuration |
| [`databox/`](databox/) | Architecture, decisions, threat model, vocabulary, fixtures and implementation plans |
| [`databox/smithy-plan/`](databox/smithy-plan/) | Product backplane, application and demonstrator plans |
| [`databox/functionality-audit.md`](databox/functionality-audit.md) | Functionality audit: produced features vs documented coverage |
| [`smithy-admin/`](smithy-admin/README.md) | Refine/React Smithy Admin console — the operator control plane |
| [`org-mobile-apps/`](org-mobile-apps/README.md) | WASM/PWA mobile app container with 6 app profiles |
| [`native/`](native/) | Rust native POS edge and cross-platform installer |
| [`rust/`](rust/) | Rust connector sidecar, POS edge proxy, and tray supervisor |
| [`databox/deployment/ipms/`](databox/deployment/ipms/) | Docker Compose, Kubernetes, and secret templates for IPMS deployment |
| [`test/unit/databox/`](test/unit/databox/) | Databox unit and security-invariant suites across all subsystems |
| [`test/integration/`](test/integration/) | 6 Databox integration tests including live CSS/OIDC/WAC |

Start with the [Databox documentation index](databox/README.md), then read the
[reference architecture](databox/dbx-04-reference-architecture.md),
[decision register](databox/decisions/README.md), [threat model](databox/dbx-03-threat-model.md) and
[Smithy productization plan](databox/smithy-plan/README.md).

## Security and privacy principles

1. A Databox belongs to one declared organisation program and one represented relationship.
2. URLs, logs and storage paths must not contain directly identifying customer information.
3. Knowing a resource URL never grants access.
4. Organisation credentials cannot authorize browsing of a consumer's independent Pod.
5. Consumer submissions are explicit disclosures, not background reads from personal storage.
6. Accepted institutional records are not silently overwritten; changes remain linked and auditable.
7. Record sensitivity is evaluated against current verified assurance, purpose and policy.
8. Hosting-provider administration is treated as a security boundary, not implicitly trusted access.
9. Public-presence tools must remain isolated from customer mappings and private Databox records.
10. Legal or interoperability claims require named review and executable evidence; the software does not
    self-certify them.

## Implementation status

The core Databox exchange (DBX-01 through DBX-25) is complete, including the live CSS slice that provisions private
WAC-protected resources, commits accepted bytes into CSS before receipt issuance, denies anonymous retrieval and
permits authenticated holder retrieval with a DPoP-bound CSS identity. DBX-26 adversarial assurance is implemented —
a dedicated P1 adversarial suite exercises the threat model's attacks against the real components and asserts the
safe, fail-closed outcome.

Beyond the organisation exchange, the broader **Web Civics buildout** is implemented: personal and mobile Databoxes
(PWA/WASM pod with owner-key-encrypted continuity backup), household guardianship and custody, verifiable
credentials (OIDC4VP presentation exchange, offline carried credentials, programmable grants, scoped disclosure),
credential-gated federation, community economics and the living-library fabric, device telemetry, and the
privacy-preserving edge-AI surface — all fail-closed and unit-tested.

This remains a reference implementation. The genuinely external remainder is not unbuilt logic but assets and
infrastructure: the bundled WASM ASR/TTS model binaries, a custody-provider decision and live KMS endpoint for key
custody and multi-writer content-addressed storage, and live multi-peer deployment proofs. Independent security,
legal-policy and external interoperability review also remain ahead of any production claim.

## Testing and deployment

### Test coverage

The Databox extension is fail-closed and comprehensively tested:

- **230 test suites / 2,020 tests** across unit and adversarial coverage — agent, authorization, bridge, IPMS,
  compliance, context, credential, disclosure, durable, evidence, feed, gateway, identifiers, notification, ODRL,
  ops, personal, policy, profile, proof, provisioning, receipt, review, storage, and tenant.
- **A dedicated adversarial suite** (`test/adversarial/P1.test.ts`) exercises the threat model's P1 attacks against
  the real components — a test fails if an attack succeeds or a denial leaks protected facts.
- **Integration tests** including live CSS/OIDC/WAC (`DataboxLive.test.ts`), IPMS handler, IPMS accessibility,
  Oxigraph sync, vanilla mode, and vertical profiles.
- **Fail-closed stubs** verified by a dedicated test — no stub silently permits access or claims conformance.

### Deployment

- **Docker Compose** — IPMS deployment via `databox/deployment/ipms/docker-compose.ipms.yml` with environment configuration.
- **Kubernetes** — manifests under `databox/deployment/ipms/kubernetes/` for production IPMS deployment.
- **Secret management** — templates under `databox/deployment/ipms/secrets/`.
- **Live CSS preset** — experimental Components.js preset under `config/databox/` for mounting the Smithy inside a
  running CSS instance.
- **Desktop releases** — platform-specific Windows x64, macOS x64/ARM64, and Linux x64 packages. Setup downloads its
  private Node.js runtime and locked dependencies on first use, then launches the tray supervisor for desktop editions.

See the [IPMS deployment guide](databox/deployment/ipms/README.md) for details.

## Relationship to Community Solid Server

The repository began with Community Solid Server and continues to use substantial upstream CSS code and architecture.
Keeping that lineage visible matters technically and legally: CSS provides the modular HTTP server, Solid protocol
handling, identity integration, storage layers and Components.js runtime on which the Databox implementation builds.

Upstream CSS documentation remains useful for its underlying server and configuration model:

- [Community Solid Server repository](https://github.com/CommunitySolidServer/CommunitySolidServer)
- [Community Solid Server documentation](https://communitysolidserver.github.io/CommunitySolidServer/)
- [Solid specifications](https://solidproject.org/TR/)

The existing package name and Components.js identifiers are retained for CSS compatibility while the derivative is
being refactored. They should not be interpreted as an assertion that this Databox branch is an official upstream CSS
release.

## Copyright, attribution and license

The original Community Solid Server code retains its copyright attribution to Inrupt Inc. and imec.

The Databox-specific design, implementation, documentation, vocabularies, fixtures and refactoring are attributed to:

### Timothy Charles Holborn

[LinkedIn](https://www.linkedin.com/in/ubiquitous/) · [timothy.holborn@gmail.com](mailto:timothy.holborn@gmail.com)

The repository is distributed under the [MIT License](LICENSE.md). The license file preserves the original CSS
copyright notice and separately records the Databox copyright holder. Third-party dependencies, standards,
legislation and imported datasets retain their own copyright, licensing and legal status.

## Contact

For Databox design and implementation enquiries, contact Timothy Charles Holborn through
[LinkedIn](https://www.linkedin.com/in/ubiquitous/) or
[timothy.holborn@gmail.com](mailto:timothy.holborn@gmail.com).
