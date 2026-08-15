module Zeta.Tests.ZetaIrEvalTests

open System
open System.IO
open System.Globalization
open Xunit
open Zeta.Core
open Zeta.Core.FSharp.Yaml.Dom

// ═══════════════════════════════════════════════════════════════════════════════════
// ZetaIrEval — the falsifier for the canonical IR evaluator.
//
// The evaluator is a claim about what the IR MEANS, so it is load-bearing
// (`.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md`) and it must be
// metered, not asserted (`toy-is-free-metered-must-be-earned.md`). These tests are the
// metering, in four parts:
//
//   1. GOLDEN CONFORMANCE — every one of the NINE committed IRs, folded over the committed
//      `tests/cross-verification/<primitive>/vectors.yaml` goldens. Those vectors are the
//      artifact the whole cross-language byte-lock already stands on, and they were produced
//      by hand-written ports, so agreeing with them is agreeing with an INDEPENDENT oracle,
//      not with another copy of this evaluator.
//
//   2. DISCRIMINATION — the same golden check run against MUTATED IRs (op list reversed, an
//      op dropped, the width swapped). Each mutation must DIVERGE from the goldens. A check
//      that passes under mutation is not a check; the divergence counts are asserted to be
//      non-trivial, so a corpus that happened to be degenerate (e.g. all-zeros) fails here.
//
//   3. REJECTION — the evaluator must fail LOUDLY where it has no semantics: an op outside
//      the grammar, a width it does not define, an input too wide for the IR, a shift of
//      width-or-more. Silent fall-through on an unknown op is exactly the defect PR #10779
//      found in every codegen emitter; nothing here may reproduce it.
//
//   4. AGREEMENT WITH THE INCUMBENT — `ZetaIrNormalizer.evalOp64` / `evalOp32` already carry
//      an op-level denotation used by the normalizer's soundness proof. Pinning them to the
//      canonical evaluator converts them from a SECOND independent answer into a checked
//      consequence of the referent, which is the whole point of having a referent.
// ═══════════════════════════════════════════════════════════════════════════════════

let private repoRoot () : string =
    let mutable dir =
        DirectoryInfo(Path.GetDirectoryName(typeof<YamlValue>.Assembly.Location))

    while not (isNull dir) && not (File.Exists(Path.Join(dir.FullName, "Zeta.sln"))) do
        dir <- dir.Parent

    if isNull dir then
        raise (InvalidOperationException "Could not locate repo root (Zeta.sln).")

    dir.FullName

/// Every committed IR, widened to v4. This is the SAME set `GeneratorIrRegistry.Tests` pins
/// byte-for-byte against the committed `*.ir.json` files, so driving from here is driving
/// from the artifacts the TypeScript oracles read.
let private allIrs: ZetaIrV4.Ir list =
    (ZetaIrV1.known |> List.map ZetaIrV4.ofV1)
    @ (ZetaIrV2.known |> List.map ZetaIrV4.ofV2)
    @ (ZetaIrV3.known |> List.map ZetaIrV4.ofV3)
    @ ZetaIrV4.known

/// The cross-verification directory for a generator. DERIVED from the name (`hash.fmix32` ->
/// `fmix32`), never a hand-maintained table — a lookup table is the bug it would prevent.
let private primitiveDirOf (generator: string) : string =
    generator.Substring(generator.LastIndexOf('.') + 1)

// ── the committed goldens ────────────────────────────────────────────────────────
//
// Three vector shapes are committed across the nine primitives and all three are read here
// rather than normalised away, because the shapes are the sibling lane's artifact:
//   * `x: "<dec>"` + `result: "<dec>"`      (splitmix64, fmix32, fmix64, fmix64, nasam, …)
//   * `state: <int>` + `expected: <int>`    (lcg32_glibc)
//   * input encoded in `id` + `expected`    (murmur3_32_tail)

type private Vector =
    { Id: string
      X: uint64
      Expected: uint64 }

let private parseU64 (s: string) (ctx: string) : uint64 =
    match UInt64.TryParse(s, NumberStyles.None, CultureInfo.InvariantCulture) with
    | true, v -> v
    | _ -> raise (InvalidOperationException(sprintf "not a u64 at %s: '%s'" ctx s))

