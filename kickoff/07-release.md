# Stage 07 — Release v1.0.0

> ~30 minutes. Tag, publish to NPM, announce. The mechanical
> end of the kickoff plan.

## Pre-release sanity checks

Before tagging, verify ONE more time:

```bash
cd C:/Users/ejosterberg/Documents/GITprojects/opensalestax-vendure
git status                           # clean tree
git log --oneline -5                 # last few commits look right
git remote -v                        # origin → github.com:ejosterberg/opensalestax-vendure.git
npm run check                        # green
gh run list --branch main --limit 1  # CI green on tip
```

If any of these fails, fix it before tagging (don't tag broken
code).

## Finalize CHANGELOG

Open `CHANGELOG.md`. The `[Unreleased]` section should hold
everything since the last tag (v0.1.0, presumably). Promote
it:

```md
## [1.0.0] - 2026-MM-DD

### Added
- Initial production release of OpenSalesTax connector as a
  Vendure plugin
- `OstaxTaxLineStrategy` implementing
  `TaxLineCalculationStrategy` from `@vendure/core`
- USD-only / US-only gating; non-US/non-USD orders fall back
  to Vendure's built-in `TaxRate` pipeline
- NPM distribution as `@ejosterberg/vendure-plugin-opensalestax`
- Configuration via `OpenSalesTaxPlugin.init({...})` options
  + env-var fallbacks
- ...

### Changed
- (anything that drifted from v0.1.0)

### Security
- SonarQube clean (0 BLOCKER, 0 CRITICAL; security rating A)
- OWASP review complete; audit at
  `specs/security/audit-YYYY-MM-DD.md`
- No inbound HTTP surface (constitution §7) — verified by
  grep audit at stage 04

[1.0.0]: https://github.com/ejosterberg/opensalestax-vendure/compare/v0.1.0...v1.0.0
[Unreleased]: https://github.com/ejosterberg/opensalestax-vendure/compare/v1.0.0...HEAD
```

Re-open a fresh `[Unreleased]` section above 1.0.0.

## Bump package.json

```bash
npm version 1.0.0 --no-git-tag-version
git add package.json package-lock.json CHANGELOG.md
git commit -s -m "chore: release v1.0.0"
git push
```

Wait for CI green on this commit.

## Tag and push

```bash
git tag -s v1.0.0 -m "v1.0.0 — first production release"
git push origin v1.0.0
```

The `-s` on `git tag` GPG-signs the tag. If GPG isn't set up,
fall back to `-a` (annotated, unsigned) and add a note in the
release body that signing will land in v1.0.1.

## Create the GitHub release

```bash
gh release create v1.0.0 \
  --title "v1.0.0 — OpenSalesTax for Vendure" \
  --notes-file - <<'EOF'
First production release of the OpenSalesTax connector for
Vendure as a `@VendurePlugin`.

## Highlights
- Destination-based US sales tax via merchant's self-hosted
  OpenSalesTax engine
- No third-party API keys, no per-transaction fees
- Apache-2.0; free to fork, free to ship
- Drop-in via `vendure-config.ts` — no separate server, no
  webhooks, no JWT to manage

## Quickstart
See `README.md` — `npm install
@ejosterberg/vendure-plugin-opensalestax`, paste init snippet
into `vendure-config.ts`, restart Vendure. ≤10 minutes to
first taxed order.

## What's in the box
- `OstaxTaxLineStrategy` implementing
  `TaxLineCalculationStrategy` from `@vendure/core`
- USD/US-only gating; graceful fallback for non-US carts via
  Vendure's built-in `TaxRate` pipeline
- Fail-soft default; fail-hard opt-in via env / plugin option
- `init()` health-check on boot so the merchant sees engine
  reachability problems at server-start

## Security
SonarQube clean (0 BLOCKER, 0 CRITICAL, A rating). OWASP A-list
review captured in `specs/security/`. No inbound HTTP surface
— trust boundary is the merchant's own Vendure process.
Reports welcome via `SECURITY.md`.

## Thanks
To the Vendure team for a clean strategy interface, and to the
OpenSalesTax engine project that does the actual math.
EOF
```

Verify in browser: `gh release view v1.0.0 --web`.

## Publish to NPM (primary distribution channel)

NPM is the merchant's install path — this is **not** optional
for v1.0 (Decision X in constitution).

```bash
# One-time setup if not already done
npm login                       # use ejosterberg account

# Verify package name is available
npm info @ejosterberg/vendure-plugin-opensalestax 2>&1 || echo "name free"

# Publish (must be --access public for scoped packages)
npm publish --access public
```

Verify on
`https://www.npmjs.com/package/@ejosterberg/vendure-plugin-opensalestax`.
A merchant should now be able to run `npm install
@ejosterberg/vendure-plugin-opensalestax` and get the
published artifact.

If `npm publish` fails (e.g., 2FA required, scope ownership
mismatch), stop and resolve — don't ship v1.0 without the NPM
artifact.

## Optional: Vendure Hub listing

Vendure maintains a curated community-plugin listing at
<https://vendure.io/hub>. Submission is manual / editorial
(not gated by automated review). The path:

- Open a PR or issue at the Vendure project (check
  <https://github.com/vendure-ecommerce/vendure>) following
  their contribution guidelines for Hub plugins
- Provide: GitHub repo URL, NPM package URL, short
  description, screenshots (if any), maintainer contact

This typically takes weeks; treat it as a v1.1 follow-up
unless Eric specifically wants it in v1.0. If deferred,
document in `specs/handoff.md`.

## Wrap-up tasks

Per START-HERE.md:

1. Update `specs/current-state.md`:
   - Move "v1.0.0 alpha plan" → "Shipped"
   - Record the GitHub release URL, tag, NPM package URL,
     demo VM details
   - Set "Last update" date
2. Update `specs/handoff.md` with v1.1 candidates:
   - Whatever was deferred from v1.0 ("`TaxZoneStrategy`",
     "Admin UI panel", "Vendure Hub listing", "per-state
     nexus filter", etc.)
   - Any merchant feedback received post-release
3. Archive the kickoff directory:
   ```bash
   git mv kickoff kickoff-archive
   git commit -s -m "chore: archive kickoff/ (v1.0 shipped)"
   git push
   ```
4. Final summary message back to Eric. Template:

> v1.0 shipped: `<release URL>`. NPM:
> `https://www.npmjs.com/package/@ejosterberg/vendure-plugin-opensalestax`.
> CI is green on `main`. Demo deployment lives on
> `vendure-demo` (VMID `<NNN>`, IP `<ip>`); $100 MN order
> returned `$<X>` tax via the plugin. SonarQube: 0 BLOCKER / 0
> CRITICAL / security rating A. `<N>` tests passing. Next: v1.1
> candidates queued in `specs/handoff.md` — top of the list is
> `<top deferred item>`.

## Acceptance for stage 07

Stage 07 is done when:

- [ ] `v1.0.0` tag exists on `origin/main`
- [ ] GitHub release `v1.0.0` published
- [ ] NPM package `@ejosterberg/vendure-plugin-opensalestax`
  published at version `1.0.0` with `--access public`
- [ ] CHANGELOG promoted; new `[Unreleased]` opened
- [ ] (Optional) Vendure Hub submission opened or deferral
  documented
- [ ] `specs/current-state.md` and `specs/handoff.md`
  reflect the shipped state
- [ ] `kickoff/` archived
- [ ] Summary message sent to Eric

Mark stage 07 complete in TodoWrite. **You are done.** The
kickoff plan has concluded.
