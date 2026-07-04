module Zeta.Tests.Operators.ReticulumChaosTests

open System
open Xunit
open FsCheck
open FsCheck.Xunit
open Zeta.Core
open ReticulumLink
open ReticulumChaos
open Zeta.Core.FSharp.ZetaId

[<Fact>]
let ``splitMix RNG is strictly deterministic`` () =
    let seed = 42L
    let val1, nextSeed1 = ReticulumChaos.splitMix seed
    let val2, nextSeed2 = ReticulumChaos.splitMix seed
    Assert.Equal(val1, val2)
    Assert.Equal(nextSeed1, nextSeed2)

    let val3, _ = ReticulumChaos.splitMix nextSeed1
    let val4, _ = ReticulumChaos.splitMix nextSeed2
    Assert.Equal(val3, val4)

[<Fact>]
let ``Reticulum chaos supports partitioning and partition healing`` () =
    let s0 = Scheduler.fromSeed 100L
    let a = ReticulumLink.mint s0.Now 0xAAAL Location.EastUsVa
    let b = ReticulumLink.mint s0.Now 0xBBBL Location.WestEurope
    
    // a is in partition 1, b is in partition 2
    let partitions = Map.ofList [ (a, 1); (b, 2) ]
    let state = 
        ReticulumChaos.create partitions 12345L
        |> ReticulumChaos.announce a
        |> ReticulumChaos.announce b

    // 1. Connection should fail due to partition boundary
    let connResult = ReticulumChaos.connect a b NetworkChaosPolicy.Partitioning state
    match connResult with
    | Error (LinkError.Unreachable target) -> Assert.Equal(b, target)
    | Ok _ -> failwith "Expected connect to fail due to partition"

    // 2. Healing partition by putting b in partition 1
    let healedPartitions = Map.ofList [ (a, 1); (b, 1) ]
    let stateHealed = { state with PartitionMap = healedPartitions }
    let connResultHealed = ReticulumChaos.connect a b NetworkChaosPolicy.Partitioning stateHealed
    Assert.True(Result.isOk connResultHealed)

[<Fact>]
let ``Reticulum chaos DropPackets deterministically drops packets`` () =
    let s0 = Scheduler.fromSeed 100L
    let a = ReticulumLink.mint s0.Now 1L Location.EastUsVa
    let b = ReticulumLink.mint s0.Now 2L Location.WestEurope
    let partitions = Map.empty
    
    // We run 10 packets with the same seed, and verify that the exact same packets are dropped
    let runSimulation seed =
        let mutable state = 
            ReticulumChaos.create partitions seed
            |> ReticulumChaos.announce a
            |> ReticulumChaos.announce b
        let mutable sched = s0
        let mutable deliveredCount = 0
        
        for i in 1 .. 100 do
            let payload = sprintf "msg-%d" i
            let nS, nSched = ReticulumChaos.send a b payload sched NetworkChaosPolicy.DropPackets state
            state <- nS
            sched <- nSched
            
            // Advance timeline to deliver ready packets
            state <- ReticulumChaos.step sched.Now NetworkChaosPolicy.DropPackets state
            
            let delivered, nState = ReticulumChaos.deliver b state
            state <- nState
            deliveredCount <- deliveredCount + delivered.Length
            
        deliveredCount

    let count1 = runSimulation 98765L
    let count2 = runSimulation 98765L
    let count3 = runSimulation 45678L

    // Replay determinism check
    Assert.Equal(count1, count2)
    // Probabilistic check: drops should have occurred (expected count < 100)
    Assert.True(count1 < 100)
    // Distinct seed should result in distinct drop rolls (probabilistically)
    Assert.NotEqual(count1, count3)

[<Fact>]
let ``Reticulum chaos DelayJitter deterministically delays packets`` () =
    let s0 = Scheduler.fromSeed 100L
    let a = ReticulumLink.mint s0.Now 1L Location.EastUsVa
    let b = ReticulumLink.mint s0.Now 2L Location.WestEurope
    let partitions = Map.empty
    
    let seed = 54321L
    let mutable state = 
        ReticulumChaos.create partitions seed
        |> ReticulumChaos.announce a
        |> ReticulumChaos.announce b
    
    // Send a packet under DelayJitter policy
    let stateAfterSend, schedAfterSend = 
        ReticulumChaos.send a b "delayed-hello" s0 NetworkChaosPolicy.DelayJitter state
        
    // Initially, it should NOT be in the medium's in-flight because it was delayed
    Assert.Empty(stateAfterSend.Medium.InFlight)
    Assert.Single(stateAfterSend.DelayedPackets) |> ignore
    
    let _, deliveryTime = stateAfterSend.DelayedPackets.[0]
    
    // Stepping the state before the deliveryTime should NOT deliver the packet
    let stateBeforeDelivery = ReticulumChaos.step (Versionstamp.ofInt64 (deliveryTime.Version - 1L)) NetworkChaosPolicy.DelayJitter stateAfterSend
    Assert.Empty(stateBeforeDelivery.Medium.InFlight)
    
    // Stepping to/past the deliveryTime should deliver the packet to the medium
    let stateAtDelivery = ReticulumChaos.step deliveryTime NetworkChaosPolicy.DelayJitter stateAfterSend
    Assert.Single(stateAtDelivery.Medium.InFlight) |> ignore
    Assert.Empty(stateAtDelivery.DelayedPackets)
    Assert.Equal("delayed-hello", stateAtDelivery.Medium.InFlight.[0].Payload)

[<Fact>]
let ``Reticulum chaos DhtChurn deterministically churns peer announcements`` () =
    let s0 = Scheduler.fromSeed 100L
    let a = ReticulumLink.mint s0.Now 1L Location.EastUsVa
    let partitions = Map.empty
    
    let runChurnSimulation seed =
        let mutable state = 
            ReticulumChaos.create partitions seed
            |> ReticulumChaos.announce a
            
        let mutable reachabilityTrace = []
        let mutable sched = s0
        
        for _ in 1 .. 50 do
            sched <- Scheduler.step sched
            state <- ReticulumChaos.step sched.Now NetworkChaosPolicy.DhtChurn state
            let reachable = ReticulumLink.isReachable a state.Medium
            reachabilityTrace <- reachable :: reachabilityTrace
            
        reachabilityTrace

    let trace1 = runChurnSimulation 8888L
    let trace2 = runChurnSimulation 8888L
    let trace3 = runChurnSimulation 9999L

    // Replay determinism check
    Assert.Equal<bool list>(trace1, trace2)
    // Distinct seed produces distinct trace
    Assert.NotEqual<bool list>(trace1, trace3)
    // Reachability should have churned (both true and false occurred)
    Assert.Contains(true, trace1)
    Assert.Contains(false, trace1)
