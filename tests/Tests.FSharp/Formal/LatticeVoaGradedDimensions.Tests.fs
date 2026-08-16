module Zeta.Tests.Formal.LatticeVoaGradedDimensionsTests

open System
open System.Globalization
open System.IO
open System.Text.Json
open global.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════════════════════════════
// LatticeVoa (`src/Core/LatticeVoa.fs`) — the GRADED DIMENSIONS of the lattice VOA V_L over
// the in-tree E8 lattice, byte-locked in `src/Core/golden-vectors-lattice-voa.json`.
//
// THE FALSIFIER (why this is `metered` and not `unmetered`): one computation is a computation;
// the check is that FOUR lanes must agree, and they were produced by disjoint means.
//
//   lane routeL     — lattice point enumeration over Construction A from AdinkraCode.generator,
//                     times the 8-colour partition series (geometric convolution).
//   lane routeM     — Eisenstein E_4 from divisor sums, times the same denominator built from
//                     Euler's pentagonal number theorem + series inversion. Reads no lattice.
//   lane published  — OEIS A007245 terms 0..8, transcribed. An external datum.
//   lane cube       — the convolution cube must equal OEIS A000521 (the j-function
//                     coefficients) — a datum neither route consumed.
//
// SCOPE, stated so no reader rounds it up: this file checks a SEQUENCE OF INTEGERS. It does not
// implement or evidence vertex operators, the VOA axioms, the Frenkel–Kac isomorphism, the
// affine E8 action, or anything about the Monster. Zhu's modular-invariance theorem quantifies
// over C2-cofinite VOAs and we have no VOA, so modularity is not claimed anywhere here.
//
// A red lane is an HONEST STOP. If the routes disagree, that disagreement IS the result — it is
// not to be reconciled by adjusting either side.
// ═══════════════════════════════════════════════════════════════════════════════════════════

let private terms = 8

let private repoRoot () =
    let mutable dir =
        DirectoryInfo(Path.GetDirectoryName(Reflection.Assembly.GetExecutingAssembly().Location))

    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent

    if isNull dir then
        failwith "Could not locate repo root (Zeta.sln)."
    else
        dir.FullName

let private vectorsPath () =
    Path.Join(repoRoot (), "src", "Core", "golden-vectors-lattice-voa.json")

let private doc = JsonDocument.Parse(File.ReadAllText(vectorsPath ()))

/// Read one committed series: each row is `{ n, dec, hex }`. The decimal and hex encodings are
/// checked against each other here, so a half-edited row fails at the read.
let private readSeries (rows: JsonElement) (lane: string) : int64[] =
    [| for i in 0 .. rows.GetArrayLength() - 1 do
           let row = rows.[i]
           let n = row.GetProperty("n").GetInt32()

           Assert.True(
               (n = i),
               String.Format(CultureInfo.InvariantCulture, "lane={0} index n={1}: row is out of order (declares n={2})", lane, i, n)
           )

           let dec = Int64.Parse(row.GetProperty("dec").GetString(), CultureInfo.InvariantCulture)
           let hex = LatticeVoa.ofHex (row.GetProperty("hex").GetString())

           Assert.True(
               (dec = hex),
               String.Format(
                   CultureInfo.InvariantCulture,
                   "lane={0} index n={1}: dec/hex encodings disagree (dec={2}, hex decodes to {3})",
                   lane, i, dec, hex
               )
           )

           yield dec |]

/// Compare a computed series against a committed lane; returns one message per mismatch,
/// each naming the lane and the index. Returning (rather than asserting) lets the mutation
/// positive-control below assert that the comparison CAN fail.
let private mismatches (lane: string) (expected: int64[]) (actual: int64[]) : string list =
    [ if expected.Length <> actual.Length then
          yield
              String.Format(
                  CultureInfo.InvariantCulture,
                  "lane={0}: length mismatch (committed {1} terms, computed {2})",
                  lane, expected.Length, actual.Length
              )

      for i in 0 .. (min expected.Length actual.Length) - 1 do
          if expected.[i] <> actual.[i] then
              yield
                  String.Format(
                      CultureInfo.InvariantCulture,
                      "lane={0} index n={1}: committed {2}, computed {3}",
                      lane, i, expected.[i], actual.[i]
                  ) ]

let private assertNoMismatch (lane: string) (expected: int64[]) (actual: int64[]) =
    let ms = mismatches lane expected actual
    Assert.True(List.isEmpty ms, String.Join("; ", ms))

let private committedDims = readSeries (doc.RootElement.GetProperty("gradedDimensions")) "gradedDimensions"
let private committedTheta = readSeries (doc.RootElement.GetProperty("thetaSeries").GetProperty("values")) "thetaSeries"
let private committedEta = readSeries (doc.RootElement.GetProperty("etaPowMinus8").GetProperty("values")) "etaPowMinus8"
let private committedOeis = readSeries (doc.RootElement.GetProperty("oeisA007245").GetProperty("values")) "published(oeis-a007245)"

let private committedCube =
    readSeries (doc.RootElement.GetProperty("convolutionCubeA000521").GetProperty("values")) "cube(oeis-a000521)"

// ── The vector itself ──────────────────────────────────────────────────────────────────────

