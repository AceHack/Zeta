import type {
  ContextPackDocConsultOutcomeAggregationScope,
  ContextPackDocConsultLedgerPort,
  ContextPackDocConsultOutcomeCounts,
  ContextPackDocConsultOutcomeLookup,
  ContextPackDocConsultOutcomeReaderPort,
  ContextPackDocConsultOutcomeStamp,
  ContextPackDocConsultOutcomeStampResult,
  ContextPackDocConsultOutcomeWriterPort,
  ContextPackDocConsultRecord,
} from "../../application/src/index.ts";
import {
  ContextPackDocConsultOutcomeAggregationScope as ContextPackDocConsultOutcomeAggregationScopeValue,
  contextPackDocConsultOutcomeClassFor,
  ContextPackDocConsultOutcomeClass,
} from "../../application/src/index.ts";
import { CockroachTableName } from "./cockroach-schema.ts";
import type { CockroachGenericSqlTransactionExecutor } from "./cockroach-sql-executor.ts";

export const CockroachDocConsultLedgerStoreStatement = {
  UpsertMany: "upsert_doc_consult_ledger_records",
  LoadOutcomeCounts: "load_doc_consult_outcome_counts",
  StampOutcome: "stamp_doc_consult_outcome",
} as const;

export type CockroachDocConsultLedgerStoreStatement =
  (typeof CockroachDocConsultLedgerStoreStatement)[keyof typeof CockroachDocConsultLedgerStoreStatement];

export type CreateCockroachDocConsultLedgerStoreInput = {
  executor: CockroachGenericSqlTransactionExecutor;
};

export type CockroachDocConsultLedgerStore =
  ContextPackDocConsultLedgerPort &
  ContextPackDocConsultOutcomeReaderPort &
  ContextPackDocConsultOutcomeWriterPort;

export function createCockroachDocConsultLedgerStore(
  input: CreateCockroachDocConsultLedgerStoreInput,
): CockroachDocConsultLedgerStore {
  return {
    async recordMany(records): Promise<void> {
      for (const record of records) {
        await input.executor.execute({
          name: CockroachDocConsultLedgerStoreStatement.UpsertMany,
          sql: `
            INSERT INTO ${CockroachTableName.DocConsultLedger} (
              doc_consult_id, organization_id, doc_unit_id, stage_id, work_item_id,
              consulted_at, outcome, context_pack_id, run_id, scope, hat_id,
              hat_assignment_id, agent_id, project_id, team_id, context_item_ids,
              source_refs, required, freshness, reasons, doc_type, doc_scope_kind,
              doc_scope_id, content_ref, content_hash, source_id, doc_version,
              trace_id, correlation_id, causation_id
            ) VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
              $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
              $21,$22,$23,$24,$25,$26,$27,$28,$29,$30
            )
            ON CONFLICT (doc_consult_id) DO UPDATE SET
              organization_id = excluded.organization_id,
              doc_unit_id = excluded.doc_unit_id,
              stage_id = excluded.stage_id,
              work_item_id = excluded.work_item_id,
              consulted_at = excluded.consulted_at,
              outcome = COALESCE(excluded.outcome, ${CockroachTableName.DocConsultLedger}.outcome),
              context_pack_id = excluded.context_pack_id,
              run_id = excluded.run_id,
              scope = excluded.scope,
              hat_id = excluded.hat_id,
              hat_assignment_id = excluded.hat_assignment_id,
              agent_id = excluded.agent_id,
              project_id = excluded.project_id,
              team_id = excluded.team_id,
              context_item_ids = excluded.context_item_ids,
              source_refs = excluded.source_refs,
              required = excluded.required,
              freshness = excluded.freshness,
              reasons = excluded.reasons,
              doc_type = excluded.doc_type,
              doc_scope_kind = excluded.doc_scope_kind,
              doc_scope_id = excluded.doc_scope_id,
              content_ref = excluded.content_ref,
              content_hash = excluded.content_hash,
              source_id = excluded.source_id,
              doc_version = excluded.doc_version,
              trace_id = excluded.trace_id,
              correlation_id = excluded.correlation_id,
              causation_id = excluded.causation_id`,
          parameters: parametersFor(record),
        });
      }
    },
    async loadOutcomeCounts(lookup): Promise<ReadonlyMap<string, ContextPackDocConsultOutcomeCounts>> {
      if (isExactWorkItemLookupMissingWorkItemId(lookup)) {
        return new Map<string, ContextPackDocConsultOutcomeCounts>();
      }
      const statement = loadOutcomeCountsStatement(lookup);
      const result = await input.executor.execute<OutcomeCountRow>(statement);
      return aggregateOutcomeCounts(result.rows);
    },
    async stampOutcome(stamp): Promise<ContextPackDocConsultOutcomeStampResult> {
      const statement = stampOutcomeStatement(stamp);
      const result = await input.executor.execute<{ doc_consult_id: string }>(statement);
      return { stampedCount: result.rows.length };
    },
  };
}

