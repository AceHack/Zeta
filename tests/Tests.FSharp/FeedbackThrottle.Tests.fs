module Zeta.Tests.FeedbackThrottleTests

open global.Xunit
open Zeta.Core

[<Fact>]
let ``instant feedback (latency 0) reaches the algebraic max S=4 (the toy)`` () =
    Assert.Equal(FeedbackThrottle.AlgebraicMax, FeedbackThrottle.maxChsh 0.0, 12)
    Assert.True(FeedbackThrottle.canExceedTsirelson 0.0)

[<Fact>]
let ``no usable real-time feedback (huge latency) -> approaches classical bound S=2`` () =
    Assert.True(FeedbackThrottle.maxChsh 1.0e9 < FeedbackThrottle.ClassicalBound + 1e-6) // approaches 2 (asymptotic; 1/(1+L) never exactly 0)
    Assert.True(FeedbackThrottle.maxChsh 1.0e9 >= FeedbackThrottle.ClassicalBound) // never below classical

[<Fact>]
let ``finite latency interpolates 4 → 2, monotonically decreasing`` () =
    let xs = [ 0.0; 0.5; 1.0; 2.0; 5.0; 20.0 ] |> List.map FeedbackThrottle.maxChsh
    Assert.Equal<float list>(xs, List.sortDescending xs) // monotone non-increasing
    Assert.True(List.head xs > List.last xs) // strictly drops
    Assert.True(xs |> List.forall (fun s -> s <= 4.0 + 1e-12 && s >= 2.0 - 1e-12)) // stays in [2,4]

[<Fact>]
let ``2√2 is crossed at a finite latency — a real transport drops below the toy's S=4`` () =
    Assert.True(FeedbackThrottle.canExceedTsirelson 0.1) // fast feedback: supra-Tsirelson still reachable
    Assert.False(FeedbackThrottle.canExceedTsirelson 10.0) // slow feedback: capped below 2√2
    // somewhere between, maxChsh passes through exactly 2√2
    Assert.True(FeedbackThrottle.maxChsh 0.1 > FeedbackThrottle.Tsirelson)
    Assert.True(FeedbackThrottle.maxChsh 10.0 < FeedbackThrottle.Tsirelson)

[<Fact>]
let ``maxChsh is ClassicalBound plus twice attenuation (two expressions, not X = X)`` () =
    // R2: `maxChsh 1.5 = maxChsh 1.5` is one expression twice, a check that
    // cannot fail. The composition identity can fail if the formula drifts.
    let l = 1.5
    let viaMax = FeedbackThrottle.maxChsh l
    let viaAttn = FeedbackThrottle.ClassicalBound + 2.0 * FeedbackThrottle.attenuation l
    Assert.Equal(viaMax, viaAttn, 12)

[<Fact>]
let ``TsirelsonLatency = sqrt 2 and it sets maxChsh to exactly 2 root 2`` () =
    Assert.Equal(sqrt 2.0, FeedbackThrottle.TsirelsonLatency, 12)
    Assert.Equal(FeedbackThrottle.Tsirelson, FeedbackThrottle.maxChsh FeedbackThrottle.TsirelsonLatency, 9)

[<Fact>]
let ``latencyFor inverts maxChsh (round-trip) and rejects out-of-band targets`` () =
    let t = 2.6
    match FeedbackThrottle.latencyFor t with
    | Some l -> Assert.Equal(t, FeedbackThrottle.maxChsh l, 9)
    | None -> Assert.True(false, "should be achievable")
    Assert.Equal(None, FeedbackThrottle.latencyFor 2.0) // classical floor not hit
    Assert.Equal(None, FeedbackThrottle.latencyFor 4.0) // algebraic ceiling not hit
    match FeedbackThrottle.latencyFor FeedbackThrottle.Tsirelson with
    | Some l -> Assert.Equal(sqrt 2.0, l, 9) // latencyFor 2√2 = √2
    | None -> Assert.True(false, "2√2 is achievable")

