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

// ── Dag: the general topology the other two are special cases of ────────────
//
// THE FALSIFIER FOR THE GENERALISATION, and the reason it is byte-identity
// rather than "close enough". `Sequential` and `SkipConnections` are now read
// through `parentsOf` like every other case, so a `Dag` spelling out the SAME
// parents must produce the SAME numbers — not approximately, exactly. Anything
// short of bit equality means the rewrite changed the model while the tests
// went on passing, which is the failure this whole row exists to avoid.

let private bits (x: float) : int64 = System.BitConverter.DoubleToInt64Bits x

let private assertBitIdentical (label: string) (a: MultilayerBnn.Network) (b: MultilayerBnn.Network) =
    Assert.Equal(a.Layers.Length, b.Layers.Length)
    for i in 0 .. a.Layers.Length - 1 do
        let pa = MultilayerBnn.beliefAt a i
        let pb = MultilayerBnn.beliefAt b i
        Assert.True(
            bits pa.Precision = bits pb.Precision
            && bits pa.PrecisionMean = bits pb.PrecisionMean,
            sprintf
                "%s: layer %d differs — (tau=%.17g, nu=%.17g) vs (tau=%.17g, nu=%.17g)"
                label i pa.Precision pa.PrecisionMean pb.Precision pb.PrecisionMean)

[<Fact>]
let ``MLBNN-23: a Dag spelling out a chain is bit-identical to Sequential`` () =
    let depth = 4
    let priors = Array.init depth (fun i -> Gaussian.ofMeanVariance (float i * 0.25) 1.0)
    let variances = Array.init depth (fun i -> 0.5 + float i * 0.1)
    let observations = [ 1.0; -0.5; 2.25; 0.75; -1.5 ]

    let chainParents = Array.init depth (fun i -> if i = 0 then [] else [ i - 1 ])
    let sequential =
        MultilayerBnn.tryCreate priors variances MultilayerBnn.Sequential |> unwrap
    let asDag =
        MultilayerBnn.tryCreate priors variances (MultilayerBnn.Dag chainParents) |> unwrap

    let a = MultilayerBnn.infer observations sequential |> unwrap
    let b = MultilayerBnn.infer observations asDag |> unwrap
    assertBitIdentical "Sequential vs Dag-chain" a b

[<Fact>]
let ``MLBNN-24: a Dag spelling out skips is bit-identical to SkipConnections`` () =
    let depth = 5
    let priors = Array.init depth (fun i -> Gaussian.ofMeanVariance (float i * 0.1) 1.0)
    let variances = Array.create depth 0.5
    let observations = [ 2.0; 0.5; -1.0; 3.0 ]
    let skips = [ (0, 2); (1, 4); (0, 4) ]

    // `parentsOf` puts the sequential parent first, then skips in declaration
    // order. The Dag must be written in that same order: Gaussian convolution is
    // associative in exact arithmetic and NOT bit-associative in floating point,
    // so a permuted parent list is a different computation in the last ulp — and
    // this test would catch that, which is the point of pinning bits.
    let dagParents =
        Array.init depth (fun i ->
            let seqParent = if i = 0 then [] else [ i - 1 ]
            let mine = skips |> List.choose (fun (f, t) -> if t = i then Some f else None)
            seqParent @ mine)

    let viaSkips =
        MultilayerBnn.tryCreate priors variances (MultilayerBnn.SkipConnections skips) |> unwrap
    let viaDag =
        MultilayerBnn.tryCreate priors variances (MultilayerBnn.Dag dagParents) |> unwrap

    let a = MultilayerBnn.infer observations viaSkips |> unwrap
    let b = MultilayerBnn.infer observations viaDag |> unwrap
    assertBitIdentical "SkipConnections vs Dag" a b