const CockroachDocConsultOutcomeFilterColumn = {
  HatId: "hat_id",
  StageId: "stage_id",
  ProjectId: "project_id",
  TeamId: "team_id",
  WorkItemId: "work_item_id",
} as const;

type CockroachDocConsultOutcomeFilterColumn =
  (typeof CockroachDocConsultOutcomeFilterColumn)[keyof typeof CockroachDocConsultOutcomeFilterColumn];

type OutcomeFilter = {
  column: CockroachDocConsultOutcomeFilterColumn;
  value: string | undefined;
};

type OutcomeCountRow = {
  doc_unit_id: string;
  outcome: string | null;
  count: string | number;
};

const CockroachDocConsultOutcomeStampFilterColumn = {
  ProjectId: "project_id",
  WorkItemId: "work_item_id",
  TeamId: "team_id",
} as const;

type CockroachDocConsultOutcomeStampFilterColumn =
  (typeof CockroachDocConsultOutcomeStampFilterColumn)[keyof typeof CockroachDocConsultOutcomeStampFilterColumn];

type StampFilter = {
  column: CockroachDocConsultOutcomeStampFilterColumn;
  value: string | undefined;
};

function loadOutcomeCountsStatement(lookup: ContextPackDocConsultOutcomeLookup): {
  name: CockroachDocConsultLedgerStoreStatement;
  sql: string;
  parameters: readonly unknown[];
} {
  const parameters: unknown[] = [lookup.organizationId];
  const filters: readonly OutcomeFilter[] = [
    { column: CockroachDocConsultOutcomeFilterColumn.HatId, value: lookup.hatId },
    { column: CockroachDocConsultOutcomeFilterColumn.StageId, value: lookup.stageId },
    { column: CockroachDocConsultOutcomeFilterColumn.ProjectId, value: lookup.projectId },
    { column: CockroachDocConsultOutcomeFilterColumn.TeamId, value: lookup.teamId },
    {
      column: CockroachDocConsultOutcomeFilterColumn.WorkItemId,
      value: shouldFilterExactWorkItem(lookup.aggregationScope) ? lookup.workItemId : undefined,
    },
  ];
  const clauses: string[] = ["organization_id = $1", "outcome IS NOT NULL"];
  for (const filter of filters) {
    if (filter.value === undefined) continue;
    parameters.push(filter.value);
    clauses.push(`${filter.column} = $${parameters.length}`);
  }

  return {
    name: CockroachDocConsultLedgerStoreStatement.LoadOutcomeCounts,
    sql: `
      SELECT doc_unit_id, outcome, COUNT(*) AS count
      FROM ${CockroachTableName.DocConsultOutcomes}
      WHERE ${clauses.join(" AND ")}
      GROUP BY doc_unit_id, outcome`,
    parameters,
  };
}

function shouldFilterExactWorkItem(
  aggregationScope: ContextPackDocConsultOutcomeAggregationScope | undefined,
): boolean {
  return aggregationScope === ContextPackDocConsultOutcomeAggregationScopeValue.ExactWorkItem;
}

function isExactWorkItemLookupMissingWorkItemId(lookup: ContextPackDocConsultOutcomeLookup): boolean {
  return (
    shouldFilterExactWorkItem(lookup.aggregationScope) &&
    (typeof lookup.workItemId !== "string" || lookup.workItemId.trim().length === 0)
  );
}

