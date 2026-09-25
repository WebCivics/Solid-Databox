# Mapping Smithy implementation prompt series

## Execution rules

This series uses the DBX plan’s agent levels, handoff contract, independent review requirements, and global security
invariants. Every prompt produces a `databox/handoffs/MFG-NN.md` record. A prompt is incomplete until its acceptance
gate passes.

Do not parallelize prompts that modify the same contracts. Identity, authorization, tenant isolation, cryptography,
legal-policy compilation, emergency access, or external publication requires the named human review in addition to
agent review.

## Dependency overview

```text
MFG-01 -> MFG-02 -> MFG-03 -> MFG-04 -> MFG-05
                                      |       |
                                      v       v
MFG-06 -> MFG-07 -> MFG-08 -> MFG-09 -> MFG-10 -> MFG-11 -> MFG-12
                                               |
                                               v
                           MFG-13 -> MFG-14 -> MFG-15

MFG-03 -> MFG-16 -> MFG-17 -> MFG-18 -> MFG-19

MFG-12 + MFG-15 -> MFG-20 -> MFG-21 -> MFG-22
```

## Wave G — product and backplane

### MFG-01 — Product boundary, requirements, and threat-model extension

**Level:** Hard  
**Depends on:** DBX-01 through DBX-24

Define the five product surfaces, personas, authorization matrix, data classification, deployment modes, service
identities, and threat boundaries. Extend the DBX threat register for smithy workspaces, pack supply chain, mapping
transforms, browser sessions, deployment jobs, external Pods, recipient applications, and adoption connectors.

**Gate:** every state and privileged action has an authority, actor, denial behavior, and testable control.

### MFG-02 — Durable smithy domain and storage ports

**Level:** Hard  
**Depends on:** MFG-01

Replace process-local aggregate ownership with repository interfaces and transactional units for workspaces,
memberships, drafts, releases, mappings, status indices, source events, jobs, receipts, and evidence. Define database
migrations, encryption/key references, backup/restore boundaries, and deterministic demo reset. Do not select a
database by leaking its types into domain contracts.

**Gate:** restart, concurrency, rollback, backup/restore, idempotency, and cross-workspace tests pass.

### MFG-03 — Organization manifest and signed industry-pack registry

**Level:** Hard  
**Depends on:** MFG-01, MFG-02

Implement versioned schemas for organization manifests, industry packs, program blueprints, public-presence profiles,
and pack signatures. Add compatibility, maturity, dependency, provenance, migration, and revocation metadata. Reject
unknown security-critical fields and unsigned/untrusted released packs.

**Gate:** malicious, incompatible, downgraded, tampered, and dependency-confused packs fail closed.

### MFG-04 — Blueprint compiler and review workflow

**Level:** Hard  
**Depends on:** MFG-03

Compile a blueprint and pack into an institution profile and immutable release bundle. Produce findings with stable
codes, source provenance, required human reviews, artifact digests, and migration preview. Separate deterministic
validation from organizational/legal approval.

**Gate:** identical inputs compile identically; missing reviews cannot publish; rollback never edits history.

### MFG-05 — Declarative connector and mapping backplane

**Level:** Hard  
**Depends on:** MFG-02, MFG-04

Define connector manifests and a constrained mapping language for source fields, constants, vocabulary terms,
normalization, validation, idempotency, and record-class routing. Add sample preview, PII classification, quarantine,
reconciliation, secret handles, and outbound destination allowlists. Arbitrary uploaded code is prohibited.

**Gate:** injection, secret exfiltration, customer-ID leakage, schema confusion, replay, and cross-program mapping tests
fail safely.

## Wave H — live Solid exchange

### MFG-06 — Consumer Solid-Pod session adapter

**Level:** Hard  
**Depends on:** MFG-01

Implement browser Solid-OIDC login using authorization code with PKCE, state, nonce, DPoP, issuer discovery, WebID
verification, and a dereferenceable client identifier where supported. Discover storage and create/select an
application container with explicit consent. Keep the holder private key consumer-side.

**Gate:** the local CSS Pod and one independently operated test Pod pass login, storage discovery, authorized CRUD,
logout, token expiry, and denial tests. Identity/security human review required.

### MFG-07 — Live CSS Databox data-plane wiring

**Level:** Hard  
**Depends on:** MFG-02, MFG-06; consumes DBX-25 prerequisites

Make the accepted runtime classes Components.js-compatible and splice tenancy, context, composed authorization,
gateway, append-only storage, receipts, feed, and notifications into a dedicated test-server preset. Preserve the
ordinary Solid Track A surface and keep experimental LWS components isolated.

**Gate:** actual HTTP deposit, retrieve, deny, submission, receipt, and recovery tests pass against a running server;
ordinary Solid behavior is unchanged outside the preset.

### MFG-08 — Consumer connection, sync, and scoped-share protocol

**Level:** Hard  
**Depends on:** MFG-06, MFG-07

Bind the reference consumer agent’s injected ports to real Solid HTTP operations. Store connection metadata and
portable evidence in the consumer’s chosen Pod container, perform holder proof and revocation checks, recover via the
cursor feed, and implement explicit field-scoped disclosure to an allowlisted recipient endpoint.

**Gate:** copied credentials, stale proofs, foreign programs, revoked status, malicious linked data, over-broad field
selection, replay, and recipient substitution all fail closed.

### MFG-09 — Recipient verifier and acknowledgement service

**Level:** Hard  
**Depends on:** MFG-08

Build a separately configured recipient that verifies sender, holder authorization, payload digest, status, purpose,
policy version, expiry, and replay key, then returns a signed acknowledgement. It must not gain general Pod access.

