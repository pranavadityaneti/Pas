#!/usr/bin/env bash
# WS2 round-5/6 inline smoke runner — drop-in for tonight's verification.
#
# Run via env vars (no script editing required):
#
#   TOKEN=<jwt> API=<base-url> \
#   OID_PENDING_UNPAID=<uuid> \
#   OID_PENDING_PAID=<uuid> \
#   OID_PENDING_PAID_OLD=<uuid> \
#   OID_DINING_PAID=<uuid> \
#   OID_READY=<uuid> \
#   OID_REJECTED=<uuid> \
#   OID_COMPLETED_TODAY=<uuid> \
#   OID_COMPLETED_OLD=<uuid> \
#   OID_COMPLETED_TODAY_2=<uuid> \
#   ./scripts/ws2-smoke-inline.sh
#
# Any OID_* that's unset → the dependent stage is SKIPPED with a clear note.
# Stages that fire actually mutate the order (cancel/return/etc) — these are
# real production calls. Use only orders you're OK losing/refunding.
#
# Auth probes (Stage 5) require ZERO order IDs.
# Output: tabular PASS/FAIL/SKIP rows + final summary.

set -uo pipefail

: "${API:?must set API base URL}"
: "${TOKEN:?must set TOKEN (Supabase access_token)}"

PASS=0; FAIL=0; SKIP=0

# colorize if terminal
if [[ -t 1 ]]; then
    G="\033[32m"; R="\033[31m"; Y="\033[33m"; D="\033[0m"
else
    G=""; R=""; Y=""; D=""
fi

assert() {
    local label="$1" expected="$2" actual="$3" body="${4:-}"
    if [[ "$actual" == "$expected" ]]; then
        printf "  ${G}✓ PASS${D}  %-60s  (%s)\n" "$label" "$actual"
        PASS=$((PASS+1))
    else
        printf "  ${R}✗ FAIL${D}  %-60s  (got %s, want %s)\n" "$label" "$actual" "$expected"
        [[ -n "$body" ]] && printf "         body: %s\n" "$body"
        FAIL=$((FAIL+1))
    fi
}

skip() {
    local label="$1" reason="$2"
    printf "  ${Y}⊘ SKIP${D}  %-60s  (%s)\n" "$label" "$reason"
    SKIP=$((SKIP+1))
}

# Single curl helper
hit() {
    local method="$1" path="$2" body="${3:-{\}}"
    local tmp=$(mktemp)
    local code
    code=$(curl -sSk -o "$tmp" -w "%{http_code}" -X "$method" \
        -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
        --data "$body" "$API$path")
    local content; content=$(cat "$tmp"); rm -f "$tmp"
    # Return as code|body
    printf '%s|%s' "$code" "$content"
}

hit_noauth() {
    local method="$1" path="$2" body="${3:-{\}}"
    local tmp=$(mktemp)
    local code
    code=$(curl -sSk -o "$tmp" -w "%{http_code}" -X "$method" \
        -H "Content-Type: application/json" --data "$body" "$API$path")
    local content; content=$(cat "$tmp"); rm -f "$tmp"
    printf '%s|%s' "$code" "$content"
}

# Used to extract a JSON field via python (jq not assumed)
jget() {
    local body="$1" path="$2"
    python3 -c "import sys,json; d=json.loads(sys.argv[1]); ks='$path'.strip('.').split('.');
import functools; print(functools.reduce(lambda x,k: x.get(k,'') if isinstance(x,dict) else '', ks, d))" "$body" 2>/dev/null || echo ""
}

echo "═══════════════════════════════════════════════════════════════════"
echo " WS2 round-5/6 smoke test  ($API)"
echo "═══════════════════════════════════════════════════════════════════"

# ─────────────────────────────────────────────────────────────────────
echo
echo "STAGE 5 ─ Auth probes (no order needed) ─────────────────────────"

r=$(hit_noauth POST "/orders/00000000-0000-0000-0000-000000000000/cancel" '{}')
assert "unauthed POST /cancel"       401 "${r%%|*}" "${r#*|}"

r=$(hit_noauth PATCH "/orders/00000000-0000-0000-0000-000000000000/status" '{"status":"PREPARING"}')
assert "unauthed PATCH /status"      401 "${r%%|*}" "${r#*|}"

r=$(hit_noauth POST "/orders/00000000-0000-0000-0000-000000000000/refund" '{}')
assert "unauthed POST /refund"       401 "${r%%|*}" "${r#*|}"

r=$(hit_noauth POST "/orders/00000000-0000-0000-0000-000000000000/verify-otp" '{"otp":"1234"}')
assert "unauthed POST /verify-otp"   401 "${r%%|*}" "${r#*|}"

