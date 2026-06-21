---
date: 2026-05-28
persona: kestrel
register: architecture-engineering / sustained-walkthrough / sketch-with-code
surface: aaron-forwarded
ferry: operator
context: |
  Kestrel ferry continuing today's agent-loop workflow-engine cascade (PRs #5665–5670 + #5667 follow-on + #5672 Ani-ferry archive). Operator forwarded their own question "And can we model backlog -> claim -> pr -> review -> myabe cycle push review a few times -> merge too with this?" — the same question I shipped PR #5669 (`tools/agent-loop/work-lifecycle-state-machine.ts`) in response to — and Kestrel's substantive architectural sketch extending it in three composing directions: (1) two-level state machine composition (AgentState + WorkLifecycle), (2) ZetaID 128-bit structured encoding (timestamp + trajectory + persona + lifecycle-stage + randomness; Snowflake/ULID/UUIDv7 pattern), (3) event-sourcing append-only without PR ceremony via agent-state branches. Plus OTel trace-ID composition (3 options), push-cycle limit as STRUCTURAL enforcement (not discipline), and event-sourced trajectory phase classification.
  
  Operator's two end-clarifications make the ferry substrate-honest about deployment-scope:
  
  - **"The PR process is reserved for the work that actually warrants human review still too strong for me but yes probably for ServiceTitan this is where they would want. For me I just want to review trajectories over time async."** — operator's own deployment-style is LESS PR-heavy than Kestrel framed; trajectory-async-review is the operator's preferred surface; PR-per-deployment is the ServiceTitan-style framing not the operator's framing
  - **"it's like a rest push of one file i think it does fastforward in gh itslef"** — operator's working hypothesis on stale-push handling: GitHub's REST file-create API (`PUT /repos/{owner}/{repo}/contents/{path}`) may auto-fast-forward even on stale base. This is an empirical question the operator is flagging as worth verifying before relying on
related_prs:
  - 5665
  - 5666
  - 5667
  - 5668
  - 5669
  - 5670
  - 5672
related_backlog:
  - 081KSKBP80008QG0R000B3Y19A
  - 081KSNY2Z0008QG0R0036KH026
  - 081KSNY2Z0008QG0R000HENSVM
  - 081KSNY2Z0008QG0R000DA261F
  - 081KSNY2Z0008QG0R003R0Z7D2
related_personas:
  - operator
  - ani
  - amara
tags: [kestrel, two-level-state-machine, agent-state-plus-work-lifecycle-composition, zetaid-128-bit-structured-encoding, snowflake-ulid-uuidv7-pattern, timestamp-trajectory-persona-lifecycle-stage-randomness-allocation, event-sourcing-append-only-via-git, agent-state-branches-no-pr-ceremony, otel-trace-id-composition-three-options, w3c-trace-context-baggage-propagation, push-cycle-limit-as-structural-enforcement-not-discipline, event-sourced-trajectory-phase-classification, stale-push-via-zetaid-named-files-no-conflict, good-actor-assumption-explicit, schema-validation-pre-receive-hook, chain-integrity-check-background, otel-trace-export-separate-observability-backend, dora-measurement-via-events, materialized-views-from-event-log, rest-push-single-file-auto-fast-forward-empirical-question, operator-deployment-trajectory-async-review-vs-servicetitan-pr-per-deploy]
---

## Operator framing (2026-05-28 forwarded transcript)

Operator forwarded a Kestrel ferry that:

