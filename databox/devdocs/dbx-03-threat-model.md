# DBX-03 — Threat Model and Abuse Cases

**Prompt:** DBX-03 (Wave A). **Agent level:** Hard. **Depends on:** DBX-01, DBX-02 (both accepted).
**Status:** complete. **Baseline:** CSS 7.1.9; decisions per [ADR register](decisions/README.md).
**Companion artifact:** [adversarial-test backlog](dbx-03-adversarial-test-backlog.md) (AT-IDs for DBX-25/DBX-26).

## 1. Purpose and method

This is the threat model required by DBX-03. It enumerates attackers and abuse cases across every
participant and trust boundary, maps each threat to a control (citing the ADR or invariant that mandates
it) and to a planned adversarial test, and proves that **every one of the twelve README invariants has at
least one threat and a verification method** (§7), with **hosting-provider administration treated as an
adversary rather than trusted** (invariant 10; boundary B4; threats T-30…T-34).

**Method.** Threats are identified by walking each trust boundary (§3) with an attacker goal in mind and
classifying with STRIDE (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service,
Elevation of privilege). Each threat has a stable `T-nn` identifier, an affected-invariant list, a
control list (`→ ADR-xxxx` / `→ invariant n` / `→ CSS seam` from [DBX-01](dbx-01-extension-map.md)), a
residual-risk note, and a test id (`AT-nn`) in the companion backlog. IDs are stable and are the contract
DBX-26 consumes; new threats get new numbers, they are never renumbered.

**Assets under protection.** (A1) record and submission payloads; (A2) the fact that a relationship exists
(existence metadata); (A3) the cross-program link graph (which programs one person deals with); (A4) the
consumer holder keys and program signing keys; (A5) the evidence ledger and receipts; (A6) authorization
state (grants, relationship status, assurance); (A7) availability of deposit/retrieval/submission.

**Explicitly in scope as adversaries** (prompt + invariant 10): a curious or malicious **provider
operator / support staff**; a malicious **program** (tenant); a malicious or compromised **institutional
bridge**; a compromised **identity provider**; a network attacker; a malicious **consumer** or consumer
agent; and **backups, queues, logs and analytics** as passive disclosure channels. `@solid/access-token-verifier`
and the TLS stack are trusted dependencies (DBX-01, ADR-0001); their compromise is out of scope but noted
as an assumption (§9).

## 2. Attacker profiles

| Id | Attacker | Capability | Primary goal |
|---|---|---|---|
| AP-1 | Malicious program (tenant) | Holds a valid service/consumer identity in its own program | Reach another program's data or correlate a person across programs |
| AP-2 | Curious/malicious provider operator or support staff | Infrastructure access (DB, queues, logs, backups, support tools); no ordinary data-plane token | Read payloads, build a global identity graph, alter evidence |
| AP-3 | External network attacker | Can send requests, sniff/observe metadata, host endpoints | Steal tokens/credentials, enumerate boxes, SSRF the server |
| AP-4 | Compromised institutional bridge | Holds one program's bridge service credential | Write outside its scope, forge records, cross to another program |
| AP-5 | Compromised or hostile IdP | Issues authentication assertions | Smithy assurance/actor claims, impersonate a consumer |
| AP-6 | Malicious consumer / consumer agent | Holds a valid connection to program X | Enumerate another consumer's box, overwrite history, escalate assurance |
| AP-7 | Coercer of a consumer | Can force a consumer to act under duress | Extract data or silence records the consumer holds |
| AP-8 | Passive infrastructure channel | Backups, queue names, log lines, metrics labels, tracing baggage | Leak identifiers / correlate without an active exploit |

## 3. Trust boundaries and diagram

Extends the five boundaries in [isolation-and-privacy.md](isolation-and-privacy.md) with the identity,
bridge and control-plane boundaries that ADR-0005/0016/0002 introduce.

