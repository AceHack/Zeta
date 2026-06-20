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
    /// rotate-left-by-constant op node — NEW in the v2 grammar (xoshiro256ss needs it).
    let private rotl (r: int64) =
        DynamicValue.Object [ ("op", DynamicValue.String "rotl"); ("r", DynamicValue.Int r) ]
    /// xor-in several self-rotations op node — NEW in the v3 grammar (nasam needs it):
    /// `x ^= rotl(x,r_1) ^ rotl(x,r_2) ^ ...` reusing the CURRENT word in parallel.
    let private xrotxor (rs: int64 list) =
        DynamicValue.Object
            [ ("op", DynamicValue.String "xrotxor")
              ("rs", DynamicValue.Array(rs |> List.map DynamicValue.Int)) ]
    /// xor-in several self-shifts op node — NEW in the v3 grammar (nasam needs it):
    /// `x ^= (x>>s_1) ^ (x>>s_2) ^ ...`. The one-term form is exactly v1/v2's `xorshr s`.
    let private xshrxor (ss: int64 list) =
        DynamicValue.Object
            [ ("op", DynamicValue.String "xshrxor")
              ("ss", DynamicValue.Array(ss |> List.map DynamicValue.Int)) ]

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

    /// MurmurHash3 fmix64 finaliser IR (width 64) — the THIRD generator, proving the
    /// `mul`/`xorshr` IR vocabulary generalises to a SECOND member of the hash family
    /// at the u64 width (splitmix64's width, fmix32's family). Austin Appleby's
    /// public-domain smhasher finalizer:
    ///   k ^= k>>33; k *= 0xff51afd7ed558ccd; k ^= k>>33; k *= 0xc4ceb9fe1a85ec53; k ^= k>>33
    /// The u64 multipliers are stored as their signed-int64 bit-pattern (multiply is
    /// mod 2^64, so the reinterpretation is bit-exact), exactly as splitmix64's are.
    /// Mirrors `tests/cross-verification/fmix64/_gen/fmix64.ir.json` (fmix32-shaped:
    /// `generator, version, width, ops`, no stored `zetaId`).
    let fmix64Ir : DynamicValue =
        DynamicValue.Object
            [ ("generator", DynamicValue.String "hash.fmix64")
              ("version", DynamicValue.Int 1L)
              ("width", DynamicValue.Int 64L)
              ("ops",
               DynamicValue.Array
                   [ xorshr 33L
                     mul -49064778989728563L // 0xff51afd7ed558ccd
                     xorshr 33L
                     mul -4265267296055464877L // 0xc4ceb9fe1a85ec53
                     xorshr 33L ]) ]

    /// xoshiro256** OUTPUT SCRAMBLER IR (width 64) — the FOURTH generator, and the first
    /// to require an op (`rotl`) OUTSIDE the v1 `mul`/`xorshr` grammar. Per the v1
    /// evolution contract this is a breaking grammar change, so the row carries the
    /// bumped `zeta-ir-v2` schema tag (it is a v2 artifact, NOT a pre-v1 grandfathered
    /// file). Blackman & Vigna's public-domain reference
    /// (https://prng.di.unimi.it/xoshiro256starstar.c): `result = rotl(x * 5, 7) * 9`.
    /// Mirrors `tests/cross-verification/xoshiro256ss/_gen/xoshiro256ss.ir.json`.
    let xoshiro256ssIr : DynamicValue =
        DynamicValue.Object
            [ ("schema", DynamicValue.String "zeta-ir-v2")
              ("generator", DynamicValue.String "rng.xoshiro256ss")
              ("version", DynamicValue.Int 1L)
              ("width", DynamicValue.Int 64L)
              ("ops",
               DynamicValue.Array
                   [ mul 5L
                     rotl 7L
                     mul 9L ]) ]

    /// The known generator-IR rows. Each `Ok` because the IRs above are canonical.
    /// Note `hash.fmix32`/`hash.fmix64`/`rng.xoshiro256ss` are NOT yet in
    /// `GeneratorRegistry.known`; their ZetaId is still the deterministic `idOf`
    /// content-address (the id is a pure function of name@version, registered-or-not —
    /// that is the homoiconic point).
    /// nasam MIXER IR (width 64) — the FIFTH generator, and the first to require ops
    /// (`xrotxor`/`xshrxor`) OUTSIDE the v2 `mul`/`xorshr`/`rotl` grammar. A v2 `rotl`
    /// REPLACES the word with its rotation; nasam XORs several rotations/shifts of the
    /// CURRENT word back IN (parallel reuse), which no sequential mul/xorshr/rotl chain
    /// expresses. Per the evolution contract this is a SECOND breaking grammar change, so
    /// the row carries the twice-bumped `zeta-ir-v3` schema tag. Pelle Evensen's
    /// public-domain reference
    /// (mostlymangling.blogspot.com/2020/01/nasam-not-another-strange-acronym-mixer.html),
    /// with M1 = 0x9E6C63D0676A9A99, M2 = 0x9E6D62D06F6A9A9B:
    ///   x ^= ror(x,25)^ror(x,47); x*=M1; x ^= x>>23^x>>51; x*=M2; x ^= x>>23^x>>51
    /// (ror 25/47 == rotl 39/17 at width 64). Mirrors
    /// `tests/cross-verification/nasam/_gen/nasam.ir.json`.
    let nasamIr : DynamicValue =
        DynamicValue.Object
            [ ("schema", DynamicValue.String "zeta-ir-v3")
              ("generator", DynamicValue.String "hash.nasam")
              ("version", DynamicValue.Int 1L)
              ("width", DynamicValue.Int 64L)
              ("ops",
               DynamicValue.Array
                   [ xrotxor [ 39L; 17L ]
                     mul -7031135171492799847L // 0x9E6C63D0676A9A99
                     xshrxor [ 23L; 51L ]
                     mul -7030854795893499237L // 0x9E6D62D06F6A9A9B
                     xshrxor [ 23L; 51L ] ]) ]

    let known: IrRow list =
        [ row "rng.splitmix64" 1 splitmix64Ir
          row "hash.fmix32" 1 fmix32Ir
          row "hash.fmix64" 1 fmix64Ir
          row "rng.xoshiro256ss" 1 xoshiro256ssIr
          row "hash.nasam" 1 nasamIr ]
        |> List.choose (function
            | Ok r -> Some r
            | Error _ -> None)

    /// The full known relation (all known IR rows, weight +1).
    let relation: ZSet<IrRow> = relationOf known

    // ── the relation as the RUNNING INTEGRAL of a delta stream ─────────────────────
    //
    // Everything above treats the relation as a constant value (full fold) or a static
    // sum of deltas. The final rung is to let the deltas ARRIVE OVER TIME on a running
    // DBSP circuit: feed each +1 (register) / -1 (retract) Z-set delta into a
    // `ZSetInput`, `IntegrateZSet` it, and step the circuit. The integrator's output is
    // the materialised relation AS OF the deltas seen so far. This is DBSP's `∫`
    // (integration) operator — the same one the rest of the engine runs — specialised
    // to the generator-IR relation.
    //
    // SOUNDNESS this exercises (pinned in `GeneratorIrRegistry.Tests`):
    //   * circuit-output AFTER all register deltas == `relationOf known` (the running
    //     integral converges to the full relation — DBSP incrementalisation soundness).
    //   * a retract (-1) delta arriving later REMOVES the row from the live output
    //     (`register r` then `retract r` => the row is gone), which is rollback observed
    //     on a running stream, not just in the static `add r (neg r) = Zero` algebra.
    //   * order independence: the integral is a sum in the abelian group, so any
    //     interleaving of the same multiset of deltas yields the same materialised
    //     relation.
    module Stream =

        open System.Threading.Tasks

        /// Run a sequence of Z-set deltas (each a `register`/`retract` result, or any
        /// `ZSet<IrRow>` delta) through a real DBSP circuit and return the materialised
        /// relation after all deltas have been stepped. One `Step` per delta, so the
        /// caller can also observe intermediate states via `stepwise` below.
        let integrateDeltas (deltas: ZSet<IrRow> seq) : Task<ZSet<IrRow>> =
            task {
                let c = Circuit.create ()
                let input = c.ZSetInput<IrRow>()
                let materialised = c.IntegrateZSet input.Stream
                let out = c.Output materialised
                for d in deltas do
                    input.Send d
                    do! c.StepAsync()
                return out.Current
            }

        /// Run the deltas through a circuit and return the materialised relation after
        /// EACH delta (the running integral's trajectory). Useful for asserting that a
        /// retract removes a row mid-stream, not only at the end.
        let stepwise (deltas: ZSet<IrRow> seq) : Task<ZSet<IrRow> list> =
            task {
                let c = Circuit.create ()
                let input = c.ZSetInput<IrRow>()
                let materialised = c.IntegrateZSet input.Stream
                let out = c.Output materialised
                let acc = ResizeArray<ZSet<IrRow>>()
                for d in deltas do
                    input.Send d
                    do! c.StepAsync()
                    acc.Add out.Current
                return List.ofSeq acc
            }

        /// Convenience: stream the +1 register delta for each row, returning the
        /// materialised relation. `integrateRegisters known` must equal `relationOf known`.
        let integrateRegisters (rows: IrRow seq) : Task<ZSet<IrRow>> =
            rows |> Seq.map register |> integrateDeltas

    // ── the relation under a LIVE, EXTERNAL delta feed (zero-downtime evolution) ────
    //
    // `Stream` above drains a finite, pre-baked `seq` of deltas through a circuit that
    // is built and torn down in one call. The honest claim the project cares about —
    // "zero-downtime schema evolution over a live feed" — needs more: a circuit that is
    // built ONCE and kept RUNNING while deltas ARRIVE FROM OUTSIDE over time, with the
    // materialised relation observable BETWEEN arrivals.
    //
    // `ChannelZSetInput` (Handles.fs) is exactly that external boundary: a bounded
    // `System.Threading.Channels` channel — SingleReader (the circuit), multi-writer
    // (external producers), FullMode=Wait (real backpressure: a full channel AWAITS,
    // never drops). The producer holds only the input handle and calls `SendAsync`; it
    // has NO reference to the step loop. This is a genuine producer/consumer split, not
    // a list dressed up as a stream.
    //
    // WHAT THIS ADDS over `Stream` (pinned in `GeneratorIrRegistry.Tests`):
    //   * the relation observed AFTER k externally-sent deltas equals `relationOf` over
    //     just those k rows admitted SO FAR — correctness holds at every observation
    //     point on a still-running circuit, not only at end-of-stream.
    //   * SCHEMA EVOLUTION: while the circuit runs, a `retract(v1) + register(v2)` pair
    //     arriving from outside swaps a generator's IR row with NO dropped or duplicated
    //     rows — the old IR is gone, the new IR is live, in one observation step.
    //   * the generator's content-addressed ZetaId is STABLE across the swap when the
    //     version is unchanged, and CHANGES (new id) when the version bumps — the
    //     homoiconic "version bump = new fact" rule survives a live feed.
    //
    // TIER: PROVEN that a long-lived circuit fed by an EXTERNAL channel preserves the
    // integral semantics and the delta algebra at every observation point, including a
    // live IR-shape swap. STILL ASPIRATIONAL (not claimed here): that this constitutes
    // production-grade zero-downtime evolution (durability, multi-node consensus, replay
    // after crash) — those are separate obligations on top of this in-process proof.
    module LiveStream =

        open System.Threading.Tasks

        /// A long-lived, externally-fed generator-IR circuit. Created ONCE; kept running.
        /// The `Input` is an external boundary (bounded channel); `feed`/`feedAndObserve`
        /// push deltas from outside and step the circuit so the integral advances.
        type Session =
            internal
                { Circuit: Circuit
                  Input: ChannelZSetInputHandle<IrRow>
                  Out: OutputHandle<ZSet<IrRow>> }

            /// The materialised relation AS OF the deltas admitted and stepped so far.
            member this.Relation : ZSet<IrRow> = this.Out.Current

            /// Resolve a live IR row by content-addressed ZetaId on the current relation.
            member this.ByZetaId(zetaId: string) : IrRow option = byZetaId zetaId this.Relation

        /// Open a long-lived session: build the circuit ONCE, wire the external channel
        /// input through the `IntegrateZSet` (`∫`) operator to an output. `capacity`
        /// bounds the in-flight delta backlog (backpressure when full).
        let openSession (capacity: int) : Session =
            let c = Circuit.create ()
            let input = c.ChannelZSetInput<IrRow>(capacity)
            let materialised = c.IntegrateZSet input.Stream
            let out = c.Output materialised
            { Circuit = c; Input = input; Out = out }

        /// Push ONE delta from the external producer and step the circuit once, so the
        /// running integral reflects exactly the deltas admitted up to and including this
        /// one. Returns when the step has completed (the delta is now visible in
        /// `session.Relation`). Send is awaited first so a full channel applies real
        /// backpressure rather than dropping.
        let feed (session: Session) (delta: ZSet<IrRow>) : Task =
            task {
                do! session.Input.SendAsync(delta).AsTask()
                do! session.Circuit.StepAsync()
            }

        /// Feed one delta, step, and return the materialised relation observed at that
        /// point — the running integral's value AS OF this arrival.
        let feedAndObserve (session: Session) (delta: ZSet<IrRow>) : Task<ZSet<IrRow>> =
            task {
                do! feed session delta
                return session.Relation
            }

        /// Live, zero-downtime swap of a generator's IR while the circuit keeps running:
        /// retract the old row and register the new one as a single observation step.
        /// After this, `oldRow` is absent and `newRow` is live, with no other rows
        /// touched. Modelled as one combined delta so the swap is atomic at the
        /// observation boundary (no transient state where both — or neither — are live).
        let evolve (session: Session) (oldRow: IrRow) (newRow: IrRow) : Task<ZSet<IrRow>> =
            let swap = ZSet.add (retract oldRow) (register newRow)
            feedAndObserve session swap
