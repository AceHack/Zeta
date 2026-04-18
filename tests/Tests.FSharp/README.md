# Dbsp.Tests.FSharp

Subject-first F# test suite for `Dbsp.Core`. Tests are organised by the
subsystem they cover, mirroring `src/Dbsp.Core/`'s module structure.

## Directory layout

```
tests/Dbsp.Tests.FSharp/
  Algebra/        ZSet / IndexedZSet / Weight / overflow guards
  Circuit/        Circuit core, Incremental, NestedCircuit, Plan, Plan.Branches
  Operators/      Aggregate, Window, Join, Upsert, Transaction, Fusion,
                  ResidualMax, Differentiate
  Storage/        Spine variants, Checkpoint, Merkle, FastCdc, ClosureTable, Simd
  Sketches/       CountMin, HyperLogLog, HyperMinHash, Bloom, Kll, Haar, Tropical
  Runtime/        Runtime, Mailbox, Shard, ConsistentHash, Concurrency, Allocation
  Infra/          Metrics, Tracing, Watermark, Sink, Dsl, Environment, Rx
  Crdt/           GCounter, PNCounter, OrSet, Lww
  Formal/         Z3.Laws, Tlc.Runner, Sharder.InfoTheoretic
  Properties/     Math.Invariants, Fuzz, Determinism  (cross-module; compiled last)
  _Support/       ConcurrencyHarness  (helpers, not tests)
  Dbsp.Tests.FSharp.fsproj
  README.md
```

## Naming convention

- **One test file per source module.** `src/Dbsp.Core/Foo.fs`
  → `tests/.../<Subsystem>/Foo.Tests.fs`. Subject-first, never
  date-first. No `RoundN` or `Coverage` in filenames.
- **Module name matches folder + filename.** `Storage/Spine.Tests.fs`
  declares `module Dbsp.Tests.Storage.SpineTests`.
- **Dot-separated sub-aspects when a file grows.** When a subject's
  test file passes ~400 lines, split by aspect with a dot:
  `Spine.Tests.fs` + `Spine.Disk.Tests.fs` + `Spine.Selector.Tests.fs`.
  The dot sorts adjacent files together.

## Size limits

- **Soft cap:** 400 lines per test file. Once crossed, look for a
  split point (a distinct aspect of the subject).
- **Hard ceiling:** 600 lines. Do not merge new tests into a file
  that is already past 400 — start a sibling file.

## Special folders

- **`Properties/`** is for FsCheck property tests that cross module
  boundaries by design (algebraic laws, fuzz, determinism). Keeping
  them together avoids fragmenting the specification. `Properties/`
  is listed **last** in the `.fsproj` because its tests depend on
  every subject file compiling first.
- **`_Support/`** holds helper code that is not itself a test. The
  leading underscore sorts it first and signals "not a test file"
  at a glance. Helper modules use the namespace
  `Dbsp.Tests.Support.*`.

## Compile order in `Dbsp.Tests.FSharp.fsproj`

F# requires a total order. We group `<Compile Include>` by folder in
this order (helpers first, properties last):

1. `_Support/`
2. `Algebra/` → `Circuit/` → `Operators/` → `Storage/` → `Sketches/`
   → `Runtime/` → `Infra/` → `Crdt/` → `Formal/`
3. `Properties/`

Within each subject folder, files listed in no particular order; F#
sees them as independent modules that all depend on `Dbsp.Core`.

## Test framework

- **xUnit v3** with auto-generated entry point (`GenerateProgramFile=false`).
- **FsCheck.Xunit.v3** for `[<Property>]` attributes.
- **FsUnit.Xunit** for fluent `should equal` assertions.
- `#nowarn "0893"` silences a common F#/xUnit warning about closures.

## Running

```
export DOTNET_ROOT=/usr/local/share/dotnet
export PATH=/usr/local/share/dotnet:$PATH
dotnet build -c Release
dotnet test -c Release --no-build --logger "console;verbosity=minimal"
```

## Rationale

The layout is subject-first: each file is named after *what* the
tests cover, never *when* or *why* they were added. Flat
`RoundN` / `Coverage` / `CoverageBoost` prefixes are explicitly
not used. See `docs/research/test-organization.md` for the
full rationale.
