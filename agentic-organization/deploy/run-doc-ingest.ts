/**
 * Prove D1 in kind: structural ingestion + content-addressed typed/scoped DocUnit storage
 * with ChangeSet provenance, against the live Cockroach. Ingests a handbook, persists its
 * structural units, and queries them back by scope + status.
 *
 *   kubectl -n agentic-org port-forward svc/cockroach 26259:26257 &
 *   COCKROACH_DATABASE_URL=postgresql://root@localhost:26259/defaultdb?sslmode=disable \
 *     node --experimental-strip-types deploy/run-doc-ingest.ts
 */
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { env } from "node:process";
import { ingestDocument } from "../packages/application/src/index.ts";
import { DocType, DocScopeKind } from "../packages/domain/src/index.ts";
import {
  createCockroachSqlExecutor,
  createCockroachDocUnitStore,
  createCockroachDocumentIntelligenceMigration,
  splitSqlStatements,
} from "../packages/state-cockroach/src/index.ts";
import type { CockroachSqlClient } from "../packages/state-cockroach/src/cockroach-sql-executor.ts";

const connectionString = env.COCKROACH_DATABASE_URL ?? "postgresql://root@localhost:26259/defaultdb?sslmode=disable";
const pool = new Pool({ connectionString });
const client: CockroachSqlClient = { query: async (sql, p) => ({ rows: (await pool.query(sql, p as unknown[])).rows }), transaction: async (op) => op(client) };
const executor = createCockroachSqlExecutor({ client });
for (const s of splitSqlStatements(createCockroachDocumentIntelligenceMigration().sql)) await pool.query(s);
const store = createCockroachDocUnitStore({ executor });
const id = (p: string) => `${p}-${randomUUID()}`;

const md = "# Onboarding\nWelcome.\n\n## Step 1\nDo first.\n\n## Step 2\nDo second.\n\n# Security\nRotate keys.";
const raw = { sourceId: id("src"), externalRef: `wiki:d1-${randomUUID()}`, type: DocType.Handbook, scopeKind: DocScopeKind.Department, scopeId: "eng", title: "Eng Handbook", markdown: md };
const { units } = ingestDocument(raw, { organizationId: "org-lfg", now: () => Date.now(), createId: id, provenanceChangeSetId: id("cs") });
for (const u of units) await store.upsert(u);
const eng = await store.listByOrgScope("org-lfg", DocScopeKind.Department, "eng");
const step2 = units.find((u) => u.title === "Step 2");
console.log(JSON.stringify({ d1KindProof: {
  ingestedUnits: units.length,
  unitTitles: units.map((u) => u.title),
  persistedInEngScope: eng.length,
  step2HeadingAddressed: step2?.contentRef,
  step2HasProvenance: (step2?.provenanceChangeSetId ?? "").startsWith("cs-"),
  contentAddressed: units.every((u) => u.contentHash.length === 64),
} }, null, 2));
await pool.end();
