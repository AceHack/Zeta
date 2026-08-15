module Zeta.Tests.CandidateGenerationTests

open FsUnit.Xunit
open global.Xunit
open Zeta.Core
open Zeta.Core.Bonsai

module CG = CandidateGeneration
module CGM = CandidateGenerationMeasure
module PS = ProbabilitySemiring


// ═══════════════════════════════════════════════════════════════════
// CandidateGeneration — the generator of alternative futures.
//
// Three registers, and the tests are split along them on purpose:
//
//   (a) GATED — vacuity. A generator emitting one candidate, or N candidates
//       carrying one posterior, satisfies every type on the path and performs no
//       inference. There is nothing to "get better at" there, so `Vacuous` is
//       asserted false and a deliberately-degenerate grammar is shown to trip it.
//   (b) GATED — soundness. Every generated program's predicted cost must bound
//       its actual `evalSoft` width, scored by the SAME instrument
//       (`BonsaiCostMeasure.measureWith`) that scored the hand-built corpus.
//       `actual > predicted` is the defect; looser is fine.
//   (c) RECORDED, NOT GATED — discrimination and held-out agreement. Aaron
//       2026-08-15: predictions "most probably won't [discriminate] at first,
//       until we get better at it." A bar here would invite tuning the model
//       until the number looks good. These tests pin that the instrument WORKS
//       (it can report disagreement) without asserting the score is good.
//
// The distinction the whole module exists to hold: cost-bound pruning drops a
// branch that is too expensive WITHIN one plan; possibility-space pruning chooses
// AMONG plans that did not exist yet. `the prior decides when the evidence cannot`
// below is the second one happening, and no cost model can produce it.
// ═══════════════════════════════════════════════════════════════════

let private okGen =
    function
    | Ok(g: CG.Generated) -> g
    | Error f -> failwithf "expected generate Ok, got %s" (CG.feedbackText f)

let private ci (v: int64) = SoftValue.certain (DynamicValue.Int v)

let private posteriorOf (c: PredictionInference.Candidate<Expr>) = PS.mul c.Prior c.Likelihood

let private labelled (label: string) (g: CG.Generated) =
    g.Candidates
    |> List.tryFind (fun c -> c.Label = label)
    |> Option.defaultWith (fun () -> failwithf "no candidate labelled %s" label)


// ── (a) VACUITY IS GATED ────────────────────────────────────────────
//
// The bar from the brief: "a generator emitting one candidate, or N identical
// ones, satisfies the type and does nothing — that is the vacuity class in
// generative clothing."

[<Fact>]
let ``the generator produces alternatives that actually differ`` () =
    let g = CG.generate CGM.referenceSituation |> okGen
    let s = CGM.spread g

    s.Vacuous |> should equal false
    s.DistinctExprs |> should be (greaterThan 1)
    s.DistinctPosteriors |> should be (greaterThan 1)
    // every generated program is structurally distinct — no duplicate padding
    s.DistinctExprs |> should equal s.Generated

[<Fact>]
let ``a leaves-only grammar is REPORTED vacuous rather than passing quietly`` () =
    // One param, no way to compose, one observation it satisfies: exactly one
    // candidate, so there are no alternatives and nothing to choose between.
    // The instrument must say so — if `Vacuous` could not fire, asserting it
    // false above would be worthless.
    let degenerate: CG.Situation =
        { Grammar =
            { Params = [ "x" ]
              Constants = []
              Ops = [ Add ]
              UseCond = false
              MaxDepth = 0 // no composition levels — leaves only
              MaxCandidates = 16 }
          Observations = [ { Env = Map.ofList [ "x", ci 3L ]; Observed = DynamicValue.Int 3L } ]
          BytesPerCandidate = 8L
          BytesPerPair = 1L }

    let s = CG.generate degenerate |> okGen |> CGM.spread
    s.Generated |> should equal 1
    s.Vacuous |> should equal true

[<Fact>]
let ``N candidates with one posterior is ALSO vacuous - the subtler case`` () =
    // Two observationally-identical hypotheses of the SAME size: same likelihood,
    // same prior, so the ranking carries no information even though the count
    // looks healthy. This is the failure that a bare "did it emit N?" check misses —
    // and it is why `Vacuous` reads `DistinctPosteriors`, not just `Generated`.
    let flat: CG.Situation =
        { Grammar =
            { Params = [ "x"; "y" ]
              Constants = []
              Ops = [ Add ]
              UseCond = false
              MaxDepth = 0
              MaxCandidates = 16 }
          Observations = [ { Env = Map.ofList [ "x", ci 0L; "y", ci 0L ]; Observed = DynamicValue.Int 0L } ]
          BytesPerCandidate = 8L
          BytesPerPair = 1L }

    let s = CG.generate flat |> okGen |> CGM.spread
    s.Generated |> should be (greaterThan 1)
    s.DistinctPosteriors |> should equal 1
    s.Vacuous |> should equal true


