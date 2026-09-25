# Civics Implementation Plan — Solid Databox build-out

## Purpose

This plan turns the [`civics-au-buildout-todo.md`](../civics-au-buildout-todo.md) backlog into an
ordered set of tracked work items. It is deliberately **coarse**: every item gets a stable ID,
dependencies, an agent level and an acceptance gate, but prompt-level detail is written per wave
as it starts — the same pattern that carried DBX-01…25 and CKAN-01…18 to completion.

The todo document remains the narrative backlog (what and why). This plan is the executable
layer (order, gates, evidence). When they disagree, the plan is authoritative for tracking and
the todo for intent.

## Tracking mechanics

- **Status board:** `databox/devdocs/civics-progress.md` — one row per item, updated in the
  same commit that changes the state.
- **Handoffs:** `databox/devdocs/handoffs/CIV-<id>.md` — same contract as the DBX handoffs:
  commits/changed files, decisions consumed and created, commands and test results, security
  assumptions, unresolved questions, artifacts available to dependents.
- **State machine** (same as the DBX board):

  ```text
  not-ready --> ready --> running --> review --> accepted
                      |          |          |
                      v          v          v
                   blocked    changes     rejected
  ```

- **Acceptance rule:** an item is `accepted` only when its gate evidence is linked in its
  handoff. A status row without a handoff is not done — this is the rule that prevents the
  earlier Phase-8-style drift between claimed and actual state.
- **Verification is throttled:** this machine starves above `--maxWorkers=2` (proven in the
  July dependency pass — 51 false timeouts at 7 workers). All gates run throttled, and exit
  codes are captured, not inferred through pipes.

## Agent levels

Reuse the [prompt-implementation-plan.md](prompt-implementation-plan.md) rubric unchanged:
**Easy** (scaffolding, docs, bounded tests), **Medium** (multi-file work on known patterns),
**Hard** (identity, cryptography, policy semantics, tenancy, evidence, adversarial security).
Hard items touching cryptography, legal policy or tenant isolation require an independent
reviewer; a blocked decision is recorded, never invented.

## ID scheme

| Series | Source in backlog | Meaning |
|---|---|---|
| `CIV-Cxx` | Part C | Incomplete work already in the repo |
| `CIV-Axx` | Part A | Personal databox profile + DNS/hosting |
| `CIV-Bxx` | Part B | civics.au functionality → databox |
| `DBX-26/27/28` | Part C.2 | Kept under their original IDs — they are gates of the existing plan, not new work |

## Dependency overview

```text
Wave 0  C01 C02 C03 C04 C05 C06          (housekeeping — no deps, cheap)
Wave 1  A01 ── A02, A07, A08             (personal profile)
        A03 ── A04 ── A05                (DNS/hosting chain)
        (C06 feeds real installs here)
Wave 2  DBX-26 ── DBX-27 ── DBX-28       (release gate tail)
        C10                              (production hardening)
Wave 3  C11 ── C12 ── C13                (Oxigraph live proof chain)
        C14 C15 C16 C17                  (POS/display/website live proof)
Wave 4  B01 ── B02 ── B03                (guardianship core)
        B04 ── B05, B06                  (concession credentials)
        B07 B08 B09 B10 B11              (settlement, audit, coercion)
Wave 5  B20 ── B21 ── B22                (ledger → portfolio → payback)
        B23 B24 B25 B26                  (stats, milestones, federation, supply chain)
Wave 6  B30 ── B31                       (reasoning → boundary enforcement)
        B32 ── B33 ── B34, B35           (WoT → telemetry → billing/access)
        B36 B37                          (device fallback auth, edge inference)
Wave 7  B40 ── B41, B42                  (food commons — needs B20)
        B43 B44 B45 B46 B47              (library — needs C17, B22, B34)
        B48 B49 B50                      (cooperative services)
        B51 ── B52                       (social web — needs B01, B31)
Wave 8  C20 C21 C22 C23 C24              (deps, docs, CKAN ops — continuous)
```

