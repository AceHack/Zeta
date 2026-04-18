# The Spec Caught a Bug — A Short Story

A real, reproducible case study of a TLA+ specification catching a
concurrency bug in the Zeta.Core F# engine before it shipped. Use this
doc when you need to sell a skeptic on formal specifications — it's
concrete, honest, and takes ~3 minutes to read.

## Setup

**System.** Zeta.Core, an F# implementation of DBSP incremental
view maintenance. One piece is the `Circuit` — a directed acyclic
graph of operators that gets advanced one tick at a time.

**The feature.** `Circuit.HasAsyncOps: bool` — lets callers decide
whether to use the fast-path sync `Step()` or the general `await
StepAsync(ct)`. The obvious first cut at the implementation:

```fsharp
member _.HasAsyncOps : bool =
    let mutable found = false
    let mutable i = 0
    while not found && i < ops.Count do
        if ops.[i].IsAsync then found <- true
        i <- i + 1
    found
```

Ships. Tests pass. Code review approves. Merged.

## The TLA+ spec gets written

A few rounds later, the team writes a TLA+ specification for the
operator lifecycle — `tools/tla/specs/OperatorLifecycleRace.tla` — modelling
concurrent `Register` calls against concurrent `HasAsyncOps` reads.
The spec says:

```tla
FlagSound == anyAsync = (\E i \in 1..Len(ops): ops[i].async)
```

"The flag cached value should match a fresh scan of the op list."

## TLC model-checker runs the spec

```
$ java -cp tools/tla/tla2tools.jar tlc2.TLC OperatorLifecycleRace
Error: Invariant FlagSound is violated.
Error: The behavior up to this point is:
```

**TLC enumerates all interleavings up to a bounded model and finds a
counter-example.** The specific case: thread A registers an async op,
thread B simultaneously calls HasAsyncOps — if B's read executes
*after* A has added to `ops` but *before* the iteration reads index
i, the ResizeArray resize can corrupt the iteration and `found` ends
up `false` even though a matching op exists.

## The real bug this points at

Look at the actual F# code again:

```fsharp
while not found && i < ops.Count do
    if ops.[i].IsAsync then found <- true
```

`ops.Count` is read once at loop head per iteration. If another
thread is mid-`ops.Add(newOp)`, the `ResizeArray` may be resizing
its backing buffer — `ops.[i]` could throw
`InvalidOperationException: collection was modified` or return
the wrong op. **The function isn't just inefficient, it's racy.**

## The fix

```fsharp
[<VolatileField>]
let mutable anyAsync = false

member internal _.Register<'O when 'O :> Op>(op: 'O) : 'O =
    lock registerLock (fun () ->
        // ... ops.Add ...
        if op.IsAsync then anyAsync <- true
        op)

member _.HasAsyncOps : bool = anyAsync
```

Flag set under the same lock that guards `ops.Add`, volatile read
for visibility. No iteration, no race, O(1) query.

## The cost and the value

- **Cost:** one `tools/tla/specs/OperatorLifecycleRace.tla` file (~40 lines) +
  one `.cfg` file (~5 lines) + a TLC test wrapper in F# (~80 lines
  shared across every spec).
- **Value:** TLC's state-space exploration found an interleaving no
  unit test would have — the race window is nanoseconds wide. The
  fix was one cache-line-sized volatile field.

## What makes this repeatable

Three ingredients, all automated in this repo:

1. **TLA+ specs live next to the code.** `docs/*.tla` + `.cfg`; each
   .tla corresponds to an observable code invariant.
2. **A test runner shells out to TLC** — `tests/Dbsp.Tests.FSharp/
   TlcRunnerTests.fs` runs `java -cp tla2tools.jar tlc2.TLC <spec>`
   and asserts "No error has been found" in stdout. Specs drift =
   tests fail.
3. **Reviewers are tasked with writing new specs** when they find a
   bug class — `.claude/skills/race-hunter/SKILL.md` explicitly
   requires the reviewer to propose a TLA+ spec when one doesn't
   exist for the finding.

## Honest caveats

- **Not a silver bullet.** TLC can only model-check bounded systems;
  it doesn't prove the F# compilation is faithful to the spec. We
  also ship Z3 SMT proofs for pointwise axioms and FsCheck property
  tests for algebraic laws — belt, braces, and a second belt.
- **Writing specs is a skill.** Our first version of this very spec
  had a bug of its own (a bad `ScanAsync` action); the spec's TLC
  output flagged it, we fixed the spec, re-ran, it passed. Specs
  co-evolve with code.
- **Specs are cheap at the start, expensive once shipped without
  them.** The lesson is: write the spec when the feature is designed,
  not after an incident.

## Takeaways for contributors

When you add a new concurrent operation to `Zeta.Core`:

1. Write a TLA+ spec (or ask a reviewer to) describing the
   invariants you want preserved.
2. Add a `.cfg` with small concrete CONSTANTS.
3. Run `dotnet test --filter "FullyQualifiedName~TlcRunner"` locally;
   CI will do the same.
4. If TLC finds a counter-example, treat it as a real bug: first
   check the spec, then check the code, fix whichever is wrong.

## References

- `tools/tla/specs/OperatorLifecycleRace.tla` — the spec
- `tools/tla/specs/OperatorLifecycleRace.cfg` — the TLC configuration
- `tests/Dbsp.Tests.FSharp/TlcRunnerTests.fs` — the test that shells
  out to TLC
- `src/Core/Circuit.fs` — the code that was fixed
- Lamport, *Specifying Systems* — the canonical TLA+ reference
- Newcombe et al. *How Amazon Web Services Uses Formal Methods* CACM 2015
