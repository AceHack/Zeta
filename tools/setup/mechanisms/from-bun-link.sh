#!/usr/bin/env bash
#
# tools/setup/mechanisms/from-bun-link.sh — expose the repo's package bins (ace, zeta-shadow)
# on PATH via `bun link`. The package.json `bin` map declares them; `bun link` in the
# repo root registers the package globally so its bins resolve on PATH (same mechanism
# tools/shadow/README.md documents for zeta-shadow). Best-effort: a failure WARNS and
# continues — these are convenience commands, NOT hard deps; never brick install
# (mirrors mechanisms/from-bun-global.sh + mechanisms/from-ollama.sh exceptions-as-signals discipline).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

if ! command -v mise >/dev/null 2>&1; then
  echo "warn: mise not on PATH; skipping repo-bins (bun comes from mise)" >&2
  exit 0
fi

# `bun link` in the repo root registers package bins globally (into bun's global bin dir).
echo "↓ bun link (repo root) → exposes ace + zeta-shadow on PATH (best-effort)..."
if ! (cd "$REPO_ROOT" && mise exec -- bun link); then
  echo "warn: 'bun link' failed; ace/zeta-shadow not globally linked (run 'bun link' in the repo root manually); continuing" >&2
  exit 0
fi

# bun's global bin dir must be on PATH for the linked bins to resolve. `bun pm bin -g`
# prints it; surface it for THIS process + note it for the managed shellenv.
BUN_GLOBAL_BIN="$(cd "$REPO_ROOT" && mise exec -- bun pm bin -g 2>/dev/null || true)"
if [ -n "$BUN_GLOBAL_BIN" ] && [ -d "$BUN_GLOBAL_BIN" ]; then
  case ":${PATH:-}:" in
    *":$BUN_GLOBAL_BIN:"*) : ;;
    *) export PATH="$BUN_GLOBAL_BIN:$PATH" ;;
  esac
  echo "✓ ace linked; bun global bin: $BUN_GLOBAL_BIN (shellenv adds it to PATH for new shells)"
else
  echo "warn: could not resolve bun global bin dir; 'ace' may need a new shell or manual PATH add" >&2
fi
