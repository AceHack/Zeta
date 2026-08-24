# The etymology attack and the supply-chain substitution are one attack — and only a metric catches drift

**Date:** 2026-08-24
**Status:** `unmetered` — a structural identity with a stated consequence; nothing here is measured yet, and §5 says what would falsify it.
**Origin:** Aaron, on dual content addressing: *"this also ties into our etymology attacks — this is the same as a dictionary intentional drift attack."*

---

## 1. The identity

Three attacks that are usually filed separately:

| attack | the move |
|---|---|
| **Supply-chain substitution** | a package keeps its **name**, its **content** is replaced |
| **Dictionary / intentional drift** | a term keeps its **name**, its **definition** is replaced |
| **Etymology drift** (the `ρ → 0` cliff) | a term keeps its **name**, its meaning **wanders** per-speaker |

**All three are: the name is stable, the referent is not.** The victim resolves a name they trust and receives something else. Whether the something-else arrived by a hostile publisher, a hostile editor, or nobody at all is a question about *intent*, not about *mechanism* — and the mechanism is identical.

This means two carved rules in this repo are **one defence at two layers**:

- [`anti-babel-preserve-reconcilability`](../../.claude/rules/anti-babel-preserve-reconcilability.md) guards the name→meaning binding.
- Byte-lock / golden vectors guard the name→artifact binding.

Neither cites the other. They are the same guard.

## 2. Why a hash is not sufficient — and this is the part that is not obvious

A cryptographic content address has **no distance metric, by construction**. One byte differs and the address is unrelated. That is exactly what makes it good at integrity and useless at drift:

> **To a hash, every change looks maximal.** A corrected typo and a wholesale replacement are equally "differs". A hash can say *the referent moved*; it cannot say *how far*.

**Drift attacks are built to exploit precisely that.** Substitution is discontinuous and gets caught at review — the change is large and one reviewer says no. Drift is a sequence of steps **each of which passes review on its own**, and whose *sum* is the substitution. The defence has to accumulate across steps, and a hash cannot accumulate anything: it is stateless between revisions.

**A metric address accumulates.** Distance from a fixed anchor is a quantity that grows, so a drift that never trips a per-change threshold still trips a cumulative one.

## 3. So the two addressings are not redundancy — they catch different attacks

| addressing | catches | blind to |
|---|---|---|
| **exact** (BLAKE3 / Merkle) | substitution — *this is not the artifact we recorded* | drift; every step reads as total change |
| **distance** (LSH / embedding / signature) | drift — *this has moved N from the anchor* | forgery that is near in metric and wrong in fact |

**Each is precisely useless at the other's job**, which is why holding both is the design rather than duplication:

> **A hash used to find "similar" always misses. A metric used to prove identity is unfalsifiable.**

And they compose in one direction: **distance for recall, hash for confirmation.** The metric tier over-includes and never under-includes; the exact tier admits no false positives. That is the cascade already designed for the signature index — and it means the two "two-tier" documents in this repo, `2026-06-07-blake3-content-address-treaty-two-tier-128-le-vs-256` and `2026-08-23-signature-index-…-two-tier-cascade`, are **two tiers of one cascade** rather than two unrelated schemes.

## 4. The falsifier already exists in the vocabulary layer — it is a distance test

`anti-babel`'s stated test:

> *"Hand a peer **only the shared anchors** — not the coinage's definition — and ask it to reconstruct the term. Reconstructible ⇒ still reconcilable. Not reconstructible ⇒ the divergence has crossed into Babel."*

**That is a distance measurement against a fixed anchor**, written in prose. Reconstruction succeeds while the term is near the anchors and fails once it has drifted past. The rule already specifies the metric defence for meaning; the artifact layer has only the exact one.

**The transfer runs both ways**, and the second direction is the useful one:

- Vocabulary → artifacts: an anchor-distance test for dependencies would detect *"same name, content has moved N"* — the substitution class that keeps a name and swaps the bytes gradually.
- Artifacts → vocabulary: a glossary term could carry a *committed* anchor set, making drift a diff rather than a judgement.

## 5. Register, and what would falsify this

**This is a structural identity, not a measured result.** Per [`numerology-vs-number-theory`](../../.claude/rules/numerology-vs-number-theory.md), a shared shape across three attacks is a **warning to check independence**, not confirmation. The honest claim is that the three share a *mechanism* (stable name, swapped referent) — **not** that a single implementation defends all three.

