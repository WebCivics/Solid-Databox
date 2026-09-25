# Architecture & the design corpus

This guide is the practical entry point. Underneath it sits a large, accepted **design corpus** — the
architecture, decision records, threat model and conformance requirements the implementation is built
against. This page summarises the shape and points you into that corpus.

## Two planes, one boundary

```text
Organisation system of record
        |
        v
Organisation bridge --> organisation-hosted Databox <-- consumer agent or wallet
        |                         |
        v                         v
Human review queue          personal retained copies
```

- The **control plane** (the Smithy, the integration/bridge, provisioning, key management) creates and
  suspends Databoxes, binds program-local identities, installs policies, rotates keys and manages
  retention. It never acts through an ordinary consumer token.
- The **data plane** (Solid resource operations) accepts validated deposits/submissions, authorises
  retrieval, emits notifications and receipts, and records evidence.

They must not share an unrestricted public API. Full detail: [architecture](../architecture.md).

## Resource layout

Each Databox is an opaque box (`/boxes/{opaque-box-id}/`) with `records/`, `submissions/`,
`dispositions/`, `receipts/`, `record-index/`, `disclosure-view/` and `audit-view/`. Box and resource
identifiers are independently random so that volume cannot be inferred by incrementing a sequence, and
never contain customer data. See [architecture › resource layout](../architecture.md#resource-layout).

## The invariants

Twelve invariants hold across every implementation — one program/one person per box, opaque URLs,
"knowing a URL never grants access", holder-bound rotatable credentials, no browsing of the person's
wallet, no silent overwrites, independent signed receipts, assurance-gated sensitivity, and preserved
standard Solid interoperability. The authoritative list is in the
[overview › invariants](../README.md#invariants).

## The design corpus

| Document | What it gives you |
|---|---|
| [Overview](../README.md) | Purpose, core model, invariants, terminology, implementation status. |
| [Architecture](../architecture.md) | Participants, topology, resource layout, control/data plane, integration plane. |
| [Reference architecture (DBX-04)](../dbx-04-reference-architecture.md) | Components (C1…C21), interfaces and sequence traces. |
| [Decision register (26 ADRs)](../decisions/README.md) | The binding decisions with a coverage matrix. |
| [Threat model (DBX-03)](../dbx-03-threat-model.md) | 58 threats/tests and the [adversarial backlog](../dbx-03-adversarial-test-backlog.md). |
| [Conformance requirements (DBX-05)](../dbx-05-conformance-requirements.md) | The conformance matrix and [test-identification scheme](../dbx-05-test-identification-scheme.md). |
| [Prompt handoffs](../handoffs) | One per completed prompt — inputs, decisions, tests, residual gates. |
| [Live CSS integration](../live-css-integration.md) | Run instructions, HTTP surface and the current DBX-25 boundary. |
| [Consumer vault interoperability](../consumer-vault-interoperability.md) | The portable connection credential and the many-Databox model. |
| [Smithy productization plan](../smithy-plan/README.md) | The polished demo, industry-pack backplane and adoption studio (MFG-01…MFG-22). |

## Code map

The extension lives under [`src/databox/`](../../src/databox). Key subsystems:

| Area | Module |
|---|---|
| Control plane / Smithy | `smithy/` (`MappingSmithy`, `MappingSmithyHttpApi`) |
| Live CSS integration | `integration/` (`LiveDataboxHttpHandler`, `CssDataboxStore`) |
| Profiles | `profile/` (schema + validator) |
| Provisioning | `provisioning/`, `identifiers/` (opaque IDs, relationship mapping) |
| Credentials | `credential/` (VC connection credential, status list, holder key proof) |
| Exchange | `bridge/`, `gateway/`, `proof/` |
| Evidence & receipts | `receipt/`, `evidence/`, `storage/` (append-only) |
| Policy | `odrl/`, `policy/` |
| Compliance | `compliance/` |
| Authorization & context | `authorization/`, `context/`, `tenant/` |
| Notification & feed | `notification/`, `feed/` |
| Reference agent | `agent/`, `review/` |

## Status & honesty

This is a **fail-closed reference implementation**, not a certified product. The live preset's
registries, keys and outbox are process-local; its control token is a demonstration boundary. Several
security, cryptography and legal-policy areas carry **residual human-review gates** recorded in their
handoffs that have not been independently certified. Read the
[implementation status](../README.md#implementation-status) before relying on any subsystem in
production.
