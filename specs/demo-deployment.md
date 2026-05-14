# Demo deployment — opensalestax-vendure

**Date:** 2026-05-13
**Status:** running

## VM facts

| Field | Value |
|-------|-------|
| Proxmox host | pmvm1 (10.32.161.114) |
| VMID | **915** |
| Name | `vendure-demo` |
| OS | Debian 13 (trixie) genericcloud |
| CPU / RAM / Disk | 4 cores / 8192 MB / 80 GB |
| Network | DHCP on `vmbr0` |
| Assigned IPv4 | **10.32.161.39** |
| SSH | `ssh vendure-demo` (alias added to `~/.ssh/config`, key `~/.ssh/id_ed25519`) |
| Linux user | `ejosterberg` (passwordless sudo via `/etc/sudoers.d/ejosterberg`) |

## What's running

| Service | Port | Notes |
|---------|------|-------|
| Vendure dev server (`ts-node ./src/index.ts`) | 3000 | sqlite (`vendure.sqlite`); admin API at `/admin-api`, shop API at `/shop-api` |
| OST engine | n/a (remote) | Pointed at the shared engine `http://10.32.161.126:8080` (constitution permits any reachable instance) |

Logs: `/tmp/vendure.log` on the VM. The plugin emits at boot:

```
warn [OpenSalesTaxPlugin] OSTAX_API_URL is plaintext (http://). Use https:// in production.
info [OpenSalesTaxPlugin] OpenSalesTax engine reachable: status=ok version=0.55.4 db=true
```

## Vendure project layout

```
~/vendure-demo/
├── package.json              # @vendure/core ^3.6.3, ts-node, better-sqlite3,
│                              # @ejosterberg/vendure-plugin-opensalestax (from local tarball)
├── tsconfig.json
├── vendure.sqlite            # demo DB; gitignored equivalent
└── src/
    ├── index.ts              # bootstrap(config)
    └── vendure-config.ts     # loads OpenSalesTaxPlugin.init({...})
```

The plugin is installed from a local tarball (option A in stage-05 doc):

```
scp ejosterberg-vendure-plugin-opensalestax-0.1.0.tgz vendure-demo:~/vendure-demo/
ssh vendure-demo 'cd ~/vendure-demo && npm install ./ejosterberg-vendure-plugin-opensalestax-0.1.0.tgz'
```

## Seed data

`scripts/demo-seed.sh` runs idempotent admin-API mutations to set up:

- US `Country` (`code: US`)
- US `Zone` (member: US country)
- "Standard" `TaxCategory`
- "US Standard" placeholder `TaxRate` (0% in US zone, Standard category) so
  Vendure's default pipeline always has a fallback
- Default channel: `defaultCurrencyCode: USD`, `availableCurrencyCodes: [USD]`,
  `defaultTaxZoneId` → US
- "Demo Item" `Product` with one variant (sku `demo-100`, price 10000 cents)
  in the Standard tax category

## Verification — $100 MN order

Run via `scripts/demo-place-order.sh 1`:

- `addItemToOrder(productVariantId: 1, quantity: 1)` →
  `unitPrice: 10000`, `unitPriceWithTax: 10000` (no tax yet — no ship-to)
- `setCustomerForOrder(...)` → captures customer
- `setOrderShippingAddress({ streetLine1: "100 N 6th St", city: "Minneapolis",
  province: "MN", postalCode: "55403", countryCode: "US" })` →

```
unitPriceWithTax: 10903     (= $109.03; tax = $9.03 on $100 net)
totalWithTax:     10903
taxLines: [
  { description: "Minneapolis (City)",                        taxRate: 0.5 },
  { description: "Hennepin County (County)",                  taxRate: 0.15 },
  { description: "Minnesota (State)",                         taxRate: 6.875 },
  { description: "Hennepin County Transit Sales Tax (District)", taxRate: 0.5 },
  { description: "Metro Area Transportation Sales Tax (District)", taxRate: 0.75 },
  { description: "Metro Area Sales and Use Tax for Housing (District)", taxRate: 0.25 }
]
```

Sum of rates: **9.025%**. Math checks out: 10000 × 0.09025 = 902.5 → rounded
to 903 cents → `unitPriceWithTax = 10903`. Vendure handled the rounding;
our plugin only supplied the rates.

This satisfies success criteria **F3** ($100 MN order returns correct per-line
tax), **F9** (per-jurisdiction rates surface in TaxLine.description), and
**D1–D6** (full demo deployment).

## Negative paths

- **Non-USD / non-US** gating verified by unit tests
  (`tests/unit/ostax-tax-line.strategy.test.ts`). Not re-verified on the
  demo VM since adding a second currency / second-country test setup is
  significant overhead and the unit-level coverage is comprehensive.
- **Fail-soft / fail-hard** verified by unit tests. Stage 06 may add a
  demo-VM verification by setting `OSTAX_API_URL` to a black-hole and
  observing the warning + zero-tax fallback (and then `OSTAX_FAIL_HARD=1`
  observing the surfaced error).

## Running the demo from scratch

After the VM is provisioned (one-time) and Vendure is running:

```bash
# from repo root on the dev box:
npm run build
npm pack
scp ejosterberg-vendure-plugin-opensalestax-0.1.0.tgz vendure-demo:~/vendure-demo/
ssh vendure-demo 'cd ~/vendure-demo && npm install ./ejosterberg-vendure-plugin-opensalestax-0.1.0.tgz'
ssh vendure-demo 'pkill -f ts-node; cd ~/vendure-demo && nohup npm run dev > /tmp/vendure.log 2>&1 < /dev/null & disown'

# wait for the server, then place a test order:
bash scripts/demo-place-order.sh 1
```

## Credentials

Superadmin: `superadmin` / `superadmin` (Vendure default; this is a demo
VM only — change in any non-demo deployment).

## Tear-down

When the demo is no longer needed:

```bash
ssh proxmox-workshop 'qm stop 915 && qm destroy 915 --purge 1 --destroy-unreferenced-disks 1'
```

(Don't run that without checking with Eric — destructive.)
