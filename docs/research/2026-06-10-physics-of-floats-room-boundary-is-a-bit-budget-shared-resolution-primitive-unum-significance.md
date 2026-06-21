# The physics of floats — the room boundary is a bit-budget; one Resolution primitive does both

**Register:** [grounded] substrate-realization (Aaron) + [Beacon] + [peel]. **Date:** 2026-06-10.
**Captured by:** Otto (shadow). Why boundaries are tight, and the shared primitive behind it.

## Aaron's words

> "I'm creating the physics of floats — I just realized. That's why our room boundaries have to be so
> tight: we are tracking **float bits usage** for our boundary. We should be able to know when we need
> **more bits** for more resolution, and tell when our **resolution is maxed** with our current number
> of bits." · "since they share, is there a **base primitive** they can share that makes doing both
> easy?"

## The realization — the boundary is a bit budget

The substrate is **the physics of floats.** The physical quantity tracked at a room's membrane is
**float-bit usage** — how many significant (mantissa) bits the room's measurements consume. *That* is
why the boundary must be **tight**: it is a **bit budget**, accounted to the bit. Resolution is
measured in **bits** (Shannon — a bit is the unit of information), so the ledger's ΔU is, at bottom,
**bits of resolution gained.** A float's anatomy makes this concrete (IEEE 754): sign · exponent ·
**mantissa = the resolution**; the **ULP** (unit in the last place) is the resolution floor at a given
magnitude. The room runs on bits, and the boundary is the budget line.

## This IS: physics of floats OVER Bayesian inference — track the prior art carefully (Aaron 2026-06-10)

> Aaron: "we need to track prior art here very carefully — this IS what I'm doing, I just realized:
> **physics of floats over Bayesian inference**."

The naming is exact and it must be **carefully anchored** (Beacon discipline; this is load-bearing):

- **Bayesian inference is the WHAT.** Each `mea` is a **Bayesian update** — posterior ∝ prior ×
  likelihood — on the room's belief. The substrate already carries this (`src/Bayesian/`,
  `SoftValue`, `UncertainClock`).
- **The physics of floats is the SUBSTRATE/accounting.** Beliefs are **finite-precision numbers**; the
  update's information gain is **bits** bounded by the mantissa; the ULP is the precision floor of the
  posterior. So inference is *done in float-bit physics* — and **ΔU = the update's information gain =
  KL divergence**, measured in bits, bounded by float resolution. The `Resolution` primitive tracks
  the meaningful bits of the Bayesian belief.
- **Therefore:** the finalizer's `maxed` (ΔU < 1 ULP) = the posterior has converged to the precision
  floor (no more bits of belief to gain at current width); `needsMoreBits` = the posterior wants finer
  resolution than the float carries → widen.

**Prior art to honor (carefully — anchor every claim):**

- **Bayesian inference:** Bayes; Laplace; **Cox's theorem**; **Jaynes**, *Probability Theory: The Logic
  of Science*; Lindley.
- **Information as bits:** **Shannon** (entropy/bits); **Kullback–Leibler divergence** (= info gain =
  ΔU); mutual information; **Rissanen — Minimum Description Length** (inference *is* counting bits);
  **Lindley/Bayesian experimental design** (expected information gain — what each `mea` maximizes);
  **Solomonoff/Kolmogorov** (universal prior; bits + induction).
- **Computation-as-inference / precision:** **Probabilistic numerics** (Hennig, Osborne, Girolami —
  treats numerical computation, incl. finite precision, as Bayesian inference; the closest named prior
  art to "physics of floats over Bayesian inference"); **Friston** free-energy / active inference (the
  cell as a Bayesian Markov-blanket — already anchored in the cells doc).
