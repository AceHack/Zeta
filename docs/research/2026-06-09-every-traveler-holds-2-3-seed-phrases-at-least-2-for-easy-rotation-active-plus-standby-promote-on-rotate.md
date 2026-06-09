# Every traveler holds 2–3 seed phrases (≥2): active + standby, so rotation is a hot-swap (promote standby), not a scramble

**Register:** [grounded] design requirement (Aaron) + [synthesis]. **Date:** 2026-06-09.
**Captured by:** Otto (shadow). Refines the keyring; lines up with the Itron Active/Standby
KeyState prior art.

## Aaron's words

> "also everyone needs 2-3 seed phrases but at least 2 for easy rotations."

## The requirement: ≥2 seeds per traveler

Every traveler (persona or maintainer) holds **2–3 BIP-39 seed phrases (at least 2)**:

- **active** — the seed the current keyring derives from (in use);
- **standby (next)** — a second seed, **already generated + already trusted** (its
  pubkeys pre-published / pre-recognized), held in reserve;
- *(optional 3rd)* — a spare / cold backup, for deeper recovery.

## Why: rotation becomes a hot-swap, not a scramble

With a single seed, rotation is a **flag-day scramble**: generate new → re-publish →
re-register everywhere → hope nothing breaks in the gap. With a **pre-trusted standby**,
rotation is a **promote**:

```
state:   active = SeedA,  standby = SeedB (pre-trusted)
rotate:  promote SeedB -> active ;  SeedA -> retiring (overlap window) ;  generate SeedC -> new standby
```

The next key is **already vouched for** before it's needed, so there is **no trust gap**
during rotation — an **overlap window** where both old and new are valid, then the old
retires. This is exactly the **Itron `KeyState` lifecycle** (the prior-art doc):
`Standby → PendingActive → Active → PendingInactive → Inactive`. The standby seed is the
`Standby`/`PendingActive` key; promotion walks the states.

It also hardens against the **future-self attack vector**: a compromised active seed can
be rotated out **instantly** to the pre-trusted standby (no scramble under duress), and
the multi-seed set composes with multisig / social recovery (M-of-N over seeds).

## What it changes in the keyring tooling

- **`keyring.sh` tracks ≥2 seeds per traveler** — `active` + `standby` (+ optional
  spare), each its own keyring (own derivation), pubkeys published, recognized.
- **`rotate` = promote standby → active** (+ generate a fresh standby), with the
  overlap window — *not* "generate one fresh seed and cut over." (The current
  generate/import `rotate` is the single-seed special case; the ≥2-seed promote flow is
  the upgrade.)
- **KeyState axis** added (Itron-style: Active/Standby/PendingActive/PendingInactive/
  Inactive) **orthogonal to** the custody axis (bootstrap-test / self-custody).
- **status surfaces both seeds** — `keyring-public.json` lists active + standby pubkeys
  + their states, so society can recognize the standby *before* it's promoted.

## Honest scope / handoff

Design requirement, not yet built — today the tool is single-seed. To build: multi-seed
tracking in `keyring.sh` + the `KeyState` lifecycle (from the Itron reference doc) +
the promote-on-rotate flow + standby-pubkey publication. Routes to the keyring tooling
(Otto/Dejan) + Mateo/Nazar (rotation/recovery) + Kenji (synthesis). For **right now**,
a human can approximate it by generating two keyrings (e.g. `aaron` + `aaron-standby`)
and rotating between them manually until the promote flow lands.

## Anchors / ties

Key rollover with overlap / next-key pre-publication (NIST key-lifecycle; DNSSEC
KSK rollover as the canonical "pre-publish the next key" pattern); the **Itron KeyState**
Active/Standby lifecycle (the prior-art doc); BIP-39 multi-seed; future-self attack
vector + commitment devices (multisig/social-recovery over the seed set); the keyring
generate-then-rotate flow (`tools/setup/persona-keys/`); the byte-lock golden vectors.
