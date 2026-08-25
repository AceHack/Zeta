#!/bin/bash
set -euo pipefail

# This test verifies the Ouroboros Base Case:
# Ace MUST be able to build and run basic operations entirely on its own,
# without Zeta being available or running.

echo "=== Stage 0 Ouroboros Bootstrap Test ==="

# Move to the root of the repo
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." >/dev/null 2>&1 && pwd)"
cd "$DIR"

# Ensure Zeta is strictly disabled
export ZETA_AVAILABLE=
export ZETA_AVAILABLE=0

echo "[1/2] Building Ace..."
# Build the ace entrypoint (simulating a fresh clone compile)
mkdir -p scratch
bun build src/Core.TypeScript/ace/ace.ts --target bun --outfile scratch/ace-dist.js

echo "[2/2] Running Ace basic commands..."
# Ensure it boots without throwing exceptions about missing Zeta dependencies
bun run scratch/ace-dist.js help > /dev/null

echo "=== Stage 0 Base Case Validated ==="
