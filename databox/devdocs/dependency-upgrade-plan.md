# Dependency upgrade plan — swarm deployment

Status: **draft plan, not yet executed.** Written 2026-07-17, after the Node 24.18.0 upgrade
(`5e592d066`) and the within-range "free wins" pass landed.

This plan covers the **47 dependencies still blocked behind a semver major**. It is deliberately
sequenced and throttled: the naive reading of the task — "point a swarm at `npm outdated` and take
everything to `latest`" — would break this repository in at least four specific, already-demonstrated
ways. Those are documented first, because they are the plan.

---

## 1. What we already learned the hard way

These are not hypotheticals. Each was observed in this repo, in the last few hours.

### 1.1 `@types/*` minor bumps are BREAKING

`npm update` (ranges untouched, lockfile only) took `@types/n3` 1.16.3 -> 1.26.1 and immediately broke
the build with 9 errors. DefinitelyTyped had changed `DataFactory` from a **namespace** to a **value**:

```ts
// @types/n3 1.16.3
export namespace DataFactory { ... }        // `import namedNode = DataFactory.namedNode` works

// @types/n3 1.26.1
export const DataFactory: DataFactoryInterface;   // same idiom -> TS2503 "Cannot find namespace"
```

The same pass took `@types/oidc-provider` 8.4.0 -> 8.8.1 and broke `src/identity/IdentityUtil.ts`
against the repo's **vendored** shim at `templates/types/oidc-provider`.

**Rule: treat every `@types/*` change as semver-major regardless of its version number.** A swarm that
classifies by version delta will mis-sort these into the "safe" bucket.

### 1.2 `@types/node` must be PINNED to the engines floor

`npm outdated` reports `@types/node 24.13.3 -> 26.1.1`. **Taking it is wrong.** We pinned 24.x because
`engines: >=24.0`. Upgrading the types means typechecking against APIs absent from the runtime we ship
to. Same for `smithy-admin`.

**Rule: `@types/node`'s major is set by the engines floor, never by `latest`.** Any agent told to "update
everything" will get this wrong unless explicitly forbidden.

### 1.3 A version bump is a 250-file migration

