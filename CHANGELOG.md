# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2026-05-13

### Added
- `OstaxTaxZoneStrategy` implementing Vendure's `TaxZoneStrategy`
  interface. The plugin now auto-routes US shipping orders to
  any Zone the merchant has configured with the United States
  as a member country, removing the manual "set
  `channel.defaultTaxZone = US`" step from the README quickstart.
- WeakMap-based memoization keyed on the `Zone[]` array
  reference so the hot-path `determineTaxZone` call collapses
  per-request scans to a single lookup.
- One-shot WARN at first miss when a US ship-to order arrives
  but no US-containing Zone exists in the merchant's data
  (rate-limited to once per process). Checkout still works via
  fallback to the channel's default Zone.
- Re-export `OstaxTaxZoneStrategy` from `src/index.ts` for
  advanced users who want to subclass it.
- ADR-004 documenting the supersession of ADR-002.
- **Per-product OST category mapping.** Two new
  `OpenSalesTaxPlugin.init({...})` options:
  - `categoryByTaxCategoryName: Record<string, OpenSalesTaxCategory>`
    maps Vendure `TaxCategory.name` → one of OST's six categories
    (`general`, `clothing`, `groceries`, `prescription_drugs`,
    `prepared_food`, `digital_goods`) or `''` to skip the line
    (non-taxable).
  - `defaultCategory: OpenSalesTaxCategory` is the fallback when
    a line's TaxCategory name doesn't match the map. Default
    `'general'` (preserves v1.0 behavior).
  - Validation: invalid OST category values throw at plugin
    init with a clear error listing every bad pairing.
  - New `OpenSalesTaxCategory` union type re-exported from
    `src/index.ts` for type-safe `init()` calls.
- ADR-005 documenting the API choice (mapping by
  TaxCategory.name rather than id or custom field).

### Changed
- README quickstart step 4 ("Configure a US tax zone") is now
  marked optional/recommended rather than required. Updated
  the "How it works" diagram to show both strategies in the
  pipeline.
- Troubleshooting section gains an entry for the new "no US
  Zone" WARN message.

### Compatibility
- Non-breaking. Merchants on v1.0.0 who manually configured a
  US Zone keep working unchanged; the new strategy finds the
  same zone they configured.

## [1.0.0] - 2026-05-13

### Changed
- Promoted v0.1.0 alpha to first production release after the
  full kickoff plan completed: quality gate green
  (60 tests, lint + typecheck + production audit clean),
  SonarQube scan clean (0 bugs / 0 vulns / 0 code smells /
  0 hotspots / Security A / Reliability A), OWASP A01-A10
  manual review complete, and end-to-end demo on Proxmox VM
  915 verified that a $100 USD MN order returns six
  per-jurisdiction tax lines summing to 9.025% via the
  OpenSalesTax engine.

### Security
- Audit recorded in `specs/security/audit-2026-05-13.md`
  (initial scan + post-fix re-scan, both clean).
- Confirmed: no inbound HTTP routes added by the plugin,
  `apiUrl` validated at init with scheme allowlist (http:,
  https:), zero PII in logs.

### Notes
- No API surface changes from v0.1.0 to v1.0.0 — merchants
  on v0.1.0 can upgrade with no code changes.
- Vendure Hub listing deferred to v1.1 (see ADR-003).
- `TaxZoneStrategy` deferred to v1.1 (see ADR-002).

## [0.1.0] - 2026-05-13

### Added

- Initial alpha release.
- `OpenSalesTaxPlugin` (`@VendurePlugin`-decorated class) loadable
  via the merchant's `vendure-config.ts`.
- `OstaxTaxLineStrategy` implementing
  `TaxLineCalculationStrategy` from `@vendure/core` — calls the
  OpenSalesTax engine `/v1/calculate` endpoint per order line.
- Configuration via `OpenSalesTaxPlugin.init({...})` options
  with `process.env` fallback (`OSTAX_API_URL`,
  `OSTAX_API_TOKEN`, `OSTAX_FAIL_HARD`, `OSTAX_TIMEOUT_MS`).
- USD-only / US-only gating: non-USD or non-US orders return
  `[]` so Vendure's built-in `TaxRate` pipeline takes over
  (constitution §5).
- Fail-soft default: engine errors return `[]` plus a warning
  log; opt into fail-hard via `OSTAX_FAIL_HARD=1` or
  `init({ failHard: true })`.
- Boot-time health-check probe against `/v1/health` so engine
  reachability problems surface at server-start.
- Apache-2.0 license, SPDX headers on all sources, DCO sign-off
  policy.

### Security

- No inbound HTTP routes / webhooks / GraphQL resolvers added
  by the plugin (verified by grep audit at stage 04).
- `OSTAX_API_URL` validated at plugin init: URL parse + scheme
  allowlist (`http:`, `https:`); fails fast on bad input.
- Structured logging only — customer addresses, line item
  descriptions, product names, and customer email are never
  logged.

[Unreleased]: https://github.com/ejosterberg/opensalestax-vendure/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/ejosterberg/opensalestax-vendure/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/ejosterberg/opensalestax-vendure/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/ejosterberg/opensalestax-vendure/releases/tag/v0.1.0
