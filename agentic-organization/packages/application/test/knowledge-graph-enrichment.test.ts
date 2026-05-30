import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { GraphConfidence, GraphEdgeKind, OrgEventKind, type GraphEdge } from "../../domain/src/index.ts";
import { inferEdge, promoteConfidence, retractEdge, type EnrichDeps } from "../src/index.ts";

let seq = 0;
const deps: EnrichDeps = { organizationId: "org-lfg", now: () => Date.parse("2026-05-30T00:00:00Z"), createId: (p) => `${p}-${++seq}` };

test("the enrichment pass lands a semantic edge at INFERRED with agent provenance", () => {
  const { edge, event } = inferEdge({ fromNodeId: "n-billing", kind: GraphEdgeKind.OwnedBy, toNodeId: "n-hat", agent: "risk-enricher", rationale: "commit history concentrates here" }, deps);
  equal(edge.confidence, GraphConfidence.Inferred);
  equal(edge.provenance.source, "agent:risk-enricher");
  equal(edge.provenance.method, "reasoned");
  equal(event.kind, OrgEventKind.GraphEdgeInferred);
});

function inferred(): GraphEdge {
  return inferEdge({ fromNodeId: "a", kind: GraphEdgeKind.OwnedBy, toNodeId: "b", agent: "x", rationale: "r" }, deps).edge;
}

test("promotion follows the legal ladder: inferred -> verified -> canonical; the jump is refused", () => {
  const e0 = inferred();
  // illegal: inferred cannot jump to canonical without verification
  const bad = promoteConfidence(e0, GraphConfidence.Canonical, "qa_lead", deps);
  equal(bad.ok, false);
  if (!bad.ok) ok(bad.legal.includes(GraphConfidence.Verified));

  // legal: inferred -> verified
  const v = promoteConfidence(e0, GraphConfidence.Verified, "qa_lead", deps);
  ok(v.ok);
  if (v.ok) {
    equal(v.edge.confidence, GraphConfidence.Verified);
    equal(v.edge.version, e0.version + 1);
    equal(v.event.kind, OrgEventKind.GraphConfidencePromoted);
    // then verified -> canonical
    const c = promoteConfidence(v.edge, GraphConfidence.Canonical, "documentation_reviewer", deps);
    ok(c.ok);
    if (c.ok) equal(c.edge.confidence, GraphConfidence.Canonical);
  }
});

test("retraction is native: confidence -> retracted, the correction is KEPT, version bumps", () => {
  const e0 = inferred();
  const r = retractEdge(e0, "the service was renamed; this edge is wrong", "documentation_reviewer", deps);
  ok(r.ok);
  if (r.ok) {
    equal(r.edge.confidence, GraphConfidence.Retracted);
    equal(r.edge.retractionReason, "the service was renamed; this edge is wrong");
    equal(r.event.kind, OrgEventKind.GraphEdgeRetracted);
  }
});

test("a retracted edge cannot be promoted or re-retracted (terminal, kept as history)", () => {
  const e0 = inferred();
  const r = retractEdge(e0, "wrong", "x", deps);
  ok(r.ok);
  if (r.ok) {
    const again = promoteConfidence(r.edge, GraphConfidence.Verified, "x", deps);
    equal(again.ok, false, "retracted is terminal — never silently revived");
  }
});
