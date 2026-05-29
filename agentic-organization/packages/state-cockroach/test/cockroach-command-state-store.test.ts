import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  CommandOutcomeEffectConflictReason,
  CommandOutcomePersistenceStatus,
  CommandResultStatus,
  type CommandResult,
  type RecordCommandOutcomeInput,
} from "../../application/src/index.ts";
import {
  AgenticAggregateType,
  AgenticEventType,
  BusinessRuleEvaluationStatus,
  DiscussionAnchorType,
  DiscussionExpectedOutput,
  ProjectStatus,
  QualityGateKind,
  QualityGateOutcome,
  ScheduleBlockState,
  ScheduleBlockType,
  SupervisorChainLevel,
  SupervisorSignalStatus,
  SupervisorSignalToolType,
  WorkItemState,
  WorkItemType,
} from "../../domain/src/index.ts";
import {
  CockroachCommandStateStoreStatement,
  createCockroachCommandStateStoreFactory,
  type CockroachSqlExecutor,
} from "../src/cockroach-command-state-store.ts";
import { CockroachWorkAnchorStateStoreStatement } from "../src/cockroach-work-anchor-state-store.ts";

describe("cockroach command state store", () => {
  test("records command outcome in one transaction batch", async () => {
    const executor = createRecordingExecutor();
    const factory = createCockroachCommandStateStoreFactory<CommandResult>({
      executor,
    });
    const store = factory.createCommandStateStore();

    equal(await store.findIdempotencyRecord("idem-001"), undefined);

    const result = await store.recordCommandOutcome(createCommandOutcome());

    equal(result.status, CommandOutcomePersistenceStatus.Committed);
    deepEqual(
      executor.statements.map((statement) => statement.name),
      [
        CockroachCommandStateStoreStatement.FindIdempotencyRecord,
        CockroachCommandStateStoreStatement.ClaimIdempotencyRecord,
        CockroachCommandStateStoreStatement.InsertSupervisorSignal,
        CockroachCommandStateStoreStatement.InsertDiscussionAnchor,
        CockroachCommandStateStoreStatement.InsertDecisionRecord,
        CockroachCommandStateStoreStatement.InsertQualityGateEvaluation,
        CockroachCommandStateStoreStatement.FindOverlappingWorkScheduleBlock,
        CockroachCommandStateStoreStatement.InsertWorkScheduleBlock,
        CockroachCommandStateStoreStatement.InsertAuditEvent,
        CockroachCommandStateStoreStatement.InsertOutboxEvent,
      ],
    );
    deepEqual(
      executor.transactionStatements.map((statement) => statement.name),
      [
        CockroachCommandStateStoreStatement.ClaimIdempotencyRecord,
        CockroachCommandStateStoreStatement.InsertSupervisorSignal,
        CockroachCommandStateStoreStatement.InsertDiscussionAnchor,
        CockroachCommandStateStoreStatement.InsertDecisionRecord,
        CockroachCommandStateStoreStatement.InsertQualityGateEvaluation,
        CockroachCommandStateStoreStatement.FindOverlappingWorkScheduleBlock,
        CockroachCommandStateStoreStatement.InsertWorkScheduleBlock,
        CockroachCommandStateStoreStatement.InsertAuditEvent,
        CockroachCommandStateStoreStatement.InsertOutboxEvent,
      ],
    );
    equal(executor.transactionStatements[0]?.sql.includes("INSERT INTO"), true);
    equal(executor.transactionStatements[0]?.sql.includes("UPSERT"), false);
    deepEqual(executor.transactionStatements[7]?.parameters.slice(6), ["policy-decision-allow-001", "policy-v1"]);
  });

  test("does not insert effects when idempotency claim replays or conflicts", async () => {
    const replayExecutor = createRecordingExecutor({
      claimStatus: CommandOutcomePersistenceStatus.Replayed,
    });
    const replayStore = createCockroachCommandStateStoreFactory<CommandResult>({
      executor: replayExecutor,
    }).createCommandStateStore();

    const replayResult = await replayStore.recordCommandOutcome(createCommandOutcome());

    equal(replayResult.status, CommandOutcomePersistenceStatus.Replayed);
    deepEqual(
      replayExecutor.transactionStatements.map((statement) => statement.name),
      [CockroachCommandStateStoreStatement.ClaimIdempotencyRecord],
    );

    const conflictExecutor = createRecordingExecutor({
      claimStatus: CommandOutcomePersistenceStatus.IdempotencyConflict,
    });
    const conflictStore = createCockroachCommandStateStoreFactory<CommandResult>({
      executor: conflictExecutor,
    }).createCommandStateStore();

    const conflictResult = await conflictStore.recordCommandOutcome(createCommandOutcome());

    equal(conflictResult.status, CommandOutcomePersistenceStatus.IdempotencyConflict);
    deepEqual(
      conflictExecutor.transactionStatements.map((statement) => statement.name),
      [CockroachCommandStateStoreStatement.ClaimIdempotencyRecord],
    );
  });

  test("rejects unsupported V0 discussion anchor effect types after claiming idempotency", async () => {
    const executor = createRecordingExecutor();
    const store = createCockroachCommandStateStoreFactory<CommandResult>({
      executor,
    }).createCommandStateStore();
    const outcome = createCommandOutcome();

    const result = await store.recordCommandOutcome({
      ...outcome,
      effects: {
        ...outcome.effects,
        discussionAnchors: [
          {
            ...outcome.effects.discussionAnchors[0]!,
            discussionAnchorType: DiscussionAnchorType.Project,
          },
        ],
      },
    });

    equal(result.status, CommandOutcomePersistenceStatus.EffectConflict);
    if (result.status !== CommandOutcomePersistenceStatus.EffectConflict) {
      throw new Error("expected effect conflict");
    }
    equal(result.reason, CommandOutcomeEffectConflictReason.UnsupportedDiscussionAnchorEffectType);
    deepEqual(
      executor.transactionStatements.map((statement) => statement.name),
      [CockroachCommandStateStoreStatement.ClaimIdempotencyRecord],
    );
  });

  test("lets idempotency replay win over unsupported effect validation", async () => {
    const executor = createRecordingExecutor({
      claimStatus: CommandOutcomePersistenceStatus.Replayed,
    });
    const store = createCockroachCommandStateStoreFactory<CommandResult>({
      executor,
    }).createCommandStateStore();
    const outcome = createUnsupportedDiscussionAnchorOutcome();

    const result = await store.recordCommandOutcome(outcome);

    equal(result.status, CommandOutcomePersistenceStatus.Replayed);
    deepEqual(
      executor.transactionStatements.map((statement) => statement.name),
      [CockroachCommandStateStoreStatement.ClaimIdempotencyRecord],
    );
  });

  test("lets idempotency conflict win over unsupported effect validation", async () => {
    const executor = createRecordingExecutor({
      claimStatus: CommandOutcomePersistenceStatus.IdempotencyConflict,
    });
    const store = createCockroachCommandStateStoreFactory<CommandResult>({
      executor,
    }).createCommandStateStore();
    const outcome = createUnsupportedDiscussionAnchorOutcome();

    const result = await store.recordCommandOutcome(outcome);

    equal(result.status, CommandOutcomePersistenceStatus.IdempotencyConflict);
    deepEqual(
      executor.transactionStatements.map((statement) => statement.name),
      [CockroachCommandStateStoreStatement.ClaimIdempotencyRecord],
    );
  });

  test("normalizes missing optional audit policy evidence to SQL nulls", async () => {
    const executor = createRecordingExecutor();
    const store = createCockroachCommandStateStoreFactory<CommandResult>({
      executor,
    }).createCommandStateStore();

    await store.recordCommandOutcome(createCommandOutcome({ includeAuditPolicyEvidence: false }));

    const insertAuditEvent = executor.transactionStatements.find(
      (statement) => statement.name === CockroachCommandStateStoreStatement.InsertAuditEvent,
    );

    deepEqual(insertAuditEvent?.parameters.slice(6), [null, null]);
  });

  test("records work-anchor effects in the command outcome transaction", async () => {
    const executor = createRecordingExecutor();
    const store = createCockroachCommandStateStoreFactory<CommandResult>({
      executor,
    }).createCommandStateStore();

    const result = await store.recordCommandOutcome(createCommandOutcome({ includeWorkAnchorEffects: true }));

    equal(result.status, CommandOutcomePersistenceStatus.Committed);
    deepEqual(
      executor.transactionStatements.map((statement) => statement.name),
      [
        CockroachCommandStateStoreStatement.ClaimIdempotencyRecord,
        CockroachCommandStateStoreStatement.InsertSupervisorSignal,
        CockroachCommandStateStoreStatement.InsertDiscussionAnchor,
        CockroachCommandStateStoreStatement.InsertDecisionRecord,
        CockroachCommandStateStoreStatement.InsertQualityGateEvaluation,
        CockroachCommandStateStoreStatement.FindOverlappingWorkScheduleBlock,
        CockroachCommandStateStoreStatement.InsertWorkScheduleBlock,
        CockroachWorkAnchorStateStoreStatement.InsertProject,
        CockroachWorkAnchorStateStoreStatement.InsertWorkItem,
        CockroachWorkAnchorStateStoreStatement.FindWorkItemForTransition,
        CockroachWorkAnchorStateStoreStatement.FindTransitionId,
        CockroachWorkAnchorStateStoreStatement.FindTransitionSequence,
        CockroachWorkAnchorStateStoreStatement.UpdateWorkItemForTransition,
        CockroachWorkAnchorStateStoreStatement.InsertWorkItemStateHistory,
        CockroachCommandStateStoreStatement.InsertAuditEvent,
        CockroachCommandStateStoreStatement.InsertOutboxEvent,
      ],
    );
  });

  test("records discussion anchor effects with full traceability", async () => {
    const executor = createRecordingExecutor();
    const store = createCockroachCommandStateStoreFactory<CommandResult>({
      executor,
    }).createCommandStateStore();

    await store.recordCommandOutcome(createCommandOutcome());

    const insertDiscussionAnchor = executor.transactionStatements.find(
      (statement) => statement.name === CockroachCommandStateStoreStatement.InsertDiscussionAnchor,
    );

    equal(insertDiscussionAnchor?.sql.includes("$9::JSONB"), true);
    deepEqual(insertDiscussionAnchor?.parameters, [
      "discussion-anchor-001",
      "org-lfg",
      "project-agentic-org",
      "team-runtime",
      "work-outbox-001",
      DiscussionAnchorType.WorkItem,
      "Review scoped NATS publisher",
      "Coordinate the evidence needed before review starts.",
      JSON.stringify([DiscussionExpectedOutput.Decision]),
      "agent-developer-001",
      "hat-assignment-dev-001",
      "2026-05-25T20:00:00.000Z",
      "2026-05-25T20:00:00.000Z",
      1,
      "corr-001",
      "cause-001",
      "trace-001",
    ]);
  });

  test("records decision record effects with full traceability", async () => {
    const executor = createRecordingExecutor();
    const store = createCockroachCommandStateStoreFactory<CommandResult>({
      executor,
    }).createCommandStateStore();

    await store.recordCommandOutcome(createCommandOutcome());

    const insertDecisionRecord = executor.transactionStatements.find(
      (statement) => statement.name === CockroachCommandStateStoreStatement.InsertDecisionRecord,
    );

    equal(insertDecisionRecord?.sql.includes("$10::JSONB"), true);
    equal(insertDecisionRecord?.sql.includes("$11::JSONB"), true);
    deepEqual(insertDecisionRecord?.parameters, [
      "decision-record-001",
      "org-lfg",
      "project-agentic-org",
      "team-runtime",
      "work-outbox-001",
      "discussion-anchor-001",
      "Review scoped NATS publisher decision",
      "Proceed with review once evidence is attached.",
      "The command outcome path is deterministic and auditable.",
      JSON.stringify(["Delay review until live NATS is available"]),
      JSON.stringify(["work-evidence-001"]),
      "agent-developer-001",
      "hat-assignment-dev-001",
      "2026-05-25T20:10:00.000Z",
      "2026-05-25T20:10:00.000Z",
      1,
      "corr-001",
      "cause-001",
      "trace-001",
    ]);
  });

  test("records work schedule block effects with full traceability", async () => {
    const executor = createRecordingExecutor();
    const store = createCockroachCommandStateStoreFactory<CommandResult>({
      executor,
    }).createCommandStateStore();

    await store.recordCommandOutcome(createCommandOutcome());

    const insertScheduleBlock = executor.transactionStatements.find(
      (statement) => statement.name === CockroachCommandStateStoreStatement.InsertWorkScheduleBlock,
    );

    deepEqual(insertScheduleBlock?.parameters, [
      "work-schedule-block-001",
      "org-lfg",
      "project-agentic-org",
      "team-runtime",
      "work-outbox-001",
      "discussion-anchor-001",
      "agent-developer-001",
      "hat-assignment-dev-001",
      ScheduleBlockType.PrioritizedWork,
      ScheduleBlockState.Scheduled,
      "Focused implementation block",
      "Allocate focused implementation time.",
      "2026-05-25T20:15:00.000Z",
      "2026-05-25T21:00:00.000Z",
      "agent-developer-001",
      "hat-assignment-dev-001",
      "2026-05-25T20:10:00.000Z",
      "2026-05-25T20:10:00.000Z",
      1,
      "corr-001",
      "cause-001",
      "trace-001",
    ]);
  });

  test("records quality gate evaluation effects with full traceability", async () => {
    const executor = createRecordingExecutor();
    const store = createCockroachCommandStateStoreFactory<CommandResult>({
      executor,
    }).createCommandStateStore();

    await store.recordCommandOutcome(createCommandOutcome());

    const insertQualityGateEvaluation = executor.transactionStatements.find(
      (statement) => statement.name === CockroachCommandStateStoreStatement.InsertQualityGateEvaluation,
    );

    equal(insertQualityGateEvaluation?.sql.includes("$10::JSONB"), true);
    equal(insertQualityGateEvaluation?.sql.includes("$11::JSONB"), true);
    deepEqual(insertQualityGateEvaluation?.parameters, [
      "quality-gate-evaluation-001",
      "org-lfg",
      "project-agentic-org",
      "team-runtime",
      "work-outbox-001",
      "discussion-anchor-001",
      QualityGateKind.FinalBusinessValidation,
      QualityGateOutcome.Approved,
      "Business rules are satisfied for release.",
      JSON.stringify(["brd-001", "qa-report-001"]),
      JSON.stringify([
        {
          ruleId: "BRD-001",
          status: BusinessRuleEvaluationStatus.Satisfied,
          evidenceArtifactIds: ["qa-report-001"],
          notes: "Validated against the business rule.",
        },
      ]),
      "agent-developer-001",
      "hat-assignment-dev-001",
      "2026-05-25T20:11:00.000Z",
      "2026-05-25T20:11:00.000Z",
      1,
      "corr-001",
      "cause-001",
      "trace-001",
    ]);
  });

  test("rejects overlapping work schedule blocks before inserting later effects", async () => {
    const executor = createRecordingExecutor({
      hasOverlappingScheduleBlock: true,
    });
    const store = createCockroachCommandStateStoreFactory<CommandResult>({
      executor,
    }).createCommandStateStore();

    const result = await store.recordCommandOutcome(createCommandOutcome());

    equal(result.status, CommandOutcomePersistenceStatus.EffectConflict);
    if (result.status !== CommandOutcomePersistenceStatus.EffectConflict) {
      throw new Error("expected effect conflict");
    }
    equal(result.reason, CommandOutcomeEffectConflictReason.WorkScheduleBlockOverlap);
    deepEqual(
      executor.transactionStatements.map((statement) => statement.name),
      [
        CockroachCommandStateStoreStatement.ClaimIdempotencyRecord,
        CockroachCommandStateStoreStatement.InsertSupervisorSignal,
        CockroachCommandStateStoreStatement.InsertDiscussionAnchor,
        CockroachCommandStateStoreStatement.InsertDecisionRecord,
        CockroachCommandStateStoreStatement.InsertQualityGateEvaluation,
        CockroachCommandStateStoreStatement.FindOverlappingWorkScheduleBlock,
      ],
    );
  });

  test("returns typed effect conflict when work-anchor command effects conflict", async () => {
    const executor = createRecordingExecutor({
      failWorkAnchorProjectInsert: true,
    });
    const store = createCockroachCommandStateStoreFactory<CommandResult>({
      executor,
    }).createCommandStateStore();

    const result = await store.recordCommandOutcome(createCommandOutcome({ includeWorkAnchorEffects: true }));

    equal(result.status, CommandOutcomePersistenceStatus.EffectConflict);
    if (result.status !== CommandOutcomePersistenceStatus.EffectConflict) {
      throw new Error("expected effect conflict");
    }
    equal(result.reason, CommandOutcomeEffectConflictReason.WorkAnchorEffectConflict);
    deepEqual(
      executor.transactionStatements.map((statement) => statement.name),
      [
        CockroachCommandStateStoreStatement.ClaimIdempotencyRecord,
        CockroachCommandStateStoreStatement.InsertSupervisorSignal,
        CockroachCommandStateStoreStatement.InsertDiscussionAnchor,
        CockroachCommandStateStoreStatement.InsertDecisionRecord,
        CockroachCommandStateStoreStatement.InsertQualityGateEvaluation,
        CockroachCommandStateStoreStatement.FindOverlappingWorkScheduleBlock,
        CockroachCommandStateStoreStatement.InsertWorkScheduleBlock,
        CockroachWorkAnchorStateStoreStatement.InsertProject,
      ],
    );
  });
});

