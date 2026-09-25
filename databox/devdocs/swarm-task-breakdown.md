# Swarm Task Breakdown — Implementation by Agent Swarms

> Maps every gap-analysis item to a concrete, assignable agent task with phase,
> dependencies, model tier, and verification gates. Follows the execution model
> from `solid-ipms-plan.md` §13 and `dynamic-strolling-lerdorf.md` §13.
>
> **Gap analysis reference:** `databox/devdocs/gap-analysis.md` (§numbers cited below).

---

## Execution rules (apply to every task)

1. **Four invariants** checked on every task: (1) opt-in profile (basic install
   untouched); (2) capability modes (portable-core vs enhanced + degradation);
   (3) declarative-first (logic as RDF, engine thin); (4) vanilla-Solid (protocol
   conformance, standard vocabs, no invented dialect).
2. **Per-task verification:** `build + lint + tsc(src+test) + tests + 80% branch coverage +
   vanilla-Solid conformance test + adversarial checker agent`. (100% branch coverage
   is a Phase 9 cleanup target — don't block feature delivery on first pass.)
3. **Repo env:** Node 24.18.0 via nvm; `--maxWorkers=2`; `rm -f .eslintcache`;
   `export PATH="/c/nvm4w/nodejs:$PATH"` before node/npm commands.
4. **Per-phase gate:** all tasks green + cross-module integration test + adversarial
   review panel + Timothy checkpoint before next phase opens.
5. **Model tiering:** Opus/high for correctness-critical; Sonnet/medium for standard
   modules; Haiku/low for mechanical/config/test scaffolds.
6. **Traceability:** every task cites the gap-analysis §number it addresses.
7. **Fix-and-report (mandatory):** if an agent discovers a problem in existing code
   (a bug, a broken import, a type error, a stale reference, a missing dependency,
   a test that fails for the wrong reason, a security issue, a deviation from the
   four invariants) **the agent must fix it** — not leave it, not comment it out,
   not add a TODO. The fix is part of the task. The agent then reports the fix in
   its task report (see rule 9). This applies to:
   - Bugs in the files the agent is editing or depends on.
   - Bugs discovered incidentally while reading code (e.g. a wrong import path, a
     stale type, a missing error handler).
   - Test failures that are not caused by the agent's own work-in-progress.
   - Security issues (e.g. unsanitised input, hardcoded secrets, missing auth check).
   - Invariant violations in existing code (e.g. a module that bypasses the opt-in
     profile, a feature that invents a non-standard Solid dialect).
   **Scope guard:** the agent fixes the problem in the minimal correct way. If the
   fix is large (would change >100 lines or touch >3 files outside the task scope),
   the agent documents it as a **discovered issue** in the task report (rule 9) with
   a recommended fix, and creates a follow-up task entry in the report — but still
   fixes small/in-scope problems immediately.
8. **No broken state:** an agent must never leave the repo in a state where `tsc`,
   `lint`, or `test` fails due to the agent's changes. If a pre-existing failure
   exists (not caused by the agent), the agent fixes it (rule 7) or documents it
   (rule 9) — but never makes it worse.
9. **Task report (mandatory, every task):** each agent must produce a structured
   report at task completion. The report is appended to
   `databox/devdocs/swarm-reports/<phase>-<task-id>.md`. Format:

   ```markdown
   # Task Report: <Task ID> — <short description>

   **Status:** completed | partially-completed | blocked
   **Phase:** <phase number>
   **Gap-analysis §:** <section number>
   **Model used:** <opus/sonnet/haiku>
   **Time:** <duration or token estimate>

   ## What was done
   - <bullet list of changes made, with file paths>

   ## Fixes applied to existing code
   - **[FIX]** <file>:<line> — <what was broken> → <what was fixed>
   - (or "None — no issues found in scope.")

   ## Discovered issues (not fixed — out of scope)
   - **[ISSUE]** <file>:<line> — <description> — **Recommended fix:** <description>
     — **Suggested follow-up task:** <description>
   - (or "None.")

   ## Tests
   - **New tests added:** <list>
   - **Existing tests updated:** <list>
   - **Test results:** <pass/fail counts>
   - **Coverage:** <percentage for new/changed branches>

   ## Invariant check
   - (1) Opt-in profile: <pass/fail + notes>
   - (2) Capability modes: <pass/fail + notes>
   - (3) Declarative-first: <pass/fail + notes>
   - (4) Vanilla-Solid: <pass/fail + notes>

   ## Verification
   - `tsc --noEmit`: <pass/fail>
   - `eslint`: <pass/fail>
   - `jest`: <pass/fail>
   - `cargo test` (if Rust): <pass/fail>

   ## Notes for downstream agents
   - <anything the next agent in the dependency chain needs to know>
   ```

10. **Cross-task issue propagation:** when an agent discovers an issue that affects
    other tasks (e.g. a shared interface change, a broken dependency, a missing
    export), the agent:
    - Fixes it if in scope (rule 7).
    - Documents it in the task report (rule 9).
    - If the issue blocks a downstream task, marks the task report status as
      `partially-completed` and notes the blocker explicitly in "Notes for downstream
      agents" so the swarm coordinator can re-route or add a fix task.

11. **Accessibility (WAI-ARIA + WCAG 2.1 AA, mandatory on every UI task):** every
    agent that creates or modifies UI (smithy-admin pages, org-mobile-apps, customer
    display, website maker, public site) must:
    - Use **semantic HTML** (`<nav>`, `<main>`, `<section>`, `<button>`, `<label>`)
      not `<div>` + `onClick` for interactive elements.
    - Add **WAI-ARIA** attributes where semantic HTML is insufficient: `aria-label`,
      `aria-describedby`, `aria-live` (for dynamic updates like POS order status),
      `aria-expanded`/`aria-controls` (for accordions/menus), `role` where the element
      is repurposed.
    - Ensure **keyboard navigation**: every interactive element is reachable via Tab,
      focus order is logical, `:focus-visible` styles are present, no keyboard traps.
    - Ensure **colour contrast** meets WCAG 2.1 AA (4.5:1 for normal text, 3:1 for
      large text). The theming token engine (§12.5) must enforce contrast tokens.
    - Add **`alt` text** for all images/icons that convey information. Decorative
      images get `alt=""`.
    - Use **`<html lang="...">`** and `lang` attributes on language-switched content.
    - Test with a screen reader (NVDA/VoiceOver) for critical flows: login, POS order
      entry, hosting wizard, module config forms.
    - The agent reports accessibility compliance in the task report under a new
      **"Accessibility check"** section:
      ```
      ## Accessibility check
      - Semantic HTML: <pass/fail + notes>
      - WAI-ARIA: <pass/fail + notes>
      - Keyboard nav: <pass/fail + notes>
      - Colour contrast: <pass/fail + notes>
      - Screen reader tested: <yes/no + which reader>
      ```
    - **Scope guard:** if an agent is working on a non-UI task (server-side only,
      Rust, config), it marks the accessibility section as "N/A — no UI changes."

12. **Internationalisation / multilingual (i18n, mandatory on every UI task):** every
    agent that creates or modifies UI must build for multilingual support from the
    start — not retrofit it later:
    - **No hardcoded user-facing strings.** All visible text (labels, buttons,
      messages, errors, tooltips, page titles) must use an i18n function:
      `t('key')` / `useTranslation()` (e.g. `react-i18next`, `react-intl`, or a
      lightweight custom resolver). Strings are defined in locale files, not inline.
    - **Locale files:** `src/locales/<lang>.json` (e.g. `en.json`, `es.json`,
      `fr.json`, `de.json`, `zh.json`, `ar.json`, `ja.json`). The default locale is
      `en`; the app ships with `en` and is structured so additional locales are
      drop-in.
    - **RTL support:** CSS must use logical properties (`margin-inline-start`,
      `padding-inline-end`, `text-align: start`) not physical ones (`margin-left`,
      `text-align: left`). The `dir` attribute on `<html>` drives layout direction.
      Arabic/Hebrew locales set `dir="rtl"`.
    - **Date/time/number formatting:** use `Intl.DateTimeFormat`,
      `Intl.NumberFormat` with the user's locale — never hardcoded formats.
    - **Pluralisation:** use the i18n library's plural rules (e.g. `t('items', {
      count: n })`), not manual `if (count === 1)`.
    - **Language switching:** a language selector in the admin shell and each
      org-mobile-app. The selected locale persists to the user's pod profile
      (§16 person-owned profile) or local storage for anonymous users.
    - **Server-side messages:** error messages from the IPMS API must include a
      message key (e.g. `"error.hosting.invalid_domain"`) alongside the English
      fallback, so the client can localise.
    - The agent reports i18n compliance in the task report:
      ```
      ## i18n check
      - No hardcoded strings: <pass/fail>
      - Locale files created/updated: <list>
      - RTL-safe CSS: <pass/fail + notes>
      - Intl formatting used: <pass/fail>
      - Pluralisation: <pass/fail>
      ```

---

## Phase 0 — Foundations & Critical Fixes (sequential, Opus)

> Must complete before any other phase. Security-critical and foundational.

| Task ID | Gap § | Description | Model | Deps | Files |
|---------|-------|-------------|-------|------|-------|
| P0-01 | 5.4 | ~~Fix control token CSPRNG in installer~~ **COMPLETED** — `config.rs` uses `rand::rng().fill_bytes()` with `rand 0.9`. | Opus | — | `native/installer/src/config.rs`, `native/installer/Cargo.toml` |
| P0-02 | 5.1 | ~~Implement Node.js provisioning in installer~~ **COMPLETED** — `node.rs` has full download, SHA-256 verify, tar.xz/zip extraction. | Opus | P0-01 | `native/installer/src/node.rs`, `native/installer/Cargo.toml` |
| P0-03 | 5.2 | ~~Implement app extraction in installer~~ **COMPLETED** — `deploy.rs` copies source + Rust binaries with SHA-256 checksum verification. | Opus | P0-02 | `native/installer/src/deploy.rs` |
| P0-04 | 5.3 | ~~Implement crypto bootstrap in installer~~ **COMPLETED** — `config.rs` generates RSA keypair via Node, sets dir permissions. | Opus | P0-02 | `native/installer/src/config.rs` |
| P0-05 | 5.5 | ~~Implement Windows privilege check~~ **COMPLETED** — `preflight.rs` uses `net session` for admin detection. | Sonnet | P0-01 | `native/installer/src/preflight.rs` |
| P0-06 | 5.6 | ~~Fix installer timestamp~~ **COMPLETED** — `handoff.rs` uses `chrono::Utc::now()` ISO 8601. | Haiku | P0-01 | `native/installer/src/handoff.rs` |
| P0-07 | 2.4 | ~~Fix `ConnectorSidecar` ESM compatibility~~ **COMPLETED** — uses `import.meta.url` check. | Sonnet | — | `src/databox/ipms/sidecars/ConnectorSidecar.ts` |
| P0-08 | new | ~~Set up i18n infrastructure~~ **COMPLETED** — `i18n.ts` provider with `i18next` + `react-i18next`, `en.json` with 238 keys, wired in `main.tsx`. | Sonnet | — | `smithy-admin/src/i18n.ts`, `smithy-admin/src/locales/en.json`, `smithy-admin/src/main.tsx`, `smithy-admin/package.json` |
| P0-09 | new | ~~Set up accessibility baseline~~ **COMPLETED** — `eslint.config.js` has `eslint-plugin-jsx-a11y` recommended rules, `index.css` has `:focus-visible` + `.skip-to-content` + `.sr-only`, `App.tsx` has skip link + `aria-live` region. | Sonnet | — | `smithy-admin/eslint.config.js`, `smithy-admin/src/index.css`, `smithy-admin/src/App.tsx` |

**Phase 0 gate:** Installer builds and runs end-to-end on Windows (privilege check,
Node download, app extraction, crypto bootstrap, config generation). Connector sidecar
runs under ESM. i18n provider wired into smithy-admin with `en.json` locale.
`eslint-plugin-jsx-a11y` active. All existing tests pass.

---

## Phase 1 — Cloudflare Hosting Completion (sequential, Opus→Sonnet)

> The hosting module is the first IPMS module and is half-built.

| Task ID | Gap § | Description | Model | Deps | Files |
|---------|-------|-------------|-------|------|-------|
| P1-01 | 11.1 | ~~Add Cloudflare API client~~ **COMPLETED** — CloudflareApi with zone lookup, DNS records, tunnel creation, ingress rules. | Opus | P0-07 | `src/databox/ipms/modules/hosting/CloudflareApi.ts` |
| P1-02 | 11.1 | ~~Add POST /hosting/apply endpoint~~ **COMPLETED** — HostingApi with apply route calling CloudflareApi. | Opus | P1-01 | `src/databox/ipms/modules/hosting/HostingApi.ts` |
| P1-03 | 11.1 | ~~Add POST /hosting/persist endpoint~~ **COMPLETED** — Persist route generates Turtle RDF. | Sonnet | P1-02 | `src/databox/ipms/modules/hosting/HostingApi.ts` |
| P1-04 | 11.1 | ~~Add POST /hosting/bind endpoint~~ **COMPLETED** — Bind route generates TenantBinding Turtle. | Sonnet | P1-03 | `src/databox/ipms/modules/hosting/HostingApi.ts` |
| P1-05 | 11.1 | ~~Generate cloudflared config~~ **COMPLETED** — `generateCloudflaredConfig` in HostingConfig.ts. | Sonnet | P1-01 | `src/databox/ipms/modules/hosting/HostingConfig.ts` |
| P1-06 | 11.2 | ~~Update smithy-admin hosting page~~ **COMPLETED** — Hosting page with token input, apply, persist, artifact download. | Sonnet | P1-02 | `smithy-admin/src/pages/hosting/index.tsx` |
| P1-07 | 11.3 | ~~Create docker-compose.yml~~ **COMPLETED** — IPMS container + /data volume + env/secrets + health check. | Haiku | — | `docker-compose.yml` |

**Phase 1 gate:** Hosting wizard computes plan → user enters Cloudflare token → DNS
records created → tunnel configured → config persisted as RDF → origin bound as
TenantBinding. Fallback path generates downloadable artifacts. Docker compose boots
IPMS. All tests pass.

---

## Phase 2 — Core Entity & People Infrastructure (mostly sequential, Opus→Sonnet)

> The connective tissue between org and its people.

| Task ID | Gap § | Description | Model | Deps | Files |
|---------|-------|-------------|-------|------|-------|
| P2-01 | 15.3 | ~~Implement governance module~~ **COMPLETED** — Role binding, ODRL policy, approval gate, resolution routes. | Opus | — | `src/databox/ipms/modules/governance/` |
| P2-02 | 15.4 | ~~Implement credential issuance (VC)~~ **COMPLETED** — VC issuer, verifier, revocation routes. | Opus | — | `src/databox/ipms/modules/credentials/` |
| P2-03 | 16 | ~~Implement member/person pod provisioning~~ **COMPLETED** — Pod creation, WebID profile, inbox/outbox, org binding. | Opus | — | `src/databox/ipms/modules/profile/MemberPod.ts` |
| P2-04 | 16 | ~~Implement LDN inbox communication~~ **COMPLETED** — LDN notification builder, inbox container, send notification. | Sonnet | P2-03 | `src/databox/ipms/modules/profile/LdnInbox.ts` |
| P2-05 | 16 | ~~Implement bidirectional member interaction~~ **COMPLETED** — sendToMember, sendToOrganisation, access grant. | Sonnet | P2-04 | `src/databox/ipms/modules/profile/MemberInteraction.ts` |
| P2-06 | 16 | ~~Implement member pod lifecycle~~ **COMPLETED** — Suspend, reactivate, revoke with audit records. | Sonnet | P2-03 | `src/databox/ipms/modules/profile/MemberPod.ts` |
| P2-07 | 15.2 | ~~Implement dynamic sidebar~~ **COMPLETED** — sidebar renders from IPMS module manifests. | Sonnet | — | `smithy-admin/src/components/layout/index.tsx` |
| P2-08 | 3 | ~~Remove `@ts-nocheck` from all smithy-admin pages~~ **COMPLETED** — no `@ts-nocheck` directives remained; all 79 type errors across 20 files fixed (unused React imports, useUpdate wrapper, N3 parser typing, DataProvider generic casts, RdfTerm guards, erasableSyntaxOnly). `tsc --noEmit` passes clean. | Sonnet | — | `smithy-admin/src/pages/**/*.tsx`, `smithy-admin/src/providers/*.ts`, `smithy-admin/src/hooks/useUpdate.ts` (new), `smithy-admin/src/components/ui-form/parseUiShape.ts` |

**Phase 2 gate:** A governed entity with a directory can issue/verify VCs. Members
have pods with LDN inboxes. Org sends a governance notice → member receives it in
their pod → member votes → org receives vote. Dynamic sidebar reflects enabled
modules. All smithy-admin pages pass TypeScript checking.

---

## Phase 3 — Food Allergy / Ingredient System (sequential, Opus)

> Core food-safety use case — nothing exists server-side.

| Task ID | Gap § | Description | Model | Deps | Files |
|---------|-------|-------------|-------|------|-------|
| P3-01 | 12 | ~~Define allergen/ingredient ontology~~ **COMPLETED** — FSANZ/EU allergen categories (10), dietary restrictions (9), schema.org JSON-LD with DPV legal basis. | Opus | — | `src/databox/ipms/modules/allergy-profile/AllergyProfile.ts` |
| P3-02 | 12 | ~~Implement consumer allergy/dietary profile module~~ **COMPLETED** — Person-owned profile with allergens, dietary restrictions, accessibility needs. | Opus | P3-01, P2-03 | `src/databox/ipms/modules/allergy-profile/AllergyProfile.ts` |
| P3-03 | 12 | ~~Implement retailer ingredient declaration module~~ **COMPLETED** — Ingredient declarations with allergen content, may-contain, free-from, vegan/vegetarian flags. | Opus | P3-01 | `src/databox/ipms/modules/allergy-profile/IngredientDeclaration.ts` |
| P3-04 | 12 | ~~Implement allergen matching engine~~ **COMPLETED** — Cross-references consumer allergens against ingredient declarations. Batch matching, dietary violation detection. | Opus | P3-02, P3-03 | `src/databox/ipms/modules/allergy-profile/AllergenMatcher.ts` |
| P3-05 | 12 | ~~Implement selective disclosure for secret ingredients~~ **COMPLETED** — Attestation-based allergen safety check without revealing full recipe. | Opus | P3-04, P2-02 | `src/databox/ipms/modules/allergy-profile/AllergenMatcher.ts` |
| P3-06 | 12 | ~~Create `food.allergy-safety` vertical profile~~ **COMPLETED** — Bundles allergy-profile, menu, catalogue, pos, notifications, credentials modules. | Sonnet | P3-04, P3-05 | `src/databox/ipms/VerticalProfile.ts` |
| P3-07 | 12 | ~~Integrate allergen filtering into POS~~ **COMPLETED** — Replaced hardcoded allergen array with FSANZ_ALLERGEN_CATEGORIES (10 categories) in customer self-order page. | Sonnet | P3-04 | `smithy-admin/src/pages/pos/allergens.ts`, `pages/pos/customer.tsx` |

**Phase 3 gate:** Consumer shares allergy profile with retailer → retailer's menu is
filtered to show only safe items → secret ingredients are checked via attestation VC
without disclosure → POS and waiter pages show real allergen data. All tests pass.

---

## Phase 4 — Enterprise Connectors & Interactive Mapping (parallel, Opus→Sonnet)

> ODBC & LDAP sidecars with interactive mapping apps.

| Task ID | Gap § | Description | Model | Deps | Files |
|---------|-------|-------------|-------|------|-------|
| P4-01 | 13 | ~~Implement real ODBC connector~~ **COMPLETED** — Dynamic import of `odbc` package, connection pooling, parameterised queries, timeout handling, schema browsing, streaming. 4 tests. | Opus | P0-07 | `src/databox/ipms/sidecars/OdbcConnector.ts` |
| P4-02 | 13 | ~~Implement real LDAP connector~~ **COMPLETED** — Dynamic import of `ldapjs` package, bind/search/unbind, connection error handling, attribute mapping, schema browsing. 3 tests. | Opus | P0-07 | `src/databox/ipms/sidecars/LdapConnector.ts` |
| P4-03 | 13 | ~~Implement R2RML/RML mapping engine~~ **COMPLETED** — `RdfMapper.ts` with subject IRI templates, class mapping, predicate-column/constant mappings, language tags, datatypes, URI refs. Turtle + JSON-LD output. Parse + serialize. 10 tests. | Opus | P4-01, P4-02 | `src/databox/ipms/sidecars/RdfMapper.ts` |
| P4-04 | 13 | ~~Build interactive mapping app~~ **COMPLETED** — `MappingBuilder` page in smithy-admin: source config (ODBC/LDAP), schema browsing, field mapping UI, subject IRI template, RDF class, preview, save. | Sonnet | P4-03 | `smithy-admin/src/pages/mappings/builder.tsx` |
| P4-05 | 13 | ~~Wire connector sidecar execution~~ **COMPLETED** — `ConnectorSidecar.ts` loads R2RML/RML mapping, connects to source, executes query, applies mapping, outputs JSON-LD. | Sonnet | P4-03 | `src/databox/ipms/sidecars/ConnectorSidecar.ts` |

**Phase 4 gate:** Operator connects to ODBC source → browses tables/columns → maps
fields to RDF predicates → previews output → saves mapping → runs sync → RDF
committed to pod. Same flow for LDAP. No mock data.

---

## Phase 5 — Org Mobile Apps Architecture (parallel, Sonnet)

> Extract, restructure, and build all org-facing client apps.

| Task ID | Gap § | Description | Model | Deps | Files |
|---------|-------|-------------|-------|------|-------|
| P5-01 | 14 | ~~Create `org-mobile-apps/` directory structure + app manifest format~~ **COMPLETED** — Unified WASM container architecture with OrgAppManifest module (app profiles, per-install licence VCs, network scope enforcement, container boot config). 5 API routes, 26 tests. | Sonnet | — | `src/databox/ipms/OrgAppManifest.ts`, `org-mobile-apps/` |
| P5-02 | 14 | ~~Extract waiter app into standalone container profile~~ **COMPLETED** — Waiter app profile defined as RDF manifest (local-only, menu/pos/bookings modules). Container shell built. | Sonnet | P5-01, P2-03 | `org-mobile-apps/profiles/waiter-app.ttl`, `org-mobile-apps/container/` |
| P5-03 | 14 | ~~Move tradie app to org-mobile-apps~~ **COMPLETED** — Tradie app profile defined as RDF manifest (remote-capable, jobs/quotations/records modules). | Sonnet | P5-01, P2-03 | `org-mobile-apps/profiles/tradie-app.ttl` |
| P5-04 | 14 | ~~Build delivery driver app~~ **COMPLETED** — Driver app profile defined as RDF manifest (remote-capable, driver-management/payments modules). | Sonnet | P5-01, P2-04 | `org-mobile-apps/profiles/driver-app.ttl` |
| P5-05 | 14 | ~~Build print business app~~ **COMPLETED** — Print app profile defined as RDF manifest (local-only, print/quotations/payments modules). | Sonnet | P5-01 | `org-mobile-apps/profiles/print-app.ttl` |
| P5-06 | 14 | ~~Build sports scorekeeper app~~ **COMPLETED** — Scorekeeper app profile defined as RDF manifest (local-only, events/records modules). | Sonnet | P5-01 | `org-mobile-apps/profiles/scorekeeper-app.ttl` |
| P5-07 | 14 | ~~Build sports referee app~~ **COMPLETED** — Referee app profile defined as RDF manifest (remote-capable, events/records modules). | Sonnet | P5-01 | `org-mobile-apps/profiles/referee-app.ttl` |
| P5-08 | 14 | ~~Implement WASM/PWA delivery for all apps~~ **COMPLETED** — Unified container with Vite + vite-plugin-pwa, service worker, dynamic module loader. Single container serves all app profiles. | Opus | P5-02..07 | `org-mobile-apps/container/vite.config.ts`, `container/src/sw.ts`, `container/src/loader.ts` |
| P5-09 | 14 | ~~Implement profile-driven availability~~ **COMPLETED** — Container boot config filters UI modules by org's enabled modules + licence permissions. IPMS org-apps module registered. | Sonnet | P5-01, P5-08 | `src/databox/ipms/OrgAppManifest.ts`, `BuiltInModules.ts` |
| P5-10 | 14 | ~~Implement network-scope enforcement~~ **COMPLETED** — checkNetworkScope function with CIDR matching for local-only apps, service worker integration. | Opus | P5-09 | `src/databox/ipms/OrgAppManifest.ts`, `org-mobile-apps/container/src/sw.ts` |

**Phase 5 gate:** Waiter app works on venue WiFi, refuses to load off-network. Tradie
app works remotely. Driver app aggregates jobs from multiple stores. All apps
installable as PWA from org's server. Admin panel shows only apps relevant to the
org's vertical profile.

---

## Phase 6 — HR, Print Business & B2B Workflows (parallel, Sonnet)

> HR module, print business module, inter-org B2B job submission.

| Task ID | Gap § | Description | Model | Deps | Files |
|---------|-------|-------------|-------|------|-------|
| P6-01 | 18 | ~~Implement HR module~~ **COMPLETED** — Onboarding, shift assignment, compliance tracking, payslip generation, expense claims. 5 routes, 12 tests. | Opus | P2-01, P2-02, P2-03 | `src/databox/ipms/modules/hr/` |
| P6-02 | 18 | ~~Implement HR payroll integration~~ **COMPLETED** — Payslip generation with deduction validation, expense claim submission. Included in P6-01. | Sonnet | P6-01, P7-01 | `src/databox/ipms/modules/hr/Hr.ts` |
| P6-03 | 18 | ~~Implement delivery driver management~~ **COMPLETED** — Driver registration with zones/availability, job offers, status tracking, dispatch matching. 4 routes, 11 tests. | Sonnet | P6-01, P2-04 | `src/databox/ipms/modules/delivery/DriverManagement.ts` |
| P6-04 | 18 | ~~Implement multi-store job pickup~~ **COMPLETED** — Dispatch matching engine with zone/availability/priority scoring. Included in P6-03. | Opus | P6-03 | `src/databox/ipms/modules/delivery/DriverManagement.ts` |
| P6-05 | 17 | ~~Implement print shop IPMS module~~ **COMPLETED** — Print service catalogue, job intake, status pipeline (intake→prepress→proofing→printing→finishing→ready→delivered). 4 routes, 11 tests. | Opus | P2-04 | `src/databox/ipms/modules/print/PrintShop.ts` |
| P6-06 | 17 | ~~Implement inter-org print job submission~~ **COMPLETED** — B2B workflow with ODRL licence enforcement, artwork URL, delivery address, budget. Included in P6-05. | Opus | P6-05, P2-04 | `src/databox/ipms/modules/print/PrintShop.ts` |
| P6-07 | 17 | ~~Create `print.shop` vertical profile~~ **COMPLETED** — Bundles print, quotations, payments, delivery, licensing, website-seo modules. | Haiku | P6-05 | `src/databox/ipms/VerticalProfile.ts` |
| P6-08 | 18 | ~~Create `hr.workforce` vertical profile~~ **COMPLETED** — Bundles hr, governance, credentials, payments, notifications, driver-management modules. | Haiku | P6-01 | `src/databox/ipms/VerticalProfile.ts` |

**Phase 6 gate:** Org onboards an employee → employee gets pod with role VC → shift
assigned via LDN → payslip delivered to pod. Driver registered with 3 stores →
receives job offers from all 3 → accepts one → delivers → status flows back.
Historical society submits print job to print shop → quote → accept → print →
deliver → receipt → file deleted per ODRL.

---

## Phase 7 — Operational Horizontals (high-parallel swarm, Sonnet)

> Core IPMS modules that other features depend on.

| Task ID | Gap § | Description | Model | Deps | Files |
|---------|-------|-------------|-------|------|-------|
| P7-01 | 15.6 | ~~Implement payments module~~ **COMPLETED** — PaymentsApi with receipt, refund, split, subscription, tax routes. | Opus | — | `src/databox/ipms/modules/payments/` |
| P7-02 | 15.5 | ~~Implement device identity (mTLS)~~ **COMPLETED** — DeviceAuth with enrolment, verify, revoke routes. mTLS client cert verification via WebID-TLS. | Opus | P1-01 | `src/databox/ipms/modules/device-auth/` |
| P7-03 | 15.1 | ~~Expand website maker~~ **COMPLETED** — WebsiteApi with preview, publish, seo, sitemap routes. PublicFeedRenderer with HTML, JSON-LD, schema.org. | Sonnet | — | `src/databox/ipms/modules/website/` |
| P7-04 | 15.7 | ~~Surface notifications in admin UI~~ **COMPLETED** — Notifications module with create, subscribe, read, query routes. Multi-channel (in-app, email, SMS, push, LDN). 20 tests. | Sonnet | — | `src/databox/ipms/modules/notifications/` |
| P7-05 | 6.2 | ~~Wire `ui#` shapes to module manifests~~ **COMPLETED** — All 30+ module manifests now have `configShape` IRIs. 10 `ui#` shape templates defined in `ModuleConfigShapes.ts`. `GET /modules/:id/config-shape` route serves Turtle. | Haiku | — | `src/databox/ipms/BuiltInModules.ts`, `ModuleConfigShapes.ts`, `IpmsHttpHandler.ts` |
| P7-06 | 6.3 | ~~Connect `UiFormRenderer` to modules page~~ **COMPLETED** — Modules page shows "Configure" button for modules with `configShape`. Opens modal with `UiFormRenderer` that fetches and renders the `ui#` shape, submits config Turtle via PUT. | Sonnet | P7-05 | `smithy-admin/src/pages/modules/index.tsx` |
| P7-07 | 5.7 | Implement direct cash drawer mode — serial/USB I/O for direct cash drawer devices via `serialport` crate in Rust POS edge. | Sonnet | — | `native/pos-edge/src/hardware/drawer.rs` |
| P7-08 | 5.8 | Clean up Rust warnings — remove unused imports, prefix unused variables, remove dead code in pos-edge. | Haiku | — | `native/pos-edge/src/*.rs` (multiple) |
| P7-09 | 5.9 | Add fullscreen for customer display — `.with_fullscreen(Fullscreen::Borderless(None))` in tray supervisor. | Haiku | — | `native/tray-supervisor/src/main.rs` |
| P7-10 | 2.3 | ~~Integrate real malware scanner for binary evidence quarantine~~ **COMPLETED** — `ClamAvScanner` (INSTREAM protocol), `VirusTotalScanner` (v3 API with hash cache + upload + poll), `CompositeScanner` (defence-in-depth). All implement `EvidenceScanner` with fail-closed. 14 tests. | Sonnet | — | `src/databox/gateway/RealEvidenceScanners.ts` |

**Phase 7 gate:** Payments flow through Stripe with webhooks. Devices authenticate
via mTLS. Website publishes public pages with SEO. Module config forms render via
`ui#` shapes. Cash drawer works in direct mode. All tests pass.

---

## Phase 8 — Remaining IPMS Modules (high-parallel swarm, Sonnet)

> 19+ modules with manifests but no route handlers. Includes new tax, concessions,
> discounts, and donations modules required for real-world business operations.

| Task ID | Gap § | Description | Model | Deps | Files |
|---------|-------|-------------|-------|------|-------|
| P8-01 | 6.1 | ~~Implement `access` module~~ **COMPLETED** — AccessApi with credential gate evaluation. | Sonnet | P2-01 | `src/databox/ipms/modules/access/` |
| P8-02 | 6.1 | ~~Implement `consent` module~~ **COMPLETED** — ConsentApi with consent record builder. | Sonnet | P2-01 | `src/databox/ipms/modules/consent/` |
| P8-03 | 6.1 | ~~Implement `credentials` module~~ **COMPLETED** — CredentialApi with issue, verify, revoke routes. | Sonnet | P2-02 | `src/databox/ipms/modules/credentials/` |
| P8-04 | 6.1 | ~~Implement `delegation` module~~ **COMPLETED** — DelegationApi with build, validate routes. | Sonnet | P2-01 | `src/databox/ipms/modules/delegation/` |
| P8-05 | 6.1 | ~~Implement `delivery` module~~ **COMPLETED** — DeliveryApi with request, status tracking. | Sonnet | P2-04 | `src/databox/ipms/modules/delivery/` |
| P8-06 | 6.1 | ~~Implement `emergency` module~~ **COMPLETED** — EmergencyApi with break-glass evaluation. | Sonnet | P2-01 | `src/databox/ipms/modules/emergency/` |
| P8-07 | 6.1 | ~~Implement `governance` module routes~~ **COMPLETED** — GovernanceApi with role bind, ODRL policy, approval gate, resolution. | Opus | P2-01 | `src/databox/ipms/modules/governance/` |
| P8-08 | 6.1 | ~~Implement `household` module~~ **COMPLETED** — HouseholdApi with household builder. | Sonnet | P2-01 | `src/databox/ipms/modules/household/` |
| P8-09 | 6.1 | ~~Implement `licensing` module~~ **COMPLETED** — LicensingApi with ODRL licence builder. | Sonnet | P2-01 | `src/databox/ipms/modules/licensing/` |
| P8-10 | 6.1 | ~~Implement `loyalty` module~~ **COMPLETED** — LoyaltyApi with apply, record routes. | Sonnet | P7-01 | `src/databox/ipms/modules/loyalty/` |
| P8-11 | 6.1 | ~~Implement `mcp` module~~ **COMPLETED** — McpServerApi with SSE endpoint. | Sonnet | — | `src/databox/ipms/modules/mcp/` |
| P8-12 | 6.1 | ~~Implement `pricing` module~~ **COMPLETED** — PricingApi with wholesale pricing. | Sonnet | P7-01 | `src/databox/ipms/modules/pricing/` |
| P8-13 | 6.1 | ~~Implement `profile` module~~ **COMPLETED** — ProfileApi with build, provision, lifecycle, LDN, member interaction routes. | Sonnet | P2-03 | `src/databox/ipms/modules/profile/` |
| P8-14 | 6.1 | ~~Implement `theming` module~~ **COMPLETED** — ThemingApi with validate, CSS, smithy tokens routes. | Sonnet | — | `src/databox/ipms/modules/theming/` |
| P8-15 | 6.1 | ~~Implement `a11y` module~~ **COMPLETED** — A11yApi with accessibility audit route. | Sonnet | — | `src/databox/ipms/modules/a11y/` |
| P8-16 | new | ~~Implement `tax` module~~ **COMPLETED** — TaxApi with compute, report routes. 8 tests. | Opus | P7-01, P8-12 | `src/databox/ipms/modules/tax/` |
| P8-17 | new | ~~Implement `concessions` module~~ **COMPLETED** — ConcessionsApi with eligibility, pricing, record routes. 7 tests. | Sonnet | P2-02, P8-12 | `src/databox/ipms/modules/concessions/` |
| P8-18 | new | ~~Implement `discounts` module~~ **COMPLETED** — DiscountsApi with apply, record routes. 9 tests. | Sonnet | P8-12, P8-10 | `src/databox/ipms/modules/discounts/` |
| P8-19 | new | ~~Implement `donations` module~~ **COMPLETED** — DonationsApi with process, receipt, transparency routes. 8 tests. | Opus | P7-01, P2-02, P2-03 | `src/databox/ipms/modules/donations/` |
| P8-20 | new | ~~Implement `barcode` module~~ **COMPLETED** — BarcodeApi with scan, lookup routes. GS1 AI parsing, GTIN check digit validation, symbology detection (EAN/UPC/Code-128/QR/DataMatrix). 12 tests. | Sonnet | P8-13 | `src/databox/ipms/modules/barcode/` |
| P8-21 | new | ~~Implement `eftpos` module~~ **COMPLETED** — EftposApi with transaction, settlement, status routes. Multi-provider (Tyro/Linkly/Westpac/CBA/NAB/ANZ/Stripe/Square/Sumup), multi-protocol (IPG/REST/SOAP/HID/SERIAL). 10 tests. | Sonnet | P7-01 | `src/databox/ipms/modules/eftpos/` |
| P8-22 | new | ~~Implement `backups` module~~ **COMPLETED** — BackupApi with create, restore, manifest routes. AES-256-GCM encryption with scrypt key derivation. JSON-LD/Turtle/N-Quads format support. 8 tests. | Sonnet | — | `src/databox/ipms/modules/backups/` |
| P8-23 | new | ~~Implement `accounting` module~~ **COMPLETED** — AccountingApi with export, import routes. Xero/MYOB/QuickBooks/Sage/CSV/OFX/QIF/JSON-LD format support. Invoice/payment/journal/tax/contact/item export and CSV/JSON-LD/QIF/OFX import. 14 tests. | Sonnet | P8-16 | `src/databox/ipms/modules/accounting/` |

**Phase 8 gate:** Each module has route handlers, data persistence, and business
logic matching its manifest's `capabilities` and `routes`. All tests pass.

---

## Phase 9 — Tests & Documentation (parallel, Sonnet→Haiku)

| Task ID | Gap § | Description | Model | Deps | Files |
|---------|-------|-------------|-------|------|-------|
| P9-01 | 8.1 | ~~Add vocabulary unit tests~~ **COMPLETED** — Extended existing test with IPMS and UI vocabulary namespace/term resolution tests. 15 tests total. | Haiku | P3-01 | `test/unit/util/Vocabularies.test.ts` |
| P9-02 | 8.2 | ~~Add `UiFormRenderer` tests~~ **COMPLETED** — 13 vitest tests: shape parsing (Turtle→form spec), field rendering (TextInput/Boolean/Integer/Choice), form value serialization (string/boolean/integer/decimal/skip-empty). Fixed rdf:List traversal bugs in parseUiShape. | Sonnet | P7-06 | `smithy-admin/src/components/ui-form/__tests__/` |
| P9-03 | 8.3 | Add Rust installer tests — unit tests for each step with mocked environment. | Sonnet | P0-04 | `native/installer/src/*.rs` (add `#[test]` functions) |
| P9-04 | 8.3 | Add Rust POS edge tests — IPC protocol parsing, job queue state, hardware dispatch with mocked devices. | Sonnet | P7-07 | `native/pos-edge/src/*.rs` (add `#[test]` functions) |
| P9-05 | 8.4 | Add POS edge IPC integration test — start binary, post cash-drawer job to `localhost:9100/jobs`, verify status transitions. | Opus | P7-07 | `test/integration/PosEdgeIpc.test.ts` (new) |
| P9-06 | 15.8 | ~~Document profile ladder~~ **COMPLETED** — `profile-ladder.md` documents basic → +databox → +ipms → +modules layers with 26 vertical profiles table. | Haiku | — | `databox/devdocs/profile-ladder.md` |

**Phase 9 gate:** All tests green. 100% branch coverage achieved on all new `src/`
branches (cleanup from 80% per-task baseline). Rust tests pass. Integration test
confirms POS edge IPC end-to-end.

---

## Phase 10 — Vertical Profiles Assembly (high-parallel swarm, Haiku→Sonnet)

> Assemble vertical profile bundles from completed horizontals.

| Task ID | Description | Model | Deps |
|---------|-------------|-------|------|
| P10-01 | ~~`food.restaurant` vertical~~ **COMPLETED** — Exists as `FOOD_RESTAURANT_VERTICAL_PROFILE`. POS + menu + bookings + delivery + allergy-safety + waiter app + tax + discounts. | Sonnet | P3-06, P5-02, P7-01, P8-05, P8-16, P8-18 |
| P10-02 | ~~`food.take-away` vertical~~ **COMPLETED** — `FOOD_TAKE_AWAY_VERTICAL_PROFILE`: POS + catalogue + payments + receipt + delivery + driver-management + allergy-profile + tax + discounts + business + website-seo. | Sonnet | P3-06, P5-04, P7-01, P8-05, P8-16, P8-18 |
| P10-03 | ~~`auto.portable-records` vertical~~ **COMPLETED** — Exists as `AUTO_PORTABLE_RECORDS_VERTICAL_PROFILE`. Verified complete. | Haiku | P8-08 |
| P10-04 | ~~`health.privacy-consent` vertical~~ **COMPLETED** — Exists as `HEALTH_PRIVACY_CONSENT_VERTICAL_PROFILE`. Verified complete with concessions module available. | Sonnet | P3-06, P8-17 |
| P10-05 | ~~`member.governance` vertical~~ **COMPLETED** — Exists as `MEMBER_GOVERNANCE_VERTICAL_PROFILE`. Verified complete with donations module available. | Haiku | P2-01, P8-19 |
| P10-06 | ~~`print.shop` vertical~~ **COMPLETED** — Exists as `PRINT_SHOP_PROFILE`. Includes tax module. | Haiku | P6-07, P8-16 |
| P10-07 | ~~`hr.workforce` vertical~~ **COMPLETED** — Exists as `HR_WORKFORCE_PROFILE`. Includes tax module for payroll tax. | Haiku | P6-08, P8-16 |
| P10-08 | ~~`sports.venue` vertical~~ **COMPLETED** — `SPORTS_VENUE_VERTICAL_PROFILE`: events + ticketing + access + credentials + payments + receipt + tax + discounts + donations + governance + profile + website-seo. | Sonnet | P5-06, P5-07, P8-07, P8-16, P8-18, P8-19 |
| P10-09 | ~~`trades.service` vertical~~ **COMPLETED** — `TRADES_SERVICE_VERTICAL_PROFILE`: jobs + bookings + quotations + catalogue + payments + receipt + tax + inventory + profile + website-seo. | Sonnet | P5-03, P7-01, P8-16 |
| P10-10 | ~~`charity.nonprofit` vertical~~ **COMPLETED** — `CHARITY_NONPROFIT_VERTICAL_PROFILE`: donations + governance + credentials + concessions + tax + profile + payments + receipt + website-seo + events + social. | Sonnet | P8-19, P2-01, P2-02, P8-17, P8-16, P7-03 |

**Phase 10 gate:** Each vertical profile is a declarative bundle manifest that
composes horizontal modules + vertical vocab + config + thin glue. Lighthouse
demos (AUTO, FOOD, MEMBER, HEALTH) are demonstrable end-to-end.

---

## Phase 11 — Accessibility & i18n Remediation (high-parallel swarm, Sonnet)

> Audit and remediate all UI surfaces for WCAG 2.1 AA compliance and full i18n.
> Runs after all UI-creating phases (5, 6, 7, 8, 10) so it can audit the complete
> surface area. Agents fix issues directly (rule 7) and report.

| Task ID | Description | Model | Deps | Files |
|---------|-------------|-------|------|-------|
| P11-01 | Audit & remediate smithy-admin **hosting wizard** — semantic HTML, ARIA, keyboard nav, contrast, i18n strings. Screen reader test (NVDA). | Sonnet | P1-06, P0-09, P0-10 | `smithy-admin/src/pages/hosting/` |
| P11-02 | Audit & remediate smithy-admin **POS pages** (index, customer, display) — ARIA live regions for cart/order updates, keyboard accessible product grid, i18n strings. | Sonnet | P3-07, P0-09 | `smithy-admin/src/pages/pos/` |
| P11-03 | Audit & remediate smithy-admin **waiter page** (pre-extraction) — keyboard accessible table/item selection, ARIA for order status, i18n. | Sonnet | P0-09 | `smithy-admin/src/pages/waiter/` |
| P11-04 | Audit & remediate smithy-admin **modules page** — keyboard accessible module list, ARIA for enable/disable toggles, form labels, i18n. | Sonnet | P7-06, P0-09 | `smithy-admin/src/pages/modules/` |
| P11-05 | Audit & remediate smithy-admin **setup/onboarding pages** — wizard keyboard flow, ARIA for vertical profile picker, form validation announcements, i18n. | Sonnet | P0-09 | `smithy-admin/src/pages/setup/` |
| P11-06 | Audit & remediate smithy-admin **remaining pages** (receipts, events, access-requests, corrections, consumer-ledger, data-portability, programs, mappings) — semantic HTML, ARIA, keyboard, contrast, i18n. | Sonnet | P0-09 | `smithy-admin/src/pages/` (all remaining) |
| P11-07 | Audit & remediate smithy-admin **layout/sidebar** — ARIA navigation landmarks, `aria-current` for active nav item, keyboard nav for sidebar, dynamic sidebar (P2-07) announces changes. Language selector in header. | Sonnet | P2-07, P0-09 | `smithy-admin/src/components/layout/` |
| P11-08 | Audit & remediate **org-mobile-apps** (all built apps) — each app: semantic HTML, ARIA, keyboard nav, contrast, i18n with locale files, RTL-safe CSS. One agent per app or batched. | Sonnet | P5-02 through P5-07 | `org-mobile-apps/*/src/` |
| P11-09 | Audit & remediate **customer display renderer** — ARIA live for playlist transitions, alt text for QR codes, i18n for slide content. | Sonnet | P0-09 | `smithy-admin/src/website/CustomerDisplayRenderer.ts` |
| P11-10 | Audit & remediate **website maker / public site** — semantic HTML, WCAG AA contrast in theme tokens, skip-to-content link, alt text, lang attribute, i18n for public content. | Sonnet | P7-03, P0-09 | `src/databox/ipms/modules/website/` |
| P11-11 | Create **additional locale files** — translate `en.json` to `es.json`, `fr.json`, `de.json`, `zh.json`, `ar.json`, `ja.json` for all keys. Verify RTL layout with `ar.json`. | Haiku | P0-09, P11-01 through P11-06 | `smithy-admin/src/locales/` |
| P11-12 | Add **server-side i18n message keys** — update all IPMS API error responses to include `messageKey` field alongside English fallback. Update `writeJson` error helpers. | Sonnet | — | `src/databox/ipms/` (error handlers) |
| P11-13 | Add **axe-core automated accessibility tests** — integrate `@axe-core/playwright` or `jest-axe` into test suite. Add accessibility test per page component. | Sonnet | P11-01 through P11-07 | `smithy-admin/src/__tests__/a11y/` (new) |
| P11-14 | Add **i18n completeness test** — verify all locale files have the same keys as `en.json`. Fail if any key is missing. | Haiku | P11-11 | `smithy-admin/src/__tests__/i18n.test.ts` (new) |

**Phase 11 gate:** `eslint-plugin-jsx-a11y` passes with zero warnings. `axe-core`
tests pass for all pages. All user-facing strings use `t()`. 7 locale files have
complete key sets. RTL layout verified with Arabic locale. Screen reader tested on
critical flows (login, POS, hosting wizard, module config). Task reports include
accessibility and i18n check sections.

---

## Dependency Graph Summary

```
Phase 0 (foundations + i18n/a11y baseline)
  ├── Phase 1 (Cloudflare hosting)
  ├── Phase 2 (entity & people) ──────┐
  │     ├── Phase 3 (allergy system)  │
  │     ├── Phase 5 (org-mobile-apps) │
  │     ├── Phase 6 (HR + print B2B) ─┤
  │     └── Phase 8 (IPMS modules)     │
  ├── Phase 4 (connectors + mapping)  │
  ├── Phase 7 (operational horizontals)┘
  │     └── Phase 8 (IPMS modules)
  └── Phase 9 (tests + docs)
        └── Phase 10 (verticals)
              └── Phase 11 (a11y & i18n remediation)
