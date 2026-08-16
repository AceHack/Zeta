module Zeta.Tests.ZetaIrMinimalSetTests

open System
open System.IO
open global.Xunit
open Zeta.Core

// =====================================================================================
//  The irreducible core of the zeta-ir grammar — DERIVABILITY, executed.
//
//  Every claim in this file is checked THROUGH the committed evaluator
//  (`ZetaIrNormalizer.evalOp64` / `evalOp32`) at BOTH supported widths, and the
//  end-to-end reductions are replayed against the COMMITTED GOLDEN VECTORS under
//  `tests/cross-verification/*/vectors.yaml`.
//
//  This replaces an earlier version of this file whose three properties compared an
//  inline re-implementation to ITSELF (`x ^^^ (x >>> s) = x ^^^ (x >>> s)`) and never
//  mentioned `ZetaIrV4` or the evaluator. Those were tautologies: they pass with the
//  op set deleted, so they falsified nothing. See
//  `docs/research/2026-08-15-zeta-ir-irreducible-core-derivability-vs-portability.md`.
// =====================================================================================

// ── the referent: the committed evaluator, dispatched on ir.Width ────────────────────

let private evalIr (width: int) (ops: ZetaIrV4.Op list) (x: uint64) : uint64 =
    if width = 64 then
        ops |> List.fold (fun s op -> ZetaIrNormalizer.evalOp64 op s) x
    elif width = 32 then
        ops
        |> List.fold (fun s op -> uint64 (ZetaIrNormalizer.evalOp32 op (uint32 s))) (x &&& 0xFFFFFFFFUL)
    else
        failwithf "unsupported width %d (SUPPORTED_WIDTHS is [32; 64])" width

let private maskOf (width: int) =
    if width = 64 then UInt64.MaxValue else (1UL <<< width) - 1UL

/// A fixed probe set: the edge words plus a seeded pseudo-random spread. Seeded and
/// computed once per width, so the check replays deterministically (DST) and the
/// exhaustive loops below stay cheap.
let private probeTable =
    let build (width: int) =
        let mask = maskOf width
        let rnd = Random(20260815)
        [ 0UL; 1UL; 2UL; 3UL; mask; mask - 1UL; 1UL <<< (width - 1); 0x0123456789ABCDEFUL &&& mask ]
        @ [ for _ in 1..512 -> ((uint64 (rnd.Next()) <<< 32) ||| uint64 (rnd.Next())) &&& mask ]
    dict [ 32, build 32; 64, build 64 ]

let private probes (width: int) : uint64 list = probeTable.[width]

/// Denotational equality of two op sequences at a width, over the probe set.
let private denoteEqual (width: int) (a: ZetaIrV4.Op list) (b: ZetaIrV4.Op list) =
    probes width |> List.forall (fun x -> evalIr width a x = evalIr width b x)

let private widths = [ 32; 64 ]

// ── the two reductions ON FILE (6 -> core four), through the evaluator ───────────────

[<Fact>]
let ``XorShr s reduces to XShrXor [s] -- through the evaluator, every shift, both widths`` () =
    for w in widths do
        for s in 0 .. w - 1 do
            Assert.True(
                denoteEqual w [ ZetaIrV4.XorShr(int64 s) ] [ ZetaIrV4.XShrXor [ int64 s ] ],
                sprintf "XorShr %d <> XShrXor [%d] at width %d" s s w)

[<Fact>]
let ``Rotl r reduces to XRotXor [0; r] -- through the evaluator, every rotation, both widths`` () =
    for w in widths do
        for r in 0 .. w - 1 do
            Assert.True(
                denoteEqual w [ ZetaIrV4.Rotl(int64 r) ] [ ZetaIrV4.XRotXor [ 0L; int64 r ] ],
                sprintf "Rotl %d <> XRotXor [0; %d] at width %d" r r w)

