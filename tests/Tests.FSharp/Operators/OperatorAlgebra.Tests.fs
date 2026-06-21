module Zeta.Tests.Operators.OperatorAlgebraTests
#nowarn "0893"

open FsCheck.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// C13 (081KT2T2J0008QG0R000YZ3NMY P1) — the DBSP linear-operator algebra over Stream<ZSet>
// (Incremental/Circuit): z⁻¹ (delay), I (integrate), D (differentiate),
// indexed by the logical-clock tick. The existing Circuit.Tests.fs proves
// these as fixed [<Fact>] EXAMPLES; C13 GENERALISES them to FsCheck over
// random delta-sequences and adds the operator identities. Spec: DBSP
// (Budiu et al.) — I = (1−z⁻¹)⁻¹, D = 1−z⁻¹, D∘I = I∘D = id. The symbolic
// operator identities are cross-checked in Z3 (Z3.Laws.Tests.fs C13) per
// BP-16: FsCheck on the real Circuit ∧ Z3 on ideal reals.
//
// (The "Tick (ℕ,+,0) monoid" property was dropped 2026-06-03 — see the
// note at the foot of this file — it verified .NET int arithmetic, not
// Zeta code, failing the proof bar.) "The compilers don't lie."
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

// NOTE — the "Tick (ℕ,+,0) monoid" property was DROPPED here (the maintainer
// 2026-06-03 proof bar: only proofs that verify OUR code against OUR claims).
// `tick` is a phantom [<Measure>] type (Window.fs:13-14); `int<tick>` is a plain
// .NET `int` annotated with that unit, so the monoid laws of `int<tick>`
// addition ARE .NET integer arithmetic — code we did NOT write — and a runtime
// FsCheck of them verifies the BCL, not Zeta (the "bullshit math test" class).
// The UoM's real and sole guarantee is COMPILE-TIME unit separation (`tick + ms`
// does not compile) — enforced by the type system, needing no runtime proof.
// The tick AS the stream index is already exercised by every operator property
// above (they drive the circuit tick-by-tick via Step()). So C13's substantive
// content is the operator algebra (D∘I / I∘D / z⁻¹ / D=1−z⁻¹ / I=running-sum) +
// the Z3 telescoping identities, each verifying a real FactorGraph/Incremental
// claim.
