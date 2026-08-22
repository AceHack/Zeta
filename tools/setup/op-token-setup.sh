#!/usr/bin/env bash
#
# tools/setup/op-token-setup.sh — securely capture a 1Password SERVICE-ACCOUNT token
# (`ops_…`) into the macOS Keychain + wire a runtime-fetch into the managed shell env.
# Aaron 2026-06-21: "make some reusable workflow/blueprint … pop up a secure window for me
# to type it in and you do everything … reuse our profile-edit scripts."
#
# SECURITY MODEL (why this is safe for an AGENT to run):
#   - The token is captured via a NATIVE macOS secure dialog (osascript, hidden answer) OR
#     from the clipboard (`--clipboard`). It NEVER passes through the agent's stdout, the
#     terminal echo, or the conversation transcript — it flows window/clipboard → Keychain.
#   - At REST it lives ENCRYPTED in the login Keychain (`security add-generic-password`),
#     NOT in any dotfile in plaintext.
#   - The shell env file holds only the FETCH command
#     (`export OP_SERVICE_ACCOUNT_TOKEN="$(security find-generic-password -s … -w)"`),
#     never the token value — so the secret is in-process only at use (export is export),
#     with the plaintext window minimized. (Encrypt-at-rest yes; encrypt-in-use no — see
#     the custody discussion 2026-06-21.)
#   - This is the bootstrap; the desktop-app integration (Touch ID, no token) and Vault
#     (short-lived issuance) are the later, token-free paths.
#
# Usage:
#   bash tools/setup/op-token-setup.sh              # secure GUI dialog (hidden input)
#   bash tools/setup/op-token-setup.sh --clipboard  # read the token from the clipboard
#   bash tools/setup/op-token-setup.sh --service <name>   # Keychain item name (default below)
#
# Idempotent: re-running updates the Keychain item in place (`-U`) and rewrites secrets-env.sh.
# macOS only (uses `security`; falls back with a clear message elsewhere — Linux/CI use the
# GitHub-secret path instead, consumed in-step, never base64-printed).

set -euo pipefail

SERVICE="zeta-op-service-account"
SOURCE="dialog"
while [ $# -gt 0 ]; do
  case "$1" in
    --clipboard) SOURCE="clipboard" ;;
    --service) SERVICE="${2:?--service needs a name}"; shift ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
  shift
done

if [ "$(uname -s)" != "Darwin" ]; then
  echo "✗ op-token-setup.sh is macOS-only (uses the Keychain)." >&2
  echo "  On Linux/CI use a GitHub Actions secret (OP_SERVICE_ACCOUNT_TOKEN), consumed" >&2
  echo "  in-step via 1password/load-secrets-action — never base64-printed." >&2
  exit 1
fi

# ── Capture the token WITHOUT echoing it ────────────────────────────
TOKEN=""
if [ "$SOURCE" = "clipboard" ]; then
  TOKEN="$(pbpaste)"
  [ -n "$TOKEN" ] || { echo "✗ clipboard empty" >&2; exit 1; }
else
  # Native secure prompt — hidden answer; token goes straight here, never to the terminal.
  TOKEN="$(osascript <<'OSA' 2>/dev/null || true
text returned of (display dialog "Paste your 1Password service-account token (ops_…). It goes straight to the macOS Keychain — never the terminal or the agent." default answer "" with hidden answer buttons {"Cancel", "Store"} default button "Store" with title "Zeta — store op service-account token")
OSA
)"
  [ -n "$TOKEN" ] || { echo "✗ cancelled / empty (nothing stored)" >&2; exit 1; }
fi

# Validate shape WITHOUT printing the value.
case "$TOKEN" in
  ops_*) : ;;
  *) echo "✗ that doesn't look like a service-account token (expected ops_…); nothing stored." >&2; exit 1 ;;
esac

# ── Store ENCRYPTED in the login Keychain (update in place if present) ──
security add-generic-password -a "$USER" -s "$SERVICE" -U -w "$TOKEN"
unset TOKEN  # drop it from this process ASAP

# ── Wire the runtime FETCH into the managed secrets-env (mode 600) ──
ZETA_ENV_DIR="$HOME/.config/zeta"
SECRETS_ENV="$ZETA_ENV_DIR/secrets-env.sh"
mkdir -p "$ZETA_ENV_DIR"
umask 077
cat > "$SECRETS_ENV" <<EOF
# Zeta managed agent secrets — Keychain-FETCH lines (NOT secrets). mode 600.
# Written by tools/setup/op-token-setup.sh. Sourced by ~/.config/zeta/shellenv.sh.
export OP_SERVICE_ACCOUNT_TOKEN="\$(security find-generic-password -s $SERVICE -w 2>/dev/null)"
EOF
chmod 600 "$SECRETS_ENV"

echo "✓ token stored ENCRYPTED in Keychain (service: $SERVICE) — value never printed."
echo "✓ fetch wired into $SECRETS_ENV (mode 600; holds the fetch command, not the token)."
echo "  New shells get OP_SERVICE_ACCOUNT_TOKEN via profile → shellenv.sh → secrets-env.sh."
echo "  (Re-run tools/setup/common/shellenv.sh once so it sources secrets-env.sh.)"
