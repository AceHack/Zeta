module Zeta.Tests.DecorrelationExcessFusionTests

open global.Xunit
open Zeta.Core

module DEF = Zeta.Core.DecorrelationExcessFusion
module DExc = Zeta.Core.DecorrelationExcess

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
// DecorrelationExcessFusion — the DAG layer. Tests prove the WIRING: spacelike-only metering,
// missing-observable skip, Reichenbach stratification by shared-ancestor count, order-independence, and
// the end-to-end coupled-vs-independent discrimination THROUGH the DAG. The statistical soundness of the
// null itself is DecorrelationExcess's own concern.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════

let private set (xs: string list) : Set<string> = Set.ofList xs

// Fork DAG: R root; A,B both children of R ⇒ A,B are SPACELIKE, shared ancestors = {R} (count 1).
let private forkDag = Map.ofList [ "R", []; "A", [ "R" ]; "B", [ "R" ] ]
// Chain DAG: B is a child of A ⇒ A,B are TIMELIKE (ancestor-related), excluded from metering.
let private chainDag = Map.ofList [ "A", []; "B", [ "A" ] ]

// ── sharedAncestorCount (the Reichenbach confounder magnitude) ────────────────────────────────────────

[<Fact>]
let ``sharedAncestorCount - fork siblings share exactly the root`` () =
    Assert.Equal(1, DEF.sharedAncestorCount forkDag "A" "B") // both ancestors = {R}

[<Fact>]
let ``sharedAncestorCount - two-level fork siblings share both ancestors`` () =
    // R -> M -> C,D : ancestors(C) = ancestors(D) = {M,R} ⇒ shared count 2.
    let dag = Map.ofList [ "R", []; "M", [ "R" ]; "C", [ "M" ]; "D", [ "M" ] ]
    Assert.Equal(2, DEF.sharedAncestorCount dag "C" "D")

// ── spacelike-only metering + skip ────────────────────────────────────────────────────────────────────

[<Fact>]
let ``fuse meters spacelike pairs ONLY - a timelike pair is excluded`` () =
    let obs = Map.ofList [ "A", set [ "f" ]; "B", set [ "f" ] ]
    let reading = DEF.fuse 1UL 0.3 100 id chainDag obs [ "A"; "B" ]
    Assert.Equal(0, reading.SpacelikePairs) // A,B timelike ⇒ nothing metered

[<Fact>]
let ``fuse skips a pair missing an observable on either end`` () =
    let obs = Map.ofList [ "A", set [ "f" ] ] // B has no observable
    let reading = DEF.fuse 1UL 0.3 100 id forkDag obs [ "A"; "B" ]
    Assert.Equal(0, reading.SpacelikePairs)

// ── Reichenbach stratification ────────────────────────────────────────────────────────────────────────

[<Fact>]
let ``fuse conditions on shared-ancestor strata - two bands give two strata`` () =
    // R -> A,B (share {R}, count 1); R -> M -> C,D (C,D share {M,R}, count 2). With stratumKey=id the
    // count-1 pairs and the count-2 pair (C,D) fall in DIFFERENT strata.
    let dag = Map.ofList [ "R", []; "A", [ "R" ]; "B", [ "R" ]; "M", [ "R" ]; "C", [ "M" ]; "D", [ "M" ] ]
    let obs = [ "A"; "B"; "C"; "D"; "M" ] |> List.map (fun c -> c, set [ c ]) |> Map.ofList
    let reading = DEF.fuse 1UL 0.3 100 id dag obs [ "A"; "B"; "C"; "D"; "M" ]
    Assert.Equal(2, reading.Strata) // count-1 band and count-2 band

// ── order-independence (DST) ──────────────────────────────────────────────────────────────────────────

[<Fact>]
let ``fuse is order-independent in the commits list`` () =
    let dag = Map.ofList [ "R", []; "A", [ "R" ]; "B", [ "R" ]; "C", [ "R" ]; "D", [ "R" ] ]
    let obs = [ "A"; "B"; "C"; "D" ] |> List.map (fun c -> c, set [ c ]) |> Map.ofList
    let r1 = DEF.fuse 7UL 0.3 100 id dag obs [ "A"; "B"; "C"; "D" ]
    let r2 = DEF.fuse 7UL 0.3 100 id dag obs [ "D"; "C"; "B"; "A" ]
    Assert.Equal(r1, r2)

// ── end-to-end discrimination THROUGH the DAG ─────────────────────────────────────────────────────────

