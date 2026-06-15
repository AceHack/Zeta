module Zeta.Tests.SoftValueTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

module SV = Zeta.Core.SoftValue

// ═══════════════════════════════════════════════════════════════════
// SoftValue (the soft DynamicValue seed) — the calibration / never-falsely-certain property
// proven, plus the headline: independent-evidence Bayesian `observe` COMMUTES (the
// convergence-despite-reordering crux — the uncertainty-merge is order-independent).
// ═══════════════════════════════════════════════════════════════════

let private EPS = 1e-9
let private approx (a: float) (b: float) = abs (a - b) < 1e-7

// compare two SoftValues' distributions (same candidates, same probabilities within tolerance)
let private sameDist (a: SV.SoftValue) (b: SV.SoftValue) : bool =
    let ca = SV.candidates a
    let cb = SV.candidates b
    List.length ca = List.length cb
    && ca
       |> List.forall (fun (d, p) ->
           match cb |> List.tryFind (fun (d2, _) -> d2 = d) with
           | Some (_, p2) -> approx p p2
           | None -> false)

// candidates drawn from a small fixed set so equality/merging is exercised
let private cand i = DynamicValue.Int(int64 i)

let private genSoft : Gen<SV.SoftValue> =
    gen {
        let! w0 = Gen.choose (1, 100) |> Gen.map float
        let! w1 = Gen.choose (1, 100) |> Gen.map float
        let! w2 = Gen.choose (1, 100) |> Gen.map float
        return
            (SV.ofWeighted [ cand 0, w0; cand 1, w1; cand 2, w2 ]).Value // weights all >0 ⇒ Some
    }

type SoftArb() =
    static member S() = Arb.fromGen genSoft

// ── normalization invariant ──

[<Property(Arbitrary = [| typeof<SoftArb> |])>]
let ``SoftValue: the distribution always sums to 1`` (sv: SV.SoftValue) =
    approx (SV.candidates sv |> List.sumBy snd) 1.0

[<Fact>]
let ``SoftValue: ofWeighted merges equal candidates and drops non-positive weights`` () =
    let sv = (SV.ofWeighted [ cand 0, 1.0; cand 0, 1.0; cand 1, 2.0; cand 2, -5.0 ]).Value
    // cand0 merged to weight 2, cand1 weight 2, cand2 dropped → {0:0.5, 1:0.5}
    Assert.Equal<int>(2, List.length (SV.candidates sv))
    Assert.True(approx (SV.confidence sv) 0.5)
    Assert.True(SV.candidates sv |> List.forall (fun (d, _) -> d <> cand 2))

// ── the calibration guarantee: never falsely certain ──

[<Property(Arbitrary = [| typeof<SoftArb> |])>]
let ``SoftValue: resolve returns a value ONLY when confidence ≥ threshold (never falsely certain)``
    (sv: SV.SoftValue) =
    let conf = SV.confidence sv
    // below confidence → must be held (None); at/under confidence → may resolve
    let belowHeld =
        match SV.resolve (conf + 0.01) sv with
        | None -> true
        | Some _ -> conf + 0.01 <= conf + EPS // only acceptable if numerically at the boundary
    let atResolves = (SV.resolve conf sv) |> Option.isSome
    belowHeld && atResolves

[<Fact>]
let ``SoftValue: certain is fully confident and always resolves; a flat distribution stays held`` () =
    let c = SV.certain (cand 7)
    Assert.True(approx (SV.confidence c) 1.0)
    Assert.True(approx (SV.entropy c) 0.0)
    Assert.Equal(Some(cand 7), SV.resolve 1.0 c)
    // a 3-way flat distribution has confidence ~1/3 → a 0.9 threshold keeps it held (honest)
    let flat = (SV.ofWeighted [ cand 0, 1.0; cand 1, 1.0; cand 2, 1.0 ]).Value
    Assert.Equal(None, SV.resolve 0.9 flat)
    Assert.True(SV.entropy flat > SV.entropy c) // flat is more uncertain — and it knows it

