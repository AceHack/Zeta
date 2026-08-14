module Zeta.Tests.HeavyTailFoldTests

open System
open Xunit
open Zeta.Bayesian
open Zeta.Bayesian.BoundJustification
open Zeta.Bayesian.HeavyTailFold

// -- What these tests are for -------------------------------------------------------------------
// B3(a) is the half of the double-counting work that was deliberately deferred: an overconfident
// member annihilating a correct one. B3(b) (`Attested`) was its precondition and has landed.
//
//   HT-1  a POINT tail index is not constructible. That is the operation the defect required and
//         the operation this module removes, so it is the first thing a falsifier should attack.
//   HT-2  the defect, reproduced exactly (joint mean 0.009990), and the robust fold refusing it.
//         At N=2 there is no majority and no `nu` creates one.
//   HT-3  `nu` SELECTS the verdict. The measured flip at nu* is why 4.0-with-a-comment is a vote.
//   HT-4  narrow the assumption and the correct member survives -- with an honest precision.
//   HT-5  agreement is unimodal and publishes, so the module is not merely a refusal machine.
//   HT-6  route 1: inference refuses at society scale and succeeds at O(100) atoms.
//   HT-7  the two registers, and that a declared interval reports itself unchecked.
//   HT-8  order invariance -- the fold must agree with the join it sits on (`Attested`).
//   HT-9  the coverage falsifier separates a defensible interval from an indefensible one.

/// The exact B3(a) configuration from the 2026-08-13 factor-graph design note.
let private modest = { Location = 10.0; ClaimedPrecision = 1.0 }
let private overconfident = { Location = 0.0; ClaimedPrecision = 1000.0 }
let private b3a = [ modest; overconfident ]

/// Five members agreeing, one overconfident dissenter: a quorum exists.
let private quorum = List.replicate 5 modest @ [ overconfident ]

// -- HT-1: a point tail index is not constructible ----------------------------------------------
// The defect required "read one `nu`, return a verdict". Removing the operation means the point
// value cannot be authored at all -- not that it is discouraged in a comment.

[<Fact>]
let ``HT-1a a point tail interval is refused`` () =
    Assert.Throws<ArgumentException>(fun () -> Tail.declare "the shipped default" 4.0 4.0 |> ignore)
    |> ignore

[<Fact>]
let ``HT-1b an inverted tail interval is refused`` () =
    Assert.Throws<ArgumentException>(fun () -> Tail.declare "backwards" 10.0 3.0 |> ignore) |> ignore

[<Fact>]
let ``HT-1c a non-positive lower endpoint is refused`` () =
    Assert.Throws<ArgumentException>(fun () -> Tail.declare "zero df" 0.0 10.0 |> ignore) |> ignore

[<Fact>]
let ``HT-1d a proper interval is constructible and reports its endpoints`` () =
    let i = Tail.declare "worked example" 3.0 15.0
    Assert.Equal(3.0, i.Lo, 12)
    Assert.Equal(15.0, i.Hi, 12)

// -- HT-2: the defect, and the refusal that replaces it -----------------------------------------

[<Fact>]
let ``HT-2a the Gaussian fold still annihilates the correct member`` () =
    // This is the defect, kept as a live measurement rather than a remembered number. If the
    // exponential-family product ever stops doing this, the premise of the module has changed.
    let joint =
        b3a
        |> List.map (fun a -> Gaussian.ofMeanVariance a.Location (1.0 / a.ClaimedPrecision))
        |> List.fold Gaussian.product Gaussian.uniform

    Assert.Equal(0.009990, Gaussian.mean joint, 6)
    Assert.Equal(1001.0, joint.Precision, 6)

[<Fact>]
let ``HT-2b at N=2 the robust fold refuses for want of a quorum`` () =
    // Not "the t fold gets it right". It cannot: the overconfident member's mode WINS on
    // likelihood (a claimed precision of 1000 makes its peak sqrt(1000) times taller). The
    // honest output is a refusal naming the missing majority.
    match fold (Tail.declare "no measurement available" 3.0 infinity) b3a with
    | NoQuorum(_, atomCount, basinSizes) ->
        Assert.Equal(2, atomCount)
        Assert.Equal<int list>([ 1; 1 ], List.sortDescending basinSizes)
    | other -> failwithf "expected NoQuorum, got %A" other

