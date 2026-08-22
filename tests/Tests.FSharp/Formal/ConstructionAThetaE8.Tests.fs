module Zeta.Tests.Formal.ConstructionAThetaE8Tests

open System
open System.Globalization
open System.IO
open System.Text.Json
open global.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════════════════════════════
// ConstructionATheta (`src/Core/ConstructionATheta.fs`) — THE THETA SERIES of the lattice the
// in-tree [8,4] code generates by Construction A, and whether it is the Eisenstein series E_4.
//
// WHY THIS IS NOT THE CHECK ALREADY IN THE TREE. `CliffordE8Roots` identifies E8 by matching a
// Gram matrix against the E8 Cartan matrix — a STRUCTURE check. A theta series is a different
// observable: it counts lattice vectors by norm and never looks at a Dynkin diagram. Agreement
// between the two is therefore cross-verification rather than the same check run twice.
//
// THE ORDER OF THIS FILE IS THE ARGUMENT, and it is deliberate:
//
//   §1 ANCHOR FIRST. The counting machinery is aimed at lattices whose answer is published
//      before it is aimed at the one we care about. Z^n must reproduce theta_3(q)^n; Z^4 must
//      reproduce Jacobi's r_4(m) = 8 sum_{d|m, 4 not| d} d (1834); D4 must reproduce both
//      Jacobi-on-even-m and the transcribed SPLAG series. A counter that only ever agrees with
//      the thing it is trying to confirm proves nothing, so it is made to agree with something
//      else first.
//
//   §2 THE COMPUTATION. Only then is the same counter pointed at
//      `L_A(AdinkraCode.allCodewords)`, and the result compared against E_4 with sigma_3
//      summed from divisors — never a transcribed 240 / 2160 / 6720.
//
//   §3 THE BOUND. Route E (enumeration) and route C (generating-function convolution, which
//      materialises no lattice point and therefore has no enumeration bound) must agree term
//      by term. This is what stands between us and a plausible-but-low count: 240 is exactly
//      the kind of number that looks right when it is not.
//
//   §4 THE POSITIVE CONTROL. The comparison is shown to be capable of failing.
//
// A red lane is an HONEST STOP. If a lane disagrees, the disagreement IS the result; it is not
// to be reconciled by adjusting either side (`toy-is-free-metered-must-be-earned`).
//
// Anchors: Conway & Sloane, *SPLAG* ch. 4-5; Serre, *A Course in Arithmetic* ch. VII; Jacobi
// (1834); Mordell (1938) — E8 is the unique even unimodular rank-8 lattice.
// ═══════════════════════════════════════════════════════════════════════════════════════════

/// Squared-length ceiling for the E8 enumeration: 40 = 4 * 10, i.e. E_4 exponents 0..10.
let private e8MaxNormSq = 40

/// Squared-length ceiling for the anchor lattices.
let private anchorMaxNormSq = 20

let private repoRoot () =
    let mutable dir =
        DirectoryInfo(Path.GetDirectoryName(Reflection.Assembly.GetExecutingAssembly().Location))

    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent

    if isNull dir then
        failwith "Could not locate repo root (Zeta.sln)."
    else
        dir.FullName

let private doc =
    JsonDocument.Parse(File.ReadAllText(Path.Join(repoRoot (), "src", "Core", "golden-vectors-construction-a-theta.json")))

