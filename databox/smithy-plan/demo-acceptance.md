# Polished demonstrator journey and acceptance

## Audience and story

The primary audience is an organization decision-maker who needs to see both sides of the exchange: how their team
tailors a Databox program and how a consumer remains in control when information is shared.

The first scripted story uses only synthetic actors:

- **MegaMart Rewards** — source organization and Databox operator;
- **Alex** — consumer using a consumer-owned Solid Pod;
- **Warranty Workshop** — recipient of a minimized warranty claim;
- **Smithy operator** — configures the program but cannot browse Alex’s records.

## Demonstration sequence

1. The operator creates a workspace and chooses the retail/loyalty pack.
2. The smithy displays inherited templates and the organization-specific questions still requiring answers.
3. The operator configures a synthetic POS source, maps its fields to `rc-receipt`, validates, previews, and publishes
   version 1.
4. Alex opens the consumer application, selects a Solid identity provider, completes Solid-OIDC, and chooses a Pod.
5. Alex creates or selects the application container. The holder key is created consumer-side and never returned to
   the organization.
6. The smithy provisions an opaque relationship and issues a holder-bound connection credential.
7. A synthetic POS event is committed. The bridge resolves the protected mapping, deposits the receipt, and retains
   a signed acceptance receipt.
8. Alex receives a notification hint, pulls the authoritative feed, verifies the record and receipt, and sees an
   understandable explanation of its source and governing terms.
9. Alex starts a warranty share. The UI shows every candidate field and defaults all optional fields to excluded.
10. Alex shares only product identifier, purchase date, merchant, and warranty evidence with Warranty Workshop.
11. Warranty Workshop independently verifies the disclosure, records the declared purpose and expiry, and returns a
    signed acknowledgement that Alex retains.
12. The operator sees aggregate reconciliation status but cannot see Alex’s raw customer ID, Pod contents, holder
    key, or unrelated shares.

The second story is the [restaurant menu and ordering journey](restaurant-demo.md): a restaurant publishes a signed
menu, Alex saves a verified snapshot in an independently selected Pod, prepares an order locally, explicitly submits
the selected fields, receives status events, and retains the final receipt. No payment authority is demonstrated.

## Required views

- Operator onboarding and workspace dashboard.
- Industry-pack selection and capability preview.
- Organization questionnaire with source/provenance for every answer.
- Record mapping studio with sample-input and transformed-output panes.
- Validation findings grouped as errors, review gates, and advice.
- Publication summary and resettable synthetic event console.
- Consumer Pod connection and consent screens.
- Verified menu, basket, order-review, status, and receipt screens.
- Consumer inbox, verified-record detail, terms explanation, and share composer.
- Recipient verification result and acknowledgement.
- Evidence timeline that clearly distinguishes organization, service, consumer, and recipient actors.

## Functional acceptance

- The complete journey runs from a clean checkout with one documented command.
- The local showcase is deterministic enough for screenshots and repeatable presentations.
- The same consumer client can connect to a separately launched compatible CSS Pod in the interoperability test.
- No step requires copying a bearer token, private key, or customer identifier into the browser.
- Refreshing or restarting does not lose a published program, mapping, receipt, or acknowledgement in durable mode.
- A failed mapping or deposit is visible, recoverable, and cannot silently become accepted.
- Replaying the same source event creates no duplicate logical record or receipt.
- The share payload contains only fields Alex explicitly selected.
- The recipient cannot use one share to retrieve Alex’s other records.

## Security and privacy acceptance

- Browser storage contains no issuer signing key, connector secret, raw mapping registry, or reusable access token.
- Cross-workspace, cross-program, and guessed-box requests fail without an existence leak.
- Solid-OIDC issuer, audience, DPoP, WebID, redirect URI, state, nonce, and PKCE checks follow the pinned profile.
- A credential copied without its holder private key cannot establish access.
- A revoked or expired connection, record proof, or share fails closed.
- Logs and UI telemetry contain opaque references, not source customer IDs or record payloads.
- The demo banner identifies synthetic data, experimental components, and any provisional protocol adapter.

## Presentation quality

- Keyboard navigation, visible focus, form labels, error summaries, contrast, and reduced-motion behavior are tested.
- The primary journey works at common laptop and mobile widths.
- Loading, empty, failure, retry, expired, revoked, and disconnected-Pod states are designed rather than hidden.
- Technical evidence is expandable; the default view uses ordinary language.
- The UI never describes cryptographic verification as proof that a real-world claim is true.

## Honest limitations shown in the demo

The demonstrator must identify whether it is using the local Pod preset or an independently hosted Pod. It must not
claim DBX release conformance, legal compliance, universal Pod portability, zero-knowledge disclosure, payment
authority, or emergency-access safety until the corresponding named gates pass.
