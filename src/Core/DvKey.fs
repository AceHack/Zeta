namespace Zeta.Core

open System
open System.Collections.Generic

/// **Content-addressed, COMPARABLE key for a `DynamicValue` row.** `DynamicValue` is `NoComparison`, so it
/// can't be a `ZSet` key or a Debezium row directly. `DvKey` wraps a value with its **canonical CBOR
/// bytes** (`DynamicValue.toCanonicalCbor` — byte-locked, cross-language) and orders/compares by those
/// bytes (ordinal, lexicographic — EXACT, no hash-collision risk). So real self-describing rows flow
/// through `ZSet` / `IndexedZSet` / `DebeziumCdc` and the data plane. The canonical bytes also ARE the
/// content address (hash them for the `ContentStore`/Merkle key), so identity is consistent end-to-end.
[<CustomEquality; CustomComparison>]
type DvKey =
    { Value: DynamicValue
      Canonical: byte[] }

    /// Lexicographic ordinal compare of the canonical bytes (the cross-language canonical order — same as
    /// `ZSetMerkle` leaf ordering).
    static member private CompareBytes(a: byte[], b: byte[]) : int =
        let n = min a.Length b.Length
        let mutable i = 0
        let mutable r = 0
        while r = 0 && i < n do
            r <- compare a.[i] b.[i]
            i <- i + 1
        if r <> 0 then r else compare a.Length b.Length

    override this.Equals(o: obj) : bool =
        match o with
        | :? DvKey as other -> DvKey.CompareBytes(this.Canonical, other.Canonical) = 0
        | _ -> false

    override this.GetHashCode() : int =
        // FNV-1a over the canonical bytes — consistent with Equals (equal canonical ⇒ equal hash).
        let mutable h = 2166136261u
        for b in this.Canonical do
            h <- (h ^^^ uint32 b) * 16777619u
        int h

    interface IEquatable<DvKey> with
        member this.Equals(other: DvKey) : bool = DvKey.CompareBytes(this.Canonical, other.Canonical) = 0

    interface IComparable<DvKey> with
        member this.CompareTo(other: DvKey) : int = DvKey.CompareBytes(this.Canonical, other.Canonical)

    interface IComparable with
        member this.CompareTo(o: obj) : int =
            match o with
            | :? DvKey as other -> DvKey.CompareBytes(this.Canonical, other.Canonical)
            | _ -> invalidArg "o" "cannot compare DvKey with a non-DvKey"

[<RequireQualifiedAccess>]
module DvKey =

    /// Wrap a `DynamicValue` as a comparable, content-addressed row key (computes its canonical CBOR once).
    let ofValue (v: DynamicValue) : DvKey =
        { Value = v; Canonical = DynamicValue.toCanonicalCborOk v }

    /// The underlying value.
    let value (k: DvKey) : DynamicValue = k.Value

    /// The canonical CBOR bytes (the content identity; hash these for the Merkle/ContentStore address).
    let canonical (k: DvKey) : byte[] = k.Canonical
