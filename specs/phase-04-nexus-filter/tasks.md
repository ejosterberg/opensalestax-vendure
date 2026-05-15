# Phase 04 — Tasks

1. Write ADR-006 (`specs/decisions/006-per-state-nexus-filter.md`).
2. TDD: add config-validation cases to `tests/unit/config.test.ts`.
3. TDD: add strategy gating cases to `tests/unit/ostax-tax-line.strategy.test.ts`.
4. Implement: extend `OpenSalesTaxPluginOptions` + `LoadedConfig` in `src/types.ts`.
5. Implement: `normalizeStateList()` + mutex check in `src/lib/config.ts`.
6. Implement: nexus-filter gate in `src/strategies/ostax-tax-line.strategy.ts`.
7. Run `npm run check` — all tests + lint + typecheck + audit green.
8. Update README: new "Per-state nexus filter" subsection + table row.
9. Update CHANGELOG `[Unreleased]` → `[1.2.0]`.
10. SonarQube re-scan — confirm 0/0/0/0 + A/A/A.
11. Demo VM verify: WI vs MN order with `enabledStates: ['MN']`.
12. Commit, push, wait for CI green, tag v1.2.0, push tag, watch release.yml.
