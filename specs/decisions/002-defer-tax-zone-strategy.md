# ADR 002 — Defer `TaxZoneStrategy` to v1.1

**Date:** 2026-05-13
**Status:** Accepted
**Context stage:** kickoff stage 02 (build alpha)

## Decision

Ship v0.1.0 / v1.0.0 with **only** `TaxLineCalculationStrategy`.
Defer `TaxZoneStrategy` to a v1.1 release.

## Rationale

- Constitution §5 + research §4: `TaxZoneStrategy` resolves
  *which Vendure `Zone` an order belongs to*, which is upstream
  of tax calculation. It does not compute tax itself.
- Merchants on Vendure already configure a `Zone` ("US") and
  attach it to their default Channel via the Admin UI as part
  of standard Vendure setup. The plugin documents this in the
  README quickstart.
- The required strategy is `TaxLineCalculationStrategy` —
  that's the one that actually returns the per-jurisdiction
  tax breakdown. `TaxZoneStrategy` is opt-in convenience.
- Shipping a strategy that touches Channel/Zone resolution
  adds blast radius (it affects orders the plugin doesn't even
  want to tax — non-USD, non-US). Deferring keeps the v1.0
  surface area minimal.

## Consequences

- README quickstart explicitly walks the merchant through
  creating a US `Zone` in the Admin UI.
- v1.1 backlog item: implement `OstaxTaxZoneStrategy` that
  auto-resolves the merchant's US zone (looks for a Zone whose
  members include `country.code === 'US'`) and returns the
  channel default for non-US orders.
- Tracked in `specs/handoff.md` v0.2 polish queue.

## Verification

- `src/opensalestax.plugin.ts`'s `configuration` callback only
  sets `config.taxOptions.taxLineCalculationStrategy` and does
  NOT touch `taxZoneStrategy`.
- Stage 05 demo confirms the manual-zone-config approach works
  end-to-end.
