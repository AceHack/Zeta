namespace Zeta.Core

open System
open System.Runtime.CompilerServices


/// Consistent-hashing strategies for shard assignment. The default
/// `Shard.fastrange` is uniform but **not consistent**: adding a single
/// shard remaps 100% of keys. These algorithms keep the remap set to
/// ~1/N on elastic rescale.
///
/// ## Which to pick
///   - `Jump` (Lamping & Veach 2014) — best fit when buckets are
///     contiguous integers `[0, N)` and you never remove. Zero memory,
///     O(log N) lookup, 1/N optimal rebalance.
///   - `Rendezvous` (HRW, Thaler 1998) — best when buckets are named
///     (host-id, pod-id); easy, arbitrary bucket IDs; still O(log N)
///     with a skeleton tree.
///   - `Memento` (2023) — when you need both elasticity **and** bucket
///     removal; Pareto-dominant for dynamic pools.
///
/// References:
///   - Lamping, Veach. "A Fast, Minimal Memory, Consistent Hash
///     Algorithm". arXiv:1406.2294 (2014).
///   - Thaler, Ravishankar. "A Name-Based Mapping Scheme for
///     Rendezvous". Univ. of Michigan, 1996.
///   - Coluzzi et al. "MementoHash". IEEE TON 2024.
///   - Mendelson et al. "Anchor Hashing". 2020.


/// The canonical consistent-hashing interface. Covariant position on
/// the key type is impossible (we receive keys, not emit them), so it
/// stays invariant.
type IConsistentHash =
    /// Pick a bucket index in `[0, bucketCount)` for `key`.
    abstract Pick: key: uint64 * bucketCount: int -> int


/// **Jump consistent hash** (Lamping & Veach 2014) — 6 lines, zero
/// memory, optimal 1/N rebalance on `bucketCount` change. Requires
/// buckets to be contiguous integers `[0, N)`; doesn't support
/// removal (use MementoHash when workers can fail).
[<Sealed>]
type JumpConsistentHash() =

    /// Classic xorshift-LCG-PRNG from the paper. Kept as `static` so
    /// the JIT can inline it at call sites.
    [<MethodImpl(MethodImplOptions.AggressiveInlining)>]
    static member Pick(key: uint64, buckets: int) : int =
        if buckets <= 0 then invalidArg (nameof buckets) "must be positive"
        let mutable k = key
        let mutable b = -1L
        let mutable j = 0L
        while j < int64 buckets do
            b <- j
            k <- k * 2862933555777941757UL + 1UL
            j <- int64 (float (b + 1L) *
                        (double (1L <<< 31) / double ((k >>> 33) + 1UL)))
        int b

    interface IConsistentHash with
        [<MethodImpl(MethodImplOptions.AggressiveInlining)>]
        member _.Pick(key, buckets) = JumpConsistentHash.Pick(key, buckets)


/// **Rendezvous / HRW hashing** (Thaler & Ravishankar 1998) — score
/// each bucket by `hash(key ⊕ bucketSeed)`, pick the argmax. O(N) per
/// lookup in the naive form; gives arbitrary named buckets and
/// optimal 1/N rebalance. For N ≤ 64 it's the simplest choice.
[<Sealed>]
type RendezvousHash(bucketSeeds: uint64 array) =

    [<MethodImpl(MethodImplOptions.AggressiveInlining)>]
    static member private Mix(a: uint64, b: uint64) : uint64 =
        // SplitMix64 of (a xor b) — good enough for HRW scoring.
        // See `src/Core/SplitMix64.fs` for the constant rationale.
        SplitMix64.mix (a ^^^ b)

    /// Pick a bucket by maximum-score-wins. O(bucketCount).
    member _.Pick(key: uint64) : int =
        let mutable bestScore = 0UL
        let mutable bestIdx = 0
        for i in 0 .. bucketSeeds.Length - 1 do
            let score = RendezvousHash.Mix(key, bucketSeeds.[i])
            if score > bestScore then
                bestScore <- score
                bestIdx <- i
        bestIdx

    /// Convenience constructor with deterministic per-slot seeds.
    static member Create(bucketCount: int) : RendezvousHash =
        let seeds =
            Array.init bucketCount (fun i ->
                let mutable z = uint64 i * 0x9E3779B97F4A7C15UL
                z <- (z ^^^ (z >>> 30)) * 0xBF58476D1CE4E5B9UL
                z <- (z ^^^ (z >>> 27)) * 0x94D049BB133111EBUL
                z ^^^ (z >>> 31))
        RendezvousHash seeds

    interface IConsistentHash with
        [<MethodImpl(MethodImplOptions.AggressiveInlining)>]
        member this.Pick(key, buckets) =
            if buckets <> bucketSeeds.Length then
                invalidArg (nameof buckets) "bucket count must match RendezvousHash slot count"
            this.Pick key


