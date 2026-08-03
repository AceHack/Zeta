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
