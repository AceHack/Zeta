module Zeta.Tests.Operators.OperatorAlgebraTests
#nowarn "0893"

open FsCheck.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// C13 (B-1007 P1) — the DBSP linear-operator algebra over Stream<ZSet>
// (Incremental/Circuit): z⁻¹ (delay), I (integrate), D (differentiate),
// plus the Tick (ℕ,+,0) monoid the streams are indexed by. The existing
// Circuit.Tests.fs proves these as fixed [<Fact>] EXAMPLES; C13 GENERALISES
// them to FsCheck over random delta-sequences and adds the operator
// identities. Spec: DBSP (Budiu et al.) — I = (1−z⁻¹)⁻¹, D = 1−z⁻¹,
// D∘I = I∘D = id. The symbolic operator identities are cross-checked in
// Z3 (Z3.Laws.Tests.fs C13) per BP-16: FsCheck on the real Circuit ∧ Z3 on
// ideal reals. "The compilers don't lie."
// ═══════════════════════════════════════════════════════════════════

// build a per-tick ZSet delta from generated pairs: keys in 0..4 (small,
// so cancellations happen across ticks), weights in −6..6 (some 0 → pruned).
let private mkDelta (pairs: (int * int) list) : ZSet<int> =
    pairs |> List.map (fun (k, w) -> (abs (k % 5)), int64 (w % 7)) |> ZSet.ofSeq

let private capTicks (raw: (int * int) list list) = raw |> List.truncate 6 |> List.map mkDelta

// ── D∘I = id : differentiate recovers the per-tick delta from the snapshot ──
[<Property>]
let ``C13 D∘I = id (differentiate of integrate recovers each tick's delta)``
    (raw: (int * int) list list) =
    let ticks = capTicks raw
    let c = Circuit.create ()
    let input = c.ZSetInput<int>()
    let out = c.Output(c.DifferentiateZSet(c.IntegrateZSet input.Stream))
    ticks
    |> List.forall (fun d ->
        input.Send d
        c.Step()
        out.Current = d)

// ── I∘D = id : integrate telescopes the per-tick differences back ──
[<Property>]
let ``C13 I∘D = id (integrate of differentiate recovers each tick's delta)``
    (raw: (int * int) list list) =
    let ticks = capTicks raw
    let c = Circuit.create ()
    let input = c.ZSetInput<int>()
    let out = c.Output(c.IntegrateZSet(c.DifferentiateZSet input.Stream))
    ticks
    |> List.forall (fun d ->
        input.Send d
        c.Step()
        out.Current = d)

// ── z⁻¹ defining property : delay(s)[t] = s[t−1], empty at t=0 ──
[<Property>]
let ``C13 z⁻¹ (delay) emits the previous tick's input (empty at t=0)``
    (raw: (int * int) list list) =
    let ticks = capTicks raw
    let c = Circuit.create ()
    let input = c.ZSetInput<int>()
    let out = c.Output(c.DelayZSet input.Stream)
    let mutable prev = ZSet.empty<int>
    ticks
    |> List.forall (fun d ->
        input.Send d
        c.Step()
        let ok = (out.Current = prev)
        prev <- d
        ok)

// ── D = 1 − z⁻¹ : differentiate equals input minus its own delay ──
[<Property>]
let ``C13 D = 1 − z⁻¹ (differentiate equals input minus delay)``
    (raw: (int * int) list list) =
    let ticks = capTicks raw
    let c = Circuit.create ()
    let input = c.ZSetInput<int>()
    let dOut = c.Output(c.DifferentiateZSet input.Stream)
    let rhsOut = c.Output(c.Plus(input.Stream, c.Negate(c.DelayZSet input.Stream)))
    ticks
    |> List.forall (fun d ->
        input.Send d
        c.Step()
        dOut.Current = rhsOut.Current)

// ── I = Σ z⁻ⁿ : integrate is the running sum (monotone snapshot) ──
[<Property>]
let ``C13 I = running sum (integrate snapshot = fold of all deltas so far)``
    (raw: (int * int) list list) =
    let ticks = capTicks raw
    let c = Circuit.create ()
    let input = c.ZSetInput<int>()
    let out = c.Output(c.IntegrateZSet input.Stream)
    let mutable acc = ZSet.empty<int>
    ticks
    |> List.forall (fun d ->
        input.Send d
        c.Step()
        acc <- ZSet.add acc d
        out.Current = acc)

// ── the Tick (ℕ,+,0) monoid the operator stream is indexed by ──
// `tick` is a [<Measure>] (Window.fs); `int<tick>` addition is the integer
// monoid lifted to the logical-clock unit-of-measure — the UoM is the safety
// (no tick/ms swap), the algebra is ℤ's commutative monoid with identity 0.
[<Property>]
let ``C13 Tick is the (ℕ,+,0) commutative monoid`` (a: int) (b: int) (d: int) =
    let ta, tb, tc = a * 1<tick>, b * 1<tick>, d * 1<tick>
    (ta + tb) + tc = ta + (tb + tc)              // associative
    && ta + 0<tick> = ta && 0<tick> + ta = ta    // two-sided identity
    && ta + tb = tb + ta                          // commutative