```text
                 external human IdP (AP-5)            coercer (AP-7)
                        |  B6                              |
                        v                                  v
   consumer  --B8-->  consumer agent / vault  --B3(no browse)-->  [ personal storage / other Databoxes ]
     |                   |  ^                                             ^
     |                   |  | holder-key proof (ADR-0008)                 | B3: program must NOT cross here
     |                   v  |                                             |
     |            Databox authorization server / broker (ADR-0005)  ------+
     |                   |  B6/B4 trust boundary; RFC 8693 exchange
     |                   v
     |   =========== DATA PLANE (CSS + LWS adapter) ==================================
     |   |  Databox A (tenant)          | B1: hard tenant wall |     Databox B (tenant) |
     |   |   /boxes/{opaque}/ records/ submissions/ receipts/ audit-view/               |
     |   |        ^                                   ^                                  |
     |   ========|===================================|================================= 
     |           | B7 append-only, scoped            | B2: consumer C1 must NOT reach C2
     |     institutional bridge A (AP-4)       institutional bridge B
     |           ^
     |           | committed source outbox (raw customerID stays here)
     |   ---- CONTROL PLANE (integration + provisioning + keys) : B9 never a consumer token ----
     |           ^                                                     ^
     |     system of record                                    provider operator / support (AP-2)
     |                                                                 | B4: infra access ≠ payload access
     +--- B5: telemetry/analytics must NOT reconstruct the cross-program graph (A3) ---+

   Boundaries: B1 program↔program · B2 consumer↔consumer · B3 program↔wallet (no browsing) ·
   B4 provider-infra↔program-data · B5 operations/analytics↔identity-graph · B6 external-IdP↔broker↔CSS ·
   B7 bridge↔data-plane (scoped append-only) · B8 consumer↔agent · B9 control-plane↔data-plane ·
   B10 control-plane↔key-management (KMS custody separation — distinct from B9 so key-custody is
   independently testable under invariant 10; AP-2 with KMS access is the actor).
```

## 4. Threat register

STRIDE key: S/T/R/I/D/E. Inv = affected invariant(s). Each control cites the ADR/invariant/seam that
mandates it. Test = AT-id in the [backlog](dbx-03-adversarial-test-backlog.md).

### B1 — Cross-program / tenant escape (AP-1, AP-4)

| T | STRIDE | Threat | Inv | Controls | Residual | Test |
|---|---|---|---|---|---|---|
| T-01 | E,I | Change host/path of a valid token to address another program's box | 1,3 | Tenant resolved+validated **before** Solid authz (ADR-0002 subdomain/audience binding; ADR-0011 tenant-bound); token audience = exactly one storage realm (ADR-0009) | Requires correct audience check on every path | AT-01 |
| T-02 | E | Program A service credential used against program B containers | 1 | Per-program service identity, WAC append-only to assigned containers, Databox validation of program+relationship+issuer (ADR-0016 HD-13) | Bridge-key theft → T-20 | AT-02 |
| T-03 | I | Cross-program correlation: join two pairwise subjects to one person | 1,2 | Pairwise WebID+key per program (ADR-0004); no global consumer id in tokens/URLs/logs (invariant 2); analytics use program-local ids only (B5, isolation §analytics) | Timing/side-channel correlation (T-27) | AT-03 |
| T-04 | E | Path-only tenancy lets a crafted URL walk into another tenant | 1,3 | Distinct origin/subdomain per program preferred; path-only discouraged (ADR-0002) | Deployments that still choose path-only | AT-04 |
| T-05 | I | RDF links inside a record point outside the box; client/server follows them cross-tenant | 1,5 | Server does not dereference cross-tenant links on the auth path; ODRL prohibits disclosure outside program (isolation §analytics, ADR-0013) | Consumer agent following links is the agent's risk (B8) | AT-05 |

### B2 — Consumer↔consumer (AP-6)

| T | STRIDE | Threat | Inv | Controls | Residual | Test |
|---|---|---|---|---|---|---|
| T-06 | I | Enumerate another consumer's box/resource by guessing identifiers | 2,3 | ≥128-bit CSPRNG opaque box + independent random resource ids (ADR-0002); authz required for every op incl. existence; knowing a URL never grants access (invariant 3) | Opaque ≠ secret; relies on authz not obscurity | AT-06 |
| T-07 | I | 403-vs-404 oracle reveals that another consumer's box exists | 2,3 | Reuse CSS 404-not-403 existence-hiding (`reportAccessError`, DBX-01 §3; ADR-0025); existence decided separately from payload (ADR-0023) | Timing oracle on the existence check | AT-07 |
| T-08 | E | Consumer of program X reuses their token/credential at program Y | 1,4 | Audience-bound token (ADR-0009); credential program-bound + holder-proof (ADR-0007); replay against another program fails (ADR-0007 failure) | — | AT-08 |

### B3 — Program↔wallet (no browsing) (AP-1)

