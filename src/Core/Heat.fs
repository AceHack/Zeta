namespace Zeta.Core

open System
open System.Collections.Generic

/// Whether a shed **deferred** the payload or **annihilated** it — the one bit the
/// backpressure composition law turns on.
///
/// Model a shed as `m : Q -> Q * Q`, `m offered = (admitted, deferred)`. Call it
/// *conservative* when `admitted ⊎ deferred = offered` — nothing destroyed, the unboarded
/// tail handed back:
///
///   • **Conservative operators compose.** Composition is associative with the admit-all
///     identity as unit (a monoid), and deferred sets join by union — idempotent and
///     order-independent, a join-semilattice. This is a Kahn process network, determinate
///     independently of scheduling (Kahn 1974; Kahn–MacQueen 1977 for the bounded-FIFO
///     blocking-write case that conservative backpressure actually is), which is why the
///     throttle path replays at all under DST (§7).
///   • **Lossy operators compose into nothing.** A destroyed item is invisible to every
///     downstream operator, so the composite depends on application order and the
///     input–output relation is not a compositional semantics (Brock–Ackerman 1981).
///
/// The emitter is the only party that knows which of the two it did, so this is carried as
/// a **declared field** rather than recovered from the kind string. Inference from the kind
/// is unsound in the dangerous direction: the kind classifiers substring-scan the whole
/// dotted kind *including the source prefix*, so a subsystem whose NAME carries a pressure
/// token (`reject-cache.overwritten`, `backpressure-meter.erased`) stamps every kind it
/// emits as deferral — claiming a composition law that the operator does not satisfy.
[<RequireQualifiedAccess>]
type ShedDisposition =
    /// The tail is still held by the caller; a retry reconstructs it. Conservative — composes.
    | Deferred
    /// Nothing retains a seed. Not conservative — does not compose.
    | Annihilated


[<RequireQualifiedAccess>]
module ShedDisposition =

    let token =
        function
        | ShedDisposition.Deferred -> "deferred"
        | ShedDisposition.Annihilated -> "annihilated"

    /// `admitted ⊎ deferred = offered` holds exactly for the deferring half. This is the
    /// predicate the composition law is stated over.
    let isConservative =
        function
        | ShedDisposition.Deferred -> true
        | ShedDisposition.Annihilated -> false


/// A deterministic heat signature for information loss at a room boundary.
///
/// The emitting subsystem should keep the detailed lost payload locally only
/// when it can afford to; this signature is the small host-facing smell:
/// source, kind, units, and fixed-point mass. `MassPpm` is parts per million so
/// cross-language tests can compare integers instead of float formatting.
///
/// `Disposition` is the emitter's declaration of deferral-vs-annihilation. It is
/// `option` deliberately, on the same policy a published schema takes a new key under:
/// an **optional field with a declared absent-reading**. `None` means *this emitter did
/// not declare*, and the absent-reading is "fall back to inferring from `Kind`" — exactly
/// the behaviour every emitter had before the field existed. So adding it changes nothing
/// until an emitter opts in, and `Some` always wins over inference.
type HeatSignature =
    { Source: string
      Kind: string
      Units: int
      MassPpm: int64
      Detail: string
      Disposition: ShedDisposition option }


