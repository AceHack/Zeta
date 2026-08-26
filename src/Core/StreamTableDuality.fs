namespace Zeta.Core

// ═══════════════════════════════════════════════════════════════════════
//  The stream/table duality, stated ONCE — and the measured reason the
//  two implementations of it in this repo are NOT the same operation.
//
//  STATUS: **unmetered** (`.claude/rules/toy-is-free-metered-must-be-earned.md`).
//  The interface is shape, not measurement. Its two declared properties
//  are CLAIMS, and `StreamTableDuality.Tests.fs` measures each one against
//  each instance's actual behaviour — a declaration that disagrees with
//  its instance fails the build. That is what keeps them from becoming
//  decoration.
//
//  ── The finding ─────────────────────────────────────────────────────
//
//  Two things in this repo implement "a table is the fold of a stream; a
//  stream is the changelog of a table", and neither knew about the other:
//
//    A. `Circuit.IntegrateZSet` / `Circuit.DifferentiateZSet`
//       (`Primitive.fs`) — DBSP's `I` and `D`. Both `IsLinear`, mutually
//       inverse, used in production in `GeneratorIrRegistry.fs` and
//       `Incremental.fs`.
//    B. `TableStream` (`TableStream.fs`) — `toTable` / `toStream` over
//       `Delta list` and `Map<string, DynamicValue>`, the CLI's `stream`
//       and `table` noun-classes.
//
//  The tempting move is to merge them. **That would be wrong.** They
//  differ in two independent ways, and a merged abstraction would have to
//  quietly pick one answer for each:
//
//  1. **The combiner.** `ZSet.add` is an ABELIAN GROUP operation:
//     commutative, associative, with inverses, and NOT idempotent
//     (`a + a = 2a`). `TableStream`'s is a LAST-WRITER-WINS map fold:
//     idempotent per delta (`Upsert` twice = once), and **not
//     commutative** — `[Upsert("k",1); Retract "k"]` folds to the empty
//     table, and the same two deltas reordered fold to `{k → 1}`.
//
//     This is the deep difference and it is operationally load-bearing.
//     An order-independent fold may be used as a SHARED conclusion across
//     nodes that received deltas in different orders; an order-dependent
//     one may not. See
//     `.claude/rules/local-time-never-enters-the-shared-fold.md` — receive
//     order is local, and a fold that reads it has leaked local order into
//     a shared result.
//
//  2. **What "table" means.** `TableStream`'s table is a single collapsed
//     SNAPSHOT. DBSP's `I` produces the whole sequence of running
//     integrals, one per tick, which is exactly why `D` can invert it —
//     `D` recovers each delta by subtracting the previous integral. There
//     is no `TableStream` analogue of that form: a snapshot has no
//     previous value to subtract.
//
//  ── So: a shared BASE INTERFACE at the level where both exist ───────
//
//  The interface below is stated at the SNAPSHOT level, because that is
//  the framing in which both instances exist, and it carries the one law
//  both satisfy: `ToTable (ToStream t) = t`. The property they disagree
//  about (`FoldIsCommutative`) is a declared, measured flag.
//
//  Read the flags honestly, including the unflattering one:
//
//  ┌──────────────────────────┬───────────────────┬──────────────────────┐
//  │                          │ A. Z-set snapshot │ B. `TableStream`     │
//  ├──────────────────────────┼───────────────────┼──────────────────────┤
//  │ `ToTable (ToStream t)=t` │ **yes** (the law) │ **yes** (the law)    │
//  │ `FoldIsCommutative`      │ **yes**           │ **no**               │
//  │ `TableDeterminesStream`  │ no                │ no                   │
//  └──────────────────────────┴───────────────────┴──────────────────────┘
//
//  `TableDeterminesStream` is `false` for BOTH at this level, and saying
//  so is the point: a snapshot cannot recover the history that produced
//  it, Z-set or otherwise. The Z-set pair regains invertibility ONLY in
//  its running-integral form (`ZSetStreamTable.integrate` /
//  `.differentiate` below), which is tested separately and has no
//  `TableStream` counterpart. Declaring the flag `true` on the strength
//  of `D∘I=id` would have been the vacuity class — a property borrowed
//  from a different framing than the one the interface states.
//
//  ── Anchors (Beacon) ────────────────────────────────────────────────
//  • Budiu, McSherry, Ryzhyk, Tannen, "DBSP: Automatic Incremental View
//    Maintenance for Rich Query Languages" (VLDB 2023) — `I` and `D` as
//    mutually inverse linear stream operators.
//  • Kreps, "The Log: What every software engineer should know about
//    real-time data's unifying abstraction" (2013), and Kafka Streams'
//    KStream/KTable — the log↔table duality in its LWW form, instance B.
//  • Shapiro, Preguiça, Baquero, Zawirski, "Conflict-free Replicated Data
//    Types" (SSS 2011) — LWW-Register is what instance B's combiner is
//    SHAPED like. It is explicitly **not** a CRDT here: `TableStream`
//    carries no timestamp or tiebreak, so its fold is order-dependent
//    rather than commutative. Named to prevent exactly that misreading.
//  • Codd, "A Relational Model of Data for Large Shared Data Banks"
//    (CACM 1970) — the relation a table denotes.
// ═══════════════════════════════════════════════════════════════════════