```

**Parallelisation opportunities:**
- Phases 1, 4 can run in parallel after Phase 0.
- Phase 2 must complete before Phases 3, 5, 6, 8 (they depend on entity/people infra).
- Phase 7 can run in parallel with Phases 3, 5, 6 (no shared deps except P7-01 for P6-02, P8-10, P8-12, P8-16).
- Phase 8 is a high-parallel swarm (19 independent module tasks).
- Phase 9 can start as soon as its dependency tasks complete (don't wait for all phases).
- Phase 10 starts after all horizontal modules are complete.
- Phase 11 starts after all UI-creating phases (5, 6, 7, 8, 10) complete. It is a
  high-parallel audit-and-fix swarm.

---

## Agent Count Estimate

| Phase | Tasks | Parallelism | Est. agents |
|-------|-------|-------------|-------------|
| 0 | 9 | sequential | 1-2 |
| 1 | 7 | sequential | 1-2 |
| 2 | 8 (2 completed) | mostly sequential | 2-3 |
| 3 | 7 | sequential | 1-2 |
| 4 | 5 | parallel after P0 | 2-3 |
| 5 | 14 | parallel after P5-01 | 4-6 |
| 6 | 8 | parallel after P6-01 | 3-4 |
| 7 | 10 | high-parallel | 5-6 |
| 8 | 19 | high-parallel | 6-10 |
| 9 | 6 | parallel | 3-4 |
| 10 | 10 | high-parallel | 4-5 |
| 11 | 14 | high-parallel | 5-7 |
| **Total** | **117** | | **~38-56 agent-runs** |

---

## Verification Commands

```bash
# Per-task (run after each task)
export PATH="/c/nvm4w/nodejs:$PATH"
npx tsc --noEmit --project tsconfig.json
npx eslint src/ --cache
npx jest test/unit/databox --maxWorkers=2
cd smithy-admin && npx tsc --noEmit && npx vite build && cd ..
cd native/installer && cargo test && cd ..
cd native/pos-edge && cargo test && cd ..

# Per-phase gate
npx jest --maxWorkers=2  # full suite
npx jest test/integration --runInBand  # integration tests

# Adversarial checker (per task)
# Verify: (1) basic install untouched, (2) capability modes, (3) declarative-first, (4) vanilla-Solid
npx jest test/unit/databox/ipms --maxWorkers=2 --coverage

# Accessibility (per UI task)
cd smithy-admin && npx eslint src/ --plugin jsx-a11y && cd ..
cd smithy-admin && npx jest src/__tests__/a11y --maxWorkers=2 && cd ..

# i18n (per UI task)
cd smithy-admin && npx jest src/__tests__/i18n.test.ts && cd ..
```