let private scalarU64 (v: YamlValue) (ctx: string) : uint64 =
    match v with
    | VStr s -> parseU64 s ctx
    | VInt i when i >= 0L -> uint64 i
    | other -> raise (InvalidOperationException(sprintf "expected u64 scalar at %s, got %A" ctx other))

let private tryField (entries: (string * YamlValue) list) (key: string) : YamlValue option =
    entries
    |> List.tryPick (fun (k, v) -> if String.Equals(k, key, StringComparison.Ordinal) then Some v else None)

/// The keys a vector row may carry. Anything else means the committed shape moved and this
/// reader must be revisited — a silently-skipped row would weaken the golden check invisibly.
let private allowedVectorKeys = [ "id"; "x"; "state"; "result"; "expected" ]

/// The `vectors:` block of a committed vectors.yaml, sliced off the prose header.
///
/// The header carries folded block scalars (`description: >-`) that the repo's own YAML
/// reader DECLINES rather than guesses at — correct behaviour for a subset parser, and not
/// something to work around by loosening the parser. Slicing to the `vectors:` block keeps
/// the strict reader and reads exactly the part that is data. The slice is then checked
/// line-by-line against `allowedVectorKeys`, so a future shape change fails by name here
/// instead of quietly yielding fewer vectors.
let private vectorsBlock (primitive: string) (text: string) : string =
    let lines = text.Replace("\r\n", "\n").Split('\n')

    let start =
        lines |> Array.tryFindIndex (fun l -> l.StartsWith("vectors:", StringComparison.Ordinal))

    match start with
    | None -> raise (InvalidOperationException(sprintf "%s/vectors.yaml has no `vectors:` block" primitive))
    | Some i ->
        let block = lines.[i..]

        for line in block do
            let trimmed = line.TrimStart([| ' '; '-'; '\t' |])

            if trimmed.Length > 0 && not (line.StartsWith("vectors:", StringComparison.Ordinal)) then
                let key = trimmed.Split(':').[0].Trim()

                if not (List.contains key allowedVectorKeys) then
                    raise (
                        InvalidOperationException(
                            sprintf
                                "%s/vectors.yaml: unexpected key '%s' inside the vectors block (known: %s) — the committed shape moved; update this reader rather than letting rows be skipped"
                                primitive
                                key
                                (String.Join(", ", allowedVectorKeys))
                        )
                    )

        String.Join("\n", block)

let private loadVectors (primitive: string) : Vector list =
    let path = Path.Join(repoRoot (), "tests", "cross-verification", primitive, "vectors.yaml")
    let text = vectorsBlock primitive (File.ReadAllText path)

    let doc =
        match parse text with
        | Ok v -> v
        | Error e -> raise (InvalidOperationException(sprintf "%s/vectors.yaml did not parse: %A" primitive e))

    let entries =
        match doc with
        | VMap m -> m
        | other -> raise (InvalidOperationException(sprintf "%s/vectors.yaml root is %A, expected a map" primitive other))

    let items =
        match tryField entries "vectors" with
        | Some(VSeq xs) -> xs
        | _ -> raise (InvalidOperationException(sprintf "%s/vectors.yaml has no `vectors` sequence" primitive))

    items
    |> List.map (fun item ->
        let e =
            match item with
            | VMap m -> m
            | other -> raise (InvalidOperationException(sprintf "%s vector is %A, expected a map" primitive other))

        let id =
            match tryField e "id" with
            | Some(VStr s) -> s
            | Some other -> string other
            | None -> raise (InvalidOperationException(sprintf "%s vector has no `id`" primitive))

        let ctx = sprintf "%s/%s" primitive id

        let x =
            match tryField e "x", tryField e "state" with
            | Some v, _ -> scalarU64 v (ctx + ".x")
            | _, Some v -> scalarU64 v (ctx + ".state")
            // murmur3_32_tail encodes the input in the id (`x-<dec>`); no separate field.
            | None, None when id.StartsWith("x-", StringComparison.Ordinal) ->
                parseU64 (id.Substring 2) (ctx + ".id")
            | None, None -> raise (InvalidOperationException(sprintf "%s: no input field and id is not `x-<dec>`" ctx))

        let expected =
            match tryField e "result", tryField e "expected" with
            | Some v, _ -> scalarU64 v (ctx + ".result")
            | _, Some v -> scalarU64 v (ctx + ".expected")
            | None, None -> raise (InvalidOperationException(sprintf "%s: no `result`/`expected` field" ctx))

        { Id = id; X = x; Expected = expected })

