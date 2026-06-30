#!/bin/bash
#
# tools/common/git-hooks.sh - Installs the repository's git hooks.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HOOKS_SOURCE_DIR="$REPO_ROOT/tools/git/hooks"
HOOKS_TARGET_DIR="$REPO_ROOT/.git/hooks"

echo "--- Installing Git Hooks ---"

if [ ! -d "$HOOKS_TARGET_DIR" ]; then
    echo "Git hooks directory not found. Skipping hook installation."
    exit 0
fi

for hook in "$HOOKS_SOURCE_DIR"/*; do
    hook_name=$(basename "$hook")
    target_hook="$HOOKS_TARGET_DIR/$hook_name"
    echo "Installing hook: $hook_name"
    cp "$hook" "$target_hook"
    chmod +x "$target_hook"
done

echo "--- Git Hooks installed successfully ---"
