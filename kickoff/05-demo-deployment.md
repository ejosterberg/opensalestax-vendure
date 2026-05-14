# Stage 05 — Demo deployment on Proxmox VM

> ~1-2 hours. Provision a Proxmox VM, run a real Vendure dev
> server + the OST engine, register the plugin via
> `vendure-config.ts`, place a real US-address order, and verify
> per-jurisdiction tax breakdown matches expectations.

This stage proves the plugin works in a realistic environment
before claiming v1.0.

## Provision the VM

Follow `~/.claude/proxmox-playbook.md`. Pick the next free VMID
in 900-999. Saleor's demo VM is likely to take 901, so this
project should default to **902** unless `qm list` shows it
taken.

```bash
ssh proxmox-workshop 'qm list'   # confirm 902 is free
```

```bash
ssh proxmox-workshop bash <<'PROVISION'
set -e
VMID=902
NAME=vendure-demo
MEM=8192
CORES=4
DISK=80
ISO=/var/lib/vz/template/iso/debian-13-genericcloud-amd64.qcow2

[ -f $ISO ] || wget -qO $ISO https://cloud.debian.org/images/cloud/trixie/latest/debian-13-genericcloud-amd64.qcow2

qm create $VMID \
  --name $NAME --memory $MEM --cores $CORES --cpu host \
  --net0 virtio,bridge=vmbr0 \
  --scsihw virtio-scsi-single \
  --serial0 socket --vga serial0 \
  --agent enabled=1 --ostype l26

qm importdisk $VMID $ISO vmpool
qm set $VMID --scsi0 vmpool:vm-$VMID-disk-0,discard=on,ssd=1
qm set $VMID --ide2 vmpool:cloudinit
qm set $VMID --boot order=scsi0
qm resize $VMID scsi0 ${DISK}G

qm set $VMID --ciuser ejosterberg
qm set $VMID --sshkeys /root/.ssh/authorized_keys
qm set $VMID --ipconfig0 ip=dhcp

qm start $VMID
PROVISION
```

After ~60s, discover the IP via `arp-scan` or `tcpdump` (see the
proxmox-playbook). Add an SSH alias to
`~/.ssh/config` on the Windows box:

```
Host vendure-demo
  HostName <discovered-ip>
  User ejosterberg
  IdentityFile ~/.ssh/proxmox_workshop
  IdentitiesOnly yes
  StrictHostKeyChecking accept-new
```

Verify: `ssh vendure-demo 'uname -a'` returns Debian 13 kernel.

## Install Node.js 20 + Docker on the VM

Vendure runs as a Node app; Docker hosts the OST engine + a
Postgres for Vendure.

```bash
ssh vendure-demo bash <<'PROVISION'
set -e
sudo apt-get update
sudo apt-get install -y curl git ca-certificates gnupg

# Node.js 20 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Docker (for OST engine + Postgres)
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/debian trixie stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker ejosterberg
PROVISION
```

Log out and back in so the docker group takes effect. Verify:
`node --version` (v20+) and `docker run --rm hello-world`.

## Stand up the OST engine

The merchant model has the engine running alongside Vendure on
the same host. Drop a small compose file:

```bash
ssh vendure-demo bash <<'OST'
set -e
mkdir -p ~/ost && cd ~/ost
cat > docker-compose.yml <<'EOF'
services:
  ost-engine:
    image: ghcr.io/ejosterberg/opensalestax:latest
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=postgres://ost:ost@ost-db:5432/ost
    depends_on: [ost-db]
  ost-db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=ost
      - POSTGRES_PASSWORD=ost
      - POSTGRES_DB=ost
    volumes:
      - ost-db:/var/lib/postgresql/data
volumes:
  ost-db:
EOF
docker compose up -d
OST
```

Wait for `curl http://<vm-ip>:8080/v1/health` to return
`{"ok": true, ...}`.

## Bootstrap a fresh Vendure project

Use Vendure's official starter (`@vendure/create` scaffolds a
new Vendure project with sqlite or Postgres):

```bash
ssh vendure-demo bash <<'VENDURE'
set -e
cd ~
npx --yes @vendure/create vendure-demo --use-npm
VENDURE
```

`@vendure/create` prompts for DB type (pick **sqlite** for the
demo — zero-config), and superadmin email (use
`ejosterberg@gmail.com`). It creates `~/vendure-demo/` with
`vendure-config.ts`, sample data, and an admin UI.

Boot the dev server (it auto-creates the DB and seeds sample
products):

```bash
ssh vendure-demo bash <<'BOOT'
cd ~/vendure-demo
npm run dev &   # backgrounds; check logs in another session
BOOT
```

Verify:

- Admin UI: `http://<vm-ip>:3000/admin` — log in with the
  superadmin credentials chosen above
- Shop GraphQL: `http://<vm-ip>:3000/shop-api`

If `npx @vendure/create` is unavailable or the template has
shifted, document the exact bootstrap commands you used in
`specs/decisions/00N-vendure-bootstrap.md`.

## Install the plugin into the Vendure project

The plugin is in the dev repo on the Windows box. Three ways to
install into the demo project (pick the simplest that works):

**Option A: install from local tarball** (recommended)