// The Lean soundness proof for these two (src/Core.Lean4/Lean4/NormalizerCorrect.lean) is
// stated over UInt64 ONLY — there is no width-32 statement anywhere in it. The two checks
// above are the width-32 half, executed rather than proved.
[<Fact>]
let ``the normalizer preserves denotation on every known IR, at its own width`` () =
    let known =
        [ ZetaIrV4.ofV1 ZetaIrV1.fmix64
          ZetaIrV4.ofV2 ZetaIrV2.xoshiro256ss
          ZetaIrV4.ofV3 ZetaIrV3.nasam ]
        @ ZetaIrV4.known
    for ir in known do
        let normalized = ZetaIrNormalizer.normalize ir
        Assert.True(
            normalized.Ops |> List.forall ZetaIrNormalizer.isCoreOp,
            sprintf "%s did not lower into the core four" ir.Generator)
        Assert.True(
            denoteEqual ir.Width ir.Ops normalized.Ops,
            sprintf "normalizer changed the denotation of %s at width %d" ir.Generator ir.Width)

// ── the committed golden vectors: the derivations must reproduce them ────────────────

let private tryFindRepoRoot (startPath: string) =
    if String.IsNullOrWhiteSpace startPath then
        None
    else
        try
            let mutable dir = DirectoryInfo(startPath)
            while not (isNull dir) && not (File.Exists(Path.Combine(dir.FullName, "Zeta.sln"))) do
                dir <- dir.Parent
            if isNull dir then None else Some dir.FullName
        with
        | :? ArgumentException
        | :? NotSupportedException
        | :? PathTooLongException -> None

let private repoRoot () =
    [ Environment.GetEnvironmentVariable("ZETA_REPO_ROOT")
      Environment.GetEnvironmentVariable("GITHUB_WORKSPACE")
      AppContext.BaseDirectory
      Directory.GetCurrentDirectory() ]
    |> List.tryPick tryFindRepoRoot
    |> Option.defaultWith (fun () -> failwith "Could not locate repo root (Zeta.sln).")

/// Minimal reader for the three committed `vectors.yaml` shapes:
///   `x: "N"` + `result: "N"`   ·   `state: N` + `expected: N`   ·   id-encoded `x-N` + `expected: N`
/// Returns (input, expected) pairs. Deliberately tiny: this is a fixture reader, not a YAML parser.
let private readVectors (dir: string) : (uint64 * uint64) list =
    let path = Path.Combine(repoRoot (), "tests", "cross-verification", dir, "vectors.yaml")
    let lines = File.ReadAllLines path
    let strip (s: string) = s.Trim().Trim('"')
    let mutable pending: uint64 option = None
    let mutable curId: string = ""
    let acc = ResizeArray<uint64 * uint64>()
    for raw in lines do
        let line = raw.Trim()
        if line.StartsWith("- id:", StringComparison.Ordinal) then
            curId <- strip (line.Substring 5)
            pending <- None
        elif line.StartsWith("x:", StringComparison.Ordinal) then
            pending <- Some(UInt64.Parse(strip (line.Substring 2), Globalization.CultureInfo.InvariantCulture))
        elif line.StartsWith("state:", StringComparison.Ordinal) then
            pending <- Some(UInt64.Parse(strip (line.Substring 6), Globalization.CultureInfo.InvariantCulture))
        elif line.StartsWith("result:", StringComparison.Ordinal)
             || line.StartsWith("expected:", StringComparison.Ordinal) then
            let v = strip (line.Substring(line.IndexOf(':') + 1))
            let expected = UInt64.Parse(v, Globalization.CultureInfo.InvariantCulture)
            let input =
                match pending with
                | Some i -> Some i
                | None ->
                    // id-encoded form, e.g. `x-305419896`
                    let ix = curId.IndexOf('-')
                    if ix >= 0 then
                        match UInt64.TryParse(curId.Substring(ix + 1), Globalization.NumberStyles.Integer,
                                              Globalization.CultureInfo.InvariantCulture) with
                        | true, i -> Some i
                        | _ -> None
                    else
                        None
            match input with
            | Some i -> acc.Add(i, expected)
            | None -> ()
            pending <- None
    Assert.True(acc.Count > 0, sprintf "no vectors parsed from %s" path)
    List.ofSeq acc

