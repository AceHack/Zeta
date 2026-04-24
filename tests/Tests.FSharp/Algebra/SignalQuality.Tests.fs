module Zeta.Tests.Algebra.SignalQualityTests

open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// Compression dimension — high-repetition strings compress well
// (low ratio / low suspicion); random-like strings do not.
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``compressionRatio on empty string returns neutral 0.5`` () =
    SignalQuality.compressionRatio "" |> should (equalWithin 1e-9) 0.5


[<Fact>]
let ``compressionRatio on highly-repetitive text is low`` () =
    let repetitive = String.replicate 4096 "abc"
    let ratio = SignalQuality.compressionRatio repetitive
    // gzip on 12 KB of 3-char repeat should land well under 0.1.
    ratio |> should be (lessThan 0.1)


[<Fact>]
let ``compressionRatio is clamped into the unit interval`` () =
    let text = "abcdefghijklmnopqrstuvwxyz"
    let ratio = SignalQuality.compressionRatio text
    ratio |> should be (greaterThanOrEqualTo 0.0)
    ratio |> should be (lessThanOrEqualTo 1.0)


[<Fact>]
let ``compressionMeasure emits a Compression-dimension finding`` () =
    let finding = SignalQuality.compressionMeasure.Measure "hello hello hello hello"
    finding.Dimension |> should equal QualityDimension.Compression
    finding.Score |> should be (greaterThanOrEqualTo 0.0)
    finding.Score |> should be (lessThanOrEqualTo 1.0)


// ═══════════════════════════════════════════════════════════════════
// Severity bands — cutoffs at 0.30 / 0.60 / 0.85.
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``severityOfScore partitions at the documented cutoffs`` () =
    SignalQuality.severityOfScore 0.10 |> should equal Pass
    SignalQuality.severityOfScore 0.45 |> should equal Warn
    SignalQuality.severityOfScore 0.75 |> should equal Fail
    SignalQuality.severityOfScore 0.95 |> should equal Quarantine


[<Fact>]
let ``severityOfScore on NaN returns Quarantine`` () =
    SignalQuality.severityOfScore nan |> should equal Quarantine


// ═══════════════════════════════════════════════════════════════════
// Claim-store — ZSet-backed retraction-native storage.
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``claimsOf sums duplicate assertions under the Z-set algebra`` () =
    let claims =
        SignalQuality.claimsOf [ ("x", 1L); ("x", 1L); ("y", 1L) ]
    claims.[ "x" ] |> should equal 2L
    claims.[ "y" ] |> should equal 1L


[<Fact>]
let ``claimsOf cancels an assertion against its retraction to zero`` () =
    let claims =
        SignalQuality.claimsOf [ ("x", 1L); ("x", -1L) ]
    // Zero-weight entries drop out in the sorted representation.
    claims.[ "x" ] |> should equal 0L


// ═══════════════════════════════════════════════════════════════════
// Grounding / falsifiability — caller-predicate dimensions.
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``groundedProportion counts strictly-positive-weight claims`` () =
    let claims =
        SignalQuality.claimsOf [ ("a", 2L); ("b", 1L); ("c", -1L) ]
    // (c, -1) stays in the Z-set but has negative weight; only a and b
    // are strictly positive.
    let grounded = SignalQuality.groundedProportion claims
    grounded |> should (equalWithin 1e-9) (2.0 / 3.0)


[<Fact>]
let ``groundingWith uses the caller's predicate`` () =
    let claims =
        SignalQuality.claimsOf [ ("fact:x=1", 1L); ("vibe:x is nice", 1L); ("fact:y=2", 1L) ]
    let looksGrounded (s: string) = s.StartsWith("fact:")
    let score = SignalQuality.groundingWith looksGrounded claims
    score |> should (equalWithin 1e-9) (2.0 / 3.0)


[<Fact>]
let ``falsifiabilityWith returns 1.0 on an empty claim store`` () =
    let empty = ZSet<string>.Empty
    SignalQuality.falsifiabilityWith (fun _ -> false) empty
    |> should (equalWithin 1e-9) 1.0


// ═══════════════════════════════════════════════════════════════════
// Consistency — only over-retraction flags inconsistency; clean
// cancellation to zero is fine.
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``consistencyScore is 1.0 when no claim is over-retracted`` () =
    let claims =
        SignalQuality.claimsOf [ ("a", 1L); ("b", 2L); ("c", -1L); ("c", 1L) ]
    // c cancelled to zero; a and b positive.
    SignalQuality.consistencyScore claims |> should (equalWithin 1e-9) 1.0


[<Fact>]
let ``consistencyScore drops below 1.0 on over-retraction`` () =
    let claims =
        SignalQuality.claimsOf [ ("a", 1L); ("b", -3L) ]
    // b is over-retracted (residual negative).
    let score = SignalQuality.consistencyScore claims
    score |> should (equalWithin 1e-9) 0.5