Waves are a recommended sequence, not a hard gate — items may run ahead when their own
dependencies are accepted. Contract-producing items (vocabularies, schemas, stores) must be
accepted before their consumers begin.

---

## Wave 0 — Housekeeping

Cheap, unblocking work. Clears the decks so later items measure from a clean baseline.

| ID | Item | Depends | Level | Acceptance gate |
|---|---|---|---|---|
| CIV-C01 | Repo-root cleanup: remove/relocate `scratch-*.ts`, `CmsHttpHandler.orig.ts`, `extract_*.js`, `rewrite_handler*.js`, `check-*.cjs`, stale logs, `x.trim().replace('`, demo HTML files | none | Easy | Working tree contains no stray files; build + lint + unit green at `--maxWorkers=2` |
| CIV-C02 | Swap fail-closed stub defaults for real impls in presets (`RegistryTenantResolver`, `AuthenticatedContextExtractor`, `RandomOpaqueIdentifierGenerator`, `ComposedDataboxPermissionReader`, `HashChainedEvidenceLedger`) | none | Medium | Live presets reference real impls; scaffold preset still fail-closed; authorization + tenant tests green |
| CIV-C03 | Verify P0 installer claims landed in code (CSPRNG, Node download, app extraction, crypto bootstrap, Windows check, chrono) | none | Easy | Handoff cites the actual code lines per claim; anything absent gets a new numbered item |
| CIV-C04 | Re-run the 5 previously-failing integration suites (Identity, WebSocketChannel2023, WebhookChannel2023, LdpHandlerWithoutAuth, V6Migration) | none | Medium | Suites pass throttled, or each failure has a root cause and an owning item |
| CIV-C05 | Rust open items: direct cash-drawer I/O, unused imports, fullscreen display, installer/pos-edge unit tests, POS-edge IPC integration test | none | Medium | `cargo test` green; drawer mode drives hardware or returns an explicit unsupported error, never silent `Ok` |
| CIV-C06 | Windows Service + systemd registration in `native/installer/src/service.rs` (launchd-only today) | none | Medium | Service registers, starts, survives reboot on Windows and Linux; macOS path unchanged |
| CIV-C25 | Production `DataboxAuthorizationInputResolver` — the per-request input assembler `ComposedDataboxPermissionReader` (DBX-14) needs; only test fixtures exist today. Discovered during CIV-C02: the C4 authorizer seam stays fail-closed until this lands. Assemble tenant (C5), authenticated context (C3), relationship status, delegation, immutability classification and ODRL precondition per the DBX-14 conjunction | C02 | Hard | Composed reader wired in a preset, spliced before/alongside the WAC union; resolver `undefined` still fails closed; truth-table tests cover every conjunct |
| CIV-C26 | Databox seam-layer Components.js registration — the whole layer is in `.componentsignore`; making it config-instantiable needs: `typeof`-const expressions (InstitutionProfile) refactored or bypassed, `readonly` arrays absent from constructor-param types, function-typed params (`now`) wrapped in no-arg factories, interface-typed params given config-loadable sources (e.g. a crosswalk file/env loader), plus a diagnosis of why `InMemoryRelationshipMappingRegistry` does not emit. Also fix the upstream `componentsjs-compile-config` empty-term failure so presets can be validated | C02 | Hard | `experimental.json` loads and instantiates every seam; `componentsjs-compile-config` clean; no type weakening that harms the security contract |
| CIV-C27 | Organisation-side `/.databox/consume/*` endpoints — the serving half of the person-side transport contract declared by `RemoteConsumeClient` (CIV-A07): `GET challenge`, `POST token`, `POST records`, `POST submissions`, `GET feed`. Composes the existing org-side components (`HolderKeyProofVerifier`, `ProvisionalTokenExchange`, record store, `RetentionBoundedCursorFeed`, submission intake + receipt signing) behind holder-proof-bound short-lived tokens | A07 | Hard | A personal vault end-to-ends against a live org databox: import → challenge → token → records → submission receipt → feed cursor recovery; unauthorized/non-owner requests fail closed |

