# CIV-C26 — Seam-layer Components.js registration (diagnosed + partially landed)

**Status:** running (generation unblocked; instantiation-instantiability refactor remains)
**Wave:** C-series
**Depends on:** CIV-C02

## The three load-bearing fixes (landed)

1. **`build:components` flag bug** — the script passed `-s src` (reads `.ts`, emits nothing
   usable). The generator reads `.d.ts`, so it must be `-s dist`. Fixed in `package.json`:
   `componentsjs-generator -s dist -c dist/components -r css -i .componentsignore`.
   Result: ~500 component files emit (was ~2 effective).

2. **Root-entry reachability** — the generator only emits classes reachable from the package
   entry. `src/index.ts` selectively re-exported ~30 databox modules and silently skipped the
   rest — this is the *actual* "why `InMemoryRelationshipMappingRegistry` does not emit":
   `provisioning/` wasn't reachable. Now `export * from './databox'` (the barrel) — every seam
   class is indexed.

3. **Const exports abort the indexer** — the generator tries to load every package-level export
   as a class/interface; a `const` (e.g. `VC_V2_CONTEXT`) is a fatal "could not load". Two
   mechanisms now handle it:
   - Non-type consts added to `.componentsignore` (verified: ignoring a const stops the load).
   - `typeof`-const *type annotations* refactored to literal types — `CredentialStatusReference.type`
     was `typeof BITSTRING_STATUS_LIST_ENTRY_TYPE` → now the literal `'BitstringStatusListEntry'`.

## Proven working

`RegistryTenantResolver` emits as `Class` with **3 real constructor params**
(`boxBase`, `mapping`, `bindings`); `InMemoryTenantBindingRegistry` emits a no-arg `Class`.
The tenant/registry spine is config-instantiable.

## The remaining refactor (the C26 bulk — mapped, not done)

Under `--lenient` these are warnings; without it they're fatal. Three mechanical classes:

- **`readonly T[]` param fields (`TSTypeOperator`)** — ~18 fields across `HouseholdServiceDeps`.
  `members`, `EndpointValidatorOptions.allowedSchemes`, `InstitutionProfile`'s ~15 arrays,
  `AssuranceContext.methodRefs`, `PolicyConfig.templates`, `RedressConfig.appealRoutes`,
  `LegislativeCorpusRef.entries`, `DataboxRequestContext`. Fix: drop `readonly` on the array
  type in ctor/deps-facing params (keep element immutability where it matters via docs).
- **Interface-typed params need config-loadable sources** — e.g. `profile: InstitutionProfile`
  in `ProductionInputResolver`'s deps is a deep config object, not a ctor literal; the resolver
  should take a `RecordClass[]`/`existenceVisibility` accessor or a JSON-loaded profile ref.
- **Function-typed params (`now`)** — wrap in no-arg factories the generator can instantiate.

## The param-type refactor (landed — strict generation now clean)

- **`readonly T[]` strips** on ctor/deps-facing params only: `HouseholdServiceDeps.members`,
  the household-service/consent-store ctor `members`, `EndpointValidatorOptions.allowedSchemes`,
  `AssuranceContext.methodRefs`, `HouseholdProfile.members`. Property bindings stay `readonly`;
  only the array *type* is now mutable (`T[]`) — the generator can't express `readonly T[]`.
- **`typeof`-const unions → literal unions**: the nine `typeof CONST[number]` types in
  `InstitutionProfile` (`DeploymentModel`, `AssuranceDimension`, `ConflictStrategy`,
  `EffectiveTimeBehavior`, `AttestationStatus`, `DeletionMode`, `AppEncryptionMode`,
  `SenderConstraint`, `ExistenceVisibility`) are now literal unions; the `as const` arrays
  remain for iteration/validation.
- **`Readonly<Record<>>`/`Record<>` → mapped type**: `AssuranceDimensionLevels` — the
  generator resolves field types as class refs, so TS utility types are unloadable.
  `{ readonly [K in AssuranceDimension]: number }` is equivalent and generator-safe.
- **`ProductionInputResolver` narrowed**: `profile: InstitutionProfile` (a deep config
  object, not a ctor literal) → `defaultExistenceVisibility: ExistenceVisibility` scalar.
- **`methodRefs`**: spread at assignment (the crosswalk returns `readonly string[]`).

**Result:** `componentsjs-generator` (strict, non-lenient) exits **clean** — 597 component
files, zero errors. `GuardianNetwork.ts` was reconstructed (accidentally truncated by a
script mid-session — all household tests re-verified green, `mayActFor` restored for AT-47).

## The upstream empty-term bug — FIXED

