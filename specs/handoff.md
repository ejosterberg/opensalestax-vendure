# Handoff — opensalestax-vendure

> **Read first if you're a fresh agent.** Constitution + current-state +
> this file are the canonical bring-up sequence.

## You are here — 2026-05-13 (v1.0.0 shipped, kickoff complete)

The Vendure plugin **v1.0.0 is shipped to GitHub + NPM**:
- GitHub: <https://github.com/ejosterberg/opensalestax-vendure/releases/tag/v1.0.0>
- NPM: <https://www.npmjs.com/package/@ejosterberg/vendure-plugin-opensalestax>

The original kickoff plan (stages 00-07) is complete. The
`kickoff/` directory has been archived to `kickoff-archive/`.

A `release.yml` GitHub Actions workflow is in place that runs
the full quality gate then publishes to NPM via OIDC + Sigstore
provenance whenever a `v*.*.*` tag is pushed. No manual `npm
publish` after v1.0.0 — see `~/.claude/projects/.../memory/`
for Eric's NPM publishing procedure (Phase 1 = manual bootstrap
done; Phase 2 = OIDC for every subsequent release).

## What's next — v1.1 backlog

Pick the top item that interests you (or that Eric names) and
follow the spec-kit pattern: draft `specs/phase-NN-<slug>/spec.md`
+ `plan.md` + `tasks.md`, implement TDD-style, run `npm run
check`, push, let `release.yml` cut the version when the tag
goes up.

## v1.1 candidate queue (priority order)

When v1.0 ships and a fresh session picks this up, work top-down:

1. **Vendure Hub listing submission** (per ADR-003) — open a
   PR or issue at the Vendure project requesting a curated
   listing entry. Provide: GitHub repo URL, NPM package URL,
   short description, screenshots if any, maintainer contact
   (`ejosterberg@gmail.com`). Lead time ~weeks.
2. **`TaxZoneStrategy` auto-resolver** (per ADR-002) — write
   `OstaxTaxZoneStrategy` that finds the merchant's US zone by
   inspecting `Zone.members[*].country.code === 'US'` and
   returns it for US orders, default zone otherwise. Eliminates
   the manual "configure US zone in Admin UI" step from the
   README quickstart.
3. **Per-product tax category mapping** — accept
   `categoryByProductTypeId` (or `categoryByTaxCategoryName`)
   in `init()` options so merchants can route specific products
   to OST's `clothing` / `groceries` / `prescription_drugs` /
   `prepared_food` / `digital_goods` categories instead of the
   v0.1 blanket `general`. Mirrors the Medusa connector's
   v0.x.x pattern.
4. **Per-state nexus filter** — `enabledStates: ['MN', 'WI', ...]`
   option that returns `[]` for states the merchant doesn't
   have nexus in. Today the plugin computes tax for every US
   ship-to ZIP. Mirrors the Odoo connector's v0.3.0 pattern.
5. **Request-scoped batch caching** — N order lines = N OST
   round-trips today. Hold a `WeakMap<RequestContext,
   Map<lineKey, CalculateResponse>>` keyed by request, collapse
   per-line calls to one batch per request. Net benefit: at
   typical 200ms RTT and a 5-line cart, drops 1000ms of
   per-checkout latency to 200ms.
6. **Embedded admin-UI panel** via Vendure UI extensions —
   "Test Connection" button that calls the OST `/v1/health`
   endpoint, plus a per-state-rate-lookup test screen.
7. **Operator telemetry** — counters: last successful calc
   timestamp, failure streak count, average latency, jurisdiction
   coverage. Surface via Vendure's job-queue events or a UI
   extension.
8. **GraphQL-typed strategy hooks** — Vendure auto-generates
   GraphQL types via codegen; add a generated baseline so
   downstream subclasses can extend with type safety.

## Standing rules

- Apache-2.0; DCO sign-off mandatory; no AI co-author trailers
- Constitution §5: USD-only; non-US / non-USD = empty `TaxLine[]`
  (Vendure default tax-rate pipeline takes over)
- Constitution §8: fail-soft default; fail-hard opt-in via env
  / plugin option
- Constitution §7: plugin trusts options from
  `OpenSalesTaxPlugin.init(...)` + `process.env`; no inbound
  auth surface to verify
- Run `npm run check` before every commit; CI gates the merge

## Pre-flight for a fresh session

1. `cat specs/constitution.md` — non-negotiables
2. `cat specs/current-state.md` — what's shipped
3. `cat specs/handoff.md` — this file
4. `git log --oneline -10`
5. `gh run list --branch main --limit 3`
6. Read most recent `specs/security/audit-*.md`
7. Pick up at the v1.1 item that interests you (or that Eric
   names) — most should already have a research note in
   `specs/research/` or be derivable from this file's queue
