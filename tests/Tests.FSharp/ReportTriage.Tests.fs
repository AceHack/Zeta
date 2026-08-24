module Zeta.Tests.ReportTriageTests

open global.Xunit
open Zeta.Core
open Zeta.Bayesian

// A deterministic uniform stream (DST §7 — no Math.random, no ambient entropy).
let private uniforms (seed: int) : unit -> float =
    let mutable s = uint64 seed * 2862933555777941757UL + 3037000493UL
    fun () ->
        s <- s * 6364136223846793005UL + 1442695040888963407UL
        float ((s >>> 11) &&& 0x1FFFFFFFFFFFFFUL) / float 0x20000000000000UL

let private signal id reporter claim severity =
    { ReportTriage.ReportId = id
      ReportTriage.Reporter = reporter
      ReportTriage.Area = "billing"
      ReportTriage.Jurisdiction = "eu"
      ReportTriage.Claim = claim
      ReportTriage.ClaimedSeverity = severity
      ReportTriage.Age = 0.0
      ReportTriage.ExpectedCost = 1.0
      ReportTriage.Novelty = 1.0 }

// A ledger where "veteran" has a long run of upheld findings in (billing, eu).
let private veteranLedger : TravelerRankLedger.Ledger =
    let dom = ReportTriage.domainKey "billing" "eu"
    List.replicate 20 true
    |> List.fold (fun acc hit -> TravelerRankLedger.record "veteran" dom hit acc) TravelerRankLedger.empty

// ── The anti-burial property — the fairness guarantee the whole design exists for ──────────────────

[<Fact>]
let ``anti-burial: a large claim from an unknown reporter outranks a small claim from a veteran`` () =
    let prior = Gaussian.ofMeanVariance 0.0 1.0
    let priorFor _ = Some prior
    // Newcomer reports something far from the prior and reasonably tight — genuinely surprising.
    let newcomer =
        signal "r-new" "unknown-newcomer"
            (Some { ReportTriage.Variable = "x"; ReportTriage.Estimate = 8.0; ReportTriage.StatedVariance = 0.5 })
            0.2
    // Veteran reports something the prior already believes — true, useful, and not news.
    let veteran =
        signal "r-vet" "veteran"
            (Some { ReportTriage.Variable = "x"; ReportTriage.Estimate = 0.05; ReportTriage.StatedVariance = 0.5 })
            0.2
    let sNew = ReportTriage.score ReportTriage.defaultWeights veteranLedger priorFor newcomer
    let sVet = ReportTriage.score ReportTriage.defaultWeights veteranLedger priorFor veteran
    // Track record scales a newcomer's report; it must never silence it.
    Assert.True(sNew.Score > sVet.Score,
                sprintf "newcomer %.4f must outrank veteran %.4f on merits" sNew.Score sVet.Score)

[<Fact>]
let ``track record is the tiebreak, not the primary: equal claims are separated by validity`` () =
    let prior = Gaussian.ofMeanVariance 0.0 1.0
    let priorFor _ = Some prior
    let claim = Some { ReportTriage.Variable = "x"; ReportTriage.Estimate = 3.0; ReportTriage.StatedVariance = 0.5 }
    let sNew = ReportTriage.score ReportTriage.defaultWeights veteranLedger priorFor (signal "a" "unknown" claim 0.5)
    let sVet = ReportTriage.score ReportTriage.defaultWeights veteranLedger priorFor (signal "b" "veteran" claim 0.5)
    // Same claim ⇒ "who has been right in this area before" decides. Aaron's tiebreak, and it is
    // not a special case in the code — it falls out of λ discounting the likelihood.
    Assert.True(sVet.Score > sNew.Score)

[<Fact>]
let ``lambda is floored above zero — the load-bearing guard against burial`` () =
    let dom = ReportTriage.domainKey "billing" "eu"
    // A reporter with a long run of unupheld findings: worst case the ledger can express.
    let poor =
        List.replicate 50 false
        |> List.fold (fun acc hit -> TravelerRankLedger.record "poor" dom hit acc) TravelerRankLedger.empty
    let lambda = ReportTriage.validityLambda "poor" "billing" "eu" poor
    // The constant itself is the guard. Asserting only `lambda >= LambdaFloor` would be vacuous —
    // it holds trivially if the floor is set to 0, which is exactly the regression to catch.
    Assert.True(ReportTriage.LambdaFloor > 0.0, "the floor must be strictly positive or a reporter can be silenced")
    Assert.True(lambda >= ReportTriage.LambdaFloor)
    Assert.True(lambda > 0.0)

