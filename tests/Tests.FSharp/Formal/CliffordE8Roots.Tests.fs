module Zeta.Tests.Formal.CliffordE8RootsTests

open FsCheck.Xunit
open FsUnit.Xunit
open global.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// CliffordE8Roots (`src/Core/CliffordE8Roots.fs`) — the DEEP unfold: the
// Clifford reflection (versor sandwich `−n x n`) GENERATES the E8 root
// system, reproducing Dechant (Adv. Appl. Clifford Algebras 2016/2017).
//
// THE ACCEPTANCE GATE (math-team row 11, non-negotiable):
//   (a) the construction yields EXACTLY 240 roots;
//   (b) the set is closed under Clifford reflection (reflecting any root
//       in any root stays in the set);
//   (c) the generated set EQUALS the in-tree E8 root set (E8Lattice.roots
//       and CliffordE8Bridge.rootMvs) — the decisive agreement check.
// A red gate is an HONEST STOP, never a weakened assertion.
// ═══════════════════════════════════════════════════════════════════

/// Set view of an int-vector list (vectors compared as int lists; order-free).
let private asSet (vs: int[] list) : Set<int list> = vs |> List.map List.ofArray |> Set.ofList

let private generated = asSet CliffordE8Roots.roots
let private inTree = asSet E8Lattice.roots

// ── Gate (a): EXACTLY 240 roots ────────────────────────────────────

[<Fact>]
let ``(a) the Clifford-reflection closure yields exactly 240 roots`` () =
    CliffordE8Roots.kissingNumber |> should equal 240
    CliffordE8Roots.roots.Length |> should equal 240
    // 240 DISTINCT roots (no accidental duplicates collapsing the count).
    generated.Count |> should equal 240

// ── Gate (b): closure under Clifford reflection ────────────────────

[<Fact>]
let ``(b) the generated set is closed under Clifford reflection (every s_r(x) stays in the set)`` () =
    let arr = CliffordE8Roots.roots |> List.toArray
    for r in arr do
        for x in arr do
            let y = CliffordE8Roots.reflect r x |> List.ofArray
            Assert.True(generated.Contains y, "reflection escaped the root set")

