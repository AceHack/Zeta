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
#   - It is NOT hoisted into any shell environment. This script used to write
#     ~/.config/zeta/secrets-env.sh containing a Keychain-fetch that EXPORTED the token,
#     and shellenv.sh sourced that from the user profile — so the 852-byte token sat in
#     the environment of every interactive shell and every process descended from one.
#     "The env file holds only the fetch command, not the value" was true and beside the
#     point: after the fetch runs, the VALUE is in the environment, and an environment
#     variable crosses `exec` regardless of the child's code identity. A signature, a
#     keychain ACL, an IMA appraisal and a TPM seal each bind a secret to a CALLER;
#     an inherited variable has already escaped the question of who the caller is.
#     Removed 2026-08-14 (081M00VMWTB087G0R0026XSWT6); §13 noninterference.
#   - Read at POINT OF USE instead: src/Core.TypeScript/secrets/credential.ts
#       withCredential("zeta-op-service-account", async (token) => …)      # never exported
#       spawnWithCredential("zeta-op-service-account", "OP_SERVICE_ACCOUNT_TOKEN", ["op", …])
#     The second is the only place the token reaches an environment at all: ONE child,
#     ONE exec, gone when it exits — because `op` takes its token from its own env and
#     offers no stdin form. A blast radius of one process, not one session.
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

# ── Retire the ambient hoist if a previous run left one behind ──────
# This is the operator half of 081M00VMWTB087G0R0026XSWT6. The file holds a
# Keychain-FETCH line, not a secret, so removing it destroys nothing — the token
# stays encrypted in the Keychain and is read at point of use from now on.
SECRETS_ENV="$HOME/.config/zeta/secrets-env.sh"
if [ -f "$SECRETS_ENV" ]; then
  rm -f "$SECRETS_ENV"
  echo "✓ removed the ambient hoist $SECRETS_ENV (it held a fetch command, not a secret)."
  echo "  Already-running shells keep the token in their environment until they exit;"
  echo "  open a new shell (or \`unset OP_SERVICE_ACCOUNT_TOKEN\`) to clear it."
fi

echo "✓ token stored ENCRYPTED in Keychain (service: $SERVICE) — value never printed."
echo "✓ NOT exported into any shell environment, by design."
echo "  Read it at point of use:"
echo "    bun -e 'import {withCredential} from \"./src/Core.TypeScript/secrets/credential.ts\";"
echo "            await withCredential(\"$SERVICE\", async (t, u) => console.log(\"len\", u.length))'"
echo "  Run the 1Password CLI with a scoped, one-exec environment:"
echo "    spawnWithCredential(\"$SERVICE\", \"OP_SERVICE_ACCOUNT_TOKEN\", [\"op\", \"whoami\"])"
echo "  (Re-run tools/setup/common/shellenv.sh so the profile stops sourcing the old file.)"
