# Phase 02 — Task list

Atomic, ordered execution. Each task fits one focused work
block (15-60 min).

1. **ADR-004**: write `specs/decisions/004-implement-tax-zone-strategy.md`
   superseding ADR-002. Mark ADR-002's header with a
   "Superseded by ADR-004" banner (or update its status).

2. **TDD: write the unit test first.**
   Create `tests/unit/ostax-tax-zone.strategy.test.ts` with
   the 11 cases from `plan.md`. Tests fail (no impl yet).

3. **Implement** `src/strategies/ostax-tax-zone.strategy.ts`
   per the design in `plan.md`. Tests go green.

4. **Wire it into the plugin.** Update
   `src/opensalestax.plugin.ts`'s `configuration` callback to
   register the new strategy on
   `config.taxOptions.taxZoneStrategy`.

5. **Re-export** `OstaxTaxZoneStrategy` from `src/index.ts`.

6. **Update integration test.** Add the
   "taxZoneStrategy is OstaxTaxZoneStrategy" assertion to
   `tests/integration/plugin.test.ts`.

7. **README**: drop step 4 ("Configure a US tax zone") from
   the quickstart. Add a paragraph in "How it works"
   describing the auto-resolution behavior. Add a line in
   "Troubleshooting" about the one-shot WARN.

8. **CHANGELOG**: open v1.1.0 entry under `[Unreleased]`,
   document the new strategy + the README simplification, and
   note ADR-004 supersedes ADR-002.

9. **Quality gate**: `npm run check` green, including new tests.
   Coverage thresholds still met.

10. **SonarQube re-scan** (optional but ship-quality bar) —
    re-run scanner, confirm 0 BLOCKER / 0 CRITICAL / ratings A.

11. **Demo VM verification**:
    - `npm run build && npm pack`
    - `scp` the new tarball to vendure-demo
    - `npm install ./<tarball>` on the VM (or `npm link` for
      faster iteration)
    - Restart Vendure
    - Run `bash scripts/demo-place-order.sh 1` — must still
      return non-zero plausible MN tax
    - Bonus: place a non-US order to confirm fallback path

12. **Commit + push**. Conventional commit messages, DCO
    sign-off, no AI co-author trailers.

13. **Cut v1.1.0** (handled in a separate stage — verify Eric
    has Trusted Publisher configured first; tag push to fire
    `release.yml`).
