/**
 * Cockroach-backed memory STATE store (MEM2). Holds the immutable content-
 * addressing (tier/scope/key) plus the mutable weight/lifecycle signals for every
 * memory. The embedded text lives in Hindsight; this store is the weight-bearing
 * envelope retrieval ranks over. Writes are idempotent on memory_id (content-
 * addressed) — re-retaining the same fact updates state, never duplicates.
 *
 * Reads:
 *  - get(memoryId)                       — one envelope
 *  - listByScopes(org, scopes)           — the surfacing candidate set (non-archived,
 *                                          weight>0) across a scope union, weight desc
 *  - listAll(org)                        — every state row (maintenance cycle input)
 */

import {
  MemoryPhase,
  MemoryTier,
  type MemoryEnvelope,
  type MemoryRecord,
  type MemoryState,
} from "../../domain/src/index.ts";
import type { CockroachGenericSqlExecutor } from "./cockroach-sql-executor.ts";

export type MemoryStateStore = {
  upsert: (record: MemoryRecord, state: MemoryState) => Promise<void>;
  get: (memoryId: string) => Promise<MemoryEnvelope | null>;
  listByScopes: (organizationId: string, scopes: readonly string[]) => Promise<readonly MemoryEnvelope[]>;
  listAll: (organizationId: string) => Promise<readonly MemoryEnvelope[]>;
};

export type CreateCockroachMemoryStateStoreInput = {
  executor: CockroachGenericSqlExecutor;
};

type MemoryStateRow = {
  memory_id: string;
  organization_id: string;
  tier: string;
  scope: string;
  key: string;
  phase: string;
  confidence: number | string;
  weight: number | string;
  freshness_at: string | Date;
  reinforcement_count: number | string;
  protected: boolean;
  written_by: string;
  written_at: string | Date;
  context_hint: string | null;
  outcome: unknown;
  utility: unknown;
  cross_scope: unknown;
  archived_at: string | Date | null;
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

function rowToEnvelope(row: MemoryStateRow): MemoryEnvelope {
  const state: MemoryState = {
    memoryId: row.memory_id,
    organizationId: row.organization_id,
    phase: row.phase as MemoryPhase,
    confidence: toNum(row.confidence),
    weight: toNum(row.weight),
    freshnessAt: toIso(row.freshness_at),
    reinforcementCount: toNum(row.reinforcement_count),
    outcome: parseJson(row.outcome),
    utility: parseJson(row.utility),
    crossScope: parseJson(row.cross_scope),
    ...(row.archived_at !== null ? { archivedAt: toIso(row.archived_at) } : {}),
  };
  return {
    memoryId: row.memory_id,
    organizationId: row.organization_id,
    tier: row.tier as MemoryTier,
    scope: row.scope,
    key: row.key,
    protected: row.protected,
    writtenBy: row.written_by,
    writtenAt: toIso(row.written_at),
    ...(row.context_hint !== null ? { contextHint: row.context_hint } : {}),
    state,
  };
}

export function createCockroachMemoryStateStore(
  input: CreateCockroachMemoryStateStoreInput,
): MemoryStateStore {
  return {
    async upsert(record: MemoryRecord, state: MemoryState): Promise<void> {
      await input.executor.execute({
        name: "upsert_memory_state",
        sql: `
          INSERT INTO agentic_org_memory_state (
            memory_id, organization_id, tier, scope, key, phase,
            confidence, weight, freshness_at, reinforcement_count, protected,
            written_by, written_at, context_hint, outcome, utility, cross_scope, archived_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          ON CONFLICT (memory_id) DO UPDATE SET
            phase = excluded.phase,
            confidence = excluded.confidence,
            weight = excluded.weight,
            freshness_at = excluded.freshness_at,
            reinforcement_count = excluded.reinforcement_count,
            protected = excluded.protected,
            context_hint = excluded.context_hint,
            outcome = excluded.outcome,
            utility = excluded.utility,
            cross_scope = excluded.cross_scope,
            archived_at = excluded.archived_at`,
        parameters: [
          record.memoryId, record.organizationId, record.tier, record.scope, record.key, state.phase,
          state.confidence, state.weight, state.freshnessAt, state.reinforcementCount, record.protected,
          record.writtenBy, record.writtenAt, record.contextHint ?? null,
          JSON.stringify(state.outcome), JSON.stringify(state.utility), JSON.stringify(state.crossScope),
          state.archivedAt ?? null,
        ],
      });
    },

    async get(memoryId: string): Promise<MemoryEnvelope | null> {
      const result = await input.executor.execute({
        name: "get_memory_state",
        sql: `SELECT * FROM agentic_org_memory_state WHERE memory_id = $1`,
        parameters: [memoryId],
      });
      const rows = result.rows as MemoryStateRow[];
      return rows.length > 0 ? rowToEnvelope(rows[0]!) : null;
    },

    async listByScopes(
      organizationId: string,
      scopes: readonly string[],
    ): Promise<readonly MemoryEnvelope[]> {
      if (scopes.length === 0) return [];
      const placeholders = scopes.map((_, i) => `$${i + 2}`).join(", ");
      const result = await input.executor.execute({
        name: "list_memory_state_by_scopes",
        sql: `SELECT * FROM agentic_org_memory_state
              WHERE organization_id = $1
                AND scope IN (${placeholders})
                AND phase != '${MemoryPhase.Archived}'
                AND weight > 0
              ORDER BY weight DESC`,
        parameters: [organizationId, ...scopes],
      });
      return (result.rows as MemoryStateRow[]).map(rowToEnvelope);
    },

    async listAll(organizationId: string): Promise<readonly MemoryEnvelope[]> {
      const result = await input.executor.execute({
        name: "list_all_memory_state",
        sql: `SELECT * FROM agentic_org_memory_state WHERE organization_id = $1 ORDER BY weight DESC`,
        parameters: [organizationId],
      });
      return (result.rows as MemoryStateRow[]).map(rowToEnvelope);
    },
  };
}
