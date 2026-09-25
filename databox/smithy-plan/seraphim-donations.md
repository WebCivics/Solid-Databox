# Seraphim privacy-shielded donations and resource pool

## Meaning of blind

“Blind” means the donor-facing system cannot identify or single out the person who ultimately benefits from a
contribution. It does not mean Seraphim has no internal accountability, that a donation is cryptographically
anonymous, or that financial and regulatory records can be omitted.

Seraphim keeps the restricted allocation evidence needed for governance and audit. Donors see delayed, aggregated,
coarsened impact reports that are not linked one-to-one to Charles or another participant.

## Actors and accounts

- An individual donor can create a private donor account.
- An organization donor has an organization account with verified representatives and role-based approval.
- A donor may choose private, pseudonymous, or public attribution for donor-facing/public recognition. This choice
  never changes recipient privacy.
- Seraphim finance, resource coordination, case work, privacy review, and audit are separate roles.
- A payment provider handles money movement. Databox records commitments, provider confirmations, allocations,
  distributions, acknowledgements, and receipts; it is not itself a bank or payment processor.

Login can use ordinary OIDC and strong account recovery. Solid-OIDC is optional for donors who want signed receipts
delivered to their own Solid data space. Organization accounts require verified representative authority and MFA.

Seraphim's organization-owned Stripe onboarding, hosted Checkout, webhook reconciliation, secret handling, and
separation from participant budgets are specified in [Stripe, budgeting, and service economics](seraphim-stripe-budget-economics.md).

## Separated ledgers

1. **Donor identity ledger** — account, representative authority, contact, privacy choice, and required financial
   records. It has no recipient identifiers.
2. **Contribution ledger** — pseudonymous contribution ID, resource type, quantity/value, restrictions, payment or
   delivery confirmation, receipt, and pool destination.
3. **Resource pool ledger** — fungible or batch lots available for accommodation, meals, clothing, transport,
   connectivity, essential equipment, and unrestricted support.
4. **Restricted allocation ledger** — internal link between a pool lot and a relationship-scoped distribution. Only
   authorized resource coordinators and auditors can access it.
5. **Impact-report ledger** — privacy-reviewed aggregates released to donors after threshold and delay rules pass.

The public/donor API has no join path from contribution ID to relationship subject, referral, voucher, diary, health
record, disputed record, case worker, or exact service event.

## Contribution flow

1. Donor logs in, selects money or an accepted in-kind resource, and chooses a broad pool.
2. The UI explains whether a payment is a gift, a contribution, or an in-kind pledge and makes no tax-deductibility
   promise without a configured eligible recipient and compliant receipt process.
3. A payment provider or resource intake worker confirms receipt.
4. Seraphim issues a signed donor receipt binding contribution ID, value/quantity, date, pool, terms, and confirmation.
5. The contribution is added to a pool lot. Donors cannot earmark a named person or a combination narrow enough to
   identify one.
6. Authorized coordinators allocate resources against human-reviewed needs. Allocation never gives the donor access
   to a relationship Pod.

## Donor reporting

Reports can contain broad resource category, reporting period, coarse region, number of distributions, rounded or
banded value/quantity, unallocated balance, and generalized outcome type. They cannot contain names, Pod identifiers,
exact address, exact service location, exact timestamp, health/disability details, free-text case stories, disputed
records, referral destinations, or unique combinations.

The demo policy uses a minimum cohort of five distributions, at least a seven-day delay, broad ACT-level geography,
rounded totals, and suppression of rare categories. These are demonstrator defaults, not a proof of anonymity. If a
cell does not meet policy it is combined with a broader period/category or withheld. Repeated report queries run
against immutable release snapshots to prevent differencing attacks.

No “differential privacy,” “zero knowledge,” or cryptographic blinding claim is made until a concrete mechanism,
privacy budget, attack analysis, and independent review exist.

## Resource distribution

A distribution records pool lot, resource category, quantity/value band, Seraphim authorizer, provider or merchant,
participant acknowledgement where appropriate, and evidence of fulfilment. The participant’s relationship Pod can
hold the exact voucher/distribution record; the donor report receives only the approved aggregate projection.