[<Fact>]
let ``MLBNN-25: parentsOf is the single interpreter and agrees across spellings`` () =
    let skips = [ (0, 2); (1, 3); (0, 3) ]
    let depth = 4
    for i in 0 .. depth - 1 do
        let fromSkips = MultilayerBnn.parentsOf (MultilayerBnn.SkipConnections skips) i
        let expected =
            (if i = 0 then [] else [ i - 1 ])
            @ (skips |> List.choose (fun (f, t) -> if t = i then Some f else None))
        Assert.Equal<int list>(expected, fromSkips)
        Assert.Equal<int list>(fromSkips, MultilayerBnn.parentsOf (MultilayerBnn.Dag (Array.init depth (fun j -> MultilayerBnn.parentsOf (MultilayerBnn.SkipConnections skips) j))) i)

[<Fact>]
let ``MLBNN-26: a Dag layer with no sequential parent is fed only by its declared parents`` () =
    // The case neither existing topology can express: layer 2's parent is layer
    // 0, and layer 1 does NOT feed it. Under `Sequential`/`SkipConnections` the
    // i-1 link is unconditional, so this wiring was unreachable before.
    let depth = 3
    let priors = Array.init depth (fun _ -> Gaussian.ofMeanVariance 0.0 1.0)
    let variances = Array.create depth 0.5
    let observations = [ 4.0; 4.0; 4.0 ]

    let bypass = MultilayerBnn.Dag [| []; [ 0 ]; [ 0 ] |]
    let chain = MultilayerBnn.Dag [| []; [ 0 ]; [ 1 ] |]
    let a = MultilayerBnn.infer observations (MultilayerBnn.tryCreate priors variances bypass |> unwrap) |> unwrap
    let b = MultilayerBnn.infer observations (MultilayerBnn.tryCreate priors variances chain |> unwrap) |> unwrap

    Assert.Equal<int list>([ 0 ], MultilayerBnn.parentsOf bypass 2)
    // Different wiring must give a different answer, or the parent set is being
    // ignored and `Dag` is decoration.
    let pa = MultilayerBnn.beliefAt a 2
    let pb = MultilayerBnn.beliefAt b 2
    Assert.True(
        bits pa.Precision <> bits pb.Precision || bits pa.PrecisionMean <> bits pb.PrecisionMean,
        sprintf "bypass and chain gave identical layer-2 beliefs (tau=%.17g, nu=%.17g)" pa.Precision pa.PrecisionMean)

[<Fact>]
let ``MLBNN-27: a parent named twice is summed in twice`` () =
    // `removeFirst` drops ONE occurrence of the cavity parent, not all of them,
    // and its docstring claims a duplicate therefore contributes twice. Nothing
    // pinned that: mutating `removeFirst` to drop every occurrence left all 425
    // tests green. This is the missing falsifier for a comment that was, until
    // now, an unchecked assertion about behaviour.
    let depth = 3
    let priors = Array.init depth (fun _ -> Gaussian.ofMeanVariance 0.0 1.0)
    let variances = Array.create depth 0.5
    let observations = [ 3.0; 3.0; 3.0 ]

    let once = MultilayerBnn.Dag [| []; [ 0 ]; [ 1 ] |]
    let twice = MultilayerBnn.Dag [| []; [ 0 ]; [ 1; 1 ] |]
    Assert.Equal<int list>([ 1; 1 ], MultilayerBnn.parentsOf twice 2)

    let a = MultilayerBnn.infer observations (MultilayerBnn.tryCreate priors variances once |> unwrap) |> unwrap
    let b = MultilayerBnn.infer observations (MultilayerBnn.tryCreate priors variances twice |> unwrap) |> unwrap
    let pa = MultilayerBnn.beliefAt a 2
    let pb = MultilayerBnn.beliefAt b 2
    Assert.True(
        bits pa.Precision <> bits pb.Precision || bits pa.PrecisionMean <> bits pb.PrecisionMean,
        sprintf
            "naming layer 1 twice changed nothing — the duplicate was silently collapsed (tau=%.17g, nu=%.17g)"
            pa.Precision pa.PrecisionMean)