/// The one law that two independently-written stream/table pairs in this
/// repo actually share: **`ToTable (ToStream t) = t`** — materializing the
/// changelog of a table returns that table.
///
/// The properties they do NOT share are declared members below, each
/// measured against real behaviour in `StreamTableDuality.Tests.fs`.
/// EXPERIMENTAL.
type IStreamTableDuality<'Stream, 'Table> =

    /// A short, stable name — test output names which duality broke.
    abstract member DualityName: string

    /// Fold a changelog into the state it denotes.
    abstract member ToTable: 'Stream -> 'Table

    /// Emit a changelog that reconstructs the state.
    abstract member ToStream: 'Table -> 'Stream

    /// **`ToTable (permute s) = ToTable s` for every permutation — on
    /// inputs where the fold is TOTAL.**
    ///
    /// `true` for an abelian-group combiner (Z-set `+`). `false` for a
    /// last-writer-wins map fold. This is the flag that decides whether
    /// the fold may serve as a shared conclusion across nodes whose
    /// receive orders differ.
    ///
    /// The totality qualifier is not a hedge, it is a real boundary:
    /// `ZSet.sum` consolidates with `Checked.(+)`, so a delta sequence
    /// whose PARTIAL sums overflow `int64` can raise in one order and not
    /// another even though the mathematical total is order-independent.
    /// `true` therefore means "commutative wherever it returns", never
    /// "commutative including its exceptions". `ColumnZSet.weightedCount`
    /// (PR #15260) is the worked precedent for why that distinction is
    /// worth stating: a partition-dependent overflow is a DST replay
    /// violation, and the honest fix there was to make the contract exact
    /// rather than to document the wobble.
    abstract member FoldIsCommutative: bool

    /// **`ToStream (ToTable s) = s` — the other round trip.**
    ///
    /// `false` for every snapshot-valued table, which is both instances
    /// here: collapsing a history and then re-emitting it cannot recover
    /// the deltas. Kept on the interface, and kept honest, because an
    /// implementation whose table retains the history could legitimately
    /// answer `true` — and a test will hold it to that.
    abstract member TableDeterminesStream: bool


/// Instance **A**: the Z-set stream/table duality.
///
/// `Circuit.IntegrateZSet` / `Circuit.DifferentiateZSet` are these same
/// operators wired into a scheduled circuit. This module is the pure
/// function they compute, extracted so the duality can be stated and
/// tested without building a circuit: the definitions use `ZSet.add` /
/// `ZSet.sub` as the group operations and `ZSet<'K>.Empty` as the initial
/// accumulator — the exact values `IntegrateOp` / `DifferentiateOp` are
/// constructed with in `Primitive.fs`.
/// EXPERIMENTAL.
[<RequireQualifiedAccess>]
[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module ZSetStreamTable =

    /// `I` in its **running-integral** form: one partial sum per delta.
    /// This is the shape `Circuit.IntegrateZSet` emits tick by tick, and
    /// the shape that makes the pair invertible.
    let integrate (deltas: ZSet<'K> list) : ZSet<'K> list =
        deltas |> List.scan ZSet.add ZSet<'K>.Empty |> List.tail

    /// `D` — the delta sequence whose running integrals are `integrals`.
    /// `differentiate (integrate s) = s` and `integrate (differentiate t)
    /// = t`: mutually inverse, which is DBSP's central identity and the
    /// property `TableStream` has no analogue of.
    let differentiate (integrals: ZSet<'K> list) : ZSet<'K> list =
        (ZSet<'K>.Empty, integrals)
        ||> List.mapFold (fun prev cur -> ZSet.sub cur prev, cur)
        |> fst

    /// The SNAPSHOT-level table: the total, i.e. the last running
    /// integral. Permutation-invariant because `ZSet.add` is abelian.
    let toTable (deltas: ZSet<'K> list) : ZSet<'K> = ZSet.sum deltas

    /// The changelog of a snapshot: one delta carrying the whole state.
    let toStream (table: ZSet<'K>) : ZSet<'K> list = [ table ]

    /// The shared-interface instance, at the snapshot level where
    /// `TableStream` also lives.
    let duality<'K when 'K : comparison> : IStreamTableDuality<ZSet<'K> list, ZSet<'K>> =
        { new IStreamTableDuality<ZSet<'K> list, ZSet<'K>> with
            member _.DualityName = "zset-snapshot"
            member _.ToTable s = toTable s
            member _.ToStream t = toStream t
            // `ZSet.add` is abelian.
            member _.FoldIsCommutative = true
            // A total forgets the summands. See the header table.
            member _.TableDeterminesStream = false }
