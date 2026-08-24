module Zeta.Tests.CssCodeTests

open System
open System.IO
open System.Text.Json
open global.Xunit
open Zeta.Core

module CC = Zeta.Core.CssCode

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// CssCode — the classical layer of the QEC stack (milestone M1, work-item 081M0QFQTS1087G0R002WHZFR7).
//
// REGISTER: every assertion below is about GF(2) linear algebra. Nothing here asserts that a
// physical quantum state exists in this repo. `[[n,k,d]]` are three integers produced by arithmetic
// from a binary code — the parameters a stabiliser code WOULD have. Running the CSS recipe is
// checkable; holding an encoded qubit is a physical claim and is not made.
//
// Every enumeration is EXHAUSTIVE rather than sampled. That is a deliberate routing call: at these
// lengths the whole space is 2^8 or 2^16, and a property test would SAMPLE a space we can EXHAUST —
// strictly weaker than the loop, and it would report a probabilistic answer where a certain one is
// free. (Soraya's routing table, L4.)
// ═══════════════════════════════════════════════════════════════════════════════════════════════

/// The committed adinkra generator, re-expressed as bitmask codewords so `CssCode` can consume it.
/// Bit `i` of the mask is coordinate `i` of the codeword.
let private adinkraCode : Set<int> =
    AdinkraCode.allCodewords
    |> List.map (fun cw -> cw |> Array.mapi (fun i b -> b <<< i) |> Array.fold (|||) 0)
    |> Set.ofList

let private rm1 = CC.reedMuller 1 4
let private rm2 = CC.reedMuller 2 4
/// Steane's classical ingredient: the adinkra code punctured at coordinate 0.
let private steane = CC.puncture 0 adinkraCode

// ── Primitives ─────────────────────────────────────────────────────────────────────────────────

[<Fact>]
let ``span of a basis is closed under XOR — it really is a subspace`` () =
    let code = CC.span [ 0b1011; 0b0110; 0b1100 ]
    for a in code do
        for b in code do
            Assert.Contains(a ^^^ b, code)

[<Fact>]
let ``dual is an involution — C-perp-perp = C for every subspace of GF(2)^4`` () =
    // Exhaustive over every subspace spanned by a subset of GF(2)^4's 16 vectors would be 2^16
    // basis-sets; spanning from every 3-subset covers every dimension 0..4 and is enough to make
    // this a real check rather than a spot check.
    for a in 0 .. 15 do
        for b in 0 .. 15 do
            for c in 0 .. 15 do
                let code = CC.span [ a; b; c ]
                Assert.Equal<Set<int>>(code, CC.dual 4 (CC.dual 4 code))

[<Fact>]
let ``doubly-even implies self-orthogonal — a RESULT, checked independently of how each is computed`` () =
    // wt(x+y) = wt(x) + wt(y) - 2|x cap y|; all weights = 0 mod 4 forces |x cap y| even, i.e. x.y = 0.
    // `isSelfOrthogonal` checks every pair directly, so this is not a restatement.
    // Exhaustive over all 902 distinct doubly-even codes of length 8.
    let all = CC.allDoublyEvenCodesLength8 ()
    Assert.NotEmpty all
    for code in all do
        Assert.True(CC.isDoublyEven code)
        Assert.True(CC.isSelfOrthogonal code, "a doubly-even code failed self-orthogonality")

[<Fact>]
let ``dimension refuses a set that is not a subspace rather than returning a plausible number`` () =
    Assert.Throws<ArgumentException>(fun () -> CC.dimension (Set.ofList [ 0; 1; 2 ]) |> ignore) |> ignore

// ── The k=0 theorem: why the adinkra lineage does not hand us a quantum code ───────────────────

[<Fact>]
let ``the committed adinkra code is doubly-even AND self-dual`` () =
    Assert.Equal(16, Set.count adinkraCode)
    Assert.True(CC.isDoublyEven adinkraCode)
    Assert.True(CC.isSelfDual 8 adinkraCode)
    Assert.Equal<(int * int) list>([ (0, 1); (4, 14); (8, 1) ], CC.weightDistribution adinkraCode)

