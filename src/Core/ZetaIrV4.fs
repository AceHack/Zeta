namespace Zeta.Core

/// ZetaIrV4 — the THIRD grammar-EXTENDING evolution of the generator IR.
///
/// WHY v4 (and why a new module). The ops accumulated through v1/v2/v3 (`mul`, `xorshr`,
/// `rotl`, `xrotxor`, `xshrxor`) are all either linear over $\mathbb{F}_2$ (the XOR-based
/// ops) or linear over $\mathbb{Z}/2^W\mathbb{Z}$ (multiplication). A fundamental property
/// of all these operations is that they map 0 to 0. Therefore, any sequence of v3 operations
/// applied to an input of 0 will yield 0.
///
/// To express an affine translation like `x += k` (which maps 0 to k), we need an operation
/// that is strictly outside the v3 grammar. This is required to express the state-advance
/// step of a Linear Congruential Generator (LCG) or the Permuted Congruential Generator (PCG),
/// which relies on `state = state * multiplier + increment`.
///
/// THE NEW OP (outside the v3 grammar; the argument is the paragraph above — the 0-fixing
/// invariant — and its FALSIFIER is `every non-Add op sequence fixes 0, and Add does not` in
/// `tests/Tests.FSharp/ZetaIrMinimalSet.Tests.fs`, which draws random non-`add` sequences at
/// both widths. The similarly-named test in `ZetaIrV4.Tests` is an illustration of three fixed
/// instances, not a proof: it never builds an op sequence and passes with `Add` deleted):
///   { "op": "add", "k": <int> }   // x += k mod 2^width
///
/// THE v4 ENVELOPE (canonical key order; the frozen v4 contract):
///   { "schema": "zeta-ir-v4",      // bumped tag — REQUIRED; v1/v2/v3 validators reject it
///     "generator": <string>,
///     "version":   <int>,
///     "width":     <int>,
///     "ops":       [ <op-node>... ] }
/// op-node grammar (total; v4 = v3's five ops PLUS add):
///   { "op": "mul",     "k": <int> }            // multiply mod 2^width            (v1)
///   { "op": "xorshr",  "s": <int> }            // x ^= x >>> s                     (v1)
///   { "op": "rotl",    "r": <int> }            // (x<<r)|(x>>>(width-r))           (v2)
///   { "op": "xrotxor", "rs": [<int>...] }      // x ^= rotl(x,r_i) ^ ...           (v3)
///   { "op": "xshrxor", "ss": [<int>...] }      // x ^= (x>>>s_i) ^ ...             (v3)
///   { "op": "add",     "k": <int> }            // x += k mod 2^width               (NEW v4)
///
/// HOMOICONIC INVARIANT (unchanged): NO stored `zetaId`. Identity is the derived
/// content-address `GeneratorRegistry.idOf generator version`.
///
/// FORWARD COMPATIBILITY. Every v3 op is a v4 op. `ofV3` widens a `ZetaIrV3.Ir` into v4.
/// The firewall is now three layers deep: v1/v2/v3 reject v4; v4 widens all of them.
///
/// TIER. PROVEN here: a FOURTH frozen layout extending v3 with `add`; a total validator
/// accepting the 6-op grammar and rejecting deviations; a sixth generator (Knuth's MMIX LCG)
/// expressed under v4 with a byte-locked golden; and the three-layer firewall.
[<RequireQualifiedAccess>]
module ZetaIrV4 =

    /// The frozen v4 schema tag.
    [<Literal>]
    let SchemaTag = "zeta-ir-v4"

    /// A single finaliser op. v4 adds `Add` to v3's ops.
    type Op =
        /// multiply mod 2^width; `K` is the multiplier as a signed-int64 bit-pattern.
        | Mul of K: int64
        /// xor-shift-right by `S` bits: `x ^= x >>> S` (v1; == `XShrXor [S]`).
        | XorShr of S: int64
        /// rotate-left by `R` bits: `(x << R) | (x >>> (width - R))` (v2).
        | Rotl of R: int64
        /// xor the word with the XOR of several rotations of itself (v3).
        | XRotXor of Rs: int64 list
        /// xor the word with the XOR of several right-shifts of itself (v3).
        | XShrXor of Ss: int64 list
        /// add mod 2^width; `K` is the addend as a signed-int64 bit-pattern. NEW in v4.
        | Add of K: int64

    /// A v4 generator IR. `ZetaId` is not a field; it is the derived content-address.
    type Ir =
        { Generator: string
          Version: int
          Width: int
          Ops: Op list }

    /// The derived content-address (pure function of generator@version).
    let zetaId (ir: Ir) : string = GeneratorRegistry.idOf ir.Generator ir.Version

    // ── widening: every v3 IR is a v4 IR (v4 reads v3's vocabulary) ───────────────────

    /// Widen a single v3 op into the v4 op set.
    let ofV3Op (op: ZetaIrV3.Op) : Op =
        match op with
        | ZetaIrV3.Mul k -> Mul k
        | ZetaIrV3.XorShr s -> XorShr s
        | ZetaIrV3.Rotl r -> Rotl r
        | ZetaIrV3.XRotXor rs -> XRotXor rs
        | ZetaIrV3.XShrXor ss -> XShrXor ss

    /// Widen a frozen `ZetaIrV3.Ir` into a v4 `Ir`.
    let ofV3 (ir: ZetaIrV3.Ir) : Ir =
        { Generator = ir.Generator
          Version = ir.Version
          Width = ir.Width
          Ops = ir.Ops |> List.map ofV3Op }

    /// Widen a v2 IR all the way to v4.
    let ofV2 (ir: ZetaIrV2.Ir) : Ir = ofV3 (ZetaIrV3.ofV2 ir)

    /// Widen a v1 IR all the way to v4.
    let ofV1 (ir: ZetaIrV1.Ir) : Ir = ofV3 (ZetaIrV3.ofV1 ir)

    // ── projection to the canonical DynamicValue (the byte-locked form) ──────────────

    let private opToDv (op: Op) : DynamicValue =
        match op with
        | Mul k -> DynamicValue.Object [ ("op", DynamicValue.String "mul"); ("k", DynamicValue.Int k) ]
        | XorShr s -> DynamicValue.Object [ ("op", DynamicValue.String "xorshr"); ("s", DynamicValue.Int s) ]
        | Rotl r -> DynamicValue.Object [ ("op", DynamicValue.String "rotl"); ("r", DynamicValue.Int r) ]
        | XRotXor rs ->
            DynamicValue.Object
                [ ("op", DynamicValue.String "xrotxor")
                  ("rs", DynamicValue.Array(rs |> List.map DynamicValue.Int)) ]
        | XShrXor ss ->
            DynamicValue.Object
                [ ("op", DynamicValue.String "xshrxor")
                  ("ss", DynamicValue.Array(ss |> List.map DynamicValue.Int)) ]
        | Add k -> DynamicValue.Object [ ("op", DynamicValue.String "add"); ("k", DynamicValue.Int k) ]

    /// The canonical `DynamicValue` for a v4 IR, in the frozen key order.
    let toDynamicValue (ir: Ir) : DynamicValue =
        DynamicValue.Object
            [ ("schema", DynamicValue.String SchemaTag)
              ("generator", DynamicValue.String ir.Generator)
              ("version", DynamicValue.Int(int64 ir.Version))
              ("width", DynamicValue.Int(int64 ir.Width))
              ("ops", DynamicValue.Array(ir.Ops |> List.map opToDv)) ]

    /// The canonical-JSON bytes for a v4 IR (the frozen golden).
    let toCanonicalJson (ir: Ir) : Result<string, EncodeError> =
        DynamicValue.toCanonicalJson (toDynamicValue ir)

    // ── the total validator (accepts mul|xorshr|rotl|xrotxor|xshrxor|add) ────────────

    /// Validate a `DynamicValue` as a well-formed v4 IR. The error string NAMES the first
    /// deviation. Accepts the v4 tag only.
    let validate (dv: DynamicValue) : Result<Ir, string> =
        let field k entries =
            entries |> List.tryPick (fun (kk, v) -> if kk = k then Some v else None)

        let parseIntList (label: string) (node: DynamicValue) : Result<int64 list, string> =
            match node with
            | DynamicValue.Array items ->
                let rec go acc rem =
                    match rem with
                    | [] -> Ok(List.rev acc)
                    | DynamicValue.Int n :: rest -> go (n :: acc) rest
                    | _ -> Error(sprintf "v4 op `%s` term list must contain only integers" label)
                match go [] items with
                | Ok [] -> Error(sprintf "v4 op `%s` requires a non-empty integer term list" label)
                | other -> other
            | _ -> Error(sprintf "v4 op `%s` requires an array term list" label)

        match dv with
        | DynamicValue.Object entries ->
            match field "zetaId" entries with
            | Some _ ->
                Error "v4 IR must NOT carry a stored `zetaId` (identity is the derived content-address)"
            | None ->
                let schema = field "schema" entries
                let generator = field "generator" entries
                let version = field "version" entries
                let width = field "width" entries
                let ops = field "ops" entries

                match schema with
                | Some(DynamicValue.String s) when s = SchemaTag ->
                    match generator, version, width, ops with
                    | Some(DynamicValue.String g),
                      Some(DynamicValue.Int v),
                      Some(DynamicValue.Int w),
                      Some(DynamicValue.Array opNodes) ->
                        let rec parseOps acc remaining =
                            match remaining with
                            | [] -> Ok(List.rev acc)
                            | node :: rest ->
                                match node with
                                | DynamicValue.Object opEntries ->
                                    match field "op" opEntries with
                                    | Some(DynamicValue.String "mul") ->
                                        match field "k" opEntries with
                                        | Some(DynamicValue.Int k) -> parseOps (Mul k :: acc) rest
                                        | _ -> Error "v4 op `mul` requires an integer `k`"
                                    | Some(DynamicValue.String "xorshr") ->
                                        match field "s" opEntries with
                                        | Some(DynamicValue.Int s) -> parseOps (XorShr s :: acc) rest
                                        | _ -> Error "v4 op `xorshr` requires an integer `s`"
                                    | Some(DynamicValue.String "rotl") ->
                                        match field "r" opEntries with
                                        | Some(DynamicValue.Int r) -> parseOps (Rotl r :: acc) rest
                                        | _ -> Error "v4 op `rotl` requires an integer `r`"
                                    | Some(DynamicValue.String "xrotxor") ->
                                        match field "rs" opEntries with
                                        | Some node ->
                                            match parseIntList "xrotxor" node with
                                            | Ok rs -> parseOps (XRotXor rs :: acc) rest
                                            | Error e -> Error e
                                        | None -> Error "v4 op `xrotxor` requires an integer array `rs`"
                                    | Some(DynamicValue.String "xshrxor") ->
                                        match field "ss" opEntries with
                                        | Some node ->
                                            match parseIntList "xshrxor" node with
                                            | Ok ss -> parseOps (XShrXor ss :: acc) rest
                                            | Error e -> Error e
                                        | None -> Error "v4 op `xshrxor` requires an integer array `ss`"
                                    | Some(DynamicValue.String "add") ->
                                        match field "k" opEntries with
                                        | Some(DynamicValue.Int k) -> parseOps (Add k :: acc) rest
                                        | _ -> Error "v4 op `add` requires an integer `k`"
                                    | Some(DynamicValue.String other) ->
                                        Error(
                                            sprintf
                                                "v4 op `%s` is not in the v4 grammar (mul | xorshr | rotl | xrotxor | xshrxor | add)"
                                                other
                                        )
                                    | _ -> Error "v4 op node requires a string `op`"
                                | _ -> Error "v4 `ops` entries must be objects"
                        match parseOps [] opNodes with
                        | Ok parsedOps ->
                            Ok
                                { Generator = g
                                  Version = int v
                                  Width = int w
                                  Ops = parsedOps }
                        | Error e -> Error e
                    | _ ->
                        Error "v4 IR requires string `generator`, int `version`, int `width`, and array `ops`"
                | Some(DynamicValue.String s) -> Error(sprintf "schema tag `%s` is not `%s`" s SchemaTag)
                | Some _ -> Error "v4 `schema` must be a string"
                | None -> Error "v4 IR is missing the required `schema` tag"
        | _ -> Error "v4 IR must be a JSON object"

    /// Round-trip helper: validate canonical-JSON text as a v4 IR.
    let validateCanonicalJson (json: string) : Result<Ir, string> =
        match DynamicValue.fromCanonicalJson json with
        | Ok dv -> validate dv
        | Error e -> Error(sprintf "not canonical JSON: %A" e)

    // ── the sixth generator, expressed UNDER v4 (the frozen v4 golden row) ───────────

    /// Knuth's 64-bit Linear Congruential Generator (from MMIX) under v4.
    /// This is the SIXTH generator, and the first to require the affine `add` op outside
    /// the v3 grammar. The algorithm is `x = x * 6364136223846793005 + 1442695040888963407`.
    /// The multiplier is the same one used in PCG32's state advance.
    /// The u64 constants are stored as their signed-int64 bit-patterns.
    let lcg64_mmix: Ir =
        { Generator = "rng.lcg64_mmix"
          Version = 1
          Width = 64
          Ops =
            [ Mul 6364136223846793005L
              Add 1442695040888963407L ] }

    /// Numerical Recipes 32-bit Linear Congruential Generator under v4.
    /// This is the SEVENTH generator, and the second to require the affine `add` op.
    /// The algorithm is `x = x * 1664525 + 1013904223`.
    let lcg32_numerical_recipes: Ir =
        { Generator = "rng.lcg32_numerical_recipes"
          Version = 1
          Width = 32
          Ops =
            [ Mul 1664525L
              Add 1013904223L ] }

    /// MurmurHash3's 32-bit block mix tail (the `h` accumulator update).
    /// This is the EIGHTH generator, and the THIRD add-anchor. It exercises `add`
    /// in combination with `rotl` and `mul` (the algorithm is `h = rotl(h, 13); h = h * 5 + 0xe6546b64`).
    /// The constants are stored as signed-int64 bit-patterns.
    let murmur3_32_tail: Ir =
        { Generator = "hash.murmur3_32_tail"
          Version = 1
          Width = 32
          Ops =
            [ Rotl 13L
              Mul 5L
              Add 3864292196L ] } // 0xe6546b64 as uint32 -> int64

    /// glibc's 32-bit Linear Congruential Generator under v4.
    /// This is the NINTH generator, and the FOURTH add-anchor.
    /// The algorithm is `x = x * 1103515245 + 12345`.
    let lcg32_glibc: Ir =
        { Generator = "rng.lcg32_glibc"
          Version = 1
          Width = 32
          Ops =
            [ Mul 1103515245L
              Add 12345L ] }

    /// All known v4 IRs (the rows the frozen v4 golden file pins).
    let known: Ir list = [ lcg64_mmix; lcg32_numerical_recipes; murmur3_32_tail; lcg32_glibc ]
