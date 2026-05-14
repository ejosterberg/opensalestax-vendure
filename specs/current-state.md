# Current State — opensalestax-vendure

**Last updated:** 2026-05-13 (v1.0.0 shipped to GitHub + NPM)
**Status:** **v1.0.0 shipped.** Kickoff plan complete.

## What's shipped (v1.0.0)

- GitHub: <https://github.com/ejosterberg/opensalestax-vendure>
- GitHub release v1.0.0: <https://github.com/ejosterberg/opensalestax-vendure/releases/tag/v1.0.0>
- NPM: <https://www.npmjs.com/package/@ejosterberg/vendure-plugin-opensalestax> (`@ejosterberg/vendure-plugin-opensalestax@1.0.0`, public, Apache-2.0)
- Trusted Publisher + `release.yml` workflow configured for hands-off OIDC publishing of every release after v1.0.0

- `OpenSalesTaxPlugin` (`@VendurePlugin`-decorated) loadable in
  `vendure-config.ts`.
- `OstaxTaxLineStrategy` implementing
  `TaxLineCalculationStrategy` from `@vendure/core`. Per-line
  call to OST `/v1/calculate`; maps each jurisdiction to a
  Vendure `TaxLine`.
- USD-only / US-only gating per constitution §5; non-USD/non-US
  returns `[]` so Vendure's built-in `TaxRate` pipeline handles
  the fallback.
- Fail-soft default; fail-hard via `OSTAX_FAIL_HARD=1` env or
  `init({ failHard: true })`.
- Boot-time `/v1/health` probe so engine reachability problems
  surface at server-start.
- 60 tests (58 unit + 2 integration via `@vendure/testing`):
  - `tests/unit/ostax-client.test.ts` — 12 tests
  - `tests/unit/config.test.ts` — 24 tests
  - `tests/unit/ostax-tax-line.strategy.test.ts` — 22 tests
  - `tests/integration/plugin.test.ts` — 2 tests
- CI workflow at `.github/workflows/ci.yml` runs lint /
  typecheck / test / audit / build on every push to `main` and
  every PR. All runs green.
- Apache-2.0 license, SPDX headers on every source file, DCO
  sign-off on every commit, no AI co-author trailers.
- Coverage: 91.0% lines, 80.21% branches.

## Quality + security baseline

| Metric | Value |
|--------|-------|
| `npm run check` | green |
| CI on `main` HEAD | green |
| SonarQube bugs | 0 |
| SonarQube vulnerabilities | 0 |
| SonarQube code smells | 0 |
| SonarQube security hotspots | 0 |
| Reliability rating | A (1.0) |
| Security rating | A (1.0) |
| Maintainability (sqale) | A (1.0) |
| `npm audit --omit=dev --audit-level=high` | 0 vulnerabilities |

Security audit recorded in
`specs/security/audit-2026-05-13.md` (initial scan + post-fix
re-scan, both clean after applying the documented fixes).

## Demo deployment

| Field | Value |
|-------|-------|
| VMID | 915 |
| Name | `vendure-demo` |
| Host | pmvm1 (Proxmox) |
| IP | 10.32.161.39 |
| Stack | Debian 13, Node 20, Vendure 3.6.3 + plugin v0.1.0 |
| OST engine | shared `http://10.32.161.126:8080` v0.55.4 |

End-to-end test passed: $100 USD order shipped to Minneapolis
MN 55403 returns six tax lines summing to 9.025% via the OST
engine (`totalWithTax = $109.03`). See `specs/demo-deployment.md`.

## Architecture decisions on file

| ADR | Title | Status |
|-----|-------|--------|
| 001 | Target Vendure 3.x | Accepted |
| 002 | Defer `TaxZoneStrategy` to v1.1 | Accepted |
| 003 | Defer Vendure Hub listing to v1.1 | Accepted |

## What's planned next

### v1.0.0 — pending stage 07 of the kickoff

Pure mechanical: tag v1.0.0, push tag, GitHub release notes,
`npm publish --access public`. Update CHANGELOG, update
current-state + handoff, archive `kickoff/`.

### v1.1 candidate queue (priority order)

1. **Vendure Hub listing submission** (deferred per ADR-003)
2. **`TaxZoneStrategy`** auto-resolver (deferred per ADR-002)
3. **Per-product tax category mapping** —
   `categoryByProductTypeId` similar to the Medusa pattern
4. **Per-state nexus filter** — opt-in/opt-out by state
5. **Request-scoped batch caching** — N order lines = N OST
   calls today; v1.1 can collapse to one per request via
   Vendure's `RequestContext` lifecycle
6. **Embedded admin-UI panel** via Vendure UI extensions
7. **Operator telemetry** — last-success / failure-streak
   counters surfaced via UI extension or job queue events

## Sibling-project map

| Path | Stack | State |
|---|---|---|
| `opensalestax-Odoo/` | Planning hub | active |
| `opensalestax-python/` | Python SDK | shipped to PyPI |
| `opensalestax-odoo-src/` | Odoo connector | v0.4.1 shipped on PyPI; OCA PR queued |
| `opensalestax-medusa/` | Medusa v2 plugin | shipped on NPM |
| `opensalestax-woocommerce/` | WordPress plugin | shipped |
| `opensalestax-stripe-php/` | Stripe-PHP connector | shipped (private repo) |
| `opensalestax-php/` | PHP SDK | shipped (private repo) |
| `opensalestax-saleor/` | Saleor Tax App | pre-alpha |
| `opensalestax-magento/` | Magento module | pre-alpha |
| `opensalestax-vendure/` | **THIS** — Vendure plugin | **v0.1.0 alpha shipped** |
