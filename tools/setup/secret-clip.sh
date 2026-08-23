#!/usr/bin/env bash
#
# tools/setup/secret-clip.sh — GENERIC clipboard → OS-keystore secret sharing.
# Aaron 2026-06-21: "this is a generic clipboard password/secret→keychain pattern too, not
# just for onepass ... clear clipboard afterwards ... gate it with fingerprint ... safe for
# everyone ... we need one for each os too."
#
# The op-token flow (op-token-setup.ts) is ONE caller; this is the reusable primitive: capture
# ANY named secret WITHOUT it touching the agent's stdout/transcript, store it ENCRYPTED in the
# OS keystore, and optionally clear the clipboard after.
#
# Interface (OS-agnostic):
#   secret-clip.sh set <name> [--clipboard] [--clear-clipboard]   # capture → keystore
#   secret-clip.sh get <name>                                     # keystore → stdout (for $(...))
#   secret-clip.sh del <name>                                     # remove from keystore
#     <name>          a label (e.g. zeta-op-service-account, github-pat, wifi-psk)
#     --clipboard     read the secret from the clipboard (default: native secure dialog)
#     --clear-clipboard  wipe the clipboard after a successful `set` (so it doesn't linger)
#
# SECURITY: the secret flows clipboard/secure-dialog → keystore inside this subprocess; it is
# NEVER echoed, NEVER an argv of a long-lived process beyond the keystore write, NEVER in the
# repo. Encrypted at rest in the OS keystore; in-process only at use ("export is export").
#
# PER-OS BACKENDS:
#   macOS    — login Keychain via `security` (IMPLEMENTED here).
#   Linux    — Secret Service via `secret-tool` (libsecret) — PLANNED (backlog 081KVP… ).
#   Windows  — Credential Manager / DPAPI via PowerShell — PLANNED (backlog 081KVP… ).
# Biometric-GATED reads (Touch ID / Windows Hello / fprintd) are the next layer — see backlog;
# today macOS encrypts at rest + (optionally) clears the clipboard; true biometric-ACL-on-read
# needs SecAccessControl (mac) / Hello (win) / polkit (linux), tracked separately.

set -euo pipefail

usage() { sed -n '11,18p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-2}"; }

[ $# -ge 2 ] || usage
ACTION="$1"; NAME="$2"; shift 2
FROM="dialog"; CLEAR_CLIP="no"
while [ $# -gt 0 ]; do
  case "$1" in
    --clipboard) FROM="clipboard" ;;
    --clear-clipboard) CLEAR_CLIP="yes" ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
  shift
done

OS="$(uname -s)"

# ── capture a secret WITHOUT echoing it ─────────────────────────────
capture_secret() {  # echoes the secret on stdout for command-substitution within THIS script only
  if [ "$FROM" = "clipboard" ]; then
    case "$OS" in
      Darwin) pbpaste ;;
      Linux)  wl-paste 2>/dev/null || xclip -selection clipboard -o 2>/dev/null || xsel -b 2>/dev/null || true ;;
      *) echo "" ;;
    esac
  else
    # MASKED entry. If a human is at a TTY, read masked from the terminal (no echo) — the
    # 1Password-style masked login, works on EVERY OS. If there's NO TTY (agent-driven), fall
    # back to a native GUI secure dialog so a human can still approve. Either way: never echoed.
    if [ -t 0 ]; then
      printf 'Enter secret for %s (hidden): ' "$NAME" >&2
      IFS= read -rs _s; printf '\n' >&2
      printf '%s' "$_s"
    else
      case "$OS" in
        Darwin) osascript <<OSA 2>/dev/null || true
text returned of (display dialog "Paste the secret for '$NAME'. It goes straight to the Keychain — never the terminal or the agent." default answer "" with hidden answer buttons {"Cancel", "Store"} default button "Store" with title "Zeta secret-clip — $NAME")
OSA
          ;;
        *) echo "" ;;  # no TTY + no GUI ⇒ caller should use --clipboard
      esac
    fi
  fi
}

clear_clipboard() {
  [ "$CLEAR_CLIP" = "yes" ] || return 0
  case "$OS" in
    Darwin) printf '' | pbcopy ;;
    Linux)  { command -v wl-copy >/dev/null 2>&1 && printf '' | wl-copy; } || printf '' | xclip -selection clipboard 2>/dev/null || true ;;
  esac
  echo "✓ clipboard cleared" >&2
}

case "$ACTION" in
  set)
    SECRET="$(capture_secret)"
    [ -n "$SECRET" ] || { echo "✗ empty / cancelled (nothing stored)" >&2; exit 1; }
    case "$OS" in
      Darwin)
        security add-generic-password -a "$USER" -s "$NAME" -U -w "$SECRET"
        unset SECRET
        echo "✓ '$NAME' stored ENCRYPTED in the macOS Keychain (value never printed)." >&2
        clear_clipboard
        ;;
      Linux)
        echo "✗ Linux backend (secret-tool / libsecret) is PLANNED, not yet implemented." >&2
        echo "  Intended: printf '%s' \"\$SECRET\" | secret-tool store --label=\"$NAME\" zeta-secret \"$NAME\"" >&2
        exit 3 ;;
      *)
        echo "✗ Windows backend (Credential Manager / DPAPI) is PLANNED, not yet implemented." >&2
        echo "  Intended: PowerShell cmdkey / [Security.Cryptography.ProtectedData]::Protect" >&2
        exit 3 ;;
    esac
    ;;
  get)
    case "$OS" in
      Darwin) security find-generic-password -s "$NAME" -w 2>/dev/null || { echo "✗ '$NAME' not in Keychain" >&2; exit 1; } ;;
      Linux)  echo "✗ Linux backend PLANNED (secret-tool lookup zeta-secret $NAME)" >&2; exit 3 ;;
      *)      echo "✗ Windows backend PLANNED" >&2; exit 3 ;;
    esac
    ;;
  del)
    case "$OS" in
      Darwin)
        if security delete-generic-password -s "$NAME" >/dev/null 2>&1; then
          echo "✓ '$NAME' removed" >&2
        else
          echo "✗ '$NAME' not found" >&2
          exit 1
        fi
        ;;
      *) echo "✗ del backend PLANNED for $OS" >&2; exit 3 ;;
    esac
    ;;
  *) usage ;;
esac