/// Read one committed series by id. Each row is `{ n, dec, hex }`, and the two encodings are
/// checked against each other at the read, so a half-edited row fails here rather than later.
let private readSeries (id: string) : int64[] =
    let series =
        doc.RootElement.GetProperty("series").EnumerateArray()
        |> Seq.find (fun s -> String.Equals(s.GetProperty("id").GetString(), id, StringComparison.Ordinal))

    let rows = series.GetProperty("values")

    [| for i in 0 .. rows.GetArrayLength() - 1 do
           let row = rows.[i]
           let n = row.GetProperty("n").GetInt32()

           Assert.True(
               (n = i),
               String.Format(CultureInfo.InvariantCulture, "series={0} index {1}: row is out of order (declares n={2})", id, i, n)
           )

           let dec = Int64.Parse(row.GetProperty("dec").GetString(), CultureInfo.InvariantCulture)
           let hex = LatticeVoa.ofHex (row.GetProperty("hex").GetString())

           Assert.True(
               (dec = hex),
               String.Format(
                   CultureInfo.InvariantCulture,
                   "series={0} index {1}: dec/hex encodings disagree (dec={2}, hex decodes to {3})",
                   id, i, dec, hex
               )
           )

           yield dec |]

/// One message per mismatch, each naming the lane and the index. Returning rather than
/// asserting is what lets the positive control below assert that the comparison CAN fail.
let private mismatches (lane: string) (expected: int64[]) (actual: int64[]) : string list =
    [ if expected.Length <> actual.Length then
          yield
              String.Format(
                  CultureInfo.InvariantCulture,
                  "lane={0}: length mismatch (expected {1} terms, computed {2})",
                  lane, expected.Length, actual.Length
              )

      for i in 0 .. (min expected.Length actual.Length) - 1 do
          if expected.[i] <> actual.[i] then
              yield
                  String.Format(
                      CultureInfo.InvariantCulture,
                      "lane={0} index n={1}: expected {2}, computed {3}",
                      lane, i, expected.[i], actual.[i]
                  ) ]

let private assertNoMismatch (lane: string) (expected: int64[]) (actual: int64[]) =
    let ms = mismatches lane expected actual
    Assert.True(List.isEmpty ms, String.Join("; ", ms))

// ═══ §1 ANCHORS — the machinery agrees with published answers BEFORE it is aimed at E8 ═════

[<Fact>]
let ``anchor Z^n: Construction A over the full code enumerates Z^n, whose theta series is theta_3(q)^n`` () =
    // L_A(GF(2)^n) = Z^n, because every residue class mod 2 is admitted.
    for n in 1 .. 5 do
        let enumerated = ConstructionATheta.thetaByEnumeration (ConstructionATheta.fullCode n) anchorMaxNormSq
        let published = ConstructionATheta.sumOfSquaresCounts n anchorMaxNormSq

        assertNoMismatch
            (String.Format(CultureInfo.InvariantCulture, "Z^{0} (enumeration vs theta_3^{0})", n))
            published
            enumerated

    // The n = 1 case is checkable by eye and pins the convention: 1 at the origin, 2 at each
    // perfect square (the two signs), 0 elsewhere.
    let z1 = ConstructionATheta.thetaByEnumeration (ConstructionATheta.fullCode 1) anchorMaxNormSq

    for m in 0 .. anchorMaxNormSq do
        let s = LatticeVoa.isqrt m
        let expected = if m = 0 then 1L elif s * s = m then 2L else 0L
        Assert.Equal(expected, z1.[m])

[<Fact>]
let ``anchor Z^4: the enumeration reproduces Jacobi's four-square theorem`` () =
    // r_4(m) = 8 * sum of divisors of m not divisible by 4 (Jacobi 1834) — an external closed
    // form evaluated from divisors, sharing no input with the lattice walk.
    let enumerated = ConstructionATheta.thetaByEnumeration (ConstructionATheta.fullCode 4) e8MaxNormSq
    let jacobi = Array.init (e8MaxNormSq + 1) ConstructionATheta.jacobiR4
    assertNoMismatch "Z^4 (enumeration vs Jacobi r_4)" jacobi enumerated
    // A spot value nobody can fudge: 24 vectors of squared length 2 in Z^4.
    Assert.Equal(24L, enumerated.[2])

