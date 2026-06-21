---
id: 081KVM1TK3Z08QG0R0002959G6
type: task
state: backlog
priority: P1
slug: unified-key-onboarding-one-generator-per-persona-per-machine
title: "Unified key onboarding — one generator, per-persona + per-machine keys, for new contributors and agents"
created: 2026-06-21T02:58:14.783Z
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
**automatically**, in-flow — they shouldn't have to know the keyring exists. When zflash runs and the
operator is not already set up:

1. **Generate the full keyset for them** (seed → persona 4×4 rolling keyset + per-machine key) via the
   persona-keys generator.
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
