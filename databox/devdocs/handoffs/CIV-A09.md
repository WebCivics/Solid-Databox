# CIV-A09 — Household pod topology (family / share-house)

**Status:** accepted
**Wave:** 1 (personal databox profile)
**Depends on:** CIV-A01
**Paired with:** CIV-A10 (governance engine, same module)

## What landed

`src/databox/personal/household/HouseholdProfile.ts` — the household topology planner:

- `planHousehold({householdId, zone, members, policy, originTarget})` → one pod per member
  (`alice.<zone>`) + a `commons.<zone>` pod for shared resources — each an independent
  personal hosting plan (reuses `planPersonalHosting`). Per-member WebIDs are derived;
  the commons has no owner WebID — it is **governed**, never owned.
- `HouseholdMember { memberId, role: admin|member, capacity: full|limited }` — `limited`
  is the family-side seed of CIV-B01 guardianship (a child).
- `HouseholdPolicy { kind, adminQuorum, commonsAuthority, memberConsent }` with presets
  `familyPolicy()` (admins=parents, quorum 1, commons=admins) and `shareHousePolicy()`
  (all members admin, `'all'` quorum, commons=all-members).
- Fail-closed: no members, no admins, bad/duplicate DNS labels all throw.

## Decisions taken

- **The commons is a governed pod, not a shared account.** Each member keeps their own
  pod and WebID — household governance applies to the commons and admin actions only,
  never to a member's own pod contents.
- **One host, N pods.** A household databox is one machine hosting the family — pods are
  created through the account API (`HttpPodProvisioner` shape) with the commons bound to
  the policy, not a person.
- **Topology reuses the personal plan** — member pods are ordinary personal pods under a
  shared zone; coop zones (`alice.members.coop.example`) work identically.

## Verification

- 11 tests in `test/unit/databox/personal/Household.test.ts`: pod topology (N member pods
  + commons + WebIDs), fail-closed inputs, family/share-house policy evaluation.
- Personal suite 69 tests green; `tsc` + `eslint` clean.

## Residual / notes

- The plan is an artifact; executing it (provisioning all pods via the account API) is the
  installer/onboarding consumption — same adapter seam as A02.
- A `config/databox/household.json` preset is unnecessary — the personal preset already
  hosts multiple pods; the household layer is topology + governance, not a new preset.
