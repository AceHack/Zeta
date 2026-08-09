---
name: n-version-derivation
description: N-version derivation — two independent implementations of one spec; divergence is a SPEC defect; coverage declared per requirement, never rounded up.
---

# N-Version Derivation

Capability skill. No persona lives here. Owns the discipline of
building a thing **twice, independently**, to find out what its
specification actually failed to say.

Zeta inherits the N-version tradition (Avižienis, 1977/1985) *and
its strongest refutation* — Knight & Leveson (1986) showed
independently developed versions fail in **correlated** ways, so
N-version **voting** does not buy the reliability it promises. Take
the refutation seriously and the technique survives with a different
purpose: you are not voting, you are **reading the divergence**. Two
honest implementers who disagree have found a sentence that admits
two readings, and that sentence is the defect. Separation discipline
comes from clean-room software engineering (Harlan Mills, IBM) and
clean-room design (the Phoenix BIOS wall).

## The carved sentence

> **A divergence between two independent derivations is a defect in
> the SPECIFICATION until argued otherwise.** The implementations are
> the instrument; the amended spec is the product.

## The falsifiable check

Under this discipline, **"both implementations passed their tests" is
not a result.** A run that produces no spec amendments either had a
perfect spec or wasn't independent — and the second is far more
likely. If a combine yields zero spec defects, suspect the wall
leaked before you congratulate the spec.

## The three failures this exists to catch

1. **Rounding partial up to done.** A derivation must declare
   `implemented / partial / deferred / blocked` **per requirement**.
   Deferring is correct and expected; misreporting is the failure. A
   header comment is not a checked artifact.
2. **The vacuity class.** A property satisfied by a literal, a
   non-optional field, or a type-level constant — no test asserting
   it can fail. Every acceptance criterion must name the function
   whose output demonstrates it *and two inputs that make that output
   differ.*
3. **Failure to discriminate.** Vacuous and unfalsifiable are ONE
   defect over different input sets: nothing can make the predicate
   differ (`AllInputs`), or obeying the spec removes the
   discriminating input (`ConformingInputs`). Worked case: "two
   principals with skewed clocks agree" cannot be failed once the
   spec forbids clocks.

   Reduce each one against the **fixed-point registry** rather than
   re-deriving it — and **pigeonhole by the subject's own self-claim,
   never by your inference.** The observer checks whether a
   self-claim was delivered; it does not choose the bin.
   `DoesNotReduce` is a first-class outcome: **a registry that always
   finds a match is the vacuity class wearing a lookup table.**

## Sequence

`Specified → Derived (n ≥ 2) → Report → Combined → Amended`

**The derivation report is a first-class artifact, not a courtesy.**
The implementer hits each ambiguity while building; that experience
is unrecoverable from the finished code, and a combine over
artifacts alone will find fewer defects than the implementer already
knows about. Collect the report before the agent stops.

Two separation disciplines, pick deliberately:

- **Cleanroom** — implementer barred from prior art. Buys a genuine
  second reading; costs a full duplicate implementation.
- **Whitebox** — sight permitted, and **attribution, contributing
  back, and profit-sharing replace the wall**. Cheaper and more
  honest where available: it does not pretend to an independence it
  does not have. An **unknown license blocks it** — unknown is not
  permissive.

## Types

`src/Core/DerivationProtocol.fs` — `Wall`, `Evidence`, `Coverage`,
`Divergence`, `Derivation`, `combine`, `unmetBy`. Every case exists
because a real run needed it. `supportsClaim` refuses
`MutantSurvived`, `NotConfirmed` and `AssertedOnly`; `isSpecDefect`
returns true for everything except an argued `ImplementationDefect`.

## Carried-forward finding (applies well beyond this discipline)

> Replaying a whole event stream **in order** reconstructs the same
> state anyway, so `fold(s @ s) = fold(s)` **cannot** catch a missing
> dedup guard. Only redelivering an **old** event *after later events
> have landed* catches it.

Any idempotency test written as replay-the-whole-stream is weaker
than it looks.

## Pointers

- `docs/specs/key-custody-n-version-combine.md` — the worked run:
  12 spec defects, and one acceptance criterion everybody believed
  was met that nobody had built.
- `.claude/rules/cleanroom-two-team-separation.md` — whoever LOOKED
  may not BUILD.
- `.claude/rules/anchor-to-human-prior-art.md` — why Avižienis,
  Knight & Leveson, and Mills are named above rather than implied.