[<RequireQualifiedAccess>]
module HeatSignature =

    let private kindContains (needle: string) (kind: string) : bool =
        not (String.IsNullOrEmpty kind) && kind.Contains(needle, StringComparison.OrdinalIgnoreCase)

    let isBackpressureKind (kind: string) : bool =
        kindContains "backpressure" kind

    let isDeniedKind (kind: string) : bool =
        kindContains "denied" kind || kindContains "reject" kind

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

    /// Single ordered classification of a kind string. Both `isPressureKind` and
    /// `HeatSignal.ofKind` read this; they cannot disagree (081M010W1BP). And since
    /// 081M07Z23EX they also share ONE pressure table (`isPressureClass`), so they cannot
    /// disagree on membership either.
    ///
    /// Dual-token kinds that carry both a forgetting token and a pressure token
    /// are **pressure**. Missing a pressure signal is fail-dangerous:
    /// `TemperatureReadout.ofHeatSignature` would otherwise read cold for a room
    /// under genuine backpressure. The order is the decision, not an accident
    /// of `if/elif` listing.
    [<RequireQualifiedAccess>]
    type KindClass =
        | Backpressure
        | Denied
        | Forgotten
        | StorageError
        | Invalid
        | Expired
        | Stale
        | Other

    let classifyKind (kind: string) : KindClass =
        if isBackpressureKind kind then KindClass.Backpressure
        elif isDeniedKind kind then KindClass.Denied
        elif isForgettingKind kind then KindClass.Forgotten
        elif isStorageErrorKind kind then KindClass.StorageError
        elif isInvalidKind kind then KindClass.Invalid
        elif isExpiredKind kind then KindClass.Expired
        elif isStaleKind kind then KindClass.Stale
        else KindClass.Other

    /// **The pressure bit, enumerated once for the whole tree** (081M07Z23EX087G0R003N676FT).
    ///
    /// Nothing else in the repo may write `-> true` for pressure over any union: the
    /// `HeatSignal`-keyed route (`HeatSignal.isPressure`) recovers the class with
    /// `HeatSignal.classOf` and reads *this* table. Before that derive there were two
    /// exhaustive tables — one per union — which post-#10804 could no longer disagree on an
    /// INPUT but could still disagree on MEMBERSHIP: add a case, mark it pressure in one table
    /// only. That split is now unrepresentable rather than merely detectable, because there is
    /// no second table to split from.
    ///
    /// The table is keyed on `KindClass` and not on `HeatSignal` because F#'s declaration order
    /// forces it: `HeatSignature` is compiled before `HeatSignal`, so this module cannot call
    /// `HeatSignal.ofKind`, while `HeatSignal` can call back into here. The direction of the
    /// derive is a fact about the file, not a preference.
    let isPressureClass =
        function
        | KindClass.Backpressure
        | KindClass.Denied -> true
        | KindClass.Forgotten
        | KindClass.StorageError
        | KindClass.Invalid
        | KindClass.Expired
        | KindClass.Stale
        | KindClass.Other -> false

    /// Derived from `classifyKind`. A kind is pressure iff the single classifier
    /// said so — never a second, independent substring test.
    let isPressureKind (kind: string) : bool = kind |> classifyKind |> isPressureClass

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
          Detail = detail
          Disposition = None }

    /// `ofMass`, with the emitter **declaring** whether it deferred the payload or
    /// annihilated it. Prefer this wherever the emitting code path structurally knows —
    /// which is every path that had to decide, in code, whether to hand the tail back.
    let ofMassWithDisposition
        (disposition: ShedDisposition)
        (source: string)
        (kind: string)
        (units: int)
        (mass: double)
        (detail: string)
        : HeatSignature =
        { ofMass source kind units mass detail with
            Disposition = Some disposition }

    /// Attach a declaration to an already-built signature (for emitters that construct the
    /// record directly). Declaring twice is idempotent in effect — the last declaration wins.
    let withDisposition (disposition: ShedDisposition) (signature: HeatSignature) : HeatSignature =
        { signature with
            Disposition = Some disposition }


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
        match HeatSignature.classifyKind kind with
        | HeatSignature.KindClass.Backpressure -> HeatSignal.Backpressure
        | HeatSignature.KindClass.Denied -> HeatSignal.Denied
        | HeatSignature.KindClass.Forgotten -> HeatSignal.Forgotten
        | HeatSignature.KindClass.StorageError -> HeatSignal.StorageError
        | HeatSignature.KindClass.Invalid -> HeatSignal.Invalid
        | HeatSignature.KindClass.Expired -> HeatSignal.Expired
        | HeatSignature.KindClass.Stale -> HeatSignal.Stale
        | HeatSignature.KindClass.Other -> HeatSignal.Other kind

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

    /// The inverse of `ofKind`'s case correspondence: recovers the `KindClass` a signal stands
    /// for. It **decides nothing** — no ordering, no predicate, no `true` — it is the mechanical
    /// name-for-name map that lets `isPressure` read `HeatSignature.isPressureClass` instead of
    /// keeping a second copy of the pressure table (081M07Z23EX087G0R003N676FT).
    ///
    /// Honest register on what this trades: the membership split is gone, and what remains is
    /// that `classOf` could be MISWIRED (`HeatSignal.Denied -> KindClass.Forgotten`) — the
    /// compiler checks exhaustiveness, never correspondence. That residual is a strictly smaller
    /// and more visible class than the split it replaces, and it is falsified twice: by the
    /// round-trip law `classOf (ofKind k) = classifyKind k` in `DarkHallScheduler.Tests.fs`, and
    /// by PART B3 of `lint-heat-kind-classifier-agreement.ts`, which reads both directions out
    /// of this file and requires them to be mutual inverses.
    let classOf =
        function
        | HeatSignal.Backpressure -> HeatSignature.KindClass.Backpressure
        | HeatSignal.Denied -> HeatSignature.KindClass.Denied
        | HeatSignal.Forgotten -> HeatSignature.KindClass.Forgotten
        | HeatSignal.StorageError -> HeatSignature.KindClass.StorageError
        | HeatSignal.Invalid -> HeatSignature.KindClass.Invalid
        | HeatSignal.Expired -> HeatSignature.KindClass.Expired
        | HeatSignal.Stale -> HeatSignature.KindClass.Stale
        | HeatSignal.Other _ -> HeatSignature.KindClass.Other

    /// Pressure, over the signal union. Derived — `HeatSignature.isPressureClass` is the only
    /// place the bit is named. Signature unchanged (`HeatSignal -> bool`): `DarkHallScheduler`,
    /// `dispositionOfKind`, `ofCounts`, and `SchedulerShedHeat.Tests` all call it as before.
    let isPressure (signal: HeatSignal) : bool =
        signal |> classOf |> HeatSignature.isPressureClass

    let ofSignature (signature: HeatSignature) : HeatSignal =
        ofKind signature.Kind

    /// The disposition **inferred** from a kind string — the legacy fallback, and the only
    /// route available before `HeatSignature.Disposition` existed.
    ///
    /// It is derived from the single ordered `ofKind` chain (never recomputed beside it), so
    /// it cannot drift from the signal vocabulary. It is nonetheless **unsound**, and in the
    /// direction that matters: the classifiers substring-match the whole dotted kind, source
    /// prefix included, so a destroying operator emitted by a subsystem whose name carries a
    /// pressure token reads as `Deferred` — i.e. claims a composition law it does not satisfy.
    /// Measured witnesses (single-token, so not the dual-token case a kind-literal lint
    /// catches): `reject-cache.overwritten`, `denied-list.compacted`,
    /// `rejection-sampler.evicted`, `backpressure-meter.erased`. Dual-token kinds
    /// are pressure by `classifyKind` (081M010W1BP) and so read `Deferred` here —
    /// that is the fail-safe direction, not this collision.
    ///
    /// Note the *other* direction is merely pessimistic: an unrecognised kind falls to
    /// `Other`, which reads `Annihilated`, so an undeclared deferral is over-charged rather
    /// than wrongly trusted. Only the pressure-token collision is unsound.
    let dispositionOfKind (kind: string) : ShedDisposition =
        if kind |> ofKind |> isPressure then
            ShedDisposition.Deferred
        else
            ShedDisposition.Annihilated

    /// The disposition of a signature: the emitter's **declaration** when it made one, and
    /// only otherwise the inference from `Kind`. This is the single read — nothing else in
    /// the tree should decide deferral-vs-annihilation.
    ///
    /// A declared disposition is *intrinsic*: relabelling `Kind` cannot change it. That is
    /// the whole point of the field, and it is the property the law tests pin.
    let dispositionOfSignature (signature: HeatSignature) : ShedDisposition =
        match signature.Disposition with
        | Some declared -> declared
        | None -> dispositionOfKind signature.Kind

    /// Whether a signature's shed is conservative — `admitted ⊎ deferred = offered`, hence
    /// composable. Declared-field-first, by way of `dispositionOfSignature`.
    let isConservativeSignature (signature: HeatSignature) : bool =
        signature |> dispositionOfSignature |> ShedDisposition.isConservative

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
    let BlackBodySchema = "zeta.blackbody.readout.v1"

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


