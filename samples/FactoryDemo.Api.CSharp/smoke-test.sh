#!/usr/bin/env bash
# Factory-demo C# API smoke test — exercises all 9 endpoints (`/` plus
# the 8 `/api/*` routes) and validates the JSON-shape contract. Exits 0
# on pass, 1 on any failure.
#
# Usage:
#   bash samples/FactoryDemo.Api.CSharp/smoke-test.sh
#
# Starts the API on a random free port, waits for /, hits each endpoint,
# verifies response shape + key invariants (row counts, duplicate-pair
# identity, funnel totals). Stops the API cleanly on exit.
#
# Dependencies on host: dotnet, curl, jq. All common dev tools; the demo
# does not ask for anything exotic.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT="$SCRIPT_DIR/FactoryDemo.Api.CSharp.csproj"

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

# Per-run server log — mktemp avoids collisions across concurrent smoke-test
# runs and writes into the host's system temp dir (honouring `$TMPDIR` when
# set, falling back to `/tmp`). The path is printed on both failure and
# success so the log is always discoverable.
#
# mktemp portability: GNU (Linux) and BSD (macOS) have incompatible
# invocations. GNU accepts `--tmpdir <template>` and XXXXXX mid-template;
# BSD (macOS) requires `XXXXXX` to be the TAIL of the template and
# rejects `--tmpdir` outright. Template `factory-demo-api-csharp.XXXXXX`
# with XXXXXX at the end works on both; the `.log` extension is added
# after the rename (portable since every POSIX shell has `mv`).
TMP_BASE="${TMPDIR:-/tmp}"
# Strip trailing slash so the join doesn't produce `//` that some tools
# mishandle (harmless but uglies up the diagnostic path).
TMP_BASE="${TMP_BASE%/}"
_LOG_TMP=$(mktemp "${TMP_BASE}/factory-demo-api-csharp.XXXXXX")
LOG_FILE="${_LOG_TMP}.log"
mv "${_LOG_TMP}" "${LOG_FILE}"
echo "Starting API on ${URL} (server log: ${LOG_FILE})..."

# Run in background; capture PID so we can stop it on exit.
dotnet run --project "$PROJECT" -c Release --no-build --urls "$URL" \
    > "$LOG_FILE" 2>&1 &
API_PID=$!

cleanup() {
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
}
trap cleanup EXIT

# Wait for API to accept requests. Bounded — 20 attempts * 0.5s = 10s budget.
for _ in {1..20}; do
    if curl -sf "${URL}/" >/dev/null 2>&1; then
        break
    fi
    sleep 0.5
done

if ! curl -sf "${URL}/" >/dev/null 2>&1; then
    echo "API did not come up within budget. Server log at ${LOG_FILE}:" >&2
    cat "$LOG_FILE" >&2
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
echo "Factory-demo C# API smoke test"
echo "=============================="

# Root metadata
check "root.name contains 'Factory-demo'"   "/"  "(.name | test(\"Factory-demo\"))"  "true"
check "root.version"                          "/"  ".version"                                "0.0.1"
check "root.endpoints length"                 "/"  ".endpoints | length"                     "9"

# Collection counts
check "/api/customers length"                 "/api/customers"       ". | length"  "20"
check "/api/opportunities length"             "/api/opportunities"   ". | length"  "30"
check "/api/activities length"                "/api/activities"      ". | length"  "33"

# Single-item lookup
check "customer #1 name"                      "/api/customers/1"     ".name"       "Alice Plumbing LLC"
check "opportunity #1 stage"                  "/api/opportunities/1" ".stage"      "Lead"

# Per-customer activities
check "customer #1 activities count"          "/api/customers/1/activities"  ". | length"  "4"

# Pipeline funnel — per-stage counts
check "funnel Lead count"      "/api/pipeline/funnel"  "[.[] | select(.stage==\"Lead\")].[0].count"       "10"
check "funnel Qualified count" "/api/pipeline/funnel"  "[.[] | select(.stage==\"Qualified\")].[0].count"  "6"
check "funnel Won count"       "/api/pipeline/funnel"  "[.[] | select(.stage==\"Won\")].[0].count"        "6"
check "funnel Lost count"      "/api/pipeline/funnel"  "[.[] | select(.stage==\"Lost\")].[0].count"       "2"

# Pipeline funnel — totals in cents
check "funnel Lead totalCents"      "/api/pipeline/funnel"  "[.[] | select(.stage==\"Lead\")].[0].totalCents"  "5400000"
check "funnel Won totalCents"       "/api/pipeline/funnel"  "[.[] | select(.stage==\"Won\")].[0].totalCents"   "2670000"

# Duplicates
check "duplicate pairs count"              "/api/pipeline/duplicates"  ". | length"                                                "2"
check "alice@acme.example pair members"    "/api/pipeline/duplicates"  "[.[] | select(.email==\"alice@acme.example\")].[0].customerIds | join(\",\")"  "1,13"
check "bob@trades.example pair members"    "/api/pipeline/duplicates"  "[.[] | select(.email==\"bob@trades.example\")].[0].customerIds | join(\",\")"  "5,19"

# 404 behavior — bypasses jq because curl -sf exits non-zero on 404.
status=$(curl -o /dev/null -s -w "%{http_code}" "${URL}/api/customers/999")
if [ "$status" = "404" ]; then
    printf "  OK   %-50s (%s)\n" "missing customer HTTP status" "404"
else
    printf "  FAIL %-50s expected=404 got=%s\n" "missing customer HTTP status" "$status"
    fail=1
fi

echo ""
if [ "$fail" -eq 0 ]; then
    echo "All checks passed. Server log: ${LOG_FILE}"
    exit 0
else
    echo "One or more checks failed — see ${LOG_FILE} for server output."
    exit 1
fi
