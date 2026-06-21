#!/bin/bash
# host-loop-bootstrap.sh — Manifest-driven cell provisioner for host-loops.
#
# Reads tools/setup/manifests/cluster-cells (or cluster-cells.<hostname>)
# and provisions one launchd service per cell. Runs automatically during
# USB/ISO setup (called by install.sh) or manually for ad-hoc nodes.
#
# Usage:
#   bash tools/setup/host-loop-bootstrap.sh [--agent-name NAME] [--manifest PATH]
#
# What it does:
#   1. Reads the cluster-cells manifest (4 cells by default)
#   2. Creates an isolated clone per cell at ~/.zeta/clones/<agent>/
#   3. Generates a launchd plist per cell
#   4. Installs and starts all cell services
#   5. Verifies health probe output
#
# If --agent-name is given, provisions only that single cell (v0 compat).
# If no --agent-name, provisions ALL cells from the manifest.
#
# Requirements:
#   - macOS with launchd (Linux systemd support: future)
#   - bun installed (via mise or directly)
#   - gh CLI authenticated
#   - Git access to Lucent-Financial-Group/Zeta
#
# Per 081KRQ1AB0008QG0R0014PKF49 / 081KSE6WT0008QG0R003YYC9PV: each cell gets its own isolated clone.
# The operator's primary checkout stays untouched (SHARED VIEW + FOR HUMAN).
#
# Examples:
#   bash tools/setup/host-loop-bootstrap.sh                        # all 4 cells
#   bash tools/setup/host-loop-bootstrap.sh --agent-name max-24x7  # single cell
#   bash tools/setup/host-loop-bootstrap.sh --manifest path/to/cells  # custom manifest
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "host-loop-bootstrap: skipped (launchd cell provisioning is macOS-only; Linux systemd: future)"
  exit 0
fi

if ! command -v launchctl >/dev/null 2>&1; then
  echo "host-loop-bootstrap: skipped (launchctl not found)"
  exit 0
fi

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SETUP_DIR="$REPO_ROOT/tools/setup"
HOSTNAME="$(hostname -s 2>/dev/null || echo "unknown")"

# --- Parse args ---
AGENT_NAME=""
MANIFEST=""
SKIP_HEALTH_CHECK=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --agent-name) AGENT_NAME="$2"; shift 2 ;;
    --manifest) MANIFEST="$2"; shift 2 ;;
    --skip-health-check) SKIP_HEALTH_CHECK=1; shift ;;
    --help|-h) echo "Usage: $0 [--agent-name NAME] [--manifest PATH] [--skip-health-check]"; exit 0 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# --- Resolve manifest ---
if [[ -z "$MANIFEST" ]]; then
  # Check for node-specific override first
  if [[ -f "$SETUP_DIR/manifests/cluster-cells.${HOSTNAME}" ]]; then
    MANIFEST="$SETUP_DIR/manifests/cluster-cells.${HOSTNAME}"
  else
    MANIFEST="$SETUP_DIR/manifests/cluster-cells"
  fi
fi

if [[ ! -f "$MANIFEST" ]]; then
  echo "ERROR: manifest not found: $MANIFEST"
  exit 1
fi

echo "=== Host-loop cell provisioner (081KRQ1AB0008QG0R0014PKF49) ==="
echo "Manifest: $MANIFEST"
echo "Hostname: $HOSTNAME"

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
BUN_DIR=$(dirname "$BUN_PATH")
echo "Using bun: $BUN_PATH"

# --- Repo URL ---
REPO_URL="https://github.com/Lucent-Financial-Group/Zeta.git"

