# CIV-A08 — Cooperative-hosted fallback

**Status:** accepted
**Wave:** 1 (personal databox profile)
**Depends on:** CIV-A01; completes the personal profile (with A01–A05, A07)

## What landed

For a person with no machine of their own — a cooperative hosts the pod and stores the
backup, while the coop operator holds only ciphertext:

- `src/databox/personal/OwnerKeyBackup.ts` — owner-key encrypted backups: hybrid
  ephemeral-P-256 ECDH → SHA-256(secret‖info) → AES-256-GCM, wire format
  `{ v, epk, iv, tag, ct }` (all base64url, ephemeral public JWK travels with the blob).
  `generateOwnerKeyPair` / JWK re-import helpers. Fail-closed on malformed/tampered blobs
  and wrong-key decrypt.
- `src/databox/personal/CooperativeMemberClient.ts` — the member-side client: provision a
  coop pod, `uploadEncryptedBackup` (encrypts BEFORE upload — plaintext never transits),
  `restoreBackup` (fetches + decrypts locally).
- `src/databox/personal/CoopMemberHttpHandler.ts` — the coop-side serving surface at
  `/.databox/coop` on the coop's organisation-profile databox: member-token auth via
  injected `MemberAuthenticator`, member-scoped routes (`POST members/pod`,
  `PUT/GET members/{id}/backup`) where a member addressing another member's resources is a
  403 and absent blobs 404. Pod creation via the injected `PodProvisioner` (the same
  `HttpPodProvisioner` adapter shape A02 uses against the account API).

## Decisions taken

- **Encrypt-before-upload is structural.** The coop's store is an opaque-blob store by
  construction; a coop operator reading a member's backup would need the owner's private
  key, which the coop never sees.
- **Member scoping is enforced at the handler**, not by convention — the authenticated
  member id must equal the `{id}` in the path.
- **Member-token auth** is an injected `MemberAuthenticator` — the coop's membership
  registry (issuance, revocation, persistence) is deployment composition, not this class.
- **The member's pod password transits the coop** on provisioning — inherent to hosted
  pods (the account lives on the coop's server); data protection is owner-key backup +
  pod-level WAC, not secrecy from the host. Documented plainly, not hidden.

## Verification

- 8 tests in `CoopHosted.test.ts` + 4 in `OwnerKeyBackup.test.ts`: round-trip crypto,
  wrong-key rejection, JWK persistence, malformed/tampered fail-closed, member-scoped
  403s, and the wire-level assertion that uploaded backup bodies never contain plaintext.
- Personal suite: 9 suites / 58 tests green; `tsc` + `eslint` clean.

## Residual / notes

- `CoopMemberHttpHandler` has no preset wiring yet — it composes on the coop's
  organisation-profile deployment (a `coop-handler.json` fragment + member registry +
  blob store are deployment choices). Follow-up: a `config/databox/coop.json` preset when
  the coop deployment is stood up.
- Backup *content* (what goes in the pod export) is the CIV-B19 data-safe scope; this item
  is the encrypted transport + storage seam.
- `MemberAuthenticator`/`MemberBackupStore` are contracts — the coop's real registry and
  store plug in at composition.
