import {
  createInMemoryContextPackLifecycleAnchorPort,
  type ContextPackLifecycleAnchorPort,
  type ContextPackLifecycleAnchorRequest,
  type ContextPackLifecycleAnchorResult,
} from "../../application/src/index.ts";
import {
  isBusinessRuleEvaluationStatus,
  isDiscussionAnchorType,
  isDiscussionExpectedOutput,
  isQualityGateKind,
  isQualityGateOutcome,
  ScheduleBlockState,
  isScheduleBlockState,
  isScheduleBlockType,
  isSupervisorChainLevel,
  isSupervisorSignalToolType,
  SupervisorSignalStatus,
  type AgenticActor,
  type BusinessRuleEvaluation,
  type DecisionRecord,
  type DiscussionAnchor,
  type DiscussionExpectedOutput,
  type QualityGateEvaluation,
  type SupervisorSignal,
  type WorkScheduleBlock,
} from "../../domain/src/index.ts";
import { CockroachTableName } from "./cockroach-schema.ts";

export const CockroachContextPackLifecycleAnchorStatement = {
  ListDiscussionAnchorsForWorkItem: "list_context_pack_discussion_anchors_for_work_item",
  ListDecisionRecordsForWorkItem: "list_context_pack_decision_records_for_work_item",
  ListQualityGateEvaluationsForWorkItem: "list_context_pack_quality_gate_evaluations_for_work_item",
  ListWorkScheduleBlocksForWorkItem: "list_context_pack_work_schedule_blocks_for_work_item",
  ListSupervisorSignalsForWorkItem: "list_context_pack_supervisor_signals_for_work_item",
} as const;

export type CockroachContextPackLifecycleAnchorStatement =
  (typeof CockroachContextPackLifecycleAnchorStatement)[keyof typeof CockroachContextPackLifecycleAnchorStatement];

export type CockroachContextPackLifecycleAnchorSqlStatement = {
  name: CockroachContextPackLifecycleAnchorStatement;
  sql: string;
  parameters: readonly unknown[];
};

export type CockroachContextPackLifecycleAnchorSqlResult<Row = Record<string, unknown>> = {
  rows: readonly Row[];
};

export type CockroachContextPackLifecycleAnchorSqlExecutor = {
  execute: <Row = Record<string, unknown>>(
    statement: CockroachContextPackLifecycleAnchorSqlStatement,
  ) => Promise<CockroachContextPackLifecycleAnchorSqlResult<Row>>;
};

export type CreateCockroachContextPackLifecycleAnchorPortInput = {
  executor: CockroachContextPackLifecycleAnchorSqlExecutor;
};

type LifecycleAnchorScope = {
  organizationId: string;
  projectId: string;
  workItemId: string;
  teamId?: string | undefined;
  agentId?: string | undefined;
  hatAssignmentId: string;
};

export function createCockroachContextPackLifecycleAnchorPort(
  input: CreateCockroachContextPackLifecycleAnchorPortInput,
): ContextPackLifecycleAnchorPort {
  return {
    load: async (request) => await loadLifecycleAnchors(input.executor, request),
  };
}

async function loadLifecycleAnchors(
  executor: CockroachContextPackLifecycleAnchorSqlExecutor,
  request: ContextPackLifecycleAnchorRequest,
): Promise<ContextPackLifecycleAnchorResult> {
  const scope = lifecycleAnchorScopeFor(request);
  if (scope === undefined) {
    return { items: [], graphRootSeeds: [] };
  }

  const [
    discussionAnchors,
    decisionRecords,
    qualityGateEvaluations,
    workScheduleBlocks,
    supervisorSignals,
  ] = await Promise.all([
    listDiscussionAnchors(executor, scope),
    listDecisionRecords(executor, scope),
    listQualityGateEvaluations(executor, scope),
    listWorkScheduleBlocks(executor, scope),
    listSupervisorSignals(executor, scope),
  ]);

  return createInMemoryContextPackLifecycleAnchorPort({
    discussionAnchors,
    decisionRecords,
    qualityGateEvaluations,
    workScheduleBlocks,
    supervisorSignals,
  }).load(request);
}

