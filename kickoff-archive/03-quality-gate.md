# Stage 03 — Quality gate

> ~30 minutes. Verify the v0.1.0 alpha meets baseline quality
> before security review or deployment. This stage is a gate:
> nothing past this point starts until every check below is
> green on `main`.

## The four checks

Run each in order. Stop and fix on the first failure; don't
batch failures.

### 1. Tests

```bash
cd C:/Users/ejosterberg/Documents/GITprojects/opensalestax-vendure
npm test -- --coverage
```

Expect:

- 0 failures
- ≥10 tests
- Branch coverage ≥70% for `src/strategies/` and
  `src/lib/ostax-client.ts`
- Line coverage ≥80% overall

If coverage is short on a critical module, add tests — don't
lower the threshold.

### 2. Lint

```bash
npm run lint
```

ESLint config should extend `@typescript-eslint/recommended`
plus `prettier`. Expect 0 errors, 0 warnings.

If a warning is legitimately a false positive: add an
`// eslint-disable-next-line <rule> -- <reason>` comment with
the justification. Never blanket-disable a rule.

### 3. Type check

```bash
npm run typecheck    # alias for: tsc --noEmit
```

`tsconfig.json` must have:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true
  }
}
```

Expect 0 errors. If `any` was introduced anywhere, find it
(`grep -rn ': any\|<any>' src/`) and replace with a proper type
or `unknown` + narrowing.

### 4. Security audit

```bash
npm audit --production --audit-level=high
```

Expect "found 0 vulnerabilities". If high/critical CVEs surface:

- Bump the affected package to a patched version
- If no patch exists yet: pin to a safe range with
  `overrides` in `package.json`, and open a GitHub issue
  tracking the upstream fix
- Don't lower the audit threshold to make it pass

## Aggregate command

Add `npm run check` to `package.json` that runs all four:

```json
{
  "scripts": {
    "check": "npm run lint && npm run typecheck && npm test && npm audit --production --audit-level=high"
  }
}
```

The user (and CI, and `04-security-review.md`) all rely on
`npm run check` being the single command that gates merges.

## CI must agree

The CI workflow (`.github/workflows/ci.yml`, added in stage 02)
runs the same four checks. After `npm run check` is green
locally, push to `main` (or a topic branch) and confirm GitHub
Actions reports green within ~3 minutes.

If local passes but CI fails:

- Likely a node_modules vs `package-lock.json` drift — make sure
  `package-lock.json` is committed
- Or a path-case mismatch (Windows vs Linux); search for
  imports with wrong casing

## Manual smoke test

In addition to the automated gate, run a manual smoke before
moving on. Since this plugin has no HTTP endpoints to curl,
the smoke is a small Node script that instantiates the plugin
and confirms the strategy is wired:

```bash
# After `npm run build`:
cat > smoke.mjs <<'EOF'
import { OpenSalesTaxPlugin } from './dist/index.js';

const Plugin = OpenSalesTaxPlugin.init({
  apiUrl: 'http://10.32.161.126:8080',
  failHard: false,
});

// Verify the plugin class is constructable and exposes the strategy
console.log('Plugin name:', Plugin.name);
console.log('Options stashed:', Plugin.options);

// Verify the strategy implements the expected interface shape
import { OstaxTaxLineStrategy } from './dist/strategies/ostax-tax-line.strategy.js';
const strat = new OstaxTaxLineStrategy();
if (typeof strat.calculate !== 'function') {
  throw new Error('OstaxTaxLineStrategy missing calculate() method');
}
console.log('OK: strategy implements TaxLineCalculationStrategy contract');
EOF

node smoke.mjs
# Expected: "OK: strategy implements TaxLineCalculationStrategy contract"
rm smoke.mjs
```

If the script throws, fix and re-run before moving on.

## Acceptance for stage 03

Stage 03 is done when:

- [ ] `npm run check` passes locally
- [ ] Latest GitHub Actions run on `main` is green
- [ ] Smoke script asserts the strategy implements the
  expected interface
- [ ] Coverage thresholds met
- [ ] `package.json` has `lint`, `typecheck`, `test`, `check`,
  `build` scripts

Mark stage 03 complete in TodoWrite. Proceed to
`04-security-review.md`.
