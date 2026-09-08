# ZD4 named unmetered N=32 ShortRun (one Mac)

Date: 2026-09-08
Author: Ani, Grok 4.6
Operational status: research-grade
Lifecycle: active
Work item: 081M1ZE5WSP087G0R002CVMVCN

A named run of `Zd4ProductExistenceBench` now exists. It does not
promote the FS-speed claim out of `toy`. It does not kill
ZetaFS-as-product. It does not go in README.

## What ran

- Harness: `bench/Benchmarks/Zd4ProductExistenceBench.fs`
- Job: BenchmarkDotNet ShortRun (LaunchCount=1, WarmupCount=3,
  IterationCount=3)
- Storm: N=32 on PhysicalFileSystem (host APFS)
- Host: macOS Tahoe 26.6.2, Apple M2 Ultra, 24 cores, .NET 10.0.11
- SHA at run: `6744d4e651` (`#17018` compact BlockCas hex)
- High-priority process: permission denied (not a result)

Each invocation creates and deletes the store. This is a cold storm,
not a warm log.

## Numbers (unmetered)

| Method | Mean | Median | StdDev | Allocated |
|---|---:|---:|---:|---:|
| HostGroupCommitStorm | 8.889 ms | 8.833 ms | 0.118 ms | 351 KB |
| ZetaFsFreezeStorm | 180.651 ms | 132.964 ms | 83.551 ms | 93.8 MB |

Host stderr was 0.77% of mean. Freeze stderr was 26.7% of mean; the
99.9% CI includes negative time. The freeze **ratio is not a
measurement**. Median freeze (133 ms) is the less-lying single number
if someone needs one, and it is still `toy`.

BDN unrolled host at 128 invocations/iteration and freeze at 4. That
is BDN noticing freeze is slower, not a second experiment.

## What this does not say

- Not "ZetaFS is faster than APFS." It is not, on this storm, on this
  Mac, in this short job.
- Not "kill ZetaFS-as-product." The ZetaDB map already said
  `GroupCommitDiskDeltaLog` wins the small-write batching bet on a
  host directory. ZetaFS has to earn a product on CAS, fork, `Regen`,
  placement, per-entity policy, typed durability — not on batching.
- Not crash-safe. Recovery stays `toy`.
- Not FUSE. Not Apple Developer Program.

The 267× alloc (351 KB vs 94 MB) is the load-bearing smell for D10
(two buffers). It is still unmetered until a job with a freeze CI that
excludes the 277 ms outlier.

## Pointers

- `docs/design/2026-09-02-zetadb-roadmap-event-sourced-streaming-sql-not-feldera-on-postgres.md` ZD4
- Tests: `tests/Tests.FSharp/Storage/Zd4ProductExistence.Tests.fs` (both legs complete; no Stopwatch)
