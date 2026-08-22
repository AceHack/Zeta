# The Eve protocol over adinkras — push-out is the up-edge, accept-in is the down-edge, and non-coercion is the grading

> **Origin.** Aaron 2026-08-18, mid-ferry of the Geometric Unity transcripts: *"our Eve protocol
> should also be able to be expressed over adinkra — it's like the minimal type system in math
> form, lol. Kind of."* Then, on seeing the mapping: *"this is great, we should save this mapping
> to Eve protocol somewhere so it's not lost in just conversation history."* This document is that
> save. **It is ours, not ferried** — which is why it lives here and not in
> `docs/research/ip-questionable/`.

## The carved version

> **Push-out is the up-edge. Accept-in is the down-edge. An offer costs nothing; a completed
> handshake costs exactly one tick. And non-coercion is not policy — it is the `Z₂` grading: the
> supercharge `Q` is odd, so it must alternate, and the bipartite structure makes two consecutive
> moves by the same side impossible.**

## The mapping, term by term

The Eve protocol in this repo is **push-out ⊕ accept-in**: the cell chooses what to offer, the
host chooses what to admit, and *neither can force the other*
(`2026-06-07-push-out-accept-in-is-the-eve-protocol-at-its-finest-zero-trust-non-coercive-mutual-consent-aaron.md`).

The adinkra edge structure, as recorded in `src/Core/AdinkraClock.fs`:

| adinkra | Eve | cost |
|---|---|---|
| **up-edge** `Q(φ) = ψ` — raises height | **push-out** — the offer | **no** `∂_τ` |
| **down-edge** `Q(ψ) = ∂_τ φ` — lowers height | **accept-in** — the admission | **exactly one** `∂_τ` |

The round trip `φ → ψ → φ̇` is one push plus one accept and emits exactly one `∂_τ`. So:

- **A completed handshake costs exactly one tick.**
- **An unaccepted offer costs nothing** — an up-edge emits no `∂_τ`. Offering is free; committing
  is what is metered.

That second line is the one worth keeping. It says the protocol's cost model is not a design
choice bolted onto the algebra — it *is* the algebra's own `∂_τ` accounting.

## Why non-coercion is structural rather than enforced

`Q` is **odd**: it carries bosons to fermions and back, never within a half. Consequently the
graph is bipartite and **no side can move twice in a row**. Mutual consent is not a rule the
protocol checks; it is a shape the protocol cannot violate.

This is the same even/odd split that `src/Core/CliffordPeriodicity.fs` now names formally: the
**odd** part swaps the halves (it *acts*), the **even** part preserves them (`{Q,Q} = ∂_τ`, what
*remains*). Eve's two parties are the two halves, and the alternation is the grading.

## "Minimal type system in math form" — closer to literal than it sounds

An adinkra is:

- a **two-sorted signature** — the `Z₂` grading gives exactly two types (boson/fermion);
- with **`N` typed operations** — one per edge colour, i.e. one per supercharge;
- carrying a **height function** — a grading by engineering dimension, i.e. a stratification.

It is minimal on both axes **for reasons that are theorems, not aesthetics**:

- **Two sorts is the fewest that supports alternation at all.** One sort permits a party to move
  twice; the non-coercion property would then have to be *checked* rather than *structural*.
- **`N = 8` is the smallest length admitting a doubly-even self-dual code** (Gleason), which is
  the same mod-8 clock that governs the Clifford classification — see
  `src/Core/CliffordPeriodicity.fs` and its `admitsDoublyEvenSelfDualCode`.

## What is checked, and what is not

**Checked (theorems or in-tree code):**

- `Q` odd ⇒ bipartite ⇒ forced alternation. Grading, not policy.
- The up/down `∂_τ` asymmetry: `AdinkraClock.fs` models a down-edge as one
  `scheduler.AdvanceBy(1)` and an up-edge as none.
- `N = 8` minimality, and the `s = 0` separation of the two halves into `M₈(R) ⊕ M₈(R)` —
  8 bosons, 8 fermions, block sizes forced by the clock.

**NOT checked — the gap that would falsify this:**

> **Adinkra alternation is *unconditional*; Eve's non-coercion is a *retained choice*.** A host may
> **decline**. The bare graph has no way to express declining — every up-edge has its down-edge,
> so in the adinkra every offer is eventually accepted.

That is a real disanalogy and it is the first thing to test. Candidate repairs, none yet tried:

1. **A partial map** — allow `Q` to be undefined on some nodes, so an offer may have no
   completing down-edge. Cost: it is no longer a supersymmetry algebra, so the `∂_τ` accounting
   that made the cost model attractive may not survive.
2. **A missing edge / quotient** — model declining as an edge absent from the code's adinkra. This
   keeps the algebra but makes "declined" a property of *which* adinkra, not of a run.
3. **Two adinkras and a comparison** — offers in one, acceptances in another, with declining as the
   difference. Closest to the "zip over two CRDTs / saga" framing the Eve doc already uses for
   host and cell living in different repos.

Until one of those is built, **the mapping covers accepted handshakes only**, and saying otherwise
would be claiming a correspondence on exactly the case that distinguishes consent from compulsion.

## Pointers

- `docs/research/2026-06-07-push-out-accept-in-is-the-eve-protocol-at-its-finest-zero-trust-non-coercive-mutual-consent-aaron.md` — the protocol
- `src/Core/AdinkraClock.fs` — the up/down `∂_τ` asymmetry and the B→A layering verdict
- `src/Core/AdinkraCode.fs` — the `[8,4]` code, 16 nodes, 8-regular
- `src/Core/CliffordPeriodicity.fs` — the mod-8 clock; even = what remains, odd = what acts
- `docs/research/ip-questionable/2026-08-18-geometric-unity-part-2-*.md` §5 — where this mapping
  was first written down, inside the ferry that prompted it
- `.claude/rules/no-directives.md` — source ≠ authorization; Eve's "neither can force the other"
  is the same refusal at protocol level
