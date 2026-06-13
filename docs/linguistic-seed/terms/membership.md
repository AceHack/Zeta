---
name: membership
defined-by: The primitive set-membership relation (∈) of axiomatic set theory
formalised: draft
dependencies: []
---

# membership

## Plain English

**Membership** is the "is one of" link. *The cat is one of the animals in
the barn.* `x ∈ A` means **`x` is in `A`** — `x` is one of the things the
collection `A` gathers up. It is the most basic question you can ask about
a collection: *is this thing in it, yes or no?*

Membership is so basic that we do not build it out of anything simpler — we
just point at it. It is a **root** of the seed, like [`truth`](truth.md):
taken as given, and everything about collections is said using it.

## Mathematical definition

Membership `∈` is a **primitive binary relation** — in axiomatic set
theory it is the single undefined non-logical symbol. It is not defined in
terms of other things; instead it is *characterised* by the axioms that
govern it. For any `x` and any collection `A`:

```
x ∈ A      is a proposition  (it is true or false — grounds through truth)
x ∉ A  :=  ¬(x ∈ A)
```

Because `∈` is undefined, its `dependencies` are empty: it is axiomatic.
The terms that *use* it ([`set`](set.md) — extensionality is stated with
`∈`) depend on **it**, not the other way round. This is what keeps the seed
graph acyclic: membership is more primitive than set, so the edge runs
`set → membership`, never back.

> **Why a primitive and not "definable from set":** it is tempting to say
> "`x ∈ A` means `A` contains `x`" — but "contains" is just `∈` again. Every
> attempt to define membership smuggles it back in. Recognising that and
> stopping (rather than circling) is the discipline; `∈` is where the
> regress honestly bottoms out.

## Lean4 formalisation

```lean4
-- Lean exposes membership through the `Membership` type class and the
-- `∈` notation; for `Set α := α → Prop` (Mathlib), `x ∈ A` unfolds to `A x`:
example (A : Set α) (x : α) : (x ∈ A) = A x := rfl

-- Non-membership is the negation (grounds through implication's ¬):
example (A : Set α) (x : α) : x ∉ A ↔ ¬ (x ∈ A) := Iff.rfl
```

In Lean, `∈` is a notation backed by a type class rather than a single
global primitive, but the role is identical: the unreduced "is one of"
relation other definitions are written against.

## Grounding point (per Otto-21 Craft discipline)

**A club roster.** *"Are you a member?"* The roster answers exactly one
question about each person: in, or not in. You don't explain membership by
appeal to something deeper — being a member just *is* being on the roster.
Everything else about the club (its size, who's equal to whom, who chairs
it) is computed from that one in/out fact.

## What this term DOES NOT mean

- **Not the subset relation.** `x ∈ A` is *an element is in a set*;
  `B ⊆ A` is *every element of one set is in another*. Subset is built
  from membership (`∀x. x ∈ B → x ∈ A`), not the same as it.
- **Not containment-as-substring / part-of.** "Cat is in concatenate" is a
  spelling fact, not set membership. Seed membership is the in/out relation
  on a collection's elements.
- **Not typed-ness.** "`x` has type `T`" and "`x ∈ S`" coincide in some
  foundations and diverge in others; the seed keeps `∈` as the set-relation
  and stays foundation-agnostic (README §What-this-skeleton-does-NOT-do).

## Citations

- **Peano, Giuseppe.** *Arithmetices principia* (1889) — introduced the
  `∈` symbol (from Greek ἐστί, "is").
- **Zermelo, Ernst.** (1908) — `∈` as the primitive relation of the
  axiomatic theory; membership characterised by axioms, not defined.
- **Fraenkel / Skolem.** (1922) — the first-order formulation in which `∈`
  is the sole non-logical symbol.

## What this term IS (summary)

The primitive "is one of" relation `x ∈ A`, taken as given (a second root
of the seed alongside truth) and characterised by axioms rather than
defined. Sets are described with it; subset and the rest are built from it.
