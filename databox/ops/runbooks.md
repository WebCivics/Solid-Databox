# DBX-28 — Operational runbooks (Solid Databox)

Operational procedures for the packaged deployment (`config/databox/live.json`). Every procedure
references the real component it operates; none is aspirational. Rehearsals that must pass before
release are executable and verified in `test/unit/databox/ops/OpsRehearsal.test.ts`.

## RB-1 — Key ceremony & rotation

**Scope:** record-proof signing keys (`IssuerTrustStore`) and connection-credential status
(`StatusListManager`).

1. **Generate** a P-256 signing key per program; custody is operator-managed (C18/KMS boundary —
   keys are never committed to the repo).
2. **Publish** the public half into the program's `IssuerTrustStore` descriptor with a
   `validFrom` and a planned `validUntil`. A descriptor fails closed at construction on a non-P-256
   key or an inverted window.
3. **Rotate** by retaining the old descriptor (`status: 'rotated'`, `validUntil` = rotation instant)
   and adding the successor (`status: 'active'`). A rotated key still verifies records issued
   in-window; it cannot mint new ones.
4. **Revoke** on compromise by flipping the descriptor to `status: 'revoked'` — a revoked key is
   rejected outright, even for in-window history (T-20).

*Rehearsal:* `key-rotation rehearsal` test — rotated-in-window resolves, retired/revoked/substituted
fail closed.

## RB-2 — Tenant (relationship) onboarding

**Scope:** provisioning a private relationship Databox via the smithy (`MappingSmithy` →
`RelationshipMappingRegistry` + `TenantBindingRegistry`).

1. Register the program (`/.databox/smithy/programs`).
2. Provision the relationship box (`/.databox/smithy/mapping`) — mints the opaque `boxId`, the
   `databox/relationships/<boxId>/` root, the box ACL (holder-only), and the pairwise holder WebID.
3. Provisioning writes the SAME `RelationshipMappingRegistry` the authorizer reads — a box is
   immediately resolvable for the holder's reads.

*Rehearsal:* `DataboxLive` provisions and reads a box end-to-end (4/4).

## RB-3 — Backup & restore

**Scope:** `createBackup`/`restoreBackup` (AES-256-GCM, password-derived) and `encryptForOwner`/
`decryptForOwner` (holder-key hybrid).

1. **Backup:** `createBackup({ resources, password })` → encrypted blob + manifest (`DataDownload`).
2. **Restore:** `restoreBackup({ encryptedBlob, password, salt, iv, tag })` → the exact resources.
   A wrong passphrase fails closed.
3. **Holder self-custody:** `encryptForOwner` produces a blob only the owner private key can open —
   the operator/cooperative holds backups it cannot read.

*Rehearsal:* `restore rehearsal` + `owner-key rehearsal` tests — exact round-trip + fail-closed.

## RB-4 — Incident response (compromise / misuse)

**Scope:** `StatusListManager` revocation + `IssuerTrustStore` revocation + the authorizer.

1. **Credential compromise:** `StatusListManager.setRevoked(connectionId)` — the per-request
   `credentialRevoked` conjunct denies the next request (ADR-0009 prompt revocation).
2. **Signing-key compromise:** set the descriptor `status: 'revoked'` — every record the key signed
   fails verification, including history.
3. **Relationship severance:** mark the relationship record inactive — the `relationship.active`
   conjunct denies all further access.
4. All denials emit a `DataboxAuthorizationDecision` audit event (reason code + conjunct) for review.

## RB-5 — Relationship recovery

**Scope:** `RelationshipMappingRegistry` + `StatusListManager`.

- A suspended relationship is reactivated by restoring `active` on the record; the per-request
  status re-check (`RegistryRelationshipStatusSource`) picks it up without a restart.
- A revoked connection credential is terminal — issue a new credential and re-register it; the old
  `statusListIndex` stays revoked (no un-revocation by design).

## RB-6 — Duty monitoring

**Scope:** `DutyStateMachine`/`DutyEngine` (ODRL duties) + `OutboxDrainer` (notification delivery).

- Duty fulfilment transitions are state-machine-driven and audited; a stalled duty surfaces via the
  state, not silently.
- `OutboxDrainer` retries and surfaces undeliverable notifications; drain status is observable.

## RB-7 — Retention

**Scope:** append-only/WORM record semantics + box lifecycle.

- Accepted records are immutable (append-only `immutable` conjunct); retention is enforced by
  refusing mutation, not by deletion.
- A decommissioned box: mark the relationship inactive (denies access), retain the WORM evidence
  ledger + backup per policy, then retire the descriptors' `validUntil`.

*Rehearsal:* the `immutable` conjunct and `accepted` index are exercised in the authorization suite.