/// Fold an IR over a primitive's goldens; returns (matches, mismatches-or-errors).
let private scoreAgainstGoldens (ir: ZetaIrV4.Ir) (vectors: Vector list) : int * int =
    vectors
    |> List.fold
        (fun (ok, bad) v ->
            match ZetaIrEval.run ir v.X with
            | Ok got when got = v.Expected -> (ok + 1, bad)
            | _ -> (ok, bad + 1))
        (0, 0)

// ═══ 1. GOLDEN CONFORMANCE ═══════════════════════════════════════════════════════

/// The canonical evaluator reproduces EVERY committed golden vector for EVERY committed IR.
///
/// This is the load-bearing assertion: nine IRs spanning four frozen schema versions, all six
/// ops, and both supported widths, checked against vectors that were produced by hand-written
/// language ports rather than by this evaluator.
[<Fact>]
let ``canonical evaluator reproduces every committed golden vector for all nine IRs`` () =
    let mutable totalVectors = 0
    let failures = ResizeArray<string>()

    for ir in allIrs do
        let primitive = primitiveDirOf ir.Generator
        let vectors = loadVectors primitive
        Assert.True(vectors.Length > 0, sprintf "%s has no committed vectors" primitive)
        totalVectors <- totalVectors + vectors.Length

        for v in vectors do
            match ZetaIrEval.run ir v.X with
            | Ok got when got = v.Expected -> ()
            | Ok got -> failures.Add(sprintf "%s/%s: got %d, golden %d" primitive v.Id got v.Expected)
            | Error e -> failures.Add(sprintf "%s/%s: rejected — %s" primitive v.Id e)

    Assert.True(failures.Count = 0, String.Join("\n", failures))
    // Nine IRs is the full committed set; guard against the list silently shrinking.
    Assert.Equal(9, allIrs.Length)
    Assert.Equal(90, totalVectors)

/// Every committed IR round-trips through canonical JSON and evaluates identically from text.
/// The text path is the one the emitters see, so it is the path that must be pinned.
[<Fact>]
let ``evaluating from canonical JSON agrees with evaluating the value`` () =
    for ir in allIrs do
        let json =
            match ZetaIrV4.toCanonicalJson ir with
            | Ok j -> j
            | Error e -> failwith (sprintf "%s: canonical JSON failed: %A" ir.Generator e)

        for v in loadVectors (primitiveDirOf ir.Generator) do
            let fromValue = ZetaIrEval.run ir v.X
            let fromText = ZetaIrEval.runCanonicalJsonAny json v.X
            Assert.Equal(fromValue, fromText)
            Assert.Equal<Result<uint64, string>>(Ok v.Expected, fromText)

// ═══ 2. DISCRIMINATION (the mutation falsifiers) ═════════════════════════════════

/// Reversing the op list must break the goldens for every IR whose ops are not all identical.
///
/// If this passed, the golden check would be vacuous — order-insensitivity would mean the
/// vectors cannot see the pipeline at all.
[<Fact>]
let ``MUTATION transposing the op order diverges from the goldens`` () =
    let mutable totalDivergences = 0

    for ir in allIrs do
        let mutated = { ir with Ops = List.rev ir.Ops }
        let vectors = loadVectors (primitiveDirOf ir.Generator)
        let _, bad = scoreAgainstGoldens mutated vectors
        totalDivergences <- totalDivergences + bad

        Assert.True(
            bad > 0,
            sprintf "reversing %s's ops still matched every golden — the check does not see op order" ir.Generator
        )

    // Non-trivial across the corpus, not just one lucky primitive.
    Assert.True(totalDivergences >= 50, sprintf "only %d transposition divergences" totalDivergences)

