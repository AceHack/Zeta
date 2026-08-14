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
DRY_RUN=0
DRY_RUN_OUT_DIR=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --agent-name) AGENT_NAME="$2"; shift 2 ;;
    --manifest) MANIFEST="$2"; shift 2 ;;
    --skip-health-check) SKIP_HEALTH_CHECK=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --out-dir) DRY_RUN_OUT_DIR="$2"; shift 2 ;;
    --help|-h) echo "Usage: $0 [--agent-name NAME] [--manifest PATH] [--skip-health-check] [--dry-run [--out-dir DIR]]"; exit 0 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

if [[ "$DRY_RUN" -eq 1 ]]; then
  DRY_RUN_OUT_DIR="${DRY_RUN_OUT_DIR:-$(mktemp -d)}"
  SKIP_HEALTH_CHECK=1
  echo "=== DRY RUN — no clone, no launchctl, no ~/Library/LaunchAgents write ==="
  echo "Generated plists: $DRY_RUN_OUT_DIR"
fi

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

  # In dry-run the cell is provisioned against a scratch clone/plist location so
  # the generator's OUTPUT can be inspected without touching the real clones or
  # launchd. This exists because the generator was previously unverifiable: the
  # only way to see what plist it produced was to install it.
  local CLONE_DIR="${HOME}/.zeta/clones/${AGENT}"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    CLONE_DIR="${DRY_RUN_CLONE_DIR:-$REPO_ROOT}"
  fi
  # Label MUST match persona-registry.ts (`com.lucent.zeta.<persona>-loop`).
  # It used to be `com.lucent.zeta.${AGENT}`, which meant IServiceManager.status()
  # looked up a label that did not exist and answered "not-installed" for a cell
  # whose plist was installed and failing every 60s. See the header note.
  local LABEL="com.lucent.zeta.${AGENT}-loop"
  local PLIST_DST="$HOME/Library/LaunchAgents/${LABEL}.plist"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    PLIST_DST="${DRY_RUN_OUT_DIR}/${LABEL}.plist"
  fi
  # LOG_DIR / STATE_DIR must match env-schema.ts defaultPaths(), or loop-liveness
  # looks for the heartbeat artifact somewhere the loop never writes it.
  local LOG_DIR="$HOME/Library/Logs/zeta-${AGENT}-loop"
  local AGENT_INITIAL
  AGENT_INITIAL="$(tr '[:lower:]' '[:upper:]' <<< "${AGENT:0:1}")"
  local STATE_DIR="$HOME/Library/Application Support/Zeta${AGENT_INITIAL}${AGENT:1}Loop"
  local LOOP_TICK="${CLONE_DIR}/src/Core.TypeScript/service/loop-tick.ts"

  echo ""
  echo "--- Provisioning cell ${CELL_ID}: agent=${AGENT} harness=${HARNESS} interval=${INTERVAL}s ---"

  # Clone or update
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "  [dry-run] skipping clone; using $CLONE_DIR"
  elif [[ -d "$CLONE_DIR/.git" ]]; then
    echo "  Clone exists — pulling latest main..."
    git -C "$CLONE_DIR" fetch origin main 2>/dev/null
    git -C "$CLONE_DIR" reset --hard origin/main 2>/dev/null
  else
    echo "  Cloning Zeta to $CLONE_DIR..."
    mkdir -p "$(dirname "$CLONE_DIR")"
    git clone --depth=1 "$REPO_URL" "$CLONE_DIR" 2>/dev/null
  fi

  # --- Preflight: refuse to generate a unit that cannot possibly start ---
  #
  # This is the guard that would have prevented the 2026-06-13 outage. PR #8088
  # deleted tools/kiro/kiro-loop-wrapper.sh while this generator kept emitting
  # its path; every clone then `reset --hard`'d the file away, and four cells
  # exited 78 (EX_CONFIG) every 60s for two months with nobody informed. The
  # generator never checked that the program it names exists.
  if [[ ! -f "$LOOP_TICK" ]]; then
    echo "  ✗ ERROR: loop runner not found at $LOOP_TICK"
    echo "    The clone does not contain the program this plist would name."
    echo "    Refusing to install a unit that would fail with EX_CONFIG."
    return 1
  fi

  # Refuse a persona the loop runner would reject at startup. The cluster-cells
  # manifest and persona-registry.ts are separate files and have drifted before
  # (alexa + vera were provisioned here while unknown to the registry).
  if ! "$BUN_PATH" "${CLONE_DIR}/src/Core.TypeScript/service/loop-liveness.ts" --assert-persona "$AGENT"; then
    echo "  ✗ ERROR: '$AGENT' is not registered in src/Core.TypeScript/service/persona-registry.ts"
    echo "    The manifest asks for a cell the loop runner would reject with"
    echo "    'Unknown persona'. Add the persona to the registry, or fix the manifest."
    return 1
  fi

  # Create directories
  if [[ "$DRY_RUN" -eq 1 ]]; then
    mkdir -p "$DRY_RUN_OUT_DIR"
  else
    mkdir -p "$LOG_DIR" "$STATE_DIR" "$HOME/Library/LaunchAgents"
  fi

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
        <string>${BUN_PATH}</string>
        <string>${LOOP_TICK}</string>
        <string>--persona</string>
        <string>${AGENT}</string>
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
        <key>ZETA_LOOP_PERSONA</key>
        <string>${AGENT}</string>
        <key>ZETA_LOOP_WORKTREE</key>
        <string>${CLONE_DIR}</string>
        <key>ZETA_LOOP_STATE_DIR</key>
        <string>${STATE_DIR}</string>
        <key>ZETA_LOOP_LOG_DIR</key>
        <string>${LOG_DIR}</string>
        <key>ZETA_LOOP_REF</key>
        <string>main</string>
        <key>ZETA_LOOP_FORWARD_ACTIONS</key>
        <string>${FORWARD}</string>
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

  # Every generated plist must at minimum be well-formed, or launchd rejects the
  # unit at load time with no useful signal downstream.
  if ! plutil -lint "$PLIST_DST" >/dev/null 2>&1; then
    echo "  ✗ ERROR: generated plist is malformed: $PLIST_DST"
    return 1
  fi

  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "  ✓ [dry-run] Cell ${CELL_ID} plist generated (not installed): ${PLIST_DST}"
    return 0
  fi

  # Install service
  launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true
  sleep 1
  launchctl load -w "$PLIST_DST" 2>/dev/null

  echo "  ✓ Cell ${CELL_ID} installed: ${LABEL}"
  echo "    Logs: $LOG_DIR/runner.log"
}

