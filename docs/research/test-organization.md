# Test Organization for `Dbsp.Tests.FSharp`

**Status:** proposal (pre-v1, refactor welcome per `AGENTS.md`). Author: architect
review. Scope: rename + regroup every file under `tests/Dbsp.Tests.FSharp/`.

## 1. Current pain

28 `.fs` files live flat in one directory. Sizes and names, auditorily scanned:

| Confusing file           | Lines | What it actually covers                       |
|--------------------------|-------|------------------------------------------------|
| `CoverageTests.fs`       |  729  | ZSet / IndexedZSet / Pool / Circuit grab-bag   |
| `CoverageTests2.fs`      |  461  | AsofJoin, Windows, Upsert, Transaction, Exchange |
| `CoverageBoostTests.fs`  |  352  | Weight, Metrics, Plan, DSL, HLL, Clock, Hash   |
| `Round17Tests.fs`        |  364  | FastCDC, ClosurePair, Merkle, Bloom, ResidualMax |
| `Round8Tests.fs`         |  489  | SpineSelector, BalancedSpine, Checkpoint, Shard |
| `Round7Tests.fs`         |  192  | NestedCircuit, SimdMerge, ChaosEnv, Plan       |
| `Round6Tests.fs`         |  288  | Differentiate2, AitkenAccelerate, BackingStore |
| `InfrastructureTests.fs` |  365  | CountMin, Watermark, Sink, Mailbox             |
| `NewFeatureTests.fs`     |  206  | Tropical, KLL, HyperMinHash, Haar, Memento, CRDT |
| `AdvancedTests.fs`       |  202  | Jump, Rendezvous, GCounter, PNCounter, OrSet, Rx |

`RoundN` encodes *when* the test was written, not *what* it tests — useless at
search time. `Coverage*` names encode *why* (a coverage target) rather than
*what*. Humans can't browse this.

## 2. Research: how humans find things

- **Miller's 7±2.** A directory with 28 entries exceeds working memory.
  Grouping into ~7 folders with ~4–6 files each is the legibility sweet spot.
- **Principle of locality.** Put tests next to the subsystem name: if
  `src/Dbsp.Core/Spine.fs` exists, `tests/.../Storage/Spine.Tests.fs` is
  where a human looks first.
- **Feature-first vs module-first.** Module-first (mirror `src/` layout) wins
  for library code because contributors arrive via the module they touched,
  not via a user story. Feature-first is right for apps, not libraries.
- **Naming.** F# community consensus (FSharp.Core, Fantomas, Fable, Ionide)
  uses `{Subject}Tests.fs` — same subject as the module under test, `.Tests`
  suffix. No `Test_` prefixing (that's xUnit-Java idiom), no scenario in the
  filename (scenarios go in the test name: `` let ``X rejects Y`` ``).
- **Growth.** When a file exceeds ~400 lines, split by sub-aspect:
  `Spine.Tests.fs` → `Spine.Tests.fs` + `Spine.Checkpoint.Tests.fs`. The
  dot-separator is an F# idiom and sorts adjacently.
- **Search-first vs browse-first.** The user said "we can grep as fast as
  you". Correct — so optimise filenames for *browse-ability* (scanning the
  tree and predicting where a test lives), not for redundancy with grep.

## 3. Proposed layout

