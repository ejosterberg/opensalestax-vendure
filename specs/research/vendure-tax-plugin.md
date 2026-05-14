# Vendure plugin + tax-strategy framework — technical research

> Snapshot of Vendure's plugin and tax-calculation framework as
> of 2026-05. Vendure evolves; re-validate everything in this
> doc before writing code against it. Primary source:
> <https://docs.vendure.io/guides/developer-guide/plugins/> and
> <https://docs.vendure.io/reference/typescript-api/>.

## 1. What a Vendure plugin is

A Vendure plugin is a TypeScript class decorated with
`@VendurePlugin({...})` from `@vendure/core`. It bundles
together: NestJS providers (services), Vendure config
extensions (custom fields, strategies, admin-UI extensions),
event subscribers, and entity definitions. The merchant loads
it in their `vendure-config.ts`:

```ts
import { OpenSalesTaxPlugin } from '@ejosterberg/vendure-plugin-opensalestax';

export const config: VendureConfig = {
  // ...
  plugins: [
    OpenSalesTaxPlugin.init({
      apiUrl: process.env.OSTAX_API_URL!,
      failHard: process.env.OSTAX_FAIL_HARD === '1',
    }),
  ],
};
```

The plugin runs in the merchant's Vendure process (no
separate container, no HTTP boundary). Anything the plugin
does happens with the same trust as Vendure itself.

Docs: <https://docs.vendure.io/guides/developer-guide/plugins/>

## 2. Tax-calculation extension points (the contract)

Vendure has TWO strategy interfaces relevant to a tax connector:

| Interface | When called | Required? |
|---|---|---|
| `TaxLineCalculationStrategy` | When an order line's tax must be computed (order create, line add, line update, address change) | **YES** for v0.1 |
| `TaxZoneStrategy` | When Vendure needs to resolve "which Zone does this order belong to" (drives which `TaxRate` set applies) | Optional; merchants can configure a US Zone manually |

Both are configured under `config.taxOptions` and Vendure
chains them (calls our strategy first; if it returns nothing
useful, falls back to its built-in calculation against
`TaxRate` records). The chain is what makes the USD/US-only
gate clean — return `[]` and Vendure does its own thing.

## 3. `TaxLineCalculationStrategy` — signature

From `@vendure/core` (approximate; verify against the version
installed at stage 02):

```ts
interface TaxLineCalculationStrategy {
  calculate(args: TaxLineCalculationArgs): Promise<TaxLine[]> | TaxLine[];
}

interface TaxLineCalculationArgs {
  ctx: RequestContext;          // includes currencyCode, channel, etc.
  order: Order;                 // includes shippingAddress
  orderLine: OrderLine;         // the line being taxed
  taxCategory: TaxCategory;     // merchant-defined category (general, food, etc.)
  taxRate: TaxRate;             // the default rate Vendure would apply
}

interface TaxLine {
  description: string;          // human-readable, e.g. "MN State Sales Tax"
  taxRate: number;              // percent as number, e.g. 6.875 (not 0.06875)
  amount: number;               // tax amount in minor units (cents)
}
```

What the plugin reads:

- **`ctx.currencyCode`** — Gate: must be `"USD"`
- **`order.shippingAddress`** — Gate: country code must be
  `"US"`; ZIP must match `^\d{5}(-\d{4})?$`; state code drives
  nexus filter (post-v0.1)
- **`orderLine.linePriceWithTax` / `orderLine.linePrice`** —
  amount to send to OST as the line's pre-tax value
- **`orderLine.productVariant.sku`** — for logging /
  diagnostics (NOT customer PII)
- **`orderLine.quantity`** — useful for OST line metadata

The plugin maps each `OrderLine` to one OST `LineItem`. Vendure
calls the strategy once per line; the plugin can either:

- Call OST per-line (simple; one HTTP round-trip per line; fine
  at small scale)
- Cache OST responses across calls within one order (v0.2
  optimization)

For v0.1: per-line call. The OST engine's `~50–200ms` RTT keeps
this well inside Vendure's expectation for a synchronous
strategy call.

## 4. `TaxZoneStrategy` — signature

Approximate (verify at stage 02):

```ts
interface TaxZoneStrategy {
  determineTaxZone(
    ctx: RequestContext,
    zones: Zone[],
    channel: Channel,
    order?: Order,
  ): Zone | undefined | Promise<Zone | undefined>;
}
```

What we'd do (when implemented in v0.2 or as an optional v0.1
extra):

- Inspect `order.shippingAddress.countryCode`. If `US`, find the
  Vendure `Zone` whose `members` include US country. Return
  that zone.
- If `null` (no order, e.g. catalog browse), return the
  channel's default `defaultTaxZone`.

This is purely about ZONE resolution; it doesn't compute tax
itself (that's `TaxLineCalculationStrategy`'s job).

For v0.1: **defer**. The merchant configures their US zone
manually in the Vendure Admin UI; the plugin's
`TaxLineCalculationStrategy` is what actually does the work.

