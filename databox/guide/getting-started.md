# Getting started

This walks you from a fresh checkout to a live program, a provisioned connection, a deposited record
and a signed receipt.

## Prerequisites

- Node.js (see the repository’s engines field) and npm.
- A clone of this repository with dependencies installed and the project built:

```sh
npm ci
npm run build
```

## 1. Run a Databox-enabled server

The Databox lives behind a **separate top-level configuration**, not a runtime flag — a Track A
(production) deployment is provably free of this code from its launch config alone. To run the live
single-process integration preset:

```sh
# Supply a control token of at least 32 bytes — the preset fails closed without one:
npm run start:databox-live -- --databoxControlToken <32-byte-token>
# or: CSS_DATABOX_CONTROL_TOKEN=<32-byte-token> npm run start:databox-live
```

To run the demo pages bundled with this server (the root page's Seraphim and MegaMart demos, and the
Admin console), use the token those pages are built against, or their calls get `401`:

```sh
npm run start:databox-demo
# node ./bin/server.js -c config/databox/live.json --databoxControlToken 12345678901234567890123456789012
```

> Starting the server **without** `-c config/databox/live.json` (for example plain `npm start` or
> `node bin/server.js`) yields a stock CSS server with no Databox extension. It boots normally, but the
> Smithy is absent, so every `/.databox/smithy/*` call returns `404` and the demos report
> "Provisioning failed".

The server starts on `http://localhost:3000/`. Two surfaces are now available:

- the **data plane** — ordinary Solid resources served by CSS;
- the **Smithy control plane** — a thin JSON API mounted at **`http://localhost:3000/.databox/smithy`**,
  protected by a bearer **control token** supplied at launch via the `--databoxControlToken` flag or the
  `CSS_DATABOX_CONTROL_TOKEN` environment variable.

> ⚠️ **The control token is a demonstration boundary, not organisation IAM.** The live preset uses a
> shared 32-byte secret. Requests without a valid `Authorization: Bearer <token>` header get `401`.

Throughout this guide, `$TOKEN` is that control token.

## 2. Register a program

A program is defined by an **[Institution Profile](institution-profile.md)**. Registering it validates
the profile and stands up the program's provisioner, credential issuer and bridge.

```sh
curl -s -X POST http://localhost:3000/.databox/smithy/programs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "profile": { "...": "your Institution Profile (see institution-profile.md)" },
    "programUri": "http://localhost:3000/program",
    "databoxBaseUrl": "http://localhost:3000/boxes/"
  }'
```

Response (`201`) is a **public** program summary — note it contains no customer data:

```json
{
  "profileId": "prog-seraphim-welfare",
  "profileVersion": "1.0.0",
  "programUri": "http://localhost:3000/program",
  "databoxBaseUrl": "http://localhost:3000/boxes/",
  "recordClasses": ["rc-case-note"],
  "submissionClasses": [],
  "legalComplianceClaimed": false
}
```

`programUri` and `databoxBaseUrl` must be absolute **HTTPS** URLs (HTTP is allowed only for `localhost`
loopback). Registering the same `profileId` twice is rejected.

## 3. Smithy a relationship mapping

This maps one of your source-system customers to an **opaque** Databox relationship and issues a
holder-bound **connection credential** the person installs in their wallet. The raw `customerId` is
control-plane PII and is deliberately absent from the result.

```sh
curl -s -X POST http://localhost:3000/.databox/smithy/mappings \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "profileId": "prog-seraphim-welfare",
    "sourceSystem": "seraphim-intake",
    "customerIdNamespace": "welfare",
    "customerId": "CHARLES-JAMES-ID-001",
    "pairwiseWebId": "https://v-8a7b6c5d.example/profile/card#seraphim",
    "holderPublicJwk": { "kty": "EC", "crv": "P-256", "x": "…", "y": "…" }
  }'
```

The `201` response carries `provisioning` (the opaque relationship + Databox root) and `credential`
(a signed VC as `jws`, its `connectionId`, and a `credentialSubject.connection` bundle: `program`,
`databox`, `storageDescription`, `accessGrant`, `relationship`). Those fields are what a wallet needs
to build a `solid-databox://connect` connection URI (or QR code).

## 4. Deposit a source event

Now deliver a record. A committed source event is drained through the bridge and gateway; on success it
is **reconciled**, the exact accepted bytes are committed to CSS storage, and a **signed acceptance
receipt** is issued.

```sh
curl -s -X POST http://localhost:3000/.databox/smithy/source-events \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "profileId": "prog-seraphim-welfare",
    "sourceSystem": "seraphim-intake",
    "eventType": "welfare-checkin",
    "sourceEventId": "CHECKIN-001",
    "customerIdNamespace": "welfare",
    "customerId": "CHARLES-JAMES-ID-001",
    "recordClass": "rc-case-note",
    "legalBasis": "lb-consent",
    "purpose": "p-service-delivery",
    "payload": { "notes": "Initial intake completed.", "status": "active" }
  }'
```

The `202` response is a **deposit report**: `status: "reconciled"`, a `reconciliation` block with the
committed `acceptedResource` URL, and a `receipt` with its `jws`. The `recordClass`, `legalBasis` and
`purpose` must all be declared in the program's profile, or the deposit fails closed.

## 5. Retrieve as the consumer

Retrieval is ordinary Solid: the person's agent authenticates (WAC + DPoP) and `GET`s the
`acceptedResource`. Knowing the URL alone never grants access, and the organisation cannot use the
connection to browse the person's storage.

## Shortcuts

- **Standalone demo (no server):** `npm run demo:databox-smithy` runs the synthetic MegaMart flow
  end-to-end against an in-memory Smithy and asserts the raw customer ID never leaks into any output.
- **Admin UI:** the `smithy-admin/` React app is a GUI over this same control plane (Organisation
  Set-up, Mappings Simulator, Event Dispatcher).

Next: the full **[Smithy API reference](smithy-api.md)**.
