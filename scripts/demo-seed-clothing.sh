#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0 OR GPL-2.0-or-later
#
# Adds a "Clothing" TaxCategory + a clothing-priced ProductVariant to the
# already-seeded demo Vendure server. Idempotent.
#
# Usage: bash demo-seed-clothing.sh
set -euo pipefail
BASE="${VENDURE_URL:-http://10.32.161.39:3000}"
ADMIN="${BASE}/admin-api"

ADMIN_TOKEN=$(curl -sS "${ADMIN}" -H "Content-Type: application/json" \
  -d '{"query":"mutation { login(username: \"superadmin\", password: \"superadmin\") { ... on CurrentUser { id } } }"}' \
  -i 2>&1 | grep -E "^vendure-auth-token:" | awk '{print $2}' | tr -d '\r\n')

admin() {
  curl -sS "${ADMIN}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -d "$1"
}

# 1. Ensure Clothing TaxCategory exists
CLOTHING_TC_ID=$(admin '{"query":"{ taxCategories { items { id name } } }"}' \
  | jq -r '.data.taxCategories.items[] | select(.name=="Clothing") | .id' | head -1)
if [ -z "$CLOTHING_TC_ID" ] || [ "$CLOTHING_TC_ID" = "null" ]; then
  CLOTHING_TC_ID=$(admin '{"query":"mutation { createTaxCategory(input: { name: \"Clothing\" }) { id } }"}' \
    | jq -r '.data.createTaxCategory.id')
fi
echo "[seed] Clothing TaxCategory id: ${CLOTHING_TC_ID}"

# 2. Ensure US Standard placeholder rate exists for the Clothing category too
#    (so Vendure has *some* applicable TaxRate to pass to our strategy)
US_ZONE_ID=$(admin '{"query":"{ zones { items { id name } } }"}' \
  | jq -r '.data.zones.items[] | select(.name=="US") | .id' | head -1)
echo "[seed] US zone id: ${US_ZONE_ID}"
RATE_EXISTS=$(admin '{"query":"{ taxRates { items { id name category { name } } } }"}' \
  | jq -r '.data.taxRates.items[] | select(.name=="US Clothing") | .id' | head -1)
if [ -z "$RATE_EXISTS" ] || [ "$RATE_EXISTS" = "null" ]; then
  admin "$(jq -nc --arg cid "$CLOTHING_TC_ID" --arg zid "$US_ZONE_ID" '{
    query: "mutation Cr($cid: ID!, $zid: ID!) { createTaxRate(input: { name: \"US Clothing\", enabled: true, value: 0, categoryId: $cid, zoneId: $zid }) { id name } }",
    variables: { cid: $cid, zid: $zid }
  }')" | jq -c '.data.createTaxRate'
fi

# 3. Reuse the Demo Item product (id 1); add a clothing variant
PROD_ID=1
EXISTING=$(admin '{"query":"{ productVariants(options: { take: 50 }) { items { id sku } } }"}' \
  | jq -r '.data.productVariants.items[] | select(.sku=="demo-tshirt") | .id' | head -1)
if [ -z "$EXISTING" ] || [ "$EXISTING" = "null" ]; then
  VARIANT=$(admin "$(jq -nc --arg pid "$PROD_ID" --arg cid "$CLOTHING_TC_ID" '{
    query: "mutation Cr($pid: ID!, $cid: ID!) { createProductVariants(input: [{ productId: $pid, sku: \"demo-tshirt\", price: 5000, taxCategoryId: $cid, translations: [{ languageCode: en, name: \"Demo T-Shirt $50\" }], stockOnHand: 9999, trackInventory: FALSE }]) { id sku price taxCategory { name } } }",
    variables: { pid: $pid, cid: $cid }
  }')")
  echo "[seed] created clothing variant: $(echo "$VARIANT" | jq -c '.data.createProductVariants[0]')"
else
  echo "[seed] clothing variant already exists: ${EXISTING}"
fi

echo "[seed] DONE"
