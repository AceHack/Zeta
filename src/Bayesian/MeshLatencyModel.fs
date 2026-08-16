namespace Zeta.Bayesian

open System
open Zeta.Core

/// **`MeshLatencyModel` — mesh link telemetry → the latency map the Delay-Decorrelation router needs.**
///
/// **This module is NOT a transport.** It opens no link, sends nothing, receives nothing and moves
/// no bytes; it is a pure function from *already-measured* link quality (RTT, RSSI, SNR, capacity)
/// to the `Map<(node, node), float>` that `AttentionRouter` reads to grant the Condorcet bonus. It
/// was named `ReticulumTransport` until 2026-08-16, which asserted a capability the code does not
/// have — the same defect class as `genomeToAdinkraByte`, whose name claimed the `[8,4,4]` code
/// while it emitted a single parity bit. The name now states the behaviour.
///
/// It is a **model**, not a telemetry pass-through, and the two modelling choices are the reason
/// "model" is the honest noun: `buildLatencyMap` imposes a **symmetric** latency assumption (`:47`)
/// that no radio guarantees, and `telemetryToLatency` **discards SNR, RSSI and capacity entirely**,
/// keeping only RTT. A caller wanting link *quality* rather than link *delay* will not find it here.
///
/// Who supplies the telemetry is out of scope — any mesh that reports per-link RTT will do, which
/// is why the name no longer says Reticulum. Under `toy-is-free-metered-must-be-earned` this is
/// **unmetered**: `Bayesian.Tests` exercises it against hand-built snapshots, never a live radio.
[<RequireQualifiedAccess>]
module MeshLatencyModel =

    /// Telemetry for one mesh link, as reported by whatever measured it.
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

    /// Projects one link's telemetry onto the scalar latency the Delay-Decorrelation theorem uses.
    ///
    /// **Lossy by construction:** this keeps `RttSeconds` and drops `Snr`, `Rssi` and `CapacityBps`.
    /// The rationale is that in a radio mesh high RTT usually implies multi-hop or low-bandwidth
    /// paths, which lines up with the Condorcet assumption that slower paths are more likely to be
    /// independent observations — but that is an *argument*, not a measurement, and it has not been
    /// falsified against a live mesh here.
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

    /// Feeds the modelled latency map to the Attention Router and returns its delay-adjusted
    /// routing decisions. Computes decisions only — it does not route, and it sends nothing.
    let computeMeshRoutingDecisions 
        (snapshot: MeshSnapshot) 
        (config: AttentionRouter.AttentionRouterConfig)
        (agents: AttentionRouter.AgentState list) : AttentionRouter.RoutingDecision list =
        
        let latencyMap = buildLatencyMap snapshot
        AttentionRouter.routeWithReticulum config agents latencyMap
