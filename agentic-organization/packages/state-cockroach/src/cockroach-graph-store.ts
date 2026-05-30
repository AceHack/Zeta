/**
 * Cockroach knowledge-graph store (G1) — idempotent node/edge persistence + traversal reads.
 * Writes upsert on the content-addressed id (re-extraction updates in place). Reads back the
 * neighborhood (out/in edges by node) to power derived intelligence + D3's graph-augment stage.
 * Default reads exclude `retracted` edges (the correction is kept, but it no longer asserts).
 */

import {
  GraphConfidence,
  type GraphNode,
  type GraphEdge,
  type GraphNodeKind,
  type GraphEdgeKind,
  type GraphProvenance,
} from "../../domain/src/index.ts";
import { CockroachTableName } from "./cockroach-schema.ts";
import type { CockroachGenericSqlExecutor } from "./cockroach-sql-executor.ts";

export type GraphStore = {
  upsertNode: (n: GraphNode) => Promise<void>;
  upsertEdge: (e: GraphEdge) => Promise<void>;
  getNode: (nodeId: string) => Promise<GraphNode | null>;
  outEdges: (organizationId: string, fromNodeId: string) => Promise<readonly GraphEdge[]>;
  inEdges: (organizationId: string, toNodeId: string) => Promise<readonly GraphEdge[]>;
  edgesByChangeSet: (changeSetId: string) => Promise<readonly GraphEdge[]>;
};

export type CreateCockroachGraphStoreInput = { executor: CockroachGenericSqlExecutor };

function toIso(v: string | Date): string { return v instanceof Date ? v.toISOString() : new Date(v).toISOString(); }
function toNum(v: number | string): number { return typeof v === "number" ? v : Number(v); }
function parseJson<T>(v: unknown): T { return (typeof v === "string" ? JSON.parse(v) : v) as T; }

type NodeRow = { node_id: string; organization_id: string; kind: string; source_key: string; label: string; confidence: string; provenance: unknown; attributes: unknown; created_at: string | Date; updated_at: string | Date; version: number | string };
type EdgeRow = { edge_id: string; organization_id: string; from_node_id: string; to_node_id: string; kind: string; confidence: string; provenance: unknown; change_set_id: string | null; retraction_reason: string | null; created_at: string | Date; updated_at: string | Date; version: number | string };

function rowToNode(r: NodeRow): GraphNode {
  return { nodeId: r.node_id, organizationId: r.organization_id, kind: r.kind as GraphNodeKind, sourceKey: r.source_key, label: r.label, confidence: r.confidence as GraphConfidence, provenance: parseJson<GraphProvenance>(r.provenance), attributes: parseJson<Record<string, string>>(r.attributes), createdAt: toIso(r.created_at), updatedAt: toIso(r.updated_at), version: toNum(r.version) };
}
function rowToEdge(r: EdgeRow): GraphEdge {
  return { edgeId: r.edge_id, organizationId: r.organization_id, fromNodeId: r.from_node_id, toNodeId: r.to_node_id, kind: r.kind as GraphEdgeKind, confidence: r.confidence as GraphConfidence, provenance: parseJson<GraphProvenance>(r.provenance), ...(r.change_set_id !== null ? { changeSetId: r.change_set_id } : {}), ...(r.retraction_reason !== null ? { retractionReason: r.retraction_reason } : {}), createdAt: toIso(r.created_at), updatedAt: toIso(r.updated_at), version: toNum(r.version) };
}

export function createCockroachGraphStore(input: CreateCockroachGraphStoreInput): GraphStore {
  const N = CockroachTableName.GraphNodes;
  const E = CockroachTableName.GraphEdges;
  const edgeCols = "edge_id, organization_id, from_node_id, to_node_id, kind, confidence, provenance, change_set_id, retraction_reason, created_at, updated_at, version";
  // default reads exclude retracted edges (kept-with-correction, no longer asserting)
  const activeEdge = `confidence <> '${GraphConfidence.Retracted}'`;

  return {
    async upsertNode(n: GraphNode): Promise<void> {
      await input.executor.execute({
        name: "upsert_graph_node",
        sql: `INSERT INTO ${N} (node_id, organization_id, kind, source_key, label, confidence, provenance, attributes, created_at, updated_at, version)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
          ON CONFLICT (node_id) DO UPDATE SET label = excluded.label, confidence = excluded.confidence, provenance = excluded.provenance, attributes = excluded.attributes, updated_at = excluded.updated_at, version = excluded.version`,
        parameters: [n.nodeId, n.organizationId, n.kind, n.sourceKey, n.label, n.confidence, JSON.stringify(n.provenance), JSON.stringify(n.attributes), n.createdAt, n.updatedAt, n.version],
      });
    },
    async upsertEdge(e: GraphEdge): Promise<void> {
      await input.executor.execute({
        name: "upsert_graph_edge",
        sql: `INSERT INTO ${E} (${edgeCols}) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
          ON CONFLICT (edge_id) DO UPDATE SET confidence = excluded.confidence, provenance = excluded.provenance, change_set_id = excluded.change_set_id, retraction_reason = excluded.retraction_reason, updated_at = excluded.updated_at, version = excluded.version`,
        parameters: [e.edgeId, e.organizationId, e.fromNodeId, e.toNodeId, e.kind, e.confidence, JSON.stringify(e.provenance), e.changeSetId ?? null, e.retractionReason ?? null, e.createdAt, e.updatedAt, e.version],
      });
    },
    async getNode(nodeId: string): Promise<GraphNode | null> {
      const r = await input.executor.execute<NodeRow>({ name: "get_graph_node", sql: `SELECT node_id, organization_id, kind, source_key, label, confidence, provenance, attributes, created_at, updated_at, version FROM ${N} WHERE node_id = $1`, parameters: [nodeId] });
      return r.rows[0] ? rowToNode(r.rows[0]) : null;
    },
    async outEdges(organizationId: string, fromNodeId: string): Promise<readonly GraphEdge[]> {
      const r = await input.executor.execute<EdgeRow>({ name: "graph_out_edges", sql: `SELECT ${edgeCols} FROM ${E} WHERE organization_id = $1 AND from_node_id = $2 AND ${activeEdge}`, parameters: [organizationId, fromNodeId] });
      return r.rows.map(rowToEdge);
    },
    async inEdges(organizationId: string, toNodeId: string): Promise<readonly GraphEdge[]> {
      const r = await input.executor.execute<EdgeRow>({ name: "graph_in_edges", sql: `SELECT ${edgeCols} FROM ${E} WHERE organization_id = $1 AND to_node_id = $2 AND ${activeEdge}`, parameters: [organizationId, toNodeId] });
      return r.rows.map(rowToEdge);
    },
    async edgesByChangeSet(changeSetId: string): Promise<readonly GraphEdge[]> {
      const r = await input.executor.execute<EdgeRow>({ name: "graph_edges_by_change_set", sql: `SELECT ${edgeCols} FROM ${E} WHERE change_set_id = $1`, parameters: [changeSetId] });
      return r.rows.map(rowToEdge);
    },
  };
}
