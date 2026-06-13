---
name: set
defined-by: The axiom of extensionality (Zermelo–Fraenkel); Cantor's collection
formalised: draft
dependencies: [equality, implication]
---

# set

## Plain English

A **set** is a collection of things where the *only* thing that matters is
**which** things are in it — not what order you list them, not how many
times you say them. Your toy box is the same toy box whether you list the
blocks first or the cars first, and saying "blocks, blocks" doesn't give
you more blocks.

The whole identity of a set is its members. So two sets are the same set
exactly when they have the same members — nothing else about them counts.

## Mathematical definition

Take membership `∈` as primitive (`x ∈ A` means "`x` is in `A`"). The
defining law is the **axiom of extensionality**:

```
A = B   ↔   ∀x. (x ∈ A  ↔  x ∈ B)
```

Two sets are [`equal`](equality.md) iff they have exactly the same
elements. The biconditionals are [`implication`](implication.md). This one
axiom is what makes order and repetition invisible: `{1, 2}`, `{2, 1}`, and
`{1, 1, 2}` all have the same members, so by extensionality they are the
same set.

(Membership `∈` is itself a primitive not yet given its own seed term —
an honest dangling edge recorded in the prereq graph, to be backwards-
chained when a downstream term needs it.)

## Lean4 formalisation

```lean4
-- In Mathlib a set over `α` is its membership predicate:
--   `Set α := α → Prop`,  with  `x ∈ A` meaning `A x`.
-- Extensionality is `Set.ext` (a real Mathlib lemma):
example (A B : Set α) (h : ∀ x, x ∈ A ↔ x ∈ B) : A = B := Set.ext h
```

Modelling a set as its membership predicate makes extensionality almost
definitional: two predicates that agree on every input are the same set.

## Grounding point (per Otto-21 Craft discipline)

**A guest list.** The party's guest list is defined by *who is invited* —
not the order names were written, not whether someone got written twice by
mistake. Two lists with the same guests are the same guest list. If you
want order to matter (who arrives first) or repeats to matter (how many
slices each person ate), you need a different tool — a sequence or a bag —
not a set.

## What this term DOES NOT mean

- **Not a list / sequence.** A list cares about order and position;
  `[1, 2] ≠ [2, 1]`. A set does not.
- **Not a multiset / bag.** A bag counts repeats; `{|1, 1|}` differs from
  `{|1|}`. A set collapses repeats. (The factory's **Bag** primitive is
  the multiset — deliberately *not* a set — and it carries the
  ordinal-parity requirement; see `docs/PRIMITIVE-REGISTRY.md`.)
- **Not a type.** Types and sets are related but distinct foundations; the
  seed stays foundation-agnostic (see README §What-this-skeleton-does-NOT-do).

## Citations

- **Cantor, Georg.** *Beiträge zur Begründung der transfiniten
  Mengenlehre* (1895) — the founding notion of a set as a collection.
- **Zermelo, Ernst.** *Untersuchungen über die Grundlagen der Mengenlehre*
  (1908) — the axiomatisation including extensionality.
- **Fraenkel, Abraham.** (1922) — the F in ZF; replacement and the modern
  axiom set.

## What this term IS (summary)

A collection identified entirely by its members (extensionality): order
and repetition do not count. Distinct from list (order matters) and bag
(repeats matter).
