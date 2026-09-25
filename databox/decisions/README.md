# DBX-02 — Normative Decision Register (index)

**Prompt:** DBX-02 (Wave A). **Agent level:** Hard. **Depends on:** DBX-01.
**Status:** complete. **Baseline pinned by:** [ADR-0001](ADR-0001-specification-baseline-pinning.md).

This register is the single source of truth for every binding Databox decision. Each decision is one ADR
under `databox/decisions/`, following [ADR-TEMPLATE.md](ADR-TEMPLATE.md). This index maps every input
question — the 18 implementation-review items, S-01…S-27, R-01…R-14, HD-01…HD-16, and the DBX-02 prompt's
explicit topic list — to the ADR that resolves it, so a dependent prompt can confirm **no contract depends
on an undocumented choice** (the DBX-02 acceptance gate). Unresolved items are listed in §6 with the exact
input that unblocks them and the prompts they block.

## 1. Status legend

| Status | Meaning |
|---|---|
| **Adopted** | A binding Databox requirement, fully specified for its scope. |
| **Adopted-with-scope** | Adopted now for a bounded scope; a named production/legal extension is deferred. |
| **Profile choice** | Each program must declare and validate its choice; the register fixes the frame. |
| **Blocked (decision required)** | Cannot be finalised yet; §6 names the unblocking input, its owner, and the prompts blocked. |
| **Rejected-as-stated** | The proposed answer would create false assurance/unsafe behavior; the ADR records the safe replacement. |

## 2. ADR index

