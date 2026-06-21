#!/usr/bin/env bash
#
# tools/setup/common/qdk.sh — install the modern Q# Development Kit (QDK).
#
# The modern QDK (qsharp 1.x) is a Python package that includes
# the Q# compiler, simulator, and language server. It does NOT need
# Visual Studio or the legacy .NET QDK packages.
#
# Prerequisites: Python 3.11+ with pip.
# Install: pip install qsharp
#
# This enables:
# - Compiling .qs files (syntax/type checking)
# - Running the sparse statevector simulator
# - Executing @EntryPoint() operations
#
# Usage: bash tools/setup/common/qdk.sh

set -euo pipefail

echo "─── Q# Development Kit (modern QDK / qsharp 1.x) ───"

if ! command -v python3 >/dev/null 2>&1; then
  echo "⚠ python3 not found — skipping QDK install"
  exit 0
fi

# Check if qsharp is already installed
if python3 -c "import qsharp" 2>/dev/null; then
  VERSION=$(python3 -c "import qsharp; print(qsharp.__version__)" 2>/dev/null || echo "unknown")
  echo "✓ qsharp already installed (version: $VERSION)"
  exit 0
fi

echo "↓ installing qsharp via pip..."
python3 -m pip install --quiet qsharp

# Verify
if python3 -c "import qsharp" 2>/dev/null; then
  VERSION=$(python3 -c "import qsharp; print(qsharp.__version__)" 2>/dev/null || echo "unknown")
  echo "✓ qsharp installed (version: $VERSION)"
else
  echo "⚠ qsharp install failed — Q# compilation will not be available"
  exit 1
fi
