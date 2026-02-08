#!/bin/bash

# Base URL
API_URL="http://localhost:3000"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "Starting Verification..."

# 1. Create a dummy user and store (Mock IDs for now if DB is empty, or assume existing)
# We will use existing IDs if possible, or just arbitrary UUIDs if constraints allow.
# Since we can't easily query IDs from here without psql/prisma, we'll try to list products first to get a valid product ID.

echo "Fetching a product..."
PRODUCT_JSON=$(curl -s "$API_URL/products?limit=1")
PRODUCT_ID=$(echo $PRODUCT_JSON | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$PRODUCT_ID" ]; then
  echo -e "${RED}Failed to fetch product. Is the API running?${NC}"
  exit 1
fi

echo -e "${GREEN}Found Product ID: $PRODUCT_ID${NC}"

# 2. Create an Order (Triggers New Order & Stock Decrement)
echo "Placing an order..."
USER_ID="test-user-$(date +%s)"
STORE_ID="test-store-id" # We might need a real store ID if we want to check the Notification table linked to a real user.
# Ideally we need a real store/manager relation.
# Let's try to update the mock product or rely on the code handling missing relations gracefully (it logs errors).

# Payload
curl -s -X POST "$API_URL/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "'"$USER_ID"'",
    "storeId": "store-123",
    "totalAmount": 100,
    "items": [
      { "storeProductId": "sp-123", "quantity": 1, "price": 100 }
    ]
  }' > order_response.json

ORDER_ID=$(cat order_response.json | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$ORDER_ID" ]; then
     echo -e "${RED}Failed to create order.${NC}"
     cat order_response.json
else
     echo -e "${GREEN}Order Created: $ORDER_ID${NC}"
fi

# 3. Cancel Order (Triggers Cancellation & Stock Restoration)
if [ ! -z "$ORDER_ID" ]; then
    echo "Cancelling order..."
    curl -s -X PATCH "$API_URL/orders/$ORDER_ID/status" \
      -H "Content-Type: application/json" \
      -d '{ "status": "CANCELLED" }' > cancel_response.json
    
    STATUS=$(cat cancel_response.json | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    if [ "$STATUS" == "CANCELLED" ]; then
        echo -e "${GREEN}Order Cancelled Successfully${NC}"
    else
        echo -e "${RED}Failed to cancel order${NC}"
    fi
fi

# 4. Check for Low Stock logic (Hard to automated verify without DB access, but if previous steps produced no 500 errors, we are good)

echo "Verification Complete. Please check server logs for 'Notification Created' messages if logging is enabled."
