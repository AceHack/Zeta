---
id: B-0196
priority: P2
status: open
title: BigInt + BigRational + BigDecimal + BigFloat integration -- substrate survey + per-class adoption recommendation (Aaron 2026-05-05)
tier: research
effort: M
ask: Aaron 2026-05-05 verbatim "oh backlog bigint and other bitnumbers integration"
created: 2026-05-05
last_updated: 2026-05-05
depends_on: []
composes_with: [B-0140, B-0156, B-0189, B-0194, B-0198, B-0202, B-0204, B-0205]
tags: [numerics, bigint, bigrational, bigdecimal, bigfloat, mpfr, dbsp, generic-numerics, srtp, research, alignment]
type: friction-reducer
---

# B-0196 -- BigInt and other big-number integration in Zeta

## Source

Aaron 2026-05-05 verbatim:

> *"oh backlog bigint and other bitnumbers integration"*

Surfaced after a reviewer caught int64 overflow in
`Units.msToNs` (PR #1590, fixed via `Checked.(*)` + 3
overflow tests). The msToNs case is **one instance** of a
broader question this row owns: should Zeta support
arbitrary-precision integers (BigInteger), arbitrary-
precision rationals (BigRational), arbitrary-precision
decimals (BigDecimal), and arbitrary-precision floats
(BigFloat / MPFR-style) for cases where int64 / double
overflow or precision-loss is in the operating regime?

## Carved sentence

*"Pick numerics by where the regime fires; per-class
adoption beats a system-wide refactor until the second
overflow site lands. The msToNs fix is a Checked-throws
guard, not yet a BigInteger argument; the second site is
the trigger."*

## What this row is

A **research + plan row**. It is NOT an implementation
row. The output is a survey + a per-numeric-class
adoption recommendation; doing the swap (where any swap
turns out to be warranted) is a separate row filed
downstream.

## What's in scope

Five concrete shapes the row covers:

1. **BigInteger** (.NET `System.Numerics.BigInteger`).
   For cases where weight or cardinality counts exceed
   int64 (high-frequency append-only Z-sets, long-running
   counters). Open question: is `Weight = int64`'s ring
   choice load-bearing on `int64` specifically, or only
   on "the canonical weight ring `ℤ`" (per
   `src/Core/Algebra.fs` line 5-7 comment)? UoM
   compatibility -- `int64<weight>` works for current
   Zeta scale; `BigInteger<weight>` is a hypothesis to
   test. The expected (training-data) answer is that
   F# UoM is constrained to primitive numeric types
   per the spec, but per Otto-364 search-first
   authority that hypothesis must be WebSearch-verified
   against current Anthropic / FSharp-Foundation /
   Mathlib documentation before binding -- recent F#
   versions may have lifted the constraint, or
   community workarounds (measure-attributed wrapper
   structs) may already exist. Section (d) is the
   research task that resolves this.

2. **BigRational**. Arbitrary-precision exact rationals
   for probability arithmetic where float precision
   loss matters (small-probability tail events,
   Bayesian normalization at high decimal precision).
   Currently `src/Bayesian/BayesianAggregate.fs` uses
   `double` throughout (`BetaBernoulli`, `NormalInverseGamma`,
   `DirichletMultinomial`). Composes with B-0189 (Q#
   Bayesian BP/EP runtime).

3. **BigDecimal**. Arbitrary-precision decimal arithmetic
   for financial calculations. Zeta's LFG (Lucent
   Financial Group) context implicates this given the
   financial-services orientation. .NET has
   `System.Decimal` (28-29 significant digits, fixed
   range) but not a true unbounded `BigDecimal`; the
   community library `Singulink.Numerics.BigDecimal`
   is one option to evaluate.

4. **MPFR-style BigFloat**. Arbitrary-precision floating-
   point for scientific calculations needing more than
   `double`'s 53 bits of mantissa. Not yet identified
   as load-bearing for any current Zeta surface; the
   research output should name whether any of the
   formal-verification toolbelt (`tools/lean4/`,
   `tools/Z3Verify/`) or research-mathematics surfaces
   (`docs/research/aurora-immune-system-math-cross-review-otto-gemini-2026-04-26.md`)
   genuinely need MPFR-grade precision, or whether
   `double` suffices.