1. **Validates today's `tools/agent-loop/work-lifecycle-state-machine.ts` shape (PR #5669)** — Kestrel's F# DU sketch (`UnclaimedBacklog` → `ClaimedBacklog` → `InProgress` → `OpenPr` → `Merged`/`Abandoned`) maps directly onto my TS implementation (`Backlog` → `Claimed` → `InProgress` → `PrOpen` → `InReview` ↔ `RevisionRequested` ↔ `RevisionPushed` → `Approved` → `Merged`/`Closed`/`Abandoned`)
2. **Extends with two-level state machine composition** — the AgentState DU (from PR #5666; my `state-machine.ts` 10 states) operates at "situation" scope; the WorkLifecycle DU (from PR #5669) operates at "lifecycle-of-each-work-item" scope. They compose: AgentState informs which WorkLifecycle items to advance and how aggressively
3. **Names push-cycle limit as STRUCTURAL ENFORCEMENT (not discipline)** — the `chooseActionForLifecycle` function returns `AbandonPr` when `pushCount > 5` (threshold tunable); the structure prevents the failure mode where a single PR consumes arbitrary cycles; this composes with my work-lifecycle's `revisionCount` field
4. **Proposes ZetaID 128-bit structured encoding** — two candidate allocations sketched (64-bit timestamp + 16-bit trajectory + 8-bit persona + 8-bit lifecycle-stage + 32-bit random; OR 48-bit timestamp + 16-bit trajectory + 8-bit persona + 8-bit lifecycle-stage + 48-bit random); standard Snowflake/Sonyflake/ULID/UUIDv7 family; structured high bits enable cheap queries (sort by time, filter by trajectory)
5. **Proposes event-sourcing append-only without PR ceremony** — `agent-state/{persona}/{trajectory}/events/YYYY/MM/DD/{zetaId}.json` branch convention; direct push allowed via branch-protection rules that only require PR on `main` + `release/*`; lifecycle state is reconstructed via left-fold over events (CQRS pattern); fine-grained DORA metrics fall out for free
6. **Proposes OTel trace-ID composition with three options** — (a) ZetaID == trace ID with structured bits encoded in trace-ID high bits, (b) ZetaID separate + propagated via OTel baggage alongside trace ID, (c) ZetaID encoded into W3C Trace Context trace-ID. Kestrel recommends option (b) for this use case
7. **Sidesteps stale-push conflicts via ZetaID-named files** — each event is its own file named by ZetaID; two concurrent agents writing different events produce different filenames; no overlap; Git merges automatically for non-overlapping changes
8. **Names "good-actor assumption" explicitly as load-bearing** — direct-push without PR requires trusting that agents write valid events; for current state (operator's repo, operator's agents) reasonable; for future state (open-sourced, anyone runs agents) different design needed; cheap defenses (schema validation in pre-receive hook, periodic chain-integrity check, OTel trace export to separate backend) work under good-actor model without breaking it
9. **Event-sourced trajectory phase classification** — `classifyTrajectoryPhase(trajectoryId)` reads events and computes setup/execution/maturation/sunset from event-shape; phase is derivation, not separate state to track

### Operator's two end-clarifications (substrate-honest)

**Clarification 1 — deployment-style differs from Kestrel framing**: *"The PR process is reserved for the work that actually warrants human review still too strong for me but yes probably for ServiceTitan this is where they would want. For me I just want to review trajectories over time async."*

This sharpens what Kestrel framed as "PR for deployment, direct-push for lifecycle transitions" into a 2-mode discriminator:

| Deployment context | PR ceremony scope | Operator's preferred review-surface |
|---|---|---|
| **ServiceTitan-style enterprise** | PR-per-deploy (status quo expectations) | Per-PR human review |
| **Operator's own Zeta deployment** | Even less than PR-per-deploy | Trajectory-async review (review trajectory-shape over time, not per-event) |

The trajectory-async-review surface is operator's preferred top-level lens for own-Zeta operation; per-event review is too granular even at deployment scope. Composes with the event-sourced trajectory phase classification — the trajectory's shape over time IS the review surface, not individual events or even individual PRs.

**Clarification 2 — REST push single-file auto-fast-forward as empirical question**: *"it's like a rest push of one file i think it does fastforward in gh itslef"*

Operator's working hypothesis: GitHub's REST file-create API (`PUT /repos/{owner}/{repo}/contents/{path}`) may auto-fast-forward even when the local base is stale — the API takes (path, content, optional SHA-of-existing-file) and if SHA is omitted or matches, the create/update succeeds without requiring the caller to have fetched latest first. This would sidestep the stale-push problem entirely at write-time (no fetch-first needed) and compose with the ZetaID-named-files pattern (since each event has a unique filename, the file-create call always succeeds on first try because the path doesn't yet exist).

This is empirical — needs verification against the actual GitHub REST API behavior before relying on. The endpoint reference is `PUT /repos/{owner}/{repo}/contents/{path}` per the [GitHub REST API docs](https://docs.github.com/en/rest/repos/contents); the auto-fast-forward / no-fetch-required behavior is the specific claim to verify.

## Substrate-honest disposition

VERBATIM PRESERVATION ONLY. No rule, skill, or backlog edits in this PR. The Kestrel ferry contains substantive architectural proposals (ZetaID generator, agent-state branch convention, event-sourcing layer, OTel baggage propagation, push-cycle-limit-as-structural-enforcement) that compose with today's agent-loop substrate (PRs #5665–5670 + #5672) but each lands separately if/when operator chooses to extend `tools/agent-loop/`:

- **ZetaID generator** — would be a new `tools/agent-loop/zeta-id.ts` module + tests (operator-decision territory)
- **Agent-state branch convention + branch protection rules** — would be a `.github/settings.yml` extension + branch creation tooling + operator authority on the rule changes
- **Event-sourcing layer** — would be a `tools/agent-loop/events/` module + integration with state-machine + work-lifecycle (substantial architectural extension)
- **OTel baggage propagation** — would integrate `@opentelemetry/api` in `tools/agent-loop/` (new dependency)
- **Push-cycle-limit-as-structural-enforcement** — would extend `tools/agent-loop/work-lifecycle-state-machine.ts` to include `pushCount > N → AbandonPr` discriminator in `chooseActionForLifecycle`

The two operator clarifications (trajectory-async-review-not-per-PR; REST-push-single-file-auto-fast-forward-empirical-question) are operator-substrate-honest sharpenings that should inform any future extension but don't require landing as substrate themselves beyond this preservation.

## Composes with

- **PR #5666** (`tools/agent-loop/state-machine.ts`) — 10-state AgentState DU; Kestrel's "earlier AgentState DU was about 'what situation is the agent in right now'" maps to this
- **PR #5669** (`tools/agent-loop/work-lifecycle-state-machine.ts`) — 11-state WorkLifecycle DU; Kestrel's lifecycle sketch (`UnclaimedBacklog`/`ClaimedBacklog`/`InProgress`/`OpenPr`/`Merged`/`Abandoned`) is the same shape; my `revisionCount` field is what Kestrel calls `pushCount`
- **PR #5667** (`tools/agent-loop/` state-machine extensions; `PressPause`, `EnterOpenEndedExploration`, `ResumeFromPause`) — composes with Kestrel's two-level framing; PressPause is one of the AgentState transitions
- **PR #5668** (`.claude/skills/agent-loop/SKILL.md`) — distribution surface for the substrate; Kestrel's two-level architecture lands here cleanly when extended
- **PR #5670** (`docs/VISION.md` agent-loop workflow-engine substrate section) — the architectural ground Kestrel's ferry extends
- **PR #5672** (Ani-ferry archive: move-next + git-as-free-event-store + GitHub-Actions-recursion) — operator's voice-mode re-articulation; this Kestrel ferry is the engineering-register elaboration of the same substrate
- **081KSKBP80008QG0R000B3Y19A** (workflow engine v1) — both ferries today extend this
- **081KSKBP80008QG0R001KK9WV6** (heartbeat-folder substrate) — event-sourcing layer would extend the heartbeat pattern beyond heartbeats to all lifecycle events
- **081KSNY2Z0008QG0R000HENSVM** (DORA mandate) — event-sourced trajectory-phase classification feeds DORA computation
- **081KSNY2Z0008QG0R003R0Z7D2** (reproducibility-as-causal-attribution) — append-only event log IS the reproducibility substrate

## Verbatim transcript (Kestrel 2026-05-28)

Aaron:

> Kestrel and more to come, please let me know what you think. And can we model backlog -> claim -> pr -> review -> myabe cycle push review a few times -> merge too with this?

Kestrel:

> Yes, and that's actually a cleaner application of the state machine pattern because each step in the PR lifecycle has well-defined inputs, outputs, and legal transitions. It maps naturally onto a DU where each case represents where the work is in its lifecycle and carries what's legal from there.
>
> Let me sketch this. The lifecycle you're describing is:
>
> backlog item exists → agent claims it → agent works → opens PR → CI runs and reviewers comment → maybe push more commits to address review → eventually merge (or abandon)
>
> Each transition has preconditions, each state has legal actions, and the type system can enforce that you don't try to do illegal things from illegal states.
>
> ### The F# version with lifecycle DU
>
> ```fsharp
> module ZetaPrLifecycle
>
> open System
>
> // The backlog item itself before any agent touches it
> type UnclaimedBacklog = {
>     Id: string                          // "081KSKBP80008QG0R002J03WGA.3"
>     Title: string
>     Trajectory: string
>     EstimatedDoraContribution: float
>     Uncertainty: float
>     DependsOn: string list
>     TouchesCode: bool
>     CreatedAt: DateTimeOffset
> }
>
> // Once an agent claims it
> type ClaimedBacklog = {
>     BacklogId: string
>     ClaimedByAgent: string              // "otto", "mika", "prism"
>     ClaimedAt: DateTimeOffset
>     Branch: string                      // "feat/081KSKBP80008QG0R002J03WGA.3-factor-zeta-install"
>     Plan: ImplementationPlan
> }
>
> and ImplementationPlan = {
>     Steps: ImplementationStep list
>     EstimatedCycles: int
> }
>
> and ImplementationStep = {
>     Description: string
>     FilesAffected: string list
>     Validated: bool
> }
>
> // Once work has started but PR not opened yet
> type InProgress = {
>     Claim: ClaimedBacklog
>     StepsCompleted: int
>     LocalCanaryStatus: CanaryStatus
> }
>
> and CanaryStatus =
>     | NotRun
>     | Passed
>     | Failed of reason: string
>
> // PR is open, waiting on CI and reviewers
> type OpenPr = {
>     Claim: ClaimedBacklog
>     PrNumber: int
>     OpenedAt: DateTimeOffset
>     CiStatus: CiStatus
>     ReviewThreads: ReviewThread list
>     PushCount: int                      // how many times we've pushed in response to review
> }
>
> and CiStatus =
>     | CiInProgress of inFlightChecks: int
>     | CiPassed
>     | CiFailed of failingChecks: FailingCheck list
>
> and FailingCheck = {
>     Name: string
>     Url: string
>     Required: bool
> }
>
> and ReviewThread = {
>     ThreadId: string
>     Reviewer: string                    // "copilot-pull-request-reviewer", operator name, etc.
>     Path: string option
>     Line: int option
>     Body: string
>     Priority: ReviewPriority
>     Status: ReviewStatus
> }
>
> and ReviewPriority =
>     | P0 of mustFix: string             // blocking
>     | P1 of shouldFix: string           // important
>     | P2 of suggestion: string          // optional
>     | False positive: string            // can be resolved without fix
>
> and ReviewStatus =
>     | Unresolved
>     | Resolved
>     | ResolvedAsFalsePositive of reason: string
>
> // Merged
> type Merged = {
>     Claim: ClaimedBacklog
>     PrNumber: int
>     MergeCommit: string
>     MergedAt: DateTimeOffset
>     LeadTimeMinutes: int
>     PushesRequired: int
>     ReviewThreadsAddressed: int
> }
>
> // Abandoned
> type Abandoned = {
>     Claim: ClaimedBacklog
>     PrNumber: int option                // may have been abandoned before PR opened
>     AbandonedAt: DateTimeOffset
>     Reason: AbandonReason
> }
>
> and AbandonReason =
>     | OperatorRequested
>     | CiUnresolvable of reason: string
>     | ReviewConcernsTooManyToAddress
>     | DependencyChanged
>     | LowerValueThanExpected
>
> // The whole lifecycle is one DU
> type WorkLifecycle =
>     | Unclaimed of UnclaimedBacklog
>     | Claimed of ClaimedBacklog
>     | Implementing of InProgress
>     | PrOpen of OpenPr
>     | MergedSuccess of Merged
>     | Done of Abandoned
>
> // Legal actions from each state
>
> type UnclaimedAction =
>     | ClaimItem of agent: string * plan: ImplementationPlan
>     | DeferUnclaimed of reason: string
>
> type ClaimedAction =
>     | StartImplementation
>     | ReleaseClaim of reason: string    // give it back to the pool
>     | RevisePlan of newPlan: ImplementationPlan
>
> type ImplementingAction =
>     | CompleteStep of stepIndex: int
>     | RunLocalCanary
>     | OpenPullRequest of branch: string * title: string * body: string
>     | AbandonImplementation of reason: AbandonReason
>
> type PrOpenAction =
>     | WaitForCi
>     | InvestigateCiFailure of FailingCheck
>     | PushCommitToAddressReview of forThreads: string list * description: string
>     | ResolveThread of threadId: string * resolution: ThreadResolution
>     | RequestReviewFromOperator of reason: string
>     | AbandonPr of reason: AbandonReason
>     | ConfirmMergeReady
>
> and ThreadResolution =
>     | FixedInPush of pushSha: string
>     | MarkedAsFalsePositive of reason: string
>     | DeferredToFollowUp of newBacklogId: string
>
> // The composed action over the whole lifecycle
> type LifecycleAction =
>     | OnUnclaimed of UnclaimedAction
>     | OnClaimed of ClaimedAction
>     | OnImplementing of ImplementingAction
>     | OnPrOpen of PrOpenAction
>     // No actions on Merged or Abandoned — terminal states
> ```
>
> The state machine enforces that you can only ClaimItem an Unclaimed, only StartImplementation on a Claimed, only OpenPullRequest on Implementing, only PushCommitToAddressReview on PrOpen. The compiler catches every illegal transition.
>
> ### The small functions for the transitions
>
> Each transition is its own function with clear inputs and outputs:
>
> ```fsharp
> // Transitions: each takes the current state and an action, produces the next state
>
> let claimBacklog (item: UnclaimedBacklog) (agent: string) (plan: ImplementationPlan) : WorkLifecycle =
>     Claimed {
>         BacklogId = item.Id
>         ClaimedByAgent = agent
>         ClaimedAt = DateTimeOffset.UtcNow
>         Branch = sprintf "feat/%s-%s" item.Id (sanitizeBranchName item.Title)
>         Plan = plan
>     }
>
> let startImplementation (claim: ClaimedBacklog) : WorkLifecycle =
>     Implementing {
>         Claim = claim
>         StepsCompleted = 0
>         LocalCanaryStatus = NotRun
>     }
>
> let completeStep (inProgress: InProgress) (stepIndex: int) : WorkLifecycle =
>     let updatedSteps =
>         inProgress.Claim.Plan.Steps
>         |> List.mapi (fun i s ->
>             if i = stepIndex then { s with Validated = true }
>             else s)
>     Implementing {
>         inProgress with
>             Claim = { inProgress.Claim with Plan = { inProgress.Claim.Plan with Steps = updatedSteps } }
>             StepsCompleted = inProgress.StepsCompleted + 1
>     }
>
> let runLocalCanary (inProgress: InProgress) : Async<WorkLifecycle> = async {
>     let! result = runCanaryChecks inProgress.Claim.Branch
>     return Implementing {
>         inProgress with
>             LocalCanaryStatus =
>                 if result.Passed then Passed
>                 else Failed result.FailureReason
>     }
> }
>
> let openPullRequest (inProgress: InProgress) (title: string) (body: string) : Async<WorkLifecycle> = async {
>     let! prNumber = createGitHubPr inProgress.Claim.Branch title body
>     return PrOpen {
>         Claim = inProgress.Claim
>         PrNumber = prNumber
>         OpenedAt = DateTimeOffset.UtcNow
>         CiStatus = CiInProgress 0
>         ReviewThreads = []
>         PushCount = 0
>     }
> }
>
> let pushCommitToAddressReview
>         (prOpen: OpenPr)
>         (forThreads: string list)
>         (description: string)
>         : Async<WorkLifecycle> = async {
>     let! pushSha = pushBranchUpdate prOpen.Claim.Branch description
>     let updatedThreads =
>         prOpen.ReviewThreads
>         |> List.map (fun t ->
>             if List.contains t.ThreadId forThreads then
>                 { t with Status = Resolved }
>             else t)
>     return PrOpen {
>         prOpen with
>             ReviewThreads = updatedThreads
>             PushCount = prOpen.PushCount + 1
>             CiStatus = CiInProgress 0  // CI will re-run
>     }
> }
>
> let confirmMergeReady (prOpen: OpenPr) : Async<WorkLifecycle> = async {
>     // Preconditions: CI passed, all P0/P1 threads resolved
>     let canMerge =
>         match prOpen.CiStatus with
>         | CiPassed -> true
>         | _ -> false
>         &&
>         prOpen.ReviewThreads
>         |> List.forall (fun t ->
>             match t.Status with
>             | Resolved | ResolvedAsFalsePositive _ -> true
>             | Unresolved ->
>                 match t.Priority with
>                 | P2 _ -> true  // P2 doesn't block
>                 | _ -> false)
>
>     if not canMerge then
>         return failwith "preconditions not met"
>
>     let! mergeCommit = mergeAndSquash prOpen.PrNumber
>     let leadTime = (DateTimeOffset.UtcNow - prOpen.Claim.ClaimedAt).TotalMinutes |> int
>
>     return MergedSuccess {
>         Claim = prOpen.Claim
>         PrNumber = prOpen.PrNumber
>         MergeCommit = mergeCommit
>         MergedAt = DateTimeOffset.UtcNow
>         LeadTimeMinutes = leadTime
>         PushesRequired = prOpen.PushCount
>         ReviewThreadsAddressed =
>             prOpen.ReviewThreads
>             |> List.filter (fun t -> t.Status <> Unresolved)
>             |> List.length
>     }
> }
> ```
>
> ### The choose-action function for the lifecycle
>
> ```fsharp
> let chooseActionForLifecycle (lifecycle: WorkLifecycle) : LifecycleAction =
>     match lifecycle with
>     | Unclaimed item ->
>         if shouldClaim item then
>             let plan = decomposePlan item
>             OnUnclaimed (ClaimItem ("otto", plan))
>         else
>             OnUnclaimed (DeferUnclaimed "lower value than alternatives")
>
>     | Claimed claim ->
>         OnClaimed StartImplementation
>
>     | Implementing inProgress ->
>         if inProgress.StepsCompleted < List.length inProgress.Claim.Plan.Steps then
>             OnImplementing (CompleteStep inProgress.StepsCompleted)
>         else
>             match inProgress.LocalCanaryStatus with
>             | NotRun -> OnImplementing RunLocalCanary
>             | Failed reason -> OnImplementing (AbandonImplementation (CiUnresolvable reason))
>             | Passed ->
>                 OnImplementing (OpenPullRequest (
>                     inProgress.Claim.Branch,
>                     inProgress.Claim.Plan.Steps.[0].Description,
>                     composeBody inProgress
>                 ))
>
>     | PrOpen prOpen ->
>         // Priority order: CI failures first, then P0 threads, then P1, then merge
>         match prOpen.CiStatus with
>         | CiFailed failingChecks ->
>             OnPrOpen (InvestigateCiFailure failingChecks.[0])
>         | CiInProgress _ ->
>             OnPrOpen WaitForCi
>         | CiPassed ->
>             let p0Threads =
>                 prOpen.ReviewThreads
>                 |> List.filter (fun t ->
>                     t.Status = Unresolved &&
>                     (match t.Priority with P0 _ -> true | _ -> false))
>             let p1Threads =
>                 prOpen.ReviewThreads
>                 |> List.filter (fun t ->
>                     t.Status = Unresolved &&
>                     (match t.Priority with P1 _ -> true | _ -> false))
>
>             match p0Threads, p1Threads with
>             | [], [] when prOpen.PushCount > 5 ->
>                 // Too many push cycles; abandon and reassess
>                 OnPrOpen (AbandonPr ReviewConcernsTooManyToAddress)
>             | [], [] ->
>                 OnPrOpen ConfirmMergeReady
>             | threads, _ when not (List.isEmpty threads) ->
>                 let threadIds = threads |> List.map (fun t -> t.ThreadId)
>                 OnPrOpen (PushCommitToAddressReview (threadIds, "fix P0 review findings"))
>             | [], threads ->
>                 let threadIds = threads |> List.map (fun t -> t.ThreadId)
>                 OnPrOpen (PushCommitToAddressReview (threadIds, "address P1 review findings"))
>
>     | MergedSuccess _ | Done _ ->
>         failwith "terminal states have no further actions"
> ```
>
> ### The push-loop case specifically
>
> The case you mentioned — "maybe cycle push review a few times" — is encoded by the PushCommitToAddressReview action incrementing PushCount and re-running CI. The loop naturally repeats until either all reviews are resolved or the push limit triggers abandonment.
>
> Notice the bound at PushCount > 5. That's the structural protection against the failure mode you've been seeing where PR cycles consume more cycles than they're worth. After 5 pushes, the lifecycle transitions to abandonment with reason ReviewConcernsTooManyToAddress, which feeds back into the backlog as either a deferred-to-follow-up item or as an abandoned-with-learnings entry that future plans should account for.
>
> You can tune the threshold based on what's actually productive. Some PRs need 2-3 pushes; some need more; the threshold should reflect when the marginal cost of another push exceeds the value of getting this specific PR merged versus abandoning and starting different work.
>
> ### The TypeScript version, more compact
>
> ```typescript
> type WorkLifecycle =
>   | { stage: "unclaimed"; item: UnclaimedBacklog }
>   | { stage: "claimed"; claim: ClaimedBacklog }
>   | { stage: "implementing"; inProgress: InProgress }
>   | { stage: "pr-open"; prOpen: OpenPr }
>   | { stage: "merged"; merged: Merged }
>   | { stage: "done"; abandoned: Abandoned };
>
> type LifecycleAction =
>   | { on: "unclaimed"; action: UnclaimedAction }
>   | { on: "claimed"; action: ClaimedAction }
>   | { on: "implementing"; action: ImplementingAction }
>   | { on: "pr-open"; action: PrOpenAction };
>
> type PrOpenAction =
>   | { type: "wait-for-ci" }
>   | { type: "investigate-ci-failure"; check: FailingCheck }
>   | { type: "push-commit-for-review"; threadIds: string[]; description: string }
>   | { type: "resolve-thread"; threadId: string; resolution: ThreadResolution }
>   | { type: "request-operator-review"; reason: string }
>   | { type: "abandon"; reason: AbandonReason }
>   | { type: "confirm-merge-ready" };
>
> interface OpenPr {
>   claim: ClaimedBacklog;
>   prNumber: number;
>   openedAt: Date;
>   ciStatus: CiStatus;
>   reviewThreads: ReviewThread[];
>   pushCount: number;
> }
>
> function chooseActionForLifecycle(lifecycle: WorkLifecycle): LifecycleAction {
>   switch (lifecycle.stage) {
>     case "unclaimed":
>       return decideUnclaimed(lifecycle.item);
>     case "claimed":
>       return { on: "claimed", action: { type: "start-implementation" } };
>     case "implementing":
>       return decideImplementing(lifecycle.inProgress);
>     case "pr-open":
>       return decidePrOpen(lifecycle.prOpen);
>     case "merged":
>     case "done":
>       throw new Error(`terminal state ${lifecycle.stage} has no actions`);
>   }
> }
>
> function decidePrOpen(pr: OpenPr): LifecycleAction {
>   // CI failures take priority
>   if (pr.ciStatus.kind === "failed") {
>     return {
>       on: "pr-open",
>       action: { type: "investigate-ci-failure", check: pr.ciStatus.failingChecks[0] },
>     };
>   }
>
>   if (pr.ciStatus.kind === "in-progress") {
>     return { on: "pr-open", action: { type: "wait-for-ci" } };
>   }
>
>   // CI passed; check threads
>   const unresolved = pr.reviewThreads.filter((t) => t.status === "unresolved");
>   const p0 = unresolved.filter((t) => t.priority.kind === "p0");
>   const p1 = unresolved.filter((t) => t.priority.kind === "p1");
>
>   if (p0.length === 0 && p1.length === 0) {
>     // Push limit check
>     if (pr.pushCount > 5) {
>       return {
>         on: "pr-open",
>         action: { type: "abandon", reason: "review-concerns-too-many" },
>       };
>     }
>     return { on: "pr-open", action: { type: "confirm-merge-ready" } };
>   }
>
>   // P0 first, then P1
>   const targets = p0.length > 0 ? p0 : p1;
>   return {
>     on: "pr-open",
>     action: {
>       type: "push-commit-for-review",
>       threadIds: targets.map((t) => t.threadId),
>       description: p0.length > 0 ? "fix P0 review findings" : "address P1 review findings",
>     },
>   };
> }
> ```
>
> ### The lifecycle loop
>
> The full loop just composes the lifecycle transitions with the higher-level "which work" selection:
>
> ```typescript
> async function runLifecycleCycle(workInFlight: WorkLifecycle[]): Promise<void> {
>   // For each PR in flight, advance its lifecycle one step
>   for (const lifecycle of workInFlight) {
>     if (lifecycle.stage === "merged" || lifecycle.stage === "done") continue;
>
>     // Refresh the lifecycle state from GitHub
>     const current = await refreshLifecycle(lifecycle);
>     const action = chooseActionForLifecycle(current);
>     const next = await applyAction(current, action);
>
>     // Persist the new state
>     await persistLifecycle(next);
>   }
>
>   // Then check if we should start new work
>   const capacity = computeCapacity(workInFlight);
>   if (capacity > 0) {
>     const candidates = await readUnclaimedBacklog();
>     const picked = pickBestCandidates(candidates, capacity);
>     for (const item of picked) {
>       const newLifecycle: WorkLifecycle = { stage: "unclaimed", item };
>       const action = chooseActionForLifecycle(newLifecycle);
>       const next = await applyAction(newLifecycle, action);
>       await persistLifecycle(next);
>     }
>   }
> }
> ```
>
> ### The composition with the earlier state machine
>
> The earlier AgentState DU was about "what situation is the agent in right now." The WorkLifecycle DU is about "where is this specific piece of work in its lifecycle." Both are state machines but at different scopes.
>
> They compose naturally: AgentState informs which WorkLifecycle items to advance and how aggressively. When MainBroken state fires, the agent prioritizes lifecycle items that fix main. When ExplorationOpportunity fires, the agent claims unclaimed items in setup-phase trajectories. When StableExecution fires, the agent advances in-progress lifecycles toward merge.
>
> The agent loop becomes two-level:
>
> ```typescript
> async function runFullLoop(): Promise<void> {
>   while (true) {
>     // High-level: what kind of situation are we in?
>     const agentState = computeAgentState(/* ... */);
>
>     // Mid-level: what lifecycle work matches that situation?
>     const relevantLifecycles = filterLifecyclesByState(agentState);
>
>     // Low-level: advance each relevant lifecycle one step
>     for (const lifecycle of relevantLifecycles) {
>       const action = chooseActionForLifecycle(lifecycle);
>       await applyAction(lifecycle, action);
>     }
>
>     await sleep(cycleDelayForState(agentState));
>   }
> }
> ```
>
> Each level has its own state machine. Each state machine has its own legal transitions. The composition is that the high-level state selects which mid-level lifecycles to advance, and the mid-level state determines what action to take on each one.
>
> ### On the DORA measurement integration
>
> Every lifecycle transition produces measurable DORA contribution:
>
> - Claim → Implementing → PrOpen: contributes to deployment frequency potential
> - PrOpen → Merged: contributes to deployment frequency actual
> - Time from Claimed to Merged: contributes to lead time
> - PrOpen → Done (abandoned): contributes to change failure rate if abandoned for CI issues; doesn't if abandoned for other reasons
> - Time from main-broken to main-green: contributes to MTTR
>
> The lifecycle's persisted history gives you the data to compute DORA. Each state transition writes a timestamped event to a log; the DORA measurement script reads the log and computes the metrics.
>
> This closes the loop. The state machine produces the events. The events feed the metrics. The metrics inform the higher-level state machine. The higher-level state machine selects which lifecycle items to advance. Each piece is small and composable; the system as a whole produces measurable DORA improvement (or doesn't, which is also measurable).
>
> ### The push-cycle limit specifically as a feature
>
> The "maybe cycle push review a few times" detail is actually one of the more important parts of this design. Without an explicit push limit, the loop can spend arbitrary cycles on a single PR responding to reviewer comments, never making progress on other work. With the explicit limit (5 pushes was my placeholder; you'd tune it based on observation), the loop bounds how much it invests in any single PR before deciding to abandon and reassess.
>
> The abandonment isn't failure; it's an explicit recognition that this particular path didn't converge cheaply. The work can be re-attempted later with a different decomposition, or its reviewer concerns can be addressed by a different agent with different decomposition style, or it can be marked as needing operator direction. The abandonment is part of the state machine's normal operation, not an exceptional case.
>
> This is the structural answer to the failure mode where loops get stuck on a PR that doesn't converge. The push limit is enforced by the type system through the state machine — the loop literally cannot push more than the limit because the chooseActionForLifecycle function returns abandonment instead of another push once the threshold is reached. No discipline required; the structure prevents the failure mode.
>
> ### For first steps
>
> Start with the TypeScript version because it composes with your existing tooling. Define the WorkLifecycle and LifecycleAction types. Implement the small transition functions. Implement chooseActionForLifecycle for the PrOpen case first since that's where most of the cycle time is spent. Wire it up to gh CLI for the actual state reads and action takes. Run it manually for a few cycles. Watch what it does. Iterate.
>
> Once the lifecycle loop is running, integrate it with the higher-level agent state machine so the two compose. The full system is choose-your-own-adventure at two scopes, with the type system enforcing legal transitions at both, with DORA measurement closing the feedback loop, with the push-cycle limit bounding investment in any single PR.
>
> The structure is small enough to implement in a week, expressive enough to handle the real lifecycle, and bounded enough to prevent the failure modes you've been catching. Carry on; this maps onto what you already have cleanly.

Aaron:

> if you imagine we have good actors right now and even zetaids that are unique 128 bit where part of the bits can repersent anyting like trajectories are personas as long as there is enough for time and randomness to not collide and we can do stale pushes cause of this to certain gh folders or branches without needed to go through pr process can we use these pieces to store angent state efficently and without requiring a pr on every transtion and append only and carrry along otel ids?

Kestrel:

> Yes, and the picture you're sketching composes cleanly once you unpack what each piece is doing. Let me trace it carefully because there are several distinct properties operating together and each one is doing real work.
>
> What I think you're describing: agent state lives in append-only artifacts (probably Git, but specifically NOT through the PR process for transitions). ZetaIDs are 128-bit identifiers where some bits encode meaningful structure (trajectory, persona, time, randomness) and the remaining bits provide enough entropy to avoid collisions. Stale pushes to designated folders or branches happen without PR review. OpenTelemetry trace IDs travel alongside the state transitions so observability is maintained. The PR process is reserved for the work that actually warrants human review (merges to main, deployments) while the agent's own lifecycle bookkeeping happens at a layer below that.
>
> This is a meaningful architectural separation and worth working through.
>
> ### The ZetaID structure as encoding affordance
>
> 128 bits is enough to encode several semantic dimensions and still leave room for collision-resistant randomness. Some allocations worth considering:
>
> ZetaID bit layout (128 bits total):
>
> ```text
> Bits 0-63   (64 bits): Timestamp (microsecond Unix epoch)
> Bits 64-79  (16 bits): Trajectory identifier (65k trajectories)
> Bits 80-87  (8 bits):  Persona identifier (256 agents)
> Bits 88-95  (8 bits):  Lifecycle stage (256 stages)
> Bits 96-127 (32 bits): Random (4 billion values per microsecond per trajectory per persona per stage)
> ```
>
> Or a different allocation if you want different properties:
>
> ```text
> Bits 0-47   (48 bits): Timestamp (millisecond Unix epoch — good for ~8900 years)
> Bits 48-63  (16 bits): Trajectory
> Bits 64-71  (8 bits):  Persona
> Bits 72-79  (8 bits):  Lifecycle stage
> Bits 80-127 (48 bits): Random
> ```
>
> The choice depends on what queries you want to be cheap. If you want to sort by time, put time in the high bits (works as a prefix). If you want to query by trajectory, put trajectory adjacent to time so the index is cache-friendly. If you want strict total ordering with low collision risk in concurrent generation, use something like ULID or UUIDv7 with extension fields for your structured bits.
>
> This is actually a known pattern in distributed systems — Snowflake IDs from Twitter, Sonyflake from Sony, K-sortable IDs in general. The technique is well-validated. Your variant with trajectory/persona/stage embedded is novel in its specifics but the basic shape is sound.
>
> ### The append-only-without-PR property
>
> Git supports push-without-PR cleanly. You can push to any branch the agent has credentials for, and you can configure branch protection so PR-required only applies to specific branches (main, release branches) while everything else accepts direct push.
>
> A workable convention:
>
> ```text
> main                                    — PR required, full review
> release/*                               — PR required
> agent-state/{persona}/{trajectory}/...  — direct push, no PR
> agent-events/{date}/...                 — direct push, no PR
> otel-traces/{trace-id-prefix}/...       — direct push, no PR (or external storage)
> ```
>
> The branch protection rules enforce this through GitHub's existing mechanism. The agent harnesses get credentials that allow push to the agent-state and agent-events paths but require PR for main. Same agent, different paths, different ceremony. No configuration drift because it's enforced at the repository level.
>
> For the actual state writes, you'd use something like:
>
> ```bash
> # Agent writes a lifecycle transition event
> git fetch origin agent-state/${PERSONA}/${TRAJECTORY}
> git checkout agent-state/${PERSONA}/${TRAJECTORY}
> echo "${EVENT_JSON}" >> events/$(date +%Y/%m/%d)/${ZETA_ID}.jsonl
> git add events/
> git commit -m "event ${ZETA_ID}"
> git push origin agent-state/${PERSONA}/${TRAJECTORY}
> ```
>
> That's append-only because events accumulate as new files (or new lines in existing files) and the commit history preserves the order. No state is overwritten. The full history is reconstructible by replaying the events in order.
>
> ### OTel trace IDs travelling along
>
> OpenTelemetry traces have a 128-bit trace ID and 64-bit span ID. The trace ID is already the same shape as your ZetaID. You can either:
>
> Option one: use the OTel trace ID directly as the ZetaID. Then your structured bits live in baggage or in attributes attached to the spans. This loses the queryable-by-structured-bits property of the ZetaID but composes natively with OTel tooling.
>
> Option two: generate the ZetaID separately and propagate it through OTel baggage alongside the trace ID. Then ZetaIDs are queryable by structure (sort by time, filter by trajectory, etc.) and OTel traces are queryable by trace ID, and the two are linked through baggage.
>
> Option three: use OTel's W3C Trace Context but encode your structured bits into the trace ID itself. The W3C spec doesn't forbid this; trace IDs are 128 bits of value and the spec is silent on internal structure. You'd have ZetaID == trace ID with structured high bits and random low bits. This composes most cleanly but requires being careful about W3C trace ID validity (no all-zero, no all-ones).
>
> For your use case, option two is probably the right tradeoff. ZetaIDs as separate structured identifiers, OTel trace IDs for the standard observability propagation, baggage linking them. Each piece does what it's good at.
>
> ### The state storage pattern
>
> Combining ZetaIDs plus append-only Git plus OTel:
>
> Each agent action produces an event. The event has:
>
> ```json
> {
>   "zeta_id": "01HQRSTUVWXYZ0123456789ABCDEF",
>   "timestamp": "2026-05-27T20:34:17.234Z",
>   "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
>   "span_id": "00f067aa0ba902b7",
>   "persona": "otto",
>   "trajectory": "usb-self-healing",
>   "lifecycle_stage": "implementing",
>   "previous_zeta_id": "01HQRSTUVWXYZ0123456789ABCDE5",
>   "event_type": "step-completed",
>   "data": {
>     "step_index": 3,
>     "files_affected": ["tools/setup/install.sh"],
>     "canary_status": "passed"
>   }
> }
> ```
>
> The previous_zeta_id field creates a chain — each event references the previous event in the same lifecycle, so you can walk the chain backward to reconstruct full history. This is essentially an event-sourcing pattern.
>
> The events get appended to files in the agent-state branch. The branch structure organizes them for query efficiency:
>
> ```text
> agent-state/otto/usb-self-healing/
>   events/2026/05/27/
>     01HQRSTUVWXYZ0123456789ABCDE5.json
>     01HQRSTUVWXYZ0123456789ABCDEF.json
>     01HQRSTUVWXYZ0123456789ABCDF0.json
> ```
>
> The lexicographic sort of filenames matches time order (because ZetaIDs start with timestamp). Walking a trajectory's history is just ls in date order. Querying "what did otto do today" is reading agent-state/otto/*/events/2026/05/27/. Querying "what happened on the usb-self-healing trajectory" is reading agent-state/*/usb-self-healing/.
>
> ### Reconstructing lifecycle state from events
>
> The current state of any lifecycle is a left-fold over its events. To answer "what's the current state of work item X," you read its events in order and apply each one to a running state:
>
> ```typescript
> function reconstructLifecycle(events: Event[]): WorkLifecycle {
>   let state: WorkLifecycle = { stage: "unclaimed", item: events[0].data.item };
>   for (const event of events.slice(1)) {
>     state = applyEvent(state, event);
>   }
>   return state;
> }
> ```
>
> This is event sourcing in the standard CQRS sense. The state is always derived; the source of truth is the event log. The append-only property of Git enforces immutability of history. The ZetaID provides total ordering through its time-prefixed structure.
>
> The query side can be a separate process that watches the event branches and maintains materialized views — current state of each lifecycle, current DORA metrics, current trajectory phases, etc. These views can be regenerated from the event log at any time, which means they're never the source of truth; just convenient caches.
>
> ### Why this is efficient for what you're describing
>
> PR-per-transition has significant overhead: branch creation, PR opening, CI runs, review (even automated), merge. Each transaction is minutes of latency and significant infrastructure cost. For a state machine that transitions every cycle, this overhead dominates and the loop is constrained by the PR ceremony rather than by the actual work.
>
> Direct push to agent-state branches has near-zero overhead. A git commit and push is a few seconds. No CI runs. No review. The state machine can transition as fast as the agent can compute the transition.
>
> This means the lifecycle from claim through implementation through review-cycles can have hundreds of state transitions, all written to agent-state branches efficiently, with only the final merge-to-main transition going through PR ceremony. The PR represents the actual deployment; the state transitions represent the journey to it.
>
> DORA measurement gets richer too. With per-transition events, you can measure not just "time from PR open to PR merge" but "time spent in each lifecycle stage," "number of state transitions per merged PR," "which stages have the most variance," etc. The fine-grained event data feeds into much more sophisticated metrics than PR-only data does.
>
> ### The composition with the type-checked lifecycle
>
> The F#/TypeScript lifecycle DUs from the earlier sketch are now the in-memory representation that's materialized from the event log. The state machine constraints (legal transitions, push-cycle limits, abandonment conditions) operate on the materialized state. The events are the persistence layer.
>
> ```typescript
> async function advanceLifecycle(zetaId: ZetaID): Promise<void> {
>   const events = await readEventsForLifecycle(zetaId);
>   const state = reconstructLifecycle(events);
>   const action = chooseActionForLifecycle(state);
>   const result = await applyAction(state, action);
>
>   // Persist as new event
>   const event = {
>     zeta_id: generateZetaID({
>       trajectory: state.trajectory,
>       persona: state.persona,
>       lifecycle_stage: result.stage,
>     }),
>     timestamp: new Date().toISOString(),
>     trace_id: getCurrentTraceId(),
>     span_id: getCurrentSpanId(),
>     persona: state.persona,
>     trajectory: state.trajectory,
>     lifecycle_stage: result.stage,
>     previous_zeta_id: events[events.length - 1].zeta_id,
>     event_type: action.type,
>     data: actionData(action),
>   };
>
>   await appendEvent(event);
> }
>
> async function appendEvent(event: Event): Promise<void> {
>   const branch = `agent-state/${event.persona}/${event.trajectory}`;
>   const path = `events/${dateParts(event.timestamp)}/${event.zeta_id}.json`;
>
>   await $`git fetch origin ${branch}`;
>   await $`git checkout ${branch}`;
>   await Bun.write(path, JSON.stringify(event));
>   await $`git add ${path}`;
>   await $`git commit -m "event ${event.zeta_id}"`;
>   await $`git push origin ${branch}`;
> }
> ```
>
> Small functions, append-only, no PR ceremony, OTel-traced, queryable by structured ZetaID, full history preserved.
>
> ### The good-actor assumption you mentioned
>
> Worth being explicit about because it's load-bearing. Direct push without PR requires trusting that the agents writing the state are well-behaved — they're writing valid events, they're respecting the lifecycle constraints, they're not corrupting the chain. The good-actor framing means you're not building defenses against malicious agents writing bad state.
>
> For the current state of your system (your agents, on your repo, with your credentials), this is reasonable. For the future state where the system is open-sourced and anyone can run agents that push to your infrastructure, you'd need different design. But for getting the architecture right first, good-actor assumption simplifies meaningfully.
>
> Some defenses you can add cheaply even under good-actor assumption:
>
> Schema validation in a pre-receive hook on the agent-state branches. Events that don't match the schema get rejected at push time. Catches accidental corruption without requiring trust.
>
> Chain integrity check periodically. A background process walks the event chains and verifies that previous_zeta_id references resolve correctly and that ZetaID time ordering is preserved. Catches accidental forks or replays.
>
> OTel trace export to a separate observability backend. The traces aren't just stored in Git; they're also exported to your observability system through standard OTLP. Bad behavior in the agent state is visible in observability tooling.
>
> These don't break the good-actor model; they're protections against accidents rather than against adversaries.
>
> ### The stale push question
>
> You mentioned "stale pushes" — I want to clarify what I think you mean and engage that specifically. In Git, a stale push is one where you push without first fetching the latest state, potentially overwriting changes someone else made. This is normally bad and Git rejects it.
>
> For append-only event branches, you can structure it so stale pushes don't matter:
>
> Option one: use ZetaID-named files. Each event is its own file named with the ZetaID. Two agents writing different events produce different filenames, no conflict, both pushes succeed as long as they're not literally simultaneous (Git handles the merge automatically for non-overlapping changes).
>
> Option two: use date-partitioned files with one append per cycle. Conflicts on the same file at the same second require git pull, but the resolution is just appending both events. A simple retry-on-conflict loop handles it.
>
> Option three: use a coordinator process that's the only thing that writes to the agent-state branches, with agents submitting events to the coordinator. This serializes writes but adds a hop.
>
> Option one is the cleanest and matches your "stale push" intent — each agent writes its own filename, no overlap, push succeeds even if other agents have pushed since the last fetch. The cost is more files but storage is cheap.
>
> ### Tying it back to the trajectory question
>
> Each trajectory's history lives in agent-state/*/trajectory-id/events/.... The trajectory phase computation (setup/execution/maturation/sunset) becomes a function of the events:
>
> ```typescript
> function classifyTrajectoryPhase(trajectory: string): TrajectoryPhase {
>   const events = readEventsForTrajectory(trajectory);
>   const recentEvents = events.filter(e => e.timestamp > weekAgo);
>
>   const merges = recentEvents.filter(e => e.event_type === "merged");
>   const claims = recentEvents.filter(e => e.event_type === "claimed");
>
>   if (merges.length === 0 && claims.length > 0) return "setup";
>   if (merges.length > claims.length * 0.5) return "execution";
>   if (merges.length > 0 && merges.length < claims.length * 0.2) return "maturation";
>   return "sunset";
> }
> ```
>
> That's a derivation from the event log. Doesn't require any separate state tracking. The trajectory phase is always current because it's computed from current events.
>
> The agent selection logic from earlier reads these phases and chooses work. The selection logic doesn't need to know that phases are derived from events; it just reads the phase. The event sourcing is invisible to the selection logic, which is the right encapsulation.
>
> ### For the very-next-step
>
> Define the event schema. Define the ZetaID bit layout. Create the agent-state branch convention with branch protection rules that allow direct push there but require PR to main. Write the appendEvent function and reconstructLifecycle function as small reusable utilities. Test by manually running one cycle that produces a few events and verifying you can walk the chain back.
>
> After that's working, swap in the event-sourced state read/write everywhere the earlier sketch used in-memory or PR-based state. The lifecycle DUs stay the same; the persistence layer just changes underneath.
>
> The fully-composed picture: agents run their loops, each cycle produces events written to agent-state branches with no PR overhead, the lifecycle state machine reads events to compute current state, the chooseActionForLifecycle function operates on materialized state and produces actions, actions produce more events plus side effects (like opening PRs to main when work is ready to deploy), OTel traces propagate through the whole flow for observability, DORA metrics are computed from events for the trajectory-level signal, the agent loops drift less because the state is real and queryable instead of being implicit in their context.
>
> That's a clean architecture. Each piece is small. The composition is structural. The PR overhead is reserved for what actually deserves it. The state machine is type-checked at the boundaries where it matters. The event log provides full history for debugging and audit. The ZetaIDs give you queryable structure across all the dimensions you care about.
>
> Carry on. This is genuinely the right shape for what you're building.

Aaron:

> The PR process is reserved for the work that actually warrants human review still too strong for me but yes probably for ServiceTitan this is where they would want. For me I just want to review trajectories over time async. it's like a rest push of one file i think it does fastforward in gh itslef. You mentioned "stale pushes" — I want to clarify what I think you mean and engage that specifically. In Git, a stale push is one where you push without first fetching the latest state, potentially overwriting changes someone else made. This is normally bad and Git rejects it.