[<Fact>]
let ``the golden vector is present, integer-only, and covers 9 terms`` () =
    Assert.Equal("lattice-voa-graded-dimensions-v1", doc.RootElement.GetProperty("format").GetString())
    Assert.Equal(terms + 1, doc.RootElement.GetProperty("terms").GetInt32())
    Assert.Equal(terms + 1, committedDims.Length)
    // Integer-only: every committed encoding is a string, never a JSON number, so no float
    // representation can enter the proof lineage through this file.
    for row in doc.RootElement.GetProperty("gradedDimensions").EnumerateArray() do
        Assert.Equal(JsonValueKind.String, row.GetProperty("dec").ValueKind)
        Assert.Equal(JsonValueKind.String, row.GetProperty("hex").ValueKind)
        Assert.Equal(16, row.GetProperty("hex").GetString().Length)

// ── lane routeL — the lattice route ────────────────────────────────────────────────────────

[<Fact>]
let ``lane routeL: lattice enumeration times geometric partitions reproduces the committed dimensions`` () =
    assertNoMismatch "routeL(lattice-theta*eta^-8)" committedDims (LatticeVoa.gradedDimensionsLattice terms)

[<Fact>]
let ``lane routeL: the enumerated theta series matches the committed one and its minimum shell is the in-tree kissing number`` () =
    let theta = LatticeVoa.thetaByEnumeration terms
    assertNoMismatch "routeL(theta by enumeration)" committedTheta theta
    // Cross-check against the independently-constructed in-tree root list.
    Assert.Equal(int64 E8Lattice.kissingNumber, theta.[1])
    Assert.Equal(240L, theta.[1])

// ── lane routeM — the modular route ────────────────────────────────────────────────────────

[<Fact>]
let ``lane routeM: Eisenstein divisor sums times the pentagonal inverse reproduces the committed dimensions`` () =
    assertNoMismatch "routeM(E4*eta^-8)" committedDims (LatticeVoa.gradedDimensionsEisenstein terms)

[<Fact>]
let ``lane routeM: E_4 from divisor sums equals the enumerated theta series`` () =
    // Disjoint inputs: one counts lattice points, the other sums cubes of divisors.
    assertNoMismatch "routeM(E4 numerator)" committedTheta (LatticeVoa.eisensteinE4 terms)

[<Fact>]
let ``both eta^-8 algorithms agree with the committed denominator`` () =
    assertNoMismatch "routeL(eta^-8 geometric)" committedEta (LatticeVoa.etaPowMinus8Geometric terms)
    assertNoMismatch "routeM(eta^-8 pentagonal)" committedEta (LatticeVoa.etaPowMinus8Pentagonal terms)

// ── The independence check itself ──────────────────────────────────────────────────────────

[<Fact>]
let ``THE FALSIFIER: the two routes agree term by term`` () =
    let l = LatticeVoa.gradedDimensionsLattice terms
    let m = LatticeVoa.gradedDimensionsEisenstein terms
    assertNoMismatch "routeL-vs-routeM" l m

[<Fact>]
let ``lane published: the committed dimensions equal the transcribed OEIS A007245 terms`` () =
    assertNoMismatch "published(oeis-a007245)" committedOeis committedDims

[<Fact>]
let ``lane cube: the convolution cube of the graded dimensions equals the committed j coefficients`` () =
    // OEIS A007245's own formula line: "Convolution cube is A000521 (the modular j-function)".
    // Neither route reads any j datum, so this tests the whole product against an outside number.
    assertNoMismatch "cube(oeis-a000521)" committedCube (LatticeVoa.convolutionCube terms committedDims)

// ── Numerology guard: 248 is forced, not found ─────────────────────────────────────────────

[<Fact>]
let ``248 at grade 1 is an identity, not a count match: rank + roots`` () =
    // `numerology-vs-number-theory`: 248 is also dim E8 (the Lie algebra), and a bare count
    // would not discriminate. Here nothing is matched — for any even lattice, (V_L)_1 is the
    // Cartan part plus one basis vector per root, so the coefficient is FORCED to be
    // rank + |roots| = 8 + 240. This test asserts that identity from in-tree values.
    Assert.Equal(int64 LatticeVoa.rank + int64 E8Lattice.kissingNumber, committedDims.[1])
    Assert.Equal(248L, committedDims.[1])

// ── Vacuity guard: the check can fail ──────────────────────────────────────────────────────

[<Fact>]
let ``positive control: perturbing one graded dimension is reported with its lane and index`` () =
    // A check that cannot fail is not a check. Perturb grade 3 by one and confirm the comparison
    // names both the lane and the index — the same message a disk-level mutation produces.
    let perturbed = Array.copy committedDims
    perturbed.[3] <- perturbed.[3] + 1L
    let ms = mismatches "routeL(lattice-theta*eta^-8)" perturbed (LatticeVoa.gradedDimensionsLattice terms)
    Assert.Single(ms) |> ignore
    Assert.Contains("lane=routeL(lattice-theta*eta^-8)", List.head ms, StringComparison.Ordinal)
    Assert.Contains("index n=3", List.head ms, StringComparison.Ordinal)
    // ...and the unperturbed comparison still passes, so the control is not merely always-red.
    Assert.Empty(mismatches "routeL(lattice-theta*eta^-8)" committedDims (LatticeVoa.gradedDimensionsLattice terms))

// ── Encoding discipline ────────────────────────────────────────────────────────────────────

[<Fact>]
let ``hex round-trips every committed value (hex-in-JSON, never a binary blob)`` () =
    for v in committedDims do
        Assert.Equal(v, LatticeVoa.ofHex (LatticeVoa.toHex v))

    for v in committedCube do
        Assert.Equal(v, LatticeVoa.ofHex (LatticeVoa.toHex v))
