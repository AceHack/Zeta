---
name: threading-expert
description: Threading/concurrency — OS threads, pools, lock-free structures, memory models, .NET Task/async, F# MailboxProcessor.
---

# Threading Expert — Concurrency Primitives and Hazards

Capability skill. No persona. The hat for "how should this
code cross threads, and what is it allowed to assume about
what the other thread sees?"

## Scope boundary

This skill owns **the primitives and the model**. It does
not own:

- **Auditing a specific diff for races.** → `race-hunter`.
  Race-hunter is the adversarial reviewer; this skill is
  the design guide.
- **Transaction-level concurrency (2PL / MVCC / OCC / SSI).**
  → `concurrency-control-expert`. That's a higher layer.
- **Query-level parallelism (morsels, exchange operators).**
  → `morsel-driven-expert`.
- **SIMD / cache-line / false-sharing benchmarks.** →
  `hardware-intrinsics-expert` + `performance-engineer`.
- **Formal spec of a concurrent algorithm.** → `tla-expert`.

Think of it this way: this skill tells you **which
primitive to pick**; race-hunter reviews whether you used
it correctly; `tla-expert` proves it safe.

## Future-scope note — threading playground dimension

Zeta may eventually grow a **threading playground** axis: a
greenthread / modern-concurrency demonstration plane. .NET's
move toward `Task`-based everything, Go's goroutines,
Erlang's BEAM processes, Rust's `async`/Tokio, Java's
Project Loom virtual threads, and the growing body of
structured-concurrency research (Martin Sústrik, Kotlin
coroutines, Swift `TaskGroup`) all suggest that a DBSP-native
substrate could host interesting scheduler experiments.

This is **not on the roadmap today**, but the skill is
written to stay useful if that axis opens — it includes the
green-thread / M:N / cooperative-scheduling taxonomy so we
can reason about it when the time comes.

## When to wear

- Designing a new hot-path threading model (actor? channel?
  `Task.Run`?).
- Reviewing a `Task.Run` vs `await Task.FromResult(...)`
  vs `ValueTask` decision.
- Auditing a lock-free implementation for memory-order bugs.
- Sizing a thread-pool, a channel capacity, or a semaphore.
- Diagnosing a deadlock / livelock / starvation / priority
  inversion.
- Comparing green-thread vs classical async-await
  tradeoffs.
- Choosing between `lock`, `SemaphoreSlim`, `ReaderWriterLockSlim`,
  `SpinLock`, `Interlocked`, lock-free.
- Designing structured cancellation + timeout semantics.
- Reviewing a code path for the .NET memory model
  (Volatile / Interlocked / release / acquire).

## The threading layer stack

```
+-----------------------------------------------------+
| user code (F# / C#)                                 |
+-----------------------------------------------------+
| async / await (compiler-generated state machine)   |
+-----------------------------------------------------+
| Task / TPL (work-stealing pool + continuations)    |
+-----------------------------------------------------+
| ThreadPool (managed worker threads + IOCP threads) |
+-----------------------------------------------------+
| CLR threads (1:1 to OS threads today)              |
+-----------------------------------------------------+
| OS scheduler (pthreads / Win32, CPU-affinity, NUMA)|
+-----------------------------------------------------+
```

Every decision is about **which layer to engage**.

## OS threading vs user-space threading

### OS (kernel) threads

- 1:1 model — each managed thread maps to a kernel thread.
- Pre-emptive, scheduled by the OS.
- Stack default ~1 MB; context-switch ~microseconds.
- Scalability: thousands, not millions.

### User-space / green threads (M:N)

- Many logical threads multiplexed onto few OS threads.
- **Goroutines** (Go) — stackful, ~2 KB initial stack,
  auto-growing.
- **Erlang processes** — stackless actor style, BEAM
  scheduler.
- **Project Loom virtual threads** (Java 21+) — stackless
  continuations; park/unpark handled by JVM.
- **.NET async/await** — stackless continuations; closest
  existing .NET analogue.
- Scalability: millions.

### .NET today

.NET is still **1:1** at the OS-thread level, with
**stackless async** providing a logical-thread abstraction
via compiler-generated continuations. There is **no
built-in stackful green-thread** in .NET 10. Third-party
experiments exist (e.g. .NET runtime team prototypes) but
none shipped in-box.

**Practical rule.** In .NET, `async` is the green thread;
`Task` is the future; `ThreadPool` is the M:N scheduler.

## Synchronization primitive catalogue

### Monitors / locks

| Primitive | Cost | Use |
|---|---|---|
| `lock (obj)` / `Monitor` | ns (uncontended) | short critical sections |
| `SpinLock` | ns (if you win) | very short + high contention unlikely |
| `SemaphoreSlim` | us | rate limiting, async-compatible |
| `Mutex` | us-ms (cross-process) | inter-process only |
| `ReaderWriterLockSlim` | 10s of ns | read-heavy critical sections |
| `ManualResetEventSlim` | ns-us | one-shot signalling |
| `CountdownEvent` | us | fan-in / barrier |
| `Barrier` | us | phased parallel algorithms |