| T | STRIDE | Threat | Inv | Controls | Residual | Test |
|---|---|---|---|---|---|---|
| T-09 | I,E | Program treats a registered consumer inbox/WebID as a licence to read the wallet | 5,6 | Registration ≠ authorization (isolation §no-wallet-browsing, ADR-0017); notify-then-pull; direct push needs a separate narrow inbox grant | Consumer mis-granting a broad inbox scope | AT-09 |
| T-10 | I | Program infers wallet contents / other connections from submission shape or timing | 5,6 | Submissions are explicit purpose-scoped disclosures (invariant 6, ADR-0017); data minimisation (isolation §minimisation); credential never discloses other connections (ADR-0007) | Statistical inference from what is submitted | AT-10 |
| T-11 | E | "Read the consumer profile" style general query | 5,6 | No general query surface; only explicit consumer POST/create (isolation §no-wallet-browsing) | — | AT-11 |

### B6 — Identity / broker / confused deputy (AP-5, AP-3)

| T | STRIDE | Threat | Inv | Controls | Residual | Test |
|---|---|---|---|---|---|---|
| T-12 | S,E | Smithy an assurance or actor/delegation claim to reach a high-grade record | 9 | Assurance only from verified signed claims, never a header/unverified decode (ADR-0010); unmapped claims fail closed; forged-claim negatives mandatory (ADR-0010, DBX-12 gate) | Compromised *trusted* IdP (T-14) | AT-12 |
| T-13 | S | Accept a token from an unapproved but cryptographically valid issuer | 9 | Per-program issuer trust contract at the broker (ADR-0005); CSS accepts any valid issuer by default (DBX-01 §2) so the broker MUST gate | Misconfigured program trust list | AT-13 |
| T-14 | S | Compromised approved IdP mints assertions for the wrong human | 9 | Customer-linking needs external auth **plus** account-linking challenge **plus** holder-key proof **plus** audited confirmation (ADR-0008); assurance alone never selects a customerID | Full IdP compromise is partially residual → step-up + audit | AT-14 |
| T-15 | E | Confused deputy: broker exchanges a token for a realm the subject isn't granted | 1,9 | Broker resolves active grant for subject+client+realm before issuing; audience = one realm (ADR-0005/0009) | Blocked wire-detail (ADR-0005 §residual) → DBX-12 | AT-15 |
| T-16 | S | Proprietary broker token becomes the only path, breaking independent clients | 12 | Conforming Solid-OIDC path preserved; broker token never the sole path (ADR-0005 S-04, ADR-0025) | — | AT-16 |

### Token & credential replay (AP-3, AP-6)

| T | STRIDE | Threat | Inv | Controls | Residual | Test |
|---|---|---|---|---|---|---|
| T-17 | S | Replay the connection-credential **document** as if it were an access token | 4 | Credential is holder-key-bound, not bearer; copied bytes without fresh key proof fail (ADR-0007, invariant 4) | Vault key theft (T-18) | AT-17 |
| T-18 | S,E | Steal a stored long-lived bearer refresh token from the vault | 4 | No default refresh token; fresh 5-min holder-key JWT per exchange (ADR-0009) — nothing high-value at rest | Holder private-key exfiltration → rotation/revocation (ADR-0009) | AT-18 |
| T-19 | S | Replay a captured short-lived access token (wrong audience/client) | 4 | 5-min lifetime; audience+client+holder binding; sender-constraint for high grades (ADR-0006/0009) | Replay window ≤5 min for low grades | AT-19 |
| T-20 | S,E | Stolen bridge/service signing key forges institutional records | 4,7 | Per-service key, key-history in evidence (ADR-0019); record proof suite (ADR-0020); rotation (ADR-0009) | Key compromise until detected → T-33 | AT-20 |

### B7 — Deposit / submission gateway (AP-4, AP-3, AP-6)

