# Stage 00 — Pre-flight

> ~10 minutes. Read the canonical specs and verify your toolchain
> works. Skip nothing — every later stage assumes you understand
> the constraints captured here.

## Read these files in order

1. `../specs/constitution.md` — non-negotiable principles. If a
   later decision conflicts with constitution, the constitution
   wins.
2. `../specs/current-state.md` — what's shipped (nothing yet) +
   sibling-project map (other OST connectors).
3. `../specs/handoff.md` — 9-step v0.1.0 alpha task list. The
   anchor for stage 02.
4. `../specs/research/vendure-tax-plugin.md` — Vendure plugin +
   tax-strategy framework details. The anchor for everything
   Vendure-related.
5. `../CLAUDE.md` — project memory. Architectural anchors +
   file-layout sketch + "what NOT to do" list.

After reading, you should be able to answer:

- Why a plugin, not a standalone server? (Architecture Decision V,
  constitution §2 — Vendure invokes strategies in-process; no
  inbound HTTP surface needed)
- Why Apache-2.0 not LGPL/AGPL? (constitution §3 — matches engine
  + Python SDK + Medusa / Saleor; no OCA-style constraint on
  Vendure's path)
- What happens when a non-USD order arrives? (constitution §5 —
  return empty `TaxLine[]`; Vendure's built-in `TaxRate`
  fallback pipeline takes over)
- Where does auth verification live? (Constitution §7 — there
  IS no inbound auth surface; the plugin runs in the merchant's
  trusted process. Options come from
  `OpenSalesTaxPlugin.init(...)` + `process.env`.)
- Which Vendure interfaces does the plugin implement?
  (`TaxLineCalculationStrategy` required;
  `TaxZoneStrategy` optional — research §2/§3/§4)

If you can't, re-read.

## Verify toolchain

Run each of these. Note the version. If anything fails, fix it
before continuing (don't paper over).

```bash
node --version              # expect v20.x or later
npm --version               # expect 10.x+
git --version
gh --version
gh auth status              # expect "Logged in to github.com as ejosterberg"
docker --version
docker compose version
ssh proxmox-workshop 'echo ok'   # expect "ok" (Proxmox SSH)
curl -sS http://10.32.161.126:8080/v1/health | head    # OST engine
curl -sS -u admin:'TktCAD_Sonar_2026!' http://10.32.161.205:9000/api/system/status | head   # SonarQube
```

If the OST engine `/v1/health` is unreachable, stop and ask the
user — every later stage depends on it.

If SonarQube is down, you can defer stage 04's SonarQube scan
but should still run the manual review checklist. Note the
deferral in `success-criteria.md`'s tracker.

## Verify Vendure target major

Before writing code at stage 02, confirm the Vendure major you'll
target:

```bash
npm info @vendure/core version            # latest published
npm info @vendure/core dist-tags          # 'latest' tag
```

The constitution and research doc assume Vendure 3.x. If the
latest stable is now 4.x or later, re-read the
`TaxLineCalculationStrategy` reference in
<https://docs.vendure.io/reference/typescript-api/> for any API
changes before proceeding. Note the targeted major in a
`specs/decisions/001-vendure-target-major.md` ADR.

## Verify the repo state

You're working in `opensalestax-vendure/`. Confirm:

```bash
cd C:/Users/ejosterberg/Documents/GITprojects/opensalestax-vendure
git log --oneline -5         # should show the scaffold commit
git status                   # should be clean
git branch                   # one branch (main or master); confirm name
ls specs/                    # constitution.md, current-state.md, handoff.md, research/
ls kickoff/                  # this directory
```

If `git status` shows changes from a prior session, ask the user
before discarding.

## Open a TodoWrite list

Use the `TodoWrite` tool to create your initial task list now.
Suggested shape:

```
[
  {"content": "Stage 00 — Pre-flight (read specs, verify tools)",  "status": "in_progress"},
  {"content": "Stage 01 — Create GitHub repo + push scaffold",     "status": "pending"},
  {"content": "Stage 02 — Build v0.1.0 alpha (9-task handoff)",    "status": "pending"},
  {"content": "Stage 03 — Quality gate (tests, lint, audit)",      "status": "pending"},
  {"content": "Stage 04 — Security review + SonarQube",            "status": "pending"},
  {"content": "Stage 05 — Demo deployment on Proxmox VM",          "status": "pending"},
  {"content": "Stage 06 — Iteration loop until success criteria",  "status": "pending"},
  {"content": "Stage 07 — Release v1.0",                           "status": "pending"}
]
```

Update statuses as you go.

## Output

When stage 00 is done:

- All five docs read; you can summarize each in one sentence.
- Toolchain verified; versions noted in your scratch notes.
- Vendure target major confirmed (likely v3.x).
- Repo state confirmed.
- TodoWrite list initialized.

Proceed to `01-github-repo.md`.
