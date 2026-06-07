namespace Zeta.Core

open System
open System.Collections.Generic


/// Conflict-free Replicated Data Types (CRDTs) layered on top of
/// Z-sets. DBSP Z-sets with integer weights are already a
/// **signed-multiset join-semilattice** — commutative, associative,
/// with an identity. We expose the three Riak CRDT classics plus LWW
/// so users get eventual-consistency primitives that compose with the
/// rest of the DBSP algebra.
///
/// ## Why this isn't just another CRDT library
///
/// Every CRDT op here is a **linear Z-set operation** — it commutes
/// with `D` (differentiate) and `I` (integrate) for free. So:
///   - A G-counter incremental over a stream's delta is just the
///     counter applied to `D(stream)`; the integrated counter equals
///     `I` applied to the counter-of-delta.
///   - Merging two replicas = adding their Z-sets (if using
///     positive-only PN-counter halves) or adding with sign
///     cancellation for full Z-set counters.
///   - OR-Set dedup = distinct over (element × unique-tag).
///
/// References:
///   - Almeida, Shoker, Baquero. "Delta State Replicated Data Types".
///     arXiv:1603.01529 (2018).
///   - Shapiro et al. "A comprehensive study of CRDTs". INRIA 2011.
///   - Baquero et al. "Approaches to CRDTs". ACM Comp. Surv. 2024.


/// **G-Counter (grow-only)**: one counter per replica, merged via
/// elementwise max. A Z-set keyed by `replicaId` with nonneg weights
/// represents it exactly.
[<NoComparison; NoEquality>]
type GCounter = { Counts: ZSet<string> }
with
    static member Empty : GCounter = { Counts = ZSet<string>.Empty }

    /// Increment this replica's counter by `delta` (must be positive).
    member this.Increment(replicaId: string, delta: int64) : GCounter =
        if delta < 0L then invalidArg (nameof delta) "G-counter increments must be non-negative"
        let diff = ZSet.ofSeq [ replicaId, delta ]
        { Counts = ZSet.add this.Counts diff }

    /// Total value across all replicas.
    member this.Value : int64 =
        let mutable total = 0L
        let span = this.Counts.AsSpan()
        for i in 0 .. span.Length - 1 do total <- Checked.(+) total span.[i].Weight
        total

    /// Merge two counters — elementwise max per replica.
    static member Merge (a: GCounter) (b: GCounter) : GCounter =
        let aSpan = a.Counts.AsSpan()
        let bSpan = b.Counts.AsSpan()
        let merged = Dictionary<string, int64>()
        for i in 0 .. aSpan.Length - 1 do merged.[aSpan.[i].Key] <- aSpan.[i].Weight
        for i in 0 .. bSpan.Length - 1 do
            let mutable cur = 0L
            if merged.TryGetValue(bSpan.[i].Key, &cur) then
                if bSpan.[i].Weight > cur then merged.[bSpan.[i].Key] <- bSpan.[i].Weight
            else merged.[bSpan.[i].Key] <- bSpan.[i].Weight
        let pairs = merged |> Seq.map (fun kv -> kv.Key, kv.Value)
        { Counts = ZSet.ofSeq pairs }


/// **PN-Counter**: two G-counters — positive increments in `p`,
/// negative in `n`. Value = `p.Value - n.Value`. Merges elementwise.
[<NoComparison; NoEquality>]
type PNCounter = { P: GCounter; N: GCounter }
with
    static member Empty : PNCounter = { P = GCounter.Empty; N = GCounter.Empty }

    member this.Increment(replicaId: string, delta: int64) : PNCounter =
        // -delta on Int64.MinValue overflows back to Int64.MinValue (Lior audit 2026-06-06) — reject it.
        if delta = System.Int64.MinValue then invalidArg (nameof delta) "Int64.MinValue not representable (negation overflows)"
        if delta >= 0L then { this with P = this.P.Increment(replicaId, delta) }
        else { this with N = this.N.Increment(replicaId, -delta) }

    member this.Value : int64 = Checked.(-) this.P.Value this.N.Value

    static member Merge (a: PNCounter) (b: PNCounter) : PNCounter =
        { P = GCounter.Merge a.P b.P ; N = GCounter.Merge a.N b.N }


