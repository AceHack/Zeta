namespace Zeta.Core

open System.Text.Json
open System.Text.Json.Serialization

/// Source-owned projection from the F# Dark Hall room loop into the no-script
/// room UI transcript consumed by src/Core.TypeScript/darkhall-ui.
[<RequireQualifiedAccess>]
module DarkHallRoomTranscript =

    module Runtime = DarkHallCabinetRuntime
    module RoomLoop = DarkHallRoomLoop
    module Scheduler = DarkHallScheduler

    [<Literal>]
    let Schema = "zeta.darkhall.room-ui.v1"

    let HeatReadoutSchema = Zeta.Core.HeatReadout.Schema

    let HeatSignalTreaty = Zeta.Core.HeatReadout.SignalTreaty

    let QSharpHeatSignalSource = Zeta.Core.HeatReadout.QSharpSignalSource

    let TemperatureReadoutSchema = Zeta.Core.HeatReadout.TemperatureSchema

    let BlackBodyReadoutSchema = Zeta.Core.HeatReadout.BlackBodySchema

    [<Literal>]
    let TravelerFrameSchema = "zeta.darkhall.traveler-frame.v1"

    [<Literal>]
    let PhaseClockSchema = "zeta.darkhall.phase-clock.v1"

    [<Literal>]
    let ContinuationReadoutSchema = "zeta.darkhall.continuation-readout.v1"

    [<Literal>]
    let CausalReadoutSchema = "zeta.darkhall.causal-readout.v1"

    type ControllerCell =
        { [<JsonPropertyName("cell")>]
          Cell: int
          [<JsonPropertyName("label")>]
          Label: string
          [<JsonPropertyName("actionId")>]
          ActionId: string
          [<JsonPropertyName("actionClass")>]
          ActionClass: string
          [<JsonPropertyName("gate")>]
          Gate: string
          [<JsonPropertyName("selected")>]
          Selected: bool
          [<JsonPropertyName("enabled")>]
          Enabled: bool }

    type HeatRow =
        { [<JsonPropertyName("tick")>]
          Tick: int
          [<JsonPropertyName("roomName")>]
          RoomName: string
          [<JsonPropertyName("heatRejected")>]
          HeatRejected: int
          [<JsonPropertyName("backpressured")>]
          Backpressured: int
          [<JsonPropertyName("storageErrors")>]
          StorageErrors: int
          [<JsonPropertyName("heatKinds")>]
          HeatKinds: string list
          [<JsonPropertyName("signals")>]
          Signals: string list
          [<JsonPropertyName("reasons")>]
          Reasons: string list }

    type HeatReadout =
        { [<JsonPropertyName("schema")>]
          Schema: string
          [<JsonPropertyName("qsharpTreaty")>]
          QSharpTreaty: string
          [<JsonPropertyName("qsharpSource")>]
          QSharpSource: string
          [<JsonPropertyName("rows")>]
          Rows: int
          [<JsonPropertyName("heatRejected")>]
          HeatRejected: int
          [<JsonPropertyName("backpressured")>]
          Backpressured: int
          [<JsonPropertyName("storageErrors")>]
          StorageErrors: int
          [<JsonPropertyName("heatKinds")>]
          HeatKinds: string list
          [<JsonPropertyName("signals")>]
          Signals: string list
          [<JsonPropertyName("reasons")>]
          Reasons: string list }

    type TranscriptTemperatureReadout =
        { [<JsonPropertyName("schema")>]
          Schema: string
          [<JsonPropertyName("source")>]
          Source: string
          [<JsonPropertyName("temperaturePpm")>]
          TemperaturePpm: int
          [<JsonPropertyName("band")>]
          Band: string
          [<JsonPropertyName("heatPpm")>]
          HeatPpm: int
          [<JsonPropertyName("uncertaintyPpm")>]
          UncertaintyPpm: int
          [<JsonPropertyName("pressurePpm")>]
          PressurePpm: int
          [<JsonPropertyName("attentionPpm")>]
          AttentionPpm: int
          [<JsonPropertyName("fidelity")>]
          Fidelity: string }

    type TranscriptBlackBodyReadout =
        { [<JsonPropertyName("schema")>]
          Schema: string
          [<JsonPropertyName("source")>]
          Source: string
          [<JsonPropertyName("temperaturePpm")>]
          TemperaturePpm: int
          [<JsonPropertyName("radiancePpm")>]
          RadiancePpm: int
          [<JsonPropertyName("peakFrequencyPpm")>]
          PeakFrequencyPpm: int }

    type TranscriptTemperatureTreaty =
        { [<JsonPropertyName("heatReadoutSchema")>]
          HeatReadoutSchema: string
          [<JsonPropertyName("temperatureReadoutSchema")>]
          TemperatureReadoutSchema: string
          [<JsonPropertyName("blackBodyReadoutSchema")>]
          BlackBodyReadoutSchema: string
          [<JsonPropertyName("qsharpTreaty")>]
          QSharpTreaty: string
          [<JsonPropertyName("qsharpSource")>]
          QSharpSource: string
          [<JsonPropertyName("fsharpSurface")>]
          FSharpSurface: string
          [<JsonPropertyName("referenceOracle")>]
          ReferenceOracle: string
          [<JsonPropertyName("referenceFeedback")>]
          ReferenceFeedback: string list
          [<JsonPropertyName("temperature")>]
          Temperature: TranscriptTemperatureReadout
          [<JsonPropertyName("blackBody")>]
          BlackBody: TranscriptBlackBodyReadout }

    type TravelerFrameCoordinate =
        { [<JsonPropertyName("traveler")>]
          Traveler: string
          [<JsonPropertyName("phase")>]
          Phase: int64 }

    type TranscriptTravelerFrame =
        { [<JsonPropertyName("schema")>]
          Schema: string
          [<JsonPropertyName("source")>]
          Source: string
          [<JsonPropertyName("commonPhase")>]
          CommonPhase: int64
          [<JsonPropertyName("coordinates")>]
          Coordinates: TravelerFrameCoordinate list
          [<JsonPropertyName("commonDominatesRoom")>]
          CommonDominatesRoom: bool
          [<JsonPropertyName("commonDominatesHeat")>]
          CommonDominatesHeat: bool }

    type TranscriptPhaseClock =
        { [<JsonPropertyName("schema")>]
          Schema: string
          [<JsonPropertyName("source")>]
          Source: string
          [<JsonPropertyName("basis")>]
          Basis: string
          [<JsonPropertyName("seed")>]
          Seed: string
          [<JsonPropertyName("phase")>]
          Phase: int64
          [<JsonPropertyName("skewBoundTicks")>]
          SkewBoundTicks: int64
          [<JsonPropertyName("appendOnly")>]
          AppendOnly: bool
          [<JsonPropertyName("travelers")>]
          Travelers: int }

    type TranscriptContinuationReadout =
        { [<JsonPropertyName("schema")>]
          Schema: string
          [<JsonPropertyName("source")>]
          Source: string
          [<JsonPropertyName("loopId")>]
          LoopId: string
          [<JsonPropertyName("resumable")>]
          Resumable: bool
          [<JsonPropertyName("token")>]
          Token: string
          [<JsonPropertyName("statePointer")>]
          StatePointer: string
          [<JsonPropertyName("nextLap")>]
          NextLap: int
          [<JsonPropertyName("ticksSpent")>]
          TicksSpent: int
          [<JsonPropertyName("resumeBaseTick")>]
          ResumeBaseTick: int
          [<JsonPropertyName("stopReason")>]
          StopReason: string
          [<JsonPropertyName("admissionFeedback")>]
          AdmissionFeedback: string list }

    type TranscriptCausalCorrection =
        { [<JsonPropertyName("sequence")>]
          Sequence: string
          [<JsonPropertyName("reinterpretsThrough")>]
          ReinterpretsThrough: string
          [<JsonPropertyName("deltaRows")>]
          DeltaRows: int }

    type TranscriptCausalReadout =
        { [<JsonPropertyName("schema")>]
          Schema: string
          [<JsonPropertyName("executionDirection")>]
          ExecutionDirection: string
          [<JsonPropertyName("appendOnly")>]
          AppendOnly: bool
          [<JsonPropertyName("rewritesHistory")>]
          RewritesHistory: bool
          [<JsonPropertyName("corrections")>]
          Corrections: TranscriptCausalCorrection list }

    type TranscriptTick =
        { [<JsonPropertyName("tick")>]
          Tick: int
          [<JsonPropertyName("phase")>]
          Phase: string
          [<JsonPropertyName("event")>]
          Event: string
          [<JsonPropertyName("choiceCell")>]
          ChoiceCell: int
          [<JsonPropertyName("outcome")>]
          Outcome: string
          [<JsonPropertyName("heat")>]
          Heat: HeatRow
          [<JsonPropertyName("continuation")>]
          Continuation: string }

    type Transcript =
        { [<JsonPropertyName("schema")>]
          Schema: string
          [<JsonPropertyName("roomName")>]
          RoomName: string
          [<JsonPropertyName("seed")>]
          Seed: string
          [<JsonPropertyName("controller")>]
          Controller: ControllerCell list
          [<JsonPropertyName("ticks")>]
          Ticks: TranscriptTick list
          [<JsonPropertyName("heatReadout")>]
          HeatReadout: HeatReadout
          [<JsonPropertyName("temperatureReadout")>]
          TemperatureReadout: TranscriptTemperatureReadout
          [<JsonPropertyName("blackBodyReadout")>]
          BlackBodyReadout: TranscriptBlackBodyReadout
          [<JsonPropertyName("temperatureTreaty")>]
          TemperatureTreaty: TranscriptTemperatureTreaty
          [<JsonPropertyName("travelerFrame")>]
          TravelerFrame: TranscriptTravelerFrame
          [<JsonPropertyName("phaseClock")>]
          PhaseClock: TranscriptPhaseClock
          [<JsonPropertyName("continuationReadout")>]
          ContinuationReadout: TranscriptContinuationReadout
          [<JsonPropertyName("causalReadout")>]
          CausalReadout: TranscriptCausalReadout
          [<JsonPropertyName("heatRows")>]
          HeatRows: HeatRow list
          [<JsonPropertyName("generatedBy")>]
          GeneratedBy: string }

    let private jsonOptions =
        JsonSerializerOptions(WriteIndented = true)

    let emptyCausalReadout : TranscriptCausalReadout =
        { Schema = CausalReadoutSchema
          ExecutionDirection = "forward-only"
          AppendOnly = true
          RewritesHistory = false
          Corrections = [] }

    /// Add one validated causal correction to a room transcript. Sequence values
    /// remain decimal strings at the browser boundary so JavaScript cannot round
    /// a long-lived `bigint` beyond `Number.MAX_SAFE_INTEGER`.
    let appendCausalCorrection
        (correction: FourCornerTrace.CausalCorrection<'I, 'F, 'K, 'W>)
        (transcript: Transcript)
        : Result<Transcript, FourCornerTrace.CausalOrderError> =
        if correction.Sequence <= correction.ReinterpretsThrough then
            Error(
                FourCornerTrace.CausalOrderError.CorrectionDoesNotFollowHistory(
                    correction.ReinterpretsThrough,
                    correction.Sequence
                )
            )
        else
            let row =
                { Sequence = correction.Sequence.ToString(System.Globalization.CultureInfo.InvariantCulture)
                  ReinterpretsThrough =
                    correction.ReinterpretsThrough.ToString(System.Globalization.CultureInfo.InvariantCulture)
                  DeltaRows = correction.Delta.Length }

            Ok
                { transcript with
                    CausalReadout =
                        { transcript.CausalReadout with
                            Corrections = transcript.CausalReadout.Corrections @ [ row ] } }

    let private actionClassName =
        function
        | Runtime.ActionClass.Transition -> "transition"
        | Runtime.ActionClass.EscapeHatch -> "escape-hatch"
        | Runtime.ActionClass.GrammarExtension -> "grammar-extension"
        | Runtime.ActionClass.MenuContribution -> "menu-contribution"
        | Runtime.ActionClass.OperatorDecision -> "operator-decision"
        | Runtime.ActionClass.AgentDecision -> "agent-decision"

    let private gateName =
        function
        | Runtime.ActionGate.AppendOnly -> "append-only"
        | Runtime.ActionGate.PrGated -> "pr-gated"

    let private emptyCell cell =
        { Cell = cell
          Label = ""
          ActionId = ""
          ActionClass = ""
          Gate = ""
          Selected = false
          Enabled = false }

    let private cellOfAction selected cell (action: Runtime.CabinetAction) =
        { Cell = cell
          Label = action.Label
          ActionId = action.Id
          ActionClass = actionClassName action.Class
          Gate = gateName action.Gate
          Selected = selected
          Enabled = true }

    /// Normalize the room-facing controller readout into exactly sixteen cells.
    /// `ControllerReadout` is the room observation; `GridBinding` remains only
    /// the mechanical 4x4 placement primitive.
    let controllerCells (selectedCell: int option) (readout: Runtime.ControllerReadout) : ControllerCell list =
        let bound =
            readout.Grid
            |> GridBinding.bound
            |> Map.ofList

        [ for cell in 0 .. GridBinding.Size - 1 do
              match Map.tryFind cell bound with
              | Some action -> cellOfAction (selectedCell = Some cell) cell action
              | None -> emptyCell cell ]

    let heatRow (row: Scheduler.HeatBoundaryRow) : HeatRow =
        { Tick = row.Tick
          RoomName = row.RoomName
          HeatRejected = row.HeatRejected
          Backpressured = row.Backpressured
          StorageErrors = row.StorageErrors
          HeatKinds = row.HeatKinds
          Signals = Scheduler.heatBoundarySignalTokens row
          Reasons = row.Reasons }

    let private distinctOrdinal (values: string list) : string list =
        let seen = System.Collections.Generic.HashSet<string>(System.StringComparer.Ordinal)

        values
        |> List.filter (fun value -> seen.Add value)

    let private actorSuffix (value: string) : string =
        value.Trim()
        |> Seq.map (fun c ->
            if System.Char.IsLetterOrDigit c || c = '-' || c = '_' || c = '.' then
                c
            else
                '-')
        |> Seq.toArray
        |> fun chars -> System.String(chars)
        |> function
            | "" -> "unknown"
            | value -> value

    let private observeIfPositive actor phase frame =
        if phase <= 0L then
            frame
        else
            TravelerFrame.observe actor (Versionstamp.ofInt64 phase) frame

    let private lastTickPhase (ticks: TranscriptTick list) : int64 =
        ticks |> List.map _.Tick |> List.fold max 0 |> int64

    let private lastHeatPhase (rows: HeatRow list) : int64 =
        rows |> List.map _.Tick |> List.fold max 0 |> int64

    let travelerFrameReadout
        (source: string)
        (roomName: string)
        (ticks: TranscriptTick list)
        (rows: HeatRow list)
        : TranscriptTravelerFrame =
        let roomActor = sprintf "room:%s" (actorSuffix roomName)
        let heatActor = sprintf "heat:%s" (actorSuffix roomName)
        let roomFrame = TravelerFrame.origin |> observeIfPositive roomActor (lastTickPhase ticks)
        let heatFrame = TravelerFrame.origin |> observeIfPositive heatActor (lastHeatPhase rows)
        let common = TravelerFrame.transform roomFrame heatFrame
        let coordinates =
            common.Coords
            |> Map.toList
            |> List.map (fun (traveler, stamp) ->
                { Traveler = traveler
                  Phase = stamp.Version })

        { Schema = TravelerFrameSchema
          Source = source
          CommonPhase = coordinates |> List.map _.Phase |> List.fold max 0L
          Coordinates = coordinates
          CommonDominatesRoom = TravelerFrame.dominates common roomFrame
          CommonDominatesHeat = TravelerFrame.dominates common heatFrame }

    let phaseClockReadout (source: string) (seed: string) (frame: TranscriptTravelerFrame) : TranscriptPhaseClock =
        let skew =
            frame.Coordinates
            |> List.map (fun coord -> abs (frame.CommonPhase - coord.Phase))
            |> List.fold max 0L

        { Schema = PhaseClockSchema
          Source = source
          Basis = "seed-phase"
          Seed = seed
          Phase = frame.CommonPhase
          SkewBoundTicks = skew
          AppendOnly = true
          Travelers = frame.Coordinates.Length }

    let private stoppedName =
        function
        | SimLoop.Stopped.CutChoseClose -> "cut-chose-close"
        | SimLoop.Stopped.LapBudget -> "lap-budget"
        | SimLoop.Stopped.TickBudget -> "tick-budget"
        | SimLoop.Stopped.ClockBudget -> "clock-budget"
        | SimLoop.Stopped.RoomError _ -> "room-error"

    let private continuationFeedbackName =
        function
        | Scheduler.HeatBoardContinuationFeedback.MalformedContinuation _ -> "malformed-continuation"
        | Scheduler.HeatBoardContinuationFeedback.LoopIdMismatch _ -> "loop-id-mismatch"
        | Scheduler.HeatBoardContinuationFeedback.StatePointerMismatch _ -> "state-pointer-mismatch"
        | Scheduler.HeatBoardContinuationFeedback.ResumeTickOverflow _ -> "resume-tick-overflow"
        | Scheduler.HeatBoardContinuationFeedback.SnapshotLapMismatch _ -> "snapshot-lap-mismatch"
        | Scheduler.HeatBoardContinuationFeedback.SnapshotTickMismatch _ -> "snapshot-tick-mismatch"
        | Scheduler.HeatBoardContinuationFeedback.SnapshotMissing _ -> "snapshot-missing"
        | Scheduler.HeatBoardContinuationFeedback.SnapshotStoreRejected _ -> "snapshot-store-rejected"

    let private noContinuationReadout (source: string) (loopId: string) (stopReason: string) : TranscriptContinuationReadout =
        { Schema = ContinuationReadoutSchema
          Source = source
          LoopId = loopId
          Resumable = false
          Token = ""
          StatePointer = ""
          NextLap = 0
          TicksSpent = 0
          ResumeBaseTick = 0
          StopReason = stopReason
          AdmissionFeedback = [] }

    let continuationReadout
        (source: string)
        (loopId: string)
        (ticksPerLap: int)
        (outcome: SimLoop.Outcome<Scheduler.ScheduledRoomState, string list>)
        : TranscriptContinuationReadout =
        let stopReason = stoppedName outcome.Stopped

        match Scheduler.continueHeatBoardAfter loopId outcome with
        | None -> noContinuationReadout source loopId stopReason
        | Some token ->
            let encoded = SimLoop.encodeContinuation token

            match Scheduler.admitHeatBoardContinuation loopId ticksPerLap encoded with
            | Ok admission ->
                { Schema = ContinuationReadoutSchema
                  Source = source
                  LoopId = token.LoopId
                  Resumable = true
                  Token = encoded
                  StatePointer = token.StatePointer
                  NextLap = token.NextLap
                  TicksSpent = token.TicksSpent
                  ResumeBaseTick = admission.ResumeBaseTick
                  StopReason = stopReason
                  AdmissionFeedback = [] }
            | Error feedback ->
                { noContinuationReadout source token.LoopId stopReason with
                    Token = encoded
                    StatePointer = token.StatePointer
                    NextLap = token.NextLap
                    TicksSpent = token.TicksSpent
                    AdmissionFeedback = [ continuationFeedbackName feedback ] }

    let heatReadout (rows: HeatRow list) : HeatReadout =
        { Schema = HeatReadoutSchema
          QSharpTreaty = HeatSignalTreaty
          QSharpSource = QSharpHeatSignalSource
          Rows = rows.Length
          HeatRejected = rows |> List.sumBy _.HeatRejected
          Backpressured = rows |> List.sumBy _.Backpressured
          StorageErrors = rows |> List.sumBy _.StorageErrors
          HeatKinds = rows |> List.collect _.HeatKinds |> distinctOrdinal
          Signals = rows |> List.collect _.Signals |> distinctOrdinal
          Reasons = rows |> List.collect _.Reasons }

    let private heatLaneMax = 16

    let private countPpm count =
        count
        |> max 0
        |> min heatLaneMax
        |> fun value -> value * (TemperatureReadout.MaxPpm / heatLaneMax)

    let temperatureReadout (rows: HeatRow list) : TranscriptTemperatureReadout =
        let source =
            rows
            |> List.tryHead
            |> Option.map _.RoomName
            |> Option.defaultValue "darkhall-room-transcript"

        let readout =
            Zeta.Core.TemperatureReadout.ofPpm
                source
                (rows |> List.sumBy _.HeatRejected |> countPpm)
                (rows |> List.sumBy _.StorageErrors |> countPpm)
                (rows |> List.sumBy _.Backpressured |> countPpm)
                0

        { Schema = readout.Schema
          Source = readout.Source
          TemperaturePpm = readout.TemperaturePpm
          Band = readout.Band
          HeatPpm = readout.HeatPpm
          UncertaintyPpm = readout.UncertaintyPpm
          PressurePpm = readout.PressurePpm
          AttentionPpm = readout.AttentionPpm
          Fidelity = readout.Fidelity }

    let private coreTemperatureReadout (readout: TranscriptTemperatureReadout) : Zeta.Core.TemperatureReadout =
        { Schema = readout.Schema
          Source = readout.Source
          TemperaturePpm = readout.TemperaturePpm
          Band = readout.Band
          HeatPpm = readout.HeatPpm
          UncertaintyPpm = readout.UncertaintyPpm
          PressurePpm = readout.PressurePpm
          AttentionPpm = readout.AttentionPpm
          Fidelity = readout.Fidelity }

    let private transcriptTemperatureReadoutOfCore
        (readout: Zeta.Core.TemperatureReadout)
        : TranscriptTemperatureReadout =
        { Schema = readout.Schema
          Source = readout.Source
          TemperaturePpm = readout.TemperaturePpm
          Band = readout.Band
          HeatPpm = readout.HeatPpm
          UncertaintyPpm = readout.UncertaintyPpm
          PressurePpm = readout.PressurePpm
          AttentionPpm = readout.AttentionPpm
          Fidelity = readout.Fidelity }

    let private transcriptBlackBodyReadoutOfCore (readout: Zeta.Core.BlackBodyReadout) : TranscriptBlackBodyReadout =
        { Schema = readout.Schema
          Source = readout.Source
          TemperaturePpm = readout.TemperaturePpm
          RadiancePpm = readout.RadiancePpm
          PeakFrequencyPpm = readout.PeakFrequencyPpm }

    let blackBodyReadout (temperature: TranscriptTemperatureReadout) : TranscriptBlackBodyReadout =
        Zeta.Core.BlackBodyReadout.ofTemperaturePpm temperature.Source temperature.TemperaturePpm
        |> transcriptBlackBodyReadoutOfCore

    let private temperatureReferenceFeedbackToken =
        function
        | Zeta.Core.TemperatureReferenceFeedback.EmptyOracleName -> "empty-oracle-name"
        | Zeta.Core.TemperatureReferenceFeedback.TemperatureSchemaMismatch(expected, actual) ->
            sprintf "temperature-schema-mismatch expected=%s actual=%s" expected actual

    let temperatureTreaty (temperature: TranscriptTemperatureReadout) : TranscriptTemperatureTreaty =
        let coreTemperature = coreTemperatureReadout temperature

        match
            Zeta.Core.TemperatureTreatyBundle.ofTemperatureReadout
                Zeta.Core.TemperatureReferenceOracle.localBlackBody
                coreTemperature
        with
        | Ok bundle ->
            { HeatReadoutSchema = bundle.HeatReadoutSchema
              TemperatureReadoutSchema = bundle.TemperatureReadoutSchema
              BlackBodyReadoutSchema = bundle.BlackBodyReadoutSchema
              QSharpTreaty = bundle.QSharpTreaty
              QSharpSource = bundle.QSharpSource
              FSharpSurface = bundle.FSharpSurface
              ReferenceOracle = bundle.ReferenceOracle
              ReferenceFeedback = []
              Temperature = transcriptTemperatureReadoutOfCore bundle.Temperature
              BlackBody = transcriptBlackBodyReadoutOfCore bundle.BlackBody }
        | Error feedback ->
            let fallbackBlackBody = Zeta.Core.BlackBodyReadout.ofTemperatureReadout coreTemperature

            { HeatReadoutSchema = Zeta.Core.HeatReadout.Schema
              TemperatureReadoutSchema = Zeta.Core.HeatReadout.TemperatureSchema
              BlackBodyReadoutSchema = Zeta.Core.HeatReadout.BlackBodySchema
              QSharpTreaty = Zeta.Core.HeatReadout.SignalTreaty
              QSharpSource = Zeta.Core.HeatReadout.QSharpSignalSource
              FSharpSurface = Zeta.Core.HeatReadout.FSharpSurface
              ReferenceOracle = Zeta.Core.TemperatureReferenceOracle.localBlackBody.Name
              ReferenceFeedback = [ temperatureReferenceFeedbackToken feedback ]
              Temperature = temperature
              BlackBody = transcriptBlackBodyReadoutOfCore fallbackBlackBody }

    let private heatRowOfReadout (tick: int) (roomName: string) (heat: RoomLoop.HeatReadout) : HeatRow =
        heatRow
            { Tick = tick
              RoomName = roomName
              HeatRejected = heat.HeatRejected
              Backpressured = heat.Backpressured
              StorageErrors = heat.StorageErrors
              HeatKinds = heat.HeatKinds
              Reasons = heat.Reasons }

    let private outcomeOfHeatAndResult (heat: RoomLoop.HeatReadout) result =
        match result with
        | Error _ when heat.Backpressured > 0 -> "backpressure"
        | Error _ -> "refused"
        | Ok _ when heat.Backpressured > 0 -> "backpressure"
        | Ok _ -> "ok"

    let private runtimeResultName =
        function
        | Runtime.RunResult.SoftChip8Frame _ -> "soft-chip8-frame"
        | Runtime.RunResult.DarkHallCpuState _ -> "darkhall-cpu-state"
        | Runtime.RunResult.Chip9Frame _ -> "chip9-frame"
        | Runtime.RunResult.MetaCartResult _ -> "meta-cart-result"

    let private boundaryEffectName =
        function
        | RoomLoop.BoundaryEffect.Admitted report -> sprintf "boundary-admitted:%A" report.Outcome
        | RoomLoop.BoundaryEffect.Frosted -> "boundary-frosted"
        | RoomLoop.BoundaryEffect.Cleared -> "boundary-cleared"
        | RoomLoop.BoundaryEffect.Traversed(fromRoom, toRoom) -> sprintf "boundary-traversed:%s->%s" fromRoom toRoom

    let private tickFeedbackName =
        function
        | RoomLoop.TickFeedback.CellUnbound _ -> "cell-unbound"
        | RoomLoop.TickFeedback.ControllerActionSelected _ -> "controller-action-selected"
        | RoomLoop.TickFeedback.RequestMissing _ -> "request-missing"
        | RoomLoop.TickFeedback.RuntimeFeedback _ -> "runtime-feedback"
        | RoomLoop.TickFeedback.BoundaryFeedback _ -> "boundary-feedback"

    let tickOfOutcome (tick: int) (outcome: RoomLoop.TickOutcome) : TranscriptTick =
        let heat = heatRowOfReadout tick outcome.Readout.RoomName outcome.Heat
        let event =
            match outcome.Result with
            | Ok result -> sprintf "executed:%s" (runtimeResultName result)
            | Error feedback -> sprintf "refused:%s" (tickFeedbackName feedback)

        { Tick = tick
          Phase = "execute"
          Event = event
          ChoiceCell = outcome.Choice.Cell
          Outcome = outcomeOfHeatAndResult outcome.Heat outcome.Result
          Heat = heat
          Continuation = "" }

    let tickOfBoundaryOutcome (tick: int) (outcome: RoomLoop.BoundaryTickOutcome<'K>) : TranscriptTick =
        let heat = heatRowOfReadout tick outcome.Readout.RoomName outcome.Heat
        let event =
            match outcome.Result with
            | Ok(RoomLoop.BoundaryTickResult.RuntimeResult result) -> sprintf "executed:%s" (runtimeResultName result)
            | Ok(RoomLoop.BoundaryTickResult.BoundaryResult effect) -> boundaryEffectName effect
            | Error feedback -> sprintf "refused:%s" (tickFeedbackName feedback)

        { Tick = tick
          Phase = "execute"
          Event = event
          ChoiceCell = outcome.Choice.Cell
          Outcome = outcomeOfHeatAndResult outcome.Heat outcome.Result
          Heat = heat
          Continuation = "" }

    let private coldHeatRow tick roomName : HeatRow =
        { Tick = tick
          RoomName = roomName
          HeatRejected = 0
          Backpressured = 0
          StorageErrors = 0
          HeatKinds = []
          Signals = []
          Reasons = [] }

    let private measureTick (index: int) (row: Scheduler.HeatBoundaryRow) : TranscriptTick =
        let projected = heatRow row
        let outcome =
            if row.Backpressured > 0 then "backpressure"
            else "ok"

        { Tick = row.Tick
          Phase = "measure"
          Event = sprintf "heat-row:%d" index
          ChoiceCell = -1
          Outcome = outcome
          Heat = projected
          Continuation = "" }

    let private attachContinuationToLast
        (roomName: string)
        (continuation: TranscriptContinuationReadout)
        (ticks: TranscriptTick list)
        : TranscriptTick list =
        if not continuation.Resumable then
            ticks
        else
            match List.rev ticks with
            | last :: rest -> List.rev ({ last with Continuation = continuation.Token } :: rest)
            | [] ->
                [ { Tick = continuation.NextLap
                    Phase = "continue"
                    Event = "heat-board-continuation"
                    ChoiceCell = -1
                    Outcome = "continued"
                    Heat = coldHeatRow continuation.NextLap roomName
                    Continuation = continuation.Token } ]

    let ofRunOutcome seed generatedBy (run: RoomLoop.RunOutcome) : Transcript =
        let roomName = run.Final.Room.Name
        let readout =
            run.Final.LastReadout
            |> Option.defaultWith (fun () -> Runtime.observe run.Final.Room)
        let heatRows = run.Ticks |> List.mapi (fun index tick -> heatRowOfReadout (index + 1) tick.Readout.RoomName tick.Heat)
        let ticks = run.Ticks |> List.mapi (fun index tick -> tickOfOutcome (index + 1) tick)
        let temperature = temperatureReadout heatRows
        let treaty = temperatureTreaty temperature
        let travelerFrame = travelerFrameReadout generatedBy roomName ticks heatRows

        { Schema = Schema
          RoomName = roomName
          Seed = seed
          GeneratedBy = generatedBy
          Controller =
              run.Ticks
              |> List.tryLast
              |> Option.map (fun tick -> controllerCells (Some tick.Choice.Cell) tick.Readout)
              |> Option.defaultWith (fun () -> controllerCells None readout)
          Ticks = ticks
          HeatReadout = heatReadout heatRows
          TemperatureReadout = treaty.Temperature
          BlackBodyReadout = treaty.BlackBody
          TemperatureTreaty = treaty
          TravelerFrame = travelerFrame
          PhaseClock = phaseClockReadout generatedBy seed travelerFrame
          ContinuationReadout = noContinuationReadout generatedBy "" "not-simloop"
          CausalReadout = emptyCausalReadout
          HeatRows = heatRows }

    let ofBoundaryState seed generatedBy (state: Scheduler.BoundaryScheduledRoomState<'K>) : Transcript =
        let rows = state |> Scheduler.boundaryHeatRows |> List.map heatRow
        let readout =
            state.Loop.LastReadout
            |> Option.defaultWith (fun () -> Runtime.observe state.Loop.Room)
        let temperature = temperatureReadout rows
        let treaty = temperatureTreaty temperature
        let ticks =
            state.LastTick
            |> Option.map (fun tick -> [ tickOfBoundaryOutcome state.CompletedTicks tick ])
            |> Option.defaultValue []
        let travelerFrame = travelerFrameReadout generatedBy state.Loop.Room.Name ticks rows

        { Schema = Schema
          RoomName = state.Loop.Room.Name
          Seed = seed
          GeneratedBy = generatedBy
          Controller =
              state.LastTick
              |> Option.map (fun tick -> controllerCells (Some tick.Choice.Cell) tick.Readout)
              |> Option.defaultWith (fun () -> controllerCells None readout)
          Ticks = ticks
          HeatReadout = heatReadout rows
          TemperatureReadout = treaty.Temperature
          BlackBodyReadout = treaty.BlackBody
          TemperatureTreaty = treaty
          TravelerFrame = travelerFrame
          PhaseClock = phaseClockReadout generatedBy seed travelerFrame
          ContinuationReadout = noContinuationReadout generatedBy "" "not-simloop"
          CausalReadout = emptyCausalReadout
          HeatRows = rows }

    let ofHeatBoardOutcome
        seed
        generatedBy
        loopId
        ticksPerLap
        (outcome: SimLoop.Outcome<Scheduler.ScheduledRoomState, string list>)
        : Transcript =
        let state = outcome.Final
        let roomName = state.Loop.Room.Name
        let readout =
            state.LastTick
            |> Option.map _.Readout
            |> Option.orElse state.Loop.LastReadout
            |> Option.defaultWith (fun () -> Runtime.observe state.Loop.Room)
        let rows = state |> Scheduler.heatRows
        let heatRows = rows |> List.map heatRow
        let continuation = continuationReadout generatedBy loopId ticksPerLap outcome
        let ticks =
            rows
            |> List.mapi (fun index row -> measureTick (index + 1) row)
            |> attachContinuationToLast roomName continuation
        let temperature = temperatureReadout heatRows
        let treaty = temperatureTreaty temperature
        let travelerFrame = travelerFrameReadout generatedBy roomName ticks heatRows

        { Schema = Schema
          RoomName = roomName
          Seed = seed
          GeneratedBy = generatedBy
          Controller =
              state.LastTick
              |> Option.map (fun tick -> controllerCells (Some tick.Choice.Cell) tick.Readout)
              |> Option.defaultWith (fun () -> controllerCells None readout)
          Ticks = ticks
          HeatReadout = heatReadout heatRows
          TemperatureReadout = treaty.Temperature
          BlackBodyReadout = treaty.BlackBody
          TemperatureTreaty = treaty
          TravelerFrame = travelerFrame
          PhaseClock = phaseClockReadout generatedBy seed travelerFrame
          ContinuationReadout = continuation
          CausalReadout = emptyCausalReadout
          HeatRows = heatRows }

    let ofUnifiedHeatRun seed generatedBy (run: RoomRun.UnifiedHeatRun<'K>) : Transcript =
        let readout =
            run.Room.LastTick
            |> Option.map (fun tick -> tick.Readout)
            |> Option.orElse run.Room.Loop.LastReadout
            |> Option.defaultWith (fun () -> Runtime.observe run.Room.Loop.Room)

        let tickRows =
            run.Room.LastTick
            |> Option.map (fun tick -> [ tickOfBoundaryOutcome run.Room.CompletedTicks tick ])
            |> Option.defaultValue []

        let heatTicks = run.HeatRows |> List.mapi (fun index row -> measureTick (index + 1) row)
        let ticks = tickRows @ heatTicks
        let heatRows = run.HeatRows |> List.map heatRow
        let temperature = temperatureReadout heatRows
        let treaty = temperatureTreaty temperature
        let travelerFrame = travelerFrameReadout generatedBy run.Room.Loop.Room.Name ticks heatRows

        { Schema = Schema
          RoomName = run.Room.Loop.Room.Name
          Seed = seed
          GeneratedBy = generatedBy
          Controller =
              run.Room.LastTick
              |> Option.map (fun tick -> controllerCells (Some tick.Choice.Cell) tick.Readout)
              |> Option.defaultWith (fun () -> controllerCells None readout)
          Ticks = ticks
          HeatReadout = heatReadout heatRows
          TemperatureReadout = treaty.Temperature
          BlackBodyReadout = treaty.BlackBody
          TemperatureTreaty = treaty
          TravelerFrame = travelerFrame
          PhaseClock = phaseClockReadout generatedBy seed travelerFrame
          ContinuationReadout = noContinuationReadout generatedBy "" "not-simloop"
          CausalReadout = emptyCausalReadout
          HeatRows = heatRows }

    let ofUnifiedHorizonRun seed generatedBy (run: RoomRun.UnifiedHorizonRun<'K, 'S>) : Transcript =
        let baseRun: RoomRun.UnifiedHeatRun<'K> =
            { Room = run.Room
              SoftFrame = run.SoftFrame
              BoundaryHeatRows = Scheduler.boundaryHeatRows run.Room
              SoftHeatReport = run.SoftHeatReport
              HeatRows = run.HeatRows
              HeatTranscript = run.HeatTranscript }

        let baseTranscript = ofUnifiedHeatRun seed generatedBy baseRun
        let ticks =
            baseTranscript.Ticks
            @ [ { Tick = run.Room.CompletedTicks
                  Phase = "continue"
                  Event = "horizon-continuation"
                  ChoiceCell = -1
                  Outcome = "continued"
                  Heat = coldHeatRow run.Room.CompletedTicks run.Room.Loop.Room.Name
                  Continuation = "room-horizon" } ]

        let travelerFrame = travelerFrameReadout generatedBy run.Room.Loop.Room.Name ticks baseTranscript.HeatRows

        { baseTranscript with
            Ticks = ticks
            TravelerFrame = travelerFrame
            PhaseClock = phaseClockReadout generatedBy seed travelerFrame }

    let toJson (transcript: Transcript) : string =
        JsonSerializer.Serialize(transcript, jsonOptions).Replace("\r\n", "\n")