## Wave 1 — Personal databox profile

The stated priority: a person runs their own databox on their own machine, with a real DNS
path. Everything person-facing exists today only as a client library — this wave builds the
server-side personal profile.

| ID | Item | Depends | Level | Acceptance gate |
|---|---|---|---|---|
| CIV-A01 | Personal databox preset — Layer-1 pod + person-facing endpoints (credential install target, vault sync, LDN inbox, cursor-feed consumer) without Smithy/IPMS | none | Medium | Preset boots; pod provisions; no org control-plane surface exposed; profile-ladder doc updated |
| CIV-A02 | Personal onboarding flow — guided setup: create pod, import first connection credential (QR/URI), choose backup/continuity options | A01 | Medium | A non-expert path from install to first working connection, exercised end-to-end |
| CIV-A03 | Personal hosting plan — single-hostname (or `pod.`/`id.`) plan template in `HostingConfig.ts`, applied by existing `CloudflareApi` | none | Easy | Personal plan type validates; DNS records + tunnel ingress generated for the personal shape |
| CIV-A04 | NAT-traversal decision + TLS automation — ADR choosing Cloudflare Tunnel vs port-forward+ACME vs cooperative subdomain; implement chosen path incl. cert issuance/renewal | A03 | Hard | ADR records the trade-off honestly (tunnel terminates at CDN); a fresh home machine reaches a working `https://` hostname end-to-end |
| CIV-A05 | Cooperative-subdomain / dynamic-DNS fallback — delegated `*.members.<coop>` issuance, RFC 2136 or provider API | A04 | Medium | A user without a Cloudflare account or domain gets a working name through the fallback |
| CIV-A07 | Consumer-vault server endpoints — per-program isolated connection registry, notify-then-pull sync worker, durable cursor consumer, private submission composer | A01 | Hard | Two synthetic programs held by one vault; neither learns the other; recovery after downtime via cursor, not assumed WebSocket delivery |
| CIV-A08 | Cooperative-hosted fallback — person pod provisioning on a coop server + owner-key encrypted backup restore path | A01 | Medium | A person with no hardware gets a working pod+connection; coop operator cannot read backup contents |
| CIV-A09 | Household pod topology — family/share-house profile: per-member pods + shared commons pod + member registry + DNS plan on one host | A01 | Medium | A household plan emits N member pods + commons + governance policy; per-member WebIDs; commons has no owner — governed, not owned |
| CIV-A10 | Household governance + member consent — admin models (sole admin, m-of-n quorum, full consensus), member→member electronic permission requests, audit trail | A09 | Medium | Admin action under quorum 1 executes alone; quorum>1 stalls until approvals meet quorum; member consent grant is scoped, recorded, revocable |
| CIV-A11 | Guardianship model — guardian kinds w/ unequal precedence (parent > appointed > attorney > kinship > professional > supporter), 9 duty scopes, time-bounds, multi-household relations, capacity scale (full/emerging/limited/supported) anchored to CRC/CRPD | A09 | Medium | Parents outrank others by default; a ward with no in-force guardian for a scope is a surfaced gap; supporters never substitute |
| CIV-A12 | Safety recipes — SHACL-grounded decision catalog (contact boundary, data-sharing, location, residence, medical, supported-decision, emergency) + ward-decision flow: voice recorded, quorum decided, record SHACL-validated before it stands | A11 | Medium | Recipe declares scope + consent-rule + ward-voice + SHACL shape + rights anchors; an approved decision with a nonconformant record is rejected-record, never stored |
| CIV-A13 | Qualified input, information asymmetry, dispute resolution, specialist credentials — scope-weighted advisory weight, privy-to-records without deciding, external resolvers (mediator/tribunal/court, independence-checked), admin-asserted justice/emergency-medical grants | A11, A12 | Medium | Specialist outranks lay advisor in-field but never gains a vote; deciders see records non-deciders do not; resolver must be external + independent; grants are scoped/time-bounded/notified |
| CIV-A14 | Household HTTP surface — `/.databox/household`: member-WebID auth, guardian-relation mgmt, recipe discovery, ward-decision request/decide, dispute open/resolve (external resolver), specialist-access grants. Caller is always the resolved member — no act-as-another | A09, A11, A12, A13 | Medium | Members act under own WebID; admins assert relations/grants; resolvers authenticated by WebID; a stranger cannot even enumerate the surface |

