# Stage 02 — Build v0.1.0 alpha

> 3-4 hours of focused work. Follow `specs/handoff.md`'s 9-step
> task list; this file adds quality and ordering guidance on top.

## Order of operations

The task list in `specs/handoff.md` is the authoritative
implementation guide. Execute its 9 steps in order:

1. Project bootstrap (package.json, tsconfig, jest, .gitignore,
   .eslintrc, .prettierrc)
2. OST HTTP client (lift from Medusa)
3. Plugin shell (`@VendurePlugin` class + `init(options)`)
4. `TaxLineCalculationStrategy` implementation
5. (Optional) `TaxZoneStrategy` implementation
6. Plugin entry point (`src/index.ts` re-exports)
7. Tests (unit + integration via `@vendure/testing`)
8. Packaging (`npm run build` produces `dist/`; `npm pack`
   inspection)
9. Release (CHANGELOG entry, `npm version 0.1.0`, tag, push)

## TDD discipline

Per Eric's global rule: write the test, then the code. For the
strategy file in step 4:

1. Create `tests/unit/ostax-tax-line.strategy.test.ts` with the
   expected behavior
2. Run `npm test` — it fails (no implementation yet)
3. Create `src/strategies/ostax-tax-line.strategy.ts` minimally
4. Run `npm test` — it passes
5. Refactor; tests still pass

Skip TDD only for trivial wiring (e.g., the `index.ts` barrel
export).

## Set up CI before you start writing code

Add `.github/workflows/ci.yml` as one of the first commits:

```yaml
name: ci
on:
  push:
    branches: [main]
  pull_request:
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm audit --production --audit-level=high
```

This gives you fast feedback on every push from the first
commit. Add `npm run lint`, `npm run typecheck`, `npm run check`
scripts to `package.json` early.

## Commit cadence

One logical change per commit. Sign every commit (`git commit
-s`). No AI co-author trailers.

Suggested commit grain:

- `chore: project bootstrap (package.json, tsconfig, jest, eslint)`
- `feat: add OST HTTP client (lifted from Medusa)`
- `test: unit tests for OST HTTP client`
- `feat: plugin shell (OpenSalesTaxPlugin with init(options))`
- `feat: config loader (env vars + plugin options merge)`
- `test: OstaxTaxLineStrategy unit tests`
- `feat: TaxLineCalculationStrategy implementation`
- `test: integration test via @vendure/testing (MN ship-to)`
- `chore: src/index.ts barrel exports`
- `docs: README v0.1.0 + install walkthrough`
- `chore: tag v0.1.0`

## Things to NOT skip

- **SPDX headers** on every TS / TSX / JS / SQL / SH file:
  `// SPDX-License-Identifier: Apache-2.0`
- **JSDoc on public APIs** — `OpenSalesTaxPlugin`, the strategy
  classes, the options type. Future contributors (and
  SonarQube) read these.
- **No `any` types** without an explicit comment justifying it.
- **No `// @ts-ignore`** without a follow-up issue link.
- **Strategy registration tested** — the integration test
  asserts the strategy is actually registered in
  `config.taxOptions.taxLineCalculationStrategy` after the
  plugin loads. Don't trust that the `@VendurePlugin`
  decorator silently did its job.
- **No log leakage of customer addresses** — never log
  `order.shippingAddress` or `orderLine.productVariant.name`.
  Log structured: `{currencyCode, country, line_count}` only.

## Reference: the OST HTTP client to lift

Source:
`C:/Users/ejosterberg/Documents/GITprojects/opensalestax-medusa/src/providers/opensalestax/client.ts`

It's ~130 lines, uses global `fetch` (Node 20+), no external HTTP
dependency. Update:

- SPDX header (already Apache-2.0; just confirm)
- Type imports — remove Medusa-specific ones if any
- Add a `healthCheck()` method that GETs `/v1/health` and returns
  `{ ok, version, db_connected, rtt_ms }`.

## Reference: Vendure docs

- Plugin overview:
  <https://docs.vendure.io/guides/developer-guide/plugins/>
- `TaxLineCalculationStrategy`:
  <https://docs.vendure.io/reference/typescript-api/tax/tax-line-calculation-strategy/>
- `TaxZoneStrategy`:
  <https://docs.vendure.io/reference/typescript-api/tax/tax-zone-strategy/>
- Testing harness `@vendure/testing`:
  <https://docs.vendure.io/guides/developer-guide/testing/>

If any of these URLs 404 (Vendure docs reshuffle occasionally),
search docs.vendure.io for the strategy name and update the
research doc.

## Acceptance for stage 02

Stage 02 is done when:

- [ ] `npm test` passes locally; ≥10 tests
- [ ] `npm run lint` passes (ESLint configured with the
  `@typescript-eslint/recommended` rules)
- [ ] `npm run typecheck` (alias for `tsc --noEmit`) passes
- [ ] `npm audit --production --audit-level=high` shows 0
  high/critical
- [ ] CI on the latest `main` commit is green
- [ ] `npm run build` produces a `dist/` with `.js` + `.d.ts`
  files; `npm pack` tarball contents inspected (no `src/`,
  `tests/`, `.env`)
- [ ] Integration test boots Vendure via `@vendure/testing`,
  loads the plugin, places a MN order, and asserts nonzero tax
  on the order lines
- [ ] `git tag v0.1.0` is pushed; GitHub release v0.1.0 created
  via `gh release create`

Mark stage 02 complete in TodoWrite. Proceed to
`03-quality-gate.md`.
