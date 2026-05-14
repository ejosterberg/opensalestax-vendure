# Handoff — opensalestax-vendure

> **Read first if you're a fresh agent.** Constitution + current-state +
> this file are the canonical bring-up sequence.

## You are here — 2026-05-13 (v0.1.0 alpha shipped, v1.0.0 pending tag)

The Vendure plugin **alpha is shipped on GitHub**:
<https://github.com/ejosterberg/opensalestax-vendure/releases/tag/v0.1.0>.
Implementation is complete, all quality + security gates are
green, and an end-to-end demo on Proxmox VM 915
(`vendure-demo`, 10.32.161.39) confirmed a $100 MN order returns
correct per-jurisdiction tax through the full stack.

The remaining stage of the original kickoff is **stage 07**:
tag v1.0.0, push tag, create GitHub release, `npm publish
--access public`. After that the kickoff plan is concluded and
the v1.1 backlog opens.

## What's next — v1.0.0 release (stage 07 of `kickoff/`)

Atomic checklist (15-30 min total):

### 1. Sanity checks

- [ ] `git status` clean
- [ ] `npm run check` green locally
- [ ] `gh run list --branch main --limit 1` green
- [ ] CHANGELOG `[Unreleased]` is empty / has only post-v0.1.0
  internal items

### 2. Promote CHANGELOG `[0.1.0]` → `[1.0.0]`

The 0.1.0 entry already documents what's in the box. v1.0.0
is essentially "alpha promoted to stable after security review
+ demo verification" — no new features. Add a new section that
notes the promotion and links to the audit.

### 3. Bump version + commit

```
npm version 1.0.0 --no-git-tag-version
git add package.json package-lock.json CHANGELOG.md
git commit -s -m "chore: release v1.0.0"
git push
```

Wait for CI green on this commit.

### 4. Tag + push tag + GitHub release

```
git tag -s v1.0.0 -m "v1.0.0 — first production release"   # -a if no GPG
git push origin v1.0.0
gh release create v1.0.0 --title "..." --notes-file <(...)
```

### 5. NPM publish (Decision X — required, not optional)

```
npm login                                # if not already authed
npm info @ejosterberg/vendure-plugin-opensalestax || echo "name free"
npm publish --access public
```

Verify on
<https://www.npmjs.com/package/@ejosterberg/vendure-plugin-opensalestax>.

### 6. Wrap-up

- [ ] Update `specs/current-state.md` (move v1.0.0 → "Shipped")
- [ ] Update this `handoff.md` to point at the v1.1 backlog
- [ ] `git mv kickoff kickoff-archive` + commit
- [ ] Brief Eric: release URL, NPM URL, demo VM, summary numbers

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
