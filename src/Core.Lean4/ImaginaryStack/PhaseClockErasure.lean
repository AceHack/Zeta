/-
  PhaseClockErasure.lean — the phase clock output IS recoverable under erasure.

  Connects the phase-clock (src/Core.TypeScript/observe/phase-clock.ts) to the
  Reed-Solomon erasure-correction proof (ErasureDistance.lean):

    **Missed heartbeat phases are erasures in the codeword. As long as the
    receiver sees any 12 of 16 consecutive phases, they can recover the
    full sequence — including the missed ones.**

  The phase clock generates a sequence via xorshift32 (GF(2) linear recurrence).
  Over ZMod 17, this maps to a polynomial evaluation (the RS encoding) — the
  connection is that a LINEAR recurrence of order k generates a sequence whose
  evaluation at any point is a polynomial of degree < k.

  What this proves:
    Given: a phase-clock generating N consecutive phases (each = xorshift(prev))
    Lost:  up to 4 of those phases are missed (lightcone delay, crash, partition)
    Prove: the remaining 12 phases uniquely determine all 16 (same code as ErasureDistance)

  The key insight: the xorshift seed IS a generator polynomial evaluated at
  consecutive points. The Adinkra structure (GF(2) walk) lifts to ZMod 17 as a
  polynomial evaluation, and the RS code's minimum distance guarantees recovery.

  Scope:
    PROVEN: the connection theorem — a linear recurrence of order ≤ 11 over F17
    produces codewords in rsCode, so the erasure correction applies.
    OPEN: that xorshift32 specifically has the right order over F17 (needs the
    minimal polynomial computation — a mechanical but tedious verification).
-/

import Mathlib
import ImaginaryStack.ErasureDistance

open Polynomial

/-! ## Degree-`< 12` polynomials produce RS codewords

    RETRACTED CLAIM (2026-08-10). This section previously argued:

      "a linear recurrence of order `k` generates a sequence `s(n) = Σ cⱼ αⱼⁿ`,
       so `s` is the evaluation of a polynomial of degree `< k` … therefore any
       linear recurrence of order ≤ 11 over F17 produces words in rsCode."

    **That inference is false**, and the refutation is the displayed formula
    itself: `Σⱼ cⱼ αⱼⁿ` is an EXPONENTIAL SUM in `n`, and it is a polynomial in
    `n` only in the degenerate case where every characteristic root `αⱼ = 1`.
    Linear complexity bounds the RECURRENCE ORDER; it says nothing about the
    INTERPOLATION DEGREE.

    Stated correctly, the two notions coincide only here: "the evaluation of a
    degree-`< k` polynomial at `0..n−1`" is exactly the recurrence whose
    characteristic polynomial is `(X − 1)ᵏ`, i.e. `Δᵏ s = 0`. One specific
    recurrence, not an arbitrary one of that order.

    Counterexample (Soraya, verified): `s(n) = 2ⁿ mod 17` has recurrence order
    **1** and interpolation degree **15**.

    Consequence: the theorem below is a statement about POLYNOMIAL DEGREE only.
    It never mentions a linear recurrence, and it must not be read as licensing
    one — which is why it no longer carries `linear_recurrence` in its name.

    Full record: `docs/letters/to-soraya-xorshift-mod17-in-rscode-is-false-not-merely-unproven.md`
-/

/-- A polynomial of degree `< 12` evaluates to a codeword of the RS [16,12] code.

    This is a definitional unfolding of `rsCode` as the image of `evalWord` over
    `degreeLT F 12`. Sound and trivially true — and deliberately narrow: supplying
    the hypothesis `p ∈ degreeLT F 12` is the whole content, and nothing here
    establishes that any particular generator's output satisfies it. -/
theorem degreeLT_mem_rsCode
    (p : Polynomial F) (hp : p ∈ Polynomial.degreeLT F 12) :
    evalWord p ∈ rsCode := by
  exact Submodule.mem_map.mpr ⟨p, hp, rfl⟩

