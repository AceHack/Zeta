/**
 * Cockroach-backed memory INJECTION ledger (MEM2/MEM4). One row per memory
 * surfaced into a turn — the audit trail that makes injection deterministic and
 * citation/utility measurable. KPI tracking (MEM5) reads this to correlate which
 * memories were present when work succeeded or failed; the maintenance cycle
 * (MEM6) reads citation rate to decide reinforce/demote.
 */

import type { MemoryInjectionRecord } from "../../domain/src/index.ts";
import type { CockroachGenericSqlExecutor } from "./cockroach-sql-executor.ts";

export type MemoryInjectionStore = {
  record: (injection: MemoryInjectionRecord) => Promise<void>;
  markCited: (injectionId: string) => Promise<void>;
  listByWorkItem: (workItemId: string) => Promise<readonly MemoryInjectionRecord[]>;
  listByMemory: (memoryId: string) => Promise<readonly MemoryInjectionRecord[]>;
};

export type CreateCockroachMemoryInjectionStoreInput = {
  executor: CockroachGenericSqlExecutor;
};

type MemoryInjectionRow = {
  injection_id: string;
  organization_id: string;
  memory_id: string;
  work_item_id: string;
  hat_id: string;
  agent_id: string;
  prompt_flow_run_id: string;
  weight_at_injection: number | string;
  cited: boolean;
  injected_at: string | Date;
};

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function rowToInjection(row: MemoryInjectionRow): MemoryInjectionRecord {
  return {
    injectionId: row.injection_id,
    organizationId: row.organization_id,
    memoryId: row.memory_id,
    workItemId: row.work_item_id,
    hatId: row.hat_id,
    agentId: row.agent_id,
    promptFlowRunId: row.prompt_flow_run_id,
    weightAtInjection: typeof row.weight_at_injection === "number" ? row.weight_at_injection : Number(row.weight_at_injection),
    cited: row.cited,
    injectedAt: toIso(row.injected_at),
  };
}

export function createCockroachMemoryInjectionStore(
  input: CreateCockroachMemoryInjectionStoreInput,
): MemoryInjectionStore {
  return {
    async record(injection: MemoryInjectionRecord): Promise<void> {
      await input.executor.execute({
        name: "record_memory_injection",
        sql: `
          INSERT INTO agentic_org_memory_injection (
            injection_id, organization_id, memory_id, work_item_id, hat_id, agent_id,
            prompt_flow_run_id, weight_at_injection, cited, injected_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (injection_id) DO NOTHING`,
        parameters: [
          injection.injectionId, injection.organizationId, injection.memoryId, injection.workItemId,
          injection.hatId, injection.agentId, injection.promptFlowRunId, injection.weightAtInjection,
          injection.cited, injection.injectedAt,
        ],
      });
    },

    async markCited(injectionId: string): Promise<void> {
      await input.executor.execute({
        name: "mark_memory_injection_cited",
        sql: `UPDATE agentic_org_memory_injection SET cited = true WHERE injection_id = $1`,
        parameters: [injectionId],
      });
    },

    async listByWorkItem(workItemId: string): Promise<readonly MemoryInjectionRecord[]> {
      const result = await input.executor.execute({
        name: "list_memory_injection_by_work",
        sql: `SELECT * FROM agentic_org_memory_injection WHERE work_item_id = $1 ORDER BY injected_at DESC`,
        parameters: [workItemId],
      });
      return (result.rows as MemoryInjectionRow[]).map(rowToInjection);
    },

    async listByMemory(memoryId: string): Promise<readonly MemoryInjectionRecord[]> {
      const result = await input.executor.execute({
        name: "list_memory_injection_by_memory",
        sql: `SELECT * FROM agentic_org_memory_injection WHERE memory_id = $1 ORDER BY injected_at DESC`,
        parameters: [memoryId],
      });
      return (result.rows as MemoryInjectionRow[]).map(rowToInjection);
    },
  };
}