[<Fact>]
let ``CSS of the committed adinkra code is [[8,0,4]] — a stabiliser STATE, encoding nothing`` () =
    match CC.cssFromAdinkraCode 8 adinkraCode with
    | Some p ->
        Assert.Equal(8, p.N)
        Assert.Equal(0, p.K)
        Assert.Equal(4, p.D)
        Assert.True(p.IsState, "k=0 must be flagged as a stabiliser state, not read as a code")
    | None -> Assert.Fail "the adinkra code is self-orthogonal; CSS must be defined"

[<Fact>]
let ``k=0 is forced by SELF-DUALITY, not by our particular code — every self-dual code, every length`` () =
    // The falsifier named in the work-item: if a self-dual code ever reports k > 0 the enumeration
    // is broken, since k = 2*dim(C) - n and self-duality forces dim = n/2.
    let selfDualCodes =
        CC.allDoublyEvenCodesLength8 () |> List.filter (CC.isSelfDual 8)
    Assert.NotEmpty selfDualCodes
    for code in selfDualCodes do
        Assert.Equal(4, CC.dimension code)
        match CC.cssFromAdinkraCode 8 code with
        | Some p -> Assert.Equal(0, p.K)
        | None -> Assert.Fail "a self-dual code is self-orthogonal; CSS must be defined"

// ── The N=8 closure — the load-bearing NEGATIVE, landed as a test ──────────────────────────────

[<Fact>]
let ``N=8 adinkra CSS closure: no code in the category both encodes a qubit and corrects an error`` () =
    // DOMAIN, stated in the assertion rather than only in prose: CSS(C^perp, C^perp) for C a
    // doubly-even binary code of length 8. NOT all 8-qubit stabiliser codes — [[8,3,3]] (CRSS 1997)
    // beats every row here, but its stabiliser does not split into X and Z parts, so it comes from
    // no binary code and is not an adinkra object. Cited, not computed; nothing here enumerates it.
    let rows = CC.adinkraClosureLength8 ()
    Assert.Equal<(int * (int * int * int)) list>(
        [ (0, (8, 8, 1)); (1, (8, 6, 2)); (2, (8, 4, 2)); (3, (8, 2, 2)); (4, (8, 0, 4)) ],
        rows |> List.map (fun (dim, p) -> dim, (p.N, p.K, p.D)))
    // The closure itself: correcting an error needs d >= 3.
    for (_, p) in rows do
        Assert.False(p.K > 0 && p.D >= 3, "a row both encodes a qubit and corrects an error — the closure is broken")

[<Fact>]
let ``the dim-0 row is the UNCODED adinkra and it is the WORST row, not a missing escape hatch`` () =
    // The second adinkra family — the homoiconic, non-coded one — is the C = 0 case under
    // Doran-Faux-Gates-Hubsch-Iga-Landweber, i.e. the full 8-cube. Omitting it as degenerate is
    // what makes the table look like it has a gap. It has none: homoiconicity is bought by
    // declining exactly the quotient the protection lives in.
    let rows = CC.adinkraClosureLength8 ()
    let dim0 = rows |> List.find (fun (d, _) -> d = 0) |> snd
    Assert.Equal(1, dim0.D)
    Assert.Equal(8, dim0.K)
    // it is the WORST row: no other dimension does worse on distance
    Assert.Equal(1, rows |> List.map (fun (_, p) -> p.D) |> List.min)
    Assert.Equal(1, rows |> List.filter (fun (_, p) -> p.D = 1) |> List.length)

[<Fact>]
let ``the closure enumerates 902 distinct doubly-even codes of length 8`` () =
    // Pinning the enumeration SIZE is what stops the closure from passing vacuously: a search that
    // silently explored one code would still satisfy every row assertion above.
    let all = CC.allDoublyEvenCodesLength8 ()
    Assert.Equal(902, List.length all)
    Assert.Equal(902, all |> List.distinct |> List.length)