// ── the mechanism: possibility-space pruning, not cost-bound pruning ──

[<Fact>]
let ``the prior decides when the evidence cannot - Rodney's Razor, not a cost model`` () =
    // Evidence generated by `x` alone. `x`, `(x + 0)`, `(0 + x)`, `(x * 1)`,
    // `(1 * x)`, `(x - 0)` and `(x + y)` are observationally IDENTICAL — same
    // likelihood, every one. Only description length separates them.
    let g = CG.generate CGM.occamSituation |> okGen
    let inference = PredictionInference.infer g.Candidates |> Result.defaultWith (fun f -> failwithf "%A" f)

    inference.Best.Candidate.Label |> should equal "x"

    // and it wins on the PRIOR, not the likelihood: the rival's likelihood is equal
    let rival = labelled "(x + 0)" g
    PS.compare rival.Likelihood inference.Best.Candidate.Likelihood |> should equal 0
    // 2^(3-1) = 4 versus 2^0 = 1
    PS.compare inference.Best.Candidate.Prior rival.Prior |> should be (greaterThan 0)

    // A COST model cannot make this call: the two programs' predicted costs are
    // equal here, which is the whole reason a cost-bound pruner is not a razor.
    rival.Cost.SpaceBytes |> should equal inference.Best.Candidate.Cost.SpaceBytes

[<Fact>]
let ``the evidence refutes hypotheses outright - a nonzero posterior is earned`` () =
    let g = CG.generate CGM.referenceSituation |> okGen

    // 80 programs enumerated, and the data kills all but the two that generated it
    g.Refuted |> should be (greaterThan 0)
    (labelled "(x * y)" g |> posteriorOf |> fun p -> PS.compare p PS.zero) |> should be (greaterThan 0)
    (labelled "(x + y)" g |> posteriorOf |> fun p -> PS.compare p PS.zero) |> should equal 0

[<Fact>]
let ``every hypothesis refuted is REPORTED, not silently empty`` () =
    // Evidence no program in the space can produce (x, y and every depth-1
    // combination of them with 0/1 miss 999). `infer` must say so.
    let impossible: CG.Situation =
        { CGM.occamSituation with
            Observations = [ { Env = Map.ofList [ "x", ci 3L; "y", ci 0L ]; Observed = DynamicValue.Int 999L } ] }

    let g = CG.generate impossible |> okGen
    g.Refuted |> should equal (List.length g.Candidates)

    match PredictionInference.infer g.Candidates with
    | Error PredictionInference.AllCandidatesRefuted -> ()
    | other -> failwithf "expected AllCandidatesRefuted, got %A" other

[<Fact>]
let ``the budget prunes the posterior order - Vision defers what it cannot fund`` () =
    // A tank too small for all 80 alternatives: the affordable prefix boards, the
    // rest is DEFERRED and reported, not dropped.
    let tank = SoftThrottle.tank 200.0 1.0
    let prediction =
        CG.prune tank CGM.referenceSituation
        |> Result.defaultWith (fun f -> failwithf "%A" f)

    prediction.Budget.Boarded |> should not' (be Empty)
    prediction.Budget.Deferred |> should not' (be Empty)
    prediction.Budget.Outcome |> should equal Vision.PartiallyAdmitted
    // the posterior winner is funded first, which is what makes the prune a prune
    (List.head prediction.Budget.Boarded).Label |> should equal "(x * y)"

    // nothing is lost: boarded + deferred is the whole space
    List.length prediction.Budget.Boarded + List.length prediction.Budget.Deferred
    |> should equal (List.length prediction.Budget.Requested)


// ── (b) SOUNDNESS IS GATED ──────────────────────────────────────────

[<Fact>]
let ``every generated program's predicted cost bounds its actual width`` () =
    // The same instrument PR #10835 built, pointed at programs nobody wrote.
    // `measureWith` takes the predictor as a parameter precisely so this reuse
    // needs no new plumbing.
    let g = CG.generate CGM.referenceSituation |> okGen

    for observation in CGM.referenceSituation.Observations do
        let cases, excluded = CGM.soundnessCases observation.Env g
        // the exclusion path must not be how the corpus stays clean
        excluded |> should equal 0
        cases |> should not' (be Empty)

        match BonsaiCostMeasure.measureWith BonsaiCost.predict cases with
        | Error f -> failwithf "measure declined: %A" f
        | Ok m ->
            m.Unsound |> should be Empty
            m.Cases |> should equal (List.length g.Candidates)

