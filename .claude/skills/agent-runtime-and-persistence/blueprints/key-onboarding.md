---
name: key-onboarding
description: Agent procedure to onboard a maintainer/fork (their own CA) or a new dev machine under the pure-key model. The AGENT executes every step; the maintainer's Touch ID / Windows Hello is the authorization at each sensitive gate (operator-approved, not operator-run).
---

# Key onboarding (agent-run, operator-approved)

How an agent sets up identity + access for a maintainer **for** them, under the
pure-key model. You (the agent) run the commands; the maintainer **approves each
sensitive step with a biometric** (fail-closed). The human-facing version is
`tools/setup/persona-keys/ONBOARDING-RUNBOOK.md` — point the maintainer there;
this blueprint is *your* procedure.

## When to use

- A new fork / maintainer wants their own cluster (stand up their CA + identity).
- A new dev machine is being added (machine key + a cert binding the user).
- The maintainer says "set up my keys / do the onboarding for me."

## The model you are enforcing

Pure keys, **O(users + machines)**: **user key** (identity, `maintainers/<user>/`)
+ **machine key** (host identity, `machines/<host>.pub`, user-independent) +
**CA cert** (the ONLY place the user×machine pair is named). Nodes trust **one CA
pubkey** (`TrustedUserCAKeys`). NEVER a `user@machine` hybrid key.

## Procedure — new fork / maintainer (own cluster)

1. **User identity** — the maintainer runs `keyring.sh rotate <them>` (they pick +
   hold the seed; seed shown once, never to git). You do NOT run seed-gen or touch
   the seed. Commit the published `maintainers/<them>/` PUBLIC artifacts.
2. **CA** — `bun tools/setup/persona-keys/ca-cli.ts ca --ca <org> --commit-pub`
   → maintainer Touch-IDs. CA private stays local (`~/.config/zeta/ca/`, `umask 077`,
   never commit); commit only `maintainers/<org>/ssh-ca.pub`.
3. **Wire trust** — point `TrustedUserCAKeys` at the CA pubkey via
   `full-ai-cluster/nixos/modules/ssh-ca.nix` (pathExists-guarded; import to activate).

## Procedure — new dev machine

1. `bun tools/setup/persona-keys/onboard-cli.ts --user <them>` → Touch ID. Generates
   the **pure** machine key (`<host> (zeta-machine)`, no `user@`), private local,
   public at `machines/<host>.pub`. Commit the pubkey. (Dry-run first: `--dry-run`.)
2. `bun tools/setup/persona-keys/ca-cli.ts cert --user <them> --machine <host>`
   → Touch ID. Mints the cert (`principal=<them>`) binding them to the box.
3. If they push from this box: `publish-cli.ts --key <their-user-pub> --user <them>`
   → Touch ID (publishes the USER key, never the machine key).

## Hard rules (do not violate)

- **Seeds + private keys + CA-private are local-only, never committed.** Only public
  keys + certs go to git. Grep your commit for `BEGIN.*PRIVATE KEY` — must be empty.
- **Every sensitive op is biometric-gated + fail-closed.** Do not bypass the gate,
  do not fall back to a password. If `pam_tid.so` is absent from `/etc/pam.d/sudo`,
  the gate fails closed — fix that first (see `biometric-sudo-handler`).
- **Pure keys only** — no `user@machine` label, machine registry is user-independent
  (`machines/<host>.pub`, NOT `maintainers/<user>/machines/`).
- **You execute; the human approves.** Never generate the maintainer's seed for them
  silently; instruct the keyring step. The biometric IS their authorization.

## Verify on land (before trusting)

- Committed file is a PUBLIC key/cert only (`grep BEGIN.*PRIVATE KEY` empty).
- Machine key label has no `user@`; registered under `machines/`.
- CA private exists ONLY at `~/.config/zeta/ca/`, never in the diff.
- If you published to GitHub: `gh ssh-key list` shows the intended key; nothing stale.

## Cleanup / back-out

- Wrong key shipped: `gh ssh-key delete <id>` (if uploaded), delete the local private,
  revert the registration commit, re-run. (Pattern proven: #8926 → #8928.)

## Pointers

- Human guide: `tools/setup/persona-keys/ONBOARDING-RUNBOOK.md`
- Tooling: `machine.ts` / `ca.ts` / `onboard.ts` / `publish.ts` / `biometric.ts`
- Rationale (O(users+machines), pure model): PR #8933 · biometric gate: PR #8887
- Sibling blueprint: `biometric-sudo-handler` (the Touch-ID/PAM gate this relies on)
