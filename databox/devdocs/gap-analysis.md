# Gap Analysis: Scaffolds, Stubs, Mocks, and Incomplete Implementations

> A comprehensive audit of the codebase identifying every scaffold, stub, mock,
> fail-closed placeholder, and incomplete implementation that needs real work
> before production use. Organized by subsystem and severity.

---

## 1. Databox Server-Side Fail-Closed Stubs (DBX-09 scaffold remnants)

These are **intentional fail-closed placeholders** from the DBX-09 scaffold. They throw
`NotImplementedHttpError` rather than silently permitting access. Each has a real
implementation that replaces it (tracked by DBX ticket), but the stubs remain as default
wiring until a preset consciously swaps them out.

### 1.1 `NotImplementedTenantResolver` — Component C5

- **File:** `src/databox/tenant/TenantResolver.ts:163-166`
- **Replaced by:** `RegistryTenantResolver` (same file, DBX-11)
- **Status:** Real implementation exists in the same file. The stub is retained as the
  default wiring until a program tenancy is configured. **Low gap** — swap the wiring in
  the preset to use the real resolver.

### 1.2 `NotImplementedContextExtractor` — Component C3

- **File:** `src/databox/context/AuthenticatedContextExtractor.ts:181-184`
- **Replaced by:** `AuthenticatedContextExtractor` (same file, DBX-12)
- **Status:** Real implementation exists in the same file. The stub is retained as the
  default wiring until a program crosswalk is configured. **Low gap** — swap the wiring.

### 1.3 `NotImplementedOpaqueIdentifierGenerator` — Component C10

- **File:** `src/databox/identifiers/OpaqueIdentifierGenerator.ts:115-124`
- **Replaced by:** `RandomOpaqueIdentifierGenerator` (same file, DBX-10)
- **Status:** Real implementation exists. The stub is the default until wired into a
  control-plane preset. **Low gap** — swap the wiring.

### 1.4 `DenyAllDataboxPermissionReader` — Component C4

- **File:** `src/databox/authorization/DataboxAuthorizer.ts:44-51`
- **Replaced by:** `ComposedDataboxPermissionReader` (DBX-14, re-exported same file)
- **Status:** Real composed authorizer engine exists (`ComposedAuthorizationEngine.ts`).
  The stub grants nothing (safe — it narrows, never broadens). **Low gap** — swap the
  wiring in `readers/default.json`.

### 1.5 `NotImplementedEvidenceLedger` — Component C13

