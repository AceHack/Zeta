---
name: definition
defined-by: Definitional equality (stipulative introduction of a new term by abbreviation)
formalised: draft
dependencies: [equality]
---

# definition

## Plain English

A **definition** introduces a new word by saying it stands for something
already understood. *"A square is a rectangle with equal sides."* You learn
"square" for free, because "rectangle," "equal," and "sides" were already
yours. A definition adds no new *fact* about the world — it adds a shorter
name for a thing you could already describe the long way.

In this seed, **every non-root term-file is a definition**: it introduces
its term using only terms already landed. So `definition` is the seed's
word for *what those files are* — the partner of [`axiom`](axiom.md)
(axioms assert; definitions abbreviate).

## Mathematical definition

A **definition** stipulates that a new symbol is [`equal`](equality.md), by
introduction, to an expression in already-defined symbols:

```
newTerm  :=  expression-in-existing-terms
```

This is **definitional equality** (equality by stipulation), distinct from
a proved equation. Two soundness conditions make a definition admissible —
the conservativity criteria (Leśniewski / Suppes):

- **Eliminability** — every use of `newTerm` can be rewritten back into the
  old vocabulary; the new word is pure abbreviation.
- **Non-creativity** — adding the definition proves no new statement in the
  old vocabulary; it adds names, never facts.

A definition that fails these (e.g. one that smuggles in an existence claim)
is really a disguised [`axiom`](axiom.md), and the seed flags it as such.

**Self-reference, Tarski-carefully.** "Every non-root file is a definition"
is a metalanguage statement about the seed's files, one level above the
terms themselves — the same stratification [`axiom`](axiom.md) uses. No
file defines itself; each defines its term from *earlier* terms, which is
why the dependency graph is acyclic.

## Lean4 formalisation

```lean4
-- A Lean `def` is exactly a (non-creative, eliminable) definition:
def IsSquare (r : Rectangle) : Prop := r.width = r.height
-- `IsSquare` is definitionally equal to its body; unfolding it recovers the
-- old vocabulary (eliminability), and it asserts no new theorem
-- (non-creativity). `abbrev` makes the definitional-equality transparent.
```

Lean enforces the conservativity in practice: a `def` cannot make a
previously-unprovable proposition provable; only an `axiom` can.

## Grounding point (per Otto-21 Craft discipline)

**A nickname.** "Let's call the tall barista 'Stretch.'" Now everyone says
"Stretch" instead of "the tall barista" — shorter, but it added no new
person and no new fact, and you can always expand it back. A good
definition is a nickname for an idea: convenient, removable, fact-free.
A bad "definition" that sneaks in a new claim ("Stretch, who owns the
shop") is really asserting something — an axiom wearing a nickname's coat.

## What this term DOES NOT mean

- **Not an axiom.** A definition asserts no new fact (non-creative); an
  [`axiom`](axiom.md) does. Conflating them is the classic error this term
  guards against.
- **Not a proof.** A definition introduces a term; it does not demonstrate
  a claim true. `newTerm := …` is stipulation, not derivation.
- **Not a dictionary gloss.** The seed sense is *formal* definition
  (eliminable + non-creative), stronger than a plain-language synonym.

## Citations

- **Leśniewski, Stanisław** / **Suppes, Patrick.** *Introduction to Logic*
  (1957) — the eliminability + non-creativity criteria for admissible
  definitions.
- **Pascal, Blaise.** *De l'esprit géométrique* (c. 1657) — definitions as
  abbreviations that must be removable.
- **Frege, Gottlob.** *Grundgesetze* (1893) — the demand that definitions
  introduce, never covertly assert.

## What this term IS (summary)

The stipulative introduction of a new term as definitionally equal to an
expression in existing terms — eliminable and non-creative (adds a name,
not a fact). Every non-root seed file is one. Paired with
[`axiom`](axiom.md); the metalanguage self-description is Tarski-careful.
