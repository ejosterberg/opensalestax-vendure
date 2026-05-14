# Handoff — opensalestax-vendure

> **Read first if you're a fresh agent.** Constitution + current
> state + this file are the canonical bring-up sequence.

## You are here — 2026-05-13 (project scaffold)

The Vendure plugin is **pre-alpha** — specs are written; no
TypeScript yet. Eric confirmed two architecture decisions on
2026-05-13:

- **Decision V**: Vendure plugin (npm package), pure in-process.
  `@VendurePlugin` class registering a
  `TaxLineCalculationStrategy` (and optionally a
  `TaxZoneStrategy`) from `@vendure/core`. No standalone server,
  no webhooks, no JWT.
- **Decision X**: merchant-self-hosted via NPM. The plugin ships
  as `@ejosterberg/vendure-plugin-opensalestax`; merchants add
  it as a dependency and wire it in `vendure-config.ts`. No
  SaaS tier in v0.x.

## What's next — implement v0.1.0 alpha

The order below is the order to do it in. Each task fits a single
focused work block (15–60 min).

### 1. Project bootstrap

- [ ] `npm init -y` then edit `package.json`:
  - `name`: `@ejosterberg/vendure-plugin-opensalestax`
  - `version`: `0.1.0`
  - `license`: `Apache-2.0`
  - `engines.node`: `>=20`
  - `main`: `dist/index.js`
  - `types`: `dist/index.d.ts`
  - `peerDependencies`: `@vendure/core` `^3.0.0`
  - DevDependencies: `@vendure/core`, `@vendure/testing`,
    `typescript`, `jest`, `@types/jest`, `@types/node`,
    `ts-jest`, `eslint`, `@typescript-eslint/eslint-plugin`,
    `@typescript-eslint/parser`, `prettier`
