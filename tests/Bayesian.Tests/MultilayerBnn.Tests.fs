module Zeta.Bayesian.Tests.MultilayerBnn

open Xunit
open Zeta.Bayesian

let private unwrap = function Ok v -> v | Error e -> failwith e

let private prior = Gaussian.ofMeanVariance 0.0 1.0
let private variance = 0.5

// ── Construction ───────────────────────────────────────────────────────────────

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

// ── Forward pass ───────────────────────────────────────────────────────────────

[<Fact>]
let ``MLBNN-5: forward pass updates all layers`` () =
    let net = MultilayerBnn.tryCreateUniform 3 prior variance |> unwrap
    let result = MultilayerBnn.forward 1.0 net
    Assert.True(result |> Result.isOk)
    let (net', _) = result |> unwrap
    // All layers should have obsCount = 1 after one forward pass
    for layer in net'.Layers do
        Assert.Equal(1, layer.Objective.ObservationCount)

[<Fact>]
let ``MLBNN-6: forward pass increases IV`` () =
    let net = MultilayerBnn.tryCreateUniform 3 prior variance |> unwrap
    let (net', _) = MultilayerBnn.forward 1.0 net |> unwrap
    Assert.True(MultilayerBnn.cumulativeIv net' > 0.0<InformationValue.iv>)

[<Fact>]
let ``MLBNN-7: output mean moves toward observation after forward pass`` () =
    let net = MultilayerBnn.tryCreateUniform 1 prior variance |> unwrap
    let (net', _) = MultilayerBnn.forward 5.0 net |> unwrap
    // Prior mean = 0.0; after observing 5.0, posterior mean should be > 0.0
    Assert.True(MultilayerBnn.outputMean net' > 0.0)

// ── Backward pass ──────────────────────────────────────────────────────────────

[<Fact>]
let ``MLBNN-8: backward pass does not error on valid network`` () =
    let net = MultilayerBnn.tryCreateUniform 3 prior variance |> unwrap
    let (net', _) = MultilayerBnn.forward 1.0 net |> unwrap
    let result = MultilayerBnn.backward net'
    Assert.True(result |> Result.isOk)

[<Fact>]
let ``MLBNN-9: update (forward+backward) is monotone in IV`` () =
    let net = MultilayerBnn.tryCreateUniform 2 prior variance |> unwrap
    let net1 = MultilayerBnn.update 1.0 net |> unwrap
    let net2 = MultilayerBnn.update 2.0 net1 |> unwrap
    Assert.True(MultilayerBnn.cumulativeIv net2 >= MultilayerBnn.cumulativeIv net1)

// ── Infer ──────────────────────────────────────────────────────────────────────

[<Fact>]
let ``MLBNN-10: infer over 10 observations converges`` () =
    let net = MultilayerBnn.tryCreateUniform 3 prior variance |> unwrap
    let obs = seq { for _ in 1..10 -> 2.0 }
    let result = MultilayerBnn.infer obs net
    Assert.True(result |> Result.isOk)
    let net' = result |> unwrap
    // After 10 observations of 2.0, output mean should be close to 2.0
    let mean = MultilayerBnn.outputMean net'
    Assert.True(mean > 1.0 && mean < 3.0)

// ── Skip connections ───────────────────────────────────────────────────────────

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

// ── Serialisation ──────────────────────────────────────────────────────────────

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
    let net' = MultilayerBnn.update 1.0 net |> unwrap
    let json = MultilayerBnn.toJsonString net'
    Assert.Contains("\"obsCount\":1", json)
