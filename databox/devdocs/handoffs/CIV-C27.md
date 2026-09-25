# CIV-C27 — Org-side `/.databox/consume/*` serving surface

**Status:** accepted
**Wave:** integration (found during CIV-A07)

## What landed

`src/databox/consume/` — the organisation-side half of the person↔org contract that
CIV-A07's `RemoteConsumeClient` declared. The consume surface is now real end-to-end:

- **`ConsumeHttpHandler`** — routes:
  - `GET  /.databox/consume/challenge?audience=` → holder-proof challenge
    (`HolderKeyProofVerifier.issueChallenge`)
  - `POST /.databox/consume/token` → credential + holder proof → provisional token
    (`ProvisionalTokenExchange.exchange`) — records the issued token + tenant binding
  - `POST /.databox/consume/records` `{token}` → the connection's servable records
  - `POST /.databox/consume/submissions` `{token, submission}` → committed + signed
    acceptance receipt
  - `GET  /.databox/consume/feed?tenant=&cursor=` → committed-event feed, **tenant-bound
    to the presented token** (the token's recorded tenant must equal `tenant`)
  - `GET  /.databox/consume/statuslist` → `{encodedList}` (Bitstring Status List)
- **`ConsumeApi`** — the injected serving contracts: `TenantRecordStore` (per-connection
  servable records — production binds to the `CssDataboxStore` committed surface),
  `SubmissionProcessor` (scoped submission → durable commit + `AcceptanceReceiptSigner`
  — never a second issuance path), `IssuedTokenRegistry`, and a `tenantFor` binding.

## The `notWireFormat` seam — honest treatment

`ProvisionalShortLivedToken` is deliberately `notWireFormat: true` (ADR-0005/0006 — the
real bearer format is a *blocked* decision). The serving side therefore does **not**
trust the token as a bearer secret; it validates a presented token against the org's own
**issuance record** (`IssuedTokenRegistry` — connection + holder thumbprint + audience +
expiry, recorded when the exchange minted it). A forged/foreign/expired token fails
closed. The registry also binds the **tenant** at exchange — the feed is thereby
token-bound (a token issued for tenant A cannot pull tenant B's feed).

## Changes to the consumer side

- `RemoteConsumeClient.pullFeed` now carries the token as a `Bearer` (base64url) — the
  feed was previously unauthenticated; it's now tenant-bound to the presented token.
- `PersonalVaultService.recover` now `authenticateRemote`s before pulling the feed — the
  tenant's session token must exist (was silently unauthenticated).

## Verification

`test/unit/databox/consume/ConsumeHttpHandler.test.ts` — 5 tests drive the REAL ceremony
through `AgentHarness` (real `ConnectionCredentialIssuer` + `HolderKeyProofVerifier` +
`ProvisionalTokenExchange`, not stubs): challenge → token → records → feed; signed
submission receipt; forged/unissued token → 400; wrong-tenant feed → 400; unbound
connection → 400; status list. 14 consume+vault tests green; lint + tsc clean.

## Residual / notes

- **Preset wiring** — the handler composes programmatically (its deps are class
  instances, not yet Components.js components — the CIV-C26 seam-registration gap). The
  composition is `new ConsumeHttpHandler({ challengeSource, tokenExchange, recordStore,
  submissionProcessor, cursorFeed, tokenRegistry, tenantFor, statusListEncoded })`;
  binding `recordStore` to the committed `CssDataboxStore` surface is the production
  half.
- The `tenantFor` binding is org-side data (which connection belongs to which tenant) —
  the deployment supplies it from its connection/tenant registry.