type RecordingCockroachSqlExecutor = CockroachSqlExecutor & {
  statements: { name: CockroachCommandStateStoreStatement | CockroachWorkAnchorStateStoreStatement; sql: string; parameters: readonly unknown[] }[];
  transactionStatements: { name: CockroachCommandStateStoreStatement | CockroachWorkAnchorStateStoreStatement; sql: string; parameters: readonly unknown[] }[];
};

function createRecordingExecutor(
  input: {
    claimStatus?: CommandOutcomePersistenceStatus;
    failWorkAnchorProjectInsert?: boolean;
    hasOverlappingScheduleBlock?: boolean;
  } = {},
): RecordingCockroachSqlExecutor {
  const statements: { name: CockroachCommandStateStoreStatement | CockroachWorkAnchorStateStoreStatement; sql: string; parameters: readonly unknown[] }[] = [];
  const transactionStatements: {
    name: CockroachCommandStateStoreStatement | CockroachWorkAnchorStateStoreStatement;
    sql: string;
    parameters: readonly unknown[];
  }[] = [];

  return {
    statements,
    transactionStatements,
    execute: async (statement) => {
      statements.push(statement);
      return {
        rows: [],
      };
    },
    executeTransaction: async (operation) =>
      await operation({
        execute: async <Row = Record<string, unknown>>(statement: {
          name: CockroachCommandStateStoreStatement | CockroachWorkAnchorStateStoreStatement;
          sql: string;
          parameters: readonly unknown[];
        }) => {
          transactionStatements.push(statement);
          statements.push(statement);

          if (statement.name === CockroachCommandStateStoreStatement.ClaimIdempotencyRecord) {
            return {
              rows: [
                {
                  persistence_status: input.claimStatus ?? CommandOutcomePersistenceStatus.Committed,
                  request_hash: "hash-001",
                  result_json: {
                    status: CommandResultStatus.Accepted,
                    idempotency: {
                      replayed: false,
                    },
                  },
                },
              ] as readonly unknown[] as readonly Row[],
            };
          }

          if (statement.name === CockroachCommandStateStoreStatement.FindOverlappingWorkScheduleBlock) {
            return {
              rows:
                input.hasOverlappingScheduleBlock === true
                  ? ([{ work_schedule_block_id: "work-schedule-block-existing-001" }] as readonly unknown[] as readonly Row[])
                  : [],
            };
          }

          if (statement.name === CockroachWorkAnchorStateStoreStatement.InsertProject) {
            return {
              rows:
                input.failWorkAnchorProjectInsert === true
                  ? []
                  : ([{ id: statement.parameters[0] }] as readonly unknown[] as readonly Row[]),
            };
          }

          if (statement.name === CockroachWorkAnchorStateStoreStatement.InsertWorkItem) {
            return {
              rows: [{ id: statement.parameters[0] }] as readonly unknown[] as readonly Row[],
            };
          }

          if (statement.name === CockroachWorkAnchorStateStoreStatement.FindWorkItemForTransition) {
            return {
              rows: [
                {
                  work_item_id: "work-command-effect-001",
                  organization_id: "org-lfg",
                  project_id: "project-agentic-org",
                  initiative_id: null,
                  work_item_type: WorkItemType.Task,
                  title: "Command effect work item",
                  description: "Created through command effects.",
                  state: WorkItemState.Created,
                  created_at: "2026-05-25T20:00:00.000Z",
                  updated_at: "2026-05-25T20:00:00.000Z",
                  version: 1,
                  created_by_agent_id: "agent-developer-001",
                  created_by_hat_assignment_id: "hat-assignment-dev-001",
                  correlation_id: "corr-001",
                  causation_id: "cause-001",
                  trace_id: "trace-001",
                },
              ] as readonly unknown[] as readonly Row[],
            };
          }

          if (statement.name === CockroachWorkAnchorStateStoreStatement.UpdateWorkItemForTransition) {
            return {
              rows: [{ id: statement.parameters[10] }] as readonly unknown[] as readonly Row[],
            };
          }

          if (statement.name === CockroachWorkAnchorStateStoreStatement.InsertWorkItemStateHistory) {
            return {
              rows: [{ id: statement.parameters[0] }] as readonly unknown[] as readonly Row[],
            };
          }

          return {
            rows: [],
          };
        },
      }),
  };
}

