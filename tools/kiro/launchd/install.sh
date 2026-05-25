#!/bin/bash
# Install the Kiro/Alexa loop as a launchd user agent.
# Run: bash tools/kiro/launchd/install.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

PLIST_NAME="com.lucent.zeta.kiro-loop.plist"
PLIST_LABEL="com.lucent.zeta.kiro-loop"
PLIST_SRC="$SCRIPT_DIR/$PLIST_NAME"
PLIST_DST="$HOME/Library/LaunchAgents/$PLIST_NAME"
LOG_DIR="$HOME/Library/Logs/zeta-kiro-loop"
STATE_DIR="$HOME/Library/Application Support/ZetaKiroLoop"

mkdir -p "$LOG_DIR" "$STATE_DIR" "$HOME/Library/LaunchAgents"

# Unload if already loaded (launchctl bootout expects the Label, not the filename)
launchctl bootout "gui/$(id -u)/$PLIST_LABEL" 2>/dev/null || true

# Safe placeholder substitution via python (handles special chars in $HOME / $REPO_ROOT)
python3 - "$PLIST_SRC" "$PLIST_DST" "$HOME" "$REPO_ROOT" <<'PYEOF'
import sys
src, dst, home, repo = sys.argv[1:]
with open(src, "r") as f:
    content = f.read()
content = content.replace("__USER_HOME__", home).replace("__REPO_ROOT__", repo)
with open(dst, "w") as f:
    f.write(content)
PYEOF

# Validate the rendered plist
plutil -lint "$PLIST_DST"

# Load the new service
launchctl bootstrap "gui/$(id -u)" "$PLIST_DST"

echo "Kiro loop installed and running."
echo "  Label: $PLIST_LABEL"
echo "  Logs: $LOG_DIR"
echo "  State: $STATE_DIR"
echo "  Unload: launchctl bootout gui/$(id -u)/$PLIST_LABEL"
