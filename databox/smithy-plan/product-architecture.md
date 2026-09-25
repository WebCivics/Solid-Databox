# Smithy product architecture

## Product boundary

The current `MappingSmithy` is an in-memory composition proof. The product backplane must preserve its useful API
boundary while moving authoritative state, secrets, jobs, and versions behind replaceable interfaces.

```text
Organization operator
        |
        v
Smithy web app ---- Smithy API ---- Workspace/version store
                         |-------- Industry-pack registry
                         |-------- Validation/compiler service
                         |-------- Connector + mapping registry
                         |-------- Key/secret provider
                         `-------- Publish/deployment orchestrator
                                      |
                                      v
Source system --> transactional bridge --> CSS Databox runtime
                                              |
                                              v
Consumer app <---- Solid-OIDC + HTTP ---- consumer-owned Solid Pod
     |
     `---- explicit scoped disclosure ----> Recipient app

Organization Databox <---- signed capability messages ----> Organization Databox
         |                                                  |
         `---- local address book + agreement profile ------'

Public organization facts --> Adoption studio --> website JSON-LD / listing adapters
```

The two sides are Solid-compatible data spaces with separate authority. The Smithy provisions the organization
relationship Pod; the consumer selects and controls their personal Pod or vault. The consumer application mediates
governed exchange between them. See the [Two-Pod exchange model](two-pod-exchange-model.md).

## Authoritative state

| State | Authority | Notes |
|---|---|---|
| Organization workspace and members | Smithy workspace store | Separate from Databox consumer identities. |
| Industry pack versions | Signed pack registry | Immutable released versions; drafts are never deployable. |
| Organization facts and program draft | Smithy workspace store | Versioned edits with actor and timestamp. |
| Compiled institution profile | Compiler artifact store | Content-addressed and immutable after publication. |
| Raw customer/source-system mapping | Protected mapping registry | Control plane only; never exposed to the browser or data plane. |
| Connector secret | External secret provider | Referenced by opaque handle; never serialized into a blueprint. |
| Databox record, receipt, disposition | Databox runtime stores | Append-only rules and evidence apply. |
| Consumer holder private key | Consumer-controlled Pod/application | Never generated or retained by the organization smithy. |
| Consumer share decision | Consumer application and receipt ledger | Explicit, purpose-bound, field-scoped. |
| Public organization/location facts | Public-presence graph | No customer or private program data may enter this graph. |
| Organization contacts and capability observations | Local organization address book | Discovery and verification evidence; not an access grant. |
| Bilateral agreement profile | Each organization's agreement store | Both sides retain signed matching terms and independent authority. |
| Offers, claims, acknowledgements and reconciliation | Each organization's exchange ledger | Pairwise references and message receipts; no shared-database assumption. |

## Backplane contracts

### Organization manifest

Stable facts shared across programs: accountable parties, public identifiers, locations, domains, contacts,
processors, approved identity providers, key-provider references, and deployment constraints.

### Industry pack

A signed, versioned template containing capability requirements, record/submission class templates, vocabulary and
shape references, policy questions, default retention questions, connector recipes, UI copy, synthetic fixtures,
and tests. Defaults are proposals; legal bases, retention, redress, and high-risk behavior always require an
organization-specific answer and the applicable human review.

### Program blueprint

The organization’s selections and answers against one industry-pack version. It records provenance for every value:
pack default, organization answer, imported public fact, or reviewer-attested decision.

### Compiled program release

An immutable bundle containing the validated institution profile, mapping specifications, policy bundle digests,
connector manifests, public discovery documents, deployment inputs, migration plan, and executable test manifest.
Publication produces a new version; it never edits the active release in place.

### Mapping specification

Defines source system, customer identifier namespace, source event types, source-to-record transforms, idempotency
coordinates, quarantine behavior, and reconciliation ownership. Executable transforms must use a constrained,
declarative mapping language. Arbitrary uploaded JavaScript is out of scope.

### Public presence profile

A separate graph of explicitly public organization and location facts, their sources, confidence, last verification,
and channel-specific projections. It cannot reference a relationship, box, customer ID, private record, access
grant, or consumer WebID.

### Organization exchange profile

A signed, versioned bilateral profile naming organizational service identities, capability endpoints, message
schemas, purposes, limits, keys, expiry, privacy/retention terms, settlement rules, dispute route, and authorized
representatives. Address-book discovery does not activate it; both organizations must approve matching terms.

## Version lifecycle

```text
draft -> validated -> review-required -> approved -> published -> superseded
                       |                    |
                       `-> rejected         `-> rollback creates a new publication event
```

Validation is deterministic. Approval is actor-bound. Publication is atomic. A failed deployment leaves the prior
release active. Rollback reactivates a previously tested artifact through a new auditable event rather than deleting
history.

## Trust boundaries

- The smithy browser is untrusted input. Server-side validation and authorization are mandatory.
- Workspace administration does not confer Databox data-plane access.
- Connector workers receive the minimum program/source secret and append authority.
- The consumer application cannot rely on a credential document alone; holder-key possession remains required.
- Recipient verification uses its own trust configuration and retains the acknowledgement evidence.
- Organization exchange workers can invoke only capabilities allowed by an active bilateral agreement. They cannot
  browse a remote Pod or resolve a pairwise voucher/claim reference into a participant identity.
- Adoption connectors use separate OAuth grants and service identities from Databox connectors.

## Deployment modes

The demonstrator supports a resettable local deployment: smithy, two organization runtimes, one consumer Pod, and one
manual-channel provider. The two runtimes exercise signed resource offers, voucher claims, acknowledgements, and
reconciliation. The production architecture supports separate processes and durable stores. Multi-organization hosting is
not accepted until tenant-isolation and operator-access tests cover the control plane, job queues, secrets, logs,
backups, and public-presence adapters.
