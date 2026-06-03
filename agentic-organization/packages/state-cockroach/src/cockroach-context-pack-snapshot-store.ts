import type {
  ContextPackScopeLookup,
  ContextPackSnapshotLookup,
  ContextPackSnapshotRecord,
  ContextPackSnapshotStorePort,
  ContextReadout,
} from "../../application/src/index.ts";
import { CockroachTableName } from "./cockroach-schema.ts";
import type { CockroachGenericSqlTransactionExecutor } from "./cockroach-sql-executor.ts";

export const CockroachContextPackSnapshotStoreStatement = {
  Upsert: "upsert_context_pack_snapshot",
  Get: "get_context_pack_snapshot",
  LatestForScope: "latest_context_pack_snapshot_for_scope",
} as const;

export type CockroachContextPackSnapshotStoreStatement =
  (typeof CockroachContextPackSnapshotStoreStatement)[keyof typeof CockroachContextPackSnapshotStoreStatement];

export type CreateCockroachContextPackSnapshotStoreInput = {
  executor: CockroachGenericSqlTransactionExecutor;
};

type ContextPackSnapshotRow = {
  context_pack_id: string;
  organization_id: string;
  run_id: string;
  scope: string;
  hat_assignment_id: string;
  hat_id: string;
  agent_id: string | null;
  project_id: string | null;
  team_id: string | null;
  work_item_id: string | null;
  status: string;
  generated_at: string | Date;
  freshness_deadline: string | Date;
  recorded_at: string | Date;
  source_graph_version: string;
  policy_version: string;
  trace_id: string;
  correlation_id: string;
  causation_id: string;
  context_json: unknown;
  phase: string | null;
};

export function createCockroachContextPackSnapshotStore(
  input: CreateCockroachContextPackSnapshotStoreInput,
): ContextPackSnapshotStorePort {
  const select = `
    SELECT context_pack_id, organization_id, run_id, scope, hat_assignment_id, hat_id,
           agent_id, project_id, team_id, work_item_id, status, generated_at,
           freshness_deadline, recorded_at, source_graph_version, policy_version,
           trace_id, correlation_id, causation_id, context_json, phase
    FROM ${CockroachTableName.ContextPackSnapshots}`;

  return {
    async record(snapshot): Promise<void> {
      const pack = snapshot.context.pack;
      const organizationId = pack.organizationId;
      if (organizationId === undefined || organizationId.length === 0) {
        throw new Error("context-pack snapshot persistence requires organization id");
      }
      await input.executor.execute({
        name: CockroachContextPackSnapshotStoreStatement.Upsert,
        sql: `
          INSERT INTO ${CockroachTableName.ContextPackSnapshots} (
            context_pack_id, organization_id, run_id, scope, hat_assignment_id, hat_id,
            agent_id, project_id, team_id, work_item_id, status, generated_at,
            freshness_deadline, recorded_at, source_graph_version, policy_version,
            trace_id, correlation_id, causation_id, context_json, phase
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
          ON CONFLICT (context_pack_id) DO UPDATE SET
            organization_id = excluded.organization_id,
            run_id = excluded.run_id,
            scope = excluded.scope,
            hat_assignment_id = excluded.hat_assignment_id,
            hat_id = excluded.hat_id,
            agent_id = excluded.agent_id,
            project_id = excluded.project_id,
            team_id = excluded.team_id,
            work_item_id = excluded.work_item_id,
            status = excluded.status,
            generated_at = excluded.generated_at,
            freshness_deadline = excluded.freshness_deadline,
            recorded_at = excluded.recorded_at,
            source_graph_version = excluded.source_graph_version,
            policy_version = excluded.policy_version,
            trace_id = excluded.trace_id,
            correlation_id = excluded.correlation_id,
            causation_id = excluded.causation_id,
            context_json = excluded.context_json,
            phase = excluded.phase`,
        parameters: [
          pack.id,
          organizationId,
          pack.runId,
          pack.scope,
          pack.hatAssignmentId,
          pack.hatId,
          pack.agentId ?? null,
          pack.projectId ?? null,
          pack.teamId ?? null,
          pack.workItemId ?? null,
          snapshot.context.status,
          pack.generatedAt,
          pack.freshnessDeadline,
          snapshot.recordedAt,
          pack.sourceGraphVersion,
          pack.policyVersion,
          snapshot.trace.traceId,
          snapshot.trace.correlationId,
          snapshot.trace.causationId,
          JSON.stringify(snapshot.context),
          snapshot.phase ?? null,
        ],
      });
    },
    async get(lookup: ContextPackSnapshotLookup): Promise<ContextPackSnapshotRecord | null> {
      const result = await input.executor.execute<ContextPackSnapshotRow>({
        name: CockroachContextPackSnapshotStoreStatement.Get,
        sql: `${select} WHERE context_pack_id = $1`,
        parameters: [lookup.contextPackId],
      });
      return rowToContextPackSnapshotRecord(result.rows[0]);
    },
    async latestForScope(lookup: ContextPackScopeLookup): Promise<ContextPackSnapshotRecord | null> {
      const scoped = scopedLatestQuery(select, lookup);
      const result = await input.executor.execute<ContextPackSnapshotRow>({
        name: CockroachContextPackSnapshotStoreStatement.LatestForScope,
        sql: scoped.sql,
        parameters: scoped.parameters,
      });
      return rowToContextPackSnapshotRecord(result.rows[0]);
    },
  };
}

function scopedLatestQuery(
  select: string,
  lookup: ContextPackScopeLookup,
): { sql: string; parameters: readonly unknown[] } {
  const conditions = ["organization_id = $1"];
  const parameters: unknown[] = [lookup.organizationId];
  addOptionalCondition(conditions, parameters, "hat_assignment_id", lookup.hatAssignmentId);
  addOptionalCondition(conditions, parameters, "agent_id", lookup.agentId);
  addOptionalCondition(conditions, parameters, "project_id", lookup.projectId);
  addOptionalCondition(conditions, parameters, "team_id", lookup.teamId);
  addOptionalCondition(conditions, parameters, "work_item_id", lookup.workItemId);
  return {
    sql: `${select} WHERE ${conditions.join(" AND ")} ORDER BY recorded_at DESC LIMIT 1`,
    parameters,
  };
}

function addOptionalCondition(
  conditions: string[],
  parameters: unknown[],
  column: string,
  value: string | undefined,
): void {
  if (value === undefined) return;
  parameters.push(value);
  conditions.push(`${column} = $${parameters.length}`);
}

function rowToContextPackSnapshotRecord(
  row: ContextPackSnapshotRow | undefined,
): ContextPackSnapshotRecord | null {
  if (row === undefined) return null;
  return {
    context: parseJson<ContextReadout>(row.context_json),
    recordedAt: toIso(row.recorded_at),
    trace: {
      traceId: row.trace_id,
      correlationId: row.correlation_id,
      causationId: row.causation_id,
    },
    ...(row.phase === null ? {} : { phase: row.phase as ContextPackSnapshotRecord["phase"] }),
  };
}

function parseJson<T>(value: unknown): T {
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