/// Every generator IR that has committed value vectors, paired with its fixture directory.
/// Between them these exercise all six ops at both widths.
let private goldenRoutes: (string * ZetaIrV4.Ir) list =
    [ "fmix64", ZetaIrV4.ofV1 ZetaIrV1.fmix64 //  mul, xorshr            @ 64
      "xoshiro256ss", ZetaIrV4.ofV2 ZetaIrV2.xoshiro256ss //  + rotl                 @ 64
      "nasam", ZetaIrV4.ofV3 ZetaIrV3.nasam //  + xrotxor, xshrxor     @ 64
      "lcg64_mmix", ZetaIrV4.lcg64_mmix //  + add                  @ 64
      "lcg32_glibc", ZetaIrV4.lcg32_glibc //  mul, add               @ 32
      "lcg32_numerical_recipes", ZetaIrV4.lcg32_numerical_recipes //  mul, add               @ 32
      "murmur3_32_tail", ZetaIrV4.murmur3_32_tail ] //  rotl, mul, add         @ 32

[<Fact>]
let ``the evaluator reproduces every committed golden vector (the referent is pinned)`` () =
    for (dir, ir) in goldenRoutes do
        for (x, expected) in readVectors dir do
            Assert.Equal(expected, evalIr ir.Width ir.Ops x)

[<Fact>]
let ``the core-four normalisation reproduces every committed golden vector`` () =
    for (dir, ir) in goldenRoutes do
        let normalized = ZetaIrNormalizer.normalize ir
        for (x, expected) in readVectors dir do
            Assert.Equal(expected, evalIr ir.Width normalized.Ops x)

// =====================================================================================
//  NEW: the two LIST ops are not the same kind of thing.
//
//  Write `R` for right-shift-by-1 and `X` for rotl-by-1. Then
//    XShrXor [s_1..s_n]  denotes  1 + R^{s_1} + ... + R^{s_n}   in F2[R]/(R^W)
//    XRotXor [r_1..r_n]  denotes  1 + X^{r_1} + ... + X^{r_n}   in F2[X]/(X^W - 1)
//  and composition is polynomial multiplication in each. The two rings behave differently,
//  and that difference decides whether the list is a FUSED FOLD or a PRIMITIVE.
// =====================================================================================

// ── XShrXor: the list IS a fused fold — it factors back into single-shift XorShr ─────

/// Multiply in F2[R]/(R^W): exponents add, terms above W-1 vanish (R is nilpotent).
let private mulShr (w: int) (a: Set<int>) (b: Set<int>) =
    let mutable acc = Set.empty
    for i in a do
        for j in b do
            let p = i + j
            if p < w then
                acc <- (if Set.contains p acc then Set.remove p acc else Set.add p acc)
    acc

/// `(1 + R^m)^-1 = 1 + R^m + R^2m + ...` truncated at `R^W`.
let private invOnePlusShr (w: int) (m: int) =
    let mutable s = Set.empty
    let mutable j = 0
    while j * m < w do
        s <- Set.add (j * m) s
        j <- j + 1
    s

let private polyOfXShrXor (w: int) (ss: int64 list) =
    ss
    |> List.fold
        (fun acc s ->
            let s = int s % w
            if Set.contains s acc then Set.remove s acc else Set.add s acc)
        (Set.singleton 0)

/// Factor a unit of `F2[R]/(R^W)` (constant term 1) into a product of `(1 + R^m)` factors,
/// i.e. into a SEQUENCE of `XorShr m` ops. Greedy: kill the lowest non-constant term, repeat.
/// Terminates because each step strictly raises the lowest non-constant degree.
let private factorXShrXorIntoXorShr (w: int) (ss: int64 list) : ZetaIrV4.Op list option =
    let p = polyOfXShrXor w ss
    if not (Set.contains 0 p) then
        None // not a unit — no factorisation into invertible single shifts exists
    else
        let mutable r = p
        let mutable acc = []
        while r <> Set.singleton 0 do
            let m = r |> Set.remove 0 |> Set.minElement
            acc <- ZetaIrV4.XorShr(int64 m) :: acc
            r <- mulShr w r (invOnePlusShr w m)
        Some(List.rev acc)

