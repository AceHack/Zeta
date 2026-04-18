# Lock Inventory

Every synchronisation primitive in `src/Dbsp.Core/`, the reason it's
there, and whether a lock-free alternative exists / has been tried.

If you add a lock, add a row here. If you convert a lock to CAS,
flip the row's status.

## Status legend
- **🔒 locked** — `lock obj` or `SemaphoreSlim` in place
- **⚛️ CAS** — `Interlocked.CompareExchange` / `Volatile.Read/Write`
- **🚦 channel** — lock-free via `Channels` / `ConcurrentQueue`
- **☘️ local** — hot-loop internal to a single-threaded scheduler;
  not truly shared

## Inventory

| File:Line | Primitive | Guards | Status | Lock-free alternative considered? | Why still a lock |
|---|---|---|---|---|---|
| `Circuit.fs:~60` | `registerLock` (obj) | `ops`, `schedule`, `strictOps`, `built`, `anyAsync` | 🔒 locked | **Yes — designed in round-17 ADR, rejected for now.** Full CAS-on-record design captured in `docs/DECISIONS/2026-04-17-lock-free-circuit-register.md`. Correct but O(n) allocations per Register (vs O(1) amortised `ResizeArray.Add`). Revisit criteria documented in the ADR. | Registration is a one-shot init phase, lock cost is amortised, and the scheduler is single-threaded so contention is theoretical |
| `Circuit.fs tick` | `[<VolatileField>] tick` + `Interlocked.Increment` | tick counter | ⚛️ CAS | — already lock-free | — |
| `Recursive.fs:~40` | `[<VolatileField>] connected` + `Interlocked.CompareExchange` | `FeedbackOp.Connect` exactly-once | ⚛️ CAS | — fixed this pattern | — |
| `Transaction.fs stateLock` | `obj` | `state`, `pending`, `autoCommit` triple | 🔒 locked | **Yes — designed CAS-on-record.** `{State; Pending; AutoCommit}` boxed record + `Interlocked.CompareExchange` on the reference. Retry loop on conflict. Captured as BACKLOG P2. | Needs a retry-bound design + tests first |
| `ChaosEnv.fs lockObj` | `obj` | RNG state + clock pair must advance atomically | 🔒 locked | No — by construction the `splitMix + AdvanceTime` pair is non-atomic without a lock. `Interlocked` can't make two non-contiguous variables move together. | Required for seeded replay determinism |
| `DiskSpine.fs hotLock` | `obj` | `hot` (Dict), `paths` (Dict), `heapBytes`, `nextId` | 🔒 locked | **Stripe proposal exists.** A review agent flagged `ConcurrentDictionary<int64, ZSet>` + `ConcurrentDictionary<int64, string>` + `Interlocked.Add &heapBytes`. Eviction still needs a lock but path-sizing is the common path. BACKLOG P1. | Partial: the eviction critical section genuinely serial-izes; other metadata can be lock-free |
| `SpineAsync.fs spineLock` | `obj` | worker write / consumer read of the async spine | 🔒 locked | **Partial.** `Depth`/`Count` reads could use `Volatile.Read` on an immutable `Spine.Snapshot` record published after each merge. Full CAS-on-record P2. | Writer path still needs mutual-exclusion over PQ + slots |
| `RecordingMetricsSink` | `lockObj` | `rowsIn`/`rowsOut` dicts | 🔒 locked | **Yes.** `ConcurrentDictionary<string, int64>` + `Interlocked.Add` closes the lock. BACKLOG P1. | Easy win, just hasn't shipped |
| `MailboxRuntime.fs` | `MailboxProcessor<'T>` internal mutex | actor inbox | 🚦 channel | — Mailbox IS the channel | — |
| `WorkStealingRuntime.fs` | TPL `ActionBlock` bounded queue | per-shard inbox | 🚦 channel | — ActionBlock IS the channel | — |
| `SpeculativeWatermark.fs lockObj` | `obj` | `speculative` Dict (late-arrival map) | 🔒 locked | **Maybe.** Dict is per-operator; Circuit is single-stepper so this lock is largely redundant. Should document `[<NotThreadSafe>]` and drop lock. BACKLOG P2. | Defensive against callers that spawn background tasks |
| `ZSetInputOp pending` | `ConcurrentQueue<ZSet>` | pending-send queue | 🚦 channel | — already lock-free | — |
| `Upsert.fs` live dict | `ConcurrentDictionary` | live tombstones | 🚦 channel | — already lock-free | — |
| `Shard.Salt` | per-process random `uint32` | HashDoS seed | ☘️ local | Initialised once at first access; no contention | — |
| `InfoTheoreticSharder` | `shardLoads: int64 array` | load prediction | 🔒 **missing** | **Bug found by harsh-critic #22.** No `Interlocked.Add`, no lock. Two concurrent Picks race. **BACKLOG P0** to fix. | — (bug) |

## Philosophy

We prefer lock-free primitives when they measurably win AND don't
introduce new correctness hazards. A lock is fine if:

1. The critical section is short (< 1 μs under contention)
2. The happy path is uncontended (single scheduler + occasional reader)
3. The CAS alternative would require a retry loop with no provable bound
4. A lock-free version would require a persistent data structure
   that allocates on every update (defeats the zero-alloc goal)

Locks we **will** replace with CAS:
- `DiskSpine hotLock` metadata paths (separate per-key CAS)
- `Transaction stateLock` (CAS-on-record)
- `RecordingMetricsSink` (ConcurrentDictionary)
- `InfoTheoreticSharder.shardLoads` (Interlocked.Add)

Locks we **won't** remove:
- `ChaosEnv lockObj` — atomicity of RNG+clock pair is correctness-
  critical; no lock-free alternative exists
- `Circuit registerLock` — one-shot init phase; lock cost amortised

## Open questions

- Is `ReaderWriterLockSlim` worth it anywhere? Measurements would say.
- Should we adopt `System.Threading.Lock` (.NET 9) everywhere? It's
  used in `Circuit.fs` and `SpineAsync.fs`; mixing `Lock` and `obj`
  is confusing.
- Persistent data structures (FSharpx immutable maps) for the `hot`
  dict? Tradeoff: every update allocates; but every read is CAS-free.