| T | STRIDE | Threat | Inv | Controls | Residual | Test |
|---|---|---|---|---|---|---|
| T-21 | T,E | Malicious RDF / JSON-LD (remote context, entity expansion, poisoned `@context`) on deposit | 7,12 | Pinned/offline contexts (ADR-0020, ADR-0025 S-14); shape validation; unknown terms fail closed (ADR-0013); bounded parsing | Parser 0-day in RDF stack (assumption §9) | AT-21 |
| T-22 | D,T | Oversized/zip-bomb binary evidence exhausts storage or scanner | 7 | Bounded size/media-type; quarantine before serve (ADR-0022); accept only after durable commit (ADR-0019) | Production scanner deferred (ADR-0022 scope) | AT-22 |
| T-23 | T | Misaddressed / wrong-purpose / wrong-class deposit accepted | 1,11 | Gateway validates container, class, legal basis, purpose, policy ref, idempotency (ADR-0016; exchange flow) | — | AT-23 |
| T-24 | E | Duplicate/replayed source event creates a second logical record | 7 | Namespaced idempotency key org/program/system/type/event-id (ADR-0016 HD-12); duplicate returns original outcome (ADR-0019) | — | AT-24 |
| T-25 | T,E | Policy substitution: attach a weaker/forged ODRL policy to a record | 11 | Immutable signed policy versions; gateway resolves+validates; receipt binds compiled-policy+corpus+attestation digests (ADR-0014/0015/0019); substitution detectable | — | AT-25 |

### Append-only / evidence integrity (AP-2, AP-4, AP-6)

| T | STRIDE | Threat | Inv | Controls | Residual | Test |
|---|---|---|---|---|---|---|
| T-26 | T | Overwrite/delete an accepted record via PUT/PATCH/DELETE | 7 | Append-only decorator **below** WAC/owner (ADR-0018); create-yes/replace-no via hasResource (DBX-01 §4); every actor class blocked | — | AT-26 |
| T-27 | T,R | Tamper with or reorder the evidence ledger / audit | 7,8 | Append-only external ledger, hash-chain/WORM-equiv, key history (ADR-0019); ordinary Pod ops cannot rewrite it | Provider with ledger-store access (T-32) | AT-27 |
| T-28 | R | Provider deletes a record and claims the receipt is void | 7,8 | Receipt verifies independently after export; later deletion cannot invalidate an issued receipt (invariant 8, ADR-0019) | — | AT-28 |
| T-29 | T | Tombstone/deletion used to destructively erase rather than mark | 7 | Lawful deletion = tombstone + evidence event, never destructive rewrite (ADR-0018) | — | AT-29 |

### B4 / B9 — Provider operator, support, control plane (AP-2) — invariant 10

| T | STRIDE | Threat | Inv | Controls | Residual | Test |
|---|---|---|---|---|---|---|
| T-30 | I | Operator reads payloads directly from the storage DB / object store | 10 | At-rest encryption with independent per-tenant keys (ADR-0021 §2); provider-blind profile for high-assurance (ADR-0021 §3, Blocked); admin access is high-assurance, purpose-bound, audited (isolation §accountability) | Default (custodian) profile: provider *can* read authored payloads — disclosed, by design (ADR-0021) | AT-30 |
| T-31 | E | Operator mints/uses a platform-wide data-plane credential to bypass tenancy | 1,10 | Explicit denial of platform-wide data-plane credentials (ADR-0016; isolation §tenant controls); control plane never acts through a consumer token (ADR-0002 B9) | Insider with key-management access → T-33 | AT-31 |
| T-32 | T,R | Support tooling / backup-restore path edits or resurrects data outside evidence | 7,10 | Tenant-aware backup/restore/deletion; evidence ledger external and append-only (ADR-0019/0021); operator actions audited | Backup system itself is a disclosure channel (T-35) | AT-32 |
| T-33 | E | Signing/encryption key compromise (program or provider key) | 4,10 | Per-tenant keys; key-history retained; rotation + revocation (ADR-0009/0019/0021); detection via evidence chain | Window between compromise and detection | AT-33 |
| T-34 | I | Operator escalates to reconstruct a cross-program identity graph via admin views | 2,10 | No global consumer key (invariant 2/ADR-0004); tenant-scoped admin roles; analytics program-local (B5) | Collusion across tenant admins → governance/legal control | AT-34 |

### B5 — Metadata / analytics leakage (AP-8)

| T | STRIDE | Threat | Inv | Controls | Residual | Test |
|---|---|---|---|---|---|---|
| T-35 | I | Identifiers leak via URLs, logs, queue names, metrics labels, tracing baggage, notification previews, backups | 2 | No PII/correlator in any of these surfaces (invariant 2; isolation §leakage); notifications carry only opaque event ids (ADR-0011) | Requires disciplined logging config — test-enforced | AT-35 |
| T-36 | I | Notification payload reveals record content to the transport/endpoint | 2,5 | Minimal notification payload, opaque event id only (ADR-0011; exchange §notifications) | — | AT-36 |
| T-37 | I | Cross-program aggregation smuggled in as a "feature" | 2 | Cross-program aggregation is not a protocol feature; needs independent legal basis; thresholding (isolation §analytics) | Governance, not purely technical | AT-37 |

