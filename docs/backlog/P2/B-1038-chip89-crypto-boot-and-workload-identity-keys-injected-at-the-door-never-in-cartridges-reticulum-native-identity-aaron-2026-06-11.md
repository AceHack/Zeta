---
id: B-1038
title: chip8/9 boot crypto + workload identity — keys INJECTED at the door (never in cartridges); Reticulum-native identities; attestation at the host layer
priority: P2
status: open
tier: security-substrate
tags: [security, identity, spiffe, reticulum, zflash, keys, membrane, red-light]
created: 2026-06-11
owner: open — REVIEW REQUIRED before build: Nazar (ops) + Mateo (research) named; security-sensitive
---

# B-1038 — auth for the little machine, without teaching it crypto (Aaron 2026-06-11)

> Aaron: "should we give it any crypto primitives inside, for initial boot and such — keys
> injected for auth, like workload identity?"

The design observation (to be red-teamed before any code):

1. **NOT inside the ISA.** chip8/9 stays tiny and deterministic; rolling crypto into a toy ISA is
   the roll-your-own-crypto smell wearing a cartridge. The machine never holds key material.
2. **Keys are INJECTED CAPABILITIES at the door** — an `io` line by ZetaId resolved up the ladder
   (Live/Injected/Mock), with the RED LIGHT showing when a signing capability is bound. NEVER a
   cartridge line: cartridges are public diffable text — a key in one is a secret on a visible
   surface, wrong by construction (the red-light law). The Mock rung = a rehearsal signer that
   cannot produce valid signatures (honest by construction, like the flat inference engine).
3. **Workload identity = the room's, not the machine's:** SPIFFE/SVID is the prior art — identity
   issued to the WORKLOAD at startup by the host (zflash maintainer-key chain + the warm-cache
   startup from B-1035 is exactly the issuance moment), scoped to the room's lifetime (the
   5-minute bound rotates credentials for free).
4. **Reticulum already speaks identity natively** (cryptographic identities are built into RNS) —
   the bus IS the auth surface; a crossing is signed at the membrane, metered and lit. Boot
   attestation stays at the HOST layer (zflash/SLSA lineage already in-tree).
5. Existing pieces to compose, not duplicate: Crypto.fs, Blake3/Sha256 treaty primitives,
   KeyStore.fs, AntiSybil, the headscale/github trust-bootstrap research, docs/security/.

Gate: Nazar + Mateo review the surface BEFORE implementation; no key handling lands without it.
