import {
  ReactionPlanStatus,
  ScheduleBlockState,
} from "../../domain/src/index.ts";
import type {
  DeadLetterRecoveryCandidate,
  ReactionPlanRecoveryCandidate,
  RunBindingRecoveryCandidate,
  ScheduleBlockRecoveryCandidate,
} from "../../application/src/index.ts";
import { CockroachTableName } from "./cockroach-schema.ts";

export const CockroachRecoveryScanReaderStatement = {
  ListStaleReactionPlanCandidates: "list_stale_reaction_plan_candidates",
  ListStrandedScheduleCandidates: "list_stranded_schedule_candidates",
  ListAbandonedRunBindingCandidates: "list_abandoned_run_binding_candidates",
  ListDeadLetterCandidates: "list_dead_letter_candidates",
} as const;

export type CockroachRecoveryScanReaderStatement =
  (typeof CockroachRecoveryScanReaderStatement)[keyof typeof CockroachRecoveryScanReaderStatement];

export type CockroachRecoveryScanSqlStatement = {
  name: CockroachRecoveryScanReaderStatement;
  sql: string;
  parameters: readonly unknown[];
};

export type CockroachRecoveryScanSqlResult<Row = Record<string, unknown>> = {
  rows: readonly Row[];
};

export type CockroachRecoveryScanSqlExecutor = {
  execute: <Row = Record<string, unknown>>(
    statement: CockroachRecoveryScanSqlStatement,
  ) => Promise<CockroachRecoveryScanSqlResult<Row>>;
};

export type ListStaleReactionPlanCandidatesInput = {
  organizationId: string;
  nowIso: string;
  staleBeforeIso: string;
  limit: number;
};

export type ListStrandedScheduleCandidatesInput = {
  organizationId: string;
  nowIso: string;
  endedBeforeIso: string;
  limit: number;
};

export type ListAbandonedRunBindingCandidatesInput = {
  organizationId: string;
  nowMs: number;
  heartbeatBeforeIso: string;
  limit: number;
};

export type ListDeadLetterCandidatesInput = {
  organizationId: string;
  limit: number;
};

export type RecoveryScanReader = {
  listStaleReactionPlanCandidates: (
    input: ListStaleReactionPlanCandidatesInput,
  ) => Promise<readonly ReactionPlanRecoveryCandidate[]>;
  listStrandedScheduleCandidates: (
    input: ListStrandedScheduleCandidatesInput,
  ) => Promise<readonly ScheduleBlockRecoveryCandidate[]>;
  listAbandonedRunBindingCandidates: (
    input: ListAbandonedRunBindingCandidatesInput,
  ) => Promise<readonly RunBindingRecoveryCandidate[]>;
  listDeadLetterCandidates: (
    input: ListDeadLetterCandidatesInput,
  ) => Promise<readonly DeadLetterRecoveryCandidate[]>;
};

export type CreateCockroachRecoveryScanReaderInput = {
  executor: CockroachRecoveryScanSqlExecutor;
};

