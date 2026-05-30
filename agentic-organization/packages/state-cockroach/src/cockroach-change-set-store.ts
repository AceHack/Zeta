/**
 * Cockroach-backed ChangeSet store (CC2) — the canonical internal "PR". Holds the
 * Git-agnostic artifacts + the optional external projections (PR/MR/card) as JSONB;
 * the projections list is metadata about external materializations, never the
 * source of truth. Writes are idempotent on the content-addressed change_set_id.
 */

import {
  ChangeSetPhase,
  type ChangeArtifact,
  type ChangeSet,
  type ProjectionRef,
} from "../../domain/src/index.ts";
import type { CockroachGenericSqlExecutor } from "./cockroach-sql-executor.ts";

export type ChangeSetStore = {
  upsert: (cs: ChangeSet) => Promise<void>;
  get: (changeSetId: string) => Promise<ChangeSet | null>;
  listByWorkItem: (workItemId: string) => Promise<readonly ChangeSet[]>;
  listByOrgPhase: (organizationId: string, phase: ChangeSetPhase) => Promise<readonly ChangeSet[]>;
};

export type CreateCockroachChangeSetStoreInput = { executor: CockroachGenericSqlExecutor };

type ChangeSetRow = {
  change_set_id: string;
  organization_id: string;
  work_item_id: string;
  proposer_hat_id: string;
  title: string;
  target_ref: string;
  phase: string;
  pipeline_id: string;
  current_stage_index: number | string;
  artifacts: unknown;
  projections: unknown;
  revision: number | string;
  opened_at: string | Date;
  updated_at: string | Date;
};

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toNum(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}

function parseJson<T>(value: unknown): T {
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}

function rowToChangeSet(row: ChangeSetRow): ChangeSet {
  return {
    changeSetId: row.change_set_id,
    organizationId: row.organization_id,
    workItemId: row.work_item_id,
    proposerHatId: row.proposer_hat_id,
    title: row.title,
    targetRef: row.target_ref,
    phase: row.phase as ChangeSetPhase,
    pipelineId: row.pipeline_id,
    currentStageIndex: toNum(row.current_stage_index),
    artifacts: parseJson<ChangeArtifact[]>(row.artifacts),
    projections: parseJson<ProjectionRef[]>(row.projections),
    revision: toNum(row.revision),
    openedAt: toIso(row.opened_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function createCockroachChangeSetStore(
  input: CreateCockroachChangeSetStoreInput,
): ChangeSetStore {
  return {
    async upsert(cs: ChangeSet): Promise<void> {
      await input.executor.execute({
        name: "upsert_change_set",
        sql: `
          INSERT INTO agentic_org_change_sets (
            change_set_id, organization_id, work_item_id, proposer_hat_id, title, target_ref,
            phase, pipeline_id, current_stage_index, artifacts, projections, revision, opened_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          ON CONFLICT (change_set_id) DO UPDATE SET
            title = excluded.title,
            phase = excluded.phase,
            current_stage_index = excluded.current_stage_index,
            artifacts = excluded.artifacts,
            projections = excluded.projections,
            revision = excluded.revision,
            updated_at = excluded.updated_at`,
        parameters: [
          cs.changeSetId, cs.organizationId, cs.workItemId, cs.proposerHatId, cs.title, cs.targetRef,
          cs.phase, cs.pipelineId, cs.currentStageIndex, JSON.stringify(cs.artifacts), JSON.stringify(cs.projections),
          cs.revision, cs.openedAt, cs.updatedAt,
        ],
      });
    },

    async get(changeSetId: string): Promise<ChangeSet | null> {
      const result = await input.executor.execute({
        name: "get_change_set",
        sql: `SELECT * FROM agentic_org_change_sets WHERE change_set_id = $1`,
        parameters: [changeSetId],
      });
      const rows = result.rows as ChangeSetRow[];
      return rows.length > 0 ? rowToChangeSet(rows[0]!) : null;
    },

    async listByWorkItem(workItemId: string): Promise<readonly ChangeSet[]> {
      const result = await input.executor.execute({
        name: "list_change_sets_by_work",
        sql: `SELECT * FROM agentic_org_change_sets WHERE work_item_id = $1 ORDER BY opened_at DESC`,
        parameters: [workItemId],
      });
      return (result.rows as ChangeSetRow[]).map(rowToChangeSet);
    },

    async listByOrgPhase(organizationId: string, phase: ChangeSetPhase): Promise<readonly ChangeSet[]> {
      const result = await input.executor.execute({
        name: "list_change_sets_by_org_phase",
        sql: `SELECT * FROM agentic_org_change_sets WHERE organization_id = $1 AND phase = $2 ORDER BY updated_at DESC`,
        parameters: [organizationId, phase],
      });
      return (result.rows as ChangeSetRow[]).map(rowToChangeSet);
    },
  };
}
