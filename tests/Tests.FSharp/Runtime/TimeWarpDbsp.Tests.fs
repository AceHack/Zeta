module Zeta.Tests.Runtime.TimeWarpDbspTests

open System
open Xunit
open Zeta.Core

[<Fact>]
let ``Time Warp straggler rolls back and computes correct state`` () =
    // Collect outgoing messages in a list to route them
    let queue = ResizeArray<TimeWarpMessage>()
    let onSend (msg: TimeWarpMessage) = queue.Add(msg)

    let node = TimeWarpNode("nodeA", onSend)

    // 1. Send normal message (ReceiveTime = 12, Payload = 100)
    node.Receive({
        Sender = "coordinator"
        Receiver = "nodeA"
        SendTime = 10L
        ReceiveTime = 12L
        Payload = 100L
        IsAntiMessage = false
    })
    Assert.Equal(100L, node.CurrentState)
    Assert.Equal(12L, node.LocalTime)

    // 2. Send future message (ReceiveTime = 22, Payload = 200)
    node.Receive({
        Sender = "coordinator"
        Receiver = "nodeA"
        SendTime = 20L
        ReceiveTime = 22L
        Payload = 200L
        IsAntiMessage = false
    })
    Assert.Equal(300L, node.CurrentState)
    Assert.Equal(22L, node.LocalTime)

    // 3. Send straggler message (ReceiveTime = 17, Payload = 300)
    // This arrives "out of order" in real time but has ReceiveTime in the past of the local virtual clock.
    node.Receive({
        Sender = "coordinator"
        Receiver = "nodeA"
        SendTime = 15L
        ReceiveTime = 17L
        Payload = 300L
        IsAntiMessage = false
    })

    // After rollback and re-evaluation, the virtual time-ordered state must be:
    // Time 12: 100
    // Time 17: 400 (100 + 300)
    // Time 22: 600 (400 + 200)
    Assert.Equal(600L, node.CurrentState)
    Assert.Equal(22L, node.LocalTime)

    let history = node.StateHistory
    Assert.Equal(4, history.Length) // initial + 3 messages
    Assert.Equal((0L, 0L), history.[0])
    Assert.Equal((12L, 100L), history.[1])
    Assert.Equal((17L, 400L), history.[2])
    Assert.Equal((22L, 600L), history.[3])


[<Fact>]
let ``DBSP retraction computes equivalent state to Time Warp on straggler`` () =
    // Create the DBSP equivalents of the same messages
    let msg1 = { Sender = "coordinator"; Receiver = "nodeA"; SendTime = 10L; ReceiveTime = 12L; Payload = 100L }
    let msg2 = { Sender = "coordinator"; Receiver = "nodeA"; SendTime = 20L; ReceiveTime = 22L; Payload = 200L }
    let msg3 = { Sender = "coordinator"; Receiver = "nodeA"; SendTime = 15L; ReceiveTime = 17L; Payload = 300L }

    let dbspNode = DbspNodeState("nodeA")

    // Construct Z-sets
    let z1 = ZSet.singleton msg1 1L
    let z2 = ZSet.singleton msg2 1L
    let z3 = ZSet.singleton msg3 1L

    // Accumulate inputs (order of addition does not matter because group addition + is commutative)
    dbspNode.Receive(z2)
    dbspNode.Receive(z1)
    dbspNode.Receive(z3)

    // Verify states at the identical virtual times
    Assert.Equal(0L, dbspNode.GetStateAt(0L))
    Assert.Equal(100L, dbspNode.GetStateAt(12L))
    Assert.Equal(100L, dbspNode.GetStateAt(15L)) // before 17
    Assert.Equal(400L, dbspNode.GetStateAt(17L)) // at 17
    Assert.Equal(600L, dbspNode.GetStateAt(22L)) // at 22
    Assert.Equal(600L, dbspNode.GetStateAt(30L)) // future


