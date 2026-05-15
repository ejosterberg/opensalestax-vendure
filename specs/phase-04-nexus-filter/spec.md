# Phase 04 — Per-state nexus filter

**Status:** Draft → In Progress
**Target version:** v1.2.0

## Why

Sales-tax nexus is the legal threshold (physical presence,
economic activity) that obligates a merchant to collect and
remit tax in a state. No US merchant has nexus in all 50
states; most small/mid-sized merchants have nexus in 1-3.

In v1.1, the plugin computes tax for every US ship-to ZIP.
A merchant with nexus only in Minnesota and Wisconsin who
follows the plugin's output literally will over-collect tax
on California, Texas, etc. orders — a real compliance + UX
problem.

The fix is a per-state filter the merchant configures at plugin
init: when set, the strategy returns `[]` (no tax) for orders
shipping outside the configured nexus states. Vendure's
default `TaxRate` pipeline then applies (typically zero in
those states for a US-only merchant).

## User stories

- **As a small merchant with nexus only in MN and WI**, I want
  to set `enabledStates: ['MN', 'WI']` and trust that orders
  to other states don't get tax computed.
- **As a national merchant with nexus everywhere except a
  short list**, I want to set `disabledStates: ['CA', 'NY']`
  and skip just those.
- **As any merchant**, I want a clear error at plugin init if
  I typo a state code (e.g., "Mn" instead of "MN") rather
  than silently miscollecting.
- **As a merchant uncertain about my own nexus footprint**, I
  can leave both options unset and get the v1.1 behavior
  (compute everywhere) — but README warns me that nexus
  configuration is my responsibility.

## In scope

1. Two new options on `OpenSalesTaxPluginOptions`:
   - **`enabledStates?: string[]`** — allowlist. If set, the
     strategy computes tax only for orders shipping to one
     of these states; all others return `[]`.
   - **`disabledStates?: string[]`** — denylist. If set, the
     strategy returns `[]` for orders shipping to one of
     these states; all others compute as normal.
   - Both unset (default): preserves v1.1 behavior (compute
     for every US ship-to).
   - Setting **both** is a configuration error — throw at
     plugin init with a clear message.

2. State-code validation at plugin init: every entry must
   match `/^[A-Z]{2}$/`. Invalid entries throw with a list of
   bad values; suggest the merchant uses uppercase ISO 3166-2
   subdivision codes (the Vendure form's "province" field
   already populates these).

3. Strategy update: after the existing USD/US/ZIP gates, read
   `order.shippingAddress.province`. If `enabledStates` is set
   and the province is not in it (or is undefined): return `[]`
   with a debug log (`skip: nexus_filter province=<X>`). If
   `disabledStates` is set and the province IS in it: return
   `[]` with the same debug log. Otherwise proceed.

4. New unit tests for config validation + strategy gating,
   covering all four positive/negative combinations.

5. README: new "Per-state nexus filter" subsection under
   "Configuration reference" with a worked example. Update
   the configuration table.

6. CHANGELOG v1.2.0 entry.

7. ADR-006 documenting the API choice (allowlist vs denylist
   vs both).

## Out of scope (defer)

- **Auto-detection of nexus from order history** (e.g.,
  "you've shipped 200 orders to TX, you may now have economic
  nexus"). Real, important, but a separate product surface —
  defer indefinitely.
- **Per-state rate overrides** ("compute MN at 6.5% instead
  of OST's 6.875%"). Workaround exists today via Vendure's
  built-in TaxRate; not the plugin's job to second-guess the
  engine.
- **Marketplace facilitator handling** (NJ / CA seller-of-
  record edge cases). Constitution §10 — out of scope.

## Success criteria

| # | Criterion | How to verify |
|---|-----------|---------------|
| N1 | `enabledStates` and `disabledStates` accepted by `OpenSalesTaxPlugin.init({...})` | typecheck + config unit test |
| N2 | `loadConfig()` throws if both are set | unit test |
| N3 | `loadConfig()` throws on invalid state codes (lowercase, 1 char, 3 chars, non-letter) | unit test (one per case) |
| N4 | Empty array on either option = no filter (treated as undefined) | unit test |
| N5 | When `enabledStates: ['MN', 'WI']` set, MN order → engine called | unit test |
| N6 | When `enabledStates: ['MN', 'WI']` set, CA order → returns `[]` | unit test |
| N7 | When `disabledStates: ['CA']` set, MN order → engine called | unit test |
| N8 | When `disabledStates: ['CA']` set, CA order → returns `[]` | unit test |
| N9 | When both unset, all US orders compute (v1.1 behavior preserved) | existing tests still pass |
| N10 | When `enabledStates: ['MN']` set and ship-to has no province → returns `[]` (conservative) | unit test |
| N11 | Skip is logged at DEBUG level only, never WARN/ERROR | grep test of Logger calls |
| N12 | SonarQube re-scan green (0 BLOCKER, 0 CRITICAL, A/A/A) | scan + measures |
| N13 | Demo VM: WI order against `enabledStates: ['MN']` returns `[]`; MN order returns full tax | runtime test |
| N14 | README + CHANGELOG updated; ADR-006 committed | manual review |
