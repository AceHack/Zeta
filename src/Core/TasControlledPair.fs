namespace Zeta.Core

open System
open System.Numerics
open System.Threading.Tasks

[<Struct>]
type TasPairBudget =
    { MaxAgentActions: int
      MaxEnvironmentSteps: int
      Attribution: string }

[<Struct>]
type TasRunOutcome =
    { NormalizedScore: float
      AgentActions: int
      EnvironmentSteps: int }

[<RequireQualifiedAccess>]
type TasRunMode =
    | Clean
    | Assisted

type TasRunContext =
    { Mode: TasRunMode
      SubjectId: string
      RunKey: Chip8CrossRunStore.RunKey
      Budget: TasPairBudget
      Grant: ChannelGrant option }

type TasExecutionReceipt =
    { Outcome: TasRunOutcome
      Meter: ChannelMeter option }

[<Struct>]
type TasExecutionFeedback =
    { Code: string
      Detail: string }

type TasPairFeedback =
    | InvalidTasSubjectId of subjectId: string
    | InvalidTasBudget of detail: string
    | CleanRunKeyRequired of actual: string
    | TasChannelGrantRefused of feedback: ChannelGrantFeedback
    | TasRunRefused of mode: TasRunMode * code: string * detail: string
    | TasRunRejected of mode: TasRunMode * detail: string
    | InvalidNormalizedScore of mode: TasRunMode * score: float
    | InvalidAgentActionCount of mode: TasRunMode * count: int
    | AgentActionBudgetExceeded of mode: TasRunMode * actual: int * maximum: int
    | InvalidEnvironmentStepCount of mode: TasRunMode * count: int
    | EnvironmentStepBudgetExceeded of mode: TasRunMode * actual: int * maximum: int
    | CleanMeterPresent
    | AssistedMeterMissing

type TasCrossingTotals =
    { Read: BigInteger
      Write: BigInteger
      Total: BigInteger }

type TasControlledPairReport =
    { SubjectId: string
      Budget: TasPairBudget
      CleanRunKey: Chip8CrossRunStore.RunKey
      AssistedRunKey: Chip8CrossRunStore.RunKey
      Clean: TasRunOutcome
      Assisted: TasRunOutcome
      ScoreDelta: float
      AgentActionDelta: int64
      EnvironmentStepDelta: int64
      Crossings: TasCrossingTotals
      AssistedMeter: ChannelMeterSnapshot }

type TasPairExecutor = TasRunContext -> Task<Result<TasExecutionReceipt, TasExecutionFeedback>>

