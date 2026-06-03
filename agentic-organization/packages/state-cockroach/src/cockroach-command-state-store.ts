import {
  CommandOutcomeEffectConflictReason,
  CommandOutcomePersistenceStatus,
  type CommandStateStore,
  type CommandStateStoreFactory,
  type WorkAnchorCommandEffects,
} from "../../application/src/ports.ts";
import { CockroachTableName } from "./cockroach-schema.ts";
import { DiscussionAnchorType, ScheduleBlockState } from "../../domain/src/index.ts";
import {
  WorkAnchorPersistenceStatus,
  type WorkAnchorPersistenceResult,
  type WorkAnchorStateStore,
} from "../../state/src/index.ts";
import {
  createCockroachWorkAnchorStateStore,
  type CockroachWorkAnchorSqlStatement,
} from "./cockroach-work-anchor-state-store.ts";
import {
  CockroachDocConsultLedgerStoreStatement,
  createCockroachDocConsultLedgerStore,
} from "./cockroach-doc-consult-ledger-store.ts";
import type {
  CockroachAnySqlResult,
  CockroachAnySqlStatement,
  CockroachGenericSqlTransactionExecutor,
} from "./cockroach-sql-executor.ts";

export const CockroachCommandStateStoreStatement = {
  FindIdempotencyRecord: "find_idempotency_record",
  ClaimIdempotencyRecord: "claim_idempotency_record",
  InsertSupervisorSignal: "insert_supervisor_signal",
  InsertDiscussionAnchor: "insert_discussion_anchor",
  InsertDecisionRecord: "insert_decision_record",
  InsertQualityGateEvaluation: "insert_quality_gate_evaluation",
  FindOverlappingWorkScheduleBlock: "find_overlapping_work_schedule_block",
  InsertWorkScheduleBlock: "insert_work_schedule_block",
  InsertContextPackInboxAnchor: "insert_context_pack_inbox_anchor",
  UpdateContextPackInboxAnchorStatus: "update_context_pack_inbox_anchor_status",
  UpsertContextPackAdvisoryPromotionDecision: "upsert_context_pack_advisory_promotion_decision",
  InsertAuditEvent: "insert_audit_event",
  InsertOutboxEvent: "insert_outbox_event",
} as const;

export type CockroachCommandStateStoreStatement =
  (typeof CockroachCommandStateStoreStatement)[keyof typeof CockroachCommandStateStoreStatement];

export type CockroachSqlStatement = {
  name: CockroachCommandStateStoreStatement;
  sql: string;
  parameters: readonly unknown[];
} | CockroachDocConsultLedgerSqlStatement | CockroachWorkAnchorSqlStatement;

export type CockroachDocConsultLedgerSqlStatement = {
  name: CockroachDocConsultLedgerStoreStatement;
  sql: string;
  parameters: readonly unknown[];
};

export type CockroachSqlResult<Row = Record<string, unknown>> = {
  rows: readonly Row[];
};

export type CockroachSqlTransactionExecutor = {
  execute: <Row = Record<string, unknown>>(statement: CockroachSqlStatement) => Promise<CockroachSqlResult<Row>>;
};

export type CockroachSqlExecutor = {
  execute: <Row = Record<string, unknown>>(statement: CockroachSqlStatement) => Promise<CockroachSqlResult<Row>>;
  executeTransaction: <Result>(
    operation: (executor: CockroachSqlTransactionExecutor) => Promise<Result>,
  ) => Promise<Result>;
};

export type CreateCockroachCommandStateStoreFactoryInput = {
  executor: CockroachSqlExecutor;
};

export function createCockroachCommandStateStoreFactory<Result>(
  input: CreateCockroachCommandStateStoreFactoryInput,
): CommandStateStoreFactory<Result> {
  return {
    createCommandStateStore: () => createCockroachCommandStateStore(input.executor),
  };
}

