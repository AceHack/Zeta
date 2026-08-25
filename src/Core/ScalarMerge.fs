namespace Zeta.Core

open System


/// Scalar merge of two sorted `int64` Z-set runs.
///
/// **This file was named `SimdMerge.fs` and claimed to be vectorised. It never
/// was.** The header asserted AVX2/NEON/AVX-512 loads, "branchless compare +
/// conditional select", and masked stores; the body contained no vector
/// instruction of any kind. `Vector<int64>.Count` appeared only as a loop
/// chunk size and `Vector.IsHardwareAccelerated` only as a guard around a
/// second *scalar* loop. It also cited, as its correctness evidence, a fuzz
/// test named `FuzzTests."fuzz: SIMD merge matches scalar"` — which does not
/// exist anywhere in the repository. The file has been renamed and the claims
/// struck rather than "fixed" by deleting the header, because a misleading
/// *name* outlives a misleading comment.
///
/// **Why it was not repaired into real SIMD instead.** A sorted merge is
/// data-dependent: the next output element is chosen by a comparison whose
/// result decides which side advances, so there is no fixed-stride lane
/// mapping to vectorise. The known vectorised merges (bitonic merge networks,
/// Inoue & Taura's AA-Sort merge) require either a full sorting network or a
/// shuffle-based permute step, and both want the keys in a *contiguous* lane —
/// which `ZEntry<int64>` (array-of-structs: `[Key][Weight]` interleaved)
/// cannot provide without a strided gather. That AoS blocker is the same one
/// `ZSet.weightedCount` documents. Real vectorisation therefore lives on the
/// columnar (struct-of-arrays) side — see `ColumnZSet.fs`, where the keys are
/// a contiguous `int64` column and the vector path is measured, not asserted.
///
/// Register: `unmetered`. Both members are correct and covered by equivalence
/// tests; no benchmark distinguishes them, and neither has a production caller
/// (`ZSet.(+)` merges through `MergeKernel.fs`).
[<AbstractClass; Sealed>]
type ScalarMerge =

    /// Window used by `MergeBlockwise` when scanning ahead for a run that can
    /// be bulk-copied. Fixed at 4. It was previously `Vector<int64>.Count`,
    /// which varied 2–8 across platforms for no algorithmic reason — the
    /// algorithm is scalar, so the window is just a lookahead depth.
    /// `unmetered`: no benchmark distinguishes any particular value.
    static let BlockWidth = 4

    /// Straight two-pointer merge-sum, specialised to `ZSet<int64>` so the key
    /// comparison is a single machine instruction. Identical output to
    /// `ZSet.add`. Returns the number of entries written to `output`.
    static member MergeTwoPointer
        (a: ReadOnlySpan<ZEntry<int64>>,
         b: ReadOnlySpan<ZEntry<int64>>,
         output: Span<ZEntry<int64>>) : int =
        let mutable i = 0
        let mutable j = 0
        let mutable k = 0
        while i < a.Length && j < b.Length do
            let ka = a.[i].Key
            let kb = b.[j].Key
            if ka < kb then
                output.[k] <- a.[i]; i <- i + 1; k <- k + 1
            elif ka > kb then
                output.[k] <- b.[j]; j <- j + 1; k <- k + 1
            else
                // Checked — see rationale in ZSet.fs:add. Overflow on a
                // weight sum is silent corruption; we want a noisy crash.
                let s = Checked.(+) a.[i].Weight b.[j].Weight
                if s <> 0L then
                    output.[k] <- ZEntry(ka, s); k <- k + 1
                i <- i + 1; j <- j + 1
        while i < a.Length do output.[k] <- a.[i]; i <- i + 1; k <- k + 1
        while j < b.Length do output.[k] <- b.[j]; j <- j + 1; k <- k + 1
        k

    /// Same result as `MergeTwoPointer`, reached by scanning up to
    /// `BlockWidth` elements ahead for a run of keys that are all strictly
    /// below the other side's front, then bulk-copying that run with
    /// `Span.CopyTo` (a `memmove`) instead of element-by-element. Still fully
    /// scalar. Falls back to `MergeTwoPointer` when either side is too short
    /// for the lookahead to pay, and always finishes on the two-pointer tail.
    static member MergeBlockwise
        (a: ReadOnlySpan<ZEntry<int64>>,
         b: ReadOnlySpan<ZEntry<int64>>,
         output: Span<ZEntry<int64>>) : int =
        let w = BlockWidth
        if a.Length < w * 4 || b.Length < w * 4 then
            ScalarMerge.MergeTwoPointer(a, b, output)
        else
            let mutable i = 0
            let mutable j = 0
            let mutable k = 0
            while i + w <= a.Length && j + w <= b.Length do
                let firstB = b.[j].Key
                let firstA = a.[i].Key
                // Contiguous elements in a[i..] whose key < firstB.
                let mutable ia = 0
                while ia < w && a.[i + ia].Key < firstB do ia <- ia + 1
                // Contiguous elements in b[j..] whose key < firstA.
                let mutable jb = 0
                while jb < w && b.[j + jb].Key < firstA do jb <- jb + 1
                if ia > 0 then
                    a.Slice(i, ia).CopyTo(output.Slice(k, ia))
                    i <- i + ia
                    k <- k + ia
                elif jb > 0 then
                    b.Slice(j, jb).CopyTo(output.Slice(k, jb))
                    j <- j + jb
                    k <- k + jb
                else
                    // Tie or immediate interleave — advance one step scalar.
                    let ka = a.[i].Key
                    let kb = b.[j].Key
                    if ka = kb then
                        // Checked — see rationale in ZSet.fs:add.
                        let s = Checked.(+) a.[i].Weight b.[j].Weight
                        if s <> 0L then
                            output.[k] <- ZEntry(ka, s); k <- k + 1
                        i <- i + 1; j <- j + 1
                    elif ka < kb then
                        output.[k] <- a.[i]; i <- i + 1; k <- k + 1
                    else
                        output.[k] <- b.[j]; j <- j + 1; k <- k + 1
            // Tail.
            let tailCount =
                ScalarMerge.MergeTwoPointer(a.Slice i, b.Slice j, output.Slice k)
            k + tailCount
