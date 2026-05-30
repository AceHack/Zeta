import { equal } from "node:assert/strict";
import { test } from "node:test";

import { GraphConfidence, GraphEdgeKind, GraphNodeKind, type GraphEdge, type GraphNode } from "../../domain/src/index.ts";
import { createCockroachGraphStore } from "../src/cockroach-graph-store.ts";
import type { CockroachGenericSqlExecutor } from "../src/cockroach-sql-executor.ts";

function fakeExecutor(): CockroachGenericSqlExecutor {
  const nodes = new Map<string, Record<string, unknown>>();
  const edges = new Map<string, Record<string, unknown>>();
  const exec = async (s: { sql: string; parameters: readonly unknown[] }) => {
    const p = s.parameters; const sql = s.sql;
    if (sql.includes(`INTO agentic_org_graph_nodes`)) { nodes.set(p[0] as string, { node_id: p[0], organization_id: p[1], kind: p[2], source_key: p[3], label: p[4], confidence: p[5], provenance: p[6], attributes: p[7], created_at: p[8], updated_at: p[9], version: p[10] }); return { rows: [] }; }
    if (sql.includes(`INTO agentic_org_graph_edges`)) { edges.set(p[0] as string, { edge_id: p[0], organization_id: p[1], from_node_id: p[2], to_node_id: p[3], kind: p[4], confidence: p[5], provenance: p[6], change_set_id: p[7], retraction_reason: p[8], created_at: p[9], updated_at: p[10], version: p[11] }); return { rows: [] }; }
    if (sql.includes("WHERE node_id = $1")) { const r = nodes.get(p[0] as string); return { rows: r ? [r] : [] }; }
    if (sql.includes("from_node_id = $2")) { return { rows: [...edges.values()].filter((e) => e["organization_id"] === p[0] && e["from_node_id"] === p[1] && e["confidence"] !== GraphConfidence.Retracted) }; }
    if (sql.includes("to_node_id = $2")) { return { rows: [...edges.values()].filter((e) => e["organization_id"] === p[0] && e["to_node_id"] === p[1] && e["confidence"] !== GraphConfidence.Retracted) }; }
    if (sql.includes("change_set_id = $1")) { return { rows: [...edges.values()].filter((e) => e["change_set_id"] === p[0]) }; }
    return { rows: [] };
  };
  return { execute: exec, executeTransaction: async (op: (e: { execute: typeof exec }) => unknown) => op({ execute: exec }) } as unknown as CockroachGenericSqlExecutor;
}

const prov = { source: "manifest:x", method: "parse", observedAt: "2026-05-30T00:00:00Z" };
function n(id: string): GraphNode { return { nodeId: id, organizationId: "org-lfg", kind: GraphNodeKind.Service, sourceKey: id, label: id, confidence: GraphConfidence.Extracted, provenance: prov, attributes: {}, createdAt: "2026-05-30T00:00:00Z", updatedAt: "2026-05-30T00:00:00Z", version: 1 }; }
function e(id: string, from: string, to: string, conf: GraphConfidence = GraphConfidence.Extracted, changeSetId?: string): GraphEdge { return { edgeId: id, organizationId: "org-lfg", fromNodeId: from, toNodeId: to, kind: GraphEdgeKind.DependsOn, confidence: conf, provenance: prov, ...(changeSetId ? { changeSetId } : {}), createdAt: "2026-05-30T00:00:00Z", updatedAt: "2026-05-30T00:00:00Z", version: 1 }; }

test("graph store round-trips a node + traverses out/in edges, excluding retracted", async () => {
  const store = createCockroachGraphStore({ executor: fakeExecutor() });
  await store.upsertNode(n("billing"));
  await store.upsertNode(n("auth"));
  await store.upsertEdge(e("e1", "billing", "auth"));
  await store.upsertEdge(e("e2", "billing", "auth", GraphConfidence.Retracted)); // retracted — excluded from reads

  equal((await store.getNode("billing"))?.nodeId, "billing");
  const out = await store.outEdges("org-lfg", "billing");
  equal(out.length, 1, "the retracted edge does not assert");
  equal(out[0]!.edgeId, "e1");
  equal((await store.inEdges("org-lfg", "auth")).length, 1);
});

test("graph store finds change-edges by ChangeSet (change provenance)", async () => {
  const store = createCockroachGraphStore({ executor: fakeExecutor() });
  await store.upsertEdge(e("ce", "billing", "auth", GraphConfidence.Extracted, "cs-42"));
  const byCs = await store.edgesByChangeSet("cs-42");
  equal(byCs.length, 1);
  equal(byCs[0]!.changeSetId, "cs-42");
});
