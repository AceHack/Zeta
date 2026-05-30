/**
 * Cockroach DocUnit store (D1) — the typed/scoped structural knowledge layer. Writes are
 * idempotent on doc_unit_id; the scope + status + content-hash indexes back the retrieval
 * scope pre-filter (Stage 1) and the content-addressed re-ingest skip. JSONB holds the
 * bound hat/stage pointer lists.
 */

import {
  DocLifecycleState,
  type DocType,
  type DocScopeKind,
  type DocUnit,
} from "../../domain/src/index.ts";
import { CockroachTableName } from "./cockroach-schema.ts";
import type { CockroachGenericSqlExecutor } from "./cockroach-sql-executor.ts";

export type DocUnitStore = {
  upsert: (unit: DocUnit) => Promise<void>;
  get: (docUnitId: string) => Promise<DocUnit | null>;
  listByOrgScope: (organizationId: string, scopeKind: DocScopeKind, scopeId: string) => Promise<readonly DocUnit[]>;
  listByOrgStatus: (organizationId: string, status: DocLifecycleState) => Promise<readonly DocUnit[]>;
  findByContentHash: (organizationId: string, contentHash: string) => Promise<DocUnit | null>;
};

export type CreateCockroachDocUnitStoreInput = { executor: CockroachGenericSqlExecutor };

type DocUnitRow = {
  doc_unit_id: string;
  organization_id: string;
  source_id: string;
  type: string;
  scope_kind: string;
  scope_id: string;
  title: string;
  summary: string;
  content_ref: string;
  content_hash: string;
  status: string;
  freshness_at: string | Date;
  bound_hat_ids: unknown;
  bound_stage_ids: unknown;
  supersedes_id: string | null;
  provenance_change_set_id: string | null;
  created_at: string | Date;
  updated_at: string | Date;
  version: number | string;
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

function rowToDocUnit(row: DocUnitRow): DocUnit {
  return {
    docUnitId: row.doc_unit_id,
    organizationId: row.organization_id,
    sourceId: row.source_id,
    type: row.type as DocType,
    scopeKind: row.scope_kind as DocScopeKind,
    scopeId: row.scope_id,
    title: row.title,
    summary: row.summary,
    contentRef: row.content_ref,
    contentHash: row.content_hash,
    status: row.status as DocLifecycleState,
    freshnessAt: toIso(row.freshness_at),
    boundHatIds: parseJson<string[]>(row.bound_hat_ids),
    boundStageIds: parseJson<string[]>(row.bound_stage_ids),
    ...(row.supersedes_id !== null ? { supersedesId: row.supersedes_id } : {}),
    ...(row.provenance_change_set_id !== null ? { provenanceChangeSetId: row.provenance_change_set_id } : {}),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    version: toNum(row.version),
  };
}

export function createCockroachDocUnitStore(input: CreateCockroachDocUnitStoreInput): DocUnitStore {
  const select = `
    SELECT doc_unit_id, organization_id, source_id, type, scope_kind, scope_id, title, summary,
           content_ref, content_hash, status, freshness_at, bound_hat_ids, bound_stage_ids,
           supersedes_id, provenance_change_set_id, created_at, updated_at, version
    FROM ${CockroachTableName.DocUnits}`;

  return {
    async upsert(unit: DocUnit): Promise<void> {
      await input.executor.execute({
        name: "upsert_doc_unit",
        sql: `
          INSERT INTO ${CockroachTableName.DocUnits} (
            doc_unit_id, organization_id, source_id, type, scope_kind, scope_id, title, summary,
            content_ref, content_hash, status, freshness_at, bound_hat_ids, bound_stage_ids,
            supersedes_id, provenance_change_set_id, created_at, updated_at, version
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
          ON CONFLICT (doc_unit_id) DO UPDATE SET
            type = excluded.type, scope_kind = excluded.scope_kind, scope_id = excluded.scope_id,
            title = excluded.title, summary = excluded.summary, content_ref = excluded.content_ref,
            content_hash = excluded.content_hash, status = excluded.status, freshness_at = excluded.freshness_at,
            bound_hat_ids = excluded.bound_hat_ids, bound_stage_ids = excluded.bound_stage_ids,
            supersedes_id = excluded.supersedes_id, provenance_change_set_id = excluded.provenance_change_set_id,
            updated_at = excluded.updated_at, version = excluded.version`,
        parameters: [
          unit.docUnitId, unit.organizationId, unit.sourceId, unit.type, unit.scopeKind, unit.scopeId, unit.title, unit.summary,
          unit.contentRef, unit.contentHash, unit.status, unit.freshnessAt, JSON.stringify(unit.boundHatIds), JSON.stringify(unit.boundStageIds),
          unit.supersedesId ?? null, unit.provenanceChangeSetId ?? null, unit.createdAt, unit.updatedAt, unit.version,
        ],
      });
    },
    async get(docUnitId: string): Promise<DocUnit | null> {
      const result = await input.executor.execute<DocUnitRow>({ name: "get_doc_unit", sql: `${select} WHERE doc_unit_id = $1`, parameters: [docUnitId] });
      const row = result.rows[0];
      return row === undefined ? null : rowToDocUnit(row);
    },
    async listByOrgScope(organizationId, scopeKind, scopeId): Promise<readonly DocUnit[]> {
      const result = await input.executor.execute<DocUnitRow>({
        name: "list_doc_units_by_scope",
        sql: `${select} WHERE organization_id = $1 AND scope_kind = $2 AND scope_id = $3 ORDER BY created_at ASC`,
        parameters: [organizationId, scopeKind, scopeId],
      });
      return result.rows.map(rowToDocUnit);
    },
    async listByOrgStatus(organizationId, status): Promise<readonly DocUnit[]> {
      const result = await input.executor.execute<DocUnitRow>({
        name: "list_doc_units_by_status",
        sql: `${select} WHERE organization_id = $1 AND status = $2 ORDER BY created_at ASC`,
        parameters: [organizationId, status],
      });
      return result.rows.map(rowToDocUnit);
    },
    async findByContentHash(organizationId, contentHash): Promise<DocUnit | null> {
      const result = await input.executor.execute<DocUnitRow>({
        name: "find_doc_unit_by_hash",
        sql: `${select} WHERE organization_id = $1 AND content_hash = $2 LIMIT 1`,
        parameters: [organizationId, contentHash],
      });
      const row = result.rows[0];
      return row === undefined ? null : rowToDocUnit(row);
    },
  };
}
