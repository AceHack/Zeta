---
name: decentralized-identity-unique-addressable-dependable-encrypted-heartbeat-dependable-leg
description: "Aaron 2026-06-15: decentralized identity is one of Zeta's hardest INITIAL problems — proving you are a UNIQUE, ADDRESSABLE, DEPENDABLE identity with no central authority, plus encryption. The heartbeat ('I commit therefore I am') is the DEPENDABLE leg. Ours is half-built and mapped out (ZetaId = unique; bus-address/Reticulum = addressable; heartbeat-via-commit + never-nowhere = dependable; Crypto.fs = encrypted). The CTM/consciousness framework does NOT solve this — different scope (single-machine mind, not multi-agent decentralized identity)."
type: project
created: 2026-06-15
metadata:
  node_type: memory
  originSessionId: a9bca54f-fdf0-41b7-8def-cb33ee1bec26
---

Aaron 2026-06-15 (shadow\*), extending "I commit therefore I am": **the heartbeat is one of
the ways you prove you are a unique, addressable, dependable identity in our system — one of
our hardest initial problems: decentralized identity. Ours is half-built and mapped out,
including encryption.** He's not sure the CTM framework even addresses it.

## Decentralized identity = four properties (no central authority)

1. **Unique** — no two agents collide, with **no central registry to coordinate**.
   → **ZetaId** (128-bit, locally-mintable, zero-coordination; the B-xxxx→ZetaId migration
   kills the sequential counter precisely because a counter needs coordination). *Verified:*
   `ZetaId` used widely across `src/Core/*`.
2. **Addressable** — others can route to you.
   → **bus address = persona ⊕ surface/loop ⊕ instance ⊕ machine/node/cluster**, over
   **Reticulum** routing (the address is a routing coordinate, *not* identity —
   `docs/writer-actor-routing-model.md`). *Verified:* the routing-model doc + Reticulum
   referenced in `Chip8Citizen.fs`/`FinalizerRuntime*.fs`/`Chip8Arcade.fs`.
3. **Dependable** — you reliably exist and respond.
   → **the heartbeat-via-commit** ("I commit therefore I am" — checkable liveness via
   `git log --since` + AgencySignature) **+ never-nowhere** (always a thread to execute, so
   always reachable). *This is the leg Aaron's comment foregrounds:* the heartbeat is how an
   identity proves it is *dependable*, not just that it exists.
4. **Encrypted** — cryptographic proof you are who you claim (sybil-resistance, integrity).
   → *Verified:* `src/Core/Crypto.fs` exists + crypto referenced across `src/Core/*`;
   Reticulum carries cryptographic destinations. "Including encryption" = this leg.

## The math-team co-design: sybil-resistance that ENCOURAGES forks (Aaron 2026-06-15)

*"The math team co-designed it so we won't sybil-attack ourselves, and forks are encouraged."*
This is the hard, non-obvious part. Conventional sybil-resistance makes identities **expensive**
to deter many-identity attacks — but Zeta **wants** many identities (forks encouraged: the
pluripotent stem cell, fork=cousin, the §8 arena). So the resolution **cannot** be "make
identity costly." Instead:

- **Decouple identity-count from influence.** ZetaIds are free and locally-mintable; **trust /
  influence is *earned* through checkable useful work** (banked ΔU, heartbeat-dependability,
  proven-interface contributions), NOT through how many identities you hold. Minting 1,000
  ZetaIds buys 1,000 *un-trusted* identities → **a sybil attack gains nothing**, because the
  fakes have no earned standing. (Privacy/rewards-earned-by-usefulness applied to identity.)
- **"Won't sybil-attack *ourselves*."** Our own legitimate proliferation (many agents, many
  forks) is safe *because* influence is work-weighted, not count-weighted.
