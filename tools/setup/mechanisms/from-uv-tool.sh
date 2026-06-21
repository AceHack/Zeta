#!/usr/bin/env bash
#
# tools/setup/mechanisms/from-uv-tool.sh — install Python CLI tools via
# `uv tool install`. Shape borrowed (not copied) from
# `../scratch/scripts/setup/unix/python-tools.sh`. See BACKLOG P1
# "Python tool management via `uv tool` (from ../scratch)".
#
# Prereq: `.mise.toml` pins uv; `common/mise.sh` ran first so `uv`
# is on PATH (via mise shims).
#
# Tool list lives in `tools/setup/manifests/from-uv-tool` (no-extension
# declarative manifest; one tool per non-comment non-empty line). Zeta
# uses a single flat manifest today; when `@include` hierarchy lands
# (BACKLOG item) this file will support `@min` directives too.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
MANIFEST="$REPO_ROOT/tools/setup/manifests/from-uv-tool"

# Early exit if no manifest or manifest is all comments — uv tool
# management is opt-in.
if [ ! -f "$MANIFEST" ]; then
  echo "✓ no uv-tools manifest at $MANIFEST; skipping"
  exit 0
fi

# Extract non-comment non-empty lines. awk pattern avoids the
# grep -v pipefail bug we hit in macos.sh/linux.sh earlier.
TOOLS="$(awk '!/^[[:space:]]*#/ && NF > 0 { print }' "$MANIFEST")"
if [ -z "$TOOLS" ]; then
  echo "✓ uv-tools manifest empty; skipping"
  exit 0
fi

# Resolve the uv binary mise provides.
if ! command -v uv >/dev/null 2>&1; then
  echo "error: uv not on PATH. common/mise.sh must run first."
  exit 1
fi
UV_BIN="$(command -v uv)"
echo "✓ uv: $($UV_BIN --version)"

# Refresh any already-installed tools first (cheap no-op if nothing
# is installed). Errors here are non-fatal — an install pass follows.
echo "↓ uv tool upgrade --all..."
"$UV_BIN" tool upgrade --all >/dev/null 2>&1 || true

# Install missing tools. `uv tool install` is idempotent on
# already-installed tool names.
while IFS= read -r entry; do
  [ -z "$entry" ] && continue
  # Strip version qualifiers (`foo==1.2.3`, `foo>=1`, etc.) for the
  # "is it installed" check. `uv tool list` prints tool names
  # one-per-line on line starts.
  name="${entry%%[ <>=!~]*}"
  if "$UV_BIN" tool list 2>/dev/null | awk '{print $1}' | grep -qx "$name"; then
    continue
  fi
  echo "↓ uv tool install $entry..."
  "$UV_BIN" tool install "$entry"
done <<< "$TOOLS"

echo "✓ uv-managed Python tools up to date"

# The `uv tool install` path is `~/.local/bin` by default on Linux,
# `~/.local/bin` on macOS too. `shellenv.sh` (final install step)
# already exports `$HOME/.local/bin` for the mise installer, so no
# extra PATH export is needed here.
