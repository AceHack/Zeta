import {
  ContextPackInboxAnchorPriority,
  ContextPackInboxAnchorStatus,
  contextPackInboxWorkflowViewFor,
  createInMemoryContextPackInboxAnchorPort,
  type ContextPackInboxAnchor,
  type ContextPackInboxAnchorPort,
  type ContextPackInboxAnchorRequest,
  type ContextPackInboxAnchorResult,
  type ContextPackInboxWorkflowView,
} from "../../application/src/index.ts";
import { CockroachTableName } from "./cockroach-schema.ts";

export const CockroachContextPackInboxAnchorStatement = {
  ListInboxAnchorsForHat: "list_context_pack_inbox_anchors_for_hat",
  ListInboxWorkflowAnchorsForHat: "list_context_pack_inbox_workflow_anchors_for_hat",
} as const;

export type CockroachContextPackInboxAnchorStatement =
  (typeof CockroachContextPackInboxAnchorStatement)[keyof typeof CockroachContextPackInboxAnchorStatement];

export type CockroachContextPackInboxAnchorSqlStatement = {
  name: CockroachContextPackInboxAnchorStatement;
  sql: string;
  parameters: readonly unknown[];
};

export type CockroachContextPackInboxAnchorSqlResult<Row = Record<string, unknown>> = {
  rows: readonly Row[];
};

export type CockroachContextPackInboxAnchorSqlExecutor = {
  execute: <Row = Record<string, unknown>>(
    statement: CockroachContextPackInboxAnchorSqlStatement,
  ) => Promise<CockroachContextPackInboxAnchorSqlResult<Row>>;
};

export type CreateCockroachContextPackInboxAnchorPortInput = {
  executor: CockroachContextPackInboxAnchorSqlExecutor;
};

export type ContextPackInboxWorkflowAnchorLookup = {
  organizationId: string;
  projectId: string;
  teamId?: string | undefined;
  targetHatAssignmentId: string;
  targetAgentId?: string | undefined;
  observedAt: string;
};

export type CockroachContextPackInboxWorkflowViewReader = {
  load: (lookup: ContextPackInboxWorkflowAnchorLookup) => Promise<ContextPackInboxWorkflowView>;
};

type InboxAnchorScope = {
  organizationId: string;
  projectId: string;
  teamId?: string | undefined;
  agentId?: string | undefined;
  hatAssignmentId: string;
};

export function createCockroachContextPackInboxAnchorPort(
  input: CreateCockroachContextPackInboxAnchorPortInput,
): ContextPackInboxAnchorPort {
  return {
    load: async (request) => await loadInboxAnchors(input.executor, request),
  };
}

export function createCockroachContextPackInboxWorkflowViewReader(
  input: CreateCockroachContextPackInboxAnchorPortInput,
): CockroachContextPackInboxWorkflowViewReader {
  return {
    load: async (lookup) => {
      const inboxAnchors = await listInboxWorkflowAnchors(input.executor, lookup);
      return contextPackInboxWorkflowViewFor({
        organizationId: lookup.organizationId,
        targetHatAssignmentId: lookup.targetHatAssignmentId,
        ...(lookup.targetAgentId === undefined ? {} : { targetAgentId: lookup.targetAgentId }),
        observedAt: lookup.observedAt,
        inboxAnchors,
      });
    },
  };
}

async function loadInboxAnchors(
  executor: CockroachContextPackInboxAnchorSqlExecutor,
  request: ContextPackInboxAnchorRequest,
): Promise<ContextPackInboxAnchorResult> {
  const scope = inboxAnchorScopeFor(request);
  if (scope === undefined) {
    return { items: [], graphRootSeeds: [] };
  }

  const inboxAnchors = await listInboxAnchors(executor, scope, request.observedAt);
  return createInMemoryContextPackInboxAnchorPort({ inboxAnchors }).load(request);
}

function inboxAnchorScopeFor(request: ContextPackInboxAnchorRequest): InboxAnchorScope | undefined {
  const { organizationId, projectId, teamId, agentId, hatAssignmentId } = request.request.snapshot;
  if (organizationId === undefined || projectId === undefined) {
    return undefined;
  }
  return {
    organizationId,
    projectId,
    ...(teamId === undefined ? {} : { teamId }),
    ...(agentId === undefined ? {} : { agentId }),
    hatAssignmentId,
  };
}

async function listInboxAnchors(
  executor: CockroachContextPackInboxAnchorSqlExecutor,
  scope: InboxAnchorScope,
  observedAt: string,
): Promise<readonly ContextPackInboxAnchor[]> {
  const result = await executor.execute<InboxAnchorRow>({
    name: CockroachContextPackInboxAnchorStatement.ListInboxAnchorsForHat,
    sql: CockroachContextPackInboxAnchorSql.ListInboxAnchorsForHat,
    parameters: [
      scope.organizationId,
      scope.projectId,
      scope.teamId ?? null,
      scope.agentId ?? null,
      scope.hatAssignmentId,
      ContextPackInboxAnchorStatus.Dismissed,
      observedAt,
    ],
  });
  return result.rows.map(mapInboxAnchorRow).filter(isDefined);
}