- [ ] `tsconfig.json` — target `ES2022`, module `commonjs`
  (Vendure's runtime), strict mode, `declaration: true`,
  `outDir: dist`
- [ ] `jest.config.js` — ts-jest preset, `testMatch:
  ["**/tests/**/*.test.ts"]`
- [ ] `.gitignore`, `.editorconfig`, `.eslintrc`, `.prettierrc`
- [ ] `LICENSE` (Apache-2.0 text), SPDX headers on all source
  files
- [ ] `CONTRIBUTING.md` — DCO sign-off mandatory, no AI co-author
  trailers, branch model (single-branch, semver tags)
- [ ] `SECURITY.md` — vulnerability reporting

### 2. OST HTTP client

- [ ] Copy `opensalestax-medusa/src/providers/opensalestax/client.ts`
  → `opensalestax-vendure/src/lib/ostax-client.ts`. The client is
  small (~130 lines), uses global `fetch`, and is platform-agnostic
  — minimal porting needed. Just update the SPDX header and any
  Medusa-specific type imports.
- [ ] Add a small `healthCheck()` method (the Medusa version
  doesn't have one; the plugin's startup probe + Test Connection
  uses it).
- [ ] Unit test the client against `nock` or a Node fetch mock.

### 3. Plugin shell

- [ ] `src/lib/config.ts` — `OpenSalesTaxPluginOptions` type +
  `loadConfig(options)` that merges options with env vars
  (`OSTAX_API_URL`, `OSTAX_API_TOKEN`, `OSTAX_FAIL_HARD`). URL
  parsing, fail-fast on missing required values.
- [ ] `src/opensalestax.plugin.ts` — `@VendurePlugin({...})`
  class `OpenSalesTaxPlugin`. Static `init(options)` returns the
  decorated class (Vendure's standard plugin pattern). The
  `providers` array registers the strategy classes. The
  `configuration` callback in the decorator wires the strategy
  into `config.taxOptions.taxLineCalculationStrategy` (and
  optionally `taxZoneStrategy`).

### 4. `TaxLineCalculationStrategy`

- [ ] `src/strategies/ostax-tax-line.strategy.ts` implements
  `TaxLineCalculationStrategy` from `@vendure/core`:
  - `calculate({ ctx, order, orderLine, taxCategory, taxRate, ... }): TaxLine[] | Promise<TaxLine[]>`
  - Gate: order `currencyCode === "USD"`, ship-to `country.code === "US"`,
    ZIP matches `^\d{5}(-\d{4})?$`
  - On gate fail → return `[]` (Vendure's default tax-rate
    pipeline takes over)
  - On gate pass → call OST `/v1/calculate` with one line
    (the current `orderLine`'s linePriceWithTax / linePrice)
  - Map OST response → Vendure `TaxLine[]` (each `TaxLine` has
    `description`, `taxRate`, `amount`)
  - Error handling: fail-soft returns `[]` + warns; fail-hard
    throws

### 5. `TaxZoneStrategy` (optional in v0.1)

- [ ] `src/strategies/ostax-tax-zone.strategy.ts` (only if v0.1
  scope allows): given a shipping address, look up the US zone
  the merchant has configured (by country code = US) and return
  it. If the merchant hasn't created a US zone, log a hint at
  startup and return `null` (Vendure falls back to default
  zone).
- [ ] If skipping in v0.1, document the skip in
  `specs/decisions/001-defer-tax-zone-strategy.md` and rely on
  the merchant configuring a US Zone manually.

### 6. Plugin entry point

- [ ] `src/index.ts`: re-export `OpenSalesTaxPlugin`,
  `OpenSalesTaxPluginOptions`, and the strategy classes (so
  advanced merchants can subclass).
- [ ] Confirm `package.json` `main` / `types` / `files` fields
  point at `dist/`.

### 7. Tests

- [ ] Unit tests for the OST client (mocked fetch; success,
  5xx, network error).
- [ ] Unit tests for `OstaxTaxLineStrategy`: USD/non-USD gate,
  US/non-US gate, ZIP regex, fail-soft vs fail-hard, OST
  response → Vendure `TaxLine[]` math.
- [ ] Unit tests for config validation (missing
  `OSTAX_API_URL`, malformed URL, conflicting options).
- [ ] Integration test: use `@vendure/testing`'s
  `createTestEnvironment()` to spin up Vendure with the plugin
  loaded. Place a test order with a MN ship-to address; assert
  `order.lines[*].taxLines` is populated with the OST-calculated
  rate. (Use a mocked OST endpoint or, if running locally,
  point at `http://10.32.161.126:8080`.)
- [ ] Target ≥10 tests at v0.1.0 ship time.

### 8. Packaging

- [ ] `npm run build` produces `dist/` with `.js` + `.d.ts`
  files; `package.json` `files` field lists `dist/`, `README.md`,
  `LICENSE`, `CHANGELOG.md`.
- [ ] Verify locally: `npm pack` → inspect the tarball; nothing
  unwanted (no `tests/`, no `src/`, no `.env`).
- [ ] Document the install flow in `README.md`:
  `npm install @ejosterberg/vendure-plugin-opensalestax`, then
  add to `vendure-config.ts` plugins array with
  `OpenSalesTaxPlugin.init({ apiUrl: '...' })`.

### 9. Release

- [ ] `CHANGELOG.md` v0.1.0 entry
- [ ] `npm version 0.1.0`
- [ ] Tag, push, GitHub release via `gh release create`
- [ ] `npm publish --access public` (NPM is the primary
  distribution channel — Decision X)

## What's deferred to v0.2

- Vendure Hub listing submission (curated; manual review)
- Admin UI panel via Vendure UI extensions
- Per-product tax category mapping
- Per-state nexus filter
- Operator telemetry (failure streak, alert hooks)
- GraphQL-typed strategy hooks (Vendure auto-generates types;
  pin to a generated baseline once codegen is wired)

## Standing rules

- Apache-2.0; DCO sign-off mandatory; no AI co-author trailers
- Constitution §5: USD-only; non-US / non-USD = empty
  `TaxLine[]` (Vendure default tax-rate pipeline takes over)
- Constitution §8: fail-soft default; fail-hard opt-in via env
  / plugin option
- Constitution §7: plugin trusts options from
  `OpenSalesTaxPlugin.init(...)` + `process.env` (both
  merchant-controlled); no inbound auth surface to verify

## Pre-flight for the next session

1. Read `specs/constitution.md`
2. Read `specs/current-state.md`
3. Read `specs/research/vendure-tax-plugin.md`
4. Skim recent commits (`git log --oneline -10`)
5. Start at task 1 above

When the alpha ships, log it in `current-state.md` and replace
this handoff with the v0.2 starting list.