/// **OR-Set (observed-remove)**: element tagged with unique insertion
/// id. Add places `(elem, tag)`; remove retracts only the tags the
/// local replica saw. Merge is set-union on `(elem, tag)`. An element
/// is *observed* iff at least one `(elem, tag)` survives.
[<NoComparison; NoEquality>]
type OrSet<'T when 'T : comparison> = { Entries: ZSet<'T * Guid> }
with
    static member Empty : OrSet<'T> = { Entries = ZSet<'T * Guid>.Empty }

    member this.Add(elem: 'T) : OrSet<'T> =
        let tag = Guid.NewGuid()
        { Entries = ZSet.add this.Entries (ZSet.ofSeq [ (elem, tag), 1L ]) }

    /// Remove: retract every `(elem, tag)` the local replica currently
    /// observes for `elem`. Merges with concurrent adds are preserved.
    member this.Remove(elem: 'T) : OrSet<'T> =
        let tagsFor =
            this.Entries.AsSpan().ToArray()
            |> Array.filter (fun e -> fst e.Key = elem)
            |> Array.map (fun e -> e.Key, -e.Weight)
        { Entries = ZSet.add this.Entries (ZSet.ofSeq tagsFor) }

    /// Current element set (distinct).
    member this.Value : seq<'T> =
        this.Entries.AsSpan().ToArray()
        |> Array.filter (fun e -> e.Weight > 0L)
        |> Array.map (fun e -> fst e.Key)
        |> Array.distinct
        |> Seq.ofArray

    static member Merge (a: OrSet<'T>) (b: OrSet<'T>) : OrSet<'T> =
        { Entries = ZSet.add a.Entries b.Entries }


/// **LWW-Register (last-writer-wins)**: each write carries a
/// monotonic timestamp. Merge picks the write with the larger
/// timestamp; ties broken by replica-id (lexicographic) for
/// determinism.
[<NoComparison; NoEquality>]
type LwwRegister<'T> =
    { Value: 'T ; Timestamp: int64 ; Replica: string }
with
    static member Create (value, timestamp, replica) : LwwRegister<'T> =
        { Value = value ; Timestamp = timestamp ; Replica = replica }

    static member Merge (a: LwwRegister<'T>) (b: LwwRegister<'T>) : LwwRegister<'T> =
        if a.Timestamp > b.Timestamp then a
        elif a.Timestamp < b.Timestamp then b
        elif String.Compare(a.Replica, b.Replica, StringComparison.Ordinal) >= 0 then a
        else b

/// **LWW-Map** — a last-writer-wins keyed map: each key independently holds an `LwwRegister`, merged
/// per-key via `LwwRegister.Merge`. Inherits commutative + associative + idempotent merge ⇒ a CRDT (the
/// common local-first keyed-document structure). Keys use F# structural comparison — **ordinal for `string`
/// (B-0969-clean)**. Composes `LwwRegister` (no duplicate merge logic). Removal is LWW too: `Remove` writes
/// a tombstone register; readers skip tombstoned keys. (081KTH4Q782 — local-first CRDTs on the substrate.)
[<NoComparison; NoEquality>]
type LwwMap<'K, 'V when 'K: comparison> =
    { Entries: Map<'K, LwwRegister<'V option>> }

    static member Empty: LwwMap<'K, 'V> = { Entries = Map.empty }

    /// Set `key` to `value` at `(timestamp, replica)` — LWW-merged against any existing register for the key.
    member this.Set(key: 'K, value: 'V, timestamp: int64, replica: string) : LwwMap<'K, 'V> =
        let reg = LwwRegister<'V option>.Create(Some value, timestamp, replica)
        let merged =
            match Map.tryFind key this.Entries with
            | Some existing -> LwwRegister.Merge existing reg
            | None -> reg
        { Entries = Map.add key merged this.Entries }

    /// Remove `key` at `(timestamp, replica)` — a LWW tombstone (a later set wins, a later remove wins).
    member this.Remove(key: 'K, timestamp: int64, replica: string) : LwwMap<'K, 'V> =
        let reg = LwwRegister<'V option>.Create(None, timestamp, replica)
        let merged =
            match Map.tryFind key this.Entries with
            | Some existing -> LwwRegister.Merge existing reg
            | None -> reg
        { Entries = Map.add key merged this.Entries }

    /// The live value at `key` (None if absent or tombstoned).
    member this.TryGet(key: 'K) : 'V option =
        Map.tryFind key this.Entries |> Option.bind (fun r -> r.Value)

    /// Merge two LWW-Maps: union of keys, per-key `LwwRegister.Merge`. Commutative, associative, idempotent.
    static member Merge (a: LwwMap<'K, 'V>) (b: LwwMap<'K, 'V>) : LwwMap<'K, 'V> =
        let mutable acc = a.Entries
        for kv in b.Entries do
            let merged =
                match Map.tryFind kv.Key acc with
                | Some existing -> LwwRegister.Merge existing kv.Value
                | None -> kv.Value
            acc <- Map.add kv.Key merged acc
        { Entries = acc }
