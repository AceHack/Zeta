/**
 * Agent enrichment + confidence lifecycle (G2) — the SEMANTIC pass, kept strictly separate
 * from the deterministic machine pass (G1). An agent reasons new edges (ownership, risk,
 * architectural role) and lands them at `inferred`; a hat/human can `verify` them; the doc
 * gate can bind them `canonical`; and anything proven wrong is `retracted` and KEPT with the
 * correction (retraction-native — the edge stays as history, excluded from active reads).
 *
 * promoteConfidence is observe→decide: it computes the LEGAL next confidences and refuses an
 * illegal jump (an inferred hypothesis cannot become canonical without being verified first).
 */

import {
  GraphConfidence,
  OrgEventKind,
  graphEdgeId,
  isLegalConfidencePromotion,
  legalConfidencePromotions,
  type GraphEdge,
  type GraphEdgeKind,
  type GraphProvenance,
  type OrgEvent,
} from "../../domain/src/index.ts";

export type EnrichDeps = {
  organizationId: string;
  now: () => number;
  createId: (prefix: string) => string;
};

function edgeEvent(deps: EnrichDeps, kind: OrgEventKind, edge: GraphEdge, from: GraphConfidence, to: GraphConfidence, by: string, decision: string): OrgEvent {
  return {
    id: deps.createId("evt"), kind, occurredAt: new Date(deps.now()).toISOString(),
    organizationId: deps.organizationId, actorHatId: by, subjectId: edge.edgeId, fromState: from, toState: to, decision,
    supervisorChain: [], evidenceRefs: [`${edge.provenance.source}#${edge.provenance.method}`],
    correlationId: edge.edgeId, causationId: edge.edgeId, traceId: edge.edgeId,
  };
}

/**
 * Infer a new semantic edge (the enrichment pass). Lands at `inferred` with agent provenance —
 * a hypothesis the org can act on but should confirm. Content-addressed, so re-inference is
 * idempotent. Optionally records the ChangeSet that motivated it.
 */
export function inferEdge(
  args: { fromNodeId: string; kind: GraphEdgeKind; toNodeId: string; agent: string; rationale: string; changeSetId?: string },
  deps: EnrichDeps,
): { edge: GraphEdge; event: OrgEvent } {
  const nowIso = new Date(deps.now()).toISOString();
  const provenance: GraphProvenance = { source: `agent:${args.agent}`, method: "reasoned", observedAt: nowIso };
  const edge: GraphEdge = {
    edgeId: graphEdgeId(deps.organizationId, args.fromNodeId, args.kind, args.toNodeId),
    organizationId: deps.organizationId, fromNodeId: args.fromNodeId, toNodeId: args.toNodeId, kind: args.kind,
    confidence: GraphConfidence.Inferred, provenance,
    ...(args.changeSetId !== undefined ? { changeSetId: args.changeSetId } : {}),
    createdAt: nowIso, updatedAt: nowIso, version: 1,
  };
  const event: OrgEvent = {
    id: deps.createId("evt"), kind: OrgEventKind.GraphEdgeInferred, occurredAt: nowIso,
    organizationId: deps.organizationId, actorHatId: args.agent, subjectId: edge.edgeId, toState: GraphConfidence.Inferred,
    decision: `inferred ${args.kind}: ${args.rationale}`, supervisorChain: [], evidenceRefs: [`agent:${args.agent}`],
    correlationId: edge.edgeId, causationId: edge.edgeId, traceId: edge.edgeId,
  };
  return { edge, event };
}

export type PromoteResult =
  | { ok: true; edge: GraphEdge; event: OrgEvent }
  | { ok: false; reason: string; legal: readonly GraphConfidence[] };

/**
 * Promote an edge's confidence within the LEGAL ladder (observe→decide). Refuses an illegal
 * jump (e.g. inferred → canonical) and reports the legal options. `by` is the verifying hat/human.
 */
export function promoteConfidence(edge: GraphEdge, to: GraphConfidence, by: string, deps: EnrichDeps): PromoteResult {
  if (!isLegalConfidencePromotion(edge.confidence, to)) {
    return { ok: false, reason: `illegal promotion ${edge.confidence} → ${to}`, legal: legalConfidencePromotions(edge.confidence) };
  }
  const from = edge.confidence;
  const next: GraphEdge = { ...edge, confidence: to, updatedAt: new Date(deps.now()).toISOString(), version: edge.version + 1 };
  const kind = to === GraphConfidence.Retracted ? OrgEventKind.GraphEdgeRetracted : OrgEventKind.GraphConfidencePromoted;
  return { ok: true, edge: next, event: edgeEvent(deps, kind, next, from, to, by, `confidence ${from} → ${to} by ${by}`) };
}

/**
 * Retract an edge: confidence → retracted + the correction is recorded (retraction-native). The
 * edge is KEPT (history + audit) but excluded from active reads. Legal from any active confidence.
 */
export function retractEdge(edge: GraphEdge, reason: string, by: string, deps: EnrichDeps): PromoteResult {
  if (!isLegalConfidencePromotion(edge.confidence, GraphConfidence.Retracted)) {
    return { ok: false, reason: `cannot retract from ${edge.confidence}`, legal: legalConfidencePromotions(edge.confidence) };
  }
  const from = edge.confidence;
  const next: GraphEdge = { ...edge, confidence: GraphConfidence.Retracted, retractionReason: reason, updatedAt: new Date(deps.now()).toISOString(), version: edge.version + 1 };
  return { ok: true, edge: next, event: edgeEvent(deps, OrgEventKind.GraphEdgeRetracted, next, from, GraphConfidence.Retracted, by, `retracted: ${reason}`) };
}
