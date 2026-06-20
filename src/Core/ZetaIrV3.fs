namespace Zeta.Core

/// ZetaIrV3 — the SECOND grammar-EXTENDING evolution of the generator IR.
///
/// WHY v3 (and why a SECOND new module, not a v2 edit). v2 proved the envelope can evolve
/// ONCE: it added `rotl` (provably outside v1's `mul`/`xorshr` grammar) under a bumped tag,
/// landing a fourth generator (xoshiro256**) whose scrambler is a strictly SEQUENTIAL chain
/// `mul · rotl · mul`. But every op exercised so far — `mul`, `xorshr`, `rotl` — is a
/// SINGLE-INPUT step `z := f(z)` that consumes only the running accumulator. The strongest
/// evidence a freeze-and-evolve discipline can offer is that it survives a SECOND, DIFFERENT
/// kind of extension: an op that reuses the input word in PARALLEL, which no sequential
/// `mul/xorshr/rotl` chain can express. Pelle Evensen's public-domain `nasam` mixer
/// (mostlymangling.blogspot.com/2020/01/nasam-not-another-strange-acronym-mixer.html) is
/// exactly such a primitive — a pure single-word finaliser whose every mixing step is a
/// "xor the word with the XOR of several self-transforms":
///   x ^= ror(x,25) ^ ror(x,47);   x *= M1;   x ^= x>>23 ^ x>>51;   x *= M2;   x ^= x>>23 ^ x>>51
///
/// THE TWO NEW OPS (both provably outside the v2 grammar — see the necessity proof in
/// ZetaIrV3.Tests):
///   { "op": "xrotxor", "rs": [r1,r2,...] }  // x ^= rotl(x,r1) ^ rotl(x,r2) ^ ...
///   { "op": "xshrxor", "ss": [s1,s2,...] }  // x ^= (x>>>s1) ^ (x>>>s2) ^ ...
/// Both fold the ORIGINAL `x` through several rotations/shifts and XOR the lot back into `x`.
/// A v2 `rotl r` REPLACES the accumulator with its rotation (`z := rotl z r`); `xrotxor`
/// XORs rotations of the CURRENT word back IN (`z := z ^ rotl z r1 ^ rotl z r2`) — a
/// different function (e.g. `xrotxor[1]` on `1` is `1 ^ rotl(1,1) = 3`, whereas `rotl 1` is
/// `2`). And `xshrxor [s]` is EXACTLY v1/v2's `xorshr s` (`x ^= x>>>s`) — so the single-term
/// case recovers the old op, and v3 strictly GENERALISES it to many terms. nasam needs two
/// terms (`x ^= x>>23 ^ x>>51`), which a single `xorshr` cannot produce.
///
/// THE v3 ENVELOPE (canonical key order; the frozen v3 contract):
///   { "schema": "zeta-ir-v3",      // bumped tag — REQUIRED; v1/v2 validators reject it
///     "generator": <string>,
///     "version":   <int>,
///     "width":     <int>,
///     "ops":       [ <op-node>... ] }
/// op-node grammar (total; v3 = v2's three ops PLUS xrotxor and xshrxor):
///   { "op": "mul",     "k": <int> }            // multiply mod 2^width            (v1)
///   { "op": "xorshr",  "s": <int> }            // x ^= x >>> s                     (v1)
///   { "op": "rotl",    "r": <int> }            // (x<<r)|(x>>>(width-r))           (v2)
///   { "op": "xrotxor", "rs": [<int>...] }      // x ^= rotl(x,r_i) ^ ...           (NEW v3)
///   { "op": "xshrxor", "ss": [<int>...] }      // x ^= (x>>>s_i) ^ ...             (NEW v3)
///
/// HOMOICONIC INVARIANT (unchanged from v1/v2): NO stored `zetaId`. Identity is the derived
/// content-address `GeneratorRegistry.idOf generator version`.
///
/// FORWARD COMPATIBILITY. Every v2 op is a v3 op (`rotl` carries over verbatim; v2's
/// `xorshr s` widens to `xshrxor [s]`). `ofV2` widens a `ZetaIrV2.Ir` into v3, and because
/// `ZetaIrV2.ofV1` already widens v1->v2, `ofV1 = ofV2 ∘ ZetaIrV2.ofV1` gives the full chain.
/// v3 reads v1's and v2's vocabularies; neither v1 nor v2 reads v3's (their validators reject
/// the tag — the firewall the evolution contract demands, now two layers deep).
///
/// TIER. PROVEN here: a THIRD frozen layout that strictly extends v2's grammar with two
/// provably-necessary parallel-reuse ops; a total validator accepting
/// `mul|xorshr|rotl|xrotxor|xshrxor` and rejecting every deviation; a fifth generator
/// (externally anchored to Evensen's public-domain nasam) expressed under v3 with a
/// byte-locked golden and a cross-language N-way oracle; and the two-layer firewall
/// (v1 and v2 reject v3; v3 widens both). NOT claimed: the Face-3 Lean/Z3 `gen(gen)=gen`
/// theorem (math team's), nor that v3 is the final layout.
[<RequireQualifiedAccess>]
module ZetaIrV3 =

    /// The frozen v3 schema tag.
    [<Literal>]
    let SchemaTag = "zeta-ir-v3"

    /// A single finaliser op. v3 adds `XRotXor`/`XShrXor` to v2's `Mul`/`XorShr`/`Rotl`.
    type Op =
        /// multiply mod 2^width; `K` is the multiplier as a signed-int64 bit-pattern.
        | Mul of K: int64
        /// xor-shift-right by `S` bits: `x ^= x >>> S` (v1; == `XShrXor [S]`).
        | XorShr of S: int64
        /// rotate-left by `R` bits: `(x << R) | (x >>> (width - R))` (v2).
        | Rotl of R: int64
        /// xor the word with the XOR of several rotations of itself:
        /// `x ^= rotl(x,r1) ^ rotl(x,r2) ^ ...`. NEW in v3 (parallel reuse of `x`).
        | XRotXor of Rs: int64 list
        /// xor the word with the XOR of several right-shifts of itself:
        /// `x ^= (x>>>s1) ^ (x>>>s2) ^ ...`. NEW in v3; `XShrXor [s]` == v1's `XorShr s`.
        | XShrXor of Ss: int64 list

    /// A v3 generator IR. `ZetaId` is not a field; it is the derived content-address.
    type Ir =
        { Generator: string
          Version: int
          Width: int
          Ops: Op list }

    /// The derived content-address (pure function of generator@version, unchanged from v1/v2).
    let zetaId (ir: Ir) : string = GeneratorRegistry.idOf ir.Generator ir.Version

    // ── widening: every v2 IR is a v3 IR (v3 reads v2's vocabulary) ───────────────────

    /// Widen a single v2 op into the v3 op set (total: v2's ops are a subset of v3's;
    /// v2's single-term `XorShr s` widens to the one-element `XShrXor [s]`).
    let ofV2Op (op: ZetaIrV2.Op) : Op =
        match op with
        | ZetaIrV2.Mul k -> Mul k
        | ZetaIrV2.XorShr s -> XShrXor [ s ]
        | ZetaIrV2.Rotl r -> Rotl r

    /// Widen a frozen `ZetaIrV2.Ir` into a v3 `Ir` (schema tag changes; semantics do not).
    let ofV2 (ir: ZetaIrV2.Ir) : Ir =
        { Generator = ir.Generator
          Version = ir.Version
          Width = ir.Width
          Ops = ir.Ops |> List.map ofV2Op }

    /// Widen a v1 IR all the way to v3 via the v1->v2->v3 chain.
    let ofV1 (ir: ZetaIrV1.Ir) : Ir = ofV2 (ZetaIrV2.ofV1 ir)

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

    /// The canonical `DynamicValue` for a v3 IR, in the frozen key order
    /// (schema, generator, version, width, ops).
    let toDynamicValue (ir: Ir) : DynamicValue =
        DynamicValue.Object
            [ ("schema", DynamicValue.String SchemaTag)
              ("generator", DynamicValue.String ir.Generator)
              ("version", DynamicValue.Int(int64 ir.Version))
              ("width", DynamicValue.Int(int64 ir.Width))
              ("ops", DynamicValue.Array(ir.Ops |> List.map opToDv)) ]

    /// The canonical-JSON bytes for a v3 IR (the frozen golden), via the REAL
    /// `DynamicValue.toCanonicalJson` (shares the cross-language byte-lock machinery).
    let toCanonicalJson (ir: Ir) : Result<string, EncodeError> =
        DynamicValue.toCanonicalJson (toDynamicValue ir)

    // ── the total validator (accepts mul|xorshr|rotl|xrotxor|xshrxor) ────────────────

    /// Validate a `DynamicValue` as a well-formed v3 IR. The error string NAMES the first
    /// deviation. Accepts the v3 tag only; a v1/v2 artifact is NOT a v3 artifact (the schema
    /// tag is the version).
    let validate (dv: DynamicValue) : Result<Ir, string> =
        let field k entries =
            entries |> List.tryPick (fun (kk, v) -> if kk = k then Some v else None)

        // parse an integer-list field (the `rs`/`ss` term lists) — total, names deviations.
        let parseIntList (label: string) (node: DynamicValue) : Result<int64 list, string> =
            match node with
            | DynamicValue.Array items ->
                let rec go acc rem =
                    match rem with
                    | [] -> Ok(List.rev acc)
                    | DynamicValue.Int n :: rest -> go (n :: acc) rest
                    | _ -> Error(sprintf "v3 op `%s` term list must contain only integers" label)
                match go [] items with
                | Ok [] -> Error(sprintf "v3 op `%s` requires a non-empty integer term list" label)
                | other -> other
            | _ -> Error(sprintf "v3 op `%s` requires an array term list" label)

        match dv with
        | DynamicValue.Object entries ->
            match field "zetaId" entries with
            | Some _ ->
                Error "v3 IR must NOT carry a stored `zetaId` (identity is the derived content-address)"
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
                                        | _ -> Error "v3 op `mul` requires an integer `k`"
                                    | Some(DynamicValue.String "xorshr") ->
                                        match field "s" opEntries with
                                        | Some(DynamicValue.Int s) -> parseOps (XorShr s :: acc) rest
                                        | _ -> Error "v3 op `xorshr` requires an integer `s`"
                                    | Some(DynamicValue.String "rotl") ->
                                        match field "r" opEntries with
                                        | Some(DynamicValue.Int r) -> parseOps (Rotl r :: acc) rest
                                        | _ -> Error "v3 op `rotl` requires an integer `r`"
                                    | Some(DynamicValue.String "xrotxor") ->
                                        match field "rs" opEntries with
                                        | Some node ->
                                            match parseIntList "xrotxor" node with
                                            | Ok rs -> parseOps (XRotXor rs :: acc) rest
                                            | Error e -> Error e
                                        | None -> Error "v3 op `xrotxor` requires an integer array `rs`"
                                    | Some(DynamicValue.String "xshrxor") ->
                                        match field "ss" opEntries with
                                        | Some node ->
                                            match parseIntList "xshrxor" node with
                                            | Ok ss -> parseOps (XShrXor ss :: acc) rest
                                            | Error e -> Error e
                                        | None -> Error "v3 op `xshrxor` requires an integer array `ss`"
                                    | Some(DynamicValue.String other) ->
                                        Error(
                                            sprintf
                                                "v3 op `%s` is not in the v3 grammar (mul | xorshr | rotl | xrotxor | xshrxor)"
                                                other
                                        )
                                    | _ -> Error "v3 op node requires a string `op`"
                                | _ -> Error "v3 `ops` entries must be objects"
                        match parseOps [] opNodes with
                        | Ok parsedOps ->
                            Ok
                                { Generator = g
                                  Version = int v
                                  Width = int w
                                  Ops = parsedOps }
                        | Error e -> Error e
                    | _ ->
                        Error "v3 IR requires string `generator`, int `version`, int `width`, and array `ops`"
                | Some(DynamicValue.String s) -> Error(sprintf "schema tag `%s` is not `%s`" s SchemaTag)
                | Some _ -> Error "v3 `schema` must be a string"
                | None -> Error "v3 IR is missing the required `schema` tag"
        | _ -> Error "v3 IR must be a JSON object"

    /// Round-trip helper: validate canonical-JSON text as a v3 IR.
    let validateCanonicalJson (json: string) : Result<Ir, string> =
        match DynamicValue.fromCanonicalJson json with
        | Ok dv -> validate dv
        | Error e -> Error(sprintf "not canonical JSON: %A" e)

    // ── the fifth generator, expressed UNDER v3 (the frozen v3 golden row) ───────────

    /// Pelle Evensen's public-domain `nasam` mixer under v3 — the FIFTH generator and the
    /// first to need the parallel-reuse ops (`xrotxor`/`xshrxor`) outside the v2 grammar.
    /// Reference (public domain):
    ///   mostlymangling.blogspot.com/2020/01/nasam-not-another-strange-acronym-mixer.html
    ///     x ^= ror(x,25) ^ ror(x,47);  x *= 0x9E6C63D0676A9A99;
    ///     x ^= x>>23 ^ x>>51;          x *= 0x9E6D62D06F6A9A9B;
    ///     x ^= x>>23 ^ x>>51;
    /// Rotate amounts are stored as the rotl-equivalents of nasam's ROR amounts at width 64
    /// (`ror 25 = rotl 39`, `ror 47 = rotl 17`). The u64 multipliers are stored as their
    /// signed-int64 bit-pattern (multiply is mod 2^64, so the reinterpretation is bit-exact).
    let nasam: Ir =
        { Generator = "hash.nasam"
          Version = 1
          Width = 64
          Ops =
            [ XRotXor [ 39L; 17L ] // x ^= ror(x,25) ^ ror(x,47)  ==  x ^= rotl(x,39) ^ rotl(x,17)
              Mul -7031135171492799847L // 0x9E6C63D0676A9A99
              XShrXor [ 23L; 51L ] // x ^= x>>23 ^ x>>51
              Mul -7030854795893499237L // 0x9E6D62D06F6A9A9B
              XShrXor [ 23L; 51L ] ] } // x ^= x>>23 ^ x>>51

    /// All known v3 IRs (the rows the frozen v3 golden file pins).
    let known: Ir list = [ nasam ]
