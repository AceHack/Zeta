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
  ActionClass,
  buildHatDefinitions,
  preflightHatAction,
} from "../../../packages/application/src/index.ts";
import {
  ReactionPlanExecutionStatus,
  type ReactionPlanActionExecutionContext,
  type ReactionPlanActionExecutionResult,
  type ReactionPlanActionExecutorPort,
} from "../../../packages/runtime/src/index.ts";
import type { CockroachOrganizationSqlExecutor } from "../../../packages/state-cockroach/src/index.ts";
import {
  ReactionActorHatId,
  composeOrganizationReactionPlanActionExecutor,
} from "../src/organization-executor-composition.ts";

describe("organization executor composition", () => {
  test("self-grants the synthesized reaction actor's hat authority, then authorizes the org command", async () => {
    // No authority is pre-seeded — the substrate is empty. The reaction must
    // grant its own scoped authority before the command pipeline authorizes the
    // discussion-anchor command. (Previously this test stubbed an Active row,
    // masking the real-path denial discovered in KIND.)
    const cockroachExecutor = createAuthorityStoreCockroachExecutor();
    const executor = composeOrganizationReactionPlanActionExecutor({
      cockroachExecutor,
      agentExecutor: createSucceededAgentExecutor(),
      createId: (prefix) => `${prefix}-001`,
      now: () => "2026-05-30T00:00:00.000Z",
    });

    const result = await executor.executeReactionPlanAction(createSupervisorTriageAction(), createExecutionContext());

    equal(result.status, ReactionPlanExecutionStatus.Succeeded);

    const grantIndex = cockroachExecutor.statementNames.indexOf("grant_hat_assignment_authority");
    const findIndex = cockroachExecutor.statementNames.indexOf("find_hat_assignment_authority");
    ok(grantIndex >= 0, "authority is granted");
    ok(findIndex >= 0, "authority is read during authorization");
    ok(grantIndex < findIndex, "authority is granted before it is read");

    const granted = cockroachExecutor.grantedAuthorities.get("hat-assignment-reaction-engineering_manager");
    ok(granted !== undefined, "synthesized actor has a persisted authority row");
    equal(granted.hat_id, "engineering_manager");
    equal(granted.assigned_agent_id, "agent-reaction-engineering_manager");
    equal(granted.organization_id, "org-lfg");
    equal(granted.project_id, "project-agentic-org");
    equal(granted.team_id, "team-runtime");
    equal(granted.state, "active");
  });

  test("every reaction-actor hat exists and carries the tool bundle its reaction command needs", () => {
    // Guards the ReactionActorHatId mapping against drift: a grant under a hat
    // that does not exist (or cannot perform the action class) would be vacuous.
    const hatById = new Map(buildHatDefinitions().map((hat) => [hat.id, hat]));
    const requiredActionClass: Readonly<Record<RequiredHat, ActionClass>> = {
      [RequiredHat.EngineeringManager]: ActionClass.Prioritize,
      [RequiredHat.Reviewer]: ActionClass.WriteDoc,
      [RequiredHat.CSuite]: ActionClass.AssignHat,
      [RequiredHat.Director]: ActionClass.AssignHat,
      [RequiredHat.ExecutiveBoard]: ActionClass.AssignHat,
    };

    for (const requiredHat of Object.values(RequiredHat)) {
      const hat = hatById.get(ReactionActorHatId[requiredHat]);
      ok(hat !== undefined, `${requiredHat} maps to a real hat (${ReactionActorHatId[requiredHat]})`);
      const guardrail = preflightHatAction(hat, requiredActionClass[requiredHat]);
      ok(guardrail.allowed, `${hat.id} can perform ${requiredActionClass[requiredHat]} for ${requiredHat}`);
    }
  });
});

type AuthorityRow = {
  hat_assignment_id: string;
  hat_id: string;
  organization_id: string;
  project_id: string;
  team_id: string | null;
  assigned_agent_id: string;
  state: string;
};

function createAuthorityStoreCockroachExecutor(): CockroachOrganizationSqlExecutor & {
  statementNames: string[];
  grantedAuthorities: Map<string, AuthorityRow>;
} {
  const statementNames: string[] = [];
  const grantedAuthorities = new Map<string, AuthorityRow>();

  const executeStatement = async <Row = Record<string, unknown>>(statement: {
    name: string;
    parameters?: readonly unknown[];
  }) => {
    statementNames.push(statement.name);
    const parameters = statement.parameters ?? [];

    if (statement.name === "grant_hat_assignment_authority") {
      const row: AuthorityRow = {
        hat_assignment_id: String(parameters[0]),
        hat_id: String(parameters[1]),
        organization_id: String(parameters[2]),
        project_id: String(parameters[3]),
        team_id: parameters[4] === null ? null : String(parameters[4]),
        assigned_agent_id: String(parameters[5]),
        state: String(parameters[6]),
      };
      grantedAuthorities.set(row.hat_assignment_id, row);
      return { rows: [] as Row[] };
    }

    if (statement.name === "find_hat_assignment_authority") {
      const row = grantedAuthorities.get(String(parameters[0]));
      return { rows: (row === undefined ? [] : [row]) as Row[] };
    }

    if (statement.name === "claim_idempotency_record") {
      return { rows: [{ persistence_status: "committed" }] as Row[] };
    }

    if (statement.name === "find_work_item") {
      // The triage discussion anchor anchors to an existing work item; the grant
      // still runs unconditionally (before this existence check) so the
      // self-grant path is exercised regardless.
      return { rows: [workItemRow()] as Row[] };
    }

    return { rows: [] as Row[] };
  };

  return {
    statementNames,
    grantedAuthorities,
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
