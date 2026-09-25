# Civics Build-Out — Progress Tracker

Companion to [`civics-implementation-plan.md`](civics-implementation-plan.md).
Update the row in the same commit that changes state. `accepted` requires a linked handoff
with gate evidence — a status without a handoff is not done.

States: `not-ready → ready → running → review → accepted` (`blocked`, `changes`, `rejected`).

## Wave 0 — Housekeeping

| ID | Item | Status | Handoff |
|---|---|---|---|
| CIV-C01 | Repo-root cleanup | accepted | [CIV-C01](handoffs/CIV-C01.md) |
| CIV-C02 | Fail-closed stub wiring swaps | accepted | [CIV-C02](handoffs/CIV-C02.md) |
| CIV-C03 | Verify P0 installer claims | accepted | [CIV-C03](handoffs/CIV-C03.md) |
| CIV-C04 | Re-run 5 previously-failing integration suites | accepted | [CIV-C04](handoffs/CIV-C04.md) |
| CIV-C05 | Rust open items (drawer, warnings, fullscreen, tests, IPC) | accepted | [CIV-C05](handoffs/CIV-C05.md) |
| CIV-C06 | Windows/systemd service registration | accepted | [CIV-C06](handoffs/CIV-C06.md) |
| CIV-C25 | Production `DataboxAuthorizationInputResolver` (found during C02) | accepted | — |
| CIV-C26 | Seam-layer Components.js registration (found during C02) | done — all seams emit + instantiate; upstream launch bindings remain | [CIV-C26](handoffs/CIV-C26.md) |
| CIV-C27 | Org-side `/.databox/consume/*` endpoints (found during A07) | done | `consume/ConsumeHttpHandler` — challenge→token→records→submit, live-tested (ConsumeInterop) |

## Wave 1 — Personal databox profile

| ID | Item | Status | Handoff |
|---|---|---|---|
| CIV-A01 | Personal databox preset | accepted | [CIV-A01](handoffs/CIV-A01.md) |
| CIV-A02 | Personal onboarding flow | accepted | [CIV-A02](handoffs/CIV-A02.md) |
| CIV-A03 | Personal hosting plan | accepted | [CIV-A03](handoffs/CIV-A03.md) |
| CIV-A04 | NAT-traversal decision + TLS | accepted | [CIV-A04](handoffs/CIV-A04.md) |
| CIV-A05 | Cooperative-subdomain/dynamic-DNS fallback | accepted | [CIV-A05](handoffs/CIV-A05.md) |
| CIV-A07 | Consumer-vault server endpoints | accepted | [CIV-A07](handoffs/CIV-A07.md) |
| CIV-A08 | Cooperative-hosted fallback | accepted | [CIV-A08](handoffs/CIV-A08.md) |
| CIV-A09 | Household pod topology (family/share-house) | accepted | [CIV-A09](handoffs/CIV-A09.md) |
| CIV-A10 | Household governance + member consent | accepted | [CIV-A10](handoffs/CIV-A10.md) |
| CIV-A11 | Guardianship model — precedence, scopes, multi-household, capacity | accepted | [CIV-A11](handoffs/CIV-A11.md) |
| CIV-A12 | Safety recipes — SHACL decision catalog + ward-decision flow | accepted | [CIV-A12](handoffs/CIV-A12.md) |
| CIV-A13 | Qualified input, information asymmetry, disputes, specialist credentials | accepted | [CIV-A13](handoffs/CIV-A13.md) |
| CIV-A14 | Household HTTP surface — member-WebID auth + guardianship routes | accepted | [CIV-A14](handoffs/CIV-A14.md) |

## Wave 2 — Release-gate tail

| ID | Item | Status | Handoff |
|---|---|---|---|
| DBX-26 | Adversarial security suite | running — live deployment-tier P1 harness lands (5/5) | [DBX-26](handoffs/DBX-26.md) |
| DBX-27 | Interoperability & conformance | done — live 3-client suite (7/7) + report + manifest | [conformance](../conformance/README.md) |
| DBX-28 | Operational & release readiness | done — runbooks + SBOM + clean scans + rehearsals + signed decision | [ops](../ops/README.md) |
| CIV-C10 | Production hardening (durable stores, KMS, WORM) | running | durable registries + WORM ledger done (restart-safe); KMS custody residual |