// ── Factor-graph inference: the per-edge path ───────────────────────────────
//
// THE BAR IS NOT BIT-IDENTITY, and saying so matters. MLBNN-23/24 demand bits
// because re-spelling `Sequential` as a `Dag` runs the same arithmetic in the
// same order. Sum-product to a fixed point is a DIFFERENT algorithm computing
// the same mathematical quantity — it agrees to machine precision, and pinning
// bits there would pin an accident of the message schedule. So these check
// against `exactChainMarginals`, the independent Gauss-Jordan solve of the joint
// precision matrix that MLBNN-17 already uses.

[<Fact>]
let ``MLBNN-28: factor-graph marginals equal the exact chain marginals at EVERY layer`` () =
    // Stronger than MLBNN-17, which checks only the output layer. A chain is a
    // tree, so sum-product is exact at every node, and an error in one link
    // factor's backward message would hide behind an output-only assertion.
    for depth in [ 1; 2; 3; 4; 6; 10 ] do
        let net = MultilayerBnn.tryCreateUniform depth prior 1.0 |> unwrap
        let after = MultilayerBnn.infer (Seq.replicate 10 10.0) net |> unwrap
        let marginals, rounds, converged =
            MultilayerBnn.tryMarginalsViaFactorGraph 1e-12 200 after |> unwrap
        Assert.True(converged, sprintf "depth %d did not converge in %d rounds" depth rounds)
        let means, vars =
            exactChainMarginals (Array.create depth 1.0) (Array.create depth 0.0) (Array.create depth 1.0) 10 10.0
        for i in 0 .. depth - 1 do
            Assert.True(
                abs (Gaussian.mean marginals.[i] - means.[i]) < 1e-9,
                sprintf "depth %d layer %d mean: got %.12g, exact %.12g"
                    depth i (Gaussian.mean marginals.[i]) means.[i])
            Assert.True(
                abs (Gaussian.variance marginals.[i] - vars.[i]) < 1e-9,
                sprintf "depth %d layer %d variance: got %.12g, exact %.12g"
                    depth i (Gaussian.variance marginals.[i]) vars.[i])

[<Fact>]
let ``MLBNN-29: on a chain the two inference paths agree to machine precision`` () =
    // Both are exact on a tree, so they must meet. This is the test that says the
    // factor-graph path is a GENERALISATION of the sweeps and not a second,
    // differently-wrong model living beside them.
    let depth = 5
    let net = MultilayerBnn.tryCreateUniform depth prior 0.75 |> unwrap
    let after = MultilayerBnn.infer [ 1.0; -2.0; 0.5; 3.0 ] net |> unwrap
    let marginals, _, converged = MultilayerBnn.tryMarginalsViaFactorGraph 1e-12 200 after |> unwrap
    Assert.True(converged)
    for i in 0 .. depth - 1 do
        let sweep = MultilayerBnn.beliefAt after i
        Assert.True(
            abs (Gaussian.mean marginals.[i] - Gaussian.mean sweep) < 1e-9
            && abs (Gaussian.variance marginals.[i] - Gaussian.variance sweep) < 1e-9,
            sprintf "layer %d: factor graph (%.12g, %.12g) vs sweeps (%.12g, %.12g)"
                i (Gaussian.mean marginals.[i]) (Gaussian.variance marginals.[i])
                (Gaussian.mean sweep) (Gaussian.variance sweep))

[<Fact>]
let ``MLBNN-30: on a loopy topology the two paths DISAGREE, and by how much`` () =
    // The whole reason the factor-graph path exists. `MultilayerBnn`'s own
    // docstring says the skip case is "a first-order approximation rather than
    // the exact marginal" because the backward sweep only walks the sequential
    // links. Sum-product to a fixed point carries messages on every edge.
    //
    // The test NAMES the difference rather than asserting convergence, because
    // "it converged" is true of the wrong answer too.
    let depth = 4
    let priors = Array.init depth (fun _ -> Gaussian.ofMeanVariance 0.0 1.0)
    let variances = Array.create depth 1.0
    let loopy = MultilayerBnn.SkipConnections [ (0, 2); (0, 3); (1, 3) ]
    let net = MultilayerBnn.tryCreate priors variances loopy |> unwrap
    let after = MultilayerBnn.infer [ 5.0; 5.0; 5.0; 5.0 ] net |> unwrap
    let marginals, rounds, converged = MultilayerBnn.tryMarginalsViaFactorGraph 1e-12 500 after |> unwrap

    let gaps =
        [ 0 .. depth - 1 ]
        |> List.map (fun i ->
            let sweep = MultilayerBnn.beliefAt after i
            i, abs (Gaussian.mean marginals.[i] - Gaussian.mean sweep))
    let biggest = gaps |> List.maxBy snd
    Assert.True(
        snd biggest > 1e-6,
        sprintf
            "the two paths agreed on a LOOPY graph (max mean gap %.3g at layer %d) — either the skips are being ignored or the sweeps were exact after all; converged=%b rounds=%d"
            (snd biggest) (fst biggest) converged rounds)

