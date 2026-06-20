namespace Zeta.Core

/// ZetaIrV2 — the FIRST grammar-EXTENDING evolution of the generator IR.
///
/// WHY v2 (and why a new module, not a v1 edit). The three generators expressed under
/// `zeta-ir-v1` (splitmix64, fmix32, fmix64) all live inside one finaliser vocabulary:
/// `mul` and `xorshr`. That is genuine evidence the frozen envelope GENERALISES across
/// same-family primitives — but it does NOT exercise the one promise a freeze makes that
/// matters most for a self-hosting proof: that the layout can EVOLVE without silently
/// corrupting what came before. The `zeta-ir-v1` evolution contract (docs/specs/
/// zeta-ir-v1.md, "Evolution contract (v2+)") is explicit:
///   1. "The schema tag is the version. A breaking layout change MUST bump the tag
///      (`zeta-ir-v2`) and ship its own frozen golden. The v1 validator rejects any other
///      tag, so a v2 artifact can never be silently read as v1."
///
/// A fourth generator whose finaliser needs an op OUTSIDE `{mul, xorshr}` is exactly such
/// a breaking change. The xoshiro256** output scrambler (Blackman & Vigna, public domain,
/// https://prng.di.unimi.it/xoshiro256starstar.c) is `result = rotl(x * 5, 7) * 9` — i.e.
/// `Mul 5 · Rotl 7 · Mul 9` at width 64. The `Rotl` (rotate-left-by-constant) op is NOT
/// expressible in the v1 grammar: `mul` only propagates carries UPWARD and `xorshr` only
/// moves bits DOWNWARD, but `rotl` WRAPS the most-significant bit down to bit 0
/// (`rotl(1<<63, 1) = 1`). So v2 must add `rotl` — and per the contract it does so under a
/// NEW frozen tag, in a NEW module, leaving `ZetaIrV1` byte-for-byte untouched.
///
/// THE v2 ENVELOPE (canonical key order; the frozen v2 contract):
///   { "schema": "zeta-ir-v2",      // bumped tag — REQUIRED; v1's validator rejects it
///     "generator": <string>,
///     "version":   <int>,
///     "width":     <int>,
///     "ops":       [ <op-node>... ] }
/// op-node grammar (total; v2 = v1's two ops PLUS rotl):
///   { "op": "mul",    "k": <int> }   // multiply mod 2^width
///   { "op": "xorshr", "s": <int> }   // x ^= x >>> s
///   { "op": "rotl",   "r": <int> }   // (x << r) | (x >>> (width - r))   — NEW in v2
///
/// HOMOICONIC INVARIANT (unchanged from v1, per contract clause 3): NO stored `zetaId`.
/// Identity is the derived content-address `GeneratorRegistry.idOf generator version`.
///
/// FORWARD COMPATIBILITY. Every v1 op is a v2 op, so `ofV1` widens a `ZetaIrV1.Ir` into a
/// v2 `Ir` (changing only the schema tag, never the semantics). This is the honest
/// direction: v2 reads v1's vocabulary; v1 does NOT read v2's (its validator rejects the
/// tag — the firewall the contract demands).
///
/// TIER. PROVEN here: a second frozen layout that strictly extends v1's grammar with a
/// provably-necessary op; a total validator accepting `mul|xorshr|rotl` and rejecting
/// every deviation; a fourth generator (externally anchored to the public-domain xoshiro
/// reference) expressed under v2 with a byte-locked golden and a cross-language N-way
/// oracle; and the v1/v2 firewall (v1 rejects v2; v2 widens v1). NOT claimed: the Face-3
/// Lean/Z3 `gen(gen)=gen` theorem (math team's), nor that v2 is the final layout.
[<RequireQualifiedAccess>]
module ZetaIrV2 =

    /// The frozen v2 schema tag.
    [<Literal>]
    let SchemaTag = "zeta-ir-v2"

    /// A single finaliser op. v2 adds `Rotl` to v1's `Mul`/`XorShr`.
    type Op =
        /// multiply mod 2^width; `K` is the multiplier as a signed-int64 bit-pattern.
        | Mul of K: int64
        /// xor-shift-right by `S` bits: `x ^= x >>> S`.
        | XorShr of S: int64
        /// rotate-left by `R` bits: `(x << R) | (x >>> (width - R))`. NEW in v2.
        | Rotl of R: int64

    /// A v2 generator IR. `ZetaId` is not a field; it is the derived content-address.
    type Ir =
        { Generator: string
          Version: int
          Width: int
          Ops: Op list }

    /// The derived content-address (pure function of generator@version, unchanged from v1).
    let zetaId (ir: Ir) : string = GeneratorRegistry.idOf ir.Generator ir.Version

    // ── widening: every v1 IR is a v2 IR (v2 reads v1's vocabulary) ──────────────────

    /// Widen a single v1 op into the v2 op set (total: v1's ops are a subset of v2's).
    let ofV1Op (op: ZetaIrV1.Op) : Op =
        match op with
        | ZetaIrV1.Mul k -> Mul k
        | ZetaIrV1.XorShr s -> XorShr s

    /// Widen a frozen `ZetaIrV1.Ir` into a v2 `Ir` (schema tag changes; semantics do not).
    let ofV1 (ir: ZetaIrV1.Ir) : Ir =
        { Generator = ir.Generator
          Version = ir.Version
          Width = ir.Width
          Ops = ir.Ops |> List.map ofV1Op }

    // ── projection to the canonical DynamicValue (the byte-locked form) ──────────────

    let private opToDv (op: Op) : DynamicValue =
        match op with
        | Mul k -> DynamicValue.Object [ ("op", DynamicValue.String "mul"); ("k", DynamicValue.Int k) ]
        | XorShr s -> DynamicValue.Object [ ("op", DynamicValue.String "xorshr"); ("s", DynamicValue.Int s) ]
        | Rotl r -> DynamicValue.Object [ ("op", DynamicValue.String "rotl"); ("r", DynamicValue.Int r) ]

    /// The canonical `DynamicValue` for a v2 IR, in the frozen key order
    /// (schema, generator, version, width, ops).
    let toDynamicValue (ir: Ir) : DynamicValue =
        DynamicValue.Object
            [ ("schema", DynamicValue.String SchemaTag)
              ("generator", DynamicValue.String ir.Generator)
              ("version", DynamicValue.Int(int64 ir.Version))
              ("width", DynamicValue.Int(int64 ir.Width))
              ("ops", DynamicValue.Array(ir.Ops |> List.map opToDv)) ]

    /// The canonical-JSON bytes for a v2 IR (the frozen golden), via the REAL
    /// `DynamicValue.toCanonicalJson` (shares the cross-language byte-lock machinery).
    let toCanonicalJson (ir: Ir) : Result<string, EncodeError> =
        DynamicValue.toCanonicalJson (toDynamicValue ir)

    // ── the total validator (accepts mul|xorshr|rotl, names every deviation) ─────────

    /// Validate a `DynamicValue` as a well-formed v2 IR. The error string NAMES the first
    /// deviation. Accepts the v2 tag only; a v1 artifact is NOT a v2 artifact (and vice
    /// versa) — the schema tag is the version.
    let validate (dv: DynamicValue) : Result<Ir, string> =
        let field k entries =
            entries |> List.tryPick (fun (kk, v) -> if kk = k then Some v else None)

        match dv with
        | DynamicValue.Object entries ->
            match field "zetaId" entries with
            | Some _ ->
                Error "v2 IR must NOT carry a stored `zetaId` (identity is the derived content-address)"
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
                                        | _ -> Error "v2 op `mul` requires an integer `k`"
                                    | Some(DynamicValue.String "xorshr") ->
                                        match field "s" opEntries with
                                        | Some(DynamicValue.Int s) -> parseOps (XorShr s :: acc) rest
                                        | _ -> Error "v2 op `xorshr` requires an integer `s`"
                                    | Some(DynamicValue.String "rotl") ->
                                        match field "r" opEntries with
                                        | Some(DynamicValue.Int r) -> parseOps (Rotl r :: acc) rest
                                        | _ -> Error "v2 op `rotl` requires an integer `r`"
                                    | Some(DynamicValue.String other) ->
                                        Error(sprintf "v2 op `%s` is not in the v2 grammar (mul | xorshr | rotl)" other)
                                    | _ -> Error "v2 op node requires a string `op`"
                                | _ -> Error "v2 `ops` entries must be objects"
                        match parseOps [] opNodes with
                        | Ok parsedOps ->
                            Ok
                                { Generator = g
                                  Version = int v
                                  Width = int w
                                  Ops = parsedOps }
                        | Error e -> Error e
                    | _ ->
                        Error "v2 IR requires string `generator`, int `version`, int `width`, and array `ops`"
                | Some(DynamicValue.String s) -> Error(sprintf "schema tag `%s` is not `%s`" s SchemaTag)
                | Some _ -> Error "v2 `schema` must be a string"
                | None -> Error "v2 IR is missing the required `schema` tag"
        | _ -> Error "v2 IR must be a JSON object"

    /// Round-trip helper: validate canonical-JSON text as a v2 IR.
    let validateCanonicalJson (json: string) : Result<Ir, string> =
        match DynamicValue.fromCanonicalJson json with
        | Ok dv -> validate dv
        | Error e -> Error(sprintf "not canonical JSON: %A" e)

    // ── the fourth generator, expressed UNDER v2 (the frozen v2 golden row) ──────────

    /// xoshiro256** output scrambler under v2 — `rotl(x * 5, 7) * 9` at width 64. The
    /// FOURTH generator and the first to require an op (`rotl`) outside the v1 grammar.
    /// Public-domain reference (Blackman & Vigna). This is the OUTPUT scrambler only (a
    /// pure finaliser over an input word), independent of the state-advance.
    let xoshiro256ss: Ir =
        { Generator = "rng.xoshiro256ss"
          Version = 1
          Width = 64
          Ops = [ Mul 5L; Rotl 7L; Mul 9L ] }

    /// All known v2 IRs (the rows the frozen v2 golden file pins).
    let known: Ir list = [ xoshiro256ss ]
