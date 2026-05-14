# Phase 03 — Plan

## File-level changes

```
src/
├── types.ts                        # MODIFIED: add categoryByTaxCategoryName + defaultCategory
├── lib/
│   ├── ostax-client.ts             # unchanged (CalculateLineItem already has `category: string`)
│   └── config.ts                   # MODIFIED: validate the new options, expose in LoadedConfig
├── strategies/
│   ├── ostax-tax-line.strategy.ts  # MODIFIED: lookup category, skip [] if empty
│   └── ostax-tax-zone.strategy.ts  # unchanged
├── opensalestax.plugin.ts          # unchanged
└── index.ts                        # unchanged

tests/
├── unit/
│   ├── config.test.ts                          # MODIFIED: add validation tests
│   ├── ostax-tax-line.strategy.test.ts         # MODIFIED: add mapping tests
│   ├── ostax-client.test.ts                    # unchanged
│   └── ostax-tax-zone.strategy.test.ts         # unchanged
└── integration/
    └── plugin.test.ts                          # unchanged
```

## API additions

`src/types.ts`:

```ts
/** OST's six accepted tax categories, plus '' meaning "skip this line". */
export type OpenSalesTaxCategory =
  | 'general'
  | 'clothing'
  | 'groceries'
  | 'prescription_drugs'
  | 'prepared_food'
  | 'digital_goods'
  | '';

export interface OpenSalesTaxPluginOptions {
  // ...existing fields unchanged...

  /**
   * Maps Vendure TaxCategory.name → OST category. When the strategy
   * runs `calculate()`, it reads `args.applicableTaxRate.category.name`
   * and looks it up here. Unmapped names fall back to `defaultCategory`,
   * then to `'general'`.
   *
   * Mapping a name to `''` (empty string) tells OST to skip the line
   * (non-taxable). The strategy returns `[]` for that line without
   * calling the engine.
   *
   * @example
   * categoryByTaxCategoryName: {
   *   'Clothing':       'clothing',
   *   'Food':           'groceries',
   *   'Digital':        'digital_goods',
   *   'Gift Cards':     '',  // non-taxable
   * }
   */
  categoryByTaxCategoryName?: Record<string, OpenSalesTaxCategory>;

  /**
   * OST category used when a line's TaxCategory name doesn't match
   * any entry in `categoryByTaxCategoryName` (or the line has no
   * resolvable TaxCategory). Default `'general'`. Set to `''` to
   * make all unmapped lines non-taxable.
   */
  defaultCategory?: OpenSalesTaxCategory;
}
```

The `OpenSalesTaxCategory` union goes in `types.ts` so it's
re-exported from `src/index.ts` (advanced merchants get type
hints in their `init()` call).

## Config validation

`src/lib/config.ts`:

```ts
const VALID_CATEGORIES = new Set<OpenSalesTaxCategory>([
  'general', 'clothing', 'groceries',
  'prescription_drugs', 'prepared_food',
  'digital_goods', '',
]);

// Inside loadConfig():
const mapping = options.categoryByTaxCategoryName ?? {};
const invalidMappings: string[] = [];
for (const [name, cat] of Object.entries(mapping)) {
  if (!VALID_CATEGORIES.has(cat as OpenSalesTaxCategory)) {
    invalidMappings.push(`"${name}" => "${cat}"`);
  }
}
if (invalidMappings.length > 0) {
  throw new Error(
    '@ejosterberg/vendure-plugin-opensalestax: ' +
      'invalid OST category in categoryByTaxCategoryName: ' +
      invalidMappings.join(', ') +
      '. Valid categories: ' +
      [...VALID_CATEGORIES].map(c => c === '' ? "''" : c).join(', '),
  );
}

const defaultCategory = options.defaultCategory ?? 'general';
if (!VALID_CATEGORIES.has(defaultCategory)) {
  throw new Error(
    '@ejosterberg/vendure-plugin-opensalestax: ' +
      `invalid defaultCategory "${defaultCategory}". ` +
      'Valid categories: ' + [...VALID_CATEGORIES].map(c => c === '' ? "''" : c).join(', '),
  );
}
```

