namespace Zeta.Core

open System
open System.Collections
open System.Collections.Generic
open System.Collections.Immutable
open System.Runtime.CompilerServices

// ═══════════════════════════════════════════════════════════════════
//  ZSetW<'K, 'W>  —  polymorphic Z-set over a weight semiring 'W
// ═══════════════════════════════════════════════════════════════════
//
//  Wires the existing ISemiring<'W> interface (Semiring.fs) through a
//  Z-set substrate, delivering the polymorphism the integer-fixed
//  ZSet<'K> can't express today. Operates as a PARALLEL substrate next
//  to ZSet<'K> — no caller of ZSet<'K> breaks.
//
//  The existing ZSet<'K> stays the int64-specialised hot-path (single
//  virtual call overhead matters at scale + per-tick); ZSetW<'K, 'W>
//  is the polymorphic surface for:
//    • TropicalSemiring (min, +)  → incremental shortest-paths / Viterbi
//    • IntervalRing [lo, hi]     → bounded-uncertainty propagation
//    • Probability / Gaussian / provenance / fuzzy-set / etc. rings
//      that future research lanes mint via ISemiring<'W>
//
//  Migration path (future B-NNNN): `type ZSet<'K> = ZSetW<'K, int64>`
//  once the ZSet hot-path is reframed as a special case of ZSetW. That
//  reframe is intentionally out of scope here — this slice ships the
//  polymorphism plumbing; the unification is downstream work.
//
//  Substrate-honest framing for the F# anchor:
//    dotnet build IS the sanity check — the polymorphism either
//    type-checks across IntegerRing / IntervalRing / TropicalSemiring
//    instances, or it doesn't. Tests verify the algebraic axioms
//    (associativity, commutativity, distributivity, retraction) flow
//    correctly through ZSetW for each ring.

/// An entry in a polymorphic Z-set. Mirrors `ZEntry<'K>` but with the
/// weight typed as `'W` rather than the int64-fixed `Weight`.
[<Struct; IsReadOnly; NoComparison>]
type ZEntryW<'K, 'W> =
    val Key: 'K
    val Weight: 'W
    new(key: 'K, weight: 'W) = { Key = key; Weight = weight }

/// Stateless entry-shape provider wiring `ZEntryW<'K,'W>` into the shared
/// `MergeKernel` (081KWFXTHJY step 3) — the polymorphic twin of `ZEntryOps`.
[<Struct>]
type internal ZEntryWOps<'K, 'W> =
    interface IZEntryOps<'K, 'W, ZEntryW<'K, 'W>> with
        member _.Key e = e.Key
        member _.Weight e = e.Weight
        member _.Make(k, w) = ZEntryW(k, w)