/// **MementoHash** (Coluzzi et al., IEEE TON 2024, arXiv:2306.09783) —
/// the current Pareto-dominant consistent hash for **elastic**
/// bucket sets (supports removal, not just growth). Reduces to Jump
/// in the no-failures common case — zero overhead on the hot path —
/// and degrades gracefully as buckets are removed, with memory
/// proportional to **actual failures** rather than capacity.
///
/// Algorithm sketch:
///   - Keep `n` = current bucket count, `replaced: Dict<int, struct (int, int)>`
///     mapping removed-bucket-id → (workingBucketCount-at-time-of-removal,
///     previously-removed-id). `lastRemoved` threads the most-recent
///     removal for O(1) Add/Remove.
///   - `Pick(key)`: Jump-hash into `[0, n)`. If that bucket is in
///     `replaced`, we chase the replacement chain — hashing `(key ^ b)`
///     into `[0, workingBucketCount)` and following replaced entries
///     whose `replacing ≥ workingBucketCount` (they were removed
///     AFTER `b`). Worst-case O(ln n · ln(n/w)), best-case O(ln n).
/// **Thread safety:** NOT thread-safe. `replaced` Dictionary and the
/// `bucketCount` / `lastRemoved` mutable fields are updated in place
/// on every `Add` / `Remove`. If you share a `MementoHash` across
/// worker threads, wrap it in a `ReaderWriterLockSlim` — `Pick` is
/// read-only; `Add`/`Remove` are writes.
[<Sealed>]
type MementoHash() =
    let replaced = System.Collections.Generic.Dictionary<int, struct (int * int)>()
    let mutable bucketCount = 0
    let mutable lastRemoved = -1

    /// Grow — allocate a new bucket, reusing a previously-removed slot
    /// if available. Returns the bucket id.
    member _.Add() : int =
        if replaced.Count = 0 then
            let id = bucketCount
            bucketCount <- bucketCount + 1
            id
        else
            let id = lastRemoved
            let struct (_, prev) = replaced.[id]
            replaced.Remove id |> ignore
            lastRemoved <- prev
            id

    /// Shrink — mark bucket `b` as removed. The most-recent-removed
    /// tail pops for free (LIFO fast path); otherwise we book-keep.
    member _.Remove(b: int) : unit =
        let workingCount = bucketCount - replaced.Count
        if b = bucketCount - 1 && replaced.Count = 0 then
            bucketCount <- bucketCount - 1
        else
            replaced.[b] <- struct (workingCount - 1, lastRemoved)
            lastRemoved <- b

    /// Pick a bucket for `key`. O(ln n) amortised.
    member _.Pick(key: uint64) : int =
        if bucketCount = 0 then -1
        else
            let mutable b = JumpConsistentHash.Pick(key, bucketCount)
            // Chase the replacement chain.
            let mutable continueLoop = true
            while continueLoop do
                let mutable entry = struct (0, 0)
                if replaced.TryGetValue(b, &entry) then
                    let struct (workingCount, _) = entry
                    // Hash `(key ⊕ b)` into `[0, workingCount)` using a
                    // SplitMix64 mixer — the paper's standard choice.
                    let mutable z = (key ^^^ uint64 b) * 0x9E3779B97F4A7C15UL
                    z <- (z ^^^ (z >>> 30)) * 0xBF58476D1CE4E5B9UL
                    z <- (z ^^^ (z >>> 27)) * 0x94D049BB133111EBUL
                    z <- z ^^^ (z >>> 31)
                    let mutable d = int ((uint64 (uint32 z) * uint64 (uint32 workingCount)) >>> 32)
                    // Follow chains of subsequently-removed buckets.
                    let mutable entry2 = struct (0, 0)
                    while replaced.TryGetValue(d, &entry2)
                          && (let struct (u, _) = entry2 in u >= workingCount) do
                        let struct (u, _) = entry2
                        d <- u
                    b <- d
                else
                    continueLoop <- false
            b

    member _.BucketCount = bucketCount
    member _.RemovedCount = replaced.Count

    interface IConsistentHash with
        member this.Pick(key, buckets) =
            if buckets <> bucketCount then
                invalidArg (nameof buckets) "MementoHash bucket count must match internal state; use Add/Remove to change"
            this.Pick key


/// Convenience module so callers can pick an algorithm without newing.
[<RequireQualifiedAccess>]
[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module ConsistentHash =

    /// Default — Jump, contiguous integer buckets.
    let jump : IConsistentHash = JumpConsistentHash() :> _

    /// Rendezvous for `n` slots.
    let rendezvous (n: int) : IConsistentHash = RendezvousHash.Create n :> _

    /// Measure rebalance churn: fraction of keys that move when the
    /// bucket count grows from `n1` to `n2`. Useful for tests asserting
    /// the algorithm behaves consistently.
    let rebalanceChurn (h: IConsistentHash) (keys: uint64 seq) (n1: int) (n2: int) : double =
        let mutable moved = 0
        let mutable total = 0
        for k in keys do
            total <- total + 1
            if h.Pick(k, n1) <> h.Pick(k, n2) then moved <- moved + 1
        if total = 0 then 0.0 else double moved / double total