## Wave 2 — Release-gate tail

The DBX plan's own completion criteria. Everything else builds credibility debt until these pass.

| ID | Item | Depends | Level | Acceptance gate |
|---|---|---|---|---|
| DBX-26 | Adversarial security suite — run the 58-threat model attacks end-to-end | DBX-25 | Hard | Independent Hard reviewer reproduces critical negatives; no unresolved critical/high tenant, identity, crypto or evidence finding |
| DBX-27 | Interoperability & conformance — ≥2 independent non-Databox Solid clients + reference agent against the packaged deployment; compatibility manifest + conformance report | DBX-25, 26 | Hard | Every requirement passed/failed/N-A with evidence; nothing marked passed for existing |
| DBX-28 | Operational & release readiness — runbooks, SBOM, secret scan, hardening checklist, key ceremony + restore rehearsals, signed readiness decision | DBX-25, 26, 27 | Hard | Restore and key-rotation rehearsals pass; residual risks have named owners |
| CIV-C10 | Production hardening — durable preset registries/keys/outbox replacing process-local state; KMS-backed keys; WORM evidence ledger | DBX-28 | Hard | Restart/durable-store tests; no process-local authority remains on the release path |

## Wave 3 — IPMS live proof

Per `handoffs/CMS-next-swarm.md`: the remaining value is runtime proof, not more builders.

| ID | Item | Depends | Level | Acceptance gate |
|---|---|---|---|---|
| CIV-C11 | Live Oxigraph endpoint — provision `oxigraph`, run unified + split-mode smoke, capture in `ipms-oxigraph-smoke.md` | none | Easy | Real endpoint run recorded with URLs, commands, failure notes |
| CIV-C12 | Live network hydration — `OxigraphIpmsSyncComposition` against the live endpoint; prove rebuildable-from-pods | C11 | Medium | Write/update/delete through CSS reaches SPARQL endpoint; canonical-pod invariant holds |
| CIV-C13 | Live migration proof — `run-ipms-migration-proof.mjs` file-backed CSS → Oxigraph → vanilla Solid, not just in-memory | C12 | Medium | Full loop passes on live endpoints |
| CIV-C14 | POS persistence completion — register open/close/count, customer-display state, table-session/Wi-Fi through `ResourceStore` | none | Medium | Round-trips as canonical RDF; readable via plain LDP like ordering flow |
| CIV-C15 | Native POS edge package — deployable shell, mTLS/WebID-TLS verify, printer/drawer I/O, QR bitmap, offline replay spool | C05 | Hard | Real or faithfully-mocked hardware run; offline queue replays without loss |
| CIV-C16 | Live customer display — playlists through Solid; updates via CSS/Solid notifications on real/native display | C14 | Medium | Display client updates from a live notification, not polling |
| CIV-C17 | Live public website publishing — RDF-backed HTML/JSON-LD, sitemap, OpenGraph, theme CSS, feeds; vanilla-Solid degradable | none | Medium | Published site serves without CSS-private routes; source Turtle readable via LDP |

## Wave 4 — Guardianship & entitlement core

The civics.au heartland: care relations and the concession layer. B.3 alone is subsystem-scale —
decompose further when the wave opens.

