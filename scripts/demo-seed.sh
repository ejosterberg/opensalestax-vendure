#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
#
# Seeds the demo Vendure server with the minimum data needed to verify
# OpenSalesTaxPlugin works end-to-end:
#   - US Zone (with United States country)
#   - "Standard" TaxCategory
#   - Placeholder US Standard TaxRate (0%)
#   - Default channel set to USD currency + US tax zone
#   - One product variant priced $100 (10000 cents)
#   - Then places a test Shop API order with a MN ship-to address.
#
# Usage: bash demo-seed.sh
set -euo pipefail

BASE="${VENDURE_URL:-http://10.32.161.39:3000}"
ADMIN="${BASE}/admin-api"
SHOP="${BASE}/shop-api"

log() { echo "[seed] $*" >&2; }

# ---------- admin login ----------
log "logging in as superadmin"
ADMIN_TOKEN=$(curl -sS "${ADMIN}" -H "Content-Type: application/json" \
  -d '{"query":"mutation { login(username: \"superadmin\", password: \"superadmin\") { ... on CurrentUser { id } ... on ErrorResult { errorCode message } } }"}' \
  -i 2>&1 | grep -i 'vendure-auth-token:' | awk '{print $2}' | tr -d '\r\n')
if [ -z "$ADMIN_TOKEN" ]; then echo "ERR: no admin token captured"; exit 1; fi
log "admin token captured: ${ADMIN_TOKEN:0:12}..."

admin() {
  curl -sS "${ADMIN}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -d "$1"
}

# ---------- find US country id ----------
log "looking up United States country id"
US_COUNTRY_ID=$(admin '{"query":"{ countries { items { id code name enabled } } }"}' \
  | jq -r '.data.countries.items[] | select(.code=="US") | .id')
if [ -z "$US_COUNTRY_ID" ] || [ "$US_COUNTRY_ID" = "null" ]; then
  log "no US country found; creating one"
  US_COUNTRY_ID=$(admin '{"query":"mutation { createCountry(input: { code: \"US\", enabled: true, translations: [{ languageCode: en, name: \"United States of America\" }] }) { id } }"}' \
    | jq -r '.data.createCountry.id')
fi
log "US country id: ${US_COUNTRY_ID}"

# ---------- create US zone ----------
log "creating US zone"
US_ZONE_ID=$(admin '{"query":"{ zones { items { id name } } }"}' \
  | jq -r '.items[]? // empty | select(.name=="US") | .id' )
if [ -z "$US_ZONE_ID" ] || [ "$US_ZONE_ID" = "null" ]; then
  US_ZONE_ID=$(admin "{\"query\":\"mutation { createZone(input: { name: \\\"US\\\", memberIds: [\\\"${US_COUNTRY_ID}\\\"] }) { id } }\"}" \
    | jq -r '.data.createZone.id')
fi
log "US zone id: ${US_ZONE_ID}"

# ---------- ensure Standard tax category ----------
log "ensuring Standard tax category"
STD_TC_ID=$(admin '{"query":"{ taxCategories { items { id name } } }"}' \
  | jq -r '.data.taxCategories.items[] | select(.name=="Standard") | .id' | head -1)
if [ -z "$STD_TC_ID" ] || [ "$STD_TC_ID" = "null" ]; then
  STD_TC_ID=$(admin '{"query":"mutation { createTaxCategory(input: { name: \"Standard\" }) { id } }"}' \
    | jq -r '.data.createTaxCategory.id')
fi
log "Standard tax category id: ${STD_TC_ID}"

# ---------- placeholder US Standard 0% tax rate ----------
log "ensuring placeholder US Standard 0% tax rate"
US_RATE_EXISTS=$(admin '{"query":"{ taxRates { items { id name value } } }"}' \
  | jq -r '.data.taxRates.items[] | select(.name=="US Standard") | .id' | head -1)
if [ -z "$US_RATE_EXISTS" ] || [ "$US_RATE_EXISTS" = "null" ]; then
  admin "{\"query\":\"mutation { createTaxRate(input: { name: \\\"US Standard\\\", enabled: true, value: 0, categoryId: \\\"${STD_TC_ID}\\\", zoneId: \\\"${US_ZONE_ID}\\\" }) { id name value } }\"}" >/dev/null
fi

# ---------- set default channel currency + tax zone ----------
log "configuring default channel: currency=USD, defaultTaxZone=US"
DEFAULT_CHANNEL_ID=$(admin '{"query":"{ channels { items { id code defaultTaxZone { id name } } } }"}' \
  | jq -r '.data.channels.items[] | select(.code=="__default_channel__") | .id')
log "default channel id: ${DEFAULT_CHANNEL_ID}"
admin "{\"query\":\"mutation { updateChannel(input: { id: \\\"${DEFAULT_CHANNEL_ID}\\\", defaultCurrencyCode: USD, availableCurrencyCodes: [USD], defaultTaxZoneId: \\\"${US_ZONE_ID}\\\" }) { ... on Channel { id defaultCurrencyCode defaultTaxZone { name } } ... on ErrorResult { errorCode message } } }\"}" \
  | jq -c '.data.updateChannel'

# ---------- create test product + $100 variant ----------
log "creating test product Demo Item with \$100 variant"
PROD_ID=$(admin '{"query":"{ products { items { id name } } }"}' \
  | jq -r '.data.products.items[] | select(.name=="Demo Item") | .id' | head -1)
if [ -z "$PROD_ID" ] || [ "$PROD_ID" = "null" ]; then
  PROD_ID=$(admin '{"query":"mutation { createProduct(input: { translations: [{ languageCode: en, name: \"Demo Item\", slug: \"demo-item\", description: \"\" }] }) { id } }"}' \
    | jq -r '.data.createProduct.id')
fi
log "product id: ${PROD_ID}"

VARIANT_ID=$(admin '{"query":"{ productVariants(options: { take: 50 }) { items { id name sku } } }"}' \
  | jq -r '.data.productVariants.items[] | select(.sku=="demo-100") | .id' | head -1)
if [ -z "$VARIANT_ID" ] || [ "$VARIANT_ID" = "null" ]; then
  VARIANT_ID=$(admin "{\"query\":\"mutation { createProductVariants(input: [{ productId: \\\"${PROD_ID}\\\", sku: \\\"demo-100\\\", price: 10000, taxCategoryId: \\\"${STD_TC_ID}\\\", translations: [{ languageCode: en, name: \\\"Demo Item \\\\\$100\\\" }], stockOnHand: 9999, trackInventory: FALSE }]) { id sku price } }\"}" \
    | jq -r '.data.createProductVariants[0].id')
fi
log "variant id: ${VARIANT_ID}"

echo "${VARIANT_ID}" > /tmp/demo-variant-id
echo "[seed] DONE — variant id ${VARIANT_ID} written to /tmp/demo-variant-id"
