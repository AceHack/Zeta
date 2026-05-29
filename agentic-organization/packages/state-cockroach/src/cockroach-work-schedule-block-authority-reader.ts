import type { WorkScheduleBlockAuthorityReaderPort } from "../../application/src/index.ts";
import {
  ScheduleBlockState,
  isScheduleBlockState,
  isScheduleBlockType,
  type WorkScheduleBlock,
} from "../../domain/src/index.ts";
import type { WorkScheduleBlockAuthorityLookup } from "../../application/src/index.ts";
import { CockroachTableName } from "./cockroach-schema.ts";

export const CockroachWorkScheduleBlockAuthorityReaderStatement = {
  FindAuthorizingScheduleBlocks: "find_authorizing_schedule_blocks",
} as const;

export type CockroachWorkScheduleBlockAuthorityReaderStatement =
  (typeof CockroachWorkScheduleBlockAuthorityReaderStatement)[keyof typeof CockroachWorkScheduleBlockAuthorityReaderStatement];

export type CockroachWorkScheduleBlockAuthoritySqlStatement = {
  name: CockroachWorkScheduleBlockAuthorityReaderStatement;
  sql: string;
  parameters: readonly unknown[];
};

export type CockroachWorkScheduleBlockAuthoritySqlResult<Row = Record<string, unknown>> = {
  rows: readonly Row[];
};

export type CockroachWorkScheduleBlockAuthoritySqlExecutor = {
  execute: <Row = Record<string, unknown>>(
    statement: CockroachWorkScheduleBlockAuthoritySqlStatement,
  ) => Promise<CockroachWorkScheduleBlockAuthoritySqlResult<Row>>;
};

export type CreateCockroachWorkScheduleBlockAuthorityReaderInput = {
  executor: CockroachWorkScheduleBlockAuthoritySqlExecutor;
};

export function createCockroachWorkScheduleBlockAuthorityReader(
  input: CreateCockroachWorkScheduleBlockAuthorityReaderInput,
): WorkScheduleBlockAuthorityReaderPort {
  return {
    findAuthorizingScheduleBlocks: async (lookup) => findAuthorizingScheduleBlocks(input.executor, lookup),
  };
}

async function findAuthorizingScheduleBlocks(
  executor: CockroachWorkScheduleBlockAuthoritySqlExecutor,
  lookup: WorkScheduleBlockAuthorityLookup,
): Promise<readonly WorkScheduleBlock[]> {
  const result = await executor.execute<WorkScheduleBlockAuthorityRow>({
    name: CockroachWorkScheduleBlockAuthorityReaderStatement.FindAuthorizingScheduleBlocks,
    sql: CockroachWorkScheduleBlockAuthoritySql.FindAuthorizingScheduleBlocks,
    parameters: [
      lookup.agentId,
      lookup.hatAssignmentId,
      lookup.evaluatedAt,
      ScheduleBlockState.Active,
      ScheduleBlockState.Scheduled,
    ],
  });

  return result.rows.map(mapScheduleBlockRow).filter(isDefined);
}

function mapScheduleBlockRow(row: WorkScheduleBlockAuthorityRow): WorkScheduleBlock | undefined {
  if (!isScheduleBlockType(row.block_type) || !isScheduleBlockState(row.state)) {
    return undefined;
  }

  return {
    workScheduleBlockId: row.work_schedule_block_id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    ...(row.team_id == null ? {} : { teamId: row.team_id }),
    workItemId: row.work_item_id,
    ...(row.discussion_anchor_id == null ? {} : { discussionAnchorId: row.discussion_anchor_id }),
    assignedAgentId: row.assigned_agent_id,
    assignedHatAssignmentId: row.assigned_hat_assignment_id,
    blockType: row.block_type,
    state: row.state,
    title: row.title,
    purpose: row.purpose,
    startsAt: stringifyTimestamp(row.starts_at),
    endsAt: stringifyTimestamp(row.ends_at),
    scheduledAt: stringifyTimestamp(row.scheduled_at),
    scheduledBy: {
      agentId: row.scheduled_by_agent_id,
      hatAssignmentId: row.scheduled_by_hat_assignment_id,
    },
    metadata: {
      updatedAt: stringifyTimestamp(row.updated_at),
      version: Number(row.version),
      correlationId: row.correlation_id,
      causationId: row.causation_id,
      traceId: row.trace_id,
    },
  };
}

function isDefined<Record>(record: Record | undefined): record is Record {
  return record !== undefined;
}

function stringifyTimestamp(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

type WorkScheduleBlockAuthorityRow = {
  work_schedule_block_id: string;
  organization_id: string;
  project_id: string;
  team_id?: string | null;
  work_item_id: string;
  discussion_anchor_id?: string | null;
  assigned_agent_id: string;
  assigned_hat_assignment_id: string;
  block_type: unknown;
  state: unknown;
  title: string;
  purpose: string;
  starts_at: string | Date;
  ends_at: string | Date;
  scheduled_by_agent_id: string;
  scheduled_by_hat_assignment_id: string;
  scheduled_at: string | Date;
  updated_at: string | Date;
  version: number | string;
  correlation_id: string;
  causation_id: string;
  trace_id: string;
};

const CockroachWorkScheduleBlockAuthoritySql = {
  FindAuthorizingScheduleBlocks: `
    SELECT
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
    FROM ${CockroachTableName.WorkScheduleBlocks}
    WHERE assigned_agent_id = $1
      AND assigned_hat_assignment_id = $2
      AND starts_at <= $3
      AND ends_at > $3
      AND state IN ($4, $5)
    ORDER BY starts_at ASC, work_schedule_block_id ASC
  `,
} as const;
