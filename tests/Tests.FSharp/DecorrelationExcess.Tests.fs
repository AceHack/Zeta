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

// ── the FINER statistic: population mutual information ─────────────────────────────────────────────────

[<Fact>]
let ``pairingMI - a perfectly coupled categorical pairing carries MI ~ ln 2; an independent one ~ 0`` () =
    // Coupled: a alternates x/y, b is a deterministic function of a (x->p, y->q) ⇒ I(A;B) = H(A) = ln 2.
    let coupled = [ for i in 0..39 -> (if i % 2 = 0 then "x", "p" else "y", "q") ]
    Assert.Equal(log 2.0, DExc.pairingMI coupled, 6)
    // Independent: a has period 2, b has period 4 ⇒ over lcm the joint factorises ⇒ I(A;B) = 0.
    let indep = [ for i in 0..39 -> ((if i % 2 = 0 then "x" else "y"), (if i % 4 < 2 then "p" else "q")) ]
    Assert.Equal(0.0, DExc.pairingMI indep, 6)

[<Fact>]
let ``permutationNullMI - yields k values and is deterministic in the seed`` () =
    let a = [ for i in 0..19 -> if i % 2 = 0 then "x" else "y" ]
    let b = [ for i in 0..19 -> if i % 2 = 0 then "p" else "q" ]
    let n1 = DExc.permutationNullMI 3UL 50 a b
    Assert.Equal(50, List.length n1)
    Assert.Equal<float list>(n1, DExc.permutationNullMI 3UL 50 a b)

[<Fact>]
let ``permutationNullMI - empty on an empty side (nan threshold ⇒ nothing convicts)`` () =
    Assert.Empty(DExc.permutationNullMI 3UL 50 [] ([] : string list))
    Assert.True(System.Double.IsNaN(DExc.nullThreshold 0.05 (DExc.permutationNullMI 3UL 50 [] ([] : string list))))

// SOUNDNESS (MI): a coupled pairing's real MI exceeds the permutation-null threshold ⇒ CONVICT; an
// independent pairing's real MI sits within the null ⇒ WITHIN NULL. The finer statistic's one-way test.
[<Fact>]
let ``SOUNDNESS (MI) - coupled convicts, independent does not (finite-sample bias absorbed by the null)`` () =
    // Coupled: b determined by a ⇒ high real MI; the shuffle destroys the coupling ⇒ low null MI.
    let aC = [ for i in 0..39 -> if i % 2 = 0 then "x" else "y" ]
    let bC = [ for i in 0..39 -> if i % 2 = 0 then "p" else "q" ]
    let nullC = DExc.permutationNullMI 7UL 200 aC bC
    Assert.Equal(DExc.ExcessCorrelation, DExc.classifyPair (DExc.nullThreshold 0.05 nullC) (DExc.pairingMI (List.zip aC bC)))
    // Independent: real MI ~ 0 is itself a draw from the null ⇒ cannot clear the (1−δ) null quantile.
    let aI = [ for i in 0..39 -> if i % 2 = 0 then "x" else "y" ]
    let bI = [ for i in 0..39 -> if i % 4 < 2 then "p" else "q" ]
    Assert.Equal(DExc.WithinNull, DExc.classifyPair (DExc.nullThreshold 0.05 (DExc.permutationNullMI 7UL 200 aI bI)) (DExc.pairingMI (List.zip aI bI)))

// ── the BLOCK-permutation null (exchangeability-respecting) ───────────────────────────────────────────

[<Fact>]
let ``blockShuffle - blockSize<=1 is the plain shuffle; blockSize>=n is the identity`` () =
    let arr = [| 0..19 |]
    Assert.Equal<int[]>(DExc.shuffle 5UL arr, DExc.blockShuffle 5UL 1 arr) // blocks of one == full shuffle
    Assert.Equal<int[]>(arr, DExc.blockShuffle 5UL 20 arr) // one block == identity

