# Phase 02 — `TaxZoneStrategy` auto-resolver

**Status:** Draft → In Progress
**Target version:** v1.1.0
**Supersedes:** ADR-002 (which deferred this work to v1.1)

## Why

In v1.0, merchants had to manually configure a US Zone in the
Vendure Admin UI before the plugin would compute tax. The
README's quickstart had this as step 4 ("Configure a US tax
zone in Vendure Admin (one-time)"). This is friction for
adoption and a common source of "why is tax always zero?"
support questions.

Vendure's `TaxZoneStrategy` interface is the right hook to
remove this step: instead of relying on the merchant to set
`channel.defaultTaxZone = US`, the plugin can dynamically
resolve the active US zone for any US-shipping order.

## User stories

- **As a merchant**, I want the plugin to "just work" after
  `npm install` + the `init()` snippet — without having to
  hand-create a Zone in the Admin UI.
- **As a merchant**, if I *do* have an existing US Zone
  configured, the plugin should use it automatically (matching
  what Vendure would have done) without any reconfiguration.
- **As a merchant**, if I have multiple Zones (US, CA, UK,
  etc.), my US orders should be assigned to the US Zone and my
  non-US orders should still flow through Vendure's default
  zone resolution.

## In scope (v1.1.0)

1. New `OstaxTaxZoneStrategy` class implementing
   `TaxZoneStrategy` from `@vendure/core`.
2. Plugin registers it via the `configuration` callback
   alongside the existing `TaxLineCalculationStrategy`.
3. Resolution rule:
   - If `order` is provided AND
     `order.shippingAddress.countryCode === 'US'`: scan `zones`
     for a Zone whose `members` include a country region with
     code `US`; return the first match.
   - If no US zone exists in the merchant's setup: log a WARN
     once at first miss, then return `channel.defaultTaxZone`
     (preserves Vendure's normal behavior).
   - For all other cases (no order; non-US shipping country):
     return `channel.defaultTaxZone` unchanged.
4. Per-process memoization: `determineTaxZone` is hot-path;
   cache the resolved US-zone-id keyed by zone-set identity
   (or by zone-list length+first-id heuristic) so we scan
   once per zone-list shape.
5. Update README quickstart: replace the "Configure a US tax
   zone" step with a one-line note that "If you don't have a
   US Zone yet, the plugin will use Vendure's default zone and
   log a recommendation. To get the most accurate behavior,
   create a Zone with US as a member."
6. ADR-004 documenting the supersession of ADR-002.
7. CHANGELOG v1.1.0 entry.

## Out of scope (defer to v1.2 or later)

- Auto-creating the US Zone at plugin init (touches Vendure's
  data layer; risky; ADR-005 would be needed). Document the
  recommended Zone shape but don't create it.
- TaxZoneStrategy support for Canadian or other non-US
  destinations. This plugin is US-only by constitution §5.
- Per-state Zone resolution (e.g. resolving to a "US-MN" Zone
  if the merchant has split zones by state). v1.0/v1.1 treats
  all US ZIPs as belonging to a single US Zone.

## Success criteria

| # | Criterion | How to verify |
|---|-----------|---------------|
| Z1 | New `OstaxTaxZoneStrategy` class exists, implements `TaxZoneStrategy`, and is exported from `src/index.ts` | grep + typecheck |
| Z2 | Plugin registers it on `config.taxOptions.taxZoneStrategy` | integration test asserting `instanceof OstaxTaxZoneStrategy` |
| Z3 | When a US-zone exists in the merchant's data, US orders get that zone | unit test with `zones=[US, CA]`, order ship-to US → returns US zone |
| Z4 | When no US zone exists, returns channel default + logs a one-shot WARN | unit test with `zones=[CA]`, order ship-to US → returns channel.defaultTaxZone, WARN logged once across multiple calls |
| Z5 | Non-US orders return channel default unchanged | unit test with order ship-to CA → returns channel.defaultTaxZone |
| Z6 | No order context returns channel default | unit test with `order=undefined` → returns channel.defaultTaxZone |
| Z7 | Repeated calls with the same zone set don't rescan (memoization works) | unit test counting member-array reads or via wrapped spy |
| Z8 | README quickstart drops the "Configure a US tax zone" step | manual review |
| Z9 | All existing tests still pass; coverage ≥ baseline | `npm run check` |
| Z10 | SonarQube re-scan green (0 BLOCKER, 0 CRITICAL, A/A/A) | scan + measures pull |
| Z11 | Demo VM still works end-to-end (place a $100 MN order, see nonzero tax) | `bash scripts/demo-place-order.sh 1` |

## Out-of-scope success criteria

- Auto-creating the US zone (Z12 if/when added in v1.2)
- Multi-region tax zones (US-MN vs US-NY) — different ADR