function createCockroachCommandStateStore<Result>(executor: CockroachSqlExecutor): CommandStateStore<Result> {
  return {
    findIdempotencyRecord: async (idempotencyKey) => {
      const result = await executor.execute<IdempotencyRecordRow>({
        name: CockroachCommandStateStoreStatement.FindIdempotencyRecord,
        sql: CockroachCommandStateStoreSql.FindIdempotencyRecord,
        parameters: [idempotencyKey],
      });
      const row = result.rows[0];

      if (row === undefined) {
        return undefined;
      }

      return {
        idempotencyKey: row.idempotency_key,
        requestHash: row.request_hash,
        result: row.result_json as Result,
      };
    },
    recordCommandOutcome: async (outcome) => {
      try {
        return await executor.executeTransaction(async (transaction) => {
        const claimResult = await transaction.execute<CockroachIdempotencyClaimRow<Result>>({
          name: CockroachCommandStateStoreStatement.ClaimIdempotencyRecord,
          sql: CockroachCommandStateStoreSql.ClaimIdempotencyRecord,
          parameters: [
            outcome.idempotencyRecord.idempotencyKey,
            outcome.idempotencyRecord.requestHash,
            outcome.idempotencyRecord.result,
          ],
        });
        const claim = claimResult.rows[0];
        const claimStatus = claim?.persistence_status ?? CommandOutcomePersistenceStatus.IdempotencyConflict;

        if (claimStatus === CommandOutcomePersistenceStatus.Replayed) {
          return {
            status: CommandOutcomePersistenceStatus.Replayed,
            result: claim?.result_json as Result,
          };
        }

        if (claimStatus === CommandOutcomePersistenceStatus.IdempotencyConflict) {
          if (claim?.request_hash === undefined || claim.request_hash === null) {
            return {
              status: CommandOutcomePersistenceStatus.IdempotencyConflict,
            };
          }

          return {
            status: CommandOutcomePersistenceStatus.IdempotencyConflict,
            existingRequestHash: claim.request_hash,
          };
        }

        const unsupportedEffectConflict = findUnsupportedCommandEffectConflict(outcome.effects);

        if (unsupportedEffectConflict !== undefined) {
          throw new CockroachCommandEffectConflictError(unsupportedEffectConflict);
        }

        for (const supervisorSignal of outcome.effects.supervisorSignals) {
          await transaction.execute(createInsertSupervisorSignalStatement(supervisorSignal));
        }

        for (const discussionAnchor of outcome.effects.discussionAnchors) {
          await transaction.execute(createInsertDiscussionAnchorStatement(discussionAnchor));
        }

        for (const decisionRecord of outcome.effects.decisionRecords) {
          await transaction.execute(createInsertDecisionRecordStatement(decisionRecord));
        }

        for (const qualityGateEvaluation of outcome.effects.qualityGateEvaluations) {
          await transaction.execute(createInsertQualityGateEvaluationStatement(qualityGateEvaluation));
        }

        const docConsultLedgerStore = createCockroachDocConsultLedgerStore({
          executor: createDocConsultLedgerTransactionExecutor(transaction),
        });

        for (const docConsultOutcomeStamp of outcome.effects.docConsultOutcomeStamps ?? []) {
          const stampResult = await docConsultLedgerStore.stampOutcome(docConsultOutcomeStamp);
          if (stampResult.stampedCount === 0) {
            throw new CockroachCommandEffectConflictError(
              CommandOutcomeEffectConflictReason.DocConsultOutcomeStampMissing,
            );
          }
        }

        for (const workScheduleBlock of outcome.effects.workScheduleBlocks) {
          await assertNoOverlappingWorkScheduleBlock(transaction, workScheduleBlock);
          await transaction.execute(createInsertWorkScheduleBlockStatement(workScheduleBlock));
        }

        for (const inboxAnchor of outcome.effects.contextPackInboxAnchors ?? []) {
          await transaction.execute(createInsertContextPackInboxAnchorStatement(inboxAnchor));
        }

        for (const decision of outcome.effects.contextPackAdvisoryPromotionDecisions ?? []) {
          await transaction.execute(createUpsertContextPackAdvisoryPromotionDecisionStatement(decision));
        }

        for (const statusTransition of outcome.effects.contextPackInboxAnchorStatusTransitions ?? []) {
          const result = await transaction.execute(createUpdateContextPackInboxAnchorStatusStatement(statusTransition));
          if (result.rows.length === 0) {
            throw new CockroachCommandEffectConflictError(
              CommandOutcomeEffectConflictReason.ContextPackInboxAnchorMissing,
            );
          }
        }

        const workAnchorStateStore = createCockroachWorkAnchorStateStore({
          executor: {
            execute: transaction.execute,
            executeTransaction: async (operation) => await operation(transaction),
          },
        });

        await recordWorkAnchorEffects(workAnchorStateStore, outcome.effects.workAnchors);

        for (const auditEvent of outcome.effects.auditEvents) {
          await transaction.execute(createInsertAuditEventStatement(auditEvent));
        }

        for (const outboxEvent of outcome.effects.outboxEvents) {
          await transaction.execute(createInsertOutboxEventStatement(outboxEvent));
        }

        return {
          status: CommandOutcomePersistenceStatus.Committed,
          result: outcome.idempotencyRecord.result,
        };
        });
      } catch (error) {
        if (error instanceof CockroachCommandEffectConflictError) {
          return {
            status: CommandOutcomePersistenceStatus.EffectConflict,
            reason: error.reason,
          };
        }

        throw error;
      }
    },
  };
}