[<Fact>]
let ``an UNSOUND predictor over the generated corpus is caught`` () =
    // Without this the assertion above could be passing because the instrument
    // never fires. Halving every width under-predicts, which is the defect.
    let g = CG.generate CGM.referenceSituation |> okGen
    let env = (List.item 2 CGM.referenceSituation.Observations).Env
    let cases, _ = CGM.soundnessCases env g

    let underPredict widths expr =
        BonsaiCost.predict widths expr
        |> Result.map (fun c -> { c with BonsaiCost.Width = max 1L (c.Width / 2L) })

    match BonsaiCostMeasure.measureWith underPredict cases with
    | Error f -> failwithf "measure declined: %A" f
    | Ok m -> m.Unsound |> should not' (be Empty)


// ── (c) RECORDED, NOT GATED ─────────────────────────────────────────

[<Fact>]
let ``the held-out check AGREES on the reference - recorded, not asserted good`` () =
    match CGM.heldOut CGM.referenceSituation CGM.referenceHeldOut with
    | Error f -> failwithf "held-out declined: %s" (CG.feedbackText f)
    | Ok h ->
        // What is pinned is the MECHANISM, not the quality: the winner is a real
        // program and the check produced a real mass. The agreement itself is
        // recorded in the PR body, not treated as a bar the model must clear.
        h.WinnerLabel |> should equal "(x * y)"
        h.Agrees |> should equal true

[<Fact>]
let ``the held-out check can DISAGREE - the falsifier is not vacuous`` () =
    // Fit on a single point where `x + y` and `x * y` both give 4 (2+2 = 2*2 = 4),
    // then test at a point where they differ. The winner is `(x + y)` by Occam tie-
    // break on label order among equals, and it MUST be able to fail here — a
    // held-out check that cannot report disagreement is not a falsifier.
    let ambiguous: CG.Situation =
        { CGM.occamSituation with
            Grammar = { CGM.occamSituation.Grammar with Constants = [] }
            Observations = [ { Env = Map.ofList [ "x", ci 2L; "y", ci 2L ]; Observed = DynamicValue.Int 4L } ] }

    let unseen: CG.Observation =
        { Env = Map.ofList [ "x", ci 3L; "y", ci 5L ]
          Observed = DynamicValue.Int 15L } // x*y = 15, x+y = 8

    match CGM.heldOut ambiguous unseen with
    | Error f -> failwithf "held-out declined: %s" (CG.feedbackText f)
    | Ok h ->
        // Whichever hypothesis won the fit, exactly one of the two can be right
        // here — and if the loser won, the check reports the disagreement.
        if h.WinnerLabel = "(x * y)" || h.WinnerLabel = "(y * x)" then
            h.Agrees |> should equal true
        else
            h.Agrees |> should equal false
            h.MassOnObserved |> should equal 0.0

[<Fact>]
let ``all-refuted at fit time is reported as a DISAGREEMENT, not a decline`` () =
    let impossible: CG.Situation =
        { CGM.occamSituation with
            Observations = [ { Env = Map.ofList [ "x", ci 3L; "y", ci 0L ]; Observed = DynamicValue.Int 999L } ] }

    match CGM.heldOut impossible CGM.referenceHeldOut with
    | Error f -> failwithf "held-out declined: %s" (CG.feedbackText f)
    | Ok h ->
        h.Agrees |> should equal false
        h.WinnerLabel |> should equal "<all refuted>"


// ── enumeration: the truncation defect that running it exposed ──────

[<Fact>]
let ``truncation is whole-level, so a survivor set is an MDL prefix`` () =
    // The defect this pins (found 2026-08-15 by running, not reading): a cap that
    // cuts INSIDE a level cuts by `for op in ...` order, not by prior — and it
    // removed `x * y`, the hypothesis that generated the reference evidence,
    // turning the whole run into `AllCandidatesRefuted`.
    let leaves = 5 // 3 constants + 2 params
    let tight = { CGM.referenceSituation.Grammar with MaxCandidates = leaves + 1 }

    match CG.enumerate tight with
    | Error f -> failwithf "enumerate declined: %s" (CG.feedbackText f)
    | Ok(exprs, truncated) ->
        truncated |> should equal true
        // the partial level was refused entirely: leaves only, never leaves + 1
        List.length exprs |> should equal leaves
        exprs |> List.forall (fun e -> CG.size e = 1) |> should equal true

[<Fact>]
let ``an untruncated space keeps the hypothesis that generated the evidence`` () =
    match CG.enumerate CGM.referenceSituation.Grammar with
    | Error f -> failwithf "enumerate declined: %s" (CG.feedbackText f)
    | Ok(exprs, truncated) ->
        truncated |> should equal false
        exprs |> List.contains (Binary(Mul, Param "x", Param "y")) |> should equal true

