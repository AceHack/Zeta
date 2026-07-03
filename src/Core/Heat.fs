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

    let private kindContains (needle: string) (kind: string) : bool =
        not (String.IsNullOrEmpty kind) && kind.Contains(needle, StringComparison.OrdinalIgnoreCase)

    let isBackpressureKind (kind: string) : bool =
        kindContains "backpressure" kind

    let isDeniedKind (kind: string) : bool =
        kindContains "denied" kind || kindContains "reject" kind

    let isPressureKind (kind: string) : bool =
        isBackpressureKind kind || isDeniedKind kind

    let isForgettingKind (kind: string) : bool =
        kindContains "forgotten" kind || kindContains "forget" kind || kindContains "prune" kind

    let isStorageErrorKind (kind: string) : bool =
        kindContains "storage" kind

    let isInvalidKind (kind: string) : bool =
        kindContains "invalid" kind || kindContains "decode" kind || kindContains "parse" kind

    let isExpiredKind (kind: string) : bool =
        kindContains "expired" kind || kindContains "expire" kind || kindContains "ttl" kind

    let isStaleKind (kind: string) : bool =
        kindContains "stale" kind

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


/// Shared, typed signal vocabulary for heat emitted through host IO and
/// projected into room/UI transcripts.
[<RequireQualifiedAccess>]
type HeatSignal =
    | Forgotten
    | Backpressure
    | Denied
    | StorageError
    | Invalid
    | Expired
    | Stale
    | Other of kind: string


[<RequireQualifiedAccess>]
module HeatSignal =

    let ofKind (kind: string) : HeatSignal =
        if HeatSignature.isForgettingKind kind then
            HeatSignal.Forgotten
        elif HeatSignature.isBackpressureKind kind then
            HeatSignal.Backpressure
        elif HeatSignature.isDeniedKind kind then
            HeatSignal.Denied
        elif HeatSignature.isStorageErrorKind kind then
            HeatSignal.StorageError
        elif HeatSignature.isInvalidKind kind then
            HeatSignal.Invalid
        elif HeatSignature.isExpiredKind kind then
            HeatSignal.Expired
        elif HeatSignature.isStaleKind kind then
            HeatSignal.Stale
        else
            HeatSignal.Other kind

    let token =
        function
        | HeatSignal.Forgotten -> "forgotten"
        | HeatSignal.Backpressure -> "backpressure"
        | HeatSignal.Denied -> "denied"
        | HeatSignal.StorageError -> "storage-error"
        | HeatSignal.Invalid -> "invalid"
        | HeatSignal.Expired -> "expired"
        | HeatSignal.Stale -> "stale"
        | HeatSignal.Other _ -> "other"

    let isPressure =
        function
        | HeatSignal.Backpressure
        | HeatSignal.Denied -> true
        | HeatSignal.Forgotten
        | HeatSignal.StorageError
        | HeatSignal.Invalid
        | HeatSignal.Expired
        | HeatSignal.Stale
        | HeatSignal.Other _ -> false

    let ofSignature (signature: HeatSignature) : HeatSignal =
        ofKind signature.Kind

    let tokenOfKind (kind: string) : string =
        kind |> ofKind |> token

    let tokenOfSignature (signature: HeatSignature) : string =
        signature |> ofSignature |> token

    let ofCounts (heatKinds: string list) (backpressured: int) (storageErrors: int) : HeatSignal list =
        let fromKinds = heatKinds |> List.map ofKind
        let hasPressureKind = fromKinds |> List.exists isPressure

        [ yield! fromKinds

          if backpressured > 0 && not hasPressureKind then
              HeatSignal.Backpressure

          if storageErrors > 0 then
              HeatSignal.StorageError ]
        |> List.distinct


/// Source-owned treaty anchors for heat readouts. Runtime rooms emit heat
/// through injected ports; Q# and other model plugins only mirror this finite
/// vocabulary as an oracle/reference surface.
[<RequireQualifiedAccess>]
module HeatReadout =

    [<Literal>]
    let Schema = "zeta.heat.readout.v1"

    [<Literal>]
    let TemperatureSchema = "zeta.temperature.readout.v1"

    [<Literal>]
    let SignalTreaty = "src/Core.QSharp.ReferenceOracle/heat-signals-treaty.json"

    [<Literal>]
    let QSharpSignalSource = "src/Core.QSharp.ReferenceOracle/HeatSignals.qs"

    [<Literal>]
    let FSharpSurface = "src/Core/Heat.fs"