function createDocConsultLedgerTransactionExecutor(
  transaction: CockroachSqlTransactionExecutor,
): CockroachGenericSqlTransactionExecutor {
  return {
    execute: async <Row = Record<string, unknown>>(
      statement: CockroachAnySqlStatement,
    ): Promise<CockroachAnySqlResult<Row>> => {
      if (!isCockroachDocConsultLedgerStatement(statement)) {
        throw new Error("unsupported doc consult ledger command transaction statement");
      }

      return await transaction.execute<Row>(statement);
    },
  };
}

function isCockroachDocConsultLedgerStatement(
  statement: CockroachAnySqlStatement,
): statement is CockroachDocConsultLedgerSqlStatement {
  return Object.values(CockroachDocConsultLedgerStoreStatement).includes(
    statement.name as CockroachDocConsultLedgerStoreStatement,
  );
}

function findUnsupportedCommandEffectConflict(
  effects: CommandStateStoreResult<unknown>["effects"],
): CommandOutcomeEffectConflictReason | undefined {
  for (const discussionAnchor of effects.discussionAnchors) {
    if (discussionAnchor.discussionAnchorType !== DiscussionAnchorType.WorkItem) {
      return CommandOutcomeEffectConflictReason.UnsupportedDiscussionAnchorEffectType;
    }
  }

  return undefined;
}

async function recordWorkAnchorEffects(
  store: WorkAnchorStateStore,
  effects: WorkAnchorCommandEffects | undefined,
): Promise<void> {
  if (effects === undefined) {
    return;
  }

  for (const project of effects.projects) {
    assertWorkAnchorEffectCommitted(await store.createProject(project));
  }

  for (const initiative of effects.initiatives) {
    assertWorkAnchorEffectCommitted(await store.createInitiative(initiative));
  }

  for (const workItem of effects.workItems) {
    assertWorkAnchorEffectCommitted(await store.createWorkItem(workItem));
  }

  for (const workAnchorTarget of effects.workAnchorTargets) {
    assertWorkAnchorEffectCommitted(await store.createWorkAnchorTarget(workAnchorTarget));
  }

  for (const workItemTransition of effects.workItemTransitions) {
    assertWorkAnchorEffectCommitted(await store.transitionWorkItem(workItemTransition));
  }
}

function assertWorkAnchorEffectCommitted(result: WorkAnchorPersistenceResult): void {
  if (result.status !== WorkAnchorPersistenceStatus.Committed) {
    throw new CockroachCommandEffectConflictError(CommandOutcomeEffectConflictReason.WorkAnchorEffectConflict);
  }
}