function lifecycleAnchorScopeFor(request: ContextPackLifecycleAnchorRequest): LifecycleAnchorScope | undefined {
  const { organizationId, projectId, workItemId, teamId, agentId, hatAssignmentId } = request.request.snapshot;
  if (organizationId === undefined || projectId === undefined || workItemId === undefined) {
    return undefined;
  }
  return {
    organizationId,
    projectId,
    workItemId,
    ...(teamId === undefined ? {} : { teamId }),
    ...(agentId === undefined ? {} : { agentId }),
    hatAssignmentId,
  };
}

async function listDiscussionAnchors(
  executor: CockroachContextPackLifecycleAnchorSqlExecutor,
  scope: LifecycleAnchorScope,
): Promise<readonly DiscussionAnchor[]> {
  const result = await executor.execute<DiscussionAnchorRow>({
    name: CockroachContextPackLifecycleAnchorStatement.ListDiscussionAnchorsForWorkItem,
    sql: CockroachContextPackLifecycleAnchorSql.ListDiscussionAnchorsForWorkItem,
    parameters: scopedWorkParameters(scope),
  });
  return result.rows.map(mapDiscussionAnchorRow).filter(isDefined);
}

async function listDecisionRecords(
  executor: CockroachContextPackLifecycleAnchorSqlExecutor,
  scope: LifecycleAnchorScope,
): Promise<readonly DecisionRecord[]> {
  const result = await executor.execute<DecisionRecordRow>({
    name: CockroachContextPackLifecycleAnchorStatement.ListDecisionRecordsForWorkItem,
    sql: CockroachContextPackLifecycleAnchorSql.ListDecisionRecordsForWorkItem,
    parameters: scopedWorkParameters(scope),
  });
  return result.rows.map(mapDecisionRecordRow).filter(isDefined);
}

async function listQualityGateEvaluations(
  executor: CockroachContextPackLifecycleAnchorSqlExecutor,
  scope: LifecycleAnchorScope,
): Promise<readonly QualityGateEvaluation[]> {
  const result = await executor.execute<QualityGateEvaluationRow>({
    name: CockroachContextPackLifecycleAnchorStatement.ListQualityGateEvaluationsForWorkItem,
    sql: CockroachContextPackLifecycleAnchorSql.ListQualityGateEvaluationsForWorkItem,
    parameters: scopedWorkParameters(scope),
  });
  return result.rows.map(mapQualityGateEvaluationRow).filter(isDefined);
}

async function listWorkScheduleBlocks(
  executor: CockroachContextPackLifecycleAnchorSqlExecutor,
  scope: LifecycleAnchorScope,
): Promise<readonly WorkScheduleBlock[]> {
  const result = await executor.execute<WorkScheduleBlockRow>({
    name: CockroachContextPackLifecycleAnchorStatement.ListWorkScheduleBlocksForWorkItem,
    sql: CockroachContextPackLifecycleAnchorSql.ListWorkScheduleBlocksForWorkItem,
    parameters: [
      ...scopedWorkParameters(scope),
      scope.agentId ?? null,
      scope.hatAssignmentId,
      ScheduleBlockState.Active,
      ScheduleBlockState.Scheduled,
    ],
  });
  return result.rows.map(mapWorkScheduleBlockRow).filter(isDefined);
}

async function listSupervisorSignals(
  executor: CockroachContextPackLifecycleAnchorSqlExecutor,
  scope: LifecycleAnchorScope,
): Promise<readonly SupervisorSignal[]> {
  const result = await executor.execute<SupervisorSignalRow>({
    name: CockroachContextPackLifecycleAnchorStatement.ListSupervisorSignalsForWorkItem,
    sql: CockroachContextPackLifecycleAnchorSql.ListSupervisorSignalsForWorkItem,
    parameters: [...scopedWorkParameters(scope), scope.hatAssignmentId],
  });
  return result.rows.map((row) => mapSupervisorSignalRow(row, scope)).filter(isDefined);
}

function scopedWorkParameters(scope: LifecycleAnchorScope): readonly unknown[] {
  return [scope.organizationId, scope.projectId, scope.workItemId, scope.teamId ?? null];
}

