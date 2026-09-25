# Inter-organizational address book and resource exchange

## Purpose

The Databox network needs an organization-to-organization exchange plane. Seraphim can discover a provider, verify
that it operates a compatible Databox, establish a bounded agreement, delegate coupons or support resources, receive
redemption claims, and reconcile use. The same pattern supports food, clothing, temporary accommodation, transport,
equipment, referrals, and other organization-specific services.

This plane does not give either organization general access to the other's Pods. It exchanges signed, schema-bound
messages through explicit capability endpoints. Discovery, trust, contractual authority, and access authorization
are separate decisions.

## Inter-organizational address book

Each organization maintains its own governed address book. An entry can contain:

- canonical organization identifier, names, public locations and contact channels;
- organizational WebID or equivalent verifiable service identity;
- Databox service description and inbox/claim/status endpoints;
- supported message profiles and versions, such as resource offer, voucher status, redemption claim, referral status,
  invoice, acknowledgement, correction, and revocation;
- signing and encryption key references, issuer trust chain, rotation/status endpoints, and last verification time;
- agreement, jurisdiction, service area, eligibility, hours, capacity signal, and escalation contact;
- source observations, verification state, owner, review date, and change history; and
- permitted purposes, data categories, retention, onward-disclosure rules, and commercial/settlement terms.

Imported CSV entries remain unverified provider observations. They become trusted exchange contacts only after an
authorized person verifies identity, endpoint control, capability compatibility, representative authority, and the
applicable agreement. Address-book membership never implies blanket trust or participant-data access.

## Capability discovery and connection

1. Seraphim selects an observed provider and requests its public service description.
2. The Smithy validates HTTPS, follows no unsafe redirects, applies SSRF controls, checks schema/version support, and
   records the exact retrieved representation and digest.
3. Both organizations prove control of their service identities and exchange signed connection proposals.
4. Authorized representatives approve a versioned agreement profile defining message types, purposes, limits,
   expiry, keys, callback endpoints, dispute route, settlement rules, and privacy obligations.
5. Each side records the other independently. A connection is not active until bilateral acknowledgements match.
6. Key rotation, endpoint change, capability withdrawal, agreement expiry, suspension, and termination are explicit
   events. The network fails closed when trust or version checks cannot be completed.

The address book supports organizations without a Databox as `manual` or `external-portal` contacts, but never
pretends those channels provide Databox receipts, interoperability, or end-to-end provenance.

## Delegated resource and coupon lifecycle

Example: a food cooperative commits 100 meal units to Seraphim and permits Seraphim to issue up to 80 purpose-limited
coupons. The provider remains authoritative for the resource commitment and redemption; Seraphim is authoritative
for allocations and delegated issuance within the agreement.

1. Provider sends a signed resource offer stating program, resource class, quantity/value, validity, locations,
   restrictions, settlement terms, and delegation limit.
2. Seraphim accepts all or part, creating a resource lot and bilateral acknowledgement.
3. A case worker allocates support. Seraphim issues Charles a holder-bound or one-time voucher containing the minimum
   merchant-facing facts: program, resource, entitlement, validity, audience, status reference, and opaque token.
4. Charles presents it to the provider. Presentation reveals no donor, case, diagnosis, disputed record, Pod URL,
   government identifier, or unrelated entitlement.
5. The provider checks signature, audience, validity, status, remaining units, and replay state, then records delivery.
6. The provider submits a signed redemption claim with opaque voucher/token reference, program, units/value,
   location reference, redemption time, evidence reference, and idempotency key.
7. Seraphim verifies and returns `accepted`, `partiallyAccepted`, `rejected`, or `needsReview`, with reason and a signed
   acknowledgement. Corrections and reversals append events rather than rewriting history.
8. Claims enter a settlement batch where money is payable, or an acquittal batch for donated/in-kind resources. Both
   organizations reconcile the same totals and retain their own evidence.

