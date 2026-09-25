# Restaurant menu and ordering demonstration

## Boundary statement

Both sides are Solid-compatible Pods. The restaurant Databox is an organization-controlled relationship Pod: the
restaurant’s governed view of its dealings with one consumer. The consumer separately chooses and controls a personal
Solid Pod, vault, compatible operating system, or knowledge environment. Databox provisions the restaurant-side
relationship Pod; it does not assign or control the consumer’s personal Pod.

The organization must not gain general read or write access to the Pod. It receives only the order disclosure the
consumer explicitly sends to the restaurant endpoint.

## Why a Solid application is required

A browser Solid application is needed for the consumer side. It performs Solid-OIDC login, discovers storage, asks
permission to use an application container, receives and verifies restaurant data, manages local preferences and
order drafts, and sends an explicit order to the restaurant.

The first demonstrator can ship this as a restaurant-branded progressive web application. Its Solid-facing code must
remain provider-independent so the consumer can use another compatible application later.

The application container holds only consumer-controlled copies and state:

- restaurant connection metadata;
- signed menu snapshots or references and their provenance;
- dietary preferences the consumer chooses to keep locally;
- order drafts that have not been submitted;
- submitted-order envelopes, acknowledgements, receipts, and status events.

The consumer holder private key and unrelated Pod resources never leave the consumer application/vault boundary.

## Actors

- **Synthetic restaurant** — authors menu versions and receives orders.
- **Restaurant relationship Pod** — stores the restaurant’s governed relationship records and submissions.
- **Restaurant Databox service** — signs and publishes information, validates submissions, and emits status.
- **Consumer Solid application** — acts for the consumer against their selected Pod and restaurant service.
- **Independent Solid Pod** — stores consumer-controlled application data; the restaurant does not supply it.
- **Kitchen/order bridge** — accepts a validated order through a least-privilege connector.

## Menu flow

1. The restaurant publishes an immutable menu version with validity interval, currency, taxes, availability, item
   identifiers, names, descriptions, prices, options, allergen declarations, and provenance.
2. The consumer opens the Solid application and chooses their existing Pod provider.
3. After Solid-OIDC and storage consent, the application retrieves the signed menu through a public or
   connection-scoped menu endpoint.
4. The application verifies signature, issuer trust, status, validity, and exact menu digest before presentation.
5. With consumer approval, the application stores a snapshot or digest-bound cached copy in its Pod container. The
   restaurant never writes directly into arbitrary Pod locations.
6. A changed menu creates a new version. Existing orders retain the exact version and price snapshot accepted at
   submission time.

Menus are organization information, not customer records. A public menu should normally be available from a public
organization resource. The menu version used in an order, personalized offers, the order, status, and receipt are
retained in the organization relationship Pod. They cannot correlate other relationships.

## Order flow

1. The consumer selects menu items and options locally.
2. The application may compare items with Pod-held dietary preferences, but performs no automatic disclosure.
3. The review screen separates required order fields from optional dietary notes or loyalty identity. Every optional
   field defaults to excluded.
4. The consumer explicitly submits an `OrderSubmission` bound to restaurant, location, menu version/digest, item and
   option identifiers, quoted amounts, fulfilment method, purpose, expiry, and idempotency key.
5. The restaurant validates version, availability, price, audience, authenticated context, replay key, and policy. A
   changed price or unavailable item returns a new quote; it never silently mutates the order.
6. Durable acceptance produces a signed acknowledgement. Kitchen acceptance, preparation, ready, completed,
   rejected, or cancelled are append-only status events.
7. The application stores acknowledgements, status events, and the final signed receipt in the consumer's Pod.

## Data model

Organization-to-consumer records are `MenuCatalog`, `MenuVersion`, `OrderAcknowledgement`, `OrderStatus`, and
`DigitalReceipt`. Consumer-to-organization submissions are `OrderSubmission`, `OrderChangeRequest`,
`OrderCancellationRequest`, and a separately selected `DietaryPreferenceDisclosure`.

Payment authorization is excluded from the first demonstrator. The demo uses “pay at venue” or a synthetic payment
status. Databox credentials are never payment mandates.

## Required failure cases

- stale, expired, revoked, or tampered menu;
- unavailable item or invalid option;
- menu digest, price, currency, tax, restaurant, or location mismatch;
- duplicate idempotency key or cross-restaurant replay;
- fields added after the consumer review screen;
- dietary preference read or disclosure without explicit selection;
- restaurant attempt to enumerate or write unrelated Pod resources;
- lost connection after durable acceptance, recovered from the authoritative order feed;
- rejected cancellation or change without deleting prior evidence.

## Acceptance journey

The presenter publishes a menu version and opens the consumer Solid app. The consumer connects an independently
hosted personal Pod, saves the verified menu, builds an order, optionally selects one dietary note, and submits it to
the restaurant relationship Pod. The consumer receives an acknowledgement, watches append-only status updates, and
retains the final receipt. The organization Pod records its view while the consumer Pod can derive a private food
diary or health entry. Neither side can browse the other Pod.