5. **Numeric type-class abstraction (F# SRTP-based
   generic numerics)**. So DBSP operators can work
   over arbitrary numeric types
   (`'T : ( + ) ( * ) Zero One`) rather than hard-coded
   to `int64` / `double`. Existing F# patterns:
   `LanguagePrimitives.GenericZero`,
   `LanguagePrimitives.GenericOne`. Note: SRTP
   imposes JIT specialization cost; performance
   assessment is part of the research output.

## Four-property hodl invariant (binding acceptance test)

Aaron 2026-05-05 added four load-bearing properties that any numeric-type addition must demonstrate "hodl" through (composes with `memory/feedback_aaron_class_discovery_experiment_rodney_razor_on_self_dst_holds_everywhere_aaron_2026_05_01.md` "DST hodls everywhere"). These are NOT separable; relaxing any one lets bugs through (the Prop 3.5 misattribution caught earlier this session is a worked example -- the Lean structural decision passed all four, but the prose-citation wasn't subjected to the same conjunction, so it leaked):

1. **DST-safe** -- deterministic simulation testing per Otto-272. Every operation is replayable, deterministic-on-fixed-seed.
2. **Lock-free** -- no mutual exclusion. Compatible with the lock-free runtime.
3. **Scale-free** -- works across scales, small to BigInteger / arbitrary-precision (SPATIAL axis) AND across timescales, per-tick to multi-decade (TEMPORAL axis). The temporal axis was implicit in the original framing; Aaron 2026-05-05 made it explicit (preserved at `docs/research/2026-05-05-claudeai-cs-is-not-cs-scale-free-in-time-ossified-framework-diagnosis-aaron-forwarded-preservation.md`, PR #1623). The same operation/discipline pattern must hold across both axes: bootstrap razor at conversation scale IS postmortems at project scale IS building codes at field scale IS constitutional reform at civilization scale; same shape, different time-resolutions. Per-tick instrumentation accumulates data normally only available at decades-of-failure scale (the load-bearing claim hidden in the tick-cadence discipline).
4. **DBSP-native** -- retraction-aware. Negative weights compose cleanly through the operation; the operation is consistent under signed-delta application. NOT all numeric types satisfy this trivially: BigInteger as weight type works (ring algebra holds); BigDecimal-with-rounding may NOT (rounding errors don't necessarily compose with negation); float arithmetic explicitly doesn't (commutative-but-not-associative under accumulation).

**Per-candidate acceptance scoring**: each numeric-type candidate (BigInteger, BigRational, BigDecimal, BigFloat) gets scored against all four. Failure on ANY axis means rejection or restriction-to-non-incremental-use. Score-against-the-conjunction is the binding test, not score-against-overflow-prevention-alone.

## Human anchors

- **Tanner Gooding** -- .NET runtime, led the .NET 7+ generic math interfaces work (`INumber<T>`, `IBinaryInteger<T>`, `IFloatingPoint<T>`). Primary anchor for the SRTP-replacement-for-numeric-typeclass-abstraction shape this row inherits.
- **Don Syme** -- F# language anchor (separate track; relevant for any F#-language-extension proposals like the existential-quantification RFC #1591). Stays the F# anchor; numerics-runtime work goes through Tanner Gooding.
- **Leonid Ryzhyk (@ryzhyk)** -- DBSP / Feldera GitHub anchor. ENGAGEMENT GATE: only engage IF the per-class evaluation produces a real DBSP-compatibility finding (e.g., "BigDecimal-with-rounding fails the DBSP-native acceptance test, here's the counter-example"). Cross-check first; do NOT engage on speculative findings.

## Acceptance criteria (with falsifiability hooks)

### (a) Substrate survey

Survey the current Zeta substrate for numeric types in
use. Method: grep for `int64`, `float`, `double`,
`BigInteger`, `decimal`, `Checked.` across `src/Core`,
`src/Bayesian`, `src/Core.CSharp`, and any Aurora
surfaces. Produce a count summary + a list of files-by-
category.

- **Verifier**: the grep output is reproducible at any
  time; the count is a function of the working tree.
- **Pass**: report names every numeric-type surface
  AND provides a count; cross-checked with at least one
  reviewer (subagent or peer-AI).
- **Fail (falsifier)**: a numeric-type surface is
  missed by the survey (caught later by a reviewer or
  by failure-mode evidence). Re-run the survey with
  the missed pattern added.

**Pre-survey starting numbers (this row's authoring
moment, so the research has a baseline)**:

- `src/Core` `int64|float|double` mentions: ~470 lines
  (raw grep, not filtered for false-positives like
  `let float = ...` -- the deduped count is research
  output, not pre-survey).
- `Checked.*` arithmetic guard sites: ~40 across the
  Core surfaces (`ZSet.fs`, `Operators.fs`,
  `IndexedZSet.fs`, `Crdt.fs`, `CountMin.fs`,
  `TimeSeries.fs`, `NovelMath.fs`, `NovelMathExt.fs`,
  `Aggregate.fs`, `Advanced.fs`, `SimdMerge.fs` are
  the file set the initial subagent grep surfaced;
  the deduped per-file count is part of the survey
  output, not pre-survey baseline). `BayesianAggregate.fs`
  was originally listed here in error -- it has only
  one `Checked.*` mention, and that's a doc-comment
  reference, not arithmetic guards. Bayesian surfaces
  use `double` arithmetic without checked guards
  (their precision-loss risk is different in shape
  from int64-overflow risk -- relevant to the
  BigRational candidate, not the BigInteger one).
  The survey should produce the verified per-file
  count.

### (b) Risk-site identification

Identify the 3-5 concrete sites where overflow /
precision-loss is **actually a risk** in the
operating regime, not theoretical. Each candidate
gets a paragraph with: (i) the operating regime that
makes it risky, (ii) what currently happens on
overflow (silent wrap, `Checked.*` throw, NaN
propagation), (iii) the proposed remediation
(BigInteger swap, BigRational swap, narrow guard,
do-nothing).

**Starting candidates (research-output validates,
extends, or rejects)**:

1. **`Units.msToNs`** (`src/Core/Units.fs`) -- the
   case Aaron's row-creation comment named. Currently
   `Checked.(*)` guards; +/-9.22e12 ms (~292 years)
   triggers `OverflowException`. **Question**: does
   any Zeta surface produce ms values in that regime?
   If yes, BigInteger argument; if no, the
   `Checked.*` guard is the right shape. Research
   output picks one.

2. **Z-set weight aggregation** (`src/Core/ZSet.fs`
   sum / scale / negate paths -- 15 `Checked.*` sites
   in this file alone). Currently `Weight = int64`
   (`src/Core/Algebra.fs`). **Question**: does any
   long-running stream + heavy multiplicities push
   aggregate weight beyond int64 (~9.22e18)? If yes
   in the deployed regime, BigInteger weight is on
   the table. If no, `Checked.*` is sufficient.
   Research output picks one.

3. **`IndexedZSet` delta cross-product**
   (`src/Core/IndexedZSet.fs:289`). `Checked.(*)`
   on `va.[x].Weight * vb.[y].Weight` -- the
   product of two int64 weights. Multiplying near-
   max int64 weights overflows immediately; the
   guard fires. **Question**: do bilinear delta
   products in heavy-shard Zeta produce near-max
   weights? If yes, BigInteger product is on the
   table. If no, the guard is correct.

4. **`BayesianAggregate.BetaBernoulli` /
   `NormalInverseGamma` / `DirichletMultinomial`**
   (`src/Bayesian/BayesianAggregate.fs`). All
   `double`-based. **Question**: do small-
   probability tail events (e.g., probability
   1e-300, near double's underflow) appear in
   Zeta's Bayesian operating regime? Does
   normalization at high decimal precision matter?
   If yes, BigRational on the table. If no, double
   is correct. Composes with B-0189 (Q# BP/EP
   runtime).

5. **`TimeSeries.fs`** time-window arithmetic (lines
   141-158). `Checked.(+)` on `tA + lowerOffset` etc.
   **Question**: do any time-window scenarios
   produce int64 overflow on the offset arithmetic?
   This is the general msToNs question generalized
   to arbitrary time-arithmetic.

- **Verifier**: each candidate's "operating regime"
  paragraph names a falsifier. If the falsifier
  fires (regime is real and produces overflow), the
  remediation lands as a follow-up row. If the
  falsifier doesn't fire, the candidate closes as
  "guard sufficient."
- **Pass**: 3-5 candidates examined, each with
  falsifier; at least one is named as
  remediation-needed OR all named as guard-
  sufficient with a one-line reason each.
- **Fail (falsifier)**: a known overflow site is
  missing from the candidate list (e.g., Aaron or
  a reviewer points at one the survey missed).
  Add it and re-evaluate.

### (c) Decision: per-class vs system-wide

Pick one of:

1. **Per-numeric-class adoption** -- only swap
   where the risk fires. msToNs gets BigInteger
   only if regime evidence shows ms values >9e12;
   weight stays int64 unless heavy-shard regime
   produces overflow; Bayesian stays double unless
   tail-event regime fires. Default if (b) finds
   <=2 sites that genuinely need it. Lower scope,
   lower disruption.

2. **System-wide generic-numerics refactor** --
   adopt SRTP-based numeric type-classes
   (`'T : ( + ) ( * ) Zero One`) so all DBSP
   operators are numeric-type-polymorphic. Default
   if (b) finds 3+ sites AND the SRTP performance
   cost is judged acceptable. Higher scope, higher
   disruption, future-proofs against new
   numeric-type asks.

3. **Defer until second overflow site lands** --
   the carved sentence's default. msToNs is the
   first case; the second overflow site (when it
   appears in production-like regime) is the
   trigger for either (1) or (2). Default if (b)
   finds zero current-regime sites that fire.

- **Verifier**: the decision is downstream of (b);
  it is a decision-with-rationale, not a
  falsifiable claim. The rationale is recorded in
  the resolution note.
- **Pass**: one of the three options is picked
  with a paragraph of rationale citing the (b)
  findings; if (1) is picked, the per-site
  remediation rows are filed (e.g., "B-NNNN: swap
  Z-set weight to BigInteger").
- **Fail (falsifier)**: rationale doesn't follow
  from (b); decision contradicts the survey
  evidence. Re-do the decision moment with
  evidence cited.

### (d) F# UoM compatibility note

Investigate whether F# Units of Measure extends to
`System.Numerics.BigInteger`. Per the F# spec, UoM
is constrained to primitive numeric types
(`int`, `int64`, `float`, `float32`, `decimal`,
`sbyte`, `int16`, `nativeint`, `uint`, `uint64`,
`uint16`, `byte`, `unativeint`) -- `BigInteger` is
not on that list as of the F# 7/8/9 specs.

- **Verifier**: F# language reference + a small
  experimental .fsx file confirming the typecheck
  result.
- **Pass**: one-paragraph note in the research
  output naming whether UoM works on BigInteger
  (likely doesn't); if it doesn't, the note
  recommends either (i) wrapping BigInteger in a
  measure-attributed struct, or (ii) abandoning UoM
  for BigInteger paths. Research output picks.
- **Fail (falsifier)**: the spec actually allows it
  (training data wrong) -- per Otto-364 search-
  first authority, WebSearch the current F# spec
  before asserting. Update the note with the
  current truth.

### (d) verification result -- 2026-05-05 (research output)

WebSearch performed 2026-05-05T07:40Z per Otto-364
search-first authority. Sources cited inline.

**Confirmed**: F# UoM does NOT natively extend to
`System.Numerics.BigInteger`. Per [Microsoft Learn:
Units of Measure](https://learn.microsoft.com/en-us/dotnet/fsharp/language-reference/units-of-measure),
dimensioned quantities work only on floating-point
types, signed integral types, and decimal types.
Per [Microsoft Learn: Basic Types](https://learn.microsoft.com/en-us/dotnet/fsharp/language-reference/basic-types),
`bigint` is *not* considered a basic type -- it's an
abbreviation for `System.Numerics.BigInteger`, which
sits outside the F# primitive numeric type set. So
`BigInteger<weight>` does not type-check natively.

**Community workaround**:
[`FSharp.UMX`](https://github.com/fsprojects/FSharp.UMX)
extends UoM-like tagging to primitive *non-numeric*
types via phantom-type mechanics. The library is
scope-restricted to non-numeric primitives (string,
DateTimeOffset, Guid, etc.), not arbitrary structs --
so `FSharp.UMX` does not directly solve
`BigInteger<weight>` either, but the phantom-type
pattern it uses is the technique that would
generalize to BigInteger if a custom wrapper struct
were authored.

**Open language-design discussion**: the F# language
suggestion ["Generic Arithmetic"](https://github.com/fsharp/fslang-suggestions/issues/831)
discusses BigInteger as the escalation type for
signed/unsigned `int64` addition / multiplication
overflow. Not implemented; not specifically about
UoM-on-BigInteger; adjacent in the broader
"primitive-numeric-type-set is too narrow" direction.

**Implication for B-0196 acceptance criterion (a)**:
the substrate-survey output should treat
`BigInteger<weight>` as requiring either (1) a custom
phantom-type wrapper struct (FSharp.UMX-style),
(2) abandoning UoM on BigInteger paths and pairing
the BigInteger value with a separate
`<weight>`-tagged unit-1 value for type-checking, or
(3) waiting on the fslang-suggestions/831 outcome.
Per the four-property hodl: option (1) is most
likely DST-safe + lock-free + scale-free + DBSP-
native; option (2) is workable but adds friction at
the call site; option (3) is uncertain timing.

## Why P2 (not P1, not P3)

- **Higher than P3** because there's a real trigger
  (overflow caught by reviewer in PR #1590) and
  Aaron explicitly named the row in the
  "oh backlog ..." surfacing. The msToNs case is
  bounded effort to verify in isolation, but the
  question scope (4 numeric classes + generic
  numerics) is broader.
- **Lower than P1** because:
  - Research-grade, not blocking. msToNs ships
    with the `Checked.*` guard already in PR
    #1590; the guard is sufficient for
    correctness (overflow throws rather than
    silently wraps).
  - No production system depends on the
    BigInteger / BigRational / BigDecimal
    decision today.
  - Per-class adoption recommendation is itself
    a downstream-decision research output, not a
    blocker for any current substrate.
- Effort M -- a few hours of focused work for
  (a)+(b)+(d); (c) is a decision moment downstream
  of (b).

## Out of scope

- **Doing the refactor itself** -- this is a
  research + plan row. If (c) picks (1) per-class
  adoption, the per-site remediation rows are
  filed downstream as separate B-NNNN rows. If
  (c) picks (2) system-wide refactor, that's
  filed as its own large row. If (c) picks (3)
  defer-until-second-site, no follow-up rows are
  filed yet.
- **Building the SRTP-based generic-numerics
  prototype** -- only if (c) selects (2). The
  prototype is its own row.
- **Selecting a BigDecimal library** for .NET
  (e.g., `Singulink.Numerics.BigDecimal` vs
  rolling our own) -- only if (c) selects (1)
  AND a financial-calculation site is named in
  (b) as remediation-needed.
- **Q# / quantum-numerics** -- the Bayesian
  numeric question composes with B-0189 (Q#
  BP/EP runtime) but the Q# scope is its own
  row.

## Falsifiability hooks (summary)

- (a) falsifier: a numeric-type surface is missed by
  the survey -- re-run with the missed pattern.
- (b) falsifier: a known overflow site is missing --
  add it.
- (c) is a decision; its falsifier is rationale-
  doesn't-follow-from-(b) -- re-do.
- (d) falsifier: the F# spec actually allows UoM on
  BigInteger -- WebSearch + update.

## Composes with

- **B-0140** (TS+Bun standardization sister) --
  parallel question on the TypeScript side: BigInt
  primitive (ES2020+) is native to TS; the
  Bun-runtime decision is whether and how to use
  it across `tools/`. Different language, same
  question shape.
- **B-0156** (also TS+Bun standardization sister) --
  same composition.
- **B-0189** (Q# Bayesian BP/EP runtime research) --
  the Bayesian numeric-type decision (BigRational
  vs double) is shared substrate. Resolution of
  B-0196 candidate (4) above informs B-0189's
  numeric foundation.
- **B-0194** (incremental-auto dispatcher / bilinear
  capability detection) -- the Z-set bilinear-
  product overflow risk in candidate (3) above is
  in the same algebraic surface that B-0194's
  dispatcher routes over. Resolution of B-0196
  candidate (3) informs whether B-0194 needs to
  carry numeric-type discrimination.
- **`src/Core/Units.fs`** -- the file that surfaced
  the original overflow case (PR #1590).
- **`src/Core/Algebra.fs`** -- carries the canonical
  `Weight = int64` definition. If (c) picks
  per-class adoption with weight-swap, this file
  changes.
- **`src/Bayesian/BayesianAggregate.fs`** -- carries
  the all-double Bayesian operators. If (c) picks
  per-class adoption with Bayesian-precision-swap,
  this file changes.

## Origin

Aaron 2026-05-05 surfaced the row after the PR #1590
reviewer caught msToNs overflow. The fix shipped via PR
1590 with `Checked.(*)` guard + 3 overflow tests, but
Aaron's framing was not "the msToNs case is the
question" -- it was "BigInt and other bignumbers
integration" as a broader substrate question.

This row is the substrate that converts that framing
from chat-weather (Otto-363 substrate-or-it-didn't-
happen) into a falsifiable, durable research artifact.
The carved sentence above is the load-bearing claim:
**per-class adoption beats system-wide refactor until
the second overflow site lands**. The trigger for
revisiting that claim is the second site, not a clock.
