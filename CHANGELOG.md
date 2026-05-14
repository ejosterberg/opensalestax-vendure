# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/ejosterberg/opensalestax-vendure/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/ejosterberg/opensalestax-vendure/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/ejosterberg/opensalestax-vendure/releases/tag/v0.1.0