- **File:** `src/databox/evidence/Evidence.ts:98-101`
- **Replaced by:** `HashChainedEvidenceLedger` in `EvidenceLedgerStore.ts` (DBX-18/19)
- **Status:** Real hash-chained ledger exists. The stub refuses to append evidence
  (safe — a deposit whose evidence can't be committed is rejected). **Low gap** — swap
  the wiring.

---

## 2. Server-Side Mocks and Stubs

### 2.1 `OdbcConnector` — Mock SQL data

- **File:** `src/databox/ipms/sidecars/OdbcConnector.ts:9-46`
- **Issue:** Returns hardcoded mock rows (`Acme Corp`, `Globex Inc`) instead of executing
  a real ODBC query. Comment says: "In a real implementation, we would use the `odbc`
  NPM package."
- **Work needed:** Install `odbc` npm package, implement real connection + query
  execution, handle errors/timeouts, stream large result sets.
- **Severity:** **High** — the connector sidecar is non-functional without real ODBC.

### 2.2 `LdapConnector` — Mock LDAP data

- **File:** `src/databox/ipms/sidecars/LdapConnector.ts:18-55`
- **Issue:** Returns hardcoded mock entries (`Admin User`, `John Doe`) instead of
  binding to and searching a real LDAP directory. Comment says: "In a real
  implementation, we would use `ldapjs` to bind and search."
- **Work needed:** Install `ldapjs` npm package, implement real bind + search + unbind,
  handle connection errors, map LDAP attributes to schema.org Person profiles.
- **Severity:** **High** — the connector sidecar is non-functional without real LDAP.

### 2.3 `FailClosedScanner` — Binary evidence quarantine

- **File:** `src/databox/gateway/BinaryEvidenceQuarantine.ts:42-50`
- **Issue:** The default scanner returns `unknown` for every payload, so no binary
  evidence is ever released from quarantine. Comment says: "Production scanning is
  DEFERRED (ADR-0022 §5)."
- **Work needed:** Integrate a real malware scanner (e.g. ClamAV, VirusTotal API).
  The `StubVerdictScanner` exists for testing but is explicitly labelled as not
  production.
- **Severity:** **Medium** — binary evidence deposits are blocked, but this is an
  intentional safety gate, not a silent failure.

### 2.4 `ConnectorSidecar` — `require.main` check

- **File:** `src/databox/ipms/sidecars/ConnectorSidecar.ts:59`
- **Issue:** Uses `require.main === module` which is CJS syntax. The project is moving
  to ESM (`"type": "module"` in `package.json`, `nodenext` module resolution). This
  will break under ESM.
- **Work needed:** Replace with `import.meta.url === pathToFileURL(process.argv[1]).href`
  or use a dedicated entry point script.
- **Severity:** **Medium** — will break when run under ESM.

---

## 3. Smithy-Admin: `@ts-nocheck` on Every Page

**Every single page component** in `smithy-admin/src/pages/` has `// @ts-nocheck` on line
1, disabling TypeScript checking entirely. This masks type errors, unsafe `any` casts,
and missing prop validation.

**Affected files (20):**
- `pages/access-requests/list.tsx`
- `pages/access-requests/show.tsx`
- `pages/consumer-ledger/list.tsx`
- `pages/consumer-ledger/show.tsx`
- `pages/corrections/list.tsx`
- `pages/corrections/show.tsx`
- `pages/data-portability/index.tsx`
- `pages/events/create.tsx`
- `pages/hosting/index.tsx`
- `pages/mappings/create.tsx`
- `pages/modules/index.tsx`
- `pages/pos/customer.tsx`
- `pages/pos/display.tsx`
- `pages/pos/index.tsx`
- `pages/pos/shared.tsx`
- `pages/programs/create.tsx`
- `pages/programs/list.tsx`
- `pages/receipts/index.tsx`
- `pages/setup/index.tsx`
- `pages/setup/InformationCategories.tsx`
- `pages/setup/VerticalProfilePicker.tsx`
- `pages/waiter/index.tsx`

- **Work needed:** Remove `@ts-nocheck` from each file, fix the resulting type errors,
  add proper interfaces for component props and API response shapes.
- **Severity:** **High** — type safety is completely bypassed for the entire admin UI.

---

## 4. Smithy-Admin: Demo Data Provider (Mock Data)

### 4.1 `demoDataProvider` — All in-memory mock data

- **File:** `smithy-admin/src/providers/demoDataProvider.ts:1-465+`
- **Issue:** The entire demo data provider uses in-memory mutable arrays (`mockPrograms`,
  `mockCorrections`, `mockAccessRequests`, `mockLedger`, `mockOutboundRequests`,
  `mockIpmsModules`, `mockVerticalProfiles`). It creates, updates, and deletes from
  these arrays — no persistence, no Solid backend.
- **Status:** This is **intentional** for demo/dev mode (activated by `VITE_DEMO=true`).
  It is not a scaffold — it's a feature. But it must not be used in production.
- **Severity:** **Low** — by design, but documented here for completeness.

### 4.2 `standardSolidDataProvider` — Degraded mode

- **File:** `smithy-admin/src/providers/standardSolidDataProvider.ts`
- **Issue:** Many resources return `degraded: true` with `degradationReason` strings.
  This is **by design** — the standard-Solid provider is the "portable-core" mode that
  reads from ordinary Solid resources without the CSS IPMS control plane. Operations like
  enabling/disabling modules or applying vertical profiles are unavailable.
- **Status:** Intentional degradation, not a stub. The missing piece is that some
  resources simply return `list([])` with a degradation reason (e.g. when
  `VITE_SOLID_CMS_MANIFEST_INDEX_URL` is not set).
- **Severity:** **Low** — by design.

---

## 5. Rust Native: Placeholder Logic

### 5.1 Installer — Node.js provisioning not implemented

- **File:** `native/installer/src/node.rs:80-93`
- **Issue:** The Node 24 download and extraction is a stub. It prints the URL and creates
  the directory structure but does not actually download or extract the archive. Comment:
  "In production, this downloads and extracts the archive."
- **Work needed:** Add `reqwest` or `ureq` crate for HTTP download, verify SHA-256
  checksum, extract `.tar.xz` (Linux/macOS) or `.zip` (Windows) to the runtime directory.
- **Severity:** **High** — the installer cannot provision Node without this.

### 5.2 Installer — App extraction not implemented

- **File:** `native/installer/src/deploy.rs:17-20`
- **Issue:** Does not extract the CSS fork archive. Comment: "In a real implementation,
  this would: 1. Extract the CSS fork archive into app_dir, 2. For each required binary,
  copy from the installer bundle and verify checksum."
- **Work needed:** Bundle the CSS fork as a tarball/zip, extract it, verify checksums of
  Rust helper binaries.
- **Severity:** **High** — no actual deployment happens.

### 5.3 Installer — Crypto bootstrap incomplete

- **File:** `native/installer/src/config.rs:49-52`
- **Issue:** Does not generate Solid-OIDC signing keys or set directory permissions.
  Comment: "In a real implementation, this would also: 1. Generate Solid-OIDC signing
  keys via the Node binary, 2. Set directory permissions on the data dir, 3. Create
  initial storage structure."
- **Work needed:** Invoke CSS's keygen via the Node binary, `chmod` the data directory,
  create storage subdirectories.
- **Severity:** **Medium** — the `.env` is generated but the server can't start without
  signing keys.

### 5.4 Installer — CSPRNG not used for control token

- **File:** `native/installer/src/config.rs:57-61`
- **Issue:** The control token is generated using `SystemTime` + `process::id` with a
  linear congruential generator, not a CSPRNG. Comment: "In production, use a proper
  CSPRNG (e.g., the `rand` crate)."
- **Work needed:** Add the `rand` crate, use `OsRng` for token generation.
- **Severity:** **High** — the control token is a security credential; weak randomness
  makes it predictable.

### 5.5 Installer — Windows privilege check not implemented

- **File:** `native/installer/src/preflight.rs:47-50`
- **Issue:** On Windows, the privilege check just prints a note instead of actually
  verifying Administrator status. Comment: "For now, just warn."
- **Work needed:** Use the `windows` crate or `is-elevated` crate to check for
  Administrator privileges.
- **Severity:** **Medium** — service registration will fail without elevation, but the
  installer won't detect it early.

### 5.6 Installer — Timestamp generation is a hack

- **File:** `native/installer/src/handoff.rs:60-64`
- **Issue:** Generates an ISO 8601 timestamp by doing arithmetic on `UNIX_EPOCH` seconds,
  producing a fake date (`2026-07-21T...`). Comment: "In production, use a proper date
  crate."
- **Work needed:** Add the `chrono` or `time` crate for proper ISO 8601 timestamps.
- **Severity:** **Low** — cosmetic, but the install manifest will have wrong dates.

### 5.7 POS edge — Direct cash drawer not implemented

- **File:** `native/pos-edge/src/hardware/drawer.rs:22-24`
- **Issue:** The `direct` cash drawer mode (non-printer-connected drawer) prints a
  message and returns `Ok(())` without actually driving hardware. Comment: "Direct cash
  drawer device not yet implemented."
- **Work needed:** Implement serial/USB I/O for direct cash drawer devices (e.g. via
  `serialport` crate).
- **Severity:** **Medium** — only the `printer` kick mode works; `direct` is a no-op.

### 5.8 POS edge — Unused imports/warnings

- **Files:** `native/pos-edge/src/main.rs:3`, `native/pos-edge/src/hardware/drawer.rs:4`,
  `native/pos-edge/src/hardware/printer_io.rs:4`, `native/pos-edge/src/ipc.rs:60,87`,
  `native/pos-edge/src/http.rs:22`
- **Issue:** Unused imports (`BufRead`, `BufReader`, `Write`, `INIT_PRINTER_BYTES`,
  `KICK_CASH_DRAWER_BYTES`), unused variable (`writer`), dead code (`send_shutdown`),
  unnecessary `mut`.
- **Work needed:** Clean up imports, prefix unused with `_`, or use `#[allow(...)]`.
- **Severity:** **Low** — warnings only, no functional impact.

### 5.9 Tray supervisor — No fullscreen for customer display

- **File:** `native/tray-supervisor/src/main.rs:104`
- **Issue:** Comment: "In production, we could set `.with_fullscreen()`" — the customer
  display window opens as a regular window, not fullscreen.
- **Work needed:** Add `.with_fullscreen(Fullscreen::Borderless(None))` for POS
  customer-facing displays.
- **Severity:** **Low** — cosmetic for the display window.

---

## 6. IPMS Module Scaffolds (Server-Side)

The IPMS has **38 module directories** under `src/databox/ipms/modules/`. Most contain
manifest definitions and some route handlers, but many are seams/declarations rather
than full implementations. Key gaps:

### 6.1 Modules with manifests but minimal/no route handlers

The following modules have manifests registered in `BuiltInModules.ts` but their route
handlers are either absent or return placeholder responses:

- `a11y/` — accessibility module
- `access/` — access request routing
- `consent/` — consent management
- `credentials/` — VC issuance
- `delegation/` — delegation management
- `delivery/` — delivery tracking
- `emergency/` — emergency access
- `governance/` — governance/quorum
- `household/` — household management
- `licensing/` — licensing
- `loyalty/` — loyalty programs
- `mcp/` — model context protocol
- `pricing/` — pricing rules
- `profile/` — profile management
- `theming/` — theme management

- **Work needed:** Implement route handlers, data persistence, and business logic for
  each module according to its manifest's `capabilities` and `routes`.
- **Severity:** **Medium** — these are declared seams; the plan explicitly says "only
  Hosting is built in pass 1."

### 6.2 `ui#` form shapes not wired to module manifests

- **Files:** `databox/ontologies/module-config-shapes.ttl`, `src/databox/ipms/SolidModuleManifest.ts`
- **Issue:** The `ui#` shapes file defines config forms for hosting, POS, and receipt
  modules, but the `configShape` field on `SolidModuleManifest` is not yet populated to
  point at these shape IRIs in the built-in module registrations.
- **Work needed:** Update `BuiltInModules.ts` to set `configShape` on each module
  manifest to the corresponding `ui#` shape IRI.
- **Severity:** **Medium** — the form renderer exists but can't be invoked because
  manifests don't point to shapes.

### 6.3 `UiFormRenderer` not wired into modules page

- **File:** `smithy-admin/src/pages/modules/index.tsx`
- **Issue:** The modules page lists modules with enable/disable toggles but does not
  render the `UiFormRenderer` for module configuration. The renderer component exists
  at `smithy-admin/src/components/ui-form/UiFormRenderer.tsx` but is not imported or used.
- **Work needed:** Add a config panel/modal to the modules page that fetches the
  module's `configShape` Turtle and renders it via `UiFormRenderer`.
- **Severity:** **Medium** — the UI infrastructure exists but is not connected.

---

## 7. Configuration and Packaging Gaps

### 7.1 No `docker-compose.yml` for IPMS

- **Plan reference:** `solid-ipms-plan.md` §7, line 589
- **Issue:** The plan calls for a `docker-compose.yml` with IPMS container + `/data`
  volume + env/secrets, multi-arch (amd64+arm64). None exists.
- **Work needed:** Create `docker-compose.yml` with the IPMS service, volume mounts,
  environment variables, and health check.
- **Severity:** **Medium** — needed for containerized deployments.

### 7.2 No `config/databox/ipms.json` handler config

- **Plan reference:** `solid-ipms-plan.md` §7, line 582
- **Issue:** The plan calls for `config/databox/ipms.json` to wire the registry +
  `/.databox/ipms` route. The IPMS config exists at `config/ipms/ipms.json` but the
  handler-level wiring config may be incomplete.
- **Work needed:** Verify the handler chain is fully wired in the config preset.
- **Severity:** **Low** — may already be partially addressed.

### 7.3 Profile ladder not documented

- **Plan reference:** `solid-ipms-plan.md` §7, line 588
- **Issue:** The plan calls for a documented profile ladder: basic → +databox → +ipms →
  +modules. No documentation file exists for this.
- **Work needed:** Write a profile ladder doc explaining each layer and what it adds.
- **Severity:** **Low** — documentation.

---

## 8. Missing Tests

### 8.1 No unit tests for new vocabulary terms

- **Issue:** The extended `IPMS` and new `UI` vocabularies in `src/util/Vocabularies.ts`
  have no unit tests verifying term resolution.
- **Work needed:** Add tests to `test/unit/util/Vocabularies` that verify all new terms
  resolve to the correct namespace IRI.
- **Severity:** **Medium** — `src/` is under a 100% coverage gate.

### 8.2 No tests for `UiFormRenderer` or `parseUiShape`

- **Issue:** The `ui#` form renderer and shape parser in `smithy-admin/src/components/
  ui-form/` have no tests.
- **Work needed:** Add tests for shape parsing (Turtle → form spec), field rendering,
  and form value serialization back to Turtle.
- **Severity:** **Medium** — untested UI infrastructure.

### 8.3 No Rust tests for installer or POS edge

- **Issue:** Neither `native/installer/` nor `native/pos-edge/` have any `#[test]`
  functions.
- **Work needed:** Add unit tests for each installer step (with mocked environment),
  IPC protocol parsing, job queue state transitions, and hardware dispatch (with mocked
  devices).
- **Severity:** **Medium** — untested native code.

### 8.4 No integration test for POS edge ↔ Node IPC

- **Issue:** The plan calls for an integration test where Node posts a job to the Rust
  binary's HTTP endpoint and the binary executes it. None exists.
- **Work needed:** Create an integration test that starts the POS edge binary, posts a
  cash-drawer job to `localhost:9100/jobs`, and verifies the job status transitions.
- **Severity:** **Medium** — the IPC bridge is untested end-to-end.

---

## 9. `tsconfig.json` and Build Configuration

### 9.1 `@tsconfig/node24` dependency removed but not reinstalled

- **File:** `tsconfig.json`, `package.json`
- **Issue:** The `extends` was removed and settings inlined, the dependency was removed
  from `package.json`, but `npm install` has not been run to update `package-lock.json`.
- **Work needed:** Run `npm install` to update the lockfile.
- **Severity:** **Low** — lockfile drift.

---

## 10. Summary by Severity

### Critical / High

| # | Item | Subsystem |
|---|------|-----------|
| 2.1 | ODBC connector returns mock data | IPMS sidecars |
| 2.2 | LDAP connector returns mock data | IPMS sidecars |
| 3 | `@ts-nocheck` on all 22 smithy-admin pages | smithy-admin |
| 5.1 | Installer Node.js download not implemented | native/installer |
| 5.2 | Installer app extraction not implemented | native/installer |
| 5.4 | Control token uses non-CSPRNG | native/installer |

### Medium

| # | Item | Subsystem |
|---|------|-----------|
| 2.3 | Binary evidence scanner deferred (fail-closed) | gateway |
| 2.4 | `ConnectorSidecar` uses CJS `require.main` | IPMS sidecars |
| 5.3 | Crypto bootstrap (OIDC keys) not implemented | native/installer |
| 5.5 | Windows privilege check is a print-only stub | native/installer |
| 5.7 | Direct cash drawer mode is a no-op | native/pos-edge |
| 6.1 | 15+ IPMS modules are manifest-only scaffolds | IPMS modules |
| 6.2 | `ui#` shapes not wired to module manifests | IPMS modules |
| 6.3 | `UiFormRenderer` not connected to modules page | smithy-admin |
| 7.1 | No `docker-compose.yml` for IPMS | packaging |
| 8.1 | No unit tests for new vocabulary terms | tests |
| 8.2 | No tests for ui# form renderer | tests |
| 8.3 | No Rust tests for installer or POS edge | tests |
| 8.4 | No integration test for POS edge IPC | tests |

### Low

| # | Item | Subsystem |
|---|------|-----------|
| 1.1-1.5 | Five fail-closed stubs (real impls exist, wiring needed) | databox |
| 4.1 | Demo data provider is in-memory mock (by design) | smithy-admin |
| 4.2 | Standard-Solid provider degraded mode (by design) | smithy-admin |
| 5.6 | Installer timestamp is a hack | native/installer |
| 5.8 | Rust unused imports/warnings | native/pos-edge |
| 5.9 | Customer display not fullscreen | native/tray-supervisor |
| 7.2 | Handler config may be incomplete | config |
| 7.3 | Profile ladder not documented | docs |
| 9.1 | `package-lock.json` needs update | build |

---

## 11. Cloudflare / Hosting Module — Incomplete

### 11.1 Hosting module only generates artifacts — no Cloudflare API integration

- **Files:** `src/databox/ipms/modules/hosting/HostingConfig.ts`, `HostingApi.ts`
- **Issue:** The hosting module computes DNS records and a launch command (pure
  derivation) and exposes a single `POST /hosting/plan` endpoint. It does **not**:
  - Accept or store a Cloudflare API token
  - Create Cloudflare DNS records via the Cloudflare API
  - Create or configure a Cloudflare Tunnel (`cloudflared`)
  - Configure ingress rules (hostname → local service)
  - Register the `databox.<apex>` origin as a `TenantBinding`
  - Persist the hosting config as an RDF resource in the pod
- **Plan reference:** `dynamic-strolling-lerdorf.md` §6 — the plan describes a full
  setup flow: user provides a scoped Cloudflare API token → module automates tunnel
  creation, ingress rules, and DNS/CNAME-to-tunnel records. A fallback path generates
  copy/download artifacts for manual application.
- **Work needed:**
  1. Add a `POST /hosting/apply` endpoint that accepts a Cloudflare API token + the
     hosting plan, and calls the Cloudflare API to create DNS records and/or tunnel.
  2. Add a `POST /hosting/persist` endpoint that commits the hosting config as an RDF
     resource (reusing `CssDataboxStore` patterns).
  3. Add a `POST /hosting/bind` endpoint that registers the origin as a
     `TenantBinding`.
  4. Store the API token server-side, redacted, never committed (env or module config).
  5. Generate `cloudflared` config for the guided-artifacts fallback path.
- **Severity:** **High** — the hosting module is the first module and is only half-built
  (plan generation without apply).

### 11.2 Smithy-admin hosting page — wizard only computes, doesn't apply

- **File:** `smithy-admin/src/pages/hosting/index.tsx`
- **Issue:** The hosting wizard UI collects domain/origin input and calls
  `POST /hosting/plan` to compute the plan, but has no UI for:
  - Entering a Cloudflare API token
  - Applying the plan (calling a `/hosting/apply` endpoint)
  - Persisting the config
  - Viewing the generated `cloudflared` config
- **Work needed:** Add token input, apply button, persistence, and artifact download.
- **Severity:** **Medium** — depends on 11.1.

### 11.3 No `docker-compose.yml` for IPMS

- **Plan reference:** `solid-ipms-plan.md` §0, `dynamic-strolling-lerdorf.md` §1.3
- **Issue:** The plan calls for a `docker-compose.yml` with IPMS container + `/data`
  volume + env/secrets. The checkpoint says "Deployment artifacts exist for Docker
  Compose" but no `docker-compose.yml` file is present in the repo root.
- **Work needed:** Create `docker-compose.yml` with the IPMS service, volume mounts,
  environment variables, and health check. Multi-arch (amd64+arm64).
- **Severity:** **Medium** — needed for containerized deployments.

---

## 12. Health / Food Allergy Module — Needs Redesign

### 12.1 Current "health" vertical profile is a clinical privacy bundle, not a food-allergy system

- **File:** `src/databox/ipms/VerticalProfile.ts:93-112`
- **Issue:** The `health.privacy-consent` vertical profile bundles consent, access
  requests, correction requests, governance, delegation, break-glass, and credential
  gates — this is a **clinical/medical privacy** bundle, not the food-allergy use case.
  The user's intent is: **a consumer provides their food allergies/dietary needs from
  their own pod, and a food retailer (restaurant, take-away) lists all ingredients so
  the system can check against allergies, with selective disclosure for secret
  ingredients/recipes.**

### 12.2 What exists for allergens is UI-only mock data

- **Files:** `smithy-admin/src/pages/pos/customer.tsx`, `pages/pos/index.tsx`,
  `pages/waiter/index.tsx`
- **Issue:** The POS customer and waiter pages have hardcoded allergen arrays
  (`["milk", "egg", "gluten", "sesame"]`) and menu items with hardcoded `allergens`
  fields. There is no:
  - Server-side ingredient/allergen data model
  - Module for ingredient declarations by the retailer
  - Consumer-side allergy profile stored in their pod
  - Matching engine that checks consumer allergies against retailer ingredients
  - Selective disclosure mechanism for secret ingredients/recipes
- **Severity:** **High** — the core food-safety use case has no server-side
  implementation.

### 12.3 What needs to be built

1. **Consumer allergy/dietary profile module** — a person-owned profile in the
   consumer's pod (reusing the "person-owned profiles" horizontal from the plan,
   §11/§12.2). Stores allergies, dietary restrictions (vegan, halal, kosher, FODMAP),
   accessibility needs. Shared minimally — the retailer sees filtered results, not the
   raw medical record.

