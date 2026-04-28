#!/usr/bin/env bash
# Factory-demo DB smoke test — confirms schema + seed applied correctly.
#
# Run after `docker-compose up -d`:
#   bash samples/FactoryDemo.Db/smoke-test.sh
#
# Exits 0 if the seed is present and shapes are correct; 1 otherwise.
# Uses `docker-compose exec` so no host-side psql is required.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if ! docker-compose ps --services 2>/dev/null | grep -q '^db$'; then
    echo "db service not running. Start it first:"
    echo "    cd $SCRIPT_DIR && docker-compose up -d"
    exit 1
fi

# Wait for Postgres to accept connections before smoke-checking.
# The compose healthcheck covers container-up; pg_isready confirms the
# server is actually answering. Bounded: 30 attempts * 1s = 30s budget.
echo -n "Waiting for Postgres to accept connections"
for _ in $(seq 1 30); do
    if docker-compose exec -T db pg_isready -U postgres -d postgres >/dev/null 2>&1; then
        echo " ready."
        break
    fi
    echo -n "."
    sleep 1
done
if ! docker-compose exec -T db pg_isready -U postgres -d postgres >/dev/null 2>&1; then
    echo ""
    echo "Postgres did not become ready within 30s." >&2
    exit 1
fi

fail=0

# run_psql captures stderr to a temp file so callers can surface psql
# errors on failure (otherwise `set -euo pipefail` + a silent stderr
# redirect produces an empty got= and a hard-to-diagnose failure).
run_psql() {
    local stderr_file
    stderr_file=$(mktemp)
    local out rc
    if out=$(docker-compose exec -T db psql -U postgres -tAX -c "$1" 2>"$stderr_file"); then
        rc=0
    else
        rc=$?
    fi
    LAST_PSQL_STDERR=$(cat "$stderr_file")
    rm -f "$stderr_file"
    if [ "$rc" -ne 0 ]; then
        # Print stderr to our stderr so the failing check has context.
        printf '%s\n' "$LAST_PSQL_STDERR" >&2
    fi
    printf '%s' "$out" | tr -d '[:space:]'
    return "$rc"
}

check() {
    local label="$1"
    local sql="$2"
    local expected="$3"
    local actual
    # Tolerate non-zero psql exit so we can print expected vs got + stderr,
    # rather than tripping `set -e` and aborting before the FAIL line.
    actual=$(run_psql "$sql") || true
    if [ "$actual" = "$expected" ]; then
        printf "  OK   %-40s (%s)\n" "$label" "$actual"
    else
        printf "  FAIL %-40s expected=%s got=%s\n" "$label" "$expected" "$actual"
        if [ -n "${LAST_PSQL_STDERR:-}" ]; then
            printf "       psql stderr: %s\n" "$LAST_PSQL_STDERR"
        fi
        fail=1
    fi
}

echo "Factory-demo DB smoke test"
echo "=========================="

check "customer row count"              "SELECT COUNT(*) FROM customers;"              "20"
check "opportunity row count"           "SELECT COUNT(*) FROM opportunities;"          "30"
check "activity row count"              "SELECT COUNT(*) FROM activities;"             "33"
check "duplicate-email groups"          "SELECT COUNT(*) FROM (SELECT email FROM customers GROUP BY email HAVING COUNT(*) > 1) s;"  "2"
check "Lead-stage opportunity count"    "SELECT COUNT(*) FROM opportunities WHERE stage = 'Lead';"     "10"
check "Won-stage opportunity count"     "SELECT COUNT(*) FROM opportunities WHERE stage = 'Won';"      "6"
check "Lost-stage opportunity count"    "SELECT COUNT(*) FROM opportunities WHERE stage = 'Lost';"     "2"

if [ "$fail" -eq 0 ]; then
    echo ""
    echo "All checks passed."
    exit 0
else
    echo ""
    echo "One or more checks failed — seed data may be missing or corrupted."
    exit 1
fi
