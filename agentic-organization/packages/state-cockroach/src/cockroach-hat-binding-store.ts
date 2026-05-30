/**
 * Cockroach-backed HatBinding store — the current "who is wearing which hat"
 * state. Upserted on every lifecycle transition so active wearers, warmup/active
 * phase, expiry, and cooldown are queryable for the org snapshot and the
 * assignment engine.
 */

import { HatBindingPhase, type HatBinding } from "../../domain/src/index.ts";
import type { CockroachGenericSqlExecutor } from "./cockroach-sql-executor.ts";

export type HatBindingStore = {
  upsert: (binding: HatBinding) => Promise<void>;
  listActive: (organizationId: string) => Promise<readonly HatBinding[]>;
  listAll: (organizationId: string) => Promise<readonly HatBinding[]>;
};

export type CreateCockroachHatBindingStoreInput = {
  executor: CockroachGenericSqlExecutor;
};

type HatBindingRow = {
  binding_id: string;
  hat_id: string;
  organization_id: string;
  wearer_agent_id: string;
  phase: string;
  bound_at: string | Date;
  warmup_ends_at: string | Date;
  expires_at: string | Date;
  activated_at: string | Date | null;
  ended_at: string | Date | null;
  cooldown_until: string | Date | null;
  reason: string | null;
};

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function rowToBinding(row: HatBindingRow): HatBinding {
  return {
    id: row.binding_id,
    hatId: row.hat_id,
    organizationId: row.organization_id,
    wearerAgentId: row.wearer_agent_id,
    phase: row.phase as HatBindingPhase,
    boundAt: toIso(row.bound_at),
    warmupEndsAt: toIso(row.warmup_ends_at),
    expiresAt: toIso(row.expires_at),
    ...(row.activated_at !== null ? { activatedAt: toIso(row.activated_at) } : {}),
    ...(row.ended_at !== null ? { endedAt: toIso(row.ended_at) } : {}),
    ...(row.cooldown_until !== null ? { cooldownUntil: toIso(row.cooldown_until) } : {}),
    ...(row.reason !== null ? { reason: row.reason } : {}),
  };
}

const NON_TERMINAL_PHASES = [HatBindingPhase.Pending, HatBindingPhase.Warmup, HatBindingPhase.Active, HatBindingPhase.Probation];

export function createCockroachHatBindingStore(input: CreateCockroachHatBindingStoreInput): HatBindingStore {
  return {
    async upsert(binding: HatBinding): Promise<void> {
      await input.executor.execute({
        name: "upsert_hat_binding",
        sql: `
          INSERT INTO agentic_org_hat_bindings (
            binding_id, hat_id, organization_id, wearer_agent_id, phase,
            bound_at, warmup_ends_at, expires_at, activated_at, ended_at, cooldown_until, reason
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (binding_id) DO UPDATE SET
            phase = excluded.phase,
            activated_at = excluded.activated_at,
            ended_at = excluded.ended_at,
            cooldown_until = excluded.cooldown_until,
            reason = excluded.reason`,
        parameters: [
          binding.id, binding.hatId, binding.organizationId, binding.wearerAgentId, binding.phase,
          binding.boundAt, binding.warmupEndsAt, binding.expiresAt,
          binding.activatedAt ?? null, binding.endedAt ?? null, binding.cooldownUntil ?? null, binding.reason ?? null,
        ],
      });
    },

    async listActive(organizationId: string): Promise<readonly HatBinding[]> {
      const placeholders = NON_TERMINAL_PHASES.map((_, i) => `$${i + 2}`).join(", ");
      const result = await input.executor.execute({
        name: "list_active_hat_bindings",
        sql: `SELECT * FROM agentic_org_hat_bindings WHERE organization_id = $1 AND phase IN (${placeholders}) ORDER BY expires_at ASC`,
        parameters: [organizationId, ...NON_TERMINAL_PHASES],
      });
      return (result.rows as HatBindingRow[]).map(rowToBinding);
    },

    async listAll(organizationId: string): Promise<readonly HatBinding[]> {
      const result = await input.executor.execute({
        name: "list_all_hat_bindings",
        sql: `SELECT * FROM agentic_org_hat_bindings WHERE organization_id = $1 ORDER BY bound_at DESC`,
        parameters: [organizationId],
      });
      return (result.rows as HatBindingRow[]).map(rowToBinding);
    },
  };
}
