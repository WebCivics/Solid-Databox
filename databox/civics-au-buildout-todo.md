# Build-Out To-Do — civics.au functionality → Solid Databox

> **Tracking:** this is the narrative backlog (what and why). Execution order, stable IDs
> and acceptance gates live in [`devdocs/civics-implementation-plan.md`](devdocs/civics-implementation-plan.md);
> item status lives in [`devdocs/civics-progress.md`](devdocs/civics-progress.md).

> Compiled 2026-09-24 from three sources: the civics.au site content
> (`C:\Projects\civics.au\content\pages.mjs` — 38 pages), the databox design corpus and
> code (`databox/`, `src/databox/`, `smithy-admin/`, `native/`, `rust/`, `ckan-bridge/`),
> and the existing audits (`databox/functionality-audit.md`, `databox/devdocs/gap-analysis.md`,
> `databox/devdocs/swarm-progress.md`, `databox/devdocs/handoffs/`).
>
> Part A is the person-side profile Timothy asked for. Part B is functionality the civics.au
> site illustrates that the databox does not yet implement. Part C is incomplete work already
> in the repo. Items marked **[verify]** were claimed done in `swarm-progress.md` — spot-checks
> were run where noted; the rest should be confirmed before scheduling.

---

## Part A — Personal databox profile (person-side install + DNS)

The explicit ask: a profile for people who want **their own databox on their own local
machine**, which requires a DNS path (Cloudflare or similar). Today the person side is a
client library (`src/databox/agent/ReferenceConsumerAgent.ts`, `LocalKnowledgeStore.ts`)
and an external app (Seraphim). The server-side stack is entirely organisation-shaped.

### A.1 Personal install profile

- [ ] **Personal databox preset** — a `config/` preset that runs Layer-1 pod + the person-facing
  databox endpoints (connection-credential install target, vault sync, LDN inbox, cursor-feed
  recovery) without the org control plane (Smithy) or IPMS. The profile ladder
  (`databox/devdocs/profile-ladder.md`) defines the layers but no personal profile exists.
- [ ] **Guided onboarding for a non-expert individual** — equivalent of the org
  `/setup` flow, for a person: create pod, install first connection credential (QR/URI import),
  pick backup/continuity options.
- [ ] **Windows and Linux service registration in `native/installer/`** — the installer is
  macOS-shaped (`service.rs` registers via launchd). Most people run Windows; community edge
  boxes run Linux (systemd). Add Windows Service + systemd paths.
- [ ] **Consumer-vault server endpoints** — the person side currently assumes an external app.
  A person-run databox needs: per-program isolated connection registries (the
  `ConsumerConnectionRegistry` pattern, server-side), notify-then-pull sync worker, durable
  cursor/reconciliation consumer (`feed/CursorFeed.ts` is org-side today), and a private
  submission composer.

### A.2 DNS and reachability for a home machine

- [ ] **Personal hosting path in the `hosting` module** — `modules/hosting/CloudflareApi.ts`
  already does zone lookup, DNS records and Tunnel+ingress for an org apex
  (`databox.`/`www.`/`devices.`). Extend to a personal profile: single hostname (or
  `pod.`/`id.` pair), no www/devices hosts, personal-plan template in `HostingConfig.ts`.
- [ ] **NAT traversal decision** — Cloudflare Tunnel (cloudflared) works behind CGNAT but
  routes traffic through Cloudflare — document the trade-off honestly alongside alternatives:
  direct DNS + port-forward with ACME HTTP-01, DNS-01 wildcard certs, Tailscale/headscale
  funnel, or cooperative-hosted relay. The site copy promises local-law/local-control; a
  tunnel that terminates at a US CDN should be a labelled option, not the silent default.
- [ ] **TLS certificate automation** — ACME issuance/renewal for the personal hostname
  (or tunnel-terminated TLS documented as such).
- [x] **Dynamic DNS fallback** — for users without Cloudflare or a domain at all:
  delegated subdomain under a cooperative zone (e.g. `name.members.coop.example`) is the
  knowledge-bank-friendly answer; RFC 2136 / provider APIs as alternates.
  → `personal/DynamicDnsClient.ts` (provider-agnostic tokenised-update client) +
  `CooperativeDnsClient` (coop zone).
