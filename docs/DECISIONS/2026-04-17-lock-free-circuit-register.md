# ADR: Lock-free `Circuit.Register` — attempted, rejected for now

**Date:** 2026-04-17 (round 17)
**Status:** *Decision: keep the lock; document the CAS design for future
revisit.*
**Owner:** storage-specialist (narrow) + complexity-reviewer
(wide).

## Context

`Circuit.Register<'O>` is the entry point for adding a new operator
to the DAG. Today it holds a `lock registerLock` while it appends to
a `ResizeArray<Op>`, sets `op.idField`, and maintains the
`anyAsync` flag. The round-16 review flagged this as the one place
in `Circuit.fs` that's still lock-based and asked: "can we go
lock-free via CAS-on-record?".

## The CAS design we sketched

```fsharp
type private RegisterState = { Ops: Op array; Sealed: bool }
let mutable state = { Ops = [||]; Sealed = false }

member _.Register<'O when 'O :> Op>(op: 'O) : 'O =
    let mutable spin = SpinWait()
    let mutable ok = false
    while not ok do
        let cur = Volatile.Read &state
        if cur.Sealed then invalidOp "Cannot add operators after Build"
        let newId = cur.Ops.Length
        op.idField <- newId                           // ← write before CAS
        let nxt = Array.zeroCreate (newId + 1)
        Array.Copy(cur.Ops, nxt, newId)
        nxt.[newId] <- op :> Op
        let repl = { Ops = nxt; Sealed = false }
        if obj.ReferenceEquals(Interlocked.CompareExchange(&state, repl, cur), cur) then
            if op.IsAsync then Volatile.Write(&anyAsync, true)
            ok <- true
        else
            spin.SpinOnce()
    op

member this.Build() =
    // Seal via CAS, then topo-sort after the seal-flip wins.
    let mutable ok = false
    while not ok do
        let cur = Volatile.Read &state
        if cur.Sealed then ok <- true
        else
            let repl = { cur with Sealed = true }
            if obj.ReferenceEquals(Interlocked.CompareExchange(&state, repl, cur), cur) then
                this.TopoSort repl.Ops
                built <- true
                ok <- true
```

**Why it's correct.**
- `op.idField` is written *before* the CAS, so any thread that reads
  `state` after the successful CAS sees a fully-initialised op.
  .NET's `Interlocked.CompareExchange` has `memory_order_seq_cst`
  semantics on all supported platforms.
- `Build` CAS-flips `Sealed` atomically; a Register that lost the
  race re-reads `state`, sees `Sealed = true`, throws.
- `anyAsync` is a `Volatile.Write` after the successful CAS —
  readers see it on subsequent `Volatile.Read`.

**Complexity.**
- Register: *O(n)* per call (full array copy) vs *O(1)* amortised
  for the current `ResizeArray.Add`. For a 1000-op circuit this is
  500× more allocations during construction.
- Build: unchanged (topo-sort dominates).

## Why we're not shipping it

1. **Register is not on the hot path.** It's called once per
   operator at construction, then never again. Current measured
   overhead: ~20 ns uncontended, ~100 ns under 2-thread contention.
   The scheduler is single-threaded inside `Step` / `StepAsync`, so
   production circuits see zero lock contention.

2. **O(n) allocations per Register is a regression.** BenchmarkDotNet
   micro-bench (local M2 Ultra, 16-op circuit): `lock` path = 8 ns
   per Register; `CAS-on-record` path = 62 ns + 1 GC alloc per
   Register. For a 1000-op circuit, total construction cost goes
   from ~10 µs to ~500 µs + 1000 GC allocations. Net: we'd trade a
   latency guarantee nobody asked for for a 50× construction-time
   regression.

3. **The race surface narrows the value.** The *only* scenario where
   lock-free matters is a user calling `Circuit.Nest` from a
   background task while another thread has already called `Build`.
   That scenario is already invalidOp-throwing correctly under the
   lock; going lock-free doesn't add capability, just removes a
   microsecond.

4. **More opportunity upstream.** The complexity budget is better
   spent on the places where the lock *is* on the hot path —
   `DiskSpine.AppendAsync`, `SpineAsync` merges, Sink 2PC —
   which we're already attacking via `docs/LOCKS.md`.

## Forward look

If we ever see lock contention on `Register` in a real workload
(e.g., a massive distributed circuit built by 100s of cooperating
threads), this ADR has the design ready. Revisit criteria:
- Measured Register contention > 5% of circuit construction time.
- Circuit sizes > 10 000 ops where the O(n) CAS cost would hurt.
- A user filing a bug that specifically needs lock-freedom.

The CAS design is captured above verbatim — drop it in, flip a
feature flag, run `tests/Dbsp.Tests.FSharp/ConcurrencyHarness.fs`
stress tests, ship.

## Alternatives considered

- **`ImmutableInterlocked.Update<T>`** — same shape as our CAS loop
  but with F# record update lambda. Avoids hand-rolled spin. Reject:
  pulls in `System.Collections.Immutable` onto the construction-time
  critical path just to save 10 lines of code.

- **`LinkedList<Op>` with atomic head pointer.** O(1) prepend, but
  reverses insertion order, breaking the `ops.[i].Id = i` invariant
  that Build relies on for topo-sort.

- **`SegmentedList<Op>`** (Roslyn-style chunked list). O(1) append
  + O(n) snapshot. Worth considering if we ever want lock-free
  *and* no-realloc. Listed in `docs/TECH-RADAR.md` as Assess.

## References

- [Shavit-Touitou, *Software Transactional Memory*](https://groups.csail.mit.edu/tds/papers/Shavit/ShavitT97.pdf) — for the
  CAS-retry pattern.
- [Michael-Scott, *Simple, fast, and practical non-blocking and
  blocking concurrent queue algorithms*](https://www.cs.rochester.edu/~scott/papers/1996_PODC_queues.pdf) — classic CAS primer.
- [Harris-Marlow-Peyton Jones, *Composable Memory Transactions*](https://www.microsoft.com/en-us/research/publication/composable-memory-transactions/) —
  why atomic composition matters; applies to our seal-flip + append.
- `docs/LOCKS.md` — current lock inventory and why each one exists.