# --- Provision a single cell ---
provision_cell() {
  local CELL_ID="$1"
  local HARNESS="$2"
  local AGENT="$3"
  local INTERVAL="$4"
  local FORWARD="$5"

  local CLONE_DIR="${HOME}/.zeta/clones/${AGENT}"
  local LABEL="com.lucent.zeta.${AGENT}"
  local PLIST_DST="$HOME/Library/LaunchAgents/${LABEL}.plist"
  local LOG_DIR="$HOME/Library/Logs/zeta-${AGENT}"
  local STATE_DIR="$HOME/Library/Application Support/Zeta-${AGENT}"

  echo ""
  echo "--- Provisioning cell ${CELL_ID}: agent=${AGENT} harness=${HARNESS} interval=${INTERVAL}s ---"

  # Clone or update
  if [[ -d "$CLONE_DIR/.git" ]]; then
    echo "  Clone exists — pulling latest main..."
    git -C "$CLONE_DIR" fetch origin main 2>/dev/null
    git -C "$CLONE_DIR" reset --hard origin/main 2>/dev/null
  else
    echo "  Cloning Zeta to $CLONE_DIR..."
    mkdir -p "$(dirname "$CLONE_DIR")"
    git clone --depth=1 "$REPO_URL" "$CLONE_DIR" 2>/dev/null
  fi

  # Create directories
  mkdir -p "$LOG_DIR" "$STATE_DIR" "$HOME/Library/LaunchAgents"

  # Generate plist
  cat > "$PLIST_DST" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${LABEL}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${CLONE_DIR}/tools/kiro/kiro-loop-wrapper.sh</string>
    </array>
    <key>StartInterval</key>
    <integer>${INTERVAL}</integer>
    <key>WorkingDirectory</key>
    <string>${CLONE_DIR}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>HOME</key>
        <string>${HOME}</string>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${HOME}/.local/bin:${BUN_DIR}</string>
        <key>ZETA_KIRO_LOOP_FORWARD_ACTIONS</key>
        <string>${FORWARD}</string>
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

  # Install service
  launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true
  sleep 1
  launchctl load -w "$PLIST_DST" 2>/dev/null

  echo "  ✓ Cell ${CELL_ID} installed: ${LABEL}"
  echo "    Logs: $LOG_DIR/runner.log"
}

# --- Main: read manifest and provision ---
CELLS_PROVISIONED=0

if [[ -n "$AGENT_NAME" ]]; then
  # Single-cell mode (v0 compat)
  provision_cell "cell-manual" "auto" "$AGENT_NAME" "60" "1"
  CELLS_PROVISIONED=1
else
  # Manifest mode: read all non-comment lines
  while IFS= read -r line; do
    # Skip comments and empty lines
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line// /}" ]] && continue

    # Parse: cell-id harness=X agent=Y interval=N forward=0|1
    CELL_ID=$(echo "$line" | awk '{print $1}')
    HARNESS=$(echo "$line" | sed -n 's/.*harness=\([^ ]*\).*/\1/p')
    AGENT=$(echo "$line" | sed -n 's/.*agent=\([^ ]*\).*/\1/p')
    INTERVAL=$(echo "$line" | sed -n 's/.*interval=\([^ ]*\).*/\1/p')
    FORWARD=$(echo "$line" | sed -n 's/.*forward=\([^ ]*\).*/\1/p')

    if [[ -n "$CELL_ID" && -n "$AGENT" ]]; then
      provision_cell "$CELL_ID" "${HARNESS:-auto}" "$AGENT" "${INTERVAL:-60}" "${FORWARD:-1}"
      CELLS_PROVISIONED=$((CELLS_PROVISIONED + 1))
    fi
  done < "$MANIFEST"
fi

echo ""
echo "=== ${CELLS_PROVISIONED} cell(s) provisioned ==="

if [[ "$SKIP_HEALTH_CHECK" -eq 0 && "$CELLS_PROVISIONED" -gt 0 ]]; then
  echo "Waiting 65s for first heartbeat..."
  sleep 65
  echo "Health check:"
  for log in "$HOME"/Library/Logs/zeta-*/runner.log; do
    if [[ -f "$log" ]]; then
      LAST=$(tail -1 "$log")
      AGENT_DIR=$(basename "$(dirname "$log")" | sed 's/^zeta-//')
      if echo "$LAST" | grep -q "heartbeat complete"; then
        echo "  ✓ $AGENT_DIR: $LAST"
      else
        echo "  ⚠ $AGENT_DIR: $(echo "$LAST" | head -c 80)"
      fi
    fi
  done
fi