[<RequireQualifiedAccess>]
module TasControlledPair =

    let private validateSubjectId (subjectId: string) =
        if
            String.IsNullOrWhiteSpace subjectId
            || not (String.Equals(subjectId, subjectId.Trim(), StringComparison.Ordinal))
            || subjectId |> Seq.exists Char.IsWhiteSpace
        then
            Error(InvalidTasSubjectId subjectId)
        else
            Ok subjectId

    let private validateBudget (budget: TasPairBudget) =
        if budget.MaxAgentActions <= 0 then
            Error(InvalidTasBudget(sprintf "max-agent-actions=%d" budget.MaxAgentActions))
        elif budget.MaxEnvironmentSteps <= 0 then
            Error(InvalidTasBudget(sprintf "max-environment-steps=%d" budget.MaxEnvironmentSteps))
        elif
            String.IsNullOrWhiteSpace budget.Attribution
            || not (String.Equals(budget.Attribution, budget.Attribution.Trim(), StringComparison.Ordinal))
        then
            Error(InvalidTasBudget "attribution must be non-empty and trimmed")
        else
            Ok budget

    let private validateOutcome mode budget outcome =
        if not (Double.IsFinite outcome.NormalizedScore)
           || outcome.NormalizedScore < 0.0
           || outcome.NormalizedScore > 1.0 then
            Error(InvalidNormalizedScore(mode, outcome.NormalizedScore))
        elif outcome.AgentActions < 0 then
            Error(InvalidAgentActionCount(mode, outcome.AgentActions))
        elif outcome.AgentActions > budget.MaxAgentActions then
            Error(AgentActionBudgetExceeded(mode, outcome.AgentActions, budget.MaxAgentActions))
        elif outcome.EnvironmentSteps < 0 then
            Error(InvalidEnvironmentStepCount(mode, outcome.EnvironmentSteps))
        elif outcome.EnvironmentSteps > budget.MaxEnvironmentSteps then
            Error(EnvironmentStepBudgetExceeded(mode, outcome.EnvironmentSteps, budget.MaxEnvironmentSteps))
        else
            Ok outcome

    let private executeOne (execute: TasPairExecutor) (context: TasRunContext) =
        task {
            try
                let! result = (execute context).ConfigureAwait(false)

                return
                    result
                    |> Result.mapError (fun feedback ->
                        TasRunRefused(context.Mode, feedback.Code, feedback.Detail))
            with ex ->
                return Error(TasRunRejected(context.Mode, ex.Message))
        }

    let private crossingTotals (snapshot: ChannelMeterSnapshot) =
        let read, write =
            snapshot.Rows
            |> List.fold
                (fun (read, write) row ->
                    match row.Direction with
                    | ChannelDirection.Read -> read + BigInteger row.Crossings, write
                    | ChannelDirection.Write -> read, write + BigInteger row.Crossings)
                (BigInteger.Zero, BigInteger.Zero)

        { Read = read
          Write = write
          Total = read + write }

    /// Run the same subject and fixed run identity twice, changing only the apparatus channel grant.
    let run
        (issuedBy: ExperimenterId)
        (subjectId: string)
        (cleanRunKey: Chip8CrossRunStore.RunKey)
        (channels: ChannelSet)
        (budget: TasPairBudget)
        (execute: TasPairExecutor)
        : Task<Result<TasControlledPairReport, TasPairFeedback>> =
        task {
            match validateSubjectId subjectId, validateBudget budget with
            | Error feedback, _
            | _, Error feedback -> return Error feedback
            | Ok validSubjectId, Ok validBudget ->
                let actualLabel =
                    cleanRunKey.ChannelLabel
                    |> Chip8CrossRunStore.RunChannelLabel.value

                if not (String.Equals(actualLabel, "clean", StringComparison.Ordinal)) then
                    return Error(CleanRunKeyRequired actualLabel)
                else
                    match ChannelSet.runLabel channels with
                    | Error feedback -> return Error(TasChannelGrantRefused feedback)
                    | Ok assistedLabel ->
                        let assistedRunKey =
                            { cleanRunKey with
                                ChannelLabel = assistedLabel }

                        match ChannelGrantHarness.issue issuedBy assistedRunKey channels with
                        | Error feedback -> return Error(TasChannelGrantRefused feedback)
                        | Ok grant ->
                            let cleanContext =
                                { Mode = TasRunMode.Clean
                                  SubjectId = validSubjectId
                                  RunKey = cleanRunKey
                                  Budget = validBudget
                                  Grant = None }

                            let assistedContext =
                                { Mode = TasRunMode.Assisted
                                  SubjectId = validSubjectId
                                  RunKey = assistedRunKey
                                  Budget = validBudget
                                  Grant = Some grant }

                            let! cleanResult = executeOne execute cleanContext

                            match cleanResult with
                            | Error feedback -> return Error feedback
                            | Ok cleanReceipt when cleanReceipt.Meter.IsSome -> return Error CleanMeterPresent
                            | Ok cleanReceipt ->
                                match validateOutcome TasRunMode.Clean validBudget cleanReceipt.Outcome with
                                | Error feedback -> return Error feedback
                                | Ok cleanOutcome ->
                                    let! assistedResult = executeOne execute assistedContext

                                    match assistedResult with
                                    | Error feedback -> return Error feedback
                                    | Ok assistedReceipt ->
                                        match
                                            validateOutcome TasRunMode.Assisted validBudget assistedReceipt.Outcome,
                                            assistedReceipt.Meter
                                        with
                                        | Error feedback, _ -> return Error feedback
                                        | Ok _, None -> return Error AssistedMeterMissing
                                        | Ok assistedOutcome, Some meter ->
                                            let snapshot = ChannelMeter.snapshot grant meter

                                            return
                                                Ok
                                                    { SubjectId = validSubjectId
                                                      Budget = validBudget
                                                      CleanRunKey = cleanRunKey
                                                      AssistedRunKey = assistedRunKey
                                                      Clean = cleanOutcome
                                                      Assisted = assistedOutcome
                                                      ScoreDelta =
                                                        assistedOutcome.NormalizedScore
                                                        - cleanOutcome.NormalizedScore
                                                      AgentActionDelta =
                                                        int64 assistedOutcome.AgentActions
                                                        - int64 cleanOutcome.AgentActions
                                                      EnvironmentStepDelta =
                                                        int64 assistedOutcome.EnvironmentSteps
                                                        - int64 cleanOutcome.EnvironmentSteps
                                                      Crossings = crossingTotals snapshot
                                                      AssistedMeter = snapshot }
        }
