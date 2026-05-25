#!/bin/bash
# kiro-loop-wrapper.sh — launchd entry point for Kiro (Qwen Coder) autonomous loop
set -euo pipefail

# Ensure standard tool paths are on the PATH
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.bun/bin:$PATH"

# Load the local Zeta shell environment if available to get the correct node/bun paths
if [ -f "$HOME/.config/zeta/shellenv.sh" ]; then
    # shellcheck source=/dev/null
    source "$HOME/.config/zeta/shellenv.sh"
fi

# Resolve the repo root relative to the script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../.."

# Export the resolved worktree so kiro-loop-tick.ts uses this checkout
# instead of falling back to the user-specific default ($HOME/Documents/src/repos/Zeta).
# tick.ts uses ZETA_KIRO_LOOP_WORKTREE as `cwd` for every git/gh subprocess; the bash
# `cd` above does not propagate to Bun.spawn calls.
export ZETA_KIRO_LOOP_WORKTREE="${ZETA_KIRO_LOOP_WORKTREE:-$(pwd)}"

# Run the Kiro loop tick script with bun
exec bun tools/kiro/kiro-loop-tick.ts
