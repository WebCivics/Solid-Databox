# CIV-C02 handoff — Fail-closed stub wiring swaps

## Status

accepted with recorded blockers — the preset now names real implementations where they exist and
documents precisely why the remaining two seams stay fail-closed. Two new tracked items were
created from what the investigation found.

## What changed

`config/databox/preset/databox-experimental-components.json` — the seam manifest now names the
real DBX-delivered implementations instead of the DBX-09 stubs:

| Seam | Before | After | Blocker for live wiring |
|---|---|---|---|
| C3 context extractor | `NotImplementedContextExtractor` | `VerifiedAssuranceContextExtractor` | `SignedAssuranceCrosswalk` document is config-unloadable (see CIV-C26) |
| C5 tenant resolver | `NotImplementedTenantResolver` | `RegistryTenantResolver` | none — in-memory registries exist |
| C4 composed authorizer | `DenyAllDataboxPermissionReader` | unchanged | `DataboxAuthorizationInputResolver` has **no production implementation** — only the test-local `resolverFor` fixture. New item **CIV-C25**. DenyAll stays: it narrows, never broadens |
| C10 opaque ID generator | `NotImplementedOpaqueIdentifierGenerator` | `RandomOpaqueIdentifierGenerator` | none |
| C13 evidence ledger | `NotImplementedEvidenceLedger` | `HashChainedEvidenceLedger` | contract evolved: `LedgerAppendInput`/`LedgerEntry` supersedes the DBX-09 `EvidenceEvent` seam shape |
| C15 cursor feed | `NotImplementedCursorFeed` | `RetentionBoundedCursorFeed` | none |

## Key finding — the preset was never loadable

The gap-analysis framed this as "swap the wiring in the preset." Investigation showed the wiring
was never real: **every seam class, stubs and impls alike, sits in `.componentsignore`**, so the
`@type` references resolve to nothing — the file is a manifest of intended seams, not instantiable
config, and `FailClosedStubs.test.ts` verifies the stub *classes* in code rather than loading the
preset. Composition of the databox layer is programmatic (e.g. `LiveDataboxHttpHandler` constructs
`CssDataboxStore` + `MappingSmithy` in code).

## What was tried and reverted

Making the seams actually Components.js-instantiable was attempted and deliberately backed out:

- Removing the classes from `.componentsignore` emitted correct descriptions for
  `RegistryTenantResolver`, `VerifiedAssuranceContextExtractor`, `RandomOpaqueIdentifierGenerator`,
  `HashChainedEvidenceLedger`, `InMemoryTenantBindingRegistry` — but:
  - `SignedAssuranceCrosswalk` cannot generate: `AssuranceCrosswalkDocument` used `readonly` array
    fields (TSTypeOperator) in a walked param type, and behind it `InstitutionProfile.ts` uses
    `typeof CONST[number]` expressions the generator cannot express. That module is the hub of the
    layer; restructuring it is its own item.
  - `InMemoryRelationshipMappingRegistry` does not emit even when un-ignored and index-exported —
    cause undiagnosed (generator's file-level emit rules; no error printed).
- Reverted: `.componentsignore`, the `src/index.ts` export additions, and a `readonly`→plain-array
  tweak in `AssuranceCrosswalkDocument`. Rationale: a half-registered layer is worse than the
  designed fully-opted-out state; minimal diff for a manifest-level change.
- Also observed (pre-existing, unrelated): `componentsjs-compile-config` fails on an upstream
  generated component (`AuxiliaryLinkMetadataWriter_auxiliaryStrategy`, "empty term is not
  allowed") — config validation via that tool is broken repo-wide today. Folded into CIV-C26.

## New tracked items

- **CIV-C25** — production `DataboxAuthorizationInputResolver` (the per-request input assembler for
  the DBX-14 composed reader). Hard.
- **CIV-C26** — seam-layer Components.js registration (typeof consts, readonly arrays in param
  types, function params, interface params, generator emit diagnosis, upstream compile failure).
  Hard.

## Commands run

```powershell
npm run build                                     # tsc + componentsjs-generator — green
npx jest test/unit/databox/FailClosedStubs.test.ts test/unit/databox/tenant \
  test/unit/databox/authorization test/unit/databox/context \
  test/unit/databox/evidence test/unit/databox/feed test/unit/databox/identifiers \
  --maxWorkers=2 --coverage=false                 # 18 suites, 209 tests — all pass
npm run lint                                      # eslint 0 warnings, markdownlint clean
```

## Residual risks / notes

- The preset remains documentation-of-intent until CIV-C26 lands; its comments now say so plainly.
- `componentsjs-compile-config` and the `validate` npm script are not in the documented gate set
  (build/lint/jest) — the upstream empty-term failure does not gate anything currently, but will
  surprise anyone who tries config validation.
