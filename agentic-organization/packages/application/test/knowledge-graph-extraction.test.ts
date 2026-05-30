import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { GraphConfidence, GraphEdgeKind, GraphNodeKind, graphNodeId, OrgEventKind } from "../../domain/src/index.ts";
import { extractServiceManifest, extractCodeowners, type ExtractDeps } from "../src/index.ts";

let seq = 0;
const deps: ExtractDeps = { organizationId: "org-lfg", now: () => Date.parse("2026-05-30T00:00:00Z"), createId: (p) => `${p}-${++seq}` };

const manifest = { serviceKey: "services/billing", serviceName: "Billing", dependsOn: ["services/auth"], exposes: ["POST /charges"], persistsTo: ["postgres:billing"], testedBy: ["test/billing.spec"] };

test("structural facts are EXTRACTED (a parser proved them); every edge carries provenance", () => {
  const r = extractServiceManifest(manifest, deps);
  ok(r.nodes.every((n) => n.confidence === GraphConfidence.Extracted), "manifest-parsed nodes are extracted");
  ok(r.edges.every((e) => e.confidence === GraphConfidence.Extracted));
  ok(r.edges.every((e) => e.provenance.source === "manifest:services/billing" && e.provenance.method === "parse"));
  const kinds = new Set(r.edges.map((e) => e.kind));
  ok(kinds.has(GraphEdgeKind.DependsOn) && kinds.has(GraphEdgeKind.Exposes) && kinds.has(GraphEdgeKind.PersistsTo) && kinds.has(GraphEdgeKind.TestedBy));
  ok(r.events.some((e) => e.kind === OrgEventKind.GraphNodeExtracted));
});

test("extraction is idempotent: the service node id is content-addressed on (org, kind, sourceKey)", () => {
  const a = extractServiceManifest(manifest, deps);
  const b = extractServiceManifest(manifest, deps);
  const svcA = a.nodes.find((n) => n.kind === GraphNodeKind.Service && n.sourceKey === "services/billing")!;
  const svcB = b.nodes.find((n) => n.kind === GraphNodeKind.Service && n.sourceKey === "services/billing")!;
  equal(svcA.nodeId, svcB.nodeId);
  equal(svcA.nodeId, graphNodeId("org-lfg", GraphNodeKind.Service, "services/billing"));
});

test("the depends_on edge points billing -> auth, both content-addressed services", () => {
  const r = extractServiceManifest(manifest, deps);
  const billing = graphNodeId("org-lfg", GraphNodeKind.Service, "services/billing");
  const auth = graphNodeId("org-lfg", GraphNodeKind.Service, "services/auth");
  const dep = r.edges.find((e) => e.kind === GraphEdgeKind.DependsOn)!;
  equal(dep.fromNodeId, billing);
  equal(dep.toNodeId, auth);
});

test("ownership is INFERRED even though parsed (a structural fact differs from an ownership signal)", () => {
  const r = extractCodeowners([{ path: "services/billing", hatId: "billing_owner" }], deps);
  const owned = r.edges.find((e) => e.kind === GraphEdgeKind.OwnedBy)!;
  equal(owned.confidence, GraphConfidence.Inferred, "owned_by is a candidate needing confirmation, not an extracted fact");
});
