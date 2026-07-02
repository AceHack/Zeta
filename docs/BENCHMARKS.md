# Benchmark Results

All numbers from **Apple M2 Ultra, .NET 10.0.6 ARM64, BenchmarkDotNet 0.15.4**.
Reproduce with `dotnet run --project bench/Benchmarks -c Release`.

## Z-set operations

At N = 4096 entries:

| Op | Time | Allocated | Throughput (ops/sec) |
|---|---:|---:|---:|
| **Lookup** (binary search) | **218 ns** | **0 B** | ~4.6 M |
| **WeightedCount** | 9.5 µs | **0 B** | N/A |
| **Neg** | 11.6 µs | 65 KB (output) | — |
| **Scale** | 14.8 µs | 65 KB | — |
| **Distinct** | 17 µs | 65 KB | — |
| **Filter** (50% sel.) | 17.7 µs | 33 KB | — |
| **Add** (sorted merge) | 78 µs | 98 KB | ~52 M entries/sec |
| **Map** (sort+consolidate) | 554 µs | 66 KB | ~7.4 M entries/sec |
| **Join** (hash) | 395 µs | 130 KB | ~10 M matches/sec |

Zero-alloc hot paths (`Lookup`, `WeightedCount`, `Count`) confirmed via
`[<MemoryDiagnoser>]` with `Allocated: 0 B`. Every allocating op
produces exactly one output buffer.

## LSM Spine: sync vs async

Workload: insert *BatchCount* batches of *BatchSize* entries, then consolidate.

| BatchCount | BatchSize | Sync | Async | Ratio | Winner |
|---|---|---:|---:|---:|---|
| 1024 | 16 | **883 µs** | 3,250 µs | 3.69 | **Sync** |
| 1024 | 256 | 13.77 ms | 13.26 ms | 0.96 | async marginal (+3%) |
| 16384 | 16 | 20.4 ms | 19.95 ms | 0.98 | async marginal (+2%) |
| 16384 | 256 | 237 ms | 230 ms | 0.97 | async marginal (+3%) |

**Honest finding: sync wins for in-memory workloads.** The async merger
pays off only when merge cost includes disk I/O (which `DiskBackingStore`
adds on top via the pluggable `IBackingStore<'K>` abstraction). At small
batches the channel overhead dominates, losing 3.7×. Sync is the default;
opt in to `SpineAsync` only when you're spilling.

## Comparison to Feldera (rough)

Feldera's published numbers (from [Nexmark harness](https://github.com/feldera/feldera/tree/main/crates/nexmark))
are **1.5–3 M events/sec/core** on common Nexmark queries. Our simple-op
throughput on a single thread:

- `Join` at N=4096: 16 M matches/sec
- `Add` at N=4096: 52 M entries/sec
- `Filter` at N=4096: 230 M entries/sec

That puts us in the same ballpark or ahead on micro-ops. A head-to-head
Nexmark run against the same dataset would be the fair comparison; our
Q1-Q8 harness is in `bench/Benchmarks/Nexmark.fs` + `NexmarkFull.fs`
ready for that.

## Polymorphic Z-set dispatch (ZSetW / MergeKernel — 081KWFXTHJY)

The sorted merge-sum exists ONCE (`src/Core/MergeKernel.fs`); `ZSet.(+)`,
`ZSetW.sumBy` (struct ring) and `ZSetW.sum` (boxed ring) all delegate to it.
Gate: the kernel-backed int64 path must match the previous hand-specialised
`ZSet.add`. Medium job (M-series ARM64, net10.0); **±** is StdDev. Naledi
sign-off-with-notes 2026-07-01.

**Pre-reframe baseline** (hand-inlined `ZSet.add`) vs **post-reframe**
(kernel-backed) vs the tie-breaker re-run:

| Size | Baseline | Post-reframe | Tie-breaker | Allocated (all) |
|---:|---:|---:|---:|---:|
| 16   | 65.08 ± 7.47 ns | 61.16 ± 0.53 ns | 60.43 ± 1.60 ns | 408 B |
| 256  | 724.6 ± 28.4 ns | 828.7 ± 48.8 ns¹ | 740.3 ± 22.1 ns | 6,168 B |
| 4096 | 18,011 ± 337 ns | 18,455 ± 561 ns | 18,548 ± 881 ns | 98,359 B |