## 5. Plugin registration pattern

The standard Vendure pattern for a configurable plugin:

```ts
// src/opensalestax.plugin.ts
import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { OstaxTaxLineStrategy } from './strategies/ostax-tax-line.strategy';
import { OpenSalesTaxPluginOptions } from './types';

@VendurePlugin({
  imports: [PluginCommonModule],
  providers: [
    {
      provide: 'OSTAX_PLUGIN_OPTIONS',
      useFactory: () => OpenSalesTaxPlugin.options,
    },
  ],
  configuration: (config) => {
    config.taxOptions.taxLineCalculationStrategy = new OstaxTaxLineStrategy();
    return config;
  },
})
export class OpenSalesTaxPlugin {
  static options: OpenSalesTaxPluginOptions;

  static init(options: OpenSalesTaxPluginOptions): typeof OpenSalesTaxPlugin {
    this.options = options;
    return OpenSalesTaxPlugin;
  }
}
```

The `init(options)` static method is the merchant-facing API.
It stashes options on the class itself so the strategy
constructor (or DI) can read them.

## 6. Strategy initialisation lifecycle

Vendure's strategy interfaces support an optional
`init(injector: Injector): Promise<void>` hook (and a
corresponding `destroy()`). The plugin's strategy can use
`init` to:

- Pull the merged config (env + plugin options) via the
  injector
- Construct the OST HTTP client once and reuse it
- Run a health-check probe against `/v1/health` and log a
  WARN if the engine is unreachable (so the merchant sees the
  problem at server-boot time, not first-checkout time)

## 7. Testing — `@vendure/testing`

Vendure ships an official test harness:
<https://docs.vendure.io/guides/developer-guide/testing/>.

The pattern:

```ts
import {
  createTestEnvironment,
  registerInitializer,
  SqljsInitializer,
  testConfig,
} from '@vendure/testing';
import { OpenSalesTaxPlugin } from '../src';

registerInitializer('sqljs', new SqljsInitializer('__data__'));

describe('OpenSalesTaxPlugin', () => {
  const { server, adminClient, shopClient } = createTestEnvironment({
    ...testConfig(),
    plugins: [
      OpenSalesTaxPlugin.init({
        apiUrl: 'http://localhost:8080',  // or a nock mock
      }),
    ],
  });

  beforeAll(async () => {
    await server.init({
      productsCsvPath: 'fixtures/products.csv',
      customerCount: 1,
    });
  });

  afterAll(() => server.destroy());

  it('calculates tax on a MN shipping address', async () => {
    // place an order, set US/MN address, assert taxLines
  });
});
```

In-memory SQLjs DB makes the integration test fast (~5s per
spec). Mock OST with `nock` or a small Express stub; or point
at the shared engine at `http://10.32.161.126:8080` when
running locally.

## 8. Configuration sources

Three layers, merged in priority order (highest wins):

1. **`OpenSalesTaxPlugin.init({...})` options** in
   `vendure-config.ts` — merchant-explicit
2. **Environment variables** — `OSTAX_API_URL`, `OSTAX_API_TOKEN`,
   `OSTAX_FAIL_HARD`
3. **Built-in defaults** — `failHard: false`; no default
   `apiUrl` (fail-fast if neither layer 1 nor 2 supplies one)

`src/lib/config.ts` does this merge once at `init(options)`
time and exposes a frozen typed object.

## 9. Package distribution

NPM is the primary channel:

- Package name: `@ejosterberg/vendure-plugin-opensalestax`
- Public, Apache-2.0
- Ships compiled `dist/` (no `src/`, no tests)
- Lists `@vendure/core` as a peer dep (not a direct dep — the
  merchant's project owns the Vendure version)

There's no "Vendure App Store" — Vendure has the **Vendure
Hub** (https://vendure.io/hub), a curated listing of community
plugins. Submission is a manual / editorial process, not gated
by automated review. Treat Hub listing as an optional v1.0
step or defer to v1.1.

## 10. Open questions

- **Per-line vs per-order OST calls**: v0.1 does per-line.
  Vendure calls the strategy once per line, so to avoid N+1
  HTTP calls we could batch within a `RequestContext` lifecycle
  via a request-scoped cache. v0.2 polish.
- **`TaxZoneStrategy` in v0.1**: defer (merchants configure US
  Zone manually) vs ship now. Default to deferring; a tiny
  `decisions/001-defer-tax-zone-strategy.md` ADR captures the
  call.
- **Engine version pinning**: surface in README's compatibility
  matrix; consider exposing in the admin UI in v0.2.
- **Multi-channel**: Vendure supports multiple channels per
  instance (per-storefront isolation). The plugin engages on
  any channel whose `currencyCode === USD`. We don't expose
  channel filters in v0.1; v0.2 adds opt-in/opt-out per
  channel.
- **Vendure Hub listing**: optional v1.0 task; defer if
  merchant-feedback is the higher priority.