```
tests/Dbsp.Tests.FSharp/
  Algebra/           ZSet.Tests.fs, IndexedZSet.Tests.fs, Weight.Tests.fs,
                     Algebra.Laws.Tests.fs
  Circuit/           Circuit.Tests.fs, NestedCircuit.Tests.fs,
                     Incremental.Tests.fs, Plan.Tests.fs, Plan.Branches.Tests.fs
  Operators/         Aggregate.Tests.fs, Window.Tests.fs, Join.Tests.fs,
                     Upsert.Tests.fs, Transaction.Tests.fs, Fusion.Tests.fs
  Storage/           Spine.Tests.fs, Spine.Balanced.Tests.fs,
                     Spine.Selector.Tests.fs, Spine.Disk.Tests.fs,
                     Checkpoint.Tests.fs, Merkle.Tests.fs, FastCdc.Tests.fs
  Sketches/          CountMin.Tests.fs, HyperLogLog.Tests.fs,
                     HyperMinHash.Tests.fs, Bloom.Tests.fs, Kll.Tests.fs,
                     Haar.Tests.fs, Tropical.Tests.fs
  Runtime/           Runtime.Tests.fs, Mailbox.Tests.fs,
                     Shard.Tests.fs, ConsistentHash.Tests.fs,
                     Concurrency.Tests.fs, Allocation.Tests.fs
  Infra/             Metrics.Tests.fs, Tracing.Tests.fs, Watermark.Tests.fs,
                     Sink.Tests.fs, Dsl.Tests.fs, Environment.Tests.fs,
                     Rx.Tests.fs
  Crdt/              GCounter.Tests.fs, PNCounter.Tests.fs, OrSet.Tests.fs,
                     Lww.Tests.fs
  Formal/            Z3.Laws.Tests.fs, Tlc.Runner.Tests.fs,
                     Sharder.InfoTheoretic.Tests.fs
  Properties/        Math.Invariants.Tests.fs, Fuzz.Tests.fs,
                     Determinism.Tests.fs
  _Support/          ConcurrencyHarness.fs  (helpers, no tests)
  Dbsp.Tests.FSharp.fsproj
  README.md
```

Ten top-level folders, each with 3–7 files. Each filename names a module in
`src/Dbsp.Core/`. New contributors browse by subsystem, not by history.

## 4. Rename map (every file)

| From                                  | To                                              |
|---------------------------------------|-------------------------------------------------|
| `ZSetTests.fs`                        | `Algebra/ZSet.Tests.fs`                         |
| `AggregateTests.fs`                   | `Operators/Aggregate.Tests.fs`                  |
| `WindowTests.fs`                      | `Operators/Window.Tests.fs`                     |
| `CircuitTests.fs`                     | `Circuit/Circuit.Tests.fs`                      |
| `IncrementalTests.fs`                 | `Circuit/Incremental.Tests.fs`                  |
| `AdvancedTests.fs`                    | split: `Runtime/ConsistentHash.Tests.fs`, `Crdt/*.Tests.fs`, `Infra/Rx.Tests.fs` |
| `InfrastructureTests.fs`              | split: `Sketches/CountMin.Tests.fs`, `Infra/Watermark.Tests.fs`, `Infra/Sink.Tests.fs`, `Runtime/Mailbox.Tests.fs` |
| `NestedAndRuntimeTests.fs`            | split: `Circuit/NestedCircuit.Tests.fs`, `Runtime/Runtime.Tests.fs` |
| `FormalVerificationTests.fs`          | `Formal/Z3.Laws.Tests.fs`                       |
| `CoverageTests.fs`                    | split across `Algebra/`, `Circuit/`, `Operators/` by subject |
| `CoverageTests2.fs`                   | split across `Operators/`, `Runtime/`           |
| `CoverageBoostTests.fs`               | split across `Infra/`, `Sketches/`, `Circuit/Plan.Tests.fs` |
| `NewFeatureTests.fs`                  | split across `Sketches/`, `Crdt/`               |
| `FuzzTests.fs`                        | `Properties/Fuzz.Tests.fs`                      |
| `DeterministicTests.fs`               | `Properties/Determinism.Tests.fs`               |
| `AllocationTests.fs`                  | `Runtime/Allocation.Tests.fs`                   |
| `SpineAndSafetyTests.fs`              | split: `Storage/Spine.Selector.Tests.fs`, `Storage/Spine.Balanced.Tests.fs`, `Storage/Checkpoint.Tests.fs` |
| `QueryCETests.fs`                     | `Infra/Dsl.Tests.fs`                            |
| `Round6Tests.fs`                      | split: `Operators/Differentiate.Tests.fs`, `Storage/Spine.Disk.Tests.fs`, `Runtime/Runtime.Tests.fs` |
| `Round7Tests.fs`                      | split: `Circuit/NestedCircuit.Tests.fs`, `Storage/Simd.Tests.fs`, `Infra/ChaosEnv.Tests.fs`, `Circuit/Plan.Tests.fs` |
| `Round8Tests.fs`                      | split: `Storage/Spine.Selector.Tests.fs`, `Storage/Checkpoint.Tests.fs`, `Algebra/ZSet.Overflow.Tests.fs`, `Runtime/Shard.Tests.fs` |
| `Round17Tests.fs`                     | split: `Storage/FastCdc.Tests.fs`, `Storage/Merkle.Tests.fs`, `Sketches/Bloom.Tests.fs`, `Operators/ResidualMax.Tests.fs` |
| `MathInvariantTests.fs`               | `Properties/Math.Invariants.Tests.fs`           |
| `ConcurrencyHarness.fs`               | `_Support/ConcurrencyHarness.fs`                |
| `ThreadSafetyTests.fs`                | `Runtime/Concurrency.Tests.fs`                  |
| `PlanBranchTests.fs`                  | `Circuit/Plan.Branches.Tests.fs`                |
| `TlcRunnerTests.fs`                   | `Formal/Tlc.Runner.Tests.fs`                    |
| `InfoTheoreticSharderClaimTests.fs`   | `Formal/Sharder.InfoTheoretic.Tests.fs`         |