/// Why a ppm channel value may fail to faithfully represent the input it
/// encodes. The mirror of TypeScript's `ChannelFidelity`
/// (`src/Core.TypeScript/darkhall-ui/heat.ts`).
///
/// `Exact` is the only case that asserts the channel round-trips the input's
/// ordering. The other three are the DECLARED half of the injectivity
/// discipline: a saturating or quantising encoder is honest exactly when it
/// says so.
///
/// F# reaches three of the four cases. `BelowResolution` is not reachable from
/// `TemperatureReadout` (the ppm lane has no sub-unit quantisation to declare)
/// and is present so the token alphabet is one alphabet across oracles rather
/// than two that happen to overlap.
[<RequireQualifiedAccess>]
type ChannelFidelity =
    | Exact
    | Saturated
    | BelowResolution
    | OutOfDomain


[<RequireQualifiedAccess>]
module ChannelFidelity =

    let token =
        function
        | ChannelFidelity.Exact -> "exact"
        | ChannelFidelity.Saturated -> "saturated"
        | ChannelFidelity.BelowResolution -> "below-resolution"
        | ChannelFidelity.OutOfDomain -> "out-of-domain"


type TemperatureReadout =
    { Schema: string
      Source: string
      TemperaturePpm: int
      Band: string
      HeatPpm: int
      UncertaintyPpm: int
      PressurePpm: int
      AttentionPpm: int
      /// What the clamp absorbed. Declared last so the emitted JSON key order is
      /// unchanged and the wire diff against a pre-fidelity `v1` instance is
      /// purely additive.
      Fidelity: string }


