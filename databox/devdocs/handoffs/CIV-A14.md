# CIV-A14 — Household HTTP surface (`/.databox/household`)

**Status:** accepted
**Wave:** 1
**Depends on:** CIV-A09, A11, A12, A13

## What landed

The reachable face of the guardianship layer — until now the network/recipes/decisions
existed only in-process. `HouseholdHttpHandler` (mounted at `/.databox/household` on a
family/share-house preset) + `HouseholdService` (the composition facade over
`GuardianNetwork` + `HouseholdConsentStore` + `WardDecisionService` + `SpecialistAccessStore`).

## The auth model — members, not the owner

Unlike `/.databox/personal` (owner-WebID), the household surface authenticates **members**:
the caller's WebID resolves to a `memberId` via `member.webId`. A dad in a second household,
a kinship carer, a supporter — each acts under their own identity. The one external surface is
the dispute resolver, authenticated by their own WebID matched to the declared resolver.

**The caller is always the resolved member** — `requesterId`/`approver`/`assertedBy` come
from the WebID, never the request body. No one may act as another member by naming them.

## Routes

- `POST /relations`, `GET /relations?ward=` — admin asserts a guardian relation; list a
  ward's relations.
- `GET /recipes`, `GET /recipes/{id}` — the safety catalog (detail includes the SHACL shape).
- `POST /decisions` — open a ward-decision request (wardId, recipeId, scope, household,
  wardPreference, decisionTurtle).
- `POST /decisions/{id}/decide` — a resolved approver approves/denies; on quorum the record
  is SHACL-validated before it stands.
- `GET /decisions/{id}` — status.
- `POST /decisions/{id}/dispute` — a member escalates to an external resolver.
- `POST /disputes/{requestId}/resolve` — the declared resolver's determination (external
  WebID; independence checked inside).
- `POST /specialist-access`, `POST /specialist-access/{id}/revoke`, `GET /specialist-access`
  — admin asserts/revokes a justice/emergency-medical credential; members audit.

## Fail-closed posture

401 without credentials; 403 for an unbound WebID (a stranger cannot even enumerate the
route surface — discovery requires membership); a non-admin asserting a relation or grant
→ 403; a non-approver voting → 403; a non-resolver determining a dispute → 403.

## Verification

`HouseholdHttpHandler.test.ts` — 7 tests: auth gates, admin-only relation assertion,
recipe catalog + SHACL detail, the full medical-major decision (both parents approve →
approved), act-as-another refused, dispute independence (a party can't resolve; the
declared resolver can), specialist-grant assert/audit/revoke. 115 personal+consume+module
tests green; lint + tsc clean.

## Residual / notes

- In-memory stores per convention — the pod-persistence projection (guardian relations,
  consent requests, decision records to the household's audit container) is the same
  follow-up noted across the household layer.
- `HouseholdMember.webId` added (optional) — the binding the surface resolves callers by.