| ID | Item | Depends | Level | Acceptance gate |
|---|---|---|---|---|
| CIV-B01 | Guardianship relation type + vocabulary — scoped, visible, revocable, distinct-party; guardian acts *for*, never *as* | none | Hard | Vocabulary + lifecycle API; every delegated act records both parties; impersonation structurally impossible |
| CIV-B02 | Capacity-scaled + duty-slice delegation — child guardianship shrinking with capacity; narrow context/time-bounded duty slices (childcare, teacher, coach) | B01 | Medium | Scope/expire rules enforced; lapsed duty denies |
| CIV-B03 | Multi-party duty webs — several specialists each holding scoped duties under a coordinator | B01 | Hard | Duty registry supports N parties without privilege bleed; revocation of one leaves others intact |
| CIV-B04 | Attribute-based credential profile — circumstance attributes (residence type, hardship markers, contribution), pairwise holder IDs, no identity dossier | none | Hard | Verifier receives attributes/proofs only; two verifiers cannot correlate the same holder |
| CIV-B05 | Issuer trust registry — governed, anchored issuers for high-stakes credentials (extends `proof/IssuerTrustStore.ts`) | B04 | Hard | Non-anchored issuer fails closed; Sybil issuance blocked |
| CIV-B06 | OIDC4VP verification flow — verifier requests attributes; holder's pod returns boolean/ZK eligibility proof | B04, B05 | Hard | Verifier learns the boolean and nothing else; proof verifies offline |
| CIV-B07 | Offline carried credentials — CBOR-LD QR/NFC; POS local signature verify, whitelist check, grant-balance debit, zero-dollar receipt | B06 | Hard | Full redemption works with holder's device offline; forged/replayed credential rejected |
| CIV-B08 | Programmable-grant settlement — grant balance, MCCs, product whitelists, matching ratios through payments/eftpos/pos | B07 | Hard | Earmarked funds settle only within rules; out-of-scope basket refuses |
| CIV-B09 | Anonymous audit ledger — per-transaction proof a valid unrevoked credential met program rules, no identity recorded | B08 | Hard | Auditor verifies integrity; no path from ledger entry to person |
| CIV-B10 | Decision-record logging — every automated eligibility decision logs rule ID + policy/circuit version | B08 | Medium | Any decision is reproducible from its logged rule + version |
| CIV-B11 | Coercion resistance — safe-exit, deadman-switch, history obfuscation, clean-break credentials via delegated advocate | B01, B04 | Hard | Advocate flow works; abuser's access revocable without alerting channel misuse |

## Wave 5 — Community ledger & cooperative economics

| ID | Item | Depends | Level | Acceptance gate |
|---|---|---|---|---|
| CIV-B20 | Resource-commit ledger — auditable records of time/skills/materials/facility contributions ("version control for real-world projects") | none | Medium | Commits are signed, provenance-bound, append-only; queryable per project/person |
| CIV-B21 | Community portfolio — person-curated collection of recognised contributions in their own pod; selectively disclosable, re-lockable | B20, A07 | Hard | Portfolio lives person-side; disclosure is per-party scoped; no public scoreboard |
| CIV-B22 | Obligation-cost accounting + payback waterfall — contributions repaid when project earns; charitable routing option | B20 | Medium | Waterfall distributes by declared equity; recognition and payment decoupled |
| CIV-B23 | Anonymised community statistics — privacy-preserving civic aggregates for funding evidence | B20 | Hard | Aggregate published with no re-identification path; minimum-cohort rules enforced |
| CIV-B24 | Milestone spine + fair-value scales — 3-stage gated milestones; declared valuation of time/equipment/space | B20 | Medium | Stage gates block unsigned progression; scales versioned and visible |
| CIV-B25 | Multi-site project federation — project state portable via IPMS works bundles across grounds | B20, C13 | Medium | Project exported from site A imports + continues at site B |
| CIV-B26 | Supply-chain hygiene — credential-verified contractors, circular-material provenance, grant disbursement→asset tracing | B04, B20 | Medium | Unverified supplier fails closed; reclaimed material carries provenance chain; grant trail auditable end-to-end |

## Wave 6 — Reasoning & devices

