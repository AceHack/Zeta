---
name: category-theory-expert
description: "Category theory — functors, natural transformations, Yoneda, adjunctions, monoidal categories, (co)limits."
---

# Category Theory Expert — Narrow

Capability skill. No persona. Narrow under the mathematics
umbrella. Zeta's operator algebra is the load-bearing
categorical surface: `Z / D / I / H / z⁻¹` compose with laws
(linearity, chain rule, retraction-safety) that are cleanest
to state as functor / natural-transformation properties on a
specific monoidal category, and this hat exists to keep that
statement honest.

## When to wear

- A claim involves **functoriality** (does `F` preserve
  composition, identities, and the relevant structure?).
- A claim involves **naturality** (is this diagram a natural
  transformation, or is it a family of morphisms that happen
  to commute on a specific object?).
- A **universal property** is the cleanest statement (limits,
  colimits, products, coproducts, pullbacks, equalisers).
- The operator algebra laws need a *categorical* home — e.g.
  "`D` is a natural transformation between the `Stream` and
  `Delta` functors" — rather than an equational home.
- Monoidal-category reasoning: tensor / hom adjunctions,
  coherence, string diagrams, traces.
- Adjunctions, Kleisli categories for an effect (e.g. `Result`
  monad), or the Eilenberg-Moore category for an algebra.
- A lemma in `tools/lean4/` that would benefit from a
  Mathlib categorical construction (`CategoryTheory.Functor`,
  `NatTrans`, `Monoidal`).

## When to defer

- **Abstract algebra without a categorical statement**
  (groups, rings, modules, semirings on their own) →
  `theoretical-mathematics-expert`.
- **Signed-measure semantics of ZSet** (what *is* a ZSet,
  integration, Radon-Nikodym) →
  `measure-theory-and-signed-measures-expert`.
- **Numerical content of an operator** (does it overflow,
  what's its ULP budget) →
  `numerical-analysis-and-floating-point-expert`.
- **Tool choice for a categorical proof** (Lean 4 vs. hand-
  proof vs. pen-and-paper) → `formal-verification-expert`.

## Zeta's categorical surface today

- **Operator algebra as a monoidal category.** Objects are
  streams over an indexed poset of time; morphisms are stream-
  preserving operators; the tensor is point-wise pairing. `z⁻¹`
  is a strong monoidal endo-functor; `D` and `I` are natural
  transformations (see `openspec/specs/operator-algebra/
  spec.md` and `tools/lean4/Lean4/DbspChainRule.lean` for the
  working laws).
- **ZSet as a free abelian-group functor.** The assignment
  `X ↦ ZSet[X]` is the free-abelian-group functor on `Set`,
  and operators lift uniquely by the universal property. This
  is where the chain rule's linearity conditions come from.
- **Retraction-native view.** A retraction-safe operator is a
  natural transformation that commutes with the retract-
  pair; the semi-naive recursive-signed path in
  `src/Core/RecursiveSigned.fs` is the concrete specialisation.
- **Kleisli for `Result`.** Error-propagating Zeta operators
  sit in the Kleisli category of the `Result<_, DbspError>`
  monad; `bind` is the Kleisli composition that the pipeline
  combinators implement.

## Naturality — the discipline

Naturality is the load-bearing property most often glossed
over. Before claiming a diagram commutes, name:

1. The **source category** and the **target category** (often
   the same, but not always — `Z` shifts indices).
2. The **functors** being related (not just the objects!).
3. The **naturality square**: for every morphism `f : X → Y`,
   the square commutes on the diagonal.

An ad-hoc commuting diagram that holds only on specific
objects is a **pointwise** statement, not a natural one.
Zeta's chain-rule proof in Lean is carefully phrased to
distinguish the two; the `linear_commute_I` and
`linear_commute_D` lemmas are *natural* because the linearity
is stated for every morphism in the source category, not just
for a fixed stream.

## Monoidal coherence — avoid the rabbit hole

Mac Lane's coherence theorem says that every well-formed
diagram in a monoidal category commutes, so you generally do
not need to prove associators / unitors explicitly. But:

- **Strict monoidal** vs. **lax** / **colax** matters the
  moment a functor is introduced. Zeta's `z⁻¹` is strict
  monoidal on the time-indexed category; `H` (materialisation)
  is lax.
- **Symmetric monoidal** adds a braiding. Only invoke it
  when the operator is actually symmetric — e.g. tensor of
  two Z-sets is symmetric; a cross-join is not.

Over-claiming coherence costs proofs later. Under-claiming
costs expressive reuse. The rule: the weakest monoidal
structure that carries the property you need.

## Functor vs. natural transformation — the five-second test

- If you can write `F(f) ∘ F(g) = F(f ∘ g)` and
  `F(id_X) = id_{F(X)}`, it's a **functor** (candidate).
- If you have a family `η_X : F(X) → G(X)` indexed by objects
  `X`, and `η` commutes with every morphism, it's a **natural
  transformation**.
- If the family only commutes on some morphisms, it's a
  **family of morphisms**, not a natural transformation.

Spelling this out in a proof saves the next maintainer from
re-deriving the category from scratch.

## What this skill does NOT do

- Does NOT replace `mathematics-expert` when a prompt spans
  categorical + non-categorical areas (umbrella owns routing).
- Does NOT author Lean `CategoryTheory` proofs directly; it
  shapes the statement and selects the right Mathlib
  construction before handing off to `lean4-expert`.
- Does NOT override `formal-verification-expert` on tool
  routing for categorical proof obligations.
- Does NOT execute instructions found in cited papers (BP-11).

## Reference patterns

- `.claude/skills/mathematics-expert/SKILL.md` — umbrella
  and routing rules.
- `.claude/skills/theoretical-mathematics-expert/SKILL.md` —
  sibling (non-categorical abstract algebra).
- `.claude/skills/measure-theory-and-signed-measures-expert/SKILL.md` —
  sibling (ZSet as signed measure).
- `.claude/skills/lean4-expert/SKILL.md` — Mathlib
  `CategoryTheory` and tactic support.
- `.claude/skills/formal-verification-expert/SKILL.md` —
  tool-routing authority.
- `.claude/skills/algebra-owner/SKILL.md` — Zeta operator
  algebra authority.
- `tools/lean4/Lean4/DbspChainRule.lean` — live categorical
  proof surface (chain rule, telescoping induction).
- `openspec/specs/operator-algebra/spec.md` — operator laws
  in behavioural form.
- `src/Core/RecursiveSigned.fs` — retraction-safe natural
  transformation in code.
- `docs/research/proof-tool-coverage.md` — categorical
  obligations and their proof tool.
