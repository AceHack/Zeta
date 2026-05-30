/**
 * Deterministic graph extraction (G1) — the MACHINE pass. Given already-parsed structured
 * input (a service manifest, an import list, a CODEOWNERS table), it emits nodes + edges a
 * parser can PROVE, all at `extracted` confidence with provenance, zero model calls. This is
 * never conflated with the enrichment pass (G2): structural facts (depends_on, exposes,
 * persists_to, tested_by) are `extracted`; the semantic layer (ownership, risk) is added later
 * as `inferred`. Ids are content-addressed, so re-extraction updates a node/edge in place.
 *
 * Pure: returns the nodes/edges/events for the caller to persist — deterministic + testable.
 */

import {
  GraphConfidence,
  GraphNodeKind,
  GraphEdgeKind,
  OrgEventKind,
  graphNodeId,
  graphEdgeId,
  type GraphNode,
  type GraphEdge,
  type GraphProvenance,
  type OrgEvent,
} from "../../domain/src/index.ts";

export type ExtractDeps = {
  organizationId: string;
  now: () => number;
  createId: (prefix: string) => string;
};

export type ExtractResult = {
  nodes: readonly GraphNode[];
  edges: readonly GraphEdge[];
  events: readonly OrgEvent[];
};

/** A parsed service manifest (the connector parses the real file; this maps structure → graph). */
export type ServiceManifest = {
  serviceKey: string; // "services/billing" — the content-address key
  serviceName: string;
  dependsOn: readonly string[]; // other service keys
  exposes?: readonly string[]; // endpoint keys (e.g. "POST /charges")
  persistsTo?: readonly string[]; // datastore keys (e.g. "postgres:billing")
  testedBy?: readonly string[]; // test target keys
};

function node(deps: ExtractDeps, kind: GraphNodeKind, sourceKey: string, label: string, provenance: GraphProvenance, attributes: Record<string, string> = {}): GraphNode {
  const nowIso = new Date(deps.now()).toISOString();
  return {
    nodeId: graphNodeId(deps.organizationId, kind, sourceKey),
    organizationId: deps.organizationId,
    kind, sourceKey, label,
    confidence: GraphConfidence.Extracted,
    provenance, attributes,
    createdAt: nowIso, updatedAt: nowIso, version: 1,
  };
}

function edge(deps: ExtractDeps, fromNodeId: string, kind: GraphEdgeKind, toNodeId: string, provenance: GraphProvenance, confidence: GraphConfidence = GraphConfidence.Extracted): GraphEdge {
  const nowIso = new Date(deps.now()).toISOString();
  return {
    edgeId: graphEdgeId(deps.organizationId, fromNodeId, kind, toNodeId),
    organizationId: deps.organizationId,
    fromNodeId, toNodeId, kind,
    confidence, provenance,
    createdAt: nowIso, updatedAt: nowIso, version: 1,
  };
}

function ingestedEvent(deps: ExtractDeps, subjectId: string, decision: string, prov: GraphProvenance): OrgEvent {
  return {
    id: deps.createId("evt"), kind: OrgEventKind.GraphNodeExtracted, occurredAt: new Date(deps.now()).toISOString(),
    organizationId: deps.organizationId, subjectId, decision, supervisorChain: [], evidenceRefs: [`${prov.source}#${prov.method}`],
    correlationId: subjectId, causationId: subjectId, traceId: subjectId,
  };
}

/**
 * Extract a service manifest into the graph: a Service node + extracted structural edges
 * (depends_on → services, exposes → endpoints, persists_to → datastores, tested_by → tests).
 * Every node/edge is `extracted` (a parser proved it). Content-addressed → idempotent.
 */
export function extractServiceManifest(manifest: ServiceManifest, deps: ExtractDeps): ExtractResult {
  const prov: GraphProvenance = { source: `manifest:${manifest.serviceKey}`, method: "parse", observedAt: new Date(deps.now()).toISOString() };
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const events: OrgEvent[] = [];

  const svc = node(deps, GraphNodeKind.Service, manifest.serviceKey, manifest.serviceName, prov, { kind: "service" });
  nodes.push(svc);
  events.push(ingestedEvent(deps, svc.nodeId, `extracted service ${manifest.serviceName}`, prov));

  for (const depKey of manifest.dependsOn) {
    const dep = node(deps, GraphNodeKind.Service, depKey, depKey, prov);
    nodes.push(dep);
    edges.push(edge(deps, svc.nodeId, GraphEdgeKind.DependsOn, dep.nodeId, prov));
  }
  for (const epKey of manifest.exposes ?? []) {
    const ep = node(deps, GraphNodeKind.Endpoint, epKey, epKey, prov);
    nodes.push(ep);
    edges.push(edge(deps, svc.nodeId, GraphEdgeKind.Exposes, ep.nodeId, prov));
  }
  for (const dsKey of manifest.persistsTo ?? []) {
    const ds = node(deps, GraphNodeKind.Datastore, dsKey, dsKey, prov);
    nodes.push(ds);
    edges.push(edge(deps, svc.nodeId, GraphEdgeKind.PersistsTo, ds.nodeId, prov));
  }
  for (const tKey of manifest.testedBy ?? []) {
    const t = node(deps, GraphNodeKind.TestTarget, tKey, tKey, prov);
    nodes.push(t);
    edges.push(edge(deps, t.nodeId, GraphEdgeKind.TestedBy, svc.nodeId, prov));
  }
  return { nodes, edges, events };
}

/** A parsed CODEOWNERS entry: a path owned by a hat. */
export type CodeownersEntry = { path: string; hatId: string };

/**
 * Extract CODEOWNERS into the graph. Per the design, ownership is a CANDIDATE: the parse is
 * deterministic but the org should confirm it, so owned_by edges land at `inferred` (NOT
 * `extracted`) — the discipline that a parsed fact about STRUCTURE differs from a parsed
 * SIGNAL about ownership/responsibility.
 */
export function extractCodeowners(entries: readonly CodeownersEntry[], deps: ExtractDeps): ExtractResult {
  const prov: GraphProvenance = { source: "manifest:CODEOWNERS", method: "parse", observedAt: new Date(deps.now()).toISOString() };
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  for (const e of entries) {
    const target = node(deps, GraphNodeKind.Module, e.path, e.path, prov);
    const hat = node(deps, GraphNodeKind.Hat, e.hatId, e.hatId, prov);
    nodes.push(target, hat);
    // owned_by is INFERRED — a candidate that needs confirmation, not a proven structural fact
    edges.push(edge(deps, target.nodeId, GraphEdgeKind.OwnedBy, hat.nodeId, prov, GraphConfidence.Inferred));
  }
  return { nodes, edges, events: [] };
}
