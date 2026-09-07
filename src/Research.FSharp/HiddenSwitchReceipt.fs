namespace Zeta.Research

open System

/// Research receipt schema. Per-observation hashes consume each raw 2048-byte frame,
/// independently, in row-major order. Compact binary strings serialize bits only.
[<RequireQualifiedAccess>]
module HiddenSwitchReceipt =
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
        { SourceCommit: string; RegistrationTag: string; RegistrationCommit: string
          ImplementationTag: string; ImplementationCommit: string; SourceHashes: SourceHash[]
          LoadedAssemblies: LoadedAssembly[]; Runtime: string; OperatingSystem: string; Arguments: string[] }
    type PanelConfig = { Name: string; Episodes: int; Seed: int; Domain: int; Effect: bool; Geometry: string; Palette: string }
    type CostConfig =
        { Seed: int; Domain: int; SourceEpisodes: int; WarmupEpisodes: int; TimedEpisodes: int
          Replicates: int; Rotation: string }
    type Config =
        { Arms: string[]; Panels: PanelConfig[]; Horizon: int; Observations: int; DriftProbability: float
          CueReliability: float; InitialBelief: float; PlanningDepth: int; TieTolerance: float; ReplayTolerance: float
          ReturnScale: int; MinimumGain: float; MaximumCostRatio: float; FrameWidth: int; FrameHeight: int
          ProjectionRows: int; Cost: CostConfig }
    type PlanningCounters = { Nodes: int; ActionValues: int; Predictions: int; Updates: int }
    type FilterCounters = { Predictions: int; Updates: int }
    /// Index is the source corpus index, including cost warmup 0..7 and timed 8..71.
    type Episode =
        { Index: int; Complete: bool; Failure: Failure; Cues: string; Actions: string; States: string
          Reward4: int[]; Beliefs: float[]; DecisionQ: float[][]; TreeRootQ: float[][]
          PlanningCounters: PlanningCounters[]; FilterCounters: FilterCounters
          FrameSha256: string[]; ProjectionSha256: string[]; TotalReward4: int }
    type Arm = { Name: string; Episodes: Episode[]; Complete: bool; Failure: Failure }
    type Panel = { Config: PanelConfig; Arms: Arm[] }
    type Native =
        { Protocol: string; Kind: string; Complete: bool; Failure: Failure; ProtocolSha256: string; Config: Config
          Provenance: Provenance; StartedAtUtc: string; FinishedAtUtc: string; Panels: Panel[] }
    type CostRow =
        { Replicate: int; Order: int; Name: string; WallMsTotal: float; CpuMsTotal: float; AllocatedBytesTotal: int64
          WarmupEpisodes: Episode[]; TimedEpisodes: Episode[] }
    type Payload =
        { Name: string; BeliefFloat64Slots: int; ModelFloat64Slots: int; ModelBoolSlots: int
          ChronologyInt32Slots: int; FullFrameCellBytes: int; ProjectionCellBytes: int; Scope: string }
    type Cost =
        { Protocol: string; Kind: string; Complete: bool; Failure: Failure; ProtocolSha256: string; Config: Config
          Provenance: Provenance; StartedAtUtc: string; FinishedAtUtc: string; InputBehaviorSha256: string
          QuietWindowDeclaration: string; HostActivity: string; SourceDraws: int; Payload: Payload[]; Rows: CostRow[] }

    let protocol = "hidden-switch-v1"
    let failure stage code detail = Failure(stage, code, detail, null, null, Nullable())
    let locate panel arm episode (reason: Failure) = Failure(reason.Stage, reason.Code, reason.Detail, panel, arm, Nullable episode)
    let zeroPlanning: PlanningCounters = { Nodes = 0; ActionValues = 0; Predictions = 0; Updates = 0 }
    let zeroFilter: FilterCounters = { Predictions = 0; Updates = 0 }
    let addPlanning (a: PlanningCounters) (b: PlanningCounters) : PlanningCounters =
        { Nodes = a.Nodes + b.Nodes; ActionValues = a.ActionValues + b.ActionValues
          Predictions = a.Predictions + b.Predictions; Updates = a.Updates + b.Updates }
    /// Return fresh arrays: caller mutation cannot rewrite the fixed roster for later calls.
    let config () : Config =
        { Arms = [|"belief-depth3"; "belief-myopic"; "belief-myopic-padded"; "latest-cue-depth3"|]
          Panels =
            [| for index, name, effect, geometry, palette in
                   [0,"dot-switch",true,"dot","fixed"; 1,"bar-switch",true,"bar","fixed"
                    2,"palette-switch",true,"dot","odd-complement"; 3,"dot-null",false,"dot","fixed"] do
                   yield { Name = name; Episodes = 1024; Seed = 9101; Domain = 911 + index
                           Effect = effect; Geometry = geometry; Palette = palette } |]
          Horizon = 16; Observations = 17; DriftProbability = 0.125; CueReliability = 0.75
          InitialBelief = 0.5; PlanningDepth = 3; TieTolerance = 1e-12; ReplayTolerance = 1e-10
          ReturnScale = 64; MinimumGain = 0.10; MaximumCostRatio = 1.25
          FrameWidth = 64; FrameHeight = 32; ProjectionRows = 24
          Cost = { Seed = 9203; Domain = 921; SourceEpisodes = 72; WarmupEpisodes = 8; TimedEpisodes = 64
                   Replicates = 5; Rotation = "left-by-replicate" } }
