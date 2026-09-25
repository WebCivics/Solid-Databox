# Seraphim Stripe, personal budgeting, and service economics

## Separation of concerns

Seraphim owns its Stripe donation account. Charles owns his budget, receipts, and financial knowledge in his personal
Pod. Seraphim and an authorized government principal receive only defined operational or outcome reports under a
contract-specific reporting profile.

Payment data, personal budgets, cases, donor reports, and government aggregates remain separate authorization
domains. Stripe metadata must never contain a participant name, relationship subject, referral, health fact,
demographic value, or disputed allegation.

## Organization Stripe setup

For a reusable Smithy, Seraphim connects an organization-owned Stripe account using Connect and Stripe-hosted
onboarding. A standalone deployment can use Seraphim-owned restricted keys referenced from its secret manager. The
Smithy never asks an administrator to paste a live secret key into a browser form or stores it in a profile.

The setup wizard covers organization workspace, authorized finance administrator, test/live mode, country, currency,
connected account and capability status, representative, broad pools, amount limits, recurring-gift policy, branding,
return URLs, privacy/refund notices, receipt wording, webhook secret handle, tax-receipt approval, and finance roles.

Use Stripe-hosted Checkout Sessions for the initial donation UI. Select Connect configuration against the current
Stripe account model rather than assuming a legacy account type.

### Payment lifecycle

1. Create a pending contribution with a random reference and broad pool.
2. Create a server-side Checkout Session with an idempotency key. Metadata contains only contribution reference and
   pool code.
3. Redirect to Stripe-hosted Checkout.
4. Treat the browser return as pending, never as settled funds.
5. Verify the webhook against the raw body, timestamp, and signing secret; deduplicate and enqueue processing.
6. Confirmed funds create a pool lot and signed receipt. Failure, expiry, refund, dispute, and reversal append
   compensating events and reconcile availability.

Pin the allowed events and Stripe API version. Store Connect credentials, restricted keys, and webhook secrets only
in an external secret provider. Separate sandbox/live data, rotate exposed keys, validate redirect allowlists,
reconcile balances/payouts, and never log secrets, payment methods, full webhook bodies, or donor contact details.

Official implementation references:

- [Stripe Connect overview](https://docs.stripe.com/connect/how-connect-works)
- [Stripe Connect OAuth](https://docs.stripe.com/connect/oauth-reference)
- [Stripe Checkout Sessions](https://docs.stripe.com/payments/checkout-sessions)
- [Stripe webhook signatures](https://docs.stripe.com/webhooks/signature)
- [Stripe key-management practices](https://docs.stripe.com/keys-best-practices)

## Charles’s personal budget

Budget information is created and retained in Charles’s personal Pod. Seraphim has no default access.

The Flutter app supports budget periods; planned and actual totals; income; fixed, variable, irregular, debt,
medical, housing, transport, food, connectivity, and discretionary costs; recurring entries; due dates; arrears;
forecast cash balance; cash expenses; and non-cash support. It never stores bank login credentials.

Receipt evidence supports camera/file or protected HTTPS input, immutable original bytes and digest, media type,
source, date, merchant, amount, currency, tax, category, and links to expenses, vouchers, reimbursements, tasks, diary
entries, or stages. OCR is an untrusted suggestion requiring confirmation.

Charles shares generated disclosures rather than his whole budget: a selected receipt, category total, recurring
cost, monthly summary, arrears evidence, or affordability statement. Review shows exact fields, recipient, purpose,
validity, retention request, and whether onward reporting is allowed.

## Seraphim case economics

Authorized staff can record staff time by role/activity/stage and loaded-rate version; direct purchases; vouchers;
accommodation; transport; provider invoices; reimbursements; donated/in-kind resources and valuation method;
versioned overhead allocation; referrals; waits; service contacts; stage events; and participant-confirmed outcomes.

Every entry binds evidence, actor, approval, currency, period, case/stage, and calculation version. Corrections append
reversals or superseding entries. Forecast, commitment, actual cost, in-kind value, and hypothetical avoided cost are
different concepts.

## Contract and government reporting

A reporting profile names the principal, contract, measures, cohort, period, geography, demographic dimensions,
formulas, denominators, suppression rules, retention, access, and approvals.

Measures can include participant counts, new/active/closed cases, stage entry/completion, median duration, waiting
time, task completion, referral acceptance, housing milestones, service contacts, staff hours, direct cost, resource
value, cost by stage/category, and cost per defined completed milestone.

Reports distinguish activity, output, participant-reported outcome, and verified outcome. They do not imply Seraphim
caused an outcome merely because it preceded it. Savings or avoided cost is a separately labelled model with
assumptions, uncertainty, counterfactual source, and review—not actual expenditure.

## Counts and demographics

Demographic information is optional, purpose-specific, self-described where possible, and includes `unknown` and
`prefer not to say`. Do not infer ethnicity, gender, disability, health, family violence, citizenship, or housing
status from names, addresses, behavior, provider use, or credentials.

Possible dimensions include broad age band, self-described gender, First Nations status where lawfully and culturally
governed, broad household composition, veteran status, broad housing situation, and disability-support status. Each
requires a reporting purpose and review. Individual values are never donor-visible.

Aggregates use minimum cohorts, intersection/rare-combination suppression, broad geography/time, immutable release
snapshots, and differencing controls. A government principal gets an approved report or specifically authorized case
record, never Pod-browsing rights.

## Implementation prompts

### SEC-01 — Stripe organization connection

Implement sandbox Connect onboarding/direct restricted-key mode, secret handles, capability status, disconnect,
rotation, role checks, audit, and test/live separation.

### SEC-02 — Checkout and webhook reconciliation

Implement Checkout Sessions, idempotency, raw-body signature verification, event deduplication, pool lots,
refunds/disputes/reversals, receipts, and Stripe sandbox/CLI tests.

### SEC-03 — Personal budget and receipt evidence

Implement Flutter budget domains, encrypted cache, Pod persistence, receipt quarantine/digest/OCR review, selective
disclosure, correction, and recovery. Prove Seraphim cannot browse an unshared budget.

### SEC-04 — Case cost and time ledger

Implement versioned staff time, direct cost, commitments, in-kind valuation, overhead methods, approvals, evidence,
reversals, stage binding, and accounting exports.

### SEC-05 — Contract metrics and demographic privacy

Implement reporting profiles, calculation versions, cohort snapshots, demographic purpose/consent, threshold and
intersection suppression, lineage, approval, signed exports, and re-identification/differencing tests.