**What would falsify it:** exhibit a drift attack that a cumulative distance-from-anchor measure cannot detect while a per-change review can. If drift can hide *inside* the metric — steps that are small in the chosen metric and large in meaning — then the metric is the wrong one and the identity buys nothing operationally. **That is a real risk**: embedding distance and semantic distance are not the same, and an adversary who knows the metric optimises against it. Any implementation must state which metric and why it resists being gamed.

**Unmeasured here:** no drift attack has been attempted against this repo; no cumulative-distance guard exists; the two-tier composition is designed and not deployed.

## 6. Why the derived state can be cheap — the generator is the storage

A companion point from the same conversation, recorded because it removes the obvious objection to committing derived state at every revision.

Aaron: *"we have Futamura, F# type providers and computational expressions, Roslyn, and our ShivaGC to make this fit into the tiny memory store, cause it can all be re-derived from source into memory and collected at any time — it's almost like structured C programming with 0 dynamic allocations. This was our firmware design guideline at Itron to avoid memory hacks and exploits and bugs."*

**The derivation is materialised as a generator, not as bytes.** It is addressable because generator + input is content-addressed; reproducible because anyone can re-run it; cheap because it is collected when not resident. That is [`only-the-irreducible-is-primitive-generate-the-rest`](../../.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md) applied to derived state.

**And the zero-dynamic-allocation discipline is doing security work, not just performance work** — no allocator means no heap grooming, no use-after-free, no fragmentation oracle. A firmware guideline (Aaron's, from Itron; the *discipline* transfers, none of their code does — see [`cleanroom-two-team-separation`](../../.claude/rules/cleanroom-two-team-separation.md)) turned into a property of a build store.

**The tension it resolves:** a maintained view that nobody can point at is unfalsifiable, so a DBSP-native store must keep *both* drift-freedom and addressability. Re-derivable-on-demand keeps both without paying storage for either.

## 7. Path-from-a-stable-root is the same operation three times

Aaron, same conversation: *"for our dynamic memory allocation work we have CHIP-8 and our ISR reversal, trying to decompose them into non-DMA orbits based on characters and objects in the game. This is our cheat-engine reverse engineering — it's all about DMA traces over pointers from root."*

**A heap object cannot be addressed by its address**, because dynamic allocation moves it every run. So it is addressed by a **path from a stable root** — which is what a Cheat Engine pointer scan produces, and it is the same shape as a Merkle path and as a GC trace:

| operation | from | finds |
|---|---|---|
| **GC trace** (ShivaGC) | roots | what is **reachable** |
| **Pointer scan** (cheat engine) | a static base | **a path** to a moving target |
| **Merkle address** | the root hash | **a leaf**, by path |

Three uses of one operation: *name a thing whose location is not stable, by its route from something that is.* The addressing scheme §3 describes is therefore not only how artifacts are named — it is how a **running heap** is named, which is why the emulator work and the store work are the same programme rather than two.

**And it explains the goal of the CHIP-8/ISR reversal.** Decomposing the heap into *"non-DMA orbits based on characters and objects"* is the claim that objects presented as dynamically allocated actually occupy **bounded, discoverable orbits** — and a bounded orbit can be statically allocated. That converts a pointer chase into a fixed offset, which is precisely how §6's zero-dynamic-allocation discipline becomes reachable for code that was not written under it. **Reverse-engineering the allocation is the method; static allocation is the result.**

Register: `toy`. The orbit-decomposition claim is a research programme, not a result — a game object *may* have an unbounded orbit, and nothing here shows the CHIP-8 corpus decomposes. Prior work: `docs/research/2026-06-09-cheat-engine-injection-points-first-class-in-the-emulator-*.md` and `docs/research/2026-06-09-content-addressing-rooms-give-free-deduplication-of-the-chip8-memory-*.md` already join cheat-engine discovery to content addressing; **this section adds only the three-way identity with GC tracing**, and defers to those for the emulator design.

## Pointers

- `.claude/rules/anti-babel-preserve-reconcilability.md` — the name→meaning guard, and the reconstruction falsifier §4 reads as a distance test.
- `docs/research/2026-06-07-v2-universe-is-a-merkle-branch-dual-content-addressing-exact-blake3-and-with-distance-similarity-aaron.md` — the dual-addressing design this builds on.
- `docs/research/2026-06-07-distance-based-content-addressing-similarity-index-near-dup-discovery-aaron.md` — the metric half.
- `docs/research/2026-08-23-signature-index-over-includes-never-under-includes-*.md` — over-include/never-under-include, the recall tier.
- `.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md` — generator-as-storage, and the generator-IS-the-ECC framing.
- Beacon: Merkle (1979) hash trees · Broder (1997) minhash · Indyk & Motwani (1998) LSH · Charikar (2002) simhash · Futamura (1971) partial evaluation.
