# Circuits compose as a PROP with trace — and `CircuitRegistration` already enforces the well-formedness conditions

**Date:** 2026-08-10 · **From:** Aaron (*"CircuitRegistration — we have multiple different
circuits and we are trying to combine all in category theory"*) · **Recorded by:** Otto (shadow)

**What this is:** the categorical target named, and the observation that the existing TLA+ spec
is not merely adjacent to it — three of its guards are the *well-formedness conditions* the
categorical structure requires. Written after auditing that spec, which is how the mapping
surfaced.

---

## 0. The structure circuits actually live in

Circuits compose two ways, and both must be modelled or the algebra is wrong:

- **Sequentially** — output wires of one into input wires of the next. That is composition `∘`.
- **In parallel** — two circuits side by side, untouching. That is a monoidal product `⊗`.

A category with both, where objects are **wire counts** (natural numbers, `m → n`) and the
symmetry lets wires cross, is a **PROP** (PROducts and Permutations category) — Mac Lane 1965.
That is the standard home for "many different circuits, combined", and it is already an anchored
term here: `only-the-irreducible-is-primitive-generate-the-rest` <!-- STALE-REF: ../../.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md -->
cites Mac Lane (monoidal categories / PROPs), May (operads), and Joyal–Street (braided / string
diagrams).

**Feedback is the third operation and it is not optional here.** A circuit with a feedback path
is a **trace**: `tr(f) : m → n` from `f : m ⊗ x → n ⊗ x`, feeding an output back to an input.
The structure is a **traced monoidal category** (Joyal–Street–Verity 1996). `CircuitRegistration`
has a `feedbackConnected` variable, so feedback is already in the model — which means the target
is not a plain PROP but a **traced PROP**.

## 1. What the spec already enforces, read categorically

This is the part worth having: three guards in `src/Core.TLA/specs/CircuitRegistration.tla` are
exactly the conditions that make a diagram a legitimate morphism.

| spec guard | categorical meaning |
|---|---|
| `Connect(t, op)` requires `~feedbackConnected[op]` — CAS, first-wins | **wires are linear**: each port is consumed exactly once |
| `ConnectAtMostOnce` (the invariant) | the same condition, stated as a safety property |
| `NoRegisterAfterBuild` | once composed, the morphism is **fixed** — a built diagram is immutable |
| `Build` requires all threads idle | the composite is only formed from a **quiescent, complete** diagram |

**The linearity one is the load-bearing observation.** In a symmetric monoidal category you may
*not* duplicate or discard a wire unless the object carries comonoid structure (copy `Δ`) and
counit (discard `!`). Connect-at-most-once is precisely the refusal to duplicate — so the spec is
already committing to the **linear** (no free copying) regime, which is the right default for
circuits with feedback, because unrestricted copying plus trace is where the semantics goes bad.

That is not a metaphor laid over the spec afterwards. The CAS guard was written for a concurrency
reason (first-wins on a feedback cell) and it *coincides* with the categorical requirement. Worth
recording precisely because the two motivations agreeing is evidence the abstraction fits.

## 2. What is missing for the categorical goal, stated as work rather than as a gap

The spec models **registration and sealing** of one circuit. Composition *of multiple different
circuits* — Aaron's actual target — needs three things it does not have:

1. **Typed boundaries.** Objects must be wire counts (or richer types), and `Build` must reject
   diagrams whose boundaries do not match. Today `ops` is a sequence with no arity, so there is
   nothing to typecheck. **Composition is partial, and the spec cannot currently express the
   partiality.**
2. **A composition operation.** There is no `∘` or `⊗` — a built circuit is terminal. Combining
   requires built circuits to be *composable objects*, not end states.
3. **Trace as an operation, not a flag.** `feedbackConnected` is a boolean per op; trace is an
   operator taking `f : m ⊗ x → n ⊗ x` to `m → n`. The flag records that feedback happened; it
   does not give the algebraic law.

**The prior art for exactly this — combining *different kinds* of open systems — is
`decorated`/`structured cospans`** (Fong 2015; Baez–Courser). That is the standard machinery for
composing open systems along shared boundaries, and it is the thing to read before designing
anything here.

## 3. Anchors (Beacon)

- **Mac Lane** (1965) — PROPs; the two-composition structure.
- **Joyal, Street & Verity** (1996), *Traced monoidal categories* — feedback as trace.
- **Selinger**, *A survey of graphical languages for monoidal categories* — which diagram
  language corresponds to which structure; the reference for "what may I draw".
- **Fong** (2015), *Decorated cospans*; **Baez & Courser**, structured cospans — composing open
  systems of different kinds along boundaries. The direct answer to "combine all".
- **Baez & Erbele**, *Categories in Control*; **Bonchi, Sobociński & Zanasi**, *Full abstraction
  for signal flow graphs* — circuits/signal-flow as morphisms, with a **completeness** result:
  the equational theory is exactly right, which is the standard to aim at.
- **Lafont** (2003), *Towards an algebraic theory of Boolean circuits* — the discrete case.
- **Coecke & Kissinger**, ZX-calculus — the same programme where the circuits are quantum.

## 4. Falsifiers, so this is a quotient and not a decoration

Per [`…how-to-decouple…`](2026-08-10-how-to-decouple-unfolding-a-compressed-generator-into-claims-that-can-fail.md),
each claim here names how it fails:

- **"Circuits form a traced PROP"** — refuted if our circuits admit an operation that is neither
  `∘`, `⊗`, symmetry, nor trace, or if wire-counts are not the right objects (e.g. boundaries
  carry types the naturals cannot express).
- **"Connect-at-most-once = linearity"** — refuted if any legitimate circuit needs to fan a
  feedback cell to two consumers. That would mean the objects need comonoid structure and the
  spec's CAS guard is over-strict, not categorically motivated.
- **"Composition is partial"** — refuted if every pair of built circuits composes, which would
  mean boundaries carry no constraint and the PROP framing buys nothing.

## 5. Pointers

- `src/Core.TLA/specs/CircuitRegistration.tla` — the spec; its liveness fairness was completed
  2026-08-10 (see `docs/research/2026-08-10-synchrony-non-transfer-audit-*` §2e)
- `only-the-irreducible-is-primitive-generate-the-rest` <!-- STALE-REF: ../../.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md -->
  — free object → earned quotient; a PROP presented by generators-and-relations is exactly that
  shape, and the free traced PROP is the generator here
- `interfaces-free-classes-earned-under-rules` <!-- STALE-REF: ../../.claude/rules/interfaces-free-classes-earned-under-rules.md -->
  — the type-level sibling: the free structure is free, the quotient is earned
