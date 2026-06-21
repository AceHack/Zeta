<!-- Operator runbook for the pure-key onboarding flow. Captures the actual,
     proven commands (Otto + Aaron, 2026-06-21). Agent-run, operator-approved-via-
     biometric: the agent executes each step; the human's Touch ID / Windows Hello
     is the authorization at every sensitive gate. -->

# Key onboarding runbook — new forks/maintainers & new dev machines

This is the **operator runbook** for setting up identity + access under Zeta's
**pure-key model**. It covers two scenarios:

- **A. A new fork / maintainer standing up their OWN cluster** (their own CA).
- **B. Adding a new dev machine** to an existing cluster.

Everything here is **agent-run, operator-approved-via-biometric**: an agent
executes each step; **you approve every sensitive step with Touch ID / Windows
Hello** (fail-closed — decline and nothing happens). Private keys and seeds never
leave the local host and never enter git; only **public keys and certs** are
committed.

---

## The model in one paragraph (why it's shaped this way)

Keys are **pure**, scaling **O(users + machines)** — not O(users × machines):

| Layer | What it is | Where | Names a user? a machine? |
|---|---|---|---|
| **User key** | a person's identity (seed-derived, HD `m/44'/1110'/0'/0'`) | `maintainers/<user>/` (keyring) | user only |
| **Machine key** | a host's identity | `machines/<host>.pub` (user-independent) | machine only |
| **CA cert** | the **(user × machine) binding** | minted on demand, short-lived | **both** — the ONLY place the pair is named |

Nodes trust **one CA public key** (`TrustedUserCAKeys`). The CA signs a cert
(`principal=<user>` over a machine key) — so 3 users × 10 machines = **13 keys +
certs**, never 30 hybrid `user@machine` keys. *Never* bake a user into a machine
key's label; that's the anti-pattern this model exists to avoid.

---

## Scenario A — new fork / maintainer with their own cluster

You become your own trust root. ~4 steps; you Touch-ID the CA generation.

1. **Your user identity (persona keyring).** One seed → all your key types
   (SSH/PGP/Nostr/…), type-separated. Seed is shown once (write it on paper);
   it never touches git.
   ```bash
   tools/setup/persona-keys/keyring.sh rotate <you>     # you pick + hold the seed
   # (Otto-bootstrap variant: keyring.sh generate <you>, then rotate to self-custody)
   ```
   → publishes your PUBLIC identity to `maintainers/<you>/` (commit it).

2. **Your cluster's SSH CA** (the fleet trust root). Generates a CA keypair;
   private stays local under `umask 077`, only the public key is written.
   ```bash
   bun tools/setup/persona-keys/ca-cli.ts ca --ca <yourorg> --commit-pub   # 🔐 Touch ID
   ```
   → CA **private** at `~/.config/zeta/ca/ssh_ca_ed25519` (**never commit**);
   CA **public** at `maintainers/<yourorg>/ssh-ca.pub` (commit it — the trust anchor).
   *Custody:* you hold the CA private now (operator = trust root); Vault takes
   custody later (same trust shape, automation upgrade only).

3. **Wire the CA into node trust.** Point `TrustedUserCAKeys` at the committed CA
   pubkey via `full-ai-cluster/nixos/modules/ssh-ca.nix` (it's `pathExists`-guarded
   + inert until the pubkey exists; import it into your node config to activate).
   Now every node trusts your one CA — no per-machine `authorizedKeys` lists.

4. **Add your users.** Each maintainer runs step 1 (their own keyring). They get
   access to a machine via a CA-signed cert (Scenario B step 2), not by being
   added to every node.

---

## Scenario B — add a new dev machine (existing cluster)

Run on the new machine. Two Touch-ID taps.

1. **Generate this host's pure machine key** (+ the user×machine presence check).
   ```bash
   bun tools/setup/persona-keys/onboard-cli.ts --user <you>          # 🔐 Touch ID
   # preview first with --dry-run (prompts/writes nothing)
   ```
   → machine key label `<host> (zeta-machine)` (**no `user@`**); private at
   `~/.config/zeta/machine/id_ed25519` (local, `umask 077`); **public** registered
   at `machines/<host>.pub` (commit it). Note: a machine key is **not** a GitHub
   user key, so it is **not** pushed to anyone's GitHub account.

2. **Bind your user to the machine — sign a cert with the CA.**
   ```bash
   bun tools/setup/persona-keys/ca-cli.ts cert --user <you> --machine <host>   # 🔐 Touch ID
   # default validity +52w (the rolling-keys window); override with --validity
   ```
   → a `<host>-cert.pub` (`principal=<you>`) — present this with the machine key
   when you SSH. Nodes trust the CA → validate the cert → grant access **as `<you>`**,
   while the key on the wire is the **machine's** (per-machine revocation).

3. **Publish YOUR user key to GitHub** (once per person, not per machine), if you
   push from this box:
   ```bash
   bun tools/setup/persona-keys/publish-cli.ts --key <your-user-pub> --user <you>  # 🔐 Touch ID
   ```

---

## Security invariants (hold these)

- **Seeds + private keys + the CA private key are local-only, `umask 077`, NEVER
  committed.** Only public keys + certs (both public) go to git.
- **Every sensitive op is biometric-gated + fail-closed** — no key/cert is
  generated, signed, or uploaded without a Touch ID / Windows Hello approval.
- **No `user@machine` hybrid keys.** User and machine keys are pure; the cert is
  the only place the pair is named.

## Cleanup / rotation / revocation

- **Re-key a machine:** delete `~/.config/zeta/machine/`, remove
  `machines/<host>.pub`, re-run Scenario B. (Revoke any uploaded GitHub key with
  `gh ssh-key delete <id>` first.)
- **Revoke a user's access to a machine:** let its cert expire (short validity) or
  re-issue the fleet's certs without it; the machine key itself need not change.
- **Rotate the CA:** regenerate (step A2) + re-sign outstanding certs; nodes pick
  up the new CA pubkey via `ssh-ca.nix`.

## Pointers

- Pure-key-model rationale + the O(users+machines) argument: PR #8933.
- The tooling: `machine.ts` (pure machine key), `ca.ts` (CA + `signMachineCert`),
  `onboard.ts` (the orchestrator), `publish.ts` (biometric GitHub publish),
  `biometric.ts` (the shared Touch-ID/Hello gate).
- In-cluster future: Vault (CA custody) + cert-manager (issuance/rotation) +
  Headscale (network ACL) — same trust shape, custody/automation upgrade only.