`componentsjs-compile-config` was dying at parse on `The empty term is not allowed`. Root
cause: `componentsjs-generator` emits `context.jsonld` entries keyed by an **empty string**
when a parameter's name can't be resolved (~15 sites: `auxiliaryStrategy`, `baseUrl`,
`members`, `location`, …, spanning upstream classes AND the databox `HouseholdConsentStore`).
The param name is recoverable from the `@id` fragment (`{Class}_{param}`), so
`scripts/componentsjs-fix-empty-terms.js` renames the empty key to the real name — run as a
`build:components` post-step over `dist/components` AND `node_modules` (the bug is in
published dependency artifacts too, e.g. `@comunica/actor-query-source-identify-hypermedia-qpf`).

## Instantiation — PROVEN

`experimental.json` is now **real wiring**, not a manifest. `RegistryTenantResolver`
instantiates from config over `InMemoryRelationshipMappingRegistry` +
`InMemoryTenantBindingRegistry` (verified: `ComponentsManager.instantiate` returns a live
`RegistryTenantResolver` with `handleSafe`). The tenant spine is config-instantiable
end-to-end.

## The function→collaborator refactor (landed — resolver now zero-wildcard)

`ProductionResolverDeps` held five bare functions (`classifyResource`, `relationshipStatus`,
`isAccepted`, `odrl`, `delegation`) — un-config-loadable `ParameterRangeWildcard`s. Refactored
to **typed collaborator objects** (`ResourceClassifier.classify`, `RelationshipStatusSource.snapshot`,
`AcceptedResourceIndex.isAccepted`, `OdrlPreconditionSource.evaluate`, `DelegationChecker.check`) —
each is now an interface-typed param resolving to a concrete component. Same runtime contract;
the resolver now emits **zero wildcards** — every param is a component-ref, scalar, or union.

`SignedAssuranceCrosswalk`'s `document` is now a **`documentJson: string`** param (the signed
per-program document is atomic deployment data — a JSON string binds to a `Variable`; the ctor
parses then runs the identical admission checks). `AuthenticatedContextExtractor` +
`SignedAssuranceCrosswalk` came out of `.componentsignore` and emit as `AbstractClass`/`Class`.

## Instantiation — the seam layer is config-instantiable

`experimental.json` is real wiring. Verified live via `ComponentsManager.instantiate`:
- `RegistryTenantResolver` over `InMemoryRelationshipMappingRegistry` + `InMemoryTenantBindingRegistry`
- `VerifiedAssuranceContextExtractor` over `SignedAssuranceCrosswalk` (documentJson inlined)

## The concrete collaborators (landed — `ResolverCollaborators.ts`)

The five collaborator interfaces now have reference impls, all Components.js `Class` components:

| Seam | Impl | Wraps |
|---|---|---|
| `ResourceClassifier` | `PathSegmentResourceClassifier` | path-segment → record/submission class |
| `RelationshipStatusSource` | `RegistryRelationshipStatusSource` | `RelationshipMappingRegistry.findByRelationshipId` + `StatusListManager` |
| `AcceptedResourceIndex` | `ResourceStoreAcceptedIndex` | `ResourceStore.hasResource` (append-only) |
| `OdrlPreconditionSource` | `PolicyEvaluatorOdrlSource` | `PolicyEvaluator` over `PolicyRegistry` + trusted clock |
| `DelegationChecker` | `RegistryDelegationChecker` | `InMemoryDelegationGrantRegistry` + `isDelegationValid` |

Added `RelationshipMappingRegistry.findByRelationshipId` (the DBX-13 per-request lifecycle
lookup) — interface + in-memory impl. `StatusListManager` came out of `.componentsignore`.

## Instantiation — the full databox seam chain is config-loadable

Verified live via `ComponentsManager.instantiate` — every databox component resolves:
`RegistryTenantResolver`, `VerifiedAssuranceContextExtractor` + `SignedAssuranceCrosswalk`
(`documentJson`), `ProductionDataboxAuthorizationInputResolver` (zero wildcards), and all
five collaborators (`StatusListManager`, `PolicyRegistry`, `PolicyEvaluator`,
`PolicyEvaluatorOdrlSource`, `InMemoryDelegationGrantRegistry`, `RegistryDelegationChecker`,
`RegistryRelationshipStatusSource`, `PathSegmentResourceClassifier`).

`experimental.json` wires the real `ComposedDataboxPermissionReader` over the production
resolver + collaborators — replacing the `DenyAll` stub. The only unresolved refs are the
upstream launch-time bindings (`urn:solid-server:default:ResourceStore`, `PermissionReader`,
`baseUrl`) — standard CSS variables provided at server launch, not a seam gap.

## Honest status

**Seam registration: met.** Every databox class emits; the authorizer chain (C3 extractor →
C5 tenant → C4 composed reader → C25 resolver → collaborators) is config-instantiable. The
remaining work is deployment launch-composition (binding the upstream `ResourceStore`/
`PermissionReader` + `baseUrl` at launch — normal CSS), not registration. **197 suites /
1895 tests green**, lint + tsc clean, strict generation clean.
