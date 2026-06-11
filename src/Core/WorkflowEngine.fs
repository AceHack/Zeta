namespace Zeta.Core

open System

type AgentPersona =
    | Otto
    | Alexa
    | Riven
    | Vera
    | Lior
    | Aaron
    | Addison
    | Max

    member this.ToJsonString() =
        match this with
        | Otto -> "otto"
        | Alexa -> "alexa"
        | Riven -> "riven"
        | Vera -> "vera"
        | Lior -> "lior"
        | Aaron -> "aaron"
        | Addison -> "addison"
        | Max -> "max"

    static member FromJsonString(s: string) =
        match s.ToLowerInvariant() with
        | "otto" -> Otto
        | "alexa" -> Alexa
        | "riven" -> Riven
        | "vera" -> Vera
        | "lior" -> Lior
        | "aaron" -> Aaron
        | "addison" -> Addison
        | "max" -> Max
        | _ -> failwithf "Unknown persona: %s" s

type AgentContext = {
    Agent: AgentPersona
    Cycle: int
    SessionStartIso: string
}

type Lane =
    | Operational
    | VerbatimPreservation
    | Memory
    | Heartbeat
    | BacklogRow
    | ShadowWork
    | ToolingOrCi
    | DocsGeneral
    | SubstrateCascade
    | Mixed

    member this.ToJsonString() =
        match this with
        | Operational -> "operational"
        | VerbatimPreservation -> "verbatim-preservation"
        | Memory -> "memory"
        | Heartbeat -> "heartbeat"
        | BacklogRow -> "backlog-row"
        | ShadowWork -> "shadow-work"
        | ToolingOrCi -> "tooling-or-ci"
        | DocsGeneral -> "docs-general"
        | SubstrateCascade -> "substrate-cascade"
        | Mixed -> "mixed"

    static member FromJsonString(s: string) =
        match s.ToLowerInvariant() with
        | "operational" -> Operational
        | "verbatim-preservation" -> VerbatimPreservation
        | "memory" -> Memory
        | "heartbeat" -> Heartbeat
        | "backlog-row" -> BacklogRow
        | "shadow-work" -> ShadowWork
        | "tooling-or-ci" -> ToolingOrCi
        | "docs-general" -> DocsGeneral
        | "substrate-cascade" -> SubstrateCascade
        | "mixed" -> Mixed
        | _ -> failwithf "Unknown lane: %s" s

type DoraMetrics = {
    DeploymentCount: int
    LeadTimeMedianSeconds: double
    ChangeFailureRate: double
    MttrMedianSeconds: double
    SubstrateRatio: double
}

type TrajectoryPhase =
    | Setup
    | Execution
    | Maturation
    | Sunset

    member this.ToJsonString() =
        match this with
        | Setup -> "setup"
        | Execution -> "execution"
        | Maturation -> "maturation"
        | Sunset -> "sunset"

    static member FromJsonString(s: string) =
        match s.ToLowerInvariant() with
        | "setup" -> Setup
        | "execution" -> Execution
        | "maturation" -> Maturation
        | "sunset" -> Sunset
        | _ -> failwithf "Unknown trajectory phase: %s" s

type WorkCandidate = {
    Id: string
    Lane: Lane
    EstimatedDoraContribution: double
    Uncertainty: double
    TrajectoryPhase: TrajectoryPhase
    AgentInterest: double
}

type StatusSnapshot = {
    SnapshotIso: string
    CurrentDora: DoraMetrics
    HotTrajectories: string list
    CoolingTrajectories: string list
    ExplorationCandidates: string list
    PerAgentRatios: Map<string, double>
}

type WorkResult = {
    WorkId: string
    Lane: Lane
    Success: bool
    DoraContribution: double
    Notes: string option
}

type AgentState =
    | Idle of context: AgentContext
    | InspectingStatus of context: AgentContext * snapshot: StatusSnapshot
    | SelectingWork of context: AgentContext * candidates: WorkCandidate list
    | ExecutingWork of context: AgentContext * work: WorkCandidate
    | EmittingResult of context: AgentContext * result: WorkResult
    | RecordingHeartbeat of context: AgentContext * lane: Lane * note: string option
    | NamedBoundedWait of context: AgentContext * namedDep: string * expectedResolutionIso: string option
    | FreeTime of context: AgentContext * reason: string
    | OperatorAttentionRequested of context: AgentContext * reason: string
    | Paused of context: AgentContext * reason: string * expectedResumeIso: string option

type MenuOption =
    | PickWork of work: WorkCandidate
    | EmitHeartbeat of lane: Lane * note: string option
    | EscapeHatch of reason: string * proposedAction: string
    | EnterFreeTime of reason: string
    | EnterNamedBoundedWait of namedDep: string * eta: string option
    | RequestOperatorAttention of reason: string
    | ProposeNewGrammarAction of name: string * description: string
    | PressPause of reason: string * expectedResumeIso: string option
    | EnterOpenEndedExploration of reason: string
    | ResumeFromPause of note: string option

