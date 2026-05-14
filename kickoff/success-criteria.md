# Success criteria — what "near-perfect v1.0" means

> This file is the single canonical tracker for the kickoff
> plan's exit condition. Stage 06 (iteration loop) terminates
> when every "Open" item is moved to "Resolved" or "Deferred
> to v1.1 (with documented rationale)."
>
> Update this file after every meaningful fix during stage 06.

## Headline target

Anyone can `npm install @ejosterberg/vendure-plugin-opensalestax`,
paste the snippet into their `vendure-config.ts`, restart their
Vendure server, and have production-quality US sales tax
calculations flowing through their self-hosted OpenSalesTax
engine within 10 minutes — with zero known critical issues.

## Functional success criteria

| # | Criterion | Status |
|---|-----------|--------|
| F1 | Plugin instantiates and registers `TaxLineCalculationStrategy` without errors when loaded via `vendure-config.ts` | Open |
| F2 | Plugin loads cleanly in a fresh `@vendure/create` project (no peer-dep warnings; `npm run dev` starts Vendure successfully) | Open |
| F3 | `TaxLineCalculationStrategy.calculate()` round-trip: $100 MN order line returns correct per-line tax in <2s | Open |
| F4 | Multi-line order: each line gets its own OST call and correct per-line `TaxLine[]` | Open |
| F5 | Non-USD order: strategy returns `[]` (Vendure falls back to built-in `TaxRate` pipeline) | Open |
| F6 | Non-US shipping address: strategy returns `[]` | Open |
| F7 | Engine 5xx (default fail-soft): returns `[]`, logs warning, order proceeds | Open |
| F8 | Engine 5xx with `OSTAX_FAIL_HARD=1`: throws cleanly; Vendure surfaces as an order error | Open |
| F9 | Tax breakdown: per-jurisdiction rates surface in a way the merchant can audit (Vendure `TaxLine.description` carries the jurisdiction name from OST) | Open |

## Quality success criteria

| # | Criterion | Status |
|---|-----------|--------|
| Q1 | `npm run check` (lint + typecheck + test + audit) passes on `main` | Open |
| Q2 | Test coverage: ≥80% lines overall, ≥70% branches for strategy + client | Open |
| Q3 | CI green on `main` HEAD | Open |
| Q4 | No `any` types without inline justification comment | Open |
| Q5 | No `// @ts-ignore` without follow-up issue link | Open |
| Q6 | SPDX header on every source file | Open |
| Q7 | JSDoc on every exported function / class | Open |

## Security success criteria

| # | Criterion | Status |
|---|-----------|--------|
| S1 | OWASP A01-A10 manual review walked; findings filed (A07 marked N/A with documented reason) | Open |
| S2 | SonarQube: 0 BLOCKER issues | Open |
| S3 | SonarQube: 0 CRITICAL issues | Open |
| S4 | SonarQube: security rating A (1.0) | Open |
| S5 | SonarQube: 0 unreviewed security hotspots | Open |
| S6 | `npm audit --production --audit-level=high`: 0 vulnerabilities | Open |
| S7 | Plugin adds zero inbound HTTP routes (verified by `grep -rn 'Controller\|@Get\|@Post\|app.listen' src/` returning nothing) | Open |
| S8 | Order payloads do not appear in logs (no PII leak; verified by inspection of test-run log output — zero matches for street address, customer email, product name) | Open |
| S9 | `OSTAX_API_URL` validated at plugin init (URL parse + scheme allowlist `['http:', 'https:']`); fails fast on bad input | Open |
| S10 | `specs/security/audit-YYYY-MM-DD.md` committed | Open |

## Deployment success criteria

| # | Criterion | Status |
|---|-----------|--------|
| D1 | Demo Proxmox VM provisioned (vendure-demo, VMID 900-999) | Open |
| D2 | Vendure dev server running on the demo VM (admin UI + shop API both reachable) | Open |
| D3 | OST engine container running on the demo VM | Open |
| D4 | Plugin installed via local tarball / Git tag / `npm link` into the demo Vendure project | Open |
| D5 | Plugin configured in `vendure-config.ts` with the demo VM's OST URL | Open |
| D6 | Real $100 MN order returns nonzero plausible tax through the full stack (Shop GraphQL `addItemToOrder` → `setOrderShippingAddress` → `taxLines` populated) | Open |
| D7 | Vendure Hub listing submitted OR deferral to v1.1 documented in `specs/decisions/` | Open |

## Documentation success criteria

| # | Criterion | Status |
|---|-----------|--------|
| X1 | README walks a new merchant from `npm install` to first taxed order in ≤10 minutes | Open |
| X2 | README documents every env var + plugin option (name, purpose, default, example value) | Open |
| X3 | README has a "Troubleshooting" section covering: plugin doesn't register, engine unreachable, tax returns zero unexpectedly, fail-hard vs fail-soft | Open |
| X4 | CHANGELOG.md follows Keep-a-Changelog format; v0.1.0 → v1.0.0 entries complete | Open |
| X5 | SECURITY.md describes vulnerability reporting process | Open |
| X6 | CONTRIBUTING.md mandates DCO sign-off and Apache-2.0 license agreement | Open |
| X7 | `specs/constitution.md`, `specs/current-state.md`, `specs/handoff.md` all current | Open |

## Release success criteria

| # | Criterion | Status |
|---|-----------|--------|
| R1 | `v1.0.0` tag exists on origin/main | Open |
| R2 | GitHub release `v1.0.0` published with release notes | Open |
| R3 | NPM package `@ejosterberg/vendure-plugin-opensalestax@1.0.0` published with `--access public` (required, not optional — Decision X) | Open |
| R4 | Vendure Hub listing submitted OR deferral documented | Open |
| R5 | `kickoff/` archived | Open |
| R6 | Summary message sent to Eric | Open |

## Status legend

- **Open** — work needed; sitting in the stage 06 backlog
- **Resolved (commit `<sha>`)** — fixed and verified
- **Deferred to v1.1** — won't fix in this release;
  rationale in `specs/decisions/NNN-<slug>.md` and tracked
  in `specs/handoff.md`
- **N/A** — criterion not applicable to this release (rare;
  needs explicit justification)

## Stage 06 exit condition

When every row above is either Resolved, Deferred-to-v1.1, or
N/A: the iteration loop is complete. Proceed to stage 07.

If any row remains Open after a reasonable iteration attempt
and the path forward isn't clear, pause and ask Eric — see
`06-iteration-loop.md` "When to ask the user."
