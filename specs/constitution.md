# Constitution — opensalestax-vendure

> Non-negotiable principles. Read before writing code; flag conflicts
> explicitly before deviating.

## §1. Mission

Ship a free, self-hostable **Vendure plugin** that routes Vendure's
tax-calculation pipeline through an OpenSalesTax engine instance
for destination-based US sales tax. Same merchant value
proposition as the WooCommerce / Medusa / Odoo / Saleor connectors:
no per-transaction fees, no SaaS lock-in, merchant runs both
Vendure and OST on their own infrastructure.

## §2. Architecture (locked 2026-05-13)

**V + X:**

- **V.** Vendure plugin (npm package), pure in-process. The
  plugin is a `@VendurePlugin`-decorated class loaded via the
  merchant's `vendure-config.ts`. It registers a
  `TaxLineCalculationStrategy` (and optionally a
  `TaxZoneStrategy`) that calls the OST engine HTTP API. No
  standalone HTTP server, no webhook subscriptions, no inbound
  authentication surface. The trust boundary is the merchant's
  own Vendure host.
- **X.** Merchant-self-hosted via NPM. The package ships to NPM
  as `@ejosterberg/vendure-plugin-opensalestax`; the merchant
  adds it to their Vendure project's dependencies and wires it
  in `vendure-config.ts`. No hosted SaaS option in v0.x. (If a
  SaaS tier is ever added, it's a separate fork or sibling
  project — this repo stays self-host-only.)

## §3. License

Apache-2.0. Matches the engine, the Python SDK, and the Medusa /
Saleor connectors. (The Odoo connector is LGPL/AGPL dual because
OCA requires AGPL; Vendure has no such constraint, so we keep
Apache 2.0 for maximum reuse.)

DCO sign-off mandatory on every commit. No AI co-author trailers.

## §4. Engine-call contract

The OST engine HTTP API (v1) is the source of truth. The Vendure
plugin calls:

- `POST /v1/calculate` — per-line tax calculation, destination ZIP
- `GET /v1/health` — for startup probe / Test Connection

The connector NEVER imports OST internals or relies on
undocumented engine behavior. The HTTP API is the contract; we
pin the engine `v1` API in our README's compatibility matrix.

## §5. USD-only

The OST engine is US-only and USD-only by design (engine
constitution §5). When Vendure invokes the plugin's strategy on
a non-USD order or with a non-US ship-to address, the strategy
returns **zero tax lines** so Vendure's built-in `TaxRate`
calculation handles the fallback. Vendure's strategy
chain-of-responsibility model makes this clean — the plugin opts
out, the default kicks in.

## §6. Calculation only

Never file returns, never remit collected tax, never validate
addresses. The connector computes tax; the merchant remits.
Every README and disclaimer carries this statement.

## §7. Trust boundary

Unlike the Saleor connector (which receives signed inbound
webhooks and verifies JWTs), this plugin is **purely outbound**.
It runs inside the merchant's Vendure process; whatever code
loaded the plugin is already trusted. There is no inbound
HTTP surface, no signature verification, no auth tokens to
manage.

The plugin's options (engine URL, optional API token, fail-hard
flag) come from one of two trusted sources:

1. `OpenSalesTaxPlugin.init({...})` arguments passed in
   `vendure-config.ts` (merchant-authored code)
2. `process.env` (merchant-controlled environment)

Both are merchant-trusted. The plugin validates them at
construction time (URL parse, token format) and fails fast on
bad input.

## §8. Fail-soft policy

When the OST engine is unreachable or returns 5xx, the strategy
returns an empty tax-line array (zero tax) and logs a warning.
Vendure's `TaxRate` fallback then applies. Merchants can opt
into **fail-hard** behavior (throw, which surfaces as an order
error in Vendure's admin) via `OSTAX_FAIL_HARD=1` or the
equivalent plugin option. Default is fail-soft.

## §9. Test environment

`@vendure/testing` provides an in-memory Vendure server harness
for integration testing. Tests spin up a Vendure instance, load
the plugin, place a synthetic order with a US ship-to address,
and assert the order's `taxLines` populate from a mocked OST
engine (or a real engine container when running the full
integration suite).

Unit tests mock the OST client; integration tests use real
engine calls against `http://10.32.161.126:8080` (the shared
dev engine) or a locally-started container.

## §10. Out of scope

Per the engine + project constitutions:

- Tax filing / remittance
- Address validation / autocomplete
- Non-USD currency
- Non-US jurisdictions
- Tax-exempt customer certificate validation against state DOR
- Marketplace facilitator handling (NJ / CA seller-of-record
  edge cases)
- Modifying upstream Vendure source
- Standalone HTTP / webhook server (Decision V — Vendure
  invokes us in-process; we don't receive callbacks)
- Admin UI in v1.0 (configuration is env vars + plugin
  options; an embedded UI panel is a v1.1 candidate)