function aggregateOutcomeCounts(
  rows: readonly OutcomeCountRow[],
): ReadonlyMap<string, ContextPackDocConsultOutcomeCounts> {
  const counts = new Map<string, ContextPackDocConsultOutcomeCounts>();
  for (const row of rows) {
    if (row.outcome === null) continue;
    const outcomeClass = contextPackDocConsultOutcomeClassFor(row.outcome);
    if (outcomeClass === undefined) continue;
    const existing = counts.get(row.doc_unit_id) ?? {
      [ContextPackDocConsultOutcomeClass.Success]: 0,
      [ContextPackDocConsultOutcomeClass.Failure]: 0,
    };
    counts.set(row.doc_unit_id, {
      ...existing,
      [outcomeClass]: existing[outcomeClass] + countValue(row.count),
    });
  }
  return counts;
}

function stampOutcomeStatement(stamp: ContextPackDocConsultOutcomeStamp): {
  name: CockroachDocConsultLedgerStoreStatement;
  sql: string;
  parameters: readonly unknown[];
} {
  const parameters: unknown[] = [
    stamp.outcome,
    stamp.outcomeRef,
    stamp.organizationId,
    stamp.outcomeRecordedAt,
    stamp.agentId,
    stamp.hatAssignmentId,
  ];
  const clauses = [
    "organization_id = $3",
    "consulted_at <= $4",
    "agent_id = $5",
    "hat_assignment_id = $6",
  ];
  const filters: readonly StampFilter[] = [
    { column: CockroachDocConsultOutcomeStampFilterColumn.ProjectId, value: stamp.projectId },
    { column: CockroachDocConsultOutcomeStampFilterColumn.WorkItemId, value: stamp.workItemId },
    { column: CockroachDocConsultOutcomeStampFilterColumn.TeamId, value: stamp.teamId },
  ];
  for (const filter of filters) {
    if (filter.value === undefined) continue;
    parameters.push(filter.value);
    clauses.push(`${filter.column} = $${parameters.length}`);
  }
  return {
    name: CockroachDocConsultLedgerStoreStatement.StampOutcome,
    sql: `
      INSERT INTO ${CockroachTableName.DocConsultOutcomes} (
        doc_consult_id,
        outcome_ref,
        organization_id,
        doc_unit_id,
        outcome,
        outcome_recorded_at,
        context_pack_id,
        run_id,
        stage_id,
        hat_id,
        hat_assignment_id,
        agent_id,
        project_id,
        team_id,
        work_item_id,
        trace_id,
        correlation_id,
        causation_id
      )
      SELECT
        doc_consult_id,
        $2,
        organization_id,
        doc_unit_id,
        $1,
        $4,
        context_pack_id,
        run_id,
        stage_id,
        hat_id,
        hat_assignment_id,
        agent_id,
        project_id,
        team_id,
        work_item_id,
        trace_id,
        correlation_id,
        causation_id
      FROM ${CockroachTableName.DocConsultLedger}
      WHERE ${clauses.join(" AND ")}
      ON CONFLICT (doc_consult_id, outcome_ref) DO UPDATE SET
        outcome = excluded.outcome,
        outcome_recorded_at = excluded.outcome_recorded_at
      RETURNING doc_consult_id`,
    parameters,
  };
}

function countValue(value: string | number): number {
  if (typeof value === "number") return value;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parametersFor(record: ContextPackDocConsultRecord): readonly unknown[] {
  return [
    record.docConsultId,
    record.organizationId,
    record.docUnitId,
    record.stageId,
    record.workItemId ?? null,
    record.consultedAt,
    record.outcome ?? null,
    record.contextPackId,
    record.runId,
    record.scope,
    record.hatId,
    record.hatAssignmentId,
    record.agentId ?? null,
    record.projectId ?? null,
    record.teamId ?? null,
    JSON.stringify(record.contextItemIds),
    JSON.stringify(record.sourceRefs),
    record.required,
    record.freshness,
    JSON.stringify(record.reasons),
    record.docType ?? null,
    record.docScopeKind ?? null,
    record.docScopeId ?? null,
    record.contentRef,
    record.contentHash,
    record.sourceId,
    record.docVersion,
    record.trace.traceId,
    record.trace.correlationId,
    record.trace.causationId,
  ];
}
