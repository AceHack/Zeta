import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import { CommandType, SupervisorChainLevel, SupervisorSignalToolType } from "../../domain/src/index.ts";
import {
  HatAuthorityDecisionStatus,
  PolicyDecisionObservationPersistenceStatus,
  PolicyDecisionStatus,
  type PolicyDecisionObservation,
} from "../../policy/src/index.ts";
import {
  CockroachPolicyDecisionObservationStoreStatement,
  createCockroachPolicyDecisionObservationStore,
  type CockroachPolicyDecisionObservationSqlExecutor,
  type CockroachPolicyDecisionObservationSqlResult,
  type CockroachPolicyDecisionObservationSqlStatement,
} from "../src/cockroach-policy-decision-observation-store.ts";

describe("cockroach policy decision observation store", () => {
  test("records denied policy observations as an idempotent governance ledger row", async () => {
    const executor = createRecordingExecutor();
    const store = createCockroachPolicyDecisionObservationStore({ executor });

    const result = await store.recordPolicyDecisionObservation(createDeniedPolicyDecisionObservation());

    equal(result.status, PolicyDecisionObservationPersistenceStatus.Recorded);
    deepEqual(
      executor.statements.map((statement) => statement.name),
      [CockroachPolicyDecisionObservationStoreStatement.RecordPolicyDecisionObservation],
    );
    deepEqual(executor.statements[0]?.parameters, [
      "policy-decision-denied-001",
      "policy-v1",
      PolicyDecisionStatus.Denied,
      HatAuthorityDecisionStatus.ToolDenied,
      "cmd-supervisor-signal-001",
      CommandType.SendSupervisorSignal,
      "org-lfg",
      "project-agentic-org",
      "team-runtime",
      "work-outbox-001",
      "agent-developer-001",
      "hat-assignment-dev-001",
      SupervisorSignalToolType.ReportBlocker,
      SupervisorChainLevel.TeamMember,
      SupervisorChainLevel.Manager,
      "corr-supervisor-signal-001",
      "cause-team-work-001",
      "trace-supervisor-signal-001",
      "idem-supervisor-signal-001",
      createDeniedPolicyDecisionObservationHash(),
      createDeniedPolicyDecisionObservation(),
      "2026-05-25T20:00:00.000Z",
    ]);
  });

  test("returns duplicate when the decision row already exists", async () => {
    const executor = createRecordingExecutor({
      recordInserted: false,
      existingObservationHash: createDeniedPolicyDecisionObservationHash(),
    });
    const store = createCockroachPolicyDecisionObservationStore({ executor });

    const result = await store.recordPolicyDecisionObservation(createDeniedPolicyDecisionObservation());

    equal(result.status, PolicyDecisionObservationPersistenceStatus.Duplicate);
  });

  test("treats observation timestamp drift as a duplicate replay", async () => {
    const executor = createRecordingExecutor({
      recordInserted: false,
      existingObservationHash: createDeniedPolicyDecisionObservationHash(),
    });
    const store = createCockroachPolicyDecisionObservationStore({ executor });

    const result = await store.recordPolicyDecisionObservation({
      ...createDeniedPolicyDecisionObservation(),
      observedAt: "2026-05-25T20:05:00.000Z",
    });

    equal(result.status, PolicyDecisionObservationPersistenceStatus.Duplicate);
  });

  test("hashes omitted and undefined optional evidence the same way as JSON persistence", async () => {
    const omittedExecutor = createRecordingExecutor();
    const undefinedExecutor = createRecordingExecutor();
    const omittedStore = createCockroachPolicyDecisionObservationStore({ executor: omittedExecutor });
    const undefinedStore = createCockroachPolicyDecisionObservationStore({ executor: undefinedExecutor });

    await omittedStore.recordPolicyDecisionObservation(createMinimalDeniedPolicyDecisionObservation());
    await undefinedStore.recordPolicyDecisionObservation(
      createMinimalDeniedPolicyDecisionObservationWithUndefinedOptionals(),
    );

    equal(getRecordedObservationHash(omittedExecutor), getRecordedObservationHash(undefinedExecutor));
  });

  test("returns conflict when the decision row exists with different observation evidence", async () => {
    const executor = createRecordingExecutor({
      recordInserted: false,
      existingObservationHash: "sha256:different-observation-payload",
    });
    const store = createCockroachPolicyDecisionObservationStore({ executor });

    const result = await store.recordPolicyDecisionObservation(createDeniedPolicyDecisionObservation());

    equal(result.status, PolicyDecisionObservationPersistenceStatus.Conflict);
    deepEqual(
      executor.statements.map((statement) => statement.name),
      [
        CockroachPolicyDecisionObservationStoreStatement.RecordPolicyDecisionObservation,
        CockroachPolicyDecisionObservationStoreStatement.FindPolicyDecisionObservationHash,
      ],
    );
  });

  test("queries observations by work item through typed visibility filters", async () => {
    const executor = createRecordingExecutor({
      queryRows: [
        {
          observation_json: createDeniedPolicyDecisionObservation(),
          team_id: null,
          work_item_id: null,
          tool_type: null,
          source_level: null,
          target_level: null,
        },
      ],
    });
    const store = createCockroachPolicyDecisionObservationStore({ executor });

    const observations = await store.findPolicyDecisionObservations({
      organizationId: "org-lfg",
      projectId: "project-agentic-org",
      workItemId: "work-outbox-001",
      decisionStatus: PolicyDecisionStatus.Denied,
      limit: 25,
    });

    deepEqual(
      executor.statements.map((statement) => statement.name),
      [CockroachPolicyDecisionObservationStoreStatement.FindPolicyDecisionObservations],
    );
    equal(executor.statements[0]?.sql.includes("organization_id = $1"), true);
    equal(executor.statements[0]?.sql.includes("project_id = $2"), true);
    equal(executor.statements[0]?.sql.includes("work_item_id = $3"), true);
    equal(executor.statements[0]?.sql.includes("decision_status = $4"), true);
    deepEqual(executor.statements[0]?.parameters, [
      "org-lfg",
      "project-agentic-org",
      "work-outbox-001",
      PolicyDecisionStatus.Denied,
      25,
    ]);
    deepEqual(observations, [createDeniedPolicyDecisionObservation()]);
  });
});