/-- **The phase-clock erasure theorem (conditional).** If a phase-clock's output
    sequence over 16 consecutive ticks is the evaluation of a polynomial of
    degree < 12 (which holds when the underlying recurrence has order ≤ 11 over F17),
    then any 4 missed phases can be recovered from the remaining 12.

    This is the connection: phase-clock persistence (resume from last known anchor)
    + ECC (recover missed ticks from the survivors) = the system tolerates partition
    gracefully. You don't need continuous connectivity — just 12/16 anchors. -/
theorem phase_clock_recoverable_under_erasure
    (phaseWord : Word) (hphase : phaseWord ∈ rsCode)
    (missed : Finset (Fin 16)) (hmissed : missed.card ≤ 4)
    (candidate : Word) (hcandidate : candidate ∈ rsCode)
    (hagree : ∀ i, i ∉ missed → phaseWord i = candidate i) :
    phaseWord = candidate :=
  rsCode_corrects_any_4_erasures missed hmissed phaseWord candidate hphase hcandidate hagree

/-! ## The xorshift connection — WITHDRAWN as false (2026-08-10)

    A theorem `xorshift_mod17_in_rsCode` stood here, asserting that the 16 outputs
    of `xorshift32(seed=4) mod 17` are the evaluation of some degree-`< 12`
    polynomial, proved by `sorry` with the note "mechanization is rote computation".

    **The statement is false, so the `sorry` admitted a falsehood rather than
    deferring work.** Two independent computations agree:

    - Lagrange interpolation over GF(17) through the 16 values at points `0..15`
      gives a UNIQUE interpolant of degree **15**. Sixteen distinct points admit
      exactly one polynomial of degree ≤ 15, so no member of `degreeLT F 12` can
      agree with all of them — the existential had no witness. (Otto)
    - The RS dual/parity syndrome of the same word is `[5, 10, 15, 2] ≠ 0`; the
      check was first validated as non-vacuous in both directions. Independently,
      `Δ¹² w = [16, 12, 15, 13] ≠ 0`. (Soraya)

    The error was a category confusion: the removed argument read `8 ≤ 11 ✓`, where
    8 is an LFSR LINEAR COMPLEXITY and 11 a POLYNOMIAL-DEGREE bound — two different
    quantities sharing a unit. See the retraction note above, and
    `.claude/rules/numerology-vs-number-theory.md`: a count matching a bound is not
    an identification.

    Soraya additionally established that no seed rescues it: over 600,000 seed
    trials the hit rate matched chance exactly (7 observed, 7.18 expected at the
    subspace density `17⁻⁴`), and a sliding 16-window over ~5,000 outputs produced
    none. There is no structural relationship here to find — which is expected, since
    a PRNG whose output WERE a low-degree polynomial evaluation would be broken by
    construction (4 of every 16 outputs predictable from the other 12).

    The file also failed to compile at the withdrawn statement (`omega could not
    prove the goal`), which nothing observed because `ImaginaryStack` had no root
    module and so was never built.

    **What survives, unaffected:** `degreeLT_mem_rsCode` and
    `phase_clock_recoverable_under_erasure` below, plus everything in
    `ErasureDistance.lean`. The erasure machinery is sound; what is gone is the
    claim that xorshift output happens to satisfy its hypothesis.

    **The open engineering question**, routed and not answered here: if missed
    phases must be recoverable, IMPOSE the structure rather than hope to discover
    it — encode 12 phase values as a degree-`< 12` polynomial and transmit its 16
    evaluations. Then `phaseWord ∈ rsCode` holds by construction and
    `phase_clock_recoverable_under_erasure` applies with no new Lean work.

    Record: `docs/letters/to-soraya-xorshift-mod17-in-rscode-is-false-not-merely-unproven.md`

    Recovery paths for missed phases that do NOT depend on the withdrawn claim:
    1. Resume from own last anchor (phase-clock persistence)
    2. Observe peers (HLC merge — no local history needed)
-/