2. **Retailer ingredient declaration module** — a IPMS module where the food retailer
   declares ingredients for each menu/catalogue item. Each ingredient links to
   allergen classifications (using a standard ontology — e.g. FSANZ allergen
   categories, schema.org `Recipe`/`MenuItem`). This is the retailer-side data that
   the matching engine checks against.

3. **Allergen matching engine** — when a consumer's pod shares their allergy profile
   with a retailer (via Solid consent + minimal disclosure), the system cross-references
   the consumer's allergens against the retailer's ingredient declarations. Items
   containing flagged allergens are filtered or flagged in the POS/menu display.

4. **Selective disclosure for secret ingredients/recipes** — the retailer may have
   secret ingredients or proprietary recipes. The system needs a mechanism where:
   - The retailer declares "this item contains allergen X" (a boolean/attestation)
     without revealing the full ingredient list or recipe.
   - A zero-knowledge or attestation-based check confirms "this item is safe for your
     allergies" without disclosing the secret ingredient.
   - This could use VC attestation patterns ("certified allergen-free for [allergen]")
     or selective disclosure primitives (SD-JWT/BBS+ per the plan's minimal-disclosure
     horizontal, §11).

5. **Vertical profile** — a new `food.allergy-safety` vertical profile (or extend
   `food.restaurant`) that bundles: ingredient declaration module + consumer profile
   module + allergen matching + selective disclosure + POS integration.