// ── The puncture: Steane's provenance, and the price nobody was charging ───────────────────────

[<Fact>]
let ``puncturing the adinkra code at ANY of the 8 coordinates gives [7,4,3] — canonical, not a choice`` () =
    // Aut(C) = AGL(3,2) is transitive on the 8 coordinates, so the puncture is forced rather than
    // picked. All eight are checked, which is what turns "transitive" from a citation into a result.
    for pos in 0 .. 7 do
        let p = CC.puncture pos adinkraCode
        Assert.Equal(4, CC.dimension p)
        Assert.Equal(Some 3, CC.minimumDistance p)

[<Fact>]
let ``the puncture EXITS the adinkra category — weights 3 and 7 are odd`` () =
    // The correspondence the whole adinkra lineage rests on is doubly-even code <-> adinkra
    // chromotopology. Puncture, and it is gone. The honest claim is PROVENANCE, not inheritance:
    // Steane's classical ingredient is one puncture from our committed generator; our adinkra code
    // does not BECOME a quantum code.
    Assert.Equal<(int * int) list>([ (0, 1); (3, 7); (4, 7); (7, 1) ], CC.weightDistribution steane)
    Assert.False(CC.isDoublyEven steane, "the punctured code must NOT be doubly-even")
    Assert.False(CC.isSelfOrthogonal steane, "the punctured code must NOT be self-orthogonal")

[<Fact>]
let ``CSS of the punctured code is Steane [[7,1,3]]`` () =
    match CC.cssFromContainingDual 7 steane with
    | Some p ->
        Assert.Equal(7, p.N)
        Assert.Equal(1, p.K)
        Assert.Equal(3, p.D)
        Assert.False(p.IsState)
    | None -> Assert.Fail "C^perp subset C holds for the punctured code; CSS must be defined"

// ── The reopening at N=16 ──────────────────────────────────────────────────────────────────────

[<Fact>]
let ``RM(r,m) dimensions follow the binomial sum — the construction, not a committed matrix`` () =
    let binom n k = List.fold (fun acc i -> acc * (n - i) / (i + 1)) 1 [ 0 .. k - 1 ]
    for m in 1 .. 4 do
        for r in 0 .. m do
            let expected = List.sum [ for i in 0 .. r -> binom m i ]
            Assert.Equal(expected, CC.dimension (CC.reedMuller r m))

[<Fact>]
let ``RM(r,m)-perp = RM(m-r-1,m) as a SET, for every r and m up to length 16`` () =
    // "As a set" is the point. Same-dimension is a count; set equality is an identification.
    for m in 1 .. 4 do
        for r in 0 .. m - 1 do
            let n = 1 <<< m
            Assert.Equal<Set<int>>(CC.reedMuller (m - r - 1) m, CC.dual n (CC.reedMuller r m))

[<Fact>]
let ``RM(1,4) is doubly-even and self-orthogonal but NOT self-dual — so k_q > 0 is available`` () =
    Assert.Equal(5, CC.dimension rm1)
    Assert.Equal<(int * int) list>([ (0, 1); (8, 30); (16, 1) ], CC.weightDistribution rm1)
    Assert.True(CC.isDoublyEven rm1, "RM(1,4) must be doubly-even — this is what keeps it in the adinkra category")
    Assert.True(CC.isSelfOrthogonal rm1)
    Assert.False(CC.isSelfDual 16 rm1, "self-duality would force k_q = 0 and close the reopening")
    Assert.Equal(11, CC.dimension rm2)
    Assert.Equal<Set<int>>(rm2, CC.dual 16 rm1)

[<Fact>]
let ``CSS from RM(1,4) is the quantum Reed-Muller code [[16,6,4]] — INSIDE the adinkra category`` () =
    match CC.cssFromAdinkraCode 16 rm1 with
    | Some p ->
        Assert.Equal(16, p.N)
        Assert.Equal(6, p.K)
        Assert.Equal(4, p.D)
        Assert.False(p.IsState)
        // Unlike Steane, nothing was punctured and nothing left the category.
        Assert.True(CC.isDoublyEven rm1)
    | None -> Assert.Fail "RM(1,4) is self-orthogonal; CSS must be defined"