```bash
# On Windows:
cd C:/Users/ejosterberg/Documents/GITprojects/opensalestax-vendure
npm run build
npm pack
# produces ejosterberg-vendure-plugin-opensalestax-0.1.0.tgz

# Copy to the VM:
scp ejosterberg-vendure-plugin-opensalestax-0.1.0.tgz vendure-demo:~/vendure-demo/

# On the VM:
ssh vendure-demo
cd ~/vendure-demo
npm install ./ejosterberg-vendure-plugin-opensalestax-0.1.0.tgz
```

**Option B: install from a Git tag** (after v0.1.0 is pushed)

```bash
cd ~/vendure-demo
npm install github:ejosterberg/opensalestax-vendure#v0.1.0
```

**Option C: `npm link`** (only if iterating fast on plugin code)

```bash
# In the plugin repo:
npm link
# In the Vendure project:
npm link @ejosterberg/vendure-plugin-opensalestax
```

## Configure the plugin

Edit `~/vendure-demo/src/vendure-config.ts`:

```ts
import { OpenSalesTaxPlugin } from '@ejosterberg/vendure-plugin-opensalestax';

export const config: VendureConfig = {
  // ... (existing config) ...
  plugins: [
    // ... existing plugins ...
    OpenSalesTaxPlugin.init({
      apiUrl: 'http://<vm-ip>:8080',
      failHard: false,
    }),
  ],
};
```

Restart the Vendure dev server. Confirm the plugin's
`init()` hook logs a successful health-check against the OST
engine at boot.

## Configure a US tax zone in Vendure Admin

In the Admin UI (`http://<vm-ip>:3000/admin`):

1. Settings → Zones → Add a new Zone "US" with United States
   as the sole member country
2. Settings → Tax Categories → Confirm "Standard" exists (or
   create it)
3. Settings → Tax Rates → Create a placeholder rate
   "US Standard" of 0% in zone US category Standard. (OST
   provides the real rate via the strategy; this placeholder
   exists so Vendure's normal pipeline has something to fall
   back to.)
4. Settings → Channels → Default channel → Set default tax
   zone to "US"

## Configure a US ship-to address and place a test order

Via the Admin UI:

1. Catalog → Products → Pick an existing sample product, set
   price to $100 (10000 cents in Vendure's minor-units model)
2. Customers → Add a test customer with address
   `100 N 6th St, Minneapolis, MN 55403, US`

Via the Shop GraphQL playground at
`http://<vm-ip>:3000/shop-api`:

```graphql
mutation {
  addItemToOrder(productVariantId: "<variant-id>", quantity: 1) {
    ... on Order {
      id
      lines {
        unitPriceWithTax
        taxLines { description rate amount }
      }
      totalWithTax
    }
    ... on ErrorResult { errorCode message }
  }
}

mutation {
  setOrderShippingAddress(input: {
    streetLine1: "100 N 6th St"
    city: "Minneapolis"
    province: "MN"
    postalCode: "55403"
    countryCode: "US"
  }) {
    ... on Order { id totalWithTax lines { taxLines { description rate amount } } }
  }
}
```

Expected behavior:

- Vendure invokes `OstaxTaxLineStrategy.calculate()` for each
  order line
- The plugin gates: USD ✓, US ✓, ZIP `55403` ✓
- The plugin calls OST `/v1/calculate` for the MN address
- OST returns ~$7.875 in tax for $100 (Minneapolis combined
  rate: 8.025% in 2026 — actual value comes from the engine;
  the test confirms it's nonzero and within 7-9% of net)
- The order's `taxLines` array is populated with the OST
  breakdown; `totalWithTax` reflects the tax

If any step fails, drop into the Vendure logs
(`tail -f ~/vendure-demo/logs/*.log` or the dev-server
foreground output), identify the issue, and fix in code (this
kicks off the iteration loop, stage 06).

## Test the non-USD short-circuit

Either (a) switch the channel's currency to EUR via the Admin UI
and run the same mutation, or (b) create a new EUR channel:

- Strategy should return `[]`
- Vendure's normal `TaxRate` pipeline takes over (zero rate
  since we haven't configured EUR rates) → order has zero tax
- Plugin logs `{event: 'skip', reason: 'non-usd', currencyCode: 'EUR'}`

## Acceptance for stage 05

Stage 05 is done when:

- [ ] Proxmox VM `vendure-demo` (VMID 902 or next free) is up
  and reachable
- [ ] OST engine container running on the VM, `/v1/health` OK
- [ ] Vendure dev server running on the VM, admin UI + shop
  API reachable
- [ ] Plugin installed via local tarball / Git / npm link and
  configured in `vendure-config.ts`
- [ ] $100 MN order returns nonzero, plausible tax through
  the strategy (verified via Shop GraphQL response)
- [ ] EUR order returns empty `taxLines` (fallback path)
- [ ] Plugin logs are clean (no errors during the happy path;
  no PII in logs)
- [ ] VM IP + admin credentials documented in
  `specs/demo-deployment.md` (gitignored fields if any go to
  the user's password manager)

Mark stage 05 complete in TodoWrite. Proceed to
`06-iteration-loop.md`.