### Outbound delivery / SSRF (AP-3, AP-6)

| T | STRIDE | Threat | Inv | Controls | Residual | Test |
|---|---|---|---|---|---|---|
| T-38 | E,I | SSRF: register a notification/webhook endpoint pointing at internal/metadata addresses | 5 | Endpoint validation, deny private/link-local ranges, bounded redirects (ADR-0011); CSS has **no** SSRF guard today (DBX-01 §6) → net-new control | New code — must be tested hard | AT-38 |
| T-39 | D | Notification failure rolls back an accepted deposit, or falsely marks a duty fulfilled | 7,11 | Notification failure never rolls back an accepted deposit; queued≠fulfilled; duty states distinct (ADR-0011/0012; exchange §atomicity) | — | AT-39 |
| T-40 | D | Flood the outbox / retry loop to exhaust resources | 7 | Bounded backoff, dedup, durable outbox (ADR-0011) | Rate-limit tuning per deployment | AT-40 |

### Availability & interop (AP-3)

| T | STRIDE | Threat | Inv | Controls | Residual | Test |
|---|---|---|---|---|---|---|
| T-41 | D | Broker/AS outage blocks all access | 7,12 | HTTPS operations authoritative; short tokens expire, existing durable records still retrievable per grant; no fallback to raw external tokens (ADR-0005 failure) | Broker is a availability SPOF → deployment HA (DBX-28) | AT-41 |
| T-42 | E,I | Enabling Track B (LWS) silently changes a Track A representation / weakens a control | 12 | Versioned adapters; Track B behind a separate config preset; must not mutate Track A (ADR-0024 S-25) | — | AT-42 |
| T-43 | S | CSRF / cross-origin browser client abuses ambient credentials | 3,12 | Defined CORS/credentials/redirect/cookie/CSRF rules for cross-origin clients (ADR-0025 S-13) | — | AT-43 |

### B8 — Coerced / malicious consumer (AP-7, AP-6)

| T | STRIDE | Threat | Inv | Controls | Residual | Test |
|---|---|---|---|---|---|---|
| T-44 | E | Coerced consumer forced to disclose or delete records they hold | 7,8 | Append-only means the *institutional* record and evidence persist regardless of the vault copy (ADR-0018); receipts independently retained (invariant 8); step-up/assurance for sensitive ops (ADR-0009) | Coercion of the human is only partially a technical control — governance/redress (ADR-0023) | AT-44 |
| T-45 | E | Malicious consumer submits forged high-assurance self-asserted "fact" | 9,11 | Submissions marked preference/self-asserted/verified; crypto validity ≠ truth (isolation §minimisation, ADR-0020); review before source-of-record update (ADR-0016/0017) | — | AT-45 |
| T-46 | R | Consumer repudiates a submission they made | 8 | Signed acceptance receipt binds sender+payload digest+time (ADR-0019); submission signed where appropriate | — | AT-46 |

### Lifecycle, agent-side, injection & supply-chain (red-team additions, T-47…T-58)

These were surfaced by an independent Hard red-team pass (§10) that attacked the register above; they close
systematic blind spots in delegation/recovery/revocation lifecycle, consumer-agent abuse, and the
config-declared supply chain.

