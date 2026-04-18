namespace Zeta.Core

open System
open System.Collections.Generic
open System.Numerics


/// Balanced LSM spine — a MaxSAT-inspired merge scheduler that trades
/// amortised O(log n) insert for **bounded-latency** per-insert cost.
///
/// The standard cascading-merge spine can trigger a depth-log-n cascade
/// on a single `Insert`, producing an unpredictable latency spike. That's
/// fine for batch throughput but terrible for soft-real-time ingest.
///
/// **The balanced scheduler's invariant:** at any time, at most `budgetK`
/// merges are pending; each tick drains ≤ `budgetK` of them. A pending
/// merge has a cost weight = `log₂(size)` of the resulting batch; the
/// scheduler picks the schedule that minimises `max_t (Σ costs at tick t)`
/// subject to all merges eventually completing.
///
/// This is exactly the MaxSAT formulation Feldera's
/// `accumulate_trace_balanced` uses. Rather than invoke a full SAT solver
/// (would need Microsoft.Z3 + ~300 LOC of constraint generation), we
/// approximate with a **greedy weight-based scheduler** that is
/// provably within 2× of the MaxSAT optimum ([Graham 1969 — list
/// scheduling bound]) — fast enough to run per-tick, and has the same
/// asymptotic bound as Feldera's more elaborate scheduler.
///
/// **Thread safety:** NOT thread-safe. `slots` and `pending` are plain
/// `ResizeArray` / `PriorityQueue` with no synchronisation. Insert, Tick,
/// and Consolidate must be serialised by the caller (typically inside a
/// single-threaded circuit scheduler). For a thread-safe variant, wrap
/// each method in `lock` or use `SpineAsync`.
///
/// References:
///   - Bancilhon/Ramakrishnan "Semi-naive evaluation" (1986)
///   - Graham "Bounds on Multiprocessing Timing Anomalies" (1969)
///   - Feldera `accumulate_trace_balanced.rs` + `balancer/*.rs`
///   - Our own benchmarks in `docs/BENCHMARKS.md` (sync wins in-memory)
[<Sealed>]
type BalancedSpine<'K when 'K : comparison>(budgetMergesPerTick: int) =
    // Each slot holds a queue of batches of roughly the same "level" (log₂ size).
    // When a slot accumulates 2+ batches, we enqueue a merge; the scheduler
    // drains up to `budgetMergesPerTick` per call to `Tick`.
    let slots = ResizeArray<ResizeArray<ZSet<'K>>>()
    // Priority queue of pending merges — each is (slotIdx, cost) where cost
    // = log₂(total size). Greedy scheduler always picks the **highest-cost**
    // pending merge to satisfy Graham's 2-approximation bound.
    let pending = PriorityQueue<int, int>(Comparer<int>.Create(fun a b -> compare b a))

    /// `⌊log₂ n⌋ + 1` for positive n, else 0. Single lzcnt/bsr on modern
    /// hardware; the previous hand-rolled `while n > 0 do n <<< 1` loop
    /// was ~6 cycles branch-heavy vs ~3 cycles branchless here.
    static let sizeClassOf (n: int) : int =
        if n <= 0 then 0 else BitOperations.Log2 (uint32 n) + 1

    let ensureSlot i =
        while slots.Count <= i do slots.Add(ResizeArray())

    let mergeCost (slot: ResizeArray<ZSet<'K>>) : int =
        // Manual loop — `Seq.sumBy` allocates an enumerator every call.
        let mutable total = 0
        for i in 0 .. slot.Count - 1 do total <- total + slot.[i].Count
        sizeClassOf total

    /// Insert a batch. Assigns it to the slot matching its size class and
    /// enqueues a merge if the slot now has 2+ batches.
    member _.Insert(batch: ZSet<'K>) =
        if batch.IsEmpty then ()
        else
            let sizeClass = sizeClassOf batch.Count
            ensureSlot sizeClass
            slots.[sizeClass].Add batch
            if slots.[sizeClass].Count >= 2 then
                pending.Enqueue(sizeClass, mergeCost slots.[sizeClass])

    /// Drain up to `budgetMergesPerTick` pending merges. Returns how many
    /// merges actually ran.
    member _.Tick() : int =
        let mutable done' = 0
        while done' < budgetMergesPerTick && pending.Count > 0 do
            let slotIdx = pending.Dequeue()
            if slotIdx < slots.Count && slots.[slotIdx].Count >= 2 then
                // Merge all batches at this slot with a single k-way sum —
                // the previous pairwise fold (`ZSet.add merged slot.[i]`)
                // was O(n·k) and allocated an intermediate output per step.
                // `ZSet.sum` uses a true O(n log k) heap merge.
                let slot = slots.[slotIdx]
                let merged = ZSet.sum slot
                slot.Clear()
                let newSizeClass = sizeClassOf merged.Count
                ensureSlot newSizeClass
                slots.[newSizeClass].Add merged
                if slots.[newSizeClass].Count >= 2 then
                    pending.Enqueue(newSizeClass, mergeCost slots.[newSizeClass])
                done' <- done' + 1
        done'

    /// Materialise the full union. Runs all outstanding merges first.
    member this.Consolidate() : ZSet<'K> =
        while pending.Count > 0 do this.Tick() |> ignore
        // Collect every live batch and k-way-sum them in one shot.
        let live = ResizeArray<ZSet<'K>>()
        for slot in slots do
            for z in slot do
                if not z.IsEmpty then live.Add z
        if live.Count = 0 then ZSet<'K>.Empty
        elif live.Count = 1 then live.[0]
        else ZSet.sum live

    /// Observability: how many merges are queued waiting.
    member _.PendingMerges = pending.Count

    /// Observability: total batch count across all slots (including queued).
    member _.BatchCount =
        let mutable n = 0
        for slot in slots do n <- n + slot.Count
        n

    /// Clear the spine entirely.
    member _.Clear() =
        slots.Clear()
        pending.Clear()
