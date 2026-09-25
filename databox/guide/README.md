# Databox Developer Guide

A practical guide to setting up and integrating an **organisation-hosted Solid Databox** on the
Community Solid Server. If you arrived here from the “Read the Documentation” button on the running
server, you are in the right place.

> **New here?** Start with **[Getting started](getting-started.md)** — it takes you from a fresh
> checkout to a live program, a provisioned connection, a deposited record and a signed receipt.

## What a Databox is

A Databox is a **private, two-way exchange point between one organisation program and one person** —
think of a modern-day post-box that a specific program (a loyalty scheme, a welfare service, a
university enrolment) operates for a specific member, citizen or student. The organisation delivers
records, receipts, credentials, warranties and notices; the person returns submissions, corrections,
claims, preferences or evidence.

It is **not** the person's general-purpose wallet. Each program relationship is a separate security
domain, so no organisation — and no shared hosting provider — ever sees a graph of the person's other
relationships.

For the full conceptual model, invariants and terminology, see the design corpus’ **[overview](../README.md)**
and **[architecture](../architecture.md)**.

## The mental model

Two planes, kept deliberately separate:

| Plane | What it does | Surface |
|---|---|---|
| **Control plane** — the *Smithy* | Registers programs, validates the Institution Profile, forges opaque relationship mappings, issues connection credentials, bridges source-system events into the Databox. | Thin JSON API at `/.databox/smithy`, behind a control token. Never uses an ordinary consumer token. |
| **Data plane** | Standard Solid resource operations — a consumer agent authenticates and retrieves records; deposits are committed as normal CSS resources. | Ordinary Solid HTTP/LDP + WAC/DPoP. |

The delivery pattern is **notify-then-pull**: the program deposits a record, the Databox sends a
minimal notification, and the person's agent authenticates and pulls the record into storage of their
own choosing.

## Contents

1. **[Getting started](getting-started.md)** — run the server, hit the Smithy, end-to-end flow.
2. **[Smithy control-plane API](smithy-api.md)** — the `/programs`, `/mappings`, `/source-events` reference.
3. **[Institution Profile](institution-profile.md)** — the machine-validated program definition.
4. **[Records, receipts & evidence](records-receipts-evidence.md)** — deposits, reconciliation, signed receipts, the ledger.
5. **[Policies & ODRL](policies-and-odrl.md)** — rights, prohibitions and auditable duties travelling with records.
6. **[Architecture & the design corpus](architecture-and-design.md)** — how it fits together, and where the deep specs live.

## Status

The Databox is a **reference implementation** shipped as an experimental Community Solid Server
extension (`src/databox/`, Track B config under `config/databox/`). Every subsystem is fail-closed and
unit-tested. The live single-process preset is **a demonstration boundary, not a production IAM model**:
its registries, keys and outbox are process-local, and the control token is a shared secret. Production
needs durable stores, KMS-held keys, a WORM evidence ledger and real operator authentication. See the
[implementation status](../README.md#implementation-status) for the precise wave-by-wave state and the
residual review gates.
