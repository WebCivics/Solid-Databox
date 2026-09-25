# DBX-28 — Hardening checklist (Solid Databox)

Each item names the control and where it's enforced. Mark `[x]` verified-by-test, `[~]` deployed-but-
unrehearsed, `[ ]` open.

## Authorization boundary

- [x] Composed authorizer is the live `PermissionReader` for databox paths (narrow-only, never
  broadens) — `live-authorization.json`; proven by DBX-26 AT-07/AT-30.
- [x] Non-databox paths pass through to WAC unchanged — `boxIdFromTarget` gate; DBX-26 AT-16.
- [x] Existence suppression — denied-vs-missing box indistinguishable (404); DBX-26 AT-07.
- [x] Fail-closed on missing/malformed conjunct — `isWellFormedInput`; engine total.
- [x] Pairwise-WebID holder binding + program audience binding, both re-asserted in-engine —
  `TenantContext.pairwiseWebId`, stage-3 conjunct.
- [x] Per-request relationship + revocation re-check — `RegistryRelationshipStatusSource` +
  `StatusListManager` (DBX-13).

## Secrets & keys

- [x] No secrets in repo — `config/databox/*.json` bind `Variable`s; control token + signing keys are
  launch-time/operator-held (see `secret-scan`).
- [x] Signing keys validated P-256 fail-closed at `IssuerTrustStore` construction.
- [x] Rotation retains history; revoked keys never verify (T-20).
- [ ] KMS/HSM custody for production signing keys — currently operator-held (CIV-C10 follow-on).

## Transport & identity

- [x] Solid-OIDC + DPoP sender-constraint (AT-16, independent clients).
- [x] Host-header rewriting does NOT change tenant binding (AT-01).
- [~] TLS termination + Cloudflare/cooperative DNS — documented in ADR-0027; deployment-level.

## Durability

- [x] Backup/restore round-trip (AES-256-GCM) — OpsRehearsal.
- [x] Owner-key backup recoverable only under holder key — OpsRehearsal.
- [ ] WORM evidence ledger + durable (non-process-local) registries/outbox — CIV-C10 follow-on.

## Privacy & human-rights controls

- [x] Status lists use a minimum-herd bitstring (T-56 herd privacy).
- [x] Denials are generic/non-leaking; audit events carry reason codes not PII.
- [x] Probabilistic AI has no path to persistent data or security boundaries (ADR track separation).
