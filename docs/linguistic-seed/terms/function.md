---
name: function
defined-by: Set-theoretic function (single-valued, total relation); Dirichlet–Bourbaki; Kuratowski ordered pair
formalised: draft
dependencies: [set, equality]
---

# function

## Plain English

A **function** is a rule that gives each input *exactly one* output. A
vending machine: each button gives one snack, and the *same* button always
gives the *same* snack. Two things are required — every button does
something (no dead buttons), and no button gives two different snacks on
two different presses.

That "same input ⇒ same output, always" is the heart of it. It is also the
seed of *determinism*: if the world is a function of its starting state,
the same start replays to the same ending.

## Mathematical definition

A function `f` from `A` to `B` is a [`set`](set.md) of ordered pairs
`f ⊆ A × B` that is

- **total** — `∀a ∈ A. ∃b ∈ B. (a, b) ∈ f`  (every input has an output), and
- **single-valued** — `∀a, b₁, b₂. (a, b₁) ∈ f ∧ (a, b₂) ∈ f → b₁ = b₂`
  (the output is unique).

Together these say `∀a ∈ A. ∃! b ∈ B. (a, b) ∈ f`. The uniqueness clause
is [`equality`](equality.md) (`b₁ = b₂`); the pairs live in a
[`set`](set.md). An **ordered pair** is itself reducible to sets via
Kuratowski's encoding `(a, b) := {{a}, {a, b}}`, so a function bottoms out
entirely in sets and equality.

## Lean4 formalisation

```lean4
-- Lean takes the function space `A → B` as primitive (type theory),
-- rather than building it from ordered pairs. Single-valuedness is then
-- automatic and shows up as congruence — equal inputs give equal outputs:
example (f : A → B) (x y : A) (h : x = y) : f x = f y := congrArg f h

-- The set-theoretic reading (a function AS its graph) is also available:
--   `Set.graphOn` / `Function.graph` relate `f` to `{(a, f a) | a}`.
```

The two readings agree: type theory's primitive arrow and set theory's
single-valued total relation describe the same object; `congrArg` is the
single-valuedness law made into a theorem.

## Grounding point (per Otto-21 Craft discipline)

**A light switch.** Each position of the switch maps to exactly one state
of the bulb: up → on, down → off. You never get "up → sometimes on,
sometimes off" — if you did, it wouldn't be a switch, it'd be a gremlin.
The vending machine is the same lesson with more buttons. Determinism is
just this promise scaled up to a whole machine: the factory's DST
(deterministic simulation testing) is the demand that a run be a *function*
of its seed.

## What this term DOES NOT mean

- **Not a general relation.** A relation may send one input to many outputs
  (one person → many phone numbers). A function may not; that's the
  single-valued clause.
- **Not a procedure with side effects.** The seed sense is a pure mapping
  input→output, not a block of code that also writes to the world. (The
  factory keeps effects behind a metered membrane — noninterference §13 —
  precisely to keep the mathematical-function reading honest.)
- **Not partiality by default.** The seed function is *total* over its
  stated domain; a "partial function" is a total function on a smaller
  domain, named honestly.

## Citations

- **Dirichlet, P. G. L.** (1837) — the modern "arbitrary rule" notion of a
  function, freed from formula.
- **Kuratowski, Kazimierz.** (1921) — the ordered-pair-as-set encoding
  `(a,b) = {{a},{a,b}}` used above.
- **Bourbaki, Nicolas.** *Théorie des ensembles* (1954) — the function-as-
  graph (set of ordered pairs) standardisation.

## What this term IS (summary)

A total, single-valued mapping from inputs to outputs — same input always
the same output. Built from sets and equality (graph of ordered pairs); in
type theory, the primitive arrow. The seed-root of determinism (DST).
