# ADR 005 — Map OST tax categories by Vendure `TaxCategory.name`

**Date:** 2026-05-13
**Status:** Accepted
**Context stage:** v1.1.0 phase 03

## Decision

Accept a `categoryByTaxCategoryName: Record<string, string>`
option on `OpenSalesTaxPlugin.init({...})`. The strategy reads
`args.applicableTaxRate.category.name` at calculation time
and looks it up in this map to choose which of OST's six
categories (`general`, `clothing`, `groceries`,
`prescription_drugs`, `prepared_food`, `digital_goods`, or
`''` for skip) to send to the engine.

Also accept `defaultCategory: string` for the unmapped-fallback
case. Both options are validated at `loadConfig()` time
against the allowed value-set; invalid values throw with a
clear error.

## Alternatives considered

### A. Map by `TaxCategory.id`

```ts
categoryByTaxCategoryId: { '1': 'general', '2': 'clothing' }
```

**Pros:** ID-stable; renaming a TaxCategory in the Admin UI
doesn't break the mapping silently.

**Cons:** terrible merchant UX. IDs are auto-generated; the
merchant has to query the database (or the Admin GraphQL
API) to find the IDs before they can write the mapping. The
typical workflow ("I just made a 'Clothing' TaxCategory in
the Admin, now what?") doesn't expose IDs.

**Verdict:** rejected. Brittleness on rename is a real but
small risk; UX cost is large and constant.

### B. Vendure custom field on `TaxCategory`

The plugin would register a custom field on `TaxCategory` at
init time, exposing a dropdown in the Admin UI where the
merchant picks the OST category per Vendure category. The
strategy reads `applicableTaxRate.category.customFields.ostaxCategory`.

**Pros:** native Admin-UI editing; mapping survives renames;
no `init()` config; validates at the data layer.

**Cons:**
- More complex implementation (custom-field type registration,
  schema migration on plugin install/upgrade, dropdown UI
  via Vendure admin extensions).
- Couples the plugin tighter to Vendure's entity layer —
  more blast radius if Vendure changes the custom-field
  registration API.
- Slower to ship; harder to test in isolation.

**Verdict:** documented as the **v1.2 candidate**. v1.1 ships
the simpler `categoryByTaxCategoryName` first; v1.2 can add
custom-field support as an *additional* path (not a
replacement — both can coexist, with custom field winning
when both are set).

### C. Per-ProductVariant override via custom field

Same as B but on `ProductVariant`, giving merchants per-SKU
escape hatches.

**Verdict:** out of scope. Not requested. If asked, lump
into the same v1.2 work as B.

### D. Auto-detect from product slug / keywords / description

E.g., regex on `productVariant.name` for "shirt" → `clothing`.

**Verdict:** rejected. Unreliable, surprising, hard to debug.

## Consequences

- **Non-breaking** for v1.0 / v1.1 (post-phase-02) merchants:
  default behavior is `categoryByTaxCategoryName: {}` and
  `defaultCategory: 'general'`, which produces the exact same
  request payloads as v1.0.
- Merchants opt in by passing a mapping in `init()`:
  ```ts
  OpenSalesTaxPlugin.init({
    apiUrl: process.env.OSTAX_API_URL!,
    categoryByTaxCategoryName: {
      'Clothing':       'clothing',
      'Food':           'groceries',
      'Digital Goods':  'digital_goods',
      'Gift Cards':     '',  // non-taxable
    },
  })
  ```
- Validation is strict: an unknown OST category in the map
  fails fast at plugin init, not at first tax calc. Merchants
  see config errors at server boot.
- A typo in a Vendure TaxCategory name silently falls back
  to `defaultCategory` (`'general'` by default). v1.2 can add
  a startup probe that lists mapped names not present in the
  TaxCategory table.

## Future direction

- v1.2: Vendure custom field on TaxCategory, dropdown-edited
  in the Admin UI. Coexists with `categoryByTaxCategoryName`
  (custom field wins when both apply).
- v1.2: optional startup probe via Injector that lists
  mapped TaxCategory names not found in the data, as a
  one-shot WARN.
- v1.3+: per-ProductVariant override (custom field) for the
  edge cases TaxCategory granularity can't express.

## Verification

- Phase-03 unit tests cover both the validation surface and
  the strategy resolution order.
- Demo VM walkthrough confirms a clothing-category Vendure
  variant produces an OST request with `category: 'clothing'`
  (vs the v1.0 blanket `general`).
