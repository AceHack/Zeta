# FoundationDB + Deterministic Simulation Testing — What We Borrow

FoundationDB's killer non-feature is **DST — Deterministic Simulation
Testing** (Will Wilson's talk at Strange Loop 2014 is the canonical
reference). Every async operation — disk I/O, network, timers, locks,
random numbers — goes through an **abstract event system** the test
harness can mock out, re-order, delay, fail, and rewind from a single
seed. Runs are **bit-for-bit reproducible**. FoundationDB used this
to hit production without a traditional integration suite.

## What we already have

- **`ChaosEnvironment`** (`src/Dbsp.Core/ChaosEnv.fs`) — seed-driven
  simulation environment with `DelayJitter`, `ClockSkew`, `RngStall`,
  `TimeReversal` policies. `splitMix + AdvanceTime` are now atomic
  under the same lock so replays are deterministic across threads.
- **`ISimulationEnvironment`** interface — operators and runtime
  consult this for time, RNG, delays. Swap it out = get simulation.
- **`VirtualTimeScheduler`** (`tests/ConcurrencyHarness.fs`) — Rx-
  inspired manual-clock scheduler. Schedule at virtual timestamp,
  `AdvanceBy(ticks)` fires everything up to that point.
- **TLA+ + Z3 + FsCheck** — three layers of formal / property-based
  verification for the algebraic axioms.

## What FoundationDB's DST has that we don't

1. **Network event interception.** Every message send, every socket
   read/write, every connection open/close is recorded by the
   simulator. The test can reorder messages, delay them, drop them,
   duplicate them, deliver them out of order. **We only have this
   for intra-process work.** A distributed DBSP harness needs this.
2. **Disk I/O interception.** Every write becomes a recorded event;
   the simulator can reorder flushes, crash in the middle of a
   write, corrupt on-disk state. **Our `DiskBackingStore` doesn't
   go through a simulator interface.**
3. **Deterministic scheduler at the Task level.** FDB's `flow`
   library wraps every actor so the simulator picks the interleaving
   deterministically. .NET's TPL scheduler is our equivalent; we
   don't (yet) intercept all `Task.Run` calls.
4. **Buggify.** Probabilistic fault injection at every known-risky
   code path. FDB's `BUGGIFY()` macros literally say "under test,
   randomly make this branch fail". Our `ChaosPolicy` flags are the
   kernel of this but sparser.
5. **Swarm testing.** FDB runs millions of seeded replays concurrently
   in the cloud. Every failure shrinks down to the triggering seed.
   We have the shrinker (FsCheck) but no swarm runner.

## Combining DST with the Rx-style `VirtualTimeScheduler`

**Yes, worth combining.** They're two halves of the same idea:
- `VirtualTimeScheduler` controls **when** async operations fire
- `ChaosEnvironment` controls **what** I/O / RNG / clock values are
  returned

The unified design:

```fsharp
type ISimulationDriver =
    inherit ISimulationEnvironment
    /// Virtual-time scheduler surface for async continuations.
    abstract Scheduler : VirtualTimeScheduler
    /// Intercepted file system — every Read/Write goes through here.
    abstract FileSystem : ISimulatedFs
    /// Intercepted network — every send/receive goes through here.
    abstract Network : ISimulatedNetwork
    /// Deterministic `Task.Run` equivalent — queues into the scheduler.
    abstract RunAsync : Func<unit, Task> -> Task
```

With this, a test looks like:

```fsharp
let driver = SimulationDriver(seed = 42, policy = ChaosPolicy.Maximal)
let circuit = Circuit.createWith driver
// Kick off 1000 concurrent Send + StepAsync + Commit events.
for i in 0 .. 999 do driver.RunAsync(fun () -> ...)
// Advance virtual time; fires everything deterministically.
driver.Scheduler.AdvanceToEnd()
// Assert invariants hold.
```

**Orthogonality vs. integration:** today `VirtualTimeScheduler` lives
in tests, `ChaosEnvironment` in core. Promoting scheduler to core +
combining into `ISimulationDriver` is the right unification — flagged
**P1** in roadmap.

## What else is worth borrowing from FoundationDB

- **`flow` actor model** — FDB's macro-generated actors that suspend
  on every I/O call. .NET's `async` / `Task` continuations are the
  equivalent; we'd bolt the simulator onto the `TaskScheduler`.
- **`Error` is a first-class return type** — not an exception. FDB's
  `Future<T>` can hold `Error(code)` without throwing. Matches our
  `Result<T, DbspError>` + `AppendResult` conventions.
- **`Role` discovery + failure propagation** — when we go multi-node,
  steal the role-based service-discovery model (Tlog, Storage,
  Resolver) rather than a monolithic node.
- **Serializable isolation via MVCC** — FDB's secret sauce. Our
  `TransactionZ1` is a single-stream analogue; the multi-stream
  MVCC version is P2.

## Roadmap slot

**P1 (next 2 weeks):**
- Promote `VirtualTimeScheduler` to `src/Dbsp.Core/Simulation.fs`
- Define `ISimulationDriver` with `Scheduler + FileSystem + Network`
- Wire `DiskBackingStore` through `ISimulatedFs`
- One end-to-end simulation test that runs 1000 randomised scenarios
  with the same seed and produces identical output

**P2:**
- `ISimulatedNetwork` for the future multi-node wire
- `Buggify`-style probabilistic fault injection macros
- Swarm runner (GitHub Actions matrix × 100 seeds)

**Publication target:** the combined DST + retraction-native
watermark story is publishable at DEBS or OSDI 2026 — "Retraction-
Native Deterministic Simulation Testing for Incremental View
Maintenance" — the claim being that DBSP's retraction algebra makes
fault-injection tests more expressive than FDB's mutation-only
model.