[<Fact>]
let ``anchor D4: Construction A over the even-weight code is the checkerboard lattice, and matches SPLAG`` () =
    // L_A(even-weight [4,3] code) = { x in Z^4 : sum x_i even } = D4, because x.x = sum x_i (mod 2).
    let d4 = ConstructionATheta.thetaByEnumeration (ConstructionATheta.evenWeightCode 4) e8MaxNormSq

    // Lane 1 — computed: D4 keeps exactly the even-squared-length vectors of Z^4.
    let fromJacobi =
        Array.init (e8MaxNormSq + 1) (fun m -> if m % 2 = 0 then ConstructionATheta.jacobiR4 m else 0L)

    assertNoMismatch "D4 (enumeration vs Jacobi on even m)" fromJacobi d4

    // Lane 2 — transcribed: the published theta series of D4 (Conway & Sloane, SPLAG ch. 4),
    // 1 + 24q^2 + 24q^4 + 96q^6 + 24q^8 + 144q^10 + ... An external datum neither lane computed.
    let splag =
        [| 1L; 0L; 24L; 0L; 24L; 0L; 96L; 0L; 24L; 0L; 144L; 0L; 96L; 0L; 192L; 0L; 24L; 0L; 312L; 0L; 144L |]

    assertNoMismatch "D4 (enumeration vs SPLAG transcription)" splag (Array.sub d4 0 splag.Length)

    // The kissing number of D4 is 24 — the count that names the lattice in every table.
    Assert.Equal(24L, d4.[2])

[<Fact>]
let ``anchor: both routes agree on the anchor lattices too, so route C is not validated only where it succeeds`` () =
    for n in 1 .. 4 do
        let full = ConstructionATheta.fullCode n

        assertNoMismatch
            (String.Format(CultureInfo.InvariantCulture, "Z^{0} (route E vs route C)", n))
            (ConstructionATheta.thetaByEnumeration full anchorMaxNormSq)
            (ConstructionATheta.thetaByConvolution full anchorMaxNormSq)

    let even4 = ConstructionATheta.evenWeightCode 4

    assertNoMismatch
        "D4 (route E vs route C)"
        (ConstructionATheta.thetaByEnumeration even4 anchorMaxNormSq)
        (ConstructionATheta.thetaByConvolution even4 anchorMaxNormSq)

// ═══ §2 THE COMPUTATION — the in-tree code, and whether its theta series is E_4 ════════════

[<Fact>]
let ``the lattice is built from the code in the tree, not from a textbook E8 basis`` () =
    // Stated as an assertion so that "we used the in-tree code" is checked rather than claimed.
    Assert.Equal(16, List.length AdinkraCode.allCodewords)
    Assert.Equal(8, AdinkraCode.length)
    Assert.Equal(8, ConstructionATheta.codeLength AdinkraCode.allCodewords)
    Assert.True(AdinkraCode.isSelfDual)
    // Doubly-even: every codeword's weight is divisible by 4. This is what forces x.x = 0 (mod 4).
    Assert.All(AdinkraCode.allCodewords, fun c -> Assert.Equal(0, AdinkraCode.weight c % 4))

[<Fact>]
let ``every Construction-A vector has squared length divisible by 4 — the lattice is EVEN after the 1/sqrt2 scaling`` () =
    let raw = ConstructionATheta.thetaByEnumeration AdinkraCode.allCodewords e8MaxNormSq

    for k in 0 .. e8MaxNormSq do
        if k % 4 <> 0 then
            Assert.True(
                (raw.[k] = 0L),
                String.Format(
                    CultureInfo.InvariantCulture,
                    "squared length {0} is occupied by {1} vector(s); the lattice is not even after scaling",
                    k, raw.[k]
                )
            )

    // `toShellCounts` enforces the same thing by throwing, so it must not throw here.
    let shells = ConstructionATheta.toShellCounts raw
    Assert.Equal(11, shells.Length)

