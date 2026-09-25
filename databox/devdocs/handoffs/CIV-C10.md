# CIV-C10 — Durable authorities (process-local → restart-surviving)

The reference preset held its crown-jewel state in `Map`-backed process memory: a restart lost the
relationship-mapping registry (the only place the raw `customerId` lives), the tenant-binding
registry (T-31 isolation), the source outbox, and the WORM evidence ledger. This change makes them
**durable over the pod `ResourceStore`** — restart-surviving without changing their interfaces.

## What landed

- `durable/DurableStateStore.ts` — one JSON state document per authority over `ResourceStore`
  (`getRepresentation`/`setRepresentation`). Durable because the store is durable (file/system-store
  backed in a real deployment).
- `durable/DurableRegistries.ts` — `DurableTenantBindingRegistry`, `DurableRelationshipMappingRegistry`,
  `DurableSourceOutbox`: the same interfaces, write-through on mutation, `initialize()` rehydrates the
  in-memory indexes by replaying the persisted document. `register`/`commit` keep their exact semantics
  (idempotent find-or-create, T-31 exclusivity, tuple-keyed outbox dedupe) — replay re-runs them.
- `durable/DurableEvidenceLedger.ts` — `HashChainedEvidenceLedger` + durable persistence. On
  `initialize()` the restored chain is re-verified (`verifyChain`) **before** it is trusted — a
  tampered/corrupt persisted document throws rather than serving a broken audit trail (T-27).
- `durable/RegistryInitializer.ts` — an `Initializer` adapter: wire a durable registry into
  `PrimaryParallelInitializer.handlers` so `initialize()` runs at boot before the server serves.
- `config/databox/durable-registries.json` — the opt-in durable profile: redefines the shared
  `RelationshipMappingRegistry`/`TenantBindingRegistry` `@id`s as `Durable*` over `DurableStateStore`s
  and joins their initializers to the startup chain.
- `MappingSmithy` gained an `outboxFactory` seam (defaults `InMemorySourceOutbox`; a durable deployment
  injects a `DurableSourceOutbox`).

## Lifecycle contract

`await registry.initialize()` once at boot (via `RegistryInitializer`), then reads serve the index and
mutations persist behind `await registry.flush()` — the durability boundary to hit before shutdown.

## Verified

`test/unit/databox/durable/DurableRegistries.test.ts` — 6 tests, all green: a fresh instance over the
shared store rehydrates bindings, box→relationship mappings (incl. the control-plane customer key),
committed outbox rows + reconciliations, and the WORM ledger hash chain; a tampered persisted ledger
is rejected on initialize; use-before-`initialize()` fails closed.

## Residual (named, not done here)

- **KMS/HSM key custody** — signing keys are still operator-held; KMS custody is a deployment/CIV-C10
  follow-on (the `IssuerTrustStore`/`keyFactory` seams accept injected keys; the custody isn't changed).
- **Concurrency** — the durable stores are single-writer reference impls (the process-local ones were
  too); multi-writer CAS/locking is a production-scale concern beyond this change.
