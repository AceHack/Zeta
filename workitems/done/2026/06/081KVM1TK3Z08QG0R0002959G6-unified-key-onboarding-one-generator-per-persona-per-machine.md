---
id: 081KVM1TK3Z08QG0R0002959G6
type: task
state: done
priority: P1
slug: unified-key-onboarding-one-generator-per-persona-per-machine
title: "Unified key onboarding — one generator, per-persona + per-machine keys, for new contributors and agents"
created: 2026-06-21T02:58:14.783Z
completed: 2026-06-21T04:49:42.888Z
depends_on: []
composes_with: ["081KSGS9H0008QG0R002T3BJ2R"]
---

# Unified key onboarding — one generator, per-persona + per-machine keys, for new contributors and agents

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KVM1TK3Z08QG0R0002959G6-*.md` glob. -->

## Why this exists (Aaron, 2026-06-20)

The key/identity setup is **scattered** across several surfaces, and a discrepancy audit (Otto,
2026-06-20) found **three unreconciled SSH keys** for the same operator:

1. **ad-hoc local** `~/.ssh/id_ed25519` (`SHA256:XxMOZ…`, `aaron_bond@yahoo.com`) — what zflash injects
   into a flashed USB ESP at flash time;
2. **registered persona/PKI** (`SHA256:7DS+…`, HD-derived) in `maintainers/aaron/keyring-public.json`;
3. **published operator** key (`aaron@lucent.financial`) in `maintainers/aaron/ssh-pubkeys.txt` +
   `full-ai-cluster/nixos/modules/operator-ssh-keys.txt` (baked into every node, pub. 2026-06-09).

These don't match → a freshly-flashed node trusts the ad-hoc key, not the canonical identity.
**Goal:** ONE easy generator so new contributors AND agents can set up keys, with **per-persona vs
per-machine made explicit** and known — no more floating ad-hoc keys.

## The two axes (the core model)

- **Per-PERSONA (identity, machine-independent):** seed-derived along HD paths
  (`m/44'/1110'/0'/0'` ssh, `…/1111'` pgp, `…/1237'` nostr, eth/btc/sol), the **rolling 4×4 keyset
  ("two of every key type" for rotation)**, registered as the persona's public trust roots in
  `maintainers/<persona>/keyring-public.json` + `ssh-pubkeys.txt`. Same identity on every machine;
  rotatable. Applies to humans (aaron, addison) AND agents (otto, amara, ani, alexa) identically.
- **Per-MACHINE (device, persona-bound):** a device key (derived per-machine for SSH from the PKI base,
  or a per-host keypair) that identifies the **machine**, traceable to its persona — what zflash
  injects + `operator-ssh-keys` bakes into node trust. This is the layer that was being filled ad-hoc.
  **Two machine kinds — both are registered identities (Aaron, 2026-06-20):**
  - **dev machines (flashers)** — the machine you flash *from*. A user has **many** (Aaron has ~4 dev
    machines that are **not** part of the cluster), and may flash from any of them. Each dev machine
    needs its **own** registered machine key, even though it never joins the cluster.
  - **cluster nodes (flash targets)** — the machine you flash *to* / boot. The booted node's machine
    key + the operator's user key go into node trust.
  So **machine identity ≠ cluster membership**: a registered machine can be a flasher-only dev box.
  The `(user × machine)` pair is the unit — same user, different dev machine ⇒ a new machine key.

## Trust distribution — don't list every dev machine on every node (Aaron, 2026-06-20)

**The problem (Aaron spotted it):** when you `ssh A→B`, B authenticates the **pubkey A presents**
against B's `authorizedKeys.keys`. Today every node carries a **list** of trusted pubkeys (confirmed:
`full-ai-cluster/nixos/modules/operator-ssh-keys.nix` → `users.users.zeta.openssh.authorizedKeys.keys`;
**no SSH CA**). With many dev machines that's the **N×M trap**: every node must list every dev machine
independently. Two cooperating fixes, both **centralized (no per-node lists)**:

- **SSH Certificate Authority (auth plane).** Nodes trust **one CA pubkey** (`TrustedUserCAKeys`); each
  dev machine's key is **signed into a cert** carrying `principal=aaron` (+ machine id + a validity
  window = the rolling-keys discipline). Result: trust anchored at the **user** (one CA per node) AND
  per-**machine** identity + per-machine revocation. The persona PKI/keyring is the CA. → `N`-trust-`1`,
  not `N×M`. Answers "user vs user×machine": **the cert binds the user (principal), the key stays
  per-machine.**
- **Headscale (network plane — already deployed: `k8s/applications/headscale/`).** Each dev machine
  **enrolls once**, tagged by owner (`tag:aaron-dev`) — that node registry **is** the per-dev-machine
  registry. One tag-based **ACL** (`tag:aaron-dev → cluster:22`) grants reachability for all your dev
  machines without editing any node. **Tailscale/Headscale SSH** can even terminate the session on the
  tailnet identity + ACL (no SSH keys for that path), or compose with the SSH-CA for user-auth.

Net: **Headscale = reachability + per-machine enrollment tagged by user; SSH-CA (or Tailscale-SSH) =
user auth.** Retire the per-node `authorizedKeys.keys` lists — that's the only model that forces
"every machine trusts every dev machine independently."

### Pre-cluster bootstrap with just git/GitHub — "can we fake a CA?" (Aaron, 2026-06-20)

In-cluster the real PKI is **Vault** (CA custody) + **cert-manager** (issuance/rotation) + Headscale
(ACL). **Before** the cluster exists, you don't *fake* a CA — you run a **real but minimal** one whose
trust is distributed through git/GitHub, and it's **forward-compatible** (same trust *model*, only
custody/automation upgrade later):

- **Option A — GitHub as IdP + key directory (zero CA, simplest).** GitHub already publishes every
  user's keys at `https://github.com/<user>.keys` (SSH) and `.gpg`. Trust = **org membership** + the
  published `.keys`; `install.sh`/nix pulls authorized keys from GitHub (`ssh-import-id gh:<user>` or
  curl). Good enough to bootstrap; no CA to run.