[<Fact>]
let ``XShrXor list is a fused fold -- it factors back into a XorShr SEQUENCE, both widths`` () =
    let cases =
        [ 64, [ 23L; 51L ] // nasam's actual op
          64, [ 33L ]
          64, [ 1L; 2L; 3L; 5L; 7L ]
          64, [ 5L; 60L ]
          32, [ 13L; 27L ]
          32, [ 16L ]
          32, [ 1L; 2L; 3L; 5L; 7L ] ]
    for (w, ss) in cases do
        match factorXShrXorIntoXorShr w ss with
        | None -> failwithf "expected a factorisation for XShrXor %A at width %d" ss w
        | Some derived ->
            Assert.True(
                derived |> List.forall (fun op -> match op with ZetaIrV4.XorShr _ -> true | _ -> false),
                "the factorisation must be XorShr ops only")
            Assert.True(
                denoteEqual w [ ZetaIrV4.XShrXor ss ] derived,
                sprintf "XShrXor %A <> %A at width %d" ss derived w)

[<Fact>]
let ``the XShrXor factorisation reproduces the nasam golden vectors`` () =
    // nasam is the only committed generator that uses XShrXor. Rewrite BOTH of its
    // XShrXor [23;51] ops into XorShr sequences and replay the committed vectors.
    let ir = ZetaIrV4.ofV3 ZetaIrV3.nasam
    let rewritten =
        ir.Ops
        |> List.collect (fun op ->
            match op with
            | ZetaIrV4.XShrXor ss ->
                match factorXShrXorIntoXorShr ir.Width ss with
                | Some ops -> ops
                | None -> [ op ]
            | other -> [ other ])
    Assert.True(
        rewritten |> List.exists (fun op -> match op with ZetaIrV4.XorShr _ -> true | _ -> false),
        "the rewrite must actually have produced XorShr ops")
    for (x, expected) in readVectors "nasam" do
        Assert.Equal(expected, evalIr ir.Width rewritten x)

[<Fact>]
let ``XShrXor with 0 in the list is NOT a XorShr product -- it is the non-unit case`` () =
    // `1 + R^0 + ... ` loses its constant term, so it is outside the group generated by the
    // invertible single shifts. These two are what the arity-2 list actually buys:
    //   XShrXor [0]    = the ZERO map      (core-four spelling: Mul 0)
    //   XShrXor [0; s] = a PLAIN right shift `x >>> s`, which no single other core op denotes.
    for w in widths do
        Assert.True(Option.isNone (factorXShrXorIntoXorShr w [ 0L ]))
        Assert.True(Option.isNone (factorXShrXorIntoXorShr w [ 0L; 5L ]))
        Assert.True(denoteEqual w [ ZetaIrV4.XShrXor [ 0L ] ] [ ZetaIrV4.Mul 0L ])
        Assert.True(
            probes w
            |> List.forall (fun x -> evalIr w [ ZetaIrV4.XShrXor [ 0L; 5L ] ] x = ((x &&& maskOf w) >>> 5)))

// ── XRotXor: the list is NOT a fused fold — arity 2 is primitive ─────────────────────

[<Fact>]
let ``XRotXor [a; b] is NOT any composition of Rotl -- exhaustive over the rotation monoid`` () =
    // `Rotl r` denotes the monomial X^r, and monomials are closed under composition
    // (rotl a then rotl b = rotl (a+b) mod W), so the ENTIRE monoid generated by Rotl at
    // width W is the W rotations — checking all W of them is exhaustive, not a sample.
    // `XRotXor [a; b]` denotes 1 + X^a + X^b, which has three terms, not one.
    // So unlike XShrXor, XRotXor's list cannot be unrolled into single-rotation steps.
    for w in widths do
        let target = [ ZetaIrV4.XRotXor [ int64 (w / 2 - 1); 17L ] ]
        for r in 0 .. w - 1 do
            Assert.False(
                denoteEqual w target [ ZetaIrV4.Rotl(int64 r) ],
                sprintf "XRotXor is not a rotation, but matched Rotl %d at width %d" r w)

[<Fact>]
let ``the Rotl monoid really is closed -- Rotl a then Rotl b = Rotl (a+b), both widths`` () =
    for w in widths do
        for a in 0 .. w - 1 do
            for b in 0 .. w - 1 do
                Assert.True(
                    denoteEqual w
                        [ ZetaIrV4.Rotl(int64 a); ZetaIrV4.Rotl(int64 b) ]
                        [ ZetaIrV4.Rotl(int64 ((a + b) % w)) ],
                    sprintf "Rotl %d ; Rotl %d <> Rotl %d at width %d" a b ((a + b) % w) w)

