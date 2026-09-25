# DBX-26 — Deployment-tier adversarial pass (live HTTP harness)

`test/integration/DataboxP1Deployment.test.ts` runs a REAL server (AppRunner over
`test/integration/config/databox-live.json` → `config/databox/live.json`) with real account +
Solid-OIDC client-credentials + DPoP-authenticated fetches — the threats that only exist over HTTP.

## The harness caught three real integration defects (all fixed)

1. **Existence oracle (AT-07 / T-06).** The live preset routed reads through plain WAC
   (`readers/default.json`) — the composed Databox authorizer was never in the chain, so a denied box
   returned `403` while a guessed box returned `404`. A response-code distinction that confirms the
   box exists. **Fix:** `config/databox/live-authorization.json` binds
   `urn:solid-server:default:PermissionReader` to `ComposedDataboxPermissionReader` wrapping the WAC
   chain (reconstructed as `WacReaderChain`, since `readers/default.json` is dropped from the import
   graph). A suppressed-existence denial now collapses to the identical 404.

2. **The composed reader denied every non-databox path.** `resolver.resolve → undefined` conflated
   "not a databox resource" with "databox resource, missing conjuncts" — so the holder's own pod
   read failed. **Fix:** `ProductionInputResolver` scope-gates on `boxIdFromTarget` — paths outside
   `databoxBoxBase` pass the WAC result through unchanged; governed paths that fail resolution return
   denying inputs (fail closed, not pass-through).

3. **Holder access had no tenant binding.** The tenant resolver only accepted program-level
   audience/origin/serviceIdentity — the holder's pairwise-WebID credential carried none, so the
   holder's own box read denied on `token-audience`. **Fix:** `RegistryTenantResolver` accepts
   `webId === record.pairwiseWebId` as the holder's binding (ADR-0004 — stronger than a program
   audience); `TenantContext.pairwiseWebId` carries it; the engine's stage-3 conjunct re-asserts
   `context.webId === pairwiseWebId` for pairwise-bound requests (vs `audience === tenant.audience`
   for program principals).

## Shared-state wiring (DBX-26)

Provisioning (`MappingSmithy`) and the composed authorizer read the SAME
`RelationshipMappingRegistry` — `MappingSmithyOptions.registry` is injectable and
`LiveDataboxHttpHandler` binds `urn:solid-server:databox:RelationshipMappingRegistry` (the same
Components.js `@id` the resolver reads), so a provisioned box resolves for the holder's read.

## Generator metadata repaired

`componentsjs-generator` drops `extends` for generic superclasses (`UnionHandler<PermissionReader>`,
`.componentsignore`d `UnionHandler`). `scripts/componentsjs-fix-empty-terms.js` now also restores
`UnionPermissionReader`'s `PermissionReader` supertype so the WAC union binds as a reader.
`StatusListManager` now `implements CredentialRevocationChecker` so the revocation check binds.

## Results — all P1 attacks denied, holder access preserved

- AT-01 host-header rewrite → tenant binds to verified audience, not the header.  PASS
- AT-07 existence suppression → real-vs-guessed box both 404.  PASS
- AT-06 enumeration under budget → consistent deny class, no oracle.  PASS
- AT-16 independent Solid-OIDC client → holder's own pod reachable (not broker-locked).  PASS
- AT-30 data-plane storage read of a box record → denied.  PASS

199 suites / 1905 tests green; `DataboxLive` 4/4 (provision → commit → holder read → WAC boundary).
