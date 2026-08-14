module Zeta.Bayesian.Tests.MultilayerBnn

open Xunit
open Zeta.Bayesian

let private unwrap = function Ok v -> v | Error e -> failwith e

let private prior = Gaussian.ofMeanVariance 0.0 1.0
let private variance = 0.5

/// An INDEPENDENT exact reference for the `Sequential` chain: build the joint
/// precision matrix over (x_0 .. x_(n-1)) and invert it by Gauss-Jordan. The
/// factors are the per-layer priors, `k` copies of the data likelihood at layer
/// 0, and one coupling per link. Sum-product on a tree must agree with this to
/// machine precision — that agreement is the falsifier for the message passing,
/// not a self-consistency check.
let private exactChainMarginals
    (priorTau: float array)
    (priorNu: float array)
    (obsVar: float array)
    (k: int)
    (y: float)
    : float array * float array =
    let n = priorTau.Length
    let lam = Array2D.zeroCreate n n
    let h = Array.zeroCreate n
    for i in 0 .. n - 1 do
        lam.[i, i] <- priorTau.[i]
        h.[i] <- priorNu.[i]
    let dataPrec = 1.0 / obsVar.[0]
    lam.[0, 0] <- lam.[0, 0] + float k * dataPrec
    h.[0] <- h.[0] + float k * y * dataPrec
    for i in 1 .. n - 1 do
        let c = 1.0 / obsVar.[i]
        lam.[i, i] <- lam.[i, i] + c
        lam.[i - 1, i - 1] <- lam.[i - 1, i - 1] + c
        lam.[i - 1, i] <- lam.[i - 1, i] - c
        lam.[i, i - 1] <- lam.[i, i - 1] - c
    let a = Array2D.init n (2 * n) (fun i j -> if j < n then lam.[i, j] elif j - n = i then 1.0 else 0.0)
    for col in 0 .. n - 1 do
        let mutable piv = col
        for r in col .. n - 1 do
            if abs a.[r, col] > abs a.[piv, col] then piv <- r
        if piv <> col then
            for j in 0 .. 2 * n - 1 do
                let t = a.[col, j]
                a.[col, j] <- a.[piv, j]
                a.[piv, j] <- t
        let d = a.[col, col]
        for j in 0 .. 2 * n - 1 do
            a.[col, j] <- a.[col, j] / d
        for r in 0 .. n - 1 do
            if r <> col then
                let f = a.[r, col]
                for j in 0 .. 2 * n - 1 do
                    a.[r, j] <- a.[r, j] - f * a.[col, j]
    let means = Array.init n (fun i -> Array.init n (fun j -> a.[i, j + n] * h.[j]) |> Array.sum)
    let vars = Array.init n (fun i -> a.[i, i + n])
    means, vars

// -- Construction ---------------------------------------------------------------

[<Fact>]
let ``MLBNN-1: tryCreate returns Ok for valid inputs`` () =
    let result = MultilayerBnn.tryCreateUniform 3 prior variance
    Assert.True(result |> Result.isOk)

[<Fact>]
let ``MLBNN-2: tryCreate returns Error for mismatched array lengths`` () =
    let result = MultilayerBnn.tryCreate [| prior; prior |] [| variance |] MultilayerBnn.Sequential
    Assert.True(result |> Result.isError)

[<Fact>]
let ``MLBNN-3: tryCreate returns Error for zero layers`` () =
    let result = MultilayerBnn.tryCreateUniform 0 prior variance
    Assert.True(result |> Result.isError)

[<Fact>]
let ``MLBNN-4: network has correct depth`` () =
    let net = MultilayerBnn.tryCreateUniform 5 prior variance |> unwrap
    Assert.Equal(5, net.Layers.Length)

// -- Forward pass ---------------------------------------------------------------

