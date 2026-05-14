# ADR 003 — Defer Vendure Hub listing to v1.1

**Date:** 2026-05-13
**Status:** Accepted
**Context stage:** kickoff stage 06 (iteration loop, pre-v1.0)

## Decision

Skip submitting the plugin to the Vendure Hub
(<https://vendure.io/hub>) for the v1.0 release. Track Hub
submission as the top item on the v1.1 candidate list.

## Rationale

- Hub submission is **manual / editorial** — it's a PR or
  curated email exchange with the Vendure maintainers, not a
  one-command publish. Lead time is typically weeks.
- v1.0's gating success criteria are: NPM published, README
  walks merchants in ≤10 min, GitHub release live, demo
  deployment working. Hub presence is nice-to-have but not on
  the critical path.
- Merchants discover the plugin via NPM search + GitHub
  topics (`vendure-plugin`, `tax-provider`, `opensalestax`)
  immediately on publish; Hub adds discoverability later.
- The earlier sibling connectors (Medusa, WooCom) didn't
  require their respective platform's curated listing to
  reach early adopters either.

## Consequences

- Success criterion **D7** marked **Deferred to v1.1** in the
  tracker; **R4** same.
- v1.1 backlog (in `specs/handoff.md`): submit Hub PR with
  GitHub repo URL, NPM package URL, screenshots if any, and
  a concise description.
- Don't link to Hub from the README until the listing is
  approved.

## Verification

- README's "Quickstart" routes via `npm install` only — no
  references to Hub.
- `specs/handoff.md` has the Hub item at the top of the v1.1
  queue when shipping v1.0.
