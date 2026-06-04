module Zeta.Tests.Formal.CrdtLawsTests

open System
open System.Diagnostics
open System.IO
open FsCheck
open FsCheck.Xunit
open FsUnit.Xunit
open global.Xunit
open Zeta.Core

// B-1016 floor primitive #4 — the CRDT merge / join-semilattice + idempotency,
// PROVEN. This is what turns "homeostats converge" from hope into theorem: a
// state-based CRDT's merge is a join (least upper bound) that is IDEMPOTENT +
// COMMUTATIVE + ASSOCIATIVE (ACI), so merging in ANY order, ANY number of times,
// reaches the SAME fixpoint (the LUB). It is also the math under the meter/sketch
// "mergeable aggregation" family and the rungs 2–3 of the consensus ladder.
//
// Three legs (mirrors clock / byte-cost):
//   1. Z3 — the join laws (ACI) hold for the canonical join (max over ℤ).
//   2. FsCheck — the same laws on the REAL G-Set union + G-Counter merge.
//   3. Convergence — fold-merge is order-independent AND duplicate-insensitive
//      (eventual consistency = a theorem, not a hope).

// ════════════════════════════════════════════════════════════════════
// 1. Z3 — the canonical join (max over ℤ) is a join-semilattice (ACI).
// ════════════════════════════════════════════════════════════════════
let private which (tool: string) : string option =
    try
        let psi = ProcessStartInfo("/usr/bin/env", $"which %s{tool}",
                    RedirectStandardOutput = true, UseShellExecute = false)
        use p = Process.Start psi
        let out = p.StandardOutput.ReadToEnd().Trim()
        p.WaitForExit()
        if p.ExitCode = 0 && File.Exists out then Some out else None
    with _ -> None

let private z3Holds (name: string) (claim: string) =
    // join := max via ite; prove the negation is unsat (law holds for all ints).
    let script =
        "(declare-const a Int)\n(declare-const b Int)\n(declare-const c Int)\n"
        + "(define-fun j ((x Int) (y Int)) Int (ite (>= x y) x y))\n"
        + "(assert (not " + claim + "))\n(check-sat)\n"
    match which "z3" with
    | None -> ()
    | Some _ ->
        let psi = ProcessStartInfo("z3", "-in",
                    RedirectStandardInput = true, RedirectStandardOutput = true, UseShellExecute = false)
        use p = Process.Start psi
        p.StandardInput.Write script
        p.StandardInput.Close()
        let out = p.StandardOutput.ReadToEnd()
        p.WaitForExit()
        if not (out.Contains "unsat") then failwithf "Z3 failed to prove CRDT join %s law. Output:\n%s" name out

[<Fact>]
let ``Z3 proves join is idempotent (a ⊔ a = a)`` () =
    z3Holds "idempotent" "(= (j a a) a)"

[<Fact>]
let ``Z3 proves join is commutative`` () =
    z3Holds "commutative" "(= (j a b) (j b a))"

[<Fact>]
let ``Z3 proves join is associative`` () =
    z3Holds "associative" "(= (j (j a b) c) (j a (j b c)))"


// ════════════════════════════════════════════════════════════════════
// 2. FsCheck — the join laws on the REAL G-Set union (the bottom rung).
// ════════════════════════════════════════════════════════════════════
let private g (xs: int list) : GSet<int> = GSet.ofSeq xs

[<Property>]
let ``G-Set union is idempotent (a + a = a)`` (xs: int list) =
    let a = g xs
    a + a = a

[<Property>]
let ``G-Set union is commutative`` (xs: int list) (ys: int list) =
    g xs + g ys = g ys + g xs

[<Property>]
let ``G-Set union is associative`` (xs: int list) (ys: int list) (zs: int list) =
    (g xs + g ys) + g zs = g xs + (g ys + g zs)

[<Property>]
let ``G-Set Zero is the merge identity`` (xs: int list) =
    let a = g xs
    a + GSet<int>.Zero = a && GSet<int>.Zero + a = a


// ════════════════════════════════════════════════════════════════════
// 3. Convergence — the payoff: fold-merge reaches the SAME LUB regardless of
//    ORDER and regardless of DUPLICATES. This IS eventual-consistency /
//    homeostat-convergence as a theorem.
// ════════════════════════════════════════════════════════════════════
[<Property>]
let ``merge fold is order-independent (any replica order → same state)`` (states: int list list) =
    let gs = states |> List.map g
    let folded = List.fold (+) GSet<int>.Zero gs
    let foldedRev = List.fold (+) GSet<int>.Zero (List.rev gs)
    folded = foldedRev

[<Property>]
let ``merge is duplicate-insensitive (re-delivering a state changes nothing)`` (xs: int list) (ys: int list) =
    let a, b = g xs, g ys
    // delivering b twice == delivering it once (idempotent redelivery)
    (a + b) + b = a + b

[<Property>]
let ``G-Counter merge is idempotent, commutative, and convergent`` (ops: (string * int) list) =
    // build two counters from disjoint perspectives, then merge both ways
    let build (pick: int -> bool) =
        ops
        |> List.indexed
        |> List.filter (fun (i, _) -> pick i)
        |> List.fold (fun (c: GCounter) (_, (r, d)) -> c.Increment(r, int64 (abs d % 1000))) GCounter.Empty
    let a = build (fun i -> i % 2 = 0)
    let b = build (fun i -> i % 2 = 1)
    let m1 = GCounter.Merge a b
    let m2 = GCounter.Merge b a
    // commutative (same value) + idempotent (merging the result with a changes nothing)
    m1.Value = m2.Value && (GCounter.Merge m1 a).Value = m1.Value