// Twin-fork: root R with 4 coupled twin-pairs of children (a{i}, b{i}). Each twin shares a UNIQUE marker
// "s{i}" (a common cause) plus its OWN unique noise file, so a real twin pair overlaps (jaccard 1/3) while
// a cross pair is disjoint (0). Because the noise is unique per commit, a permuted re-pairing coincides
// only when a twin's two sides meet — a rare event well below δ — so the null threshold sits at 0 and the
// coupled twins stand out. This shows the instrument DISCRIMINATES coupled from independent THROUGH the
// DAG (exact conviction count is the core's concern; here we assert detection happened).
[<Fact>]
let ``fuse detects the coupled twins as excess (discrimination through the DAG)`` () =
    let children = [ "a0"; "b0"; "a1"; "b1"; "a2"; "b2"; "a3"; "b3" ]
    let dag = ("R", []) :: (children |> List.map (fun c -> c, [ "R" ])) |> Map.ofList
    // a{i} and b{i} share marker "s{i}"; each also has a unique noise file "u<name>".
    let obs =
        children
        |> List.map (fun c -> c, set [ "s" + string c.[1]; "u" + c ])
        |> Map.ofList
    let reading = DEF.fuse 2024UL 0.3 200 id dag obs children
    Assert.Equal(28, reading.SpacelikePairs) // C(8,2)
    Assert.Equal(1, reading.Strata) // all share exactly {R}
    Assert.True(reading.Excess >= 1, sprintf "expected the coupled twins to be detected, got Excess=%d" reading.Excess)
    Assert.Equal(reading.SpacelikePairs, reading.Excess + reading.WithinNull) // counts partition

// The independent control: 8 children each touching a DISTINCT file, no twins ⇒ every real pair AND every
// permuted pair is disjoint ⇒ null all-zero, nothing exceeds it (no false green through the DAG).
[<Fact>]
let ``fuse convicts nothing when every commit is independent (no false green)`` () =
    let children = [ "c0"; "c1"; "c2"; "c3"; "c4"; "c5"; "c6"; "c7" ]
    let dag = ("R", []) :: (children |> List.map (fun c -> c, [ "R" ])) |> Map.ofList
    let obs = children |> List.map (fun c -> c, set [ "u_" + c ]) |> Map.ofList // all distinct
    let reading = DEF.fuse 2024UL 0.05 200 id dag obs children
    Assert.Equal(28, reading.SpacelikePairs)
    Assert.Equal(0, reading.Excess)

// Degenerate: every commit touches the SAME file ⇒ real pairs AND the null are all jaccard 1.0 ⇒ there is
// no EXCESS over the (saturated) baseline ⇒ nothing convicts. The honest no-false-green on a uniform pop.
[<Fact>]
let ``fuse finds no excess when every commit is identical (uniform baseline, not coupling)`` () =
    let children = [ "c0"; "c1"; "c2"; "c3"; "c4"; "c5" ]
    let dag = ("R", []) :: (children |> List.map (fun c -> c, [ "R" ])) |> Map.ofList
    let obs = children |> List.map (fun c -> c, set [ "same" ]) |> Map.ofList // all identical
    let reading = DEF.fuse 2024UL 0.05 200 id dag obs children
    Assert.Equal(0, reading.Excess) // 1.0 is the baseline, not excess above it

// ── fuseMI: the finer lens (per-stratum excess mutual information) — wiring ────────────────────────────

// Two ancestor bands (as in the fuse stratification test) ⇒ two MIStratum readings, one per band, each
// reporting its pair count. (Statistical power of the MI test itself lives in the DecorrelationExcess
// core tests, where the pairing is controlled directly.)
[<Fact>]
let ``fuseMI conditions on shared-ancestor strata - one MIStratum per band, pair counts intact`` () =
    let dag = Map.ofList [ "R", []; "A", [ "R" ]; "B", [ "R" ]; "M", [ "R" ]; "C", [ "M" ]; "D", [ "M" ] ]
    let cats = [ "A"; "B"; "C"; "D"; "M" ] |> List.map (fun c -> c, c) |> Map.ofList // primary-subsystem stand-in
    let reading = DEF.fuseMI 1UL 0.05 200 id dag cats [ "A"; "B"; "C"; "D"; "M" ]
    Assert.Equal(2, List.length reading.Strata) // count-1 band and count-2 band
    // total metered pairs across MI strata match the per-pair fuse's SpacelikePairs on the same inputs.
    let obs = cats |> Map.map (fun _ v -> set [ v ])
    let jac = DEF.fuse 1UL 0.05 200 id dag obs [ "A"; "B"; "C"; "D"; "M" ]
    Assert.Equal(jac.SpacelikePairs, reading.Strata |> List.sumBy (fun s -> s.Pairs))

[<Fact>]
let ``fuseMI skips a pair missing a category on either end`` () =
    let cats = Map.ofList [ "A", "cat" ] // B has no category
    let reading = DEF.fuseMI 1UL 0.05 200 id forkDag cats [ "A"; "B" ]
    Assert.Equal(0, reading.Strata |> List.sumBy (fun s -> s.Pairs))

