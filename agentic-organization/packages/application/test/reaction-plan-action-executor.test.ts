import { deepEqual } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  CommandType,
  DiscussionAnchorType,
  DiscussionExpectedOutput,
  ReactionPlanActionType,
  ReactionPlanReason,
  RequiredHat,
  SupervisorChainLevel,
  type AgenticActor,
} from "../../domain/src/index.ts";
import { ReactionPlanExecutionStatus, type ReactionPlanActionExecutionContext } from "../../runtime/src/index.ts";
import type { CommandPipeline } from "../src/command-pipeline.ts";
import {
  CommandErrorCode,
  CommandResultArtifactType,
  CommandResultStatus,
  type CommandResult,
} from "../src/command-result.ts";
import {
  ReactionPlanApplicationExecutorMessage,
  createApplicationReactionPlanActionExecutor,
} from "../src/reaction-plan-action-executor.ts";

describe("application reaction plan action executor", () => {
  test("turns supervisor triage reaction actions into real discussion-anchor commands", async () => {
    const executedCommands: unknown[] = [];
    const executor = createApplicationReactionPlanActionExecutor({
      commandPipeline: createAcceptedCommandPipeline(executedCommands),
      actorResolver: {
        resolveReactionActor: async () => createManagerActor(),
      },
      createId: () => "cmd-reaction-001",
    });

    const result = await executor.executeReactionPlanAction(createSupervisorTriageAction(), createExecutionContext());

    deepEqual(result, {
      status: ReactionPlanExecutionStatus.Succeeded,
      result: {
        message: ReactionPlanApplicationExecutorMessage.DiscussionAnchorCreated,
        createdWorkItemIds: [],
        createdDiscussionAnchorIds: ["discussion-anchor-001"],
      },
    });
    deepEqual(executedCommands, [
      {
        commandId: "cmd-reaction-001",
        type: CommandType.CreateDiscussionAnchor,
        idempotencyKey: "reaction-plan-001:create_supervisor_triage:create_discussion_anchor",
        requestHash:
          '{"actionType":"create_supervisor_triage","commandType":"create_discussion_anchor","organizationId":"org-lfg","projectId":"project-agentic-org","reason":"supervisor signal needs triage","supervisorSignalId":"supervisor-signal-001","triggerEventId":"evt-supervisor-signal-001","workItemId":"work-runtime-001"}',
        correlationId: "evt-supervisor-signal-001",
        causationId: "supervisor-signal-001",
        traceId: "evt-supervisor-signal-001",
        organizationId: "org-lfg",
        projectId: "project-agentic-org",
        actor: createManagerActor(),
        teamId: "team-runtime",
        workItemId: "work-runtime-001",
        discussionAnchorType: DiscussionAnchorType.WorkItem,
        title: "Supervisor triage: supervisor signal needs triage",
        purpose: "Triage the supervisor signal and decide the next organization action.",
        expectedOutputs: [DiscussionExpectedOutput.Decision, DiscussionExpectedOutput.FollowUp],
      },
    ]);
  });

  test("turns ready-work reaction actions into manager assignment discussion commands", async () => {
    const executedCommands: unknown[] = [];
    const executor = createApplicationReactionPlanActionExecutor({
      commandPipeline: createAcceptedCommandPipeline(executedCommands),
      actorResolver: {
        resolveReactionActor: async () => createManagerActor(),
      },
      createId: () => "cmd-reaction-001",
    });

    const result = await executor.executeReactionPlanAction(
      createImplementationAssignmentAction(),
      createExecutionContext("reaction-plan-001:request_implementation_assignment"),
    );

    deepEqual(result, {
      status: ReactionPlanExecutionStatus.Succeeded,
      result: {
        message: ReactionPlanApplicationExecutorMessage.DiscussionAnchorCreated,
        createdWorkItemIds: [],
        createdDiscussionAnchorIds: ["discussion-anchor-001"],
      },
    });
    deepEqual(executedCommands, [
      {
        commandId: "cmd-reaction-001",
        type: CommandType.CreateDiscussionAnchor,
        idempotencyKey: "reaction-plan-001:request_implementation_assignment:create_discussion_anchor",
        requestHash:
          '{"actionType":"request_implementation_assignment","commandType":"create_discussion_anchor","organizationId":"org-lfg","projectId":"project-agentic-org","reason":"work item entered ready state","triggerEventId":"evt-work-ready-001","workItemId":"work-runtime-001"}',
        correlationId: "evt-work-ready-001",
        causationId: "evt-work-ready-001",
        traceId: "evt-work-ready-001",
        organizationId: "org-lfg",
        projectId: "project-agentic-org",
        actor: createManagerActor(),
        teamId: "team-runtime",
        workItemId: "work-runtime-001",
        discussionAnchorType: DiscussionAnchorType.WorkItem,
        title: "Implementation assignment: work item entered ready state",
        purpose: "Assign implementation ownership and decide the next execution schedule.",
        expectedOutputs: [DiscussionExpectedOutput.Decision, DiscussionExpectedOutput.FollowUp],
      },
    ]);
  });

  test("turns review-gate reaction actions into reviewer gate discussion commands", async () => {
    const executedCommands: unknown[] = [];
    const executor = createApplicationReactionPlanActionExecutor({
      commandPipeline: createAcceptedCommandPipeline(executedCommands),
      actorResolver: {
        resolveReactionActor: async () => createManagerActor(),
      },
      createId: () => "cmd-reaction-001",
    });

    const result = await executor.executeReactionPlanAction(
      createReviewGateAction(),
      createExecutionContext("reaction-plan-001:request_review_gate"),
    );

    deepEqual(result.status, ReactionPlanExecutionStatus.Succeeded);
    deepEqual(executedCommands, [
      {
        commandId: "cmd-reaction-001",
        type: CommandType.CreateDiscussionAnchor,
        idempotencyKey: "reaction-plan-001:request_review_gate:create_discussion_anchor",
        requestHash:
          '{"actionType":"request_review_gate","commandType":"create_discussion_anchor","organizationId":"org-lfg","projectId":"project-agentic-org","reason":"work item entered review state","triggerEventId":"evt-work-review-001","workItemId":"work-runtime-001"}',
        correlationId: "evt-work-review-001",
        causationId: "evt-work-review-001",
        traceId: "evt-work-review-001",
        organizationId: "org-lfg",
        projectId: "project-agentic-org",
        actor: createManagerActor(),
        teamId: "team-runtime",
        workItemId: "work-runtime-001",
        discussionAnchorType: DiscussionAnchorType.WorkItem,
        title: "Review gate: work item entered review state",
        purpose: "Open the review gate and decide the reviewer evidence needed before the next state transition.",
        expectedOutputs: [DiscussionExpectedOutput.Decision, DiscussionExpectedOutput.FollowUp],
      },
    ]);
  });

  test("returns retryable failure when the required reaction actor is unavailable", async () => {
    const executor = createApplicationReactionPlanActionExecutor({
      commandPipeline: createRejectedCommandPipeline(),
      actorResolver: {
        resolveReactionActor: async () => undefined,
      },
      createId: () => "cmd-reaction-001",
    });

    const result = await executor.executeReactionPlanAction(createSupervisorTriageAction(), createExecutionContext());

    deepEqual(result, {
      status: ReactionPlanExecutionStatus.Failed,
      failure: {
        message: ReactionPlanApplicationExecutorMessage.ActorUnavailable,
        retryable: true,
      },
    });
  });

  test("returns retryable failure when the command pipeline rejects the lifecycle command", async () => {
    const executor = createApplicationReactionPlanActionExecutor({
      commandPipeline: createRejectedCommandPipeline(),
      actorResolver: {
        resolveReactionActor: async () => createManagerActor(),
      },
      createId: () => "cmd-reaction-001",
    });

    const result = await executor.executeReactionPlanAction(createSupervisorTriageAction(), createExecutionContext());

    deepEqual(result, {
      status: ReactionPlanExecutionStatus.Failed,
      failure: {
        message: "reaction command was rejected: schedule authority denied the command",
        retryable: true,
      },
    });
  });

  test("returns retryable failure when the lifecycle command accepts without creating a discussion anchor", async () => {
    const executor = createApplicationReactionPlanActionExecutor({
      commandPipeline: {
        execute: async (command): Promise<CommandResult> => ({
          commandId: command.commandId,
          status: CommandResultStatus.Accepted,
          artifacts: [],
          idempotency: {
            replayed: false,
          },
        }),
      },
      actorResolver: {
        resolveReactionActor: async () => createManagerActor(),
      },
      createId: () => "cmd-reaction-001",
    });

    const result = await executor.executeReactionPlanAction(createSupervisorTriageAction(), createExecutionContext());

    deepEqual(result, {
      status: ReactionPlanExecutionStatus.Failed,
      failure: {
        message: ReactionPlanApplicationExecutorMessage.DiscussionAnchorMissing,
        retryable: true,
      },
    });
  });

  test("returns retryable failure when the lifecycle command returns malformed discussion anchor evidence", async () => {
    const executor = createApplicationReactionPlanActionExecutor({
      commandPipeline: {
        execute: async (command): Promise<CommandResult> => ({
          commandId: command.commandId,
          status: CommandResultStatus.Accepted,
          artifacts: [
            {
              artifactType: CommandResultArtifactType.DiscussionAnchor,
              artifactId: "   ",
            },
          ],
          idempotency: {
            replayed: false,
          },
        }),
      },
      actorResolver: {
        resolveReactionActor: async () => createManagerActor(),
      },
      createId: () => "cmd-reaction-001",
    });

    const result = await executor.executeReactionPlanAction(createSupervisorTriageAction(), createExecutionContext());

    deepEqual(result, {
      status: ReactionPlanExecutionStatus.Failed,
      failure: {
        message: ReactionPlanApplicationExecutorMessage.DiscussionAnchorMissing,
        retryable: true,
      },
    });
  });
});

