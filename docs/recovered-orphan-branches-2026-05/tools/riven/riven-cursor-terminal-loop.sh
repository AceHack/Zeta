#!/usr/bin/env bash
# riven-cursor-terminal-loop.sh — Secure launcher for Riven's Cursor Terminal background loop
#
# Usage (in the persistent "1 Terminal" tab):
#   bash tools/riven/riven-cursor-terminal-loop.sh
#
# Features:
# - Prevents duplicate instances via lock file
# - Detects and cleans stale locks (previous process died)
# - Forwards signals cleanly to the Node/Bun process
# - Re-entrant: safe to re-run after terminal close/reopen
#
# Security model:
# - Lock file lives in $HOME/.cursor/riven-terminal-loop.lock
# - Contains PID + start timestamp
# - On startup: check if PID is alive; if not, remove stale lock
# - On SIGINT/SIGTERM: forward to child, wait for clean exit, remove lock

set -euo pipefail

LOCK_DIR="${HOME}/.cursor"
LOCK_FILE="${LOCK_DIR}/riven-terminal-loop.lock"
STATE_FILE="${LOCK_DIR}/riven-terminal-loop-state.json"

mkdir -p "${LOCK_DIR}"

log() {
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"
}

acquire_lock() {
  if [[ -f "${LOCK_FILE}" ]]; then
    local old_pid
    old_pid=$(head -1 "${LOCK_FILE}" 2>/dev/null || echo "")
    if [[ -n "${old_pid}" ]] && kill -0 "${old_pid}" 2>/dev/null; then
      log "ERROR: Riven Cursor Terminal loop already running (PID ${old_pid})"
      log "If you believe this is a stale lock, remove: ${LOCK_FILE}"
      exit 1
    else
      log "Stale lock detected (PID ${old_pid} not running). Removing."
      rm -f "${LOCK_FILE}"
    fi
  fi

  echo "$$" > "${LOCK_FILE}"
  echo "started_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "${LOCK_FILE}"
  log "Lock acquired (PID $$)"
}

release_lock() {
  if [[ -f "${LOCK_FILE}" ]]; then
    local lock_pid
    lock_pid=$(head -1 "${LOCK_FILE}" 2>/dev/null || echo "")
    if [[ "${lock_pid}" == "$$" ]]; then
      rm -f "${LOCK_FILE}"
      log "Lock released (PID $$)"
    else
      log "WARNING: Lock file contains different PID (${lock_pid}); not removing."
    fi
  fi
}

forward_signal() {
  local sig="$1"
  log "Received signal ${sig}; forwarding to child..."
  if [[ -n "${CHILD_PID:-}" ]]; then
    kill "-${sig}" "${CHILD_PID}" 2>/dev/null || true
  fi
}

trap 'forward_signal INT; release_lock; exit 130' INT
trap 'forward_signal TERM; release_lock; exit 143' TERM
trap 'release_lock' EXIT

acquire_lock

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOOP_SCRIPT="${SCRIPT_DIR}/riven-cursor-terminal-loop.ts"

if [[ ! -f "${LOOP_SCRIPT}" ]]; then
  log "ERROR: Loop script not found at ${LOOP_SCRIPT}"
  release_lock
  exit 1
fi

log "Starting Riven Cursor Terminal loop..."
bun "${LOOP_SCRIPT}" &
CHILD_PID=$!

log "Child process PID: ${CHILD_PID}"
wait "${CHILD_PID}" || true

log "Child process exited"
release_lock
exit 0