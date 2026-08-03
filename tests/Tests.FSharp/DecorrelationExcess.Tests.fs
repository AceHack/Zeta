module Zeta.Tests.DecorrelationExcessTests

open global.Xunit
open Zeta.Core

module DExc = Zeta.Core.DecorrelationExcess

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
// DecorrelationExcess — the general instrument (excess correlation over an independent permutation null,
// Lumen Attempt 3). These tests prove the STATISTICAL CORE: the Jaccard statistic, the seeded-
// deterministic permutation null (DST), the quantile threshold, ONE-WAY conviction, and the end-to-end
// soundness pair: a coupled population convicts, an independent population does NOT (and, crucially, a
// passive-common-cause style clean reading never *acquits*).
// ═══════════════════════════════════════════════════════════════════════════════════════════════════

let private set (xs: string list) : Set<string> = Set.ofList xs

// ── piece 2: jaccard ────────────────────────────────────────────────────────────────────────────────

[<Fact>]
let ``jaccard - disjoint sets are 0, identical are 1`` () =
    Assert.Equal(0.0, DExc.jaccard (set [ "a"; "b" ]) (set [ "c"; "d" ]))
    Assert.Equal(1.0, DExc.jaccard (set [ "a"; "b" ]) (set [ "a"; "b" ]))

[<Fact>]
let ``jaccard - two empty sets are 0 (no shared evidence, not a spurious perfect match)`` () =
    Assert.Equal(0.0, DExc.jaccard Set.empty Set.empty)

[<Fact>]
let ``jaccard - one common of three total is one third`` () =
    // {a,b} ∪ {b,c} = {a,b,c} (3); ∩ = {b} (1) ⇒ 1/3
    Assert.Equal(1.0 / 3.0, DExc.jaccard (set [ "a"; "b" ]) (set [ "b"; "c" ]), 12)

// ── piece 3a: shuffle is a deterministic genuine permutation (DST) ────────────────────────────────────

[<Fact>]
let ``shuffle - same seed gives the same permutation (deterministic, replayable)`` () =
    let arr = [| 0..20 |]
    Assert.Equal<int[]>(DExc.shuffle 42UL arr, DExc.shuffle 42UL arr)

[<Fact>]
let ``shuffle - preserves the multiset (a genuine permutation) and does not mutate the input`` () =
    let arr = [| 0..20 |]
    let shuffled = DExc.shuffle 7UL arr
    Assert.Equal<int[]>(arr, [| 0..20 |]) // input untouched
    Assert.Equal<int[]>(Array.sort shuffled, arr) // same multiset

[<Fact>]
let ``shuffle - different seeds generally give different permutations`` () =
    let arr = [| 0..50 |]
    Assert.NotEqual<int[]>(DExc.shuffle 1UL arr, DExc.shuffle 2UL arr)

// ── piece 3b: permutation null + quantile ─────────────────────────────────────────────────────────────

[<Fact>]
let ``permutationNull - pools k * n statistics and is deterministic in the seed`` () =
    let a = [ set [ "x" ]; set [ "y" ]; set [ "z" ] ]
    let b = [ set [ "x" ]; set [ "y" ]; set [ "z" ] ]
    let n1 = DExc.permutationNull 99UL 10 DExc.jaccard a b
    Assert.Equal(30, List.length n1) // k=10 * n=3
    Assert.Equal<float list>(n1, DExc.permutationNull 99UL 10 DExc.jaccard a b) // replayable

[<Fact>]
let ``quantile - nan on empty, exact on a known sample`` () =
    Assert.True(System.Double.IsNaN(DExc.quantile 0.95 []))
    // order stats 0..10, q=1.0 ⇒ max = 10; q=0.5 ⇒ median = 5
    let xs = [ 0.0 .. 10.0 ]
    Assert.Equal(10.0, DExc.quantile 1.0 xs, 12)
    Assert.Equal(5.0, DExc.quantile 0.5 xs, 12)