export function createCockroachRecoveryScanReader(
  input: CreateCockroachRecoveryScanReaderInput,
): RecoveryScanReader {
  return {
    listStaleReactionPlanCandidates: async (scanInput) => {
      const result = await input.executor.execute<StaleReactionPlanRow>({
        name: CockroachRecoveryScanReaderStatement.ListStaleReactionPlanCandidates,
        sql: CockroachRecoveryScanSql.ListStaleReactionPlanCandidates,
        parameters: [scanInput.organizationId, scanInput.nowIso, scanInput.staleBeforeIso, scanInput.limit],
      });

      return result.rows.map(mapStaleReactionPlanRow).filter(isDefined);
    },
    listStrandedScheduleCandidates: async (scanInput) => {
      const result = await input.executor.execute<StrandedScheduleRow>({
        name: CockroachRecoveryScanReaderStatement.ListStrandedScheduleCandidates,
        sql: CockroachRecoveryScanSql.ListStrandedScheduleCandidates,
        parameters: [scanInput.organizationId, scanInput.endedBeforeIso, scanInput.limit],
      });

      return result.rows.map(mapStrandedScheduleRow).filter(isDefined);
    },
    listAbandonedRunBindingCandidates: async (scanInput) => {
      const result = await input.executor.execute<AbandonedRunBindingRow>({
        name: CockroachRecoveryScanReaderStatement.ListAbandonedRunBindingCandidates,
        sql: CockroachRecoveryScanSql.ListAbandonedRunBindingCandidates,
        parameters: [scanInput.organizationId, scanInput.heartbeatBeforeIso, scanInput.limit],
      });

      return result.rows.map(mapAbandonedRunBindingRow).filter(isDefined);
    },
    listDeadLetterCandidates: async (scanInput) => {
      const result = await input.executor.execute<DeadLetterRow>({
        name: CockroachRecoveryScanReaderStatement.ListDeadLetterCandidates,
        sql: CockroachRecoveryScanSql.ListDeadLetterCandidates,
        parameters: [scanInput.organizationId, scanInput.limit],
      });

      return result.rows.map(mapDeadLetterRow).filter(isDefined);
    },
  };
}

type StaleReactionPlanRow = {
  reaction_plan_id: string;
  organization_id: string;
  status: string;
  created_at: string | Date;
  claimed_at: string | Date | null;
  claim_expires_at: string | Date | null;
  attempt_count: number | string;
  next_attempt_at: string | Date | null;
};

type StrandedScheduleRow = {
  work_schedule_block_id: string;
  organization_id: string;
  work_item_id: string;
  assigned_agent_id: string;
  assigned_hat_assignment_id: string;
  state: string;
  starts_at: string | Date;
  ends_at: string | Date;
};

type AbandonedRunBindingRow = {
  run_id: string;
  work_item_id: string;
  agent_id: string;
  session_id: string;
  hat_assignment_id: string;
  prompt_flow_run_id: string;
  state: string;
  last_heartbeat_ms: number | string;
};

type DeadLetterRow = {
  dead_letter_id: string;
  organization_id: string;
  created_at: string | Date;
  failed_at: string | Date | null;
  failure_json: unknown;
  attempt_count: number | string;
};

function mapStaleReactionPlanRow(row: StaleReactionPlanRow): ReactionPlanRecoveryCandidate | undefined {
  if (!isEnumValue(ReactionPlanStatus, row.status)) {
    return undefined;
  }

  return {
    reactionPlanId: row.reaction_plan_id,
    organizationId: row.organization_id,
    status: row.status,
    createdAt: stringifyTimestamp(row.created_at),
    attemptCount: Number(row.attempt_count),
    ...optionalTimestamp("claimedAt", row.claimed_at),
    ...optionalTimestamp("claimExpiresAt", row.claim_expires_at),
    ...optionalTimestamp("nextAttemptAt", row.next_attempt_at),
  };
}

function mapStrandedScheduleRow(row: StrandedScheduleRow): ScheduleBlockRecoveryCandidate | undefined {
  if (!isEnumValue(ScheduleBlockState, row.state)) {
    return undefined;
  }

  return {
    workScheduleBlockId: row.work_schedule_block_id,
    organizationId: row.organization_id,
    workItemId: row.work_item_id,
    assignedAgentId: row.assigned_agent_id,
    assignedHatAssignmentId: row.assigned_hat_assignment_id,
    state: row.state,
    startsAt: stringifyTimestamp(row.starts_at),
    endsAt: stringifyTimestamp(row.ends_at),
  };
}

function mapAbandonedRunBindingRow(row: AbandonedRunBindingRow): RunBindingRecoveryCandidate | undefined {
  const lastHeartbeatMs = Number(row.last_heartbeat_ms);
  if (!Number.isFinite(lastHeartbeatMs)) {
    return undefined;
  }

  return {
    runId: row.run_id,
    workItemId: row.work_item_id,
    agentId: row.agent_id,
    sessionId: row.session_id,
    hatAssignmentId: row.hat_assignment_id,
    promptFlowRunId: row.prompt_flow_run_id,
    state: row.state,
    lastHeartbeatMs,
  };
}