[<Fact>]
let ``blockShuffle - preserves within-block contiguity (the blocks move intact) and is a permutation`` () =
    let arr = [| 0..11 |]
    let shuffled = DExc.blockShuffle 3UL 4 arr
    Assert.Equal<int[]>(Array.sort shuffled, arr) // genuine permutation (multiset preserved)
    // every length-4 chunk of the output is one of the ORIGINAL blocks (intact, in order)
    let origBlocks = arr |> Array.chunkBySize 4 |> Set.ofArray
    let outBlocks = shuffled |> Array.chunkBySize 4 |> Set.ofArray
    Assert.Equal<Set<int[]>>(origBlocks, outBlocks)

[<Fact>]
let ``blockShuffle - deterministic in the seed`` () =
    let arr = [| 0..30 |]
    Assert.Equal<int[]>(DExc.blockShuffle 9UL 5 arr, DExc.blockShuffle 9UL 5 arr)

[<Fact>]
let ``permutationNullBlock - blockSize 1 exactly recovers permutationNull`` () =
    let a = [ set [ "x" ]; set [ "y" ]; set [ "z" ]; set [ "w" ] ]
    let b = a
    Assert.Equal<float list>(
        DExc.permutationNull 4UL 20 DExc.jaccard a b,
        DExc.permutationNullBlock 4UL 20 1 DExc.jaccard a b
    )

// THE POINT: on an AUTOCORRELATED stream (categories in runs), the block null preserves the run
// structure ⇒ its threshold is HIGHER (more conservative) than the plain shuffle's, which destroys the
// runs and understates the fluctuation. This is the fix for the over-conviction on real commit history.
[<Fact>]
let ``permutationNullMIBlock - is MORE conservative than the plain null on an autocorrelated stream`` () =
    // 40 samples in aligned runs of 4 (x,x,x,x, y,y,y,y, …); a and b identical ⇒ strong autocorrelation.
    let a = [ for i in 0..39 -> if (i / 4) % 2 = 0 then "x" else "y" ]
    let b = a
    let plain = DExc.nullThreshold 0.05 (DExc.permutationNullMI 11UL 300 a b)
    let block = DExc.nullThreshold 0.05 (DExc.permutationNullMIBlock 11UL 300 4 a b)
    Assert.True(block > plain, sprintf "block null (%.4f) should exceed the plain null (%.4f) on autocorrelated data" block plain)

// ── the WITHIN-ERA (windowed) null ────────────────────────────────────────────────────────────────────

[<Fact>]
let ``windowShuffle - windowSize<=1 is identity; windowSize>=n is the plain shuffle`` () =
    let arr = [| 0..19 |]
    Assert.Equal<int[]>(arr, DExc.windowShuffle 5UL 1 arr) // window of one can't permute
    Assert.Equal<int[]>(DExc.shuffle 5UL arr, DExc.windowShuffle 5UL 20 arr) // one window == plain shuffle

[<Fact>]
let ``windowShuffle - keeps each window's MEMBERSHIP in place (only contents permute) and is a permutation`` () =
    let arr = [| 0..11 |]
    let shuffled = DExc.windowShuffle 3UL 4 arr
    Assert.Equal<int[]>(Array.sort shuffled, arr) // genuine permutation
    // each length-4 window stays in place set-wise: output[0..3]={0..3}, [4..7]={4..7}, [8..11]={8..11}
    Assert.Equal<Set<int>>(Set.ofArray shuffled.[0..3], Set.ofList [ 0..3 ])
    Assert.Equal<Set<int>>(Set.ofArray shuffled.[4..7], Set.ofList [ 4..7 ])
    Assert.Equal<Set<int>>(Set.ofArray shuffled.[8..11], Set.ofList [ 8..11 ])

[<Fact>]
let ``windowShuffle - deterministic in the seed`` () =
    let arr = [| 0..30 |]
    Assert.Equal<int[]>(DExc.windowShuffle 9UL 6 arr, DExc.windowShuffle 9UL 6 arr)

