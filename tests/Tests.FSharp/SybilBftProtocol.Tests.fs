module Zeta.Tests.SybilBftProtocolTests

open global.Xunit
open Zeta.Core
open Zeta.Core.SybilBft
open Zeta.Core.SybilBftProtocol

let private bits (seed: int) (n: int) : int list =
    let mutable s = uint64 seed * 2862933555777941757UL + 3037000493UL
    [ for _ in 1 .. n ->
          s <- s * 6364136223846793005UL + 1442695040888963407UL
          int ((s >>> 33) &&& 1UL) ]

// 4 honest nodes (distinct seeds) all voting "commit"; node 0 proposes.
let private honestInbox value =
    [ propose 0 (bits 0 500) value
      ballot 1 (bits 1 500) value
      ballot 2 (bits 2 500) value
      ballot 3 (bits 3 500) value ]

[<Fact>]
let ``honest quorum commits the proposed value (d=4, f=1, quorum=3)`` () =
    let v, _ = receiveAll (init 4 0.5) (honestInbox "commit")
    Assert.Equal(Some "commit", committed v)

[<Fact>]
let ``Pending→Committed announces exactly one Decision`` () =
    let _, out = receiveAll (init 4 0.5) (honestInbox "commit")
    let decisions = out |> List.filter (function Decision _ -> true | _ -> false)
    Assert.Equal(1, List.length decisions)
    Assert.Equal<Message<string>>(Decision "commit", List.head decisions)

[<Fact>]
let ``THE GUARANTEE at protocol level: one clock forging 5 ids cannot drive the decision`` () =
    let evil = bits 9 500
    let inbox =
        [ propose 0 evil "evil"
          ballot 1 evil "evil"
          ballot 2 evil "evil"
          ballot 3 evil "evil"
          ballot 4 evil "evil" // 5 forged claims, ONE clock
          ballot 5 (bits 1 500) "good"
          ballot 6 (bits 2 500) "good"
          ballot 7 (bits 3 500) "good" ] // 3 honest distinct
    let v, _ = receiveAll (init 4 0.5) inbox
    Assert.Equal(Some "good", committed v) // forged majority collapses to 1 source; honest 3 decide

[<Fact>]
let ``delivery-order independent: same vote set commits the same value (DST)`` () =
    let inbox = honestInbox "x"
    let a, _ = receiveAll (init 4 0.5) inbox
    let b, _ = receiveAll (init 4 0.5) (List.rev inbox)
    Assert.Equal(committed a, committed b)
    Assert.Equal(Some "x", committed a)

[<Fact>]
let ``decision is final / idempotent: later conflicting votes cannot unset or change it`` () =
    let v, _ = receiveAll (init 4 0.5) (honestInbox "first")
    Assert.Equal(Some "first", committed v)
    // A flood of distinct "second" votes arrives after commit — must NOT change the committed value.
    let later =
        [ for i in 10 .. 20 -> ballot i (bits i 500) "second" ]
    let v', out = receiveAll v later
    Assert.Equal(Some "first", committed v') // unchanged
    Assert.True(List.isEmpty (out |> List.filter (function Decision _ -> true | _ -> false)))

[<Fact>]
let ``the safety fix: a lone forged source (5 ids, 1 clock) does NOT commit prematurely`` () =
    // Before the membership-quorum fix this committed "evil" (d=1 ⇒ quorum 1). With Members=4 the quorum is
    // fixed at 3, so one distinct source can never decide no matter how many ids it forges.
    let evil = bits 9 500
    let onlyEvil = [ for i in 0 .. 4 -> ballot i evil "evil" ]
    let v, out = receiveAll (init 4 0.5) onlyEvil
    Assert.Equal(None, committed v)
    Assert.True(List.isEmpty out)

[<Fact>]
let ``informational Decision message does not affect the local tally`` () =
    let v, out = receive (init 4 0.5) (Decision "ignored")
    Assert.Equal(None, committed v)
    Assert.True(List.isEmpty out)