function mapDeadLetterRow(row: DeadLetterRow): DeadLetterRecoveryCandidate | undefined {
  const failure = parseFailure(row.failure_json);
  if (failure === undefined || row.failed_at === null) {
    return undefined;
  }

  return {
    deadLetterId: row.dead_letter_id,
    organizationId: row.organization_id,
    createdAt: stringifyTimestamp(row.created_at),
    failedAt: stringifyTimestamp(row.failed_at),
    failureMessage: failure.message,
    retryable: failure.retryable,
    attemptCount: Number(row.attempt_count),
  };
}

function parseFailure(value: unknown): { message: string; retryable: boolean } | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  return typeof record.message === "string" && typeof record.retryable === "boolean"
    ? { message: record.message, retryable: record.retryable }
    : undefined;
}

function stringifyTimestamp(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function optionalTimestamp<Key extends string>(
  key: Key,
  value: string | Date | null,
): { [K in Key]?: string } {
  return value === null ? {} : { [key]: stringifyTimestamp(value) } as { [K in Key]?: string };
}

function isEnumValue<Values extends Record<string, string>>(
  values: Values,
  value: unknown,
): value is Values[keyof Values] {
  return typeof value === "string" && Object.values(values).includes(value);
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

const CockroachRecoveryScanSql = {
  ListStaleReactionPlanCandidates: `
    SELECT
      reaction_plan_id,
      organization_id,
      status,
      created_at,
      claimed_at,
      claim_expires_at,
      attempt_count,
      next_attempt_at
    FROM ${CockroachTableName.ReactionPlans}
    WHERE organization_id = $1
      AND (
        (status = '${ReactionPlanStatus.Claimed}' AND claim_expires_at IS NOT NULL AND claim_expires_at <= $2)
        OR (
          status = '${ReactionPlanStatus.Planned}'
          AND created_at <= $3
          AND (next_attempt_at IS NULL OR next_attempt_at <= $2)
        )
      )
    ORDER BY created_at ASC
    LIMIT $4
  `,
  ListStrandedScheduleCandidates: `
    SELECT
      work_schedule_block_id,
      organization_id,
      work_item_id,
      assigned_agent_id,
      assigned_hat_assignment_id,
      state,
      starts_at,
      ends_at
    FROM ${CockroachTableName.WorkScheduleBlocks}
    WHERE organization_id = $1
      AND ends_at <= $2
      AND state IN ('${ScheduleBlockState.Scheduled}', '${ScheduleBlockState.Active}')
    ORDER BY ends_at ASC
    LIMIT $3
  `,
  ListAbandonedRunBindingCandidates: `
    SELECT
      run_id,
      r.work_item_id,
      agent_id,
      session_id,
      hat_assignment_id,
      prompt_flow_run_id,
      r.state,
      (EXTRACT(EPOCH FROM last_heartbeat_at) * 1000)::INT8 AS last_heartbeat_ms
    FROM ${CockroachTableName.HermesRun} AS r
    INNER JOIN ${CockroachTableName.WorkItems} AS w ON w.work_item_id = r.work_item_id
    WHERE w.organization_id = $1
      AND r.state = 'running'
      AND last_heartbeat_at <= $2
    ORDER BY last_heartbeat_at ASC
    LIMIT $3
  `,
  ListDeadLetterCandidates: `
    SELECT
      reaction_plan_id AS dead_letter_id,
      organization_id,
      created_at,
      failed_at,
      failure_json,
      attempt_count
    FROM ${CockroachTableName.ReactionPlans}
    WHERE organization_id = $1
      AND status = '${ReactionPlanStatus.Failed}'
      AND failure_json IS NOT NULL
    ORDER BY failed_at ASC
    LIMIT $2
  `,
} as const;