/// Dropping any single op must break the goldens. Run for every op position of every IR.
[<Fact>]
let ``MUTATION dropping any single op diverges from the goldens`` () =
    let mutable totalDivergences = 0

    for ir in allIrs do
        let vectors = loadVectors (primitiveDirOf ir.Generator)

        for i in 0 .. ir.Ops.Length - 1 do
            let mutated =
                { ir with Ops = ir.Ops |> List.mapi (fun j op -> (j, op)) |> List.filter (fun (j, _) -> j <> i) |> List.map snd }

            let _, bad = scoreAgainstGoldens mutated vectors
            totalDivergences <- totalDivergences + bad

            Assert.True(
                bad > 0,
                sprintf "dropping op %d of %s still matched every golden" i ir.Generator
            )

    Assert.True(totalDivergences >= 100, sprintf "only %d dropped-op divergences" totalDivergences)

/// Evaluating at the WRONG width must never silently agree with the goldens.
///
/// This is the mutation for the field four emitters ignored. Both directions are covered:
/// a width-32 IR run at 64 computes different (unmasked) arithmetic, and a width-64 IR run at
/// 32 REJECTS most inputs as too wide. Either way the result is not the golden — which is
/// what "width-incorrectness is detectable, not merely avoided" has to mean operationally.
[<Fact>]
let ``MUTATION evaluating at the wrong width diverges from the goldens`` () =
    let mutable totalDivergences = 0

    for ir in allIrs do
        let mutated = { ir with Width = (if ir.Width = 32 then 64 else 32) }
        let vectors = loadVectors (primitiveDirOf ir.Generator)
        let _, bad = scoreAgainstGoldens mutated vectors
        totalDivergences <- totalDivergences + bad

        Assert.True(
            bad > 0,
            sprintf "%s evaluated at width %d still matched every golden" ir.Generator mutated.Width
        )

    Assert.True(totalDivergences >= 50, sprintf "only %d wrong-width divergences" totalDivergences)

/// Perturbing any single multiplier/addend constant by one must break the goldens.
[<Fact>]
let ``MUTATION perturbing a constant diverges from the goldens`` () =
    let mutable perturbed = 0

    for ir in allIrs do
        let vectors = loadVectors (primitiveDirOf ir.Generator)

        for i in 0 .. ir.Ops.Length - 1 do
            let bump op =
                match op with
                | ZetaIrV4.Mul k -> Some(ZetaIrV4.Mul(k + 1L))
                | ZetaIrV4.Add k -> Some(ZetaIrV4.Add(k + 1L))
                | _ -> None

            match bump ir.Ops.[i] with
            | None -> ()
            | Some m ->
                perturbed <- perturbed + 1
                let mutated = { ir with Ops = ir.Ops |> List.mapi (fun j op -> if j = i then m else op) }
                let _, bad = scoreAgainstGoldens mutated vectors

                Assert.True(
                    bad > 0,
                    sprintf "bumping constant at op %d of %s still matched every golden" i ir.Generator
                )

    Assert.True(perturbed >= 9, sprintf "only %d constants were perturbed" perturbed)

// ═══ 3. REJECTION (must fail loudly, never fall through) ═════════════════════════

/// An op outside the frozen grammar is REJECTED BY NAME at the text boundary.
///
/// This is defect 2's direct regression test. `codegen-from-ir.ts` used to emit
/// `xorshr undefined` for any op it did not recognise; the canonical evaluator must instead
/// refuse, and the refusal must name the offending op.
[<Fact>]
let ``an op outside the grammar is rejected by name, never defaulted`` () =
    let json =
        """{"schema":"zeta-ir-v4","generator":"test.bogus","version":1,"width":64,"ops":[{"op":"frobnicate","k":3}]}"""

    match ZetaIrEval.runCanonicalJsonAny json 1UL with
    | Ok v -> failwith (sprintf "an unknown op evaluated to %d instead of being rejected" v)
    | Error e -> Assert.Contains("frobnicate", e, StringComparison.Ordinal)

/// A width the evaluator has no semantics for is rejected, not approximated.
[<Fact>]
let ``an unsupported width is rejected, not approximated`` () =
    let ir: ZetaIrV4.Ir =
        { Generator = "test.w17"
          Version = 1
          Width = 17
          Ops = [ ZetaIrV4.Mul 3L ] }

    match ZetaIrEval.run ir 1UL with
    | Ok v -> failwith (sprintf "width 17 evaluated to %d instead of being rejected" v)
    | Error e -> Assert.Contains("17", e, StringComparison.Ordinal)

