# @ejosterberg/vendure-plugin-opensalestax

[![ci](https://github.com/ejosterberg/opensalestax-vendure/actions/workflows/ci.yml/badge.svg)](https://github.com/ejosterberg/opensalestax-vendure/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@ejosterberg/vendure-plugin-opensalestax.svg)](https://www.npmjs.com/package/@ejosterberg/vendure-plugin-opensalestax)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

Vendure plugin for **destination-based US sales tax** via the
self-hosted [OpenSalesTax](https://github.com/ejosterberg/opensalestax)
engine. No SaaS, no per-transaction fees, no third-party API keys.

- Implements Vendure's `TaxLineCalculationStrategy` — Vendure
  invokes us per `OrderLine`; we return per-jurisdiction tax
  lines (state, county, city, transit district, etc.)
- **USD-only / US-only.** Non-USD or non-US orders pass through
  to Vendure's built-in `TaxRate` pipeline unchanged.
- **Fail-soft default.** If the OpenSalesTax engine is
  unreachable, the plugin returns zero tax + logs a warning;
  Vendure's default tax rates take over so checkouts don't
  block. Opt into fail-hard via env var.
- **No inbound HTTP surface.** Pure outbound HTTP to the
  configured engine URL. The plugin runs in-process inside your
  Vendure server.

## Compatibility

| Plugin | Vendure | OST engine | Node |
|--------|---------|-----------|------|
| 0.1.x  | 3.x     | 0.22+ (v1 API) | 20+ |

## Quickstart (≤10 minutes)

### 1. Install

```bash
npm install @ejosterberg/vendure-plugin-opensalestax
```

### 2. Wire it into `vendure-config.ts`

```ts
import { OpenSalesTaxPlugin } from '@ejosterberg/vendure-plugin-opensalestax';
import { VendureConfig } from '@vendure/core';

export const config: VendureConfig = {
  // ...your existing config...
  plugins: [
    // ...your existing plugins...
    OpenSalesTaxPlugin.init({
      apiUrl: process.env.OSTAX_API_URL!,
      // failHard: true,        // optional; default fail-soft
      // apiToken: '...',       // optional; X-API-Key header
      // timeoutMs: 5000,       // optional; per-request timeout
    }),
  ],
};
```

### 3. Set the environment variable

```bash
# Point at your OpenSalesTax engine instance (HTTP or HTTPS)
export OSTAX_API_URL="https://ost.your-domain.com"

# Optional:
# export OSTAX_API_TOKEN="..."
# export OSTAX_FAIL_HARD=1
# export OSTAX_TIMEOUT_MS=5000
```

### 4. Configure a US tax zone in Vendure Admin (one-time)

In the Admin UI:

1. **Settings → Zones** → Add a Zone "US" with United States as
   the sole member country
2. **Settings → Tax Categories** → Confirm "Standard" exists
3. **Settings → Tax Rates** → Create a placeholder rate
   "US Standard" of `0%` in zone US, category Standard. (OST
   provides the real rate via the strategy; this placeholder
   exists so Vendure's normal pipeline always has something to
   fall back to.)
4. **Settings → Channels → Default channel** → Set default tax
   zone to "US"

### 5. Restart Vendure

On boot you'll see a log line like:

```
[OpenSalesTaxPlugin] OpenSalesTax engine reachable: status=ok version=0.55.4 db=true
```

If the engine is unreachable, you'll see a WARN (default
fail-soft mode) — the plugin still loads and Vendure's default
tax pipeline takes over until the engine comes back.

### 6. Place a test US order

Use the Shop GraphQL API to add an item, set a US shipping
address, and inspect `taxLines`:

```graphql
mutation {
  setOrderShippingAddress(input: {
    streetLine1: "100 N 6th St"
    city: "Minneapolis"
    province: "MN"
    postalCode: "55403"
    countryCode: "US"
  }) {
    ... on Order {
      lines {
        taxLines { description rate }
      }
      totalWithTax
    }
  }
}
```

You should see one `TaxLine` per OST jurisdiction (e.g.
"Minnesota (State)", "Minneapolis (City)", "Hennepin Transit
(Transit)") with the correct percentage rates. Vendure
multiplies these against the line price to compute the actual
tax amount.

## Configuration reference

| Option        | Env var               | Default | Description |
|---------------|-----------------------|---------|-------------|
| `apiUrl`      | `OSTAX_API_URL`       | —       | **Required.** Base URL of your OST engine. Must be `http:` or `https:`. Validated at plugin init. |
| `apiToken`    | `OSTAX_API_TOKEN`     | —       | Optional. Sent as the `X-API-Key` header. Most self-hosted deployments don't need this. |
| `failHard`    | `OSTAX_FAIL_HARD=1`   | `false` | When `true`, engine errors throw (Vendure surfaces as order error). Default `false` returns `[]` + warns. |
| `timeoutMs`   | `OSTAX_TIMEOUT_MS`    | `5000`  | Per-request timeout in milliseconds. |

Options passed to `init()` take priority over env vars.

## How it works

```
┌─────────────────────────────────────────────────┐
│ Merchant's Vendure server                       │
│  ┌─────────────────────────────────────────┐    │
│  │ Order checkout flow                     │    │
│  │  ↓                                      │    │
│  │ TaxLineCalculationStrategy.calculate()  │    │
│  │  ↓                                      │    │
│  │ OstaxTaxLineStrategy                    │    │
│  │  ├─ Gate: USD? US? valid ZIP?           │    │
│  │  └─ POST /v1/calculate ─────────────────┼────┼──→ OpenSalesTax engine
│  └─────────────────────────────────────────┘    │   (merchant-self-hosted)
└─────────────────────────────────────────────────┘
```

For each order line, the plugin:

1. Gates on `currencyCode === "USD"`,
   `shippingAddress.countryCode === "US"`, and ZIP regex
   `^\d{5}(-\d{4})?$`. If any fail → return `[]` and Vendure's
   built-in `TaxRate` pipeline takes over.
2. Sends a single-line `POST /v1/calculate` to the engine with
   the line's `proratedUnitPrice` (in dollars) and category
   `"general"`.
3. Maps each jurisdiction in the response to a Vendure
   `TaxLine` (`description` + `taxRate`). Vendure handles the
   multiplication.

## Troubleshooting

### "OpenSalesTax engine health check failed at startup"

The plugin couldn't reach `apiUrl` at boot. The plugin still
loads (fail-soft); calculations will return zero tax until the
engine is reachable. Check:

- Is `OSTAX_API_URL` set and reachable from the Vendure host?
- Is the OST engine container running and healthy?
- Can you `curl $OSTAX_API_URL/v1/health` from the Vendure
  server?

### "Returns zero tax even for US orders"

Possible causes:

1. The engine is unreachable — check Vendure boot logs for
   the health-check warning.
2. The order's `shippingAddress.countryCode` is not exactly
   `"US"` (case-sensitive).
3. The order's `postalCode` doesn't match `^\d{5}(-\d{4})?$`.
4. The order's `currencyCode` is not `"USD"`.
5. The OST engine has no rate data for the destination ZIP
   (rare; check engine logs).

### "I want errors to surface, not silently fall back"

Set `OSTAX_FAIL_HARD=1` (or `init({ failHard: true })`).
Engine errors then throw, which Vendure surfaces as an order
error in the Admin UI.

### "Plugin doesn't appear to register"

Verify in the running Vendure server:

```ts
import { ConfigService } from '@vendure/core';

// In a NestJS-aware context (e.g. an admin-API resolver):
const cfg = injector.get(ConfigService);
console.log(cfg.taxOptions.taxLineCalculationStrategy);
// Expect: OstaxTaxLineStrategy
```

Common causes: forgot to call `OpenSalesTaxPlugin.init({...})`
(the `init()` is required to capture options); plugin
registered after a different plugin that also overrides
`taxLineCalculationStrategy`.

## What this plugin does NOT do

By design (constitution §6 + §10):

- **Filing or remittance.** It computes tax. You file.
- **Address validation.** Bring your own / use Vendure's.
- **Non-USD currencies.** Returns `[]` so Vendure's default
  pipeline applies.
- **Non-US jurisdictions.** Same — returns `[]`.
- **Tax-exempt customer certificate validation.**
- **Marketplace facilitator** (NJ / CA seller-of-record edge
  cases).
- **Inbound webhooks / standalone server.** Pure outbound HTTP
  to your engine.

For any of these, run a separate process or use a dedicated
service.

## Security

The plugin exposes **no inbound HTTP routes, no GraphQL
resolvers, no webhook receivers**. The trust boundary is your
Vendure host; whatever code loaded the plugin is already
trusted.

`apiUrl` is validated at plugin init: URL parse + scheme
allowlist (`http:`, `https:`). Customer addresses, line item
descriptions, product names, and customer email are never
logged.

Reporting vulnerabilities: see [`SECURITY.md`](SECURITY.md).

## Contributing

DCO sign-off mandatory on every commit
(`git commit -s`). See [`CONTRIBUTING.md`](CONTRIBUTING.md).
Apache-2.0 licensed.

## Related projects

| Connector | Stack | Repo |
|-----------|-------|------|
| OpenSalesTax engine | Python | [opensalestax](https://github.com/ejosterberg/opensalestax) |
| Medusa v2           | TypeScript | [medusa-plugin-opensalestax](https://github.com/ejosterberg/opensalestax-medusa) |
| WooCommerce         | PHP | [woocommerce-opensalestax](https://github.com/ejosterberg/opensalestax-woocommerce) |
| Odoo                | Python | opensalestax-odoo-src |
| Vendure             | TypeScript | **this repo** |
