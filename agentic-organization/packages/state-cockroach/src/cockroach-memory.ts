/**
 * Cockroach-backed Hindsight memory — the durable Memory adapter behind the same
 * port the in-process fake implements. An agent retains what it learned
 * (attributed by hat assignment); recall is SCOPED by project (Organization
 * memory policy: scoped recall, never global); attribution is STICKY (a memory
 * keeps its original author even when recalled by another hat). Persists across
 * worker restarts.
 */

import { randomUUID } from "node:crypto";

import {
  MemoryOperation,
  type Memory,
  type MemoryAttribution,
  type MemoryRecord,
  type RecallResult,
  type ReflectResult,
  type RetainResult,
} from "../../memory/src/index.ts";
import type { CockroachGenericSqlExecutor } from "./cockroach-sql-executor.ts";

export const CockroachMemoryStatement = {
  RetainMemory: "retain_memory",
  RecallMemories: "recall_memories",
  ReflectMemories: "reflect_memories",
} as const;
export type CockroachMemoryStatement = (typeof CockroachMemoryStatement)[keyof typeof CockroachMemoryStatement];

export type CockroachMemoryDeps = {
  executor: CockroachGenericSqlExecutor;
  idGenerator?: { nextMemoryId: () => string };
  clock?: { now: () => number };
};

type MemoryRow = {
  memory_id: string;
  agent_id: string;
  hat_assignment_id: string;
  project_id: string;
  work_item_id: string;
  prompt_flow_run_id: string;
  content: string;
  retained_at_ms: number | string;
};

export function createCockroachMemory(deps: CockroachMemoryDeps): Memory {
  // default to globally-unique ids (NOT a per-instance counter): a fresh memory
  // adapter is created per execution, so a counter would collide across runs
  const nextMemoryId = deps.idGenerator?.nextMemoryId ?? (() => `mem-${randomUUID()}`);
  const now = deps.clock?.now ?? (() => Date.now());

  return {
    async retain(attribution: MemoryAttribution, content: string): Promise<RetainResult> {
      const memoryId = nextMemoryId();
      const retainedAtMs = now();
      await deps.executor.execute({
        name: CockroachMemoryStatement.RetainMemory,
        sql: `
          INSERT INTO agentic_org_hindsight_memory (
            memory_id, agent_id, hat_assignment_id, project_id, work_item_id, prompt_flow_run_id, content, retained_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, now())
        `,
        parameters: [
          memoryId,
          attribution.agentId,
          attribution.hatAssignmentId,
          attribution.projectId,
          attribution.workItemId,
          attribution.promptFlowRunId,
          content,
        ],
      });

      return {
        operation: MemoryOperation.Retain,
        memory: { memoryId, attribution: { ...attribution }, content, retainedAtMs },
      };
    },

    async recall(attribution: MemoryAttribution): Promise<RecallResult> {
      // scoped by project (never global); rows carry the original (sticky) author
      const result = await deps.executor.execute<MemoryRow>({
        name: CockroachMemoryStatement.RecallMemories,
        sql: `
          SELECT
            memory_id, agent_id, hat_assignment_id, project_id, work_item_id, prompt_flow_run_id, content,
            (EXTRACT(EPOCH FROM retained_at) * 1000)::INT8 AS retained_at_ms
          FROM agentic_org_hindsight_memory
          WHERE project_id = $1
          ORDER BY retained_at ASC
        `,
        parameters: [attribution.projectId],
      });

      return { operation: MemoryOperation.Recall, memories: result.rows.map(toMemoryRecord) };
    },

    async reflect(attribution: MemoryAttribution): Promise<ReflectResult> {
      const result = await deps.executor.execute<{ considered_count: number | string }>({
        name: CockroachMemoryStatement.ReflectMemories,
        sql: `SELECT count(*) AS considered_count FROM agentic_org_hindsight_memory WHERE project_id = $1`,
        parameters: [attribution.projectId],
      });
      const consideredCount = Number(result.rows[0]?.considered_count ?? 0);
      return {
        operation: MemoryOperation.Reflect,
        consideredCount,
        summary:
          consideredCount === 0
            ? "no memories in scope to reflect on"
            : `reflected on ${consideredCount} memories in project ${attribution.projectId}`,
      };
    },
  };
}

function toMemoryRecord(row: MemoryRow): MemoryRecord {
  return {
    memoryId: row.memory_id,
    attribution: {
      agentId: row.agent_id,
      hatAssignmentId: row.hat_assignment_id,
      projectId: row.project_id,
      workItemId: row.work_item_id,
      promptFlowRunId: row.prompt_flow_run_id,
    },
    content: row.content,
    retainedAtMs: Number(row.retained_at_ms),
  };
}
