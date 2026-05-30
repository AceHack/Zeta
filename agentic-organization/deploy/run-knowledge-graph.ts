/**
 * Prove TRACK G (Knowledge Graph) end to end in kind: extract a codebase manifest into the
 * graph (extracted facts + provenance), enrich it (inferred edge, promote to verified, a
 * changed_by edge to a ChangeSet, a retraction), then derive intelligence (impact/ownership/
 * change-history) — all against live Cockroach, with confidence tiers + retraction persisted.
 *
 *   kubectl -n agentic-org port-forward svc/cockroach 26259:26257 &
 *   COCKROACH_DATABASE_URL=postgresql://root@localhost:26259/defaultdb?sslmode=disable \
 *     node --experimental-strip-types deploy/run-knowledge-graph.ts
 */
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { env } from "node:process";
import { GraphConfidence, GraphEdgeKind, GraphNodeKind, graphNodeId, graphEdgeId } from "../packages/domain/src/index.ts";
import { extractServiceManifest, extractCodeowners, inferEdge, promoteConfidence, retractEdge, deriveImpact, deriveOwnership, deriveChangeHistory, deriveNeighborhood } from "../packages/application/src/index.ts";
import {
  createCockroachSqlExecutor,
  createCockroachGraphStore,
  createCockroachKnowledgeGraphMigration,
  splitSqlStatements,
} from "../packages/state-cockroach/src/index.ts";
import type { CockroachSqlClient } from "../packages/state-cockroach/src/cockroach-sql-executor.ts";

const connectionString = env.COCKROACH_DATABASE_URL ?? "postgresql://root@localhost:26259/defaultdb?sslmode=disable";
const ORG = `org-g5-${randomUUID().slice(0, 8)}`;
const NOW = Date.now();
let seq = 0;
const id = (p: string) => `${p}-${++seq}`;

const pool = new Pool({ connectionString });
const client: CockroachSqlClient = { query: async (sql, p) => ({ rows: (await pool.query(sql, p as unknown[])).rows }), transaction: async (op) => op(client) };
const executor = createCockroachSqlExecutor({ client });
for (const s of splitSqlStatements(createCockroachKnowledgeGraphMigration().sql)) await pool.query(s);
const store = createCockroachGraphStore({ executor });
const deps = { organizationId: ORG, now: () => NOW, createId: id };

// 1) deterministic extraction: web depends_on billing depends_on auth (+ structural edges)
for (const m of [
  { serviceKey: "services/web", serviceName: "Web", dependsOn: ["services/billing"] },
  { serviceKey: "services/billing", serviceName: "Billing", dependsOn: ["services/auth"], exposes: ["POST /charges"], persistsTo: ["postgres:billing"], testedBy: ["test/billing.spec"] },
  { serviceKey: "services/auth", serviceName: "Auth", dependsOn: [] },
]) {
  const r = extractServiceManifest(m, deps);
  for (const n of r.nodes) await store.upsertNode(n);
  for (const e of r.edges) await store.upsertEdge(e);
}
const co = extractCodeowners([{ path: "services/billing", hatId: "payments_owner" }], deps);
for (const n of co.nodes) await store.upsertNode(n);
for (const e of co.edges) await store.upsertEdge(e);

const billing = graphNodeId(ORG, GraphNodeKind.Service, "services/billing");
const auth = graphNodeId(ORG, GraphNodeKind.Service, "services/auth");

// 2) enrichment: infer an architectural-role edge, promote it, add a changed_by edge, retract a wrong one
const inf = inferEdge({ fromNodeId: billing, kind: GraphEdgeKind.About, toNodeId: auth, agent: "arch-enricher", rationale: "billing is the payments boundary over auth" }, deps);
await store.upsertEdge(inf.edge);
const prom = promoteConfidence(inf.edge, GraphConfidence.Verified, "architect", deps);
if (prom.ok) await store.upsertEdge(prom.edge);
// a changed_by edge referencing a ChangeSet (change provenance)
const changeEdge = { ...inferEdge({ fromNodeId: billing, kind: GraphEdgeKind.ChangedBy, toNodeId: id("cs"), agent: "work-loop", rationale: "release", changeSetId: "cs-release-42" }, deps).edge, confidence: GraphConfidence.Extracted };
await store.upsertEdge({ ...changeEdge, edgeId: graphEdgeId(ORG, billing, GraphEdgeKind.ChangedBy, "cs-node"), toNodeId: "cs-node", changeSetId: "cs-release-42" });
// a wrong edge, then retracted (kept with correction)
const wrong = inferEdge({ fromNodeId: billing, kind: GraphEdgeKind.DependsOn, toNodeId: graphNodeId(ORG, GraphNodeKind.Service, "services/legacy"), agent: "x", rationale: "guess" }, deps);
await store.upsertEdge(wrong.edge);
const ret = retractEdge(wrong.edge, "legacy was decommissioned", "architect", deps);
if (ret.ok) await store.upsertEdge(ret.edge);

// 3) derived intelligence
const impact = await deriveImpact(store, ORG, auth);
const ownership = await deriveOwnership(store, ORG, billing);
const changeHistory = await deriveChangeHistory(store, ORG, billing);
const nb = await deriveNeighborhood(store, ORG, billing);
const verifiedAboutEdge = await store.outEdges(ORG, billing).then((es) => es.find((e) => e.kind === GraphEdgeKind.About));

console.log(JSON.stringify({ trackGProof: {
  impactOfAuth: { dependents: impact.dependents, webIsTransitiveDependent: impact.depthByNode[graphNodeId(ORG, GraphNodeKind.Service, "services/web")] === 2 },
  ownershipOfBilling: ownership,
  changeHistoryOfBilling: changeHistory,
  aboutEdgePromotedToVerified: verifiedAboutEdge?.confidence === GraphConfidence.Verified,
  retractedEdgeExcludedFromNeighborhood: !nb.outbound.some((o) => o.toNodeId.includes("legacy")),
  neighborhoodOutboundKinds: [...new Set(nb.outbound.map((o) => o.kind))].sort(),
} }, null, 2));
await pool.end();