async function assertNoOverlappingWorkScheduleBlock(
  transaction: CockroachSqlTransactionExecutor,
  workScheduleBlock: CommandStateStoreResult<unknown>["effects"]["workScheduleBlocks"][number],
): Promise<void> {
  const overlapResult = await transaction.execute({
    name: CockroachCommandStateStoreStatement.FindOverlappingWorkScheduleBlock,
    sql: CockroachCommandStateStoreSql.FindOverlappingWorkScheduleBlock,
    parameters: [
      workScheduleBlock.assignedHatAssignmentId,
      workScheduleBlock.startsAt,
      workScheduleBlock.endsAt,
      ScheduleBlockState.Scheduled,
      ScheduleBlockState.Active,
    ],
  });

  if (overlapResult.rows.length > 0) {
    throw new CockroachCommandEffectConflictError(CommandOutcomeEffectConflictReason.WorkScheduleBlockOverlap);
  }
}

class CockroachCommandEffectConflictError extends Error {
  readonly reason: CommandOutcomeEffectConflictReason;

  constructor(reason: CommandOutcomeEffectConflictReason) {
    super(reason);
    this.reason = reason;
  }
}

type CommandStateStoreResult<Result> = Parameters<CommandStateStore<Result>["recordCommandOutcome"]>[0];

function createInsertSupervisorSignalStatement(
  supervisorSignal: CommandStateStoreResult<unknown>["effects"]["supervisorSignals"][number],
): CockroachSqlStatement {
  return {
    name: CockroachCommandStateStoreStatement.InsertSupervisorSignal,
    sql: CockroachCommandStateStoreSql.InsertSupervisorSignal,
    parameters: [
      supervisorSignal.supervisorSignalId,
      supervisorSignal.organizationId,
      supervisorSignal.projectId,
      supervisorSignal.teamId,
      supervisorSignal.sourceLevel,
      supervisorSignal.targetLevel,
      supervisorSignal.targetHatAssignmentId,
      supervisorSignal.sender.agentId,
      supervisorSignal.sender.hatAssignmentId,
      supervisorSignal.toolType,
      supervisorSignal.status,
      supervisorSignal.title,
      supervisorSignal.message,
      supervisorSignal.relatedWorkItemId,
      supervisorSignal.createdAt,
    ],
  };
}

function createInsertDiscussionAnchorStatement(
  discussionAnchor: CommandStateStoreResult<unknown>["effects"]["discussionAnchors"][number],
): CockroachSqlStatement {
  return {
    name: CockroachCommandStateStoreStatement.InsertDiscussionAnchor,
    sql: CockroachCommandStateStoreSql.InsertDiscussionAnchor,
    parameters: [
      discussionAnchor.discussionAnchorId,
      discussionAnchor.organizationId,
      discussionAnchor.projectId,
      discussionAnchor.teamId ?? null,
      discussionAnchor.workItemId,
      discussionAnchor.discussionAnchorType,
      discussionAnchor.title,
      discussionAnchor.purpose,
      JSON.stringify(discussionAnchor.expectedOutputs),
      discussionAnchor.createdBy.agentId,
      discussionAnchor.createdBy.hatAssignmentId,
      discussionAnchor.createdAt,
      discussionAnchor.metadata.updatedAt,
      discussionAnchor.metadata.version,
      discussionAnchor.metadata.correlationId,
      discussionAnchor.metadata.causationId,
      discussionAnchor.metadata.traceId,
    ],
  };
}

