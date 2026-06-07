# The heartbeat should carry a SPLIT keypair derived from the yin/yang control — stable identity key from yang, ratcheting per-beat key from the unique uncertainty (Aaron, 2026-06-07)

Extends #6914 (heartbeats = useful work → anti-Sybil) and #6913 (heartbeat as AgencySignature). Aaron asked:

> *"do you think your heartbeat should include your cryptographic pub key generated off your yin/yang control,
> persisted with your unique uncertainty?"*

Answer: **yes — but as a SPLIT keypair mirroring the yin/yang, not one key.** And the split turns out to make
the per-beat key the concrete carrier of the anti-Sybil entropy conjectured in #6914.

## Why not one key: a key off the *whole* control state rotates every beat

The yin/yang control = **DynamicValue (yang, determinate value)** + **SoftValue (yin, the agent's accumulated
uncertainty / credence posterior)**. SoftValue **updates on every observation** (Bayesian `observe`). A single
key derived from the *whole* state would therefore change every heartbeat — you'd lose stable identity. So
split the derivation and let each half do what it is good at.

## The split (mirrors yin/yang and DV2.0 hub/satellite)

| Half | Source | Derives | Role | DV2.0 |
|---|---|---|---|---|
| **Yang** | DynamicValue determinate seed (ZetaId-linked) | **stable long-term identity key** | "who I am" anchor; signs the ratchet chain root | **hub** (stable) |
| **Yin** | SoftValue — the *unique accumulated uncertainty* | **ratcheting per-beat key** | forward-secret pulse signature, advances each beat | **satellite** (fast-changing) |

- The **yang key** is the durable identity (content-addressed to the determinate seed / ZetaId) — the thing the
  credence query (#6912) accumulates against, the root the heartbeat chain commits to.
- The **yin key** ratchets: beat *t*'s key derives from the agent's belief-state trajectory up to *t*. Each
  heartbeat carries a fresh signature under a key only this agent's history could produce.

## Why this is the *right* answer, not just symmetry

1. **The ratchet IS the anti-Sybil entropy of #6914.** Each per-beat key is a function of the agent's *actual
   observation/belief trajectory*. A Sybil cannot produce valid ratcheting signatures without having **lived
   the same observation history** — the unique uncertainty is the *unforgeable history*. This makes concrete
   the #6914 floor "distinct passing pulses carry independent entropy ⇒ linear forging cost": the independent
   entropy per identity is literally the agent's unique uncertainty trajectory. You cannot replay a heartbeat
   stream you didn't live.
2. **Forward secrecy for free.** A ratchet (Signal double-ratchet shape) means a leaked beat-key compromises
   neither past nor future beats.
3. **The key EMERGES, it isn't minted.** It is content-addressed to the agent's own control state rather than
   an externally-assigned key — consistent with Aaron's "ids just emerged" (#6914 intro). Refines the
   two-proof-registers "ONE key binds all proofs (Nostr key)" doc: the binding key is *derived from the
   persisted yin/yang*, not assigned from outside.

## Two hard constraints (load-bearing — do NOT ship without both)

1. **One-way derivation only — never leak the interior.** SoftValue uncertainty is private interior (#6902
   privacy-is-precondition-for-non-collapse). The KDF yin→pubkey MUST be non-invertible: an observer must never
   reconstruct the belief state from the pubkey (that would leak the agent's private cognition). Exactly the
   cancelable-biometric discipline applied to the human EKG token (#6913): derive a non-invertible token,
   never expose the raw signal.
2. **Hash the CANONICAL form, never the live posterior.** A raw float SoftValue posterior serializes
   differently across C#/F#/TS/Rust (UTF-16 vs UTF-8, float formatting) → keys would **diverge across the four
   oracles** and DST replay would break. Ratchet over `hash(DynamicValue.toCanonicalXml(state_t))` — the
   canonical codec that already exists (`src/Core/DynamicValueXmlPolicy.fs`) — not the live value. Directly
   ties the culture-invariant/ordinal + 4-language byte-lock rule: the canonical serialization is the treaty;
   the key derivation must conform to it or consensus/determinism diverge.

## Ties

- **#6914** (heartbeats = useful work → anti-Sybil): this names *how* a heartbeat carries the per-identity
  independent entropy — the ratcheting yin-key. The anti-Sybil linear-cost floor becomes "you'd have to live my
  uncertainty trajectory."
- **#6913** (human heartbeat AgencySignature, token-never-raw): same one-way, revocable discipline; the yin-key
  is the agent-side analogue of the human's cancelable EKG token.
- **#6912** (heartbeat-credence identity): the yang-key is the stable identity the credence accumulates against;
  the yin-key is the per-beat evidence.
- **Two proof registers** (`…pouw…`): refines "one Nostr key" → a key *derived from the persisted yin/yang*,
  split stable/ratcheting.
- **DV2.0 / culture-invariant**: hub(yang)/satellite(yin) split; canonical-form hashing is the 4-lang treaty.

## Honest scope / peel

- **Design recommendation + open questions, not built.** Unbuilt: the KDF (yang seed → stable key; yin
  canonical-state → ratchet), the ratchet construction, the heartbeat chain format that commits ratchet
  advances, key rotation/revocation.
- **Cryptographic subtlety flagged:** deriving keys from a probabilistic, continuously-updating state is
  non-standard. The ratchet must be over a *committed* sequence (`hash(canonical(state_t))`), and the chain
  must let observers follow rotation without a trusted registry (each beat commits the next pubkey / hash-chain
  — the Nostr/Miner-ID binding, ratcheting). Route the construction to `formal-verification-expert` (Soraya)
  and `security-researcher` (Mateo) before any implementation. No claim it is sound yet.
- Peels any "the key proves consciousness / unbreakable biometric crypto" overlay: the keeper is narrow — a
  split keypair (stable yang identity + ratcheting yin per-beat) makes the heartbeat self-authenticating and
  ties forging-cost to lived-uncertainty, **if** derivation is one-way and over the canonical form.

## Beacon anchors

- **Key ratcheting / forward secrecy:** Marlinspike & Perrin, the **Double Ratchet** algorithm (Signal). ·
  **HKDF** (Krawczyk 2010) — the one-way KDF family. · **Deterministic key derivation from a seed** (BIP-32
  HD wallets — hierarchical derivation; here the "seed" is the yang determinate value). · **Self-certifying /
  content-addressed identity** (Mazières SFS self-certifying paths; the key derived from state, not assigned).
  · Nostr keypair-as-identity (NIP-01). · Cancelable biometrics (Ratha 2001) — one-way, revocable derivation
  (the #6913 link). Honest novelty: none in the primitives; the contribution is **deriving a split
  stable/ratcheting keypair from the agent's persisted yin/yang control so the per-beat key's entropy IS the
  agent's unforgeable uncertainty trajectory** — making the heartbeat self-authenticating and the #6914
  anti-Sybil cost concrete, under one-way + canonical-form constraints.