- [ ] **Cooperative-hosted fallback** — for people who can't run a box: cooperative-hosted
  pod provisioning for natural persons (member pods exist via `modules/profile/MemberPod.ts`
  but are org-membership-shaped), encrypted backup under *owner* keys, and digital-estate
  standing instructions (see B.9).

### A.3 Household profile — families and share-houses (CIV-A09/A10)

The personal profile extends to multi-member homes: one host runs a pod per member plus a
governed `commons` pod (shared bills, calendar, pantry) that no single member owns.

- [ ] **Household topology planner** — `planHousehold`: member pods (`alice.<zone>`),
  commons pod, per-member WebIDs, DNS/hosting plans, member registry.
- [ ] **Admin governance models** — sole admin (either parent acts alone, `adminQuorum: 1`),
  m-of-n admin quorum, or full consensus (`'all'` — a share-house where commons changes
  need every member). `commonsAuthority`: admins-set-rules (family) vs all-members
  co-govern (share-house).
- [ ] **Electronic member consent** — one member grants another a scoped permission:
  ask → approve/deny → execute → revoke, with an audit trail. A `limited`-capacity member
  (child) is never petitioned alone — an admin counter-signature is required (the
  household-side seed of B.1 guardianship).
- [ ] **Guardianship network (CIV-A11)** — guardian kinds with unequal precedence
  (parent > appointed > attorney > kinship > professional > supporter), nine duty scopes,
  time-bounded relations spanning MULTIPLE households (separated families, kinship care),
  and a capacity scale (full/emerging/limited/supported) anchored to CRC Art. 5 and CRPD
  Art. 12 — supporters advise, never substitute.
- [ ] **Safety recipes (CIV-A12)** — SHACL-grounded decision templates for guardians:
  online-contact boundary, third-party data sharing, location sharing, residence schedule,
  major medical, supported decision (CRPD), emergency break-glass. The ward's voice is
  recorded where required (CRC Art. 12); an approved decision whose record fails SHACL is
  rejected — approval ≠ conformance.

---

## Part B — civics.au functionality to build into the databox

Mapped by site area. "Exists" = something already in the codebase to build on.

### B.1 Guardianship & care (`guardianship.html`, `social-web.html`)

- [ ] **Guardianship relation type + vocabulary** — scoped, visible, revocable, *distinct-party*
  delegation: a guardian acts *for* a person, never *as* them. `agent/AgentTypes.ts` already
  separates acting-agent from represented-person; the `delegation` module exists. Missing:
  purpose-scoped guardianship declarations, expiry when purpose ends, actions recorded as the
  guardian's acts on the person's behalf.
- [ ] **Capacity-scaled guardianship** — children: near-total infant guardianship shrinking as
  capacity grows; narrow duty-slices for childcare/teacher/coach. Needs time/context-bounded
  delegation scopes.
- [ ] **Duty webs** — healthcare pattern: several specialists each holding a scoped duty,
  coordinated by a primary. Needs multi-party duty registries over `policy/DutyEngine.ts`.
- [ ] **Deterministic boundary enforcement** — the social-web promise: declared guardianship
  rules enforced by a reasoning engine (rules, not probabilistic filtering), so unsafe spaces
  are structurally unreachable for a child. Needs a local rules engine over pod data with
  inspectable derivations (see B.6).

### B.2 Community ledger — "counting what counts" (`community-ledger.html`, `cooperative-projects.html`)

- [x] **Contribution/resource-commit ledger** — auditable records of who contributed which
  time, skill, materials or facility usage to a project — "version control for real-world
  projects". → `ipms/modules/community-ledger/ContributionLedger.ts` — append-only, hash-chained
  (tamper-evident), durable via `DurableStateStore`, per-contributor pairwise WebID (no PII).
- [~] **Community portfolio** — a person-curated collection of recognised contributions held
  in their own pod — the `contributions()`/`recognise` projection is the authoritative source;
  the per-party *selective-disclosure* pod view is a UI/scope layer on top (open).
- [x] **Obligation-cost accounting & payback waterfall** — logged contributions repaid when a
  project earns, including charitable routing of compensation while recognition stays in the
  portfolio. → `ipms/modules/community-ledger/PaybackWaterfall.ts` — weighted settlement over
  recognised contributions + beneficiary routing. (`modules/payments` executes the payouts.)
