import type { DiscussionAnchorStateReaderPort } from "../../application/src/index.ts";
import {
  DiscussionAnchorType,
  DiscussionExpectedOutput,
  isDiscussionExpectedOutput,
  type AgenticActor,
  type DiscussionAnchor,
} from "../../domain/src/index.ts";
import { CockroachTableName } from "./cockroach-schema.ts";

export const CockroachDiscussionAnchorStateStoreStatement = {
  FindDiscussionAnchor: "find_discussion_anchor",
} as const;

export type CockroachDiscussionAnchorStateStoreStatement =
  (typeof CockroachDiscussionAnchorStateStoreStatement)[keyof typeof CockroachDiscussionAnchorStateStoreStatement];

export type CockroachDiscussionAnchorSqlStatement = {
  name: CockroachDiscussionAnchorStateStoreStatement;
  sql: string;
  parameters: readonly unknown[];
};

export type CockroachDiscussionAnchorSqlResult<Row = Record<string, unknown>> = {
  rows: readonly Row[];
};

export type CockroachDiscussionAnchorSqlExecutor = {
  execute: <Row = Record<string, unknown>>(
    statement: CockroachDiscussionAnchorSqlStatement,
  ) => Promise<CockroachDiscussionAnchorSqlResult<Row>>;
};

export type CreateCockroachDiscussionAnchorStateStoreInput = {
  executor: CockroachDiscussionAnchorSqlExecutor;
};

export function createCockroachDiscussionAnchorStateStore(
  input: CreateCockroachDiscussionAnchorStateStoreInput,
): DiscussionAnchorStateReaderPort {
  return {
    findDiscussionAnchor: async (discussionAnchorId) =>
      mapDiscussionAnchorRow((await input.executor.execute<DiscussionAnchorRow>({
        name: CockroachDiscussionAnchorStateStoreStatement.FindDiscussionAnchor,
        sql: CockroachDiscussionAnchorSql.FindDiscussionAnchor,
        parameters: [discussionAnchorId],
      })).rows[0]),
  };
}

function mapDiscussionAnchorRow(row: DiscussionAnchorRow | undefined): DiscussionAnchor | undefined {
  if (row === undefined) {
    return undefined;
  }

  const expectedOutputs = parseDiscussionExpectedOutputs(row.expected_outputs);

  if (expectedOutputs === undefined) {
    return undefined;
  }

  const discussionAnchor: DiscussionAnchor = {
    discussionAnchorId: row.discussion_anchor_id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    workItemId: row.work_item_id,
    discussionAnchorType: row.discussion_anchor_type,
    title: row.title,
    purpose: row.purpose,
    expectedOutputs,
    createdAt: stringifyTimestamp(row.created_at),
    createdBy: mapActor(row),
    metadata: {
      updatedAt: stringifyTimestamp(row.updated_at),
      version: Number(row.version),
      correlationId: row.correlation_id,
      causationId: row.causation_id,
      traceId: row.trace_id,
    },
  };

  if (row.team_id !== undefined && row.team_id !== null) {
    discussionAnchor.teamId = row.team_id;
  }

  return discussionAnchor;
}

function parseDiscussionExpectedOutputs(value: unknown): readonly DiscussionExpectedOutput[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  if (!value.every(isDiscussionExpectedOutput)) {
    return undefined;
  }

  return value;
}

function mapActor(row: Pick<DiscussionAnchorRow, "created_by_agent_id" | "created_by_hat_assignment_id">): AgenticActor {
  return {
    agentId: row.created_by_agent_id,
    hatAssignmentId: row.created_by_hat_assignment_id,
  };
}

function stringifyTimestamp(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

type DiscussionAnchorRow = {
  discussion_anchor_id: string;
  organization_id: string;
  project_id: string;
  team_id?: string | null;
  work_item_id: string;
  discussion_anchor_type: DiscussionAnchorType;
  title: string;
  purpose: string;
  expected_outputs: unknown;
  created_by_agent_id: string;
  created_by_hat_assignment_id: string;
  created_at: string | Date;
  updated_at: string | Date;
  version: number | string;
  correlation_id: string;
  causation_id: string;
  trace_id: string;
};

const CockroachDiscussionAnchorSql = {
  FindDiscussionAnchor: `
    SELECT
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
    FROM ${CockroachTableName.DiscussionAnchors}
    WHERE discussion_anchor_id = $1
  `,
} as const;