| ID | Item | Depends | Level | Acceptance gate |
|---|---|---|---|---|
| CIV-B30 | Local reasoning engine over pod RDF — checkable rule derivations over permissioned data (N3/EYE-style or deterministic layer over Oxigraph) | none | Hard | Every conclusion carries its derivation; no probabilistic path in the boundary decisions |
| CIV-B31 | Deterministic boundary enforcement — guardianship rules enforced by B30; unsafe spaces structurally unreachable | B01, B30 | Hard | Declared boundary denies deterministically; rule change re-evaluates access |
| CIV-B32 | WoT Thing Descriptions as pod resources — devices represented/discoverable as TDs | none | Medium | Enrolled device exposes a valid TD readable via LDP |
| CIV-B33 | SOSA/SSN telemetry pipeline — observations land as standard RDF; append-only device write grants | B32 | Medium | Reading arrives as SOSA/SSN RDF over notification channel; device cannot alter history |
| CIV-B34 | Telemetry → billing — meter telemetry feeding micro-billing and P2P energy settlement | B33 | Hard | Metered usage produces a receipted charge; dispute reconstructable from evidence |
| CIV-B35 | Credential-gated physical access — turnstile VC verify without identity exposure; purpose-limited licensed jobs (3D printer) | B04, B32 | Hard | Valid credential opens; invalid/expired denies; verifier learns nothing beyond the gate decision |
| CIV-B36 | Device fallback auth — Solid-OIDC client-credentials/DPoP for devices that can't do mTLS | B32 | Medium | Non-mTLS device authenticates scoped; least-privilege enforced |
| CIV-B37 | Edge inference patterns — private health-context matching, skill/task matching, microgrid dispatch at edge | B30, B41 | Medium | Inference runs locally against pods; no personal data leaves the edge |

## Wave 7 — Community-facing services

| ID | Item | Depends | Level | Acceptance gate |
|---|---|---|---|---|
| CIV-B40 | Food evidence-graph vocabulary + publishing — 297 foods, typed edges, evidence tiers, cautions, 200 meals as RDF works | none | Medium | Graph publishes as linked data; tier/caution/provenance preserved; SPARQL-queryable |
| CIV-B41 | Scoped-disclosure matching API — food business gets scoped attributes, matches evidence graph, returns choices; never holds health record | B40, B04 | Hard | Business receives only granted attributes for that exchange; nothing persists beyond it |
| CIV-B42 | Commons-maintenance workflow — contributions/corrections as logged resource commits with reviewer roles | B40, B20 | Medium | Every graph change carries provenance + review state; fork/extend works |
| CIV-B43 | Noticeboard + local guide module — events, listings, amenities, businesses, clubs in schema.org, any-client queryable | none | Medium | Entries readable by a vanilla Solid/LDP client; no private API required |
| CIV-B44 | Living archive — heritage/historical-society collections with public publishing path | B43, C17 | Medium | Collection curated in-pod and published publicly; community controls storage |
| CIV-B45 | Civic window — council submissions/consultations, grants, licensing, issue reporting; complements CKAN bridge | B43 | Medium | A resident reaches civic functions without council systems holding community data |
| CIV-B46 | Cross-site shared namespace + federated query — agreed addressing scheme; SPARQL federation across communities | B43, C13 | Hard | Federated query across two sites returns unified results; no central index |
| CIV-B47 | Physical-site services — check-ins, amenity access, small payments, micro-billing on one account | B34, B43 | Medium | Person sees exactly what each access shared; billing reconciles with telemetry |
| CIV-B48 | Owner-key encrypted backups + continuity — coop holds backups it cannot read; lost-box recovery without ownership transfer | A08 | Hard | Operator cannot decrypt; owner restores to new hardware with keys alone |
| CIV-B49 | Digital estate / standing instructions — death/incapacity: what passes to family, executor, sealed, destroyed | B01, B48 | Hard | Instructions execute as declared under the triggering event; evidence-grade audit of the execution |
| CIV-B50 | Fiduciary-duty auditability — operator actions on member pods evidence-logged and reviewable | B48 | Hard | Any operator touch is reconstructable; covert access structurally prevented or detected |
| CIV-B51 | Community social spaces — rooms with declared membership/norms; social graph in each person's pod | B43 | Medium | Space membership/norms enforced; no global platform dependency |
| CIV-B52 | Child-safe bounded spaces — B31 boundaries applied to social membership/contact | B51, B31 | Hard | Child participates inside guardian-declared boundary; outside contact unreachable, not filtered |
| CIV-B53 | Pod-bound local LLM agent — `node-llama-cpp` server-side (native accel) or `wllama` WASM client-side served from the pod as static assets; strict CSP (`connect-src` limited to pod + model registry); OpenAI-style tool-calling surface; zero external inference calls. The agent is ASSISTIVE ONLY — never a boundary decision path (B30 stays deterministic) | A01 | Hard | Model + wasm served from pod; CSP blocks third-party inference endpoints; tool calls execute via injected ResourceStore, not public HTTP |
| CIV-B54 | Ephemeral Oxigraph SPARQL tool layer — per-query in-memory `oxigraph.Store` loaded from internal `ResourceStore` reads; RDF/JS-compliant; token-flattened result serialization for the LLM context; pod-bounded (never calls out) | B53 | Medium | LLM `query_pod_graph`/`read_rdf` tool returns pod data as flattened JSON-LD; no HTTP egress; WASM store freed per call |
| CIV-B55 | SHACL-gated LLM write path — agent assertions stage to an in-memory quad store, validate against pod SHACL shapes, commit on conformance or remediate on failure; every agent cycle logs PROV-O (Entity=prompt, Activity=inference, Entity=generation+tool calls) to a pod log container | B54 | Medium | A hallucinated/invalid triple never reaches the store; conformance report + provenance trail exist for every committed assertion |
| CIV-B56 | WASM voice pipeline — whisper.wasm ASR + wllama + Piper TTS (or unified Transformers.js v3), all in-browser/local; grounded in the B54/B55 semantic loop so voice intent becomes SHACL-validated assertions, not free text | B53, B54, B55 | Hard | Spoken command produces a SHACL-conformant assertion or a remediation prompt; audio never leaves the device; works offline |