function createUnsupportedDiscussionAnchorOutcome(): RecordCommandOutcomeInput<CommandResult> {
  const outcome = createCommandOutcome();

  return {
    ...outcome,
    effects: {
      ...outcome.effects,
      discussionAnchors: [
        {
          ...outcome.effects.discussionAnchors[0]!,
          discussionAnchorType: DiscussionAnchorType.Project,
        },
      ],
    },
  };
}

function createCommandOutcome(
  input: { includeAuditPolicyEvidence?: boolean; includeWorkAnchorEffects?: boolean } = {},
): RecordCommandOutcomeInput<CommandResult> {
  const includeAuditPolicyEvidence = input.includeAuditPolicyEvidence ?? true;

  return {
    idempotencyRecord: {
      idempotencyKey: "idem-001",
      requestHash: "hash-001",
      result: {
        status: CommandResultStatus.Accepted,
        idempotency: {
          replayed: false,
        },
      },
    },
    effects: {
      supervisorSignals: [
        {
          supervisorSignalId: "supervisor-signal-001",
          organizationId: "org-lfg",
          projectId: "project-agentic-org",
          teamId: "team-runtime",
          sourceLevel: SupervisorChainLevel.TeamMember,
          targetLevel: SupervisorChainLevel.Manager,
          targetHatAssignmentId: "hat-assignment-em-001",
          sender: {
            agentId: "agent-developer-001",
            hatAssignmentId: "hat-assignment-dev-001",
          },
          toolType: SupervisorSignalToolType.ReportBlocker,
          status: SupervisorSignalStatus.Sent,
          title: "Blocked on scoped NATS publisher",
          message: "Need a scoped publisher decision.",
          relatedWorkItemId: "work-outbox-001",
          createdAt: "2026-05-25T20:00:00.000Z",
        },
      ],
      discussionAnchors: [
        {
          discussionAnchorId: "discussion-anchor-001",
          organizationId: "org-lfg",
          projectId: "project-agentic-org",
          teamId: "team-runtime",
          workItemId: "work-outbox-001",
          discussionAnchorType: DiscussionAnchorType.WorkItem,
          title: "Review scoped NATS publisher",
          purpose: "Coordinate the evidence needed before review starts.",
          expectedOutputs: [DiscussionExpectedOutput.Decision],
          createdAt: "2026-05-25T20:00:00.000Z",
          createdBy: {
            agentId: "agent-developer-001",
            hatAssignmentId: "hat-assignment-dev-001",
          },
          metadata: {
            updatedAt: "2026-05-25T20:00:00.000Z",
            version: 1,
            correlationId: "corr-001",
            causationId: "cause-001",
            traceId: "trace-001",
          },
        },
      ],
      decisionRecords: [
        {
          decisionRecordId: "decision-record-001",
          organizationId: "org-lfg",
          projectId: "project-agentic-org",
          teamId: "team-runtime",
          workItemId: "work-outbox-001",
          discussionAnchorId: "discussion-anchor-001",
          title: "Review scoped NATS publisher decision",
          decision: "Proceed with review once evidence is attached.",
          rationale: "The command outcome path is deterministic and auditable.",
          alternativesConsidered: ["Delay review until live NATS is available"],
          followUpWorkItemIds: ["work-evidence-001"],
          decidedAt: "2026-05-25T20:10:00.000Z",
          decidedBy: {
            agentId: "agent-developer-001",
            hatAssignmentId: "hat-assignment-dev-001",
          },
          metadata: {
            updatedAt: "2026-05-25T20:10:00.000Z",
            version: 1,
            correlationId: "corr-001",
            causationId: "cause-001",
            traceId: "trace-001",
          },
        },
      ],
      qualityGateEvaluations: [
        {
          qualityGateEvaluationId: "quality-gate-evaluation-001",
          organizationId: "org-lfg",
          projectId: "project-agentic-org",
          teamId: "team-runtime",
          workItemId: "work-outbox-001",
          discussionAnchorId: "discussion-anchor-001",
          gateKind: QualityGateKind.FinalBusinessValidation,
          outcome: QualityGateOutcome.Approved,
          summary: "Business rules are satisfied for release.",
          evaluatedArtifactIds: ["brd-001", "qa-report-001"],
          businessRuleResults: [
            {
              ruleId: "BRD-001",
              status: BusinessRuleEvaluationStatus.Satisfied,
              evidenceArtifactIds: ["qa-report-001"],
              notes: "Validated against the business rule.",
            },
          ],
          evaluatedAt: "2026-05-25T20:11:00.000Z",
          evaluatedBy: {
            agentId: "agent-developer-001",
            hatAssignmentId: "hat-assignment-dev-001",
          },
          metadata: {
            updatedAt: "2026-05-25T20:11:00.000Z",
            version: 1,
            correlationId: "corr-001",
            causationId: "cause-001",
            traceId: "trace-001",
          },
        },
      ],
      workScheduleBlocks: [
        {
          workScheduleBlockId: "work-schedule-block-001",
          organizationId: "org-lfg",
          projectId: "project-agentic-org",
          teamId: "team-runtime",
          workItemId: "work-outbox-001",
          discussionAnchorId: "discussion-anchor-001",
          assignedAgentId: "agent-developer-001",
          assignedHatAssignmentId: "hat-assignment-dev-001",
          blockType: ScheduleBlockType.PrioritizedWork,
          state: ScheduleBlockState.Scheduled,
          title: "Focused implementation block",
          purpose: "Allocate focused implementation time.",
          startsAt: "2026-05-25T20:15:00.000Z",
          endsAt: "2026-05-25T21:00:00.000Z",
          scheduledAt: "2026-05-25T20:10:00.000Z",
          scheduledBy: {
            agentId: "agent-developer-001",
            hatAssignmentId: "hat-assignment-dev-001",
          },
          metadata: {
            updatedAt: "2026-05-25T20:10:00.000Z",
            version: 1,
            correlationId: "corr-001",
            causationId: "cause-001",
            traceId: "trace-001",
          },
        },
      ],
      auditEvents: [
        {
          auditEventId: "audit-001",
          eventName: AgenticEventType.SupervisorSignalSent,
          aggregateId: "supervisor-signal-001",
          actor: {
            agentId: "agent-developer-001",
            hatAssignmentId: "hat-assignment-dev-001",
          },
          ...(includeAuditPolicyEvidence
            ? {
                policy: {
                  decisionId: "policy-decision-allow-001",
                  policyVersion: "policy-v1",
                },
              }
            : {}),
          occurredAt: "2026-05-25T20:00:00.000Z",
        },
      ],
      outboxEvents: [
        {
          outboxEventId: "outbox-001",
          envelope: {
            eventId: "evt-001",
            eventType: AgenticEventType.SupervisorSignalSent,
            schemaVersion: "agentic.org.event.v1",
            occurredAt: "2026-05-25T20:00:00.000Z",
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
            aggregate: {
              aggregateId: "supervisor-signal-001",
              aggregateType: AgenticAggregateType.SupervisorSignal,
              aggregateVersion: 1,
            },
            trace: {
              commandId: "cmd-001",
              correlationId: "corr-001",
              causationId: "cause-001",
              traceId: "trace-001",
              idempotencyKey: "idem-001",
            },
            policy: {
              decisionId: "policy-decision-allow-001",
              policyVersion: "policy-v1",
            },
            replay: {
              isReplay: false,
            },
            payload: {
              title: "Blocked on scoped NATS publisher",
            },
          },
        },
      ],
      ...(input.includeWorkAnchorEffects === true
        ? {
            workAnchors: {
              projects: [
                {
                  projectId: "project-agentic-org",
                  organizationId: "org-lfg",
                  name: "Agentic Organization",
                  status: ProjectStatus.Active,
                  createdAt: "2026-05-25T20:00:00.000Z",
                  createdBy: {
                    agentId: "agent-developer-001",
                    hatAssignmentId: "hat-assignment-dev-001",
                  },
                  metadata: {
                    updatedAt: "2026-05-25T20:00:00.000Z",
                    version: 1,
                    correlationId: "corr-001",
                    causationId: "cause-001",
                    traceId: "trace-001",
                  },
                },
              ],
              initiatives: [],
              workItems: [
                {
                  workItemId: "work-command-effect-001",
                  organizationId: "org-lfg",
                  projectId: "project-agentic-org",
                  workItemType: WorkItemType.Task,
                  title: "Command effect work item",
                  description: "Created through command effects.",
                  state: WorkItemState.Created,
                  createdAt: "2026-05-25T20:00:00.000Z",
                  createdBy: {
                    agentId: "agent-developer-001",
                    hatAssignmentId: "hat-assignment-dev-001",
                  },
                  metadata: {
                    updatedAt: "2026-05-25T20:00:00.000Z",
                    version: 1,
                    correlationId: "corr-001",
                    causationId: "cause-001",
                    traceId: "trace-001",
                  },
                },
              ],
              workAnchorTargets: [],
              workItemTransitions: [
                {
                  expectedVersion: 1,
                  nextWorkItem: {
                    workItemId: "work-command-effect-001",
                    organizationId: "org-lfg",
                    projectId: "project-agentic-org",
                    workItemType: WorkItemType.Task,
                    title: "Command effect work item",
                    description: "Created through command effects.",
                    state: WorkItemState.Intake,
                    createdAt: "2026-05-25T20:00:00.000Z",
                    createdBy: {
                      agentId: "agent-developer-001",
                      hatAssignmentId: "hat-assignment-dev-001",
                    },
                    metadata: {
                      updatedAt: "2026-05-25T20:05:00.000Z",
                      version: 2,
                      correlationId: "corr-001",
                      causationId: "cause-001",
                      traceId: "trace-001",
                    },
                  },
                  transition: {
                    workStateTransitionId: "transition-command-effect-001",
                    organizationId: "org-lfg",
                    projectId: "project-agentic-org",
                    workItemId: "work-command-effect-001",
                    sequence: 1,
                    fromState: WorkItemState.Created,
                    toState: WorkItemState.Intake,
                    evidenceArtifactIds: [],
                    transitionedAt: "2026-05-25T20:05:00.000Z",
                    transitionedBy: {
                      agentId: "agent-developer-001",
                      hatAssignmentId: "hat-assignment-dev-001",
                    },
                    metadata: {
                      updatedAt: "2026-05-25T20:05:00.000Z",
                      version: 1,
                      correlationId: "corr-001",
                      causationId: "cause-001",
                      traceId: "trace-001",
                    },
                  },
                },
              ],
            },
          }
        : {}),
    },
  };
}
