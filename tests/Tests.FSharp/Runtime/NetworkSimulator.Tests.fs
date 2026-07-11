module Zeta.Tests.Runtime.NetworkSimulatorTests

open System
open Xunit
open Zeta.Core
open Zeta.Core.ReticulumLink
open Zeta.Core.ReticulumChaos
open Zeta.Core.FSharp.ZetaId

[<Fact>]
let ``NetworkSimulator multi-hop routing happy path succeeds`` () =
    // Create the simulator
    let partitions = Map.empty<Destination, int>
    let sim = NetworkSimulator(partitions, 42L)

    // Mint destinations
    let destA = ReticulumLink.mint sim.Scheduler.Now 1L Location.CentralUs
    let destB = ReticulumLink.mint sim.Scheduler.Now 2L Location.CentralUs
    let destC = ReticulumLink.mint sim.Scheduler.Now 3L Location.CentralUs

    let receivedByC = ResizeArray<string>()

    // Setup virtual nodes
    let nodeA = {
        Destination = destA
        HandlePacket = fun _ -> Seq.empty
    }
    
    let nodeB = {
        Destination = destB
        HandlePacket = fun pkt -> 
            if pkt.From = destA then
                Seq.singleton (destC, "forwarded: " + pkt.Payload)
            else
                Seq.empty
    }

    let nodeC = {
        Destination = destC
        HandlePacket = fun pkt ->
            receivedByC.Add(pkt.Payload)
            Seq.empty
    }

    sim.AddNode(nodeA)
    sim.AddNode(nodeB)
    sim.AddNode(nodeC)

    // Send packet from A to B
    sim.SendPacket(destA, destB, "hello-dst")

    // Run until quiet
    let steps = sim.RunUntilQuiet()
    Assert.True(steps > 0)

    // Verify Node C received the forwarded packet
    Assert.Single(receivedByC) |> ignore
    Assert.Equal("forwarded: hello-dst", receivedByC.[0])


[<Fact>]
let ``NetworkSimulator packet drop chaos silently discards packets`` () =
    let partitions = Map.empty<Destination, int>
    let sim = NetworkSimulator(partitions, 42L)
    sim.ChaosPolicy <- NetworkChaosPolicy.DropPackets

    let destA = ReticulumLink.mint sim.Scheduler.Now 1L Location.CentralUs
    let destB = ReticulumLink.mint sim.Scheduler.Now 2L Location.CentralUs

    let received = ResizeArray<string>()

    let nodeA = { Destination = destA; HandlePacket = fun _ -> Seq.empty }
    let nodeB = { Destination = destB; HandlePacket = fun pkt -> received.Add(pkt.Payload); Seq.empty }

    sim.AddNode(nodeA)
    sim.AddNode(nodeB)

    // Send 100 packets to ensure statistical drop triggers
    for i in 1 .. 100 do
        sim.SendPacket(destA, destB, sprintf "msg-%d" i)
        
    sim.RunUntilQuiet() |> ignore

    // With a 10% drop rate, at least one drop is statistically guaranteed (prob > 99.999%)
    Assert.True(received.Count < 100, sprintf "Expected some packet drops, but all 100 delivered. Received: %d" received.Count)


[<Fact>]
let ``NetworkSimulator network partitioning drops packets and heals correctly`` () =
    // Create partitioned map: Node A (Partition 1), Node B (Partition 2)
    let destA = { Id = System.UInt128.Parse("101") }
    let destB = { Id = System.UInt128.Parse("102") }
    let destC = { Id = System.UInt128.Parse("103") }

    let partitions = Map [ (destA, 1); (destB, 2); (destC, 2) ]
    let sim = NetworkSimulator(partitions, 42L)
    sim.ChaosPolicy <- NetworkChaosPolicy.Partitioning

    let receivedByB = ResizeArray<string>()

    let nodeA = { Destination = destA; HandlePacket = fun _ -> Seq.empty }
    let nodeB = { Destination = destB; HandlePacket = fun pkt -> receivedByB.Add(pkt.Payload); Seq.empty }

    sim.AddNode(nodeA)
    sim.AddNode(nodeB)

    // 1. Send while partitioned
    sim.SendPacket(destA, destB, "hello-during-partition")
    sim.RunUntilQuiet() |> ignore
    Assert.Empty(receivedByB)

    // 2. Heal the partition (place both in Partition 1)
    sim.SetPartitions(Map [ (destA, 1); (destB, 1) ])

    // Send after healing
    sim.SendPacket(destA, destB, "hello-after-heal")
    sim.RunUntilQuiet() |> ignore

    // Verify receipt after healing
    Assert.Single(receivedByB) |> ignore
    Assert.Equal("hello-after-heal", receivedByB.[0])


[<Fact>]
let ``NetworkSimulator delay jitter defers packet delivery to future timestamps`` () =
    let partitions = Map.empty<Destination, int>
    let sim = NetworkSimulator(partitions, 12345L) // seed chosen for positive delay jitter
    sim.ChaosPolicy <- NetworkChaosPolicy.DelayJitter

    let destA = ReticulumLink.mint sim.Scheduler.Now 1L Location.CentralUs
    let destB = ReticulumLink.mint sim.Scheduler.Now 2L Location.CentralUs

    let received = ResizeArray<string>()

    let nodeA = { Destination = destA; HandlePacket = fun _ -> Seq.empty }
    let nodeB = { Destination = destB; HandlePacket = fun pkt -> received.Add(pkt.Payload); Seq.empty }

    sim.AddNode(nodeA)
    sim.AddNode(nodeB)

    sim.SendPacket(destA, destB, "delayed-message")

    // Step once: packet should still be delayed
    sim.Step()
    Assert.Empty(received)

    // Run until quiet: packet delivers
    sim.RunUntilQuiet() |> ignore
    Assert.Single(received) |> ignore
    Assert.Equal("delayed-message", received.[0])