Bumping `version` 7.1.9 -> 8.0.0 broke every integration test with `stream.on is not a function`.
Components.js resolves config through version-pinned `lsd:importPaths`; with `^7.0.0` mappings and an
8.0.0 package it stopped matching locally and tried to fetch config over the network.
**Unit tests could not see it** — only integration instantiates from config.
`scripts/upgradeConfig.ts` (normally fired by `commit-and-tag-version`'s `postbump`) rewrites 253
references across 249 files. Any cluster that forces a major version bump inherits this.

### 1.4 Peer ranges silently rot

Node 24 -> `@types/node@24` -> TypeScript 5.9.3 left `typedoc@0.26.x` (peer: TS `<=5.5.x`) violated. It
still *ran*, so nothing failed loudly — it only surfaced when `npm update` refused to resolve. Only the
`0.28.x` line supports TS 5.9.

**Rule: after any toolchain bump, re-check peers of everything that consumes it.**

---

## 2. Hard constraints the swarm design must respect

### 2.1 The machine cannot run the gate in parallel

Proven: 8 cores, with resident apps consuming ~40–50% at baseline. Jest's default 7 workers starved and
blew the 90s timeout on **51 tests**; the identical tree passed at `--maxWorkers=2`. We spent real time
diagnosing this as a code bug. It was not.

**Agents may edit in parallel. Verification MUST be throttled to 1–2 concurrent runners.** N agents each
running `test:unit`/`test:integration` will produce false failures indistinguishable from real
regressions. Verify centrally, in a queue.

### 2.2 `npm run typedocs` destroys `docs/`

`typedoc.json` sets `"out": "docs"`. Upstream CSS owns `docs/` for typedoc; **this fork put the published
GitHub Pages site there** (landing page, admin demo, smithy demo). Running typedocs deletes all of it.
Recoverable from git, and the live site is safe (CI publishes typedoc to the `gh-pages` branch while
Pages serves `main:/docs`) — but it is a live footgun for any agent that runs the docs build.
**Either fix `out` first, or forbid agents from running typedocs.**

### 2.3 100% coverage gate on `./src`

`/src/databox/` is exempt (`jest.coverage.config.js`). Everything else must stay at 100%. Any upgrade
that adds a branch needs a test.

### 2.4 This is a FORK

`@solid/community-server` is a fork. Every major taken here that upstream has not taken widens the merge
gap — permanently, in the most conflict-prone files. This is a real cost, not a footnote. **Check whether
upstream already depends on the target major before taking it.**

### 2.5 CommonJS vs ESM-only majors

The codebase compiles to CommonJS (`module: nodenext`). Several majors we are behind went **ESM-only** at
exactly that major (`escape-string-regexp@5`, `url-join@5`, `marked`, others). Those are not bumps — each
forces a dynamic `import()` at the call site or an ESM migration of the consumer. **Classify ESM-only
first; it changes the estimate by an order of magnitude.**

---

## 3. Current state

- **47** dependencies blocked behind a semver major (root).
- **13** vulnerabilities, all **moderate**, all requiring a major:
  - 5 via `@comunica/query-sparql@5` (RDF cluster)
  - 5 via `markdownlint-cli2@0.23` (lint cluster)
  - (0 critical, 0 high, 0 low — the 2 highs were cleared by the free-wins pass)
- `smithy-admin`: 4 majors, incl. `@refinedev/core 4 -> 5`.

## 4. Clusters — the upgrade unit is a cluster, never a package

| # | Cluster | Packages | Why coupled | Risk |
|---|---|---|---|---|
| A | **RDF / Comunica** | `@rdfjs/types 1->2`, `rdf-parse 2->5`, `rdf-dereference 2->5`, `rdf-serialize 2->5`, `rdf-string 1->2`, `rdf-terms 1->2`, `n3 1->2`, `sparqlalgebrajs 4->5`, `jsonld-context-parser 2->3`, `fetch-sparql-endpoint 6->7`, `@comunica/* 2->5`, `jest-rdf 1->2` | All share `@rdfjs/types`. Mixing majors yields two incompatible `Quad` types across the tree | **High** — clears 5 moderate vulns |
| B | **Components.js** | `componentsjs 5->6`, `componentsjs-generator 3->4` | The DI framework the entire server is wired through (`dist/components/*.jsonld`, every config) | **Highest blast radius** |
| C | **Identity** | `oidc-provider 8->9`, `@types/oidc-provider 8->9`, `jose 4->6` | Shared types; also the vendored `templates/types/oidc-provider` shim | **High** — security-sensitive |
| D | **Test tooling** | `jest 29->30`, `@types/jest 29->30`, `jest-rdf 1->2` | Shared jest runtime | Medium — **optional**, see §6 |
| E | **Lint** | `eslint 9->10`, `opinionated-eslint-config@0.2.0` (exact pin), `markdownlint-cli2 0.13->0.23` | eslint peer; clears 5 moderate vulns | Medium |
| F | **Git hooks** | `husky 4.3.8 -> 9.1.7` (**5 majors**) | v4 configures hooks in `package.json`; v9 uses `.husky/` + a different install | Medium — changes everyone's commit workflow |
| G | **TypeScript line** | `typescript 5.9.3 -> 6 -> 7` | `typedoc` peer follows it | Medium — nothing forces it |
| H | **Independent singletons** | `bcryptjs 2->3`, `@isaacs/ttlcache 1->2`, `set-cookie-parser 2->3`, `mime-types 2->3` (+types), `cookie 0.7->2`, `ejs 3->6`, `marked 9->18`, `yargs 17->18`, `arrayify-stream 2->3`, `escape-string-regexp 4->5`, `url-join 4->5`, `@solid/access-control-policy 0.1->1.0`, `@inrupt/solid-client-authn-* 2->5` (dev), `commit-and-tag-version 11->12`, `@commitlint/* 19->21`, `@types/*` majors | Independent | Low each — **but triage ESM-only out** |
| I | **smithy-admin** | `@refinedev/core 4->5`, `react-router-dom 6->7`, `typescript 6->7` | Separate npm project | Low — **`@refinedev/core@5` likely fixes the red `databox-pages` workflow** (v4 peers want `@types/react ^17\|\|^18` vs React 19) |

---

## 5. Swarm design

### Phase 0 — Classify (fan-out, READ-ONLY, cheap, no verification)
One agent per cluster A–I. For each package, return a structured verdict:
- Is it **ESM-only** at the target major? (decides everything)
- Actual breaking changes, from the changelog — not the version delta.
- Peers that must move with it.
- **Does upstream CSS already use this major?** (fork-divergence cost)
- Effort estimate + a "should we do this at all?" recommendation.

**Barrier.** Re-scope the rest of this plan from the findings. Expect clusters to be dropped here.

### Phase 1 — Independent singletons (cluster H)
Parallel edit, `isolation: 'worktree'` per agent so they cannot corrupt each other.
Each agent: bump one package -> fix call sites -> report. **No agent runs the test suite.**
Verification is queued centrally (§2.1) and batched.
ESM-only ones are triaged OUT into their own review — they are migrations, not bumps.
Land as one commit per package, or one batched commit if the gate stays green.

### Phase 2 — Coupled clusters, one at a time
Order by blast radius **ascending**: **I -> E -> C -> A -> B**, with D/F/G optional.
- One agent per cluster, working sequentially *within* the cluster.
- Each cluster: its own branch, its own commit, its own full gate.
- **Stop after each. Re-baseline. Never one mega-commit.**
- Cluster A and B each warrant their own adversarial review before landing.

### Phase 3 — Adversarial verification (per cluster, not at the end)
- Full gate: build (incl. `componentsjs-generator`), lint, `tsc` (src **and** test), unit + coverage,
  integration — all at `--maxWorkers=2`.
- `test:deploy` (`validate-configs.sh`) and a real `docker build` on `node:24-alpine`.
- **Drive the real app**, because the gate has already proven insufficient once: start
  `npm run start:databox-demo`, load `/index.html`, click Provision Charles James and MegaMart **twice
  each** (the second run is the one that catches already-registered bugs), check the QR renders and the
  program is correct, then load the Admin console routes.
- An independent skeptic agent per cluster, prompted to **refute** "this upgrade is safe".

### Phase 4 — Land
One commit per cluster. Hook passing (or, if the machine starves, the gate run individually at
`--maxWorkers=2` and **said so explicitly in the commit message**). No bylines.

---

## 6. Recommendation — do NOT do all 47

Ranked by value-to-risk:

1. **Cluster I — `@refinedev/core@5`.** Likely repairs `databox-pages`, which is **red today**. Small,
   isolated, immediate value.
2. **Cluster E — lint.** Clears 5 of the 13 moderate vulns. Check `opinionated-eslint-config`'s eslint
   peer first; it is pinned to an exact version and may block eslint 10 outright.
3. **Cluster C — identity.** Security-sensitive, and the vendored oidc shim is already a known friction
   point.
4. **Cluster A — RDF.** Clears the other 5 moderates, but it is 12 packages and the deepest divergence
   from upstream.
5. **Re-evaluate before B, D, F, G.**
   - **D (jest 30) buys nothing right now** — jest 29 is proven working on Node 24 (empirically, all 435
     suites). Skip unless something forces it.
   - **G (TS 6/7)** — nothing forces it; `@types/node@24`'s floor is only 5.6.
   - **B (Components.js)** — highest blast radius in the repo. Do it alone, deliberately, or not at all.

The honest summary: **this is not one task, it is 6–8 separate projects.** Each cluster deserves its own
decision, and several deserve a "no".

## 7. Packages pinned back during the within-range update pass (2026-07-17)

The `npm update` pass (64 direct deps, lockfile-only) broke 5 integration suites / 39 tests. Both root
causes were demonstrated (not guessed) and both packages are **pinned back in `package.json`**, because in
each case the newer version is a decision that belongs to a cluster below, not to a lockfile refresh.

Neither pin reintroduces a vulnerability: `npm audit` after pinning is **0 critical / 0 high / 13
moderate**. `oidc-provider@8.8.1` and `typedoc@0.28.20` — the two HIGH-vuln fixes — are **retained**.

### 7.1 `n3` pinned `^1.17.1` -> `1.17.1` — belongs to **cluster A (RDF/Comunica)**

**Broke:** `LdpHandlerWithoutAuth`, `WebSocketChannel2023`, `WebhookChannel2023`.

**Demonstrated:** n3's `StreamWriter` honours the `baseIRI` option again as of **1.25.0**, so it now
relativizes IRIs. `QuadToRdfConverter.ts:52` passes `baseIRI: identifier.path`. Same input, same options:

| n3 version | Writer `baseIRI` behaviour |
|---|---|
| 1.8.0 – 1.12.0 | relativizes an **exact** base match only (`<>`) |
| **1.14.0 – 1.24.0** | **`baseIRI` silently ignored** (upstream regression) |
| **1.25.0+** | honoured **and expanded**: exact -> `<>`, under-base -> `<sibling>`, other origin -> absolute |

So `<http://localhost:6013/a> <b> <c>.` became `<a> <b> <c>.`, and `WebSocketChannel2023` then read a
**relative** `subscriptionUrl` out of the storage description (it parses with `new Parser()` and **no**
`baseIRI`), producing `TypeError: Only absolute URLs are supported`.

**Why pinned rather than adapted — this is a judgement call the cluster must make, not a test fix:**
CSS *asked* for this behaviour in `4638ba4bc` *"feat: Use baseIRI in QuadToRdfConverter."* (closes #512),
which bumped n3 `^1.7.0 -> ^1.8.0` and changed tests to expect `<> a ldp:Container`. n3 then regressed at
~1.13/1.14 and the tests were changed back to absolute. **1.25.0 restores the intent — and goes further
than CSS ever tested** (full relativization vs. exact-match-only).

Adopting it changes the **on-the-wire Turtle/TriG output of every response** the reference server emits.
It is semantically sound for a client that resolves against the document URL (verified: `baseIRI` is the
document's own URL, so it round-trips), but it is an ecosystem-visible representation change and must not
land as a side effect of `npm update`. **Cluster A owns it** (`n3 1->2` is already listed there).

When cluster A adopts it, the fix is *not* to loosen the assertions: follow the 2021 precedent and give
the parser a base — `new Parser({ baseIRI: storageDescriptionUrl })` in `WebSocketChannel2023.test.ts:87`
— then assert the resolved absolute IRIs.

Note: `n3@2.1.1` is already in the tree, isolated under `shaclc-write` (which requires `n3@^2.0.0`). All
1.x consumers are satisfied by 1.17.1 (highest floor is `^1.17.1`), so the pin needs no nested duplicate.

### 7.2 `@inrupt/solid-client-authn-{node,core}` pinned `^2.0.0` -> `2.3.0` (dev) — **cluster H**

**Broke:** `Identity`, `V6Migration`.

**Demonstrated (observed runtime values, not inference).** `ClientRegistrar.getClient` gained two
conditions in **2.4.0**:

```
2.0.0:  if (storedClientId) { return storedClient; }
2.4.0+: if (storedClientId !== undefined && isKnownClientType(storedClientType) && !expired) { ... }
```

`expired = storedClientSecret !== undefined && storedClientType === 'dynamic' && now > expirationDate`.
CSS/oidc-provider returns `client_secret_expires_at: 0`, which **RFC 7591 §3.2.1 defines as "does not
expire"**; inrupt parses it as an epoch, so `now > 0` is **always true**. Instrumenting the real call:

```
[PROBE] getClient {"storedClientId":"96ZK...","storedClientSecret":"<set>","storedExpiresAt":"0",
                   "storedClientType":"dynamic","expirationDate":0,"expired":true,"knownType":true}
```

It therefore falls through to **re-register** — but `AuthCodeRedirectHandler` calls
`getClient({ sessionId })` with **no `redirectUrl`**, so it sends `redirect_uris: [undefined]` and the
server correctly rejects: `invalid_redirect_uri (redirect_uris must only contain strings)`.

**This is an upstream bug, not ours.** `oidc-provider` 8.4.3 and 8.8.1 are functionally **identical**
here (`registration.js` diffs to two comment-only lines; the `strings()` validator is untouched) — so
`oidc-provider` was **exonerated**, despite being the prime suspect. 2.5.0 is the newest 2.x, so **there
is no fixed version to move to**; 2.3.0 is the newest unaffected release.

`node` and `core` must move **together**: `buildAuthenticatedFetch` is `async` in <=2.3.0 and synchronous
in 2.5.0, and mixing `node@2.3.0` with `core@2.5.0` fails at runtime
(`TypeError: this.handleRedirect is not a function`). Pinning both to 2.3.0 restores the `await` at
`Identity.test.ts:395` / `DataboxLive.test.ts:79` — which is simply HEAD's committed code.

**For a human to decide:** this is a genuine CSS <-> inrupt interop bug. Any Solid app using
`solid-client-authn-node` >=2.4.0 with **dynamic client registration** against CSS will hit it on the
redirect leg. Both packages are `devDependencies` (test-only), so **CSS itself ships unaffected** — but
the bug is real for downstream clients and is worth reporting upstream.