async function listInboxWorkflowAnchors(
  executor: CockroachContextPackInboxAnchorSqlExecutor,
  lookup: ContextPackInboxWorkflowAnchorLookup,
): Promise<readonly ContextPackInboxAnchor[]> {
  const result = await executor.execute<InboxAnchorRow>({
    name: CockroachContextPackInboxAnchorStatement.ListInboxWorkflowAnchorsForHat,
    sql: CockroachContextPackInboxAnchorSql.ListInboxWorkflowAnchorsForHat,
    parameters: [
      lookup.organizationId,
      lookup.projectId,
      lookup.teamId ?? null,
      lookup.targetHatAssignmentId,
      lookup.targetAgentId ?? null,
      ContextPackInboxAnchorStatus.Dismissed,
    ],
  });
  return result.rows.map(mapInboxAnchorRow).filter(isDefined);
}

function mapInboxAnchorRow(row: InboxAnchorRow): ContextPackInboxAnchor | undefined {
  if (!isContextPackInboxAnchorPriority(row.priority) || !isContextPackInboxAnchorStatus(row.status)) {
    return undefined;
  }
  return {
    inboxAnchorId: row.inbox_anchor_id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    ...(row.team_id == null ? {} : { teamId: row.team_id }),
    ...(row.work_item_id == null ? {} : { workItemId: row.work_item_id }),
    targetHatAssignmentId: row.target_hat_assignment_id,
    ...(row.target_agent_id == null ? {} : { targetAgentId: row.target_agent_id }),
    title: row.title,
    summary: row.summary,
    priority: row.priority,
    status: row.status,
    deliveredAt: stringifyTimestamp(row.delivered_at),
    ...(row.snoozed_until == null ? {} : { snoozedUntil: stringifyTimestamp(row.snoozed_until) }),
    ...(row.source_ref == null ? {} : { sourceRef: row.source_ref }),
    ...(row.trace_id == null ? {} : { traceId: row.trace_id }),
  };
}

function isContextPackInboxAnchorPriority(value: unknown): value is ContextPackInboxAnchorPriority {
  return typeof value === "string" &&
    Object.values(ContextPackInboxAnchorPriority).includes(value as ContextPackInboxAnchorPriority);
}

function isContextPackInboxAnchorStatus(value: unknown): value is ContextPackInboxAnchorStatus {
  return typeof value === "string" &&
    Object.values(ContextPackInboxAnchorStatus).includes(value as ContextPackInboxAnchorStatus);
}

function stringifyTimestamp(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function isDefined<Record>(record: Record | undefined): record is Record {
  return record !== undefined;
}

type InboxAnchorRow = {
  inbox_anchor_id: string;
  organization_id: string;
  project_id: string;
  team_id?: string | null;
  work_item_id?: string | null;
  target_hat_assignment_id: string;
  target_agent_id?: string | null;
  title: string;
  summary: string;
  priority: unknown;
  status: unknown;
  delivered_at: string | Date;
  snoozed_until?: string | Date | null;
  source_ref?: string | null;
  trace_id?: string | null;
};

const CockroachContextPackInboxAnchorSql = {
  ListInboxAnchorsForHat: `
    SELECT
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
      snoozed_until,
      source_ref,
      trace_id
    FROM ${CockroachTableName.ContextPackInboxAnchors}
    WHERE organization_id = $1
      AND project_id = $2
      AND ($3::STRING IS NULL OR team_id IS NULL OR team_id = $3)
      AND ($4::STRING IS NULL OR target_agent_id IS NULL OR target_agent_id = $4)
      AND target_hat_assignment_id = $5
      AND status <> $6
      AND (status <> '${ContextPackInboxAnchorStatus.Snoozed}' OR snoozed_until <= $7::TIMESTAMPTZ)
    ORDER BY
      CASE priority WHEN '${ContextPackInboxAnchorPriority.Urgent}' THEN 0 ELSE 1 END ASC,
      delivered_at DESC,
      inbox_anchor_id ASC
  `,
  ListInboxWorkflowAnchorsForHat: `
    SELECT
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
      snoozed_until,
      source_ref,
      trace_id
    FROM ${CockroachTableName.ContextPackInboxAnchors}
    WHERE organization_id = $1
      AND project_id = $2
      AND ($3::STRING IS NULL OR team_id IS NULL OR team_id = $3)
      AND target_hat_assignment_id = $4
      AND ($5::STRING IS NULL OR target_agent_id IS NULL OR target_agent_id = $5)
      AND status <> $6
    ORDER BY
      delivered_at DESC,
      inbox_anchor_id ASC
  `,
} as const;