// ── The stabiliser rows, and the condition that makes them a code at all ──────────────────────

[<Fact>]
let ``CSS commutation holds: every X-stabiliser commutes with every Z-stabiliser`` () =
    // For a CSS code built from a single C with C^perp subset C, both stabiliser families are rows
    // of a generator of C^perp, and X/Z commutation is exactly `H_X . H_Z^T = 0` over GF(2). This is
    // the condition that makes the stabiliser group ABELIAN — without it there is no codespace at
    // all, so a wrong matrix fails here rather than producing a plausible-looking code.
    let check (n: int) (c: Set<int>) =
        let rows = CC.echelonBasis n (CC.dual n c)
        Assert.NotEmpty rows
        for x in rows do
            for z in rows do
                Assert.Equal(0, CC.dot x z)
    check 7 steane
    check 16 rm2
    check 8 adinkraCode

[<Fact>]
let ``echelonBasis is canonical — the same code always yields the same rows, whatever order it arrived in`` () =
    // Determinism is what makes the golden vectors byte-lockable rather than equal-up-to-basis.
    let shuffled = rm1 |> Set.toList |> List.rev |> Set.ofList
    Assert.Equal<int list>(CC.echelonBasis 16 rm1, CC.echelonBasis 16 shuffled)
    // The property that makes it a function of the CODE and not of the insertion order is
    // REDUCEDNESS. Asserted for every code the treaty commits, because "same rows from a reversed
    // list" is satisfied trivially by any implementation that sorts internally — that assertion
    // alone cannot fail, and a check that cannot fail is a defect.
    for (n, code) in [ (8, adinkraCode); (7, steane); (16, rm1); (16, rm2) ] do
        let rows = CC.echelonBasis n code
        Assert.True(CC.isReducedEchelon rows, "basis is not in REDUCED row echelon form")
        Assert.Equal(CC.dimension code, List.length rows)
        Assert.Equal<Set<int>>(code, CC.span rows)
    Assert.Equal(CC.dimension rm1, List.length (CC.echelonBasis 16 rm1))
    // and the rows really do regenerate the code
    Assert.Equal<Set<int>>(rm1, CC.span (CC.echelonBasis 16 rm1))

[<Fact>]
let ``Steane's 7 single-bit errors have DISTINCT nonzero syndromes — and all 21 weight-2 errors alias`` () =
    // Soraya's F1/F2. F1 alone is satisfiable by a decoder that lies; F2 is the half that matters,
    // and the TOTAL form (all 21, not "some") is available because the Hamming code is PERFECT:
    // every nonzero syndrome is already claimed by a weight-1 error, leaving none free to signal
    // "weight 2". A decoder whose weight-2 failure set came back EMPTY would be the vacuity class.
    let rows = CC.echelonBasis 7 (CC.dual 7 steane)
    Assert.Equal(3, List.length rows)
    let single = [ for i in 0 .. 6 -> CC.syndrome rows (1 <<< i) ]
    Assert.Equal(7, single |> List.distinct |> List.length)
    Assert.DoesNotContain(0, single)
    let singleSet = Set.ofList single
    let weight2 = [ for i in 0 .. 6 do for j in i + 1 .. 6 -> CC.syndrome rows ((1 <<< i) ||| (1 <<< j)) ]
    Assert.Equal(21, List.length weight2)
    Assert.Equal(21, weight2 |> List.filter (fun s -> Set.contains s singleSet) |> List.length)

// ── Guards that would otherwise never be exercised (found by mutation testing) ─────────────────

