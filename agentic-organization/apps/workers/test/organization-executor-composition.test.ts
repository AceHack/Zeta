import { equal, ok } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  ReactionPlanActionType,
  ReactionPlanReason,
  RequiredHat,
  SupervisorChainLevel,
  WorkItemState,
  WorkItemType,
  type ReactionPlanAction,
} from "../../../packages/domain/src/index.ts";
import {
  ReactionPlanExecutionStatus,
  type ReactionPlanActionExecutionContext,
  type ReactionPlanActionExecutionResult,
  type ReactionPlanActionExecutorPort,
} from "../../../packages/runtime/src/index.ts";
import type { CockroachOrganizationSqlExecutor } from "../../../packages/state-cockroach/src/index.ts";
import { composeOrganizationReactionPlanActionExecutor } from "../src/organization-executor-composition.ts";

describe("organization executor composition", () => {
  test("authorizes reaction commands through durable hat assignment authority", async () => {
    const cockroachExecutor = createRecordingCockroachExecutor();
    const executor = composeOrganizationReactionPlanActionExecutor({
      cockroachExecutor,
      agentExecutor: createSucceededAgentExecutor(),
      createId: (prefix) => `${prefix}-001`,
      now: () => "2026-05-30T00:00:00.000Z",
    });

    const result = await executor.executeReactionPlanAction(createSupervisorTriageAction(), createExecutionContext());

    equal(result.status, ReactionPlanExecutionStatus.Succeeded);
    ok(cockroachExecutor.statementNames.includes("find_hat_assignment_authority"));
  });
});

function createRecordingCockroachExecutor(): CockroachOrganizationSqlExecutor & { statementNames: string[] } {
  const statementNames: string[] = [];

  const executeStatement = async <Row = Record<string, unknown>>(statement: { name: string }) => {
    statementNames.push(statement.name);

    if (statement.name === "find_hat_assignment_authority") {
      return {
        rows: [
          {
            hat_assignment_id: "hat-assignment-reaction-engineering_manager",
            hat_id: "engineering_manager",
            organization_id: "org-lfg",
            project_id: "project-agentic-org",
            team_id: "team-runtime",
            assigned_agent_id: "agent-reaction-engineering_manager",
            state: "active",
          },
        ] as Row[],
      };
    }

    if (statement.name === "find_work_item") {
      return { rows: [workItemRow()] as Row[] };
    }

    if (statement.name === "claim_idempotency_record") {
      return { rows: [{ persistence_status: "committed" }] as Row[] };
    }

    return { rows: [] as Row[] };
  };

  return {
    statementNames,
    execute: executeStatement,
    executeTransaction: async (operation) => await operation({ execute: executeStatement }),
  };
}

function workItemRow() {
  return {
    work_item_id: "work-runtime-001",
    organization_id: "org-lfg",
    project_id: "project-agentic-org",
    initiative_id: null,
    work_item_type: WorkItemType.Task,
    title: "Runtime work",
    description: "Existing work item.",
    state: WorkItemState.Created,
    created_at: "2026-05-30T00:00:00.000Z",
    updated_at: "2026-05-30T00:00:00.000Z",
    version: 1,
    created_by_agent_id: "agent-reaction-engineering_manager",
    created_by_hat_assignment_id: "hat-assignment-reaction-engineering_manager",
    correlation_id: "evt-supervisor-signal-001",
    causation_id: "evt-supervisor-signal-001",
    trace_id: "evt-supervisor-signal-001",
  };
}

function createSucceededAgentExecutor(): ReactionPlanActionExecutorPort {
  return {
    executeReactionPlanAction: async (): Promise<ReactionPlanActionExecutionResult> => ({
      status: ReactionPlanExecutionStatus.Succeeded,
      result: {
        message: "agent ran",
        createdWorkItemIds: [],
        createdDiscussionAnchorIds: [],
      },
    }),
  };
}

function createSupervisorTriageAction(): ReactionPlanAction {
  return {
    actionType: ReactionPlanActionType.CreateSupervisorTriage,
    triggerEventId: "evt-supervisor-signal-001",
    organizationId: "org-lfg",
    projectId: "project-agentic-org",
    teamId: "team-runtime",
    workItemId: "work-runtime-001",
    supervisorSignalId: "supervisor-signal-001",
    targetLevel: SupervisorChainLevel.Manager,
    requiredHat: RequiredHat.EngineeringManager,
    reason: ReactionPlanReason.SupervisorSignalNeedsTriage,
  };
}

function createExecutionContext(): ReactionPlanActionExecutionContext {
  return {
    reactionPlanId: "reaction-plan-001",
    claimId: "reaction-claim-001",
    actionIdempotencyKey: "reaction-plan-001:create_supervisor_triage",
    claimExpiresAt: "2026-05-30T00:05:00.000Z",
  };
}
