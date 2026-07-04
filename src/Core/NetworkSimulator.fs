namespace Zeta.Core

open System
open System.Collections.Generic
open ReticulumLink
open ReticulumChaos

/// Represents a virtual node inside the simulated network.
type VirtualNode =
    { Destination: Destination
      HandlePacket: Packet -> seq<Destination * string> }

/// A multi-node network cluster simulator.
type NetworkSimulator(initialPartitions: Map<Destination, int>, seed: int64) =
    let mutable scheduler = Scheduler.fromSeed seed
    let mutable chaosState = ReticulumChaos.create initialPartitions seed
    let mutable chaosPolicy = NetworkChaosPolicy.None
    let mutable nodes = Map.empty<Destination, VirtualNode>

    member _.Scheduler
        with get() = scheduler
        and set(v) = scheduler <- v

    member _.ChaosState
        with get() = chaosState
        and set(v) = chaosState <- v

    member _.ChaosPolicy
        with get() = chaosPolicy
        and set(v) = chaosPolicy <- v

    member _.Nodes = nodes

    /// Register a virtual node. Announces it on the network.
    member this.AddNode(node: VirtualNode) =
        nodes <- Map.add node.Destination node nodes
        chaosState <- ReticulumChaos.announce node.Destination chaosState

    /// Update network partitioning map.
    member this.SetPartitions(partitions: Map<Destination, int>) =
        chaosState <- { chaosState with PartitionMap = partitions }

    /// Sends a packet from one node to another.
    member this.SendPacket(from: Destination, toD: Destination, payload: string) =
        let nextState, nextSched = ReticulumChaos.send from toD payload scheduler chaosPolicy chaosState
        chaosState <- nextState
        scheduler <- nextSched

    /// Step the simulation timeline by one versionstamp tick.
    member this.Step() =
        // 1. Advance the network state timeline
        chaosState <- ReticulumChaos.step scheduler.Now chaosPolicy chaosState

        // 2. Deliver packets and run node logic
        let activeDestinations = nodes |> Map.keys |> Seq.toArray

        for dest in activeDestinations do
            let packets, nextState = ReticulumChaos.deliver dest chaosState
            chaosState <- nextState

            for pkt in packets do
                match Map.tryFind dest nodes with
                | Some node ->
                    let outgoing = node.HandlePacket(pkt)
                    for (toDest, outPayload) in outgoing do
                        this.SendPacket(dest, toDest, outPayload)
                | None -> ()

        // 3. Advance virtual clock
        scheduler <- Scheduler.step scheduler

    /// Run the simulation until there are no remaining delayed or in-flight packets.
    member this.RunUntilQuiet(?maxSteps: int) =
        let limit = defaultArg maxSteps 1000
        let rec loop steps =
            let hasInFlight = not (List.isEmpty chaosState.Medium.InFlight)
            let hasDelayed = not (List.isEmpty chaosState.DelayedPackets)
            if (hasInFlight || hasDelayed) && steps < limit then
                this.Step()
                loop (steps + 1)
            else
                steps
        loop 0