/// A bounded scalar readout for uncertainty/pressure heat. The fixed-point
/// parts-per-million scale lets F#, TS, Q#, and Bayesian plugin code compare
/// the same values without float formatting becoming part of the treaty.
[<RequireQualifiedAccess>]
type TemperatureBand =
    | Cold
    | Warm
    | Hot
    | Critical


[<RequireQualifiedAccess>]
module TemperatureBand =

    let token =
        function
        | TemperatureBand.Cold -> "cold"
        | TemperatureBand.Warm -> "warm"
        | TemperatureBand.Hot -> "hot"
        | TemperatureBand.Critical -> "critical"

    let code =
        function
        | TemperatureBand.Cold -> 0
        | TemperatureBand.Warm -> 1
        | TemperatureBand.Hot -> 2
        | TemperatureBand.Critical -> 3


type TemperatureReadout =
    { Schema: string
      Source: string
      TemperaturePpm: int
      Band: string
      HeatPpm: int
      UncertaintyPpm: int
      PressurePpm: int
      AttentionPpm: int }


[<RequireQualifiedAccess>]
module TemperatureReadout =

    [<Literal>]
    let MaxPpm = 1_000_000

    [<Literal>]
    let WarmMaxPpm = 333_333

    [<Literal>]
    let HotMaxPpm = 666_666

    let clampPpm (value: int) : int =
        value |> max 0 |> min MaxPpm

    let bandOfPpm (value: int) : TemperatureBand =
        let ppm = clampPpm value

        if ppm = 0 then
            TemperatureBand.Cold
        elif ppm <= WarmMaxPpm then
            TemperatureBand.Warm
        elif ppm <= HotMaxPpm then
            TemperatureBand.Hot
        else
            TemperatureBand.Critical

    let thermalPpm (heatPpm: int) (uncertaintyPpm: int) (pressurePpm: int) : int =
        [ heatPpm; uncertaintyPpm; pressurePpm ]
        |> List.map clampPpm
        |> List.max

    let ofPpm
        (source: string)
        (heatPpm: int)
        (uncertaintyPpm: int)
        (pressurePpm: int)
        (attentionPpm: int)
        : TemperatureReadout =
        let heat = clampPpm heatPpm
        let uncertainty = clampPpm uncertaintyPpm
        let pressure = clampPpm pressurePpm
        let attention = clampPpm attentionPpm
        let temperature = thermalPpm heat uncertainty pressure
        let band = bandOfPpm temperature

        { Schema = HeatReadout.TemperatureSchema
          Source = source
          TemperaturePpm = temperature
          Band = TemperatureBand.token band
          HeatPpm = heat
          UncertaintyPpm = uncertainty
          PressurePpm = pressure
          AttentionPpm = attention }

    let ofHeatSignature (signature: HeatSignature) : TemperatureReadout =
        let pressure =
            if HeatSignal.ofSignature signature |> HeatSignal.isPressure then
                MaxPpm
            else
                0

        ofPpm signature.Source (int (min (int64 MaxPpm) signature.MassPpm)) 0 pressure 0


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


[<RequireQualifiedAccess>]
module BoundedHeat =

    /// Convert bounded finite-view loss into the common host-facing heat
    /// signature. Empty heat stays cold: callers should not spend heat-channel
    /// capacity to say that nothing was forgotten.
    let signature
        (source: string)
        (kind: string)
        (detail: string)
        (heat: BoundedGSetHeat<'T>)
        : HeatSignature option =
        if heat.Units <= 0 then
            None
        else
            Some(HeatSignature.ofMass source kind heat.Units (float heat.Units) detail)

    /// Emit bounded finite-view loss through an injected host or in-room heat
    /// sink. Sink backpressure is preserved on the typed feedback channel.
    let emit
        (sink: IHeatSink)
        (source: string)
        (kind: string)
        (detail: string)
        (heat: BoundedGSetHeat<'T>)
        : Result<unit, HeatSinkFeedback> =
        match signature source kind detail heat with
        | None -> Ok()
        | Some heatSignature -> sink.Emit heatSignature


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


/// Bounded in-room heat storage. Use `NoForgetBackpressure` for the no-forget
/// mode; use a forgetting policy only for experiments that explicitly measure
/// heat-channel self-shedding via `StorageHeat`.
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
