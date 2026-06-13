---
name: implication
defined-by: The material conditional (classical propositional logic); Meredith's single-axiom basis
formalised: draft
dependencies: [truth]
---

# implication

## Plain English

**Implication** is the "if … then …" link between two claims. *"If it
rains, the ground gets wet."* It makes one promise, and the promise is
broken in exactly one situation: the first part is true but the second
part is false. If the first part is false, the promise was never tested —
it simply didn't apply, so it counts as kept.

That last bit is the surprising part to a beginner: *"if the moon is made
of cheese, then 2 + 2 = 4"* is a true implication, because the "if" never
happened. Implication is a promise about what follows *when* the first
thing holds — not a claim that the first thing holds.

## Mathematical definition

Written `φ → ψ`. Its truth (grounds through [`truth`](truth.md)) is given
by the truth table:

```
φ      ψ      φ → ψ
true   true   true
true   false  false        ← the only false row
false  true   true
false  false  true
```

Equivalently, `φ → ψ  ≡  ¬φ ∨ ψ` (material conditional). In classical
propositional calculus, implication together with negation generates every
connective, and **Meredith's single 21-symbol axiom** generates the whole
of classical propositional logic from this base via *modus ponens*
(`φ` and `φ → ψ` yield `ψ`). This is why implication is a seed term: it is
the smallest connective from which the rest of propositional reasoning
unfolds.

## Lean4 formalisation

```lean4
-- In Lean, implication is the function arrow itself: `φ → ψ`.
-- A proof of `φ → ψ` IS a function taking a proof of `φ` to a proof
-- of `ψ` (the Brouwer–Heyting–Kolmogorov / Curry–Howard reading).
-- Modus ponens is therefore just function application:
example (φ ψ : Prop) (hφ : φ) (himp : φ → ψ) : ψ := himp hφ

-- Classical material-conditional equivalence (¬φ ∨ ψ) needs classical
-- logic; it is NOT constructively provable in the → direction:
open Classical in
example (φ ψ : Prop) : (φ → ψ) ↔ (¬φ ∨ ψ) := by
  constructor
  · intro h; exact (em φ).elim (fun hφ => Or.inr (h hφ)) Or.inl
  · intro h hφ; exact h.elim (fun hnφ => absurd hφ hnφ) id
```

The constructive arrow and the classical material conditional differ only
on the law of excluded middle — a distinction the seed records rather than
hides.

## Grounding point (per Otto-21 Craft discipline)

**A vending machine.** *"If you put in a dollar, you get the snack."* The
promise is broken only by the one bad case: you put in your dollar and no
snack comes out (`φ` true, `ψ` false). If you never put in a dollar, the
machine broke no promise — it just sat there. That "never tested ⇒ promise
kept" rule is exactly why `false → anything` is true.

## What this term DOES NOT mean

- **Not causation.** `φ → ψ` does not say `φ` *makes* `ψ` happen; it only
  forbids the true→false case. Correlation/causation is a separate matter.
- **Not biconditional.** Implication runs one way. `φ → ψ` does not give
  you `ψ → φ`. (Two implications together make `↔`; see
  [`equality`](equality.md), which uses the biconditional.)
- **Not relevance.** The material conditional is true whenever the
  antecedent is false, *even if the two parts are unrelated*. Relevance
  logics reject this; the seed uses the classical material conditional.

## Citations

- **Frege, Gottlob.** *Begriffsschrift* (1879). The conditional stroke —
  the first rigorous treatment of "if…then" in a formal logic.
- **Whitehead & Russell.** *Principia Mathematica* (1910). Material
  implication `⊃`.
- **Meredith, C. A.** Single-axiom bases for the propositional calculus
  (1950s). Demonstrates implication-based minimal axiomatisation — the
  README's Meredith-minimalism anchor.
- **Howard, W. A.** *The formulae-as-types notion of construction* (1969).
  The Curry–Howard reading used in the Lean section.

## What this term IS (summary)

The "if…then" connective, false only when a true antecedent meets a false
consequent. The minimal connective from which propositional logic is
generated (Meredith); in type theory, the function arrow itself.
