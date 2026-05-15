# Phase 04 — Plan

## File-level changes

```
src/
├── types.ts                        # MODIFIED: add enabledStates + disabledStates
├── lib/
│   └── config.ts                   # MODIFIED: validate state codes, mutex, normalize to Set
└── strategies/
    └── ostax-tax-line.strategy.ts  # MODIFIED: nexus gate after the existing gates

tests/
└── unit/
    ├── config.test.ts                    # MODIFIED: validation tests
    └── ostax-tax-line.strategy.test.ts   # MODIFIED: gating tests
```

## API additions

`src/types.ts` — extend `OpenSalesTaxPluginOptions`:

```ts
/**
 * Allowlist of US state codes (ISO 3166-2 subdivision codes,
 * uppercase 2-letter, e.g. 'MN', 'WI'). When set, the plugin
 * computes tax only for orders shipping to one of these states;
 * orders to other states return `[]`.
 *
 * Mutually exclusive with `disabledStates` — setting both throws
 * at plugin init.
 */
enabledStates?: string[];

/**
 * Denylist of US state codes. When set, the plugin returns `[]`
 * for orders shipping to one of these states; orders elsewhere
 * compute as normal.
 *
 * Mutually exclusive with `enabledStates`.
 */
disabledStates?: string[];
```

Extend `LoadedConfig` with the normalized form (Set for O(1)
lookup, frozen):

```ts
readonly enabledStates: ReadonlySet<string> | null;   // null = no filter
readonly disabledStates: ReadonlySet<string> | null;
```

(Use `null` rather than empty Set to distinguish "unset" from
"set to []" — empty array still throws in validation since
empty allowlist = "compute for nobody" is almost certainly a
typo.)

Actually — reconsidering — empty array is genuinely useful:
"I have no nexus right now, suppress all calc until I do."
Treating empty as "filter everything out" is an explicit
choice. Let me default to: empty array = treat as undefined
(no filter), to avoid the "user accidentally configured an
empty array" footgun. If they really want "compute for
nobody," they should disable the plugin instead.

Final design: empty array → normalized to `null` (no filter)
+ INFO log noting the empty list was ignored. Less footgun.

## Config validation

`src/lib/config.ts`:

```ts
const STATE_CODE_REGEX = /^[A-Z]{2}$/;

function normalizeStateList(
  raw: string[] | undefined,
  fieldName: string,
): ReadonlySet<string> | null {
  if (raw === undefined || raw.length === 0) return null;
  const invalid = raw.filter((s) => !STATE_CODE_REGEX.test(s));
  if (invalid.length > 0) {
    throw new Error(
      '@ejosterberg/vendure-plugin-opensalestax: invalid state codes in ' +
        `${fieldName}: ${invalid.map((s) => `"${s}"`).join(', ')}. ` +
        'Use uppercase 2-letter ISO 3166-2 codes (e.g. "MN", "WI").',
    );
  }
  return Object.freeze(new Set(raw));
}

// In loadConfig():
const enabledStates = normalizeStateList(options.enabledStates, 'enabledStates');
const disabledStates = normalizeStateList(options.disabledStates, 'disabledStates');
if (enabledStates !== null && disabledStates !== null) {
  throw new Error(
    '@ejosterberg/vendure-plugin-opensalestax: enabledStates and ' +
      'disabledStates are mutually exclusive — set one or the other, ' +
      'not both.',
  );
}
```

## Strategy update

`src/strategies/ostax-tax-line.strategy.ts` — after the
existing US gate, before the OST call:

```ts
// Gate 4: per-state nexus filter (added in v1.2.0)
const province = address.province;
if (this.config.enabledStates !== null) {
  if (province === undefined || !this.config.enabledStates.has(province)) {
    Logger.debug(`skip: nexus_filter province=${province ?? 'none'}`, LOGGER_CTX);
    return [];
  }
}
if (this.config.disabledStates !== null && province !== undefined) {
  if (this.config.disabledStates.has(province)) {
    Logger.debug(`skip: nexus_filter province=${province}`, LOGGER_CTX);
    return [];
  }
}
```

Order matters: this gate runs AFTER USD/US/ZIP gates so
non-US orders aren't even considered for nexus filtering.

## Tests (config)

`tests/unit/config.test.ts` additions (under new
`describe('nexus filter')` block):

1. defaults: enabledStates and disabledStates are `null` when
   not provided
2. accepts a valid `enabledStates: ['MN', 'WI']`
3. accepts a valid `disabledStates: ['CA']`
4. throws when both set
5. throws on lowercase state code
6. throws on 1-letter state code
7. throws on 3-letter state code
8. throws on numeric "state code"
9. error message lists every bad code
10. empty array normalized to `null` (no filter)
11. returned Set is frozen

## Tests (strategy)

`tests/unit/ostax-tax-line.strategy.test.ts` additions (under
new `describe('nexus filter (phase 04)')` block):

1. enabledStates includes ship-to state → engine called normally
2. enabledStates does NOT include ship-to → returns `[]` (no engine call)
3. enabledStates set + ship-to has no province → returns `[]` (conservative)
4. disabledStates includes ship-to → returns `[]`
5. disabledStates does NOT include ship-to → engine called normally
6. disabledStates set + no province → engine called (denylist doesn't catch)
7. neither option set → engine called for any US ship-to (preserves v1.1)

## ADR-006

Captures:
- Why two options (allowlist vs denylist) — both have legitimate use cases
- Why mutually exclusive — setting both creates a paradox; error is clearer than silently picking one
- Why uppercase 2-letter validation — matches Vendure's standard "province" field convention; catches typos
- Why empty array → no filter — footgun mitigation
- Future: economic-nexus auto-detection deferred indefinitely (separate product)

## Risk + mitigation

- **Risk:** merchant assumes `enabledStates` covers economic nexus thresholds, doesn't realize they need to update it as their business grows. **Mitigation:** README disclaimer, plus a one-shot INFO log at startup listing the active filter so it's visible in the boot output.
- **Risk:** Vendure stores province in a non-standard format (e.g. full name "Minnesota") in some merchant configurations. **Mitigation:** Vendure's stock UI uses 2-letter codes; if a merchant has customized, they'll see DEBUG logs showing the mismatch and can adjust.
- **Risk:** state-code validation rejects non-US codes a global merchant might have entered (e.g. "ON" for Ontario). **Mitigation:** the constitution restricts the plugin to US-only; the validation message points at ISO 3166-2 US codes. Non-US merchants shouldn't be using this plugin.

## Acceptance for phase 04

- [ ] All N1-N14 success criteria green
- [ ] `npm run check` passes
- [ ] CI on main HEAD green
- [ ] SonarQube re-scan: 0 BLOCKER, 0 CRITICAL, A/A/A
- [ ] Demo VM: WI ship-to with `enabledStates: ['MN']` returns []; MN ship-to returns full tax
