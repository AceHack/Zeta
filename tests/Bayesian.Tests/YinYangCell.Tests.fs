module Zeta.Tests.YinYangCellTests

open global.Xunit
open FsCheck
open FsCheck.Xunit
open Zeta.Core
open Zeta.Bayesian

// ── Test data ────────────────────────────────────────────────────────────────────────────────────
// Valid Adinkra codewords are the images of the 16 GF(2)^4 messages under AdinkraCode.encode.
// Generator is systematic [I4 | A], so codewords are NOT arbitrary weight-4 patterns.
// We derive the test data directly from AdinkraCode to guarantee correctness.

/// The zero codeword [0,0,0,0,0,0,0,0] — message [0,0,0,0], the identity element.
let private zero = AdinkraCode.encode [| 0;0;0;0 |]

/// Codeword from message [1,0,0,0] → [1,0,0,0,0,1,1,1] (weight 4).
let private w4a = AdinkraCode.encode [| 1;0;0;0 |]

/// Codeword from message [0,1,0,0] → [0,1,0,0,1,0,1,1] (weight 4).
let private w4b = AdinkraCode.encode [| 0;1;0;0 |]

/// The all-ones codeword — message [1,1,1,1] → [1,1,1,1,1,1,1,1] (weight 8).
let private allOnes = AdinkraCode.encode [| 1;1;1;1 |]

// ── YYC-1: seed produces a valid cell ────────────────────────────────────────────────────────────
[<Fact>]
let ``YYC-1: seed from a valid Adinkra codeword produces a valid cell`` () =
    let cell = YinYangCell.seed w4a
    Assert.True(YinYangCell.isValidSeed cell, "seeded cell should have a valid Adinkra codeword as yin")

// ── YYC-2: yin is invariant under observe ────────────────────────────────────────────────────────
[<Fact>]
let ``YYC-2: yin (codeword) is invariant under observe`` () =
    let cell = YinYangCell.seed w4b
    let sensory = { Gaussian.PrecisionMean = 2.0; Precision = 1.0 }
    let updated = YinYangCell.observe sensory cell
    Assert.Equal<int[]>(cell.Codeword, updated.Codeword)

// ── YYC-3: yang (column) changes under observe ───────────────────────────────────────────────────
[<Fact>]
let ``YYC-3: yang (column belief) changes under observe`` () =
    let cell = YinYangCell.seed w4a
    let sensory = { Gaussian.PrecisionMean = 2.0; Precision = 1.0 }
    let updated = YinYangCell.observe sensory cell
    // The posterior precision should be strictly greater than the prior (0.0 + 1.0 = 1.0).
    Assert.True(updated.Column.Belief.Precision > cell.Column.Belief.Precision,
        sprintf "posterior precision %f should exceed prior %f" updated.Column.Belief.Precision cell.Column.Belief.Precision)

// ── YYC-4: round-trip through DynamicValue ───────────────────────────────────────────────────────
[<Fact>]
let ``YYC-4: cell round-trips through DynamicValue losslessly`` () =
    let cell = YinYangCell.seed w4b
    match YinYangCell.toDynamicValue cell with
    | None -> Assert.Fail("toDynamicValue returned None")
    | Some dv ->
        match YinYangCell.ofDynamicValue dv with
        | None -> Assert.Fail("ofDynamicValue returned None")
        | Some cell2 ->
            Assert.Equal<int[]>(cell.Codeword, cell2.Codeword)
            Assert.Equal(cell.Column.Id, cell2.Column.Id)
            Assert.Equal(cell.Column.Belief.PrecisionMean, cell2.Column.Belief.PrecisionMean)
            Assert.Equal(cell.Column.Belief.Precision, cell2.Column.Belief.Precision)

// ── YYC-5: round-trip after observe ──────────────────────────────────────────────────────────────
[<Fact>]
let ``YYC-5: cell round-trips through DynamicValue after observe`` () =
    let cell =
        YinYangCell.seed w4a
        |> YinYangCell.observe { Gaussian.PrecisionMean = 3.0; Precision = 2.0 }
    match YinYangCell.toDynamicValue cell with
    | None -> Assert.Fail("toDynamicValue returned None after observe")
    | Some dv ->
        match YinYangCell.ofDynamicValue dv with
        | None -> Assert.Fail("ofDynamicValue returned None after observe")
        | Some cell2 ->
            Assert.Equal<int[]>(cell.Codeword, cell2.Codeword)
            Assert.Equal(cell.Column.Belief.PrecisionMean, cell2.Column.Belief.PrecisionMean)
            Assert.Equal(cell.Column.Belief.Precision, cell2.Column.Belief.Precision)