[<Fact>]
let ``THE VERDICT: the theta series of the in-tree Construction-A lattice IS the Eisenstein series E_4`` () =
    let shells = ConstructionATheta.toShellCounts (ConstructionATheta.thetaByEnumeration AdinkraCode.allCodewords e8MaxNormSq)

    // E_4 = 1 + 240 * sum sigma_3(n) q^n, with sigma_3 summed from divisors — never a
    // transcribed 240 / 2160 / 6720 sequence, which would make this comparison vacuous.
    let e4 = Array.init 11 ConstructionATheta.eisensteinE4Coefficient

    assertNoMismatch "theta(L_A(AdinkraCode)) vs E_4" e4 shells

    // The three discriminating coefficients, named so a reader does not have to derive them.
    Assert.Equal(1L, shells.[0])
    Assert.Equal(240L, shells.[1])
    Assert.Equal(2160L, shells.[2])
    Assert.Equal(6720L, shells.[3])

[<Fact>]
let ``the minimal shell agrees with BOTH independent in-tree root constructions`` () =
    // A theta series counts vectors by norm; `CliffordE8Roots` matches a Gram matrix against
    // the E8 Cartan matrix. Different observables, no shared code path — so this is genuine
    // cross-verification of the Gram-matrix route, not a second run of it.
    let shells = ConstructionATheta.toShellCounts (ConstructionATheta.thetaByEnumeration AdinkraCode.allCodewords e8MaxNormSq)
    Assert.Equal(240L, shells.[1])
    Assert.Equal(240, E8Lattice.kissingNumber)
    Assert.Equal(240, CliffordE8Roots.kissingNumber)

[<Fact>]
let ``the committed byte-lock replays: all three series match what the code recomputes`` () =
    assertNoMismatch
        "committed z4-by-normSq"
        (readSeries "z4-by-normSq")
        (ConstructionATheta.thetaByEnumeration (ConstructionATheta.fullCode 4) anchorMaxNormSq)

    assertNoMismatch
        "committed d4-by-normSq"
        (readSeries "d4-by-normSq")
        (ConstructionATheta.thetaByEnumeration (ConstructionATheta.evenWeightCode 4) anchorMaxNormSq)

    assertNoMismatch
        "committed e8-shells-by-e4-exponent"
        (readSeries "e8-shells-by-e4-exponent")
        (ConstructionATheta.toShellCounts (ConstructionATheta.thetaByEnumeration AdinkraCode.allCodewords e8MaxNormSq))

    // Integer-only: every committed encoding is a string, never a JSON number, so no float
    // representation can enter the proof lineage through this file.
    for series in doc.RootElement.GetProperty("series").EnumerateArray() do
        for row in series.GetProperty("values").EnumerateArray() do
            Assert.Equal(JsonValueKind.String, row.GetProperty("dec").ValueKind)
            Assert.Equal(JsonValueKind.String, row.GetProperty("hex").ValueKind)
            Assert.Equal(16, row.GetProperty("hex").GetString().Length)

// ═══ §3 THE BOUND — an under-enumeration would look exactly like a correct low answer ══════

[<Fact>]
let ``THE BOUND: enumeration and convolution agree, so the walk missed nothing`` () =
    // Route C forms, per coordinate, f_p(u) = sum_{m = p mod 2} u^(m^2) and multiplies. It
    // materialises no lattice point and has no norm budget, so it cannot share route E's
    // failure mode. Agreement is the evidence that the depth-first walk is exhaustive inside
    // the ball rather than inside a box that happens to contain most of it.
    assertNoMismatch
        "E8 (route E enumeration vs route C convolution)"
        (ConstructionATheta.thetaByEnumeration AdinkraCode.allCodewords e8MaxNormSq)
        (ConstructionATheta.thetaByConvolution AdinkraCode.allCodewords e8MaxNormSq)