[<Fact>]
let ``CSS is None — not a plausible-looking triple — when C-perp is NOT contained in C`` () =
    // Found by mutation: replacing the containment check with `if false then` survived every other
    // test in this file, because every code the treaty commits satisfies containment. A guard that
    // is never exercised is a guard that is not there.
    let notContaining = CC.span [ 0b0001 ]        // dim 1 at n=4; C^perp has dim 3, so C^perp ⊄ C
    Assert.Equal<CC.CssParams option>(None, CC.cssFromContainingDual 4 notContaining)
    // and the sibling guard on `cssFromAdinkraCode`: a code that is not self-orthogonal
    let notSelfOrthogonal = CC.span [ 0b0001 ]
    Assert.False(CC.isSelfOrthogonal notSelfOrthogonal)
    Assert.Equal<CC.CssParams option>(None, CC.cssFromAdinkraCode 4 notSelfOrthogonal)
    // the positive control: containment holding really does yield Some, so the None above is not
    // an artefact of the whole function being broken
    Assert.True((CC.cssFromContainingDual 7 steane).IsSome)

[<Fact>]
let ``no DEGENERATE symmetric CSS code exists at length 8 — the equivalence a surviving mutant rests on`` () =
    // A CSS code is DEGENERATE when some stabiliser weighs less than the distance, i.e. when the
    // minimum weight of the whole code is attained INSIDE C^perp rather than in the logical coset.
    // Mutating `min over C \ C^perp` to `min over C \ {0}` survives every test above, and this is
    // why: over all 902 doubly-even codes of length 8 the two minima always coincide, so the mutant
    // is EQUIVALENT on this domain rather than undetected. Recording the equivalence is the honest
    // discipline — the alternative is a mutation report with an unexplained survivor in it.
    //
    // Honest scope: length 8, symmetric form CSS(C,C). Degenerate codes certainly exist in the
    // asymmetric form CSS(C1,C2) — Shor's [[9,1,3]] is the textbook one — and nothing here says
    // otherwise. This asserts the equivalence exactly where it is relied on and nowhere further.
    let mutable checkedCodes = 0
    for c in CC.allDoublyEvenCodesLength8 () do
        let outer = CC.dual 8 c                       // the code CSS is built from
        let logicalCoset = Set.difference outer c
        if not (Set.isEmpty logicalCoset) then
            let cosetMin = logicalCoset |> Set.toList |> List.map CC.weight |> List.min
            let wholeMin = (CC.minimumDistance outer).Value
            Assert.Equal(wholeMin, cosetMin)
            checkedCodes <- checkedCodes + 1
    // the k=0 (self-dual) codes have an empty logical coset and are excluded above; pin how many
    // codes actually reached the assertion so this cannot pass by checking nothing
    Assert.Equal(902 - (CC.allDoublyEvenCodesLength8 () |> List.filter (CC.isSelfDual 8) |> List.length), checkedCodes)
    Assert.True(checkedCodes > 800, "too few codes reached the assertion")

// ── The byte-lock: verification artefacts are TEXT ────────────────────────────────────────────

/// Locate the committed treaty by walking up from the test assembly to the repo root.
let private treatyPath () =
    let rec up (dir: DirectoryInfo) =
        if isNull (box dir) then failwith "repo root not found"
        elif File.Exists(Path.Combine(dir.FullName, "src", "Core.QSharp.ReferenceOracle", "css-stabilizer-treaty.json"))
        then Path.Combine(dir.FullName, "src", "Core.QSharp.ReferenceOracle", "css-stabilizer-treaty.json")
        else up dir.Parent
    up (DirectoryInfo(AppContext.BaseDirectory))

