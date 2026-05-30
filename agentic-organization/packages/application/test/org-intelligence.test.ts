import { ok, deepEqual } from "node:assert/strict";
import { test } from "node:test";

import { DocScopeKind, DocType, DocLifecycleState, GraphConfidence, GraphEdgeKind, type DocEntity, type DocUnit, type GraphEdge } from "../../domain/src/index.ts";
import { summarizeService, type GraphStoreReader } from "../src/index.ts";

const prov = { source: "x", method: "parse", observedAt: "t" };
function edge(from: string, kind: GraphEdgeKind, to: string, changeSetId?: string): GraphEdge {
  return { edgeId: `${from}-${kind}-${to}`, organizationId: "org-lfg", fromNodeId: from, toNodeId: to, kind, confidence: GraphConfidence.Extracted, provenance: prov, ...(changeSetId ? { changeSetId } : {}), createdAt: "t", updatedAt: "t", version: 1 };
}
// web depends_on billing depends_on auth; billing owned_by hat-pay; billing changed_by cs-9
const EDGES: GraphEdge[] = [
  edge("web", GraphEdgeKind.DependsOn, "billing"),
  edge("billing", GraphEdgeKind.DependsOn, "auth"),
  edge("billing", GraphEdgeKind.OwnedBy, "hat-pay"),
  edge("billing", GraphEdgeKind.ChangedBy, "cs-node", "cs-9"),
];
const graph: GraphStoreReader = {
  outEdges: async (_o, from) => EDGES.filter((e) => e.fromNodeId === from),
  inEdges: async (_o, to) => EDGES.filter((e) => e.toNodeId === to),
};

const billingEntity: DocEntity = { docEntityId: "ent-billing", organizationId: "org-lfg", canonicalName: "Billing", kind: "service", aliases: ["the billing service"], createdAt: "t", updatedAt: "t" };
function doc(id: string, scopeId: string, title: string, summary: string): DocUnit {
  return { docUnitId: id, organizationId: "org-lfg", sourceId: "s", type: DocType.Runbook, scopeKind: DocScopeKind.Service, scopeId, title, summary, contentRef: "r", contentHash: "h", status: DocLifecycleState.Active, freshnessAt: "t", boundHatIds: [], boundStageIds: [], createdAt: "t", updatedAt: "t", version: 1 };
}
const corpus = [doc("d-billing", "billing", "Billing runbook", "restart the billing service"), doc("d-other", "sales", "Sales doc", "unrelated")];

test("C5 joins graph structure + doc prose into one answer about a service", async () => {
  const intel = await summarizeService("billing", "Billing", graph, corpus, [billingEntity], { organizationId: "org-lfg", docScope: { kind: DocScopeKind.Service, id: "billing" } });

  // graph side
  deepEqual(intel.dependsOn, ["auth"]); // structural fact from the graph
  ok(intel.dependents.includes("web"), "web is in billing's blast radius");
  deepEqual(intel.owners, ["hat-pay"]);
  deepEqual(intel.recentChangeSets, ["cs-9"]); // the ChangeSet that touched billing (provenance)

  // doc side — scoped to the service, the wrong-scope doc is excluded
  ok(intel.describingDocs.some((d) => d.docUnitId === "d-billing"));
  ok(!intel.describingDocs.some((d) => d.docUnitId === "d-other"), "a doc from another scope does not describe this service");
});