- [ ] **Anonymised community statistics** — aggregate, privacy-preserving civic statistics for
  funding evidence ("if you can't measure it, you can't fund it"). CKAN bridge anonymisation
  is the nearest machinery.

### B.3 Concession credentials & programmable grants (`concession-card.html`)

Existing: `modules/credentials` (VC lifecycle), `modules/concessions`, `modules/access`
(CredentialGate), `proof/OfflineVerification.ts`, POS, payments.

- [ ] **Attribute-based credentials + pairwise identifiers** — attributes of circumstance
  (residence type, hardship/transition markers, contribution attributes) with no identity
  dossier; per-verifier pairwise IDs to prevent correlation.
- [ ] **OIDC4VP verification flow** — verifier requests attributes; holder's pod produces a
  boolean/zero-knowledge proof answering only "eligible or not".
- [ ] **Offline carried credentials** — CBOR-LD compressed credentials in QR/NFC; POS verifies
  issuer signature locally, checks product whitelist, debits prepaid grant balance, prints
  zero-dollar receipt — no connectivity required from the person.
- [ ] **Programmable-grant settlement engine** — grant balance, merchant category codes,
  product whitelists, matching ratios; settles at POS through `modules/payments` +
  `modules/eftpos`/`pos`.
- [ ] **Anonymous ZK audit ledger** — per-transaction proof that a valid, unrevoked credential
  met program rules, appended to an immutable ledger *without* recording who the person was —
  auditable by funders without surveillance. (Deliberately different from the general evidence
  ledger, which binds actors.)
- [ ] **Issuer trust registry** — only governed, anchored issuers can issue high-stakes
  credentials (`proof/IssuerTrustStore.ts` is the seed).
- [ ] **Coercion resistance** — safe-exit / deadman-switch protocols: obfuscate history,
  revoke an abuser's access, provision clean-break credentials via a delegated advocate.
- [ ] **Decision-record logging** — every automated eligibility decision logs rule ID +
  circuit/policy version for appeal and bias investigation.

### B.4 Food & health evidence commons (`food-health.html`)

Existing: `modules/allergy-profile` (AllergenMatcher, IngredientDeclaration — Phase 3),
`modules/menu`, `modules/catalogue`.

- [ ] **Evidence-graph vocabulary + hosting** — the site's real dataset: 297 normalised foods,
  typed edges (`may_support`, `relates_to_focus`, `contains_or_marks`), evidence tiers A–D,
  cautions, provenance URLs; 200 meal options across 14 cuisine groups. Publish as RDF works
  in pods; ontology files under `databox/ontologies/` or `vocab/`.
- [ ] **Scoped-disclosure matching API** — food business receives only the scoped attributes
  granted for that exchange (allergy, dietary requirement, nutrition goal), matches against
  the evidence graph, returns suitable choices; never holds the health record.
- [ ] **Commons-maintenance workflow** — contributions and corrections to the graph are logged
  resource commits with provenance (B.2), with reviewer roles — the cooperative-knowledge-asset
  pattern the site describes.

### B.5 Community digital library & shared namespace (`community-library.html`, `community-manifold.html`)

Existing: `glam.*` vertical profiles, `modules/catalogue|records|provenance`, `events`,
`bookings`, CKAN bridge for the civic/open-data leg.

- [ ] **Machine-readable noticeboard + local guide** — events, listings, amenities, local
  businesses, clubs in shared vocabularies (schema.org), queryable by any client.
- [ ] **Living archive** — heritage/historical-society collections in community-controlled
  storage (glam profiles cover much of this; needs the archive workflow + public publishing
  path — see C.4 website publishing).
- [ ] **Civic window** — council submissions/consultations, grants, licensing, issue reporting
  (potholes), GIS links — surfaces civic institutions without their systems holding community
  data. CKAN bridge covers open-data publication; issue-reporting/consultation surfaces are new.
- [ ] **Cross-site shared namespace + federated query** — one agreed addressing scheme so
  neighbouring communities' public resources are discoverable and SPARQL-federatable without
  a central platform — "a regional catalogue from local catalogues".
- [ ] **Physical-site services on the same account** — campsite check-ins, amenity access,
  small payments, IoT-connected facilities, micro-billing — the person sees exactly what each
  access shared.