[<Fact>]
let ``MLBNN-31: a repeated parent is REFUSED by the factor-graph path, not collapsed`` () =
    // MLBNN-27 pins that the sweeps sum a repeated parent in twice. `Factor` keys
    // its outgoing messages by variable id, so the factor-graph path cannot
    // express that and would silently deliver it once. Two inference paths
    // quietly disagreeing about the same network is worse than one refusing, so
    // it refuses.
    // TWO OFFENDING LAYERS, RUN SEPARATELY, because a single case cannot tell a
    // named layer from a hardcoded one. The original assertion here was
    // `Contains("2", e)` — a lone digit, satisfied by any count or index the
    // message happens to carry, and unable to notice the diagnostic dropping the
    // layer id altogether. The same one-character weakness made TB-9 pass on
    // "ta*b*le" for a while.
    let depth = 3
    let priors = Array.init depth (fun _ -> Gaussian.ofMeanVariance 0.0 1.0)
    let refuse (topology: MultilayerBnn.Topology) =
        let net = MultilayerBnn.tryCreate priors (Array.create depth 0.5) topology |> unwrap
        match MultilayerBnn.tryMarginalsViaFactorGraph 1e-12 100 net with
        | Ok _ -> failwith "a repeated parent was silently accepted by the factor-graph path"
        | Error e -> e

    let atLayer2 = refuse (MultilayerBnn.Dag [| []; [ 0 ]; [ 1; 1 ] |])
    Assert.Contains("more than once", atLayer2)
    Assert.Contains("layers 2", atLayer2)

    let atLayer1 = refuse (MultilayerBnn.Dag [| []; [ 0; 0 ]; [ 1 ] |])
    Assert.Contains("layers 1", atLayer1)
    Assert.DoesNotContain("layers 2", atLayer1)

/// An independent exact solve for the smallest MULTI-PARENT model: two layers
/// feeding one, `x2 = x0 + x1 + w`. Builds the 3x3 joint precision and inverts
/// it, the same method `exactChainMarginals` uses and deliberately not shared
/// with it — a reference that reuses the machinery under test stops being
/// independent, and this one has to check a structure the chain solver cannot
/// express.
///
/// The constraint contributes `(1/vn) * a a^T` with `a = (1, 1, -1)`: that is
/// just the quadratic form of `(x2 - x0 - x1)^2 / (2 vn)` read off as a
/// precision matrix.
let private exactSumMarginals
    (priorTau: float array)
    (priorNu: float array)
    (linkVariance: float)
    : float array * float array =
    let n = 3
    let a = [| 1.0; 1.0; -1.0 |]
    let lam = Array2D.init n n (fun i j -> (if i = j then priorTau.[i] else 0.0) + a.[i] * a.[j] / linkVariance)
    let h = Array.copy priorNu
    let m = Array2D.init n (2 * n) (fun i j -> if j < n then lam.[i, j] elif j - n = i then 1.0 else 0.0)
    for col in 0 .. n - 1 do
        let mutable piv = col
        for r in col .. n - 1 do
            if abs m.[r, col] > abs m.[piv, col] then piv <- r
        if piv <> col then
            for j in 0 .. 2 * n - 1 do
                let t = m.[col, j]
                m.[col, j] <- m.[piv, j]
                m.[piv, j] <- t
        let d = m.[col, col]
        for j in 0 .. 2 * n - 1 do
            m.[col, j] <- m.[col, j] / d
        for r in 0 .. n - 1 do
            if r <> col then
                let f = m.[r, col]
                for j in 0 .. 2 * n - 1 do
                    m.[r, j] <- m.[r, j] - f * m.[col, j]
    let means = Array.init n (fun i -> Array.init n (fun j -> m.[i, j + n] * h.[j]) |> Array.sum)
    let vars = Array.init n (fun i -> m.[i, i + n])
    means, vars