/// An input too wide for the IR is rejected rather than truncated.
///
/// Truncation is how a width mismatch HIDES — the wrong-width lane keeps producing plausible
/// numbers. Refusing turns the mismatch into a named failure.
[<Fact>]
let ``an input wider than the IR's width is rejected, not truncated`` () =
    let fmix32 = ZetaIrV4.ofV1 ZetaIrV1.fmix32
    Assert.Equal(32, fmix32.Width)

    // In range: fine, and equals the committed golden for x-1.
    Assert.Equal<Result<uint64, string>>(Ok 1364076727UL, ZetaIrEval.run fmix32 1UL)

    match ZetaIrEval.run fmix32 4294967296UL with
    | Ok v -> failwith (sprintf "2^32 evaluated at width 32 to %d instead of being rejected" v)
    | Error e -> Assert.Contains("does not fit width 32", e, StringComparison.Ordinal)

/// A shift of width-or-more is refused rather than silently given .NET's masked semantics.
[<Fact>]
let ``a shift of width-or-more is refused rather than silently masked`` () =
    let ir (width: int) (s: int64) : ZetaIrV4.Ir =
        { Generator = "test.shift"
          Version = 1
          Width = width
          Ops = [ ZetaIrV4.XorShr s ] }

    // width-1 is the largest legal shift and evaluates.
    match ZetaIrEval.run (ir 64 63L) 0xFFFFFFFFFFFFFFFFUL with
    | Ok _ -> ()
    | Error e -> failwith (sprintf "a legal shift of 63 at width 64 was rejected: %s" e)

    for bad in [ 64L; 65L; -1L ] do
        match ZetaIrEval.run (ir 64 bad) 1UL with
        | Ok v -> failwith (sprintf "shift %d at width 64 evaluated to %d instead of being rejected" bad v)
        | Error _ -> ()

    // And the same boundary at width 32 — 32 is illegal there even though it is legal-ish at 64.
    match ZetaIrEval.run (ir 32 32L) 1UL with
    | Ok v -> failwith (sprintf "shift 32 at width 32 evaluated to %d instead of being rejected" v)
    | Error e -> Assert.Contains("width 32", e, StringComparison.Ordinal)

/// A non-canonical or structurally invalid IR text is rejected by every schema and says so.
[<Fact>]
let ``text that is not a valid IR under any frozen schema is rejected`` () =
    match ZetaIrEval.runCanonicalJsonAny """{"schema":"zeta-ir-v9","ops":[]}""" 1UL with
    | Ok v -> failwith (sprintf "an unknown schema evaluated to %d" v)
    | Error e -> Assert.Contains("v1", e, StringComparison.Ordinal)

// ═══ 4. AGREEMENT WITH THE INCUMBENT DENOTATION ══════════════════════════════════

/// `ZetaIrNormalizer.evalOp64` / `evalOp32` agree with the canonical evaluator on every
/// committed IR and golden input.
///
/// The normalizer's soundness proof (FsCheck + `NormalizerCorrect.lean`) is stated against
/// that op-level denotation, so this test is what keeps the proof pointed at the same
/// semantics the goldens pin. Before the canonical evaluator existed these were two
/// unrelated answers that happened to coincide.
[<Fact>]
let ``the normalizer's op-level denotation agrees with the canonical evaluator`` () =
    for ir in allIrs do
        for v in loadVectors (primitiveDirOf ir.Generator) do
            let viaNormalizer =
                if ir.Width = 32 then
                    ir.Ops |> List.fold (fun z op -> ZetaIrNormalizer.evalOp32 op z) (uint32 v.X) |> uint64
                else
                    ir.Ops |> List.fold (fun z op -> ZetaIrNormalizer.evalOp64 op z) v.X

            Assert.Equal<Result<uint64, string>>(Ok viaNormalizer, ZetaIrEval.run ir v.X)

/// Normalizing an IR into the core four preserves its meaning under the canonical evaluator.
///
/// The normalizer already claims this at op level; asserting it at PROGRAM level against the
/// committed goldens is what makes the claim reach the artifacts anyone actually ships.
[<Fact>]
let ``normalizing an IR preserves its canonical denotation on every golden`` () =
    for ir in allIrs do
        let normalized = ZetaIrNormalizer.normalize ir

        for v in loadVectors (primitiveDirOf ir.Generator) do
            Assert.Equal<Result<uint64, string>>(Ok v.Expected, ZetaIrEval.run normalized v.X)
