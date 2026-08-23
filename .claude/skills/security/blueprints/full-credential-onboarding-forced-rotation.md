# Blueprint: full credential onboarding — one fingerprint, forced rotation from creation

**Carved sentence (Aaron 2026-06-21):** *"Set this whole thing up as a blueprint. We force
rotation support on everything from the beginning and make it easy — so people can't get it
wrong."* Every credential is **born rotatable** (Active + Standby, overlap-window dual-key) — there
is no "add rotation later," because there is no path that creates a non-rotatable credential.

## The principle: rotation is structural, not opt-in

Getting rotation wrong = not doing it. So remove the wrong path: **the only way to create a
credential is the rotatable way.** Each key/cert/token is minted with its **Standby** sibling and
an **overlap window** from day one (the Itron `KeyState` lifecycle: Active · PendingActive ·
PendingInactive · Inactive · Standby). Rotation is then a state transition, never a re-architecture
— and "rotate" is one command, so the easy path IS the correct path.

## The one-fingerprint flow (composes the shipped pieces)

1. **Prereqs** — GitHub (required) + 1Password (strongly encouraged). See
   `onboarding-prerequisites-github-1password.md`.
2. **Vaults (CA → Org → User)** — the generic tier hierarchy (CA=trust root; Org=Lucent/Zeta
   instances; User=aaron/etc.), modeled as the tracked Merkle-over-Z-set OU directory. Each vault
   gets **two** service accounts (Active + Standby) at creation.
3. **Token custody** — capture each token via `op-token-setup.ts` / `secret-clip.sh` (secure
   dialog/clipboard/masked → Keychain, never echoed; opt-in vs auto-export per scope). See
   `op-service-account-token-provisioning.md`.
4. **Keys** — one seed → full HD keychain (SSH/PGP/Nostr/ETH/Solana + PQ); `setup-machine`
   (one fingerprint) realizes CA-if-missing, machine key, signs the N+M cert. Seed → User vault
   (human-viewable); agent never holds the master.
5. **Forced rotation wired in** — every credential created in steps 2–4 is minted **Active +
   Standby**; the overlap-window rotation (`KeyState`) is configured at birth. `rotate <name>`
   promotes Standby→Active, demotes old→PendingInactive→Inactive (a `−1` retraction after the
   window) — **zero downtime**. Functions rotate the same way (codebase on Z-sets).
6. **Teardown** — `teardown.ts` (dry-run default; `--confirm` + biometric) wipes local + repo +
   1Password; proves clean re-onboarding.

## Why "can't get it wrong"

- **No non-rotatable creation path** — the blueprint/scripts only emit Active+Standby credentials.
- **One command to rotate** — easy path = correct path; the overlap window means no flag-day.
- **Reversible** — rotate/rollback are Z-set advance/retract (banana-split for external effects).
- **Verifiable** — Merkle proofs over the directory; biometric consent fail-closed on every mint.
- **Investor-grade** — no long-lived keys, least-privilege vaults, PQ-capable, no vendor lock-in
  (hexagonal ports → DB-as-PKI endgame).

## Composes / anchors

Blueprints: `onboarding-prerequisites-github-1password.md`,
`op-service-account-token-provisioning.md`. Decisions/research (2026-06-21): hexagonal ports,
identity+crypto synthesis, crypto-agile PQ keychain, Itron-KeyState zero-downtime rotation,
identity-directory Merkle-OU graph (CA→Org→User), Durable-Functions-AS-the-DB. Code: `derive.ts`,
`setup-machine`, `ca.ts`, `secret-clip.sh`, `op-token-setup.ts`, `teardown.ts`. Builds:
081KVNXBR4S0 (identity+crypto unify), 081KVNYZXQ60 (crypto-agile), 081KVNTNTDQ0 (vault separation).