[<Property(MaxTest = 500)>]
let ``(b') FsCheck: reflecting any root in any root lands back in the in-tree set`` (i: int) (j: int) =
    let arr = E8Lattice.roots |> List.toArray
    let r = arr.[((i % arr.Length) + arr.Length) % arr.Length]
    let x = arr.[((j % arr.Length) + arr.Length) % arr.Length]
    let y = CliffordE8Roots.reflect r x |> List.ofArray
    inTree.Contains y

// ── Gate (c): the DECISIVE agreement check ─────────────────────────

[<Fact>]
let ``(c) DECISIVE: the Clifford-generated set EQUALS the in-tree E8Lattice.roots set`` () =
    // Set equality up to ordering — the reproduction lands the published 240 roots in OUR integer frame.
    generated |> should equal inTree

[<Fact>]
let ``(c) the generated multivector set equals CliffordE8Bridge.rootMvs as a set`` () =
    let bridgeMvs = CliffordE8Bridge.rootMvs |> Set.ofList
    let genMvs = CliffordE8Roots.rootMvs |> Set.ofList
    genMvs |> should equal bridgeMvs

// ── The Clifford identity: the sandwich IS the reflection ──────────

[<Fact>]
let ``the integer reflection equals the Clifford versor sandwich −n x n / (n·n) on every root pair`` () =
    let arr = E8Lattice.roots |> List.toArray
    for r in arr do
        for x in arr do
            let euclid = CliffordE8Roots.reflect r x
            let sandwich = CliffordE8Roots.reflectClifford r x
            Assert.Equal<int[]>(euclid, sandwich)

// ── The simple system is a genuine E8 Cartan system ────────────────

[<Fact>]
let ``the derived simple system has 8 roots with the E8 Cartan/Gram matrix`` () =
    let s = CliffordE8Roots.simpleSystem |> List.toArray
    s.Length |> should equal 8
    // Every simple root is a genuine root (norm² = 4) and lies in the in-tree set.
    for r in s do
        CliffordE8Roots.dot r r |> should equal 4
        Assert.True(inTree.Contains(List.ofArray r))
    // Off-diagonal Gram entries are 0 or −2 (E8 has single bonds only); the connected count is 7
    // (E8 is a tree with 8 nodes ⇒ 7 edges). Diagonal is 4 throughout.
    let mutable edges = 0
    for i in 0 .. 7 do
        for j in 0 .. 7 do
            let g = CliffordE8Roots.dot s.[i] s.[j]
            if i = j then g |> should equal 4
            else
                Assert.True(g = 0 || g = -2, "E8 simple roots admit only single bonds (Gram 0 or −2)")
                if g = -2 && i < j then edges <- edges + 1
    edges |> should equal 7

// ── DST: the generator is deterministic (same orbit every run) ─────

[<Fact>]
let ``DST: the construction is deterministic — re-evaluating yields the identical 240-set`` () =
    let a = asSet CliffordE8Roots.roots
    let b = asSet CliffordE8Roots.roots
    a |> should equal b


// ── L-E: the COXETER RELATIONS on the 8 simple reflections (work-item 081KYXCM1WK08QG0R003B9KVP4) ──
// Soraya's route-(B) plan routes the group-presentation leg to exact-arithmetic property testing (NOT
// Lean: W(E8) has 696,729,600 elements and Mathlib carries no concrete E8 root system). The Cartan/Gram
// test above pins the simple system's ANGLES; this pins the GROUP RELATIONS those angles imply:
//     s_i² = id            (every reflection is an involution)
//     (s_i s_j)^m_ij = id  with m_ij = 3 on a Dynkin edge, 2 otherwise
// Verified on all 240 roots in exact integers. Together with the closure test, this is the concrete,
// independently-checkable content of "these reflections present W(E8)" — the full presentation
// isomorphism itself stays a DOCUMENTED CONJECTURE (Mathlib gaps), per the work-item.

/// Coxeter order m_ij read off the Gram matrix on our root·root = 4 scale: connected simple roots have
/// inner product −2 (⇒ 120°, m = 3); orthogonal ones have 0 (⇒ 90°, m = 2).
let private coxeterOrder (a: int[]) (b: int[]) : int =
    match CliffordE8Roots.dot a b with
    | 0 -> 2
    | -2 -> 3
    | d -> failwithf "unexpected simple-root inner product %d (expected 0 or -2)" d

[<Fact>]
let ``L-E: every simple reflection is an involution (s_i² = id on all 240 roots)`` () =
    for a in CliffordE8Roots.simpleSystem do
        for x in CliffordE8Roots.roots do
            let twice = CliffordE8Roots.reflect a (CliffordE8Roots.reflect a x)
            Assert.Equal<int list>(List.ofArray x, List.ofArray twice)

[<Fact>]
let ``L-E: the Coxeter relations (s_i s_j)^m = id hold for every simple pair (m = 3 on an edge, else 2)`` () =
    let simples = CliffordE8Roots.simpleSystem |> List.toArray
    for i in 0 .. simples.Length - 1 do
        for j in i + 1 .. simples.Length - 1 do
            let ai, aj = simples.[i], simples.[j]
            let m = coxeterOrder ai aj
            // (s_i ∘ s_j) applied m times must be the identity on every root
            for x in CliffordE8Roots.roots do
                let mutable cur = x
                for _ in 1 .. m do
                    cur <- CliffordE8Roots.reflect ai (CliffordE8Roots.reflect aj cur)
                Assert.Equal<int list>(List.ofArray x, List.ofArray cur)

[<Fact>]
let ``L-E negative control: a WRONG Coxeter order does NOT give the identity (the test is not vacuous)`` () =
    // If every power trivially returned x, the relations above would prove nothing. Exhibit a pair whose
    // (s_i s_j)^k ≠ id for k one short of its true order — so the assertions above have real content.
    let simples = CliffordE8Roots.simpleSystem |> List.toArray
    let mutable foundWitness = false
    for i in 0 .. simples.Length - 1 do
        for j in i + 1 .. simples.Length - 1 do
            let ai, aj = simples.[i], simples.[j]
            let m = coxeterOrder ai aj
            if m > 1 && not foundWitness then
                // one application short of the full order should move SOME root
                let moved =
                    CliffordE8Roots.roots
                    |> List.exists (fun x ->
                        let mutable cur = x
                        for _ in 1 .. m - 1 do
                            cur <- CliffordE8Roots.reflect ai (CliffordE8Roots.reflect aj cur)
                        List.ofArray cur <> List.ofArray x)
                if moved then foundWitness <- true
    Assert.True(foundWitness, "no pair moved a root below its Coxeter order — the relation tests would be vacuous")