Refund, reversal, expired voucher, lost goods, disputed fulfilment, and unused-balance events are append-only and
reconciled back to both restricted allocation and pool availability.

Where a merchant or provider operates a compatible Databox, fulfilment uses the signed offer, delegated issuance,
redemption-claim, disposition, and reconciliation flow in [Inter-organizational exchange](inter-organizational-exchange.md).
The merchant claim contains an opaque voucher reference and minimum fulfilment facts, never a participant or donor
identity, case reference, health fact, personal Pod URL, or relationship-Pod browsing grant.

## Privacy and abuse controls

- deny donor-selected recipients and unsafe micro-earmarking;
- separate donor, case-worker, resource-coordinator, report-compiler, approver, and auditor permissions;
- prohibit donor messages to recipients through contribution metadata;
- scan in-kind descriptions and attachments for personal information;
- suppress small cells, rare combinations, precise time/location, and narrative details;
- rate-limit exports and retain report-release evidence;
- prohibit joining donor analytics with participant analytics;
- require privacy approval for every report template and changed projection;
- give participants a clear notice about de-identified operational reporting without presenting it as risk-free;
- retain donor and financial data only under an approved retention schedule.

Australian implementation requires current charity, fundraising, financial, tax, and privacy review. OAIC guidance
emphasizes collecting only needed supporter/client information, securing it, limiting use/disclosure, and deleting or
de-identifying it when no longer required. ACNC guidance requires appropriate financial and operational records.

## Demonstration acceptance

- an individual and an organization donor can log in and contribute to broad pools;
- both receive signed receipts without a participant reference;
- Charles receives a synthetic accommodation voucher from the pool without donor identity;
- the restricted ledger can reconstruct authorization and fulfilment for an auditor;
- the donor sees no report until the cohort/delay gate passes;
- the released report cannot be joined through any exposed ID to Charles or his providers;
- sub-threshold, rare-category, exact-time, exact-location, and differencing probes are refused or coarsened;
- revocation of donor marketing consent does not destroy required financial records or expose recipient information.

Official review inputs:

- [OAIC privacy guidance for not-for-profits](https://www.oaic.gov.au/privacy/privacy-guidance-for-organisations-and-government-agencies/organisations/privacy-for-not-for-profits%2C-including-charities)
- [ACNC managing people’s information and data](https://www.acnc.gov.au/tools/guides/managing-peoples-information-and-data)
- [ACNC charity record keeping](https://www.acnc.gov.au/for-charities/manage-your-charity/obligations-acnc/keeping-charity-records)
- [ATO gifts and donations](https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/deductions-you-can-claim/gifts-and-donations)

## Implementation prompts

### SDO-01 — Donation and pool ledger

Implement durable donor identity, contribution, pool, pool-lot, restricted allocation, distribution, receipt, reversal,
and reconciliation stores with separate encryption domains and role authorization. Gate on restart, concurrency,
idempotency, financial reconciliation, backup/restore, and forbidden cross-ledger joins.

### SDO-02 — Donor portal and intake adapters

Build individual and organization account onboarding, representative authority, MFA, privacy/marketing choices,
payment-provider confirmation, in-kind intake, broad-pool selection, signed receipts, refunds, and account recovery.
Complete payment, fundraising, tax, accessibility, and security review before accepting real value.

### SDO-03 — Allocation, vouchers, and fulfilment

Connect human-reviewed needs to pool allocations and purpose-limited vouchers without donor visibility. Implement
merchant/provider redemption, expiry, partial use, cancellation, dispute, and restored-balance events. Prove voucher
presentation discloses no hardship, diagnosis, case identifier, donor, or unrelated entitlement.

### SDO-04 — Privacy-safe impact reports

Implement immutable report snapshots, minimum cohorts, delay, category/geography coarsening, rounding, rare-cell
suppression, query-rate controls, template approval, participant notice, release evidence, and adversarial linkage and
differencing tests. An independent privacy reviewer must approve each report template before donor release.