Add to `LoadedConfig`:
```ts
readonly categoryByTaxCategoryName: Readonly<Record<string, OpenSalesTaxCategory>>;
readonly defaultCategory: OpenSalesTaxCategory;
```

Both frozen so the strategy can trust them.

## Strategy update

`src/strategies/ostax-tax-line.strategy.ts`:

Add helper:
```ts
private resolveCategory(args: CalculateTaxLinesArgs): OpenSalesTaxCategory {
  const name = args.applicableTaxRate?.category?.name;
  const mapped = name !== undefined
    ? this.config.categoryByTaxCategoryName[name]
    : undefined;
  return mapped ?? this.config.defaultCategory;
}
```

In `calculate()` after the gates pass:
```ts
const category = this.resolveCategory(args);
if (category === '') {
  Logger.debug(`skip: tax_category_name=${args.applicableTaxRate?.category?.name ?? 'unknown'} mapped_to_skip`, LOGGER_CTX);
  return [];
}
const request: CalculateRequest = {
  address: { zip5 },
  line_items: [{ amount: amountStr, category }],
};
```

(Note: TaxCategory name is merchant-defined and not customer
PII — safe to log under DEBUG when explaining a skip.)

## Tests

### `tests/unit/config.test.ts` additions
1. defaults: empty mapping + defaultCategory='general' when none provided
2. accepts a valid mapping with all 6 OST categories + ''
3. throws on invalid OST category in mapping (e.g., 'invalid_cat')
4. throws on invalid defaultCategory
5. accepts defaultCategory='' (skip-by-default)
6. multiple invalid entries surfaced together in error message
7. mapping is frozen on the LoadedConfig output

### `tests/unit/ostax-tax-line.strategy.test.ts` additions

Existing test fixtures pass `applicableTaxRate = { value: 0, name: 'Placeholder' } as TaxRate` (no `.category`). Add a new `buildArgs` overload accepting an optional `taxCategoryName` and a tweak for the strategy options.

1. **C4 happy path**: mapping `{ 'Clothing': 'clothing' }` + order line whose `applicableTaxRate.category.name === 'Clothing'` → engine called with `category: 'clothing'`
2. **C5 fallback to defaultCategory**: mapping `{ 'Clothing': 'clothing' }` + name='Standard' + defaultCategory='general' → engine called with `category: 'general'`
3. **C6 default-of-default**: no mapping, no defaultCategory, name unset → engine called with `category: 'general'` (preserves v1.0)
4. **C7 skip-line**: mapping `{ 'Donations': '' }` + name='Donations' → returns [] without calling engine
5. **C7 skip-default**: defaultCategory='', name unset → returns [] without calling engine

## ADR-005

Documents:
- Why mapping by TaxCategory **name** (not id, not custom field) for v1.1
- Why we accept `''` as skip-this-line
- Why defaults preserve v1.0 behavior (zero-config still works)
- Future direction: TaxCategory custom field for Admin-UI editing (v1.2 candidate)

## Risk + mitigation

- **Risk:** Merchants typo a TaxCategory name in the mapping
  → falls back silently to defaultCategory (engineering-wise
  correct, but the merchant might not notice until they see
  unexpected tax). **Mitigation:** strategy `init()` could
  fetch all TaxCategory records via the Injector and emit a
  one-shot WARN listing mapped names that don't exist. Defer
  to v1.2.
- **Risk:** Merchants confuse OST category names with Vendure
  category names. **Mitigation:** error messages on invalid
  values list the exact valid OST categories. Worked example
  in README shows both sides clearly.
- **Risk:** Vendure renames `TaxCategory.name` field in a
  major version. **Mitigation:** the strategy uses
  `applicableTaxRate?.category?.name` with optional chaining
  — a missing field falls to `undefined` → fallback to default.

## Acceptance for phase 03

- [ ] All C1-C12 success criteria green
- [ ] `npm run check` passes
- [ ] CI on main HEAD green
- [ ] SonarQube re-scan: 0 BLOCKER, 0 CRITICAL, A/A/A
- [ ] Demo VM: clothing-category order observed using `category=clothing` in the engine call
- [ ] CHANGELOG v1.1.0 entry extended; ADR-005 committed