# --- Main: read manifest and provision ---
CELLS_PROVISIONED=0
CELLS_FAILED=0

if [[ -n "$AGENT_NAME" ]]; then
  # Single-cell mode (v0 compat)
  if provision_cell "cell-manual" "auto" "$AGENT_NAME" "60" "1"; then
    CELLS_PROVISIONED=1
  else
    CELLS_FAILED=1
  fi
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
      # Preflight failures must not abort the remaining cells, but they MUST be
      # counted and must make the run exit nonzero.
      if provision_cell "$CELL_ID" "${HARNESS:-auto}" "$AGENT" "${INTERVAL:-60}" "${FORWARD:-1}"; then
        CELLS_PROVISIONED=$((CELLS_PROVISIONED + 1))
      else
        CELLS_FAILED=$((CELLS_FAILED + 1))
      fi
    fi
  done < "$MANIFEST"
fi

echo ""
echo "=== ${CELLS_PROVISIONED} cell(s) provisioned, ${CELLS_FAILED} failed ==="

# --- Health check ---
#
# The predecessor of this block could not fail. It globbed
# $HOME/Library/Logs/zeta-*/runner.log, guarded each hit with `[[ -f "$log" ]]`,
# and only ever `echo`'d. A cell that never started writes no runner.log at all,
# so the glob simply skipped it and the provisioner exited 0 reporting nothing —
# silence read as success. It also grepped for "heartbeat complete", a string
# loop-tick.ts does not emit (it logs "tick complete"), so even a healthy cell
# could only ever produce the ⚠ branch.
#
# It now delegates to loop-liveness.ts, which reads launchd's `last exit code`
# and the heartbeat artifact, and PROPAGATES the exit status.
if [[ "$SKIP_HEALTH_CHECK" -eq 0 && "$CELLS_PROVISIONED" -gt 0 ]]; then
  echo "Waiting 65s for the first tick..."
  sleep 65
  echo "Health check:"
  if ! "$BUN_PATH" "$REPO_ROOT/src/Core.TypeScript/service/loop-liveness.ts"; then
    echo ""
    echo "✗ host-loop-bootstrap: at least one provisioned cell is not healthy (see above)."
    exit 1
  fi
  echo "✓ All installed cells healthy."
fi

if [[ "$CELLS_FAILED" -gt 0 ]]; then
  echo "✗ host-loop-bootstrap: ${CELLS_FAILED} cell(s) failed preflight and were NOT installed."
  exit 1
fi
