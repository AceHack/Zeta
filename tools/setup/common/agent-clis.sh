#!/usr/bin/env bash
#
# tools/setup/common/agent-clis.sh — installs/updates agent + peer-AI CLIs from
# tools/setup/manifests/agent-clis, bun-global (bun provided by mise). Sibling to
# common/dotnet-tools.sh + common/python-tools.sh (manifest-driven global-tool steps).
#
# BEST-EFFORT (mirrors common/local-llm.sh's exceptions-as-signals discipline): each CLI is
# an auth-gated dev/peer tool, NOT a hard dep — an install failure WARNS and continues, never
# bricks install. LOGIN/auth is the operator's to do after install. `bun install --global` is
# idempotent (install if absent, update if present), so re-running only refreshes what changed
# — the idempotent-update property.
#
# Why bun-global (not npm -g): bun's global bin is already on the install-graph PATH (via mise),
# so the CLIs are immediately invokable. The classic npm-global "command not found / not on
# PATH" failure (what bit `codex` here on 2026-05-31, and ~45% of Gemini/Codex install issues)
# is avoided by construction — the same reason claude-code has always installed cleanly.
#
# PACKAGE-MANAGER CLIs only. Non-package-manager CLIs with their own one-line installers
# (grok / cursor-agent / kiro) belong in the one-liner installer registry, NOT here.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
MANIFEST="$REPO_ROOT/tools/setup/manifests/agent-clis"

if [ ! -f "$MANIFEST" ]; then
  echo "✓ no agent-clis manifest; skipping"
  exit 0
fi

if ! command -v mise >/dev/null 2>&1; then
  echo "warn: mise not on PATH; skipping agent-clis (bun comes from mise)" >&2
  exit 0
fi

# Read the manifest directly (NOT via a pipe) so an all-comments file doesn't trip pipefail,
# and strip inline `#` comments + trim. First token is the package id; later key=value
# qualifiers are metadata for smoke tests / other OS adapters. `|| [ -n "$line" ]` catches
# a final no-newline line.
while IFS= read -r line || [ -n "$line" ]; do
  line="${line%%#*}"
  line="$(echo "$line" | xargs)" # trim leading/trailing whitespace
  [ -z "$line" ] && continue
  # shellcheck disable=SC2086  # intentional word-split of the trusted manifest line
  set -- $line
  pkg="${1:-}"
  [ -z "$pkg" ] && continue
  echo "↓ bun -g install $pkg (best-effort agent CLI)..."
  if ! mise exec -- bun install --global "$pkg"; then
    echo "warn: 'bun install -g $pkg' failed; continuing (best-effort — auth/login is the operator's)" >&2
  fi
done <"$MANIFEST"

echo "✓ agent-clis step complete (login to each CLI separately — install is account-free)"