6. **Ontology** — adopt or define an allergen/ingredient ontology. Candidates:
   - **schema.org `Recipe`** (`recipeIngredient`, `recipeCategory`) for ingredient lists
   - **Food allergen ontologies** (FSANZ, EU Reg 1169/2011 allergen list) as SKOS
     concepts
   - **DPV** for the legal basis of processing allergy data (special-category health
     data)
   - **ODRL** for the usage licence on secret recipes (no-reuse, no-disclosure)

---

## 13. ODBC & LDAP Connectors — Need Interactive Mapping Apps

### 13.1 Current state: mock data + no mapping UI

- **Files:** `src/databox/ipms/sidecars/OdbcConnector.ts`, `LdapConnector.ts`
- **Issue:** Both connectors return hardcoded mock data. The plan (§1.5) calls for
  R2RML/RML declarative mapping via an interactive mapping application — the operator
  defines how source columns/fields map to RDF predicates, and the connector executes
  that mapping. No mapping UI exists.

### 13.2 What needs to be built

1. **Real ODBC and LDAP connector implementations** — replace mock data with actual
   `odbc` (NPM) and `ldapjs` (NPM) calls (or Rust `odbc-api`/`ldap3` sidecars per the
   plan).

2. **Interactive mapping app** — a smithy-admin page where the operator:
   - Connects to the source (ODBC connection string / LDAP URL + credentials)
   - Browses the source schema (tables/columns for ODBC, attributes for LDAP)
   - Maps source fields to RDF predicates (using the Ontology Mapping Registry)
   - Defines the subject IRI template (R2RML `subjectTemplate`)
   - Previews the mapped RDF output
   - Saves the mapping as a declarative R2RML/RML RDF resource in the pod

3. **Ontological approach** — the mapping definitions are themselves RDF ("the works",
   §1.4) — R2RML/RML are W3C standard mapping languages. The mapping app produces
   portable RDF mapping documents that any engine can execute. This aligns with the
   plan's "declarative mapping + thin engine" architecture.

