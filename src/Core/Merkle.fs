namespace Zeta.Core

open System
open System.Buffers.Binary
open System.IO.Hashing
open System.Runtime.CompilerServices


/// Merkle-tree checkpointing — the second CAS-DBSP building block
/// after `FastCdc`. A Merkle tree hashes every leaf (spine batch,
/// checkpoint chunk) and internal node, so incremental checkpoints
/// can ship **only the leaves whose digest changed** plus the
/// O(log N) path to the root. Same trick git / IPFS / BitTorrent /
/// CRDT anti-entropy all use.
///
/// ## Why this pairs with FastCDC
///
/// `FastCdc` cuts a byte stream into content-defined chunks. Each
/// chunk has a stable digest; we hash the digests into a Merkle
/// tree. Two checkpoints that share most chunks produce Merkle
/// trees that share most internal nodes → only the differing
/// leaves + the recalculated path travel on the wire.
///
/// ## Hash choice
///
/// **XxHash128** — 128-bit, non-cryptographic, 40+ GB/s on modern
/// x86-64 or ARMv8. Not tamper-proof; if you need Byzantine
/// guarantees upgrade to BLAKE3 (flagged roadmap P2). For
/// same-tenant replication XxHash128's collision probability is
/// effectively zero at reasonable tree sizes (< 2^60 leaves).
///
/// References:
///   - Merkle "A digital signature based on a conventional
///     encryption function" CRYPTO 1987
///   - git's packfile format (incremental object transfer)
///   - IPFS DAG (content-addressed Merkle DAGs)
///   - Xia et al. "FastCDC" USENIX ATC 2016 (the chunker we pair with)

// MerkleHash is defined in Zeta.Core.Abstractions C# project.