[<Fact>]
let ``HT-2c the wrong mode really is the likelihood winner at N=2`` () =
    // The reason HT-2b must refuse rather than pick. Stated as a measurement so that a future
    // "just take the argmax" patch fails here instead of shipping.
    let ms = modesAt 4.0 b3a
    Assert.Equal(2, ms.Length)
    Assert.True(abs (List.head ms).Theta < 1.0, "the overconfident mode wins on likelihood")
    Assert.True((List.head ms).LogLikelihood - (List.item 1 ms).LogLikelihood > 10.0)

// -- HT-3: `nu` selects the verdict -------------------------------------------------------------

[<Fact>]
let ``HT-3a an unnarrowed tail assumption yields a tail-dependent refusal`` () =
    // "Somewhere between nu=4 and Gaussian" is the honest statement of not knowing, and it is
    // exactly the statement under which this society has no supported answer.
    match fold (Tail.declare "4 to Gaussian, unmeasured" 4.0 infinity) quorum with
    | TailDependent(criticalNu, thetaBelow, thetaAbove) ->
        Assert.InRange(criticalNu, 20.0, 27.0)
        Assert.InRange(thetaBelow, 9.0, 10.1)
        Assert.InRange(thetaAbove, -0.1, 1.0)
    | other -> failwithf "expected TailDependent, got %A" other

[<Fact>]
let ``HT-3b the two answers on either side of the critical nu are different members`` () =
    // The measured flip: below nu* the society answers the quorum (~9.9), above it the loudest
    // member (~0.01). A shipped point value casts this vote silently.
    let below = modesAt 20.0 quorum |> List.head
    let above = modesAt 30.0 quorum |> List.head
    Assert.InRange(below.Theta, 9.0, 10.1)
    Assert.InRange(above.Theta, -0.1, 1.0)

// -- HT-4: narrowed assumption, correct member survives, honest precision ------------------------

[<Fact>]
let ``HT-4 a narrowed interval publishes the quorum answer with an honest precision`` () =
    match fold (Tail.declare "tails heavier than nu=15, from calibration" 3.0 15.0) quorum with
    | Located(theta, precision, ess) ->
        // the correct member survives instead of being annihilated
        Assert.InRange(theta, 9.5, 10.1)
        // and the society is NOT 1001-confident. Observed information at the mode counts the
        // rejected member NEGATIVELY, so the published precision is order-of-the-quorum, not
        // order-of-the-loudest-claim.
        Assert.InRange(precision, 3.0, 12.0)
        Assert.InRange(ess, 4.0, 5.2)
    | other -> failwithf "expected Located, got %A" other

[<Fact>]
let ``HT-4b the rejected member SUBTRACTS observed information`` () =
    // The redescending property, on the confidence axis rather than the location axis. An atom
    // the fold has rejected is not merely ignored: it makes the answer less certain.
    let m = modesAt 4.0 quorum |> List.find (fun m -> m.Theta > 5.0)
    let withoutDissenter = modesAt 4.0 (List.replicate 5 modest) |> List.head
    Assert.True(
        m.Precision < withoutDissenter.Precision,
        "a rejected outlier must not increase the published precision"
    )

// -- HT-5: agreement publishes (the module is not merely a refusal machine) ----------------------

[<Fact>]
let ``HT-5 members that agree fold to one mode and publish`` () =
    let agreeing =
        [ { Location = 10.0; ClaimedPrecision = 1.0 }
          { Location = 10.2; ClaimedPrecision = 1.0 }
          { Location = 9.8; ClaimedPrecision = 1.0 }
          { Location = 10.1; ClaimedPrecision = 1.0 }
          { Location = 9.9; ClaimedPrecision = 1.0 }
          { Location = 10.6; ClaimedPrecision = 1.0 } ]

    match fold (Tail.declare "unnarrowed" 3.0 infinity) agreeing with
    | Located(theta, precision, ess) ->
        Assert.InRange(theta, 9.8, 10.4)
        Assert.True(precision > 0.0)
        Assert.InRange(ess, 4.5, 6.0)
    | other -> failwithf "expected Located, got %A" other