function mapDiscussionAnchorRow(row: DiscussionAnchorRow): DiscussionAnchor | undefined {
  if (!isDiscussionAnchorType(row.discussion_anchor_type)) {
    return undefined;
  }
  const expectedOutputs = mapDiscussionExpectedOutputs(row.expected_outputs);
  if (expectedOutputs === undefined) {
    return undefined;
  }
  return {
    discussionAnchorId: row.discussion_anchor_id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    ...(row.team_id == null ? {} : { teamId: row.team_id }),
    workItemId: row.work_item_id,
    discussionAnchorType: row.discussion_anchor_type,
    title: row.title,
    purpose: row.purpose,
    expectedOutputs,
    createdAt: stringifyTimestamp(row.created_at),
    createdBy: actor(row.created_by_agent_id, row.created_by_hat_assignment_id),
    metadata: metadata(row),
  };
}

function mapDecisionRecordRow(row: DecisionRecordRow): DecisionRecord | undefined {
  const alternativesConsidered = mapStringArray(row.alternatives_considered);
  const followUpWorkItemIds = mapStringArray(row.follow_up_work_item_ids);
  if (alternativesConsidered === undefined || followUpWorkItemIds === undefined) {
    return undefined;
  }
  return {
    decisionRecordId: row.decision_record_id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    ...(row.team_id == null ? {} : { teamId: row.team_id }),
    workItemId: row.work_item_id,
    discussionAnchorId: row.discussion_anchor_id,
    title: row.title,
    decision: row.decision,
    rationale: row.rationale,
    alternativesConsidered,
    followUpWorkItemIds,
    decidedAt: stringifyTimestamp(row.decided_at),
    decidedBy: actor(row.decided_by_agent_id, row.decided_by_hat_assignment_id),
    metadata: metadata(row),
  };
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
    evaluatedBy: actor(row.evaluated_by_agent_id, row.evaluated_by_hat_assignment_id),
    metadata: metadata(row),
  };
}

function mapWorkScheduleBlockRow(row: WorkScheduleBlockRow): WorkScheduleBlock | undefined {
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
    scheduledBy: actor(row.scheduled_by_agent_id, row.scheduled_by_hat_assignment_id),
    metadata: metadata(row),
  };
}

function mapSupervisorSignalRow(row: SupervisorSignalRow, scope: LifecycleAnchorScope): SupervisorSignal | undefined {
  if (
    !isSupervisorChainLevel(row.source_level) ||
    !isSupervisorChainLevel(row.target_level) ||
    !isSupervisorSignalToolType(row.tool_type) ||
    !isSupervisorSignalStatus(row.status) ||
    row.target_hat_assignment_id !== scope.hatAssignmentId
  ) {
    return undefined;
  }
  return {
    supervisorSignalId: row.supervisor_signal_id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    teamId: row.team_id,
    sourceLevel: row.source_level,
    targetLevel: row.target_level,
    targetHatAssignmentId: row.target_hat_assignment_id,
    sender: actor(row.sender_agent_id, row.sender_hat_assignment_id),
    toolType: row.tool_type,
    status: row.status,
    title: row.title,
    message: row.message,
    relatedWorkItemId: row.related_work_item_id,
    createdAt: stringifyTimestamp(row.created_at),
  };
}

function isSupervisorSignalStatus(value: unknown): value is SupervisorSignalStatus {
  return typeof value === "string" && Object.values(SupervisorSignalStatus).includes(value as SupervisorSignalStatus);
}

function mapDiscussionExpectedOutputs(value: unknown): readonly DiscussionExpectedOutput[] | undefined {
  const parsed = parseJsonArray(value);
  return parsed !== undefined && parsed.every(isDiscussionExpectedOutput) ? parsed : undefined;
}

function mapBusinessRuleResults(value: unknown): readonly BusinessRuleEvaluation[] | undefined {
  const parsed = parseJsonArray(value);
  if (parsed === undefined) return undefined;
  const results = parsed.map(mapBusinessRuleEvaluation);
  return results.every(isDefined) ? results : undefined;
}

function mapBusinessRuleEvaluation(value: unknown): BusinessRuleEvaluation | undefined {
  if (!isRecord(value)) return undefined;
  const evidenceArtifactIds = mapStringArray(value.evidenceArtifactIds);
  if (
    typeof value.ruleId !== "string" ||
    !isBusinessRuleEvaluationStatus(value.status) ||
    evidenceArtifactIds === undefined ||
    typeof value.notes !== "string"
  ) {
    return undefined;
  }
  return {
    ruleId: value.ruleId,
    status: value.status,
    evidenceArtifactIds,
    notes: value.notes,
  };
}

