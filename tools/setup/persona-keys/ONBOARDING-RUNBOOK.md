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

| Layer           | What it is                                                 | Where                                    | Names a user? a machine?                    |
| --------------- | ---------------------------------------------------------- | ---------------------------------------- | ------------------------------------------- |
| **User key**    | a person's identity (seed-derived, HD `m/44'/1110'/0'/0'`) | `maintainers/<user>/` (keyring)          | user only                                   |
| **Machine key** | a host's identity                                          | `machines/<host>.pub` (user-independent) | machine only                                |
| **CA cert**     | the **(user × machine) binding**                           | minted on demand, short-lived            | **both** — the ONLY place the pair is named |

Nodes trust **one CA public key** (`TrustedUserCAKeys`). The CA signs a cert
(`principal=<user>` over a machine key) — so 3 users × 10 machines = **13 keys +
certs**, never 30 hybrid `user@machine` keys. _Never_ bake a user into a machine
key's label; that's the anti-pattern this model exists to avoid.

---

## One command, one fingerprint (the easy path)

The multi-step flows below are wrapped by **two top-level commands**, each gated by
**ONE** biometric approval that covers the whole sequence (Aaron 2026-06-21: _"should
be ONE like fingerprint … too many steps and easy to get wrong"_). One Touch ID /
Windows Hello press up front, then every sub-step runs under that single approval —
**fail-closed** (decline → nothing runs; the gates are shared, never bypassed).

- **New machine / maintainer on an existing cluster:**

  ```bash
  bun tools/setup/persona-keys/setup-machine-cli.ts --user <you>     # 🔐 ONE Touch ID
  # preview with --dry-run (prompts/writes/generates/fetches NOTHING)
  ```

  One approval covers: status → user-keyring check (instruction if missing) →
  machine key → trust-resolve → **realize a local CA if none exists, then auto cert-sign**
  (no `--sign-with-ca` flag). If a CA is already configured it signs against it (idempotent —
  the CA is never re-created); if **no local CA** exists, setup **realizes one** under the
  _same_ approval (no second prompt) so a fresh host ends with CA + machine key + cert in one
  step. Fail-closed: decline → nothing realized. _Deferred:_ if this host is **joining** an
  existing cluster whose CA lives elsewhere, sign via the CA holder instead — the readout names
  the realized local CA so you can re-home it.

- **Stand up a new cluster's trust root (+ cross-cluster trust):**
  ```bash
  bun tools/setup/persona-keys/setup-cluster-cli.ts --ca <yourorg>   # 🔐 ONE Touch ID
  # trust a peer cluster's CA too (PUBLIC key only, repeatable):
  bun tools/setup/persona-keys/setup-cluster-cli.ts --ca <yourorg> --trust-peer <peer-ca.pub>
  ```
  One approval generates the CA, then **renders** (never destructively activates) the
  multi-CA `TrustedUserCAKeys` trust set: this cluster's CA pubkey **plus** any peer
  CA pubkeys. **Cross-cluster trust** = a node trusts a cert signed by ANY listed CA;
  add a peer's CA **public** key to trust that peer (the CA private key never leaves
  its origin host). You commit + import the rendered file; the command never runs
  `nixos-rebuild`.

These thin wrappers reuse the same modules as the granular steps below
(`machine.ts`, `ca.ts`, `onboard.ts`, `biometric.ts`) — they add only the
**one-approval session** (`sessionBiometric`) and the trust-set rendering. The
granular `ca-cli.ts` / `onboard-cli.ts` paths remain for when you want a single step.

> **Future custody:** these scripts are the **pre-cluster** form. Vault (CA custody)
> and cert-manager (cert issuance/rotation) take over later — **same trust shape**, an
> automation/custody upgrade only.

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
   _Custody:_ you hold the CA private now (operator = trust root); Vault takes
   custody later (same trust shape, automation upgrade only).

3. **Wire the CA into node trust.** Point `TrustedUserCAKeys` at the committed CA
   pubkey via `full-ai-cluster/nixos/modules/ssh-ca.nix` (it's `pathExists`-guarded
   and inert until the pubkey exists; import it into your node config to activate).
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
  `biometric.ts` (the shared Touch-ID/Hello gate + `sessionBiometric` one-approval).
- One-command wrappers: `setup-machine.ts` / `setup-machine-cli.ts` (one-fingerprint
  machine setup), `setup-cluster.ts` / `setup-cluster-cli.ts` (one-fingerprint cluster
  trust root + cross-cluster `--trust-peer`).
- In-cluster future: Vault (CA custody) + cert-manager (issuance/rotation) +
  Headscale (network ACL) — same trust shape, custody/automation upgrade only.