// THE POINT: coupling that is ONLY era-level marginal (both sides constant WITHIN an era, differing
// ACROSS eras) is a benign era common cause. The plain null shuffles across eras ⇒ destroys the marginal
// ⇒ CONVICTS (false). The within-era null re-pairs only inside a window ⇒ its marginals match ⇒ it does
// NOT convict — it strips the era coupling, as intended.
[<Fact>]
let ``permutationNullMIWindow - refuses era-marginal-only coupling that the plain null convicts`` () =
    // era 1 = first 20 all "x", era 2 = next 20 all "y"; a and b identical ⇒ coupling is purely era-level.
    let a = [ for i in 0..39 -> if i < 20 then "x" else "y" ]
    let b = a
    let realMI = DExc.pairingMI (List.zip a b)
    let plainThr = DExc.nullThreshold 0.05 (DExc.permutationNullMI 3UL 200 a b)
    let windowThr = DExc.nullThreshold 0.05 (DExc.permutationNullMIWindow 3UL 200 20 a b) // window = era
    Assert.Equal(DExc.ExcessCorrelation, DExc.classifyPair plainThr realMI) // plain: false conviction
    Assert.Equal(DExc.WithinNull, DExc.classifyPair windowThr realMI) // within-era: correctly no excess

// ── the COMBINED within-era block null ────────────────────────────────────────────────────────────────

[<Fact>]
let ``windowBlockShuffle - blockSize 1 is the window null; windowSize>=n is the block null`` () =
    let arr = [| 0..23 |]
    Assert.Equal<int[]>(DExc.windowShuffle 5UL 6 arr, DExc.windowBlockShuffle 5UL 6 1 arr) // block of one within window
    Assert.Equal<int[]>(DExc.blockShuffle 5UL 4 arr, DExc.windowBlockShuffle 5UL 24 4 arr) // one window == block null

[<Fact>]
let ``windowBlockShuffle - keeps window membership AND within-window block contiguity; is a permutation`` () =
    let arr = [| 0..23 |] // windows of 12, blocks of 4
    let shuffled = DExc.windowBlockShuffle 3UL 12 4 arr
    Assert.Equal<int[]>(Array.sort shuffled, arr) // genuine permutation
    // window membership preserved: first 12 stay {0..11}, last 12 stay {12..23}
    Assert.Equal<Set<int>>(Set.ofArray shuffled.[0..11], Set.ofList [ 0..11 ])
    Assert.Equal<Set<int>>(Set.ofArray shuffled.[12..23], Set.ofList [ 12..23 ])
    // block contiguity preserved: every length-4 chunk is one of the ORIGINAL blocks (intact)
    let origBlocks = arr |> Array.chunkBySize 4 |> Set.ofArray
    Assert.Equal<Set<int[]>>(origBlocks, shuffled |> Array.chunkBySize 4 |> Set.ofArray)

[<Fact>]
let ``windowBlockShuffle - deterministic in the seed`` () =
    let arr = [| 0..31 |]
    Assert.Equal<int[]>(DExc.windowBlockShuffle 9UL 8 2 arr, DExc.windowBlockShuffle 9UL 8 2 arr)

// THE POINT: on data with BOTH era structure AND fine autocorrelation, the combined null preserves both,
// so its threshold is >= BOTH the block null's and the window null's — the most conservative of the family.
[<Fact>]
let ``permutationNullMIWindowBlock - threshold dominates both the block and window nulls`` () =
    // era 1 (0..19) categories x/z in runs of 4; era 2 (20..39) categories y/w in runs of 4. a=b.
    // Fine autocorrelation (runs of 4) AND era marginal shift (x,z → y,w) both present.
    let cat i =
        let era = i / 20
        let run = (i % 20) / 4 % 2
        match era, run with
        | 0, 0 -> "x"
        | 0, _ -> "z"
        | _, 0 -> "y"
        | _, _ -> "w"
    let a = [ for i in 0..39 -> cat i ]
    let b = a
    let thr f = DExc.nullThreshold 0.05 f
    let blockT = thr (DExc.permutationNullMIBlock 11UL 300 4 a b)
    let windowT = thr (DExc.permutationNullMIWindow 11UL 300 20 a b)
    let combinedT = thr (DExc.permutationNullMIWindowBlock 11UL 300 20 4 a b)
    Assert.True(combinedT >= blockT, sprintf "combined %.4f should dominate block %.4f" combinedT blockT)
    Assert.True(combinedT >= windowT, sprintf "combined %.4f should dominate window %.4f" combinedT windowT)
