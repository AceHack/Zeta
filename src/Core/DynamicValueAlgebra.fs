namespace Zeta.Core

open System

/// **Generic-algebra instances over `DynamicValue` (Aaron 2026-06-07: "generic algebra interfaces … add it
/// to our DynamicValue; use the dotnet ones where they make sense").** Instance-passing (the algebra is a
/// separate value implementing `IMonoid`/`ISemilattice` from `Semiring.fs`), matching the existing
/// `ISemiring` instances (`IntegerRing` etc.) — so this is **additive and does NOT change the public
/// `DynamicValue` DU or its interface list** (implementing the operator interfaces *on the type itself*, or
/// adopting .NET generic-math `INumber` at scalar leaves, is a separate API-reviewed step — backlogged).
///
/// The clean, *provably associative* monoid on raw `DynamicValue` is an **LWW-register join-semilattice**:
/// identity `Null`, combine = content-hash last-write-wins (max over a total order) for ALL shapes. It is
/// commutative, associative, and idempotent (max over a total order always is), so out-of-order merges
/// converge — the confluence resolver, reused (PR #6846). The total order is the canonical-CBOR content
/// address (`toCanonicalCbor` is total over all 8 shapes), so the tiebreak is deterministic and DST-stable.
///
/// **Why not a recursive deep-merge here?** Deep `Object` key-union composed with LWW at type-conflicts is
/// NOT associative without per-key versioning (an object in one grouping is LWW'd as a whole in another —
/// caught by the associativity law test). Deep structural merge is therefore the domain of the **versioned
/// `LwwMap` CRDT** (`Crdt.fs`), which timestamps each key — not a plain monoid on unversioned `DynamicValue`.
[<RequireQualifiedAccess>]
module DynamicValueAlgebra =

    /// Canonical content address of any `DynamicValue` (via canonical CBOR) — the deterministic LWW key.
    let private addr (v: DynamicValue) : MerkleHash =
        MerkleHash.ofBytes(ReadOnlySpan<byte>(DynamicValue.toCanonicalCborOk v))

    /// Content-hash last-write-wins: `Null` is bottom; equal values collapse; else the value with the
    /// greater content address. A deterministic, commutative, associative, idempotent join (max over a
    /// total order).
    let private lwwJoin (a: DynamicValue) (b: DynamicValue) : DynamicValue =
        match a, b with
        | DynamicValue.Null, x
        | x, DynamicValue.Null -> x
        | _ when a.Equals b -> a
        | _ -> if (addr a).ToHex() >= (addr b).ToHex() then a else b

    /// The DynamicValue **LWW-register** semilattice — identity `Null`, combine = content-hash last-write-
    /// wins. Commutative + associative + idempotent (the confluence join-semilattice). For per-field deep
    /// merge use the versioned `LwwMap` CRDT (`Crdt.fs`).
    let mergeSemilattice: ISemilattice<DynamicValue> =
        { new ISemilattice<DynamicValue> with
            member _.Identity = DynamicValue.Null
            member _.Combine(a, b) = lwwJoin a b }

    /// Fold a sequence under any monoid (generic plumbing): `Combine`-reduce from `Identity`.
    let fold (m: IMonoid<'T>) (xs: 'T seq) : 'T = Seq.fold (fun a b -> m.Combine(a, b)) m.Identity xs

    /// Merge a sequence of `DynamicValue`s under the merge semilattice (order-independent by construction).
    let mergeAll (xs: DynamicValue seq) : DynamicValue = fold mergeSemilattice xs