/// Polymorphic Z-set `Z[K, W]` — finitely-supported map `K -> W` where
/// `W` forms a ring (and zero-weighted entries are dropped). Stored as
/// an immutable ascending-sorted run of `(key, weight)` pairs, same
/// shape as `ZSet<'K>` — a future migration can unify them.
///
/// Operations live in the `ZSetW` module and take an `ISemiring<'W>`
/// as a runtime argument. The common case is to pass the ring's
/// `Instance` singleton.
///
/// **Important — same ZSetW value across different rings is unsafe**:
/// the on-disk representation of a `ZSetW<'K, 'W>` depends on the ring
/// used to construct it. `ring.Add` decides what consolidates;
/// `ring.Zero` decides what gets dropped. Re-interpreting a `ZSetW`
/// constructed with one ring under a different ring with different
/// `Zero` / `Add` semantics can silently produce wrong answers (entries
/// that should be dropped under the second ring are still present;
/// duplicate keys that the first ring already collapsed via `Add` are
/// gone). Always use the same ring for all operations on a given value;
/// to move data between rings, project explicitly (e.g., reconstruct
/// via `ofSeq` under the target ring).
///
/// **Collation (DB model — 081KT07NV0008QG0R001YDB73K):** every ordering
/// site in this module (`ofSeq` sort, `lookup` binary search, the `sum`
/// merges) resolves through `KeyComparerCache` = `Collation.forKey` =
/// the shipped **`binary`** default (codepoint / UTF-8 byte order; SQL
/// `_BIN2` / Postgres `C` shaped) — the DB "server default" level. Fast
/// (no linguistic pass) and byte-locked across oracles. Never the
/// culture-sensitive `Comparer<string>.Default`; linguistic collations
/// (`ordinal-ci`, `invariant`, …) are opt-in `Collation.catalog` entries
/// selected at the edge, never the silent default. Like the ring above,
/// the collation is part of a value's identity: all ops on one value
/// must use one collation, and today this module is uniformly `binary`.
[<Struct; IsReadOnly; CustomEquality; NoComparison>]
type ZSetW<'K, 'W when 'K : comparison> =
    val internal entries: ImmutableArray<ZEntryW<'K, 'W>>

    /// Construct from an already-sorted-by-key, nonzero-weighted run.
    /// Use `ZSetW.ofSeq` for arbitrary input.
    new(entries: ImmutableArray<ZEntryW<'K, 'W>>) = { entries = entries }

    static member Empty : ZSetW<'K, 'W> = ZSetW(ImmutableArray<ZEntryW<'K, 'W>>.Empty)

    member this.Count =
        if this.entries.IsDefault then 0 else this.entries.Length

    member this.IsEmpty = this.entries.IsDefaultOrEmpty

    member this.AsSpan() : ReadOnlySpan<ZEntryW<'K, 'W>> =
        if this.entries.IsDefault then ReadOnlySpan.Empty
        else this.entries.AsSpan()

    member this.GetEnumerator() =
        (if this.entries.IsDefault then ImmutableArray<ZEntryW<'K, 'W>>.Empty else this.entries).GetEnumerator()

    interface IEnumerable<ZEntryW<'K, 'W>> with
        member this.GetEnumerator() : IEnumerator<ZEntryW<'K, 'W>> =
            let a = if this.entries.IsDefault then ImmutableArray<ZEntryW<'K, 'W>>.Empty else this.entries
            (a :> IEnumerable<_>).GetEnumerator()

    interface IEnumerable with
        member this.GetEnumerator() : IEnumerator =
            let a = if this.entries.IsDefault then ImmutableArray<ZEntryW<'K, 'W>>.Empty else this.entries
            (a :> IEnumerable).GetEnumerator()

    interface IEquatable<ZSetW<'K, 'W>> with
        member this.Equals(that: ZSetW<'K, 'W>) =
            let a = this.AsSpan()
            let b = that.AsSpan()
            if a.Length <> b.Length then false
            else
                let keyEq = EqualityComparer<'K>.Default
                let weightEq = EqualityComparer<'W>.Default
                let mutable i = 0
                let mutable eq = true
                while eq && i < a.Length do
                    if not (weightEq.Equals(a.[i].Weight, b.[i].Weight))
                       || not (keyEq.Equals(a.[i].Key, b.[i].Key)) then
                        eq <- false
                    i <- i + 1
                eq

    override this.Equals(other: obj) =
        match other with
        | :? ZSetW<'K, 'W> as that -> (this :> IEquatable<ZSetW<'K, 'W>>).Equals(that)
        | _ -> false

    override this.GetHashCode() =
        let mutable h = HashCode()
        let span = this.AsSpan()
        for i in 0 .. span.Length - 1 do
            h.Add span.[i].Key
            h.Add span.[i].Weight
        h.ToHashCode()

    override this.ToString() =
        if this.IsEmpty then "{}" else
        let sb = System.Text.StringBuilder("{")
        let span = this.AsSpan()
        for i in 0 .. span.Length - 1 do
            if i > 0 then sb.Append("; ") |> ignore
            sb.AppendFormat("{0}→{1}", span.[i].Key, span.[i].Weight) |> ignore
        sb.Append('}').ToString()


