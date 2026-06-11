#!/bin/bash
# host-loop-bootstrap.sh — One-command setup for a new maintainer host-loop.
#
# Usage:
#   bash tools/setup/host-loop-bootstrap.sh [--agent-name NAME]
#
# What it does:
#   1. Creates an isolated clone at /private/tmp/zeta-clones/<agent-name>/
#   2. Generates a launchd plist for 60s heartbeat ticks
#   3. Installs and starts the launchd service
#   4. Verifies health probe output
#
# Requirements:
#   - macOS with launchd
#   - bun installed (via mise or directly)
#   - gh CLI authenticated
#   - Git access to Lucent-Financial-Group/Zeta
#
# Per B-0248.2 / B-0751: each maintainer gets their own isolated clone.
# The operator's primary checkout stays untouched (SHARED VIEW + FOR HUMAN).
#
# Examples:
#   bash tools/setup/host-loop-bootstrap.sh --agent-name max-24x7
#   bash tools/setup/host-loop-bootstrap.sh --agent-name addison-dev
set -euo pipefail

# --- Parse args ---
AGENT_NAME="host-loop"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --agent-name) AGENT_NAME="$2"; shift 2 ;;
    --help|-h) echo "Usage: $0 [--agent-name NAME]"; exit 0 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# --- Paths ---
CLONE_DIR="/private/tmp/zeta-clones/${AGENT_NAME}"
REPO_URL="https://github.com/Lucent-Financial-Group/Zeta.git"
LABEL="com.lucent.zeta.${AGENT_NAME}"
PLIST_DST="$HOME/Library/LaunchAgents/${LABEL}.plist"
LOG_DIR="$HOME/Library/Logs/zeta-${AGENT_NAME}"
STATE_DIR="$HOME/Library/Application Support/Zeta-${AGENT_NAME}"

# --- Find bun ---
BUN_PATH=""
if command -v bun &>/dev/null; then
  BUN_PATH="$(command -v bun)"
elif [[ -f "$HOME/.local/share/mise/installs/bun/1.3/bin/bun" ]]; then
  BUN_PATH="$HOME/.local/share/mise/installs/bun/1.3/bin/bun"
elif [[ -f "$HOME/.local/bin/bun" ]]; then
  BUN_PATH="$HOME/.local/bin/bun"
else
  echo "ERROR: bun not found. Install via: curl -fsSL https://bun.sh/install | bash"
  exit 1
fi
echo "Using bun: $BUN_PATH"

# --- Clone or update ---
if [[ -d "$CLONE_DIR/.git" ]]; then
  echo "Clone exists at $CLONE_DIR — pulling latest main..."
  git -C "$CLONE_DIR" fetch origin main
  git -C "$CLONE_DIR" reset --hard origin/main
else
  echo "Cloning Zeta to $CLONE_DIR..."
  mkdir -p "$(dirname "$CLONE_DIR")"
  git clone --depth=1 "$REPO_URL" "$CLONE_DIR"
fi

# --- Create directories ---
mkdir -p "$LOG_DIR" "$STATE_DIR" "$HOME/Library/LaunchAgents"

# --- Generate plist ---
BUN_DIR=$(dirname "$BUN_PATH")
cat > "$PLIST_DST" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${LABEL}</string>

    <key>ProgramArguments</key>
    <array>
        <string>${BUN_PATH}</string>
        <string>${CLONE_DIR}/tools/kiro/kiro-loop-tick.ts</string>
    </array>

    <key>StartInterval</key>
    <integer>60</integer>

    <key>WorkingDirectory</key>
    <string>${CLONE_DIR}</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>HOME</key>
        <string>${HOME}</string>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${HOME}/.local/bin:${BUN_DIR}</string>
        <key>ZETA_KIRO_LOOP_FORWARD_ACTIONS</key>
        <string>1</string>
        <key>ZETA_KIRO_LOOP_WORKTREE</key>
        <string>${CLONE_DIR}</string>
    </dict>

    <key>StandardOutPath</key>
    <string>${LOG_DIR}/launchd-stdout.log</string>

    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/launchd-stderr.log</string>

    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
PLIST

echo "Plist written to $PLIST_DST"

# --- Install service ---
launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true
sleep 1
launchctl load -w "$PLIST_DST"

echo ""
echo "=== Host loop installed ==="
echo "  Agent:    $AGENT_NAME"
echo "  Clone:    $CLONE_DIR"
echo "  Logs:     $LOG_DIR"
echo "  State:    $STATE_DIR"
echo "  Service:  $LABEL"
echo ""
echo "  Verify:   tail -f $LOG_DIR/runner.log"
echo "  Stop:     launchctl bootout gui/\$(id -u)/${LABEL}"
echo "  Restart:  launchctl load -w $PLIST_DST"
echo ""

# --- Health check (wait one tick) ---
echo "Waiting 65s for first heartbeat..."
sleep 65

if [[ -f "$LOG_DIR/runner.log" ]]; then
  LAST_LINE=$(tail -1 "$LOG_DIR/runner.log")
  if echo "$LAST_LINE" | grep -q "heartbeat complete"; then
    echo "✓ Health check PASSED: $LAST_LINE"
  else
    echo "⚠ Health check INCONCLUSIVE. Last log line:"
    echo "  $LAST_LINE"
    echo "  Check: tail -f $LOG_DIR/runner.log"
  fi
else
  echo "⚠ No log file yet. Service may still be starting."
  echo "  Check: launchctl list | grep $LABEL"
fi