## 5. Rules for new test files

- **One test file per src module.** `src/Dbsp.Core/Foo.fs` → `Xxx/Foo.Tests.fs`.
- **Append until ~400 lines**, then split by sub-aspect using a dot:
  `Spine.Tests.fs` + `Spine.Disk.Tests.fs`. Hard ceiling: 600 lines.
- **Never encode dates, rounds, or coverage targets in filenames.** The
  subject under test is the only allowed discriminator.
- **Support/harness files go in `_Support/`** (leading underscore sorts first
  and signals "not a test file").
- **Properties and fuzz tests live in `Properties/`** — they cross modules by
  design and cutting them by module would fragment the algebraic laws.

## 6. Objections anticipated

- **`.fsproj` compile order matters.** All compile order the proposal needs
  is: `_Support/` first, then leaves in any order, then `Properties/` last
  (they depend on everything). Expressible as `<Compile Include="..."/>` with
  wildcards disallowed — we list explicitly, one folder per `ItemGroup`.
- **Churn.** 28 renames is one PR, reviewed as a pure move. No test bodies
  change; `git log --follow` tracks history. The `.fsproj` is the only file
  whose *content* changes.
- **IDE navigation.** VS Code / Rider / Ionide all recurse; tree-view
  becomes better, not worse.

## 7. Migration plan (keeps CI green at every step)

1. Create empty folders. No build change. (commit 1)
2. Move `ConcurrencyHarness.fs` → `_Support/`; update `.fsproj`; `dotnet
   test`. (commit 2)
3. Move the **already-well-named** files (ZSet, Circuit, Aggregate, Window,
   Incremental, Fuzz, Determinism, Allocation, PlanBranch, TlcRunner,
   InfoTheoreticSharder, FormalVerification, MathInvariant, ThreadSafety,
   QueryCE) — one commit per folder, update `.fsproj` atomically each time.
   (commits 3–7)
4. Split `Round6/7/8/17`, `Coverage*`, `Advanced`, `Infrastructure`,
   `NestedAndRuntime`, `SpineAndSafety`, `NewFeature` one file at a time;
   each commit moves test-bodies into their new home verbatim. (commits
   8–20)
5. Delete the empty originals; final `.fsproj` cleanup. (commit 21)
6. Add `tests/Dbsp.Tests.FSharp/README.md` documenting §3 and §5. (commit 22)

Each commit runs `dotnet test Dbsp.sln` — the 447-test gate stays green
throughout.