function mapStringArray(value: unknown): readonly string[] | undefined {
  const parsed = parseJsonArray(value);
  return parsed !== undefined && parsed.every(isString) ? parsed : undefined;
}

function parseJsonArray(value: unknown): readonly unknown[] | undefined {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function actor(agentId: string, hatAssignmentId: string): AgenticActor {
  return { agentId, hatAssignmentId };
}

function metadata(row: MetadataRow) {
  return {
    updatedAt: stringifyTimestamp(row.updated_at),
    version: Number(row.version),
    correlationId: row.correlation_id,
    causationId: row.causation_id,
    traceId: row.trace_id,
  };
}

function stringifyTimestamp(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function isDefined<Record>(record: Record | undefined): record is Record {
  return record !== undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

type MetadataRow = {
  updated_at: string | Date;
  version: number | string;
  correlation_id: string;
  causation_id: string;
  trace_id: string;
};

type DiscussionAnchorRow = MetadataRow & {
  discussion_anchor_id: string;
  organization_id: string;
  project_id: string;
  team_id?: string | null;
  work_item_id: string;
  discussion_anchor_type: unknown;
  title: string;
  purpose: string;
  expected_outputs: unknown;
  created_by_agent_id: string;
  created_by_hat_assignment_id: string;
  created_at: string | Date;
};

type DecisionRecordRow = MetadataRow & {
  decision_record_id: string;
  organization_id: string;
  project_id: string;
  team_id?: string | null;
  work_item_id: string;
  discussion_anchor_id: string;
  title: string;
  decision: string;
  rationale: string;
  alternatives_considered: unknown;
  follow_up_work_item_ids: unknown;
  decided_by_agent_id: string;
  decided_by_hat_assignment_id: string;
  decided_at: string | Date;
};

type QualityGateEvaluationRow = MetadataRow & {
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
};

type WorkScheduleBlockRow = MetadataRow & {
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
};

type SupervisorSignalRow = {
  supervisor_signal_id: string;
  organization_id: string;
  project_id: string;
  team_id: string;
  source_level: unknown;
  target_level: unknown;
  target_hat_assignment_id: string;
  sender_agent_id: string;
  sender_hat_assignment_id: string;
  tool_type: unknown;
  status: unknown;
  title: string;
  message: string;
  related_work_item_id: string;
  created_at: string | Date;
};

const CockroachContextPackLifecycleAnchorSql = {
  ListDiscussionAnchorsForWorkItem: `
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
    WHERE organization_id = $1
      AND project_id = $2
      AND work_item_id = $3
      AND ($4::STRING IS NULL OR team_id IS NULL OR team_id = $4)
    ORDER BY created_at ASC, discussion_anchor_id ASC
  `,
  ListDecisionRecordsForWorkItem: `
    SELECT
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
    FROM ${CockroachTableName.DecisionRecords}
    WHERE organization_id = $1
      AND project_id = $2
      AND work_item_id = $3
      AND ($4::STRING IS NULL OR team_id IS NULL OR team_id = $4)
    ORDER BY decided_at ASC, decision_record_id ASC
  `,
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
      AND ($4::STRING IS NULL OR team_id IS NULL OR team_id = $4)
    ORDER BY evaluated_at ASC, quality_gate_evaluation_id ASC
  `,
  ListWorkScheduleBlocksForWorkItem: `
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
    WHERE organization_id = $1
      AND project_id = $2
      AND work_item_id = $3
      AND ($4::STRING IS NULL OR team_id IS NULL OR team_id = $4)
      AND ($5::STRING IS NULL OR assigned_agent_id = $5)
      AND assigned_hat_assignment_id = $6
      AND state IN ($7, $8)
    ORDER BY starts_at ASC, work_schedule_block_id ASC
  `,
  ListSupervisorSignalsForWorkItem: `
    SELECT
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
    FROM ${CockroachTableName.SupervisorSignals}
    WHERE organization_id = $1
      AND project_id = $2
      AND related_work_item_id = $3
      AND ($4::STRING IS NULL OR team_id IS NULL OR team_id = $4)
      AND target_hat_assignment_id = $5
    ORDER BY created_at ASC, supervisor_signal_id ASC
  `,
} as const;
