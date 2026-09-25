# Charles James Flutter Solid application requirements

## Product boundary

The Flutter app is Charles’s consumer-controlled Solid client. It does not embed a Seraphim account database, provide
a Pod, or grant Seraphim general access to Charles’s personal Pod. It connects to an independently selected
Solid-compatible vault and to one or more organization relationship Pods.

## Target platforms

First release targets Android and web for the demonstrator. iOS and desktop remain supported architecture targets.
The web build handles Solid-OIDC redirects; mobile uses claimed HTTPS/app links and an external user-agent. Platform
credentials and redirect behavior require security review before release.

## Required modules

- Solid account and storage discovery, login/logout, DPoP, PKCE, session expiry, and provider switching.
- Relationship connection import, holder-key generation/storage, rotation, pause, revoke, and recovery.
- Inbox/feed synchronization with offline cache and visible last-sync state.
- Verified-record and credential viewer with issuer, status, provenance, terms, and plain-language limitations.
- Diary, timeline, tasks, goals, stages, and dependency graph.
- Correction request composer with safe file picker, URI evidence, upload progress, digest, and receipt.
- Credential/voucher wallet and QR/presentation flow with minimal disclosure preview.
- Provider directory and referral composer with explicit privacy selection.
- Consent dashboard with purpose, recipient, categories, expiry, communications permission, and revoke action.
- Communications timeline backed by acknowledged events, not an untracked chat channel.
- Evidence export and accessible presentation mode.
- Pool-funded voucher and resource viewer that never exposes donor identity or donor account references.
- Personal budget planner with periods, planned/actual income and costs, recurring commitments, due dates, arrears,
  forecast balance, and cash/non-cash support, persisted in Charles's personal Pod.
- Receipt evidence capture from camera, file, or protected HTTPS source with digest, reviewable OCR suggestions, and
  links to expenses, reimbursements, vouchers, tasks, diary entries, or stages.
- Selective cost disclosure that shares a chosen receipt, category total, recurring cost, summary, or affordability
  statement for a named purpose and duration without exposing the complete budget.

## Architecture

Use feature packages around domain ports: `solid_session`, `pod_storage`, `relationship_connection`, `records`,
`credentials`, `case_plan`, `corrections`, `evidence`, `directory`, `referrals`, `consent`, and `communications`.
Transport, secure-key storage, local database, file scanning/upload, and notification clients are adapters. Business
rules remain testable without Flutter widgets or a live Pod.

Add `budget`, `receipts`, and `cost_disclosure` as personal-Pod feature packages; they do not use Seraphim's case
storage as their system of record.

Private keys use platform secure storage and are non-exportable where the platform permits. Sensitive cached payloads
are encrypted at rest. Logs, crash reports, analytics, notifications, and screenshots exclude sensitive payloads by
default. The app supports a quick privacy screen and local session lock.

## Accessibility and safety

Support screen readers, text scaling, keyboard navigation, high contrast, low literacy/plain language, reduced motion,
offline/low-bandwidth use, and discreet notification text. Safety-sensitive records use neutral labels. The app must
not expose domestic-violence, health, disability, housing, or disputed-allegation details on a lock screen.

## Acceptance gates

- Connect to the local CSS test Pod and one independently operated compatible Pod.
- Complete the Seraphim correction, credential, voucher, task, and referral journeys offline/reconnected.
- Prove Seraphim and referred providers cannot enumerate unrelated Pod resources.
- Prove optional health and dietary fields remain absent unless selected.
- Prove Seraphim cannot enumerate budget entries or receipt evidence that Charles has not explicitly disclosed.
- Recover accepted submissions after network loss without duplicate records.
- Pass widget, domain, integration, accessibility, deep-link, secure-storage, and adversarial session tests.