// ── YYC-6: gen(gen) = gen — yin is preserved by reseed ───────────────────────────────────────────
[<Fact>]
let ``YYC-6: gen(gen) = gen — reseed preserves the yin (codeword)`` () =
    let cell =
        YinYangCell.seed w4b
        |> YinYangCell.observe { Gaussian.PrecisionMean = 5.0; Precision = 3.0 }
    let reseeded = YinYangCell.reseed cell
    Assert.Equal<int[]>(cell.Codeword, reseeded.Codeword)

// ── YYC-7: reseed resets the yang to uninformative prior ─────────────────────────────────────────
[<Fact>]
let ``YYC-7: reseed resets the yang to the uninformative prior`` () =
    let cell =
        YinYangCell.seed w4a
        |> YinYangCell.observe { Gaussian.PrecisionMean = 5.0; Precision = 3.0 }
    let reseeded = YinYangCell.reseed cell
    // The uninformative prior has Precision = 0.0.
    Assert.Equal(0.0, reseeded.Column.Belief.Precision)
    Assert.Equal(0.0<InformationValue.iv>, reseeded.Column.AccumulatedIV)

// ── YYC-8: ZSet +1 entry is Some ─────────────────────────────────────────────────────────────────
[<Fact>]
let ``YYC-8: toZSetEntry returns Some for a valid cell`` () =
    let cell = YinYangCell.seed w4b
    Assert.True(Option.isSome (YinYangCell.toZSetEntry cell))

// ── YYC-9: ZSet +1 and -1 are negations of each other ────────────────────────────────────────────
[<Fact>]
let ``YYC-9: toZSetEntry and toZSetRetraction have equal keys and opposite weights`` () =
    let cell = YinYangCell.seed w4a
    match YinYangCell.toZSetEntry cell, YinYangCell.toZSetRetraction cell with
    | Some (dvA, wA), Some (dvB, wB) ->
        Assert.Equal(dvA, dvB)
        Assert.Equal(1L, wA)
        Assert.Equal(-1L, wB)
    | _ -> Assert.Fail("ZSet entry or retraction returned None")

// ── YYC-10: self-dual — the zero codeword is a valid seed ────────────────────────────────────────
[<Fact>]
let ``YYC-10: zero codeword is a valid Adinkra seed (the identity element)`` () =
    let cell = YinYangCell.seed zero
    Assert.True(YinYangCell.isValidSeed cell)

// ── YYC-11: all-ones codeword is a valid seed ────────────────────────────────────────────────────
[<Fact>]
let ``YYC-11: all-ones codeword is a valid Adinkra seed (weight-8 codeword)`` () =
    let cell = YinYangCell.seed allOnes
    Assert.True(YinYangCell.isValidSeed cell)

// ── YYC-12: castVote IV accumulates monotonically ────────────────────────────────────────────────
[<Fact>]
let ``YYC-12: accumulated IV grows monotonically with observations`` () =
    let cell0 = YinYangCell.seed w4b
    let cell1 = YinYangCell.observe { Gaussian.PrecisionMean = 1.0; Precision = 1.0 } cell0
    let cell2 = YinYangCell.observe { Gaussian.PrecisionMean = 2.0; Precision = 1.0 } cell1
    Assert.True(cell1.Column.AccumulatedIV >= cell0.Column.AccumulatedIV,
        "IV should be non-decreasing after first observation")
    Assert.True(cell2.Column.AccumulatedIV >= cell1.Column.AccumulatedIV,
        "IV should be non-decreasing after second observation")

// ── YYC-13: FsCheck — all valid Adinkra codewords round-trip ─────────────────────────────────────
[<Property>]
let ``YYC-13: all valid Adinkra codewords round-trip through YinYangCell DynamicValue`` () =
    // Generate a random index into the 16 valid Adinkra codewords.
    let codewords = AdinkraCode.allCodewords
    let n = codewords.Length
    if n = 0 then true
    else
        let results =
            codewords
            |> List.forall (fun cw ->
                let cell = YinYangCell.seed cw
                match YinYangCell.toDynamicValue cell with
                | None -> false
                | Some dv ->
                    match YinYangCell.ofDynamicValue dv with
                    | None -> false
                    | Some cell2 -> cell.Codeword = cell2.Codeword)
        results