The provider cannot use a claim endpoint to enumerate vouchers. Claim IDs, voucher handles, presentation tokens,
idempotency keys, and settlement references are pairwise and must not be reused as cross-program person identifiers.

## Resource-management information

Operational dashboards can show, per organization, agreement, program, resource type, region, and period:

- offered, accepted, delegated, issued, reserved, redeemed, expired, cancelled, reversed, disputed, and remaining
  units/value;
- unique vouchers redeemed, total redemption events, partial redemptions, rejection reasons, and replay attempts;
- outstanding claims, accepted liability, settled/acquitted value, settlement age, and reconciliation differences;
- location capacity, temporary unavailability, forecast exhaustion, average time to redemption, and unused allocation;
- aggregate beneficiary and outcome counts only when an approved reporting profile and privacy threshold permit it.

Resource totals must identify their measurement basis. `available`, `committed`, `reserved`, `delivered`, `claimed`,
`accepted`, and `paid` are different states. Inventory snapshots are immutable projections derived from the event
ledger, not mutable source-of-truth counters.

Provider operational reporting contains no participant demographics by default. If a contract genuinely requires a
demographic aggregate, Seraphim produces it from an approved cohort release with minimum-cell and intersection
suppression; providers do not receive person-level demographic or case data through redemption claims.

## Security, privacy, and abuse controls

- mutual organization authentication plus message-level signatures and payload digests;
- allowlisted capability/version combinations and bounded request bodies;
- pairwise opaque references, nonce/expiry, replay prevention, idempotency, rate limits, and claim-enumeration tests;
- least-privilege roles for address-book administration, agreement approval, issuance, fulfilment, claim review,
  settlement, privacy approval, and audit;
- status checking and offline rules that make double-spend risk visible rather than silently accepting it;
- no free-text participant data or attachments unless a separately reviewed message profile requires them;
- corrections, disputes, reversals, key compromise, endpoint compromise, and organization offboarding;
- reconciliation without requiring a shared database or either party to browse the other's Pods; and
- retention and export controls for agreements, financial records, operational evidence, and message receipts.

## Demonstration acceptance

- Seraphim promotes a synthetic food provider from unverified observation to a verified Databox address-book entry.
- Both sides approve a bounded voucher agreement and discover compatible endpoints.
- The provider offers 100 meal units and delegates issuance of 80; Seraphim accepts and issues a synthetic voucher.
- Charles redeems one unit without disclosing his identity, case, Pod, health information, or donor.
- Duplicate submission returns the original outcome; token replay and over-redemption are refused.
- Provider and Seraphim display matching signed claim, acknowledgement, batch, and resource totals.
- A reversal changes derived availability and settlement through compensating events.
- Another provider without a Databox is clearly shown as manual and cannot receive Databox-only data.
- Neither organization can browse the other's resources or submit a message outside the approved agreement profile.

## Implementation prompts

### IOX-01 - Address book and capability discovery

Implement organization entries, source observations, identity/endpoints, capability profiles, trust evidence, review,
key/status metadata, manual-channel labelling, secure discovery, and change monitoring.

### IOX-02 - Bilateral agreements and secure exchange

Implement signed connection proposals, representative approval, versioned agreement profiles, pairwise service
identities, message envelopes, acknowledgements, expiry, suspension, key rotation, and recovery feeds.

### IOX-03 - Resource offers, delegation, and voucher issuance

Implement offer/acceptance, resource lots, delegation ceilings, allocation, reservation, holder-bound and one-time
vouchers, status, partial use, expiry, cancellation, and offline-risk policy.

### IOX-04 - Redemption claims and settlement

Implement merchant verification, fulfilment evidence, signed claims, idempotency, replay/over-redemption rejection,
review/dispute/reversal, settlement and acquittal batches, accounting export, and bilateral reconciliation.

### IOX-05 - Resource dashboards and privacy tests

Implement event-derived inventory snapshots, lifecycle counts, liabilities, capacity and exhaustion signals, approved
aggregate outcome joins, privacy suppression, forbidden-field tests, and adversarial cross-program correlation tests.
