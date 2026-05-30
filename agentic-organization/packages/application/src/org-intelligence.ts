/**
 * Codebase + org intelligence (C5) — the payoff of D + G together. A single question, "tell me
 * about service X", is answered by COMPOSING the knowledge graph (what it depends on, who owns it,
 * what changed it, its blast radius) with document intelligence (the docs that describe it,
 * smarter-than-RAG-scoped to the service). Neither layer alone can do this: the graph has the
 * structure, the doc layer has the prose, and C5 joins them into one provenance-bearing answer.
 */

import { DocScopeKind, type DocEntity, type DocUnit } from "../../domain/src/index.ts";
import { deriveImpact, deriveOwnership, deriveChangeHistory, deriveNeighborhood, type GraphStoreReader } from "./knowledge-graph-intelligence.ts";
import { runRetrieval } from "./document-retrieval.ts";

export type ServiceIntelligence = {
  serviceNodeId: string;
  serviceLabel: string;
  /** structural facts from the graph */
  dependsOn: readonly string[]; // nodes this service depends on (out depends_on)
  dependents: readonly string[]; // the blast radius (who breaks if this changes)
  owners: readonly string[]; // owning hats
  recentChangeSets: readonly string[]; // ChangeSets that touched it (provenance of change)
  /** prose from the doc layer — the docs that describe this service, scoped + ranked */
  describingDocs: readonly { docUnitId: string; title: string; summary: string }[];
};

export type OrgIntelligenceDeps = {
  organizationId: string;
  /** how to scope doc retrieval to this service (its department/project scope) */
  docScope: { kind: DocScopeKind; id: string };
};

/**
 * Compose the graph + doc layers into one answer about a service. The graph traversal and the
 * doc retrieval are independent reads joined here — provenance flows through (change-edges →
 * ChangeSets, doc units → their content refs).
 */
export async function summarizeService(
  serviceNodeId: string,
  serviceLabel: string,
  graph: GraphStoreReader,
  docCorpus: readonly DocUnit[],
  docEntities: readonly DocEntity[],
  deps: OrgIntelligenceDeps,
): Promise<ServiceIntelligence> {
  // ── graph side ──────────────────────────────────────────────────────────
  const neighborhood = await deriveNeighborhood(graph, deps.organizationId, serviceNodeId);
  const dependsOn = neighborhood.outbound.filter((o) => o.kind === "depends_on").map((o) => o.toNodeId);
  const [impact, owners, recentChangeSets] = await Promise.all([
    deriveImpact(graph, deps.organizationId, serviceNodeId),
    deriveOwnership(graph, deps.organizationId, serviceNodeId),
    deriveChangeHistory(graph, deps.organizationId, serviceNodeId),
  ]);

  // ── doc side: retrieve the docs that describe this service (D3, scoped) ──
  const retrieval = runRetrieval(
    serviceLabel,
    { organizationId: deps.organizationId, scopes: [deps.docScope] },
    docCorpus,
    docEntities,
  );
  const describingDocs = retrieval.hits.map((h) => ({ docUnitId: h.unit.docUnitId, title: h.unit.title, summary: h.unit.summary }));

  return {
    serviceNodeId,
    serviceLabel,
    dependsOn,
    dependents: impact.dependents,
    owners,
    recentChangeSets,
    describingDocs,
  };
}
