#!/usr/bin/env bash
# WS2 round-5 smoke test — POST-DEPLOY verification script.
#
# Exercises the cancel / return / exchange / merchant PATCH / cron flows
# against a live API. Designed to be run against STAGING first; rerun
# against PRODUCTION after staging passes.
#
# Setup:
#   1. Set the env vars below.
#   2. Place 5 test orders manually beforehand (customer app) so the
#      OIDS are real. Edit the OID_* assignments at the top of "STAGE 1".
#   3. Make the script executable: chmod +x scripts/ws2-smoke-test.sh
#   4. Run: ./scripts/ws2-smoke-test.sh
#
# Each test prints PASS/FAIL with the HTTP status it got. Non-PASS rows
# require investigation before deployment proceeds.
#
# ─────────────────────────────────────────────────────────────────────

set -uo pipefail

# REQUIRED — fill in before running:
: "${API_URL:?must set API_URL (e.g. https://api-staging.pickatstore.app)}"
: "${CUSTOMER_TOKEN:?must set CUSTOMER_TOKEN (Supabase access_token from a test customer account)}"
: "${MERCHANT_TOKEN:?must set MERCHANT_TOKEN (Supabase access_token from a test merchant account)}"

# OPTIONAL — for endpoints that take an issue id (will be discovered from earlier responses):
ISSUE_ID="${ISSUE_ID:-}"

# ─────────────────────────────────────────────────────────────────────
# Helpers

PASS=0; FAIL=0

assert_status() {
    local label="$1" expected="$2" actual="$3" body="$4"
    if [[ "$actual" == "$expected" ]]; then
        echo "  ✓ PASS  $label  ($actual)"
        PASS=$((PASS+1))
    else
        echo "  ✗ FAIL  $label  (got $actual, want $expected)"
        echo "         body: $body"
        FAIL=$((FAIL+1))
    fi
}

req() {
    # req METHOD PATH BODY TOKEN
    local method="$1" path="$2" body="$3" token="$4"
    local tmp; tmp=$(mktemp)
    local code
    code=$(curl -sS -o "$tmp" -w "%{http_code}" -X "$method" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        --data "$body" \
        "$API_URL$path")
    local body_content; body_content=$(cat "$tmp"); rm -f "$tmp"
    echo "$code|$body_content"
}

# ─────────────────────────────────────────────────────────────────────
# STAGE 1 — Happy-path cancel
# Replace these with real test order ids before running.
OID_CANCEL_FREE=""        # PENDING, unpaid order (expect free cancel)
OID_CANCEL_LATE=""        # CONFIRMED, paid order >5min old (expect 5% fee)
OID_CANCEL_DINING=""      # CONFIRMED dine-in (expect full forfeit)
OID_CANCEL_REJECTED=""    # REJECTED order (expect 400 — terminal state)
OID_CANCEL_READY=""       # READY order (expect 400 — too late)
OID_CANCEL_CAS_RACE=""    # FRESH PENDING/CONFIRMED order — sacrificed for the parallel-cancel CAS race test
OID_RETURN_OK=""          # COMPLETED order, <24h, returnable (expect 201)
OID_RETURN_DAMAGED=""     # FRESH COMPLETED order, <24h — sacrificed for the damaged-no-photo gate test
OID_RETURN_LATE=""        # COMPLETED order, >24h (expect 400)
OID_EXCHANGE_OK=""        # COMPLETED order, <24h (expect 201)

if [[ -z "$OID_CANCEL_FREE" ]]; then
    echo "ERROR: edit this script and assign real test order ids to OID_* variables before running."
    exit 1
fi

echo "▸ STAGE 1 — Cancel happy path"

# 1a. Free cancel (unpaid PENDING)
out=$(req POST "/orders/$OID_CANCEL_FREE/cancel" "{}" "$CUSTOMER_TOKEN")
assert_status "cancel unpaid PENDING" 200 "${out%%|*}" "${out#*|}"

# 1b. Late cancel with 5% fee (paid CONFIRMED >5min)
out=$(req POST "/orders/$OID_CANCEL_LATE/cancel" "{}" "$CUSTOMER_TOKEN")
assert_status "cancel paid CONFIRMED (5% fee)" 200 "${out%%|*}" "${out#*|}"

# 1c. Dining no-refund
out=$(req POST "/orders/$OID_CANCEL_DINING/cancel" "{}" "$CUSTOMER_TOKEN")
assert_status "cancel paid dine-in (full forfeit)" 200 "${out%%|*}" "${out#*|}"

# 1d. REJECTED terminal block
out=$(req POST "/orders/$OID_CANCEL_REJECTED/cancel" "{}" "$CUSTOMER_TOKEN")
assert_status "cancel REJECTED — blocked" 400 "${out%%|*}" "${out#*|}"

# 1e. READY block (any-type)
out=$(req POST "/orders/$OID_CANCEL_READY/cancel" "{}" "$CUSTOMER_TOKEN")
assert_status "cancel READY — blocked" 400 "${out%%|*}" "${out#*|}"

echo
echo "▸ STAGE 2 — CAS / race protection"

# 2a. Double cancel (same FRESH order, parallel) — exactly one should succeed.
# The CAS-race test MUST use a fresh order id: reusing OID_CANCEL_LATE here
# would mean both calls hit the rules engine's already-cancelled terminal
# guard and both return 400, hiding any CAS regression.
echo "  Running 2× parallel cancel on $OID_CANCEL_CAS_RACE (expect 1× 200 + 1× {409|400})..."
tmp1=$(mktemp); tmp2=$(mktemp)
( curl -sS -o /dev/null -w "%{http_code}" -X POST \
    -H "Authorization: Bearer $CUSTOMER_TOKEN" -H "Content-Type: application/json" \
    --data "{}" "$API_URL/orders/$OID_CANCEL_CAS_RACE/cancel" > "$tmp1" ) &