// ═══════════════════════════════════════════════════════════════════
// Drift — Jaccard complement between snapshots.
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``driftScore is zero when both snapshots are empty`` () =
    let e = ZSet<string>.Empty
    SignalQuality.driftScore e e |> should (equalWithin 1e-9) 0.0


[<Fact>]
let ``driftScore is zero when snapshots are identical`` () =
    let a = SignalQuality.claimsOf [ ("x", 1L); ("y", 1L) ]
    let b = SignalQuality.claimsOf [ ("x", 1L); ("y", 1L) ]
    SignalQuality.driftScore a b |> should (equalWithin 1e-9) 0.0


[<Fact>]
let ``driftScore is 1.0 when snapshots are disjoint`` () =
    let a = SignalQuality.claimsOf [ ("x", 1L) ]
    let b = SignalQuality.claimsOf [ ("y", 1L) ]
    SignalQuality.driftScore a b |> should (equalWithin 1e-9) 1.0


[<Fact>]
let ``driftScore is 2/3 when one of three union elements overlaps`` () =
    let a = SignalQuality.claimsOf [ ("x", 1L); ("y", 1L) ]
    let b = SignalQuality.claimsOf [ ("y", 1L); ("z", 1L) ]
    // Union = {x,y,z} size 3; Intersect = {y} size 1; 1 - 1/3 = 2/3.
    SignalQuality.driftScore a b |> should (equalWithin 1e-9) (2.0 / 3.0)


// ═══════════════════════════════════════════════════════════════════
// Composite — weighted mean; NaN poisons honestly.
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``composite on empty findings returns zero`` () =
    let score = SignalQuality.composite SignalQuality.uniformWeights []
    score.Composite |> should (equalWithin 1e-9) 0.0
    score.Findings |> should be Empty


[<Fact>]
let ``composite computes a weighted mean under uniform weights`` () =
    let findings =
        [ { Dimension = Compression; Severity = Pass; Score = 0.2; Evidence = "" }
          { Dimension = Grounding; Severity = Warn; Score = 0.4; Evidence = "" }
          { Dimension = Falsifiability; Severity = Fail; Score = 0.9; Evidence = "" } ]
    let score = SignalQuality.composite SignalQuality.uniformWeights findings
    // (0.2 + 0.4 + 0.9) / 3 = 0.5.
    score.Composite |> should (equalWithin 1e-9) 0.5
    score.Findings |> List.length |> should equal 3


[<Fact>]
let ``composite applies caller-supplied weights`` () =
    let findings =
        [ { Dimension = Compression; Severity = Pass; Score = 0.0; Evidence = "" }
          { Dimension = Grounding; Severity = Fail; Score = 1.0; Evidence = "" } ]
    let weights = Map.ofList [ Compression, 0.0; Grounding, 1.0 ]
    let score = SignalQuality.composite weights findings
    // Only grounding contributes; composite = 1.0.
    score.Composite |> should (equalWithin 1e-9) 1.0


[<Fact>]
let ``composite poisons to NaN when any finding score is NaN`` () =
    let findings =
        [ { Dimension = Compression; Severity = Pass; Score = 0.2; Evidence = "" }
          { Dimension = Entropy; Severity = Warn; Score = nan; Evidence = "" } ]
    let score = SignalQuality.composite SignalQuality.uniformWeights findings
    System.Double.IsNaN score.Composite |> should equal true


// ═══════════════════════════════════════════════════════════════════
// End-to-end — measure something that looks like technical prose
// against something that looks like padded fluff.
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``end-to-end composite separates structured prose from padded fluff`` () =
    let structured =
        "The retraction-native Z-set algebra guarantees that every \
         assertion admits a signed retraction; summing deltas cancels \
         to zero at equilibrium."
    let fluff =
        "meta-hyper-quantum recursive epistemic lattice paradigm \
         shift synergy empowering holistic transformation pipeline."
    let claimsStructured =
        SignalQuality.claimsOf
            [ "retraction-native algebra", 1L
              "delta-sum cancels at equilibrium", 1L ]
    let claimsFluff =
        SignalQuality.claimsOf
            [ "paradigm shift synergy", 1L
              "holistic transformation pipeline", 1L ]
    let looksGrounded (s: string) =
        // Very coarse predicate: concrete verbs / quantitative language.
        s.Contains("cancels") || s.Contains("algebra") || s.Contains("=")
    let runOne (text: string) (claims: ZSet<string>) =
        [ SignalQuality.compressionMeasure.Measure text
          (SignalQuality.groundingMeasure looksGrounded).Measure claims
          SignalQuality.consistencyMeasure.Measure claims ]
        |> SignalQuality.composite SignalQuality.uniformWeights
    let structuredScore = runOne structured claimsStructured
    let fluffScore = runOne fluff claimsFluff
    // Fluff should score strictly more suspicious than the structured
    // prose. This is the load-bearing end-to-end behaviour.
    fluffScore.Composite |> should be (greaterThan structuredScore.Composite)