[<Fact>]
let ``fuseMI is order-independent in the commits list`` () =
    let dag = Map.ofList [ "R", []; "A", [ "R" ]; "B", [ "R" ]; "C", [ "R" ]; "D", [ "R" ] ]
    let cats = [ "A"; "B"; "C"; "D" ] |> List.map (fun c -> c, c) |> Map.ofList
    let r1 = DEF.fuseMI 7UL 0.05 200 id dag cats [ "A"; "B"; "C"; "D" ]
    let r2 = DEF.fuseMI 7UL 0.05 200 id dag cats [ "D"; "C"; "B"; "A" ]
    Assert.Equal(r1, r2)

// Degenerate: every concurrent commit has the SAME category ⇒ the pairing carries zero mutual information
// (B tells you nothing about A beyond the constant) ⇒ no excess-MI stratum (honest no-false-green).
[<Fact>]
let ``fuseMI finds no excess when every commit shares one category (MI is zero, not coupling)`` () =
    let children = [ "c0"; "c1"; "c2"; "c3"; "c4"; "c5" ]
    let dag = ("R", []) :: (children |> List.map (fun c -> c, [ "R" ])) |> Map.ofList
    let cats = children |> List.map (fun c -> c, "same") |> Map.ofList
    let reading = DEF.fuseMI 2024UL 0.05 200 id dag cats children
    Assert.Equal(0, reading.ExcessStrata)

// ── fuseMIBlock: the exchangeability-respecting (block-permutation) variant ────────────────────────────

// RealMI and stratum structure are order-invariant, so they match fuseMI; only the NULL differs (block
// vs plain). And fuseMIBlock is itself order-independent in the commits list (generation-ordered internally).
[<Fact>]
let ``fuseMIBlock - matches fuseMI on the order-invariant parts and is order-independent`` () =
    let dag = Map.ofList [ "R", []; "A", [ "R" ]; "B", [ "R" ]; "C", [ "R" ]; "D", [ "R" ] ]
    let cats = [ "A"; "B"; "C"; "D" ] |> List.map (fun c -> c, c) |> Map.ofList
    let m = DEF.fuseMI 7UL 0.05 200 id dag cats [ "A"; "B"; "C"; "D" ]
    let b1 = DEF.fuseMIBlock 7UL 0.05 200 1 0 id dag cats [ "A"; "B"; "C"; "D" ]
    // same strata keys + pair counts + RealMI (all order-invariant)
    Assert.Equal<(int * int) list>(
        m.Strata |> List.map (fun s -> s.Stratum, s.Pairs),
        b1.Strata |> List.map (fun s -> s.Stratum, s.Pairs)
    )
    Assert.Equal<float list>(m.Strata |> List.map (fun s -> s.RealMI), b1.Strata |> List.map (fun s -> s.RealMI))
    // order-independent in the commits list
    Assert.Equal(b1, DEF.fuseMIBlock 7UL 0.05 200 1 0 id dag cats [ "D"; "C"; "B"; "A" ])

[<Fact>]
let ``fuseMIBlock - uniform category yields no excess (honest no-false-green)`` () =
    let children = [ "c0"; "c1"; "c2"; "c3"; "c4"; "c5" ]
    let dag = ("R", []) :: (children |> List.map (fun c -> c, [ "R" ])) |> Map.ofList
    let cats = children |> List.map (fun c -> c, "same") |> Map.ofList
    Assert.Equal(0, (DEF.fuseMIBlock 2024UL 0.05 200 3 0 id dag cats children).ExcessStrata)

// minSharedAncestors excludes causally-disjoint pairs (no common ancestor). Two SEPARATE roots, each with
// two children: the cross-root pairs share ZERO ancestors; the same-root pairs share their root (count 1).
[<Fact>]
let ``fuseMIBlock - minSharedAncestors=1 drops the zero-shared-ancestor (cross-history) pairs`` () =
    // R1 -> A,B ; R2 -> C,D (two disjoint histories). Spacelike pairs: within-root share 1 ancestor;
    // cross-root (A,C),(A,D),(B,C),(B,D) share 0.
    let dag = Map.ofList [ "R1", []; "A", [ "R1" ]; "B", [ "R1" ]; "R2", []; "C", [ "R2" ]; "D", [ "R2" ] ]
    let cats = [ "A"; "B"; "C"; "D"; "R1"; "R2" ] |> List.map (fun c -> c, c) |> Map.ofList
    let commits = [ "A"; "B"; "C"; "D"; "R1"; "R2" ]
    let all = DEF.fuseMIBlock 1UL 0.05 100 4 0 id dag cats commits // meter everything (incl. shared=0)
    let conditioned = DEF.fuseMIBlock 1UL 0.05 100 4 1 id dag cats commits // exclude shared=0
    let pairsOf (r: DEF.MIReading) = r.Strata |> List.sumBy (fun s -> s.Pairs)
    Assert.True(pairsOf all > pairsOf conditioned) // the zero-shared-ancestor pairs are removed
    // no metered pair in the conditioned run has a zero-shared-ancestor stratum key (band 0 under id)
    Assert.DoesNotContain(0, conditioned.Strata |> List.map (fun s -> s.Stratum))
