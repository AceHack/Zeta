import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { DocType, DocScopeKind, DocLifecycleState, type DocUnit } from "../../domain/src/index.ts";
import { createCockroachDocUnitStore } from "../src/cockroach-doc-unit-store.ts";
import type { CockroachGenericSqlExecutor } from "../src/cockroach-sql-executor.ts";

/** A tiny in-memory executor that emulates the doc_units table the store queries. */
function fakeExecutor(): CockroachGenericSqlExecutor {
  const rows = new Map<string, Record<string, unknown>>();
  const toRow = (p: readonly unknown[]): Record<string, unknown> => ({
    doc_unit_id: p[0], organization_id: p[1], source_id: p[2], type: p[3], scope_kind: p[4], scope_id: p[5],
    title: p[6], summary: p[7], content_ref: p[8], content_hash: p[9], status: p[10], freshness_at: p[11],
    bound_hat_ids: p[12], bound_stage_ids: p[13], supersedes_id: p[14], provenance_change_set_id: p[15],
    created_at: p[16], updated_at: p[17], version: p[18],
  });
  const exec = async (s: { sql: string; parameters: readonly unknown[] }) => {
    const sql = s.sql;
    const p = s.parameters;
    if (sql.includes("INSERT INTO")) { const r = toRow(p); rows.set(r["doc_unit_id"] as string, r); return { rows: [] }; }
    if (sql.includes("WHERE doc_unit_id = $1")) { const r = rows.get(p[0] as string); return { rows: r ? [r] : [] }; }
    if (sql.includes("scope_kind = $2 AND scope_id = $3")) {
      return { rows: [...rows.values()].filter((r) => r["organization_id"] === p[0] && r["scope_kind"] === p[1] && r["scope_id"] === p[2]) };
    }
    if (sql.includes("status = $2")) {
      return { rows: [...rows.values()].filter((r) => r["organization_id"] === p[0] && r["status"] === p[1]) };
    }
    if (sql.includes("content_hash = $2")) {
      return { rows: [...rows.values()].filter((r) => r["organization_id"] === p[0] && r["content_hash"] === p[1]).slice(0, 1) };
    }
    return { rows: [] };
  };
  return { execute: exec, executeTransaction: async (op: (e: { execute: typeof exec }) => unknown) => op({ execute: exec }) } as unknown as CockroachGenericSqlExecutor;
}

function unit(over: Partial<DocUnit> = {}): DocUnit {
  return {
    docUnitId: "du-1", organizationId: "org-lfg", sourceId: "src-1", type: DocType.Handbook,
    scopeKind: DocScopeKind.Department, scopeId: "eng", title: "Onboarding", summary: "Welcome",
    contentRef: "wiki:onboarding#Onboarding", contentHash: "a".repeat(64), status: DocLifecycleState.Draft,
    freshnessAt: "2026-05-30T00:00:00Z", boundHatIds: ["documentation_reviewer"], boundStageIds: ["brd"],
    provenanceChangeSetId: "cs-42", createdAt: "2026-05-30T00:00:00Z", updatedAt: "2026-05-30T00:00:00Z", version: 1, ...over,
  };
}

test("doc unit store round-trips a unit (incl bound pointers + provenance)", async () => {
  const store = createCockroachDocUnitStore({ executor: fakeExecutor() });
  await store.upsert(unit());
  const got = await store.get("du-1");
  ok(got !== null);
  equal(got!.provenanceChangeSetId, "cs-42");
  equal(got!.contentHash, "a".repeat(64));
  equal(got!.boundHatIds[0], "documentation_reviewer");
  equal(got!.boundStageIds[0], "brd");
});

test("doc unit store filters by scope, status, and content hash (the retrieval pre-filter substrate)", async () => {
  const store = createCockroachDocUnitStore({ executor: fakeExecutor() });
  await store.upsert(unit({ docUnitId: "du-1", scopeId: "eng", status: DocLifecycleState.Active, contentHash: "b".repeat(64) }));
  await store.upsert(unit({ docUnitId: "du-2", scopeId: "sales", status: DocLifecycleState.Draft, contentHash: "c".repeat(64) }));

  equal((await store.listByOrgScope("org-lfg", DocScopeKind.Department, "eng")).length, 1);
  equal((await store.listByOrgStatus("org-lfg", DocLifecycleState.Active)).length, 1);
  const byHash = await store.findByContentHash("org-lfg", "c".repeat(64));
  equal(byHash?.docUnitId, "du-2");
});
