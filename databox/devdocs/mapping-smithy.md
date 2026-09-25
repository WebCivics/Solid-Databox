# Mapping smithy demo

The mapping smithy is the first runnable control-plane integration of the Databox reference components. A
business can register and validate its institution profile, create an opaque mapping from its own source-system
customer namespace, issue a holder-bound connection credential, and submit synthetic source-outbox events to
the bridge. It does not expose the protected mapping registry through the public data plane.

Run the synthetic MegaMart demonstration:

```sh
npm run demo:databox-smithy
```

The command prints the public program configuration, opaque Databox mapping, connection credential, signed
acceptance receipt, and the temporary local API URL. It also asserts that the raw synthetic customer ID is not
present anywhere in that output.

The thin JSON API exposes `GET/POST /programs`, `POST /mappings`, and `POST /source-events`. It is an in-memory
reference service for demos and integration work. Production use still requires durable stores, managed signing
keys, authenticated operator access, and live CSS Components.js data-plane wiring.

The product boundary, polished Solid-Pod sharing journey, reusable industry-pack backplane, adoption studio, and
ordered implementation gates are defined in the [Smithy productization plan](smithy-plan/README.md).
The planned consumer-facing menu and order exchange is specified in the
[restaurant demonstration](smithy-plan/restaurant-demo.md). It links an organization-controlled relationship Pod to
a consumer-selected personal Pod without giving either side general access to the other. The underlying model is
defined in the [Two-Pod exchange model](smithy-plan/two-pod-exchange-model.md).
