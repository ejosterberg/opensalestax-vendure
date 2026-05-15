#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
#
# Same as demo-place-order.sh but ships to Milwaukee WI to test the
# nexus filter. With enabledStates: ['MN'] configured, this order
# should return empty taxLines.
set -euo pipefail
BASE="${VENDURE_URL:-http://10.32.161.39:3000}"
SHOP="${BASE}/shop-api"
VARIANT_ID="${1:-1}"

shop() {
  local body="$1"
  local extra_headers=("${@:2}")
  curl -sS "${SHOP}" -H "Content-Type: application/json" "${extra_headers[@]}" -d "$body"
}

echo "[order-wi] addItemToOrder variantId=${VARIANT_ID}"
ADD_BODY=$(cat <<EOF
{"query":"mutation Add(\$vid: ID!) { addItemToOrder(productVariantId: \$vid, quantity: 1) { ... on Order { id code } ... on ErrorResult { errorCode message } } }","variables":{"vid":"${VARIANT_ID}"}}
EOF
)
ADD_RESP=$(shop "$ADD_BODY" -i)
SHOP_TOKEN=$(echo "$ADD_RESP" | grep -E "^vendure-auth-token:" | awk '{print $2}' | tr -d '\r\n')
AUTH=(-H "Authorization: Bearer ${SHOP_TOKEN}")

shop '{"query":"mutation { setCustomerForOrder(input: { emailAddress: \"wi-demo@example.test\", firstName: \"WI\", lastName: \"Demo\" }) { ... on Order { id } ... on ErrorResult { errorCode message } } }"}' "${AUTH[@]}" > /dev/null

echo "[order-wi] setOrderShippingAddress 200 E Wells St, Milwaukee WI 53202 US"
shop '{"query":"mutation { setOrderShippingAddress(input: { streetLine1: \"200 E Wells St\", city: \"Milwaukee\", province: \"WI\", postalCode: \"53202\", countryCode: \"US\" }) { ... on Order { id totalWithTax lines { unitPrice unitPriceWithTax taxLines { description taxRate } } } ... on ErrorResult { errorCode message } } }"}' "${AUTH[@]}" | jq '.data'
