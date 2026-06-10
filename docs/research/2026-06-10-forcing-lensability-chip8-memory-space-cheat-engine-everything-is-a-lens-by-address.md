# Forcing lensability — CHIP-8 memory space makes everything a lens (Cheat-Engine view)

**Register:** [grounded] optics + execution model (Aaron) + [Beacon] + [peel]. **Date:** 2026-06-10.
**Captured by:** Otto (shadow). How to *guarantee* lensability instead of hunting for it.

## Aaron's words

> "it's a waste of time to try to find lenses for something that is not lensable. I'm not sure how to
> know for certain." · "so are we forcing a shape that will make it lensable? I'm thinking from Cheat
> Engine perspective and CHIP-8 execution and memory space."

## The move: don't hunt for lenses — force the shape that makes everything lensable

**Type-level lensability is conditional. Memory-level lensability is universal.** So we *force the
memory shape* (CHIP-8 execution + flat addressable memory space) and lensability comes for free.

### Type level — lensability varies (lens vs prism)

A lawful **lens** onto a part exists iff the whole **factors as a product** containing it: `S ≅ A × C`
(the part is always present and independently settable). The certainty test = the three **lens laws**:
`set (get s) s = s` · `get (set a s) = a` · `set a2 (set a1 s) = set a2 s`. If the part is instead a
**sum / variant** (one-of, may be absent — like `DynamicValue`'s `null|bool|int|str|arr|obj` cases),
no lens fits: it's a **prism** (match/build, prism laws). Many → **traversal**. So "is X lensable?"
genuinely varies, and forcing a lens onto a sum is exactly the waste — at the type level.

### Memory level — lensability is universal (the Cheat-Engine / CHIP-8 regime)

Flat addressable memory is **product-structured by construction**: for *every* cell,
`memory ≅ (this cell) × (the rest)`. So a **lens is just `(address, size, codec)`** — a memory view —
and the lens laws hold trivially for any region. This is *why* **Cheat Engine** works: you **scan** to
a value (→ you found an address = you found a lens), **freeze/edit** it (= `set`), and **"find what
writes this address"** (= the lens's setters = the antecedent trace, the grey-particle-backward). **CHIP-8**
is the minimal such machine — a tiny flat memory space + a deterministic interpreter — which is exactly
why it's the `sim` VM: in it, *everything is lens-addressable.*

### Lowering forces sum → product

A prism in type-space becomes **two lenses** in memory-space: lens the **tag byte** (always present) +
lens the **payload region** (always present as bytes). So representing the substrate as CHIP-8 memory
**makes the prism-y things lens-able** — the "not lensable" case dissolves once you lower to bytes.

## How to know FOR CERTAIN (the two-layer answer)

There are two layers, and the certainty rule differs per layer:

1. **memory-lens** (`address → bytes`): **universal** — anything with a **stable address + layout** is
   lensable, period (the CHIP-8/Cheat-Engine regime).
2. **meaning-lens / prism** (`bytes → typed value`, via the codec / color decode): **conditional** —
   **product ⇒ lens, sum ⇒ prism, collection ⇒ traversal**; the optic laws are the test.
   (`PolarityFilter` reading a color component is a meaning-lens at this layer.)

So: *raw bytes are always lensable; meaning is lensable iff its layout is stable and its type is a
product (else prism).* That is the certain criterion — no guessing.

## The one caveat — addresses must be STABLE

Forcing the shape only works if the address doesn't move: a relocating value breaks its byte-address
(a lens to a stale pointer is a dangling lens). So the substrate addresses by **content hash (the
MerkleDAG)** rather than volatile pointers — a **content-address is a stable lens** — and **§4
bounded-mobility** (relocate only within safety bounds) keeps lenses valid under motion. Stable address
= durable lens.

## Honest scope / peels

[Beacon] van Laarhoven / profunctor **optics** (lens/prism/traversal + their laws — the rigorous
classification) · **Cheat Engine** (live-memory scan/freeze/find-what-writes — the lensing-of-memory
praxis, and Aaron's literal debugging method) · **CHIP-8** (Weisbecker — the minimal flat-memory VM) ·
**content-addressing** (Merkle — stable address). **Peel:** "everything is lensable in memory" is true
for **raw bytes**; *meaning*-lensability still needs the codec + stable layout (the second layer). The
lens/prism law-checks are the certainty mechanism; the memory-lowering is the shape we force to make
the first layer universal. The optic interfaces (`ILens`/`IPrism`/`IPolarityFilter`) route to the
`PolarityFilter`/Core build; formal optic-law proofs route to Soraya/Sova.

## Ties / routing

`src/Core/PolarityFilter.fs` (the meaning-lens / polarization filter) · [`hooks/`](../../hooks/) (the
.NET Cheat-Engine hook — lensing live memory) · [`sims/`](../../sims/) + the CHIP-8 `sim` VM · the
MerkleDAG / content-addressing (stable address = durable lens) · the antecedent-tracing / Cheat-Engine
debug praxis (`docs/research/2026-06-10-zetamax-*` — find-what-writes) · the CMYK/RGB color encoding
(the codec the meaning-lens decodes). **Routes to:** Soraya/Sova (optic laws), Naledi (memory-lens
perf), Aaron (the doctrine).