[<Fact>]
let ``a fresh reporter sits at the honest prior, not at a pessimistic clamp`` () =
    let lambda = ReportTriage.validityLambda "never-seen" "billing" "eu" TravelerRankLedger.empty
    Assert.Equal(0.5, lambda, 3)

// ── The honest prerequisite: free text has no measurable information gain ──────────────────────────

[<Fact>]
let ``free-text reports score on the proxy path, and the queue says so`` () =
    let priorFor _ = None
    let scored =
        [ signal "a" "unknown" None 0.9; signal "b" "veteran" None 0.3 ]
        |> List.map (ReportTriage.score ReportTriage.defaultWeights veteranLedger priorFor)
    // 1.0 means: none of the ordering rests on measured belief movement. Today that is the truth,
    // and the queue reports it rather than letting it be inferred.
    Assert.Equal(1.0, ReportTriage.proxyFraction scored)
    Assert.All(scored, fun s -> Assert.True(ReportTriage.isProxy s.InfoGain))

[<Fact>]
let ``a claim over a variable we hold no prior for falls back to proxy, never fabricates a KL`` () =
    let claim = Some { ReportTriage.Variable = "unmodelled"; ReportTriage.Estimate = 5.0; ReportTriage.StatedVariance = 0.1 }
    let s = ReportTriage.score ReportTriage.defaultWeights veteranLedger (fun _ -> None) (signal "a" "x" claim 0.4)
    Assert.True(ReportTriage.isProxy s.InfoGain)

// ── Cry-wolf is blocked, and the code says blocked rather than returning a fake correction ─────────

[<Fact>]
let ``severity correction is identically zero because no rubric exists`` () =
    // Zeta has P0..P3 labels with no criteria, so no severity claim here is falsifiable. The type
    // has one inhabitant naming the blocker; this pins that no silent correction is being applied.
    Assert.Equal(0.0, ReportTriage.severityCorrection ReportTriage.NoRubricExists)
    // REWRITTEN 2026-08-23 (Soraya), workitem 081M0RAX8AC087G0R003NQM7P9. This line used to read
    //     Assert.Equal(ReportTriage.Blocked "severity rubric", ReportTriage.Blocked "severity rubric")
    // Both sides were the same literal constructor application. No code under test was invoked at
    // all, so the assertion could not fail for any implementation of anything — and the value it
    // named is one `ReportTriage` never produces (`computabilityOf Severity` is `Placeholder`, not
    // `Blocked`). The two claims the comment above actually makes are now made, and both can go red:
    //   (1) the adjudication type still has exactly ONE inhabitant — adding a rubric-checked case
    //       fails here, which is what a typed hole is for;
    //   (2) Severity is DECLARED non-computable rather than silently corrected.
    Assert.Equal(
        1,
        Microsoft.FSharp.Reflection.FSharpType
            .GetUnionCases(typeof<ReportTriage.SeverityAdjudication>)
            .Length
    )
    Assert.Equal<ReportTriage.Computability>(ReportTriage.Placeholder, ReportTriage.computabilityOf ReportTriage.Severity)

[<Fact>]
let ``severity and validity stay separate: an inflated claim is not laundered by a good record`` () =
    let priorFor _ = None
    // The veteran's validity record is excellent; the severity claim is still taken at face value
    // plus its own (currently absent) correction, never absorbed into the validity term.
    let inflated = ReportTriage.score ReportTriage.defaultWeights veteranLedger priorFor (signal "a" "veteran" None 1.0)
    let honest = ReportTriage.score ReportTriage.defaultWeights veteranLedger priorFor (signal "b" "veteran" None 0.1)
    Assert.True(inflated.Score > honest.Score)
    // This test documents the CURRENT, gameable behaviour rather than a desired one: with no rubric,
    // a veteran who marks everything critical does sort first. That is the hole cry-wolf closes, and
    // it stays open until the rubric exists.

// ── Self-confirmation guards ───────────────────────────────────────────────────────────────────────