| ADR | Title | Status | Residual human review | Primary blocks |
|---|---|---|---|---|
| [0001](ADR-0001-specification-baseline-pinning.md) | Pinned specification baseline | Adopted | — | DBX-27, all track claims |
| [0002](ADR-0002-topology-tenancy-and-storage-controller.md) | Topology, tenancy & storage controller | Adopted | security | DBX-04, DBX-10, DBX-11 |
| [0003](ADR-0003-solid-authorization-baseline.md) | Solid authorization baseline (WAC now, ACP-neutral) | Adopted | security | DBX-07, DBX-14 |
| [0004](ADR-0004-identifiers-and-pairwise-webid.md) | Identifiers & pairwise WebID | Adopted | identity, privacy | DBX-10, DBX-13, DBX-24 |
| [0005](ADR-0005-authorization-server-broker-and-idp-trust.md) | Authorization server / broker & IdP trust | Adopted (1 Blocked sub-q) | security, identity | DBX-12, DBX-04 |
| [0006](ADR-0006-lws-auth-suites-and-sender-constraint.md) | LWS auth suites & sender-constraint | Adopted-with-scope | security, crypto | DBX-12, DBX-14 |
| [0007](ADR-0007-connection-credential-format-and-status.md) | Connection credential format & status | Adopted | crypto, privacy | DBX-13, DBX-24 |
| [0008](ADR-0008-proof-ceremony-and-customer-linking.md) | Proof ceremony & customer linking | Adopted | identity, security | DBX-13, DBX-22 |
| [0009](ADR-0009-token-offline-stepup-revocation-lifecycle.md) | Token / offline / step-up / revocation lifecycle | Adopted | security | DBX-12, DBX-13 |
| [0010](ADR-0010-assurance-vocabulary-and-crosswalk.md) | Assurance vocabulary & crosswalk | Adopted (crosswalk = Profile choice) | identity, security | DBX-06, DBX-12, DBX-14 |
| [0011](ADR-0011-durable-notification-and-recovery.md) | Durable notification & missed-event recovery | Adopted | — | DBX-21, HAK-08 |
| [0012](ADR-0012-odrl-duty-catalogue-and-fulfilment.md) | ODRL duty catalogue & fulfilment states | Adopted | — | DBX-20, DBX-21, HAK-05 |
| [0013](ADR-0013-odrl-conflict-and-precedence.md) | ODRL conflict strategy & precedence | Adopted | — | DBX-07, DBX-14, DBX-20 |
| [0014](ADR-0014-policy-versioning-and-effective-time.md) | Policy versioning & effective-time | Adopted | — | DBX-06, DBX-20 |
| [0015](ADR-0015-legal-policy-compilation-boundary.md) | Legal-policy compilation boundary & attestation | Adopted-with-scope (+Blocked release gate) | legal-policy, crypto | DBX-07, DBX-20; legal-compliance profile |
| [0016](ADR-0016-integration-plane-and-relationship-mapping.md) | Integration plane & relationship mapping | Adopted | — | DBX-10, DBX-22, DBX-23 |
| [0017](ADR-0017-data-exchange-and-social-sharing.md) | Data exchange & social-sharing boundary | Adopted | — | DBX-15, DBX-23, DBX-24 |
| [0018](ADR-0018-append-only-supersession-tombstone.md) | Append-only, supersession & tombstone | Adopted | — | DBX-17, HAK-07 |
| [0019](ADR-0019-receipts-states-and-evidence-ledger.md) | Receipts, states & evidence ledger | Adopted | — | DBX-18, DBX-19, HAK-07 |
| [0020](ADR-0020-record-proof-suite-and-status.md) | Record proof suite & status | Adopted | crypto | DBX-16, HAK-06 |
| [0021](ADR-0021-encryption-boundary.md) | Encryption boundary | Profile choice (1 Blocked sub-q) | security, legal-policy | DBX-11, deployment profile |
| [0022](ADR-0022-binary-evidence-and-quarantine.md) | Binary evidence & quarantine | Adopted-with-scope | — | DBX-15, DBX-16 |
| [0023](ADR-0023-record-awareness-access-correction.md) | Record awareness, access & correction | Adopted (CDR profile = candidate) | legal-policy | DBX-14, DBX-23 |
| [0024](ADR-0024-track-separation-and-experimental-isolation.md) | Track separation & experimental isolation | Adopted | — | DBX-09, DBX-27, DBX-28 |
| [0025](ADR-0025-solid-interoperability-guarantee.md) | Solid interoperability guarantee | Adopted | — | DBX-05, DBX-24, DBX-27 |
| [0026](ADR-0026-deployment-and-customer-onboarding.md) | Single-org deployment & consumer-pod access | Adopted (consumer pod required) | identity, privacy | DBX-13, DBX-24 |
| [0027](ADR-0027-personal-nat-traversal-and-tls.md) | Personal Databox NAT traversal & TLS delivery mode | Adopted-with-scope | privacy | CIV-A02, CIV-A05, CIV-A08 |
| [0028](ADR-0028-interchangeable-rdf-store.md) | Interchangeable RDF/SPARQL store (Oxigraph ↔ QualiaDB, unbundled) | Adopted | extensibility, licensing | CIV-B53..56 |

## 3. Coverage — implementation-review items (1–18)

Every item in [implementation-decisions.md](../implementation-decisions.md) is adjudicated. "Verdict"
records how this register resolves it (several were **Rejected-as-stated** in the source and the ADR keeps
the safe replacement).

| Item | Question (abbrev.) | ADR | Verdict |
|---|---|---|---|
| 1 | Which IdPs accepted? | 0005 | Profile choice (per-program trust contract) |
| 2 | Broker / token exchange required? | 0005 | Adopted (separately deployable broker) |
| 3 | LoA → access grade | 0010 | Adopted (multi-dimension crosswalk) |
| 4 | Connection credential = long-running authority? | 0007 | Adopted (holder-bound, not bearer) |
| 5 | Bind WebID + DID + key? | 0004 | Rejected-as-stated (WebID + holder key; DID optional) |
| 6 | Refresh / revoke / step-up | 0009 | Adopted (no default refresh; prompt revocation) |
| 7 | WebSockets required? | 0011 | Adopted (No — HTTPS authoritative) |
| 8 | LDN mandatory durable baseline? | 0011 | Adopted (No — cursor feed is the contract) |
| 9 | Recover missed events from outbox? | 0011 | Rejected-as-stated (define cursor recovery API) |
| 10 | When is a notify duty fulfilled? | 0012 | Adopted (typed duties, distinct states) |
| 11 | ELI provides versioning/pinning? | 0015, 0014 | Rejected-as-stated (immutable corpus manifest) |
| 12 | Evaluator decides commencement/repeal? | 0015 | Rejected-as-stated (compilation stage + attestation) |
| 13 | Machine outputs proposed until attested? | 0015 | Adopted-with-scope |
| 14 | WebCivics→ODRL mapping already defined? | 0013, 0015 | Decision required → owned by DBX-07 |
| 15 | Policy conflict precedence settled? | 0013 | Adopted (deterministic 5-stage strategy) |
| 16 | Appeal = step-up or staff queue? | 0023 | Rejected-as-single-choice (both, distinct routes) |
| 17 | Policy updates affect only new records? | 0014 | Rejected-as-stated (effective-time + re-eval rules) |
| 18 | Receipt proves governing corpus? | 0019, 0020 | Rejected-as-stated (multi-digest binding) |

