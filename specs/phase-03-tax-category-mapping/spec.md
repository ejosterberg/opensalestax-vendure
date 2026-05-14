# Phase 03 — Per-product OST tax category mapping

**Status:** Draft → In Progress
**Target version:** v1.1.0 (bundled with phase-02)

## Why

The OST engine accepts a `category` string per line item and
applies category-specific rules (clothing exemptions in some
states, groceries usually exempt, prescription drugs always
exempt, etc.). v1.0/v1.1 hardcodes `category: 'general'` for
every line — correct for general-merchandise stores, wrong for
anyone selling food, clothing, prescription drugs, prepared
food, or digital goods.

Vendure's natural extension point is the **`TaxCategory`**
entity: merchants already create TaxCategory records ("Standard",
"Reduced", etc.) and assign them per-ProductVariant in the
Admin UI. Each `TaxRate` (and therefore the
`applicableTaxRate.category` we receive in the strategy
`calculate()` args) carries a `TaxCategory` with a `name`
field. We can map that `name` to one of OST's six categories.

## User stories

- **As a merchant selling general merchandise**, I keep the
  v1.0 zero-config behavior — every line goes to OST as
  `general`.
- **As a clothing merchant**, I want to map my "Clothing"
  TaxCategory to OST's `clothing` category so the engine
  correctly applies state clothing exemptions (PA, MN, NJ,
  etc.).
- **As a grocery store**, I map "Groceries" → `groceries` so
  food gets the appropriate state-by-state treatment.
- **As any merchant**, I want a "non-taxable" mapping so I can
  flag items (gift cards, donations) to skip OST entirely
  without disabling the plugin per-line.

## In scope (v1.1.0 phase 03)

1. Two new fields on `OpenSalesTaxPluginOptions`:
   - **`categoryByTaxCategoryName?: Record<string, string>`** —
     map of Vendure `TaxCategory.name` → OST category string
     (`general`, `clothing`, `groceries`,
     `prescription_drugs`, `prepared_food`, `digital_goods`,
     or `''` to skip the line).
   - **`defaultCategory?: string`** — fallback OST category
     when no mapping matches (or the order line has no
     resolvable TaxCategory). Default: `'general'`. Same
     value-set as above (including `''` for skip-by-default).

2. `loadConfig()` validates both fields:
   - Every value must be one of the 6 known OST categories
     OR empty string. Invalid values throw at plugin init
     with a clear error message listing the bad pairing(s).
   - The map's keys (TaxCategory names) are not validated
     against Vendure's data — Vendure entities aren't loaded
     at plugin init time. (We could probe at strategy `init()`
     via the Injector, but a missing-key isn't an error: the
     fallback covers it.)

3. `OstaxTaxLineStrategy.calculate()` reads
   `args.applicableTaxRate?.category?.name` and looks it up
   in the mapping. Resolution order:
   1. `categoryByTaxCategoryName[name]` if present
   2. `defaultCategory` if set
   3. Built-in `'general'`
   - If the resolved category is `''` (empty/skip): return
     `[]` for the line (engine never called).

4. New unit tests covering: config validation (valid mappings,
   each invalid OST category name, empty string accepted),
   strategy mapping behavior (mapping hits, mapping misses
   fall to default, default fall to `'general'`, empty string
   short-circuits to `[]`).

5. README: new "Tax category mapping" section under
   "Configuration reference" with a worked example covering a
   clothing/grocery store.

6. CHANGELOG v1.1.0 entry extended with this feature.

7. ADR-005 documenting the API choice (mapping by
   TaxCategory.name vs id vs custom field).

8. Demo-VM verification: create a "Clothing" TaxCategory in
   the demo, set the mapping, place an order with a
   clothing-category variant, observe the engine call uses
   `category: clothing`.

## Out of scope (defer to v1.2 or later)

- **Vendure custom field on TaxCategory** for native Admin-UI
  editing of the OST mapping. Documented in ADR-005's
  "Future direction" section.
- **Per-ProductVariant override** (escape hatch beyond
  TaxCategory granularity). Not requested; would also use a
  custom field.
- **Validation that the mapping's keys exist as TaxCategory
  records in Vendure.** Hard to do at plugin init (entities
  not loaded yet); easy to do at strategy `init()` via the
  Injector — defer until merchants actually request it.
- **Auto-detect category from product slug/keywords**.
  Brittle; not on the roadmap.

## Success criteria

| # | Criterion | How to verify |
|---|-----------|---------------|
| C1 | New options accepted by `OpenSalesTaxPlugin.init()` and surfaced in `LoadedConfig` | typecheck + config unit test |
| C2 | `loadConfig()` throws on invalid mapping value (not one of the 6 categories or `''`) | unit test |
| C3 | `loadConfig()` accepts an empty/undefined mapping and an undefined `defaultCategory` (preserves v1.0 behavior) | unit test |
| C4 | Strategy uses mapped category when TaxCategory name matches | unit test |
| C5 | Strategy falls back to `defaultCategory` when name doesn't match | unit test |
| C6 | Strategy falls back to `'general'` when both mapping and defaultCategory are unset | unit test (existing v1.0 tests should keep passing) |
| C7 | Strategy returns `[]` (skip) when resolved category is `''` | unit test |
| C8 | Existing v1.0 tests still pass without modification (no regression) | `npm run check` |
| C9 | Demo VM: a clothing-category order calls OST with `category: 'clothing'` | tcpdump or engine log inspection on demo VM |
| C10 | SonarQube re-scan green (0 BLOCKER, 0 CRITICAL, A/A/A) | scan + measures pull |
| C11 | README documents the new option with a worked example | manual review |
| C12 | ADR-005 committed | grep |