## Wave 3 — IPMS live proof

| ID | Item | Status | Handoff |
|---|---|---|---|
| CIV-C11 | Live Oxigraph endpoint | ready | — |
| CIV-C12 | Live network hydration | not-ready | — |
| CIV-C13 | Live migration proof | not-ready | — |
| CIV-C14 | POS persistence completion | ready | — |
| CIV-C15 | Native POS edge package | not-ready | — |
| CIV-C16 | Live customer display | not-ready | — |
| CIV-C17 | Live public website publishing | ready | — |

## Wave 4 — Guardianship & entitlement core

| ID | Item | Status | Handoff |
|---|---|---|---|
| CIV-B01 | Guardianship relation type + vocabulary | ready | — |
| CIV-B02 | Capacity-scaled + duty-slice delegation | done | `policy/CapacityDelegation` — slice ∩ capacity-ceiling, substitution-class never delegated to supported/limited |
| CIV-B03 | Multi-party duty webs | done | `policy/DutyWeb` — a duty discharges only when every named holder carries their part, hash-chained |
| CIV-B04 | Attribute-based credential profile | ready | — |
| CIV-B05 | Issuer trust registry | review | `proof/IssuerTrustStore` — per-program trusted-issuer set + rotation/revocation; governance admission open |
| CIV-B06 | OIDC4VP verification flow | done | `credential/Oidc4VpFlow` — request→present→verify, holder-bound single-use nonce, selective claims, fail-closed |
| CIV-B07 | Offline carried credentials | done | `credential/OfflineCredential` — compressed signed token, offline verify, trusted-key + forgery gated |
| CIV-B08 | Programmable-grant settlement | done | `concessions/ProgrammableGrant` — category/cap/expiry/balance-gated, hash-chained spend log |
| CIV-B09 | Anonymous audit ledger | done | `credential/AnonymousAuditLedger` — nullifier-keyed valid-presentation, no holder id, replay-safe |
| CIV-B10 | Decision-record logging | done | `concessions/EligibilityDecisionLog` — hash-chained, inputs-digest (no raw attrs), supersession/appeal |
| CIV-B11 | Coercion resistance (safe-exit, deadman-switch) | done | `personal/SafeExit` — duress-signal + deadman-lapsed posture, decoy view, audited, fail-safe |

## Wave 5 — Community ledger & cooperative economics

| ID | Item | Status | Handoff |
|---|---|---|---|
| CIV-B20 | Resource-commit ledger | done | `community-ledger/ContributionLedger` — append-only, hash-chained, durable (restart-safe) |
| CIV-B21 | Community portfolio | running | authoritative `contributions()`/`recognise` projection done; selective-disclosure pod view open |
| CIV-B22 | Obligation-cost accounting + payback | done | `community-ledger/PaybackWaterfall` — weighted settlement + charitable routing |
| CIV-B23 | Anonymised community statistics | done | `CommunityStats` — k-anonymous aggregation, no identities |
| CIV-B24 | Milestone spine + fair-value scales | done | `MilestoneSpine` — 3-stage gated advance (quorum+evidence, fail-closed) + per-stage value scales |
| CIV-B25 | Multi-site project federation | done | `community-ledger/ProjectFederation` — credential-gated cross-site sync, signed+revocable membership |
| CIV-B26 | Supply-chain hygiene | done | `supply-chain/ChainOfCustody` — credentialed custody steps, hash-chained provenance, trusted-issuer gated |

## Wave 6 — Reasoning & devices

