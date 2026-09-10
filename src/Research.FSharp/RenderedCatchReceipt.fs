namespace Zeta.Research

open System

/// Typed v1 receipt contract. Binary strings use ASCII 0/1 for compact JSON only.
/// Digests consume underlying bytes, never hexadecimal digest strings: source symbols
/// are bytes 0/1; ROMs are raw bytes; frames are 2048 row-major bytes; shadow trace
/// tuples are (before-PC, opcode, after-PC), each unsigned 16-bit little-endian.
/// Batch digests append those same underlying streams in episode execution order.
[<RequireQualifiedAccess>]
module RenderedCatchReceipt =
    [<AllowNullLiteral; Sealed>]
    type Failure(stage: string, code: string, detail: string, panel: string, arm: string, episode: Nullable<int>) =
        member _.Stage = stage
        member _.Code = code
        member _.Detail = detail
        member _.Panel = panel
        member _.Arm = arm
        member _.Episode = episode

    type SourceHash = { File: string; Sha256: string }
    type LoadedAssembly = { Name: string; Mvid: string; Sha256: string }
    type Provenance =
        { SourceCommit: string; ImplementationArchive: string; ImplementationCommit: string
          SourceHashes: SourceHash[]; LoadedAssemblies: LoadedAssembly[]
          Runtime: string; OperatingSystem: string; Arguments: string[] }
    type PanelConfig =
        { Name: string; Episodes: int; SourceSeed: int; SourceDomain: int
          ActionSeed: int; ActionDomain: int; CopyProbability: float; Geometry: string; Palette: string }
    type CostConfig =
        { SourceSeed: int; SourceDomain: int; Episodes: int; WarmupEpisodes: int; TimedEpisodes: int
          ActionSeed: int; ActionDomain: int; Repetitions: int; Rotation: string }
    type Config =
        { Arms: string[]; Panels: PanelConfig[]; Symbols: int; ScoredChoices: int; WarmupKey: int
          EmulatorSeed: int; CyclesPerCall: int; RomBytes: int; ProjectionRows: int
          Cost: CostConfig; PositiveGainNumerator: int; PositiveGainDenominator: int
          NullGainNumerator: int; NullGainDenominator: int; MaximumCostRatio: float }
    type Counters =
        { Episodes: int; EnvironmentCalls: int; KeyActions: int; ScoredChoices: int
          PrimaryInstructions: int; ShadowInstructions: int; TotalTransitions: int
          PrimaryTimerTicks: int; ShadowTimerTicks: int; AdapterGroupsChecked: int }
    /// Index is always the original corpus row: cost warmup 0..7, timed 8..71.
    type Episode =
        { Index: int; Complete: bool; Failure: Failure; Actions: string; Hits: string; Observations: string
          WarmupHit: int; Return: int; Counters: Counters
          FrameSha256: string; ProjectionSha256: string; ShadowTraceSha256: string }
    type Batch =
        { Complete: bool; Failure: Failure; ActionDraws: int64; TotalHits: int; MeanHitFraction: float
          Counters: Counters; FrameSha256: string; ProjectionSha256: string; ShadowTraceSha256: string
          Episodes: Episode[] }
    type Payload =
        { ParameterFloat64Values: int; ParameterBytes: int; HistoryInt32Slots: int; HistoryBytes: int
          ObservationCountBytes: int; FairStreamStateBytes: int; FairInitialSeedBytes: int; FairDrawCountBytes: int
          RomBytes: int; FullFrameCellBytes: int; ProjectedFrameCellBytes: int; Scope: string }
    type Arm = { Name: string; Payload: Payload; Batch: Batch }
    type Source =
        { SourceSeed: int; SourceDomain: int; SourceDraws: int64; SourceSymbols: string[]
          SourceSymbolsSha256: string; SourceRomSha256: string; Episodes: int; SymbolsPerEpisode: int; RomBytes: int }
    type PairedReturn = { Control: string; Differences: int[]; TotalDifference: int }
    type Panel = { Config: PanelConfig; Source: Source; Arms: Arm[]; PairedReturns: PairedReturn[] }
    type Native =
        { Protocol: string; Kind: string; Complete: bool; Failure: Failure; ProtocolSha256: string
          InputSha256: string; CountsSha256Before: string; CountsSha256After: string; Config: Config
          Provenance: Provenance; StartedAtUtc: string; FinishedAtUtc: string; Panels: Panel[] }
    type Resource = { ElapsedMilliseconds: float; CpuMilliseconds: float; AllocatedBytes: int64 }
    /// SourceDraws are actual draws inside each path (zero); corpus generation is in Source.SourceDraws.
    /// Source fingerprints cover all 72 precompiled rows; ActionDraws are the actual path deltas.
    type CostRow =
        { Repetition: int; Name: string; Payload: Payload; Warmup: Batch; Timed: Batch; Resource: Resource
          WarmupSourceDraws: int64; TimedSourceDraws: int64; WarmupActionDraws: int64; TimedActionDraws: int64
          SourceSymbolsSha256: string; SourceRomSha256: string }
    type Cost =
        { Protocol: string; Kind: string; Complete: bool; Failure: Failure; ProtocolSha256: string
          InputSha256: string; ModelInputSha256: string; CountsSha256Before: string; CountsSha256After: string
          Config: Config; Provenance: Provenance; StartedAtUtc: string; FinishedAtUtc: string
          QuietWindowDeclaration: string; HostActivity: string; Source: Source; Measurements: CostRow[] }

    let protocol = "rendered-catch-actions-v1"
    let failure stage code detail = Failure(stage, code, detail, null, null, Nullable())
    let locate panel arm episode (reason: Failure) =
        Failure(reason.Stage, reason.Code, reason.Detail, panel, arm, Nullable episode)
    let zeroCounters =
        { Episodes = 0; EnvironmentCalls = 0; KeyActions = 0; ScoredChoices = 0; PrimaryInstructions = 0
          ShadowInstructions = 0; TotalTransitions = 0; PrimaryTimerTicks = 0; ShadowTimerTicks = 0; AdapterGroupsChecked = 0 }
    let addCounters (a: Counters) (b: Counters) =
        { Episodes = a.Episodes + b.Episodes; EnvironmentCalls = a.EnvironmentCalls + b.EnvironmentCalls
          KeyActions = a.KeyActions + b.KeyActions; ScoredChoices = a.ScoredChoices + b.ScoredChoices
          PrimaryInstructions = a.PrimaryInstructions + b.PrimaryInstructions; ShadowInstructions = a.ShadowInstructions + b.ShadowInstructions
          TotalTransitions = a.TotalTransitions + b.TotalTransitions; PrimaryTimerTicks = a.PrimaryTimerTicks + b.PrimaryTimerTicks
          ShadowTimerTicks = a.ShadowTimerTicks + b.ShadowTimerTicks; AdapterGroupsChecked = a.AdapterGroupsChecked + b.AdapterGroupsChecked }
    let config =
        { Arms = [|"order-two"; "bigram"; "last-beacon"; "fair-independent"; "known-lag-two"|]
          Panels =
            [| for index, name, probability, geometry, palette in
                   [0,"dot-three-quarter",0.75,"dot","fixed"
                    1,"bar-three-quarter",0.75,"bar","fixed"
                    2,"palette-three-quarter",0.75,"dot","odd-complement"
                    3,"dot-iid-half",0.5,"dot","fixed"] do
                   yield { Name = name; Episodes = 1024; SourceSeed = 4001; SourceDomain = 401 + index
                           ActionSeed = 5003; ActionDomain = 501 + index; CopyProbability = probability; Geometry = geometry; Palette = palette } |]
          Symbols = 66; ScoredChoices = 64; WarmupKey = 0; EmulatorSeed = 1; CyclesPerCall = 17; RomBytes = 2247; ProjectionRows = 24
          Cost = { SourceSeed = 7001; SourceDomain = 701; Episodes = 72; WarmupEpisodes = 8; TimedEpisodes = 64
                   ActionSeed = 8003; ActionDomain = 801; Repetitions = 5; Rotation = "left-by-repetition" }
          PositiveGainNumerator = 15; PositiveGainDenominator = 100; NullGainNumerator = 3; NullGainDenominator = 100; MaximumCostRatio = 2.0 }