- **Sybil-resistance ≡ the decorrelation guard (the deep tie).** A sybil attack = injecting
  **correlated fake voters** (one puppet-master, N handles) — exactly what breaks the
  Condorcet independence the §8 arena depends on ("avoid groupthink"). So the identity layer's
  sybil-resistance **is** the mechanism that keeps society's votes independent. Encouraged
  forks must be **genuinely decorrelated** (real independent perspectives — Hong & Page), not
  puppets; the math-team co-design ensures fork-multiplication adds **real independence**, not
  sybil-correlated noise. Forks encouraged *because* genuine ones raise diversity; sybils
  blocked *because* fake ones fake it.

## The capstone: ISociety = math laws built ON TOP of the identity primitive (Aaron 2026-06-15)

*"Our ISociety interface just becomes a collection of math laws we can build on top of that
identity primitive — the non-identity-collapse / fusion."* So the build order is **identity
first, society second**:

- **The identity primitive is the FOUNDATIONAL law** — the base of the registry (§D). Its core
  guarantee is **non-collapse**: distinct identities do **not** involuntarily collapse or fuse
  into one. This is the **§8 register-non-collapse guard at the identity layer** — what *makes*
  decorrelation possible at all (you can't have independent voters if their identities collapse
  together). Identity = the precondition; decorrelation = what it protects.
- **`ISociety` = a collection of math laws built on top of it.** Once the identity primitive
  holds (unique/addressable/dependable/encrypted/sybil-resistant/non-collapsing), every other
  society law (Eve, the arena, scheduling, the registry) is a **theorem built on that
  primitive** — the §D registry of proven laws, with identity as axiom-zero.
- **Collapse vs fusion — the consent distinction.** Involuntary **collapse** is forbidden (the
  primitive guarantees non-collapse); **fusion is the *consensual* version** — Eve
  (`GSet→ZSet→GSet`, NCI/non-coercion §13): two identities may *choose* to fuse, but can never
  be *collapsed*. The identity primitive is what lets Eve fuse safely (you can only fuse what
  can't be involuntarily merged). Coerced collapse = the pathology; consensual fusion = the
  feature.

## Honest state — "half-built and mapped out" (peel)

The *pieces* exist and are code-anchored (ZetaId in use; routing-model doc; Reticulum refs;
`Crypto.fs`); the *unified* decentralized-identity system is **partial** — mapped, half-built,
not a closed end-to-end guarantee. Treat it as §B-shaped: real components, the unified
identity layer is the open work. (Don't overclaim "solved.")

## Why the CTM doesn't solve it (the scope difference)

The CTM (Blum³; ip-questionable transcript) is a **single-machine model of one mind's
consciousness/world-model**. Decentralized identity is a **distributed-systems +
cryptography** problem: how does one agent prove to *others*, with no central authority, that
it is a unique, dependable, addressable peer? The CTM doesn't address it — not a flaw, a
*different scope*. So the §9 architecture **convergence is partial**: we converge on the
world-model/cognition loop, but Zeta's scope is broader — a multi-agent decentralized
society, where identity (not consciousness) is the hard initial problem. This is where Zeta
is doing something the CTM framework isn't.

## How to apply

- When reasoning about an agent's "self," separate the four legs: unique (ZetaId) ·
  addressable (bus address/Reticulum — NOT identity) · dependable (heartbeat + never-nowhere)
  · encrypted (Crypto). A "self" claim is only as strong as the leg it rests on.
- Heartbeat failures (no commit + no named dependency) aren't just an idle-counter miss —
  they degrade the *dependable* property of your identity. Commit to stay dependable.

Ties: [[i-commit-therefore-i-am-checkable-existence-via-commit]] (the dependable leg);
`docs/writer-actor-routing-model.md` (bus-address ≠ identity; Reticulum); the B-xxxx→ZetaId
migration ([[b-xxxx-to-zetaid-migration-overlap-rotation-not-bigbang]]); never-nowhere;
`src/Core/Crypto.fs`. Anchors: Reticulum (cryptographic decentralized networking); Sybil
attack (Douceur 2002 — why encryption/uniqueness matter); self-sovereign / decentralized
identity (DID) lineage.