function createInsertDecisionRecordStatement(
  decisionRecord: CommandStateStoreResult<unknown>["effects"]["decisionRecords"][number],
): CockroachSqlStatement {
  return {
    name: CockroachCommandStateStoreStatement.InsertDecisionRecord,
    sql: CockroachCommandStateStoreSql.InsertDecisionRecord,
    parameters: [
      decisionRecord.decisionRecordId,
      decisionRecord.organizationId,
      decisionRecord.projectId,
      decisionRecord.teamId ?? null,
      decisionRecord.workItemId,
      decisionRecord.discussionAnchorId,
      decisionRecord.title,
      decisionRecord.decision,
      decisionRecord.rationale,
      JSON.stringify(decisionRecord.alternativesConsidered),
      JSON.stringify(decisionRecord.followUpWorkItemIds),
      decisionRecord.decidedBy.agentId,
      decisionRecord.decidedBy.hatAssignmentId,
      decisionRecord.decidedAt,
      decisionRecord.metadata.updatedAt,
      decisionRecord.metadata.version,
      decisionRecord.metadata.correlationId,
      decisionRecord.metadata.causationId,
      decisionRecord.metadata.traceId,
    ],
  };
}

function createInsertQualityGateEvaluationStatement(
  qualityGateEvaluation: CommandStateStoreResult<unknown>["effects"]["qualityGateEvaluations"][number],
): CockroachSqlStatement {
  return {
    name: CockroachCommandStateStoreStatement.InsertQualityGateEvaluation,
    sql: CockroachCommandStateStoreSql.InsertQualityGateEvaluation,
    parameters: [
      qualityGateEvaluation.qualityGateEvaluationId,
      qualityGateEvaluation.organizationId,
      qualityGateEvaluation.projectId,
      qualityGateEvaluation.teamId ?? null,
      qualityGateEvaluation.workItemId,
      qualityGateEvaluation.discussionAnchorId,
      qualityGateEvaluation.gateKind,
      qualityGateEvaluation.outcome,
      qualityGateEvaluation.summary,
      JSON.stringify(qualityGateEvaluation.evaluatedArtifactIds),
      JSON.stringify(qualityGateEvaluation.businessRuleResults),
      qualityGateEvaluation.evaluatedBy.agentId,
      qualityGateEvaluation.evaluatedBy.hatAssignmentId,
      qualityGateEvaluation.evaluatedAt,
      qualityGateEvaluation.metadata.updatedAt,
      qualityGateEvaluation.metadata.version,
      qualityGateEvaluation.metadata.correlationId,
      qualityGateEvaluation.metadata.causationId,
      qualityGateEvaluation.metadata.traceId,
    ],
  };
}

function createInsertWorkScheduleBlockStatement(
  workScheduleBlock: CommandStateStoreResult<unknown>["effects"]["workScheduleBlocks"][number],
): CockroachSqlStatement {
  return {
    name: CockroachCommandStateStoreStatement.InsertWorkScheduleBlock,
    sql: CockroachCommandStateStoreSql.InsertWorkScheduleBlock,
    parameters: [
      workScheduleBlock.workScheduleBlockId,
      workScheduleBlock.organizationId,
      workScheduleBlock.projectId,
      workScheduleBlock.teamId ?? null,
      workScheduleBlock.workItemId,
      workScheduleBlock.discussionAnchorId ?? null,
      workScheduleBlock.assignedAgentId,
      workScheduleBlock.assignedHatAssignmentId,
      workScheduleBlock.blockType,
      workScheduleBlock.state,
      workScheduleBlock.title,
      workScheduleBlock.purpose,
      workScheduleBlock.startsAt,
      workScheduleBlock.endsAt,
      workScheduleBlock.scheduledBy.agentId,
      workScheduleBlock.scheduledBy.hatAssignmentId,
      workScheduleBlock.scheduledAt,
      workScheduleBlock.metadata.updatedAt,
      workScheduleBlock.metadata.version,
      workScheduleBlock.metadata.correlationId,
      workScheduleBlock.metadata.causationId,
      workScheduleBlock.metadata.traceId,
    ],
  };
}

