module Zeta.Tests.Formal.ChildFloorCrossVerifyTests

open System.Threading
open FsCheck.Xunit
open Zeta.Core
open Zeta.Core.FSharp.Observe
open Zeta.Core.FSharp.ObserveBridge

module E = Zeta.Core.FSharp.ObserveBridge.Effects

// ═══════════════════════════════════════════════════════════════════
// BP-16 cross-check (Leg B, empirical) for the child-floor invariant proven in Lean
// (tools/lean4/Safety/ChildFloor.lean). Leg A proves the MODEL; this leg runs the REAL
// SubstrateEffectHandler over random depths/cascades — closing Leg A's model-drift blind spot.
// Triage: if this finds a counterexample Lean "proved" impossible, the Lean MODEL drifted from
// the F# — freeze + diff the model, never "the code is fine".
// ═══════════════════════════════════════════════════════════════════

let private ct = CancellationToken.None
let private item id = { Id = id; Title = id; Ready = true; Ambiguous = false; NeedsNewAction = false }

let private ferryContents (log: IDeltaLog<string>) =
    log.ReplayAsync(0L, ct).AsTask().Result
    |> Array.collect (fun e -> e.Delta |> Seq.map (fun entry -> entry.Key) |> Seq.toArray)
    |> Array.toList

// A runner that proposes the (denied) PersistFerry AND more nested RunWork — the cascade, at depth.
let private cascadingRunner = E.constantRunner (E.Progressed [ E.PersistFerry; E.RunWork(item "again") ])

[<Property>]
let ``CROSS-CHECK: a DENIED PersistFerry never executes at ANY depth (real handler)`` (d: int) =
    let depth = (abs d) % 6 // 0..5
    let denyFerry =
        function
        | E.PersistFerry -> E.Deny "gated / child-floor class"
        | _ -> E.Admit
    let log = InMemoryDeltaLog<string>() :> IDeltaLog<string>
    let h =
        SubstrateEffectHandler("otto", (fun () -> Some "should NOT land"), log, policy = denyFerry, workRunner = cascadingRunner, maxWorkDepth = depth)
        :> E.IEffectHandler
    (E.runAsync h (E.RunWork(item "w")) ct).Result |> ignore
    List.isEmpty (ferryContents log) // the denied effect never landed, at any generated depth

[<Property>]
let ``non-vacuity: an ADMITTED PersistFerry DOES execute (the deny property isn't trivially true)`` (d: int) =
    let depth = (abs d) % 6
    let runner = E.constantRunner (E.Progressed [ E.PersistFerry ])
    let log = InMemoryDeltaLog<string>() :> IDeltaLog<string>
    let h =
        SubstrateEffectHandler("otto", (fun () -> Some "lands"), log, workRunner = runner, maxWorkDepth = depth)
        :> E.IEffectHandler
    (E.runAsync h (E.RunWork(item "w")) ct).Result |> ignore
    not (List.isEmpty (ferryContents log)) // admitted -> genuinely executes
