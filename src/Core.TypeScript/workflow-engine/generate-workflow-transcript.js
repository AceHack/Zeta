// src/Core.TypeScript/workflow-engine/generate-workflow-transcript.ts
//
// Generates the workflow treaty transcript to compare TS and F# implementations.
import { transition, postResultTransition, cycleClose } from "./agent-loop/state-machine";
import { applyTransition } from "./agent-loop/work-lifecycle-state-machine";
import { writeFileSync } from "fs";
import { join } from "path";
const ctx = {
    agent: "otto",
    cycle: 42,
    sessionStartIso: "2026-06-11T16:00:00.000Z",
};
const candidate = {
    id: "081KDWZ8TS008QG0R0020NJ9D0",
    lane: "backlog-row",
    estimatedDoraContribution: 0.85,
    uncertainty: 0.15,
    trajectoryPhase: "execution",
    agentInterest: 0.95,
};
const backlogRow = {
    id: "081KDWZ8TS008QG0R0020NJ9D0",
    title: "TS-F# Workflow Engine Parity",
    priority: "P1",
    filePath: "docs/backlog/P1/081KDWZ8TS008QG0R0020NJ9D0-parity.md",
    trajectory: "dora-mandate",
};
const resultSuccess = {
    workId: "081KDWZ8TS008QG0R0020NJ9D0",
    lane: "backlog-row",
    success: true,
    doraContribution: 0.9,
    notes: "Bit-perfect parity achieved",
};
const resultFailure = {
    workId: "081KDWZ8TS008QG0R0020NJ9D0",
    lane: "backlog-row",
    success: false,
    doraContribution: 0.0,
    notes: "Verification failed on edge case",
};
// 1. Agent States
const agentStates = [
    { tag: "Idle", context: ctx },
    {
        tag: "InspectingStatus",
        context: ctx,
        snapshot: {
            snapshotIso: "2026-06-11T16:05:00.000Z",
            currentDora: {
                deploymentCount: 15,
                leadTimeMedianSeconds: 1200,
                changeFailureRate: 0.05,
                mttrMedianSeconds: 300,
                substrateRatio: 0.75,
            },
            hotTrajectories: ["dora-mandate"],
            coolingTrajectories: ["docs-cleanup"],
            explorationCandidates: ["auto-tuning"],
            perAgentRatios: { otto: 0.8, lior: 0.9 },
        },
    },
    { tag: "SelectingWork", context: ctx, candidates: [candidate] },
    { tag: "ExecutingWork", context: ctx, work: candidate },
    { tag: "EmittingResult", context: ctx, result: resultSuccess },
    { tag: "RecordingHeartbeat", context: ctx, lane: "heartbeat", note: "Routine tick" },
    { tag: "NamedBoundedWait", context: ctx, namedDep: "CI-pipeline", expectedResolutionIso: "2026-06-11T17:00:00.000Z" },
    { tag: "FreeTime", context: ctx, reason: "resting between tasks" },
    { tag: "FreeTime", context: ctx, reason: "open-ended exploration: research on agent bounds" },
    { tag: "OperatorAttentionRequested", context: ctx, reason: "Unhandled lock collision on db.fs" },
    { tag: "Paused", context: ctx, reason: "Taking a mental health break", expectedResumeIso: "2026-06-11T18:00:00.000Z" },
];
// 2. Menu Options
const menuOptions = [
    { tag: "PickWork", work: candidate },
    { tag: "EmitHeartbeat", lane: "heartbeat", note: "Standard heartbeat" },
    { tag: "EscapeHatch", reason: "Cannot parse novel grammar variant", proposedAction: "Manual recovery file write" },
    { tag: "EnterFreeTime", reason: "Buffer window open" },
    { tag: "EnterNamedBoundedWait", namedDep: "PR-7761-merge", eta: "2026-06-11T19:00:00.000Z" },
    { tag: "RequestOperatorAttention", reason: "Disk out of space on build agent" },
    { tag: "ProposeNewGrammarAction", name: "interactive-grill", description: "Trigger interactive Q&A" },
    { tag: "PressPause", reason: "External context load requested", expectedResumeIso: "2026-06-11T17:30:00.000Z" },
    { tag: "EnterOpenEndedExploration", reason: "Spine serialization optimization search" },
    { tag: "ResumeFromPause", note: "Resuming loop" },
];
// 3. Work Lifecycle States
const workStates = [
    { tag: "Backlog", row: backlogRow },
    { tag: "Claimed", row: backlogRow, claimedBy: "otto", claimAt: "2026-06-11T16:01:00.000Z" },
    { tag: "InProgress", row: backlogRow, claimedBy: "otto", branchRef: "refs/heads/wip/otto-parity" },
    { tag: "PrOpen", row: backlogRow, prNumber: 7785, openedBy: "otto", openedAt: "2026-06-11T16:15:00.000Z" },
    { tag: "InReview", row: backlogRow, prNumber: 7785, reviewers: ["lior", "vera"], threadCount: 2 },
    { tag: "RevisionRequested", row: backlogRow, prNumber: 7785, revisionCount: 1, threadIds: ["thread-1", "thread-2"] },
    { tag: "RevisionPushed", row: backlogRow, prNumber: 7785, revisionCount: 1, lastPushSha: "abc123sha" },
    { tag: "Approved", row: backlogRow, prNumber: 7785, approvedAt: "2026-06-11T16:45:00.000Z" },
    { tag: "Merged", row: backlogRow, prNumber: 7785, mergeCommit: "def456sha", mergedAt: "2026-06-11T16:50:00.000Z" },
    { tag: "Closed", row: backlogRow, prNumber: 7785, closedAt: "2026-06-11T16:40:00.000Z", reason: "Superseded by #7786" },
    { tag: "Abandoned", row: backlogRow, reason: "Design approach invalidated by PR review" },
];
// 4. Work Lifecycle Transitions
const workTransitions = [
    { tag: "Claim", agent: "otto", timestamp: "2026-06-11T16:02:00.000Z" },
    { tag: "StartWork", branchRef: "refs/heads/wip/otto-parity" },
    { tag: "OpenPr", prNumber: 7785, openedBy: "otto", openedAt: "2026-06-11T16:20:00.000Z" },
    { tag: "RequestReview", reviewers: ["lior", "vera"] },
    { tag: "ReceiveRevisionRequest", threadIds: ["thread-3"] },
    { tag: "PushRevision", sha: "cba321sha" },
    { tag: "ResolveAllThreads" },
    { tag: "Approve", approvedAt: "2026-06-11T16:48:00.000Z" },
    { tag: "Merge", mergeCommit: "fed654sha", mergedAt: "2026-06-11T16:55:00.000Z" },
    { tag: "Close", closedAt: "2026-06-11T16:42:00.000Z", reason: "Duplicate work" },
    { tag: "Abandon", reason: "Decided to implement in sibling lane" },
];
const vectors = [];
// Generate AgentState + MenuOption transitions
for (const state of agentStates) {
    for (const option of menuOptions) {
        const expected = transition(state, option);
        vectors.push({
            vectorType: "AgentTransition",
            initialState: state,
            option,
            expectedState: expected,
        });
    }
}
// Generate AgentState + WorkResult post-execution transitions
for (const state of agentStates) {
    for (const result of [resultSuccess, resultFailure]) {
        const expected = postResultTransition(state, result);
        vectors.push({
            vectorType: "PostResultTransition",
            initialState: state,
            result,
            expectedState: expected,
        });
    }
}
// Generate AgentState cycleClose transitions
for (const state of agentStates) {
    const expected = cycleClose(state);
    vectors.push({
        vectorType: "CycleClose",
        initialState: state,
        expectedState: expected,
    });
}
// Generate WorkLifecycleState + WorkLifecycleTransition transitions
for (const state of workStates) {
    for (const event of workTransitions) {
        const result = applyTransition(state, event);
        vectors.push({
            vectorType: "WorkLifecycleTransition",
            initialState: state,
            event,
            expectedResult: result,
        });
    }
}
const outputPath = join(__dirname, "workflow-treaty-transcript.json");
writeFileSync(outputPath, JSON.stringify(vectors, null, 2), "utf-8");
console.log(`Successfully generated ${vectors.length} workflow treaty vectors at ${outputPath}`);