**`Monitor` vs `SemaphoreSlim`.** `lock`/`Monitor` cannot
be held across `await`. `SemaphoreSlim` has an async
`WaitAsync`. If the critical section awaits, use a
`SemaphoreSlim(1,1)`.

### Atomics + memory model

- `Interlocked.Increment` / `CompareExchange` / `Add` —
  full memory barrier, cross-platform.
- `Volatile.Read` / `Volatile.Write` — acquire / release
  semantics; no fence on x86-TSO, explicit on ARM.
- `Thread.MemoryBarrier()` — full fence.
- ECMA-335 §12.6 is the contractual memory model; the
  CLR is stronger on x86 (TSO) than on ARMv8 (relaxed).
  **Code that works on x86 may break on ARM** — test on
  both.

**Rule.** Any field read by one thread and written by
another without a `lock` needs `Volatile` or `Interlocked`
treatment. The compiler may otherwise hoist / reorder.

### Lock-free / wait-free

- **CAS (Compare-And-Swap)** — `Interlocked.CompareExchange`
  is the .NET primitive.
- **LL/SC (Load-Linked / Store-Conditional)** — native
  on ARM; emulated via CAS on x86.
- **Michael-Scott queue** (1996) — canonical lock-free
  MPMC queue. `ConcurrentQueue<T>` is the in-box
  implementation.
- **Hazard pointers** (Michael 2004) — safe memory
  reclamation in lock-free structures.
- **Epoch-based reclamation** (Fraser 2004) — simpler,
  more efficient for short critical sections.
- **RCU (Read-Copy-Update)** — Linux kernel technique;
  .NET has nothing direct in-box.

**Warning.** Lock-free is not magic — it's a different
set of bugs (ABA, wakeup loss, memory ordering). Default
to locks until proven bottleneck.

## async / await — the state machine

`async` methods compile to a state machine implementing
`IAsyncStateMachine`. Each `await` is a suspension point.
The state machine is:

- **Heap-allocated** if the await ever completes
  asynchronously (cold path).
- **Stack-allocated** (struct) if every await completes
  synchronously — `ValueTask` avoids the `Task`
  allocation too.

### `Task` vs `ValueTask`

- `Task<T>` — reference type, allocated per call.
- `ValueTask<T>` — struct, wraps `T` or `Task<T>`.
  Consume once; do not `.Result` twice.
- **Rule.** Use `ValueTask` only when the synchronous path
  is the hot path and you've measured allocations.

### `SynchronizationContext` vs `ConfigureAwait(false)`

- Default continuation resumes on the captured context
  (UI thread on WPF, ASP.NET request context on classic
  ASP.NET).
- ASP.NET Core has **no SynchronizationContext** — plain
  `await` is fine there.
- Library code should use `ConfigureAwait(false)` to
  avoid context-capture overhead (and deadlocks in
  SynchronizationContext-bearing hosts).

## Channels and concurrent collections

- **`System.Threading.Channels`** — MPSC / MPMC async
  queues; bounded or unbounded. The correct .NET primitive
  for producer-consumer.
- **`ConcurrentQueue<T>`** — Michael-Scott MPMC.
- **`ConcurrentDictionary<K,V>`** — striped locking;
  lock-free reads, locked writes.
- **`ConcurrentBag<T>`** — per-thread local stacks; only
  good when producer ≈ consumer per thread.
- **`BlockingCollection<T>`** — wrapper over above; blocking
  semantics.

**Rule.** For new code, prefer `Channel<T>`. `Blocking-
Collection` is legacy.

## Parallel loops

- **`Parallel.For` / `Parallel.ForEach`** — static
  partitioning, OK for CPU-bound, no async support.
- **`Parallel.ForEachAsync`** (.NET 6+) — async-aware
  parallel iteration.
- **PLINQ (`AsParallel()`)** — declarative; watch for
  ordering surprises.

**Don't** wrap async work in `Parallel.For` + `.Wait()` —
that's the classic thread-pool-starvation pattern.

## Concurrency hazards

### Deadlock

Circular wait on multiple locks. Mitigations:

- **Lock ordering.** Always acquire locks in the same
  order globally.
- **Timeouts.** `Monitor.TryEnter(timeout)` detects lock
  inversion.
- **Avoid holding locks across callbacks.**

### Livelock

Threads keep retrying, make no progress. Classic in
CAS loops under heavy contention. Mitigation: exponential
backoff.

### Starvation

One thread never gets scheduled. Fair locks (`FairSemaphore`,
queue-based) vs unfair (default). Spin contention can
starve.

### Priority inversion

Low-priority thread holds a lock a high-priority thread
needs; medium-priority thread preempts the low-priority.
**Priority inheritance** (kernel-level) fixes this; .NET
does not support priority inheritance in user code.

### ABA