[<Fact>]
let ``Unexamined is dropped from evidence — never scored as examined-and-found-nothing`` () =
    let outcomes =
        [ "a", ReportTriage.Unexamined
          "b", ReportTriage.ExaminedNoFinding
          "c", ReportTriage.ExaminedFinding 0.8
          "d", ReportTriage.Unexamined ]
    let admissible = ReportTriage.admissibleEvidence outcomes
    Assert.Equal(2, List.length admissible)
    Assert.DoesNotContain(("a", ReportTriage.Unexamined), admissible)

[<Fact>]
let ``exploration draws surface reports the score would never reach`` () =
    let priorFor _ = None
    let queue =
        [ for i in 1 .. 40 ->
            signal (sprintf "r%02d" i) "unknown" None (float i / 40.0) ]
        |> List.map (ReportTriage.score ReportTriage.defaultWeights TravelerRankLedger.empty priorFor)
    let next = uniforms 7
    // With epsilon = 1.0 every draw ignores the score entirely — the sample the ordering did not
    // select, which is what keeps a holdout independent of the queue on refresh.
    let kinds =
        [ for _ in 1 .. 20 ->
            match ReportTriage.drawNext 1.0 next queue with
            | Some (_, kind, _) -> kind
            | None -> failwith "queue was not empty" ]
    Assert.All(kinds, fun k -> Assert.Equal(ReportTriage.ExplorationDraw, k))
    // And it genuinely reaches low-scored reports, not just the top under another name.
    let picked =
        [ for _ in 1 .. 40 ->
            match ReportTriage.drawNext 1.0 next queue with
            | Some (r, _, _) -> r.Signal.ReportId
            | None -> failwith "queue was not empty" ]
        |> Set.ofList
    Assert.True(Set.count picked > 5)

[<Fact>]
let ``epsilon = 0 is pure score order, deterministic and replayable`` () =
    let priorFor _ = None
    let queue =
        [ signal "low" "unknown" None 0.1; signal "high" "unknown" None 0.9; signal "mid" "unknown" None 0.5 ]
        |> List.map (ReportTriage.score ReportTriage.defaultWeights TravelerRankLedger.empty priorFor)
    match ReportTriage.drawNext 0.0 (uniforms 1) queue, ReportTriage.drawNext 0.0 (uniforms 99) queue with
    | Some (a, ka, resta), Some (b, kb, _) ->
        Assert.Equal("high", a.Signal.ReportId)
        Assert.Equal("high", b.Signal.ReportId)   // different seeds, same result — no ambient entropy
        Assert.Equal(ReportTriage.ScoreDraw, ka)
        Assert.Equal(ReportTriage.ScoreDraw, kb)
        Assert.Equal(2, List.length resta)
    | _ -> failwith "expected a draw from a non-empty queue"

[<Fact>]
let ``weight movement is clamped per tick`` () =
    let current = ReportTriage.defaultWeights
    let runaway = current |> Map.map (fun _ _ -> 1.0)
    let clamped = ReportTriage.clampWeightDelta current runaway
    for KeyValue(d, w) in clamped do
        let before = Map.find d current
        Assert.True(abs (w - before) <= ReportTriage.MaxWeightDelta + 1e-12,
                    sprintf "%A moved %.4f, cap is %.4f" d (abs (w - before)) ReportTriage.MaxWeightDelta)

[<Fact>]
let ``weights never clamp below zero`` () =
    let current = ReportTriage.defaultWeights
    let collapse = current |> Map.map (fun _ _ -> -5.0)
    let clamped = ReportTriage.clampWeightDelta current collapse
    for KeyValue(_, w) in clamped do
        Assert.True(w >= 0.0)

// ── Mechanical properties ──────────────────────────────────────────────────────────────────────────

[<Fact>]
let ``domainKey composes (area, jurisdiction) without collision`` () =
    // "ab" + "" must not equal "a" + "b" — the separator is what prevents a jurisdiction from
    // being read as part of an area name.
    Assert.True(ReportTriage.domainKey "ab" "" <> ReportTriage.domainKey "a" "b")
    Assert.True(ReportTriage.domainKey "billing" "eu" = ReportTriage.domainKey "billing" "eu")