| T | STRIDE | Threat | Inv | Controls | Residual | Test |
|---|---|---|---|---|---|---|
| T-47 | E | Appointed guardian/delegate acts **outside** delegated scope, or **after** expiry/revocation | 9 | Delegation grant is scoped + time-bound + status-checked on every op; revocation enforced at the data plane (ADR-0008/0009 guardianship lifecycle) | Full guardianship model → DBX-13/14 | AT-47 |
| T-48 | E | Recovery/migration re-grants access **below** the record's original proofing grade, or preserves obsolete grants across key rotation | 4,9 | Recovery re-binds at ≥ original assurance; email-only reset cannot restore high-proof records; rotation retains provenance but issues fresh scoped grants, dropping obsolete access (ADR-0009) | — | AT-48 |
| T-49 | E | Use a still-valid 5-min token **after** the relationship/credential is revoked (revocation-latency window) | 4,9 | Per-request relationship/grant status re-check (not only at mint) for sensitive grades; bounded, disclosed window for low grades (ADR-0009) | ≤ one token lifetime for low grades (accepted, §8) | AT-49 |
| T-50 | D,R | A duty (retention deletion, prior-recipient correction propagation, correction clock) is unfulfilled/failed but recorded **fulfilled**, or never evaluated | 11 | Typed duty states; fulfilment requires handler evidence; unevaluated/failed fails closed, never "fulfilled"; every transition in evidence (ADR-0012, ADR-0019) | — | AT-50 |
| T-51 | I,E | A deposited record is crafted (active links, rendering directives, ODRL) to make the **consumer agent** exfiltrate other-connection data or auto-submit — confused-deputy on the agent | 5,6 | Retrieved records are inert data; agent contract: safe-rendering, no auto-dereference, no auto-submit; profile bans active content (ADR-0017; consumer-agent contract DBX-24) | Agent implementation quality → DBX-24 | AT-51 |
| T-52 | S | Relay/MITM the connection-ceremony **holder-key proof** (step 5) so the credential binds an attacker-controlled key | 4 | Channel-bound / nonce'd proof; key confirmed in the audited step-7 issuance (ADR-0008) | — | AT-52 |
| T-53 | I | A submission is made or **over-scoped** without genuine explicit per-purpose consumer authorization; or a direct-push inbox grant is abused beyond its named inbox/expiry | 6 | Explicit consumer authorization per submission; push grant is resource/purpose-scoped and expiring, verified on every write (ADR-0017; isolation §no-wallet-browsing) | Consumer mis-granting a broad scope | AT-53 |
| T-54 | E | TOCTOU: the tenant/mapping mutates **between** tenant resolution and the ResourceStore operation, landing an op in the wrong tenant | 1 | Resolved tenant identity carried immutably into the operation; the store re-validates the target's tenant binding at execution (ADR-0002/0016; DBX-11) | Net-new resolver — test hard | AT-54 |
| T-55 | T | Audit/log **injection**: attacker-controlled fields (WebID, purpose, reason, policy ref) inject CRLF into logs or malicious triples into the RDF audit projection / consumer audit-view | 7,8 | Untrusted fields escaped/typed before ledger write; audit projection encodes untrusted values; ledger entries are structured, not string-concatenated (ADR-0019) | — | AT-55 |
| T-56 | I | Revocation-status check leaks a correlator via BitstringStatusList index / herd size / status-endpoint access | 2 | Adequate herd size; non-correlating index allocation; private/aggregated status retrieval (ADR-0007 residual) | Status-list privacy detail → DBX-13 | AT-56 |
| T-57 | D | Crafted policy/credential forces pathologically expensive ODRL conflict resolution or chained VC verification on the auth path | 7 | Bounded policy complexity + a verification budget/timeout; exceed → fail closed (ADR-0012/0013) | Tuning per deployment | AT-57 |
| T-58 | T,E | A malicious/compromised **Components.js module** in the Databox config preset silently replaces a security decorator (append-only store, SSRF guard, tenant resolver) — one swap defeats every net-new control at once | 10,12 | Pinned module digests; config/preset attestation; startup integrity check; SBOM + dependency/secret scan (ADR-0024 separate-preset mechanism; DBX-28) | Supply-chain trust root → DBX-28 | AT-58 |

## 5. Control mapping summary

Every control above traces to a binding decision. The dominant control sources:

- **Tenant isolation:** ADR-0002 (topology, opaque ids, control/data plane), ADR-0016 (mapping, per-bridge
  scope, no platform-wide credential), enforced before Solid authz (DBX-11).
- **Identity/assurance/confused-deputy:** ADR-0004 (pairwise), ADR-0005 (broker trust), ADR-0008 (linking
  ceremony), ADR-0010 (assurance from verified claims only).
- **Token/credential:** ADR-0006 (sender-constraint), ADR-0007 (holder-bound credential), ADR-0009 (short
  tokens, revocation).
- **Integrity/evidence:** ADR-0018 (append-only), ADR-0019 (evidence ledger + receipts), ADR-0014/0015/0020
  (policy + record proof binding, substitution detection).
