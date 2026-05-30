/**
 * Derived intelligence (G4) — the value the graph unlocks that neither RAG nor a flat store
 * can: traversal. impact analysis (what breaks if this changes), ownership resolution, and
 * change history (which ChangeSets touched a node) all fall out of walking edges. This also
 * LIGHTS UP D3's Stage-5 graph-augmentation seam: a retrieved doc unit, anchored on the graph
 * node it is about, gains its neighborhood — the service it describes, what that service depends
 * on, and the ChangeSet that changed it — so the agent gets context, not just the hit.
 *
 * All reads go through the GraphStore, whose traversal already excludes retracted edges.
 */

import type { GraphEdge, GraphEdgeKind } from "../../domain/src/index.ts";
import { GraphEdgeKind as EdgeKind } from "../../domain/src/index.ts";

export type GraphStoreReader = {
  outEdges: (organizationId: string, fromNodeId: string) => Promise<readonly GraphEdge[]>;
  inEdges: (organizationId: string, toNodeId: string) => Promise<readonly GraphEdge[]>;
};

/** The blast radius of a node: everything that (transitively) depends_on it, with depth. */
export async function deriveImpact(
  store: GraphStoreReader,
  organizationId: string,
  nodeId: string,
  maxDepth = 8,
): Promise<{ dependents: readonly string[]; depthByNode: Readonly<Record<string, number>> }> {
  const visited: Record<string, number> = { [nodeId]: 0 }; // seed the root visited (depth 0)
  let frontier = [nodeId];
  for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth += 1) {
    const next: string[] = [];
    for (const id of frontier) {
      const incoming = await store.inEdges(organizationId, id);
      for (const e of incoming) {
        if (e.kind !== EdgeKind.DependsOn) continue;
        if (visited[e.fromNodeId] !== undefined) continue; // shortest depth wins; cycles + self-ref safe
        visited[e.fromNodeId] = depth;
        next.push(e.fromNodeId);
      }
    }
    frontier = next;
  }
  // the root is never a dependent of itself (even under a depends_on cycle)
  const { [nodeId]: _root, ...depthByNode } = visited;
  return { dependents: Object.keys(depthByNode), depthByNode };
}

/** The hats that own a node (owned_by edges out of it). */
export async function deriveOwnership(store: GraphStoreReader, organizationId: string, nodeId: string): Promise<readonly string[]> {
  const out = await store.outEdges(organizationId, nodeId);
  return out.filter((e) => e.kind === EdgeKind.OwnedBy).map((e) => e.toNodeId);
}

/** The ChangeSets that touched a node (changed_by edges → provenance of changes). */
export async function deriveChangeHistory(store: GraphStoreReader, organizationId: string, nodeId: string): Promise<readonly string[]> {
  const out = await store.outEdges(organizationId, nodeId);
  return out.filter((e) => e.kind === EdgeKind.ChangedBy && e.changeSetId !== undefined).map((e) => e.changeSetId!);
}

export type GraphNeighborhood = {
  nodeId: string;
  outbound: readonly { kind: GraphEdgeKind; toNodeId: string }[];
  inbound: readonly { kind: GraphEdgeKind; fromNodeId: string }[];
  changeSets: readonly string[];
};

/** The full neighborhood of a node — the Stage-5 augmentation context for a retrieved unit. */
export async function deriveNeighborhood(store: GraphStoreReader, organizationId: string, nodeId: string): Promise<GraphNeighborhood> {
  const out = await store.outEdges(organizationId, nodeId);
  const incoming = await store.inEdges(organizationId, nodeId);
  return {
    nodeId,
    outbound: out.map((e) => ({ kind: e.kind, toNodeId: e.toNodeId })),
    inbound: incoming.map((e) => ({ kind: e.kind, fromNodeId: e.fromNodeId })),
    changeSets: out.filter((e) => e.kind === EdgeKind.ChangedBy && e.changeSetId !== undefined).map((e) => e.changeSetId!),
  };
}

/**
 * D3 Stage 5, lit: augment retrieval hits with their graph neighborhood. `nodeIdForHit` maps a
 * hit to the graph node it is about (e.g. via its resolved entity); hits with no graph node are
 * returned unaugmented. Async because traversal reads the store — runs AFTER the sync pipeline.
 */
export async function augmentHitsWithGraph<H>(
  hits: readonly H[],
  store: GraphStoreReader,
  organizationId: string,
  nodeIdForHit: (hit: H) => string | null,
): Promise<readonly { hit: H; neighborhood: GraphNeighborhood | null }[]> {
  const out: { hit: H; neighborhood: GraphNeighborhood | null }[] = [];
  for (const hit of hits) {
    const nodeId = nodeIdForHit(hit);
    out.push({ hit, neighborhood: nodeId === null ? null : await deriveNeighborhood(store, organizationId, nodeId) });
  }
  return out;
}