[<Fact>]
let ``MLBNN-5: forward pass updates all layers`` () =
    let net = MultilayerBnn.tryCreateUniform 3 prior variance |> unwrap
    let result = MultilayerBnn.forward 1.0 net
    Assert.True(result |> Result.isOk)
    let (after, _) = result |> unwrap
    // Every layer processed the observation exactly once.
    for layer in after.Layers do
        Assert.Equal(1, layer.Objective.ObservationCount)

[<Fact>]
let ``MLBNN-6: forward pass increases IV`` () =
    let net = MultilayerBnn.tryCreateUniform 3 prior variance |> unwrap
    let (after, _) = MultilayerBnn.forward 1.0 net |> unwrap
    Assert.True(MultilayerBnn.cumulativeIv after > 0.0<InformationValue.iv>)

[<Fact>]
let ``MLBNN-7: output mean moves toward observation after forward pass`` () =
    let net = MultilayerBnn.tryCreateUniform 1 prior variance |> unwrap
    let (after, _) = MultilayerBnn.forward 5.0 net |> unwrap
    // Prior mean = 0.0; after observing 5.0, posterior mean should be > 0.0
    Assert.True(MultilayerBnn.outputMean after > 0.0)

// -- Backward pass ----------------------------------------------------------------

[<Fact>]
let ``MLBNN-8: backward pass does not error on valid network`` () =
    let net = MultilayerBnn.tryCreateUniform 3 prior variance |> unwrap
    let (after, _) = MultilayerBnn.forward 1.0 net |> unwrap
    let result = MultilayerBnn.backward after
    Assert.True(result |> Result.isOk)

[<Fact>]
let ``MLBNN-9: update (forward+backward) is monotone in IV`` () =
    let net = MultilayerBnn.tryCreateUniform 2 prior variance |> unwrap
    let net1 = MultilayerBnn.update 1.0 net |> unwrap
    let net2 = MultilayerBnn.update 2.0 net1 |> unwrap
    Assert.True(MultilayerBnn.cumulativeIv net2 >= MultilayerBnn.cumulativeIv net1)

// -- Infer --------------------------------------------------------------------------

[<Fact>]
let ``MLBNN-10: a depth-1 network converges to the observed value`` () =
    // Depth 1 is the only depth at which the output is asked to track the data
    // without a second layer prior pulling on it. See MLBNN-20 for what depth
    // does and MLBNN-22 for why.
    let net = MultilayerBnn.tryCreateUniform 1 prior variance |> unwrap
    let obs = seq { for _ in 1..10 -> 2.0 }
    let result = MultilayerBnn.infer obs net
    Assert.True(result |> Result.isOk)
    let after = result |> unwrap
    let mean = MultilayerBnn.outputMean after
    Assert.True(mean > 1.0 && mean < 3.0, sprintf "depth-1 mean was %.6f" mean)

// -- Skip connections ---------------------------------------------------------------

[<Fact>]
let ``MLBNN-11: skip connection network creates successfully`` () =
    let topology = MultilayerBnn.SkipConnections [ (0, 2) ]
    let result = MultilayerBnn.tryCreate [| prior; prior; prior |] [| variance; variance; variance |] topology
    Assert.True(result |> Result.isOk)

[<Fact>]
let ``MLBNN-12: skip connection network forward pass completes`` () =
    let topology = MultilayerBnn.SkipConnections [ (0, 2) ]
    let net = MultilayerBnn.tryCreate [| prior; prior; prior |] [| variance; variance; variance |] topology |> unwrap
    let result = MultilayerBnn.forward 1.0 net
    Assert.True(result |> Result.isOk)

[<Fact>]
let ``MLBNN-13: toJsonString produces valid JSON structure`` () =
    let net = MultilayerBnn.tryCreateUniform 2 prior variance |> unwrap
    let json = MultilayerBnn.toJsonString net
    Assert.Contains("\"layers\"", json)
    Assert.Contains("\"topology\"", json)
    Assert.Contains("\"mu\"", json)
    Assert.Contains("\"sigma2\"", json)

