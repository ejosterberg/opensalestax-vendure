# Stage 04 — Security review + SonarQube

> ~1 hour. OWASP-style code review of the alpha + SonarQube scan
> + dependency audit. Tax software handles PII and financial
> data — this stage is non-negotiable before any deployment.

## Manual OWASP review checklist

Walk through every checklist item against the v0.1.0 alpha
codebase. For each issue found, file it as a GitHub issue with
label `security` and severity tag (`severity-critical`,
`severity-high`, `severity-medium`, `severity-low`).

Note: this plugin has **no inbound HTTP surface** — it runs
in-process inside the merchant's Vendure server. That changes
the shape of several OWASP categories below; adaptations are
called out per row.

### A01: Broken access control

- [ ] The plugin trusts only options passed at `init(...)` time
  (merchant-authored `vendure-config.ts`) and `process.env`.
  No other configuration sources are read at runtime.
- [ ] The plugin does NOT add any inbound HTTP routes, REST
  endpoints, or GraphQL resolvers. Verify with
  `grep -rn 'Controller\|Resolver\|@Get\|@Post' src/` —
  zero matches.
- [ ] No "debug" / "test" endpoints exposed in production
  (search for `app.get(`, `app.post(`, etc.) — zero matches.

### A02: Cryptographic failures

- [ ] OST API tokens (if any) read from env vars / options,
  never logged
- [ ] No hardcoded keys / tokens anywhere
  (`grep -rn 'eyJ\|sk_\|pk_\|Bearer ' src/`)
- [ ] TLS verification not disabled on outbound calls to OST
  engine (no `rejectUnauthorized: false`,
  no `NODE_TLS_REJECT_UNAUTHORIZED=0` documentation)
- [ ] If `OSTAX_API_URL` is `http://` (plaintext), log a WARN at
  plugin init so the merchant sees it; allow it (local-dev
  case) but make it visible

### A03: Injection

- [ ] OST API requests use parameterized JSON bodies; no
  string concatenation of user input into URLs or payloads
- [ ] Log statements use structured logging (object args), not
  string interpolation with user-controlled fields
- [ ] No `eval`, `Function(...)`, `child_process.exec` with
  user input
- [ ] The strategy does NOT execute any merchant-supplied
  scripting (no `eval` of plugin options)

### A04: Insecure design

- [ ] Fail-soft default behavior documented and tested:
  engine 5xx → empty `TaxLine[]` + warn log
- [ ] Fail-hard mode (`OSTAX_FAIL_HARD=1` or
  `init({ failHard: true })`) throws cleanly; Vendure
  surfaces this as an order error
- [ ] Non-USD currency / non-US country short-circuits to
  empty response without calling OST engine (constitution §5)
- [ ] No silent failures: every catch logs context

### A05: Security misconfiguration

- [ ] The plugin does NOT open ports or modify Vendure's HTTP
  surface. Verify by review: zero references to `app.listen`,
  no NestJS `Controller`, no `@Post()` / `@Get()` decorators.
- [ ] No Dockerfile shipped (the plugin is an npm dep; the
  merchant runs Vendure in their own container) — confirm
  `ls Dockerfile docker-compose.yml 2>&1` shows "No such file"
- [ ] No `NODE_ENV=development` assumptions baked in
- [ ] Plugin does not write to the filesystem (no `fs.writeFile`
  in production paths) — log to stdout only

### A06: Vulnerable & outdated components

- [ ] `npm audit --production --audit-level=high` passes (from
  stage 03)
- [ ] `npm outdated` reviewed; no major-version stragglers on
  security-critical deps
- [ ] `@vendure/core` pinned as peerDep (not direct dep) so we
  inherit the merchant's hardened version
- [ ] CI workflow runs the audit on every PR

### A07: Identification & authentication failures

- [ ] **N/A** — the plugin exposes no authentication surface
  (no inbound HTTP, no JWT, no session tokens). The trust
  boundary is the merchant's Vendure process. Reason: Decision
  V locks the plugin in-process; there is nothing to
  authenticate against.

### A08: Software & data integrity failures

- [ ] `package-lock.json` committed
- [ ] CI runs `npm ci` (lockfile-strict), not `npm install`
- [ ] No `postinstall` scripts running arbitrary commands
- [ ] `npm publish` uses `--access public` explicitly (not
  default to private accidentally)
- [ ] `package.json` `files` field allowlists what gets shipped
  to NPM (no `src/`, no `tests/`, no `.env*`)

### A09: Security logging & monitoring failures

- [ ] Strategy invocations log
  `{event: 'calculate', currencyCode, country, line_count}` —
  but NOT customer addresses, line item descriptions, product
  names, customer email, or full order payloads
- [ ] Engine errors logged at ERROR with HTTP status + rtt_ms;
  no payload echo
