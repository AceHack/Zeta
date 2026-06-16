namespace Zeta.Core

open System
open System.Collections.Generic

/// A deterministic heat signature for information loss at a room boundary.
///
/// The emitting subsystem should keep the detailed lost payload locally only
/// when it can afford to; this signature is the small host-facing smell:
/// source, kind, units, and fixed-point mass. `MassPpm` is parts per million so
/// cross-language tests can compare integers instead of float formatting.
type HeatSignature =
    { Source: string
      Kind: string
      Units: int
      MassPpm: int64
      Detail: string }


[<RequireQualifiedAccess>]
module HeatSignature =

    let ofMass (source: string) (kind: string) (units: int) (mass: double) (detail: string) : HeatSignature =
        let ppm =
            if Double.IsNaN mass || Double.IsInfinity mass then
                0L
            else
                int64 (Math.Round(max 0.0 mass * 1_000_000.0))

        { Source = source
          Kind = kind
          Units = max 0 units
          MassPpm = ppm
          Detail = detail }


/// Feedback from the injected heat sink. Heat is diagnostic output, but the
/// sink still has a budget; if even the heat cannot fit, report backpressure
/// rather than recursively losing the loss signal.
[<RequireQualifiedAccess>]
type HeatSinkFeedback =
    | Backpressure of heat: HeatSignature * capacity: int * count: int
    | StorageError of BoundedGSetError


/// Injected IO port for heat. Production can export these signatures to host
/// telemetry; tests can bind a recorder; tiny rooms can bind a bounded in-room
/// store and learn when the heat channel itself saturates.
type IHeatSink =
    abstract Emit: heat: HeatSignature -> Result<unit, HeatSinkFeedback>


[<Sealed>]
type NullHeatSink() =
    interface IHeatSink with
        member _.Emit _ = Ok()


[<Sealed>]
type RecordingHeatSink() =
    let signatures = List<HeatSignature>()
    let lockObj = obj ()
    member _.Signatures : IReadOnlyList<HeatSignature> = upcast signatures
    interface IHeatSink with
        member _.Emit heat =
            lock lockObj (fun () -> signatures.Add heat)
            Ok()


/// Bounded in-room heat storage. Use `RejectNew` for the no-forget mode; use a
/// forgetting policy only for experiments that explicitly measure heat-channel
/// self-shedding via `StorageHeat`.
[<Sealed>]
type BoundedHeatSink(config: BoundedGSetConfig) =
    let lockObj = obj ()
    let mutable state = BoundedGSet.empty<HeatSignature> config
    let mutable storageHeat = BoundedGSet.emptyHeat<HeatSignature>

    member _.Stored : HeatSignature list =
        lock lockObj (fun () ->
            match state with
            | Ok s -> BoundedGSet.toList s
            | Error _ -> [])

    member _.StorageHeat : BoundedGSetHeat<HeatSignature> =
        lock lockObj (fun () -> storageHeat)

    interface IHeatSink with
        member _.Emit heat =
            lock lockObj (fun () ->
                match state with
                | Error e -> Error(HeatSinkFeedback.StorageError e)
                | Ok s ->
                    match BoundedGSet.add heat s with
                    | Error e -> Error(HeatSinkFeedback.StorageError e)
                    | Ok added ->
                        match added.Admission with
                        | BoundedGSetAdmission.RejectedByBound ->
                            Error(HeatSinkFeedback.Backpressure(heat, s.Capacity, s.Count + 1))
                        | BoundedGSetAdmission.Admitted
                        | BoundedGSetAdmission.AlreadyPresent ->
                            state <- Ok added.State
                            storageHeat <-
                                { Forgotten = GSet.union storageHeat.Forgotten added.Heat.Forgotten
                                  Units = storageHeat.Units + added.Heat.Units }
                            Ok())
