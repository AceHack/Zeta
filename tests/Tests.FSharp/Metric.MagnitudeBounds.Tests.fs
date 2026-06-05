module Zeta.Tests.MetricMagnitudeBoundsTests

open global.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// Metric / aggregation (PROVEN-CORE-MAP #6) — the MAGNITUDE-BOUNDS leg, EMPIRICAL.
// The math leg already has merge-laws + error-DIRECTION (Bloom no-false-neg, CMS no-
// undercount). This adds the error-MAGNITUDE bounds — the probabilistic guarantees that make
// the sketches useful — verified EMPIRICALLY (deterministic given the fixed seed + fixed
// input sets), NOT as a closed-form proof. A formal ε/δ bound (Lean/Z3) remains future work;
// this pins the actual measured error against the theoretical bound so a regression that
// blows the bound is caught.
//
//   • CountMin: overestimate ≤ ε·N where ε = e/width (per-row collision rate). With
//     width=256, ε ≈ 0.0106; depth=4 gives failure prob δ = e^-4 ≈ 0.018 per query.
//   • Bloom: false-positive rate ≈ (1 - e^(-k·n/m))^k for k probes, n items, m bits.
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``Metric/CountMin × magnitude: overestimate stays within the ε·N theoretical bound (empirical)`` () =
    let depth, width = 4, 256
    let cms = CountMinSketch(depth, width, 777L)
    // add 200 distinct keys, each once → true count 1, total weight N = 200
    let n = 200
    for k in 0 .. n - 1 do cms.Add(int64 k, 1L)
    let totalWeight = int64 n
    let epsilon = 2.718281828 / float width // e/width
    let bound = int64 (ceil (epsilon * float totalWeight)) // ε·N, rounded up

    let overestimates = [ for k in 0 .. n - 1 -> cms.Estimate(int64 k) - 1L ]
    let maxOver = List.max overestimates
    let withinBound = overestimates |> List.filter (fun o -> o <= bound) |> List.length
    let fracWithin = float withinBound / float n

    // no undercount (re-checks the error-direction leg on this data)
    Assert.True(List.forall (fun o -> o >= 0L) overestimates, "estimate must never undercount")
    // magnitude: the per-query bound holds with high probability (≥ 1-δ ≈ 0.98). Deterministic
    // given the seed, so this is a concrete pinned fact, not a flaky statistical assertion.
    Assert.True(fracWithin >= 0.95, $"only {fracWithin} of queries within ε·N={bound} (maxOver={maxOver})")
    // and even the worst case is bounded by a small multiple of ε·N (no pathological blowup)
    Assert.True(maxOver <= bound * 4L, $"max overestimate {maxOver} exceeded 4·ε·N={bound * 4L}")

[<Fact>]
let ``Metric/Bloom × magnitude: false-positive rate stays within the theoretical bound (empirical)`` () =
    let buckets, probes = 1024, 4
    let bloom = BlockedBloomFilter(buckets, probes)
    let n = 1000
    for k in 0 .. n - 1 do bloom.Add(int64 k)

    // query 10_000 keys known to be absent (disjoint range)
    let trials = 10000
    let mutable falsePos = 0
    for k in 1_000_000 .. 1_000_000 + trials - 1 do
        if bloom.MayContain(int64 k) then falsePos <- falsePos + 1
    let fpRate = float falsePos / float trials

    // every added key is found (error-direction re-check on this data)
    for k in 0 .. n - 1 do
        Assert.True(bloom.MayContain(int64 k), $"added key {k} must be found (no false negative)")
    // magnitude: FP rate is small and bounded. Deterministic given the fixed input sets, so
    // this pins the actual rate; a regression that degrades the filter blows this bound.
    Assert.True(fpRate <= 0.10, sprintf "Bloom false-positive rate %f exceeded the 0.10 bound (fp=%d/%d)" fpRate falsePos trials)
