namespace Zeta.Core

open System
open System.Numerics

/// Finite treaty for "memory braids as gravity" plus attention-weighted
/// self-budgeting. This does not make Q# or Bayesian inference the DBSP
/// runtime. It gives both oracles a small, typed shape to agree on:
/// memory braid load prices durable path history, attention ranks which
/// futures the Vision budget should inspect first, and normal budget pressure
/// remains a Vision report.
[<RequireQualifiedAccess>]
module VisionAttention =

    type Attention =
        { Weight: float
          ResolutionBits: int }

    type MemoryBraid =
        { Strands: int
          Word: int list
          BytesPerCrossing: int64
          PureKernelBytes: int64 }

    type Proposal<'S> =
        { Label: string
          State: 'S
          BaseSpaceBytes: int64
          TimeTicks: int
          BytesPerTick: int64
          BaseUncertaintyResolutionBits: int
          Attention: Attention
          Memory: MemoryBraid option }

    type RankedBranch<'S> =
        { Proposal: Proposal<'S>
          Branch: Vision.FutureBranch<'S>
          GravityBytes: int64
          Rank: float }

    type Feedback =
        | InvalidStrandCount of strands: int
        | InvalidBraidWord of strands: int * word: int list
        | NegativeBytesPerCrossing of bytes: int64
        | NegativePureKernelBytes of bytes: int64
        | NegativeBaseSpaceBytes of bytes: int64
        | NegativeTimeTicks of ticks: int
        | NegativeBytesPerTick of bytes: int64
        | NegativeBaseUncertaintyResolutionBits of bits: int
        | InvalidAttentionWeight of weight: float
        | NegativeAttentionResolutionBits of bits: int
        | ByteCostOverflow of bytes: BigInteger
        | VisionFeedback of Vision.GrowthFeedback

    let private addCapped (a: BigInteger) (b: BigInteger) : Result<BigInteger, Feedback> =
        let total = a + b
        if total > BigInteger Int64.MaxValue then Error(ByteCostOverflow total) else Ok total

    let private toInt64 (value: BigInteger) : int64 = int64 value

    let memoryGravityBytes (memory: MemoryBraid) : Result<int64, Feedback> =
        result {
            if memory.Strands < 2 then
                return! Error(InvalidStrandCount memory.Strands)
            elif memory.BytesPerCrossing < 0L then
                return! Error(NegativeBytesPerCrossing memory.BytesPerCrossing)
            elif memory.PureKernelBytes < 0L then
                return! Error(NegativePureKernelBytes memory.PureKernelBytes)
            elif not (Braid.validWord memory.Strands memory.Word) then
                return! Error(InvalidBraidWord(memory.Strands, memory.Word))
            else
                let loadBytes =
                    Braid.pairLoad memory.Strands memory.Word
                    |> Map.toSeq
                    |> Seq.map (fun (_, load) ->
                        BigInteger load * BigInteger load * BigInteger memory.BytesPerCrossing)
                    |> Seq.fold (+) BigInteger.Zero

                let permutationIsTrivial =
                    Braid.permutation memory.Strands memory.Word = [ 0 .. memory.Strands - 1 ]

                let pureKernelMemory =
                    permutationIsTrivial
                    && not (Braid.isIdentity memory.Strands memory.Word)

                let kernelBytes =
                    if pureKernelMemory then BigInteger memory.PureKernelBytes else BigInteger.Zero

                let! total = addCapped loadBytes kernelBytes
                return toInt64 total
        }

    let private validateProposal (proposal: Proposal<'S>) : Result<unit, Feedback> =
        if proposal.BaseSpaceBytes < 0L then
            Error(NegativeBaseSpaceBytes proposal.BaseSpaceBytes)
        elif proposal.TimeTicks < 0 then
            Error(NegativeTimeTicks proposal.TimeTicks)
        elif proposal.BytesPerTick < 0L then
            Error(NegativeBytesPerTick proposal.BytesPerTick)
        elif proposal.BaseUncertaintyResolutionBits < 0 then
            Error(NegativeBaseUncertaintyResolutionBits proposal.BaseUncertaintyResolutionBits)
        elif proposal.Attention.ResolutionBits < 0 then
            Error(NegativeAttentionResolutionBits proposal.Attention.ResolutionBits)
        elif not (Double.IsFinite proposal.Attention.Weight) || proposal.Attention.Weight < 0.0 then
            Error(InvalidAttentionWeight proposal.Attention.Weight)
        else
            Ok()

    let toRankedBranch (proposal: Proposal<'S>) : Result<RankedBranch<'S>, Feedback> =
        result {
            do! validateProposal proposal

            let! gravityBytes =
                match proposal.Memory with
                | Some memory -> memoryGravityBytes memory
                | None -> Ok 0L

            let! spaceBytes =
                addCapped (BigInteger proposal.BaseSpaceBytes) (BigInteger gravityBytes)
                |> Result.map toInt64

            let uncertaintyBits =
                BigInteger proposal.BaseUncertaintyResolutionBits
                + BigInteger proposal.Attention.ResolutionBits

            if uncertaintyBits > BigInteger Int32.MaxValue then
                return! Error(ByteCostOverflow uncertaintyBits)
            else
                let rank =
                    proposal.Attention.Weight
                    * Math.Log(2.0 + float gravityBytes, 2.0)

                let branch : Vision.FutureBranch<'S> =
                    { Label = proposal.Label
                      State = proposal.State
                      Cost =
                        { SpaceBytes = spaceBytes
                          TimeTicks = proposal.TimeTicks
                          BytesPerTick = proposal.BytesPerTick
                          UncertaintyResolutionBits = int uncertaintyBits } }

                return
                    { Proposal = proposal
                      Branch = branch
                      GravityBytes = gravityBytes
                      Rank = rank }
        }

    let rankProposals (proposals: Proposal<'S> list) : Result<RankedBranch<'S> list, Feedback> =
        let rec loop acc rest =
            result {
                match rest with
                | [] ->
                    return
                        acc
                        |> List.sortWith (fun left right ->
                            let rankOrder = compare right.Rank left.Rank
                            if rankOrder <> 0 then
                                rankOrder
                            else
                                StringComparer.Ordinal.Compare(left.Branch.Label, right.Branch.Label))
                | proposal :: tail ->
                    let! branch = toRankedBranch proposal
                    return! loop (branch :: acc) tail
            }

        loop [] proposals

    let predict
        (proposals: Proposal<'S> list)
        (tank: SoftThrottle.Tank)
        : Result<Vision.PredictionReport<'S>, Feedback> =
        result {
            let! ranked = rankProposals proposals
            let branches = ranked |> List.map _.Branch
            return!
                Vision.predictBranches branches tank
                |> Result.mapError VisionFeedback
        }
