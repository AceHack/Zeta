module Zeta.Tests.SubstrateHandlerTests

open System.Threading
open global.Xunit
open Zeta.Core
open Zeta.Core.FSharp.Observe
open Zeta.Core.FSharp.ObserveBridge

module E = Zeta.Core.FSharp.ObserveBridge.Effects

let tryFind (key: string) (dict: System.Collections.Generic.IReadOnlyDictionary<string, string>) =
    match dict.TryGetValue key with
    | true, v -> Some v
    | _ -> None

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
    Assert.Equal(Some "otto", tryFind "persona" captured)
    Assert.Equal(Some "persona", tryFind "ferryType" captured)  // persona-ferry = one ferry TYPE

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


// ── RunWork — the Agent hook (recursion through the gate; child-floor; depth bound) ──────
[<Fact>]
let ``RunWork with no work runner is honestly skipped`` () =
    let log = InMemoryDeltaLog<string>() :> IDeltaLog<string>
    let h = SubstrateEffectHandler("otto", (fun () -> Some "c"), log) :> E.IEffectHandler
    match (E.runAsync h (E.RunWork(item "w")) ct).Result with
    | E.Skipped _ -> ()
    | other -> failwithf "expected Skipped, got %A" other

[<Fact>]
let ``RunWork Progressed re-gates + executes the proposed effects`` () =
    let log = InMemoryDeltaLog<string>() :> IDeltaLog<string>
    let runner = E.constantRunner (E.Progressed [ E.PersistFerry ])
    let h = SubstrateEffectHandler("otto", (fun () -> Some "work output"), log, workRunner = runner) :> E.IEffectHandler
    Assert.Equal(E.Executed, (E.runAsync h (E.RunWork(item "w")) ct).Result)
    Assert.Equal<string list>([ "work output" ], ferryContents log) // the proposed effect ran

[<Fact>]
let ``RunWork Blocked / NeedsAuthorization surface honestly and run nothing`` () =
    let log = InMemoryDeltaLog<string>() :> IDeltaLog<string>
    let blocked = SubstrateEffectHandler("otto", (fun () -> Some "c"), log, workRunner = E.constantRunner (E.Blocked "waiting on dep")) :> E.IEffectHandler
    match (E.runAsync blocked (E.RunWork(item "w")) ct).Result with
    | E.Skipped r -> Assert.Contains("blocked", r)
    | other -> failwithf "expected Skipped blocked, got %A" other
    let needsAuth = SubstrateEffectHandler("otto", (fun () -> Some "c"), log, workRunner = E.constantRunner (E.NeedsAuthorization "budget")) :> E.IEffectHandler
    match (E.runAsync needsAuth (E.RunWork(item "w")) ct).Result with
    | E.Skipped r -> Assert.Contains("authorization", r)
    | other -> failwithf "expected Skipped needs-auth, got %A" other
    Assert.Empty(ferryContents log)

[<Fact>]
let ``CHILD-FLOOR: the Agent cannot self-authorize a DENIED effect by proposing it`` () =
    // Policy admits RunWork but DENIES PersistFerry (simulating a gated/child-floor class).
    let denyFerry =
        function
        | E.PersistFerry -> E.Deny "gated class: requires human authorization"
        | _ -> E.Admit
    let log = InMemoryDeltaLog<string>() :> IDeltaLog<string>
    let runner = E.constantRunner (E.Progressed [ E.PersistFerry ]) // the Agent proposes the gated effect
    let h = SubstrateEffectHandler("otto", (fun () -> Some "should NOT land"), log, policy = denyFerry, workRunner = runner) :> E.IEffectHandler
    (E.runAsync h (E.RunWork(item "w")) ct).Result |> ignore
    Assert.Empty(ferryContents log) // the denied effect NEVER executed — at depth, through the gate

[<Fact>]
let ``maxWorkDepth bounds runaway RunWork nesting (terminates, no cascade)`` () =
    let log = InMemoryDeltaLog<string>() :> IDeltaLog<string>
    // A runner that always proposes MORE work would recurse forever unbounded; the depth bound stops it.
    let runner = E.constantRunner (E.Progressed [ E.RunWork(item "again") ])
    let h = SubstrateEffectHandler("otto", (fun () -> Some "c"), log, workRunner = runner, maxWorkDepth = 1) :> E.IEffectHandler
    // Terminates (no stack overflow / no infinite loop) and the top-level work ran.
    Assert.Equal(E.Executed, (E.runAsync h (E.RunWork(item "w")) ct).Result)


// ── EmitResponse — the outbound twin of PersistFerry (reply → persona response stream) ──────
let private responseEntries (log: IDeltaLog<string>) = ferryContents log

[<Fact>]
let ``EmitResponse appends the Agent reply to the persona response stream, attributed kind=response`` () =
    let rlog = InMemoryDeltaLog<string>() :> IDeltaLog<string>
    let h =
        SubstrateEffectHandler("otto", (fun () -> None), (InMemoryDeltaLog<string>() :> IDeltaLog<string>),
                               responseSource = (fun () -> Some "here is my reply"), responseLog = rlog)
        :> E.IEffectHandler
    Assert.Equal(E.Executed, (E.runAsync h E.EmitResponse ct).Result)
    Assert.Equal<string list>([ "here is my reply" ], responseEntries rlog)
    let captured = (rlog.ReplayAsync(0L, ct).AsTask().Result).[0].Captured
    Assert.Equal(Some "response", tryFind "kind" captured)
    Assert.Equal(Some "otto", tryFind "persona" captured)