| ID | Item | Status | Handoff |
|---|---|---|---|
| CIV-B30 | Local reasoning engine over pod RDF | ready | — |
| CIV-B31 | Deterministic boundary enforcement | done | `policy/BoundaryEnforcer` — pure gate over declared guardianship, no override input, fail-closed |
| CIV-B32 | WoT Thing Descriptions as pod resources | done | `ipms/modules/wot/` — TD builder + `ThingRegistry` (discoverable pod resources) |
| CIV-B33 | SOSA/SSN telemetry pipeline | done | `wot/TelemetryPipeline` — sosa:Observation RDF in the device's append-only telemetry ns |
| CIV-B34 | Telemetry → billing | done | `wot/TelemetryBilling` — tariff-priced charge/credit lines, observation-auditable |
| CIV-B35 | Credential-gated physical access | done | `access/CredentialGate` — narrow-claim VC check, no holder identity, issuer+claim+expiry |
| CIV-B36 | Device fallback auth | done | `device-auth/DeviceFallbackAuth` — scoped client-creds + DPoP-bound, secret-hashed, never pod-wide |
| CIV-B37 | Edge inference patterns | done | `modules/llm/EdgeInference` — read-time CONSTRUCT over pod RDF, PROV-O provenance, deterministic overlay |

## Wave 7 — Community-facing services

| ID | Item | Status | Handoff |
|---|---|---|---|
| CIV-B40 | Food evidence-graph vocabulary + publishing | ready | — |
| CIV-B41 | Scoped-disclosure matching API | done | `disclosure/ScopedDisclosure` — minimal permitted attrs, purpose/recipient-bound, fail-closed |
| CIV-B42 | Commons-maintenance workflow | done | `community-ledger/CommonsMaintenance` — propose→SHACL-validate→review→merge, separation of duties, audited |
| CIV-B43 | Noticeboard + local guide module | ready | — |
| CIV-B44 | Living archive | done | `community-library/LivingArchive` — canonical+replica sets, governed localise, digest-checked sync |
| CIV-B45 | Civic window | done | `community-library/CivicWindow` — content-addressed public display over the namespace |
| CIV-B46 | Cross-site shared namespace + federation | done | `community-library/SharedNamespace` — stable community URIs ↔ site URIs, governed rebind, conflict-safe |
| CIV-B47 | Physical-site services | done | `community-library/ItemLending` — member-gated checkout/return, single-custody, overdue view |
| CIV-B48 | Owner-key encrypted backups + continuity | done | `personal/OwnerKeyBackup` — owner-key ECDH+AES-GCM, coop stores ciphertext only |
| CIV-B49 | Digital estate / standing instructions | done | `personal/DigitalEstate` — digest-bound directives, quorum-attested trigger, revocable |
| CIV-B50 | Fiduciary-duty auditability | done | `policy/FiduciaryAudit` — every privileged access needs a justification ref, hash-chained, fail-closed |
| CIV-B51 | Community social spaces | done | `social/BoundedSpace` — member-admitted, hash-chained posts, moderation-auditable |
| CIV-B52 | Child-safe bounded spaces | done | `social/BoundedSpace` — child admission gated on declared online-contact bound via BoundaryEnforcer |
| CIV-B53 | Pod-bound local LLM agent (node-llama-cpp/wllama) | running | [CIV-B53](handoffs/CIV-B53.md) — agent loop + Ollama backend + store adapters done |
| CIV-B54 | Ephemeral SPARQL tool layer | done | `SparqlEngine` port — engine-agnostic ephemeral store (ADR-0028) |
| CIV-B55 | SHACL-gated LLM write path + PROV-O agent audit | done | `propose_rdf_assertion` + `ContainerAssertionCommitter` to real ResourceStore |
| CIV-B56 | WASM voice pipeline (whisper/piper/transformers.js) | running | `VoiceIntentPipeline` (transcript→SHACL-gated loop) done; WASM ASR/TTS device-shell external |

## Wave 8 — Continuous hardening

| ID | Item | Status | Handoff |
|---|---|---|---|
| CIV-C20 | Dependency upgrade programme | ready | — |
| CIV-C21 | MkDocs databox content | ready | — |
| CIV-C22 | gh-pages landing completeness | ready | — |
| CIV-C23 | README + deployment linking | ready | — |
| CIV-C24 | CKAN bridge live e2e + packaging + runbooks | not-ready | — |

---

**Counts:** 50 tracked items · 9 accepted · 20 ready · 21 not-ready · 0 running
