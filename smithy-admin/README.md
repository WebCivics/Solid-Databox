# Databox Forge — Admin Console (`forge-admin`)

[![Refine](https://img.shields.io/badge/Built_with-Refine-1890FF.svg)](https://refine.dev/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF.svg)](https://vite.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38BDF8.svg)](https://tailwindcss.com/)

The admin console (control plane) for **[Solid Databox](../README.md)**. It is a single-page
[Refine](https://refine.dev/) application that an organisation operator uses to onboard programs, provision
relationship mappings, dispatch institutional events, declare the information it is obliged to make available to
people, and handle inbound consumer-rights requests — all against the Databox **Forge** API exposed by a running
Solid Databox server.

It implements the operator-facing slice of the Forge productization plan
([MFG-10 / MFG-11](../databox/forge-plan/README.md)) and supersedes the lightweight vanilla-JS "Forge Management UI"
that the server still serves at `/forge` (see [Relationship to the embedded `/forge` UI](#relationship-to-the-embedded-forge-ui)).

> **Scope & status.** This is a reference/demonstration control plane, not a hardened product. The API bearer token
> is a hardcoded demonstration boundary (not organisation IAM), and several screens are backed by in-memory mock
> data rather than live endpoints — see [Caveats](#caveats). Statutory references shown in the UI are indicative
> classification pointers, **not legal advice**.

## Contents

- [What it does](#what-it-does)
- [Screens](#screens)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Two run modes: live vs. demo](#two-run-modes-live-vs-demo)
- [The Forge control-plane API](#the-forge-control-plane-api)
- [Reference data](#reference-data)
- [Project structure](#project-structure)
- [Configuration](#configuration)
- [Caveats](#caveats)

## What it does

- **Onboards organisation programs** into the Databox Forge as schema.org `Organization` profiles.
- **Provisions relationship mappings** — turning a program + synthetic customer id + holder key into a portable,
  holder-bound **connection credential** (JWS).
- **Dispatches source-events** into a Databox stream and shows the reconciliation status and signed receipt.
- **Captures an organisation's information-provision obligations**: pick an ANZSIC industry and the console tailors a
  taxonomy of the information & data categories the organisation must make available to a person, viewable through an
  **AU / Multi-jurisdiction / Standards** lens, then writes them into the program profile.
- **Runs a Data Portability Registry**: browse a directory of ~345 platforms and lodge a "request my own data" back
  — as an organisation or a natural person — under a chosen regulatory basis (CDR / Privacy Act APP 12 / GDPR Art. 20).
- **Surfaces consumer-rights workflows** (per [ADR-0023](../databox/decisions/ADR-0023-record-awareness-access-correction.md)):
  inbound access requests, correction requests, and a per-consumer ledger of held data with source and policy.

## Screens

The left sidebar (`src/components/layout/index.tsx`) groups the routes:

| Screen | Route | Backend | What it does |
|---|---|---|---|
| **Programs List** | `/programs` | Live Forge API | Lists organisation programs registered in the Forge. |
| **Onboard Organization** | `/programs/create` | Live Forge API | Registers an institution profile (schema.org `Organization`) and returns its program URI. |
| **Mappings Simulator** | `/mappings` | Live Forge API | Provisions a customer relationship mapping; returns the holder-bound connection credential JWS. |
| **Event Dispatcher** | `/events` | Live Forge API | Injects a source-event (record class, legal basis, purpose, payload) and shows reconciliation status + receipt. |
| **Organization Set-up** | `/setup` | Live Forge API | Rich onboarding: identity + ANZSIC classification → industry-tailored information-category taxonomy → writes `capabilities`, `informationCategories` and `ontologyMappings` into the profile. |
| **Data Portability** | `/data-portability` | In-memory | Directory of ~345 platforms; lodge outbound "request my data" as organisation or natural person, and track the requests. |
| **Access Requests** | `/access-requests`, `/access-requests/show/:id` | In-memory | Inbound data-subject access requests and their disposition. |
| **Correction Requests** | `/corrections`, `/corrections/show/:id` | In-memory | Inbound rectification requests and their disposition. |
| **Consumer Ledger** | `/consumer-ledger`, `/consumer-ledger/show/:id` | In-memory | What data is held about each consumer, with source system and governing policy. |

## Tech stack

- **[Refine](https://refine.dev/) 4** (`@refinedev/core`, `@refinedev/react-router-v6`) — resources, routing and
  data-provider abstraction.
- **React 19** + **react-router-dom 6**.
- **Vite 8** (dev server / bundler) with **`@vitejs/plugin-react`**.
- **Tailwind CSS v4** via **`@tailwindcss/vite`** (the "glass" dark theme lives in `src/index.css`).
- **TypeScript ~6** and **oxlint** for linting.

## Getting started

**Prerequisites**

- Node.js **24.0+**, per the [repository's engines field](../package.json). (Vite 8 itself only requires
  20.19+ / 22.12+, but this repository's floor is higher.)
- For [live mode](#two-run-modes-live-vs-demo): a running **Solid Databox** server with the Databox Forge mounted
  (default `http://localhost:3000/`). See the [live CSS integration guide](../databox/live-css-integration.md).

**Install & run**

```bash
cd forge-admin
npm install
npm run dev        # live mode — expects the Forge API at http://localhost:3000/.databox/forge
```

**Scripts**

| Script | Purpose |
|---|---|
| `npm run dev` | Start the Vite dev server (live mode: BrowserRouter + real Forge API). |
| `npm run build` | Type-check (`tsc -b`) and produce a production bundle in `dist/`. |
| `npm run preview` | Serve the built bundle locally. |
| `npm run lint` | Run oxlint. |

## Two run modes: live vs. demo

`src/App.tsx` selects behaviour from the `VITE_DEMO` env flag:

| | Live (default) | Demo (`VITE_DEMO=true`) |
|---|---|---|
| Router | `BrowserRouter` | `HashRouter` (works on static hosting) |
| Data provider | `dataProvider` — talks to the Forge API | `demoDataProvider` — fully in-memory, **no backend** |
| Use | Operating against a real Solid Databox server | Backendless walkthrough (e.g. GitHub Pages) |

**Demo build & deploy.** The demo build is a self-contained static bundle with relative asset paths. The committed
output lives in [`../docs/admin/`](../docs/admin) and is linked from the project's docs landing page as
*"Open the Admin Demo →"* ([`../docs/index.html`](../docs/index.html)), served via GitHub Pages. Regenerate it with a
relative base and demo flag, for example:

```bash
VITE_DEMO=true npx vite build --base=./ --outDir=../docs/admin --emptyOutDir
```

In demo mode every resource (programs, mappings, events, portability and the consumer-rights screens) is served from
`demoDataProvider`, so the console is fully explorable with no server running.

## The Forge control-plane API

In live mode the data provider (`src/providers/dataProvider.ts`) calls the Forge endpoints on the Solid Databox
server, authenticated with a `Bearer` control token:

| Resource | Method | Endpoint |
|---|---|---|
| `programs` | `GET` / `POST` | `/.databox/forge/programs` |
| `mappings` | `POST` | `/.databox/forge/mappings` |
| `source-events` | `POST` | `/.databox/forge/source-events` |

`API_URL` and `TOKEN` are constants at the top of `dataProvider.ts`. The remaining resources
(`corrections`, `access-requests`, `consumer-ledger`, `outbound-requests`) are currently served from in-memory mock
arrays in the same file — the UI is wired and ready for real endpoints when they land.

## Reference data

Two data modules drive the richer screens:

- **Information & data category taxonomy** — `src/data/informationCategories.ts`
  - **219 categories** across **14 groups** (transactional records, mandatory disclosures, privacy & data-rights
    outputs, account/identity, AI & automated systems, biometrics, communications, tracking, identity/KYC,
    employment, marketing, fraud/risk, special-category, and sector-specific), plus **14 sector packs**.
  - Deliberately **layered** so one dataset serves three views:
    1. **AU** — `basis.au` carries Australian statutory references (Privacy Act / APPs, CDR, Australian Consumer Law…).
    2. **Multi-jurisdiction** — `basis.eu` adds parallel EU bases (GDPR and related) side-by-side.
    3. **Standards** — a jurisdiction-agnostic `rightType` resolves to machine-resolvable vocabulary URIs:
       **[W3C DPV](https://w3id.org/dpv)** (core), its **EU-GDPR extension** (by article), and
       **[ODRL](http://www.w3.org/ns/odrl/2/)** (the operational action).
  - Each category carries a **direction** (`push` = must provide, `record` = transaction artefact, `pull` = on
    request), `portability` / `sensitive` flags, an `appliesTo` list of ANZSIC divisions, and a `recommended` default.
  - Helpers: `applicableCategories(division)`, `recommendCategories(division)`, `vocabFor(rightType)`.
- **Platform ontology registry** — `src/pages/setup/platformData.ts`
  - `PLATFORM_ONTOLOGIES`: a directory of **~345 platforms** (Enterprise, Consumer and more) that the Data
    Portability Registry lists and files outbound requests against.

> The statutory references are indicative pointers to help classify data, not legal advice or exhaustive citations.

## Project structure

```text
forge-admin/
├─ index.html                     # Vite entry (title: "Admin")
├─ vite.config.ts                 # React + Tailwind v4 plugins
├─ src/
│  ├─ App.tsx                     # Refine setup, resources, routes, live/demo switch
│  ├─ main.tsx                    # React root
│  ├─ index.css                   # Tailwind + glass dark theme
│  ├─ components/layout/          # Sidebar navigation + content shell
│  ├─ providers/
│  │  ├─ dataProvider.ts          # Live Forge API (+ in-memory mocks for some resources)
│  │  └─ demoDataProvider.ts      # Fully in-memory provider for VITE_DEMO builds
│  ├─ data/
│  │  └─ informationCategories.ts # 219-entry taxonomy + AU/EU/standards mappings
│  └─ pages/
│     ├─ programs/                # list, create (onboard)
│     ├─ mappings/create.tsx      # provisioning simulator
│     ├─ events/create.tsx        # event dispatcher
│     ├─ setup/                   # Organization Set-up (index) + InformationCategories + platformData
│     ├─ data-portability/        # Data Portability Registry
│     ├─ access-requests/         # list, show
│     ├─ corrections/             # list, show
│     └─ consumer-ledger/         # list, show
```

## Configuration

| What | Where |
|---|---|
| Forge API base URL | `API_URL` in `src/providers/dataProvider.ts` |
| Control-plane bearer token | `TOKEN` in `src/providers/dataProvider.ts` |
| Live vs. demo mode | `VITE_DEMO` env var (read in `src/App.tsx`) |
| Theme / styling | `src/index.css` (Tailwind v4 + glass utilities) |

## Relationship to the embedded `/forge` UI

The Solid Databox server also ships a minimal, dependency-free **Forge Management UI** (Programs / Mappings /
Events) generated by [`../scripts/build-forge-ui.js`](../scripts/build-forge-ui.js) into the server's root templates
and served at `/forge`. This `forge-admin` app is the richer, standalone Refine successor; both talk to the same
`/.databox/forge` control-plane API.

## Caveats

- **Demonstration security boundary.** The `Bearer` control token is hardcoded and is a demo boundary, not
  organisation identity/access management. Do not treat it as production auth.
- **Partial live wiring.** Only `programs`, `mappings` and `source-events` call the real Forge API. Corrections,
  access requests, the consumer ledger and outbound portability requests are in-memory mock data today.
- **Natural-person portability.** In production a natural person lodges a portability request from their own Databox
  agent; this admin surface can lodge it on their behalf (as the UI notes).
- **Not legal advice.** The information-category statutory bases are indicative classification aids only.

---

Part of the [Solid Databox](../README.md) project. See the [Databox design corpus](../databox/README.md) and the
[Forge productization plan](../databox/forge-plan/README.md) for the surrounding architecture and roadmap.