[<Fact>]
let ``MLBNN-32: a two-parent sum node matches the exact 3x3 solve at every layer`` () =
    // THE MULTI-PARENT BACKWARD MESSAGE, which nothing pinned. Break-red found
    // it: deleting the `deconvolve` that removes the OTHER addends from a
    // parent's incoming message left all 430 tests green, because every existing
    // multi-parent test was either a chain — where that fold is empty — or only
    // asserted that two paths disagree, which stays true when both are wrong.
    //
    // This graph is a TREE (three prior leaves and one sum factor, no cycle), so
    // sum-product is exact and an independent dense solve is the right judge.
    let priors = [| Gaussian.ofMeanVariance 2.0 0.5; Gaussian.ofMeanVariance -1.0 0.25; Gaussian.ofMeanVariance 0.0 4.0 |]
    let linkVariance = 0.8
    // Layer 2 is fed by BOTH 0 and 1; layer 1 is fed by nobody, so the sequential
    // link is genuinely absent — a wiring only `Dag` can express.
    let topology = MultilayerBnn.Dag [| []; []; [ 0; 1 ] |]
    let net =
        MultilayerBnn.tryCreate priors [| 1.0; 1.0; linkVariance |] topology |> unwrap
    let marginals, rounds, converged = MultilayerBnn.tryMarginalsViaFactorGraph 1e-13 500 net |> unwrap
    Assert.True(converged, sprintf "did not converge in %d rounds" rounds)

    let priorTau = priors |> Array.map (fun p -> p.Precision)
    let priorNu = priors |> Array.map (fun p -> p.PrecisionMean)
    let means, vars = exactSumMarginals priorTau priorNu linkVariance
    for i in 0 .. 2 do
        Assert.True(
            abs (Gaussian.mean marginals.[i] - means.[i]) < 1e-9,
            sprintf "layer %d mean: got %.12g, exact %.12g" i (Gaussian.mean marginals.[i]) means.[i])
        Assert.True(
            abs (Gaussian.variance marginals.[i] - vars.[i]) < 1e-9,
            sprintf "layer %d variance: got %.12g, exact %.12g" i (Gaussian.variance marginals.[i]) vars.[i])

/// Exact marginals for ANY parent structure, by dense inversion of the joint
/// precision matrix. The model is linear-Gaussian, so this is exact whether or
/// not the factor graph has loops — which is the point: sum-product being
/// approximate under loops says nothing about the truth being unavailable.
///
/// Each layer contributes its prior `(tau, nu)`. Each layer with parents adds
/// the constraint `x_i = sum(parents) + w`, whose quadratic form
/// `(x_i - sum parents)^2 / (2 v)` is the precision `(1/v) * a a^T` with
/// `a.[i] = -1` and `a.[p] = +1` for each parent.
let private exactDagMarginals
    (priorTau: float array)
    (priorNu: float array)
    (linkVariance: float array)
    (parentsOfLayer: int -> int list)
    : float array * float array =
    let n = priorTau.Length
    let lam = Array2D.init n n (fun i j -> if i = j then priorTau.[i] else 0.0)
    for i in 0 .. n - 1 do
        match parentsOfLayer i with
        | [] -> ()
        | ps ->
            let a = Array.zeroCreate n
            a.[i] <- a.[i] - 1.0
            for pIdx in ps do
                a.[pIdx] <- a.[pIdx] + 1.0
            for r in 0 .. n - 1 do
                for c in 0 .. n - 1 do
                    lam.[r, c] <- lam.[r, c] + a.[r] * a.[c] / linkVariance.[i]
    let h = Array.copy priorNu
    let m = Array2D.init n (2 * n) (fun i j -> if j < n then lam.[i, j] elif j - n = i then 1.0 else 0.0)
    for col in 0 .. n - 1 do
        let mutable piv = col
        for r in col .. n - 1 do
            if abs m.[r, col] > abs m.[piv, col] then piv <- r
        if piv <> col then
            for j in 0 .. 2 * n - 1 do
                let t = m.[col, j]
                m.[col, j] <- m.[piv, j]
                m.[piv, j] <- t
        let d = m.[col, col]
        for j in 0 .. 2 * n - 1 do
            m.[col, j] <- m.[col, j] / d
        for r in 0 .. n - 1 do
            if r <> col then
                let f = m.[r, col]
                for j in 0 .. 2 * n - 1 do
                    m.[r, j] <- m.[r, j] - f * m.[col, j]
    let means = Array.init n (fun i -> Array.init n (fun j -> m.[i, j + n] * h.[j]) |> Array.sum)
    let vars = Array.init n (fun i -> m.[i, i + n])
    means, vars

