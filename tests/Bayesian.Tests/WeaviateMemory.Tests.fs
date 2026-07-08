module Zeta.Bayesian.Tests.WeaviateMemoryTests

open Xunit
open Zeta.Core
open Zeta.Bayesian

// ─────────────────────────────────────────────────────────────────────────────
// WAV-1 through WAV-5: WeaviateMemory vector memory for warm-starting
// sequential ensembles.
// ─────────────────────────────────────────────────────────────────────────────

/// WAV-1: A fresh memory store is empty.
[<Fact>]
let ``WAV-1: fresh memory store is empty`` () =
    let mem = WeaviateMemory.InMemoryVectorMemory() :> WeaviateMemory.IVectorMemory
    Assert.Empty(mem.All())
    let s = WeaviateMemory.stats mem
    Assert.Equal(0, s.Count)

/// WAV-2: Storing a belief vector and retrieving it by exact match.
[<Fact>]
let ``WAV-2: store and retrieve exact match`` () =
    let mem = WeaviateMemory.InMemoryVectorMemory() :> WeaviateMemory.IVectorMemory
    let g = { Gaussian.PrecisionMean = 5.0; Precision = 2.0 }
    WeaviateMemory.storePosterior mem "cell-0" g
    // Retrieve with the same vector — cosine similarity = 1.0
    let query = WeaviateMemory.toVector "cell-0" g
    let result = mem.Retrieve(query, 0.99)
    Assert.True(result.IsSome, "Should retrieve the stored vector with exact match")
    let retrieved = result.Value
    Assert.True(abs (retrieved.PrecisionMean - g.PrecisionMean) < 1e-9,
        sprintf "Retrieved PrecisionMean should match: got %f" retrieved.PrecisionMean)
    Assert.True(abs (retrieved.Precision - g.Precision) < 1e-9,
        sprintf "Retrieved Precision should match: got %f" retrieved.Precision)

/// WAV-3: Cosine similarity correctly identifies similar and dissimilar beliefs.
[<Fact>]
let ``WAV-3: cosine similarity identifies similar and dissimilar beliefs`` () =
    // Two beliefs pointing in the same direction (same mean, different precision)
    let a = WeaviateMemory.toVector "a" { Gaussian.PrecisionMean = 5.0; Precision = 2.0 }
    let b = WeaviateMemory.toVector "b" { Gaussian.PrecisionMean = 10.0; Precision = 4.0 }  // 2x scale
    let simSame = WeaviateMemory.cosineSimilarity a b
    Assert.True(abs (simSame - 1.0) < 1e-9,
        sprintf "Beliefs in the same direction should have cosine similarity = 1.0, got %f" simSame)
    // Two beliefs pointing in orthogonal directions
    let c = WeaviateMemory.toVector "c" { Gaussian.PrecisionMean = 1.0; Precision = 0.0 }
    let d = WeaviateMemory.toVector "d" { Gaussian.PrecisionMean = 0.0; Precision = 1.0 }
    let simOrth = WeaviateMemory.cosineSimilarity c d
    Assert.True(abs simOrth < 1e-9,
        sprintf "Orthogonal beliefs should have cosine similarity = 0.0, got %f" simOrth)
    // A zero vector has similarity 0.0 with anything
    let zero = WeaviateMemory.toVector "z" { Gaussian.PrecisionMean = 0.0; Precision = 0.0 }
    let simZero = WeaviateMemory.cosineSimilarity zero a
    Assert.Equal(0.0, simZero)

/// WAV-4: Warm-start prior is returned when a similar belief exists in memory.
[<Fact>]
let ``WAV-4: warm-start prior uses stored belief when similarity >= threshold`` () =
    let mem = WeaviateMemory.InMemoryVectorMemory() :> WeaviateMemory.IVectorMemory
    // Store a past posterior
    let pastPosterior = { Gaussian.PrecisionMean = 8.0; Precision = 3.0 }
    WeaviateMemory.storePosterior mem "cell-0" pastPosterior
    // Query with a very similar belief (same direction, slightly different scale)
    let currentBelief = { Gaussian.PrecisionMean = 8.1; Precision = 3.05 }
    let prior = WeaviateMemory.warmStartPrior mem "cell-0" currentBelief 0.99
    // The warm-start prior should be the stored past posterior (similarity ≈ 1.0)
    Assert.True(prior.Precision > 0.0,
        "Warm-start prior should have non-zero precision when a match is found")
    Assert.True(abs (prior.PrecisionMean - pastPosterior.PrecisionMean) < 1e-9,
        sprintf "Warm-start PrecisionMean should match stored: got %f" prior.PrecisionMean)
    // Query with a very different belief — no match above threshold
    let differentBelief = { Gaussian.PrecisionMean = 0.1; Precision = 100.0 }
    let uninformativePrior = WeaviateMemory.warmStartPrior mem "cell-0" differentBelief 0.99
    Assert.Equal(0.0, uninformativePrior.Precision)

/// WAV-5: runWithMemory accumulates precision and stores the final posterior.
[<Fact>]
let ``WAV-5: runWithMemory accumulates precision and stores final posterior`` () =
    let mem = WeaviateMemory.InMemoryVectorMemory() :> WeaviateMemory.IVectorMemory
    let signals =
        [ { Gaussian.PrecisionMean = 2.0; Precision = 1.0 }
          { Gaussian.PrecisionMean = 3.0; Precision = 1.5 }
          { Gaussian.PrecisionMean = 1.0; Precision = 0.5 } ]
    // First run: no warm-start (memory is empty)
    let (posterior1, wasWarm1) = WeaviateMemory.runWithMemory mem "cell-0" signals 0.95
    Assert.False(wasWarm1, "First run should not be warm-started (memory is empty)")
    // Precision should be sum of all signal precisions (starting from uninformative prior)
    let expectedPrecision = signals |> List.sumBy (fun s -> s.Precision)
    Assert.True(abs (posterior1.Precision - expectedPrecision) < 1e-9,
        sprintf "Posterior precision should be sum of signal precisions: expected %f, got %f"
            expectedPrecision posterior1.Precision)
    // Memory should now contain the stored posterior
    let s = WeaviateMemory.stats mem
    Assert.Equal(1, s.Count)
    // Second run with the same signals: should warm-start from the stored posterior
    let (posterior2, wasWarm2) = WeaviateMemory.runWithMemory mem "cell-0" signals 0.95
    Assert.True(wasWarm2, "Second run should be warm-started from stored posterior")
    // Posterior2 should have higher precision than posterior1 (warm-start adds prior precision)
    Assert.True(posterior2.Precision > posterior1.Precision,
        sprintf "Warm-started posterior should have higher precision: p1=%f, p2=%f"
            posterior1.Precision posterior2.Precision)
