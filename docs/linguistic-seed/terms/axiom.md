---
name: axiom
defined-by: axiomatic (self-referential — an axiom is a claim posited true without proof)
formalised: draft
dependencies: [truth]
---

# axiom

## Plain English

An **axiom** is a claim you start from — accepted as [`true`](truth.md)
without proof, because it is where the proving *begins*. You can't prove
everything from something earlier forever; eventually you reach the first
stones you simply lay down. Those first stones are the axioms.

In this seed, the **root** terms are the axioms: [`truth`](truth.md) and
[`membership`](membership.md) are laid down (their `dependencies` are
empty), and every other term is built on them. So `axiom` is the seed
describing its own foundation — the word for what a root *is*.

## Mathematical definition

In a formal system, an **axiom** is a sentence taken as a theorem without
derivation — a leaf of every proof tree, never itself the conclusion of an
inference step. A system is the closure of its axioms under its inference
rules (e.g. *modus ponens*; see [`implication`](implication.md)). Formally
a term/file in this seed is an axiom exactly when its frontmatter carries

```
dependencies: []        and        defined-by: axiomatic
```

i.e. it is asserted, not reduced to earlier seed terms.

**Self-reference, Tarski-carefully.** Saying "the root terms are the
axioms" is the seed talking *about* its own structure. This is a
**metalanguage** statement (a claim about the term-files), not an
object-level paradox — exactly the stratification [`truth`](truth.md)'s
T-schema requires. The seed describes itself one level up; it does not
assert its own truth at its own level (which is what the liar paradox
needs and what Tarski's theorem forbids).

## Lean4 formalisation

```lean4
-- In Lean, an axiom is introduced with the `axiom` keyword: a declaration
-- asserted to inhabit a type with NO proof term. (Used sparingly — each
-- axiom is an unproven trust assumption.)
axiom choice_example {α : Type} : Nonempty (α → α)

-- The seed prefers proofs to axioms wherever a proof exists; an axiom is
-- the honest marker for "trusted, not derived" — auditable by `#print axioms`.
```

`#print axioms f` lists exactly which axioms a result `f` leans on — the
machine-checkable version of "name your unproven assumptions," which is the
auditing posture the seed wants for every root.

## Grounding point (per Otto-21 Craft discipline)

**The rules of a board game.** Before you can play, someone reads the rules
off the box: *the token starts on GO; you roll two dice.* Nobody proves
those — they're agreed, and play proceeds from them. Change the box rules
and you're playing a different game. Axioms are the box rules of a formal
system; the README's foundation-agnosticism is exactly "an adopter may
swap the box rules" (ZFC for type theory) and get a different but coherent
game.

## What this term DOES NOT mean

- **Not a self-evident eternal truth.** A modern axiom is a *chosen*
  starting assumption, not a claim no sane person could doubt. Different
  axiom sets (Euclidean vs. non-Euclidean) are all legitimate.
- **Not a definition.** An axiom *asserts* something true; a
  [`definition`](definition.md) *introduces a new term* without asserting a
  new fact. (Pairing term — they are the two kinds of "starting line.")
- **Not unrevisable.** Axioms can be dropped or replaced; doing so changes
  the system, openly. The seed records that as adopter-pluggability.

## Citations

- **Euclid.** *Elements* (c. 300 BCE) — postulates/common-notions, the
  archetype of axiomatic method.
- **Hilbert, David.** *Grundlagen der Geometrie* (1899) — the modern view:
  axioms as implicit definitions, freely chosen, judged by consistency.
- **Tarski, Alfred.** (1933) — the metalanguage stratification that makes
  the seed's "the roots are axioms" self-description paradox-free.

## What this term IS (summary)

A claim posited true without proof — the starting stone of a system; in
this seed, a root term (`dependencies: []`, `defined-by: axiomatic`). The
self-description is metalanguage-level (Tarski-careful), not a self-truth
claim. Paired with [`definition`](definition.md).
