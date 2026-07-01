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
    let empty<'K, 'W when 'K : comparison> : ZSetW<'K, 'W> = ZSetW<'K, 'W>.Empty

    let count (z: ZSetW<'K, 'W>) = z.Count
    let isEmpty (z: ZSetW<'K, 'W>) = z.IsEmpty

    /// Singleton entry; if `weight` equals `ring.Zero` returns empty.
    let singleton (ring: ISemiring<'W>) (key: 'K) (weight: 'W) : ZSetW<'K, 'W> =
        if EqualityComparer<'W>.Default.Equals(weight, ring.Zero) then
            ZSetW<'K, 'W>.Empty
        else
            ZSetW(ImmutableArray.Create(ZEntryW(key, weight)))

    /// Build from an arbitrary sequence; duplicate keys are combined
    /// via `ring.Add`; entries equal to `ring.Zero` are dropped.
    let ofSeq (ring: ISemiring<'W>) (xs: seq<'K * 'W>) : ZSetW<'K, 'W> =
        let agg = SortedDictionary<'K, 'W>()
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

    /// Lookup weight at key; returns `ring.Zero` when key absent.
    let lookup (ring: ISemiring<'W>) (key: 'K) (z: ZSetW<'K, 'W>) : 'W =
        let span = z.AsSpan()
        if span.IsEmpty then ring.Zero
        else
            let cmp = Comparer<'K>.Default
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
    let sum (ring: ISemiring<'W>) (a: ZSetW<'K, 'W>) (b: ZSetW<'K, 'W>) : ZSetW<'K, 'W> =
        let aSpan = a.AsSpan()
        let bSpan = b.AsSpan()
        if aSpan.IsEmpty then b
        elif bSpan.IsEmpty then a
        else
            let zero = ring.Zero
            let eq = EqualityComparer<'W>.Default
            let cmp = Comparer<'K>.Default
            // Upper bound on output length is |a| + |b|; zero entries dropped
            // shrinks it. Use a builder sized to the upper bound; trim via
            // ToImmutable rather than MoveToImmutable since the final count
            // may be strictly less than the allocated capacity.
            let builder = ImmutableArray.CreateBuilder<ZEntryW<'K, 'W>>(aSpan.Length + bSpan.Length)
            let mutable i = 0
            let mutable j = 0
            while i < aSpan.Length && j < bSpan.Length do
                let kA = aSpan.[i].Key
                let kB = bSpan.[j].Key
                let c = cmp.Compare(kA, kB)
                if c < 0 then
                    builder.Add(aSpan.[i])
                    i <- i + 1
                elif c > 0 then
                    builder.Add(bSpan.[j])
                    j <- j + 1
                else
                    let combined = ring.Add(aSpan.[i].Weight, bSpan.[j].Weight)
                    if not (eq.Equals(combined, zero)) then
                        builder.Add(ZEntryW(kA, combined))
                    i <- i + 1
                    j <- j + 1
            while i < aSpan.Length do
                builder.Add(aSpan.[i])
                i <- i + 1
            while j < bSpan.Length do
                builder.Add(bSpan.[j])
                j <- j + 1
            ZSetW(builder.ToImmutable())

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
    let difference (ring: ISemiring<'W>) (a: ZSetW<'K, 'W>) (b: ZSetW<'K, 'W>) : ZSetW<'K, 'W> =
        sum ring a (negate ring b)

    /// Scale every weight by `scalar` via `ring.Mul`.
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
    let toZSetIntegerRing (a: ZSetW<'K, int64>) : ZSet<'K> =
        let span = a.AsSpan()
        let builder = ImmutableArray.CreateBuilder<ZEntry<'K>>(span.Length)
        for i in 0 .. span.Length - 1 do
            builder.Add(ZEntry(span.[i].Key, span.[i].Weight))
        ZSet(builder.MoveToImmutable())

    /// Bridge: lift the existing ZSet<'K> to ZSetW<'K, int64>.
    let ofZSetIntegerRing (a: ZSet<'K>) : ZSetW<'K, int64> =
        let span = a.AsSpan()
        let builder = ImmutableArray.CreateBuilder<ZEntryW<'K, int64>>(span.Length)
        for i in 0 .. span.Length - 1 do
            builder.Add(ZEntryW(span.[i].Key, span.[i].Weight))
        ZSetW(builder.MoveToImmutable())
