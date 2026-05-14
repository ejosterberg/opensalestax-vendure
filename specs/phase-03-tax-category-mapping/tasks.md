# Phase 03 — Task list

Atomic, ordered. v1.1.0 bundles phase-02 (`TaxZoneStrategy`)
and phase-03 (category mapping).

1. **ADR-005**: write
   `specs/decisions/005-tax-category-mapping-by-name.md`
   capturing the API choice (name vs id vs custom field).

2. **TDD: extend `tests/unit/config.test.ts`** with the
   7 cases from `plan.md`. Run — they fail.

3. **TDD: extend `tests/unit/ostax-tax-line.strategy.test.ts`**
   with the 5 cases from `plan.md`. Run — they fail.

4. **Implement** in `src/types.ts`: add
   `OpenSalesTaxCategory` union type, extend
   `OpenSalesTaxPluginOptions` with the two new fields, extend
   `LoadedConfig` accordingly.

5. **Implement** in `src/lib/config.ts`: add
   `VALID_CATEGORIES` set, validate both new options, fail
   fast with a clear error message listing the bad pairings.
   Freeze the mapping in the returned config.

6. **Implement** in `src/strategies/ostax-tax-line.strategy.ts`:
   add `resolveCategory()` helper, use it before building the
   OST request, short-circuit to `[]` on `''` (skip).

7. **Re-export** `OpenSalesTaxCategory` from `src/index.ts`.

8. **Run `npm run check`** — all 75 (now 75 + new) tests pass,
   typecheck clean, lint clean, coverage thresholds met.

9. **Update README**: add a "Tax category mapping" subsection
   under "Configuration reference" with a worked example
   covering a clothing/grocery store. Update the configuration
   reference table to include `categoryByTaxCategoryName` and
   `defaultCategory`.

10. **Update CHANGELOG v1.1.0 entry**: add a "Tax category
    mapping" item under Added describing the new options.

11. **SonarQube re-scan**: run scanner with `-Dsonar.projectVersion=1.1.0`,
    confirm 0 BLOCKER / 0 CRITICAL / A/A/A.

12. **Demo VM verification**:
    - `npm run build && npm pack`
    - `scp` new tarball to vendure-demo
    - `npm install ./<tarball>` on the VM
    - Update the demo's `vendure-config.ts` to add a
      `categoryByTaxCategoryName: { 'Clothing': 'clothing' }`
      mapping (or use a fresh seed step that creates a Clothing
      TaxCategory + variant)
    - Restart Vendure
    - Place an order with a clothing variant; verify the OST
      engine was called with `category: 'clothing'` (check
      VM-side curl trace OR engine logs)

13. **Commit + push** in two logical chunks:
    - feat(strategy): per-product OST category mapping
    - test/docs: tests + README + CHANGELOG + ADR-005

14. **Cut v1.1.0** (separate stage — verify Eric's Trusted
    Publisher first; tag push fires release.yml).
