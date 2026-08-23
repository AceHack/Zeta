module Zeta.Tests.SoftValueWideningTests

open global.Xunit
open Zeta.Core

module SV = Zeta.Core.SoftValue

// ═══════════════════════════════════════════════════════════════════════════════
// The widening operator — the four falsifiers.
//
// Gap this closes: `observe` sharpens monotonically, so under a NON-STATIONARY source the
// posterior concentrates on stale evidence and cannot re-open. Never-collapse was implemented
// on the ENSEMBLE axis (`YinYangEnsemble.reseedIfCollapsed`) and absent on the VALUE axis.
//
// Two operators are under test and their commutativity status is OPPOSITE — that contrast is
// the point of the change, so it is pinned here rather than described in prose:
//   • `SV.widen`        — belief-reading floor. Idempotent. Does NOT commute with `observe`.
//   • `SV.foldRetained` — evidence retraction. Re-opens AND commutes.
// ═══════════════════════════════════════════════════════════════════════════════

let private cand i = DynamicValue.Int(int64 i)
let private soft xs = (SV.ofWeighted xs).Value
let private approx (a: float) (b: float) = abs (a - b) < 1e-9

let private sameDist (a: SV.SoftValue) (b: SV.SoftValue) =
    let ca, cb = SV.candidates a, SV.candidates b
    List.length ca = List.length cb
    && ca |> List.forall (fun (d, p) ->
        match cb |> List.tryFind (fun (d2, _) -> d2 = d) with
        | Some (_, q) -> approx p q
        | None -> false)

/// Likelihood table over candidates 0..2.
let private lik (xs: float list) : DynamicValue -> float =
    fun d -> xs |> List.mapi (fun i w -> (cand i, w)) |> List.tryPick (fun (c, w) -> if c = d then Some w else None) |> Option.defaultValue 0.0

let private A = lik [ 0.9; 0.05; 0.05 ]   // source A favours candidate 0
let private B = lik [ 0.05; 0.9; 0.05 ]   // source B favours candidate 1
let private uniform3 = soft [ cand 0, 1.0; cand 1, 1.0; cand 2, 1.0 ]

let private argmax (sv: SV.SoftValue) = SV.candidates sv |> List.maxBy snd |> fst

/// Evidence constructor — keeps record resolution explicit under `RequireQualifiedAccess`.
let private ev (phase: int64) (l: DynamicValue -> float) : SV.Evidence =
    { Phase = phase; Likelihood = l }

