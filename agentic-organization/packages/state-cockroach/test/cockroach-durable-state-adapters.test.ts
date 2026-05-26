import { deepEqual } from "node:assert/strict";
import { describe, test } from "node:test";

import { CommandType, SupervisorChainLevel, SupervisorSignalToolType } from "../../domain/src/index.ts";
import { HatAuthorityDecisionStatus, PolicyDecisionStatus } from "../../policy/src/index.ts";
import {
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
    await adapters.outboxEventSource.claimUnpublishedOutboxEvents({ batchSize: 10 });
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

    deepEqual(executor.statementNames, [
      "find_idempotency_record",
      "claim_unpublished_outbox_events",
      "find_inbox_receipt",
      "record_policy_decision_observation",
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
          statement.name === "record_policy_decision_observation"
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