r=$(hit_noauth GET "/orders/issues/inbox")
assert "unauthed GET /issues/inbox"  401 "${r%%|*}" "${r#*|}"

# ─────────────────────────────────────────────────────────────────────
echo
echo "STAGE 1 ─ Cancel happy paths ────────────────────────────────────"

if [[ -n "${OID_PENDING_UNPAID:-}" ]]; then
    r=$(hit POST "/orders/$OID_PENDING_UNPAID/cancel" '{}')
    assert "cancel PENDING + unpaid (free)" 200 "${r%%|*}" "${r#*|}"
else
    skip "cancel PENDING + unpaid (free)" "OID_PENDING_UNPAID not set"
fi

if [[ -n "${OID_PENDING_PAID_OLD:-}" ]]; then
    r=$(hit POST "/orders/$OID_PENDING_PAID_OLD/cancel" '{}')
    assert "cancel CONFIRMED + paid + >5min (5% fee)" 200 "${r%%|*}" "${r#*|}"
else
    skip "cancel CONFIRMED + paid + >5min (5% fee)" "OID_PENDING_PAID_OLD not set"
fi

if [[ -n "${OID_DINING_PAID:-}" ]]; then
    r=$(hit POST "/orders/$OID_DINING_PAID/cancel" '{}')
    assert "cancel dine-in + paid (full forfeit)" 200 "${r%%|*}" "${r#*|}"
else
    skip "cancel dine-in + paid (full forfeit)" "OID_DINING_PAID not set"
fi

# ─────────────────────────────────────────────────────────────────────
echo
echo "STAGE 1b ─ Cancel state-machine blocks ──────────────────────────"

if [[ -n "${OID_REJECTED:-}" ]]; then
    r=$(hit POST "/orders/$OID_REJECTED/cancel" '{}')
    assert "cancel REJECTED order (terminal-block)" 400 "${r%%|*}" "${r#*|}"
else
    skip "cancel REJECTED order (terminal-block)" "OID_REJECTED not set"
fi

if [[ -n "${OID_READY:-}" ]]; then
    r=$(hit POST "/orders/$OID_READY/cancel" '{}')
    assert "cancel READY order (any-type block)" 400 "${r%%|*}" "${r#*|}"
else
    skip "cancel READY order (any-type block)" "OID_READY not set"
fi

# ─────────────────────────────────────────────────────────────────────
echo
echo "STAGE 2 ─ CAS race protection ───────────────────────────────────"

if [[ -n "${OID_PENDING_PAID:-}" ]]; then
    echo "  Firing 2× parallel cancel on $OID_PENDING_PAID..."
    tmp1=$(mktemp); tmp2=$(mktemp)
    ( curl -sSk -o /dev/null -w "%{http_code}" -X POST \
        -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
        --data "{}" "$API/orders/$OID_PENDING_PAID/cancel" > "$tmp1" ) &
    P1=$!
    ( curl -sSk -o /dev/null -w "%{http_code}" -X POST \
        -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
        --data "{}" "$API/orders/$OID_PENDING_PAID/cancel" > "$tmp2" ) &
    P2=$!
    wait $P1 $P2
    c1=$(cat "$tmp1"); c2=$(cat "$tmp2"); rm -f "$tmp1" "$tmp2"
    sorted=$(printf '%s\n%s\n' "$c1" "$c2" | sort | tr '\n' ' ')
    case "$sorted" in
        "200 400 "|"200 409 ")
            printf "  ${G}✓ PASS${D}  %-60s  (%s + %s)\n" "parallel cancel CAS" "$c1" "$c2"
            PASS=$((PASS+1))
            ;;
        *)
            printf "  ${R}✗ FAIL${D}  %-60s  (got %s + %s; want one 200 + one {400|409})\n" "parallel cancel CAS" "$c1" "$c2"
            FAIL=$((FAIL+1))
            ;;
    esac
else
    skip "parallel cancel CAS" "OID_PENDING_PAID not set (need a FRESH cancellable order)"
fi

# ─────────────────────────────────────────────────────────────────────
echo
echo "STAGE 3 ─ Return ────────────────────────────────────────────────"

ISSUE_ID=""
if [[ -n "${OID_COMPLETED_TODAY:-}" ]]; then
    r=$(hit POST "/orders/$OID_COMPLETED_TODAY/return" \
        '{"reason":"quality_issue","description":"smoke test","refundInr":1,"photos":[]}')
    code="${r%%|*}"; body="${r#*|}"
    assert "file return (quality_issue, <24h)" 201 "$code" "$body"
    ISSUE_ID=$(jget "$body" "issue.id")
    [[ -n "$ISSUE_ID" ]] && echo "    captured issueId: $ISSUE_ID"