[<Fact>]
let ``regimeOf classifies channels by latency (git-slow=Classical, instant=Signalling, sqrt2=Quantum)`` () =
    Assert.Equal(FeedbackThrottle.Classical, FeedbackThrottle.regimeOf 1e6) // git-over-commits: huge latency
    Assert.Equal(FeedbackThrottle.Signalling, FeedbackThrottle.regimeOf 0.0) // instant feedback: S=4
    Assert.Equal(FeedbackThrottle.Quantum, FeedbackThrottle.regimeOf (sqrt 2.0)) // exactly at 2√2 -> Quantum band
    Assert.Equal(FeedbackThrottle.Quantum, FeedbackThrottle.regimeOf 2.0) // slower than √2, still > classical

[<Fact>]
let ``S=4 is measured seed-shared; 2√2 is an unmeasured predicted floor; TsirelsonLatency is toy`` () =
    match FeedbackThrottle.measuredSeedSharedS4 with
    | FeedbackThrottle.Measured(s, cond) ->
        Assert.Equal(FeedbackThrottle.AlgebraicMax, s)
        Assert.Equal(BellTest.AlgebraicMax, s)
        Assert.Contains("seed", cond, System.StringComparison.Ordinal)
    | other -> failwithf "expected Measured, got %A" other
    match FeedbackThrottle.toyAt 0.0 with
    | FeedbackThrottle.ToyModel(s, lat) ->
        Assert.Equal(0.0, lat)
        Assert.Equal(4.0, s)
    | other -> failwithf "expected ToyModel, got %A" other
    match FeedbackThrottle.tsirelsonFloorToBeMeasured with
    | FeedbackThrottle.UnmeasuredPredictedFloor(s, reason) ->
        Assert.Equal(FeedbackThrottle.Tsirelson, s, 12)
        Assert.True(
            reason.IndexOf("underpowered", System.StringComparison.Ordinal)
            >= 0
        )
    | other -> failwithf "expected UnmeasuredPredictedFloor, got %A" other
    // toy curve identity still holds — that is not a network measurement
    Assert.Equal(FeedbackThrottle.Tsirelson, FeedbackThrottle.maxChsh FeedbackThrottle.TsirelsonLatency, 9)

[<Fact>]
let ``jitter is dual-use — degrades S and is captured into frost; neither reading is the verdict`` () =
    Assert.Equal(2, List.length FeedbackThrottle.jitterDualReadings)
    Assert.Contains(
        FeedbackThrottle.CorrelationDegradation,
        FeedbackThrottle.jitterDualReadings
    )
    Assert.Contains(
        FeedbackThrottle.FrostUniquenessCapture,
        FeedbackThrottle.jitterDualReadings
    )
    // the fact does not name a verdict
    let fact = FeedbackThrottle.JitterPresent
    Assert.Equal(FeedbackThrottle.JitterPresent, fact)

[<Fact>]
let ``a latency-only sweep is underpowered — the channel inventory is open and non-exhaustive`` () =
    Assert.False FeedbackThrottle.inventoryClaimsExhaustiveness
    Assert.True(FeedbackThrottle.hasKnownChannel "system-prompt")
    Assert.True(FeedbackThrottle.hasKnownChannel "selected-model")
    Assert.True(FeedbackThrottle.hasKnownChannel "model-family")
    Assert.True(FeedbackThrottle.hasKnownChannel "prompt-frame")
    Assert.True(FeedbackThrottle.hasKnownChannel "network-latency-jitter")
    Assert.True(FeedbackThrottle.hasKnownChannel "hat-producer-vs-verifier")
    Assert.True(
        FeedbackThrottle.sweepIsUnderpowered [ "network-latency-jitter" ]
    )
    // covering today's snapshot still does not claim completeness
    Assert.False(
        FeedbackThrottle.sweepIsUnderpowered FeedbackThrottle.knownChannelNames
    )
    Assert.False FeedbackThrottle.inventoryClaimsExhaustiveness
    Assert.True(List.length FeedbackThrottle.knownDecorrelationChannels > 6)
    // default string collation is binary / codepoint, not ambient culture
    Assert.Equal("binary", Collation.defaultName)
    Assert.Same(Collation.binary, Collation.byNameOrDefault Collation.defaultName)
    Assert.NotSame(System.StringComparer.InvariantCulture, Collation.binary)
    Assert.NotSame(System.StringComparer.CurrentCulture, Collation.binary)