[<Fact>]
let ``MLBNN-33: on a loopy graph the factor-graph MEANS are exact and the sweeps' are not`` () =
    // MLBNN-30 established only that the two paths DISAGREE, which says nothing
    // about which is right — "different" is not "better". The model is
    // linear-Gaussian, so the true marginals exist and are computable by dense
    // inversion whether or not sum-product converges on the loops.
    //
    // MEASURED (4-layer net, skips (0,2) (0,3) (1,3), four observations of 5.0):
    //
    //     path          mean L1      variance L1
    //     factor graph  4.02e-14     0.227
    //     sweeps        2.075        0.316
    //
    // ANCHOR, AND IT IS CHECKED RATHER THAN CITED. Weiss & Freeman, "Correctness
    // of belief propagation in Gaussian graphical models of arbitrary topology"
    // (Neural Computation, 2001) proves that when Gaussian loopy BP converges,
    // the MEANS are exact and the variances are generally not. That is exactly
    // the pattern above: the means land at machine zero while the variances stay
    // wrong by 0.227. The theorem predicted the split before the number was
    // taken, which is what makes it an anchor rather than a decoration.
    //
    // So the honest claim is narrow and worth stating narrowly: the factor-graph
    // path buys EXACT MEANS on a loopy topology, better-but-still-wrong
    // variances, and no guarantee at all if it fails to converge.
    let depth = 4
    let priors = Array.init depth (fun _ -> Gaussian.ofMeanVariance 0.0 1.0)
    let variances = Array.create depth 1.0
    let loopy = MultilayerBnn.SkipConnections [ (0, 2); (0, 3); (1, 3) ]
    let net = MultilayerBnn.tryCreate priors variances loopy |> unwrap
    let after = MultilayerBnn.infer [ 5.0; 5.0; 5.0; 5.0 ] net |> unwrap
    let marginals, rounds, converged = MultilayerBnn.tryMarginalsViaFactorGraph 1e-13 1000 after |> unwrap
    Assert.True(converged, sprintf "loopy BP did not converge in %d rounds — the theorem's precondition fails" rounds)

    // Layer 0's "prior" in the exact model is the posterior the sweeps built,
    // because that is where the data was absorbed.
    let priorTau = Array.init depth (fun i -> after.Layers.[i].Posterior.Precision)
    let priorNu = Array.init depth (fun i -> after.Layers.[i].Posterior.PrecisionMean)
    let means, vars = exactDagMarginals priorTau priorNu variances (MultilayerBnn.parentsOf loopy)

    let err (get: int -> float) (truth: float array) =
        [ 0 .. depth - 1 ] |> List.sumBy (fun i -> abs (get i - truth.[i]))
    let fgMeanErr = err (fun i -> Gaussian.mean marginals.[i]) means
    let swMeanErr = err (fun i -> Gaussian.mean (MultilayerBnn.beliefAt after i)) means
    let fgVarErr = err (fun i -> Gaussian.variance marginals.[i]) vars
    let swVarErr = err (fun i -> Gaussian.variance (MultilayerBnn.beliefAt after i)) vars

    Assert.True(
        fgMeanErr < 1e-9,
        sprintf "factor-graph means are not exact on a converged Gaussian loopy graph: L1 %.6g" fgMeanErr)
    Assert.True(
        swMeanErr > 1.0,
        sprintf "the sweeps' means were accurate after all (L1 %.6g) — then the skip approximation this row exists to fix is not a real defect" swMeanErr)
    // Stated as a NON-claim: the variances are wrong on both paths, and the
    // factor graph's being smaller here is a measurement, not a guarantee.
    Assert.True(
        fgVarErr > 1e-6,
        sprintf "factor-graph variances came out exact (L1 %.6g) — Weiss & Freeman says they should not be, so either the graph is secretly a tree or the reference is wrong" fgVarErr)
    Assert.True(
        fgVarErr < swVarErr,
        sprintf "factor-graph variance error %.6g is not below the sweeps' %.6g" fgVarErr swVarErr)

