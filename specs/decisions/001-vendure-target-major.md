# ADR 001 — Target Vendure 3.x

**Date:** 2026-05-13
**Status:** Accepted
**Context stage:** kickoff stage 00 (pre-flight)

## Decision

Target Vendure **3.x** (latest stable on npm at session start: `3.6.3`).
Declare `@vendure/core` as a `peerDependencies` entry pinned to
`^3.0.0` so any merchant on Vendure 3.x can install the plugin
without resolution conflicts.

## Rationale

- The constitution (§2) and research doc both assume Vendure 3.x.
- `npm info @vendure/core dist-tags` shows `latest: 3.6.3`,
  `next: 3.1.0-next.4`, `master: 3.6.4-master-...`. There is no
  4.x release line yet.
- `TaxLineCalculationStrategy` and `TaxZoneStrategy` shapes
  documented in `specs/research/vendure-tax-plugin.md` are valid
  for the 3.x line.
- 3.x is the LTS/stable tag; merchants running production
  Vendure are on 3.x.

## Consequences

- `package.json` lists `@vendure/core` `^3.0.0` as a peerDep
  (not a direct dep) so the merchant's install picks up their
  pinned 3.x version.
- `@vendure/core` and `@vendure/testing` go into
  `devDependencies` at `^3.6.0` so local dev + CI can build
  against a known-good version.
- When Vendure 4.x ships, this ADR is superseded by a follow-up
  that documents any API drift in the strategy interfaces.
- README's compatibility matrix lists "Vendure 3.x" as the
  supported range.

## Verification

- `npm info @vendure/core version` returned `3.6.3` on
  2026-05-13.
- `peerDependencies` field in `package.json` reflects this on
  the v0.1.0 commit.
