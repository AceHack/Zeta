---
name: equality
defined-by: Leibniz's law (indiscernibility of identicals); first-order logic with equality
formalised: draft
dependencies: [implication]
---

# equality

## Plain English

Two names are **equal** when they point at the very same thing. *"The
morning star"* and *"the evening star"* are two names for one planet
(Venus) — so they are equal. The test: if `x` equals `y`, then anything
true of `x` is true of `y`, because there is only one thing there wearing
two names.

Equality is not "looks alike" and not "is similar to." Two identical-
looking toys are still two toys. Equality means *one and the same thing*.

## Mathematical definition

Equality `=` is the relation that is:

- **reflexive** — `x = x`
- **symmetric** — `x = y → y = x`
- **transitive** — `(x = y) ∧ (y = z) → x = z`

and satisfies **Leibniz's law** (indiscernibility of identicals): for
every property `P`,

```
x = y  →  (P(x) ↔ P(y))
```

The arrows and the biconditional `↔` are [`implication`](implication.md)
(`↔` is two implications), which is why equality depends on it. Leibniz's
law is what makes equality *usable*: it licenses substituting equals for
equals everywhere.

## Lean4 formalisation

```lean4
-- Lean's `Eq` is the inductive equality; `rfl` is reflexivity, and the
-- other properties are derived (real Mathlib/core declarations):
example (x : α) : x = x := rfl
example (x y : α) (h : x = y) : y = x := h.symm
example (x y z : α) (h₁ : x = y) (h₂ : y = z) : x = z := h₁.trans h₂

-- Leibniz substitution (indiscernibility of identicals) is `Eq.subst`:
example (x y : α) (P : α → Prop) (h : x = y) (px : P x) : P y := h ▸ px
```

Lean takes equality as a single-constructor inductive type whose only
proof is `rfl`; symmetry, transitivity, and substitution are theorems
about it, not separate axioms.

## Grounding point (per Otto-21 Craft discipline)

**A secret identity.** *Clark Kent = Superman.* Two names, one person.
Anything true of Clark (he is in this room) is true of Superman (he is in
this room) — because there is exactly one individual. The moment a story
needs them to be in two different places at once, it is denying the
equality. That is Leibniz's law doing detective work.

## What this term DOES NOT mean

- **Not similarity / equivalence.** Equal things are *one* thing; similar
  things are several things that share features. Equivalence relations
  (same-remainder, same-colour) group many distinct things; equality does
  not.
- **Not assignment.** The `=` that binds a value to a name in some
  programming languages is a command, not the equality relation.
- **Not culture-sensitive string match.** When equality is decided on text,
  the seed sense is **ordinal / structural** identity, never locale-aware
  collation. (See the factory's *culture-invariant-by-default* rule:
  `Comparer<string>.Default` is the wrong test; `StringComparer.Ordinal`
  is the right one. Equality must be bit-honest for 4-language byte-lock.)

## Citations

- **Leibniz, G. W.** *Discourse on Metaphysics* (1686) — the identity of
  indiscernibles and indiscernibility of identicals.
- **Frege, Gottlob.** *Über Sinn und Bedeutung* (1892) — sense vs.
  reference; the morning-star / evening-star example.
- **Martin-Löf, Per.** *Intuitionistic Type Theory* (1984) — definitional
  vs. propositional equality, the distinction Lean's `Eq` makes precise.

## What this term IS (summary)

The relation that holds when two names denote one and the same thing —
reflexive, symmetric, transitive, and substitution-licensing (Leibniz).
On text, the seed sense is ordinal/structural identity, not linguistic
collation.
