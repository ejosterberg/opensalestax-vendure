# Phase 02 — Plan

## File-level architecture

```
src/
├── opensalestax.plugin.ts               # MODIFIED: configuration callback
│                                        # registers TaxZoneStrategy alongside
│                                        # the existing TaxLineCalculationStrategy
├── strategies/
│   ├── ostax-tax-line.strategy.ts       # unchanged
│   └── ostax-tax-zone.strategy.ts       # NEW
├── lib/
│   ├── ostax-client.ts                  # unchanged
│   └── config.ts                        # unchanged
├── index.ts                             # MODIFIED: re-export OstaxTaxZoneStrategy
└── types.ts                             # unchanged

tests/
├── unit/
│   ├── ostax-tax-zone.strategy.test.ts  # NEW
│   └── ... (existing tests unchanged)
└── integration/
    └── plugin.test.ts                   # MODIFIED: add assertion that
                                         # taxZoneStrategy is registered
```

## `OstaxTaxZoneStrategy` design

```ts
export class OstaxTaxZoneStrategy implements TaxZoneStrategy {
  // Memoization: zone-list reference identity → resolved US zone (or null if none).
  // We use the array reference itself as the key via WeakMap; Vendure passes the
  // same `zones` array reference across calls within a request lifecycle, so this
  // collapses N calls/request to 1 scan. Across requests, Vendure may pass new
  // arrays; we accept the rescan cost there.
  private cache = new WeakMap<Zone[], Zone | null>();

  // Once-per-process WARN flag so we don't spam logs when a merchant runs without
  // a US zone configured.
  private warnedNoUsZone = false;

  determineTaxZone(
    ctx: RequestContext,
    zones: Zone[],
    channel: Channel,
    order?: Order,
  ): Zone | undefined {
    // Skip the US lookup if there's no order context or it's not a US ship-to.
    const isUsOrder =
      order?.shippingAddress?.countryCode === 'US';
    if (!isUsOrder) {
      return channel.defaultTaxZone;
    }

    // Cached lookup; falls back to a scan on miss.
    const cached = this.cache.get(zones);
    if (cached !== undefined) {
      return cached === null ? this.fallback(channel) : cached;
    }
    const found = this.findUsZone(zones);
    this.cache.set(zones, found ?? null);
    return found ?? this.fallback(channel);
  }

  private findUsZone(zones: Zone[]): Zone | undefined {
    // First Zone whose members include a country region with code === 'US'.
    return zones.find((z) =>
      z.members?.some(
        (m) => m.type === 'country' && m.code === 'US',
      ),
    );
  }

  private fallback(channel: Channel): Zone | undefined {
    if (!this.warnedNoUsZone) {
      Logger.warn(
        'No Zone with US country member found. Falling back to ' +
          'channel.defaultTaxZone. Create a Zone containing the United States ' +
          'in Settings -> Zones to silence this warning and ensure US orders ' +
          'are zoned correctly.',
        'OpenSalesTaxPlugin',
      );
      this.warnedNoUsZone = true;
    }
    return channel.defaultTaxZone;
  }
}
```

### Why `WeakMap<Zone[], ...>` instead of a Map keyed by ids

- `WeakMap` keyed by the array reference itself means the cache
  entry GCs when Vendure replaces the array (e.g. on zone CRUD,
  it rebuilds the cached zone list). No manual invalidation
  needed.
- An id-keyed Map would need explicit invalidation logic and a
  way to detect "the zone list has changed" — extra surface
  with no win.

### Why a one-shot WARN

- Per Vendure's TaxZoneStrategy docstring, this method is called
  *very* often. Logging on every miss would flood the merchant's
  logs.
- The `warnedNoUsZone` flag is per-strategy-instance, which is
  effectively per-process (Vendure constructs the strategy once
  during plugin configuration).

## Tests (unit)

`tests/unit/ostax-tax-zone.strategy.test.ts`:

1. **Z3 happy path** — zones include a US zone → returns US zone
2. Zones include US zone but it's not the first one → still returns US zone
3. **Z4 fallback** — zones don't include a US zone → returns channel.defaultTaxZone
4. **Z4 warn-once** — multiple fallback calls only log WARN once (spy on Logger)
5. **Z5 non-US order** — order ship-to CA → returns channel.defaultTaxZone (no scan)
6. **Z6 no order** — order=undefined → returns channel.defaultTaxZone
7. **Z6.5 order with no shippingAddress** — order={}; → returns channel.defaultTaxZone
8. **Z7 memoization** — same zones array reference, multiple calls → scan happens once
9. New zones array reference (different identity) → re-scans
10. Province-type members are ignored — only country-type with code 'US' counts
11. Zone with empty `members` array doesn't crash

## Tests (integration)

Modify `tests/integration/plugin.test.ts`:

- Add assertion that `configService.taxOptions.taxZoneStrategy instanceof OstaxTaxZoneStrategy`
- The existing "boots cleanly" test continues to pass

## Plugin wiring

`src/opensalestax.plugin.ts` — extend the `configuration` callback:

```ts
configuration: (config) => {
  const opts = OpenSalesTaxPlugin.options;
  config.taxOptions.taxLineCalculationStrategy = new OstaxTaxLineStrategy(opts);
  config.taxOptions.taxZoneStrategy = new OstaxTaxZoneStrategy();
  return config;
},
```

The zone strategy doesn't need plugin options — its logic is
deterministic given Vendure's input.

## README changes

- Drop the "Configure a US tax zone in Vendure Admin (one-time)"
  step from the quickstart.
- Replace with a one-paragraph note in "How it works": "If
  you've already created a US Zone in Vendure (recommended),
  the plugin auto-routes US orders to it. If not, the plugin
  falls back to your channel's default Zone and logs a
  one-time WARN suggesting you create one — checkout still
  works either way."
- Update the troubleshooting section to mention the fallback
  WARN message as a normal-state log line.

## Schema impact

None. The plugin doesn't add or modify any Vendure entities.
The strategy reads existing Zone, Channel, Order, RegionType
data Vendure already provides.

## Risk + mitigation

- **Risk:** Vendure may pass `null`/`undefined` in
  `members` array if a zone has no members. **Mitigation:**
  optional-chain on `z.members?.some(...)`.
- **Risk:** A merchant could have a Zone named "US" that's
  actually meant for a different purpose (no US country
  member). **Mitigation:** match on `member.code === 'US'` and
  `member.type === 'country'`, NOT on zone name.
- **Risk:** WeakMap keyed by array reference could miss the
  cache hit if Vendure copies the array between calls.
  **Mitigation:** worst case is a cache miss → re-scan → reset
  cache. No correctness issue, just a small perf win lost. The
  scan itself is O(zones × members) which is small (typical
  merchant has <10 zones × <50 members).

## Acceptance for phase 02

- [ ] All Z1-Z11 success criteria green
- [ ] `npm run check` passes
- [ ] CI on `main` HEAD green
- [ ] SonarQube re-scan: 0 BLOCKER, 0 CRITICAL, ratings A/A/A
- [ ] Demo VM end-to-end test still works
- [ ] CHANGELOG v1.1.0 entry committed
- [ ] ADR-004 supersedes ADR-002