// =====================================================================================
//  The `add` NECESSITY argument, as a falsifier rather than an illustration.
//
//  ZetaIrV4.fs's header states it: every non-`add` op maps 0 to 0, so every sequence of
//  them does too, while `add k` maps 0 to k. The test carrying that name in
//  `ZetaIrV4.Tests.fs` asserts `0UL + k = k` and three fixed instances of `f 0 = 0`; it
//  never builds an op SEQUENCE and never calls the evaluator, so it survives deleting
//  `Add` from the grammar. The quantified version is below.
// =====================================================================================

[<Fact>]
let ``every non-Add op sequence fixes 0, and Add does not -- the add necessity argument`` () =
    let rnd = Random(4)
    for w in widths do
        let nonAddOps =
            [ for k in [ 0L; 1L; 2L; 3L; 5L; 1103515245L; 6364136223846793005L ] -> ZetaIrV4.Mul k ]
            @ [ for s in 0 .. w - 1 -> ZetaIrV4.XorShr(int64 s) ]
            @ [ for r in 0 .. w - 1 -> ZetaIrV4.Rotl(int64 r) ]
            @ [ for a in 0 .. w - 1 -> ZetaIrV4.XRotXor [ int64 a; int64 ((a * 7 + 3) % w) ] ]
            @ [ for a in 0 .. w - 1 -> ZetaIrV4.XShrXor [ int64 a; int64 ((a * 5 + 1) % w) ] ]
            |> List.toArray
        // 4000 random sequences of length 1..8 drawn from the five non-Add op families.
        for _ in 1..4000 do
            let n = rnd.Next(1, 9)
            let seq = [ for _ in 1..n -> nonAddOps.[rnd.Next nonAddOps.Length] ]
            Assert.Equal(0UL, evalIr w seq 0UL)
        // and the witness that leaves the fragment
        for k in [ 1L; 12345L; 1442695040888963407L ] do
            Assert.NotEqual(0UL, evalIr w [ ZetaIrV4.Add k ] 0UL)

// =====================================================================================
//  PORTABILITY: the F2-unit criterion decides REVERSIBILITY, not just derivability.
//
//  `QuantumArithmeticMix.qs.sketch` lifts `xorshr` to a reversible circuit with exactly
//  this argument: "M = I + S^s where S is the down-shift; S is nilpotent so M is
//  invertible over GF(2)". That argument is the constant-term/unit condition above, and it
//  generalises to the whole op set — the SAME invariant that decides whether a list op
//  factors also decides whether the op is a permutation, i.e. whether a reversible or
//  quantum lane can carry it without ancillas.
//
//  Checked here by exhaustive bijectivity at width 16, against a width-parametric
//  reference evaluator that is FIRST pinned to the committed 32/64 evaluator.
// =====================================================================================

let private evalOpW (w: int) (op: ZetaIrV4.Op) (x: uint64) : uint64 =
    let mask = if w = 64 then UInt64.MaxValue else (1UL <<< w) - 1UL
    let rotl (v: uint64) (k: int) =
        let k = ((k % w) + w) % w
        if k = 0 then v else ((v <<< k) ||| (v >>> (w - k))) &&& mask
    // .NET masks the shift COUNT by (w-1) for the native widths; below 32 there is no
    // native type, so shifts at or past the width give zero. The grammar's shifts are
    // always < width in this file, where the two agree.
    let shr (v: uint64) (s: int) =
        let s = if w = 64 then s &&& 63 elif w = 32 then s &&& 31 else s
        if s >= 64 then 0UL else (v >>> s) &&& mask
    match op with
    | ZetaIrV4.Mul k -> (x * uint64 k) &&& mask
    | ZetaIrV4.Add k -> (x + uint64 k) &&& mask
    | ZetaIrV4.XorShr s -> (x ^^^ shr x (int s)) &&& mask
    | ZetaIrV4.Rotl r -> rotl x (int r)
    | ZetaIrV4.XRotXor rs -> (rs |> List.fold (fun acc r -> acc ^^^ rotl x (int r)) 0UL) ^^^ x
    | ZetaIrV4.XShrXor ss -> (ss |> List.fold (fun acc s -> acc ^^^ shr x (int s)) 0UL) ^^^ x

