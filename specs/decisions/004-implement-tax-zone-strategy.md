# ADR 004 — Implement `TaxZoneStrategy` (supersedes ADR-002)

**Date:** 2026-05-13
**Status:** Accepted
**Supersedes:** ADR-002
**Context stage:** v1.1.0 phase 02

## Decision

Ship `OstaxTaxZoneStrategy` in v1.1.0 (alongside the existing
`OstaxTaxLineStrategy`). The plugin's `configuration` callback
now registers both strategies on `config.taxOptions`.

## Why this supersedes ADR-002

ADR-002 (2026-05-13) deferred `TaxZoneStrategy` to v1.1 with
the reasoning that:

1. The required strategy was `TaxLineCalculationStrategy`
2. Adding zone-resolution increased v1.0 blast radius
3. Merchants could configure a US zone manually

(1) and (2) were correct calls for v1.0. (3) turned out to be
real friction in the README quickstart — a manual Admin UI
step that a meaningful share of merchants will skip or do
incorrectly, then file "tax always returns zero" issues. The
zone strategy adds enough value to justify a focused v1.1
release.

## What's changed since ADR-002

- v1.0 shipped on 2026-05-13. The constitution's risk-aversion
  about zone-resolution touching non-tax orders was reconfirmed
  to be unfounded: our strategy explicitly returns
  `channel.defaultTaxZone` unchanged for non-US orders, so the
  blast radius is bounded.
- Vendure's `TaxZoneStrategy.determineTaxZone` signature is
  hot-path; we mitigate with WeakMap memoization keyed by the
  zones-array reference (free invalidation on zone CRUD via
  GC).

## Decision details

- New class `OstaxTaxZoneStrategy` in
  `src/strategies/ostax-tax-zone.strategy.ts`.
- `determineTaxZone` rule:
  - US ship-to with a US-containing zone available → return that zone
  - US ship-to without a US zone → log one-shot WARN, return `channel.defaultTaxZone`
  - All other cases → return `channel.defaultTaxZone` (Vendure default behavior)
- WeakMap memoization keyed on the `Zone[]` array reference.
- Plugin `configuration` callback sets both
  `taxLineCalculationStrategy` and `taxZoneStrategy`.

## Consequences

- README quickstart drops the "Configure a US tax zone in
  Vendure Admin (one-time)" step. New merchants get correct
  behavior on day-1 with their existing default zone.
- The ADR-002 status is updated to "Superseded by ADR-004".
- CHANGELOG v1.1.0 documents the new strategy + the README
  simplification.
- v1.0 → v1.1 is a non-breaking change. Existing merchants
  who configured a US zone manually keep working unchanged
  (the strategy just finds the same zone they configured).

## Verification

- Phase-02 tests in `tests/unit/ostax-tax-zone.strategy.test.ts`
  cover all 11 cases enumerated in `phase-02-tax-zone-strategy/plan.md`.
- Integration test in `tests/integration/plugin.test.ts`
  confirms `config.taxOptions.taxZoneStrategy instanceof
  OstaxTaxZoneStrategy` on a running Vendure instance.
- Demo VM end-to-end re-run: $100 MN order continues to return
  the correct per-jurisdiction tax breakdown.
