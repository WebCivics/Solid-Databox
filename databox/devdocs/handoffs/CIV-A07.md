# CIV-A07 — Consumer-vault server endpoints

**Status:** accepted
**Wave:** 1 (personal databox profile)
**Depends on:** CIV-A01 (personal preset)

## What landed

The person-facing HTTP surface, mounted at `/.databox/personal` on the personal preset:

- `src/databox/personal/PersonalDataboxHttpHandler.ts` — routing + owner-WebID auth +
  JSON responses. Ordered before `LdpHandler` in the waterfall via
  `config/databox/personal-handler.json`. Auth is the owner's WebID through the standard
  `CredentialsExtractor` — never a shared bearer token: 401 (`Bearer scope="openid webid"`)
  unauthenticated, 403 for a different WebID.
- `src/databox/personal/PersonalVaultService.ts` — the shared engine: one
  `ConsumerConnectionRegistry` + real local validators (`ConnectionCredentialValidator`,
  `RecordProofValidator`, `AcceptanceReceiptVerifier`), building a `ProgramAgent` per call
  over the same registry. The holder keypair is generated **on the person's box** at import
  (`generateKeyPairSync` P-256) — the org never sees the private half.
- `src/databox/personal/RemoteConsumeClient.ts` — the person-side HTTP transport for the
  agent's remote operations against the declared org contract `{databox}/.databox/consume/*`
  (`GET challenge`, `POST token`, `POST records`, `POST submissions`, `GET feed`).
- `config/databox/personal-variables.json` — `--databoxPersonalOwnerWebId` +
  `--databoxPersonalIssuerKeys` (JSON issuer→public-JWK map) variables.
- `config/databox/personal.json` — imports the handler + variables; run-line documented.

## Routes

```
POST   /.databox/personal/connections                        credential install target
GET    /.databox/personal/connections?program=…              per-program list (T-03)
GET    /.databox/personal/connections/{id}?program=…         describe (no secrets)
POST   /.databox/personal/connections/{id}/pause|resume      lifecycle
DELETE /.databox/personal/connections/{id}?program=…         removal
POST   /.databox/personal/connections/{id}/sync              notify-then-pull (verify+store)
POST   /.databox/personal/connections/{id}/recover           cursor recovery (durable cursor)
GET    /.databox/personal/connections/{id}/records           vault read
GET    /.databox/personal/connections/{id}/evidence          evidence bundle export (T-46)
POST   /.databox/personal/connections/{id}/submissions       scoped submission composer
POST   /.databox/personal/status-lists/refresh               status-list refresh
```

## Decisions taken (honest seams)

1. **Sync/async boundary.** `HolderProofChallengeSource`/`TokenExchangeEndpoint` are sync by
   design (org-side in-process). The vault negotiates the remote session *eagerly*
   (`authenticateRemote`: fetch challenge → sign holder proof locally → exchange token) and
   a session adapter replays it into the agent's sync interfaces. No session → fail closed.
2. **Status-list resolution is sync.** Lists are fetched into a cache seeded at import
   (`pinnedStatusLists`) and refreshed via `/status-lists/refresh`; an absent list makes the
   validator fail closed per ADR-0020, never "assumed not revoked".
3. **Service owns the registry** and constructs `ProgramAgent`s over it — `importConnection`
   inspects the same store it wrote (the earlier split-registry bug was caught by tests).
4. **Issuer keys via JSON string** (`databoxPersonalIssuerKeys`) — a `Map<string, KeyObject>`
   is not Components.js-expressible; each JWK is fail-closed validated at construction.
5. **Per-program `?program=` required** on every connection-scoped route — a missing program
   is a 400, preserving structural isolation at the HTTP boundary.

## Verification

- 35 unit tests in `test/unit/databox/personal/` green (service: real minted credentials via
  `AgentHarness`, remote mocked; handler: auth + every route + per-program 400s).
- `tsc` clean; `eslint` clean; `build:components` emits the `PersonalDataboxHttpHandler`
  component description.
- **Live boot**: preset started on :3100 with `--databoxPersonalOwnerWebId`; root 200,
  `/.databox/personal/` → 401 + `WWW-Authenticate: Bearer scope="openid webid"`,
  `/.databox/personal/connections` → 401 (previously 404 — handler confirmed wired).

## Newly discovered → tracked

- **CIV-C27**: the org-side `/.databox/consume/*` serving half does not exist — the live
  Smithy surface is control-plane only. `RemoteConsumeClient` declares the contract; CIV-C27
  composes `HolderKeyProofVerifier`/`ProvisionalTokenExchange`/feed/submission-intake
  behind holder-proof tokens.

## Residual / notes

- Boot log shows `Cannot set headers after they are sent` once per 401 — the upstream CSS
  middleware writes headers after `response.end()`; wire behavior is correct. Same pattern
  as the live Smithy handler's 401 path — noted, not blocking.
- Vault state is process-local (registry/cursors/stores in memory). Durable persistence of
  connections/knowledge across restarts is a follow-up — the cursor contract makes restart
  recovery correct, but restart loses connection registrations until persisted.
- Live org interop is untestable until CIV-C27 serves the consume contract.
