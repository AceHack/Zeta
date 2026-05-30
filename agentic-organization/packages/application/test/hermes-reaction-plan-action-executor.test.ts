import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";

import {
  ReactionPlanActionType,
  ReactionPlanReason,
  RequiredHat,
  type ReactionPlanAction,
} from "../../domain/src/index.ts";
import { createInProcessHermesRuntime } from "../../hermes/src/index.ts";
import { createInProcessMemory } from "../../memory/src/index.ts";
import { ReactionPlanExecutionStatus } from "../../runtime/src/index.ts";
import {
  createHermesReactionPlanActionExecutor,
  type AgentHeartbeatRecord,
  type AgentHeartbeatWriter,
} from "../src/index.ts";

function triageAction(overrides: Partial<ReactionPlanAction> = {}): ReactionPlanAction {
  return {
    actionType: ReactionPlanActionType.CreateSupervisorTriage,
    triggerEventId: "evt-1",
    organizationId: "org-1",
    projectId: "proj-1",
    teamId: "team-1",
    workItemId: "wi-1",
    requiredHat: RequiredHat.EngineeringManager,
    reason: ReactionPlanReason.SupervisorSignalNeedsTriage,
    supervisorSignalId: "sig-1",
    targetLevel: "manager",
    ...overrides,
  } as ReactionPlanAction;
}

function recordingWriter(): AgentHeartbeatWriter & { records: AgentHeartbeatRecord[] } {
  const records: AgentHeartbeatRecord[] = [];
  return { records, recordAgentHeartbeat: async (r) => void records.push(r) };
}

const context = {
  reactionPlanId: "rp-1",
  claimId: "claim-1",
  actionIdempotencyKey: "idem-1",
  claimExpiresAt: "2026-05-30T07:00:00.000Z",
};

test("runs a reaction-plan action through a Hermes run and persists agent liveness", async () => {
  const writer = recordingWriter();
  const executor = createHermesReactionPlanActionExecutor({
    createHermesRuntime: () => createInProcessHermesRuntime(),
    createMemory: () => createInProcessMemory(),
    agentHeartbeatWriter: writer,
    agentHeartbeatDeadlineMs: 60_000,
    generateId: (prefix) => `${prefix}-x`,
  });

  const result = await executor.executeReactionPlanAction(triageAction(), context);

  equal(result.status, ReactionPlanExecutionStatus.Succeeded);
  // the agent's liveness was persisted for the work item, keyed by org
  equal(writer.records.length, 1);
  equal(writer.records[0]?.organizationId, "org-1");
  equal(writer.records[0]?.workItemId, "wi-1");
  equal(writer.records[0]?.deadlineMs, 60_000);
});

test("a Hermes run that fails to launch surfaces as a retryable failure", async () => {
  const writer = recordingWriter();
  const executor = createHermesReactionPlanActionExecutor({
    createHermesRuntime: () => ({
      ...createInProcessHermesRuntime(),
      launchRun: async () => ({ outcome: "feedback", feedback: { reason: "unknown_run", message: "no capacity" } }),
    }),
    createMemory: () => createInProcessMemory(),
    agentHeartbeatWriter: writer,
    agentHeartbeatDeadlineMs: 60_000,
    generateId: (prefix) => `${prefix}-x`,
  });

  const result = await executor.executeReactionPlanAction(triageAction(), context);

  equal(result.status, ReactionPlanExecutionStatus.Failed);
  if (result.status !== ReactionPlanExecutionStatus.Failed) return;
  equal(result.failure.retryable, true);
  // a run that never launched persisted no liveness
  deepEqual(writer.records, []);
});