PID1=$!
( curl -sS -o /dev/null -w "%{http_code}" -X POST \
    -H "Authorization: Bearer $CUSTOMER_TOKEN" -H "Content-Type: application/json" \
    --data "{}" "$API_URL/orders/$OID_CANCEL_CAS_RACE/cancel" > "$tmp2" ) &
PID2=$!
wait $PID1 $PID2
code1=$(cat "$tmp1"); code2=$(cat "$tmp2"); rm -f "$tmp1" "$tmp2"
# Sort the two codes so we can compare deterministically.
sorted=$(printf '%s\n%s\n' "$code1" "$code2" | sort | tr '\n' ' ')
case "$sorted" in
    "200 400 "|"200 409 ")
        echo "  ✓ PASS  parallel cancel race  ($code1 + $code2)"
        PASS=$((PASS+1))
        ;;
    *)
        echo "  ✗ FAIL  parallel cancel race  (got $code1 + $code2; want exactly one 200 + one {400|409})"
        FAIL=$((FAIL+1))
        ;;
esac

echo
echo "▸ STAGE 3 — Return + merchant decide"

# 3a. Customer files return
out=$(req POST "/orders/$OID_RETURN_OK/return" \
    '{"reason":"quality_issue","description":"item smelled off","refundInr":100,"photos":[]}' \
    "$CUSTOMER_TOKEN")
status="${out%%|*}"; body="${out#*|}"
assert_status "file return (quality_issue)" 201 "$status" "$body"
ISSUE_ID=$(echo "$body" | python3 -c "import sys,json;print(json.load(sys.stdin).get('issue',{}).get('id',''))" 2>/dev/null || true)
if [[ -z "$ISSUE_ID" ]]; then
    echo "  ! WARN  ISSUE_ID extraction failed (python3 missing or unexpected response) — skipping tests 3d + 3e"
fi

# 3b. Out-of-window return
out=$(req POST "/orders/$OID_RETURN_LATE/return" \
    '{"reason":"changed_mind","refundInr":50,"photos":[]}' \
    "$CUSTOMER_TOKEN")
assert_status "file return >24h — blocked" 400 "${out%%|*}" "${out#*|}"

# 3c. Damaged WITHOUT photo (server requires ≥1 photo for damaged).
# MUST use a fresh COMPLETED OID — OID_RETURN_OK was just flipped to
# RETURN_REQUESTED by 3a, so the rules engine returns 400 with a "not
# completed" reason instead of the photo-required reason and the test
# would silently false-positive.
out=$(req POST "/orders/$OID_RETURN_DAMAGED/return" \
    '{"reason":"damaged","refundInr":100,"photos":[]}' \
    "$CUSTOMER_TOKEN")
assert_status "damaged return w/o photo — blocked" 400 "${out%%|*}" "${out#*|}"

# 3d. Merchant approves the return
if [[ -n "$ISSUE_ID" ]]; then
    out=$(req PATCH "/orders/$OID_RETURN_OK/issue/$ISSUE_ID" \
        '{"decision":"APPROVED"}' \
        "$MERCHANT_TOKEN")
    assert_status "merchant approves return" 200 "${out%%|*}" "${out#*|}"

    # 3e. Re-approving the same issue (idempotency / CAS)
    out=$(req PATCH "/orders/$OID_RETURN_OK/issue/$ISSUE_ID" \
        '{"decision":"APPROVED"}' \
        "$MERCHANT_TOKEN")
    assert_status "re-approve issue — blocked" 400 "${out%%|*}" "${out#*|}"
fi

echo
echo "▸ STAGE 4 — Exchange"

# 4a. Customer files exchange
out=$(req POST "/orders/$OID_EXCHANGE_OK/exchange" \
    '{"reason":"wrong_size","description":"need M not L"}' \
    "$CUSTOMER_TOKEN")
assert_status "file exchange (wrong_size)" 201 "${out%%|*}" "${out#*|}"

echo
echo "▸ STAGE 5 — Auth"

# 5a. Unauthed call to /orders/:id/cancel
out=$(curl -sS -o /dev/null -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    --data "{}" \
    "$API_URL/orders/$OID_CANCEL_FREE/cancel")
assert_status "unauthed cancel — 401" 401 "$out" ""

# 5b. Unauthed call to PATCH /orders/:id/status (the now-protected legacy endpoint)
out=$(curl -sS -o /dev/null -w "%{http_code}" -X PATCH \
    -H "Content-Type: application/json" \
    --data '{"status":"PREPARING"}' \
    "$API_URL/orders/$OID_CANCEL_FREE/status")
assert_status "unauthed PATCH /status — 401" 401 "$out" ""

# 5c. Unauthed call to POST /orders/:id/refund
out=$(curl -sS -o /dev/null -w "%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    --data "{}" \
    "$API_URL/orders/$OID_CANCEL_FREE/refund")
assert_status "unauthed refund — 401" 401 "$out" ""

echo
echo "─────────────────────────────────────────"
echo "SUMMARY:  $PASS passed,  $FAIL failed"
echo "─────────────────────────────────────────"

if [[ $FAIL -gt 0 ]]; then exit 1; fi