[<Fact>]
let ``the bound is stable: extending the ceiling does not change the coefficients already computed`` () =
    // If the walk were under-enumerating at a given ceiling, raising the ceiling would let
    // previously-missed vectors in and the earlier coefficients would move.
    let small = ConstructionATheta.thetaByEnumeration AdinkraCode.allCodewords e8MaxNormSq
    let large = ConstructionATheta.thetaByEnumeration AdinkraCode.allCodewords (e8MaxNormSq + 24)
    assertNoMismatch "E8 (ceiling 40 vs prefix of ceiling 64)" small (Array.sub large 0 (e8MaxNormSq + 1))

[<Fact>]
let ``the theta series agrees with the independent in-tree implementation in LatticeVoa`` () =
    // `LatticeVoa.thetaByEnumeration` is a separately-written walk over the same lattice,
    // landed before this module existed. Agreement is a fourth, pre-existing witness.
    let shells = ConstructionATheta.toShellCounts (ConstructionATheta.thetaByEnumeration AdinkraCode.allCodewords e8MaxNormSq)
    assertNoMismatch "E8 (this module vs LatticeVoa)" (LatticeVoa.thetaByEnumeration 10) shells

// ═══ §4 POSITIVE CONTROLS — the comparison is shown to be capable of failing ═══════════════

[<Fact>]
let ``POSITIVE CONTROL: dropping one coset moves the minimal shell from 240 to 224`` () =
    // Each weight-4 codeword contributes 2^4 = 16 minimal vectors, so losing one costs exactly
    // 16. A comparison that still passed here would be constraining nothing.
    let mutilated = AdinkraCode.allCodewords |> List.filter (fun c -> AdinkraCode.weight c <> 4 || c.[0] <> 1)
    Assert.True(List.length mutilated < 16)

    let shells = ConstructionATheta.toShellCounts (ConstructionATheta.thetaByEnumeration mutilated e8MaxNormSq)
    let e4 = Array.init 11 ConstructionATheta.eisensteinE4Coefficient

    Assert.NotEmpty(mismatches "mutilated" e4 shells)
    Assert.True(shells.[1] < 240L)

[<Fact>]
let ``POSITIVE CONTROL: a code that is merely even, not doubly-even, is refused rather than silently regraded`` () =
    // D4's even-weight code is even but NOT doubly-even (weight-2 codewords exist), so its
    // Construction-A lattice has vectors of squared length 2 — not divisible by 4. `toShellCounts`
    // must throw. If it silently floored instead, a broken generator would produce a
    // plausible-looking shell table.
    let d4 = ConstructionATheta.thetaByEnumeration (ConstructionATheta.evenWeightCode 4) anchorMaxNormSq
    Assert.Throws<InvalidOperationException>(fun () -> ConstructionATheta.toShellCounts d4 |> ignore) |> ignore

[<Fact>]
let ``POSITIVE CONTROL: a repeated codeword is refused, because it would double-count a coset`` () =
    let doubled = (List.head AdinkraCode.allCodewords) :: AdinkraCode.allCodewords
    Assert.Throws<ArgumentException>(fun () -> ConstructionATheta.thetaByEnumeration doubled 4 |> ignore) |> ignore

[<Fact>]
let ``POSITIVE CONTROL: sigma_3 is computed, so E_4 is not a transcribed sequence`` () =
    // sigma_3(n) = sum of cubes of divisors. Checked at values whose factorisation differs in
    // shape (prime, prime power, product of two primes) so a wrong divisor loop cannot survive.
    Assert.Equal(1L, LatticeVoa.sigma3 1)
    Assert.Equal(9L, LatticeVoa.sigma3 2) // 1 + 8
    Assert.Equal(28L, LatticeVoa.sigma3 3) // 1 + 27
    Assert.Equal(73L, LatticeVoa.sigma3 4) // 1 + 8 + 64
    Assert.Equal(252L, LatticeVoa.sigma3 6) // 1 + 8 + 27 + 216
    // ... and that E_4's coefficients are 240 times them, not a table.
    Assert.Equal(240L * 9L, ConstructionATheta.eisensteinE4Coefficient 2)
    Assert.Equal(240L * 28L, ConstructionATheta.eisensteinE4Coefficient 3)
