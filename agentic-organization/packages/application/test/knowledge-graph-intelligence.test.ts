import { equal, ok, deepEqual } from "node:assert/strict";
import { test } from "node:test";

import { GraphConfidence, GraphEdgeKind, type GraphEdge } from "../../domain/src/index.ts";
import { deriveImpact, deriveOwnership, deriveChangeHistory, deriveNeighborhood, augmentHitsWithGraph, type GraphStoreReader } from "../src/index.ts";

const prov = { source: "x", method: "parse", observedAt: "t" };
function e(from: string, kind: GraphEdgeKind, to: string, conf: GraphConfidence = GraphConfidence.Extracted, changeSetId?: string): GraphEdge {
  return { edgeId: `${from}-${kind}-${to}`, organizationId: "org-lfg", fromNodeId: from, toNodeId: to, kind, confidence: conf, provenance: prov, ...(changeSetId ? { changeSetId } : {}), createdAt: "t", updatedAt: "t", version: 1 };
}

// graph: web depends_on billing depends_on auth; billing changed_by cs-42; billing owned_by hat-pay
const EDGES: GraphEdge[] = [
  e("web", GraphEdgeKind.DependsOn, "billing"),
  e("billing", GraphEdgeKind.DependsOn, "auth"),
  e("billing", GraphEdgeKind.ChangedBy, "cs-42", GraphConfidence.Extracted, "cs-42"),
  e("billing", GraphEdgeKind.OwnedBy, "hat-pay", GraphConfidence.Inferred),
  e("billing", GraphEdgeKind.DependsOn, "old-auth", GraphConfidence.Retracted), // retracted — excluded
];
const store: GraphStoreReader = {
  outEdges: async (_o, from) => EDGES.filter((x) => x.fromNodeId === from && x.confidence !== GraphConfidence.Retracted),
  inEdges: async (_o, to) => EDGES.filter((x) => x.toNodeId === to && x.confidence !== GraphConfidence.Retracted),
};

test("deriveImpact returns the transitive blast radius with depth (what breaks if auth changes)", async () => {
  const { dependents, depthByNode } = await deriveImpact(store, "org-lfg", "auth");
  ok(dependents.includes("billing"), "billing depends_on auth directly");
  ok(dependents.includes("web"), "web depends_on billing depends_on auth transitively");
  equal(depthByNode["billing"], 1);
  equal(depthByNode["web"], 2);
});

test("deriveChangeHistory returns the ChangeSets that touched a node (change provenance)", async () => {
  deepEqual(await deriveChangeHistory(store, "org-lfg", "billing"), ["cs-42"]);
});

test("deriveOwnership returns the owning hats", async () => {
  deepEqual(await deriveOwnership(store, "org-lfg", "billing"), ["hat-pay"]);
});

test("deriveNeighborhood gives the Stage-5 context (out/in + changeSets), excluding retracted", async () => {
  const nb = await deriveNeighborhood(store, "org-lfg", "billing");
  ok(nb.outbound.some((o) => o.kind === GraphEdgeKind.DependsOn && o.toNodeId === "auth"));
  ok(!nb.outbound.some((o) => o.toNodeId === "old-auth"), "retracted edge is not in the neighborhood");
  ok(nb.inbound.some((i) => i.fromNodeId === "web"));
  deepEqual(nb.changeSets, ["cs-42"]);
});

test("augmentHitsWithGraph lights up D3 Stage 5: a retrieved unit traverses to its service + change", async () => {
  const hits = [{ docUnitId: "u-billing-rb", aboutNode: "billing" }, { docUnitId: "u-orphan", aboutNode: null }];
  const augmented = await augmentHitsWithGraph(hits, store, "org-lfg", (h) => h.aboutNode);
  const billingHit = augmented.find((a) => a.hit.docUnitId === "u-billing-rb")!;
  ok(billingHit.neighborhood !== null);
  deepEqual(billingHit.neighborhood!.changeSets, ["cs-42"]); // traverses to the ChangeSet that changed its service
  const orphan = augmented.find((a) => a.hit.docUnitId === "u-orphan")!;
  equal(orphan.neighborhood, null, "a hit with no graph node is returned unaugmented");
});

test("deriveImpact is cycle-safe: the root is never reported as its own dependent", async () => {
  const cyclic: GraphEdge[] = [e("a", GraphEdgeKind.DependsOn, "b"), e("b", GraphEdgeKind.DependsOn, "a")];
  const cyclicStore: GraphStoreReader = {
    outEdges: async (_o, from) => cyclic.filter((x) => x.fromNodeId === from),
    inEdges: async (_o, to) => cyclic.filter((x) => x.toNodeId === to),
  };
  const { dependents } = await deriveImpact(cyclicStore, "org-lfg", "a");
  ok(dependents.includes("b"));
  ok(!dependents.includes("a"), "the root is excluded from its own blast radius even under a cycle");
});
