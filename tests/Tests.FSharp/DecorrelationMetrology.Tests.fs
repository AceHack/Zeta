module Zeta.Tests.DecorrelationMetrologyTests

open global.Xunit
open Zeta.Core

module DM = Zeta.Core.DecorrelationMetrology

// ═══════════════════════════════════════════════════════════════════
// DecorrelationMetrology — the SENSOR layer of the decorrelation meter (metrology ≠ meter).
// Metrology = sensors (which spacelike commit pairs to read); the meter = fusion (→ S + margin),
// a SEPARATE layer not tested here. These tests prove only the register-2 graph fact: which pairs
// are spacelike (concurrent) in a commit DAG — pure, deterministic, byte-lockable.
//
// The golden fork/diamond DAG:
//        A
//        |
//        B
//       / \
//      C   D        <- C,D spacelike (the fork tips)
//      |   |
//      E   F        <- E,F spacelike; also C,F and D,E cross-spacelike
//       \ /
//        G          <- merge: ordered with ALL its ancestors
// ═══════════════════════════════════════════════════════════════════

let private dag : Map<string, string list> =
    Map.ofList
        [ "A", []
          "B", [ "A" ]
          "C", [ "B" ]
          "D", [ "B" ]
          "E", [ "C" ]
          "F", [ "D" ]
          "G", [ "E"; "F" ] ]

let private allCommits = [ "A"; "B"; "C"; "D"; "E"; "F"; "G" ]

// The load-bearing byte-lock: the exact spacelike-pair set of the fork DAG, in canonical order.
[<Fact>]
let ``golden vector - spacelike pairs of the fork DAG`` () =
    let expected = [ ("C", "D"); ("C", "F"); ("D", "E"); ("E", "F") ]
    Assert.Equal<(string * string) list>(expected, DM.spacelikeCommitPairs dag allCommits)

[<Fact>]
let ``ancestors are the strict causal past`` () =
    Assert.Equal<Set<string>>(Set.ofList [ "C"; "B"; "A" ], DM.ancestors dag "E")
    Assert.Equal<Set<string>>(Set.empty, DM.ancestors dag "A")
    Assert.Equal<Set<string>>(Set.ofList [ "E"; "F"; "C"; "D"; "B"; "A" ], DM.ancestors dag "G")

// A linear chain is fully time-ordered: zero spacelike pairs.
[<Fact>]
let ``a linear chain has no spacelike pairs`` () =
    let chain = Map.ofList [ "A", []; "B", [ "A" ]; "C", [ "B" ]; "D", [ "C" ] ]
    Assert.Empty(DM.spacelikeCommitPairs chain [ "A"; "B"; "C"; "D" ])

[<Fact>]
let ``fork tips are spacelike; a merge is ordered with all its ancestors`` () =
    Assert.True(DM.concurrent dag "C" "D") // the fork tips
    Assert.False(DM.concurrent dag "A" "G") // A is an ancestor of G
    Assert.False(DM.concurrent dag "E" "G") // E is an ancestor of the merge G

// concurrency is symmetric and irreflexive (relation hygiene).
[<Fact>]
let ``concurrent is symmetric and irreflexive`` () =
    for a in allCommits do
        Assert.False(DM.concurrent dag a a)
        for b in allCommits do
            Assert.Equal(DM.concurrent dag a b, DM.concurrent dag b a)

// For DISTINCT commits in a DAG, exactly one of {ordered, concurrent} holds (dichotomy):
// ordered = one is an ancestor of the other; concurrent = neither. Never both, never neither.
[<Fact>]
let ``order and concurrency are exclusive and exhaustive for distinct commits`` () =
    for a in allCommits do
        for b in allCommits do
            if a <> b then
                let ordered = DM.dominates dag a b || DM.dominates dag b a
                let conc = DM.concurrent dag a b
                Assert.True(ordered <> conc) // XOR: exactly one

// ── git-read parser (parseRevListParents) ────────────────────────────────────────────────────────

// `git rev-list --parents` output for the fork DAG (children-first, as git emits it): first token is
// the commit, the rest are parents (root A has none; merge G has two).
let private revList =
    "G E F\n\
     F D\n\
     E C\n\
     D B\n\
     C B\n\
     B A\n\
     A\n"

[<Fact>]
let ``parseRevListParents reconstructs the DAG (roots, normals, merges)`` () =
    Assert.Equal<Map<string, string list>>(dag, DM.parseRevListParents revList)

[<Fact>]
let ``parseRevListParents - root has no parents, merge has two`` () =
    let m = DM.parseRevListParents revList
    Assert.Equal<string list>([], m.["A"]) // root
    Assert.Equal<string list>([ "B" ], m.["C"]) // normal
    Assert.Equal<string list>([ "E"; "F" ], m.["G"]) // merge

[<Fact>]
let ``parseRevListParents tolerates blank lines and extra whitespace`` () =
    let noisy = "\n  G   E F \n\nF\tD\n\n"
    let m = DM.parseRevListParents noisy
    Assert.Equal<string list>([ "E"; "F" ], m.["G"])
    Assert.Equal<string list>([ "D" ], m.["F"])
    Assert.Equal(2, m.Count)

// The whole input pipeline, end to end (register-2, byte-locked): rev-list text → DAG → spacelike set.
[<Fact>]
let ``golden pipeline - rev-list text to spacelike pairs`` () =
    let m = DM.parseRevListParents revList
    let expected = [ ("C", "D"); ("C", "F"); ("D", "E"); ("E", "F") ]
    Assert.Equal<(string * string) list>(expected, DM.spacelikeCommitPairs m allCommits)

// ── generation number (the pure causal-temporal ordinal for block-permutation ordering) ──────────────
[<Fact>]
let ``generation - chain increments, fork siblings tie, merge takes 1 + max of parents`` () =
    // R -> A -> B (chain); R -> M (fork sib of A); D merges A and M ⇒ gen(D)=1+max(1,1)=2.
    let dag = Map.ofList [ "R", []; "A", [ "R" ]; "B", [ "A" ]; "M", [ "R" ]; "D", [ "A"; "M" ] ]
    let g = DM.generation dag
    Assert.Equal(0, g.["R"])
    Assert.Equal(1, g.["A"])
    Assert.Equal(2, g.["B"])
    Assert.Equal(1, g.["M"])
    Assert.Equal(2, g.["D"]) // 1 + max(gen A=1, gen M=1)