// ── Idempotency (discipline #6) ─────────────────────────────────────────────

[<Fact>]
let ``MLBNN-34: the backward sweep is bit-idempotent on chains ONLY — multi-parent re-counts`` () =
    // MLBNN-16 already asserts backward-sweep idempotency, but compares through
    // `toJsonString`, which formats with `%.12g` — so a drift below the twelfth
    // significant figure passes it. Re-running a sweep must not move the state at
    // all, and "at all" is a bit comparison. This also covers `Dag`, which
    // MLBNN-16 predates.
    let cases =
        [ "Sequential", MultilayerBnn.Sequential
          "Dag-chain", MultilayerBnn.Dag [| []; [ 0 ]; [ 1 ]; [ 2 ]; [ 3 ] |]
          "Dag-skip", MultilayerBnn.Dag [| []; [ 0 ]; [ 1; 0 ]; [ 2 ]; [ 3; 1 ] |]
          "SkipConnections", MultilayerBnn.SkipConnections [ (0, 2); (1, 4) ] ]
    // Every case is measured before anything is asserted: a `for` loop that
    // throws on the first mismatch reports one topology and hides the rest, and
    // WHICH topologies drift is the whole diagnostic here.
    let drift =
        cases
        |> List.map (fun (name, topology) ->
            let priors = Array.init 5 (fun i -> Gaussian.ofMeanVariance (float i * 0.3) 1.0)
            let net = MultilayerBnn.tryCreate priors (Array.create 5 1.0) topology |> unwrap
            let afterForward, _ = MultilayerBnn.forward 10.0 net |> unwrap
            let once = MultilayerBnn.backward afterForward |> unwrap
            let twice = MultilayerBnn.backward once |> unwrap
            let worst =
                [ 0 .. 4 ]
                |> List.map (fun i ->
                    let a = MultilayerBnn.beliefAt once i
                    let b = MultilayerBnn.beliefAt twice i
                    max (abs (a.Precision - b.Precision)) (abs (a.PrecisionMean - b.PrecisionMean)))
                |> List.max
            name, worst)
    let report =
        drift |> List.map (fun (n, d) -> sprintf "%s=%.3g" n d) |> String.concat "  "
    let byName = dict drift
    // Chains are idempotent and must stay so.
    Assert.True(byName.["Sequential"] = 0.0, sprintf "Sequential lost idempotency: %s" report)
    Assert.True(byName.["Dag-chain"] = 0.0, sprintf "Dag-chain lost idempotency: %s" report)
    // Multi-parent is NOT, and pinning the defect is the point. This is
    // pre-existing — `SkipConnections` drifts identically and always did — and
    // the qualifier is now on `backward`'s docstring, which claimed unconditional
    // idempotency until this test was written. If either of these ever reaches
    // zero the sweep was fixed, and this test should be inverted, not deleted.
    Assert.True(
        byName.["SkipConnections"] > 0.0 && byName.["Dag-skip"] > 0.0,
        sprintf "a multi-parent sweep became idempotent — good news, update this test: %s" report)
    Assert.Equal(byName.["SkipConnections"], byName.["Dag-skip"], 12)