[<Fact>]
let ``the width-parametric reference agrees with the committed evaluator at 32 and 64`` () =
    for w in widths do
        let ops =
            [ for k in [ 0L; 1L; 2L; 5L; 6364136223846793005L; -7031135171492799847L ] -> ZetaIrV4.Mul k ]
            @ [ for k in [ 0L; 1L; 12345L; 3864292196L ] -> ZetaIrV4.Add k ]
            @ [ for s in 0 .. w - 1 -> ZetaIrV4.XorShr(int64 s) ]
            @ [ for r in 0 .. w - 1 -> ZetaIrV4.Rotl(int64 r) ]
            @ [ ZetaIrV4.XRotXor [ 1L ]
                ZetaIrV4.XRotXor [ 0L; 7L ]
                ZetaIrV4.XRotXor [ 13L; 17L ]
                ZetaIrV4.XShrXor [ 0L ]
                ZetaIrV4.XShrXor [ 0L; 5L ]
                ZetaIrV4.XShrXor [ 13L ] ]
        for op in ops do
            for x in probes w do
                Assert.Equal(evalIr w [ op ] x, evalOpW w op x)

/// The algebraic prediction of invertibility, from the polynomial's constant term / weight.
let private predictedInvertible (w: int) (op: ZetaIrV4.Op) =
    match op with
    | ZetaIrV4.Mul k -> uint64 k % 2UL = 1UL // unit of Z/2^W  <=>  k odd
    | ZetaIrV4.Add _ -> true // a translation is always a bijection
    | ZetaIrV4.Rotl _ -> true // a monomial X^r is always a unit
    | ZetaIrV4.XorShr s -> int s % w <> 0 // 1 + R^s keeps its constant term  <=>  s <> 0
    | ZetaIrV4.XShrXor ss -> // constant term survives  <=>  0 occurs an even number of times
        (ss |> List.filter (fun s -> int s % w = 0) |> List.length) % 2 = 0
    | ZetaIrV4.XRotXor rs -> // unit of F2[X]/((1+X)^W)  <=>  odd Hamming weight
        let terms =
            rs
            |> List.fold
                (fun (acc: Set<int>) r ->
                    let r = ((int r % w) + w) % w
                    if Set.contains r acc then Set.remove r acc else Set.add r acc)
                (Set.singleton 0)
        Set.count terms % 2 = 1

[<Fact>]
let ``the F2-unit criterion predicts bijectivity EXACTLY (exhaustive at width 16)`` () =
    let w = 16
    let bijective (op: ZetaIrV4.Op) =
        let seen = Collections.Generic.HashSet<uint64>()
        let mutable ok = true
        for i in 0 .. (1 <<< w) - 1 do
            if not (seen.Add(evalOpW w op (uint64 i))) then ok <- false
        ok
    let cases =
        [ ZetaIrV4.Mul 0L; ZetaIrV4.Mul 1L; ZetaIrV4.Mul 2L; ZetaIrV4.Mul 5L; ZetaIrV4.Mul 6L
          ZetaIrV4.Add 0L; ZetaIrV4.Add 7L
          ZetaIrV4.Rotl 0L; ZetaIrV4.Rotl 3L
          ZetaIrV4.XorShr 0L; ZetaIrV4.XorShr 1L; ZetaIrV4.XorShr 7L
          ZetaIrV4.XShrXor [ 3L ]; ZetaIrV4.XShrXor [ 3L; 5L ]
          ZetaIrV4.XShrXor [ 0L ]; ZetaIrV4.XShrXor [ 0L; 5L ]
          ZetaIrV4.XRotXor [ 3L ]; ZetaIrV4.XRotXor [ 3L; 5L ]; ZetaIrV4.XRotXor [ 0L; 3L ]
          ZetaIrV4.XRotXor [ 1L; 2L; 3L ]; ZetaIrV4.XRotXor [ 1L; 2L; 3L; 4L ]; ZetaIrV4.XRotXor [ 0L ] ]
    for op in cases do
        Assert.Equal(predictedInvertible w op, bijective op)

// =====================================================================================
//  The canonicalizer defect this work found, as a regression test.
//  `ZetaIrCanonicalizer.fromPolyF2Rot` used to drop the constant term unconditionally.
//  The constant term CAN cancel: at W the product (1 + X^{W-1})(1 + X) reduces to
//  X + X^{W-1}, because X^W = 1. The old code then re-added the implicit `x`.
// =====================================================================================

