import {
  ReactionPlanActionType,
  ReactionPlanReason,
  ReactionPlanStatus,
  RequiredHat,
  isSupervisorChainLevel,
  type ReactionPlanAction,
} from "../../domain/src/index.ts";
import {
  ReactionPlanClaimStatus,
  ReactionPlanCompletionStatus,
  type ClaimedReactionPlanRecord,
  type ClaimReactionPlansResult,
  type CompleteReactionPlanResult,
  type ReactionPlanRecord,
  type ReactionPlanWorkQueue,
} from "../../state/src/index.ts";
import type {
  ClaimReactionPlansInput,
  CompleteReactionPlanInput,
  FailReactionPlanInput,
} from "../../state/src/reaction-plan-work-queue.ts";
import { CockroachTableName } from "./cockroach-schema.ts";

export const CockroachReactionPlanWorkQueueStatement = {
  ClaimPlannedReactionPlans: "claim_planned_reaction_plans",
  CompleteReactionPlan: "complete_reaction_plan",
  FailMalformedReactionPlan: "fail_malformed_reaction_plan",
  FailReactionPlan: "fail_reaction_plan",
} as const;

export type CockroachReactionPlanWorkQueueStatement =
  (typeof CockroachReactionPlanWorkQueueStatement)[keyof typeof CockroachReactionPlanWorkQueueStatement];

export type CockroachReactionPlanWorkQueueSqlStatement = {
  name: CockroachReactionPlanWorkQueueStatement;
  sql: string;
  parameters: readonly unknown[];
};

export type CockroachReactionPlanWorkQueueSqlResult<Row = Record<string, unknown>> = {
  rows: readonly Row[];
};

export type CockroachReactionPlanWorkQueueSqlExecutor = {
  execute: <Row = Record<string, unknown>>(
    statement: CockroachReactionPlanWorkQueueSqlStatement,
  ) => Promise<CockroachReactionPlanWorkQueueSqlResult<Row>>;
};

export type CreateCockroachReactionPlanWorkQueueInput = {
  executor: CockroachReactionPlanWorkQueueSqlExecutor;
};

export function createCockroachReactionPlanWorkQueue(
  input: CreateCockroachReactionPlanWorkQueueInput,
): ReactionPlanWorkQueue {
  return {
    claimPlannedReactionPlans: async (claimInput) => claimPlannedReactionPlans(input.executor, claimInput),
    completeReactionPlan: async (completeInput) => completeReactionPlan(input.executor, completeInput),
    failReactionPlan: async (failInput) => failReactionPlan(input.executor, failInput),
  };
}

async function claimPlannedReactionPlans(
  executor: CockroachReactionPlanWorkQueueSqlExecutor,
  input: ClaimReactionPlansInput,
): Promise<ClaimReactionPlansResult> {
  const result = await executor.execute<ClaimedReactionPlanRow>({
    name: CockroachReactionPlanWorkQueueStatement.ClaimPlannedReactionPlans,
    sql: CockroachReactionPlanWorkQueueSql.ClaimPlannedReactionPlans,
    parameters: [input.limit, input.claimId, input.leaseDurationMs],
  });
  const reactionPlans: ClaimedReactionPlanRecord[] = [];

  for (const row of result.rows) {
    const reactionPlan = await mapClaimedReactionPlanRow(row, executor);

    if (reactionPlan !== undefined) {
      reactionPlans.push(reactionPlan);
    }
  }

  if (reactionPlans.length === 0) {
    return {
      status: ReactionPlanClaimStatus.Empty,
      reactionPlans: [],
    };
  }

  return {
    status: ReactionPlanClaimStatus.Claimed,
    reactionPlans,
  };
}

async function completeReactionPlan(
  executor: CockroachReactionPlanWorkQueueSqlExecutor,
  input: CompleteReactionPlanInput,
): Promise<CompleteReactionPlanResult> {
  const result = await executor.execute({
    name: CockroachReactionPlanWorkQueueStatement.CompleteReactionPlan,
    sql: CockroachReactionPlanWorkQueueSql.CompleteReactionPlan,
    parameters: [input.reactionPlanId, input.claimId, input.result],
  });

  return {
    status:
      result.rows.length === 1
        ? ReactionPlanCompletionStatus.Completed
        : ReactionPlanCompletionStatus.ClaimLost,
  };
}

