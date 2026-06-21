module Zeta.Tests.Formal.MerkleLawsTests

open System
open System.Diagnostics
open System.IO
open FsCheck
open FsCheck.Xunit
open global.Xunit
open Zeta.Core

// 081KT7YW00008QG0R002T1XNWT floor primitive #3 — Merkle integrity, MATH LEG. This is what makes
// "lightlike history" provable: tamper-evidence means the past cannot be silently
// rewritten, so the derived curve/curvature are trustworthy.
//
// HONEST SCOPE (search-last-not-excluded / premise-flagged): we prove the
// STRUCTURAL tamper-evidence — "equal roots ⟹ equal leaves" — GIVEN an injective
// `combine`. The hash being collision-resistant (the crypto premise) is NOT
// proven here (it's a 128-bit non-cryptographic digest; Byzantine integrity needs
// a real CR hash — see Merkle.fs doc). So: structure proven, crypto premise named.
//   1. Z3 — given injective combine, a 4-leaf tree's root determines all 4 leaves.
//   2. FsCheck — on the REAL MerkleTree: determinism, single-leaf tamper changes
//      the root, LeafDiff pinpoints exactly the changed indices, order matters.

// ── full-script Z3 runner (this proof needs sorts + a quantified axiom) ──
let private which (tool: string) : string option =
    try
        let psi = ProcessStartInfo("/usr/bin/env", $"which %s{tool}",
                    RedirectStandardOutput = true, UseShellExecute = false)
        use p = Process.Start psi
        let out = p.StandardOutput.ReadToEnd().Trim()
        p.WaitForExit()
        if p.ExitCode = 0 && File.Exists out then Some out else None
    with _ -> None

let private z3Unsat (name: string) (script: string) =
    match which "z3" with
    | None -> ()  // z3 absent — CI installs it; skip cleanly.
    | Some _ ->
        let psi = ProcessStartInfo("z3", "-in",
                    RedirectStandardInput = true, RedirectStandardOutput = true, UseShellExecute = false)
        use p = Process.Start psi
        p.StandardInput.Write script
        p.StandardInput.Close()
        let out = p.StandardOutput.ReadToEnd()
        p.WaitForExit()
        if not (out.Contains "unsat") then failwithf "Z3 failed to prove Merkle %s. Output:\n%s" name out

[<Fact>]
let ``Z3 proves tamper-evidence: given injective combine, the 4-leaf root determines all leaves`` () =
    // H = hash sort; comb = combine, asserted injective. A 4-leaf Merkle root is
    // comb(comb(l0,l1), comb(l2,l3)). Prove: equal roots ⟹ all four leaves equal.
    // (If this is unsat, no leaf can change without changing the root — tamper-evidence,
    //  reduced to the injectivity premise the crypto hash is responsible for.)
    let script =
        """(declare-sort H)
(declare-fun comb (H H) H)
(assert (forall ((a H) (b H) (c H) (d H))
  (=> (= (comb a b) (comb c d)) (and (= a c) (= b d)))))
(declare-const l0 H) (declare-const l1 H) (declare-const l2 H) (declare-const l3 H)
(declare-const m0 H) (declare-const m1 H) (declare-const m2 H) (declare-const m3 H)
(define-fun root4 ((a H) (b H) (c H) (d H)) H (comb (comb a b) (comb c d)))
(assert (not (=> (= (root4 l0 l1 l2 l3) (root4 m0 m1 m2 m3))
                 (and (= l0 m0) (= l1 m1) (= l2 m2) (= l3 m3)))))
(check-sat)
"""
    z3Unsat "4-leaf tamper-evidence (given injective combine)" script


// ── FsCheck on the real MerkleTree ──
let private leaf (n: int) : byte[] = BitConverter.GetBytes n
let private tree (ns: int list) : MerkleTree = MerkleTree(ns |> List.map leaf |> List.toArray)
let private rootHex (t: MerkleTree) : string = t.Root.ToHex()

[<Property>]
let ``Merkle root is deterministic (same leaves → same root)`` (ns: int list) =
    let xs = if List.isEmpty ns then [ 0 ] else ns
    rootHex (tree xs) = rootHex (tree xs)

[<Property>]
let ``changing any single leaf changes the root (tamper-evidence)`` (ns: int list) (i: int) =
    let xs = if List.isEmpty ns then [ 0 ] else ns
    let idx = (abs i) % xs.Length
    // replace leaf idx with a guaranteed-different value
    let xs2 = xs |> List.mapi (fun k v -> if k = idx then v + 1 else v)
    // only assert when we actually changed the leaf set (we always do: v <> v+1)
    rootHex (tree xs) <> rootHex (tree xs2)

[<Property>]
let ``LeafDiff pinpoints exactly the changed indices`` (ns: int list) (i: int) =
    let xs = if List.length ns < 2 then [ 0; 1 ] else ns
    let idx = (abs i) % xs.Length
    let xs2 = xs |> List.mapi (fun k v -> if k = idx then v + 1 else v)
    let diff = (tree xs2).LeafDiff(tree xs) |> Array.toList
    diff = [ idx ]

[<Property>]
let ``Merkle root is order-sensitive (reordering distinct leaves changes the root)`` (a: int) (b: int) =
    a = b || rootHex (tree [ a; b ]) <> rootHex (tree [ b; a ])
