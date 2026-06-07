module Zeta.Tests.SubstrateHandlerTests

open System.Threading
open global.Xunit
open Zeta.Core
open Zeta.Core.FSharp.Observe
open Zeta.Core.FSharp.ObserveBridge

module E = Zeta.Core.FSharp.ObserveBridge.Effects

// ═══════════════════════════════════════════════════════════════════
// Bridge D (substrate) — SubstrateEffectHandler. v1 wires PersistFerry (marker + dedicated
// ferry stream): content from the bus seam -> appended to an IDeltaLog<string> ferry stream.
// ═══════════════════════════════════════════════════════════════════

let private ct = CancellationToken.None
let private item id = { Id = id; Title = id; Ready = true; Ambiguous = false; NeedsNewAction = false }

let private ferryContents (log: IDeltaLog<string>) =
    log.ReplayAsync(0L, ct).AsTask().Result
    |> Array.collect (fun e -> e.Delta |> Seq.map (fun entry -> entry.Key) |> Seq.toArray)
    |> Array.toList

[<Fact>]
let ``PersistFerry appends the ferried content to the dedicated ferry stream`` () =
    let log = InMemoryDeltaLog<string>() :> IDeltaLog<string>
    let h = SubstrateEffectHandler("otto", (fun () -> Some "verbatim ferry payload"), log) :> E.IEffectHandler
    let r = (E.runAsync h E.PersistFerry ct).Result
    Assert.Equal(E.Executed, r)
    Assert.Equal<string list>([ "verbatim ferry payload" ], ferryContents log)
    // the ferry entry is attributed to the owning persona.
    let captured = (log.ReplayAsync(0L, ct).AsTask().Result).[0].Captured
    Assert.Equal(Some "otto", Map.tryFind "persona" captured)
    Assert.Equal(Some "persona", Map.tryFind "ferryType" captured)  // persona-ferry = one ferry TYPE

[<Fact>]
let ``PersistFerry with no ferried content skips and appends nothing`` () =
    let log = InMemoryDeltaLog<string>() :> IDeltaLog<string>
    let h = SubstrateEffectHandler("otto", (fun () -> None), log) :> E.IEffectHandler
    match (E.runAsync h E.PersistFerry ct).Result with
    | E.Skipped _ -> ()
    | other -> failwithf "expected Skipped, got %A" other
    Assert.Empty(ferryContents log)

[<Fact>]
let ``a DENIED PersistFerry never touches the ferry stream (inspect-before-execute)`` () =
    let log = InMemoryDeltaLog<string>() :> IDeltaLog<string>
    let denyAll = fun _ -> E.Deny "no persistence without authorization"
    let h = SubstrateEffectHandler("otto", (fun () -> Some "should not land"), log, policy = denyAll) :> E.IEffectHandler
    match (E.runAsync h E.PersistFerry ct).Result with
    | E.Skipped _ -> ()
    | other -> failwithf "expected Skipped, got %A" other
    Assert.Empty(ferryContents log)

[<Fact>]
let ``EmitResponse / RunWork / ExtendGrammar are honestly not-wired in v1 (never silent success)`` () =
    let log = InMemoryDeltaLog<string>() :> IDeltaLog<string>
    let h = SubstrateEffectHandler("otto", (fun () -> None), log) :> E.IEffectHandler
    for e in [ E.EmitResponse; E.RunWork(item "x"); E.ExtendGrammar(item "g") ] do
        match (E.runAsync h e ct).Result with
        | E.Skipped _ -> ()
        | other -> failwithf "expected Skipped for %A, got %A" e other
