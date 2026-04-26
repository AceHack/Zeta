---
name: truth
defined-by: Tarski's semantic definition of truth (1933/1944)
formalised: draft
dependencies: []
---

# truth

## Plain English

**Truth** is the property an assertion has when what it
says matches what is the case.

"The apple is red" is true when the apple being referred
to is, in fact, red. "2 + 2 = 4" is true when the
arithmetic operation genuinely yields 4. Truth is not a
property of words alone; it is the correspondence
between the assertion and the situation the assertion
is about.

When we say something is **true**, we are claiming the
assertion has this correspondence property. When we say
something is **false**, we are claiming the assertion's
negation has this property.

## Mathematical definition

Following Tarski's 1933/1944 formalisation:

Given a language `L` with sentences `φ, ψ, ...`, a
**truth-definition** for `L` is a predicate `T` in a
richer metalanguage `M ⊃ L` such that for every sentence
`φ` of `L`:

```
T("φ")   if and only if   φ
```

The left side uses `T` applied to a *name* (quoted
string) of the sentence; the right side uses the sentence
itself as asserted in the metalanguage.

This is the **T-schema** (or Convention T). A
truth-definition is adequate when every instance of the
T-schema is a theorem of the metalanguage.

**Crucial Tarski theorem**: `L` cannot define its own
truth predicate (under mild assumptions). Truth is
definable only *about* `L`, only *in* a richer `M`. This
is what blocks the liar paradox: *"this sentence is
false"* cannot be self-consistently expressed in a
language that defines its own truth.

## Lean4 formalisation

```lean4
-- Deferred — draft sketch only.
--
-- In Lean4, `Prop` directly embodies the T-schema:
-- a proposition `p : Prop` IS its own truth condition.
-- You don't prove "T(p) ↔ p" in Lean's logic; you prove
-- `p` itself, and the act of producing a proof IS the
-- truth-witness. This is why Lean's type theory works
-- as a metalanguage for this term — Tarski's hierarchy
-- (object-language L ⊂ metalanguage M ⊂ ...) collapses
-- to a single layer when the object-language is Prop and
-- the metalanguage is the type theory above it.
--
-- A *reflective* truth predicate that talks about a
-- closed object-language (separate syntax, separate
-- quotation, separate evaluation) requires explicit
-- syntactic encoding in Lean. Mathlib has partial
-- substrate (Tarski-Vaught test, elementary substructure)
-- but no closed "Tarski's truth" theorem module as of
-- 2026-04-23.
--
-- Full formalisation: follow-on work per
-- `docs/linguistic-seed/README.md` §growth-discipline.
-- Deliberately NOT included here: the earlier draft
-- attempted `theorem T_schema : ∀ (p : Prop), (p = p) ↔ p`
-- which is logically incorrect — `(p = p)` is provable
-- for every p, so the equivalence reduces to "True ↔ p"
-- which is false for unprovable p. The error is fixed
-- by recognising that Lean's Prop already IS the
-- T-schema; no theorem needs to be proven about it.
```

## Grounding point (per Otto-21 Craft discipline)

**The witness-stand oath.** When a witness swears to "tell
the truth, the whole truth, and nothing but the truth,"
the oath names three aspects of truth:

- **Tell the truth** — say only assertions that correspond
  to what is the case (no false statements)
- **The whole truth** — say all relevant assertions that
  correspond (no omissions that mislead)
- **Nothing but the truth** — say only truth-correspondent
  assertions (no unrelated material mixed in)

The oath does not define truth in a philosophical sense;
it operationalises it for legal testimony. The factory
uses truth the same way — operationally, as a
correspondence between assertion and the-case-as-it-is.

## What this term DOES NOT mean

- **Not certainty** — we can assert truth without being
  certain; certainty is a confidence measure, truth is
  a correspondence property.
- **Not agreement** — a claim can be true even if no one
  agrees with it (the universe of facts is not
  determined by human agreement).
- **Not pragmatic-usefulness** — we are not defining
  truth as "what works in practice" (pragmatist
  redefinition); Tarski's correspondence is the seed's
  anchor.
- **Not coherence-alone** — we are not defining truth as
  "what fits with other beliefs" (coherentist
  redefinition); internal consistency is necessary but
  not sufficient.
- **Not provability** — a statement can be true without
  being provable in a given formal system (Gödel's
  incompleteness). Truth and provability are distinct
  predicates.

## Citations

- **Tarski, Alfred.** *"The Concept of Truth in
  Formalized Languages."* 1933 (Polish); 1956 (English
  translation in *Logic, Semantics, Metamathematics*).
  The seed's primary source for the correspondence /
  T-schema formalisation.
- **Tarski, Alfred.** *"The Semantic Conception of Truth
  and the Foundations of Semantics."* Philosophy and
  Phenomenological Research 4 (1944). The accessible
  English reformulation.
- **Gödel, Kurt.** *"On Formally Undecidable Propositions
  of Principia Mathematica and Related Systems I"*
  (1931). Establishes that truth and provability can
  diverge — motivating why the seed distinguishes them.

## Factory usage

Other factory vocabulary grounds through `truth`:

- **Assertion** (when landed) — something that can be
  true or false
- **Claim** — an assertion proposed for acceptance
- **Invariant** — a claim whose truth is preserved
  through state transitions
- **Property** (in property-based testing) — an assertion
  about all instances of a type that should be true for
  every instance
- **Proof** — a demonstration that a claim is true in a
  given formal system
- **Correctness** — the property of software that its
  outputs truly match its specification

Every factory claim of the form "X is true" / "X is
correct" / "X holds" grounds through this term's
correspondence definition.

## What this term IS (summary)

The correspondence property of an assertion with what is
the case, definable only in a richer metalanguage
(Tarski). The factory uses it operationally, not
philosophically: an assertion is true when
the-thing-it-asserts is what's actually happening.
