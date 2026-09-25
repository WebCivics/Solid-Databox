# Smithy control-plane API

The Smithy is a **thin JSON control-plane API**, intentionally separate from the public Databox data
plane. In the live preset it is mounted at `/.databox/smithy`; in the standalone demo it listens on an
ephemeral loopback port.

Source: [`src/databox/smithy/MappingSmithyHttpApi.ts`](../../src/databox/smithy/MappingSmithyHttpApi.ts)
and [`MappingSmithy.ts`](../../src/databox/smithy/MappingSmithy.ts); live mount in
[`LiveDataboxHttpHandler.ts`](../../src/databox/integration/LiveDataboxHttpHandler.ts).

## Base URL & authentication

| | |
|---|---|
| Base (live preset) | `http://localhost:3000/.databox/smithy` |
| Auth | `Authorization: Bearer <control-token>` — the token must be **≥ 32 bytes**; comparison is constant-time. |
| Missing/invalid token | `401` with `WWW-Authenticate: Bearer realm="databox-control"` and `{"error":"unauthorized"}` |
| Body limit | `1 MB`; bodies must be valid JSON (`400` otherwise) |
| Caching | responses are sent `Cache-Control: no-store` |

## Endpoints

| Method | Path | Success | Purpose |
|---|---|---|---|
| `GET`  | `/programs` | `200` | List registered program summaries |
| `POST` | `/programs` | `201` | Register & validate an Institution Profile |
| `POST` | `/mappings` | `201` | Smithy an opaque relationship + issue a connection credential |
| `POST` | `/source-events` | `202` | Deposit a source-system event as a record |

Any other route returns `404 {"error":"not-found"}`.

### `POST /programs`

Request (`ForgeProgramInput`):

| Field | Type | Notes |
|---|---|---|
| `profile` | object | The [Institution Profile](institution-profile.md). Validated fail-closed. |
| `programUri` | string | Absolute **HTTPS** URL (HTTP allowed only for loopback). |
| `databoxBaseUrl` | string | Absolute HTTPS/loopback URL; base for opaque Databox roots. |
| `issuer` | string? | Defaults to `<programUri origin>/databox/issuer`. |
| `claimsLegalCompliance` | boolean? | If `true`, `compliance` is required and must pass the publication gate. |
| `compliance` | object? | Compliance assessment input (see [Policies & ODRL](policies-and-odrl.md)). |

Response (`ForgeProgramSummary`, `201`): `profileId`, `profileVersion`, `programUri`,
`databoxBaseUrl`, `recordClasses[]`, `submissionClasses[]`, `legalComplianceClaimed`. **No customer
data appears in the summary.** Re-registering an existing `profileId` returns `400`.

### `POST /mappings`

Request (`ForgeMappingInput`): `profileId`, `sourceSystem`, `customerIdNamespace`, `customerId`
(control-plane PII), `pairwiseWebId`, `holderPublicJwk`.

Response (`ForgeMappingResult`, `201`): `provisioning` (opaque `relationship`, `databox.root`,
policy refs) and `credential` (an `IssuedConnectionCredential` — signed VC `jws`, `connectionId`, and
`credential.credentialSubject.connection` with `program`, `databox`, `storageDescription`,
`accessGrant`, `relationship`). The raw `customerId` is **deliberately absent** from the result.

### `POST /source-events`

Request (`ForgeSourceEventInput`): `profileId`, `sourceSystem`, `eventType`, `sourceEventId`,
`customerIdNamespace`, `customerId`, `recordClass`, `legalBasis`, `purpose`, `payload`.

Response (`BridgeDepositReport`, `202`): `status` (e.g. `"reconciled"`), a `reconciliation` block
(`sourceEventId`, committed `acceptedResource`, …) and a `receipt` (`jws`). `recordClass`,
`legalBasis` and `purpose` must be declared in the profile. Depositing an already-reconciled
`sourceEventId` returns `400`.

## Errors

| Status | Meaning |
|---|---|
| `400` | Bad request — invalid JSON, oversized body, invalid/duplicate profile, non-HTTPS URL, unknown program, undeclared class/basis/purpose, replayed event. |
| `401` | Missing or invalid control token (live mount only). |
| `404` | Unknown route. |
| `500` | Unexpected Smithy error. |

## Invariants enforced here

- **PII stays in the control plane.** The raw `customerId` never enters a response body, resource URL,
  connection credential or notification.
- **Opaque identifiers.** Databox roots and relationship IDs derive from ≥128 bits of randomness, never
  from a customer number or an unkeyed hash of one.
- **HTTPS or loopback only** for `programUri`, `databoxBaseUrl` and `issuer`.
- **Legal-compliance claims are gated** — a program cannot advertise legal compliance unless a
  compliance assessment passes the publication gate.
- **Reference implementation is in-memory** — registries, keys and the outbox are process-local in the
  demo/live preset; production requires durable stores, KMS keys and real operator auth.
