#!/usr/bin/env bash
#
# tools/lint/lint-go-python.sh — Runs Go and Python formatting, linting, and type checking.
#

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo "=== Linting Go ==="
cd "$REPO_ROOT/src/Core.Go"
go fmt ./...
golangci-lint run ./...

echo "=== Linting Python ==="
cd "$REPO_ROOT/src/Core.Python"
uv sync
uv run ruff check
uv run ruff format --check
uv run mypy src/ tests/

echo "✓ Go and Python linting checks passed successfully!"
