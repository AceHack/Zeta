namespace Zeta.Bayesian

open System
open Zeta.Core

/// **`ReticulumTransport` — Physical wiring for the Delay-Decorrelation Theorem.**
///
/// This module bridges the theoretical `AttentionRouter` and `DelayDecorrelation` 
/// modules with the physical reality of a Reticulum mesh network. It converts 
/// Reticulum link quality metrics (RTT, RSSI, SNR) into the latency map required 
/// by the router to grant the Condorcet bonus.
[<RequireQualifiedAccess>]
module ReticulumTransport =

    /// Represents the physical telemetry of a Reticulum link.
    type LinkTelemetry =
        { /// Round-trip time in seconds
          RttSeconds: float
          /// Signal-to-noise ratio
          Snr: float
          /// Received signal strength indicator
          Rssi: float
          /// Link capacity in bits per second
          CapacityBps: float }

    /// A snapshot of all active links from the perspective of one node.
    type MeshSnapshot =
        { LocalNodeId: string
          /// Map of remote node IDs to their link telemetry
          ActiveLinks: Map<string, LinkTelemetry> }

    /// Converts physical Reticulum telemetry into the abstract latency 
    /// used by the Delay-Decorrelation theorem.
    /// 
    /// In a real radio mesh, high RTT usually implies multi-hop or low-bandwidth 
    /// connections, which perfectly aligns with the Condorcet assumption: 
    /// slower paths are more likely to be independent observations.
    let telemetryToLatency (telemetry: LinkTelemetry) : float =
        max 0.0 telemetry.RttSeconds

    /// Converts a mesh snapshot into the latency map required by `AttentionRouter.routeWithReticulum`.
    let buildLatencyMap (snapshot: MeshSnapshot) : Map<string * string, float> =
        snapshot.ActiveLinks
        |> Map.toList
        |> List.map (fun (remoteId, telemetry) -> 
            let latency = telemetryToLatency telemetry
            // Symmetric latency assumption for routing matrix
            [ ((snapshot.LocalNodeId, remoteId), latency)
              ((remoteId, snapshot.LocalNodeId), latency) ])
        |> List.concat
        |> Map.ofList

    /// Integrates the physical mesh telemetry with the Attention Router.
    /// Returns the delay-adjusted routing decisions.
    let computeMeshRoutingDecisions 
        (snapshot: MeshSnapshot) 
        (config: AttentionRouter.AttentionRouterConfig)
        (agents: AttentionRouter.AgentState list) : AttentionRouter.RoutingDecision list =
        
        let latencyMap = buildLatencyMap snapshot
        AttentionRouter.routeWithReticulum config agents latencyMap