/// Deterministic shuffle: project to a seeded key ONCE, then sort. (No ambient RNG; DST-replayable.)
let private shuffle (rng: System.Random) (xs: 'a list) : 'a list =
    xs |> List.map (fun x -> rng.Next(), x) |> List.sortBy fst |> List.map snd

// ── FALSIFIER 1: a widened posterior can RE-OPEN; without the operator it stays stuck ──
// This is the core property. It MUST fail if the operator is removed, so both arms are
// asserted in the same test: the no-widening arm pins that the gap is real.

[<Fact>]
let ``falsifier 1 - without retraction the posterior locks on the stale source; with it, it re-opens`` () =
    // 40 observations of A, then the source switches: 12 observations of B.
    let evidence =
        [ for i in 0 .. 39 -> ev (int64 i) A ]
        @ [ for i in 0 .. 11 -> ev (int64 (40 + i)) B ]

    // No retraction (retain everything) — the CURRENT behaviour, and the bug.
    let stuck = (SV.foldRetained (SV.window 1_000_000L) evidence uniform3).Value
    Assert.Equal(cand 0, argmax stuck)          // still locked on the STALE source A

    // With a phase-keyed retention window — tracks the new source.
    let reopened = (SV.foldRetained (SV.window 10L) evidence uniform3).Value
    Assert.Equal(cand 1, argmax reopened)       // tracks B

    // And the two genuinely differ — guards against a vacuous pass if both arms degenerated.
    Assert.False(sameDist stuck reopened)

// ── FALSIFIER 2: COMMUTATIVITY IS PRESERVED WITH WIDENING ENABLED ──
// The most important test in the change: it is what catches a local-time leak. Retention keyed
// on the CARRIED PHASE commutes under reordering; retention keyed on ARRIVAL ORDER (the leak
// `local-time-never-enters-the-shared-fold.md` forbids) does not — the mutant arm below proves
// this test can actually fail, so it is not vacuous.

[<Fact>]
let ``falsifier 2 - foldRetained commutes under reordering with widening enabled`` () =
    let evidence =
        [ for i in 0 .. 39 -> ev (int64 i) A ]
        @ [ for i in 0 .. 11 -> ev (int64 (40 + i)) B ]

    let schedule = SV.window 10L
    let baseline = (SV.foldRetained schedule evidence uniform3).Value

    // Deterministic reorderings (no ambient RNG — DST-replayable).
    let rng = System.Random(4)   // the common seed S=4
    for _ in 1 .. 200 do
        let shuffled = shuffle rng evidence
        let got = (SV.foldRetained schedule shuffled uniform3).Value
        Assert.True(sameDist baseline got, "reordering changed the posterior — local order leaked into the fold")

[<Fact>]
let ``falsifier 2b - the arrival-order MUTANT is caught by falsifier 2 (non-vacuity)`` () =
    // Retention keyed on ARRIVAL POSITION instead of carried phase — the local-time leak.
    // Folded by hand because the shipped API makes this un-expressible, which is the design.
    let evidence =
        [ for i in 0 .. 39 -> ev (int64 i) A ]
        @ [ for i in 0 .. 11 -> ev (int64 (40 + i)) B ]

    let foldByArrival (ev: SV.Evidence list) =
        let n = List.length ev
        ev
        |> List.mapi (fun i e -> i, e)
        |> List.fold
            (fun acc (i, e) -> if n - 1 - i < 10 then acc |> Option.bind (SV.observe e.Likelihood) else acc)
            (Some uniform3)

    let baseline = (foldByArrival evidence).Value
    let rng = System.Random(4)
    let mutable diverged = 0
    for _ in 1 .. 200 do
        let shuffled = shuffle rng evidence
        if not (sameDist baseline (foldByArrival shuffled).Value) then diverged <- diverged + 1

    // The mutant MUST diverge — otherwise falsifier 2 is a check that cannot fail.
    Assert.True(diverged > 190, sprintf "arrival-keyed mutant diverged only %d/200 times" diverged)

// ── FALSIFIER 3: IDEMPOTENCY ──

[<Fact>]
let ``falsifier 3 - widen is idempotent, non-vacuously (it actually fires)`` () =
    let concentrated = soft [ cand 0, 0.97; cand 1, 0.02; cand 2, 0.01 ]
    // Guard the test against vacuity: the operator must actually have work to do.
    Assert.True(SV.uniformShare concentrated < 0.3, "precondition: belief must be below the floor")

    let once = SV.widen 0.3 concentrated
    let twice = SV.widen 0.3 once

    Assert.False(sameDist concentrated once, "widen did not fire — test would be vacuous")
    Assert.True(sameDist once twice, "widen is not idempotent")
    Assert.True(approx (SV.uniformShare once) 0.3, "floor did not land exactly on lambda")

[<Fact>]
let ``falsifier 3b - retain is idempotent`` () =
    let evidence = [ for i in 0 .. 39 -> ev (int64 i) A ]
    let once = SV.retain (SV.window 10L) evidence
    let twice = SV.retain (SV.window 10L) once
    Assert.Equal(10, List.length once)                     // fired: 10 of 40 retained
    Assert.Equal(List.length once, List.length twice)
    Assert.Equal<int64 list>(once |> List.map (fun e -> e.Phase), twice |> List.map (fun e -> e.Phase))

[<Fact>]
let ``widen above the floor is a no-op (the max, not an increment)`` () =
    let wide = soft [ cand 0, 1.0; cand 1, 1.0; cand 2, 1.0 ]
    Assert.True(sameDist wide (SV.widen 0.3 wide))

// ── FALSIFIER 4: THE FLOOR IS NOT FREE ──
// An operator that only ever widens is as broken as one that only ever sharpens.

[<Fact>]
let ``falsifier 4 - a stationary source still converges under retraction, and does not jitter`` () =
    let stationary = [ for i in 0 .. 59 -> ev (int64 i) A ]
    let converged = (SV.foldRetained (SV.window 10L) stationary uniform3).Value
    Assert.Equal(cand 0, argmax converged)
    Assert.True(SV.confidence converged > 0.99,
                sprintf "stationary source failed to converge: confidence %f" (SV.confidence converged))

[<Fact>]
let ``falsifier 4b - widen's floor PERMANENTLY caps confidence - the cost, stated`` () =
    // This is the price of the belief-axis floor, and why `foldRetained` is the load-bearing
    // operator: no amount of consistent evidence can push confidence past 1 - λ + λ/n.
    let mutable sv = uniform3
    for _ in 1 .. 200 do
        sv <- SV.widen 0.3 ((SV.observe A sv).Value)
    let cap = 1.0 - 0.3 + 0.3 / 3.0                        // = 0.8
    Assert.True(SV.confidence sv <= cap + 1e-9,
                sprintf "confidence %f exceeded the structural cap %f" (SV.confidence sv) cap)
    Assert.True(SV.confidence sv > 0.79, "should sit AT the cap, not below it")

// ── The boundary `widen` is shipped to mark (mirror of BeliefConvergence.sharpen) ──

[<Fact>]
let ``widen interleaved with observe does NOT commute - the documented boundary`` () =
    let p0 = soft [ cand 0, 0.5; cand 1, 0.3; cand 2, 0.2 ]
    let L1 = lik [ 0.9; 0.2; 0.1 ]
    let L2 = lik [ 0.1; 0.8; 0.3 ]
    let step l s = SV.widen 0.3 ((SV.observe l s).Value)
    let order1 = step L2 (step L1 p0)
    let order2 = step L1 (step L2 p0)
    // Pinned as a NEGATIVE: if this ever starts commuting the doc comment is wrong.
    Assert.False(sameDist order1 order2,
                 "widen unexpectedly commuted with observe — the shipped documentation is now false")

[<Fact>]
let ``widen at the fold boundary DOES commute - the safe usage`` () =
    let p0 = soft [ cand 0, 0.5; cand 1, 0.3; cand 2, 0.2 ]
    let L1 = lik [ 0.9; 0.2; 0.1 ]
    let L2 = lik [ 0.1; 0.8; 0.3 ]
    let o l s = (SV.observe l s).Value
    Assert.True(sameDist (SV.widen 0.3 (o L2 (o L1 p0))) (SV.widen 0.3 (o L1 (o L2 p0))))

// ── Invariants widening must not break ──

[<Fact>]
let ``widen never refutes a candidate and preserves normalization`` () =
    let concentrated = soft [ cand 0, 0.97; cand 1, 0.02; cand 2, 0.01 ]
    let w = SV.widen 0.5 concentrated
    let ps = SV.candidates w |> List.map snd
    Assert.All(ps, fun p -> Assert.True(p > 0.0, "widening refuted a candidate"))
    Assert.True(approx (List.sum ps) 1.0, "widening broke normalization")
    Assert.True(SV.entropy w > SV.entropy concentrated, "widening did not increase entropy")

[<Fact>]
let ``widen on a point mass with one candidate is a no-op`` () =
    let pm = SV.certain (cand 0)
    Assert.True(sameDist pm (SV.widen 0.9 pm))