[<RequireQualifiedAccess>]
[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module MerkleHash =

    /// Hash a leaf (raw bytes) into a `MerkleHash`. We use
    /// `XxHash128.Hash` which writes 16 bytes into a destination
    /// span — cheaper than allocating a UInt128 struct.
    let ofBytes (bytes: ReadOnlySpan<byte>) : MerkleHash =
        let buf = Array.zeroCreate<byte> 16
        XxHash128.Hash(bytes, Span<byte> buf) |> ignore
        let lo = BinaryPrimitives.ReadUInt64LittleEndian(ReadOnlySpan<byte>(buf, 0, 8))
        let hi = BinaryPrimitives.ReadUInt64LittleEndian(ReadOnlySpan<byte>(buf, 8, 8))
        MerkleHash(hi, lo)

    /// Combine two child hashes into a parent. Concatenate hi/lo
    /// bytes and re-hash — the standard Merkle-tree internal-node
    /// construction.
    let combine (a: MerkleHash) (b: MerkleHash) : MerkleHash =
        let buf = Array.zeroCreate<byte> 32
        BinaryPrimitives.WriteUInt64LittleEndian(Span<byte>(buf, 0, 8), a.Hi)
        BinaryPrimitives.WriteUInt64LittleEndian(Span<byte>(buf, 8, 8), a.Lo)
        BinaryPrimitives.WriteUInt64LittleEndian(Span<byte>(buf, 16, 8), b.Hi)
        BinaryPrimitives.WriteUInt64LittleEndian(Span<byte>(buf, 24, 8), b.Lo)
        ofBytes (ReadOnlySpan<byte> buf)


/// One step on a Merkle inclusion (audit) path: the sibling digest and whether
/// that sibling sits on the RIGHT (so the current node is the LEFT child and
/// `parent = combine self sibling`). The odd trailing node's sibling is itself
/// with `SiblingOnRight = true` — the same duplicate-last shape the tree folds.
/// Byte-portable across the F#/C#/Rust/TS oracles (the golden-vector treaty).
type MerkleProofStep = { Sibling: MerkleHash; SiblingOnRight: bool }

/// Merkle tree over a sequence of leaf blobs. Built bottom-up in a
/// single pass; the root digest is returned + cached for later
/// diff-against-a-prior-tree comparisons.
[<Sealed>]
type MerkleTree(leaves: byte array array) =
    // Compute level 0 (leaves).
    let level0 = leaves |> Array.map (fun b -> MerkleHash.ofBytes (ReadOnlySpan<byte> b))

    // Build internal levels until root. We keep every level so a
    // diff against a prior tree can identify the exact leaf path
    // whose digest changed.
    let levels =
        let all = ResizeArray<MerkleHash array>()
        all.Add level0
        let mutable cur = level0
        while cur.Length > 1 do
            let parent =
                Array.init ((cur.Length + 1) / 2) (fun i ->
                    let left = cur.[2 * i]
                    let right =
                        if 2 * i + 1 < cur.Length then cur.[2 * i + 1]
                        else left   // duplicate last leaf for odd fan-in
                    MerkleHash.combine left right)
            all.Add parent
            cur <- parent
        all.ToArray()

    /// Root digest — unique per distinct sequence of leaves. Two
    /// trees with equal roots share every leaf.
    member _.Root : MerkleHash =
        let top = levels.[levels.Length - 1]
        if top.Length = 0 then MerkleHash.Zero else top.[0]

    /// Number of leaves.
    member _.LeafCount = leaves.Length

    /// Height of the tree (log2 ceiling).
    member _.Height = levels.Length

    /// The leaf hashes (useful for diffing).
    member _.LeafHashes : MerkleHash array = level0

    /// Find leaf indices whose hash differs from the corresponding
    /// hash in `prior`. Precisely the **minimum set of leaves**
    /// that need to be re-transmitted to sync the prior state to
    /// this one. **Flat O(N)** over the leaf hashes with a root-equality
    /// short-circuit — it does NOT branch-prune internal levels (BUGS.md
    /// triage 2026-06-12: the old claim of "O(changed + log N) in
    /// practice" described a walk this body never performs; the pruning
    /// walk is a named upgrade, not what this is).
    member this.LeafDiff(prior: MerkleTree) : int array =
        if this.Root = prior.Root then [||]
        else
            let mine = this.LeafHashes
            let theirs = prior.LeafHashes
            let n = max mine.Length theirs.Length
            let changed = ResizeArray()
            for i in 0 .. n - 1 do
                let m = if i < mine.Length then mine.[i] else MerkleHash.Zero
                let t = if i < theirs.Length then theirs.[i] else MerkleHash.Zero
                if not (m.Equals t) then changed.Add i
            changed.ToArray()

    /// All internal-level digests — exposed for advanced diff-path
    /// protocols that walk the tree top-down.
    member _.LevelDigests : MerkleHash array array = levels

    /// Inclusion (audit) proof for the leaf at `index`: the sibling digest at
    /// each level from leaf to root, with its side. A verifier holding only the
    /// leaf, this proof, and the root can confirm membership without the tree
    /// (see `MerkleTree.verifyProof`). Replays the exact fold (duplicate-last on
    /// an odd trailing node → sibling is self, on the right). Raises on a
    /// leaf-index out of range.
    member _.Proof(index: int) : MerkleProofStep array =
        if index < 0 || index >= level0.Length then
            invalidArg (nameof index) $"leaf index {index} out of range [0, {level0.Length})"
        let steps = ResizeArray<MerkleProofStep>()
        let mutable idx = index
        // Walk levels[0 .. n-2]; the last level is the root (no sibling).
        for lvl in 0 .. levels.Length - 2 do
            let cur = levels.[lvl]
            let selfIsLeft = idx % 2 = 0
            let siblingIdx =
                if selfIsLeft then (if idx + 1 < cur.Length then idx + 1 else idx) else idx - 1
            steps.Add({ Sibling = cur.[siblingIdx]; SiblingOnRight = selfIsLeft })
            idx <- idx / 2
        steps.ToArray()


[<RequireQualifiedAccess>]
[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module MerkleTree =

    /// Verify an inclusion proof: re-hash `leaf`, fold the audit `steps` up,
    /// and check the result equals `expectedRoot`. Touches ONLY the leaf, the
    /// proof, and the root — never the tree (the third-party property). A
    /// tampered leaf, a corrupted step, or the wrong root all fail. The fold
    /// matches `MerkleTree.Proof` + `MerkleHash.combine` byte-for-byte, so the
    /// same `(leaf, steps, root)` verifies identically in the C#/Rust/TS oracles.
    let verifyProof (leaf: byte array) (steps: MerkleProofStep array) (expectedRoot: MerkleHash) : bool =
        let mutable acc = MerkleHash.ofBytes (ReadOnlySpan<byte> leaf)
        for step in steps do
            acc <-
                if step.SiblingOnRight then MerkleHash.combine acc step.Sibling
                else MerkleHash.combine step.Sibling acc
        acc.Equals expectedRoot

    /// Combine `FastCdc` + `MerkleTree` into a single call — chunk a
    /// byte stream by content-defined boundaries then build a tree
    /// over the chunks. The result pairs incremental delta
    /// transmission (pass only changed chunks) with integrity
    /// verification (root digest).
    let ofStream (bytes: byte array) : MerkleTree =
        let chunks = FastCdc.chunkAll bytes
        MerkleTree chunks