### B.6 Reasoning engine & honest helpers (`honest-helpers.html`, `social-web.html`, `digital-economy.html`)

Existing: `modules/mcp/McpServerApi.ts` gives authorised agents a governed surface;
ODRL/policy evaluators are deterministic.

- [ ] **Local reasoning engine over pod RDF** — checkable rule derivations ("show its working")
  over verified, permissioned data — the counterpart to probabilistic AI. Options: N3/EYE-style
  reasoning, or a deterministic rule layer over Oxigraph hydration.
- [ ] **Edge inference patterns** — private resident support (match a person's health context
  against the food evidence graph locally), skill/task matching, microgrid dispatch — all
  without data leaving the edge.

### B.7 Devices / Web of Things (`databox.html#devices-wot`, `digital-economy.html`)

Existing: `modules/device-auth` (enrol/verify/revoke — P7-02), device identity design
(mTLS claim-URI ceremony), `databox/ontologies/` WoT/SOSA/SSN files, `native/pos-edge`.

- [x] **WoT Thing Descriptions as pod resources** — devices represented and discoverable as TDs.
  → `ipms/modules/wot/` (`ThingDescription` builder + `ThingRegistry` persisting JSON-LD TDs under
  `/.databox/devices/`, DPoP security scheme, `acl:Append` telemetry affordances).
- [ ] **SOSA/SSN telemetry pipeline** — sensor observations land as standard RDF with
  time/location context; append-only `acl:Append` write grants for devices.
