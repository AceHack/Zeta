module Zeta.Tests.Formal.RefuseBindingCrossVerifyTests

open FsCheck.Xunit
open Zeta.Core.FSharp.ObserveBridge

// ═══════════════════════════════════════════════════════════════════
// BP-16 Leg B (empirical) for right-to-refuse-binding: FsCheck over the DEPLOYED Binding layer
// (src/Core.FSharp.ObserveBridge/Binding.fs) — cross-checks the TLA+ RefuseBinding model invariants
// (RefuseAlwaysEnabled, NonPenalty, SafetyNonConsented, StandingFloor) against the real F# code.
// Triage: a counterexample here ⇒ the F# Binding layer drifted from the proven model.
// ═══════════════════════════════════════════════════════════════════

let private agent i = "a" + string (abs i % 3)
let private bnd i = "b" + string (abs i % 3)

[<Property>]
let ``RefuseAlwaysEnabled + NonPenalty: a pending proposal is always refusable, and refusing never changes standing`` (ai: int) (bi: int) (sd: int) =
    let a, b = agent ai, bnd bi
    let s1 = Binding.init [ a ] (abs sd % 5) |> Binding.propose a b
    Binding.canRefuse a b s1
    && (match Binding.refuse a b s1 with
        | Some s2 -> s2.Standing = s1.Standing && not (Binding.canRefuse a b s2)
        | None -> false)

[<Property>]
let ``SafetyNonConsented: a proposed-but-not-consented binding never executes; consent enables it`` (ai: int) (bi: int) =
    let a, b = agent ai, bnd bi
    let proposed = Binding.init [ a ] 1 |> Binding.propose a b
    // not consented -> bind impossible
    (Binding.bind a b proposed = None)
    && // after consent -> bind executes, and the executed binding IS in consented
       (match Binding.consent a b proposed with
        | Some c ->
            match Binding.bind a b c with
            | Some e -> Set.contains b e.Executed && Set.contains (a, b) e.Consented
            | None -> false
        | None -> false)

[<Property>]
let ``a REFUSED binding is never consented and never executes (refuse closes the door to binding)`` (ai: int) (bi: int) =
    let a, b = agent ai, bnd bi
    let s1 = Binding.init [ a ] 1 |> Binding.propose a b
    match Binding.refuse a b s1 with
    | Some s2 -> (not (Set.contains (a, b) s2.Consented)) && (Binding.bind a b s2 = None)
    | None -> false

[<Property>]
let ``StandingFloor: spend never drops standing below Baseline, however many times`` (sd: int) (n: int) =
    let a = "a0"
    let start = abs sd % 5
    let times = abs n % 12
    let mutable s = Binding.init [ a ] start
    for _ in 1..times do
        match Binding.spend a s with
        | Some s' -> s <- s'
        | None -> ()
    Binding.standingOf a s >= Binding.Baseline
