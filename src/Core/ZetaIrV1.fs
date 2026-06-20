namespace Zeta.Core

/// ZetaIrV1 — the FROZEN v1 layout of the generator IR.
///
/// WHY A FREEZE (math-team handoff row 10, Face 3 — the Futamura `gen(gen)=gen`
/// homoiconicity capstone). The gen-gen test plan (docs/research/2026-06-16-…-capstone.md,
/// "Phase A — Freeze the IR (prerequisite, BLOCKING)") is explicit: *"Nothing below can
/// byte-lock against a moving IR."* `GeneratorIrRegistry` already carries the IR as a live
/// row on a DBSP Z-set relation and reproduces the committed `*.ir.json` byte-for-byte —
/// but the SHAPE is unfrozen and, today, INCONSISTENT across the two shipped artifacts:
///   * `splitmix64.ir.json` carries `zetaId` and NO `width`,
///   * `fmix32.ir.json`     carries `width` and NO `zetaId`.
/// That difference is pre-existing (two separate PRs). A self-hosting fixed-point proof
/// cannot point at a moving target, so v1 pins ONE canonical envelope.
///
/// THE v1 ENVELOPE (canonical key order; this IS the frozen contract):
///   { "schema": "zeta-ir-v1",      // the version tag — REQUIRED in v1 (new vs the legacy files)
///     "generator": <string>,        // e.g. "rng.splitmix64"
///     "version":   <int>,           // generator version (NOT the schema version)
///     "width":     <int>,           // word width in BITS — REQUIRED in v1 (resolves splitmix64's omission: u64 ⇒ 64)
///     "ops":       [ <op-node>... ] } // the finaliser pipeline
/// op-node grammar (total; the only two ops the oracles fold):
///   { "op": "mul",    "k": <int> }   // multiply mod 2^width (u-word multipliers stored as signed bit-pattern)
///   { "op": "xorshr", "s": <int> }   // x ^= x >>> s
///
/// HOMOICONIC INVARIANT: there is **NO stored `zetaId`** in a v1 IR. The row's identity is
/// the DERIVED content-address `GeneratorRegistry.idOf generator version`, recomputed on
/// read. Storing the id as data is precisely the mintable-identity anti-pattern the
/// homoiconic rule forbids (`GeneratorIrRegistry`: "DERIVED from name@version, never
/// minted-and-forgotten"). The legacy `splitmix64.ir.json` `zetaId` field is therefore
/// **dropped** under v1 — and `idOf "rng.splitmix64" 1` reproduces exactly that value, so
/// no information is lost, only un-frozen redundancy.
///
/// TIER. PROVEN here: a single frozen v1 layout with a versioned, golden-vectored canonical
/// serialisation, a total validator that accepts conformant IRs and rejects every shape
/// deviation, and the two known generators expressed under v1 with byte-locked goldens.
/// NOT claimed here: the Face-3 Lean/Z3 `gen(gen)=gen` theorem itself (that remains the
/// math team's), nor that v1 is the final layout — the evolution contract (docs/specs/
/// zeta-ir-v1.md) governs v2+. This module only makes the substrate STABLE so the proof
/// has a fixed artifact to point at.
[<RequireQualifiedAccess>]
module ZetaIrV1 =

    /// The frozen schema tag. Every v1 IR carries exactly this under the `schema` key.
    [<Literal>]
    let SchemaTag = "zeta-ir-v1"

    /// A single finaliser op. Total: the two ops the cross-language oracles fold.
    type Op =
        /// multiply mod 2^width; `K` is the multiplier as a signed-int64 bit-pattern.
        | Mul of K: int64
        /// xor-shift-right by `S` bits: `x ^= x >>> S`.
        | XorShr of S: int64

    /// A v1 generator IR — the frozen, validated shape. `ZetaId` is NOT a field; it is the
    /// derived content-address, available via `zetaId` below.
    type Ir =
        { Generator: string
          Version: int
          /// Word width in bits (e.g. 64 for splitmix64, 32 for fmix32).
          Width: int
          Ops: Op list }

    /// The derived content-address for a v1 IR (id is a pure function of generator@version).
    let zetaId (ir: Ir) : string = GeneratorRegistry.idOf ir.Generator ir.Version

    // ── projection to the canonical DynamicValue (the byte-locked form) ─────────────

    let private opToDv (op: Op) : DynamicValue =
        match op with
        | Mul k -> DynamicValue.Object [ ("op", DynamicValue.String "mul"); ("k", DynamicValue.Int k) ]
        | XorShr s -> DynamicValue.Object [ ("op", DynamicValue.String "xorshr"); ("s", DynamicValue.Int s) ]

    /// The canonical `DynamicValue` for a v1 IR, in the frozen key order
    /// (schema, generator, version, width, ops). This is the single source the
    /// canonical-JSON byte-lock pins.
    let toDynamicValue (ir: Ir) : DynamicValue =
        DynamicValue.Object
            [ ("schema", DynamicValue.String SchemaTag)
              ("generator", DynamicValue.String ir.Generator)
              ("version", DynamicValue.Int(int64 ir.Version))
              ("width", DynamicValue.Int(int64 ir.Width))
              ("ops", DynamicValue.Array(ir.Ops |> List.map opToDv)) ]

    /// The canonical-JSON bytes for a v1 IR (the frozen golden). Goes through the REAL
    /// `DynamicValue.toCanonicalJson`, so it shares the cross-language byte-lock machinery.
    let toCanonicalJson (ir: Ir) : Result<string, EncodeError> =
        DynamicValue.toCanonicalJson (toDynamicValue ir)

    // ── the total validator (accepts conformant IRs, names every deviation) ─────────

    /// Validate that a `DynamicValue` is a well-formed v1 IR. The error string NAMES the
    /// first deviation so a drifting artifact fails loudly. This is the gate that "nothing
    /// byte-locks against a moving IR" depends on.
    let validate (dv: DynamicValue) : Result<Ir, string> =
        let field k entries =
            entries |> List.tryPick (fun (kk, v) -> if kk = k then Some v else None)

        match dv with
        | DynamicValue.Object entries ->
            // a stored `zetaId` is forbidden in v1 — identity is derived, never minted.
            match field "zetaId" entries with
            | Some _ ->
                Error "v1 IR must NOT carry a stored `zetaId` (identity is the derived content-address)"
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
                                        | _ -> Error "v1 op `mul` requires an integer `k`"
                                    | Some(DynamicValue.String "xorshr") ->
                                        match field "s" opEntries with
                                        | Some(DynamicValue.Int s) -> parseOps (XorShr s :: acc) rest
                                        | _ -> Error "v1 op `xorshr` requires an integer `s`"
                                    | Some(DynamicValue.String other) ->
                                        Error(sprintf "v1 op `%s` is not in the frozen grammar (mul | xorshr)" other)
                                    | _ -> Error "v1 op node requires a string `op`"
                                | _ -> Error "v1 `ops` entries must be objects"
                        match parseOps [] opNodes with
                        | Ok parsedOps ->
                            Ok
                                { Generator = g
                                  Version = int v
                                  Width = int w
                                  Ops = parsedOps }
                        | Error e -> Error e
                    | _ ->
                        Error "v1 IR requires string `generator`, int `version`, int `width`, and array `ops`"
                | Some(DynamicValue.String s) -> Error(sprintf "schema tag `%s` is not `%s`" s SchemaTag)
                | Some _ -> Error "v1 `schema` must be a string"
                | None -> Error "v1 IR is missing the required `schema` tag"
        | _ -> Error "v1 IR must be a JSON object"

    /// Round-trip helper: validate canonical-JSON text as a v1 IR.
    let validateCanonicalJson (json: string) : Result<Ir, string> =
        match DynamicValue.fromCanonicalJson json with
        | Ok dv -> validate dv
        | Error e -> Error(sprintf "not canonical JSON: %A" e)

    // ── the two known generators expressed UNDER v1 (the frozen golden rows) ─────────

    /// SplitMix64 finaliser under v1 — width 64 made explicit (legacy file omitted it),
    /// the redundant stored `zetaId` dropped (it equals `idOf "rng.splitmix64" 1`).
    let splitmix64: Ir =
        { Generator = "rng.splitmix64"
          Version = 1
          Width = 64
          Ops =
            [ Mul -7046029254386353131L // 0x9E3779B97F4A7C15
              XorShr 30L
              Mul -4658895280553007687L // 0xBF58476D1CE4E5B9
              XorShr 27L
              Mul -7723592293110705685L // 0x94D049BB133111EB
              XorShr 31L ] }

    /// MurmurHash3 fmix32 finaliser under v1 — width 32 (already present in the legacy file).
    let fmix32: Ir =
        { Generator = "hash.fmix32"
          Version = 1
          Width = 32
          Ops =
            [ XorShr 16L
              Mul 2246822507L // 0x85ebca6b
              XorShr 13L
              Mul 3266489909L // 0xc2b2ae35
              XorShr 16L ] }

    /// All known v1 IRs (the rows the frozen golden file pins).
    let known: Ir list = [ splitmix64; fmix32 ]

    // ── projection BACK to the legacy `*.ir.json` shape (single source of truth) ─────
    //
    // The committed legacy files predate v1 and have two pre-existing, INCONSISTENT
    // shapes (see the module header): `splitmix64.ir.json` stores a `zetaId` and omits
    // `width`; `fmix32.ir.json` carries `width` and omits `zetaId`; neither carries the
    // `schema` tag. Those bytes are load-bearing byte-locks (the TS harness folds them
    // and `GeneratorIrRegistry.Tests` pin the relation row against them), so they must
    // not change. Instead, this projection makes the v1 `Ir` the SINGLE SOURCE OF TRUTH:
    // it DERIVES the exact committed legacy bytes from the frozen v1 value, and a
    // byte-lock test (`ZetaIrV1.Tests`) asserts the derivation equals the committed file
    // character-for-character. The legacy file thus becomes a generated artifact, not a
    // hand-maintained parallel.
    //
    // Crucially the legacy `splitmix64` `zetaId` is NOT carried as v1 data — it is
    // re-derived here via `zetaId ir` (== `idOf generator version`), demonstrating it
    // was always a pure function of identity, never independent data. The legacy field
    // ORDER is reproduced exactly: splitmix64 = generator,version,zetaId,ops;
    // fmix32 = generator,version,width,ops.

    /// The legacy field layout a given generator's committed `*.ir.json` uses. The two
    /// shipped files differ by construction; v1 unifies the *source*, this records how
    /// each one *serialised* before the freeze.
    type private LegacyShape =
        /// generator, version, zetaId (derived), ops  — e.g. splitmix64 (no width)
        | ZetaIdNoWidth
        /// generator, version, width, ops             — e.g. fmix32 (no zetaId)
        | WidthNoZetaId

    /// How each known generator serialised under the legacy (pre-v1) shape.
    let private legacyShapeOf (generator: string) : LegacyShape option =
        match generator with
        | "rng.splitmix64" -> Some ZetaIdNoWidth
        | "hash.fmix32" -> Some WidthNoZetaId
        | _ -> None

    /// The legacy-shaped `DynamicValue` for a v1 IR, in that generator's committed field
    /// order. Returns `None` for a generator with no legacy file.
    let private toLegacyDynamicValue (ir: Ir) : DynamicValue option =
        legacyShapeOf ir.Generator
        |> Option.map (fun shape ->
            let opsDv = DynamicValue.Array(ir.Ops |> List.map opToDv)
            match shape with
            | ZetaIdNoWidth ->
                DynamicValue.Object
                    [ ("generator", DynamicValue.String ir.Generator)
                      ("version", DynamicValue.Int(int64 ir.Version))
                      // re-DERIVED, not stored: equals `idOf generator version`.
                      ("zetaId", DynamicValue.String(zetaId ir))
                      ("ops", opsDv) ]
            | WidthNoZetaId ->
                DynamicValue.Object
                    [ ("generator", DynamicValue.String ir.Generator)
                      ("version", DynamicValue.Int(int64 ir.Version))
                      ("width", DynamicValue.Int(int64 ir.Width))
                      ("ops", opsDv) ])

    /// The exact committed legacy `*.ir.json` bytes for a v1 IR, derived from the frozen
    /// v1 value via the REAL canonical-JSON machinery. `None` if the generator has no
    /// legacy file. The `ZetaIrV1.Tests` byte-lock proves this equals the committed file.
    let toLegacyIrJson (ir: Ir) : Result<string, EncodeError> option =
        toLegacyDynamicValue ir |> Option.map DynamicValue.toCanonicalJson
