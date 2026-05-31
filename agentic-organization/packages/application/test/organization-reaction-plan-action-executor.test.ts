import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";

import {
  ReactionPlanActionType,
  ReactionPlanReason,
  RequiredHat,
  type ReactionPlanAction,
} from "../../domain/src/index.ts";
import {
  ReactionPlanExecutionStatus,
  type ReactionPlanActionExecutionContext,
  type ReactionPlanActionExecutionResult,
  type ReactionPlanActionExecutorPort,
} from "../../runtime/src/index.ts";
import {
  ControlPlaneFlagKind,
  ControlPlaneScopeKind,
  createOrganizationReactionPlanActionExecutor,
  type EnsureWorkItemPort,
} from "../src/index.ts";

function action(): ReactionPlanAction {
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
  } as ReactionPlanAction;
}

const context: ReactionPlanActionExecutionContext = {
  reactionPlanId: "rp-1",
  claimId: "claim-1",
  actionIdempotencyKey: "idem-1",
  claimExpiresAt: "2026-05-30T07:00:00.000Z",
};

function ok(message: string): ReactionPlanActionExecutionResult {
  return {
    status: ReactionPlanExecutionStatus.Succeeded,
    result: { message, createdWorkItemIds: [], createdDiscussionAnchorIds: ["da-1"] },
  };
}

function failed(message: string): ReactionPlanActionExecutionResult {
  return { status: ReactionPlanExecutionStatus.Failed, failure: { message, retryable: true } };
}

function recordingExecutor(result: ReactionPlanActionExecutionResult): ReactionPlanActionExecutorPort & {
  calls: number;
} {
  const port = {
    calls: 0,
    executeReactionPlanAction: async () => {
      port.calls += 1;
      return result;
    },
  };
  return port;
}

function recordingSeeder(): EnsureWorkItemPort & { seeded: string[] } {
  const seeded: string[] = [];
  return { seeded, ensureWorkItem: async (a) => void seeded.push(a.workItemId) };
}

test("runs the agent (Hermes), ensures the work item exists, then creates the org artifact", async () => {
  const agentExecutor = recordingExecutor(ok("agent ran"));
  const seeder = recordingSeeder();
  const organizationExecutor = recordingExecutor(ok("discussion anchor created"));

  const executor = createOrganizationReactionPlanActionExecutor({ agentExecutor, ensureWorkItem: seeder, organizationExecutor });
  const result = await executor.executeReactionPlanAction(action(), context);

  equal(agentExecutor.calls, 1);
  deepEqual(seeder.seeded, ["wi-1"]);
  equal(organizationExecutor.calls, 1);
  equal(result.status, ReactionPlanExecutionStatus.Succeeded);
  if (result.status !== ReactionPlanExecutionStatus.Succeeded) return;
  // the org artifact (discussion anchor) flows through as the result
  deepEqual(result.result.createdDiscussionAnchorIds, ["da-1"]);
});

test("if the agent run fails, it does NOT seed or create org artifacts (short-circuits)", async () => {
  const agentExecutor = recordingExecutor(failed("agent could not run"));
  const seeder = recordingSeeder();
  const organizationExecutor = recordingExecutor(ok("should not run"));

  const executor = createOrganizationReactionPlanActionExecutor({ agentExecutor, ensureWorkItem: seeder, organizationExecutor });
  const result = await executor.executeReactionPlanAction(action(), context);

  equal(result.status, ReactionPlanExecutionStatus.Failed);
  deepEqual(seeder.seeded, []);
  equal(organizationExecutor.calls, 0);
});

test("control-plane ESTOP rejects reaction-plan execution before agent or org artifacts", async () => {
  const agentExecutor = recordingExecutor(ok("should not run"));
  const seeder = recordingSeeder();
  const organizationExecutor = recordingExecutor(ok("should not run"));

  const executor = createOrganizationReactionPlanActionExecutor({
    agentExecutor,
    ensureWorkItem: seeder,
    organizationExecutor,
    controlPlane: {
      now: () => "2026-05-31T20:00:00.000Z",
      flags: [{
        controlPlaneFlagId: "flag-estop",
        organizationId: "org-1",
        scope: { kind: ControlPlaneScopeKind.Organization },
        flag: ControlPlaneFlagKind.Estop,
        reason: "operator estop",
        setByHatId: "incident_commander",
        setAt: "2026-05-31T19:59:00.000Z",
      }],
    },
  });

  const result = await executor.executeReactionPlanAction(action(), context);

  equal(result.status, ReactionPlanExecutionStatus.Failed);
  if (result.status !== ReactionPlanExecutionStatus.Failed) return;
  equal(result.failure.message.includes("operator estop"), true);
  equal(agentExecutor.calls, 0);
  deepEqual(seeder.seeded, []);
  equal(organizationExecutor.calls, 0);
});
