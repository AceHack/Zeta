import type {
  QualityGateEvaluationStateReaderPort,
  QualityGateEvaluationWorkItemLookup,
} from "../../application/src/index.ts";
import {
  isBusinessRuleEvaluationStatus,
  isQualityGateKind,
  isQualityGateOutcome,
  type BusinessRuleEvaluation,
  type QualityGateEvaluation,
} from "../../domain/src/index.ts";
import { CockroachTableName } from "./cockroach-schema.ts";

export const CockroachQualityGateEvaluationStateReaderStatement = {
  ListQualityGateEvaluationsForWorkItem: "list_quality_gate_evaluations_for_work_item",
} as const;

export type CockroachQualityGateEvaluationStateReaderStatement =
  (typeof CockroachQualityGateEvaluationStateReaderStatement)[keyof typeof CockroachQualityGateEvaluationStateReaderStatement];

export type CockroachQualityGateEvaluationSqlStatement = {
  name: CockroachQualityGateEvaluationStateReaderStatement;
  sql: string;
  parameters: readonly unknown[];
};

export type CockroachQualityGateEvaluationSqlResult<Row = Record<string, unknown>> = {
  rows: readonly Row[];
};

export type CockroachQualityGateEvaluationSqlExecutor = {
  execute: <Row = Record<string, unknown>>(
    statement: CockroachQualityGateEvaluationSqlStatement,
  ) => Promise<CockroachQualityGateEvaluationSqlResult<Row>>;
};

export type CreateCockroachQualityGateEvaluationStateReaderInput = {
  executor: CockroachQualityGateEvaluationSqlExecutor;
};

export function createCockroachQualityGateEvaluationStateReader(
  input: CreateCockroachQualityGateEvaluationStateReaderInput,
): QualityGateEvaluationStateReaderPort {
  return {
    listQualityGateEvaluationsForWorkItem: async (lookup) =>
      listQualityGateEvaluationsForWorkItem(input.executor, lookup),
  };
}

async function listQualityGateEvaluationsForWorkItem(
  executor: CockroachQualityGateEvaluationSqlExecutor,
  lookup: QualityGateEvaluationWorkItemLookup,
): Promise<readonly QualityGateEvaluation[]> {
  const result = await executor.execute<QualityGateEvaluationRow>({
    name: CockroachQualityGateEvaluationStateReaderStatement.ListQualityGateEvaluationsForWorkItem,
    sql: CockroachQualityGateEvaluationSql.ListQualityGateEvaluationsForWorkItem,
    parameters: [lookup.organizationId, lookup.projectId, lookup.workItemId, lookup.teamId ?? null],
  });

  return result.rows.map(mapQualityGateEvaluationRow).filter(isDefined);
}

function mapQualityGateEvaluationRow(row: QualityGateEvaluationRow): QualityGateEvaluation | undefined {
  if (!isQualityGateKind(row.gate_kind) || !isQualityGateOutcome(row.outcome)) {
    return undefined;
  }

  const evaluatedArtifactIds = mapStringArray(row.evaluated_artifact_ids);
  const businessRuleResults = mapBusinessRuleResults(row.business_rule_results);

  if (evaluatedArtifactIds === undefined || businessRuleResults === undefined) {
    return undefined;
  }

  return {
    qualityGateEvaluationId: row.quality_gate_evaluation_id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    ...(row.team_id == null ? {} : { teamId: row.team_id }),
    workItemId: row.work_item_id,
    discussionAnchorId: row.discussion_anchor_id,
    gateKind: row.gate_kind,
    outcome: row.outcome,
    summary: row.summary,
    evaluatedArtifactIds,
    businessRuleResults,
    evaluatedAt: stringifyTimestamp(row.evaluated_at),
    evaluatedBy: {
      agentId: row.evaluated_by_agent_id,
      hatAssignmentId: row.evaluated_by_hat_assignment_id,
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

function mapBusinessRuleResults(value: unknown): readonly BusinessRuleEvaluation[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const results = value.map(mapBusinessRuleEvaluation);

  return results.every(isDefined) ? results : undefined;
}

function mapBusinessRuleEvaluation(value: unknown): BusinessRuleEvaluation | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const ruleId = value.ruleId;
  const status = value.status;
  const evidenceArtifactIds = mapStringArray(value.evidenceArtifactIds);
  const notes = value.notes;

  if (
    typeof ruleId !== "string" ||
    !isBusinessRuleEvaluationStatus(status) ||
    evidenceArtifactIds === undefined ||
    typeof notes !== "string"
  ) {
    return undefined;
  }

  return {
    ruleId,
    status,
    evidenceArtifactIds,
    notes,
  };
}

function mapStringArray(value: unknown): readonly string[] | undefined {
  return Array.isArray(value) && value.every(isString) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isDefined<Record>(record: Record | undefined): record is Record {
  return record !== undefined;
}

function stringifyTimestamp(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

type QualityGateEvaluationRow = {
  quality_gate_evaluation_id: string;
  organization_id: string;
  project_id: string;
  team_id?: string | null;
  work_item_id: string;
  discussion_anchor_id: string;
  gate_kind: unknown;
  outcome: unknown;
  summary: string;
  evaluated_artifact_ids: unknown;
  business_rule_results: unknown;
  evaluated_by_agent_id: string;
  evaluated_by_hat_assignment_id: string;
  evaluated_at: string | Date;
  updated_at: string | Date;
  version: number | string;
  correlation_id: string;
  causation_id: string;
  trace_id: string;
};

const CockroachQualityGateEvaluationSql = {
  ListQualityGateEvaluationsForWorkItem: `
    SELECT
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
    FROM ${CockroachTableName.QualityGateEvaluations}
    WHERE organization_id = $1
      AND project_id = $2
      AND work_item_id = $3
      AND ($4::STRING IS NULL OR team_id = $4)
    ORDER BY evaluated_at ASC, quality_gate_evaluation_id ASC
  `,
} as const;