// ── observe: uninformative evidence is identity; favoring evidence sharpens ──

[<Property(Arbitrary = [| typeof<SoftArb> |])>]
let ``SoftValue: an uninformative observe (constant likelihood) leaves beliefs unchanged`` (sv: SV.SoftValue) =
    match SV.observe (fun _ -> 3.0) sv with
    | Some sv2 -> sameDist sv sv2
    | None -> false

[<Property(Arbitrary = [| typeof<SoftArb> |])>]
let ``SoftValue: observing evidence that favors a candidate raises its probability (sharpening)``
    (sv: SV.SoftValue) =
    let before = SV.candidates sv |> List.find (fun (d, _) -> d = cand 1) |> snd
    match SV.observe (fun d -> if d = cand 1 then 5.0 else 1.0) sv with
    | Some sv2 ->
        let after = SV.candidates sv2 |> List.find (fun (d, _) -> d = cand 1) |> snd
        after >= before - EPS
    | None -> false

// ── ★ the headline: independent-evidence observes COMMUTE (the convergence-despite-reordering crux) ──

[<Property(Arbitrary = [| typeof<SoftArb> |])>]
let ``SoftValue: independent-evidence Bayesian updates COMMUTE (order-independent uncertainty-merge)``
    (sv: SV.SoftValue) =
    let l1 d = if d = cand 0 then 4.0 else 1.0
    let l2 d = if d = cand 2 then 3.0 else 1.0
    let ab = SV.observe l1 sv |> Option.bind (SV.observe l2)
    let ba = SV.observe l2 sv |> Option.bind (SV.observe l1)
    match ab, ba with
    | Some a, Some b -> sameDist a b
    | None, None -> true
    | _ -> false

[<Fact>]
let ``SoftValue: a refuting observation that zeroes all candidates returns None (no fabricated certainty)`` () =
    let sv = (SV.ofWeighted [ cand 0, 1.0; cand 1, 1.0 ]).Value
    Assert.Equal(None, SV.observe (fun _ -> 0.0) sv)

// ═══════════════════════════════════════════════════════════════════
// combine — the soft order-free child-combiner (soft banana-split / fuse in uncertainty space).
// Commutative + associative (multiplication is) ⇒ reducing a node's children with `combine` is
// order-independent: the soft / NCI analogue of the eager cata-fusion law. genSoft has full shared
// support (cand 0/1/2 all positive) ⇒ every combine here is Some.
// ═══════════════════════════════════════════════════════════════════

[<Property(Arbitrary = [| typeof<SoftArb> |])>]
let ``combine commutes`` (a: SV.SoftValue) (b: SV.SoftValue) =
    match SV.combine a b, SV.combine b a with
    | Some ab, Some ba -> sameDist ab ba
    | None, None -> true
    | _ -> false

[<Property(Arbitrary = [| typeof<SoftArb> |])>]
let ``combine associates`` (a: SV.SoftValue) (b: SV.SoftValue) (c: SV.SoftValue) =
    let lhs = SV.combine a b |> Option.bind (fun ab -> SV.combine ab c)
    let rhs = SV.combine b c |> Option.bind (fun bc -> SV.combine a bc)
    match lhs, rhs with
    | Some l, Some r -> sameDist l r
    | None, None -> true
    | _ -> false

[<Property(Arbitrary = [| typeof<SoftArb> |])>]
let ``combine reduce is order-independent (soft fold child-combine)`` (a: SV.SoftValue) (b: SV.SoftValue) (c: SV.SoftValue) =
    let red xs = xs |> List.reduce (fun acc x -> (SV.combine acc x).Value) // shared support ⇒ Some
    let r1 = red [ a; b; c ]
    let r2 = red [ c; a; b ]
    let r3 = red [ b; c; a ]
    sameDist r1 r2 && sameDist r2 r3

// ═══════════════════════════════════════════════════════════════════
// snap — the policy-gated soft → hard boundary (the one sanctioned exit from uncertainty space).
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``snap best of a certain value returns that exact value (soft reproduces hard when certain)`` () =
    Assert.Equal(Some(cand 7), SV.snap SV.best (SV.certain (cand 7)))