[<Fact>]
let ``Cascading rollback via anti-messages is isomorphic to DBSP projection retractions`` () =
    // Setup Time Warp system
    let twQueue = ResizeArray<TimeWarpMessage>()
    let rec route (msg: TimeWarpMessage) =
        if msg.Receiver = "sink" then
            (sink: TimeWarpNode).Receive(msg)
        elif msg.Receiver = "nodeA" then
            (nodeA: TimeWarpNode).Receive(msg)
    and nodeA = TimeWarpNode("nodeA", route)
    and sink = TimeWarpNode("sink", route)

    // 1. Process Msg1 (ReceiveTime = 12, Payload = 100) -> sends to sink at Time 14, Payload = 200
    nodeA.Receive({ Sender = "coord"; Receiver = "nodeA"; SendTime = 10L; ReceiveTime = 12L; Payload = 100L; IsAntiMessage = false })
    // 2. Process Msg2 (ReceiveTime = 22, Payload = 200) -> sends to sink at Time 24, Payload = 400
    nodeA.Receive({ Sender = "coord"; Receiver = "nodeA"; SendTime = 20L; ReceiveTime = 22L; Payload = 200L; IsAntiMessage = false })

    // Verify sink received both forwards
    Assert.Equal(600L, sink.CurrentState) // 200 + 400

    // 3. Process straggler at nodeA (ReceiveTime = 17, Payload = 300) -> sends to sink at Time 19, Payload = 600.
    // This triggers nodeA to rollback to 17. The forward message at time 22 is cancelled.
    // nodeA sends an anti-message to sink for the message sent at time 22, and re-sends at time 22.
    nodeA.Receive({ Sender = "coord"; Receiver = "nodeA"; SendTime = 15L; ReceiveTime = 17L; Payload = 300L; IsAntiMessage = false })

    // Verify final state of sink after receiving the anti-message and new forwards
    // Time 14: 200
    // Time 19: 800 (200 + 600)
    // Time 24: 1200 (800 + 400)
    Assert.Equal(1200L, sink.CurrentState)

    // --- Equivalent DBSP stream execution ---
    let dbspNodeA = DbspNodeState("nodeA")
    let dbspSink = DbspNodeState("sink")

    let msg1 = { Sender = "coord"; Receiver = "nodeA"; SendTime = 10L; ReceiveTime = 12L; Payload = 100L }
    let msg2 = { Sender = "coord"; Receiver = "nodeA"; SendTime = 20L; ReceiveTime = 22L; Payload = 200L }
    let msg3 = { Sender = "coord"; Receiver = "nodeA"; SendTime = 15L; ReceiveTime = 17L; Payload = 300L }

    dbspNodeA.Receive(ZSet.singleton msg1 1L)
    dbspNodeA.Receive(ZSet.singleton msg2 1L)
    dbspNodeA.Receive(ZSet.singleton msg3 1L)

    // Downstream project acts as a linear map
    let projectedZSet = dbspNodeA.ProjectDownstream()
    dbspSink.Receive(projectedZSet)

    // Verify DBSP Sink states match Time Warp Sink states exactly at all times
    Assert.Equal(0L, dbspSink.GetStateAt(0L))
    Assert.Equal(200L, dbspSink.GetStateAt(14L))
    Assert.Equal(800L, dbspSink.GetStateAt(19L))
    Assert.Equal(1200L, dbspSink.GetStateAt(24L))


[<Fact>]
let ``DBSP subtraction completely cancels out a message (algebraic isomorphism)`` () =
    let msg = { Sender = "A"; Receiver = "B"; SendTime = 10L; ReceiveTime = 15L; Payload = 500L }
    let zPositive = ZSet.singleton msg 1L
    let zNegative = ZSet.singleton msg -1L

    // Summing them must yield the empty Z-set
    let zSum = zPositive + zNegative
    Assert.True(zSum.IsEmpty)