- **Option B — real SSH CA, git-distributed (the forward-compatible one).** A genuine SSH-CA keypair
  (operator-held / **seed-derived** via the persona HD path); the CA **public** key is **committed to
  git** → fed to `TrustedUserCAKeys`; sign per-machine certs locally with `ssh-keygen -s`. Nodes (even
  pre-cluster, via the nix config pulled from git) trust the one CA. **git is the distribution channel,
  not the secret store** — the CA *private* key never lands in git.
- **Git-native attestation** underpins both: **SSH-signed commits** (`gpg.format=ssh`) +
  a committed **`allowed_signers`** / the `maintainers/<persona>/keyring-public.json` registry = the
  git-native "is this key a trusted maintainer's" check (the repo's signed history is the attestation
  chain — the "GitHub border as trust bootstrap" mode).
- **Migration (no model change):** git-distributed CA pubkey + GitHub `.keys` **now** → **Vault** takes
  custody of the CA private key + **cert-manager** automates issuance/rotation + **Headscale** ACLs
  **in-cluster**. The trust *shape* (trust-the-CA, per-machine certs, tag-by-user) is identical; only
  custody + automation upgrade. So **Option B built now is not throwaway** — Vault/cert-manager assume
  the CA role the git-distributed CA already established. Anchor:
  `docs/research/2026-06-09-identity-trust-and-network-plane-two-modes-equipment-vault-headscale-vs-github-free-secrets-tailscale-github-trust-bootstrap-pluggable-idp.md`
  (the two trust modes: equipment-Vault-Headscale vs GitHub-free-secrets).

## What to combine (the scattered pieces today)

- **Generator:** `tools/setup/persona-keys/` — `gen.ts` / `derive.ts` / `keyset.ts` / `keyring.sh` /
  `keyring-4x4.ts` (the 4×4 rolling layout) + `keyring.rotate.test.ts` + `keyring.dst1000.test.ts` +
  golden vectors (seed → all keys, deterministic, DST-replayable).
- **Registry/publish:** `maintainers/<persona>/{keyring-public.json, ssh-pubkeys.txt, gpg-pubkey.asc}`.
- **Node trust:** `full-ai-cluster/nixos/modules/operator-ssh-keys.{nix,txt}` + `keyring-dst1000.yml`.
- **Provisioning:** zflash ESP pubkey injection (`src/Core.TypeScript/zflash/cli.ts`) + `install.sh`
  (`tools/setup/`) — should pull the *derived/published* key, not an ad-hoc `id_ed25519`.

## Canonical-email cleanup (Aaron, 2026-06-20)

- **`aaron@lucent.financial` is now the canonical operator email** (working) — and it is **already the
  published key** in `ssh-pubkeys.txt` / `operator-ssh-keys.txt`. So the reconciliation is: **retire /
  re-point the ad-hoc `aaron_bond@yahoo.com` `id_ed25519`** (the floating one) onto the canonical
  `aaron@lucent.financial` identity (either derive it via the persona-keys generator, or publish the
  intended device key under `aaron@lucent.financial`).