[<Fact>]
let ``MLBNN-35: factor-graph inference is idempotent and does not consume the network`` () =
    // The factor-graph path rebuilds its graph from `Layers.[i].Posterior` every
    // call, so it should be a pure function of the network — but "should be" is
    // the claim, not the evidence. Two things are checked: repeated calls agree
    // to the bit, and the network is unchanged afterwards, so a caller can run
    // inference and keep using the same value.
    let depth = 4
    let priors = Array.init depth (fun i -> Gaussian.ofMeanVariance (float i * 0.2) 1.0)
    let topology = MultilayerBnn.Dag [| []; [ 0 ]; [ 1; 0 ]; [ 2 ] |]
    let net = MultilayerBnn.tryCreate priors (Array.create depth 0.75) topology |> unwrap
    let after = MultilayerBnn.infer [ 3.0; -1.0; 2.0 ] net |> unwrap

    // ADJUDICATED SELF-COMPARISON, counted in `registry/check-arity-census.json`.
    // `audit-check-arity.ts` inlines the `before` binding, so both sides of the
    // assertion below normalize to `toJsonString after` and it is flagged as a
    // check whose two sides are one expression. It is NOT vacuous, and that was
    // demonstrated rather than argued: `Network` holds mutable ARRAYS
    // (`Layers`, `UpwardMessages`, `DownwardMessages`), so an implementation can
    // scribble on its input. Adding `net.UpwardMessages.[0] <- ...` to
    // `tryToFactorGraph` fails this exact line. The string is snapshotted BEFORE
    // the calls and compared after — temporal ordering the normalizer cannot see.
    let before = MultilayerBnn.toJsonString after
    let a, _, _ = MultilayerBnn.tryMarginalsViaFactorGraph 1e-13 500 after |> unwrap
    let b, _, _ = MultilayerBnn.tryMarginalsViaFactorGraph 1e-13 500 after |> unwrap
    Assert.Equal<string>(before, MultilayerBnn.toJsonString after)
    for i in 0 .. depth - 1 do
        Assert.True(
            bits a.[i].Precision = bits b.[i].Precision
            && bits a.[i].PrecisionMean = bits b.[i].PrecisionMean,
            sprintf "layer %d moved between identical calls" i)

[<Fact>]
let ``MLBNN-36: evidence is absorbed once, not once per inference path`` () =
    // The failure this discipline exists to catch: layer 0's posterior already
    // carries the data, and the factor-graph path uses it as a prior FACTOR. If
    // it also re-absorbed the observations, the precision would grow with the
    // number of times inference was run rather than with the number of
    // observations — the classic double-count.
    //
    // Checked against the shape of the answer rather than a magic number: one
    // observation absorbed k times has precision `prior + k/obsVar`, so running
    // inference repeatedly on the SAME network must leave that unchanged.
    let net = MultilayerBnn.tryCreateUniform 3 prior 1.0 |> unwrap
    let after = MultilayerBnn.infer (Seq.replicate 4 7.0) net |> unwrap
    let expected = prior.Precision + 4.0 / 1.0
    Assert.True(
        abs (after.Layers.[0].Posterior.Precision - expected) < 1e-12,
        sprintf "layer 0 precision %.12g, expected %.12g" after.Layers.[0].Posterior.Precision expected)

    let m1, _, _ = MultilayerBnn.tryMarginalsViaFactorGraph 1e-13 500 after |> unwrap
    let m2, _, _ = MultilayerBnn.tryMarginalsViaFactorGraph 1e-13 500 after |> unwrap
    let m3, _, _ = MultilayerBnn.tryMarginalsViaFactorGraph 1e-13 500 after |> unwrap
    Assert.True(
        bits m1.[0].Precision = bits m3.[0].Precision && bits m2.[0].Precision = bits m3.[0].Precision,
        sprintf "layer 0 marginal precision drifted across runs: %.17g / %.17g / %.17g"
            m1.[0].Precision m2.[0].Precision m3.[0].Precision)
