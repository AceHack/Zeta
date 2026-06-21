namespace Zeta.Core

open System.Collections.Immutable

/// **Content-addressed, single-instance store — the COW Merkle-DAG backend foundation (081KTGTJC1Q).**
///
/// A value is stored ONCE, keyed by the hash of its content (the key IS the content address). Properties
/// that make this the git-compatible / APFS-like substrate:
///
///   - **Single-instance / dedup** — identical content under any number of references is one stored node;
///     `put` of already-present content is a no-op on the set of nodes (idempotent — discipline #6).
///   - **Copy-on-write** — `put` returns a NEW `Store` version; the prior version is unchanged, so old
///     roots persist as **cheap branches** (the fork-from-prod / experiment-timeline substrate). Backed by
///     an immutable `Map`, so sharing is structural (no copy).
///   - **Hash-parameterized** — the content hash comes from an injected `hashOf`; XxHash128 (`MerkleHash`)
///     today, **BLAKE3** for the tamper-evident git-replacement store (Aaron's decision; 081KT07NV0008QG0R001YDB73K-adjacent).
///     The `ZSetMerkle` root is the natural `hashOf` for Z-set-valued nodes.
///
/// This is the object/blob layer; the multi-parent closure-table DAG (folders → nodes, hardlink-shaped)
/// and the garbage-dump null-writer write path land on top (`Hierarchy.fs` + the merge engine).
[<RequireQualifiedAccess>]
module ContentStore =

    /// An immutable content-addressed store. `hashOf` makes the address; `byHash` is the single-instance
    /// node set. Construct via `create`; evolve via `put` (each returns a new COW version).
    [<NoEquality; NoComparison>]
    type Store<'V> =
        private
            { byHash: ImmutableDictionary<MerkleHash, 'V>
              hashOf: 'V -> MerkleHash }

    /// A store keyed by `hashOf` (e.g. `ZSetMerkle.root enc` for Z-sets, or a canonical-CBOR hash).
    /// `ImmutableDictionary` keys on `MerkleHash`'s custom equality (no ordering needed) and stays
    /// structurally-shared/immutable, so each `put` is a cheap COW version.
    let create (hashOf: 'V -> MerkleHash) : Store<'V> =
        { byHash = ImmutableDictionary.Create<MerkleHash, 'V>(); hashOf = hashOf }

    /// The content address of a value WITHOUT storing it (pure; for lookup-before-put / equality checks).
    let addressOf (v: 'V) (s: Store<'V>) : MerkleHash = s.hashOf v

    /// Idempotent content-addressed put: returns the content hash + the new (COW) store version. Storing
    /// content already present leaves the node set unchanged (single-instance dedup) — `apply-N == apply-1`.
    let put (v: 'V) (s: Store<'V>) : MerkleHash * Store<'V> =
        let h = s.hashOf v
        if s.byHash.ContainsKey h then h, s // dedup: already single-instanced
        else h, { s with byHash = s.byHash.Add(h, v) }

    /// Fetch content by its address.
    let get (h: MerkleHash) (s: Store<'V>) : 'V option =
        match s.byHash.TryGetValue h with
        | true, v -> Some v
        | _ -> None

    /// Is this address present?
    let contains (h: MerkleHash) (s: Store<'V>) : bool = s.byHash.ContainsKey h

    /// The number of distinct (single-instanced) nodes.
    let count (s: Store<'V>) : int = s.byHash.Count

    /// **Merge two content stores** (same `hashOf`): union by content address. CONFLICT-FREE — identical
    /// content has the identical hash (single-instance), so the union just dedups; this is the whole point
    /// of content-addressing for filesystem merge (Aaron 2026-06-07). Structural sharing via ImmutableDictionary.
    let merge (a: Store<'V>) (b: Store<'V>) : Store<'V> =
        let mutable d = a.byHash
        for kv in b.byHash do
            if not (d.ContainsKey kv.Key) then d <- d.Add(kv.Key, kv.Value)
        { a with byHash = d }

    /// All content addresses currently stored.
    let addresses (s: Store<'V>) : MerkleHash seq = s.byHash.Keys
