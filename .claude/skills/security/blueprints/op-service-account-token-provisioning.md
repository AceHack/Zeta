# Blueprint: provision a 1Password service-account token for the agent (secure, reusable)

**Purpose:** give an agent scoped, revocable 1Password access **without the agent ever
seeing the token in its context/transcript**, on a machine with no desktop-app integration.
The agent EXECUTES; the operator pastes the token into a native secure dialog (or has it on
the clipboard); the token flows window/clipboard → macOS Keychain → runtime fetch. Aaron
2026-06-21: *"reusable workflow/blueprint … pop up a secure window for me to type it in and
you do everything … reuse our profile-edit scripts."*

## When to use

A dev/build machine needs `op` (1Password CLI) access for the agent, the desktop-app
integration (Touch ID, token-free) is not enabled, and you want encrypted-at-rest custody
of the service-account token (not a plaintext dotfile, not base64-in-a-workflow).

## The one move

```bash
# operator creates the service account on 1password.com (Developer → Service Accounts),
# scoped to ONE vault (least-privilege), then either copies the token to the clipboard OR
# is ready to paste it into the secure dialog. Then the AGENT runs:
bash tools/setup/op-token-setup.sh             # native secure dialog (hidden input)
#   or
bash tools/setup/op-token-setup.sh --clipboard # read from the clipboard
bash tools/setup/common/shellenv.sh            # regen so shellenv sources secrets-env.sh
```

That script (idempotent, macOS): captures the `ops_…` token via `osascript` hidden-answer
dialog or `pbpaste`, validates the prefix **without echoing**, stores it ENCRYPTED in the
login Keychain (`security add-generic-password -U`), and writes the runtime FETCH line to
`~/.config/zeta/secrets-env.sh` (mode 600) — `export OP_SERVICE_ACCOUNT_TOKEN="$(security
find-generic-password -s zeta-op-service-account -w)"`. The managed `shellenv.sh` (already
sourced by the profile via `profile-edit.sh`) sources `secrets-env.sh`, so every shell —
including the agent's fresh subprocesses — gets the scoped token from the Keychain.

## Security invariants (why an agent may run this)

- **Token never enters the agent's context/transcript.** Capture is window/clipboard →
  Keychain inside the script subprocess; the agent must NOT use its own ask/question tool for
  a secret (that would transcript it). The native secure dialog is the "popup."
- **Encrypted at rest** (Keychain), **in-process only at use** (`export` is `export` — the
  plaintext window is minimized, never persisted to a dotfile). The repo holds only the
  mechanism; `secrets-env.sh` lives in `~/.config`, never committed.
- **Least-privilege + revocable**: scope the service account to ONE vault; delete it to
  revoke instantly.
- **NEVER** store/recover the token via `base64`-print in a CI log (trust-leak anti-pattern).
  CI uses a GitHub Actions secret consumed in-step via `1password/load-secrets-action`.

## Verify

```bash
op whoami                      # User Type: SERVICE_ACCOUNT
op vault list                  # shows ONLY the scoped vault
op item list --vault <vault>   # the granted items; nothing else
```

## Paths to the better, token-free custody (later)

- **Desktop-app integration** (dev): Touch ID, no token at rest at all.
- **Vault + cert-manager** (cluster): short-lived issuance, HSM custody.

See `docs/research/2026-06-21-config-and-secrets-as-event-sourced-zset-dbsp-…` (custody +
the event-sourced direction) and the `cluster-encryption-credential-substrate` trajectory.
Reuses: `tools/setup/op-token-setup.sh`, `tools/setup/common/shellenv.sh`,
`tools/setup/common/profile-edit.sh`.