type BlackBodyReadout =
    { Schema: string
      Source: string
      TemperaturePpm: int
      RadiancePpm: int
      PeakFrequencyPpm: int }


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

    /// What `clampPpm` absorbed across the four input channels.
    ///
    /// Mirrors TypeScript's rule in `temperatureReadout`, restricted to the
    /// inputs an `int` can actually hold: a negative input is out of the treaty
    /// domain `[0, MaxPpm]`; an input above `MaxPpm` saturates. `NaN` and
    /// `Infinity` — the motivating cases on the TypeScript side — are not
    /// representable in `int`, so `OutOfDomain` here is reached by the negative
    /// branch alone.
    ///
    /// Out-of-domain outranks saturated: an input that is not a measurement at
    /// all is a worse fault than one the channel merely could not hold.
    ///
    /// This is the half of the fidelity question that is NOT a TypeScript
    /// encoder concern. `max 0 |> min MaxPpm` discarded a negative and an
    /// above-ceiling input exactly as silently as the TypeScript clamp did
    /// before PR #10722, and nothing said so.
    let fidelityOfPpm (heatPpm: int) (uncertaintyPpm: int) (pressurePpm: int) (attentionPpm: int) : ChannelFidelity =
        let inputs = [ heatPpm; uncertaintyPpm; pressurePpm; attentionPpm ]

        if inputs |> List.exists (fun value -> value < 0) then
            ChannelFidelity.OutOfDomain
        elif inputs |> List.exists (fun value -> value > MaxPpm) then
            ChannelFidelity.Saturated
        else
            ChannelFidelity.Exact

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
          AttentionPpm = attention
          Fidelity =
            fidelityOfPpm heatPpm uncertaintyPpm pressurePpm attentionPpm
            |> ChannelFidelity.token }

    let ofHeatSignature (signature: HeatSignature) : TemperatureReadout =
        let pressure =
            if HeatSignal.ofSignature signature |> HeatSignal.isPressure then
                MaxPpm
            else
                0

        ofPpm signature.Source (int (min (int64 MaxPpm) signature.MassPpm)) 0 pressure 0


