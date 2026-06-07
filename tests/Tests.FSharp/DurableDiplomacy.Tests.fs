module Zeta.Tests.DurableDiplomacyTests

open System.Threading
open global.Xunit
open Zeta.Core

module D = Zeta.Core.Diplomacy
module DD = Zeta.Core.DurableDiplomacy

// ═══════════════════════════════════════════════════════════════════
// DurableDiplomacy — cached polymorphic diplomacy OVER A STREAM: agreements fold into a
// Map (last-write-wins supersession); recovery rebuilds the cache from the agreement log.
// ═══════════════════════════════════════════════════════════════════

let private ct = CancellationToken.None

let private cellOf (remains: DynamicValue) (names: string list) : YinYang.Cell =
    let acts =
        names |> List.fold (fun acc n -> Bonsai.Binary(Bonsai.Add, Bonsai.Call(n, []), acc)) (Bonsai.Const Bonsai.CNull)
    { YinYang.Remains = remains; YinYang.Acts = acts }

[<Fact>]
let ``Profile and NegotiationOutcome round-trip through the agreement codec`` () =
    let a = D.describe (cellOf (DynamicValue.Int 1L) [ D.ExitCapability; "trade" ])
    let b = D.describe (cellOf (DynamicValue.Object [ "x", DynamicValue.String "s" ]) [ D.ExitCapability; "trade"; "ping" ])
    let o = D.Negotiated(Set.ofList [ "trade" ])
    let a2, b2, o2 = DD.encodeAgreement a b o |> DD.decodeAgreement
    Assert.Equal(a, a2)
    Assert.Equal(b, b2)
    Assert.Equal(o, o2)

[<Fact>]
let ``agreements fold into the durable cache and recover from the stream`` () =
    let log = InMemoryDeltaLog<string>() :> IDeltaLog<string>
    let a = cellOf (DynamicValue.Int 1L) [ D.ExitCapability; "trade" ]
    let b = cellOf (DynamicValue.Int 9L) [ D.ExitCapability; "trade" ]
    let saga = DurableSaga.start log DD.step DD.empty
    let outcome, ev = DD.recordEvent a b
    saga.AppendAsync(ev).Wait()
    Assert.Equal(Some outcome, DD.lookup saga.State a b)
    // Recover from the agreement stream alone.
    let resumed = DurableSaga<DD.DurableCache, string>.ResumeAsync(log, DD.step, DD.empty).Result
    Assert.Equal(Some outcome, DD.lookup resumed.State a b)

[<Fact>]
let ``supersession is last-write-wins for the same profile-pair key`` () =
    let log = InMemoryDeltaLog<string>() :> IDeltaLog<string>
    let a = D.describe (cellOf (DynamicValue.Int 1L) [ D.ExitCapability; "trade" ])
    let b = D.describe (cellOf (DynamicValue.Int 9L) [ D.ExitCapability; "trade" ])
    let saga = DurableSaga.start log DD.step DD.empty
    saga.AppendAsync(DD.encodeAgreement a b (D.Negotiated(Set.ofList [ "trade" ]))).Wait()
    saga.AppendAsync(DD.encodeAgreement a b (D.Negotiated(Set.ofList [ "trade"; "extra" ]))).Wait()
    // Same key -> last write wins.
    Assert.Equal(Some(D.Negotiated(Set.ofList [ "trade"; "extra" ])), Map.tryFind (a, b) saga.State)
    Assert.Equal(1, Map.count saga.State)

[<Fact>]
let ``a different shape coexists as a separate agreement (PIC invalidation by key)`` () =
    let log = InMemoryDeltaLog<string>() :> IDeltaLog<string>
    let aInt = cellOf (DynamicValue.Int 1L) [ D.ExitCapability; "trade" ]
    let aStr = cellOf (DynamicValue.String "x") [ D.ExitCapability; "trade" ]  // different shape
    let b = cellOf (DynamicValue.Int 9L) [ D.ExitCapability; "trade" ]
    let saga = DurableSaga.start log DD.step DD.empty
    let _, ev1 = DD.recordEvent aInt b
    let _, ev2 = DD.recordEvent aStr b
    saga.AppendAsync(ev1).Wait()
    saga.AppendAsync(ev2).Wait()
    Assert.Equal(2, Map.count saga.State)
