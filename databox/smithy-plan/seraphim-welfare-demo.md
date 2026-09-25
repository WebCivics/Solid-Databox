# Seraphim and Charles James welfare demonstrator

## Purpose and actors

Seraphim is a synthetic registration and coordination organization for people experiencing homelessness. It runs an
organization-controlled relationship Pod for synthetic participant **Charles James**. Charles independently controls
a personal Solid Pod/vault through a Flutter application.

All people, organizations, credentials, keys, case notes, evidence, and transactions in the demo are synthetic. The
imported provider directory is discovery input and must not be presented as current or verified until reviewed.

## Deliberately false record and correction

The Seraphim relationship Pod initially contains a restricted synthetic intake note falsely alleging that Charles was
removed from accommodation for violent conduct and is barred from supported housing. The UI must label this as an
organization assertion, not established fact. It must never appear in search snippets, notifications, analytics,
provider-directory data, or an eligibility credential.

Charles disputes the note from the Flutter app, supplies a correction statement, and attaches synthetic evidence by:

- selecting a local file, which is quarantined, malware-scanned, digested, and stored as immutable evidence; or
- providing an HTTPS URI, which is fetched only through the SSRF-protected evidence service, content-limited, scanned,
  digested, and provenance-recorded.

A reviewer records a signed disposition. Acceptance appends a corrected record that supersedes the allegation; it
does not erase the original evidence. Rejection retains Charles’s statement, reason, review route, and deadline.
Every prior recipient of the disputed assertion is recorded and receives a correction notification where policy
requires. The demo must show both parties’ evidence that the correction was submitted and decided.

## Synthetic credentials delivered to Charles

- ACT residency credential from a synthetic state-government issuer.
- Healthcare concession credential from a synthetic social-security issuer.
- Disability Support Pension status credential, separate from the healthcare credential.
- Minimal functional-needs credential from a synthetic clinician, describing only housing-relevant accessibility or
  environmental needs selected for disclosure; detailed diagnoses remain highly restricted.
- Seraphim registration credential and relationship credential.
- Purpose-limited voucher credentials for temporary accommodation/camping, meals, clothing, transport, connectivity,
  and essential equipment.

Credentials bind issuer, subject/holder, purpose, scope, status, validity, and audience where applicable. A voucher
must not reveal the underlying hardship, diagnosis, disputed allegation, or global identity to a merchant. All demo
issuers and credentials are visibly marked synthetic and cannot be mistaken for real entitlements.

## Goals, stages, and dependencies

The case plan is a human-reviewed graph, not a rigid automated funnel:

1. Immediate safety, communication, identity, food, and temporary shelter.
2. Stable housing search and application.
3. Health access, treatment, and accommodation of functional needs.
4. Stabilization, recovery, community connection, and longer-term goals.

Edges are `supports`, `blocks`, `parallel`, or `urgentOverride`. Health care can run in parallel and urgent clinical
needs override any apparent housing prerequisite. Software may surface dependencies and overdue tasks but may not
diagnose, deny service, or assign final housing priority. A named human records the urgency rationale and appeal path.

## Charles’s personal Pod experience

- private diary with text, attachments, mood/wellbeing self-notes, and links to received records;
- immutable event timeline showing deposits, submissions, referrals, appointments, decisions, and receipts;
- separate “To do,” “Waiting,” “Done,” and “Disputed” task views;
- credential wallet grouped by residency, concession, support, and vouchers;
- service directory with source and verification status;
- record-by-record and category-level privacy controls;
- correction composer with file/URI evidence and recipient-notification visibility;
- referral inbox, communication history, consent expiry, and revoke action;
- portable export of records and evidence without Seraphim-specific transport.
- private budget planning and receipt capture in Charles's personal Pod, with purpose-bound disclosure of only a
  selected receipt, total, recurring cost, or affordability statement when support requires it.

## Referrals and coordinated communication

Seraphim can propose referrals for housing, disability support, health, case management, food, clothing, temporary
accommodation, and related services. Charles chooses the provider and approves a purpose-bound consent grant naming:

- provider and service;
- permitted record categories or specific records;
- purpose and prohibited reuse;
- validity interval;
- whether provider-to-Seraphim coordination is allowed;
- communication channel and notification preference;
- revocation and correction propagation behavior.

The provider receives only the selected referral packet, not Pod browsing rights. Messages and status events are
tracked in the relationship Pod and Charles’s Pod with acknowledgements and recovery feeds.

## Provider directory import

The supplied CSVs contain 60 business rows, 263 found-service rows, and 88 ontology-work rows. Import preserves
dataset name and source row. Every listing begins `unverified`; blank organizations are rejected; duplicates become
review candidates; missing websites remain absent. A detected run of likely shifted URLs in the found-service CSV is
quarantined rather than automatically repaired. Phone, website, role, eligibility, hours, geography, and current
availability require source verification before display as trusted facts.

## Donations and pooled resources

Individual and organization donors can fund broad Seraphim resource pools without gaining access to participant
records or a one-to-one allocation trail. Charles can receive vouchers or resources from a pool without seeing donor
identity. Donors receive signed contribution receipts and privacy-reviewed aggregate impact reports. The complete
separation, reporting, and abuse model is defined in [Seraphim donations](seraphim-donations.md).

## Service economics and government reporting

Seraphim records approved staff time, direct costs, commitments, reimbursements, provider invoices, in-kind value,
and versioned overhead methods against cases and stages. Contract reports can show participant and case counts,
service activity, waits, stage progress, outcomes, time, expenses, and cost per defined milestone. Actual cost,
forecast, in-kind value, and modelled avoided cost remain distinct.

Basic demographic dimensions are optional, purpose-specific, preferably self-described, and always support
`unknown` and `prefer not to say`. Reports use defined cohorts, denominators, broad bands, small-cell and intersection
suppression, approved immutable snapshots, and lineage. A government principal receives the contract-approved report,
not general access to relationship or personal Pods. See [Stripe, budgeting, and service economics](seraphim-stripe-budget-economics.md).

## Inter-organizational resource exchange

Seraphim maintains a governed address book of provider identities, Databox endpoints, supported capabilities, trust
evidence, agreements, keys, and verification history. The imported provider directory remains discovery input; an
entry is not exchange-enabled until both organizations verify identity and approve a bounded agreement.

A connected food, clothing, accommodation, or other provider can offer resources, delegate coupon issuance, verify
presented vouchers, submit signed redemption claims, receive dispositions, and reconcile settlement or acquittal
batches. Pairwise opaque voucher and claim references prevent the exchange from becoming a participant directory.
Resource dashboards distinguish offered, accepted, delegated, issued, reserved, redeemed, expired, reversed,
disputed, settled, and remaining quantities. See [Inter-organizational exchange](inter-organizational-exchange.md).
