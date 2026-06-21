namespace Zeta.Core

open System
open System.Collections.Generic
open System.Collections.Immutable
open System.Runtime.CompilerServices

/// A grow-only set `G[T]` — the bottom rung of the Zeta algebra ladder
/// (**G-Set → Bag → Z-set**) made first-class instead of implicit.
///
/// G-Set is the `ZSet` (`ZSet.fs`) **restricted to non-negative multiplicity
/// with no retractions**: every element is present exactly once, `union` is the
/// only combiner, and `union` is **idempotent, commutative, and associative** —
/// the three CRDT convergence laws. Those three laws are why a G-Set converges
/// without coordination: any two replicas that have seen the same elements (in
/// any order, with any duplication) compute the same set.
///
/// This is the comms substrate of the git-native agent-bus (081KSXN940008QG0R00171YAZW): an
/// append-only `docs/agent-bus/` folder of ZetaId-keyed messages *is* a G-Set —
/// re-observing the same message id is `union` and a no-op (the same reason the
/// observe-loop's `folderSink` treats an `EEXIST` write as success). Ace's
/// dependency graph (081KSGS9H0008QG0R0031PBNGA) is the general `ZSet`, where add/remove nets via
/// retraction; the bus never retracts, so the weaker G-Set is exactly right.
///
/// Represented as an immutable **ascending-sorted, de-duplicated** run. The
/// canonical order makes `Equals` total, makes `toArray` deterministic, and
/// makes cross-language golden-vectors byte-stable (the TS twin in
/// `src/Core.TypeScript/g-set/` produces the identical sorted array). `'T`
/// needs `comparison` to give the sort + the dedup — the F# analog of the TS
/// twin's required `compare`.
[<Struct; IsReadOnly; CustomEquality; NoComparison>]
type GSet<'T when 'T : comparison> =
    val internal items : ImmutableArray<'T>

    /// Construct from an already sorted-ascending, duplicate-free run. Callers
    /// own the invariant; use `GSet.ofSeq` for arbitrary input.
    new(items: ImmutableArray<'T>) = { items = items }

    static member Empty : GSet<'T> = GSet(ImmutableArray<'T>.Empty)

    /// The additive-monoid identity (generic-math `Zero`) — an alias for `Empty`,
    /// recognized by F# SRTP / `LanguagePrimitives.GenericZero` + generic numeric
    /// code. G-Set is an additive, **commutative + idempotent** monoid (identity +
    /// associative `union`, **no inverse**), so it surfaces `Zero` + `(+)` only —
    /// never `INumber` (no negation / order / multiplication). `(+)` IS `union`.
    static member Zero : GSet<'T> = GSet<'T>.Empty

    /// The additive operator (generic-math `(+)`): the CRDT `union` merge of two
    /// sorted-unique runs, kept sorted-unique. Idempotent + commutative +
    /// associative. The canonical home of the merge; `GSet.union` delegates here.
    static member (+) (a: GSet<'T>, b: GSet<'T>) : GSet<'T> =
        let xa = if a.items.IsDefault then ImmutableArray<'T>.Empty else a.items
        let xb = if b.items.IsDefault then ImmutableArray<'T>.Empty else b.items
        if xa.IsEmpty then GSet<'T>(xb)
        elif xb.IsEmpty then GSet<'T>(xa)
        else
            // Default collation = binary/ordinal (081KT07NV0008QG0R001YDB73K): never culture-sensitive Comparer<string>.Default.
            let cmp = Collation.forKey<'T> ()
            let out = ImmutableArray.CreateBuilder<'T>(xa.Length + xb.Length)
            let mutable i = 0
            let mutable j = 0
            while i < xa.Length && j < xb.Length do
                let c = cmp.Compare(xa.[i], xb.[j])
                if c < 0 then
                    out.Add(xa.[i]); i <- i + 1
                elif c > 0 then
                    out.Add(xb.[j]); j <- j + 1
                else
                    out.Add(xa.[i]); i <- i + 1; j <- j + 1 // duplicate → keep one
            while i < xa.Length do
                out.Add(xa.[i]); i <- i + 1
            while j < xb.Length do
                out.Add(xb.[j]); j <- j + 1
            GSet<'T>(out.ToImmutable())

    member this.Count =
        if this.items.IsDefault then 0 else this.items.Length

    member this.IsEmpty = this.items.IsDefaultOrEmpty

    /// Membership via binary search on the sorted run. O(log n), zero-alloc.
    member this.Contains(x: 'T) : bool =
        if this.items.IsDefaultOrEmpty then
            false
        else
            let cmp = Collation.forKey<'T> ()
            let mutable lo = 0
            let mutable hi = this.items.Length - 1
            let mutable found = false
            while lo <= hi && not found do
                let mid = lo + (hi - lo) / 2
                let c = cmp.Compare(this.items.[mid], x)
                if c = 0 then found <- true
                elif c < 0 then lo <- mid + 1
                else hi <- mid - 1
            found

    /// The elements in canonical (ascending) order.
    member this.ToArray() : 'T[] =
        if this.items.IsDefaultOrEmpty then
            Array.empty
        else
            let arr = Array.zeroCreate this.items.Length
            this.items.CopyTo(arr)
            arr

    override this.Equals(o: obj) : bool =
        match o with
        | :? GSet<'T> as other -> (this :> IEquatable<GSet<'T>>).Equals(other)
        | _ -> false

    override this.GetHashCode() : int =
        // Order-independent only in principle; the run is canonical-sorted, so a
        // simple positional combine over the canonical order is stable + total.
        let mutable h = 17
        if not this.items.IsDefaultOrEmpty then
            for i in 0 .. this.items.Length - 1 do
                h <- (h * 31) + EqualityComparer<'T>.Default.GetHashCode(this.items.[i])
        h

    interface IEquatable<GSet<'T>> with
        member this.Equals(other: GSet<'T>) : bool =
            let a = this.items
            let b = other.items
            let an = if a.IsDefault then 0 else a.Length
            let bn = if b.IsDefault then 0 else b.Length
            if an <> bn then
                false
            else
                let cmp = Collation.forKey<'T> ()
                let mutable i = 0
                let mutable eq = true
                while i < an && eq do
                    if cmp.Compare(a.[i], b.[i]) <> 0 then eq <- false
                    i <- i + 1
                eq

/// Operations on `GSet<'T>`. The combiner `union` is the CRDT merge; `add` is
/// `union` with a singleton; `ofSeq` canonicalizes arbitrary input.
[<RequireQualifiedAccess>]
module GSet =

    /// The empty G-Set (the `union` identity).
    let empty<'T when 'T : comparison> : GSet<'T> = GSet<'T>.Empty

    /// Canonicalize arbitrary input: sort ascending + drop duplicates. Uses the default binary/ordinal
    /// collation (081KT07NV0008QG0R001YDB73K): string ordering is ordinal, never culture-sensitive.
    let ofSeq (xs: seq<'T>) : GSet<'T> =
        let cmp = Collation.forKey<'T> ()
        let sorted =
            xs
            |> Seq.distinct
            |> Seq.sortWith (fun a b -> cmp.Compare(a, b))
            |> ImmutableArray.CreateRange
        GSet<'T>(sorted)

    /// A one-element G-Set.
    let singleton (x: 'T) : GSet<'T> = GSet<'T>(ImmutableArray.Create(x))

    let toArray (g: GSet<'T>) : 'T[] = g.ToArray()
    let toList (g: GSet<'T>) : 'T list = g.ToArray() |> List.ofArray
    let toSeq (g: GSet<'T>) : seq<'T> = g.ToArray() :> seq<'T>
    let contains (x: 'T) (g: GSet<'T>) : bool = g.Contains(x)
    let count (g: GSet<'T>) : int = g.Count
    let isEmpty (g: GSet<'T>) : bool = g.IsEmpty

    /// The CRDT merge: the union of two sorted-unique runs, kept sorted-unique.
    /// Idempotent (`union a a = a`), commutative (`union a b = union b a`), and
    /// associative — verified by the law tests + the cross-language golden
    /// vector. Delegates to the type's generic-math `(+)` operator: same merge,
    /// one canonical implementation (so `union` and `(+)` can never drift).
    let union (a: GSet<'T>) (b: GSet<'T>) : GSet<'T> = a + b

    /// Add one element (`union` with a singleton). Idempotent: adding a present
    /// element returns an equal set.
    let add (x: 'T) (g: GSet<'T>) : GSet<'T> =
        if g.Contains(x) then g else union g (singleton x)