- [ ] **Telemetry → billing** — smart-meter P2P energy telemetry feeding micro-billing and
  transactive settlement (digital-economy page's P2P energy matching).
- [ ] **Credential-gated physical access** — turnstile verifying a ticket/membership VC without
  learning identity; 3D-printer purpose-limited ODRL-licensed jobs.
- [ ] **Fallback auth path** — Solid-OIDC client-credentials/DPoP for devices that can't do mTLS.

### B.8 Cooperative project infrastructure (`cooperative-projects.html`)

- [ ] **3-stage gated milestone spine** — inception/exploration → build → release gating over
  resource-commit records.
- [ ] **Fair-value scales** — declared valuation of human time, equipment, space for
  contribution-equity accounting.
- [ ] **Multi-site federation of project state** — projects spanning grounds, with portable
  IPMS-works bundles carrying project state between sites.
- [ ] **Supply-chain hygiene** — credential-verified contractors/suppliers; circular-material
  provenance (origin, structural integrity, safety testing of reclaimed inputs); grant
  disbursement→asset tracing for public audit.

### B.9 Knowledge-bank cooperative services (`knowledge-bank.html`, `data-safe.html`)

- [ ] **Owner-key encrypted backups** — cooperative holds backups it cannot read. Verify what
  `modules/backups` actually implements; add client-side/sealed-key backup protocol if absent.
- [ ] **Digital estate / standing instructions** — on death or incapacity: what passes to
  family, what transfers to an executor, what is sealed or destroyed — declared in advance,
  administered under local law. Nothing like this exists.
- [ ] **Continuity service** — lost/stolen/failed box: records survive encrypted under the
  owner's keys; recovery path that doesn't transfer ownership.
- [ ] **Fiduciary-duty auditability** — the informatics-fiduciary claim needs technical teeth:
  operator actions on member pods are themselves evidence-logged and reviewable.

### B.10 Social web (`social-web.html`)

- [ ] **Community social spaces** — rooms with declared membership and norms, hosted by the
  cooperative; social graph lives in each person's pod. `modules/social` (Note/SocialApi)
  and `profile/LdnInbox` are seeds only.
- [ ] **Child-safe bounded spaces** — the B.1 guardianship enforcement applied to social
  membership/contact boundaries.

### B.11 Local LLM + voice agent (`Wllama and Solid Pod Integration`)

A pod-bound assistive agent — inference never leaves the device. Registered as CIV-B53..56.
**The agent proposes; SHACL/governance disposes — it is never a boundary-decision path**
(B.6 reasoning stays deterministic; no probabilistic enforcement).

- [ ] **Pod-bound LLM agent** — `node-llama-cpp` server-side (native CUDA/Metal/Vulkan) or
  `wllama` WASM served from the pod as static assets for browser-side inference; strict CSP
  (`connect-src` limited to the pod + model registry); OpenAI-style tool-calling; zero
  external inference egress.
- [ ] **Ephemeral Oxigraph SPARQL tool layer** — per-query in-memory `oxigraph.Store`
  loaded via the internal `ResourceStore` (no HTTP hop); RDF/JS interop; token-flattened
  serialization so the LLM ingests results cheaply.
- [ ] **SHACL-gated write path** — LLM assertions stage to an in-memory quad store,
  validate against pod SHACL shapes, commit on conformance or remediate on fail. PROV-O
  audit per cycle: prompt=Entity, inference=Activity, generation+tool-calls=Entity.
- [~] **WASM voice pipeline** — whisper.wasm ASR + wllama + Piper TTS (or Transformers.js
  → server half done: `modules/llm/VoiceIntentPipeline.ts` (transcript → SHACL-gated agent loop;
  blank/low-confidence never reaches the pod). The WASM ASR/TTS itself is device-shell (external).
  v3 unified), all local/offline-capable; accessibility for elderly/low-literacy members —
  the voice intent flows through the same SHACL-gated loop, never free-text writes.

---

## Part C — Incomplete work already in the repo

### C.1 Stray scratch/junk files at repo root (cleanup or integrate)

- `scratch-pos-routes.ts`, `scratch-utils.ts` — leftover POS route work.
- `CmsHttpHandler.orig.ts` — 85KB backup file.
- `extract_payments.js`, `extract_pos.js`, `extract_pos2.js`, `extract_rest.js`,
  `extract_website2.js`, `extract_website3.js`, `extract_website4.js`,
  `rewrite_handler.js`, `rewrite_handler_safely.js`, `check-deps.cjs`, `check-deps2.cjs`,
  `check-shacl.cjs` — one-off extraction/rewrite scripts.
- `test_output.log`, `test_output.txt`, `unit_test_output.log` — stale logs.
- `x.trim().replace('` — 0-byte junk file (shell accident).
- `civics.html`, `cybertech.html`, `gourmet.html` — demo mockups at root; move under `docs/`
  or remove.

### C.2 DBX plan tail (handoffs exist DBX-01…DBX-25 only)

- [ ] **DBX-26 — adversarial security suite** — run the 58-threat model attacks; no handoff.
- [ ] **DBX-27 — interoperability & conformance** — independent-client evidence, compatibility
  manifest, conformance report; no handoff.
- [ ] **DBX-28 — operational & release readiness** — runbooks (key ceremony, tenant onboarding,
  backup/restore, incident response, relationship recovery, duty monitoring, retention),
  SBOM, dependency/secret scan, hardening checklist, signed readiness decision; no handoff.
- [ ] **Reference-implementation → production gaps** (named in the corpus): process-local
  preset registries/keys/outbox → durable stores; KMS-backed keys; WORM evidence ledger.

### C.3 IPMS runtime proof (per `handoffs/CMS-next-swarm.md` / `CMS-swarm-status.md`)

- [ ] **Live Oxigraph** — provision an actual endpoint (`cargo install oxigraph-cli` timed out
  previously); run unified + split-mode smoke; capture in `databox/ipms-oxigraph-smoke.md`.
- [ ] **Live network hydration** — `OxigraphIpmsSyncComposition` against a real endpoint;
  prove rebuildable-from-pods invariant.
- [ ] **Live migration proof** — `run-ipms-migration-proof.mjs` against live file-backed CSS +
  live Oxigraph profile (only in-memory/dry-run done).
- [ ] **POS persistence beyond ordering** — register open/close/count and customer-display
  state through `ResourceStore` like `PosOrderStore`; shop Wi-Fi/table-session native-edge.
- [ ] **Native POS edge package** — deployable Rust/Tauri or WASM shell; mTLS/WebID-TLS
  verifier; thermal printer + cash-drawer I/O; QR bitmap rendering; offline replay spool.
- [ ] **Live customer display** — publish playlists through Solid; update clients via CSS/Solid
  notifications on real display hardware.
- [ ] **Live public website publishing** — preview exists; publish RDF-backed HTML/JSON-LD,
  sitemap, OpenGraph, theme CSS, feeds — degradable to vanilla Solid.

### C.4 Rust / native open items (`swarm-progress.md` ❓ items)

- [ ] P7-07 direct cash-drawer mode (`native/pos-edge/src/hardware/drawer.rs` — no-op).
- [ ] P7-08 unused imports/warnings cleanup in pos-edge.
- [ ] P7-09 fullscreen customer display in tray-supervisor.
- [ ] P9-03/04 Rust unit tests for installer + pos-edge; P9-05 POS edge IPC integration test.
- [ ] Windows/Linux service registration in `native/installer/src/service.rs` (launchd-only).
- [ ] **[verify]** P0 swarm fixes claimed in `swarm-progress.md` (CSPRNG, Node provisioning,
  app extraction, crypto bootstrap, Windows check, chrono timestamps) — confirm the code
  actually landed, since `gap-analysis.md` listed them as stubs.

### C.5 Fail-closed stub wiring (`gap-analysis.md` §1 — low severity)

- [ ] Swap default wiring in presets: `RegistryTenantResolver`, `AuthenticatedContextExtractor`,
  `RandomOpaqueIdentifierGenerator`, `ComposedDataboxPermissionReader`,
  `HashChainedEvidenceLedger` — real impls exist; stubs remain the defaults.

### C.6 Dependencies & toolchain

- [ ] **47 blocked majors** — `databox/devdocs/dependency-upgrade-plan.md` (draft status);
  cluster-aware sequencing required (n3/@comunica cluster, @types discipline, version-bump
  250-file `upgradeConfig.ts` path).
- [ ] **[verify] July integration regression** — `upgrade-completion-plan.md` recorded
  5 failing integration suites after within-range dep updates; tree is now clean — confirm
  whether the fixes landed or the work was dropped.

### C.7 Documentation gaps (`functionality-audit.md` §7/summary)

- [ ] **MkDocs** is entirely upstream CSS — wrong site name, wrong repo URL, zero databox
  content.
- [ ] **gh-pages landing page** — missing full IPMS module catalog, org mobile apps, tradie
  app, Rust sidecar/proxy/supervisor, compliance engine, evidence ledger, policy engine,
  review workflow, credential lifecycle, deployment guides, test coverage.
- [ ] **README** — missing IPMS module system, native/Rust components, org mobile apps,
  deployment guides.
- [ ] **Deployment docs unlinked** — `databox/deployment/ipms/` (Docker, K8s, secrets) not
  referenced from README or gh-pages.

### C.8 CKAN bridge

- Feature-complete through CKAN-18 per handoffs (Solid-OIDC, gov IdP, SHACL, RDF→tabular,
  webhooks, publication pipeline, correction propagation, reconciliation, adversarial tests,
  conformance, operational). Remaining:
- [ ] Live end-to-end deployment verification against a real CKAN instance.
- [ ] Python CKAN plugin packaging/distribution path.
- [ ] Production operational runbooks (folds into DBX-28).

### C.9 Verified-done since `gap-analysis.md` (do not re-list as open)

- smithy-admin `@ts-nocheck` removed (0 pages flagged now).
- `configShape` wired into `BuiltInModules.ts` (P7-05); UiFormRenderer connected (P7-06).
- Real ODBC/LDAP connectors (dynamic `odbc` import — Phase 4).
- ClamAV + VirusTotal scanners in `gateway/RealEvidenceScanners.ts` (P7-10).
- Vocabulary + UiFormRenderer tests (P9-01/02); profile-ladder doc (P9-06).
- All 23 Phase-8 IPMS module routes; 26 vertical profiles (Phase 10).

---

## Suggested ordering

1. **A.1–A.2 (personal profile + DNS)** — the user's stated next step; mostly additive.
2. **C.1 cleanup + C.5 wiring + C.4 verify** — cheap, clears the decks.
3. **C.2 DBX-26/27/28** — the release gate; everything else builds credibility debt until
   these pass.
4. **B.1/B.3 guardianship + concession layer** — the civics.au heartland (vulnerable people,
   entitlements, care) and the most novel surface.
5. **B.2 ledger + B.8 projects** — the cooperative-economics layer that funds the rest.
6. **B.5 library/namespace + B.7 WoT + B.9 cooperative services** — the deployment-visible
   layer for pilots.
7. **C.3 live-proof items + C.6 dependencies + C.7 docs** — continuous hardening alongside.
