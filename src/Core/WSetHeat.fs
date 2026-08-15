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

    [<RequireQualifiedAccess>]
    type ThermodynamicClass =
        | Reversible
        | Erasing

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
        | ThermodynamicClass.Erasing ->
            let detail =
                System.String.Format(
                    CultureInfo.InvariantCulture,
                    "finite-reference-domain;largest-fibre={0};bits-erased-ppm={1};not-per-input-physical-cost",
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