## 4. Coverage — Solid/LWS interoperability questions (S-01…S-27)

Each is **resolved** by an ADR or explicitly routed to a later prompt as a **residual gate** (never left
undocumented). None is Blocked.

| S | ADR(s) | Disposition |
|---|---|---|
| S-01 | 0001 | Resolved — signed baseline manifest |
| S-02 | 0002 | Resolved — advertised storage subtree topology |
| S-03 | 0005, 0025 | Resolved — independent issuer/WebID after onboarding |
| S-04 | 0005 | Resolved — conforming Solid-OIDC path preserved |
| S-05 | 0025 | Resolved — adopted Solid-OIDC client identification |
| S-06 | 0004 | Resolved — user-controlled pairwise WebID |
| S-07 | 0025, 0018 | Resolved — capability matrix; append-only via method denial |
| S-08 | 0003 | Resolved — WAC baseline, narrow-never-broaden |
| S-09 | 0025 | Resolved — standard discovery, no hidden SDK registry |
| S-10 | 0025 | Resolved — safely-ignorable RDF extensions |
| S-11 | 0011 | Resolved — Solid channels vs Databox durable contract separated |
| S-12 | 0025 | Resolved — standard codes/challenges, no existence leak |
| S-13 | 0025 | Resolved — CORS/credentials/CSRF rules defined |
| S-14 | 0020, 0025 | Resolved — offline verification, pinned contexts |
| S-15 | 0025 | Resolved — guaranteed basic experience + progressive enhancement |
| S-16 | 0025 | Resolved (frame); **residual gate:** ≥2 independent stacks + 1 issuer proof → DBX-27 |
| S-17 | 0024, 0001 | Resolved — compatibility manifest + upstream-change watch |
| S-18 | 0024 | Resolved — separate Track A / Track B results |
| S-19 | 0006, 0008 | Resolved — LWS access-request/grant carries the ceremony |
| S-20 | 0005 | Resolved — broker is the LWS AS where Track B enabled |
| S-21 | 0006 | Resolved — OIDC + self-signed CID; SAML/DID optional |
| S-22 | 0004 | Resolved — typed directional identifier bindings |
| S-23 | 0006, 0009 | Resolved — Bearer for low grades, sender-constraint for high |
| S-24 | 0002 | Resolved — organisation is storage controller/custodian |
| S-25 | 0024, 0025 | Resolved — versioned adapters; Track A unchanged by Track B |
| S-26 | 0011, 0024 | Resolved — LWS notification text is not the durable contract |
| S-27 | 0024 | Resolved — maturity/graduation gate for WD features |

## 5. Coverage — recommendations (R), hackathon decisions (HD), and DBX-02 topic list

**R-01…R-14 → ADRs:** R-01→0003 · R-02→0004 · R-03→0005 · R-04→0007 · R-05→0009 · R-06→0010 ·
R-07→0011 · R-08→0012 · R-09→0016 · R-10→0017 · R-11→0018/0019 · R-12→0015 · R-13→0024 · R-14→0023.