4. **Connector sidecar execution** — the `ConnectorSidecar.ts` reads a job config from
   stdin and executes the mapping. It needs to:
   - Load the R2RML/RML mapping from the pod
   - Connect to the source (ODBC/LDAP) using credentials from `secretRefs`
   - Execute the query/search
   - Apply the mapping to produce RDF
   - Write the RDF to stdout (for the IPMS to commit to the pod)

5. **ESM compatibility** — `ConnectorSidecar.ts` uses `require.main === module` (CJS);
   must be updated for ESM (`import.meta.url`).

---

## 14. Org Mobile Apps — Architecture & Delivery Model Needed

### 14.1 Current state: scattered, no unified delivery model

- **Waiter app:** exists only as a page inside smithy-admin (`smithy-admin/src/pages/waiter/index.tsx`) — it is not a standalone installable app.
- **Tradie app:** exists as a standalone Vite/React app (`apps/tradie-app/`) with mock data and a `handleSave` that just alerts "Saving to Solid Pod..." — no real Solid integration.
- **No `org-mobile-apps` folder:** the tradie app lives in `apps/` with no org-app convention. The waiter app is embedded in the admin panel rather than being a separate client.
- **No WASM packaging:** neither app is built for WASM delivery. Both are standard Vite SPA builds.
- **No profile-driven availability:** no mechanism ties app availability to the org's vertical profile (e.g. a restaurant gets the waiter app, an auto shop gets the tradie app).
- **No network-scope policy:** no mechanism restricts an app to the org's WiFi only (waiter) vs allowing remote use (tradie).

### 14.2 What needs to be built

1. **`org-mobile-apps/` directory** — a new top-level folder (or `apps/org-mobile-apps/`) that holds all org-specific client apps as a convention. Each app is self-contained with its own `package.json`, built independently. Apps include:
   - **Waiter app** — extracted from smithy-admin into a standalone app. For restaurant/food verticals. WiFi-only.
   - **Tradie app** — moved from `apps/tradie-app/` into `org-mobile-apps/tradie-app/`. For auto/trades/service verticals. Remote-capable.
   - Future apps: POS handheld, kitchen display, booking desk, event check-in, etc.
   - **Sports/venue apps** — scorekeeper app (mark live scores for matches/games),
     referee app (match officiation: fouls, timeouts, player management, match report
     submission), turnstile/credential-gate app (verify membership/ticket VCs at
     physical access points per §10.2/§11). These are `local-only` (used at the
     venue on event WiFi) except the referee app which may be `remote-capable` for
     remote officiation or post-match report filing.
   - **Print business app** — job queue, prepress/proofing, print dispatch, delivery
     management for a printing business. `local-only` in-shop, `remote-capable` for
     off-site monitoring. See §17 for the full print business module and inter-org
     B2B print job submission workflow.
   - **Delivery driver app** — unified job queue across multiple stores/platforms,
     navigation, one-tap status updates, earnings dashboard, privacy-preserving
     customer messaging. `remote-capable` (field use on mobile data). See §18 for
     the HR module and multi-store job pickup architecture.

2. **WASM installable delivery** — each app should be compilable to WASM so it can be:
   - Served from the org's Solid server (no app store needed)
   - Installed to a device's home screen / PWA with offline capability
   - Run client-side with no server round-trip for rendering (the Solid pod is the backend)
   - Options: compile via `wasm-pack` (if Rust-based), or use WASM-based build tools (e.g. `wasm-bindgen`, or Emscripten for existing C/C++ assets). For React/TS apps, a PWA with a WASM-embedded runtime (e.g. Oxigraph WASM for local SPARQL queries) is the pragmatic path — the app shell is a PWA, with WASM modules for heavy client-side work (RDF parsing, SPARQL querying, crypto for VC verification).

3. **Profile-driven availability** — the org's vertical profile determines which apps are available:
   - The IPMS module registry exposes an `orgApps` field on each module manifest (or vertical profile) listing the app IDs that module provides.
   - The admin panel shows available apps based on enabled modules / applied vertical profile.
   - The org's Solid server serves the apps at a discoverable URL (e.g. `https://databox.<apex>/apps/<app-id>/`), advertised via Type Index or `.well-known`.
   - Devices/installations fetch the app from the org's server, not a public app store.

