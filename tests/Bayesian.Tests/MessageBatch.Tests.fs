module Zeta.Bayesian.Tests.MessageBatchTests
#nowarn "0893"

open FsUnit.Xunit
open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Bayesian

// Columnar message batches (081KT2T2J0008QG0R000S7GHQ8) — the Apache Arrow in-memory store
// for bit-efficient message passing. The load-bearing property: batched
// column-wise product/divide (natural-param vector add/sub) AGREES with
// the scalar Message ops on the VALUE within float tolerance, for every
// family (081KT2T2J0008QG0R000YZ3NMY C11) — bit-exact for Gaussian, value-equal for
// Beta/Bernoulli (reassociation / prob-space-vs-log-odds) — AND the
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

// ═══════════════════════════════════════════════════════════════════
// C11 (081KT2T2J0008QG0R000YZ3NMY P0) — columnar batch product AGREES with the scalar
// product, message-by-message, within float tolerance, per family.
// This is the HONEST claim: the prose previously said "bit-exact,
// proven in tests" which is FALSE for Beta (last-ULP reassociation:
// (α-1)+(α'-1)+1 vs α+α'-1) and Bernoulli (scalar = prob-space t/(t+f),
// column = log-odds add — value-equal, different bits). Gaussian IS
// bit-exact; the property below asserts value-equality within tolerance
// for all three (and Gaussian is additionally checked bit-exact).
//
// C10 (081KT2T2J0008QG0R000YZ3NMY P0) — round-trip toMessages ∘ ofMessages = id, per family,
// within tolerance. Bernoulli is LOSSY at p→0/1 (log-odds saturates), so
// its generator stays strictly inside (0,1) via logistic of bounded
// log-odds — the honest "proper round-trips" claim, not "all p round-trip".
// FsCheck half; no Z3 (these are float-conformance claims, not symbolic).
// ═══════════════════════════════════════════════════════════════════

let private mkG (nuRaw: float) (tauRaw: float) : Gaussian =
    let clamp lo hi x = max lo (min hi x)
    { PrecisionMean = clamp -1.0e6 1.0e6 nuRaw; Precision = clamp 1.0e-6 1.0e6 (abs tauRaw) }

let private mkB (aRaw: float) (bRaw: float) : Beta =
    let clamp lo hi x = max lo (min hi x)
    { Alpha = clamp 1.0e-6 1.0e6 (abs aRaw); Beta = clamp 1.0e-6 1.0e6 (abs bRaw) }

let private mkBern (lRaw: float) : Bernoulli =
    let l = max -8.0 (min 8.0 lRaw)
    { ProbTrue = 1.0 / (1.0 + exp (-l)) }

let private batchProd1 (c: IColumnar<'M>) (a: 'M) (b: 'M) : 'M =
    (NaturalBatch.product (NaturalBatch.ofMessages c [| a |]) (NaturalBatch.ofMessages c [| b |])
     |> NaturalBatch.toMessages c).[0]

let private roundTrip1 (c: IColumnar<'M>) (m: 'M) : 'M =
    (NaturalBatch.toMessages c (NaturalBatch.ofMessages c [| m |])).[0]

// ── C11: batch product = scalar product, per family ──

[<Property>]
let ``C11 Gaussian batch product = scalar product (bit-exact)``
    (NormalFloat nuA) (NormalFloat tauA) (NormalFloat nuB) (NormalFloat tauB) =
    let a, b = mkG nuA tauA, mkG nuB tauB
    let bp = batchProd1 Columnar.gaussian a b
    let sp = a * b
    // Gaussian columns are the identity (ν,τ) and adds happen in the same
    // order ⇒ genuinely bit-exact (exact equality, no tolerance).
    bp.PrecisionMean = sp.PrecisionMean && bp.Precision = sp.Precision

[<Property>]
let ``C11 Beta batch product = scalar product (value-equal within tol)``
    (NormalFloat aA) (NormalFloat bA) (NormalFloat aB) (NormalFloat bB) =
    let a, b = mkB aA bA, mkB aB bB
    let bp = batchProd1 Columnar.beta a b
    let sp = a * b
    abs (bp.Alpha - sp.Alpha) <= 1e-7 && abs (bp.Beta - sp.Beta) <= 1e-7

[<Property>]
let ``C11 Bernoulli batch product = scalar product (value-equal within tol)``
    (NormalFloat lA) (NormalFloat lB) =
    let a, b = mkBern lA, mkBern lB
    let bp = batchProd1 Columnar.bernoulli a b
    let sp = a * b
    abs (bp.ProbTrue - sp.ProbTrue) <= 1e-7

// ── C10: round-trip toMessages ∘ ofMessages = id, per family ──

[<Property>]
let ``C10 Gaussian round-trips through the columnar batch (bit-exact)``
    (NormalFloat nuA) (NormalFloat tauA) =
    let g = mkG nuA tauA
    let r = roundTrip1 Columnar.gaussian g
    r.PrecisionMean = g.PrecisionMean && r.Precision = g.Precision

[<Property>]
let ``C10 Beta round-trips through the columnar batch (within tol)``
    (NormalFloat aA) (NormalFloat bA) =
    let d = mkB aA bA
    let r = roundTrip1 Columnar.beta d
    abs (r.Alpha - d.Alpha) <= 1e-7 && abs (r.Beta - d.Beta) <= 1e-7

[<Property>]
let ``C10 proper Bernoulli round-trips through the columnar batch (within tol; lossy at p->0/1)``
    (NormalFloat lA) =
    // proper p strictly inside (0,1) via bounded log-odds round-trips; the
    // log-odds representation is LOSSY at p→0/1 (saturation), so this is the
    // honest "proper round-trips" claim, not "all p".
    let b = mkBern lA
    let r = roundTrip1 Columnar.bernoulli b
    abs (r.ProbTrue - b.ProbTrue) <= 1e-7