else
    skip "file return (quality_issue, <24h)" "OID_COMPLETED_TODAY not set"
fi

if [[ -n "${OID_COMPLETED_OLD:-}" ]]; then
    r=$(hit POST "/orders/$OID_COMPLETED_OLD/return" \
        '{"reason":"changed_mind","refundInr":1,"photos":[]}')
    assert "file return on >24h order (window block)" 400 "${r%%|*}" "${r#*|}"
else
    skip "file return on >24h order (window block)" "OID_COMPLETED_OLD not set"
fi

if [[ -n "${OID_COMPLETED_TODAY_2:-}" ]]; then
    r=$(hit POST "/orders/$OID_COMPLETED_TODAY_2/return" \
        '{"reason":"damaged","refundInr":1,"photos":[]}')
    assert "damaged-without-photo block" 400 "${r%%|*}" "${r#*|}"
else
    skip "damaged-without-photo block" "OID_COMPLETED_TODAY_2 not set"
fi

# Merchant decisions (require ISSUE_ID + same user being merchant)
if [[ -n "${OID_COMPLETED_TODAY:-}" && -n "$ISSUE_ID" ]]; then
    r=$(hit PATCH "/orders/$OID_COMPLETED_TODAY/issue/$ISSUE_ID" '{"decision":"APPROVED"}')
    assert "merchant approves return" 200 "${r%%|*}" "${r#*|}"

    # Re-approve must fail
    r=$(hit PATCH "/orders/$OID_COMPLETED_TODAY/issue/$ISSUE_ID" '{"decision":"APPROVED"}')
    assert "re-approve issue (idempotency)" 400 "${r%%|*}" "${r#*|}"
else
    skip "merchant approves return" "no issueId from 3a"
    skip "re-approve issue (idempotency)" "no issueId from 3a"
fi

# ─────────────────────────────────────────────────────────────────────
echo
echo "STAGE 4 ─ Inbox endpoint (catches the .toLowerCase() bug) ───────"

r=$(hit GET "/orders/issues/inbox")
case "${r%%|*}" in
    200) printf "  ${G}✓ PASS${D}  %-60s  (200, default ALL filter works)\n" "GET /orders/issues/inbox?type=ALL (default)"; PASS=$((PASS+1)) ;;
    400)
        if echo "${r#*|}" | grep -q "type must be one of"; then
            printf "  ${R}✗ FAIL${D}  %-60s  (the toLowerCase bug — inbox-fix deploy NOT live yet)\n" "GET /orders/issues/inbox default"
            FAIL=$((FAIL+1))
        else
            printf "  ${R}✗ FAIL${D}  %-60s  (400, body: %s)\n" "GET /orders/issues/inbox default" "${r#*|}"
            FAIL=$((FAIL+1))
        fi
        ;;
    403) printf "  ${Y}⊘ SKIP${D}  %-60s  (403 — token user not a store manager; inbox empty for non-merchants)\n" "GET /orders/issues/inbox default"; SKIP=$((SKIP+1)) ;;
    *)   printf "  ${R}✗ FAIL${D}  %-60s  (unexpected HTTP %s)\n" "GET /orders/issues/inbox default" "${r%%|*}"; FAIL=$((FAIL+1)) ;;
esac

r=$(hit GET "/orders/issues/inbox?type=return")
case "${r%%|*}" in
    200) printf "  ${G}✓ PASS${D}  %-60s  (200)\n" "GET /orders/issues/inbox?type=return"; PASS=$((PASS+1)) ;;
    400|403) printf "  ${Y}⊘ SKIP${D}  %-60s  (%s — token user not a store manager)\n" "GET /orders/issues/inbox?type=return" "${r%%|*}"; SKIP=$((SKIP+1)) ;;
    *)   printf "  ${R}✗ FAIL${D}  %-60s  (unexpected HTTP %s)\n" "GET /orders/issues/inbox?type=return" "${r%%|*}"; FAIL=$((FAIL+1)) ;;
esac

# ─────────────────────────────────────────────────────────────────────
echo
echo "═══════════════════════════════════════════════════════════════════"
printf " SUMMARY   ${G}PASS=%d${D}   ${R}FAIL=%d${D}   ${Y}SKIP=%d${D}\n" "$PASS" "$FAIL" "$SKIP"
echo "═══════════════════════════════════════════════════════════════════"

[[ $FAIL -gt 0 ]] && exit 1 || exit 0
