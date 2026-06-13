namespace Zeta.Bayesian

open System
open System.Numerics
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
        | MissingReticulumFuture of BoundaryFact
        | VisionBudget of VisionAttention.Feedback
        | QuantumOracle of OracleFeedback

    type EvidenceLedger =
        { DeltaCount: int
          TouchedIdentities: int
          ExteriorIdentities: int
          HiddenInteriorIdentities: int }

    type FusionSnapshot =
        { Exterior: GSet<BoundaryFact>
          Posterior: Beta
          Ledger: EvidenceLedger }

    type Report =
        { Exterior: GSet<BoundaryFact>
          Posterior: Beta
          Ledger: EvidenceLedger
          Prediction: Vision.PredictionReport<BoundaryFact> }

    type Forecast<'S> =
        { Snapshot: FusionSnapshot
          Branches: Vision.FutureBranch<'S> list }

    type ReticulumFuture =
        { Fact: BoundaryFact
          Sources: string list
          FirstSequence: int64
          LastSequence: int64
          DeltaCount: int
          WireBytes: int64 }

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

    let private branchBaseBytesWithExtra
        (budget: Budget)
        (extraSpaceBytes: int64)
        (fact: BoundaryFact)
        : Result<int64, Feedback> =
        if extraSpaceBytes < 0L then
            Error(NegativeBaseSpaceBytes extraSpaceBytes)
        else
            let total =
                BigInteger budget.BaseSpaceBytes
                + BigInteger(utf8Bytes fact.Kind)
                + BigInteger(utf8Bytes fact.Id)
                + BigInteger(utf8Bytes fact.Operation)
                + BigInteger extraSpaceBytes

            if total > BigInteger Int64.MaxValue then
                Error(ByteCostOverflow fact.Id)
            else
                Ok(int64 total)

    let private proposalWithExtraSpace
        (extraSpaceBytes: int64)
        (attentionWeight: float)
        (budget: Budget)
        (fact: BoundaryFact)
        : Result<VisionAttention.Proposal<BoundaryFact>, Feedback> =
        result {
            let! baseBytes = branchBaseBytesWithExtra budget extraSpaceBytes fact
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

    let private proposal (attentionWeight: float) (budget: Budget) (fact: BoundaryFact)
        : Result<VisionAttention.Proposal<BoundaryFact>, Feedback> =
        proposalWithExtraSpace 0L attentionWeight budget fact

    let private futureBranchesWithExtraSpace
        (budget: Budget)
        (attention: BoundaryFact -> float)
        (extraSpace: BoundaryFact -> int64)
        (facts: GSet<BoundaryFact>)
        : Result<Vision.FutureBranch<BoundaryFact> list, Feedback> =
        let rec loop acc rest =
            result {
                match rest with
                | [] ->
                    let! ranked =
                        VisionAttention.rankProposals (List.rev acc)
                        |> Result.mapError VisionBudget

                    return ranked |> List.map _.Branch
                | fact :: tail ->
                    let! p = proposalWithExtraSpace (extraSpace fact) (attention fact) budget fact
                    return! loop (p :: acc) tail
            }

        result {
            do! validateBudget budget
            return! loop [] (GSet.toList facts)
        }

    let futureBranchesWithAttention
        (budget: Budget)
        (attention: BoundaryFact -> float)
        (facts: GSet<BoundaryFact>)
        : Result<Vision.FutureBranch<BoundaryFact> list, Feedback> =
        futureBranchesWithExtraSpace budget attention (fun _ -> 0L) facts

    let private predictionWithAttention
        (attention: BoundaryFact -> float)
        (facts: GSet<BoundaryFact>)
        (budget: Budget)
        (tank: SoftThrottle.Tank)
        : Result<Vision.PredictionReport<BoundaryFact>, Feedback> =
        result {
            let! branches = futureBranchesWithAttention budget attention facts
            return!
                Vision.predictBranches branches tank
                |> Result.mapError (VisionAttention.VisionFeedback >> VisionBudget)
        }

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

    let snapshotDeltas
        (budget: Budget)
        (deltas: QuantumObservableDelta seq)
        : Result<FusionSnapshot, Feedback> =
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

            return
                { Exterior = exteriorFacts
                  Posterior = posterior
                  Ledger = evidenceLedger materialized touchedFacts exteriorFacts }
        }

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
            let! snapshot = snapshotDeltas budget deltas
            let! report =
                predictionWithAttention (attentionPolicy snapshot.Posterior) snapshot.Exterior budget tank

            return
                { Exterior = snapshot.Exterior
                  Posterior = snapshot.Posterior
                  Ledger = snapshot.Ledger
                  Prediction = report }
        }

    let forecastDeltasWithAttention
        (budget: Budget)
        (attentionPolicy: AttentionPolicy)
        (deltas: QuantumObservableDelta seq)
        : Result<Forecast<BoundaryFact>, Feedback> =
        result {
            let! snapshot = snapshotDeltas budget deltas
            let! branches =
                futureBranchesWithAttention budget (attentionPolicy snapshot.Posterior) snapshot.Exterior

            return
                { Snapshot = snapshot
                  Branches = branches }
        }

    let private reticulumDelta (delta: ReticulumQuantum.ObservableDelta) : QuantumObservableDelta =
        { Row = delta.Row
          Weight = delta.Weight }

    let private addWireBytes (fact: BoundaryFact) (left: int64) (right: int64) : Result<int64, Feedback> =
        let total = BigInteger left + BigInteger right
        if total > BigInteger Int64.MaxValue then Error(ByteCostOverflow fact.Id)
        else Ok(int64 total)

    let private reticulumFuture (fact: BoundaryFact) (deltas: ReticulumQuantum.ObservableDelta array)
        : Result<BoundaryFact * ReticulumFuture, Feedback> =
        let rec sumWireBytes acc rest =
            result {
                match rest with
                | [] -> return acc
                | delta :: tail ->
                    let bytes = ReticulumQuantum.encodeDelta delta |> utf8Bytes
                    let! total = addWireBytes fact acc bytes
                    return! sumWireBytes total tail
            }

        result {
            let! wireBytes = sumWireBytes 0L (Array.toList deltas)
            let sequences = deltas |> Array.map _.Sequence
            let sources =
                deltas
                |> Seq.map _.Source
                |> Seq.distinct
                |> Seq.sortWith (fun left right -> StringComparer.Ordinal.Compare(left, right))
                |> Seq.toList

            return
                fact,
                { Fact = fact
                  Sources = sources
                  FirstSequence = sequences |> Array.min
                  LastSequence = sequences |> Array.max
                  DeltaCount = deltas.Length
                  WireBytes = wireBytes }
        }

    let private reticulumFuturesByFact
        (deltas: ReticulumQuantum.ObservableDelta array)
        : Result<Map<BoundaryFact, ReticulumFuture>, Feedback> =
        let groups =
            deltas
            |> Array.groupBy (fun delta -> boundaryFact delta.Row)
            |> Array.toList

        let rec loop acc rest =
            result {
                match rest with
                | [] -> return Map.ofList (List.rev acc)
                | (fact, factDeltas) :: tail ->
                    let! pair = reticulumFuture fact factDeltas
                    return! loop (pair :: acc) tail
            }

        loop [] groups

    let forecastReticulumDeltasWithAttention
        (budget: Budget)
        (attentionPolicy: AttentionPolicy)
        (deltas: ReticulumQuantum.ObservableDelta seq)
        : Result<Forecast<ReticulumFuture>, Feedback> =
        result {
            let materialized = deltas |> Seq.toArray
            let! snapshot = materialized |> Seq.map reticulumDelta |> snapshotDeltas budget
            let! futureByFact = reticulumFuturesByFact materialized

            let extraSpace fact =
                futureByFact
                |> Map.tryFind fact
                |> Option.map _.WireBytes
                |> Option.defaultValue 0L

            let! factBranches =
                futureBranchesWithExtraSpace
                    budget
                    (attentionPolicy snapshot.Posterior)
                    extraSpace
                    snapshot.Exterior

            let rec mapBranches
                (acc: Vision.FutureBranch<ReticulumFuture> list)
                (rest: Vision.FutureBranch<BoundaryFact> list)
                : Result<Vision.FutureBranch<ReticulumFuture> list, Feedback> =
                result {
                    match rest with
                    | [] -> return List.rev acc
                    | branch :: tail ->
                        match futureByFact |> Map.tryFind branch.State with
                        | Some future ->
                            let next: Vision.FutureBranch<ReticulumFuture> =
                                { Label = branch.Label
                                  State = future
                                  Cost = branch.Cost }

                            return! mapBranches (next :: acc) tail
                        | None ->
                            return! Error(MissingReticulumFuture branch.State)
                }

            let! branches = mapBranches [] factBranches
            return
                { Snapshot = snapshot
                  Branches = branches }
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
