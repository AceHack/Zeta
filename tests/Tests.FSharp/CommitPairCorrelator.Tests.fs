module Zeta.Tests.CommitPairCorrelatorTests

open Xunit
open Zeta.Core

// ── Helpers ────────────────────────────────────────────────────────────────────────────────────────
/// A simple linear DAG: c0 ← c1 ← c2 ← ... ← cn
let private linearDag (n: int) : Map<int, int list> =
    [ for i in 1..n -> (i, [i - 1]) ] |> Map.ofList |> Map.add 0 []

/// A fork DAG: c0 ← c1 ← c2, c0 ← c3 ← c4 (two branches from c0)
let private forkDag : Map<int, int list> =
    Map.ofList [ 0, []; 1, [0]; 2, [1]; 3, [0]; 4, [3] ]

// ── CPC-1: SoundnessNote is non-empty and mentions CHSH ──────────────────────────────────────────
[<Fact>]
let ``CPC-1 SoundnessNote is non-empty and mentions CHSH`` () =
    Assert.False(System.String.IsNullOrWhiteSpace(CommitPairCorrelator.SoundnessNote))
    Assert.Contains("CHSH", CommitPairCorrelator.SoundnessNote)
    Assert.Contains("ill-posed", CommitPairCorrelator.SoundnessNote)

// ── CPC-2: Empty commit set → no pairs metered ───────────────────────────────────────────────────
[<Fact>]
let ``CPC-2 empty commit set produces no metered pairs`` () =
    let report = CommitPairCorrelator.correlateDefault<int, int> Map.empty Map.empty []
    Assert.Equal(0, report.MeteredPairs)
    Assert.Equal(0, report.CommitCount)
    Assert.Equal(0, report.ProbedCommits)

// ── CPC-3: Linear DAG has no spacelike pairs (all timelike) → no pairs metered ──────────────────
[<Fact>]
let ``CPC-3 linear DAG has no spacelike pairs — no pairs metered`` () =
    let dag = linearDag 5
    let probes = [ for i in 0..5 -> (i, i % 2) ] |> Map.ofList
    let commits = [ 0..5 ]
    let report = CommitPairCorrelator.correlateDefault dag probes commits
    Assert.Equal(0, report.MeteredPairs)

// ── CPC-4: Fork DAG has spacelike pairs (c2, c4) — both branches from c0 ────────────────────────
[<Fact>]
let ``CPC-4 fork DAG has spacelike pair (c2, c4) — metered`` () =
    let probes = Map.ofList [ 0, 0; 1, 0; 2, 1; 3, 0; 4, 1 ]
    let commits = [ 0; 1; 2; 3; 4 ]
    let report = CommitPairCorrelator.correlateDefault forkDag probes commits
    // c2 and c4 are spacelike (neither is ancestor of the other)
    Assert.True(report.MeteredPairs >= 1, sprintf "Expected >= 1 metered pair, got %d" report.MeteredPairs)

// ── CPC-5: Report carries SoundnessNote and InterpretationPolicy ─────────────────────────────────
[<Fact>]
let ``CPC-5 report carries SoundnessNote and InterpretationPolicy`` () =
    let report = CommitPairCorrelator.correlateDefault<int, int> Map.empty Map.empty []
    Assert.Equal(CommitPairCorrelator.SoundnessNote, report.SoundnessNote)
    Assert.Equal(CommitPairCorrelator.InterpretationPolicy, report.InterpretationPolicy)

// ── CPC-6: isExcess is false for empty DAG ───────────────────────────────────────────────────────
[<Fact>]
let ``CPC-6 isExcess is false for empty DAG`` () =
    let report = CommitPairCorrelator.correlateDefault<int, int> Map.empty Map.empty []
    Assert.False(CommitPairCorrelator.isExcess report)

// ── CPC-7: excessFraction is nan for empty DAG ───────────────────────────────────────────────────
[<Fact>]
let ``CPC-7 excessFraction is nan for empty DAG`` () =
    let report = CommitPairCorrelator.correlateDefault<int, int> Map.empty Map.empty []
    Assert.True(System.Double.IsNaN(CommitPairCorrelator.excessFraction report))

// ── CPC-8: Deterministic replay (DST §7) ─────────────────────────────────────────────────────────
[<Fact>]
let ``CPC-8 deterministic replay: same inputs always produce same report`` () =
    let dag = forkDag
    let probes = Map.ofList [ 0, 0; 1, 0; 2, 1; 3, 0; 4, 1 ]
    let commits = [ 0; 1; 2; 3; 4 ]
    let r1 = CommitPairCorrelator.correlateDefault dag probes commits
    let r2 = CommitPairCorrelator.correlateDefault dag probes commits
    Assert.Equal(r1.MeteredPairs, r2.MeteredPairs)
    Assert.Equal(r1.Reading.ExcessStrata, r2.Reading.ExcessStrata)
    Assert.Equal(r1.CommitCount, r2.CommitCount)
    Assert.Equal(r1.ProbedCommits, r2.ProbedCommits)

// ── CPC-9: CommitCount matches input list length ──────────────────────────────────────────────────
[<Fact>]
let ``CPC-9 CommitCount matches input list length`` () =
    let dag = forkDag
    let probes = Map.ofList [ 0, 0; 1, 0; 2, 1; 3, 0; 4, 1 ]
    let commits = [ 0; 1; 2; 3; 4 ]
    let report = CommitPairCorrelator.correlateDefault dag probes commits
    Assert.Equal(5, report.CommitCount)

// ── CPC-10: ProbedCommits counts only commits with a probe ───────────────────────────────────────
[<Fact>]
let ``CPC-10 ProbedCommits counts only commits with an assigned probe observable`` () =
    let dag = forkDag
    // Only probe 3 out of 5 commits
    let probes = Map.ofList [ 0, 0; 2, 1; 4, 1 ]
    let commits = [ 0; 1; 2; 3; 4 ]
    let report = CommitPairCorrelator.correlateDefault dag probes commits
    Assert.Equal(3, report.ProbedCommits)

// ── CPC-11: Custom config is respected (different seed → same structure) ─────────────────────────
[<Fact>]
let ``CPC-11 custom config: different seed produces same MeteredPairs (seed only affects null)`` () =
    let dag = forkDag
    let probes = Map.ofList [ 0, 0; 1, 0; 2, 1; 3, 0; 4, 1 ]
    let commits = [ 0; 1; 2; 3; 4 ]
    let config1 = { CommitPairCorrelator.defaultConfig with Seed = 42UL }
    let config2 = { CommitPairCorrelator.defaultConfig with Seed = 999UL }
    let r1 = CommitPairCorrelator.correlate dag probes commits config1
    let r2 = CommitPairCorrelator.correlate dag probes commits config2
    // MeteredPairs is determined by the DAG structure, not the seed
    Assert.Equal(r1.MeteredPairs, r2.MeteredPairs)
    Assert.Equal(r1.CommitCount, r2.CommitCount)
