import { equal } from "node:assert/strict";
import { test } from "node:test";

import {
  ContextPackRefreshReason,
  ContextPackStatus,
  RunLifecyclePhase,
  RunScope,
  asZetaIdDecimal,
  decideContextPackRefresh,
  type AgentObserveSnapshot,
  type ContextPackSnapshotRecord,
  type ContextReadout,
} from "../src/index.ts";
import { buildHatDefinitions } from "../src/org-seed.ts";

test("context-pack refresh policy requires build on first hat wake with no prior snapshot", () => {
  const decision = decideContextPackRefresh({
    current: snapshot({ hatAssignmentId: "77" }),
    observedAt: "2026-06-02T12:00:00.000Z",
    previous: null,
  });

  equal(decision.reason, ContextPackRefreshReason.FirstHatWake);
  equal(decision.requiresBuild, true);
  equal(decision.previousContextPackId, undefined);
});

test("context-pack refresh policy detects reassigned hat capacity for the same agent", () => {
  const decision = decideContextPackRefresh({
    current: snapshot({ hatAssignmentId: "77" }),
    observedAt: "2026-06-02T12:00:00.000Z",
    previous: snapshotRecord({
      contextPackId: "ctx-previous",
      hatAssignmentId: "76",
      hatId: "engineering_director",
      agentId: "agent-director-1",
    }),
  });

  equal(decision.reason, ContextPackRefreshReason.HatAssignmentChanged);
  equal(decision.requiresBuild, true);
  equal(decision.previousContextPackId, "ctx-previous");
  equal(decision.previousStatus, ContextPackStatus.Current);
});

test("context-pack refresh policy checks assignment before freshness or lifecycle status", () => {
  const decision = decideContextPackRefresh({
    current: snapshot({ hatAssignmentId: "77" }),
    observedAt: "2026-06-02T12:00:00.000Z",
    previous: snapshotRecord({
      contextPackId: "ctx-previous",
      hatAssignmentId: "76",
      status: ContextPackStatus.Incomplete,
      freshnessDeadline: "2026-06-02T11:00:00.000Z",
    }),
  });

  equal(decision.reason, ContextPackRefreshReason.HatAssignmentChanged);
  equal(decision.requiresBuild, true);
});

test("context-pack refresh policy detects changed hat definition on the same assignment", () => {
  const decision = decideContextPackRefresh({
    current: snapshot({ hatAssignmentId: "77", hatId: "engineering_director" }),
    observedAt: "2026-06-02T12:00:00.000Z",
    previous: snapshotRecord({
      contextPackId: "ctx-previous-hat",
      hatAssignmentId: "77",
      hatId: "release_operator",
    }),
  });

  equal(decision.reason, ContextPackRefreshReason.HatChanged);
  equal(decision.requiresBuild, true);
});

test("context-pack refresh policy rejects prior context from a different work scope", () => {
  const decision = decideContextPackRefresh({
    current: snapshot({ hatAssignmentId: "77" }),
    observedAt: "2026-06-02T12:00:00.000Z",
    previous: snapshotRecord({
      contextPackId: "ctx-other-project",
      hatAssignmentId: "77",
      projectId: "project-other",
    }),
  });

  equal(decision.reason, ContextPackRefreshReason.ScopeChanged);
  equal(decision.requiresBuild, true);
});

test("context-pack refresh policy detects expired or not-current prior context", () => {
  equal(decideContextPackRefresh({
    current: snapshot({ hatAssignmentId: "77" }),
    observedAt: "2026-06-02T12:00:00.000Z",
    previous: snapshotRecord({
      contextPackId: "ctx-expired",
      freshnessDeadline: "2026-06-02T11:59:59.000Z",
      hatAssignmentId: "77",
    }),
  }).reason, ContextPackRefreshReason.PreviousExpired);

  equal(decideContextPackRefresh({
    current: snapshot({ hatAssignmentId: "77" }),
    observedAt: "2026-06-02T12:00:00.000Z",
    previous: snapshotRecord({
      contextPackId: "ctx-invalid-deadline",
      freshnessDeadline: "not-a-date",
      hatAssignmentId: "77",
    }),
  }).reason, ContextPackRefreshReason.PreviousExpired);

  equal(decideContextPackRefresh({
    current: snapshot({ hatAssignmentId: "77" }),
    observedAt: "2026-06-02T12:00:00.000Z",
    previous: snapshotRecord({
      contextPackId: "ctx-incomplete",
      status: ContextPackStatus.Incomplete,
      hatAssignmentId: "77",
    }),
  }).reason, ContextPackRefreshReason.PreviousNotCurrent);
});

