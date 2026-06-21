module Zeta.Tests.Formal.BifurcationCrossVerifyTests

open FsCheck.Xunit
open Zeta.Core.FSharp.ObserveBridge

// ═══════════════════════════════════════════════════════════════════
// BP-16 Leg B (empirical) for bifurcation: FsCheck over the DEPLOYED Divvy ops
// (src/Core.FSharp.ObserveBridge/Binding.fs) — cross-checks the TLA+ Bifurcation invariants
// (Conservation, NoDoubleOwnership, NoDoubleSpend, ExecOnlyByOwner) AND the Lean Face-1
// convergence (merge commutative + idempotent) against the real F# code.
// Triage: a counterexample ⇒ Divvy drifted from the proven TLA+/Lean model.
// ═══════════════════════════════════════════════════════════════════

let private allBindings = Set.ofList [ "b0"; "b1"; "b2" ]
let private bid i = "b" + string (abs i % 3)

/// Build a Divvy state by folding random tag/exec moves over a fresh split.
let private build (moves: (bool * bool * int) list) : Divvy.State =
    moves
    |> List.fold
        (fun s (isTag, isI1, bi) ->
            let h = if isI1 then Divvy.I1 else Divvy.I2
            let b = bid bi
            let next = if isTag then Divvy.tag h b s else Divvy.exec h b s
            Option.defaultValue s next)
        (Divvy.split allBindings)

let private ownerKeys (s: Divvy.State) = s.Owner |> Map.toSeq |> Seq.map fst |> Set.ofSeq

[<Property>]
let ``Conservation: owned ∪ unassigned = all bindings, and they are disjoint`` (moves: (bool * bool * int) list) =
    let s = build moves
    let ok = ownerKeys s
    (Set.union ok s.Unassigned = allBindings) && (Set.intersect ok s.Unassigned = Set.empty)

[<Property>]
let ``NoDoubleSpend: no binding is executed more than once across the halves`` (moves: (bool * bool * int) list) =
    let s = build moves
    s.ExecBy |> Map.forall (fun _ halves -> Set.count halves <= 1)

[<Property>]
let ``ExecOnlyByOwner: a half only executes a binding it owns`` (moves: (bool * bool * int) list) =
    let s = build moves
    s.ExecBy
    |> Map.forall (fun b halves -> halves |> Set.forall (fun h -> Divvy.owns h b s))

[<Property>]
let ``Face-1 convergence: merge is commutative and idempotent (reconciliation order-independent + absorbing)`` (ma: (bool * bool * int) list) (mb: (bool * bool * int) list) =
    let a, b = build ma, build mb
    (Divvy.merge a b = Divvy.merge b a) && (Divvy.merge a a = a)

// Associativity completes the join-semilattice triple (commutative + idempotent + ASSOCIATIVE = the
// `L.assoc` field the Lean Bifurcation semilattice proves). Kept explicit per the 081KT07NV0008QG0R001YDB73K precedent:
// a tie-break/sort that is commutative+idempotent but NOT associative is still NOT a lawful join —
// exactly the failure class 081KT07NV0008QG0R001YDB73K exposed in a max-merge. Without it this leg would be blind to the
// one law most likely to silently break under a key-ordering change.
[<Property>]
let ``Face-1 convergence: merge is associative (three-way reconciliation order-independent)`` (ma: (bool * bool * int) list) (mb: (bool * bool * int) list) (mc: (bool * bool * int) list) =
    let a, b, c = build ma, build mb, build mc
    Divvy.merge (Divvy.merge a b) c = Divvy.merge a (Divvy.merge b c)
