# Live CSS Databox Integration

## What is live

The experimental `config/databox/live.json` preset runs the Mapping Smithy inside Community Solid Server's
Components.js composition. It keeps the control plane at `/.databox/smithy` and puts provisioned Databox resources on
the ordinary Solid data plane.

The live path now:

1. validates and registers an institution profile;
2. creates an opaque program-person relationship mapping;
3. provisions the relationship root and managed containers in CSS storage;
4. creates private WAC ACLs for the pairwise holder, including `Read` and a specific submissions `Append` grant;
5. commits the exact accepted institutional JSON-LD bytes to the CSS backend before signing the acceptance receipt;
6. serves those bytes through CSS's normal LDP, Solid-OIDC and WAC request path.

Anonymous knowledge of an accepted record URL is insufficient. The integration test creates a real CSS account and
client credential, obtains a DPoP-bound token, and proves that only the configured holder WebID can retrieve it.

## Run locally

Build the TypeScript and Components.js metadata first:

```powershell
npm.cmd run build
```

Start the memory-backed demonstration server with a random control token of at least 32 bytes:

```powershell
$token = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
npm.cmd run start:databox-live -- --databoxControlToken $token --baseUrl http://localhost:3000/ --port 3000
```

The token may instead be supplied as `CSS_DATABOX_CONTROL_TOKEN`. Do not put it in a URL, source fixture or client
log. Local plain HTTP is accepted only for `localhost`, `127.0.0.1` and `::1`; non-loopback program, issuer, WebID and
Databox URLs must use HTTPS.

## Control-plane routes

All routes require `Authorization: Bearer <control token>` and return `Cache-Control: no-store`:

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/.databox/smithy/programs` | List registered program summaries |
| `POST` | `/.databox/smithy/programs` | Register a validated institution profile |
| `POST` | `/.databox/smithy/mappings` | Provision one opaque relationship and issue its connection credential |
| `POST` | `/.databox/smithy/source-events` | Transform and commit an institutional source event, then issue its receipt |

The control token is an intentionally small demonstration boundary. A deployable organisation service must replace
it with authenticated operator/service identities, scoped authorization, tenant binding and auditable administration.

## Verify

```powershell
npx.cmd jest test/integration/DataboxLive.test.ts --runInBand --coverage=false
```

The test starts a real CSS process and verifies that ordinary Solid routes remain available, the Smithy route is
protected, provisioning is private, accepted bytes are physically in the configured CSS `ResourceStore`, anonymous
retrieval fails, authenticated DPoP retrieval succeeds, and no raw customer identifier leaks in returned artifacts.

## Current DBX-25 boundary

This is the instrumental live-server slice, not completion of the full DBX-25 acceptance gate. The remaining DBX-25
scenario must still compose two isolated programs and cover low/high assurance, notifications, retained copies,
consumer submissions, review/disposition, duties, supersession, revocation, rotation and recovery with an evidence
bundle. Persistence across restart also remains production work: the current live preset uses memory storage and the
Smithy's program, key, mapping, outbox and committed-digest registries are process-local and fail closed when they
cannot prove an existing resource's digest.