function createInsertContextPackInboxAnchorStatement(
  inboxAnchor: NonNullable<CommandStateStoreResult<unknown>["effects"]["contextPackInboxAnchors"]>[number],
): CockroachSqlStatement {
  return {
    name: CockroachCommandStateStoreStatement.InsertContextPackInboxAnchor,
    sql: CockroachCommandStateStoreSql.InsertContextPackInboxAnchor,
    parameters: [
      inboxAnchor.inboxAnchorId,
      inboxAnchor.organizationId,
      inboxAnchor.projectId,
      inboxAnchor.teamId ?? null,
      inboxAnchor.workItemId ?? null,
      inboxAnchor.targetHatAssignmentId,
      inboxAnchor.targetAgentId ?? null,
      inboxAnchor.title,
      inboxAnchor.summary,
      inboxAnchor.priority,
      inboxAnchor.status,
      inboxAnchor.deliveredAt,
      inboxAnchor.sourceRef ?? null,
      inboxAnchor.traceId ?? null,
      inboxAnchor.deliveredAt,
      1,
    ],
  };
}

function createUpsertContextPackAdvisoryPromotionDecisionStatement(
  decision: NonNullable<
    CommandStateStoreResult<unknown>["effects"]["contextPackAdvisoryPromotionDecisions"]
  >[number],
): CockroachSqlStatement {
  return {
    name: CockroachCommandStateStoreStatement.UpsertContextPackAdvisoryPromotionDecision,
    sql: CockroachCommandStateStoreSql.UpsertContextPackAdvisoryPromotionDecision,
    parameters: [
      decision.decisionId,
      decision.decisionKey,
      decision.organizationId,
      decision.status,
      decision.policyVersion,
      decision.lifecycleBlocker,
      decision.fingerprint.itemKind,
      decision.fingerprint.summaryHash,
      jsonArrayParameter(decision.fingerprint.citationRefs),
      jsonArrayParameter(decision.fingerprint.sourcePointerKeys),
      jsonArrayParameter(decision.evidenceRefs),
      decision.hatId ?? null,
      decision.hatAssignmentId ?? null,
      decision.projectId ?? null,
      decision.teamId ?? null,
      decision.workItemId ?? null,
      decision.curationProfileId ?? null,
      decision.audit.decidedByHatId,
      decision.audit.decidedByHatAssignmentId,
      decision.audit.decidedByAgentId ?? null,
      decision.audit.decidedAt,
      decision.audit.decidedAt,
      decision.audit.traceId,
      decision.audit.correlationId,
      decision.audit.causationId,
    ],
  };
}

function createUpdateContextPackInboxAnchorStatusStatement(
  statusTransition: NonNullable<
    CommandStateStoreResult<unknown>["effects"]["contextPackInboxAnchorStatusTransitions"]
  >[number],
): CockroachSqlStatement {
  return {
    name: CockroachCommandStateStoreStatement.UpdateContextPackInboxAnchorStatus,
    sql: CockroachCommandStateStoreSql.UpdateContextPackInboxAnchorStatus,
    parameters: [
      statusTransition.inboxAnchorId,
      statusTransition.organizationId,
      statusTransition.projectId,
      statusTransition.teamId ?? null,
      statusTransition.workItemId ?? null,
      statusTransition.targetHatAssignmentId,
      statusTransition.targetAgentId ?? null,
      statusTransition.status,
      statusTransition.changedAt,
      statusTransition.snoozedUntil ?? null,
    ],
  };
}

function createInsertAuditEventStatement(
  auditEvent: CommandStateStoreResult<unknown>["effects"]["auditEvents"][number],
): CockroachSqlStatement {
  return {
    name: CockroachCommandStateStoreStatement.InsertAuditEvent,
    sql: CockroachCommandStateStoreSql.InsertAuditEvent,
    parameters: [
      auditEvent.auditEventId,
      auditEvent.eventName,
      auditEvent.aggregateId,
      auditEvent.actor.agentId,
      auditEvent.actor.hatAssignmentId,
      auditEvent.occurredAt,
      auditEvent.policy?.decisionId ?? null,
      auditEvent.policy?.policyVersion ?? null,
    ],
  };
}