test("context-pack refresh policy treats current matching prior context as reusable", () => {
  const decision = decideContextPackRefresh({
    current: snapshot({ hatAssignmentId: "77" }),
    observedAt: "2026-06-02T12:00:00.000Z",
    previous: snapshotRecord({
      contextPackId: "ctx-current",
      freshnessDeadline: "2026-06-02T12:05:00.000Z",
      hatAssignmentId: "77",
    }),
  });

  equal(decision.reason, ContextPackRefreshReason.Reusable);
  equal(decision.requiresBuild, false);
  equal(decision.previousContextPackId, "ctx-current");
});

function snapshot(input: { hatAssignmentId: string; hatId?: string | undefined }): AgentObserveSnapshot {
  const hat = buildHatDefinitions().find((candidate) => candidate.id === (input.hatId ?? "engineering_director"));
  if (hat === undefined) throw new Error("test hat missing");
  return {
    runId: asZetaIdDecimal("42"),
    scope: RunScope.Project,
    phase: RunLifecyclePhase.Blocked,
    trace: {
      traceId: "trace-current",
      correlationId: "corr-current",
      causationId: "cause-current",
    },
    hasGateApproval: false,
    hasEvidence: true,
    hatAssignmentId: asZetaIdDecimal(input.hatAssignmentId),
    hat,
    agentId: "agent-director-1",
    organizationId: "org-1",
    projectId: "project-1",
    workItemId: "work-1",
  };
}

function snapshotRecord(input: {
  contextPackId: string;
  hatAssignmentId: string;
  hatId?: string | undefined;
  agentId?: string | undefined;
  projectId?: string | undefined;
  teamId?: string | undefined;
  workItemId?: string | undefined;
  status?: ContextPackStatus | undefined;
  freshnessDeadline?: string | undefined;
}): ContextPackSnapshotRecord {
  return {
    context: contextReadout(input),
    recordedAt: "2026-06-02T11:55:00.000Z",
    trace: {
      traceId: `trace-${input.contextPackId}`,
      correlationId: `corr-${input.contextPackId}`,
      causationId: `cause-${input.contextPackId}`,
    },
  };
}

function contextReadout(input: {
  contextPackId: string;
  hatAssignmentId: string;
  hatId?: string | undefined;
  agentId?: string | undefined;
  projectId?: string | undefined;
  teamId?: string | undefined;
  workItemId?: string | undefined;
  status?: ContextPackStatus | undefined;
  freshnessDeadline?: string | undefined;
}): ContextReadout {
  return {
    status: input.status ?? ContextPackStatus.Current,
    pack: {
      id: input.contextPackId,
      runId: asZetaIdDecimal("41"),
      scope: RunScope.Project,
      hatAssignmentId: asZetaIdDecimal(input.hatAssignmentId),
      hatId: input.hatId ?? "engineering_director",
      agentId: input.agentId ?? "agent-director-1",
      organizationId: "org-1",
      projectId: input.projectId ?? "project-1",
      ...(input.teamId === undefined ? {} : { teamId: input.teamId }),
      workItemId: input.workItemId ?? "work-1",
      generatedAt: "2026-06-02T11:55:00.000Z",
      freshnessDeadline: input.freshnessDeadline ?? "2026-06-02T12:05:00.000Z",
      sourceGraphVersion: "graph:v1",
      policyVersion: "policy:v1",
      tokenBudget: 4096,
      items: [],
      omittedItemsWithReason: [],
      contradictions: [],
      staleInputs: [],
      lifecycleBlockers: [],
      curationTrace: [],
    },
    requiredItems: [],
    optionalItems: [],
    omittedItemsWithReason: [],
    contradictions: [],
    staleInputs: [],
    lifecycleBlockers: [],
    uncertainty: {
      signalCount: 0,
      highSeverityCount: 0,
      mediumSeverityCount: 0,
      lowSeverityCount: 0,
      groups: [],
    },
    drillTargetGroups: [],
    summary: {
      requiredItemCount: 0,
      optionalItemCount: 0,
      omissionCount: 0,
      contradictionCount: 0,
      staleInputCount: 0,
      lifecycleBlockerCount: 0,
      uncertaintySignalCount: 0,
    },
  };
}