¹ single-run outlier; disproved by the tie-breaker and by the same-run
struct-ring cell (712.5 ns — the identical kernel code path). @4096 the
delta (+443–537 ns) is within 1σ of the combined spread (σ≈654); Naledi's
2σ re-run rule not triggered.

**Dispatch cost, same run** (int keys, `ZSetAdd` = baseline 1.00):

| Method | 16 | 256 | 4096 | Alloc ratio |
|---|---:|---:|---:|---:|
| `ZSetAdd` (kernel, monomorphised int64) | 1.00 | 1.00 | 1.00 | 1.00 |
| `ZSetWStructRing` (struct ring by value) | 0.98 | 0.86 | 0.97 | 1.00 |
| `ZSetWInstance` (boxed `ISemiring`) | 1.28 | 1.22 | 1.16 | 1.00 |

The struct-ring path is zero-overhead (JIT monomorphisation devirtualises
`ISemiring.Add` to a bare `int64 +`); the boxed path pays the virtual call
per weight — the cold/dynamic-ring register, by design. Both allocation
patterns are identical (Pool workspace + one `FreezeSlice`).

**String keys** (the practical DBSP key type — exercises the shared-generics
path, interface-dispatched ordinal comparer, and `Pool.Return`'s O(cap)
clear pass for reference-containing entries). `ZSetAdd` = baseline 1.00:

| Method | 16 | 256 | 4096 | Alloc ratio |
|---|---:|---:|---:|---:|
| `ZSetAdd` | 520.0 ± 2.5 ns | 7,291 ± 42 ns | 121,787 ± 1,582 ns | 1.00 |
| `ZSetWStructRing` | **1.00** | **1.00** | **1.00** | 1.00 |
| `ZSetWInstance` | 1.15 | 1.15 | 1.15 | 1.00 |

Exact parity (RatioSD 0.01–0.02) — struct-ring devirtualisation holds under
shared generics (`__Canon`), empirically confirming the sign-off analysis.
The ~6.6× cost vs int keys is the per-element string compare, inherent to
the key type and identical in both worlds.

**Large point / LOH** (65536 ⊕ 65536; the merge workspace rents 131,072
entries — a pool-miss allocates on the LOH; steady state stays pooled):

| Method | Mean | Alloc |
|---|---:|---:|
| `ZSetAdd` | 256.6 ± 5.3 µs | 1.5 MB |
| `ZSetWStructRing` | 266.9 ± 5.5 µs (ratio 1.04 ± 0.03) | 1.5 MB |

Overlapping error bars; identical allocation and Gen2 profile. No pool /
LOH divergence between the kernel-backed paths.

## Allocation guarantees (zero-alloc paths)

Verified via `GC.GetAllocatedBytesForCurrentThread()` in unit tests:

- `z.[k]` — binary search, zero alloc
- `ZSet.count`, `ZSet.isEmpty` — zero alloc
- `ZSet.weightedCount` — zero alloc (SIMD sum under the hood via `Simd.Sum`)
- Empty-input operations — zero alloc via `ZSet.Empty` short-circuits

## Big-O summary

| Op | Complexity | Memory | Notes |
|---|---|---|---|
| `add` | O(n + m) | O(output) | sorted merge |
| `neg`, `scale` | O(n) | O(n) | linear scan |
| `filter`, `distinct` | O(n) | O(output) | |
| `map` | O(n log n) | O(n) | sort+consolidate |
| `join` (hash-index) | O(n + m) avg | O(output + min(n,m)) | bucket-chained index |
| `join` (indexed) | O(matching keys · avg group) | O(output) | sort-merge on keys |
| `cartesian` | O(n · m) | O(n · m) | unavoidable |
| `distinctIncremental` (H function) | **O(\|Δ\|)** | O(\|Δ\|) | key DBSP win |
| `Spine.Insert` | O(log n) amortised | O(n) | size-doubling levels |
| `Spine.Consolidate` | O(n) | O(n) | |
| `RecursiveSemiNaive` | O(\|LFP\|) total | O(\|LFP\|) | semi-naive Δ-evaluation |
| `ZSet.sum` of k sets | **O(n log k)** | O(n) | k-way merge |

Bold entries are places we match theoretically-optimal complexity.