**Gate:** the recipient accepts exactly the demonstrated share and rejects tampering, excess fields, wrong audience,
expired purpose, replay, revoked proofs, and untrusted issuers.

## Wave I — polished application

### MFG-10 — Authenticated Smithy API and job orchestration

**Level:** Hard  
**Depends on:** MFG-02 through MFG-09

Replace the thin unauthenticated demo API with workspace-scoped sessions, CSRF protection, role checks, validation,
pagination, optimistic concurrency, rate limits, audit events, background jobs, and safe error contracts. Keep
customer mapping APIs server-to-server except for the consumer-mediated onboarding ceremony.

**Gate:** API contract, authorization, concurrency, abuse, restart, and job-recovery tests pass.

### MFG-11 — Smithy and consumer web applications

**Level:** Medium  
**Depends on:** MFG-10

Build the required views from `demo-acceptance.md` and `restaurant-demo.md` with accessible components, responsive
layouts, understandable policy language, menu/basket/order flows, evidence drill-down, and complete failure states.
Use the API contracts; do not duplicate security logic in the browser.

**Gate:** automated accessibility checks and keyboard, mobile, error, empty, retry, expiry, revocation, and role-based
journey tests pass.

### MFG-12 — Reproducible showcase packaging

**Level:** Medium  
**Depends on:** MFG-11

Provide synthetic seeds, reset, local TLS/hostnames, local Pod and recipient presets, one-command launch, health
checks, scripted presenter mode, screenshots, and troubleshooting. Clearly label synthetic and provisional parts.

**Gate:** a clean machine can run the twelve-step journey twice without manual database or token edits.

## Wave J — reusable tailoring packs

### MFG-13 — Capability ontology and pack authoring kit

**Level:** Hard  
**Depends on:** MFG-03, MFG-04

Turn `industry-capability-catalog.md` into stable capability identifiers, dependency/risk rules, templates, a pack
authoring CLI, schema documentation, fixtures, and test harness. Preserve unknown/high-risk ideas as gated capability
requests rather than silently approximating them.

**Gate:** a new low-risk pack can be built without runtime code changes and cannot bypass universal invariants.

### MFG-14 — Retail/loyalty and restaurant packs

**Level:** Hard  
**Depends on:** MFG-13

Migrate the synthetic loyalty fixture into the first released pack and add restaurant menu versioning, ordering,
status, receipt, and dietary-preference disclosure. Use synthetic policy inputs and obtain domain review for allergen
wording and operational limitations. Payment authorization remains excluded.

**Gate:** both packs compile, migrate, deploy, reset, and pass positive/negative journey tests.

### MFG-15 — Pack extension and governance process

**Level:** Hard  
**Depends on:** MFG-14

Define proposal, review, signing, compatibility, deprecation, vulnerability response, provenance, and release
processes. Triage every early industry draft into supported, extension-needed, research, or excluded capability.

**Gate:** an independent maintainer can review and release a pack without trusting its author or changing runtime
security code.

## Wave K — adoption studio

### MFG-16 — Public-presence graph and provenance

**Level:** Medium  
**Depends on:** MFG-03

Implement the explicitly public organization/location graph, source observations, confidence, review, and channel
projection ports with structural exclusion of Databox-private identifiers.

**Gate:** privacy-taint and cross-boundary tests prove private fields cannot enter a projection.

### MFG-17 — Website structured-data auditor and exporter

**Level:** Medium  
**Depends on:** MFG-16

Import existing site facts, compare visible and structured content, generate Schema.org JSON-LD, validate it, preview
changes, and export through a file/IPMS/pull-request port with approval and post-deploy drift checks.

**Gate:** representative organization and LocalBusiness pages produce valid, consistent projections; no ranking or
rich-result guarantee is asserted.

### MFG-18 — Google Business Profile reconciliation adapter

**Level:** Hard  
**Depends on:** MFG-16

Implement owner-authorized OAuth, account/location selection, read-only comparison, Google-updated value review,
field-level proposals, explicit update masks, approval, patch, revocation, rate-limit recovery, and evidence. Complete
a current Google API and platform-policy review before coding.

**Gate:** no write occurs without an authorized approver; token, wrong-account, stale-update, partial-failure, and
revocation tests pass.

### MFG-19 — Adoption dashboard and connector SDK

**Level:** Medium  
**Depends on:** MFG-17, MFG-18

Build correctness, drift, staleness, approval, publication, and connector-health views. Extract a channel adapter SDK
that preserves projection, approval, least-privilege, and evidence contracts.

**Gate:** a mock second directory adapter works without access to private Databox services or data.

## Wave L — independent gates

### MFG-20 — Adversarial product security review

**Level:** Hard, independent reviewer  
**Depends on:** MFG-12, MFG-15

Reproduce threats across workspace tenancy, pack supply chain, mapping engine, Solid sessions, live data plane,
recipient sharing, logs, secrets, jobs, backup/restore, and admin operations. Human security review required.

### MFG-21 — Solid interoperability and accessibility evidence

**Level:** Hard, independent integrator  
**Depends on:** MFG-20

Run the pinned Solid compatibility matrix against the local CSS Pod and named independent Pod implementations. Record
versions, deviations, captures, and repeatable tests. Complete manual accessibility review alongside automation.

### MFG-22 — Pilot-readiness review

**Level:** Hard, human sign-off  
**Depends on:** MFG-21

Review operations, privacy, security, legal/policy, recovery, support, documentation, telemetry, incident response,
key lifecycle, data retention, and organization onboarding evidence. Release only the capabilities whose gates passed;
do not infer approval for high-risk industry tracks or the adoption studio.
