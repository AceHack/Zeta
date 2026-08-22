namespace Zeta.Core

open System

module Consensus =

    type NodeId = NodeId of string

    type Vote<'T> =
        { Node: NodeId
          Value: 'T
          Timestamp: DateTimeOffset }

    type ConsensusResult<'T> =
        | Committed of value: 'T * quorum: int * total: int
        | Rejected of reason: string * votes: int * total: int

    let quorumThreshold (nodeCount: int) : int =
        (2 * ((nodeCount - 1) / 3)) + 1

    /// **THIS IS THE SHARED FOLD**, and it must be a function of the evidence MULTISET alone.
    ///
    /// `.claude/rules/local-time-never-enters-the-shared-fold.md` states the litmus as "if two nodes
    /// with different receive-times could fold different SETS, local time has leaked." Receive ORDER
    /// is the same door as a receive-time field: two nodes that saw the same votes in different
    /// orders hold the same evidence set, so they must decide identically.
    ///
    /// **TIE-BREAK = ORDINAL MINIMUM of the values tied at the top count.** It used to be
    /// *first-occurrence* (`List.groupBy` preserves first-occurrence order, `List.sortByDescending`
    /// is stable), which read the arrival order and therefore diverged — at n=6 a 3/3 tie committed
    /// "a" or "b" purely by who arrived first, and through `transitionAt` (which prepends) it
    /// inverted to whoever arrived LAST. Reachable at exactly n ∈ {2, 3, 6}: a tie also reaching
    /// quorum needs floor(n/2) >= quorumThreshold n, and writing n-1 = 3q+r (r ∈ {0,1,2}) that
    /// condition is r >= q+1, so q <= 1. Guarded by `tests/Tests.FSharp/Consensus.TieBreak.Tests.fs`
    /// (permutation-invariance, exhaustive) and pinned by the four-oracle seed
    /// `src/Core.TypeScript/consensus/golden-vectors.json`. Do NOT change it in one oracle.
    ///
    /// Ordinal, never culture-sensitive (`.claude/rules/culture-invariant-by-default.md`): F#
    /// structural comparison on `string` is `String.CompareOrdinal`, verified against a Danish
    /// culture where linguistic collation disagrees. Residual, named not fixed — F#/C#/TS order by
    /// UTF-16 code unit while Rust orders by UTF-8 byte, so the four oracles disagree on a tie whose
    /// values straddle the astral/high-BMP boundary. See the decision doc; no such value exists in
    /// the system today and no vector pins one.
    let decide<'T when 'T: comparison>
        (votes: Vote<'T> list)
        : ConsensusResult<'T> =
        let total = votes.Length
        let threshold = quorumThreshold total
        let groups =
            votes
            |> List.groupBy (fun v -> v.Value)
            |> List.map (fun (value, supporters) -> (value, supporters.Length))
        match groups with
        | [] ->
            Rejected("no votes", 0, 0)
        | _ ->
            let best = groups |> List.map snd |> List.max
            // Order-independent tie-break: the ordinal minimum among the values tied at `best`.
            let value = groups |> List.filter (fun (_, c) -> c = best) |> List.map fst |> List.min
            if best >= threshold then
                Committed(value, best, total)
            else
                Rejected(
                    $"no quorum: best=%d{best} threshold=%d{threshold}",
                    best,
                    total
                )

    let isCommitted (result: ConsensusResult<'T>) : bool =
        match result with
        | Committed _ -> true
        | Rejected _ -> false

    let committedValue (result: ConsensusResult<'T>) : 'T option =
        match result with
        | Committed(v, _, _) -> Some v
        | Rejected _ -> None

    type Phase =
        | Proposed
        | Voting
        | Decided

    type Message<'T> =
        | Propose of proposer: NodeId * value: 'T
        | CastVote of voter: NodeId * value: 'T
        | Finalize

    type RoundState<'T> =
        { Phase: Phase
          Proposal: 'T option
          Proposer: NodeId option
          Votes: Vote<'T> list
          Result: ConsensusResult<'T> option
          Nodes: NodeId list }

    let emptyRound (nodes: NodeId list) : RoundState<'T> =
        { Phase = Proposed
          Proposal = None
          Proposer = None
          Votes = []
          Result = None
          Nodes = nodes }

    type TransitionResult<'T> =
        | Ok of RoundState<'T>
        | InvalidTransition of reason: string

    /// The DST-clean transition: `now` is INJECTED (determinism-lint finding 2026-06-12 — votes
    /// were stamping ambient DateTimeOffset.UtcNow inside Core; replay could never reproduce a
    /// round byte-for-byte). Simulation and golden paths use this; the treaty's byte-locked
    /// decision core (quorumThreshold/decide) never read the clock at all.
    /// `'T: comparison` (not merely `equality`) because `Finalize` folds through `decide`, whose
    /// tie-break is the ordinal minimum of the tied values — it needs an order, not just equality.
    let transitionAt<'T when 'T: comparison>
        (now: DateTimeOffset)
        (state: RoundState<'T>)
        (msg: Message<'T>)
        : TransitionResult<'T> =
        match state.Phase, msg with
        | Proposed, Propose(proposer, value) ->
            if not (List.contains proposer state.Nodes) then
                InvalidTransition $"unknown proposer: %A{proposer}"
            else
                Ok { state with
                        Phase = Voting
                        Proposal = Some value
                        Proposer = Some proposer }
        | Voting, CastVote(voter, value) ->
            if not (List.contains voter state.Nodes) then
                InvalidTransition $"unknown voter: %A{voter}"
            elif state.Votes |> List.exists (fun v -> v.Node = voter) then
                InvalidTransition $"duplicate vote from %A{voter}"
            else
                let vote =
                    { Node = voter
                      Value = value
                      Timestamp = now }
                Ok { state with Votes = vote :: state.Votes }
        | Voting, Finalize ->
            let result = decide state.Votes
            Ok { state with Phase = Decided; Result = Some result }
        | Decided, _ ->
            InvalidTransition "round already decided"
        | Proposed, CastVote _ ->
            InvalidTransition "cannot vote before proposal"
        | Proposed, Finalize ->
            InvalidTransition "cannot finalize before proposal"
        | Voting, Propose _ ->
            InvalidTransition "cannot propose during voting"

    /// The AMBIENT transition (wall-clock edge): convenience for interactive paths; stamps
    /// DateTimeOffset.UtcNow. Non-replayable by construction — DST paths use `transitionAt`.
    let transition<'T when 'T: comparison> (state: RoundState<'T>) (msg: Message<'T>) : TransitionResult<'T> =
        transitionAt DateTimeOffset.UtcNow state msg

    type MergeVerdict =
        | Merge
        | Block of reason: string

    type PrGateState =
        { Number: int
          ChecksPassed: int
          ChecksFailed: int
          ChecksInProgress: int
          UnresolvedThreads: int
          AutoMergeArmed: bool }

    let evaluateGate (pr: PrGateState) : MergeVerdict =
        if pr.ChecksFailed > 0 then
            Block $"PR #%d{pr.Number}: %d{pr.ChecksFailed} failed checks"
        elif pr.ChecksInProgress > 0 then
            Block $"PR #%d{pr.Number}: %d{pr.ChecksInProgress} checks in progress"
        elif pr.UnresolvedThreads > 0 then
            Block $"PR #%d{pr.Number}: %d{pr.UnresolvedThreads} unresolved threads"
        else
            Merge

    /// DST-clean: timestamp injected (see transitionAt).
    let prToVoteAt
        (now: DateTimeOffset)
        (node: NodeId)
        (pr: PrGateState)
        : Vote<MergeVerdict> =
        { Node = node
          Value = evaluateGate pr
          Timestamp = now }

    /// Ambient wall-clock edge (interactive paths only).
    let prToVote
        (node: NodeId)
        (pr: PrGateState)
        : Vote<MergeVerdict> =
        prToVoteAt DateTimeOffset.UtcNow node pr

    let prConsensus
        (nodes: NodeId list)
        (prStates: (NodeId * PrGateState) list)
        : ConsensusResult<MergeVerdict> =
        let votes =
            prStates
            |> List.map (fun (node, pr) -> prToVote node pr)
        decide votes
