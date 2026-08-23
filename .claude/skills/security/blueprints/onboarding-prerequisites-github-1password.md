# Blueprint: onboarding prerequisites — GitHub + 1Password (the current supported baseline)

**Carved sentence (Aaron 2026-06-21):** *"you need GitHub and 1Password — 1Password optional but
STRONGLY encouraged, or else all your keys are local — for now, until we support more. We can
count on these. We'll have our own cluster password manager + identity-management PKI eventually."*

## The two deps a maintainer/agent needs to onboard, today

1. **GitHub — REQUIRED.** The public trust + distribution channel: the CA *public* key and user
   *public* keys/certs are registered/distributed via the repo (`maintainers/<user>/`, `machines/`),
   and the automation/PRs run through it. Without GitHub you can't register or distribute trust.
2. **1Password — STRONGLY ENCOURAGED (optional).** The secret-custody layer. **Without it, every
   private key stays LOCAL ONLY** (mode-600 files: CA key, machine key, your SSH/GPG) — no backup,
   no recovery, no cross-machine custody, no agent access. With it: keys are encrypted at rest in
   scoped vaults, recoverable, and the agent gets least-privilege access via a service-account token.
   You CAN run fully local (keys never leave the machine) — you just lose backup/recovery/sharing.

These two are the baseline we **can count on now**. Everything else (cluster password manager,
PKI/identity) is future (see end).

## The onboarding flow (each step reuses shipped tooling)

1. **Install** — `tools/setup/install.sh` (macOS: `macos.sh`). mise pins `1password-cli` (`op`)
   cross-OS; brew-cask framework for any mac GUI app.
2. **1Password access** — create a scoped **service account** per vault on 1password.com; capture
   the token with `bun tools/setup/op-token-setup.ts` (secure dialog / clipboard → Keychain, never
   echoed) or the generic `secret-clip.sh set <name>`. Token encrypted at rest; opt-in or
   auto-exported via `~/.config/zeta/secrets-env.sh`.
3. **Keys** — `setup-machine` (one fingerprint): realizes a CA if missing, generates the machine
   key, signs the cert (N+M: Key ID = machine, `principal=<user>`). `setup-cluster` for a CA +
   cross-cluster trust.
4. **Register PUBLIC material on GitHub** — CA pubkey → `maintainers/<ca>/ssh-ca.pub`; machine
   pubkey → `machines/<host>.pub`; user key publish via `publish-cli.ts` (biometric-gated,
   title `<user> (zeta)` — no `@host`).
5. **Custody PRIVATE material in 1Password** (if using it) — `op document create <file> --vault …`
   into the right vault per the separation: shared/infra → an agent-readable vault; the human's
   GPG/SSH/derivation-seed → a human-only vault. **Machine keys: never uploaded** (regenerable).

## Vault separation (the minimum, today)

Two vaults: **shared/work** (agent-readable; CA key may sit here under full-trust bootstrap) and
**personal** (the human's GPG/SSH/derivation seed — ideally human-only). See workitem
081KVNTNTDQ08QG0R0017NBBWB for the least-privilege end-state (trust-root + seed out of any
agent-readable vault; per-secret-class scoping; mirrored on Bitwarden).

## The future (what replaces these deps)

- **Our own cluster password manager** — self-hosted Vaultwarden/Bitwarden via ArgoCD
  (081KVNMFYS808QG0R002D0VM64) — so custody isn't a SaaS dependency.
- **Identity management + PKI** — HashiCorp Vault (SSH secrets engine, short-lived certs) +
  cert-manager issuance/rotation; the desktop-app/Secure-Enclave biometric path removes tokens.
- Same trust model throughout (the bootstrap shape == the cluster shape) — migration is a custody
  swap, not a redesign.

## Anchors / reuse

`tools/setup/op-token-setup.ts`, `tools/setup/secret-clip.sh`, `setup-machine`/`setup-cluster`,
`publish-cli.ts`, `ONBOARDING-RUNBOOK.md`. Blueprints: `op-service-account-token-provisioning.md`,
`key-onboarding.md`. Trajectory: cluster-encryption-credential-substrate.
