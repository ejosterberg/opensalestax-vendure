#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0 OR GPL-2.0-or-later
#
# Places a $100 USD order against the demo Vendure server with a
# Minneapolis MN ship-to address, then prints the resulting taxLines
# from the OpenSalesTaxPlugin.
set -euo pipefail

BASE="${VENDURE_URL:-http://10.32.161.39:3000}"
SHOP="${BASE}/shop-api"
VARIANT_ID="${1:-1}"

shop() {
  local body="$1"
  local extra_headers=("${@:2}")
  curl -sS "${SHOP}" -H "Content-Type: application/json" \
    "${extra_headers[@]}" -d "$body"
}

# Add the variant to a fresh order (anonymous).
echo "[order] addItemToOrder variantId=${VARIANT_ID}"
ADD_BODY=$(cat <<EOF
{"query":"mutation Add(\$vid: ID!) { addItemToOrder(productVariantId: \$vid, quantity: 1) { ... on Order { id code totalWithTax lines { id quantity unitPrice unitPriceWithTax taxLines { description taxRate } } } ... on ErrorResult { errorCode message } } }","variables":{"vid":"${VARIANT_ID}"}}
EOF
)
ADD_RESP=$(shop "$ADD_BODY" -i)

# Capture the cookie jar so subsequent requests stay on this order.
SHOP_TOKEN=$(echo "$ADD_RESP" | grep -E "^vendure-auth-token:" | awk '{print $2}' | tr -d '\r\n')
echo "[order] shop token: ${SHOP_TOKEN:0:12}..."
echo "$ADD_RESP" | tail -1 | jq '.data'

AUTH=(-H "Authorization: Bearer ${SHOP_TOKEN}")

# Set the customer (anonymous shop API requires this before checkout fields).
echo "[order] setCustomerForOrder ejosterberg+demo@example.test"
shop '{"query":"mutation { setCustomerForOrder(input: { emailAddress: \"ejosterberg+demo@example.test\", firstName: \"Demo\", lastName: \"Customer\" }) { ... on Order { id customer { emailAddress } } ... on ErrorResult { errorCode message } } }"}' "${AUTH[@]}" | jq '.data'

# Set the MN ship-to address â€” this is the trigger that exercises the OST plugin.
echo "[order] setOrderShippingAddress 100 N 6th St, Minneapolis MN 55403 US"
shop '{"query":"mutation { setOrderShippingAddress(input: { streetLine1: \"100 N 6th St\", city: \"Minneapolis\", province: \"MN\", postalCode: \"55403\", countryCode: \"US\" }) { ... on Order { id totalWithTax lines { unitPrice unitPriceWithTax taxLines { description taxRate } } } ... on ErrorResult { errorCode message } } }"}' "${AUTH[@]}" | jq '.data'