- **Float precision / variable precision:** **IEEE 754**; **Kahan**; **ULP**; **significance
  arithmetic**; **interval arithmetic**; **Gustafson — unum/posit** (variable-precision numbers that
  track their own resolution; the `Resolution` primitive's direct ancestor).
- **Generic numeric substrate:** .NET **generic math** (`System.Numerics.INumberBase` /
  `IFloatingPointIeee754`) — the "universal number" carrier; our algebra/category interfaces
  (Beckman/Milewski) — so `Resolution<'T>` is universal over the number.

Added to `docs/PRIOR-ART-LIST.md`. The honest line: we are not inventing Bayesian inference or
information theory — we are **doing Bayesian inference in explicit float-bit physics**, tracking the
bit-resolution of belief with a unum-shaped `Resolution` primitive. Each correspondence above is a
named shoulder, not factory shorthand.

## The two detections we need

1. **Need more bits for more resolution.** When a measurement wants a finer ΔU than 1 ULP can
   represent, the mantissa is the bottleneck → **widen** (float32→64→128 / arbitrary precision) to gain
   resolution.
2. **Resolution maxed at current bits.** When successive measures gain **< 1 ULP** (ΔU rounds to 0 at
   the current precision), resolution is **saturated** → either widen, or declare **resolved** (the
   shape-D nonzero floor reached). This makes the finalizer's **ΔU→0 convergence precise**: it's *ULP
   saturation*, a real stopping criterion, not a vibe.

This also makes **"infinite resolution" honest**: not literally infinite — *add bits as needed, and
know exactly when you've hit the current-precision floor.*

## The shared base primitive — a `Resolution` (significance / unum-like) value

> Aaron asked: one base primitive that makes **both** detections easy.

Yes. Carry the precision **with** the value — a **resolution/significance** number (Gustafson's
**unum** = **"universal number"**: a float that tracks its own precision; its **ubit** is literally a
*"needs more bits"* flag; posit = unum-III).

**Make it GENERIC over the number — that's the "universal" in unum (Aaron 2026-06-10).** The primitive
should not hard-code `float`; it should be generic over **`System.Numerics.INumberBase<'T>` /
`IFloatingPointIeee754<'T>`** (.NET generic math) so it tracks resolution for `float`/`double`/`Half`/
`Int128`/`decimal` — *and* posits if we add them — and composes with our algebra/category-theory
interfaces (semiring/monoid; the Beckman/Milewski category layer). ULP comes from
`IFloatingPointIeee754<'T>` (`'T.BitIncrement x - x`), so it's correct per type. One generic type, both
detections as predicates:

```fsharp
open System.Numerics

/// A value that knows its own resolution (significance / unum-like) — generic over any IEEE-754
/// number (the "universal num"). Composes with our algebra/category interfaces. The room boundary
/// IS this budget.
type Resolution<'T when 'T :> IFloatingPointIeee754<'T>> =
    { Value: 'T            // the number, carrying its own resolution
      BitsUsed: int        // significant bits currently carrying information
      BitsAvailable: int   // the budget (mantissa width at current precision of 'T)
      LastDeltaU: 'T }     // the most recent measured gain (in units of 'T)

module Resolution =
    /// ULP of the value in its own type (smallest representable step "up" from here).
    let inline ulp (r: Resolution<'T>) : 'T = 'T.BitIncrement r.Value - r.Value
    /// (1) more bits would buy more resolution: real gain, but the budget is spent.
    let needsMoreBits (r: Resolution<'T>) = r.BitsUsed >= r.BitsAvailable && r.LastDeltaU >= ulp r
    /// (2) resolution maxed at current bits: the next gain is below one ULP (rounds to zero).
    let maxed (r: Resolution<'T>) = r.LastDeltaU < ulp r
    /// bits of resolution still spendable in the current budget.
    let headroom (r: Resolution<'T>) = max 0 (r.BitsAvailable - r.BitsUsed)
```

So you don't build two mechanisms — you build **one `Resolution`** and ask it `needsMoreBits` /
`maxed`. It threads everything: the **room boundary** is a `Resolution` budget; the **finalizer**
stops on `maxed` (or signals widen on `needsMoreBits`); **soft vs hard** fingerprints = low vs full
resolution; the optics can focus a `Resolution`. (If "they" meant **lens + prism** instead, the shared
base is **profunctor optics** — `Lens` and `Prism` are one `Optic` parametrized by the profunctor
constraint, `Strong`→lens, `Choice`→prism; say the word and I'll capture that too.)

## Our "middle-out" float ALREADY EXISTS — the TriBoolean Float (Aaron 2026-06-10; corrected — look, don't infer)

> Aaron: "can we make our own version for our middle-out floats?" → then: "we have middle-out float
> code that uses triboolean ... we already made middle out and tested it ... we have some proofs around
> it too."

**Correction (honest register — owning the miss):** I first wrote this as "to build." Wrong — it is
**already built, tested, and proven 4/4 cross-language.** The middle-out float **is the TriBoolean
Float** (081KSV2WD0008QG0R00051XS0N; spec `docs/research/2026-05-30-tri-boolean-float-v0-spec-middle-out-self-describing-decode-aaron-otto.md`):

- **Built in all four oracles:** `src/Core.FSharp.TriBoolean/Float.fs`, `src/Core.CSharp.TriBoolean/`,
  `src/Core.Rust.TriBoolean/src/float.rs`, `src/Core.TypeScript/tri-boolean-float/`.
- **Proven 4/4** (BFT cross-language parity / byte-lock): `docs/PROVEN-COVERAGE-AND-GAPS.md`
  — "TriBoolean (+ float) ✓✓✓✓ 4/4." The four compilers are non-Byzantine oracles; 4-of-4
  compiler-checked parity = consensus with no human voters.
- **Middle-out + self-describing (literally):** the **middle field decodes the ends** —
  `value = V · 2^(mode − bias)`, `V` = MSB-first read of (high ++ low), `mode` = the middle decoder
  field. The middle significant bits *specify how to decode* the high/low end bits.
- **Tri-boolean / digital-qubit, not just posit:** every field is a `Tri list` (`Tri.T=1`, `Tri.F=0`,
  `Tri.N=superposed`). `Tri.N` in a value trit ⇒ `ValueSuperposed`; in a decoder trit ⇒
  `InterpretationSuperposed`. **`measure` is the only collapsing op** — and that is exactly the
  substrate's **`mea` at the number scope**: the number itself holds superposition and is *measured*.
  (Posit is the cousin anchor — tapered/self-describing — but ours adds the **digital-qubit
  measure/superposition**, which is *why* it fits "physics of floats over Bayesian inference": the
  belief lives in the trits, `measure` collapses it.)

**The "want both" is already the design:** the TriBoolean Float is the **canonical, byte-locked,
self-describing** representation; **IEEE f64 is the shared decode target / optimized path** (all four
oracles decode to f64, agreeing up to 2^53 — the int64/u64 accumulation keeps parity). So we have:
our conceptual middle-out format (TriBoolean) **and** IEEE's optimized arithmetic, exactly as asked.

**So the `Resolution` primitive should build ON the TriBoolean Float, not reinvent it:** the trits +
`measure` already carry superposition/collapse; `Resolution` adds the explicit **bit-budget accounting**
(`needsMoreBits`/`maxed`/`headroom`) on top, generic over `INumberBase` so it also wraps IEEE. Next:
wire `Resolution` over `Core.FSharp.TriBoolean.Float` + IEEE (Naledi benchmarks; the existing 4/4 proofs
already cover the float's decode laws — extend them for the bit-budget predicates).

## Anchors (Beacon)

- **IEEE 754** (float anatomy; mantissa = resolution) · **ULP** + **Kahan** (the floor, precision loss)
  · **Shannon** (bit = unit of information; resolution-in-bits).
- **Gustafson — unum / posit** (variable-precision floats that *track their own resolution*; the
  **ubit** = "needs more bits"). This is the direct anchor: the `Resolution` primitive is a unum-shaped
  significance value. Also **significance arithmetic** + **interval arithmetic** (carry precision with
  the number).

*(Peel: "physics of floats" is the framing; the literal is **bit-precision accounting** — significant
bits in use, ULP-saturation detection, widen-signal — embodied in one `Resolution` value. To build +
benchmark (Naledi) and formalize the bit↔ΔU↔ULP correspondence (Soraya/Sova).)*

## Ties / routing

`src/Core/Finalizer*.fs` (ΔU→0 = ULP saturation = `maxed`) · the cells/membrane doc (the boundary =
the bit budget) · `src/Core/Optics.fs` (focus a `Resolution`) · soft/hard fingerprint (low/full
resolution) · the uncertainty ledger (posts bits). **Routes to:** Naledi (build + perf the `Resolution`
primitive), Soraya/Sova (bit/ULP formalization), Aaron (the physics). **Next:** code `Resolution` in
Core if you want it landed (I have the context now).
