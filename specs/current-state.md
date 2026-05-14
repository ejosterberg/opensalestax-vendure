# Current State — opensalestax-vendure

**Last updated:** 2026-05-13 (project scaffolded)
**Status:** **Pre-alpha — specs scaffolded; no code yet.** Eric
confirmed architecture (Vendure plugin via `@VendurePlugin`,
in-process `TaxLineCalculationStrategy`, merchant self-hosted
via NPM). Next step: scaffold `package.json` + source layout,
then implement v0.1.0 alpha (strategy that calls OST engine,
integration test via `@vendure/testing`).

## Where the upstream engine is

OpenSalesTax engine — same instance the other connectors point at.
Pin in production: **v0.22+** (pre-v0.22 had the SD-state-bleed
bug, closed in v0.22.0). Tested-against version pinned per release.
v1 HTTP API: `POST /v1/calculate`, `GET /v1/health`,
`GET /v1/states`, `GET /v1/rates`.

## Where the platform is

Vendure — **v3.0+** target floor. Vendure's plugin API evolved
significantly between v1 and v3; `TaxLineCalculationStrategy`
and `TaxZoneStrategy` as documented in v3 are the modern
extension points. Stage 00 should re-verify the target major is
still v3 (or whatever Vendure's current LTS is at session
start).

Strategy interfaces the plugin implements:

- `TaxLineCalculationStrategy` — given an `OrderLine` +
  `TaxCategory` + `Zone` + context, return a `TaxLine[]` with
  computed tax. **Required.**
- `TaxZoneStrategy` — given an order's ship-to address,
  determine the active `Zone` (helps Vendure pick which tax
  category applies). **Optional** for v0.1; useful when the
  merchant hasn't pre-configured a US tax zone.

Both strategies run synchronously in the order-creation /
order-modification path. Vendure expects them to return
promptly (target ≤2 s with OST's typical ~50-200 ms RTT).

## What's shipped

(Nothing yet — this is the project's first session.)

## What's planned (in order)

### v0.1.0 alpha (this session or next)

- `package.json` with `@vendure/core` as a peerDep + `@vendure/testing` as devDep
- `tsconfig.json` (strict) + `jest.config.js` + `.eslintrc` + `.prettierrc`
- `src/lib/ostax-client.ts` — minimal HTTP client lifted from the
  Medusa connector's `client.ts` (~130 lines), with a
  `healthCheck()` method added
- `src/lib/config.ts` — typed loader merging
  `OpenSalesTaxPlugin.init(options)` with env-var defaults;
  fails fast on missing / invalid input
- `src/opensalestax.plugin.ts` — the `@VendurePlugin` class with
  `init(options)` static + `providers` array registering the
  strategies
- `src/strategies/ostax-tax-line.strategy.ts` — implements
  `TaxLineCalculationStrategy`; gates on USD + US ship-to, calls
  OST, returns `TaxLine[]`
- `src/strategies/ostax-tax-zone.strategy.ts` (optional) —
  implements `TaxZoneStrategy` for US zone mapping
- `src/index.ts` — re-exports `OpenSalesTaxPlugin`, the strategy
  classes, and the options type
- `tests/unit/*.test.ts` — Jest unit tests for client, strategy,
  config validation
- `tests/integration/plugin.test.ts` — `@vendure/testing` harness
  spins up Vendure, registers the plugin, places an order with a
  MN ship-to, asserts nonzero tax
- `README.md` with install + configuration walkthrough
- Apache-2.0 LICENSE + SPDX headers + CONTRIBUTING.md (DCO)

### v0.2 polish queue (after v0.1 alpha ships)

- Vendure Hub listing submission (curated listing at
  https://vendure.io/hub — manual review, not gated on this
  alpha)
- Tax category mapping (Vendure's `TaxCategory` records → OST's
  six categories — same shape as the WooCom v0.3.3 / Odoo v0.1.13
  pattern)
- Per-state nexus filter (matches Odoo v0.3.0)
- Operator telemetry — last successful calc, failure streak;
  surface via a Vendure admin UI extension or job-queue events
- Exemption-certificate handling
- Optional admin UI panel via Vendure's UI extensions framework

## Spec-folder map

| File | Purpose |
|---|---|
| `specs/constitution.md` | Non-negotiable principles (license, architecture, USD-only) |
| `specs/current-state.md` | This file — snapshot for fresh sessions |
| `specs/handoff.md` | What the next session should pick up |
| `specs/research/vendure-tax-plugin.md` | Vendure's plugin + strategy framework — APIs, lifecycle, testing harness |
| `specs/phase-01-alpha/spec.md` | v0.1.0 user stories + functional requirements |
| `specs/phase-01-alpha/plan.md` | Implementation plan — file layout, dependencies, test strategy |
| `specs/phase-01-alpha/tasks.md` | Atomic, ordered task list |

(The `phase-01-alpha/` directory is created when the design is
locked. As of 2026-05-13 it's not yet populated — that's the next
session's first job.)

## Sibling-project map

| Path | Stack | State |
|---|---|---|
| `opensalestax-Odoo/` | Planning hub | active (drives all connector projects) |
| `opensalestax-python/` | Python SDK | shipped to PyPI |
| `opensalestax-odoo-src/` | Odoo connector | v0.4.1 shipped on PyPI; OCA PR queued |
| `opensalestax-medusa/` | Medusa v2 plugin | shipped; NPM `@ejosterberg/medusa-plugin-opensalestax` |
| `opensalestax-woocommerce/` | WordPress plugin | shipped |
| `opensalestax-stripe-php/` | Stripe-PHP connector | shipped, private repo pending Packagist flip |
| `opensalestax-php/` | PHP SDK | shipped, private repo pending Packagist flip |
| `opensalestax-saleor/` | Saleor Tax App | pre-alpha, specs + kickoff |
| `opensalestax-magento/` | Magento module | pre-alpha, specs + kickoff |
| `opensalestax-vendure/` | **THIS** — Vendure plugin | pre-alpha, specs only |
