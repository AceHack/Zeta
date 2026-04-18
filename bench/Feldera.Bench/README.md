# Dbsp.Feldera.Bench

Side-by-side benchmark harness comparing **Dbsp.Core** against **Feldera**
(https://github.com/feldera/feldera) on **Nexmark** and **TPC-H-streaming**
workloads.

## Running locally

```bash
dotnet run -c Release --project bench/Dbsp.Feldera.Bench --filter "*"
```

BenchmarkDotNet runs each query across `EventCount ∈ {10K, 100K}` and
reports:
- **Mean / P95 / P99** wall-clock latency
- **Allocations / tick** via `[<MemoryDiagnoser>]`
- **Gen0 / Gen1 / Gen2** GC counts

Results land in `BenchmarkDotNet.Artifacts/` with a JSON + CSV pair.

## Comparing to Feldera

Feldera publishes Nexmark numbers in
https://www.feldera.com/blog/nexmark-vs-flink. Representative expected
numbers at 100 M events / 16 worker threads (Threadripper 3990X):

| Query | Feldera | DBSP target |
|-------|---------|-------------|
| Q1/Q2 projection-only | 10–40 M events/s | ≥ 70 % of Feldera |
| Q3 hash join          | 3–8 M/s          | ≥ 60 % |
| Q7 windowed top-1     | 5–10 M/s         | ≥ 60 % |
| Q5 tumbling top-N     | 2–5 M/s          | ≥ 50 % |

Our near-term target is to **beat Feldera on projection/filter** and
match within 2× on joins — we have a better allocation story on the
hot path (zero-alloc Span + ArrayPool); Feldera's Rust backend wins
on raw throughput at the cost of a harder FFI boundary.

## Roadmap

- **Now**: Q1 projection, Q2 filter — shipped
- **Next**: Q3 hash join, Q7 windowed top-1 (needs `Window.fs` wiring)
- **Later**: Q5 tumbling top-N (residuated-lattice `ResidualMax`!),
  Q8 self-join, Q12 pre-fix
- **TPC-H**: Q1 scalar agg, Q5 multi-join

## Output comparison

Export Feldera's `benchmark/results.json` alongside our `Artifacts/`
JSON, then a side-by-side table prints via `FelderaCompare.fs`
(future helper). The `q12` optimization story from Feldera's blog is
a particularly useful micro-benchmark to replicate — it exercises
spine compaction + sink backpressure together.