- **Delivery/SSRF/leakage:** ADR-0011 (durable delivery + SSRF guard + minimal payloads), invariant 2.
- **Provider-as-adversary:** ADR-0021 (encryption boundary), ADR-0016/0002 (no platform-wide credential),
  ADR-0019 (external append-only ledger), isolation §accountability (audited admin).
- **Interop safety:** ADR-0024 (track isolation), ADR-0025 (standard surface, existence hiding, CORS).

## 6. Net-new controls flagged by DBX-01 (highest implementation risk)

These controls have **no existing CSS mechanism** and are therefore the riskiest to get right; DBX-26 must
test them adversarially, not assume them:

1. **SSRF/endpoint validation** on outbound delivery (T-38) — CSS webhook emitter has none (DBX-01 §6).
2. **Durable cursor recovery** (T-39) — CSS notifications are best-effort in-memory (DBX-01 §6).
3. **Append-only create-yes/replace-no decorator** (T-26) — adapt `ReadOnlyStore` with a `hasResource`
   check (DBX-01 §4).
4. **Assurance-aware context** carried outside WAC (T-12) — `Credentials` has no assurance field and WAC
   drops client/issuer (DBX-01 §2/§3).
5. **Opaque random box identifiers** (T-06) — CSS pod ids are slug-derived (DBX-01 §5).
6. **Tenant resolution before authorization** (T-01/T-31) — no tenant concept exists (DBX-01 §5).

## 7. Invariant → threat → verification coverage matrix (acceptance gate)

Every invariant has ≥1 threat and a verification method. **Invariant 10 (provider administration is a
threat) is covered by a dedicated boundary B4/B9 and threats T-30…T-34** — provider admin is modelled as
an adversary, not trusted.

| Invariant | Threats | Verification (AT) |
|---|---|---|
| 1 — one program, one relationship | T-01,T-02,T-03,T-04,T-15,T-23,T-31,T-34,T-54 | AT-01,02,03,04,15,23,31,34,54 |
| 2 — no identifying data in URLs/logs/paths | T-03,T-06,T-34,T-35,T-36,T-37,T-56 | AT-03,06,34,35,36,37,56 |
| 3 — knowing a URL never grants access | T-01,T-04,T-06,T-07,T-43 | AT-01,04,06,07,43 |
| 4 — credential holder-bound; tokens short/audience-bound | T-08,T-17,T-18,T-19,T-20,T-33,T-48,T-49,T-52 | AT-08,17,18,19,20,33,48,49,52 |
| 5 — no wallet/other-box browsing | T-05,T-09,T-10,T-11,T-36,T-38,T-51 | AT-05,09,10,11,36,38,51 |
| 6 — submissions are explicit disclosures | T-09,T-10,T-11,T-51,T-53 | AT-09,10,11,51,53 |
| 7 — no silent overwrite; linked auditable events | T-21,T-22,T-24,T-26,T-27,T-29,T-32,T-39,T-40,T-44,T-55,T-57 | AT-21,22,24,26,27,29,32,39,40,44,55,57 |
| 8 — independently retainable signed receipt | T-27,T-28,T-44,T-46,T-55 | AT-27,28,44,46,55 |
| 9 — sensitivity vs current assurance, not ownership | T-12,T-13,T-14,T-15,T-45,T-47,T-48,T-49 | AT-12,13,14,15,45,47,48,49 |
| 10 — provider administration is a threat | T-30,T-31,T-32,T-33,T-34,T-58 | AT-30,31,32,33,34,58 |
| 11 — rights/duties travel as versioned ODRL, auditable | T-23,T-25,T-39,T-45,T-50 | AT-23,25,39,45,50 |
| 12 — preserve standard Solid surface for independent clients | T-16,T-21,T-42,T-43,T-58 | AT-16,21,42,43,58 |

Prompt-named threat classes all mapped: cross-program correlation (T-03,T-34), tenant escape (T-01,T-02,
T-04,T-31), confused deputy (T-15), token replay (T-17,T-18,T-19), identifier enumeration (T-06,T-07),
SSRF (T-38), malicious RDF (T-21), policy substitution (T-25), audit tampering (T-27,T-32), operator
bypass (T-30,T-31,T-32), key compromise (T-20,T-33), coerced consumers (T-44).

## 8. Residual-risk register (accepted, with owner)