- **Optional:** standardize git author identity (`git config user.email`) → `aaron@lucent.financial`
  so commit attribution matches the keyring identity. (Operator's call — identity change.)

## First-run auto-provisioning AT FLASH TIME (Aaron, 2026-06-20)

The load-bearing UX: a **first-time** zflash user who has **no saved keys yet** must be provisioned
**automatically**, in-flow — they shouldn't have to know the keyring exists. When zflash runs it
**checks the `(user, machine)` pair independently** and creates whichever is missing **before
flashing**:

0. **Two-part presence check (the gate):** is the **user key** present (this operator's persona
   keyring)? is the **machine key** present (this *dev machine's* device key)? Either missing →
   create it. Because a user flashes from **several different dev machines**, the user key is often
   already set up while *this* dev machine's key is not (new flasher box) — so check + create each
   independently, not all-or-nothing.
1. **Generate whatever's missing** — user keyset (seed → persona 4×4 rolling keyset) and/or this dev
   machine's per-machine key — via the persona-keys generator.
2. **Save it to their local PC** (seed/private keys land in their local secret store, e.g.
   `~/.config/zeta/...`; never committed).
3. **Set up their GitHub account** — `gh auth login` + upload/register their SSH (and signing) pubkey
   to their GH account, so git/SSH-to-GitHub works immediately. (Prior art: gh-auth-at-install,
   PR-5210 "homelab gh-auth-login operator-pubkey-copy at install time"; `081KSGS9H0008QG0R00120EEHM`.)
4. **Register the user with Zeta** — publish their public trust roots to `maintainers/<user>/`
   (`keyring-public.json` + `ssh-pubkeys.txt`) so every node trusts them.
5. **Inject into the flash** — the freshly-generated per-machine key goes into the USB ESP +
   `operator-ssh-keys`, so the booted node trusts the *canonical generated* key (not an ad-hoc one).

**Two timings, same generator:**

- **Pre-flash** (preferred): set keys up *before* flashing (run `zeta keys onboard` first), so the
  flash just consumes already-registered keys.
- **During-flash** (fallback): if keys aren't present when zflash runs, it provisions them inline
  (steps 1–5) as part of the flash — no separate step required, first-timer just runs zflash.

> **CURRENT STATE — honest (Aaron, 2026-06-20): this is NOT built yet.** Keys have been set up
> **manually / ad-hoc** so far ("just messing around"). The few published pubkeys (e.g. Aaron PR-7249,
> Addison PR-7250 — operator pubkey baked into node trust) were done **by hand, not via this
> auto-flow** — neither Max nor Addison has gone through an automated first-run provision. This item is
> the TARGET we are **working toward**: generalized + automated for any new contributor/agent,
> idempotent (re-running a provisioned user is a no-op / detects existing keys).

## Scope (design-first; KEYS ARE SECRET — operator-run)

1. **Design the unified flow**: one command (extend `keyring.sh` / a `zeta keys onboard`) that, from a
   seed, (a) derives the persona keyset (4×4 rolling), (b) writes the public trust roots to
   `maintainers/<persona>/`, (c) derives/registers the per-machine key, (d) feeds zflash + node trust —
   with a clear `whoami`-style readout of "this key = persona X on machine Y."
2. **First-run auto-provisioning at flash time** (above): zflash detects no-keys → generate + save
   local + GH-auth + register-with-Zeta + inject; pre-flash or during-flash; idempotent.
3. **Reconcile the existing 3-key state** for aaron onto `aaron@lucent.financial` (cleanup).
4. **One flow for humans + agents** (personas otto/amara/ani/alexa already have keyrings — same path).

*Honest scope:* this touches **seeds/secrets**. **Today** generation is operator-run (humans hold the
seeds), and this is **not built yet** (manual/ad-hoc). **Trajectory (Aaron, 2026-06-20): agents WILL
hold their own seeds** — durable-agent identity is the direction (m/acc; each persona — otto/amara/ani/
alexa — already has its own keyring), so design the flow for **agent-held seeds as a first-class case**,
not just operator-run. The immediate deliverable here is the unified-flow design + the reconciliation
plan; the generation + git/email change are operator-run *for now*.

## Composition

- `composes_with` `081KSGS9H0008QG0R002T3BJ2R` (iter-4 ssh-key + hashedpassword substrate for cluster
  bring-up).
- Relates to: the zflash TS/FS iso-usb consolidation (UX note 2026-06-20) and the MCU/ESP32 fleet item
  `081KVM04R4T08QG0R003AZ0E6K` (those nodes also need the per-machine key story).
