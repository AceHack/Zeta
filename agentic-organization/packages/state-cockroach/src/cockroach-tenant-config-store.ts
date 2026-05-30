/**
 * Cockroach tenant-config store (C0) — get/upsert the one config row per org. The config is a
 * JSONB blob (the whole TenantConfig minus the identity columns), so the schema never changes
 * when the config shape grows. Idempotent on organization_id.
 */

import type { TenantConfig } from "../../domain/src/index.ts";
import { CockroachTableName } from "./cockroach-schema.ts";
import type { CockroachGenericSqlExecutor } from "./cockroach-sql-executor.ts";

export type TenantConfigStore = {
  get: (organizationId: string) => Promise<TenantConfig | null>;
  upsert: (config: TenantConfig) => Promise<void>;
};

export type CreateCockroachTenantConfigStoreInput = { executor: CockroachGenericSqlExecutor };

type ConfigRow = { organization_id: string; config: unknown; updated_at: string | Date; version: number | string };

export function createCockroachTenantConfigStore(input: CreateCockroachTenantConfigStoreInput): TenantConfigStore {
  const T = CockroachTableName.TenantConfig;
  return {
    async get(organizationId: string): Promise<TenantConfig | null> {
      const r = await input.executor.execute<ConfigRow>({ name: "get_tenant_config", sql: `SELECT organization_id, config, updated_at, version FROM ${T} WHERE organization_id = $1`, parameters: [organizationId] });
      const row = r.rows[0];
      if (row === undefined) return null;
      const config = (typeof row.config === "string" ? JSON.parse(row.config) : row.config) as Omit<TenantConfig, "organizationId" | "updatedAt" | "version">;
      return {
        organizationId: row.organization_id,
        ...config,
        updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : new Date(row.updated_at).toISOString(),
        version: typeof row.version === "number" ? row.version : Number(row.version),
      };
    },
    async upsert(config: TenantConfig): Promise<void> {
      const { organizationId, updatedAt, version, ...rest } = config;
      await input.executor.execute({
        name: "upsert_tenant_config",
        sql: `INSERT INTO ${T} (organization_id, config, updated_at, version) VALUES ($1,$2,$3,$4)
          ON CONFLICT (organization_id) DO UPDATE SET config = excluded.config, updated_at = excluded.updated_at, version = excluded.version`,
        parameters: [organizationId, JSON.stringify(rest), updatedAt, version],
      });
    },
  };
}
