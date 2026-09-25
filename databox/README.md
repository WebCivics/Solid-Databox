# Organisation-hosted Solid Databox

> **Looking to build with the Databox?** Start with the **[Databox Developer Guide](guide/README.md)** —
> a practical walkthrough of running the server, the Smithy control-plane API, the Institution Profile,
> and the deposit → receipt → evidence flow. This README and the documents it links are the underlying
> **design corpus** (architecture, decisions, threat model, conformance).
>
> **Live demo:** [landing](https://mediaprophet.github.io/Solid-CSS-Databox/) ·
> [admin console](https://mediaprophet.github.io/Solid-CSS-Databox/admin/) ·
> [Smithy control panel](https://mediaprophet.github.io/Solid-CSS-Databox/smithy/)

## Purpose

An organisation-hosted Databox is a private, two-way exchange point between one organisation program and one
person. It enables the organisation to provide records, receipts, credentials, warranty information and notices to
the person, and enables the person to return submissions, corrections, claims, preferences or evidence.

The Databox is not the person's general-purpose wallet. It is a relationship-specific post-box operated for a
declared program, such as:

- a university and one student;
- a government agency and one citizen;
- a retailer's loyalty program and one member;
- a utility and one account holder;
- a health service and one patient.

The person may connect the Databox to a Solid Pod, wallet, personal data system or another compatible agent. That
connection does not allow the organisation or its hosting provider to browse the person's storage or discover their
other organisational relationships.

The Databox issues a portable, signed, long-term connection credential for the consumer to install in that personal
service. Operationally it behaves like a program-scoped API credential: the service can maintain the connection
without interactive login for every sync. It is bound to a vault-controlled key and exchanged for short-lived access
tokens rather than functioning as a copyable bearer secret. The service can hold many such credentials—one per
organisation program—without exposing the other connections.

## Core model

```text
Organisation system of record
        |
        v
Organisation bridge --> organisation-hosted Databox <-- consumer agent or wallet
        |                         |
        v                         v
Human review queue          personal retained copies
```

The organisation operates the exchange point and is accountable for its records. The person controls which agent
connects to it and which information they deliberately submit back.

## Security boundary

Each program relationship is a separate security domain:

```text
One person's wallet
|- Woolworths relationship --> Woolworths Databox
|- Coles relationship ------> Coles Databox
|- ANU relationship --------> ANU Databox
`- Agency relationship -----> Agency Databox
```

None of those organisations receives a graph of the other connections. A shared Databox hosting provider must not
introduce a global consumer identifier or a platform-wide credential that bypasses program isolation.

## Invariants

Every implementation should preserve these rules:

1. A Databox belongs to exactly one declared organisation program and one represented person or relationship.
2. URLs, logs and storage paths contain no directly identifying customer information.
3. Knowing a resource URL never grants access.
4. Connection credentials are long-lived, portable, holder-bound, program-specific, rotatable and revocable; access
   tokens are separately audience-bound and short-lived.
5. The organisation cannot use a Databox connection to browse the person's wallet or other Databoxes.
6. Consumer submissions are explicit disclosures, not reads performed by the organisation against personal storage.
7. Accepted records and submissions are not silently overwritten; changes create linked, auditable events.
8. Every accepted submission produces a signed receipt that the person can retain independently.
9. Record sensitivity is enforced against the assurance of the current authentication, not merely account ownership.
10. Hosting-provider administration is treated as a security threat and controlled below the RDF ACL layer.
11. Rights, prohibitions and obligations travel with records as versioned ODRL policies and produce auditable duties.
12. Databox extensions preserve the standard Solid discovery, authentication and resource-operation surface so an
    independent conforming Solid client can exercise its granted access without proprietary transport or tokens.

## Implementation status

The design in these documents is being implemented as a Community Solid Server extension under
[`src/databox/`](../src/databox) (tests under `test/unit/databox/`, an experimental Track B config preset
under `config/databox/`). Progress follows the ordered prompts in the
[prompt implementation plan](prompt-implementation-plan.md); each prompt records a handoff under
[`handoffs/`](handoffs) and consumes the binding decisions in the [decision register](decisions/README.md).

**Completed: DBX-01 through DBX-24 of the 28-prompt plan** (Waves A–E). DBX-25 is active: its
[live CSS integration slice](live-css-integration.md) now mounts the Smithy in Components.js, provisions opaque
WAC-protected Databox resources, commits exact accepted bytes to CSS storage before receipt issuance, and proves
authenticated DPoP retrieval through the normal Solid HTTP route. The broader two-program lifecycle scenario remains
before DBX-25 can be marked complete. DBX-26 adversarial, DBX-27 conformance and DBX-28 release readiness follow it.
A separate [Smithy productization plan](smithy-plan/README.md) defines the polished demo, reusable organisation/industry
backplane and optional public-information adoption studio. Its operator control plane is implemented as the
[Smithy Admin console](../smithy-admin/README.md) (Refine/React): program onboarding, relationship mapping, event
dispatch, the ANZSIC-tailored AU / multi-jurisdiction / standards information-obligation taxonomy, a data-portability
registry and inbound access/correction handling.

| Wave | Prompts | What landed |
|---|---|---|
| A — discovery & binding decisions | 01–05 | Extension map, 26 ADRs, threat model (58 threats/tests), reference architecture, conformance matrix |
| B — schemas, policy & scaffold | 06–09 | Institution-profile schema, Databox vocabulary + ODRL profile, synthetic loyalty profile, extension scaffold |
| C — provisioning, identity & authorization | 10–14 | Opaque provisioning, tenant isolation, authenticated context + assurance, VC connection credential, composed authorizer |
| D — exchange, policy execution & evidence | 15–21 | Deposit/submission gateway, record-proof validation, append-only + tombstone, signed receipts, evidence ledger, ODRL evaluator + duty engine, outbox + SSRF-guarded notification + cursor recovery |
| E — integration endpoints | 22–24 | Synthetic institutional bridge, governed review/disposition workflow, reference consumer-pod agent |

**How to read the code state:** the extension is a **reference implementation**. Every subsystem is fail-closed and
unit tested. The experimental live preset is wired into Components.js, but its Smithy registries, keys, outbox and
digest confirmation index are still process-local; production needs durable registries, a WORM/signed evidence
ledger, KMS-held keys, and durable outbox/feed storage. The live preset's control bearer is a demonstration boundary,
not organisation IAM. Every security, cryptography and legal-policy prompt also carries a residual human-review gate
recorded in its handoff that has not been independently certified here. Two protocol bindings remain provisional:
the RFC 8693 token-exchange wire format
([ADR-0005](decisions/ADR-0005-authorization-server-broker-and-idp-trust.md)) and record, credential and crosswalk
signature verification against a pinned key.

## Documents

### Implementation artifacts

- [Extension map (DBX-01)](dbx-01-extension-map.md) inventories the CSS seams the Databox reuses, wraps or replaces.
- [Decision register (DBX-02)](decisions/README.md) — the ADRs (ADR-0001…ADR-0026) with a coverage matrix.
- [Threat model (DBX-03)](dbx-03-threat-model.md) and [adversarial-test backlog](dbx-03-adversarial-test-backlog.md).
- [Reference architecture (DBX-04)](dbx-04-reference-architecture.md) — components, interfaces, sequence traces.
- [Conformance requirements (DBX-05)](dbx-05-conformance-requirements.md) and
  [test-identification scheme](dbx-05-test-identification-scheme.md).
- [Prompt handoffs](handoffs) — one per completed prompt (inputs, decisions, tests, residual gates).
- [Live CSS integration](live-css-integration.md) — run instructions, HTTP surface and current DBX-25 boundary.
- [Smithy Admin console](../smithy-admin/README.md) — the Refine/React operator control plane for the Smithy API.

### Design specifications

- [Architecture](architecture.md) defines the participants, deployment topology and resource layout.
- [Identity and access](identity-and-access.md) defines onboarding, pairwise identity, credentials and authorization.
- [Isolation and privacy](isolation-and-privacy.md) defines program, tenant and personal-storage boundaries.
- [Rights and obligations](rights-and-obligations.md) defines the ODRL policy model and its enforcement boundary.
- [Exchange and evidence](exchange-and-evidence.md) defines deposits, retrieval, submissions, receipts and audit.
- [Implementation scope](implementation-scope.md) maps the design onto Community Solid Server extension points.
- [Implementation decisions](implementation-decisions.md) adjudicates the open implementation questions and records
  which apparent answers are adopted, provisional or rejected.
- [Standards roadmap](standards-roadmap.md) separates current Solid/CSS compatibility from forward W3C Linked Web
  Storage compatibility and tracks the Working Group deliverables.
- [Consumer vault interoperability](consumer-vault-interoperability.md) defines the portable connection credential
  and the many-Databox aggregation model.
- [Hackathon profile](hackathon-profile.md) fixes an LWS-first experimental implementation slice and twelve executable
  prompts for the demonstration.
- [Hackathon decisions](hackathon-decisions.md) records the resolved WebID/WAC, credential, integration-plane and
  demonstration choices that implementation agents must use.
- [DBX recommended decisions](dbx-recommended-decisions.md) gives the proposed production answers for DBX-02,
  including the legal-policy workstream boundary.
- [Legal design review: data awareness, access and correction](legal-review-cdr-data-awareness-and-correction.md)
  applies the CDR Rules and Privacy Act structure to record visibility, correction and downstream propagation without
  claiming that the broader legal mapping is complete.
- [Prompt implementation plan](prompt-implementation-plan.md) provides the ordered, agent-level implementation prompts.
- [Smithy productization plan](smithy-plan/README.md) defines MFG-01 through MFG-22 for the polished demo, tailoring
  backplane, industry packs, adoption studio, and independent readiness gates.

## Terminology

**Consumer** means the person served by the program: member, student, citizen, customer, patient or their lawful
representative.

**Program** means the bounded organisational relationship for which a Databox exists, such as a specific loyalty
scheme rather than every service offered by a hosting provider.

**Databox provider** means the technical operator hosting the service. It may be the organisation itself or a
contracted processor.

**Consumer agent** means software selected by the person to authenticate, retrieve records, retain copies and make
explicit submissions.

**Databox connection credential** (also called the relationship credential) means a portable, signed and revocable
statement connecting a program-specific consumer identifier, Databox, discovery information and access-grant
reference to a consumer-controlled key or identifier. The consumer installs it in a vault or knowledge bank as the
long-term authority for that connection. It has API-key-like persistence but is not a reusable bearer secret or an
access token.
