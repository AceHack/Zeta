namespace Zeta.Core

open System
open Zeta.Core.FSharp.ZetaId
open ReticulumLink


/// Deterministic network chaos simulation policies.
[<Flags>]
type NetworkChaosPolicy =
    | None          = 0
    | DropPackets   = 1
    | DelayJitter   = 2
    | DhtChurn      = 4
    | Partitioning  = 8

/// The state of the simulated network chaos environment.
type NetworkChaosState =
    { Medium: Medium
      DelayedPackets: (Packet * Versionstamp) list
      PartitionMap: Map<Destination, int>
      AnnounceHistory: Set<Destination>
      RngState: int64 }

module ReticulumChaos =

    /// Standard splitmix64 deterministic random number generator step.
    /// Pure, functional state transition: input RNG state -> returns (value, next RNG state).
    let splitMix (state: int64) : int64 * int64 =
        let nextState = state + 0x9E3779B97F4A7C15L
        let mutable z = nextState
        z <- (z ^^^ (z >>> 30)) * 0xBF58476D1CE4E5B9L
        z <- (z ^^^ (z >>> 27)) * 0x94D049BB133111EBL
        let value = z ^^^ (z >>> 31)
        value, nextState

    /// Create an initial NetworkChaosState.
    let create (partitions: Map<Destination, int>) (seed: int64) : NetworkChaosState =
        { Medium = ReticulumLink.empty
          DelayedPackets = []
          PartitionMap = partitions
          AnnounceHistory = Set.empty
          RngState = seed }

    /// Announce a destination, recording it in history to support subsequent DHT Churn.
    let announce (d: Destination) (state: NetworkChaosState) : NetworkChaosState =
        let nextMedium = ReticulumLink.announce d state.Medium
        { state with
            Medium = nextMedium
            AnnounceHistory = state.AnnounceHistory.Add d }

    /// Connect two destinations under chaos rules (fails if they are partitioned).
    let connect (a: Destination) (b: Destination) (policy: NetworkChaosPolicy) (state: NetworkChaosState) : Result<Link, LinkError> =
        match ReticulumLink.connect a b state.Medium with
        | Error err -> Error err
        | Ok link ->
            let isPartitioned =
                if (policy &&& NetworkChaosPolicy.Partitioning) = NetworkChaosPolicy.Partitioning then
                    let partA = Map.tryFind a state.PartitionMap |> Option.defaultValue 0
                    let partB = Map.tryFind b state.PartitionMap |> Option.defaultValue 0
                    partA <> partB
                else
                    false
            if isPartitioned then
                Error(LinkError.Unreachable b)
            else
                Ok link

    /// Send a packet from a to b under drop, delay, and partition chaos rules.
    let send (from: Destination) (toD: Destination) (payload: string) (s: Scheduler) (policy: NetworkChaosPolicy) (state: NetworkChaosState)
        : NetworkChaosState * Scheduler =
        
        let isPartitioned =
            if (policy &&& NetworkChaosPolicy.Partitioning) = NetworkChaosPolicy.Partitioning then
                let partA = Map.tryFind from state.PartitionMap |> Option.defaultValue 0
                let partB = Map.tryFind toD state.PartitionMap |> Option.defaultValue 0
                partA <> partB
            else
                false

        if isPartitioned then
            // Partitioned: packet is silently dropped
            state, Scheduler.step s
        else
            let mutable rng = state.RngState
            
            // 1. Probabilistic Packet Drop (e.g., 10% rate)
            let isDropped, nextRng =
                if (policy &&& NetworkChaosPolicy.DropPackets) = NetworkChaosPolicy.DropPackets then
                    let roll, nR = splitMix rng
                    let prob = (float (uint64 roll &&& 0xFFFF_FFFFUL)) / 4294967295.0
                    prob < 0.10, nR
                else
                    false, rng

            if isDropped then
                { state with RngState = nextRng }, Scheduler.step s
            else
                // 2. Probabilistic Delay Jitter (e.g., 1 to 5 versionstamp steps delay)
                let delay, finalRng =
                    if (policy &&& NetworkChaosPolicy.DelayJitter) = NetworkChaosPolicy.DelayJitter then
                        let roll, nR = splitMix nextRng
                        let delayVal = 1L + (abs roll % 5L)
                        delayVal, nR
                    else
                        0L, nextRng

                let pkt = { From = from; To = toD; Payload = payload; At = s.Now }
                let nextScheduler = Scheduler.step s

                if delay > 0L then
                    let deliveryTime = Versionstamp.ofInt64 (s.Now.Version + delay)
                    let delayedList = state.DelayedPackets @ [ (pkt, deliveryTime) ]
                    { state with
                        DelayedPackets = delayedList
                        RngState = finalRng }, nextScheduler
                else
                    let nextMedium = { state.Medium with InFlight = state.Medium.InFlight @ [ pkt ] }
                    { state with
                        Medium = nextMedium
                        RngState = finalRng }, nextScheduler

    /// Drain packets addressed to a destination.
    let deliver (d: Destination) (state: NetworkChaosState) : Packet list * NetworkChaosState =
        let mine, rest = ReticulumLink.deliver d state.Medium
        mine, { state with Medium = rest }

    /// Advances the network chaos timeline by one versionstamp tick.
    /// Delivers any ready delayed packets, and applies DHT churn to announced destinations.
    let step (currentTimestamp: Versionstamp) (policy: NetworkChaosPolicy) (state: NetworkChaosState) : NetworkChaosState =
        // 1. Process delayed packet delivery
        let ready, remaining =
            state.DelayedPackets
            |> List.partition (fun (_, deliveryTime) -> deliveryTime.Version <= currentTimestamp.Version)

        let readyPackets = ready |> List.map fst
        let nextInFlight = state.Medium.InFlight @ readyPackets
        let nextMedium = { state.Medium with InFlight = nextInFlight }

        // 2. Process DHT Churn (reachability flip for historically announced nodes)
        let mutable rng = state.RngState
        let mutable announced = nextMedium.Announced

        if (policy &&& NetworkChaosPolicy.DhtChurn) = NetworkChaosPolicy.DhtChurn then
            for d in state.AnnounceHistory do
                let roll, nR = splitMix rng
                rng <- nR
                let prob = (float (uint64 roll &&& 0xFFFF_FFFFUL)) / 4294967295.0
                // 15% chance of state churn transition
                if prob < 0.15 then
                    if List.contains d announced then
                        // Retract the DHT entry
                        announced <- announced |> List.filter (fun x -> x <> d)
                    else
                        // Inject the DHT entry
                        announced <- announced @ [ d ]

        { state with
            Medium = { nextMedium with Announced = announced }
            DelayedPackets = remaining
            RngState = rng }