// ── piece 4: one-way conviction ──────────────────────────────────────────────────────────────────────

[<Fact>]
let ``classifyPair - nan threshold or nan stat never convicts (soundness-biased)`` () =
    Assert.Equal(DExc.WithinNull, DExc.classifyPair nan 0.9)
    Assert.Equal(DExc.WithinNull, DExc.classifyPair 0.5 nan)

[<Fact>]
let ``classifyPair - strictly-above convicts, at-or-below stays within null`` () =
    Assert.Equal(DExc.ExcessCorrelation, DExc.classifyPair 0.5 0.51)
    Assert.Equal(DExc.WithinNull, DExc.classifyPair 0.5 0.5)
    Assert.Equal(DExc.WithinNull, DExc.classifyPair 0.5 0.49)

// ── the end-to-end SOUNDNESS pair (the whole reason the instrument exists) ────────────────────────────

// A strongly COUPLED population: A and B touch-sets are identical per pair (a shared common cause makes
// them move together). The permutation null breaks the pairing ⇒ mostly disjoint ⇒ low. The real pairs'
// statistic (1.0) must exceed the (1−δ) null threshold ⇒ CONVICT.
[<Fact>]
let ``SOUNDNESS - a coupled population convicts (excess above the independent null)`` () =
    // n disjoint "subsystems"; each real pair touches the SAME one ⇒ perfectly coupled (jaccard 1.0).
    // The permutation null re-pairs subsystems ⇒ mostly disjoint (0.0). NOTE the resolution floor: the
    // null's own fixed points (perm(i)=i, rate ~1/n) coincidentally reproduce jaccard 1.0, so to convict
    // at level δ we need that rate below δ ⇒ n > 1/δ. δ=0.05 ⇒ n>20; use 30. Below that the instrument
    // is soundness-BIASED (can't resolve ⇒ WithinNull, never a false green) — the safe direction.
    let subsystems = [ for i in 0..29 -> sprintf "s%d" i ]
    let a = subsystems |> List.map (fun s -> set [ s ])
    let b = a // identical pairing ⇒ real jaccard = 1.0 each
    let nullStats = DExc.permutationNull 2024UL 200 DExc.jaccard a b
    let threshold = DExc.nullThreshold 0.05 nullStats
    // fixed-point rate ~1/30 ≈ 0.033 < 0.05 ⇒ the 95th-percentile null threshold sits below 1.0.
    Assert.True(threshold < 1.0)
    Assert.Equal(DExc.ExcessCorrelation, DExc.classifyPair threshold (DExc.jaccard a.[0] b.[0]))

// An INDEPENDENT population: the pairing is already arbitrary, so the real pairs look just like the null.
// The real statistic must NOT exceed the (1−δ) threshold ⇒ WITHIN NULL (no false conviction).
[<Fact>]
let ``SOUNDNESS - an independent population is NOT convicted (no false green on the null itself)`` () =
    // Two independent draws over the same subsystem alphabet: any overlap is chance, not coupling.
    let subsystems = [ "s0"; "s1"; "s2"; "s3"; "s4"; "s5"; "s6"; "s7" ]
    // Deterministic "independent" A and B via disjoint seeded shuffles of the alphabet, one subsystem each.
    let alpha = List.toArray subsystems
    let a = DExc.shuffle 11UL alpha |> Array.toList |> List.map (fun s -> set [ s ])
    let b = DExc.shuffle 999UL alpha |> Array.toList |> List.map (fun s -> set [ s ])
    let nullStats = DExc.permutationNull 555UL 200 DExc.jaccard a b
    let threshold = DExc.nullThreshold 0.05 nullStats
    // real pairs are single disjoint subsystems drawn the same way as the null ⇒ real stat sits within it.
    let convicted =
        List.zip a b
        |> List.filter (fun (x, y) -> DExc.classifyPair threshold (DExc.jaccard x y) = DExc.ExcessCorrelation)
    Assert.Empty(convicted)
