# CIV-A11 — Guardianship model: precedence, scopes, multi-household, capacity

**Status:** accepted
**Wave:** 1
**Depends on:** CIV-A09

## What landed

`src/databox/personal/household/Guardianship.ts` + `GuardianNetwork.ts` — the rights-
anchored guardianship substrate:

- **Guardian kinds with unequal precedence** (`parent` 100, `appointed` 90, `attorney`
  80, `kinship` 60, `professional` 40, `supporter` 0) — defaults, overridable per-relation
  (a court order raising a kinship carer above a parent is an explicit `precedence`
  override, not a hidden rule).
- **Nine duty scopes** — residence, medical, financial, education, online-contact,
  location-sharing, data-sharing, daily-care, legal. A relation covering zero scopes is
  inert; guardianship is a set of scoped authorities, never blanket control.
- **Multi-household** — a relation names the households it operates in; `guardiansFor` is
  household-aware (dad's online-contact authority is house-b only, nan's is house-a).
- **Capacity scale** — `full` / `emerging` (CRC Art. 5: decides with guardian
  counter-signature on scoped matters, shrinking as capacity grows) / `limited` /
  `supported` (CRPD Art. 12: retains capacity — supporters advise, never substitute).
  `HouseholdMember.capacity` now carries all four.
- **`GuardianNetwork`** — `resolveDecision(ward, scope, recipe, household?)` resolves who
  decides under a recipe's consent rule: `top-tier-any` (one top-tier guardian suffices),
  `top-tier-all` (every highest-tier guardian — a parent split deadlocks, never
  steamrolls), `all-scoped`, `ward-with-support` (the ward's own assent is operative;
  supporters are `consulted`, not approvers). A ward with no in-force guardian for a
  scope is a surfaced gap, not a silent approval. Equal-precedence disagreement never
  resolves by picking a favourite.
- `isInForce` time-bounds + `mayActFor` enforcement checks; every relation validated
  (no self-guardianship, at least one household, known members).

## Decisions taken

- **Precedence is numeric and explicit** — "parents usually trump" is the *default*, not
  an iron law; a court order overrides per-relation.
- **Supported ≠ limited** — the CRPD distinction is structural: `supported` capacity
  means the person's own act decides; a supporter's role is recorded as advice. Substitute
  decision-making for a supported person requires an explicit different recipe/path.
- **Ties deadlock** — equal-precedence co-guardians who disagree produce a `pending`
  (or vetoed) request that escalates per the recipe's `escalation` field — the model
  encodes "go to mediation/court", not "first parent to click wins".

## Verification

`test/unit/databox/personal/Guardianship.test.ts` — precedence ordering, per-household
scoping, expired relations, top-tier-all deadlock semantics, emergency any-guardian,
supported-decision ward-assent, no-guardian gap surfacing, self-guardian/unknown-member
fail-closed. 84 personal tests green.

## Residual / notes

- Relations are in-memory per convention — the persistence/audit projection to the pod
  is the same follow-up as the other stores.
- The consent store gained a `ward-decision` kind with caller-supplied approvers — the
  seam WardDecisions (CIV-A12) plugs into.