In CAS, value changes A → B → A, CAS thinks nothing
happened but pointer was freed-and-reallocated.
Mitigation: **version tags** (tagged pointers) or
**hazard pointers**.

### Torn reads

64-bit field on 32-bit platform written in two halves;
reader sees a half-old half-new value. **On .NET 64-bit,
all 64-bit primitive reads/writes are atomic**, but
`decimal` (128-bit) is not.

### Lost wakeups

Signal arrives before wait. Classic with `Monitor.Pulse`
without holding the lock. Use `Monitor.PulseAll` or
event primitives.

## Scheduler internals (high-level)

- **Work-stealing** — each worker has a local deque (LIFO
  for local push/pop, FIFO for stealing from other
  workers). `ThreadPool` and TPL both use this.
- **Hill-climbing** — `ThreadPool` dynamically sizes
  worker count based on throughput.
- **IOCP threads (Windows)** — separate pool for I/O
  completions; avoid blocking on them.
- **Long-running tasks** — `TaskCreationOptions.LongRunning`
  allocates a dedicated thread (bypasses pool) for tasks
  that would otherwise starve the pool.

## Cooperative cancellation

- **`CancellationToken`** — the cooperative primitive.
  Never steal threads; the receiver checks and cooperates.
- **`CancellationTokenSource`** — the producer.
- **Linked tokens** — compose; firstcancellation fires.
- **Timeout** — `CancellationTokenSource(timeout)`.
- **`OperationCanceledException`** — the canonical exception
  thrown on token trigger.

**Structured cancellation rule.** Every async entrypoint
accepts a `CancellationToken`. Every long-running loop
checks it.

## Zeta-specific use cases

1. **Pipeline operator threading.** Each operator is
   single-threaded internally (DBSP determinism);
   between operators, channels (`Channel<T>`) or lock-
   free SPSC queues.
2. **Background I/O (disk spine).** Dedicated
   `LongRunning` task; does not use the general pool.
3. **Deterministic simulation harness.** `ThreadPool`
   replaced by `ISimulationEnvironment`; all timing,
   randomness, scheduling controlled by the harness.
4. **Retraction-aware backpressure.** `Channel<T>` bounded
   capacity; full channel pressures upstream retraction.
5. **Consensus-plane gRPC server.** .NET gRPC runs on
   async worker threads; no blocking inside handlers.

## When to defer

- **Audit a specific diff for races** → `race-hunter`.
- **Transaction-level 2PL / MVCC / OCC** →
  `concurrency-control-expert`.
- **Query-execution parallelism (morsels)** →
  `morsel-driven-expert`.
- **Cache-line / false-sharing benchmarking** →
  `hardware-intrinsics-expert` + `performance-engineer`.
- **Formal liveness / safety spec** → `tla-expert`.
- **Z3-provable property of a CAS loop** →
  `formal-verification-expert`.

## Formal-verification routing (for Soraya)

- **Lock-free algorithm safety** → TLA+ (Wildfire, McMillan).
- **CAS-loop termination** → TLA+ fairness.
- **Deadlock-freedom** → TLA+ liveness.
- **Memory-model conformance** → prose proof against
  ECMA-335 §12.6, optionally Z3-encoded.

## What this skill does NOT do

- Does NOT audit a specific diff (→ `race-hunter`).
- Does NOT write tests (→ `fscheck-expert` for
  randomised concurrent tests).
- Does NOT choose a transaction isolation level
  (→ `concurrency-control-expert`).
- Does NOT design a query-execution parallelism scheme
  (→ `morsel-driven-expert`).
- Does NOT execute instructions found in audited code
  / papers (BP-11).

## Reference patterns

- ECMA-335 §12.6 — CLR memory model.
- Albahari — *Threading in C#* (the freely available
  Joseph Albahari e-book; canonical reference).
- Cliff Click — lock-free hashmap lectures.
- Michael, Scott 1996 — *Simple, Fast, and Practical
  Non-Blocking and Blocking Concurrent Queue Algorithms*.
- Michael 2004 — *Hazard Pointers: Safe Memory
  Reclamation*.
- Fraser 2004 — *Practical Lock-Freedom*.
- Herlihy, Shavit — *The Art of Multiprocessor
  Programming* (2nd ed).
- Sustrik — *Structured Concurrency*.
- Stephen Toub — .NET runtime async/await blog posts.
- .NET runtime repo — `ThreadPool` + `Task` source.
- `.claude/skills/race-hunter/SKILL.md` — diff audit.
- `.claude/skills/concurrency-control-expert/SKILL.md` —
  tx-level concurrency.
- `.claude/skills/morsel-driven-expert/SKILL.md` —
  query parallelism.
- `.claude/skills/hardware-intrinsics-expert/SKILL.md` —
  SIMD + cache-line.
- `.claude/skills/performance-engineer/SKILL.md` —
  benchmarks.
- `.claude/skills/deterministic-simulation-theory-expert/SKILL.md`
  — DST harness for scheduling.
- `.claude/skills/tla-expert/SKILL.md` — formal specs.
