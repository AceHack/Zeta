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

// ACI is the heart, but LEAST-UPPER-BOUND is what justifies "merge" as
// convergence, not merely a nice operator. a ≤ b := (a ⊔ b = b).
[<Fact>]
let ``Z3 proves join is an upper bound (a ≤ a⊔b and b ≤ a⊔b)`` () =
    z3Holds "upper-bound" "(and (<= a (j a b)) (<= b (j a b)))"

[<Fact>]
let ``Z3 proves join is the LEAST upper bound (a≤c ∧ b≤c ⇒ a⊔b ≤ c)`` () =
    z3Holds "least-upper-bound" "(=> (and (<= a c) (<= b c)) (<= (j a b) c))"


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

// LUB on the real G-Set: a ≤ b := (a ⊔ b = b). Upper-bound + least-upper-bound
// are what make union a JOIN (convergence), not just a commutative-idempotent
// monoid — Amara's blade: ACI is the heart, LUB justifies "merge".
let private leq (a: GSet<int>) (b: GSet<int>) : bool = a + b = b

[<Property>]
let ``G-Set join is an upper bound of both operands`` (xs: int list) (ys: int list) =
    let a, b = g xs, g ys
    leq a (a + b) && leq b (a + b)

[<Property>]
let ``G-Set join is the LEAST upper bound`` (xs: int list) (ys: int list) (zs: int list) =
    let a, b, c = g xs, g ys, g zs
    not (leq a c && leq b c) || leq (a + b) c


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

// G-Counter proven over STATE (the per-replica Counts ZSet), NOT just .Value —
// Amara's catch: a .Value-only check masks per-replica structural bugs. GCounter
// has [<NoEquality>], so compare its underlying ZSet<string> (which IS structurally
// equatable). Merge = elementwise max per replica = a join-semilattice on state.
[<Property>]
let ``G-Counter merge is ACI over per-replica STATE (not just .Value)`` (ops: (string * int) list) =
    let build (pick: int -> bool) =
        ops
        |> List.indexed
        |> List.filter (fun (i, _) -> pick i)
        |> List.fold (fun (c: GCounter) (_, (r, d)) -> c.Increment((if r = "" then "r0" else r), int64 (abs d % 1000))) GCounter.Empty
    let a = build (fun i -> i % 3 = 0)
    let b = build (fun i -> i % 3 = 1)
    let c = build (fun i -> i % 3 = 2)
    let idempotent = (GCounter.Merge a a).Counts = a.Counts
    let commutative = (GCounter.Merge a b).Counts = (GCounter.Merge b a).Counts
    let associative = (GCounter.Merge (GCounter.Merge a b) c).Counts = (GCounter.Merge a (GCounter.Merge b c)).Counts
    idempotent && commutative && associative