[<Fact>]
let ``MLBNN-14: toJsonString after update contains obsCount=1`` () =
    let net = MultilayerBnn.tryCreateUniform 2 prior variance |> unwrap
    let after = MultilayerBnn.update 1.0 net |> unwrap
    let json = MultilayerBnn.toJsonString after
    Assert.Contains("\"obsCount\":1", json)

// -- B1 regression: the EP cavity step must HAVE AN EFFECT ---------------------------
//
// Before the message-passing fix, `backward` computed cavityPrec = P - L and then
// newPosteriorPrec = cavityPrec + L, i.e. the identity, because a layer holds only
// prior x likelihood and so its cavity IS its prior. Output was bit-identical at
// depths 1, 2, 3 and 5. These tests are written against API that already existed,
// so they turn RED on the pre-fix module rather than merely failing to compile.

[<Fact>]
let ``MLBNN-15: backward pass changes the network (the cavity is not the identity)`` () =
    let net = MultilayerBnn.tryCreateUniform 3 prior 1.0 |> unwrap
    let (afterForward, _) = MultilayerBnn.forward 10.0 net |> unwrap
    let afterBackward = MultilayerBnn.backward afterForward |> unwrap
    Assert.NotEqual<string>(
        MultilayerBnn.toJsonString afterForward,
        MultilayerBnn.toJsonString afterBackward)

[<Fact>]
let ``MLBNN-16: backward pass is idempotent`` () =
    let net = MultilayerBnn.tryCreateUniform 5 prior 1.0 |> unwrap
    let (afterForward, _) = MultilayerBnn.forward 10.0 net |> unwrap
    let once = MultilayerBnn.backward afterForward |> unwrap
    let twice = MultilayerBnn.backward once |> unwrap
    Assert.Equal<string>(MultilayerBnn.toJsonString once, MultilayerBnn.toJsonString twice)

[<Fact>]
let ``MLBNN-17: forward+backward equals the exact chain marginals`` () =
    // The falsifier. On a Sequential chain (a tree) sum-product is exact, so the
    // module must agree with an independent dense solve of the joint precision
    // matrix. Machine precision, not a tolerance chosen to pass.
    for depth in [ 1; 2; 3; 4; 6; 10 ] do
        let net = MultilayerBnn.tryCreateUniform depth prior 1.0 |> unwrap
        let after = MultilayerBnn.infer (Seq.replicate 10 10.0) net |> unwrap
        let means, vars =
            exactChainMarginals (Array.create depth 1.0) (Array.create depth 0.0) (Array.create depth 1.0) 10 10.0
        let gotMean = MultilayerBnn.outputMean after
        let gotVar = MultilayerBnn.outputVariance after
        Assert.True(
            abs (gotMean - means.[depth - 1]) < 1e-9,
            sprintf "depth %d mean: got %.12g, exact %.12g" depth gotMean means.[depth - 1])
        Assert.True(
            abs (gotVar - vars.[depth - 1]) < 1e-9,
            sprintf "depth %d variance: got %.12g, exact %.12g" depth gotVar vars.[depth - 1])

// -- B2 regression: confidence must depend on depth ----------------------------------

[<Fact>]
let ``MLBNN-18: output precision depends on depth`` () =
    // The B2 tell was a precision of exactly 11.0 at every depth from 1 to 10:
    // the layer below handed down a point estimate and its variance was dropped,
    // so depth cost nothing in confidence while it cost almost everything in the
    // mean. A deep agent could then be 33 sigma from truth at full stated
    // confidence, which is invisible to a society that reads only confidence.
    let precisionAt depth =
        let net = MultilayerBnn.tryCreateUniform depth prior 1.0 |> unwrap
        let after = MultilayerBnn.infer (Seq.replicate 10 10.0) net |> unwrap
        (MultilayerBnn.outputPosterior after).Precision
    let p1 = precisionAt 1
    let p3 = precisionAt 3
    let p10 = precisionAt 10
    Assert.True(p3 < p1, sprintf "depth 3 precision %.6f was not below depth 1 precision %.6f" p3 p1)
    Assert.True(p10 < p3, sprintf "depth 10 precision %.6f was not below depth 3 precision %.6f" p10 p3)

