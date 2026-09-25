# CIV-A13 — Qualified input, information asymmetry, disputes, specialist credentials

**Status:** accepted
**Wave:** 1
**Depends on:** CIV-A11, CIV-A12

## What landed

The four mechanisms the user's scenario asked for, all in `personal/household/`:

### Qualified input — the specialist weighs more *in their field*

`GuardianshipRelation.specialties: GuardianshipScope[]` + `advisoryWeightOf(relation,
scope)` — a relation specialised in a scope carries +50 advisory weight there. The
cardiologist's input on a `medical` decision outranks a lay relative's, but **advice is
ordered, not voted** — deciding authority stays with the accountable guardians (the
specialist informs; the guardians decide and are responsible). `resolveDecision`'s
`consulted` list is weight-ordered, and advisory-only relations (no decision scope, but
qualified input) count — a relation is in-force with zero scopes if it has specialties or
information access.

### Information asymmetry — privy ≠ deciding

`GuardianshipRelation.informationAccess` declares which scopes a relation may *see records
in* without deciding. `resolveDecision` returns `informationHolders` — the deciders plus
explicitly-privy relations. A grandparent can see the daily-care log without seeing the
medical file; a guardian sees the specialist's report because they're deciding.

### Dispute resolution — escalation with independence

`GuardianNetwork.openDispute(requestId, resolver)` / `resolveDispute(...)` — a persistent
deadlock or veto escalates to a `mediator` / `tribunal` / `court`. Independence is
structural: the resolver must not be the ward, a guardian of the ward, or the requester —
a party to the dispute cannot resolve it. A mediator must declare an `organisation` so
independence is checkable. The determination (`uphold`/`deny`/`remit`) + rationale are
recorded; only the declared resolver may determine.

### Specialist access — admin-asserted credentials for justice & emergency medical

`SpecialistAccessStore` — a household **admin** asserts a scoped, time-bounded, audited
grant for a specialist agent:

- `accessClass: 'justice'` — court/tribunal/child-protection officers under an order.
- `accessClass: 'emergency-medical'` — paramedic/ED break-glass when deciders are
  unreachable.

A grant requires a named `basis` (`court-order:FCOA-…`, `emergency-protocol:ambulance-
act-s.17`), explicit scopes, a future `expiresAt` (no standing passes), a `reviewBy`, and
**at least one notified member** — break-glass access is never silent. `mayAccess` is
fail-closed (wrong class/scope/expired → denied); `revoke` is admin-only and the record
is kept (revocation is a status flip, not a deletion — auditability).

## Decisions taken

- **Advice weight vs decision authority are separate axes** — the user asked for
  "specialist more weight than a relative in their field" — weight on the *input*, not
  the *vote*. The responsible decider stays the guardian; the specialist is recorded as
  the strongest advisor. This keeps accountability where the duty lies.
- **Independence is checked, not asserted** — `openDispute` refuses any resolver who's a
  party to the network.
- **No standing specialist passes** — every grant expires and notifies; the access is a
  credential asserted against a named legal basis, not ambient privilege.

## Verification

`SpecialistAccess.test.ts` — 15 tests: advisory-weight ordering, consulted/information-
holders separation, per-scope information isolation, dispute independence + declared-
resolver-only determination + mandatory rationale, grant assertion/scoping/expiry/
notification/revocation fail-closed. 101 personal+module tests green.

## Residual / notes

- The `ward-decision` consent kind now takes caller-resolved approvers — the seam between
  the network's resolution and the vote.
- Remitting a dispute (`remit`) doesn't auto-reopen a request — the household layer
  records it; the follow-up decision is a new request (honest: remit ≠ silent retry).
- The specialist grants are the household-side capability credential; the org-side
  `access/CredentialGate` (B-series) is the verified-credential equivalent — the two are
  complementary (household asserts for its agents; org verifies externally-issued VCs).