[<Fact>]
let ``cost divides rather than subtracts — Smith's rule`` () =
    let priorFor _ = None
    let cheap = { signal "cheap" "unknown" None 0.5 with ReportTriage.ExpectedCost = 1.0 }
    let dear = { signal "dear" "unknown" None 0.5 with ReportTriage.ExpectedCost = 10.0 }
    let sc = ReportTriage.score ReportTriage.defaultWeights TravelerRankLedger.empty priorFor cheap
    let sd = ReportTriage.score ReportTriage.defaultWeights TravelerRankLedger.empty priorFor dear
    Assert.True(sc.Score > sd.Score)
    // Exactly 10x, not "10 less" — the ratio is the property, and it is what makes the score a
    // value-per-unit-of-scarce-resource rather than an arbitrary penalty.
    Assert.Equal(sc.Score / 10.0, sd.Score, 9)

[<Fact>]
let ``information gain is monotone in how far the claim moves the prior`` () =
    let prior = Gaussian.ofMeanVariance 0.0 1.0
    let gain estimate =
        ReportTriage.claimInfoGain 1.0 prior
            { ReportTriage.Variable = "x"; ReportTriage.Estimate = estimate; ReportTriage.StatedVariance = 0.5 }
        |> ReportTriage.infoGainTerm
    Assert.True(gain 0.1 < gain 1.0)
    Assert.True(gain 1.0 < gain 5.0)

[<Fact>]
let ``a malformed claim teaches nothing rather than scoring infinite`` () =
    let prior = Gaussian.ofMeanVariance 0.0 1.0
    let bad =
        ReportTriage.claimInfoGain 1.0 prior
            { ReportTriage.Variable = "x"; ReportTriage.Estimate = nan; ReportTriage.StatedVariance = 0.5 }
    Assert.Equal(0.0, ReportTriage.infoGainTerm bad)
    let zeroVar =
        ReportTriage.claimInfoGain 1.0 prior
            { ReportTriage.Variable = "x"; ReportTriage.Estimate = 1.0; ReportTriage.StatedVariance = 0.0 }
    Assert.Equal(0.0, ReportTriage.infoGainTerm zeroVar)

[<Fact>]
let ``recency reads the supplied age, and scoring repeats within a run`` () =
    let priorFor _ = None
    let fresh = { signal "a" "unknown" None 0.5 with ReportTriage.Age = 0.0 }
    let old = { signal "b" "unknown" None 0.5 with ReportTriage.Age = 100.0 }
    let sf = ReportTriage.score ReportTriage.defaultWeights TravelerRankLedger.empty priorFor fresh
    let so = ReportTriage.score ReportTriage.defaultWeights TravelerRankLedger.empty priorFor old
    Assert.True(sf.Score > so.Score)
    // CLAIM LOWERED 2026-08-23 (Soraya), workitem 081M0RAX8AC087G0R003NQM7P9. The test name used to
    // end "— the module holds no clock" and this line used to carry the comment "no wall-clock
    // leaked in". Absence of an ambient clock is 2-SAFETY (Clarkson & Schneider 2008): it quantifies
    // over PAIRS of executions under DIFFERENT wall clocks. Two calls microseconds apart share
    // theirs, so the pair is degenerate in exactly the variable being quantified, and this check
    // discriminates only against a clock finer than the inter-call gap — near-zero power against the
    // coarse clock a real leak would read. Faking the pair is not available (`score` cannot be
    // handed a clock), so the claim is lowered rather than the check dressed up.
    //
    // What is honestly checked: scoring repeats within one run. The AGE dependence the name does
    // claim is checked by `sf.Score > so.Score` above, which varies the declared Age across the pair.
    let again = ReportTriage.score ReportTriage.defaultWeights TravelerRankLedger.empty priorFor fresh
    Assert.Equal(sf.Score, again.Score, 12)

[<Fact>]
let ``the queue orders and never rejects — an empty draw only happens on an empty queue`` () =
    Assert.True((ReportTriage.drawNext 0.5 (uniforms 3) []).IsNone)
    let priorFor _ = None
    let one = [ ReportTriage.score ReportTriage.defaultWeights TravelerRankLedger.empty priorFor (signal "a" "unknown" None 0.0) ]
    // Severity 0.0, unknown reporter, no claim — the lowest a report can score, and it is still
    // drawn. Nothing is dropped for scoring low; under scarcity it waits, that is all.
    Assert.True((ReportTriage.drawNext 0.0 (uniforms 3) one).IsSome)
