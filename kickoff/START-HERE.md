# START HERE — Vendure plugin kickoff

> **You are a fresh Claude session.** Your job: take this repo from
> "specs scaffolded, no code" to "production-grade v1.0 Vendure
> plugin on the OpenSalesTax engine — released, security-reviewed,
> demo-deployed, near-zero outstanding issues." This file is your
> entry point.

## The kickoff prompt (verbatim)

When invoking a new Claude session in this repo, paste this prompt:

> Read `kickoff/START-HERE.md` and execute the full kickoff plan:
> stages 00 → 07. Drive each stage to completion, run the iteration
> loop at stage 06 until the success criteria in
> `kickoff/success-criteria.md` are met, and ship v1.0 to GitHub +
> NPM. Use `ScheduleWakeup` to pace CI verification waits.
> Confirm stop conditions with the user only when:
> (a) a destructive operation needs explicit consent
> (creating a public repo, force-pushing, deleting a VM),
> (b) a key architectural decision was not pre-locked in
> `specs/constitution.md`, or
> (c) the iteration loop terminates with unresolved blocker(s).

## How to use this directory

The kickoff is sequenced. Read and execute each numbered file in
order. Each one is short and self-contained.

| Stage | File | What it does |
|---|---|---|
| 00 | `00-pre-flight.md` | Read constitution / current-state / handoff / research; verify env (git, gh, docker, node 20+) |
| 01 | `01-github-repo.md` | Create the GitHub repo via `gh`; push the existing local branch |
| 02 | `02-build-alpha.md` | Implement v0.1.0 alpha per the 9-task list in `specs/handoff.md` |
| 03 | `03-quality-gate.md` | Run tests + lint + type check + npm audit; gate must be green before continuing |
| 04 | `04-security-review.md` | OWASP-style code review + SonarQube scan + dependency audit |
| 05 | `05-demo-deployment.md` | Provision a Proxmox VM, run a Vendure dev server + OST engine, register the plugin, run a real order |
| 06 | `06-iteration-loop.md` | Iterate: fix issues from stages 03/04/05; re-run gates; repeat until `success-criteria.md` met |
| 07 | `07-release.md` | Tag v1.0.0, push tag, create GitHub release, publish to NPM |

## Success criteria (the target)

See `success-criteria.md` for the concrete definition of
"near-perfect." Headline summary:

- **All quality gates green** — tests, lint, type check, security
  audit pass on `main`
- **SonarQube** — 0 BLOCKER issues, 0 CRITICAL issues, security
  rating A
- **Demo install works end-to-end** — fresh Vendure dev server,
  fresh OST engine, plugin loaded via `vendure-config.ts`, place a
  $100 order to a MN ZIP, see correct per-jurisdiction tax on the
  order lines
- **README walks a new merchant from zero to live in ≤10 minutes**
- **CHANGELOG documents v0.1 → v1.0 with migration notes for each
  breaking change**
- **GitHub release v1.0.0 published**
- **NPM package `@ejosterberg/vendure-plugin-opensalestax`
  published with `--access public`**

## What's pre-locked vs open

**Pre-locked** (in `specs/constitution.md`):

- License: Apache-2.0
- Architecture: Vendure plugin via `@VendurePlugin` +
  `TaxLineCalculationStrategy` — pure in-process (Decision V)
- Distribution: NPM as
  `@ejosterberg/vendure-plugin-opensalestax`; merchant
  self-hosted (Decision X)
- USD/US-only; non-USD/non-US returns empty `TaxLine[]`
  (Vendure's built-in `TaxRate` pipeline takes over)
- No inbound auth surface — trust boundary is merchant's
  Vendure process (constitution §7)
- Fail-soft default; fail-hard opt-in via env / plugin option

**Open** (decide as you go, document in `specs/decisions/`):

- Ship `TaxZoneStrategy` in v1.0 or defer to v1.1?
- Vendure Hub listing submission in this cycle or queue for
  v1.1?
- Per-line vs request-scoped batch of OST calls in v1.0?
- Embedded admin-UI panel in v1.0 or v1.1?

For each open question: write a short ADR in
`specs/decisions/NNN-<slug>.md` when you decide, commit it, and
move on. Don't block the session waiting for Eric.

## Standing rules from Eric's global config

These come from `~/.claude/CLAUDE.md` (the user's machine-wide
instructions). Re-stating here because they govern this session:

- DCO sign-off on every commit (`git commit -s`)
- No AI co-author trailers in commit messages
- Apache-2.0 default for project code
- TDD: write/update tests before declaring work done
- Security review: every PR / feature gets the
  `04-security-review.md` checklist before merge
- Confirm with user before destructive operations (only;
  routine PRs and tags are fine)
- Username on any Linux account: `ejosterberg` (never `eric`)
- Default git host: GitHub (`gh` CLI logged in as
  `ejosterberg`)

## Infrastructure available to you (no setup needed)

These are pre-configured on the user's machine — your session
inherits them automatically:

- **Proxmox host `pmvm1`** at `10.32.161.114`, alias
  `proxmox-workshop`. Use VM ID range 900-999 for demo VMs.
  Playbook: `~/.claude/proxmox-playbook.md`.
- **SonarQube** at `http://10.32.161.205:9000`. Admin login
  in `~/.claude/sonarqube-playbook.md`. Scanner CLI at
  `C:/Users/ejosterberg/Documents/GITprojects/TicketsCADFixes/sonar-scanner-temp/`.
- **OpenSalesTax engine** at `http://10.32.161.126:8080`. Same
  engine the other connectors point at. v0.54.1+ confirmed.
- **GitHub** via `gh` CLI, logged in as `ejosterberg`.

## When you finish

1. Tag v1.0.0, create the release.
2. Update `specs/current-state.md` to reflect shipped state.
3. Update `specs/handoff.md` to describe what a v1.1 starter
   session should pick up.
4. Move `kickoff/` to `kickoff-archive/` (or delete) — its job
   is done.
5. Open a short summary message back to Eric: "v1.0 shipped at
   [release URL]. [N] tests passing. [M] SonarQube issues
   resolved. Demo deployed at [VM IP]. Next: v1.1 candidates in
   `specs/handoff.md`."