[<Fact>]
let ``snap threshold holds below confidence and collapses above (calibration-gated)`` () =
    let sv = (SV.ofWeighted [ cand 0, 0.6; cand 1, 0.4 ]).Value // confidence 0.6
    Assert.Equal(None, SV.snap (SV.threshold 0.9) sv) // 0.6 < 0.9 → hold
    Assert.Equal(Some(cand 0), SV.snap (SV.threshold 0.5) sv) // 0.6 ≥ 0.5 → snap argmax
    Assert.Equal(Some(cand 0), SV.snap SV.best sv) // best always snaps to argmax

// ═══════════════════════════════════════════════════════════════════
// Multi-objective snap — the commit-decision for sensor fusion. `combine` fuses the sensors;
// the multi-objective policy commits the fused belief. `valueObj` is a stand-in "sensor objective"
// (prefer larger candidate values); `posterior` is the fused belief as an objective.
// ═══════════════════════════════════════════════════════════════════

let private valueObj: SV.Objective =
    fun _ d ->
        match d with
        | DynamicValue.Int n -> float n
        | _ -> 0.0

[<Fact>]
let ``weighted [posterior,1] reduces to best (argmax of the fused belief)`` () =
    let sv = (SV.ofWeighted [ cand 0, 0.5; cand 1, 0.3; cand 5, 0.2 ]).Value
    Assert.Equal(SV.snap SV.best sv, SV.snap (SV.weighted [ SV.posterior, 1.0 ]) sv)
    Assert.Equal(Some(cand 0), SV.snap (SV.weighted [ SV.posterior, 1.0 ]) sv)

[<Fact>]
let ``weighted picks by the objective, and weights shift the winner (posterior vs value)`` () =
    let sv = (SV.ofWeighted [ cand 0, 0.5; cand 1, 0.3; cand 5, 0.2 ]).Value
    // value objective alone → the largest candidate
    Assert.Equal(Some(cand 5), SV.snap (SV.weighted [ valueObj, 1.0 ]) sv)
    // posterior-heavy → cand 0 (0.5); value-heavy → cand 5
    Assert.Equal(Some(cand 0), SV.snap (SV.weighted [ SV.posterior, 10.0; valueObj, 0.01 ]) sv)
    Assert.Equal(Some(cand 5), SV.snap (SV.weighted [ SV.posterior, 0.01; valueObj, 10.0 ]) sv)

[<Fact>]
let ``paretoFront drops dominated candidates, keeps the non-dominated set`` () =
    let sv = (SV.ofWeighted [ cand 0, 0.5; cand 1, 0.3; cand 5, 0.15; cand 2, 0.05 ]).Value
    // objectives: (posterior, value). cand 2 (post .05, val 2) is dominated by cand 5 (post .15, val 5).
    // cand 0 (highest post), cand 1 (middle), cand 5 (highest value) are each non-dominated.
    Assert.Equal<DynamicValue list>(
        [ cand 0; cand 1; cand 5 ],
        SV.paretoFront [ SV.posterior; valueObj ] sv)

[<Fact>]
let ``paretoFront of a single objective is its maximizer`` () =
    let sv = (SV.ofWeighted [ cand 0, 0.5; cand 1, 0.3; cand 5, 0.2 ]).Value
    Assert.Equal<DynamicValue list>([ cand 5 ], SV.paretoFront [ valueObj ] sv)

[<Fact>]
let ``sensor fusion: combine two sensors then multi-objective snap`` () =
    let s1 = (SV.ofWeighted [ cand 0, 0.7; cand 1, 0.3 ]).Value
    let s2 = (SV.ofWeighted [ cand 0, 0.4; cand 1, 0.6 ]).Value
    let fused = (SV.combine s1 s2).Value // ∝ (0.28, 0.18) → cand 0 wins the fused belief
    Assert.Equal(Some(cand 0), SV.snap (SV.weighted [ SV.posterior, 1.0 ]) fused)
