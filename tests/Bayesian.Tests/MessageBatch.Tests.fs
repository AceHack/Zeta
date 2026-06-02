module Zeta.Bayesian.Tests.MessageBatchTests

open FsUnit.Xunit
open global.Xunit
open Zeta.Bayesian

// Columnar message batches (B-1000) — the Apache Arrow in-memory store
// for bit-efficient message passing. The load-bearing property: batched
// column-wise product/divide (natural-param vector add/sub) is bit-exact
// equivalent to the scalar Message ops, for every family — AND the
// columns round-trip through an Arrow RecordBatch. "The compilers don't lie."

// ─── Batched product = scalar product, element-wise, per family ───

[<Fact>]
let ``Gaussian batched product equals scalar product element-wise`` () =
    let gs1 = [| Gaussian.ofMeanVariance 0.0 1.0; Gaussian.ofMeanVariance 1.0 2.0 |]
    let gs2 = [| Gaussian.ofMeanVariance 2.0 1.0; Gaussian.ofMeanVariance -1.0 4.0 |]
    let batched =
        NaturalBatch.product
            (NaturalBatch.ofMessages Columnar.gaussian gs1)
            (NaturalBatch.ofMessages Columnar.gaussian gs2)
        |> NaturalBatch.toMessages Columnar.gaussian
    for i in 0 .. 1 do
        let scalar = Gaussian.product gs1.[i] gs2.[i]
        Gaussian.mean batched.[i] |> should (equalWithin 1e-9) (Gaussian.mean scalar)
        Gaussian.variance batched.[i] |> should (equalWithin 1e-9) (Gaussian.variance scalar)

[<Fact>]
let ``Beta batched product equals the conjugate posterior (α-1 natural columns)`` () =
    let prior = [| Beta.create 2.0 3.0 |]
    let lik = [| Beta.likelihood 5.0 1.0 |]
    let batched =
        NaturalBatch.product
            (NaturalBatch.ofMessages Columnar.beta prior)
            (NaturalBatch.ofMessages Columnar.beta lik)
        |> NaturalBatch.toMessages Columnar.beta
    batched.[0].Alpha |> should (equalWithin 1e-9) 7.0
    batched.[0].Beta |> should (equalWithin 1e-9) 4.0

[<Fact>]
let ``Bernoulli batched product equals scalar product (log-odds columns)`` () =
    let batched =
        NaturalBatch.product
            (NaturalBatch.ofMessages Columnar.bernoulli [| Bernoulli.create 0.8 |])
            (NaturalBatch.ofMessages Columnar.bernoulli [| Bernoulli.create 0.6 |])
        |> NaturalBatch.toMessages Columnar.bernoulli
    batched.[0].ProbTrue |> should (equalWithin 1e-9) (0.48 / 0.56)

[<Fact>]
let ``batched divide inverts batched product (the EP cavity, columnar)`` () =
    let a = [| Gaussian.ofMeanVariance 1.0 2.0; Gaussian.ofMeanVariance 0.0 5.0 |]
    let b = [| Gaussian.ofMeanVariance -0.5 3.0; Gaussian.ofMeanVariance 2.0 1.0 |]
    let ba = NaturalBatch.ofMessages Columnar.gaussian a
    let bb = NaturalBatch.ofMessages Columnar.gaussian b
    let back = NaturalBatch.divide (NaturalBatch.product ba bb) bb |> NaturalBatch.toMessages Columnar.gaussian
    for i in 0 .. 1 do
        Gaussian.mean back.[i] |> should (equalWithin 1e-9) (Gaussian.mean a.[i])
        Gaussian.variance back.[i] |> should (equalWithin 1e-9) (Gaussian.variance a.[i])

// ─── Apache Arrow RecordBatch round-trip ───

[<Fact>]
let ``NaturalBatch round-trips through an Arrow RecordBatch`` () =
    let gs = [| Gaussian.ofMeanVariance 1.0 2.0; Gaussian.ofMeanVariance 3.0 4.0 |]
    let batch = NaturalBatch.ofMessages Columnar.gaussian gs
    use rb = NaturalBatch.toRecordBatch Columnar.gaussian.ColumnNames batch
    rb.ColumnCount |> should equal 2     // ν, τ columns
    rb.Length |> should equal 2          // two messages
    let back = NaturalBatch.ofRecordBatch rb |> NaturalBatch.toMessages Columnar.gaussian
    Gaussian.mean back.[0] |> should (equalWithin 1e-9) 1.0
    Gaussian.variance back.[0] |> should (equalWithin 1e-9) 2.0
    Gaussian.mean back.[1] |> should (equalWithin 1e-9) 3.0
    Gaussian.variance back.[1] |> should (equalWithin 1e-9) 4.0

[<Fact>]
let ``columnar pack/unpack is the identity and reports dim and count`` () =
    let gs = [| Gaussian.ofMeanVariance 0.5 1.5; Gaussian.ofMeanVariance -2.0 3.0; Gaussian.ofMeanVariance 4.0 0.25 |]
    let batch = NaturalBatch.ofMessages Columnar.gaussian gs
    batch.Dim |> should equal 2
    batch.Count |> should equal 3
    let back = NaturalBatch.toMessages Columnar.gaussian batch
    for i in 0 .. 2 do
        Gaussian.mean back.[i] |> should (equalWithin 1e-9) (Gaussian.mean gs.[i])
        Gaussian.variance back.[i] |> should (equalWithin 1e-9) (Gaussian.variance gs.[i])