Runs alongside, not last.

| ID | Item | Depends | Level | Acceptance gate |
|---|---|---|---|---|
| CIV-C20 | Dependency upgrade programme — 47 blocked majors, cluster-aware per `dependency-upgrade-plan.md` | none | Medium | Each cluster lands green (build/lint/tsc/unit/integration throttled) or is pinned with reason |
| CIV-C21 | MkDocs databox content — site name, repo URL, databox/IPMS/smithy-admin/deployment docs | none | Easy | MkDocs builds with databox nav; no upstream-CSS-only pages presented as this project |
| CIV-C22 | gh-pages landing completeness — module catalog, org mobile apps, Rust components, compliance, evidence, deployment per audit matrix | none | Easy | Every `functionality-audit.md` gap row addressed or explicitly deferred |
| CIV-C23 | README + deployment linking — IPMS, native/Rust, mobile apps, Docker/K8s docs linked | none | Easy | Audit matrix shows no `None` cells for covered areas |
| CIV-C24 | CKAN bridge live e2e + plugin packaging + runbooks | C10 | Medium | Bridge runs against a real CKAN instance; Python plugin installable; ops covered in DBX-28 runbooks |

---

## Execution rules (carried from the DBX plan, unchanged)

1. Run items in dependency order; do not fan an entire wave into one agent.
2. Contract producers (vocabularies, schemas, store interfaces) are accepted before consumers start.
3. No placeholder that silently permits access or claims conformance; blocked decisions are recorded, not invented.
4. An `accepted` status without gate evidence in the handoff does not exist.
5. New findings create a new numbered item with dependencies — never hidden inside an existing
   completion claim.
6. Waves 2 and 8 have no dependencies on Waves 1/4–7: the release-gate tail and continuous
   hardening may run ahead whenever reviewer capacity allows.
