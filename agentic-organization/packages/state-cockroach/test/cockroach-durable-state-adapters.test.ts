import { deepEqual } from "node:assert/strict";
import { describe, test } from "node:test";

import { CommandType, SupervisorChainLevel, SupervisorSignalToolType } from "../../domain/src/index.ts";
import { HatAuthorityDecisionStatus, PolicyDecisionStatus } from "../../policy/src/index.ts";
import {
  CockroachCommandStateStoreStatement,
  CockroachDiscussionAnchorStateStoreStatement,
  CockroachEventIngestionStoreStatement,
  CockroachHatAssignmentAuthorityReaderStatement,
  CockroachOutboxEventSourceStatement,
  CockroachPolicyDecisionObservationStoreStatement,
  CockroachQualityGateEvaluationStateReaderStatement,
  CockroachReactionPlanWorkQueueStatement,
  CockroachWorkAnchorStateStoreStatement,
  CockroachWorkScheduleBlockAuthorityReaderStatement,
  createCockroachDurableStateAdapters,
  type CockroachAnySqlStatement,
  type CockroachOrganizationSqlExecutor,
} from "../src/index.ts";

describe("cockroach durable state adapters", () => {
  test("builds all durable Organization state ports from one generic executor", async () => {
    const executor = createRecordingOrganizationSqlExecutor();
    const adapters = createCockroachDurableStateAdapters({
      executor,
    });

    await adapters.commandStateStoreFactory.createCommandStateStore().findIdempotencyRecord("idem-001");
    await adapters.outboxEventSource.claimUnpublishedOutboxEvents({
      batchSize: 10,
      claimId: "outbox-claim-001",
    });
    await adapters.eventIngestionStore.findInboxReceipt({
      eventId: "evt-001",
      consumerName: "v0_automation_planner",
    });
    await adapters.policyDecisionObservationStore.recordPolicyDecisionObservation({
      commandId: "cmd-001",
      commandType: CommandType.SendSupervisorSignal,
      actor: {
        agentId: "agent-001",
        hatAssignmentId: "hat-assignment-001",
      },
      scope: {
        organizationId: "org-lfg",
        projectId: "project-agentic-org",
      },
      toolType: SupervisorSignalToolType.ReportBlocker,
      supervisorChain: {
        sourceLevel: SupervisorChainLevel.TeamMember,
        targetLevel: SupervisorChainLevel.Manager,
      },
      trace: {
        correlationId: "corr-001",
        causationId: "cause-001",
        traceId: "trace-001",
        idempotencyKey: "idem-001",
      },
      decision: {
        status: PolicyDecisionStatus.Denied,
        decisionId: "policy-decision-001",
        policyVersion: "policy-v1",
        reason: HatAuthorityDecisionStatus.ToolDenied,
      },
      observedAt: "2026-05-26T00:00:00.000Z",
    });
    await adapters.discussionAnchorStateReader.findDiscussionAnchor("discussion-anchor-001");
    await adapters.hatAssignmentAuthorityReader.findHatAssignmentAuthority("hat-assignment-dev-001");
    await adapters.qualityGateEvaluationStateReader.listQualityGateEvaluationsForWorkItem({
      organizationId: "org-lfg",
      projectId: "project-agentic-org",
      teamId: "team-runtime",
      workItemId: "work-runtime-001",
    });
    await adapters.reactionPlanWorkQueue.claimPlannedReactionPlans({
      claimId: "reaction-claim-001",
      limit: 1,
      claimedAt: "2026-05-29T16:00:00.000Z",
      claimExpiresAt: "2026-05-29T16:05:00.000Z",
      leaseDurationMs: 300_000,
    });
    await adapters.workScheduleBlockAuthorityReader.findAuthorizingScheduleBlocks({
      agentId: "agent-dev-001",
      hatAssignmentId: "hat-assignment-dev-001",
      evaluatedAt: "2026-05-29T16:00:00.000Z",
    });
    await adapters.workAnchorStateStore.findProject("project-agentic-org");

    deepEqual(executor.statementNames, [
      CockroachCommandStateStoreStatement.FindIdempotencyRecord,
      CockroachOutboxEventSourceStatement.ClaimUnpublishedOutboxEvents,
      CockroachEventIngestionStoreStatement.FindInboxReceipt,
      CockroachPolicyDecisionObservationStoreStatement.RecordPolicyDecisionObservation,
      CockroachDiscussionAnchorStateStoreStatement.FindDiscussionAnchor,
      CockroachHatAssignmentAuthorityReaderStatement.FindHatAssignmentAuthority,
      CockroachQualityGateEvaluationStateReaderStatement.ListQualityGateEvaluationsForWorkItem,
      CockroachReactionPlanWorkQueueStatement.ClaimPlannedReactionPlans,
      CockroachWorkScheduleBlockAuthorityReaderStatement.FindAuthorizingScheduleBlocks,
      CockroachWorkAnchorStateStoreStatement.FindProject,
    ]);
  });
});

function createRecordingOrganizationSqlExecutor(): CockroachOrganizationSqlExecutor & {
  statementNames: string[];
} {
  const statementNames: string[] = [];

  return {
    statementNames,
    execute: async <Row = Record<string, unknown>>(statement: CockroachAnySqlStatement) => {
      statementNames.push(statement.name);

      return {
        rows:
          statement.name === CockroachPolicyDecisionObservationStoreStatement.RecordPolicyDecisionObservation
            ? ([{ policy_decision_id: "policy-decision-001" }] as Row[])
            : ([] as Row[]),
      };
    },
    executeTransaction: async <Result>(
      operation: (executor: {
        execute: <Row = Record<string, unknown>>(statement: CockroachAnySqlStatement) => Promise<{ rows: Row[] }>;
      }) => Promise<Result>,
    ) =>
      await operation({
        execute: async <Row = Record<string, unknown>>(statement: CockroachAnySqlStatement) => {
          statementNames.push(statement.name);

          return {
            rows: [] as Row[],
          };
        },
      }),
  };
}