4. **Network-scope policy (WiFi-gated vs remote)** — each app declares a network scope:
   - **`local-only` (WiFi-gated):** the waiter app is only served/usable when connected to the org's WiFi network. Implementation options:
     - The server checks the request origin IP against the org's LAN subnet for app downloads and API calls.
     - The app itself checks connectivity to the local Solid server and refuses to function when the server is unreachable or when the connection is not from the expected network (e.g. checking that the request comes through the org's `devices.<apex>` host or a local IP range).
     - DNS-level: the app is served from a local-only hostname (e.g. `waiter.databox.local`) that is only resolvable on the org's network.
   - **`remote-capable`:** the tradie app is designed for field use — connects to the org's Solid server from anywhere via the internet. Uses Solid-OIDC for authentication, works over the public `databox.<apex>` endpoint.
   - The network scope is declared in the app manifest (an RDF resource) and enforced by both the server (serving) and the client (connectivity check).

5. **App manifest format** — each app has a manifest (RDF, reusing the IPMS module manifest pattern):
   - `appId`, `name`, `version`, `description`
   - `networkScope`: `local-only` | `remote-capable`
   - `requiredModules`: which IPMS modules must be enabled (e.g. waiter requires `pos.ordering`)
   - `verticalProfiles`: which profiles include this app (e.g. `food.restaurant`)
   - `installUrl`: where the WASM/PWA bundle is served
   - `permissions`: what Solid access the app needs (read/write to specific resource types)

6. **Solid integration** — both apps need real Solid client integration (not mock data):
   - Use `@inrupt/solid-client` or `@solid/client` for pod read/write.
   - Authenticate via Solid-OIDC (the org's identity provider).
   - The waiter app reads menu/order data from the pod and writes orders/tickets.
   - The tradie app reads job/work-order data from the pod and writes inspections/quotations.

### 14.3 Severity

- **High** — the client apps are a core part of the org-facing product. The waiter app is embedded in the admin panel (wrong place for a floor worker), and the tradie app has no real Solid integration. The WASM/PWA delivery model, profile-driven availability, and network-scope policy are all new architecture that doesn't exist yet.

---

## 16. Member/Person Solid Pods — Communication & Authority Channel

### 16.1 Current state: no per-person pod infrastructure

- **Issue:** The IPMS models a relationship directory (§5.0 part 2) with typed roles
  (`org:Membership`, `org:Role`) and the databox has opaque person-program
  relationships, but there is no infrastructure for **each organisational member**
  (contractor, employee, director, member, volunteer, referee, etc.) to have their
  **own Solid pod** that serves as their personal communication and authority channel
  with the organisation.

- **What exists:** The org has its own internal pod(s) on `databox.<apex>`. The
  relationship directory stores entries pointing at a person's WebID. But the person's
  pod — where they receive organisational communications, hold their role-issued VCs,
  exercise delegated authority, and interact with the org's governance/workflows — is
  not provisioned or managed by the IPMS.

### 16.2 What needs to be built

1. **Member pod provisioning** — when a directory entry is created (§5.5), the IPMS
   can optionally provision a Solid pod for that person on the org's server (e.g.
   `https://databox.<apex>/<opaque-id>/`) or link to an external pod the person
   already owns. This reuses CSS's existing multi-pod provisioning. The pod is:
   - **Owned by the person** (their WebID is the owner).
   - **WAC-scoped** so the org can write specific resources (inbox, credentials) but
     cannot read everything — the person retains sovereignty.
   - **Discoverable** via the directory entry's WebID profile.

2. **Communication channel (LDN inbox)** — each member pod has an `ldp:inbox`
   (W3C Linked Data Notifications) that the org writes to:
   - **Governance notices** — meeting calls, resolution drafts, voting ballots,
     policy changes.
   - **Work assignments** — job/work-order assignments (tradie), shift schedules
     (waiter), match assignments (referee), appointment bookings (professional
     services).
   - **Credential delivery** — issued VCs (membership card, role credential,
     qualification, ticket, age/ID proof) delivered to the member's pod.
   - **Pay/receipt delivery** — payment receipts, payslips, expense reimbursements
     as RDF resources.
   - **Emergency/break-glass notices** — conditional access alerts (§11 break-glass).

3. **Authority channel (ODRL + VC)** — the member's pod holds the evidence of their
   authority within the org:
   - **Role VCs** — a director holds a `director` role VC; a referee holds a
     `referee` qualification VC; a tradie holds a `contractor` role VC. These are
     presented when exercising authority (approving a payment, filing a match
     report, submitting a quotation).
   - **Delegation grants** — if a member delegates authority (§11 delegation), the
     grant is recorded as an ODRL policy resource in both the delegator's and
     delegate's pods.
   - **Governance resolutions** — resolutions affecting the member (appointments,
     removals, spending limits) are recorded as RDF resources the member can
     reference.

4. **Bidirectional interaction** — the member's pod is not just a mailbox; the
   member writes back:
   - **Match reports** (referee → org), **job completion** (tradie → org),
     **score submissions** (scorekeeper → org), **votes/ballots** (member → org
     governance), **expense claims** (employee → org), **availability/leave
     requests** (employee → org).
   - These are written to the member's pod and notified to the org's inbox via LDN,
     or written directly to an org-owned container the member has scoped write
     access to.

5. **Federated vs org-hosted** — two models:
   - **Org-hosted:** the org provisions and hosts the member's pod on its own
     server. Simplest for a small org (shop, club). The pod is WAC-scoped so the
     org can't read everything, but the org controls availability/backups.
   - **Federated (external):** the member brings their own pod (personal WebID,
     external provider). The org links to it via the directory entry. This is the
     Solid-sovereignty ideal — the person owns their data. The org communicates via
     LDN to the external pod's inbox.
   - The IPMS supports both; the directory entry records which model is in use.

6. **Lifecycle** — when a role ends (employment terminated, membership lapses,
   contract complete), the org's write access to the member's pod is revoked (WAC
   update), but the person retains their pod and any VCs they hold (which may
   expire or be revoked separately). The directory entry is marked as inactive but
   retained (append-only history, §C6).

### 16.3 Severity

- **Medium** — the directory and role model exist in the plan (§5.0/§5.5) but the
  per-person pod infrastructure (provisioning, inbox communication, VC delivery,
  bidirectional workflows, federated vs hosted) is not implemented. This is the
  connective tissue between the org and its people — without it, the IPMS can only
  manage data about people, not interact with them.

---

## 15. Additional Tasks from Plan Review

### 15.1 Website maker — not implemented

- **Plan reference:** `solid-ipms-plan.md` §0, `dynamic-strolling-lerdorf.md` §10.7
- **Issue:** The plan calls for a website maker that pulls back-end "things" (catalogue,
  menu, business info) into public pages with SEO (schema.org JSON-LD, OG tags,
  sitemap.xml, robots.txt). A "public website preview" route exists but does not produce
  live public publishing backed by Solid RDF state.
- **Work needed:** Implement the website maker module with templating, data binding to
  RDF things, SEO output, and a publish pipeline.
- **Severity:** **Medium** — the `www` route is reserved but not served.

### 15.2 Dynamic sidebar not implemented

- **Plan reference:** `dynamic-strolling-lerdorf.md` §5.4
- **Issue:** The smithy-admin sidebar is hardcoded in `components/layout/index.tsx` with
  static `NavLink` entries. The plan calls for a dynamic sidebar rendered from enabled
  modules — a module appears only when enabled, backed by real server state.
- **Work needed:** Fetch enabled modules from the IPMS API and render nav entries
  dynamically.
- **Severity:** **Medium** — core IPMS framework requirement.

### 15.3 Governance module — manifest only

- **Plan reference:** `dynamic-strolling-lerdorf.md` §5.7
- **Issue:** The governance module has a manifest but no route handlers or business
  logic. The plan calls for role→authority bindings, ODRL policy evaluation, approval
  gates/chains, and resolution records.
- **Work needed:** Implement governance route handlers, ODRL evaluation, approval
  workflow, and resolution recording as RDF resources.
- **Severity:** **Medium** — core model pillar (§5.0 part 3).

### 15.4 Credential issuance (VC) — stub

- **Plan reference:** `dynamic-strolling-lerdorf.md` §5.5, §12.2
- **Issue:** The credentials module has a manifest but no VC issuer/verifier
  implementation. The plan calls for membership card VCs, age/ID proof, warranty, ticket,
  qualification credentials.
- **Work needed:** Implement VC issuance (sign RDF, produce JWS), verification (verify
  signature against issuer key), and revocation.
- **Severity:** **Medium** — cross-cuts membership, events, governance.

### 15.5 Device identity (mTLS) — not implemented

- **Plan reference:** `dynamic-strolling-lerdorf.md` §10.2
- **Issue:** The plan calls for a device-auth module with cert provisioning, WebID-TLS
  verification, and a dedicated non-proxied `devices.<apex>` host. The POS edge binary
  exists but does not implement mTLS device verification.
- **Work needed:** Build the device-auth module (TLS listener requesting client certs +
  WebID-TLS verifier), enrolment flow (claim URI → keypair → cert), and the hosting
  module's `devices` DNS record (non-proxied).
- **Severity:** **Medium** — needed for IoT/POS devices.

### 15.6 Payments module — no gateway adapters

- **Plan reference:** `dynamic-strolling-lerdorf.md` §10.5
- **Issue:** The payments module has a manifest but no gateway adapter implementations.
  The plan calls for a `PaymentGateway` adapter pattern (Stripe first), PCI-safe hosted
  fields, webhooks, and receipts as linked data.
- **Work needed:** Implement the gateway interface, Stripe adapter, webhook handler,
  and receipt minting as RDF resources.
- **Severity:** **Medium** — POS depends on it.

### 15.7 Real-time / notifications — not surfaced in admin UI

- **Plan reference:** `dynamic-strolling-lerdorf.md` §10.3
- **Issue:** CSS already implements the Solid Notifications Protocol (WebSocketChannel2023,
  StreamingHTTPChannel2023), but the IPMS admin UI does not surface live resource-change
  streams. No module manages notification channels.
- **Work needed:** Add a notifications module that manages channels and exposes live
  streams to the admin UI and POS/IoT.
- **Severity:** **Low** — infrastructure exists, needs surfacing.

### 15.8 Profile ladder not documented

- **Plan reference:** `solid-ipms-plan.md` §1.1
- **Issue:** The plan calls for a documented profile ladder: basic → +databox → +ipms →
  +modules. No documentation file exists.
- **Severity:** **Low** — documentation.

---

## 17. Print Business App & Inter-Org Print Job Submission

### 17.1 Current state: plan references PRINT use-case but nothing exists

- **Plan reference:** `dynamic-strolling-lerdorf.md` §11 — "Print shop / 3D printing" is
  listed as a validator use-case (PRINT). The plan describes it as inverting the
  ownership flow (customer owns the print file/3D model, their IP), with ODRL usage
  licensing (no-reuse, print-count, delete-after), printers as governed IoT, and a
  jobs/work-order pipeline.
- **What exists:** Nothing. There is no print shop module, no print business client app,
  no inter-org print job submission mechanism, no print job tracking. The plan mentions
  it as a use-case but no code has been written for it.
- **The user's requirement:** a printing business app (an org-mobile-app for the print
  shop) that is also needed **by other organisations** — e.g. a historical society can
  send a print job (documents, flyers, booklets, archival reproductions) to the printing
  business for printing and delivery. This is a **B2B inter-org workflow** mediated by
  Solid pods.