- [ ] Logs go to Vendure's logger (which the merchant has
  already configured) — do NOT instantiate our own file
  logger
- [ ] Audit log capture: confirm a successful $100 MN run, then
  `grep` the log output for any of: street address, full ZIP+4,
  customer email, product name. Zero matches required.

### A10: Server-side request forgery

- [ ] `OSTAX_API_URL` validated as a URL at plugin init; no
  request-time interpolation of merchant-controlled or
  customer-controlled input into the URL
- [ ] No `javascript:` / `file:` / `data:` schemes accepted
  (URL parser rejects them by default; add an explicit
  scheme allowlist `['http:', 'https:']`)
- [ ] Outbound calls go only to the configured URL host; no
  redirect-following to other hosts (Node's `fetch` does NOT
  follow cross-origin redirects by default — verify in client)

## SonarQube scan

Per `~/.claude/sonarqube-playbook.md`:

```bash
# 1. Generate a scan token
TOKEN=$(curl -s -u "admin:TktCAD_Sonar_2026!" \
  -X POST "http://10.32.161.205:9000/api/user_tokens/generate" \
  -d "name=vendure-scan-$(date +%s)&type=GLOBAL_ANALYSIS_TOKEN" \
  | jq -r .token)

# 2. Create the project (one-time)
curl -s -u "admin:TktCAD_Sonar_2026!" \
  -X POST "http://10.32.161.205:9000/api/projects/create" \
  -d "project=opensalestax-vendure" \
  -d "name=opensalestax-vendure"
```

Create `sonar-project.properties` at repo root:

```properties
sonar.projectKey=opensalestax-vendure
sonar.projectName=opensalestax-vendure
sonar.projectVersion=0.1.0
sonar.sources=src
sonar.tests=tests
sonar.sourceEncoding=UTF-8
sonar.exclusions=**/node_modules/**,**/dist/**,**/coverage/**
sonar.test.inclusions=tests/**/*.test.ts
sonar.javascript.lcov.reportPaths=coverage/lcov.info
sonar.host.url=http://10.32.161.205:9000
sonar.typescript.tsconfigPath=tsconfig.json
```

Run the scan (LCOV report is generated by `npm test --
--coverage` in stage 03):

```bash
"/c/Users/ejosterberg/Documents/GITprojects/TicketsCADFixes/sonar-scanner-temp/sonar-scanner-6.2.1.4610-windows-x64/bin/sonar-scanner.bat" \
  -Dsonar.token=$TOKEN
```

Wait 2-5 minutes for processing. Pull results:

```bash
curl -s -u "admin:TktCAD_Sonar_2026!" \
  "http://10.32.161.205:9000/api/measures/component?component=opensalestax-vendure&metricKeys=bugs,vulnerabilities,code_smells,security_hotspots,reliability_rating,security_rating,sqale_rating,ncloc"
```

## SonarQube acceptance bar

For v1.0 release the SonarQube dashboard must show:

- **0 BLOCKER issues**
- **0 CRITICAL issues**
- **Security rating: A** (1.0)
- **Reliability rating: A or B**
- **0 unreviewed security hotspots** (every hotspot reviewed
  and marked Safe or Fixed)

For v0.1.0 alpha (just past stage 04), the bar relaxes to:

- 0 BLOCKER
- ≤3 CRITICAL with documented mitigation plans in
  `specs/security/audit-YYYY-MM-DD.md`
- Security rating A or B

If alpha can't hit the v1.0 bar, the iteration loop (stage 06)
exists to drive it there. Don't gate alpha on v1.0 perfection.

## Write the audit record

After the scan, create `specs/security/audit-2026-MM-DD.md`
capturing:

- Scan timestamp and SonarQube project URL
- Issue counts by severity
- The list of BLOCKER + CRITICAL findings, with for each:
  - Rule ID and category
  - File:line
  - Disposition (Fixed in commit `<sha>` / Deferred to v1.1
    with rationale / False positive — marked Won't Fix in
    SonarQube with reason)
- Manual review checklist items not green, with same
  disposition tags
- npm audit output
- Date and reviewer (Claude session ID + stage 04)

This file is appended-only across audits — never edit a prior
audit; create a new dated file for each scan.

## Acceptance for stage 04

Stage 04 is done when:

- [ ] All 10 OWASP checklist sections walked; findings filed
  as issues (A07 noted N/A with reason)
- [ ] SonarQube scan completed; results meet the alpha bar
  (BLOCKER=0; CRITICAL≤3 documented)
- [ ] `specs/security/audit-YYYY-MM-DD.md` committed
- [ ] All security hotspots reviewed
- [ ] Any new CVEs from `npm audit` triaged

Mark stage 04 complete in TodoWrite. Proceed to
`05-demo-deployment.md`.