**HD-01…HD-16 → ADRs:** HD-01→0004 · HD-02→0004 · HD-03→0003 · HD-04→0017 · HD-05→0007/0020 ·
HD-06→0007/0008 · HD-07→0006/0009 · HD-08→0016 · HD-09→0016 · HD-10→0016 · HD-11→0008 · HD-12→0016 ·
HD-13→0016 · HD-14→0017 (fixture content; built in DBX-08) · HD-15→0017 · HD-16→0016 (systems; built in DBX-08).

**DBX-02 explicit topic list → ADRs:** box topology→0002 · ownership→0002 · consumer proof ceremony→0008 ·
pairwise identifiers→0004 · assurance vocabulary→0010 · notification mechanism→0011 · receipt states→0019 ·
append-only rules→0018 · deletion/tombstones→0018 · policy versioning→0014 · ODRL conflict strategy→0013 ·
VC proof/status format→0007 (credential) + 0020 (records) · encryption boundary→0021 · binary evidence→0022.

## 6. Blocked / gated decisions (the only unresolved items) and what they block

Two Blocked sub-questions and one Blocked release gate. Each names its unblocking input, owner, and blocked
prompts — nothing else in the register is unresolved.

| Where | What is Blocked | Unblocking input (owner) | Blocks |
|---|---|---|---|
| [ADR-0005](ADR-0005-authorization-server-broker-and-idp-trust.md) §residual | Exact RFC 8693 wire semantics binding the connection credential + fresh holder-key proof into token exchange (subject- vs actor-token) | The token-exchange ADR against the pinned LWS draft (**DBX-12**, with DBX-13) | DBX-12; the unattended-sync path of HAK-04. The rest of ADR-0005 (broker adoption, per-program IdP trust) is Adopted and unblocks DBX-04/DBX-06 now. |
| [ADR-0021](ADR-0021-encryption-boundary.md) §residual | Whether/how a high-assurance **provider-blind** encryption profile is offered | Custodianship/legal determination (**ADR-0002 + R-12 legal workstream**) + key-custody design from a **named security reviewer** | Only the provider-blind profile. TLS (mandatory) and at-rest-per-tenant (Profile choice) are decided; DBX-11 proceeds. |
| [ADR-0015](ADR-0015-legal-policy-compilation-boundary.md) §residual | **Legal-compliance release gate** | (1) actual legislation corpus ingested + content-digest-pinned; (2) authorized human attestation of the WebCivics/legal→ODRL mapping (**separate Hard legal-policy prompt via DBX-07**; accountable human legal reviewer) | Only a legal-compliance *release claim* (and the CDR profile in ADR-0023). All technical work on synthetic policies (DBX-07, DBX-20) is explicitly **not** gated. |

## 7. Residual human-review gates (DBX-02 rule)

Per the plan, cryptographic/identity ADRs need Hard + human security/identity review, and ODRL/legal ADRs
need human policy review, before the dependent production code is accepted. These are **not** self-certified
by DBX-02. Flagged for human review: **security/identity** — ADR-0002, 0003, 0004, 0005, 0006, 0007, 0008,
0009, 0010; **cryptography** — ADR-0006, 0007, 0015, 0020; **legal-policy** — ADR-0015, 0021, 0023. The
independent Hard reviewer for the authorization composition is scheduled at DBX-14; adversarial tenant
review at DBX-11/DBX-26.

## 8. Acceptance-gate self-check

- **"No later contract depends on an undocumented choice":** §§3–5 map every review item, S-question,
  R-recommendation, HD-decision and DBX-02 topic to a specific ADR. ✔
- **"Unresolved decisions explicitly identify which prompts they block":** §6 lists all three Blocked items
  with unblocking input, owner and blocked prompts; the rest of each partially-blocked ADR is Adopted and
  unblocks its consumers now. ✔
- **"Alternatives, consequences, recommendation, status per decision":** every ADR carries Alternatives,
  Consequences, Failure behavior and a Status field per [ADR-TEMPLATE.md](ADR-TEMPLATE.md). ✔
- **"Pin the dated specification baseline":** [ADR-0001](ADR-0001-specification-baseline-pinning.md). ✔
