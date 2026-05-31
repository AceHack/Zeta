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
import {
  RecordingTelemetry,
  TelemetrySpanStatusCode,
} from "../../observability/src/index.ts";
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

test("emits a Hermes run span linked to the work item and originating traceparent", async () => {
  const telemetry = new RecordingTelemetry();
  const executor = createHermesReactionPlanActionExecutor({
    createHermesRuntime: () => createInProcessHermesRuntime(),
    createMemory: () => createInProcessMemory(),
    agentHeartbeatWriter: recordingWriter(),
    agentHeartbeatDeadlineMs: 60_000,
    generateId: (prefix) => `${prefix}-x`,
    telemetry,
  });

  await executor.executeReactionPlanAction(triageAction(), {
    ...context,
    traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
  });

  deepEqual(
    telemetry.spans.map((span) => ({
      name: span.name,
      status: span.status,
      ended: span.ended,
      workItemId: span.attributes["org.work_item_id"],
      reactionPlanId: span.attributes["agentic.reaction_plan.id"],
      requiredHat: span.attributes["agentic.required_hat"],
    })),
    [
      {
        name: "org.hermes.run",
        status: { code: TelemetrySpanStatusCode.Ok },
        ended: true,
        workItemId: "wi-1",
        reactionPlanId: "rp-1",
        requiredHat: RequiredHat.EngineeringManager,
      },
    ],
  );
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