// -- HT-8: order invariance ---------------------------------------------------------------------

[<Fact>]
let ``HT-8 the verdict does not depend on the order the atoms arrived in`` () =
    // `Attested` is a join-semilattice: order and grouping invariant. A fold sitting on top of it
    // that reordered its answer would break the interface it consumes.
    let interval = Tail.declare "unnarrowed" 3.0 infinity
    let forward = fold interval quorum
    let reversed = fold interval (List.rev quorum)
    let shuffled = fold interval (overconfident :: List.replicate 5 modest)

    match forward, reversed, shuffled with
    | Located(a, pa, _), Located(b, pb, _), Located(c, pc, _) ->
        Assert.Equal(a, b, 9)
        Assert.Equal(a, c, 9)
        Assert.Equal(pa, pb, 9)
        Assert.Equal(pa, pc, 9)
    | TailDependent(a, _, _), TailDependent(b, _, _), TailDependent(c, _, _) ->
        Assert.Equal(a, b, 6)
        Assert.Equal(a, c, 6)
    | f, r, s -> failwithf "verdict depends on order: %A / %A / %A" f r s

// -- deterministic sampling for the inference tests ---------------------------------------------
// A fixed-seed xorshift, so these tests are DST-replayable and do not depend on the platform RNG.

let private sampleT (nu: float) (count: int) (seed: uint64) : float list =
    let mutable st = seed
    let nextU () =
        st <- st ^^^ (st <<< 13)
        st <- st ^^^ (st >>> 7)
        st <- st ^^^ (st <<< 17)
        float (st >>> 11) / float (1UL <<< 53)

    let nextNormal () =
        let mutable u = 0.0
        let mutable v = 0.0
        let mutable s = 0.0
        let mutable go = true
        while go do
            u <- 2.0 * nextU () - 1.0
            v <- 2.0 * nextU () - 1.0
            s <- u * u + v * v
            if s > 0.0 && s < 1.0 then go <- false
        u * sqrt (-2.0 * log s / s)

    // chi-square with nu df as a sum of squared normals (nu integral here, which is all the
    // tests need and avoids a gamma sampler whose rejection loop would be seed-fragile)
    let chi2 () =
        let k = int (round nu)
        Seq.init k (fun _ -> let z = nextNormal () in z * z) |> Seq.sum

    List.init count (fun _ -> nextNormal () / sqrt (chi2 () / nu))

// -- HT-6: route 1 -- inference refuses at society scale, succeeds at O(100) atoms ---------------

[<Fact>]
let ``HT-6a inference refuses with two atoms`` () =
    match tryInfer b3a with
    | Error(TooFewAtomsToInfer n) -> Assert.Equal(2, n)
    | other -> failwithf "expected TooFewAtomsToInfer, got %A" other

[<Fact>]
let ``HT-6b inference has no power at society scale`` () =
    // The measured fact the module header records. This is deliberately a RATE and not a single
    // seed: at N=6 the boundary LRT rejects about as often as its own 5% size, so any individual
    // run may reject by luck. Asserting on one lucky seed would be a test that agrees with the
    // module for the wrong reason. The honest falsifier is that the rate stays near the size --
    // if inference ever became usable at N=6 this test SHOULD fail and the gate should open.
    let replicates = 80

    let accepted =
        [ for k in 0 .. replicates - 1 ->
            sampleT 3.0 6 (0x2545F4914F6CDD1DUL + 0x9E3779B97F4A7C15UL * uint64 k)
            |> List.map (fun y -> { Location = y; ClaimedPrecision = 1.0 })
            |> tryInfer ]
        |> List.filter Result.isOk
        |> List.length

    let rate = float accepted / float replicates
    Assert.True(rate < 0.25, sprintf "N=6 inference accepted %.3f of the time; expected near its 5%% size" rate)

