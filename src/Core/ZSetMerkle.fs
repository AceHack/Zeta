namespace Zeta.Core

open System
open System.Buffers.Binary

/// **Canonical Merkle root over a Z-set** — the foundation of the fs-Merkle / git-compatible replacement
/// backend (workitem 081KTGTJC1Q; Aaron 2026-06-07). The Merkle leaves ARE the retractable DBSP Z-set
/// entries, so the content-addressed root is a *pure function of the NET Z-set state*: **retraction is
/// native** — equal Z-sets produce equal roots, and `+w` then `−w` on a key is a no-op on the root (the
/// canceled entry simply isn't in the support). Two Z-sets differing by a small delta share most leaves →
/// most internal nodes → cheap incremental diff (the Merkle trick, now over Z-set deltas).
///
/// **Hash-parameterized.** `rootWith` takes the hash function, so the structure + canonicalization are
/// independent of the digest. Today the default `root` uses `MerkleHash.ofBytes` (XxHash128 —
/// dedup/history-grade). The git-replacement object store will pass **BLAKE3** (cryptographic,
/// tamper-respecting — Aaron's decision; not yet a dependency). Swap at the call site, not in the algebra.
///
/// **Canonical order is by ENCODED-KEY BYTES (codepoint / byte-ordinal lexicographic)** — deliberately NOT
/// the Z-set's internal `Comparer<'K>.Default` order, which is culture-SENSITIVE for strings (081KT07NV0008QG0R001YDB73K /
/// the culture-invariant rule). Re-sorting by key bytes here is exactly what makes the root cross-language
/// **byte-lockable** (the same root in F#/C#/Rust/TS given the same `encodeKey` + hash). The seed is the
/// treaty.
[<RequireQualifiedAccess>]
module ZSetMerkle =

    /// Canonical leaf encoding for one `(key, weight)` entry:
    /// `[4-byte LE keyLen][keyBytes][8-byte LE weight]`. Length-prefixing the key makes the encoding
    /// injective (no `(k1,k2)` vs `(k1++k2)` ambiguity); little-endian fixes byte order across languages.
    let private leafBytes (keyBytes: byte[]) (weight: Weight) : byte[] =
        let buf = Array.zeroCreate<byte> (4 + keyBytes.Length + 8)
        BinaryPrimitives.WriteInt32LittleEndian(Span<byte>(buf, 0, 4), keyBytes.Length)
        Array.blit keyBytes 0 buf 4 keyBytes.Length
        BinaryPrimitives.WriteInt64LittleEndian(Span<byte>(buf, 4 + keyBytes.Length, 8), weight)
        buf

    /// Lexicographic ordinal comparison of two byte arrays (the cross-language canonical order).
    let private byteCompare (a: byte[]) (b: byte[]) : int =
        let n = min a.Length b.Length
        let mutable i = 0
        let mutable r = 0
        while r = 0 && i < n do
            r <- compare a.[i] b.[i]
            i <- i + 1
        if r <> 0 then r else compare a.Length b.Length

    /// Combine two child digests into a parent: 32 LE bytes `a.Hi a.Lo b.Hi b.Lo`, re-hashed.
    let private combine (hash: byte[] -> MerkleHash) (a: MerkleHash) (b: MerkleHash) : MerkleHash =
        let buf = Array.zeroCreate<byte> 32
        BinaryPrimitives.WriteUInt64LittleEndian(Span<byte>(buf, 0, 8), a.Hi)
        BinaryPrimitives.WriteUInt64LittleEndian(Span<byte>(buf, 8, 8), a.Lo)
        BinaryPrimitives.WriteUInt64LittleEndian(Span<byte>(buf, 16, 8), b.Hi)
        BinaryPrimitives.WriteUInt64LittleEndian(Span<byte>(buf, 24, 8), b.Lo)
        hash buf

    /// Fold a level of digests bottom-up; an odd trailing node is promoted (duplicated) — the standard
    /// Merkle construction. (Note: the duplicate-last shape has the well-known second-preimage caveat; for
    /// a tamper-evident store this is paired with BLAKE3 + the length-prefixed injective leaf encoding.)
    let rec private fold (hash: byte[] -> MerkleHash) (level: MerkleHash[]) : MerkleHash =
        match level.Length with
        | 0 -> hash (Array.empty<byte>) // canonical empty root
        | 1 -> level.[0]
        | n ->
            let parents = Array.zeroCreate<MerkleHash> ((n + 1) / 2)
            for i in 0 .. parents.Length - 1 do
                let a = level.[2 * i]
                let b = if 2 * i + 1 < n then level.[2 * i + 1] else a
                parents.[i] <- combine hash a b
            fold hash parents

    /// Canonical Merkle root over `z` with an explicit hash function. Leaves = `(key, weight)` entries
    /// encoded + sorted by key bytes (ordinal); folded bottom-up. Deterministic + retraction-native.
    let rootWith (hash: byte[] -> MerkleHash) (encodeKey: 'K -> byte[]) (z: ZSet<'K>) : MerkleHash =
        let leaves =
            [| for e in z -> struct (encodeKey e.Key, e.Weight) |]
            |> Array.sortWith (fun (struct (ka, _)) (struct (kb, _)) -> byteCompare ka kb)
            |> Array.map (fun (struct (kb, w)) -> hash (leafBytes kb w))

        fold hash leaves

    /// Canonical Merkle root using the default digest (XxHash128 via `MerkleHash.ofBytes`). For the
    /// git-replacement / tamper-evident store, call `rootWith` with BLAKE3 instead (081KTGTJC1Q).
    let root (encodeKey: 'K -> byte[]) (z: ZSet<'K>) : MerkleHash =
        rootWith (fun (b: byte[]) -> MerkleHash.ofBytes (ReadOnlySpan<byte> b)) encodeKey z

    // ── Inclusion (audit) proofs — math-team handoff row 4 (inclusion + no third-party forge) ──
    //
    // A root commits to the whole Z-set; an inclusion proof commits to ONE `(key, weight)` entry
    // *under* that root. The soundness target (row 4): a third party holding only the proof + the
    // root — never the tree — can verify membership, and cannot forge a proof for an entry that is
    // not committed (any tampered leaf/weight/path recomputes a different root). This is the
    // companion to `Merkle.Laws.Tests.fs`'s existing tamper-evidence ("equal roots ⟹ equal leaves"):
    // that proves the root pins the leaves; this gives the succinct per-leaf witness of it.

    /// One step on a Merkle audit path: the sibling digest and whether that sibling sits on the
    /// RIGHT (so the current node is the LEFT child and `parent = combine self sibling`). When a
    /// level has an odd trailing node the `fold` duplicates it, so that node's sibling IS itself
    /// with `SiblingOnRight = true` — `proofForWith` records this faithfully so verification replays
    /// the exact same construction `rootWith` used.
    type MerkleStep = { Sibling: MerkleHash; SiblingOnRight: bool }

    /// A self-contained inclusion (audit) proof that a single `(key, weight)` Z-set entry is
    /// committed under a Merkle root. Verifiable by a third party holding ONLY the proof + the root.
    /// `LeafKeyBytes` is the canonical `encodeKey` image (not the live `'K`), so the proof is
    /// byte-portable across the four language oracles — the bytes are the treaty, same as the root.
    type MerkleProof =
        { LeafKeyBytes: byte[]
          LeafWeight: Weight
          Steps: MerkleStep[] }

    /// Build an inclusion proof for `key` under the root of `z` (explicit hash). `None` when `key`
    /// is not in the support (you cannot prove membership of a non-member — that absence is exactly
    /// the no-forge property). The proof replays `rootWith`'s canonical order + odd-node duplication.
    let proofForWith
        (hash: byte[] -> MerkleHash)
        (encodeKey: 'K -> byte[])
        (z: ZSet<'K>)
        (key: 'K)
        : MerkleProof option =
        let entries =
            [| for e in z -> struct (encodeKey e.Key, e.Weight) |]
            |> Array.sortWith (fun (struct (ka, _)) (struct (kb, _)) -> byteCompare ka kb)

        let targetKey = encodeKey key

        match entries |> Array.tryFindIndex (fun (struct (kb, _)) -> byteCompare kb targetKey = 0) with
        | None -> None
        | Some leafIdx ->
            let struct (leafKeyBytes, leafWeight) = entries.[leafIdx]
            let mutable level = entries |> Array.map (fun (struct (kb, w)) -> hash (leafBytes kb w))
            let steps = ResizeArray<MerkleStep>()
            let mutable idx = leafIdx
            while level.Length > 1 do
                let n = level.Length
                let selfIsLeft = idx % 2 = 0
                // selfIsLeft: sibling on the right (or self, when this is the odd trailing node).
                // not selfIsLeft: self is the right child, sibling is the left neighbour.
                let siblingIdx =
                    if selfIsLeft then (if idx + 1 < n then idx + 1 else idx) else idx - 1
                steps.Add({ Sibling = level.[siblingIdx]; SiblingOnRight = selfIsLeft })
                let parents = Array.zeroCreate<MerkleHash> ((n + 1) / 2)
                for i in 0 .. parents.Length - 1 do
                    let a = level.[2 * i]
                    let b = if 2 * i + 1 < n then level.[2 * i + 1] else a
                    parents.[i] <- combine hash a b
                level <- parents
                idx <- idx / 2
            Some
                { LeafKeyBytes = leafKeyBytes
                  LeafWeight = leafWeight
                  Steps = steps.ToArray() }

    /// Verify an inclusion proof against an expected root (explicit hash). Recomputes the leaf digest
    /// from the proof's own `(LeafKeyBytes, LeafWeight)` and folds up the audit path — touching only
    /// the proof + the root, never the tree. Returns `true` iff the recomputed root matches.
    let verifyWith (hash: byte[] -> MerkleHash) (proof: MerkleProof) (expectedRoot: MerkleHash) : bool =
        let mutable acc = hash (leafBytes proof.LeafKeyBytes proof.LeafWeight)
        for step in proof.Steps do
            acc <-
                if step.SiblingOnRight then combine hash acc step.Sibling
                else combine hash step.Sibling acc
        acc.ToHex() = expectedRoot.ToHex()

    /// Inclusion proof using the default digest (XxHash128). Pairs with `root`.
    let proofFor (encodeKey: 'K -> byte[]) (z: ZSet<'K>) (key: 'K) : MerkleProof option =
        proofForWith (fun (b: byte[]) -> MerkleHash.ofBytes (ReadOnlySpan<byte> b)) encodeKey z key

    /// Verify an inclusion proof using the default digest (XxHash128). Pairs with `root`.
    let verify (proof: MerkleProof) (expectedRoot: MerkleHash) : bool =
        verifyWith (fun (b: byte[]) -> MerkleHash.ofBytes (ReadOnlySpan<byte> b)) proof expectedRoot
