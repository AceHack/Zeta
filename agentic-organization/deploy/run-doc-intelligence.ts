/**
 * Prove TRACK D (Document Intelligence) end to end in kind: ingest a doc set, then show the
 * 8-stage pipeline beats naive RAG (scope excludes wrong-team docs, entity anchoring, the
 * stage-bound handbook is consulted deterministically), then run the maintenance cycle and
 * observe doc_* org_events — all against the live Cockroach.
 *
 *   kubectl -n agentic-org port-forward svc/cockroach 26259:26257 &
 *   COCKROACH_DATABASE_URL=postgresql://root@localhost:26259/defaultdb?sslmode=disable \
 *     node --experimental-strip-types deploy/run-doc-intelligence.ts
 */
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { env } from "node:process";
import { DocType, DocScopeKind, DocLifecycleState, type DocEntity, type DocUnit } from "../packages/domain/src/index.ts";
import { ingestDocument, runRetrieval, runDocMaintenanceCycle, type RetrievalContext } from "../packages/application/src/index.ts";
import {
  createCockroachSqlExecutor,
  createCockroachDocUnitStore,
  createCockroachOrgEventStore,
  createCockroachDocumentIntelligenceMigration,
  splitSqlStatements,
} from "../packages/state-cockroach/src/index.ts";
import type { CockroachSqlClient } from "../packages/state-cockroach/src/cockroach-sql-executor.ts";

const connectionString = env.COCKROACH_DATABASE_URL ?? "postgresql://root@localhost:26259/defaultdb?sslmode=disable";
const ORG = `org-d5-${randomUUID().slice(0, 8)}`; // fresh org so the proof is isolated
const NOW = Date.now();
const DAY = 86_400_000;
const id = (p: string) => `${p}-${randomUUID()}`;

const pool = new Pool({ connectionString });
const client: CockroachSqlClient = { query: async (sql, p) => ({ rows: (await pool.query(sql, p as unknown[])).rows }), transaction: async (op) => op(client) };
const executor = createCockroachSqlExecutor({ client });
for (const s of splitSqlStatements(createCockroachDocumentIntelligenceMigration().sql)) await pool.query(s);
const store = createCockroachDocUnitStore({ executor });
const events = createCockroachOrgEventStore({ executor });

const billing: DocEntity = { docEntityId: "ent-billing", organizationId: ORG, canonicalName: "Billing", kind: "service", aliases: ["the billing service", "services/billing"], createdAt: "t", updatedAt: "t" };

// ingest three docs: an eng handbook (active, billing), a sales doc (active, same words), a stale eng runbook
async function ingestActive(over: Partial<DocUnit> & { markdown: string; title: string; type: DocType; scopeId: string }): Promise<DocUnit[]> {
  const raw = { sourceId: id("src"), externalRef: id("wiki"), type: over.type, scopeKind: DocScopeKind.Department, scopeId: over.scopeId, title: over.title, markdown: over.markdown, boundStageIds: over.boundStageIds ?? [] };
  const { units, events: evs } = ingestDocument(raw, { organizationId: ORG, now: () => NOW, createId: id, provenanceChangeSetId: id("cs") });
  for (const e of evs) await events.append(e);
  const active = units.map((u) => ({ ...u, status: (over.status ?? DocLifecycleState.Active), freshnessAt: over.freshnessAt ?? u.freshnessAt }));
  for (const u of active) await store.upsert(u);
  return active;
}

await ingestActive({ type: DocType.Handbook, scopeId: "docs", title: "Release Handbook", markdown: "# Release Handbook\nrun the billing service checks before shipping", boundStageIds: ["release"] });
await ingestActive({ type: DocType.Runbook, scopeId: "eng", title: "Billing runbook", markdown: "# Billing runbook\nrestart the billing service workers" });
await ingestActive({ type: DocType.Runbook, scopeId: "sales", title: "Billing runbook", markdown: "# Billing runbook\nrestart the billing service workers" });
await ingestActive({ type: DocType.Runbook, scopeId: "eng", title: "Ancient guide", markdown: "# Ancient guide\nold stuff", status: DocLifecycleState.Active, freshnessAt: new Date(NOW - 200 * DAY).toISOString() });

// 8-stage retrieval for an eng release query that mentions the billing service
const corpus = [
  ...(await store.listByOrgStatus(ORG, DocLifecycleState.Active)),
];
const ctx: RetrievalContext = { organizationId: ORG, stageId: "release", scopes: [{ kind: DocScopeKind.Department, id: "eng" }] };
const r = runRetrieval("the billing service is failing during release", ctx, corpus, [billing]);

// maintenance: the 200-day-old eng unit should be flagged stale
const maint = runDocMaintenanceCycle(corpus, { organizationId: ORG, now: NOW, createId: id, stalenessFloorMs: 30 * DAY, archiveFloorMs: 180 * DAY });
for (const e of maint.events) await events.append(e);

const allEvents = await events.listByOrganization(ORG, 200);
const docEvents = allEvents.filter((e) => e.kind.startsWith("doc_"));

console.log(JSON.stringify({ trackDProof: {
  ingestedActiveUnits: corpus.length,
  query: "the billing service is failing during release",
  scopeExcludedSalesDoc: r.hits.every((h) => h.unit.scopeId !== "sales"),
  topHitIsEngBilling: r.hits[0]?.unit.scopeId === "eng" && r.hits[0]?.unit.title.includes("Billing"),
  topHitEntityAnchored: r.hits[0]?.reasons.includes("entity-anchored") ?? false,
  queryResolvedEntities: r.diagnostics.queryEntities,
  stageBoundHandbookConsulted: r.consulted.some((c) => c.title === "Release Handbook"),
  diagnostics: r.diagnostics,
  maintenanceStaleFlagged: maint.staleFlagged,
  docOrgEventsObserved: docEvents.length,
} }, null, 2));
await pool.end();
