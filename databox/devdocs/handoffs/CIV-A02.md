# CIV-A02 — Personal onboarding flow

**Status:** accepted
**Wave:** 1 (personal databox profile)
**Depends on:** CIV-A01 (personal preset)

## What landed

The guided setup orchestrator — a resumable step machine for the non-expert path from
install to first working connection:

- `src/databox/personal/PersonalOnboardingService.ts` — four ordered steps (`pod` →
  `hosting` → `connection` → `backup`), each against an injected adapter so the same flow
  drives a CLI installer, a local web UI, or tests. **Fail-closed and resumable**: a failed
  step halts the run marked `failed`; `run()` again resumes at the first non-done step.
  Emits a `SetupManifest` (owner WebID, pod URL, hosting mode/host, first connection id,
  backup target, completed-at) for the caller to persist.
- `src/databox/personal/HttpPodProvisioner.ts` — the real pod-provisioning adapter: follows
  the CSS account API's self-describing `controls` links (`GET /.account/` → bootstrap →
  create account → create pod), tracks the session cookie, derives the WebID
  (`{pod}/profile/card#me`), and fails closed on absent controls. Owner password is sent
  only to the local server it configures.
- `RemoteFetcher` gained optional response `headers` (the account API's session cookie).

## Decisions taken

- **Adapter contracts, not baked transports.** `provisionPod`, `applyHosting`,
  `importFirstConnection`, `configureBackup` are injectable — `HttpPodProvisioner` is the
  real pod adapter; `applyPersonalHosting` (CIV-A04, Cloudflare *or* coop client per
  CIV-A05) is the real hosting adapter; `PersonalVaultService.importConnection` (CIV-A07)
  is the real connection adapter. A `local-only` hosting mode skips the hosting step
  entirely — a pod on `localhost` is a complete, valid outcome.
- **Backup step records the choice** (`local-encrypted` / `coop-encrypted` / `none`) and
  target; the owner-key encrypted backup implementation itself is CIV-B19 scope.
- **The owner WebID is an OUTPUT of provisioning**, not an input — the pod create derives
  it; that's what feeds `--databoxPersonalOwnerWebId` for the A07 handler.

## Verification

- 8 new tests: orchestrator (full run + manifest, local-only skip, fail-closed halt +
  resume, missing-adapter/input rejection, explicit no-backup) and `HttpPodProvisioner`
  (controls-following, cookie session, missing-control fail-closed, pre-flight input
  rejection with zero network calls).
- Personal suite now 50 tests green; `tsc` + `eslint` clean.

## Residual / notes

- The person-facing **UI** (a setup wizard rendering `status()` and collecting inputs) is
  deliberately out of scope — the service is the API a UI or the installer drives.
- `HttpPodProvisioner` follows `controls` links defensively; if a CSS version reshapes the
  account API the provisioner fails closed rather than guessing — verified shape is the
  standard controls flow.
- The setup manifest is returned, not written — persistence target (file vs pod resource)
  is the installer's choice (native installer consumes it).