/// Dimensionless black-body reference readout for the information-temperature
/// lane. The mapping intentionally uses normalized ppm values, not SI Kelvin:
/// emitted radiance follows the Stefan-Boltzmann fourth-power shape, while the
/// frequency peak follows a Wien-style linear temperature lane.
[<RequireQualifiedAccess>]
module BlackBodyReadout =

    let radiancePpm (temperaturePpm: int) : int =
        let t = TemperatureReadout.clampPpm temperaturePpm |> int64
        let maxPpm = int64 TemperatureReadout.MaxPpm
        let square = (t * t) / maxPpm
        int ((square * square) / maxPpm)

    let peakFrequencyPpm (temperaturePpm: int) : int =
        TemperatureReadout.clampPpm temperaturePpm

    let ofTemperaturePpm (source: string) (temperaturePpm: int) : BlackBodyReadout =
        let temperature = TemperatureReadout.clampPpm temperaturePpm

        { Schema = HeatReadout.BlackBodySchema
          Source = source
          TemperaturePpm = temperature
          RadiancePpm = radiancePpm temperature
          PeakFrequencyPpm = peakFrequencyPpm temperature }

    let ofTemperatureReadout (readout: TemperatureReadout) : BlackBodyReadout =
        ofTemperaturePpm readout.Source readout.TemperaturePpm


/// Feedback from a temperature reference oracle. The runtime owns the
/// temperature lane; Q# and other plugins must conform to this interface
/// instead of pulling their implementation into the room runtime.
[<RequireQualifiedAccess>]
type TemperatureReferenceFeedback =
    | EmptyOracleName
    | TemperatureSchemaMismatch of expected: string * actual: string


/// Source-owned port for external temperature/black-body reference oracles.
/// Q# can plug in here as an oracle; it is not the runtime that emits heat.
type ITemperatureReferenceOracle =
    abstract Name: string
    abstract Project: readout: TemperatureReadout -> Result<BlackBodyReadout, TemperatureReferenceFeedback>


[<RequireQualifiedAccess>]
module TemperatureReferenceOracle =

    let localBlackBody : ITemperatureReferenceOracle =
        { new ITemperatureReferenceOracle with
            member _.Name = "fsharp-blackbody-reference"

            member _.Project readout =
                if readout.Schema <> HeatReadout.TemperatureSchema then
                    Error(TemperatureReferenceFeedback.TemperatureSchemaMismatch(HeatReadout.TemperatureSchema, readout.Schema))
                else
                    Ok(BlackBodyReadout.ofTemperatureReadout readout) }

    let project (oracle: ITemperatureReferenceOracle) (readout: TemperatureReadout)
        : Result<BlackBodyReadout, TemperatureReferenceFeedback> =
        if Object.ReferenceEquals(oracle, null) || String.IsNullOrWhiteSpace oracle.Name then
            Error TemperatureReferenceFeedback.EmptyOracleName
        else
            oracle.Project readout


/// A compact source-owned treaty bundle that lets room transcripts, Bayesian
/// plugins, and Q# reference code talk about the same finite temperature lane.
type TemperatureTreatyBundle =
    { HeatReadoutSchema: string
      TemperatureReadoutSchema: string
      BlackBodyReadoutSchema: string
      QSharpTreaty: string
      QSharpSource: string
      FSharpSurface: string
      ReferenceOracle: string
      Temperature: TemperatureReadout
      BlackBody: BlackBodyReadout }


[<RequireQualifiedAccess>]
module TemperatureTreatyBundle =

    let ofTemperatureReadout
        (oracle: ITemperatureReferenceOracle)
        (temperature: TemperatureReadout)
        : Result<TemperatureTreatyBundle, TemperatureReferenceFeedback> =
        result {
            let! blackBody = TemperatureReferenceOracle.project oracle temperature

            return
                { HeatReadoutSchema = HeatReadout.Schema
                  TemperatureReadoutSchema = HeatReadout.TemperatureSchema
                  BlackBodyReadoutSchema = HeatReadout.BlackBodySchema
                  QSharpTreaty = HeatReadout.SignalTreaty
                  QSharpSource = HeatReadout.QSharpSignalSource
                  FSharpSurface = HeatReadout.FSharpSurface
                  ReferenceOracle = oracle.Name
                  Temperature = temperature
                  BlackBody = blackBody }
        }


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