### 17.2 What needs to be built

1. **Print shop IPMS module** — a module for the printing business that provides:
   - **Catalogue of print services** — document printing, large-format, binding,
     3D printing, archival reproduction, with pricing tiers and turnaround times.
   - **Print job intake** — accepts job submissions from other orgs (via LDN inbox or
     a dedicated job-submission endpoint), including:
     - The print file/artwork (uploaded as a binary resource to a pod container, or
       referenced by URL from the customer's pod).
     - Print specifications (paper size, colour/B&W, quantity, binding, finish,
       delivery method).
     - **ODRL usage licence** — the customer's terms on their submitted asset
       (no-reuse, delete-after-fulfilment, print-count limit, no-redistribution).
   - **Job tracking** — the jobs/work-order horizontal (§11) applied to print:
     intake → prepress/proof → print → finish → ready → deliver. Live status via
     notifications (§10.3).
   - **Printer as IoT device** — print devices are governed IoT (§10.2) receiving jobs
     + telemetry. For 3D printers, this is the crispest device instance.
   - **Delivery** — via the delivery horizontal (§10.6): the print job's delivery leg
     is an LDN exchange with a delivery provider, or the print shop's own driver.

2. **Print business client app** (`org-mobile-apps/print-app/`) — an org-mobile-app for
   the print shop operator:
   - **Job queue** — see incoming print jobs, sorted by priority/deadline.
   - **Prepress/proofing** — view the submitted file, approve or request changes.
   - **Print dispatch** — send the job to a specific printer device, track progress.
   - **Delivery management** — mark jobs as ready, arrange delivery, notify customer.
   - **Customer communication** — LDN-based messaging with the customer org.
   - Network scope: `local-only` when operating the printers in-shop; `remote-capable`
     for monitoring job queue off-site.

3. **Inter-org print job submission** — the mechanism for **other organisations** (e.g.
   a historical society, a club, a business) to send print jobs to the printing business:
   - **Directory relationship** — the printing business is a directory entry (§5.0(2))
     in the customer org's relationship directory, typed as `supplier` / `print-provider`.
   - **Job submission via LDN** — the customer org writes a print job (RDF: schema.org
     `Order` + print specifications + ODRL licence on the asset) to the print shop's
     `ldp:inbox`. The print file is either:
     - **Attached** as a binary in the customer's pod, with a WAC grant to the print
       shop's WebID for download.
     - **Federated** — the file stays in the customer's pod, the print shop fetches it
       with scoped access (the customer grants read access for the duration of the job,
       then revokes).
   - **Quote/approval exchange** — the print shop responds with a quote (RDF `Offer`),
     the customer accepts (RDF `OrderConfirmation`), the print shop produces a proof
     (binary resource + notification), the customer approves (LDN message).
   - **Fulfilment** — the print shop prints, packs, and delivers. The delivery status
     flows back via LDN/notifications. The customer receives a receipt (RDF `Invoice`
     at `PaymentComplete`).
   - **Asset lifecycle** — after fulfilment, the print shop deletes the customer's file
     per the ODRL licence (delete-after), or retains it if the licence permits. The
     WAC grant is revoked.

4. **Print vertical profile** — a `print.shop` vertical profile that bundles:
   - Print shop module (catalogue + job intake + tracking + printer IoT)
   - Jobs/work-order horizontal
   - Delivery horizontal
   - Payments (for invoicing)
   - Usage licensing (ODRL on customer assets)
   - Print business client app

5. **Historical society example** — a concrete use case:
   - The historical society has its own Solid pod with archival documents, event flyers,
     membership forms.
   - It needs 200 copies of a heritage booklet printed and delivered for an event.
   - The society's admin opens their IPMS, selects the print provider from their
     directory, submits the print job (booklet PDF + specifications + ODRL "no-reuse,
     delete-after-fulfilment" + delivery address).
   - The print shop receives the job in their print-app job queue, sends a quote, the
     society accepts, the shop prints and delivers, the society receives a receipt.
   - The print file is deleted from the shop's access after fulfilment per the ODRL
     terms.

### 17.3 Severity

- **Medium** — the plan identifies the PRINT use-case but no implementation exists. The
  print business app is needed both as a standalone vertical and as a **B2B service**
  that other orgs consume. The inter-org job submission via Solid pods (LDN + WAC +
  ODRL) is a new workflow pattern that generalises to other B2B service relationships
  (not just printing).

---

## 18. HR Module & Delivery Driver App — Multi-Store Job Pickup

### 18.1 Current state: no HR module, no delivery driver app

- **Plan reference:** `dynamic-strolling-lerdorf.md` §10.6 describes delivery as a
  directory relationship + LDN exchange, and §11 lists delivery drivers implicitly
  under the food/delivery use-case. The plan's §12.2 Group B lists "Directory &
  relationships" and "Credential issuance" but does not call out an HR-specific module.
- **What exists:** Nothing for HR or delivery driver management. The delivery horizontal
  (§10.6) is a seam only. There is no:
  - HR module for managing employees/contractors (onboarding, roles, shifts, compliance)
  - Delivery driver management (driver directory entries, vehicle info, licence/VC
    verification, availability scheduling)
  - Multi-store job pickup mechanism (a driver picking up delivery jobs from multiple
    food retailers / take-away stores, not just one)
  - Delivery driver client app

### 18.2 What needs to be built

1. **HR module** — a IPMS module for managing the org's workforce, covering:
   - **Employee/contractor onboarding** — creates a directory entry (§5.0(2)) + provisions
     a member pod (§16) with role VC, employment contract (ODRL Agreement + DPV legal
     basis), tax/banking details (stored securely, not in the pod).
   - **Role & shift management** — assigns roles (driver, cook, waiter, manager),
     manages shift schedules, availability/leave requests (written from member pod →
     org inbox via LDN).
   - **Compliance & credentials** — tracks required credentials (driver's licence, food
     safety cert, working with children check, police check) as VCs. Uses
     minimal-disclosure verification (§11) — the org verifies "licence valid" without
     storing the raw document. Credentials expire → system alerts for renewal.
   - **Payroll integration** — links to the payments module (§15.6) for payslips,
     contractor invoicing, expense reimbursement. Payslips delivered as RDF resources
     to the member's pod.
   - **Performance & incident records** — append-only longitudinal records (§11) for
     performance reviews, incidents, warnings. Owner-controlled by the org but
     referenceable by the employee.

2. **Delivery driver management** (HR module sub-module or delivery module extension):
   - **Driver directory entries** — typed as `delivery-driver` role in the directory,
     with vehicle details (vehicle type, registration, capacity), supported delivery
     zones, and availability schedule.
   - **Driver credentials** — driver's licence VC, vehicle registration VC, insurance
     proof VC. Verified via minimal-disclosure (valid/invalid + expiry, not the raw
     document).
   - **Driver pod** — the driver's member pod (§16) receives:
     - **Job assignments** — delivery jobs as LDN notifications (pickup location,
       drop-off address, items, deadline, special instructions).
     - **Route/order details** — the order's RDF resource (schema.org `Order` with
       items, pickup/dropoff, customer contact preferences).
     - **Status updates** — the driver writes back: accepted → picked up → in transit →
       delivered (or failed/returned), each as an LDN notification to the dispatching
       org's inbox.
   - **Multi-store job pickup** — a driver is not bound to a single store. The driver
     can pick up delivery jobs from **multiple orgs** (e.g. multiple take-away
     restaurants on the same platform/marketplace, or independent orgs the driver has
     a delivery relationship with). Mechanism:
     - Each store that offers delivery has the driver as a `delivery-driver` directory
       entry (or the driver is registered on a marketplace/platform that multiple
       stores subscribe to).
     - The driver's app aggregates job notifications from all stores the driver is
       registered with — a unified job queue across multiple orgs.
     - The driver accepts/rejects jobs from any registered store. Accept creates an
       ODRL obligation (deliver by deadline) between the driver and that store.
     - **Marketplace/multi-tenant case** (§11 #21): a food delivery platform (multi-tenant
       IPMS) has multiple take-away stores as tenant orgs. Drivers register with the
       platform, not individual stores. The platform dispatches jobs from any tenant
       store to available drivers. Driver earnings are split per job with platform fee
       (escrow/split payments, §10.5).
     - **Independent/federated case**: a driver has their own pod and is independently
       registered with multiple stores' IPMS instances. Each store sends job offers via
       LDN to the driver's pod inbox. The driver's app federates across all connected
       stores.

3. **Delivery driver client app** (`org-mobile-apps/driver-app/`) — an org-mobile-app:
   - **Unified job queue** — aggregates delivery jobs from all registered stores/
     platforms. Shows pickup location, drop-off, items, deadline, earnings.
   - **Job acceptance/rejection** — accept creates obligation, reject passes to next
     driver.
   - **Navigation** — pickup → dropoff routing (integrates with maps; the address comes
     from the order RDF resource).
   - **Status updates** — one-tap status: picked up, in transit, delivered, failed.
     Each writes to the driver's pod and notifies the store via LDN.
   - **Earnings dashboard** — tracks completed jobs, earnings per store/platform,
     payout status.
   - **Customer communication** — in-app messaging with the customer (via LDN or
     Solid notifications), no phone number exchange (privacy-preserving).
   - Network scope: `remote-capable` (drivers are in the field, using mobile data).

4. **Multi-store dispatch logic** — for the marketplace/platform case:
   - A store marks an order as "ready for delivery" → the platform's dispatch engine
     finds available drivers registered for that store's delivery zone → sends job
     offers via LDN to the top N drivers → first to accept gets the job.
   - Dispatch rules: proximity, zone, driver capacity (bike vs car), current workload,
     driver rating (portable reputation, §11).
   - The dispatch engine is a IPMS module (or part of the delivery module) that runs on
     the platform's server, reading driver availability from driver pods and order
     status from store pods.

5. **HR vertical profile** — an `hr.workforce` vertical profile (or horizontal that
   composes with any vertical) that bundles:
   - HR module (onboarding, roles, shifts, compliance, payroll)
   - Directory & relationships (employee/contractor entries)
   - Member pods (§16) for workforce communication
   - Credential issuance & verification (role VCs, compliance VCs)
   - Payments (payslips, contractor invoicing)
   - Delivery driver app (if the org has delivery drivers)

### 18.3 Severity

- **Medium** — HR is a core operational need for any org with employees/contractors.
  The delivery driver multi-store job pickup is specifically called out as important
  for food/take-away verticals. The driver app is a new org-mobile-app that doesn't
  exist. The multi-store federated dispatch pattern is new architecture that also
  applies to other multi-org service relationships (not just food delivery).

---

## 19. Updated Recommended Priority Order

1. **Fix the control token CSPRNG** (5.4) — security credential with weak randomness.
2. **Implement Node.js provisioning** (5.1) — installer is useless without it.
3. **Implement app extraction** (5.2) — installer is useless without it.
4. **Implement Cloudflare API integration** (11.1) — hosting module is half-built.
5. **Build the food-allergy / ingredient system** (12) — core use case, nothing exists
   server-side.
6. **Implement real ODBC and LDAP connectors with interactive mapping app** (13) —
   sidecars are non-functional, mapping UI is needed.
7. **Establish org-mobile-apps architecture** (14) — extract waiter app, move tradie
   app, add WASM/PWA delivery, profile-driven availability, network-scope policy.
8. **Implement member/person Solid pods** (16) — per-person pod provisioning, LDN
   inbox communication, VC delivery, bidirectional workflows, federated vs org-hosted.
9. **Build print business app & inter-org print job submission** (17) — print shop
   module, print-app (org-mobile-app), B2B job submission via LDN + WAC + ODRL.
10. **Build HR module & delivery driver app** (18) — workforce management, driver
    directory/credentials, multi-store job pickup (marketplace + federated), driver-app
    (org-mobile-app, remote-capable).
11. **Remove `@ts-nocheck` from smithy-admin pages** (3) — type safety across the entire
   admin UI.
12. **Wire `ui#` shapes to module manifests** (6.2) and **connect `UiFormRenderer` to
   modules page** (6.3) — completes the form rendering pipeline.
13. **Implement crypto bootstrap** (5.3) — server can't start without signing keys.
14. **Fix `ConnectorSidecar` ESM compatibility** (2.4) — will break under ESM.
15. **Implement dynamic sidebar** (15.2) — core IPMS framework requirement.
16. **Implement governance module** (15.3) — core model pillar.
17. **Implement credential issuance (VC)** (15.4) — cross-cuts multiple modules.
18. **Implement payments gateway adapters** (15.6) — POS and payroll depend on it.
19. **Implement device identity (mTLS)** (15.5) — needed for IoT/POS devices.
20. **Implement website maker** (15.1) — the `www` route is reserved but not served.
21. **Add tests** (8.1–8.4) — coverage gate compliance and native code safety.
22. **Implement remaining IPMS modules** (6.1) — per the plan's phasing, pass 2+.
23. **Add `docker-compose.yml`** (11.3) — containerized deployments.
24. **Surface notifications in admin UI** (15.7) — infrastructure exists, needs UI.
25. **Clean up Rust warnings** (5.8) and **add fullscreen** (5.9) — polish.
26. **Document profile ladder** (15.8) — documentation.
