import { equal, deepEqual, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  GraphConfidence,
  GraphNodeKind,
  GraphEdgeKind,
  legalConfidencePromotions,
  isLegalConfidencePromotion,
  isActiveConfidence,
  graphNodeId,
  graphEdgeId,
} from "../src/index.ts";

const C = GraphConfidence;

test("confidence promotion ladder: extracted/inferred -> verified -> canonical; anything -> retracted; retracted terminal", () => {
  deepEqual([...legalConfidencePromotions(C.Extracted)].sort(), [C.Retracted, C.Verified].sort());
  deepEqual([...legalConfidencePromotions(C.Inferred)].sort(), [C.Retracted, C.Verified].sort());
  deepEqual([...legalConfidencePromotions(C.Verified)].sort(), [C.Canonical, C.Retracted].sort());
  deepEqual(legalConfidencePromotions(C.Canonical), [C.Retracted]);
  deepEqual(legalConfidencePromotions(C.Retracted), []);
  // an inferred hypothesis cannot jump straight to canonical without being verified
  ok(!isLegalConfidencePromotion(C.Inferred, C.Canonical));
  ok(isLegalConfidencePromotion(C.Inferred, C.Verified));
});

test("retracted edges are excluded from active reads (kept with the correction)", () => {
  for (const c of [C.Extracted, C.Inferred, C.Verified, C.Canonical]) equal(isActiveConfidence(c), true);
  equal(isActiveConfidence(C.Retracted), false);
});

test("node + edge ids are content-addressed (idempotent re-extraction)", () => {
  const a = graphNodeId("org-lfg", GraphNodeKind.Service, "services/billing");
  const b = graphNodeId("org-lfg", GraphNodeKind.Service, "services/billing");
  const c = graphNodeId("org-lfg", GraphNodeKind.Service, "services/auth");
  equal(a, b, "same (org,kind,sourceKey) → same id (one row, updated in place)");
  ok(a !== c);
  ok(a.startsWith("node-"));

  const e1 = graphEdgeId("org-lfg", a, GraphEdgeKind.DependsOn, c);
  const e2 = graphEdgeId("org-lfg", a, GraphEdgeKind.DependsOn, c);
  equal(e1, e2);
  ok(e1.startsWith("edge-"));
  // direction matters: from→to is not the same edge as to→from
  ok(graphEdgeId("org-lfg", c, GraphEdgeKind.DependsOn, a) !== e1);
});