async function failReactionPlan(
  executor: CockroachReactionPlanWorkQueueSqlExecutor,
  input: FailReactionPlanInput,
): Promise<CompleteReactionPlanResult> {
  const result = await executor.execute({
    name: CockroachReactionPlanWorkQueueStatement.FailReactionPlan,
    sql: CockroachReactionPlanWorkQueueSql.FailReactionPlan,
    parameters: [input.reactionPlanId, input.claimId, input.failure, input.retryDelayMs, input.maxAttempts],
  });

  return {
    status:
      result.rows.length === 1
        ? ReactionPlanCompletionStatus.Completed
        : ReactionPlanCompletionStatus.ClaimLost,
  };
}

async function mapClaimedReactionPlanRow(
  row: ClaimedReactionPlanRow,
  executor: CockroachReactionPlanWorkQueueSqlExecutor,
): Promise<ClaimedReactionPlanRecord | undefined> {
  const action = parseReactionPlanAction(row.action_json);

  if (action === undefined) {
    await failMalformedReactionPlan(row, executor);
    return undefined;
  }

  return {
    reactionPlanId: row.reaction_plan_id,
    consumerName: row.consumer_name,
    createdAt: stringifyTimestamp(row.created_at),
    status: ReactionPlanStatus.Claimed,
    action,
    claimId: row.claim_id,
    claimedAt: stringifyTimestamp(row.claimed_at),
    claimExpiresAt: stringifyTimestamp(row.claim_expires_at),
    attemptCount: Number(row.attempt_count),
    ...createOptionalTraceparent(row.traceparent),
    ...createOptionalNextAttempt(row.next_attempt_at),
  };
}

async function failMalformedReactionPlan(
  row: ClaimedReactionPlanRow,
  executor: CockroachReactionPlanWorkQueueSqlExecutor,
): Promise<void> {
  await executor.execute({
    name: CockroachReactionPlanWorkQueueStatement.FailMalformedReactionPlan,
    sql: CockroachReactionPlanWorkQueueSql.FailMalformedReactionPlan,
    parameters: [
      row.reaction_plan_id,
      row.claim_id,
      {
        message: CockroachReactionPlanWorkQueueFailureMessage.InvalidDurableAction,
        retryable: false,
      },
    ],
  });
}

function parseReactionPlanAction(value: unknown): ReactionPlanAction | undefined {
  if (!isReactionPlanAction(value)) {
    return undefined;
  }

  return value;
}

function isReactionPlanAction(value: unknown): value is ReactionPlanAction {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isEnumValue(ReactionPlanActionType, value.actionType) &&
    isRequiredString(value.triggerEventId) &&
    isRequiredString(value.organizationId) &&
    isRequiredString(value.projectId) &&
    isOptionalString(value.teamId) &&
    isRequiredString(value.workItemId) &&
    isActionSpecificFieldsValid(value)
  );
}

function isActionSpecificFieldsValid(value: Record<string, unknown>): boolean {
  if (value.actionType === ReactionPlanActionType.CreateSupervisorTriage) {
    return (
      isRequiredString(value.supervisorSignalId) &&
      isSupervisorChainLevel(value.targetLevel) &&
      isEnumValue(RequiredHat, value.requiredHat) &&
      value.requiredHat !== RequiredHat.Reviewer &&
      value.reason === ReactionPlanReason.SupervisorSignalNeedsTriage
    );
  }

  if (value.actionType === ReactionPlanActionType.RequestImplementationAssignment) {
    return (
      value.supervisorSignalId === undefined &&
      value.targetLevel === undefined &&
      value.requiredHat === RequiredHat.EngineeringManager &&
      value.reason === ReactionPlanReason.WorkItemEnteredReadyState
    );
  }

  if (value.actionType === ReactionPlanActionType.RequestReviewGate) {
    return (
      value.supervisorSignalId === undefined &&
      value.targetLevel === undefined &&
      value.requiredHat === RequiredHat.Reviewer &&
      value.reason === ReactionPlanReason.WorkItemEnteredReviewState
    );
  }

  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRequiredString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || isRequiredString(value);
}

function isEnumValue<Values extends Record<string, string>>(
  values: Values,
  value: unknown,
): value is Values[keyof Values] {
  return typeof value === "string" && Object.values(values).includes(value);
}