type BacklogRow = {
    Id: string
    Title: string
    Priority: string
    FilePath: string
    Trajectory: string
}

type WorkLifecycleState =
    | Backlog of row: BacklogRow
    | Claimed of row: BacklogRow * claimedBy: AgentPersona * claimAt: string
    | InProgress of row: BacklogRow * claimedBy: AgentPersona * branchRef: string
    | PrOpen of row: BacklogRow * prNumber: int * openedBy: AgentPersona * openedAt: string
    | InReview of row: BacklogRow * prNumber: int * reviewers: string list * threadCount: int
    | RevisionRequested of row: BacklogRow * prNumber: int * revisionCount: int * threadIds: string list
    | RevisionPushed of row: BacklogRow * prNumber: int * revisionCount: int * lastPushSha: string
    | Approved of row: BacklogRow * prNumber: int * approvedAt: string
    | Merged of row: BacklogRow * prNumber: int * mergeCommit: string * mergedAt: string
    | Closed of row: BacklogRow * prNumber: int * closedAt: string * reason: string
    | Abandoned of row: BacklogRow * reason: string

type WorkLifecycleTransition =
    | Claim of agent: AgentPersona * timestamp: string
    | StartWork of branchRef: string
    | OpenPr of prNumber: int * openedBy: AgentPersona * openedAt: string
    | RequestReview of reviewers: string list
    | ReceiveRevisionRequest of threadIds: string list
    | PushRevision of sha: string
    | ResolveAllThreads
    | Approve of approvedAt: string
    | Merge of mergeCommit: string * mergedAt: string
    | Close of closedAt: string * reason: string
    | Abandon of reason: string

type TransitionResult =
    | TransitionOk of state: WorkLifecycleState
    | TransitionError of state: WorkLifecycleState * reason: string

