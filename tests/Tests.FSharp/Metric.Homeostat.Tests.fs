module Zeta.Tests.MetricHomeostatTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// Metric / aggregation (PROVEN-CORE-MAP #6) — the HOMEOSTAT leg only. The probabilistic
// sketches carry the same merge-convergence property as the proven floor primitives, and
// each lands in an already-worked homeostat class:
//   • BloomFilter.MergeFrom = bitwise OR  → JOIN-SEMILATTICE (idempotent ∪; like G-Set):
//     replicas converge to the same filter regardless of merge order + duplicates, and the
//     no-FALSE-NEGATIVE guarantee is preserved (anything added to any replica is found).
//   • CountMinSketch.Union = elementwise add → COMMUTATIVE MONOID (NOT idempotent; like
//     ByteCost): the merged estimate is order-independent, the no-UNDERCOUNT guarantee is
//     preserved, and re-merging a replica double-counts (monoid, not LUB).
//
// HONEST SCOPE: this is ONE of the six legs. Metric is NOT FULL PROVEN — the math leg's
// probabilistic MAGNITUDE BOUNDS are unproven (only merge-laws + error-direction hold), the
// 4-ser/Arrow/Bonsai legs are blocked (the sketch types expose no rehydrate-from-state
// constructor — would need a public-API change), and the sketches are F#-only (4-lang open).
// This leg moves the homeostat cell ✗→✓; the rest is the gap to FULL PROVEN.
// ═══════════════════════════════════════════════════════════════════

// ── Bloom: semilattice (OR) merge-convergence ──

let private bloomOf (xs: int64 list) : BlockedBloomFilter =
    let f = BlockedBloomFilter(1024, 4)
    for x in xs do f.Add(x)
    f

let private mergedBloom (fs: BlockedBloomFilter list) : BlockedBloomFilter =
    let acc = BlockedBloomFilter(1024, 4)
    for f in fs do acc.MergeFrom(f)
    acc

let private genInts : Gen<int64 list> =
    Gen.listOf (Gen.choose (-100000, 100000) |> Gen.map int64)

type IntsArb() =
    static member I() = Arb.fromGen genInts

[<Property(Arbitrary = [| typeof<IntsArb> |])>]
let ``Metric/Bloom × homeostat: OR-merge converges regardless of order + duplicates (semilattice)``
    (a: int64 list) (b: int64 list) (c: int64 list) =
    let fa, fb, fc = bloomOf a, bloomOf b, bloomOf c
    let lub = (mergedBloom [ fa; fb; fc ]).Table
    let orderIndependent =
        [ (mergedBloom [ fc; fb; fa ]).Table
          (mergedBloom [ fb; fa; fc ]).Table
          (mergedBloom [ fc; fa; fb ]).Table ]
        |> List.forall (fun t -> t = lub)
    // idempotent: re-merging a replica is a no-op (OR x x = x)
    let idempotent = (mergedBloom [ fa; fb; fc; fa; fc ]).Table = lub
    orderIndependent && idempotent

[<Property(Arbitrary = [| typeof<IntsArb> |])>]
let ``Metric/Bloom × homeostat: merge preserves no-false-negative (anything added is found)``
    (a: int64 list) (b: int64 list) =
    let m = mergedBloom [ bloomOf a; bloomOf b ]
    (a @ b) |> List.forall (fun x -> m.MayContain x)

// ── CountMin: commutative monoid (add) merge-convergence ──

let private cmsOf (xs: int64 list) : CountMinSketch =
    let c = CountMinSketch(4, 256, 777L)
    for x in xs do c.Add(x, 1L)
    c

let private unionAll (lists: int64 list list) : CountMinSketch =
    // rebuild components fresh each call (Union mutates) → order-independence is honest
    let acc = CountMinSketch(4, 256, 777L)
    for xs in lists do acc.Union(cmsOf xs)
    acc

[<Property(Arbitrary = [| typeof<IntsArb> |])>]
let ``Metric/CountMin × homeostat: union is order-independent (commutative monoid)``
    (a: int64 list) (b: int64 list) (c: int64 list) =
    let lub = unionAll [ a; b; c ]
    let probes = (a @ b @ c) |> List.distinct
    [ unionAll [ c; b; a ]; unionAll [ b; a; c ]; unionAll [ c; a; b ] ]
    |> List.forall (fun u -> probes |> List.forall (fun k -> u.Estimate k = lub.Estimate k))

[<Property(Arbitrary = [| typeof<IntsArb> |])>]
let ``Metric/CountMin × homeostat: union preserves no-undercount (estimate ≥ true count)``
    (a: int64 list) (b: int64 list) =
    let m = unionAll [ a; b ]
    let all = a @ b
    all
    |> List.distinct
    |> List.forall (fun k ->
        let trueCount = all |> List.filter ((=) k) |> List.length |> int64
        m.Estimate k >= trueCount)

[<Fact>]
let ``Metric/CountMin × homeostat: union is NOT idempotent — re-merging double-counts (monoid, not LUB)`` () =
    let single = unionAll [ [ 5L; 5L; 7L ] ]
    let doubled = unionAll [ [ 5L; 5L; 7L ]; [ 5L; 5L; 7L ] ]
    // monoid (add), so re-merging the same observations increases the estimate
    Assert.True(doubled.Estimate 5L > single.Estimate 5L)
    Assert.Equal(single.Estimate 5L * 2L, doubled.Estimate 5L)