function createAcceptedCommandPipeline(executedCommands: unknown[]): CommandPipeline {
  return {
    execute: async (command): Promise<CommandResult> => {
      executedCommands.push(command);

      return {
        commandId: command.commandId,
        status: CommandResultStatus.Accepted,
        artifacts: [
          {
            artifactType: CommandResultArtifactType.DiscussionAnchor,
            artifactId: "discussion-anchor-001",
          },
        ],
        idempotency: {
          replayed: false,
        },
      };
    },
  };
}

function createRejectedCommandPipeline(): CommandPipeline {
  return {
    execute: async (command): Promise<CommandResult> => ({
      commandId: command.commandId,
      status: CommandResultStatus.Rejected,
      idempotency: {
        replayed: false,
      },
      error: {
        code: CommandErrorCode.ScheduleAuthorityDenied,
        message: "schedule authority denied the command",
      },
    }),
  };
}

function createManagerActor(): AgenticActor {
  return {
    agentId: "agent-manager-001",
    hatAssignmentId: "hat-manager-001",
  };
}

function createExecutionContext(
  actionIdempotencyKey = "reaction-plan-001:create_supervisor_triage",
): ReactionPlanActionExecutionContext {
  return {
    reactionPlanId: "reaction-plan-001",
    claimId: "reaction-claim-001",
    actionIdempotencyKey,
    claimExpiresAt: "2026-05-29T16:05:00.000Z",
  };
}

function createSupervisorTriageAction() {
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

function createImplementationAssignmentAction() {
  return {
    actionType: ReactionPlanActionType.RequestImplementationAssignment,
    triggerEventId: "evt-work-ready-001",
    organizationId: "org-lfg",
    projectId: "project-agentic-org",
    teamId: "team-runtime",
    workItemId: "work-runtime-001",
    requiredHat: RequiredHat.EngineeringManager,
    reason: ReactionPlanReason.WorkItemEnteredReadyState,
  };
}

function createReviewGateAction() {
  return {
    actionType: ReactionPlanActionType.RequestReviewGate,
    triggerEventId: "evt-work-review-001",
    organizationId: "org-lfg",
    projectId: "project-agentic-org",
    teamId: "team-runtime",
    workItemId: "work-runtime-001",
    requiredHat: RequiredHat.Reviewer,
    reason: ReactionPlanReason.WorkItemEnteredReviewState,
  };
}