[<Fact>]
let ``MLBNN-19: only layer 0 accumulates evidence`` () =
    // Deeper layers see the data through a MESSAGE, which is recomputed each
    // sweep. Accumulating it into a per-layer likelihood product is how one
    // observation gets counted once per layer.
    let net = MultilayerBnn.tryCreateUniform 4 prior 1.0 |> unwrap
    let after = MultilayerBnn.infer (Seq.replicate 10 10.0) net |> unwrap
    Assert.True(
        after.Layers.[0].LikelihoodProduct.Precision > 0.0,
        "layer 0 must accumulate the data likelihood")
    for i in 1 .. after.Layers.Length - 1 do
        Assert.Equal(0.0, after.Layers.[i].LikelihoodProduct.Precision)
        Assert.Equal(0.0, after.Layers.[i].LikelihoodProduct.PrecisionMean)

// -- B2 attribution: what depth does, and why ---------------------------------------

[<Fact>]
let ``MLBNN-20: depth attenuates the mean under proper per-layer priors`` () =
    // Characterisation, not a defect. Every layer carries its own N(0,1) prior,
    // so every hop shrinks the mean toward zero. This is what the model says;
    // MLBNN-22 shows the same code preserving the mean once the prior stops
    // saying it.
    let meanAt depth =
        let net = MultilayerBnn.tryCreateUniform depth prior 1.0 |> unwrap
        let after = MultilayerBnn.infer (Seq.replicate 10 10.0) net |> unwrap
        MultilayerBnn.outputMean after
    Assert.True(meanAt 2 < meanAt 1)
    Assert.True(meanAt 3 < meanAt 2)
    Assert.True(meanAt 10 < meanAt 3)

[<Fact>]
let ``MLBNN-21: the deep-chain variance is the Riccati fixed point`` () =
    // With unit prior precision and unit link variance the steady-state variance
    // v solves v = (v+1)/(v+2), i.e. v^2 + v - 1 = 0, so v = (sqrt 5 - 1)/2 and
    // the precision is the golden ratio. This is the scalar steady-state Riccati
    // solution of the Kalman recursion (Kalman 1960) — structure, not a matching
    // decimal: the equation is derived from the model, and the measurement lands
    // on its root.
    let net = MultilayerBnn.tryCreateUniform 24 prior 1.0 |> unwrap
    let after = MultilayerBnn.infer (Seq.replicate 10 10.0) net |> unwrap
    let expected = (sqrt 5.0 - 1.0) / 2.0
    let got = MultilayerBnn.outputVariance after
    Assert.True(abs (got - expected) < 1e-9, sprintf "steady-state variance: got %.12g, expected %.12g" got expected)

[<Fact>]
let ``MLBNN-22: with near-flat deeper priors the mean survives and the variance grows`` () =
    // Same code, same data, different prior: the attenuation in MLBNN-20 is the
    // PRIOR, not the arithmetic. A relay chain preserves the mean and accumulates
    // exactly one link variance per hop.
    let build depth =
        let priors =
            Array.init depth (fun i ->
                if i = 0 then Gaussian.ofMeanVariance 0.0 1.0 else Gaussian.ofMeanVariance 0.0 1e6)
        MultilayerBnn.tryCreate priors (Array.create depth 1.0) MultilayerBnn.Sequential |> unwrap
    let run depth =
        let after = MultilayerBnn.infer (Seq.replicate 10 10.0) (build depth) |> unwrap
        MultilayerBnn.outputMean after, MultilayerBnn.outputVariance after
    let m1, v1 = run 1
    let m4, v4 = run 4
    Assert.True(abs (m4 - m1) < 1e-3, sprintf "mean drifted from %.6f to %.6f" m1 m4)
    Assert.True(abs (v4 - (v1 + 3.0)) < 1e-3, sprintf "variance %.6f is not %.6f plus three link variances" v4 v1)
