namespace Zeta.Bayesian

open System
open System.Text
open Zeta.Core

/// Bayesian/Q# fusion bridge for the finite quantum-observable lane.
///
/// Core owns `GSet`, `ZSet`, and the source-owned quantum observable rows. Q#
/// remains an oracle through the committed row operations and golden vectors;
/// this plugin adds the Bayesian layer: aggregate confidence over the signed
/// evidence ledger plus a Vision budget report for how much of the exterior
/// support can be inspected now.
[<RequireQualifiedAccess>]
module QuantumFusion =

    /// The exterior fact visible after fusion. This intentionally excludes
    /// signed weight and multiplicity: those are interior Z-set structure.
    type BoundaryFact =
        { Kind: string
          Id: string
          Operation: string }

    type Budget =
        { Prior: Beta
          BaseSpaceBytes: int64
          TimeTicks: int
          BytesPerTick: int64
          ResolutionBits: int }

    type OracleFeedback =
        | EmptyOracleName
        | OracleUnavailable of string

    type Feedback =
        | InvalidPrior of Beta
        | NegativeBaseSpaceBytes of int64
        | NegativeTimeTicks of int
        | NegativeBytesPerTick of int64
        | NegativeResolutionBits of int
        | ByteCostOverflow of string
        | VisionBudget of VisionAttention.Feedback
        | QuantumOracle of OracleFeedback

    type EvidenceLedger =
        { DeltaCount: int
          TouchedIdentities: int
          ExteriorIdentities: int
          HiddenInteriorIdentities: int }

    type Report =
        { Exterior: GSet<BoundaryFact>
          Posterior: Beta
          Ledger: EvidenceLedger
          Prediction: Vision.PredictionReport<BoundaryFact> }

    type AttentionPolicy = Beta -> BoundaryFact -> float

    type IQuantumFusionOracle =
        abstract Name: string
        abstract Observe: unit -> Result<QuantumObservableDelta list, OracleFeedback>

    let oracleFromDeltas (name: string) (deltas: QuantumObservableDelta seq) : IQuantumFusionOracle =
        { new IQuantumFusionOracle with
            member _.Name = name

            member _.Observe() =
                if String.IsNullOrWhiteSpace name then
                    Error EmptyOracleName
                else
                    Ok(Seq.toList deltas) }

    let private utf8Bytes (s: string) : int64 =
        if isNull s then 0L else int64 (Encoding.UTF8.GetByteCount s)

    let boundaryFact (row: QuantumObservableRow) : BoundaryFact =
        match row with
        | QuantumObservableRow.SingleQubit value ->
            { Kind = "SingleQubit"; Id = value.Id; Operation = value.Operation }
        | QuantumObservableRow.CanonicalChsh value ->
            { Kind = "CanonicalChsh"; Id = value.Id; Operation = "Zeta.ReferenceOracle.ApplyBellPhiPlus" }
        | QuantumObservableRow.SingletChsh value ->
            { Kind = "SingletChsh"; Id = value.Id; Operation = "Zeta.ReferenceOracle.ApplyBellSinglet" }
        | QuantumObservableRow.BellCorner value ->
            { Kind = "BellCorner"; Id = value.Id; Operation = value.Operation }
        | QuantumObservableRow.BellCoincidence value ->
            { Kind = "BellCoincidence"; Id = value.Id; Operation = value.Operation }
        | QuantumObservableRow.InterferenceVisibility value ->
            { Kind = "InterferenceVisibility"; Id = value.Id; Operation = value.Operation }
        | QuantumObservableRow.FlowBitDistinction value ->
            { Kind = "FlowBitDistinction"; Id = value.Id; Operation = value.Operation }

    /// Re-view a composed signed quantum Z-set as the outside monotone G-set.
    let exterior (rows: ZSet<QuantumObservableRow>) : GSet<BoundaryFact> =
        rows
        |> FusionReconstruction.fuse
        |> GSet.toSeq
        |> Seq.map boundaryFact
        |> GSet.ofSeq

    let private validateBudget (budget: Budget) : Result<unit, Feedback> =
        if not (Double.IsFinite budget.Prior.Alpha)
           || not (Double.IsFinite budget.Prior.Beta)
           || budget.Prior.Alpha <= 0.0
           || budget.Prior.Beta <= 0.0 then
            Error(InvalidPrior budget.Prior)
        elif budget.BaseSpaceBytes < 0L then
            Error(NegativeBaseSpaceBytes budget.BaseSpaceBytes)
        elif budget.TimeTicks < 0 then
            Error(NegativeTimeTicks budget.TimeTicks)
        elif budget.BytesPerTick < 0L then
            Error(NegativeBytesPerTick budget.BytesPerTick)
        elif budget.ResolutionBits < 0 then
            Error(NegativeResolutionBits budget.ResolutionBits)
        else
            Ok()

    let private branchBaseBytes (budget: Budget) (fact: BoundaryFact) : Result<int64, Feedback> =
        let dynamicBytes = utf8Bytes fact.Kind + utf8Bytes fact.Id + utf8Bytes fact.Operation
        if dynamicBytes > Int64.MaxValue - budget.BaseSpaceBytes then
            Error(ByteCostOverflow fact.Id)
        else
            Ok(budget.BaseSpaceBytes + dynamicBytes)

    let private proposal (attentionWeight: float) (budget: Budget) (fact: BoundaryFact)
        : Result<VisionAttention.Proposal<BoundaryFact>, Feedback> =
        result {
            let! baseBytes = branchBaseBytes budget fact
            return
                { Label = fact.Kind + ":" + fact.Id
                  State = fact
                  BaseSpaceBytes = baseBytes
                  TimeTicks = budget.TimeTicks
                  BytesPerTick = budget.BytesPerTick
                  BaseUncertaintyResolutionBits = 0
                  Attention =
                    { Weight = attentionWeight
                      ResolutionBits = budget.ResolutionBits }
                  Memory = None }
        }

    let private predictionWithAttention
        (attention: BoundaryFact -> float)
        (facts: GSet<BoundaryFact>)
        (budget: Budget)
        (tank: SoftThrottle.Tank)
        : Result<Vision.PredictionReport<BoundaryFact>, Feedback> =
        let rec loop acc rest =
            result {
                match rest with
                | [] ->
                    return! VisionAttention.predict (List.rev acc) tank |> Result.mapError VisionBudget
                | fact :: tail ->
                    let! p = proposal (attention fact) budget fact
                    return! loop (p :: acc) tail
            }

        loop [] (GSet.toList facts)

    let private evidenceLedger
        (materialized: QuantumObservableDelta array)
        (touchedFacts: GSet<BoundaryFact>)
        (exteriorFacts: GSet<BoundaryFact>)
        : EvidenceLedger =
        let touched = GSet.count touchedFacts
        let exterior = GSet.count exteriorFacts
        { DeltaCount = materialized.Length
          TouchedIdentities = touched
          ExteriorIdentities = exterior
          HiddenInteriorIdentities = max 0 (touched - exterior) }

    let predictExteriorWithAttention
        (budget: Budget)
        (tank: SoftThrottle.Tank)
        (attention: BoundaryFact -> float)
        (facts: GSet<BoundaryFact>)
        : Result<Vision.PredictionReport<BoundaryFact>, Feedback> =
        result {
            do! validateBudget budget
            return! predictionWithAttention attention facts budget tank
        }

    /// Compose signed quantum deltas, fuse their positive support into an
    /// exterior G-set, and attach a Bayesian/Vision budget report. Retractions
    /// and multiplicities affect only aggregate confidence; they are not visible
    /// as exterior G-set members.
    let fuseDeltasWithAttention
        (budget: Budget)
        (tank: SoftThrottle.Tank)
        (attentionPolicy: AttentionPolicy)
        (deltas: QuantumObservableDelta seq)
        : Result<Report, Feedback> =
        result {
            do! validateBudget budget

            let materialized = deltas |> Seq.toArray
            let interior = materialized |> QuantumObservableDbsp.zsetOfDeltas
            let exteriorFacts = exterior interior

            let touchedFacts =
                materialized
                |> Seq.map (fun delta -> boundaryFact delta.Row)
                |> GSet.ofSeq

            let successes = exteriorFacts |> GSet.count |> float
            let failures = max 0 (GSet.count touchedFacts - GSet.count exteriorFacts) |> float
            let posterior = Beta.product budget.Prior (Beta.likelihood successes failures)
            let ledger = evidenceLedger materialized touchedFacts exteriorFacts
            let! report =
                predictionWithAttention (attentionPolicy posterior) exteriorFacts budget tank

            return
                { Exterior = exteriorFacts
                  Posterior = posterior
                  Ledger = ledger
                  Prediction = report }
        }

    /// Default Bayesian attention: every exterior fact receives the posterior
    /// mean. This keeps the old arithmetic surface while allowing experiments
    /// to use `fuseDeltasWithAttention` for attention/gravity priority.
    let fuseDeltas
        (budget: Budget)
        (tank: SoftThrottle.Tank)
        (deltas: QuantumObservableDelta seq)
        : Result<Report, Feedback> =
        fuseDeltasWithAttention budget tank (fun posterior _ -> Beta.mean posterior) deltas

    let fuseOracle
        (budget: Budget)
        (tank: SoftThrottle.Tank)
        (oracle: IQuantumFusionOracle)
        : Result<Report, Feedback> =
        result {
            let! deltas = oracle.Observe() |> Result.mapError QuantumOracle
            return! fuseDeltas budget tank deltas
        }

    let fuseOracleWithAttention
        (budget: Budget)
        (tank: SoftThrottle.Tank)
        (attentionPolicy: AttentionPolicy)
        (oracle: IQuantumFusionOracle)
        : Result<Report, Feedback> =
        result {
            let! deltas = oracle.Observe() |> Result.mapError QuantumOracle
            return! fuseDeltasWithAttention budget tank attentionPolicy deltas
        }