[<Fact>]
let ``XRotXor fusion whose constant term cancels still preserves denotation`` () =
    for w in widths do
        let ops = [ ZetaIrV4.XRotXor [ int64 (w - 1) ]; ZetaIrV4.XRotXor [ 1L ] ]
        let ir = { ZetaIrV4.Generator = "probe"; ZetaIrV4.Version = 1; ZetaIrV4.Width = w; ZetaIrV4.Ops = ops }
        let canon = ZetaIrCanonicalizer.canonicalize ir
        Assert.True(
            denoteEqual w ops canon.Ops,
            sprintf "canonicalize changed the denotation at width %d: %A -> %A" w ops canon.Ops)

[<Fact>]
let ``XRotXor fusion that annihilates to the zero map does not become the identity`` () =
    for w in widths do
        // XRotXor [0] is 1 + X^0 = 0: the ZERO map. Fusing it with anything stays zero.
        let ops = [ ZetaIrV4.XRotXor [ 0L ]; ZetaIrV4.XRotXor [ 1L ] ]
        let ir = { ZetaIrV4.Generator = "probe"; ZetaIrV4.Version = 1; ZetaIrV4.Width = w; ZetaIrV4.Ops = ops }
        let canon = ZetaIrCanonicalizer.canonicalize ir
        Assert.True(
            denoteEqual w ops canon.Ops,
            sprintf "canonicalize changed the denotation at width %d: %A -> %A" w ops canon.Ops)
        Assert.True(probes w |> List.forall (fun x -> evalIr w canon.Ops x = 0UL))

[<Fact>]
let ``XRotXor fusion is denotation-preserving over EVERY single-rotation pair, both widths`` () =
    // Exhaustive over the W^2 pairs `XRotXor [a]; XRotXor [b]` — 1024 at width 32, 4096 at 64.
    // This is the sweep that catches both the constant-term cancellation (a + b = W) and the
    // annihilation to zero (a = b = 0), and it also pins TERMINATION: the fusion rewrite must
    // make progress, or `fuseOps` re-enters the same case forever.
    for w in widths do
        for a in 0 .. w - 1 do
            for b in 0 .. w - 1 do
                let ops = [ ZetaIrV4.XRotXor [ int64 a ]; ZetaIrV4.XRotXor [ int64 b ] ]
                let ir = { ZetaIrV4.Generator = "probe"; ZetaIrV4.Version = 1; ZetaIrV4.Width = w; ZetaIrV4.Ops = ops }
                let canon = ZetaIrCanonicalizer.canonicalize ir
                Assert.True(
                    denoteEqual w ops canon.Ops,
                    sprintf "canonicalize changed the denotation at width %d: %A -> %A" w ops canon.Ops)
                match ZetaIrV4.validate (ZetaIrV4.toDynamicValue canon) with
                | Ok _ -> ()
                | Error e -> failwithf "canonicalize emitted an invalid v4 IR at width %d from %A: %s" w ops e

[<Fact>]
let ``the canonicalizer never emits an op the v4 validator would reject`` () =
    // An empty term list is outside the v4 grammar (`validate` requires a non-empty list),
    // so the canonicalizer must never produce one — it is the zero map, spelled `Mul 0`.
    let cases =
        [ [ ZetaIrV4.XRotXor [ 0L ]; ZetaIrV4.XRotXor [ 1L ] ]
          [ ZetaIrV4.XRotXor [ 1L ]; ZetaIrV4.XRotXor [ 1L ] ]
          [ ZetaIrV4.XRotXor [ 3L ]; ZetaIrV4.XRotXor [ 3L ] ] ]
    for w in widths do
        for ops in cases do
            let ir = { ZetaIrV4.Generator = "probe"; ZetaIrV4.Version = 1; ZetaIrV4.Width = w; ZetaIrV4.Ops = ops }
            let canon = ZetaIrCanonicalizer.canonicalize ir
            match ZetaIrV4.validate (ZetaIrV4.toDynamicValue canon) with
            | Ok _ -> ()
            | Error e -> failwithf "canonicalize emitted an invalid v4 IR at width %d from %A: %s" w ops e
            Assert.True(denoteEqual w ops canon.Ops)
