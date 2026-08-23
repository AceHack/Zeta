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
bun tools/setup/op-token-setup.ts             # native secure dialog (hidden input)
#   or
bun tools/setup/op-token-setup.ts --clipboard # read from the clipboard
bun tools/setup/op-token-setup.ts --check     # presence + length only, no write
```

That command (idempotent, macOS): captures the `ops_…` token via an `osascript`
hidden-answer dialog or `pbpaste`, validates the prefix **without echoing**, and stores it
ENCRYPTED in the login Keychain. The write goes through `security -i`, so the token crosses
on **stdin** and never appears in an argv — `security add-generic-password … -w "$TOKEN"`
put it in `ps` output for the life of the call, which is why the `.sh` this replaced was
sequenced for conversion (`docs/SHELL-DEPRECATION-SEQUENCE.md`). `security -i` exits 0 even
on failure, so success is decided by **reading the item back**, never by an exit status.

**There is no env file and no `shellenv.sh` step.** Two earlier revisions of this blueprint
told the operator to regenerate `~/.config/zeta/secrets-env.sh` so every shell would export
`OP_SERVICE_ACCOUNT_TOKEN`. That hoist was **removed 2026-08-14**
(`081M00VMWTB087G0R0026XSWT6`): an environment variable crosses `exec` regardless of the
child's code identity, so it is the one exposure a signature, a keychain ACL, an IMA
appraisal or a TPM seal cannot gate. The token is read **at point of use** instead:

```ts
import { withCredential, spawnWithCredential } from "./src/Core.TypeScript/secrets/credential.ts";
await withCredential("zeta-op-service-account", async (token, use) => { /* … */ });
await spawnWithCredential("zeta-op-service-account", "OP_SERVICE_ACCOUNT_TOKEN", ["op", "whoami"]);
```

`spawnWithCredential` is the only site where the token reaches an environment at all — one
child, one exec, gone when it exits, because `op` offers no stdin form.

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
Reuses: `tools/setup/op-token-setup.ts` (+ `op-token-setup.test.ts`, the falsifiers for
no-stdout / no-argv / no-env), `src/Core.TypeScript/secrets/credential.ts`,
`src/Core.TypeScript/secrets/keychain-macos.ts`.
