# CLAUDE.md — opensalestax-vendure

> Project memory for Claude sessions on the Vendure plugin
> connector. Read this AND `specs/constitution.md` +
> `specs/handoff.md` before writing code.

## Mission

Ship a free, self-hostable Vendure plugin that routes Vendure's
tax-calculation strategy through an OpenSalesTax engine for
destination-based US sales tax. Same value prop as the other OST
connectors.

## Stack

- **Language:** TypeScript (Node 20+)
- **Framework:** Vendure plugin loaded via `vendure-config.ts` —
  pure in-process; uses `@VendurePlugin` + `@vendure/core`
  strategy interfaces (Decision V, locked 2026-05-13 — no
  standalone server, no webhooks, no JWT)
- **Distribution:** NPM as
  `@ejosterberg/vendure-plugin-opensalestax`; merchant adds it
  as a dependency in their own Vendure project (Decision X)
- **License:** Apache-2.0
- **Tests:** Jest + ts-jest + `@vendure/testing` for integration

## Architectural anchors

- **No standalone server.** The plugin loads in the merchant's
  Vendure process. The trust boundary is the merchant's own
  Vendure host — there's no inbound webhook surface to secure.
- **`TaxLineCalculationStrategy`** from `@vendure/core` is the
  registered extension point. The plugin returns calculated tax
  lines for each `OrderLine`. Optional `TaxZoneStrategy`
  registers a US tax-zone resolver.
- **USD-only / US-only**: non-USD orders or non-US ship-to
  addresses return zero from this strategy and let Vendure's
  built-in `TaxRate` calculation handle the fallback
  (constitution §5). Vendure's strategy chain makes this clean.
- **Fail-soft default**: engine errors return zero tax + log a
  warning. `OSTAX_FAIL_HARD=1` env var opts into fail-hard
  (throw, surfaces as an order error).
- **Calculation only**: no filing, no remittance, no address
  validation (constitution §6, §10).

## File layout (planned)

```
opensalestax-vendure/
├── CLAUDE.md                # this file
├── README.md                # user-facing (added in stage 02)
├── LICENSE                  # Apache-2.0 (added in stage 01/02)
├── CONTRIBUTING.md          # DCO sign-off mandatory
├── SECURITY.md
├── CHANGELOG.md
├── package.json
├── tsconfig.json
├── jest.config.js
├── specs/
│   ├── constitution.md
│   ├── current-state.md
│   ├── handoff.md
│   └── research/vendure-tax-plugin.md
├── src/
│   ├── index.ts                       # exports OpenSalesTaxPlugin
│   ├── opensalestax.plugin.ts         # @VendurePlugin class
│   ├── strategies/
│   │   ├── ostax-tax-line.strategy.ts
│   │   └── ostax-tax-zone.strategy.ts # optional
│   ├── lib/
│   │   ├── ostax-client.ts            # lifted from medusa/saleor
│   │   └── config.ts                  # env-var + options loader
│   └── types.ts
└── tests/
    ├── unit/
    │   ├── ostax-client.test.ts
    │   └── ostax-tax-line.strategy.test.ts
    └── integration/
        └── plugin.test.ts             # @vendure/testing harness
```

## What NOT to do

- Don't ship a standalone HTTP server. The plugin loads in
  Vendure's process — Decision V locked it out.
- Don't add webhook subscriptions, JWT verification, or any
  inbound HTTP surface. The plugin makes OUTBOUND calls to the
  OST engine; it does not receive callbacks.
- Don't ship a copy of the OST engine — point at the merchant's
  instance via env var / plugin options.
- Don't add an SDK dependency on a private npm registry — keep
  every dep public.
- Don't accept commits without DCO sign-off (`-s` flag).
- Don't ship admin UI in v1.0. Settings live in env vars +
  `OpenSalesTaxPlugin.init({...})` options.
- Don't invent Vendure API names — use real ones
  (`@VendurePlugin`, `TaxLineCalculationStrategy`,
  `TaxZoneStrategy`, `@vendure/core`, `@vendure/testing`).

## Releasing

- Semver tags `vX.Y.Z` on the single `main` branch (no
  branch-per-major like Odoo; the plugin tracks Vendure's
  current major and bumps with breaking-change releases).
- GitHub release on each tag.
- Publish to NPM as `@ejosterberg/vendure-plugin-opensalestax`
  (`--access public`). NPM is the primary distribution channel
  — no Docker image (the merchant runs Vendure in their own
  container; the plugin is just a dep).

## Sibling-project map

See `specs/current-state.md` "Sibling-project map" section.
