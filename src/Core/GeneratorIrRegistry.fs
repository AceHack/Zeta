namespace Zeta.Core

/// GeneratorIrRegistry — the generator's IR carried as a LIVE TUPLE on a DBSP Z-set
/// relation, completing the codegen-forward trajectory.
///
/// BACKGROUND (the trajectory this closes)
/// ----------------------------------------
/// The cross-verification harness (`tests/cross-verification/_harness/nway-diff.ts`)
/// shifted from "do the hand-ports agree?" to "does the generated code match the
/// byte-lock?": splitmix64 and fmix32 each have a TS oracle that is EMITTED FROM an
/// IR row (an ordered list of total u-word ops) decoded through the real
/// `DynamicValue` canonical-JSON machinery and folded. Until now that IR lived ONLY
/// as a checked-in document (`*.ir.json`) — disconnected from the registry.
///
/// `GeneratorRegistry` is, per Aaron's reframe, "NOT a sibling mechanism — it is ONE
/// schema-registry-over-DBSP relation": a registry entry (name@version ->
/// content-addressed ZetaId) is a ROW in a Z-set; registering or superseding a
/// generator is a Z-set DELTA; rollback is Z-set RETRACTION. `GeneratorRegistry.Entry`
/// today carries only `{ Name; Version; ZetaId }` — identity but no PAYLOAD.
///
/// THIS MODULE adds the payload rung: the generator's IR (the canonical-JSON
/// `DynamicValue` the oracle folds) becomes the row's payload on a real
/// `ZSet<IrRow>`. So:
///   * REGISTER a generator IR  = add a +1 singleton delta to the relation.
///   * SUPERSEDE / ROLL BACK    = RETRACT the row: `add r (neg r) = Zero` — the
///     abelian-group law a Bag cannot satisfy (`ZSet.fs`), and exactly why the
///     Z-set, not the Bag, is the DBSP substrate for undo.
///   * full == incremental      = building the relation from the full row list
///     EQUALS folding the per-row deltas with `+` (`relation = incremental`). This
///     is DBSP's incrementalization soundness specialised to a constant stream.
///
/// The committed `*.ir.json` documents are now a MATERIALISED VIEW of these rows:
/// `irCanonicalJson row` reproduces the file byte-for-byte (asserted in the F# tests
/// and, cross-language, by the existing `DynamicValue.Canonical.Tests` byte-locks).
/// The TS oracles still read the file (they run under bun, no .NET), but the file is
/// now a projection of the relation row, not an independent artifact.
///
/// Tier: PROVEN that the IR is a row on a real Z-set relation, that register/retract
/// obey the group law, that full == incremental, that the row's ZetaId is the REAL
/// content-address (`GeneratorRegistry.idOf`), and that the row payload reproduces
/// the committed canonical-JSON byte-for-byte. The "live STREAM" (deltas arriving
/// over time on a running DBSP circuit, zero-downtime schema evolution of the IR
/// shape) reuses the same `+`/`neg` rungs; what is exercised here is the constant
/// relation + its delta algebra, which is the group-theoretic core of that claim.
[<RequireQualifiedAccess>]
module GeneratorIrRegistry =

    /// A row on the generator-IR relation: the generator's stable identity plus its
    /// IR as a canonical-JSON `DynamicValue` string (the exact bytes the oracle
    /// folds). `ZetaId` is the REAL content-address from `GeneratorRegistry.idOf`, so
    /// the row's identity is DERIVED from name@version, never minted-and-forgotten.
    /// Comparison is structural over all fields so the `ZSet<IrRow>` key is the whole
    /// row (a change to the IR is a DIFFERENT row — a new fact — not a silent mutate).
    type IrRow =
        { Name: string
          Version: int
          ZetaId: string
          IrCanonicalJson: string }

    /// Build a row from a generator name@version and its IR `DynamicValue`. The IR is
    /// serialised through the REAL `DynamicValue.toCanonicalJson`, so the row carries
    /// exactly the bytes the cross-language byte-lock pins. Fails (Error) if the IR is
    /// not canonical-encodable — an IR that cannot be a row is rejected as data.
    let row (name: string) (version: int) (ir: DynamicValue) : Result<IrRow, EncodeError> =
        match DynamicValue.toCanonicalJson ir with
        | Ok cj ->
            Ok
                { Name = name
                  Version = version
                  ZetaId = GeneratorRegistry.idOf name version
                  IrCanonicalJson = cj }
        | Error e -> Error e

    /// Decode a row's IR payload back to a `DynamicValue` (the inverse of `row`'s
    /// encode leg). This is what a generator/oracle calls to obtain the IR FROM the
    /// relation row rather than from a free-floating file.
    let decodeIr (r: IrRow) : Result<DynamicValue, DecodeError> =
        DynamicValue.fromCanonicalJson r.IrCanonicalJson

    // ── the relation as a Z-set, and its delta algebra ─────────────────────────────

    /// REGISTER one IR row: the +1 singleton delta. Adding it to a relation is the
    /// Z-set DELTA that registration IS.
    let register (r: IrRow) : ZSet<IrRow> = ZSet.singleton r 1L

    /// RETRACT one IR row: the -1 delta (supersession / rollback). `relation + retract r`
    /// removes `r` exactly; `register r + retract r = Zero` (the group inverse).
    let retract (r: IrRow) : ZSet<IrRow> = ZSet.neg (register r)

    /// Build the relation from a full set of rows (the "from-scratch" / full-recompute
    /// side of full == incremental).
    let relationOf (rows: IrRow seq) : ZSet<IrRow> = rows |> Seq.map (fun r -> r, 1L) |> ZSet.ofSeq

    /// Build the relation INCREMENTALLY by folding each row's +1 delta with `+` (the
    /// incremental side). `incremental rows = relationOf rows` is the soundness law.
    let incremental (rows: IrRow seq) : ZSet<IrRow> =
        rows |> Seq.fold (fun acc r -> ZSet.add acc (register r)) ZSet.empty

    /// Look a row up on the relation by its content-addressed ZetaId (id -> IR row).
    /// Returns the row only if it is LIVE (net weight > 0): a retracted row is absent,
    /// so rollback is observed through the same query, no separate tombstone.
    let byZetaId (zetaId: string) (relation: ZSet<IrRow>) : IrRow option =
        relation
        |> Seq.tryPick (fun e -> if e.Key.ZetaId = zetaId && ZSet.lookup e.Key relation > 0L then Some e.Key else None)

    // ── the known generator IRs (the rows the committed *.ir.json files project) ────

    /// SplitMix64 finaliser IR (width 64). u64 multipliers are stored as their
    /// signed-int64 bit-pattern — multiply is mod 2^64, so the reinterpretation is
    /// bit-exact when the interpreter reads it back as u64. Mirrors
    /// `tests/cross-verification/splitmix64/_gen/splitmix64.ir.json`.
    let private mul (k: int64) = DynamicValue.Object [ ("op", DynamicValue.String "mul"); ("k", DynamicValue.Int k) ]
    let private xorshr (s: int64) =
        DynamicValue.Object [ ("op", DynamicValue.String "xorshr"); ("s", DynamicValue.Int s) ]

    /// NOTE on shape: the committed splitmix64 file carries an explicit `zetaId` field
    /// and NO `width` (u64 implied); the fmix32 file carries `width` and no `zetaId`.
    /// That difference is pre-existing across the two PRs that introduced them; the
    /// relation row mirrors each committed file EXACTLY (the materialised-view relation
    /// is faithful to the artifact as-is, not a re-normalisation of it).
    let splitmix64Ir : DynamicValue =
        DynamicValue.Object
            [ ("generator", DynamicValue.String "rng.splitmix64")
              ("version", DynamicValue.Int 1L)
              ("zetaId", DynamicValue.String (GeneratorRegistry.idOf "rng.splitmix64" 1))
              ("ops",
               DynamicValue.Array
                   [ mul -7046029254386353131L // 0x9E3779B97F4A7C15
                     xorshr 30L
                     mul -4658895280553007687L // 0xBF58476D1CE4E5B9
                     xorshr 27L
                     mul -7723592293110705685L // 0x94D049BB133111EB
                     xorshr 31L ]) ]

    /// MurmurHash3 fmix32 finaliser IR (width 32). u32 multipliers are < 2^31, so they
    /// fit `DynamicValue.Int` (int64) directly with no reinterpretation. Mirrors
    /// `tests/cross-verification/fmix32/_gen/fmix32.ir.json`.
    let fmix32Ir : DynamicValue =
        DynamicValue.Object
            [ ("generator", DynamicValue.String "hash.fmix32")
              ("version", DynamicValue.Int 1L)
              ("width", DynamicValue.Int 32L)
              ("ops",
               DynamicValue.Array
                   [ xorshr 16L
                     mul 2246822507L // 0x85ebca6b
                     xorshr 13L
                     mul 3266489909L // 0xc2b2ae35
                     xorshr 16L ]) ]

    /// The known generator-IR rows. Each `Ok` because the IRs above are canonical.
    /// Note `hash.fmix32` is NOT yet in `GeneratorRegistry.known`; its ZetaId is still
    /// the deterministic `idOf` content-address (the id is a pure function of
    /// name@version, registered-or-not — that is the homoiconic point).
    let known: IrRow list =
        [ row "rng.splitmix64" 1 splitmix64Ir
          row "hash.fmix32" 1 fmix32Ir ]
        |> List.choose (function
            | Ok r -> Some r
            | Error _ -> None)

    /// The full known relation (all known IR rows, weight +1).
    let relation: ZSet<IrRow> = relationOf known
