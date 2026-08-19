namespace Zeta.Core

open System.Globalization
open Zeta.Core.Abstractions

/// Source-owned thermodynamic profiles and additive heat adapters for `WSet`.
///
/// The bit masses are maxima measured over the committed finite reference domain
/// in `WSet.ErasureClassification.Laws.Tests.fs`. They classify operation shape;
/// they are not a claim about the physical dissipation of an individual call.
[<RequireQualifiedAccess>]
module WSetHeat =

    /// The substrate-wide classification, not a local one. `ErasureClass` owns this vocabulary so
    /// a delta log, a backing store and a WSet operation are all classified in the same units —
    /// and so nothing can be free in one module's books and costly in another's.
    type ThermodynamicClass = ErasureClass.ThermodynamicClass

    /// The exact specializations measured by the finite-domain law pack.
    /// `ApplyInjective` and `MapKeysInjective` deliberately name their premise;
    /// arbitrary functions supplied to those WSet operations need not be injective.
    [<RequireQualifiedAccess>]
    type Operation =
        | Negate
        | Copy
        | MapKeysInjective
        | ApplyInjective
        | Consolidate
        | Discard
        | BornProb
        | Plus
        | Tensor

    type ReferenceProfile =
        { Operation: Operation
          WSetFunction: string
          Specialization: string
          Classification: ThermodynamicClass
          LargestFibre: int
          BitsErasedPpm: int64 }

    /// A WSet result paired with its finite-reference-domain profile. Reversible
    /// operations carry no heat; erasing operations carry one optional signature
    /// that the caller may send through an injected `IHeatSink`.
    type Metered<'T> =
        { Value: 'T
          Profile: ReferenceProfile
          Heat: HeatSignature option }

    let profile =
        function
        | Operation.Negate ->
            { Operation = Operation.Negate
              WSetFunction = "negate"
              Specialization = "negate over a star ring"
              Classification = ThermodynamicClass.Reversible
              LargestFibre = 1
              BitsErasedPpm = 0L }
        | Operation.Copy ->
            { Operation = Operation.Copy
              WSetFunction = "copy"
              Specialization = "diagonal key copy"
              Classification = ThermodynamicClass.Reversible
              LargestFibre = 1
              BitsErasedPpm = 0L }
        | Operation.MapKeysInjective ->
            { Operation = Operation.MapKeysInjective
              WSetFunction = "mapKeys"
              Specialization = "injective key mapping"
              Classification = ThermodynamicClass.Reversible
              LargestFibre = 1
              BitsErasedPpm = 0L }
        | Operation.ApplyInjective ->
            { Operation = Operation.ApplyInjective
              WSetFunction = "apply"
              Specialization = "injective one-row operator"
              Classification = ThermodynamicClass.Reversible
              LargestFibre = 1
              BitsErasedPpm = 0L }
        | Operation.Consolidate ->
            { Operation = Operation.Consolidate
              WSetFunction = "consolidate"
              Specialization = "integer ring with zero-weight removal"
              Classification = ThermodynamicClass.Erasing
              LargestFibre = 11
              BitsErasedPpm = 3_459_432L }
        | Operation.Discard ->
            { Operation = Operation.Discard
              WSetFunction = "discard"
              Specialization = "integer-ring additive counit"
              Classification = ThermodynamicClass.Erasing
              LargestFibre = 15
              BitsErasedPpm = 3_906_891L }
        | Operation.BornProb ->
            { Operation = Operation.BornProb
              WSetFunction = "bornProb"
              Specialization = "integer magnitude squared and normalization"
              Classification = ThermodynamicClass.Erasing
              LargestFibre = 7
              BitsErasedPpm = 2_807_355L }
        | Operation.Plus ->
            { Operation = Operation.Plus
              WSetFunction = "plus"
              Specialization = "ordered input pair with forgotten split point"
              Classification = ThermodynamicClass.Erasing
              LargestFibre = 3
              BitsErasedPpm = 1_584_963L }
        | Operation.Tensor ->
            { Operation = Operation.Tensor
              WSetFunction = "tensor"
              Specialization = "ordered integer-ring input pair"
              Classification = ThermodynamicClass.Erasing
              LargestFibre = 85
              BitsErasedPpm = 6_409_391L }

    let allProfiles =
        [ Operation.Negate
          Operation.Copy
          Operation.MapKeysInjective
          Operation.ApplyInjective
          Operation.Consolidate
          Operation.Discard
          Operation.BornProb
          Operation.Plus
          Operation.Tensor ]
        |> List.map profile

    let private signature (source: string) (operationProfile: ReferenceProfile) : HeatSignature option =
        match operationProfile.Classification with
        | ThermodynamicClass.Reversible -> None
        | ThermodynamicClass.Unmeasured ->
            // Unreachable for the nine measured WSet specializations, and deliberately NOT `None`.
            // If a tenth ever lands unmeasured, the sink hears about it instead of the ledger
            // recording a silent zero — an unknown cost must never present as a free one.
            Some
                { Source = source
                  Kind = "wset." + operationProfile.WSetFunction + ".unmeasured"
                  Units = 1
                  MassPpm = operationProfile.BitsErasedPpm
                  Detail =
                    "unmeasured;specialization="
                    + operationProfile.Specialization
                    + ";no-admissible-sweep;must-not-be-read-as-zero"
                  Disposition = None }
        | ThermodynamicClass.Erasing ->
            let detail =
                System.String.Format(
                    CultureInfo.InvariantCulture,
                    "finite-reference-domain;specialization={0};largest-fibre={1};bits-erased-ppm={2};not-per-input-physical-cost",
                    operationProfile.Specialization,
                    operationProfile.LargestFibre,
                    operationProfile.BitsErasedPpm
                )

            Some
                { Source = source
                  Kind = "wset." + operationProfile.WSetFunction + ".forgotten"
                  Units = 1
                  MassPpm = operationProfile.BitsErasedPpm
                  Detail = detail
                  // Declared, not inferred: this branch IS `ThermodynamicClass.Erasing` — the
                  // fibre collapsed, so no reachable state distinguishes the erased inputs and
                  // nothing retains a seed. `Reversible` emits no signature at all.
                  Disposition = Some ShedDisposition.Annihilated }

    let private meter (source: string) (operation: Operation) (value: 'T) : Metered<'T> =
        let operationProfile = profile operation

        { Value = value
          Profile = operationProfile
          Heat = signature source operationProfile }

    /// Emit the optional signature through an injected port. A cold operation
    /// does not call the sink. Sink failure remains typed feedback.
    let emit (sink: IHeatSink) (result: Metered<'T>) : Result<Metered<'T>, HeatSinkFeedback> =
        match result.Heat with
        | None -> Ok result
        | Some heat -> sink.Emit heat |> Result.map (fun () -> result)

    let negate source (ring: IStarRing<'W>) (s: WSet.WSet<'K, 'W>) =
        WSet.negate ring s |> meter source Operation.Negate

    let copy source (s: WSet.WSet<'K, 'W>) =
        WSet.copy s |> meter source Operation.Copy

    /// The caller supplies the injectivity premise named by this measured specialization.
    let mapKeysInjective source g (s: WSet.WSet<'K, 'W>) =
        WSet.mapKeys g s |> meter source Operation.MapKeysInjective

    /// The caller supplies the injectivity premise named by this measured specialization.
    let applyInjective source (ring: IStarRing<'W>) op (s: WSet.WSet<'K, 'W>) =
        WSet.apply ring op s |> meter source Operation.ApplyInjective

    let consolidate source (ring: IStarRing<'W>) isZero (s: WSet.WSet<'K, 'W>) =
        WSet.consolidate ring isZero s |> meter source Operation.Consolidate

    let discard source (ring: IStarRing<'W>) (s: WSet.WSet<'K, 'W>) =
        WSet.discard ring s |> meter source Operation.Discard

    let bornProb source magSq (s: WSet.WSet<'K, 'W>) =
        WSet.bornProb magSq s |> meter source Operation.BornProb

    let plus source (a: WSet.WSet<'K, 'W>) (b: WSet.WSet<'K, 'W>) =
        WSet.plus a b |> meter source Operation.Plus

    let tensor source (ring: IStarRing<'W>) (a: WSet.WSet<'A, 'W>) (b: WSet.WSet<'B, 'W>) =
        WSet.tensor ring a b |> meter source Operation.Tensor

/// Injected heat boundary for the source-owned Mach-Zehnder WSet calculation.
/// The pure calculation remains available as a reference; production observable generation
/// crosses both non-injective stages here and cannot silently discard their signatures.
/// `MassPpm` remains the committed integer-reference-domain witness named in each signature's
/// detail; it is not presented as measured dissipation of a complex-amplitude execution.
[<RequireQualifiedAccess>]
module MachZehnderWSetHeat =

    [<RequireQualifiedAccess>]
    type Stage =
        | Consolidation
        | BornProjection

    type Measurement =
        { Probabilities: (int * float) list
          Heat: HeatSignature list }

    type Feedback =
        { Stage: Stage
          Completed: HeatSignature list
          Pending: HeatSignature
          Sink: HeatSinkFeedback }

    let private ring = ImaginaryStack.complex
    let private isZero (z: Complex) = abs z.Real < 1e-12 && abs z.Imag < 1e-12
    let private magSq (z: Complex) = z.Real * z.Real + z.Imag * z.Imag

    let private emitStage
        (sink: IHeatSink)
        (stage: Stage)
        (completed: HeatSignature list)
        (result: WSetHeat.Metered<'T>)
        : Result<HeatSignature list, Feedback> =
        match result.Heat with
        | None -> Ok completed
        | Some pending ->
            match WSetHeat.emit sink result with
            | Ok _ -> Ok(completed @ [ pending ])
            | Error feedback ->
                Error
                    { Stage = stage
                      Completed = completed
                      Pending = pending
                      Sink = feedback }

    let private measure
        (sink: IHeatSink)
        (source: string)
        (amplitudes: WSet.WSet<int, Complex>)
        : Result<Measurement, Feedback> =
        let consolidated = WSetHeat.consolidate source ring isZero amplitudes
        let projected = WSetHeat.bornProb source magSq consolidated.Value

        match emitStage sink Stage.Consolidation [] consolidated with
        | Error feedback -> Error feedback
        | Ok completed ->
            match emitStage sink Stage.BornProjection completed projected with
            | Error feedback -> Error feedback
            | Ok heat ->
                Ok
                    { Probabilities = projected.Value
                      Heat = heat }

    let closed (sink: IHeatSink) (source: string) (phi: float) : Result<Measurement, Feedback> =
        MachZehnderWSet.closedAmplitudes phi |> measure sink source

    let openArm (sink: IHeatSink) (source: string) : Result<Measurement, Feedback> =
        MachZehnderWSet.openArmAmplitudes () |> measure sink source

/// Integer specialization of `FourCornerTrace` with an injected heat boundary.
/// The generic trace remains pure so non-integer reference calculations do not inherit
/// a finite integer-domain profile. This adapter meters the consolidations that remove
/// annihilated rows and preserves the completed/pending sequence for exact retry.
/// Each event advances interpretation in one direction; its negative rows revise the
/// emitted reading of immutable history rather than reversing or mutating that history.
[<RequireQualifiedAccess>]
module FourCornerTraceHeat =

    [<RequireQualifiedAccess>]
    type Stage =
        | OpeningConsolidation
        | DeltaConsolidation
        | StateConsolidation

    type HeatEmission =
        { Stage: Stage
          Signature: HeatSignature }

    type Candidate<'I, 'K when 'K: comparison> =
        { State: FourCornerTrace.Traced<'I, 'K, int64>
          Emission: WSet.WSet<'K, int64> }

    type Measurement<'I, 'K when 'K: comparison> =
        { Candidate: Candidate<'I, 'K>
          Heat: HeatEmission list }

    type Feedback<'I, 'K when 'K: comparison> =
        { Candidate: Candidate<'I, 'K>
          Completed: HeatEmission list
          Pending: HeatEmission list
          Sink: HeatSinkFeedback }

    let private stageToken =
        function
        | Stage.OpeningConsolidation -> "opening-consolidation"
        | Stage.DeltaConsolidation -> "delta-consolidation"
        | Stage.StateConsolidation -> "state-consolidation"

    let private asEmission eventId stage (result: WSetHeat.Metered<'T>) =
        result.Heat
        |> Option.map (fun signature ->
            { Stage = stage
              Signature =
                { signature with
                    Detail =
                        signature.Detail
                        + ";trace-event="
                        + eventId
                        + ";trace-stage="
                        + stageToken stage } })

    let rec private emitPending
        (sink: IHeatSink)
        (candidate: Candidate<'I, 'K>)
        (completed: HeatEmission list)
        (pending: HeatEmission list)
        : Result<Measurement<'I, 'K>, Feedback<'I, 'K>> =
        match pending with
        | [] ->
            Ok
                { Candidate = candidate
                  Heat = completed }
        | next :: remaining ->
            match sink.Emit next.Signature with
            | Ok() -> emitPending sink candidate (completed @ [ next ]) remaining
            | Error feedback ->
                Error
                    { Candidate = candidate
                      Completed = completed
                      Pending = pending
                      Sink = feedback }

    let private run
        (sink: IHeatSink)
        (candidate: Candidate<'I, 'K>)
        (pending: HeatEmission option list)
        : Result<Measurement<'I, 'K>, Feedback<'I, 'K>> =
        pending |> List.choose id |> emitPending sink candidate []

    /// Retry only the signatures not accepted by the previous sink. The candidate
    /// trace state and already accepted prefix remain bit-identical.
    let resume
        (sink: IHeatSink)
        (feedback: Feedback<'I, 'K>)
        : Result<Measurement<'I, 'K>, Feedback<'I, 'K>> =
        emitPending sink feedback.Candidate feedback.Completed feedback.Pending

    /// `eventId` is stable for replay and distinct for each forward trace turn.
    let start
        (sink: IHeatSink)
        (source: string)
        (eventId: string)
        (ring: IStarRing<int64>)
        (isZero: int64 -> bool)
        (gen: FourCornerTrace.Generator<'H, 'I, 'K, int64>)
        (history: 'H)
        (interpretation: 'I)
        : Result<Measurement<'I, 'K>, Feedback<'I, 'K>> =
        let opening = FourCornerTrace.openingUnconsolidated gen history interpretation
        let consolidated = WSetHeat.consolidate source ring isZero opening

        let candidate =
            { State =
                { Interpretation = interpretation
                  Emitted = consolidated.Value }
              Emission = consolidated.Value }

        run sink candidate [ asEmission eventId Stage.OpeningConsolidation consolidated ]

    /// `eventId` is stable for replay and distinct for each forward trace turn.
    let step
        (sink: IHeatSink)
        (source: string)
        (eventId: string)
        (ring: IStarRing<int64>)
        (isZero: int64 -> bool)
        (gen: FourCornerTrace.Generator<'H, 'I, 'K, int64>)
        (update: 'I -> 'F -> 'I)
        (history: 'H)
        (feedback: 'F)
        (state: FourCornerTrace.Traced<'I, 'K, int64>)
        : Result<Measurement<'I, 'K>, Feedback<'I, 'K>> =
        let after = update state.Interpretation feedback

        let delta =
            FourCornerTrace.deltaUnconsolidated ring gen history state.Interpretation after
            |> WSetHeat.consolidate source ring isZero

        let emitted =
            FourCornerTrace.cumulativeUnconsolidated state.Emitted delta.Value
            |> WSetHeat.consolidate source ring isZero

        let candidate =
            { State =
                { Interpretation = after
                  Emitted = emitted.Value }
              Emission = delta.Value }

        run
            sink
            candidate
            [ asEmission eventId Stage.DeltaConsolidation delta
              asEmission eventId Stage.StateConsolidation emitted ]
