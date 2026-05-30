import { equal } from "node:assert/strict";
import { test } from "node:test";

import { AutonomyLevel, defaultTenantConfig } from "../../domain/src/index.ts";
import { createCockroachTenantConfigStore } from "../src/cockroach-tenant-config-store.ts";
import type { CockroachGenericSqlExecutor } from "../src/cockroach-sql-executor.ts";

function fakeExecutor(): CockroachGenericSqlExecutor {
  const rows = new Map<string, Record<string, unknown>>();
  const exec = async (s: { sql: string; parameters: readonly unknown[] }) => {
    const p = s.parameters;
    if (s.sql.includes("INSERT INTO")) { rows.set(p[0] as string, { organization_id: p[0], config: p[1], updated_at: p[2], version: p[3] }); return { rows: [] }; }
    if (s.sql.includes("WHERE organization_id = $1")) { const r = rows.get(p[0] as string); return { rows: r ? [r] : [] }; }
    return { rows: [] };
  };
  return { execute: exec, executeTransaction: async (op: (e: { execute: typeof exec }) => unknown) => op({ execute: exec }) } as unknown as CockroachGenericSqlExecutor;
}

test("tenant config store round-trips the whole config (autonomy + workflow + bindings)", async () => {
  const store = createCockroachTenantConfigStore({ executor: fakeExecutor() });
  const c = { ...defaultTenantConfig("org-lfg", "2026-05-30T00:00:00Z"), autonomy: { level: AutonomyLevel.Manual, humanGatedStageIds: ["external-code-review"] } };
  await store.upsert(c);
  const got = await store.get("org-lfg");
  equal(got?.organizationId, "org-lfg");
  equal(got?.autonomy.level, AutonomyLevel.Manual);
  equal(got?.autonomy.humanGatedStageIds[0], "external-code-review");
  equal(got?.workflow.defaultPipelineId, "internal-only");
});

test("tenant config store returns null for an unconfigured org (caller uses the default)", async () => {
  const store = createCockroachTenantConfigStore({ executor: fakeExecutor() });
  equal(await store.get("org-missing"), null);
});
