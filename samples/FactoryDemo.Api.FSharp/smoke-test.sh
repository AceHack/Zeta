#!/usr/bin/env bash
# Factory-demo F# API smoke test — exercises all 9 endpoints and validates
# the JSON-shape contract. Exits 0 on pass, 1 on any failure.
#
# Usage:
#   bash samples/FactoryDemo.Api.FSharp/smoke-test.sh
#
# Starts the API on a random free port, waits for /, hits each endpoint,
# verifies response shape + key invariants (row counts, duplicate-pair
# identity, funnel totals). Stops the API cleanly on exit.
#
# Dependencies on host: dotnet, curl, jq. A C# sibling API (sibling
# PR #147) will land its own parallel smoke-test so parity between
# the two APIs is ground-truth-testable.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT="$SCRIPT_DIR/FactoryDemo.Api.FSharp.fsproj"

for cmd in dotnet curl jq; do
    if ! command -v "$cmd" >/dev/null; then
        echo "Missing required tool: $cmd" >&2
        exit 2
    fi
done

# Pick a high random port to avoid clashes with other dev services.
PORT=$(( 5100 + RANDOM % 400 ))
URL="http://localhost:${PORT}"

echo "Building API..."
dotnet build "$PROJECT" -c Release --nologo -v quiet >/dev/null
echo "Starting API on ${URL}..."

dotnet run --project "$PROJECT" -c Release --no-build --urls "$URL" \
    > /tmp/factory-demo-api-fsharp.log 2>&1 &
API_PID=$!

cleanup() {
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
}
trap cleanup EXIT

for _ in {1..20}; do
    if curl -sf "${URL}/" >/dev/null 2>&1; then
        break
    fi
    sleep 0.5
done

if ! curl -sf "${URL}/" >/dev/null 2>&1; then
    echo "API did not come up within budget. Log:" >&2
    cat /tmp/factory-demo-api-fsharp.log >&2
    exit 1
fi

fail=0
check() {
    local label="$1"
    local path="$2"
    local jq_expr="$3"
    local expected="$4"
    local actual
    actual=$(curl -sf "${URL}${path}" | jq -r "$jq_expr" 2>/dev/null || echo "ERROR")
    if [ "$actual" = "$expected" ]; then
        printf "  OK   %-50s (%s)\n" "$label" "$actual"
    else
        printf "  FAIL %-50s expected=%s got=%s\n" "$label" "$expected" "$actual"
        fail=1
    fi
}

echo ""
echo "Factory-demo F# API smoke test"
echo "=============================="

# Root metadata — F# anonymous-record fields declared lowercase emit
# lowercase JSON property names. Same as the C# sibling after
# System.Text.Json default camelCasing. The `(.Name // .name | ...)`
# jq pattern below is tolerant either way, which keeps the parity
# test resilient if field-casing conventions drift between the two
# APIs in the future.
check "root.name contains 'Factory-demo'"     "/"  "(.Name // .name | test(\"Factory-demo\"))"  "true"

check "/api/customers length"                 "/api/customers"       ". | length"  "20"
check "/api/opportunities length"             "/api/opportunities"   ". | length"  "30"
check "/api/activities length"                "/api/activities"      ". | length"  "33"

check "customer #1 name"                      "/api/customers/1"     "(.Name // .name)"  "Alice Plumbing LLC"
check "opportunity #1 stage"                  "/api/opportunities/1" "(.Stage // .stage)"  "Lead"

check "customer #1 activities count"          "/api/customers/1/activities"  ". | length"  "4"

# Pipeline funnel — per-stage counts. F# emits PascalCase; jq handles both.
check "funnel Lead count"      "/api/pipeline/funnel"  "[.[] | select((.Stage // .stage)==\"Lead\")].[0] | (.Count // .count)"       "10"
check "funnel Qualified count" "/api/pipeline/funnel"  "[.[] | select((.Stage // .stage)==\"Qualified\")].[0] | (.Count // .count)"  "6"
check "funnel Won count"       "/api/pipeline/funnel"  "[.[] | select((.Stage // .stage)==\"Won\")].[0] | (.Count // .count)"        "6"
check "funnel Lost count"      "/api/pipeline/funnel"  "[.[] | select((.Stage // .stage)==\"Lost\")].[0] | (.Count // .count)"       "2"

check "funnel Lead totalCents" "/api/pipeline/funnel"  "[.[] | select((.Stage // .stage)==\"Lead\")].[0] | (.TotalCents // .totalCents)"  "5400000"
check "funnel Won totalCents"  "/api/pipeline/funnel"  "[.[] | select((.Stage // .stage)==\"Won\")].[0] | (.TotalCents // .totalCents)"   "2670000"

check "duplicate pairs count"              "/api/pipeline/duplicates"  ". | length"  "2"
check "alice@acme.example pair members"    "/api/pipeline/duplicates"  "[.[] | select((.Email // .email)==\"alice@acme.example\")].[0] | (.CustomerIds // .customerIds) | join(\",\")"  "1,13"
check "bob@trades.example pair members"    "/api/pipeline/duplicates"  "[.[] | select((.Email // .email)==\"bob@trades.example\")].[0] | (.CustomerIds // .customerIds) | join(\",\")"  "5,19"

# 404 behavior
status=$(curl -o /dev/null -s -w "%{http_code}" "${URL}/api/customers/999")
if [ "$status" = "404" ]; then
    printf "  OK   %-50s (%s)\n" "missing customer HTTP status" "404"
else
    printf "  FAIL %-50s expected=404 got=%s\n" "missing customer HTTP status" "$status"
    fail=1
fi

echo ""
if [ "$fail" -eq 0 ]; then
    echo "All checks passed."
    exit 0
else
    echo "One or more checks failed — see /tmp/factory-demo-api-fsharp.log for server output."
    exit 1
fi