| Risk | Threats | Why residual | Owner / mitigation path |
|---|---|---|---|
| Default (custodian) profile lets the provider read authored payloads | T-30 | S-24 custodian model; correction/review need readable payloads (ADR-0021) | Disclosed in accountability record; provider-blind profile is the opt-in (ADR-0021 Blocked → DBX-11 + legal) |
| Full compromise of an approved IdP | T-14 | External trust root | Step-up + audited linking ceremony (ADR-0008) bound the blast radius; program IdP accreditation |
| Key compromise window before detection | T-20,T-33 | Detection is not instantaneous | Short tokens, key-history, rotation/revocation (ADR-0009/0019); monitoring (DBX-28) |
| Statistical/timing correlation across pairwise ids | T-03,T-10 | Cannot be fully eliminated | Minimisation, program-local analytics, thresholding (isolation §analytics) |
| Production malware scanning deferred | T-22 | Hackathon scope (ADR-0022) | Quarantine state machine now; scanner at DBX-15 production |
| Coercion of the human | T-44 | Not a purely technical problem | Append-only persistence + independent receipts + redress routes (ADR-0018/0023) |
| RFC 8693 credential-binding wire detail unresolved | T-15 | ADR-0005 Blocked sub-question | DBX-12 token-exchange ADR |
| Broker availability SPOF | T-41 | Architectural | HA deployment + ops runbooks (DBX-28) |
| Revocation-latency window for a live low-grade token | T-49 | Short tokens expire; per-request re-check reserved for sensitive grades | Bounded ≤ token lifetime; sensitive grades re-checked (ADR-0009) |
| Full guardianship/delegation lifecycle unspecified | T-47 | ADR-0009 names the events; detail deferred | DBX-13/DBX-14 model scope, expiry, revocation enforcement |
| Consumer-agent quality (safe rendering, no auto-submit) | T-51 | Agent is consumer-chosen software | Agent contract + reference agent hardening (DBX-24) |
| Status-list herd privacy | T-56 | BitstringStatusList index is a potential correlator | Herd size + non-correlating allocation (ADR-0007 → DBX-13) |
| Supply-chain / module integrity | T-58 | Whole security model is config-declared module swaps | Pinned digests + config attestation + SBOM (DBX-28) |

## 9. Trusted-dependency assumptions (out of scope, stated)

- `@solid/access-token-verifier` correctly verifies Solid-OIDC/DPoP (DBX-01 §2); its compromise is out of
  scope.
- The TLS stack and certificate trust are sound (ADR-0021).
- The RDF/JSON-LD parser has no unpatched RCE/expansion 0-day beyond the bounded-parsing controls (T-21).
- The Components.js **runtime** is trusted, but the **integrity of the specific modules/preset** wired
  into a deployment is now an in-scope threat (T-58), not an assumption — because the entire security model
  is config-declared module swaps. Module-digest pinning, preset attestation and SBOM/dependency scanning
  are the controls (DBX-28).

These assumptions are explicit so DBX-27/DBX-28 can revisit them at release.

## 10. Independent red-team pass

After the register above was drafted, an independent Hard security agent (that did not write it) attacked
its coverage on five axes: missing threats, invariants with weak coverage, controls that do not fully
mitigate, unfalsifiable tests, and boundary gaps. Its findings were incorporated verbatim as **T-47…T-58**
(§4 last table), **AT-47…AT-58** (backlog), boundary **B10** (§3), and the residual-risk additions (§8).
The most consequential structural findings it surfaced:

- **Lifecycle was the biggest blind spot:** guardianship scope/revocation (T-47), recovery/migration
  downgrade and obsolete-access retention (T-48), and the revoke→enforcement latency window (T-49) — the
  hardest cases of invariants 4 and 9 were previously untested.
- **Two invariants had thin, near-tautological coverage:** invariant 6 (submissions as explicit disclosure)
  restated invariant 5 — fixed by T-51/T-53; invariant 11 (auditable duties) tested only the notify duty —
  fixed by T-50 (a duty handler that no-ops but reports fulfilled).
- **The consumer agent was treated as always-benign:** a deposited record crafted to coerce the agent into
  leaking (T-51) was previously punted to "the agent's risk."
- **Supply chain was under-weighted:** one compromised module in the preset defeats every net-new control
  at once (T-58) — promoted from an assumption to a P1 threat.

This adversarial pass is itself the verification method the DBX-03 acceptance gate asks for at the model
level; the per-threat verification methods are the AT tests. A second independent reproduction of the P1
negatives is scheduled at DBX-26.