[<Fact>]
let ``enumeration is deduplicated and deterministic`` () =
    let first = CG.enumerate CGM.referenceSituation.Grammar
    let second = CG.enumerate CGM.referenceSituation.Grammar
    first |> should equal second

    match first with
    | Ok(exprs, _) -> List.length (List.distinct exprs) |> should equal (List.length exprs)
    | Error f -> failwithf "enumerate declined: %s" (CG.feedbackText f)


// ── the likelihood's two honesty details ────────────────────────────

[<Fact>]
let ``a positive but tiny weight is NOT rounded to refuted`` () =
    // 1/8192 is below the quantization step. Refuted must mean "no support", not
    // "rounded away" — collapsing the two manufactures certainty the evidence
    // does not contain.
    let faint =
        SoftValue.ofWeighted [ DynamicValue.Int 1L, 1.0 / 8192.0; DynamicValue.Int 2L, 1.0 - 1.0 / 8192.0 ]
        |> Option.defaultWith (fun () -> failwith "degenerate")

    let situation: CG.Situation =
        { Grammar =
            { Params = [ "x" ]
              Constants = [ CInt 1L ]
              Ops = [ Add ]
              UseCond = false
              MaxDepth = 1
              MaxCandidates = 32 }
          Observations = [ { Env = Map.ofList [ "x", faint ]; Observed = DynamicValue.Int 1L } ]
          BytesPerCandidate = 8L
          BytesPerPair = 1L }

    let g = CG.generate situation |> okGen
    let x = labelled "x" g
    PS.compare x.Likelihood PS.zero |> should be (greaterThan 0)

[<Fact>]
let ``an ill-typed hypothesis is REFUTED by evidence, not dropped from the space`` () =
    // Grammar over a bool-producing op feeding an arithmetic one. The ill-typed
    // program must still appear, carrying likelihood 0 — dropping it would shrink
    // the possibility space instead of pruning it, and the two are not the same act.
    let situation: CG.Situation =
        { Grammar =
            { Params = [ "x" ]
              Constants = [ CInt 1L ]
              Ops = [ Add; Lt ]
              UseCond = false
              MaxDepth = 2
              MaxCandidates = 4096 }
          Observations = [ { Env = Map.ofList [ "x", ci 2L ]; Observed = DynamicValue.Int 3L } ]
          BytesPerCandidate = 8L
          BytesPerPair = 1L }

    let g = CG.generate situation |> okGen
    let illTyped = labelled "((x < 1) + 1)" g
    PS.compare illTyped.Likelihood PS.zero |> should equal 0
    // and the well-typed one that fits the data survives
    PS.compare (labelled "(x + 1)" g |> posteriorOf) PS.zero |> should be (greaterThan 0)


// ── the scheduler seam ──────────────────────────────────────────────

[<Fact>]
let ``the generator plugs into PredictionScheduler as the CandidateEstimator`` () =
    // The point of the whole exercise: the seam is unchanged, the input is not.
    let tank = SoftThrottle.tank 200.0 1.0
    let state = PredictionScheduler.planned CGM.referenceSituation tank

    match PredictionScheduler.plan CG.estimator (TimerElapsed 1) state with
    | Error f -> failwithf "plan declined: %A" f
    | Ok next ->
        next.Tick |> should equal 1
        next.PredictedBytes |> should be (greaterThan 0L)
        next.DeferredBytes |> should be (greaterThan 0L)

        match next.LastPrediction with
        | None -> failwith "expected a prediction"
        | Some p -> (List.head p.Budget.Boarded).Label |> should equal "(x * y)"

[<Fact>]
let ``a generation decline reaches the scheduler as GenerationFeedback, not a fake prior`` () =
    let broken =
        { CGM.referenceSituation with
            Grammar = { CGM.referenceSituation.Grammar with Params = [ "missing" ] } }

    match CG.estimator (TimerElapsed 1) broken with
    | Ok _ -> failwith "expected a decline"
    | Error(PredictionInference.GenerationFeedback detail) ->
        detail |> should haveSubstring "missing"
    | Error other -> failwithf "expected GenerationFeedback, got %A" other

[<Fact>]
let ``no observations is a decline, because the posterior would just be the prior`` () =
    let noEvidence = { CGM.referenceSituation with Observations = [] }

    match CG.generate noEvidence with
    | Error CG.NoObservations -> ()
    | other -> failwithf "expected NoObservations, got %A" other


// ── the report line ─────────────────────────────────────────────────

[<Fact>]
let ``the spread report is invariant-culture and fixed-format`` () =
    let s = CG.generate CGM.referenceSituation |> okGen |> CGM.spread
    let line = CGM.report s
    line |> should haveSubstring "CandidateGeneration spread:"
    line |> should haveSubstring "vacuous=False"
    // decimal point, never a locale comma — this line is compared across machines
    line |> should haveSubstring "posteriorRatio=1.000"