[<Fact>]
let ``HT-6c inference succeeds at O(100) atoms and carries the Measurement register`` () =
    let atoms =
        sampleT 3.0 400 0x9E3779B97F4A7C15UL
        |> List.map (fun y -> { Location = y; ClaimedPrecision = 1.0 })

    match tryInfer atoms with
    | Ok interval ->
        Assert.True(interval.Hi > interval.Lo, "an inferred interval is never a point")
        Assert.True(interval.IsChecked, "an inferred interval is Measurement, hence checked")
        match interval.Why with
        | Measurement(quantity, over) ->
            Assert.Contains("nu", quantity)
            Assert.Contains("400", over)
        | other -> failwithf "expected a Measurement justification, got %A" other
        // and the interval covers the truth it was generated from
        Assert.True(interval.Lo <= 3.0 && 3.0 <= interval.Hi)
    | Error e -> failwithf "expected an interval at N=400, got %A" e

// -- HT-7: the two registers --------------------------------------------------------------------

[<Fact>]
let ``HT-7a a declared interval reports itself unchecked and names its reason`` () =
    // A guess stays legal. It stops being silent. Same boundary `BoundJustification` draws.
    let i = Tail.declare "robust but not too heavy-tailed" 3.0 8.0
    Assert.False(i.IsChecked)
    match i.Why with
    | Assumption reason -> Assert.Equal("robust but not too heavy-tailed", reason)
    | other -> failwithf "expected an Assumption, got %A" other

[<Fact>]
let ``HT-7b a derived interval is available for when a proof lands`` () =
    let i =
        Tail.declareWith (Derivation("tail index bounded by the channel model", "docs/none-yet.md")) 3.0 8.0
    Assert.True(i.IsChecked)

// -- HT-9: the falsifier a declared interval must carry -----------------------------------------

[<Fact>]
let ``HT-9 coverage falsifies a tail assumption that is too light`` () =
    // The point of route 2. A declared tail is permitted; a declared tail nobody checked is not,
    // and this is the check. Six members whose errors are genuinely t_2 -- heavy -- each claiming
    // a precision consistent with a unit scale. The declared tail is then varied from heavy to
    // near-Gaussian, and the fold's own 90% interval is scored against the truth it never saw.
    //
    // Measured, nominal 0.90:   [2,6] -> 0.864   [8,20] -> 0.814   [200,2000] -> 0.667
    //                           [5000,50000] -> 0.583
    //
    // Monotone, and the near-Gaussian declaration loses a THIRD of its nominal coverage. That is
    // what makes `Assumption` an honest register rather than a loophole: the assumption is cheap
    // to state and this check will still catch it if it is wrong.
    let cases =
        [ for k in 0..59 ->
            let truth = float k * 0.25
            let errors = sampleT 2.0 6 (0xD1B54A32D192ED03UL + uint64 k)
            (errors |> List.map (fun e -> { Location = truth + e; ClaimedPrecision = 1.0 })), truth ]

    let empiricalFor lo hi =
        let _, empirical, published, _ =
            coverage (Tail.declare "declared for the coverage check" lo hi) 1.645 0.90 cases
        Assert.True(published > 40, "the declared interval must actually publish on most cases")
        empirical

    let heavy = empiricalFor 2.0 6.0
    let mid = empiricalFor 8.0 20.0
    let light = empiricalFor 200.0 2000.0
    let nearGaussian = empiricalFor 5000.0 50000.0

    // a defensible tail assumption is close to its nominal level
    Assert.InRange(heavy, 0.80, 0.97)
    // and lightening the declared tail monotonically destroys coverage
    Assert.True(mid <= heavy, sprintf "mid %f should not beat heavy %f" mid heavy)
    Assert.True(light <= mid, sprintf "light %f should not beat mid %f" light mid)
    Assert.True(nearGaussian <= light, sprintf "gaussian %f should not beat light %f" nearGaussian light)
    // and the near-Gaussian declaration is falsified outright
    Assert.True(nearGaussian < 0.75, sprintf "a near-Gaussian tail claim must be falsified, got %f" nearGaussian)