type RecordingPolicyDecisionObservationExecutor = CockroachPolicyDecisionObservationSqlExecutor & {
  statements: CockroachPolicyDecisionObservationSqlStatement[];
};

function createRecordingExecutor(
  input: {
    recordInserted?: boolean;
    existingObservationHash?: string;
    queryRows?: readonly Record<string, unknown>[];
  } = {},
): RecordingPolicyDecisionObservationExecutor {
  const statements: CockroachPolicyDecisionObservationSqlStatement[] = [];

  return {
    statements,
    execute: async <Row = Record<string, unknown>>(statement: CockroachPolicyDecisionObservationSqlStatement) => {
      statements.push(statement);

      if (statement.name === CockroachPolicyDecisionObservationStoreStatement.RecordPolicyDecisionObservation) {
        return {
          rows: input.recordInserted === false ? [] : ([{ policy_decision_id: "policy-decision-denied-001" }] as Row[]),
        };
      }

      if (statement.name === CockroachPolicyDecisionObservationStoreStatement.FindPolicyDecisionObservationHash) {
        return {
          rows:
            input.existingObservationHash === undefined
              ? []
              : ([
                  {
                    observation_hash: input.existingObservationHash,
                  },
                ] as Row[]),
        } satisfies CockroachPolicyDecisionObservationSqlResult<Row>;
      }

      return {
        rows: (input.queryRows ?? []) as Row[],
      };
    },
  };
}

function createDeniedPolicyDecisionObservationHash(): string {
  return "sha256:ed890dae6f9a6afb4330ae282e70b23da4c14e1efc3831de68711d3604f29743";
}

function getRecordedObservationHash(executor: RecordingPolicyDecisionObservationExecutor): unknown {
  return executor.statements[0]?.parameters[19];
}

function createDeniedPolicyDecisionObservation(): PolicyDecisionObservation {
  return {
    commandId: "cmd-supervisor-signal-001",
    commandType: CommandType.SendSupervisorSignal,
    actor: {
      agentId: "agent-developer-001",
      hatAssignmentId: "hat-assignment-dev-001",
    },
    scope: {
      organizationId: "org-lfg",
      projectId: "project-agentic-org",
      teamId: "team-runtime",
      workItemId: "work-outbox-001",
    },
    toolType: SupervisorSignalToolType.ReportBlocker,
    supervisorChain: {
      sourceLevel: SupervisorChainLevel.TeamMember,
      targetLevel: SupervisorChainLevel.Manager,
    },
    trace: {
      correlationId: "corr-supervisor-signal-001",
      causationId: "cause-team-work-001",
      traceId: "trace-supervisor-signal-001",
      idempotencyKey: "idem-supervisor-signal-001",
    },
    decision: {
      status: PolicyDecisionStatus.Denied,
      decisionId: "policy-decision-denied-001",
      policyVersion: "policy-v1",
      reason: HatAuthorityDecisionStatus.ToolDenied,
    },
    observedAt: "2026-05-25T20:00:00.000Z",
  };
}

function createMinimalDeniedPolicyDecisionObservation(): PolicyDecisionObservation {
  return {
    commandId: "cmd-supervisor-signal-001",
    commandType: CommandType.SendSupervisorSignal,
    actor: {
      agentId: "agent-developer-001",
      hatAssignmentId: "hat-assignment-dev-001",
    },
    scope: {
      organizationId: "org-lfg",
      projectId: "project-agentic-org",
    },
    trace: {
      correlationId: "corr-supervisor-signal-001",
      causationId: "cause-team-work-001",
      traceId: "trace-supervisor-signal-001",
      idempotencyKey: "idem-supervisor-signal-001",
    },
    decision: {
      status: PolicyDecisionStatus.Denied,
      decisionId: "policy-decision-denied-001",
      policyVersion: "policy-v1",
      reason: HatAuthorityDecisionStatus.ToolDenied,
    },
    observedAt: "2026-05-25T20:00:00.000Z",
  };
}

function createMinimalDeniedPolicyDecisionObservationWithUndefinedOptionals(): PolicyDecisionObservation {
  return {
    ...createMinimalDeniedPolicyDecisionObservation(),
    toolType: undefined,
    supervisorChain: undefined,
    scope: {
      ...createMinimalDeniedPolicyDecisionObservation().scope,
      teamId: undefined,
      workItemId: undefined,
    },
  } as unknown as PolicyDecisionObservation;
}