function stringifyTimestamp(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function stringifyOptionalTimestamp(value: string | Date | null): string | undefined {
  if (value === null) {
    return undefined;
  }

  return stringifyTimestamp(value);
}

function createOptionalNextAttempt(value: string | Date | null): { nextAttemptAt?: string } {
  const nextAttemptAt = stringifyOptionalTimestamp(value);

  return nextAttemptAt === undefined ? {} : { nextAttemptAt };
}

function createOptionalTraceparent(value: string | null): { traceparent?: string } {
  return value === null ? {} : { traceparent: value };
}

type ClaimedReactionPlanRow = {
  reaction_plan_id: string;
  consumer_name: ReactionPlanRecord["consumerName"];
  created_at: string | Date;
  action_json: ReactionPlanAction;
  traceparent: string | null;
  claim_id: string;
  claimed_at: string | Date;
  claim_expires_at: string | Date;
  attempt_count: number | string;
  next_attempt_at: string | Date | null;
};

const CockroachReactionPlanWorkQueueFailureMessage = {
  InvalidDurableAction: "invalid durable reaction plan action",
} as const;

const CockroachReactionPlanWorkQueueSql = {
  ClaimPlannedReactionPlans: `
    UPDATE ${CockroachTableName.ReactionPlans}
    SET
      status = '${ReactionPlanStatus.Claimed}',
      claim_id = $2,
      claimed_at = now(),
      claim_expires_at = now() + ($3::INT8 * INTERVAL '1 millisecond')
    WHERE reaction_plan_id IN (
      SELECT reaction_plan_id
      FROM ${CockroachTableName.ReactionPlans}
      WHERE (status = '${ReactionPlanStatus.Planned}' AND (next_attempt_at IS NULL OR next_attempt_at <= now()))
        OR (status = '${ReactionPlanStatus.Claimed}' AND claim_expires_at <= now())
      ORDER BY created_at ASC
      LIMIT $1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING
      reaction_plan_id,
      consumer_name,
      created_at,
      action_json,
      traceparent,
      claim_id,
      claimed_at,
      claim_expires_at,
      attempt_count,
      next_attempt_at
  `,
  CompleteReactionPlan: `
    UPDATE ${CockroachTableName.ReactionPlans}
    SET
      status = '${ReactionPlanStatus.Completed}',
      completed_at = now(),
      result_json = $3
    WHERE reaction_plan_id = $1
      AND claim_id = $2
      AND status = '${ReactionPlanStatus.Claimed}'
      AND claim_expires_at > now()
    RETURNING reaction_plan_id
  `,
  FailMalformedReactionPlan: `
    UPDATE ${CockroachTableName.ReactionPlans}
    SET
      status = '${ReactionPlanStatus.Failed}',
      attempt_count = attempt_count + 1,
      next_attempt_at = NULL,
      failed_at = now(),
      failure_json = $3
    WHERE reaction_plan_id = $1
      AND claim_id = $2
      AND status = '${ReactionPlanStatus.Claimed}'
      AND claim_expires_at > now()
    RETURNING reaction_plan_id
  `,
  FailReactionPlan: `
    UPDATE ${CockroachTableName.ReactionPlans}
    SET
      status = CASE
        WHEN ($3->>'retryable')::BOOL AND attempt_count + 1 < $5 THEN '${ReactionPlanStatus.Planned}'
        ELSE '${ReactionPlanStatus.Failed}'
      END,
      claim_id = CASE WHEN ($3->>'retryable')::BOOL AND attempt_count + 1 < $5 THEN NULL ELSE claim_id END,
      claimed_at = CASE WHEN ($3->>'retryable')::BOOL AND attempt_count + 1 < $5 THEN NULL ELSE claimed_at END,
      claim_expires_at = CASE WHEN ($3->>'retryable')::BOOL AND attempt_count + 1 < $5 THEN NULL ELSE claim_expires_at END,
      attempt_count = attempt_count + 1,
      next_attempt_at = CASE
        WHEN ($3->>'retryable')::BOOL AND attempt_count + 1 < $5 THEN now() + ($4::INT8 * INTERVAL '1 millisecond')
        ELSE NULL
      END,
      failed_at = now(),
      failure_json = $3
    WHERE reaction_plan_id = $1
      AND claim_id = $2
      AND status = '${ReactionPlanStatus.Claimed}'
      AND claim_expires_at > now()
    RETURNING reaction_plan_id
  `,
} as const;
