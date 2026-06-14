namespace Zeta.Core

open System
open System.Collections.Concurrent
open System.Threading

/// **DeterministicSyncContext** — a single-threaded, pumpable `SynchronizationContext`
/// for Deterministic Simulation Testing of async code (Option-A increment 4b).
///
/// `Post` captures each continuation into a FIFO queue; **nothing runs ambiently**.
/// `PumpToIdle` runs the queued continuations in registration order until the queue
/// is empty (a continuation may post more — those run too). Because every `await`
/// under this context re-`Post`s its continuation here, an async workload launched
/// onto it advances **only** when pumped, in a fixed, seed-independent, replayable
/// order — so the same inputs replay to byte-identical results (FoundationDB-style
/// single-thread determinism; Zhou et al., SIGMOD 2021).
///
/// This is the deterministic implementation of the **noninterference door**
/// (manifesto §13 / discipline #7): scheduling entropy enters async code only
/// through this declared, metered channel — never the ambient threadpool. Inject it
/// where production injects nothing (e.g. `FerryThrottler`'s `?syncContext`) to make
/// the background path replayable without changing that path.
///
/// **Earned class** (per `interfaces-free-classes-earned-under-rules`): a class
/// carries state ⇒ weight, so it must be justified. The earning: this state (the
/// FIFO run-queue) **is** the simulated scheduler's queue — the very thing replay
/// reflects over. A pure interface cannot hold a mutable run-queue; the DST +
/// injected-`SynchronizationContext` boundary is the rule that earns it. It is a
/// sim/test primitive, not a production scheduler.
///
/// The continuation queue is **lock-free** (discipline #2): a `ConcurrentQueue<T>`
/// with `Interlocked` on the counter, since `Post` runs from arbitrary threads while
/// one thread pumps. No hand-rolled CAS class — the BCL queue is the earned-correct
/// implementation of the lock-free FIFO.
///
/// Prior art (Beacon): Stephen Cleary, *Nito.AsyncEx* `AsyncContext` (single-thread
/// pump-based `SynchronizationContext`); Stephen Toub, "await, SynchronizationContext,
/// and Console Apps" (the single-threaded-pump pattern); WPF/WinForms
/// `DispatcherSynchronizationContext` (the marshal-to-one-thread shape this mirrors
/// for determinism rather than UI affinity). Lock-free FIFO: Michael & Scott,
/// "Simple, Fast, and Practical Non-Blocking and Blocking Concurrent Queue
/// Algorithms" (PODC 1996) — the lineage `ConcurrentQueue<T>` implements. Human
/// anchor for the lock-free `ConcurrentQueue` + CAS approach: the maintainer's Itron
/// `Itron.Extensibility/AsyncCollection.cs` — a lock-free async producer/consumer
/// rendezvous (two `ConcurrentQueue`s coordinated by a speculative-CAS on a paired
/// count, `TrySpeculativeUpdate`; Stephen Toub's `AsyncProducerConsumerQueue`
/// lineage) — and `AtomicBoolean.cs` for the bare `Interlocked.CompareExchange`.
[<Sealed>]
type DeterministicSyncContext() =
    inherit SynchronizationContext()

    // Lock-free MPSC handoff: `Post` may enqueue from arbitrary threads while a
    // single thread pumps. `ConcurrentQueue<T>` is the BCL's lock-free queue
    // (segment-list CAS enqueue/dequeue, FIFO) — discipline #2 (lock/wait-free)
    // without a hand-rolled CAS class. `posted` is bumped with `Interlocked`, so the
    // whole context is lock-free.
    let queue = ConcurrentQueue<SendOrPostCallback * obj>()
    let mutable posted = 0

    /// Enqueue a continuation (FIFO). Lock-free + thread-safe: the workload's
    /// completions may fire from arbitrary threads (e.g. a channel write on the
    /// producer's thread), but they only *enqueue* here — the callback itself runs
    /// on the pump thread.
    override _.Post(d: SendOrPostCallback, state: obj) =
        Interlocked.Increment(&posted) |> ignore
        queue.Enqueue((d, state))

    /// Synchronous `Send` is unsupported: it would run a continuation off the pump
    /// thread, breaking the single-threaded determinism this context exists to give.
    override _.Send(_d: SendOrPostCallback, _state: obj) =
        raise (NotSupportedException("DeterministicSyncContext.Send breaks single-threaded determinism; use Post + PumpToIdle."))

    /// A captured copy must route to THIS queue, or continuations leak to a fresh
    /// (threadpool-backed) context and determinism is lost.
    override this.CreateCopy() = this :> SynchronizationContext

    /// Total continuations posted to this context over its lifetime — lets a test
    /// assert the workload's continuations routed through this door, not the threadpool.
    member _.PostedCount = Volatile.Read(&posted)

    /// Continuations currently queued and not yet run.
    member _.PendingCount = queue.Count

    /// Run queued continuations in registration (FIFO) order until none remain.
    /// Runs on the calling thread — that thread IS the deterministic single thread.
    ///
    /// Installs THIS context as the calling thread's current `SynchronizationContext`
    /// for the duration of the pump, then restores the previous one. Message-pump
    /// contract, two ways: (1) a continuation resumed here sees this context as
    /// current, so its *next* `await` re-captures it and stays on the deterministic
    /// thread (the replay chain holds); (2) the previous context is restored on exit,
    /// so the caller's own later awaits are NOT trapped in this (now-idle) context —
    /// the leak that would otherwise deadlock the caller.
    member this.PumpToIdle() =
        let previous = SynchronizationContext.Current
        SynchronizationContext.SetSynchronizationContext this

        // Tail-recursive drain — pumping is single-threaded, so no mutable sentinel
        // is needed (the recursion is the loop). `TryDequeue` is the lock-free
        // counterpart to `Post`'s lock-free `Enqueue`.
        let rec drain () =
            match queue.TryDequeue() with
            | true, (d, s) ->
                d.Invoke s
                drain ()
            | false, _ -> ()

        try
            drain ()
        finally
            SynchronizationContext.SetSynchronizationContext previous
