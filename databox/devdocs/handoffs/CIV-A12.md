# CIV-A12 — Safety recipes: SHACL-grounded guardian decision catalog

**Status:** accepted
**Wave:** 1
**Depends on:** CIV-A11

## What landed

`src/databox/personal/household/SafetyRecipes.ts` + `WardDecisions.ts` — the "guardians
negotiate and decide" surface, SHACL-grounded and rights-anchored:

- **Seven shipped recipes** — `online-contact-boundary`, `data-sharing-third-party`,
  `location-sharing`, `residence-schedule`, `medical-major`, `supported-decision`
  (CRPD Art. 12), `emergency-safety` (break-glass with mandatory review). Each declares:
  scope, applicable capacities, consent rule, ward-voice requirement, a SHACL shape the
  decision record must satisfy, rights anchors (CRC-3/5/6/9/12/16/24, CRPD-12/19/22/25,
  UDHR-12), and the deadlock escalation path (mediation/court/defer).
- **`WardDecisionService`** — the flow: `request` resolves the deciders via the
  GuardianNetwork under the recipe, requires the ward's voice where the recipe demands it
  (a missing required preference fails the request), and opens a `ward-decision` consent
  request with the resolved approvers/quorum. `decide` runs the vote; on quorum the
  decision record is SHACL-validated — an approved-but-nonconformant record is
  `rejected-record`, not stored. **The guardians decide; the shape disposes.**
- `supported-decision` enforces CRPD Art. 12 structurally: only the ward may open their
  own supported decision — a supporter petitioning is refused.

## Decisions taken

- **SHACL validates the record, not just the form** — a decision that passes the vote but
  lacks e.g. a `reviewDate` or `wardAssentRecorded` cannot stand. Approval ≠ conformance.
- **Ward voice is a required field, not a comment** — `wardVoice: 'required'` recipes
  refuse a request carrying no `wardPreference`. The child's view is data, not decor.
- **Emergency ≠ silent override** — `emergency-safety` lets any guardian act alone but the
  record must carry justification + notified-guardian + review-by — accountability built
  into the shape.
- **Household-layer scope** — this is the personal profile's guardianship surface; the
  org-side B.1 guardianship relation type (verifiable credential-bound, duty-webs) is the
  formal layer this seeds.

## Verification

`Guardianship.test.ts` — major-medical: all-scoped guardians + SHACL-valid record →
approved; SHACL-violating record under full approval → `rejected-record`; veto → denied;
ward-voice required fails closed; supporter cannot open a supported decision. 15 tests.

## Residual / notes

- The decision record's *storage* — the approved Turtle lands in the ward's pod under the
  household's audit container — is the wiring step when the household HTTP surface is
  exposed (`/.databox/household/decisions`).
- `rdf-validate-shacl`/`rdf-ext` vs `shacl-engine` — the gate uses `shacl-engine` (the
  LLM module's choice) for consistency; the two engines can be unified later.
- The recipes are data, not code — new recipes are a catalog entry + SHACL shape; a
  household/jurisdiction overlay can supply its own.
