#!/bin/bash
# kiro-loop-wrapper.sh — launchd entry point for Kiro (Qwen Coder) autonomous loop
set -euo pipefail

# Source the zeta shell environment to get paths for bun and other tools
if [ -f "$HOME/.config/zeta/shellenv.sh" ]; then
    . "$HOME/.config/zeta/shellenv.sh"
fi

cd /Users/acehack/Documents/src/repos/Zeta

# Run the Kiro loop tick script with bun
exec bun tools/kiro/kiro-loop-tick.ts
