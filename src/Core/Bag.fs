namespace Zeta.Core

open System
open System.Collections.Generic
open System.Collections.Immutable
open System.Runtime.CompilerServices

/// One bag entry: a key `Key` with a strictly-positive multiplicity
/// `Count` (>= 1L in a canonical bag). Mirrors the TS twin's `{ e, n }`
/// (`src/Core.TypeScript/bag/`) and the Rust twin's `BagEntry { e, n: i64 }`
/// (`src/Core.Rust.Algebra/src/bag.rs`); `Count` is `int64` to match the Rust
/// `i64` oracle and keep the cross-language golden vector exact.
[<Struct; IsReadOnly>]
type BagEntry<'T when 'T : comparison> =
    { Key : 'T
      Count : int64 }

/// A Bag (multiset) `Bag[T]` — the MIDDLE rung of the Zeta algebra ladder
/// (**G-Set → Bag → Z-set**) made first-class instead of implicit.
///
/// A Bag is the `ZSet` (`ZSet.fs`) **restricted to non-negative multiplicity**:
/// every key carries a count `>= 1` (absent key ⇒ multiplicity 0) and the only
/// combiner is `union` = per-key **sum**. The precise contrast with the G-Set
/// (`GSet.fs`), whose `union` is set-union and therefore idempotent: a Bag's
/// `union` is a commutative **monoid** — commutative, associative, with the
/// empty bag as identity — but it is **NOT** a semilattice, because `union a a`
/// DOUBLES every count. That non-idempotence is exactly what makes the Bag the
/// counting structure (DORA / metrics / the LGTM "M") and the step toward the
/// Z-set's signed ℤ weights + retraction. Per the database-design ADR
/// (2026-05-31): Bag = ℕ / sum.
///
/// Represented as an immutable **ascending-key-sorted** run, every `Count >= 1`,
/// no key appearing twice — the canonical form that makes `Equals` total, makes
/// `ToArray` deterministic, and makes the cross-language `golden-vectors.json`
/// byte-stable (the TS/Rust twins produce the identical sorted entry array).
/// `'T : comparison` gives the key order; this impl uses F# structural `compare`
/// — which for `string` is **ordinal** (`String.CompareOrdinal`), matching the
/// TS `<` and byte-ordered Rust `Ord` twins and the invariant-culture default,
/// in deliberate contrast to the G-Set's `Comparer<'T>.Default` (culture-
/// sensitive for strings — the 081KT07NV0008QG0R001YDB73K gap, which this rung avoids from the start).
[<Struct; IsReadOnly; CustomEquality; NoComparison>]
type Bag<'T when 'T : comparison> =
    val internal items : ImmutableArray<BagEntry<'T>>

    /// Construct from an already sorted-ascending, count-positive,
    /// key-unique run. Callers own the invariant; use `Bag.ofEntries` for
    /// arbitrary input.
    new(items: ImmutableArray<BagEntry<'T>>) = { items = items }

    static member Empty : Bag<'T> = Bag(ImmutableArray<BagEntry<'T>>.Empty)

    /// The additive-monoid identity (generic-math `Zero`) — an alias for `Empty`,
    /// recognized by F# SRTP / `LanguagePrimitives.GenericZero` + generic numeric code.
    /// Bag is an additive, **commutative** monoid (identity + associative per-key-sum
    /// `union`, **no inverse**, and — unlike G-Set — **NOT idempotent**: `a + a` doubles
    /// every count), so it surfaces `Zero` + `(+)` only — never `INumber` (no negation /
    /// order / multiplication). The Z-set completes this monoid into an abelian group
    /// (signed ℤ weights, where retraction is the inverse). `(+)` IS `union`.
    static member Zero : Bag<'T> = Bag<'T>.Empty

    /// The additive operator (generic-math `(+)`): the per-key SUM of two sorted bags,
    /// kept sorted + count-positive (overflow-checked via `Checked.(+)`). The canonical
    /// home of the merge; `Bag.union` delegates here.
    static member (+) (a: Bag<'T>, b: Bag<'T>) : Bag<'T> =
        let xa = if a.items.IsDefault then ImmutableArray<BagEntry<'T>>.Empty else a.items
        let xb = if b.items.IsDefault then ImmutableArray<BagEntry<'T>>.Empty else b.items
        if xa.IsEmpty then Bag<'T>(xb)
        elif xb.IsEmpty then Bag<'T>(xa)
        else
            let out = ImmutableArray.CreateBuilder<BagEntry<'T>>(xa.Length + xb.Length)
            let mutable i = 0
            let mutable j = 0
            while i < xa.Length && j < xb.Length do
                let c = KeyComparerCache<'T>.Instance.Compare(xa.[i].Key, xb.[j].Key)
                if c < 0 then
                    out.Add(xa.[i]); i <- i + 1
                elif c > 0 then
                    out.Add(xb.[j]); j <- j + 1
                else
                    out.Add({ Key = xa.[i].Key; Count = Checked.(+) xa.[i].Count xb.[j].Count })
                    i <- i + 1
                    j <- j + 1
            while i < xa.Length do
                out.Add(xa.[i]); i <- i + 1
            while j < xb.Length do
                out.Add(xb.[j]); j <- j + 1
            Bag<'T>(out.ToImmutable())

    /// The number of DISTINCT keys (the support size).
    member this.Count =
        if this.items.IsDefault then 0 else this.items.Length

    member this.IsEmpty = this.items.IsDefaultOrEmpty

    /// The multiplicity of `x` (0L if absent). Binary search on the sorted
    /// keys. O(log n), zero-alloc.
    member this.Multiplicity(x: 'T) : int64 =
        if this.items.IsDefaultOrEmpty then
            0L
        else
            let mutable lo = 0
            let mutable hi = this.items.Length - 1
            let mutable result = 0L
            let mutable found = false
            while lo <= hi && not found do
                let mid = lo + (hi - lo) / 2
                let c = KeyComparerCache<'T>.Instance.Compare(this.items.[mid].Key, x)
                if c = 0 then
                    result <- this.items.[mid].Count
                    found <- true
                elif c < 0 then lo <- mid + 1
                else hi <- mid - 1
            result

    /// Membership: whether `x` has a positive multiplicity.
    member this.Contains(x: 'T) : bool = this.Multiplicity(x) > 0L

    /// The entries in canonical (ascending-key) order.
    member this.ToArray() : BagEntry<'T>[] =
        if this.items.IsDefaultOrEmpty then
            Array.empty
        else
            let arr = Array.zeroCreate this.items.Length
            this.items.CopyTo(arr)
            arr

    override this.Equals(o: obj) : bool =
        match o with
        | :? Bag<'T> as other -> (this :> IEquatable<Bag<'T>>).Equals(other)
        | _ -> false

    override this.GetHashCode() : int =
        // The run is canonical-sorted, so a positional combine over the
        // canonical (key, count) order is stable + total.
        let mutable h = 17
        if not this.items.IsDefaultOrEmpty then
            for i in 0 .. this.items.Length - 1 do
                h <- (h * 31) + EqualityComparer<'T>.Default.GetHashCode(this.items.[i].Key)
                h <- (h * 31) + this.items.[i].Count.GetHashCode()
        h

    interface IEquatable<Bag<'T>> with
        member this.Equals(other: Bag<'T>) : bool =
            let a = this.items
            let b = other.items
            let an = if a.IsDefault then 0 else a.Length
            let bn = if b.IsDefault then 0 else b.Length
            if an <> bn then
                false
            else
                let mutable i = 0
                let mutable eq = true
                while i < an && eq do
                    if KeyComparerCache<'T>.Instance.Compare(a.[i].Key, b.[i].Key) <> 0 || a.[i].Count <> b.[i].Count then
                        eq <- false
                    i <- i + 1
                eq

/// Operations on `Bag<'T>`. The combiner `union` is the per-key SUM; `add` is
/// `union` with a singleton; `ofEntries` canonicalizes arbitrary input.
[<RequireQualifiedAccess>]
module Bag =

    /// Add two counts, raising `OverflowException` if the int64 sum overflows —
    /// the F# analog of the TS `addCounts` safe-integer guard and the Rust
    /// `checked_add`. Two valid counts can sum past `Int64.MaxValue`, which would
    /// silently wrap; the guard surfaces it instead.
    let inline private addCounts (a: int64) (b: int64) : int64 = Checked.(+) a b

    /// The empty Bag (the `union` identity).
    let empty<'T when 'T : comparison> : Bag<'T> = Bag<'T>.Empty

    /// A one-key Bag at count `n`; `n <= 0` yields the empty Bag.
    let singleton (x: 'T) (n: int64) : Bag<'T> =
        if n > 0L then Bag<'T>(ImmutableArray.Create({ Key = x; Count = n }))
        else Bag<'T>.Empty

    /// Canonicalize arbitrary `(key, count)` entries: sum counts per key, drop
    /// any whose summed count is `<= 0`, sort ascending by key. The constructor
    /// that re-establishes the invariant from unordered, possibly-duplicated,
    /// possibly-non-positive input.
    let ofEntries (entries: seq<'T * int64>) : Bag<'T> =
        let sorted =
            entries
            |> Seq.sortWith (fun (ka, _) (kb, _) -> KeyComparerCache<'T>.Instance.Compare(ka, kb))
            |> Seq.toArray
        let merged = ImmutableArray.CreateBuilder<BagEntry<'T>>(sorted.Length)
        for (k, n) in sorted do
            if merged.Count > 0 && KeyComparerCache<'T>.Instance.Compare(merged.[merged.Count - 1].Key, k) = 0 then
                let prev = merged.[merged.Count - 1]
                merged.[merged.Count - 1] <- { Key = prev.Key; Count = addCounts prev.Count n }
            else
                merged.Add({ Key = k; Count = n })
        let out = ImmutableArray.CreateBuilder<BagEntry<'T>>(merged.Count)
        for e in merged do
            if e.Count > 0L then out.Add(e)
        Bag<'T>(out.ToImmutable())

    /// Build a Bag by counting occurrences in a seq — each occurrence adds 1.
    let ofSeq (xs: seq<'T>) : Bag<'T> =
        xs |> Seq.map (fun x -> (x, 1L)) |> ofEntries

    let multiplicity (x: 'T) (g: Bag<'T>) : int64 = g.Multiplicity(x)
    let contains (x: 'T) (g: Bag<'T>) : bool = g.Contains(x)
    let count (g: Bag<'T>) : int = g.Count
    let distinctCount (g: Bag<'T>) : int = g.Count
    let isEmpty (g: Bag<'T>) : bool = g.IsEmpty
    let toArray (g: Bag<'T>) : BagEntry<'T>[] = g.ToArray()

    /// The entries in canonical order as `(key, count)` tuples — the shape the
    /// cross-language golden vector compares against.
    let toList (g: Bag<'T>) : ('T * int64) list =
        g.ToArray() |> Array.map (fun e -> (e.Key, e.Count)) |> List.ofArray

    /// The sum of all multiplicities (the total count across keys); raises on
    /// int64 overflow.
    let total (g: Bag<'T>) : int64 =
        let mutable s = 0L
        for e in g.ToArray() do
            s <- addCounts s e.Count
        s

    /// The combiner: the per-key SUM of two sorted bags, kept sorted and
    /// count-positive. Commutative, associative, and the empty bag is the
    /// identity — but NOT idempotent: `union a a` doubles every count. This
    /// commutative monoid is the step the Z-set completes into an abelian group
    /// (signed ℤ weights, where retraction is the inverse). Delegates to the type's
    /// generic-math `(+)` operator: same merge, one canonical implementation.
    let union (a: Bag<'T>) (b: Bag<'T>) : Bag<'T> = a + b

    /// Increment `x`'s count by 1 (`union` with a singleton). NOT idempotent.
    let add (x: 'T) (g: Bag<'T>) : Bag<'T> = union g (singleton x 1L)

    /// Increment `x`'s count by `n`; `n <= 0` is a no-op (the Bag is grow-only
    /// over ℕ).
    let addN (x: 'T) (n: int64) (g: Bag<'T>) : Bag<'T> =
        if n > 0L then union g (singleton x n) else g
