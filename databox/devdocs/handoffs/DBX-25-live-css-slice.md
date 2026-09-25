# DBX-25 Live CSS Integration Slice Handoff

**Status:** implemented and passing; DBX-25 as a whole remains active.

## Delivered

- `LiveDataboxHttpHandler` mounts the protected Smithy routes before the catch-all LDP handler.
- `CssDataboxStore` provisions opaque relationship resources and WAC ACLs in the configured CSS `ResourceStore`.
- Accepted institutional bytes are committed to `ResourceStore_Backend` without RDF reserialization before the
  durable-commit confirmation reaches the receipt signer.
- Ordinary HTTP retrieval continues through CSS LDP authorization and representation handling.
- Loopback HTTP is supported for local integration only; all non-loopback identity and service URLs require HTTPS.
- The live integration test proves anonymous denial and authenticated holder retrieval with a real CSS-issued,
  DPoP-bound client-credentials token.

## Configuration

- `config/databox/live.json`
- `config/databox/live-handler.json`
- `config/databox/live-variables.json`
- `test/integration/config/databox-live.json`

Operational instructions are in `databox/live-css-integration.md`.

## Verification

```text
npx jest test/integration/DataboxLive.test.ts --runInBand --coverage=false
PASS: 4 tests
```

## Residual DBX-25 work

The prompt's deterministic two-program lifecycle and evidence bundle are not yet complete. Remaining coverage is:

- low- and high-assurance access;
- deposit notification and recovery;
- retained consumer copy;
- consumer submission, signed receipt, review and disposition;
- policy duties and visible failure state;
- supersession;
- connection revocation and key rotation;
- cursor/feed recovery;
- explicit isolation assertions across two programs.

The live preset is demonstration-grade. Its control bearer must be replaced by organisation IAM, and Smithy keys,
mappings, outbox, status, idempotency and digest confirmation require durable production substrates.
