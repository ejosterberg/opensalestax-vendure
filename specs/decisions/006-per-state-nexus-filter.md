# ADR 006 — Per-state nexus filter (allowlist + denylist)

**Date:** 2026-05-14
**Status:** Accepted
**Context:** v1.2.0 phase 04

## Decision

Add two mutually exclusive `OpenSalesTaxPlugin.init({...})`
options:

- `enabledStates?: string[]` — allowlist of US state codes
  (uppercase 2-letter, ISO 3166-2)
- `disabledStates?: string[]` — denylist (same format)

Both unset (default): preserve v1.1 behavior — compute tax for
every US ship-to. Setting both throws at plugin init.

## Why both directions

Two distinct merchant shapes need this:

- **Most small merchants** have nexus in 1-3 states (the
  state(s) they're physically present in plus maybe one or
  two warehouse states). `enabledStates: ['MN', 'WI']` is
  the natural expression.
- **Larger merchants** with broad economic-nexus footprints
  often hit nexus everywhere except a handful of states they
  haven't crossed thresholds in yet. `disabledStates: ['MT', 'WY']`
  is more concise than enumerating 47+ enabled states.

A single option (allowlist OR denylist) would be simpler but
forces one of these merchants into an awkward enumeration.
The cost of supporting both is one extra validation rule
(mutex) — small.

## Why mutually exclusive

Setting both creates an ambiguous configuration: does
`enabledStates: ['MN']` + `disabledStates: ['MN']` mean
"compute for MN only" or "compute for nobody"? Rather than
pick a convention and silently apply it, throw with a clear
error so the merchant fixes their config.

## Why uppercase 2-letter validation

- Matches Vendure's standard "province" field for US
  addresses (`address.province` is the 2-letter code on the
  default storefront forms).
- Catches typos at server boot, not at first checkout.
- Communicates the intended format clearly via the error
  message ("use uppercase 2-letter ISO 3166-2 codes").

A merchant on a customized Vendure setup that stores
provinces differently will see DEBUG logs at calculation time
showing the mismatch — they can adjust their address
collection or post-process.

## Why empty array → no filter (instead of "filter everything")

`enabledStates: []` literally means "compute for no states,"
which is effectively "disable the plugin." If a merchant
truly wants that, removing the plugin from the `plugins`
array is clearer than configuring an empty allowlist.

Treating empty as no-filter mitigates a real footgun: a
merchant who programmatically builds their list (e.g.,
`enabledStates: nexusStates ?? []`) doesn't accidentally
flip the plugin off when their data source returns empty.

## Consequences

- Non-breaking: defaults reproduce v1.1 behavior exactly.
- Merchants opt in by setting one of the two options; both
  surfaces are covered by unit tests.
- Strategy gains one new gate after the existing US-country
  check, before the OST HTTP call. Adds no new external
  dependencies, no schema changes.
- Future: economic-nexus auto-detection (compute as your
  business crosses thresholds) is documented as deferred —
  it would need order-history analysis and a per-state
  threshold table; out of scope for this plugin.

## Verification

- Phase-04 unit tests in `tests/unit/config.test.ts` and
  `tests/unit/ostax-tax-line.strategy.test.ts` cover all
  decision points.
- Demo VM walkthrough: WI ship-to with
  `enabledStates: ['MN']` returns `[]`; MN ship-to with the
  same config returns the full per-jurisdiction tax breakdown.
