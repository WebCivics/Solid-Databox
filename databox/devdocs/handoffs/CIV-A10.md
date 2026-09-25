# CIV-A10 — Household governance + member consent

**Status:** accepted
**Wave:** 1 (personal databox profile)
**Depends on:** CIV-A09

## What landed

`src/databox/personal/household/HouseholdGovernance.ts` — the answers to the admin/
approval questions:

- **Admin models** — `adminCanActAlone(policy, member)`: quorum `1` + admin role = act
  alone (family: either parent). Quorum `n`/`'all'` = the action must gather that many
  distinct admin approvals through a consent request. A non-admin can *petition* the
  admins but never executes an admin action.
- **`adminApprovers`/`commonsApprovers`/`adminQuorumCount`** — pure evaluation of who
  must approve under the policy (admins for admin actions; admins *or* all members for
  commons per `commonsAuthority`).
- **`HouseholdConsentStore`** — the electronic-permission flow:
  - `requestAdminAction(requester, scope)` — petition the admins (quorum-resolved).
  - `requestMemberScope(requester, target, scope)` — member asks another member for a
    scoped grant; refused when `memberConsent` is off; self-petition refused.
  - **Limited-capacity targets** (children) get the admins appended as required
    counter-signers — guardian consent, not unilateral child consent.
  - `approve`/`deny` — only listed approvers may vote; a single denial vetoes; quorum met
    → `approved`.
  - `mayExecute(memberId, kind, action, requestId)` — the enforcement gate: sole-admin
    fast-path or an approved, action-matching request.
  - Every transition appends an audit entry (`requested`/`approved`/`denied`…); the
    request carries `requiredApprovers`, `quorum`, `approvals`, `denials`, `status`,
    `decidedAt`, `audit`.

## Decisions taken

- **Veto semantics**: one denial closes a request — a housemate's "no" is final, not a
  vote to be outnumbered (a share-house rule; a majority-override model is a policy
  variant if ever needed).
- **Scoped grants are recorded, not ambient** — a `member-scope` grant is tied to the
  request's `scope.action`/`target`; `mayExecute` matches on them, so an approved "read
  bills/" doesn't silently become write.
- **Revocation** is the member's own scope management — a granted scope is a state of the
  member's pod access (WAC), the request record is the evidence of consent; revoke =
  change the member's own ACL (the grant is a permission artifact, not an ongoing lease).
- **In-memory per convention** — same persistence follow-up as the vault stores.

## Verification

- Quorum math (1, n, 'all'), sole-admin fast-path, member petition→admin approval,
  limited-capacity counter-signature, veto-deny, non-approver rejection, consent-disabled
  refusal, unknown-member 404s, audit trail — all in `Household.test.ts` (11 tests).

## Residual / notes

- Enforcement: `mayExecute` is the decision point — the household handler (when the
  commons/admin routes are exposed) calls it before applying changes. Wiring a
  `/.databox/household` surface is the next seam when the household API is served.
- `capacity: 'limited'` models a child's consent; the full guardianship relation
  (purpose-scoped, duty-webs, expiry) is CIV-B01 territory.