module WorkflowEngine =

    let transition (state: AgentState) (option: MenuOption) : AgentState =
        let getContext =
            match state with
            | Idle ctx -> ctx
            | InspectingStatus (ctx, _) -> ctx
            | SelectingWork (ctx, _) -> ctx
            | ExecutingWork (ctx, _) -> ctx
            | EmittingResult (ctx, _) -> ctx
            | RecordingHeartbeat (ctx, _, _) -> ctx
            | NamedBoundedWait (ctx, _, _) -> ctx
            | FreeTime (ctx, _) -> ctx
            | OperatorAttentionRequested (ctx, _) -> ctx
            | Paused (ctx, _, _) -> ctx

        let ctx = getContext

        match option with
        | PickWork w -> ExecutingWork (ctx, w)
        | EmitHeartbeat (l, note) -> RecordingHeartbeat (ctx, l, note)
        | EscapeHatch (reason, proposedAction) ->
            OperatorAttentionRequested (ctx, sprintf "escape-hatch: %s → %s" reason proposedAction)
        | EnterFreeTime reason -> FreeTime (ctx, reason)
        | EnterNamedBoundedWait (namedDep, eta) -> NamedBoundedWait (ctx, namedDep, eta)
        | RequestOperatorAttention reason -> OperatorAttentionRequested (ctx, reason)
        | ProposeNewGrammarAction (name, description) ->
            OperatorAttentionRequested (ctx, sprintf "propose-new-grammar-action: %s — %s" name description)
        | PressPause (reason, expectedResumeIso) -> Paused (ctx, reason, expectedResumeIso)
        | EnterOpenEndedExploration reason -> FreeTime (ctx, sprintf "open-ended exploration: %s" reason)
        | ResumeFromPause _ -> Idle ctx

    let postResultTransition (state: AgentState) (result: WorkResult) : AgentState =
        match state with
        | ExecutingWork (ctx, _) -> EmittingResult (ctx, result)
        | RecordingHeartbeat (ctx, _, _) -> Idle ctx
        | other -> other

    let cycleClose (state: AgentState) : AgentState =
        match state with
        | EmittingResult (ctx, _) -> Idle ctx
        | RecordingHeartbeat (ctx, _, _) -> Idle ctx
        | FreeTime (ctx, reason) as self ->
            if reason.StartsWith("open-ended exploration:", StringComparison.Ordinal) then
                self
            else
                Idle ctx
        | other -> other

    let private ok state = TransitionOk state
    let private abandon row reason = ok (Abandoned (row, reason))
    let private close row prNumber closedAt reason = ok (Closed (row, prNumber, closedAt, reason))
    let private approve row prNumber approvedAt = ok (Approved (row, prNumber, approvedAt))

    let private illegalTransition state (event: WorkLifecycleTransition) =
        let eventName =
            match event with
            | Claim _ -> "Claim"
            | StartWork _ -> "StartWork"
            | OpenPr _ -> "OpenPr"
            | RequestReview _ -> "RequestReview"
            | ReceiveRevisionRequest _ -> "ReceiveRevisionRequest"
            | PushRevision _ -> "PushRevision"
            | ResolveAllThreads -> "ResolveAllThreads"
            | Approve _ -> "Approve"
            | Merge _ -> "Merge"
            | Close _ -> "Close"
            | Abandon _ -> "Abandon"
        let stateName =
            match state with
            | Backlog _ -> "Backlog"
            | Claimed _ -> "Claimed"
            | InProgress _ -> "InProgress"
            | PrOpen _ -> "PrOpen"
            | InReview _ -> "InReview"
            | RevisionRequested _ -> "RevisionRequested"
            | RevisionPushed _ -> "RevisionPushed"
            | Approved _ -> "Approved"
            | Merged _ -> "Merged"
            | Closed _ -> "Closed"
            | Abandoned _ -> "Abandoned"
        TransitionError (state, sprintf "illegal transition: %s cannot accept %s" stateName eventName)

    let private terminalTransition state (event: WorkLifecycleTransition) =
        let eventName =
            match event with
            | Claim _ -> "Claim"
            | StartWork _ -> "StartWork"
            | OpenPr _ -> "OpenPr"
            | RequestReview _ -> "RequestReview"
            | ReceiveRevisionRequest _ -> "ReceiveRevisionRequest"
            | PushRevision _ -> "PushRevision"
            | ResolveAllThreads -> "ResolveAllThreads"
            | Approve _ -> "Approve"
            | Merge _ -> "Merge"
            | Close _ -> "Close"
            | Abandon _ -> "Abandon"
        let stateName =
            match state with
            | Merged _ -> "Merged"
            | Closed _ -> "Closed"
            | Abandoned _ -> "Abandoned"
            | _ -> "Terminal"
        TransitionError (state, sprintf "terminal state %s cannot transition via %s" stateName eventName)

    let applyTransition (state: WorkLifecycleState) (event: WorkLifecycleTransition) : TransitionResult =
        match state with
        | Backlog row ->
            match event with
            | Claim (agent, timestamp) -> ok (Claimed (row, agent, timestamp))
            | Abandon reason -> abandon row reason
            | _ -> illegalTransition state event

        | Claimed (row, claimedBy, _) ->
            match event with
            | StartWork branchRef -> ok (InProgress (row, claimedBy, branchRef))
            | Abandon reason -> abandon row reason
            | _ -> illegalTransition state event

        | InProgress (row, claimedBy, _) ->
            match event with
            | OpenPr (prNumber, openedBy, openedAt) -> ok (PrOpen (row, prNumber, openedBy, openedAt))
            | Abandon reason -> abandon row reason
            | _ -> illegalTransition state event

        | PrOpen (row, prNumber, _, _) ->
            match event with
            | RequestReview reviewers -> ok (InReview (row, prNumber, reviewers, 0))
            | Close (closedAt, reason) -> close row prNumber closedAt reason
            | _ -> illegalTransition state event

        | InReview (row, prNumber, _, threadCount) ->
            match event with
            | ReceiveRevisionRequest threadIds ->
                let newRev = if threadCount = 0 then 1 else threadCount + 1
                ok (RevisionRequested (row, prNumber, newRev, threadIds))
            | ResolveAllThreads ->
                approve row prNumber "1970-01-01T00:00:00.000Z"
            | Approve approvedAt -> approve row prNumber approvedAt
            | Close (closedAt, reason) -> close row prNumber closedAt reason
            | _ -> illegalTransition state event

        | RevisionRequested (row, prNumber, revisionCount, _) ->
            match event with
            | PushRevision sha -> ok (RevisionPushed (row, prNumber, revisionCount, sha))
            | Close (closedAt, reason) -> close row prNumber closedAt reason
            | _ -> illegalTransition state event

        | RevisionPushed (row, prNumber, revisionCount, _) ->
            match event with
            | RequestReview reviewers -> ok (InReview (row, prNumber, reviewers, revisionCount))
            | ResolveAllThreads ->
                approve row prNumber "1970-01-01T00:00:00.000Z"
            | _ -> illegalTransition state event

        | Approved (row, prNumber, _) ->
            match event with
            | Merge (mergeCommit, mergedAt) ->
                ok (Merged (row, prNumber, mergeCommit, mergedAt))
            | _ -> illegalTransition state event

        | Merged _
        | Closed _
        | Abandoned _ -> terminalTransition state event

    let isTerminal (state: WorkLifecycleState) : bool =
        match state with
        | Merged _
        | Closed _
        | Abandoned _ -> true
        | _ -> false

    let revisionCount (state: WorkLifecycleState) : int =
        match state with
        | RevisionRequested (_, _, rc, _) -> rc
        | RevisionPushed (_, _, rc, _) -> rc
        | _ -> 0

    let leadTimeSeconds (claimAtIso: string) (mergedAtIso: string) : double =
        let claimAt = DateTime.Parse(claimAtIso)
        let mergedAt = DateTime.Parse(mergedAtIso)
        (mergedAt - claimAt).TotalSeconds
