# CIV-C25 — Production `DataboxAuthorizationInputResolver`

**Status:** accepted
**Wave:** C-series
**Depends on:** CIV-C02 (the seam this fills)

## What landed

`src/databox/authorization/ProductionInputResolver.ts` — the real per-request input
assembler the `ComposedDataboxPermissionReader` (DBX-14, C4) composes over. Until now the
`DataboxAuthorizationInputResolver` seam had only test fixtures (a static inputs object);
this is the production path that fills each conjunct from its authoritative source.

## The assembly order (the load-bearing part)

For one `(resource, request)` it resolves, **in order**:

1. **Context (C3)** first — `contextExtractor.handleSafe({credentials})`. The verified
   context is extracted before the tenant because the tenant resolver binds against the
   token's **audience — a verified claim, never a request-echoed header** (DBX-11 §7).
2. **Tenant (C5)** — `tenantResolver.handleSafe({target, audience, origin, serviceIdentity})`.
   `undefined` → the reader denies every mode.
3. **Classify** — `classifyResource(identifier)` maps the path to its governed record/
   submission class (deployment-specific → injected). Drives `requiredAssurance` +
   `existenceVisibility`.
4. **Relationship status (DBX-13)** — `relationshipStatus(tenant.relationshipId)` — the
   per-request re-check. Absent → deny (never "assume active").
5. **Append-only** — `isAccepted(identifier)` + a mutating mode → `mutatesAcceptedResource`.
6. **ODRL** — `odrl(classId, modes, context)` — the class's policy precondition.
7. **Delegation** — only when the context asserts an `act`/`onBehalfOf` claim →
   `delegation(grantRef, onBehalfOf, modes)`. **No checker configured + a claim present →
   `{valid:false}`** — a delegation can never ride through unvalidated.

## Fail-closed posture

Every missing conjunct returns `undefined` (deny) or a deny-valued conjunct — no
default-to-allow anywhere. The resolver itself never re-implements crypto or policy; it
*consumes* the C3/C5/C9/C12/C13 results as already-decided facts.

## Verification

`ProductionInputResolver.test.ts` — 6 tests: full assembly, no-tenant deny, missing
relationship deny, immutable classification on write-vs-read, delegation-without-checker
fails closed, unclassified-resource defaults. All authorization suites green (62 tests);
lint + tsc clean. Barrel-exported.

## Residual

The resolver is config-instantiable only once CIV-C26 lands (the seam-layer Components.js
registration). The `classifyResource` path→class convention and the `relationshipStatus`/
`isAccepted`/`odrl`/`delegation` collaborators are injected seams a preset wires.