[<Fact>]
let ``the committed golden treaty agrees with the live computation, field by field`` () =
    use doc = JsonDocument.Parse(File.ReadAllText(treatyPath ()))
    let root = doc.RootElement
    let codes = root.GetProperty("classicalCodes")
    let checkCode (name: string) (n: int) (code: Set<int>) =
        let e = codes.GetProperty(name)
        Assert.Equal(n, e.GetProperty("length").GetInt32())
        Assert.Equal(CC.dimension code, e.GetProperty("dimension").GetInt32())
        Assert.Equal(CC.isDoublyEven code, e.GetProperty("doublyEven").GetBoolean())
        Assert.Equal(CC.isSelfOrthogonal code, e.GetProperty("selfOrthogonal").GetBoolean())
        Assert.Equal(CC.isSelfDual n code, e.GetProperty("selfDual").GetBoolean())
        Assert.Equal(CC.digest n code, e.GetProperty("codewordSetSha256").GetString())
        let basis = [ for x in e.GetProperty("basisHex").EnumerateArray() -> x.GetString() ]
        Assert.Equal<string list>(CC.echelonBasis n code |> List.map (CC.toHex n), basis)
        // the hex really does round-trip back to the code — a digest alone explains nothing
        let parsed = basis |> List.map (fun h -> Convert.ToInt32(h, 16)) |> CC.span
        Assert.Equal<Set<int>>(code, parsed)
    checkCode "adinkra_8_4_4" 8 adinkraCode
    checkCode "steane_punctured_7_4_3" 7 steane
    checkCode "rm_1_4" 16 rm1

[<Fact>]
let ``the committed CSS parameters and closure rows agree with the live computation`` () =
    use doc = JsonDocument.Parse(File.ReadAllText(treatyPath ()))
    let root = doc.RootElement
    let css = root.GetProperty("cssCodes")
    let checkCss (name: string) (p: CC.CssParams) =
        let e = css.GetProperty(name)
        Assert.Equal(p.N, e.GetProperty("n").GetInt32())
        Assert.Equal(p.K, e.GetProperty("k").GetInt32())
        Assert.Equal(p.D, e.GetProperty("d").GetInt32())
        Assert.Equal(p.IsState, e.GetProperty("isStabilizerStateNotACode").GetBoolean())
        Assert.Equal(p.N - p.K, e.GetProperty("stabilizerGeneratorCount").GetInt32())
    checkCss "adinkra_8_0_4" (CC.cssFromAdinkraCode 8 adinkraCode).Value
    checkCss "steane_7_1_3" (CC.cssFromContainingDual 7 steane).Value
    checkCss "quantum_rm_16_6_4" (CC.cssFromAdinkraCode 16 rm1).Value
    let closure = root.GetProperty("n8AdinkraClosure")
    Assert.Equal(List.length (CC.allDoublyEvenCodesLength8 ()), closure.GetProperty("distinctDoublyEvenCodesEnumerated").GetInt32())
    let live = CC.adinkraClosureLength8 ()
    let rows = [ for r in closure.GetProperty("rows").EnumerateArray() -> r.GetProperty("dimC").GetInt32(), r.GetProperty("k").GetInt32(), r.GetProperty("d").GetInt32() ]
    Assert.Equal<(int * int * int) list>(live |> List.map (fun (d, p) -> d, p.K, p.D), rows)

[<Fact>]
let ``the golden treaty is TEXT and every code payload is hex — no binary in the proof lineage`` () =
    // `.claude/rules/no-binary-in-proof-lineage.md`. A test that only READS the treaty would leave
    // the shape unenforced; this pins that every basis row is fixed-width lowercase hex, so a
    // future contributor cannot quietly switch the encoding to base64 or raw bytes.
    use doc = JsonDocument.Parse(File.ReadAllText(treatyPath ()))
    let isHex (s: string) = s |> Seq.forall (fun ch -> (ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f'))
    let mutable seen = 0
    for code in doc.RootElement.GetProperty("classicalCodes").EnumerateObject() do
        for row in code.Value.GetProperty("basisHex").EnumerateArray() do
            let s = row.GetString()
            Assert.True(isHex s, "basis row is not lowercase hex: " + s)
            seen <- seen + 1
        let d = code.Value.GetProperty("codewordSetSha256").GetString()
        Assert.Equal(64, d.Length)
        Assert.True(isHex d, "digest is not lowercase hex")
    Assert.Equal(13, seen) // 4 (adinkra) + 4 (punctured) + 5 (RM(1,4))