[<RequireQualifiedAccess>]
[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module ZSetW =

    /// Empty Z-set over weight semiring 'W.
    [<CompiledName "Empty">]
    let empty<'K, 'W when 'K : comparison> : ZSetW<'K, 'W> = ZSetW<'K, 'W>.Empty

    [<CompiledName "Count">]
    let count (z: ZSetW<'K, 'W>) = z.Count
    [<CompiledName "IsEmpty">]
    let isEmpty (z: ZSetW<'K, 'W>) = z.IsEmpty

    /// Singleton entry; if `weight` equals `ring.Zero` returns empty.
    [<CompiledName "Singleton">]
    let singleton (ring: ISemiring<'W>) (key: 'K) (weight: 'W) : ZSetW<'K, 'W> =
        if EqualityComparer<'W>.Default.Equals(weight, ring.Zero) then
            ZSetW<'K, 'W>.Empty
        else
            ZSetW(ImmutableArray.Create(ZEntryW(key, weight)))

    /// Build from an arbitrary sequence; duplicate keys are combined
    /// via `ring.Add`; entries equal to `ring.Zero` are dropped.
    [<CompiledName "OfSeq">]
    let ofSeq (ring: ISemiring<'W>) (xs: seq<'K * 'W>) : ZSetW<'K, 'W> =
        let agg = SortedDictionary<'K, 'W>(KeyComparerCache<'K>.Instance)
        for (k, w) in xs do
            match agg.TryGetValue(k) with
            | true, existing -> agg.[k] <- ring.Add(existing, w)
            | false, _ -> agg.[k] <- w
        let zero = ring.Zero
        let eq = EqualityComparer<'W>.Default
        let builder = ImmutableArray.CreateBuilder<ZEntryW<'K, 'W>>()
        for kv in agg do
            if not (eq.Equals(kv.Value, zero)) then
                builder.Add(ZEntryW(kv.Key, kv.Value))
        ZSetW(builder.ToImmutable())

    /// C#-friendly `ofSeq` over ValueTuples (Iris event-storm F2, 2026-07-02):
    /// `ZSetWModule.OfValuePairs(ring, new[] { ("x", 2L), ("y", 1L) })` — no
    /// `System.Tuple.Create` ceremony. Same semantics as `ofSeq`.
    [<CompiledName "OfValuePairs">]
    let ofValuePairs (ring: ISemiring<'W>) (pairs: seq<struct ('K * 'W)>) : ZSetW<'K, 'W> =
        ofSeq ring (pairs |> Seq.map (fun struct (k, w) -> k, w))

    /// Lookup weight at key; returns `ring.Zero` when key absent.
    [<CompiledName "Lookup">]
    let lookup (ring: ISemiring<'W>) (key: 'K) (z: ZSetW<'K, 'W>) : 'W =
        let span = z.AsSpan()
        if span.IsEmpty then ring.Zero
        else
            let cmp = KeyComparerCache<'K>.Instance
            let mutable lo = 0
            let mutable hi = span.Length - 1
            let mutable result = ring.Zero
            let mutable found = false
            while not found && lo <= hi do
                let mid = lo + ((hi - lo) >>> 1)
                let c = cmp.Compare(span.[mid].Key, key)
                if c = 0 then result <- span.[mid].Weight; found <- true
                elif c < 0 then lo <- mid + 1
                else hi <- mid - 1
            result

    /// Z-set sum: `(a + b)(k) = a(k) `ring.Add` b(k)`. Output is
    /// sorted by key with zero entries dropped.
    ///
    /// Both inputs are already sorted by key (ZSetW invariant), so this
    /// is a linear two-pointer merge — O(|a| + |b|) — not the
    /// O(n log n) a `SortedDictionary` rebuild would cost.
    [<CompiledName "Sum">]
    let sum (ring: ISemiring<'W>) (a: ZSetW<'K, 'W>) (b: ZSetW<'K, 'W>) : ZSetW<'K, 'W> =
        if a.IsEmpty then b
        elif b.IsEmpty then a
        else
            // The boxed ring rides into the shared kernel via the struct
            // `BoxedRing` adapter — same virtual-call cost this path always
            // had, but ONE merge implementation instead of a hand copy.
            let merged =
                MergeKernel.sum (ZEntryWOps<'K, 'W>()) (BoxedRing<'W>(ring)) (a.AsSpan()) (b.AsSpan())
            if merged.IsEmpty then ZSetW<'K, 'W>.Empty else ZSetW(merged)

    /// Negate every weight via `ring.Negate` — additive inverse. The
    /// ring axiom `negate a `Add` a = zero` is required for retraction.
    ///
    /// **Requires a full ring**: this calls `ring.Negate` on every entry's
    /// weight. Semirings WITHOUT additive inverse (e.g., `TropicalSemiring`,
    /// whose `Negate` raises `InvalidOperationException` per its docstring)
    /// cannot satisfy this and the exception propagates verbatim. Callers
    /// that work over non-ring semirings must avoid `negate`/`difference`
    /// and use ring-specific equivalents (for tropical: there is no
    /// retraction — "minimum so far" is monotone-decreasing only).
    [<CompiledName "Negate">]
    let negate (ring: ISemiring<'W>) (a: ZSetW<'K, 'W>) : ZSetW<'K, 'W> =
        let span = a.AsSpan()
        let builder = ImmutableArray.CreateBuilder<ZEntryW<'K, 'W>>(span.Length)
        for i in 0 .. span.Length - 1 do
            builder.Add(ZEntryW(span.[i].Key, ring.Negate(span.[i].Weight)))
        ZSetW(builder.MoveToImmutable())

    /// Difference: `a - b = a `sum` (negate b)`.
    ///
    /// Same ring-requires-additive-inverse caveat as `negate` — semirings
    /// without `Negate` (e.g., `TropicalSemiring`) will surface
    /// `InvalidOperationException` from the underlying `ring.Negate` call.
    [<CompiledName "Difference">]
    let difference (ring: ISemiring<'W>) (a: ZSetW<'K, 'W>) (b: ZSetW<'K, 'W>) : ZSetW<'K, 'W> =
        sum ring a (negate ring b)

    /// Scale every weight by `scalar` via `ring.Mul`.
    [<CompiledName "Scale">]
    let scale (ring: ISemiring<'W>) (scalar: 'W) (a: ZSetW<'K, 'W>) : ZSetW<'K, 'W> =
        if EqualityComparer<'W>.Default.Equals(scalar, ring.Zero) then
            ZSetW<'K, 'W>.Empty
        else
            let span = a.AsSpan()
            let builder = ImmutableArray.CreateBuilder<ZEntryW<'K, 'W>>(span.Length)
            for i in 0 .. span.Length - 1 do
                let w = ring.Mul(scalar, span.[i].Weight)
                if not (EqualityComparer<'W>.Default.Equals(w, ring.Zero)) then
                    builder.Add(ZEntryW(span.[i].Key, w))
            ZSetW(builder.ToImmutable())

    /// Bridge: project a ZSetW<'K, int64> to the existing ZSet<'K>.
    /// Lets callers move polymorphic results into the int64 hot path
    /// where the rest of the substrate currently lives.
    [<CompiledName "ToZSetIntegerRing">]
    let toZSetIntegerRing (a: ZSetW<'K, int64>) : ZSet<'K> =
        let span = a.AsSpan()
        let builder = ImmutableArray.CreateBuilder<ZEntry<'K>>(span.Length)
        for i in 0 .. span.Length - 1 do
            builder.Add(ZEntry(span.[i].Key, span.[i].Weight))
        ZSet(builder.MoveToImmutable())

    /// Bridge: lift the existing ZSet<'K> to ZSetW<'K, int64>.
    [<CompiledName "OfZSetIntegerRing">]
    let ofZSetIntegerRing (a: ZSet<'K>) : ZSetW<'K, int64> =
        let span = a.AsSpan()
        let builder = ImmutableArray.CreateBuilder<ZEntryW<'K, int64>>(span.Length)
        for i in 0 .. span.Length - 1 do
            builder.Add(ZEntryW(span.[i].Key, span.[i].Weight))
        ZSetW(builder.MoveToImmutable())

    // ═══════════════════════════════════════════════════════════════
    //  Zero-overhead hot path (081KWFXTHJY step 2b) — `*By` variants.
    //
    //  The ring is passed BY VALUE as a struct generic `'R`. These
    //  functions are NOT F# `inline` (the shared kernel they call is the
    //  internal-inline piece; a public inline here would collide with the
    //  internal `KeyComparerCache` — FS1113). They don't need to be: the
    //  CLR emits a specialised body per value-type `'R` instantiation, so
    //  the interface calls `ring.Add/Mul/Negate` devirtualise + inline to
    //  bare primitives — no vtable dispatch, unlike the instance-passing
    //  ops above (boxed `ISemiring<'W>`, one virtual call per weight op).
    //  Same results as the instance ops (proven in ZSetW.Tests); the win
    //  is dispatch cost, certified by ZSetWBench (the step-3 gate, PASSED
    //  — Naledi sign-off-with-notes 2026-07-01).
    //
    //  NOTE: callers must instantiate `'R` at a known struct type; a
    //  boxed `ISemiring<'W>` value cannot flow here (use the
    //  instance-passing ops for the dynamic-ring cold path).
    // ═══════════════════════════════════════════════════════════════

    /// Zero-overhead singleton (struct ring by value).
    [<CompiledName "SingletonBy">]
    let singletonBy (ring: 'R when 'R : struct and 'R :> ISemiring<'W>)
                           (key: 'K) (weight: 'W) : ZSetW<'K, 'W> =
        if EqualityComparer<'W>.Default.Equals(weight, ring.Zero) then
            ZSetW<'K, 'W>.Empty
        else
            ZSetW(ImmutableArray.Create(ZEntryW(key, weight)))

    /// Zero-overhead build-from-sequence (struct ring by value).
    [<CompiledName "OfSeqBy">]
    let ofSeqBy (ring: 'R when 'R : struct and 'R :> ISemiring<'W>)
                       (xs: seq<'K * 'W>) : ZSetW<'K, 'W> =
        let agg = SortedDictionary<'K, 'W>(KeyComparerCache<'K>.Instance)
        for (k, w) in xs do
            match agg.TryGetValue(k) with
            | true, existing -> agg.[k] <- ring.Add(existing, w)
            | false, _ -> agg.[k] <- w
        let zero = ring.Zero
        let eq = EqualityComparer<'W>.Default
        let builder = ImmutableArray.CreateBuilder<ZEntryW<'K, 'W>>()
        for kv in agg do
            if not (eq.Equals(kv.Value, zero)) then
                builder.Add(ZEntryW(kv.Key, kv.Value))
        ZSetW(builder.ToImmutable())

    /// Zero-overhead Z-set sum — the DBSP incremental-merge hot op.
    ///
    /// Step-3 perf parity with `ZSet.(+)`: same `ArrayPool` workspace
    /// (`Pool.Rent` → fill → `Pool.FreezeSlice` = one heap alloc, the output) and
    /// the same cached `KeyComparerCache` (vs the earlier builder + `Comparer.Default`,
    /// which cost a second allocation and an uncached comparer). Combined with the
    /// devirtualised struct-ring `Add`, this is the int64 path meant to MATCH the
    /// specialised `ZSet.add` — verified by `ZSetWBench`.
    [<CompiledName "SumBy">]
    let sumBy (ring: 'R when 'R : struct and 'R :> ISemiring<'W>)
                     (a: ZSetW<'K, 'W>) (b: ZSetW<'K, 'W>) : ZSetW<'K, 'W> =
        if a.IsEmpty then b
        elif b.IsEmpty then a
        else
            // Same shared kernel as `ZSet.(+)` — the struct ring monomorphises
            // straight through it (this delegation is what the ZSetWBench
            // parity table certified).
            let merged =
                MergeKernel.sum (ZEntryWOps<'K, 'W>()) ring (a.AsSpan()) (b.AsSpan())
            if merged.IsEmpty then ZSetW<'K, 'W>.Empty else ZSetW(merged)

    /// Zero-overhead negate (struct ring by value; requires a full ring).
    [<CompiledName "NegateBy">]
    let negateBy (ring: 'R when 'R : struct and 'R :> ISemiring<'W>)
                        (a: ZSetW<'K, 'W>) : ZSetW<'K, 'W> =
        let span = a.AsSpan()
        let builder = ImmutableArray.CreateBuilder<ZEntryW<'K, 'W>>(span.Length)
        for i in 0 .. span.Length - 1 do
            builder.Add(ZEntryW(span.[i].Key, ring.Negate(span.[i].Weight)))
        ZSetW(if span.Length = 0 then ImmutableArray.Empty else builder.MoveToImmutable())

    /// Zero-overhead difference `a - b` (struct ring by value).
    [<CompiledName "DifferenceBy">]
    let differenceBy (ring: 'R when 'R : struct and 'R :> ISemiring<'W>)
                            (a: ZSetW<'K, 'W>) (b: ZSetW<'K, 'W>) : ZSetW<'K, 'W> =
        sumBy ring a (negateBy ring b)

    /// Zero-overhead scale (struct ring by value).
    [<CompiledName "ScaleBy">]
    let scaleBy (ring: 'R when 'R : struct and 'R :> ISemiring<'W>)
                       (scalar: 'W) (a: ZSetW<'K, 'W>) : ZSetW<'K, 'W> =
        if EqualityComparer<'W>.Default.Equals(scalar, ring.Zero) then
            ZSetW<'K, 'W>.Empty
        else
            let span = a.AsSpan()
            let builder = ImmutableArray.CreateBuilder<ZEntryW<'K, 'W>>(span.Length)
            for i in 0 .. span.Length - 1 do
                let w = ring.Mul(scalar, span.[i].Weight)
                if not (EqualityComparer<'W>.Default.Equals(w, ring.Zero)) then
                    builder.Add(ZEntryW(span.[i].Key, w))
            ZSetW(builder.ToImmutable())