function createInsertOutboxEventStatement(
  outboxEvent: CommandStateStoreResult<unknown>["effects"]["outboxEvents"][number],
): CockroachSqlStatement {
  return {
    name: CockroachCommandStateStoreStatement.InsertOutboxEvent,
    sql: CockroachCommandStateStoreSql.InsertOutboxEvent,
    parameters: [
      outboxEvent.outboxEventId,
      outboxEvent.envelope.eventId,
      outboxEvent.envelope.eventType,
      outboxEvent.envelope.scope.organizationId,
      outboxEvent.envelope.scope.projectId,
      outboxEvent.envelope.scope.workItemId,
      outboxEvent.envelope.trace.traceId,
      outboxEvent.envelope.trace.correlationId,
      outboxEvent.envelope,
    ],
  };
}

type IdempotencyRecordRow = {
  idempotency_key: string;
  request_hash: string;
  result_json: unknown;
};

type CockroachIdempotencyClaimRow<Result> = {
  persistence_status: CommandOutcomePersistenceStatus;
  request_hash?: string | null;
  result_json?: Result | null;
};

const CockroachCommandStateStoreSql = {
  FindIdempotencyRecord: `
    SELECT idempotency_key, request_hash, result_json
    FROM ${CockroachTableName.IdempotencyRecords}
    WHERE idempotency_key = $1
  `,
  ClaimIdempotencyRecord: `
    WITH claimed_record AS (
      INSERT INTO ${CockroachTableName.IdempotencyRecords} (
        idempotency_key,
        request_hash,
        result_json
      ) VALUES ($1, $2, $3)
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING request_hash, result_json
    ),
    existing_record AS (
      SELECT request_hash, result_json
      FROM ${CockroachTableName.IdempotencyRecords}
      WHERE idempotency_key = $1
    )
    SELECT
      CASE
        WHEN EXISTS (SELECT 1 FROM claimed_record) THEN '${CommandOutcomePersistenceStatus.Committed}'
        WHEN EXISTS (SELECT 1 FROM existing_record WHERE request_hash = $2) THEN '${CommandOutcomePersistenceStatus.Replayed}'
        ELSE '${CommandOutcomePersistenceStatus.IdempotencyConflict}'
      END AS persistence_status,
      (SELECT request_hash FROM existing_record) AS request_hash,
      (SELECT result_json FROM existing_record) AS result_json
  `,
  InsertSupervisorSignal: `
    INSERT INTO ${CockroachTableName.SupervisorSignals} (
      supervisor_signal_id,
      organization_id,
      project_id,
      team_id,
      source_level,
      target_level,
      target_hat_assignment_id,
      sender_agent_id,
      sender_hat_assignment_id,
      tool_type,
      status,
      title,
      message,
      related_work_item_id,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
  `,
  InsertDiscussionAnchor: `
    INSERT INTO ${CockroachTableName.DiscussionAnchors} (
      discussion_anchor_id,
      organization_id,
      project_id,
      team_id,
      work_item_id,
      discussion_anchor_type,
      title,
      purpose,
      expected_outputs,
      created_by_agent_id,
      created_by_hat_assignment_id,
      created_at,
      updated_at,
      version,
      correlation_id,
      causation_id,
      trace_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::JSONB, $10, $11, $12, $13, $14, $15, $16, $17)
  `,
  InsertDecisionRecord: `
    INSERT INTO ${CockroachTableName.DecisionRecords} (
      decision_record_id,
      organization_id,
      project_id,
      team_id,
      work_item_id,
      discussion_anchor_id,
      title,
      decision,
      rationale,
      alternatives_considered,
      follow_up_work_item_ids,
      decided_by_agent_id,
      decided_by_hat_assignment_id,
      decided_at,
      updated_at,
      version,
      correlation_id,
      causation_id,
      trace_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::JSONB, $11::JSONB, $12, $13, $14, $15, $16, $17, $18, $19)
  `,
  InsertQualityGateEvaluation: `
    INSERT INTO ${CockroachTableName.QualityGateEvaluations} (
      quality_gate_evaluation_id,
      organization_id,
      project_id,
      team_id,
      work_item_id,
      discussion_anchor_id,
      gate_kind,
      outcome,
      summary,
      evaluated_artifact_ids,
      business_rule_results,
      evaluated_by_agent_id,
      evaluated_by_hat_assignment_id,
      evaluated_at,
      updated_at,
      version,
      correlation_id,
      causation_id,
      trace_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::JSONB, $11::JSONB, $12, $13, $14, $15, $16, $17, $18, $19)
  `,
  FindOverlappingWorkScheduleBlock: `
    SELECT work_schedule_block_id
    FROM ${CockroachTableName.WorkScheduleBlocks}
    WHERE assigned_hat_assignment_id = $1
      AND state IN ($4, $5)
      AND starts_at < $3
      AND ends_at > $2
    LIMIT 1
    FOR UPDATE
  `,
  InsertWorkScheduleBlock: `
    INSERT INTO ${CockroachTableName.WorkScheduleBlocks} (
      work_schedule_block_id,
      organization_id,
      project_id,
      team_id,
      work_item_id,
      discussion_anchor_id,
      assigned_agent_id,
      assigned_hat_assignment_id,
      block_type,
      state,
      title,
      purpose,
      starts_at,
      ends_at,
      scheduled_by_agent_id,
      scheduled_by_hat_assignment_id,
      scheduled_at,
      updated_at,
      version,
      correlation_id,
      causation_id,
      trace_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
  `,
  InsertContextPackInboxAnchor: `
    INSERT INTO ${CockroachTableName.ContextPackInboxAnchors} (
      inbox_anchor_id,
      organization_id,
      project_id,
      team_id,
      work_item_id,
      target_hat_assignment_id,
      target_agent_id,
      title,
      summary,
      priority,
      status,
      delivered_at,
      source_ref,
      trace_id,
      updated_at,
      version
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
  `,
  UpsertContextPackAdvisoryPromotionDecision: `
    UPSERT INTO ${CockroachTableName.ContextPackAdvisoryPromotionDecisions} (
      decision_id,
      decision_key,
      organization_id,
      status,
      policy_version,
      lifecycle_blocker,
      item_kind,
      summary_hash,
      citation_refs,
      source_pointer_keys,
      evidence_refs,
      hat_id,
      hat_assignment_id,
      project_id,
      team_id,
      work_item_id,
      curation_profile_id,
      decided_by_hat_id,
      decided_by_hat_assignment_id,
      decided_by_agent_id,
      decided_at,
      updated_at,
      trace_id,
      correlation_id,
      causation_id
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9::JSONB, $10::JSONB,
      $11::JSONB, $12, $13, $14, $15, $16, $17, $18, $19,
      $20, $21::TIMESTAMPTZ, $22::TIMESTAMPTZ, $23, $24, $25
    )
  `,
  UpdateContextPackInboxAnchorStatus: `
    UPDATE ${CockroachTableName.ContextPackInboxAnchors}
    SET
      status = $8,
      updated_at = $9,
      snoozed_until = $10,
      version = version + 1
    WHERE inbox_anchor_id = $1
      AND organization_id = $2
      AND project_id = $3
      AND team_id IS NOT DISTINCT FROM $4
      AND work_item_id IS NOT DISTINCT FROM $5
      AND target_hat_assignment_id = $6
      AND target_agent_id IS NOT DISTINCT FROM $7
    RETURNING inbox_anchor_id
  `,
  InsertAuditEvent: `
    INSERT INTO ${CockroachTableName.AuditEvents} (
      audit_event_id,
      event_name,
      aggregate_id,
      actor_agent_id,
      actor_hat_assignment_id,
      occurred_at,
      policy_decision_id,
      policy_version
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `,
  InsertOutboxEvent: `
    INSERT INTO ${CockroachTableName.OutboxEvents} (
      outbox_event_id,
      event_id,
      event_type,
      organization_id,
      project_id,
      work_item_id,
      trace_id,
      correlation_id,
      envelope_json
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `,
} as const;

function jsonArrayParameter(values: readonly string[]): string {
  return JSON.stringify(values);
}