[<Fact>]
let ``EmitResponse with no reply skips and sends nothing`` () =
    let rlog = InMemoryDeltaLog<string>() :> IDeltaLog<string>
    let h =
        SubstrateEffectHandler("otto", (fun () -> None), (InMemoryDeltaLog<string>() :> IDeltaLog<string>),
                               responseSource = (fun () -> None), responseLog = rlog)
        :> E.IEffectHandler
    match (E.runAsync h E.EmitResponse ct).Result with
    | E.Skipped _ -> ()
    | other -> failwithf "expected Skipped, got %A" other
    Assert.Empty(responseEntries rlog)

[<Fact>]
let ``EmitResponse not wired (no responseSource/Log) is honestly skipped`` () =
    let h = SubstrateEffectHandler("otto", (fun () -> None), (InMemoryDeltaLog<string>() :> IDeltaLog<string>)) :> E.IEffectHandler
    match (E.runAsync h E.EmitResponse ct).Result with
    | E.Skipped _ -> ()
    | other -> failwithf "expected Skipped, got %A" other

[<Fact>]
let ``a DENIED EmitResponse never reaches the response stream (inspect-before-execute)`` () =
    let rlog = InMemoryDeltaLog<string>() :> IDeltaLog<string>
    let denyResponse =
        function
        | E.EmitResponse -> E.Deny "responses gated"
        | _ -> E.Admit
    let h =
        SubstrateEffectHandler("otto", (fun () -> None), (InMemoryDeltaLog<string>() :> IDeltaLog<string>),
                               policy = denyResponse, responseSource = (fun () -> Some "should NOT send"), responseLog = rlog)
        :> E.IEffectHandler
    (E.runAsync h E.EmitResponse ct).Result |> ignore
    Assert.Empty(responseEntries rlog)


// ── ExtendGrammar — the sovereign self-edit (marker + grammar stream + tunable escalation) ──
[<Fact>]
let ``ExtendGrammar appends the new action to the grammar stream, attributed kind=grammar-extension`` () =
    let glog = InMemoryDeltaLog<string>() :> IDeltaLog<string>
    let h =
        SubstrateEffectHandler("otto", (fun () -> None), (InMemoryDeltaLog<string>() :> IDeltaLog<string>),
                               grammarSource = (fun () -> Some "new action: archive(item)"), grammarLog = glog)
        :> E.IEffectHandler
    Assert.Equal(E.Executed, (E.runAsync h (E.ExtendGrammar(item "g1")) ct).Result)
    Assert.Equal<string list>([ "new action: archive(item)" ], ferryContents glog)
    let captured = (glog.ReplayAsync(0L, ct).AsTask().Result).[0].Captured
    Assert.Equal(Some "grammar-extension", tryFind "kind" captured)
    Assert.Equal(Some "g1", tryFind "item" captured)

[<Fact>]
let ``ExtendGrammar above the TUNABLE threshold escalates to needs-authorization (nothing persisted)`` () =
    let glog = InMemoryDeltaLog<string>() :> IDeltaLog<string>
    let h =
        SubstrateEffectHandler("otto", (fun () -> None), (InMemoryDeltaLog<string>() :> IDeltaLog<string>),
                               grammarSource = (fun () -> Some "consequential edit"), grammarLog = glog,
                               grammarNeedsAuth = (fun _ -> true)) // tuned strict
        :> E.IEffectHandler
    match (E.runAsync h (E.ExtendGrammar(item "g2")) ct).Result with
    | E.Skipped r -> Assert.Contains("authorization", r)
    | other -> failwithf "expected Skipped needs-auth, got %A" other
    Assert.Empty(ferryContents glog)

[<Fact>]
let ``a DENIED ExtendGrammar never lands (child-floor; the hard policy gate underneath)`` () =
    let glog = InMemoryDeltaLog<string>() :> IDeltaLog<string>
    let denyGrammar =
        function
        | E.ExtendGrammar _ -> E.Deny "grammar edits gated"
        | _ -> E.Admit
    let h =
        SubstrateEffectHandler("otto", (fun () -> None), (InMemoryDeltaLog<string>() :> IDeltaLog<string>),
                               policy = denyGrammar, grammarSource = (fun () -> Some "should NOT land"), grammarLog = glog)
        :> E.IEffectHandler
    (E.runAsync h (E.ExtendGrammar(item "g3")) ct).Result |> ignore
    Assert.Empty(ferryContents glog)

[<Fact>]
let ``ExtendGrammar not wired (no grammarSource/Log) is honestly skipped`` () =
    let h = SubstrateEffectHandler("otto", (fun () -> None), (InMemoryDeltaLog<string>() :> IDeltaLog<string>)) :> E.IEffectHandler
    match (E.runAsync h (E.ExtendGrammar(item "g4")) ct).Result with
    | E.Skipped _ -> ()
    | other -> failwithf "expected Skipped, got %A" other
