/**
 * Knowledge graph (G0) — the unified node/edge substrate behind codebase, document, and org
 * intelligence. Every source (deterministic parsers, agent enrichment, the work loop) emits
 * nodes + edges into ONE graph. The discipline: a parser proves structure as high-confidence
 * `extracted` facts with zero model calls; an enrichment pass adds the semantic layer as lower
 * -confidence `inferred` edges that can be human-`verified` then bound `canonical`; anything
 * proven wrong is `retracted` and KEPT with the correction (retraction-native). Every node and
 * edge carries a confidence tier + provenance, so "the parser found this" and "an agent guessed
 * this" are never confused.
 */

import { createHash } from "node:crypto";

// ── confidence tiers (every node + edge carries one) ─────────────────────────

export const GraphConfidence = {
  Extracted: "extracted", // a parser proved it (an import exists, a manifest declares a dep) — high
  Inferred: "inferred", // an agent reasoned it (this service is the payments boundary) — medium
  Verified: "verified", // a hat/human confirmed an inferred node/edge — high
  Canonical: "canonical", // reviewed + bound as a standard (the architecture handbook's claims) — highest
  Retracted: "retracted", // proven wrong; kept with the correction — excluded from default reads
} as const;
export type GraphConfidence = (typeof GraphConfidence)[keyof typeof GraphConfidence];

const C = GraphConfidence;

/** The legal confidence promotions (observe->decide on the graph; retraction always available). */
export function legalConfidencePromotions(from: GraphConfidence): readonly GraphConfidence[] {
  switch (from) {
    case C.Extracted:
      return [C.Verified, C.Retracted]; // a proven fact can be bound/verified or proven wrong
    case C.Inferred:
      return [C.Verified, C.Retracted]; // a hypothesis is confirmed or rejected
    case C.Verified:
      return [C.Canonical, C.Retracted]; // confirmed -> bound as standard, or later retracted
    case C.Canonical:
      return [C.Retracted]; // even a standard can be retracted on drift
    case C.Retracted:
      return []; // terminal — kept with the correction, never silently revived
    default:
      return [];
  }
}

export function isLegalConfidencePromotion(from: GraphConfidence, to: GraphConfidence): boolean {
  return legalConfidencePromotions(from).includes(to);
}

/** Excluded from default graph reads (the correction is kept, but the edge no longer asserts). */
export function isActiveConfidence(c: GraphConfidence): boolean {
  return c !== GraphConfidence.Retracted;
}

// ── node + edge kinds ────────────────────────────────────────────────────────

export const GraphNodeKind = {
  Service: "service",
  Module: "module",
  Repo: "repo",
  Endpoint: "endpoint",
  Datastore: "datastore",
  Environment: "environment",
  TestTarget: "test_target",
  DocUnit: "doc_unit",
  Entity: "entity",
  InboxAnchor: "inbox_anchor",
  Decision: "decision",
  Discussion: "discussion",
  Initiative: "initiative",
  Meeting: "meeting",
  Mission: "mission",
  Organization: "organization",
  Project: "project",
  QualityGate: "quality_gate",
  Release: "release",
  ScheduleBlock: "schedule_block",
  SupervisorSignal: "supervisor_signal",
  Team: "team",
  Trace: "trace",
  WorkItem: "work_item",
  Hat: "hat",
} as const;
export type GraphNodeKind = (typeof GraphNodeKind)[keyof typeof GraphNodeKind];

export const GraphEdgeKind = {
  DependsOn: "depends_on", // extracted: manifest deps + imports
  Calls: "calls", // extracted: static call graph / route refs
  Exposes: "exposes", // extracted: service -> endpoint
  PersistsTo: "persists_to", // extracted: service -> datastore
  DeploysTo: "deploys_to", // extracted: service -> environment
  TestedBy: "tested_by", // extracted: test -> target
  PartOf: "part_of", // extracted: module -> service -> repo
  OwnedBy: "owned_by", // inferred until verified: doc/service -> hat
  About: "about", // doc -> entity/service
  References: "references",
  Supersedes: "supersedes",
  ChangedBy: "changed_by", // node -> ChangeSet (provenance of a change)
} as const;
export type GraphEdgeKind = (typeof GraphEdgeKind)[keyof typeof GraphEdgeKind];

// ── provenance envelope ──────────────────────────────────────────────────────

export type GraphProvenance = {
  source: string; // "manifest:package.json" | "agent:risk-enricher" | "work-loop" | "doc-ingest"
  method: string; // "import-parse" | "reasoned" | "emitted" | "human-verify"
  observedAt: string;
};

// ── content-addressed identity (re-extraction updates in place) ──────────────

function sha(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** A node id is content-addressed on (org, kind, sourceKey), so re-extraction is idempotent. */
export function graphNodeId(organizationId: string, kind: GraphNodeKind, sourceKey: string): string {
  return `node-${sha(`${organizationId}:${kind}:${sourceKey}`).slice(0, 32)}`;
}

/** An edge id is content-addressed on (org, from, kind, to), so the same edge is one row. */
export function graphEdgeId(organizationId: string, fromNodeId: string, kind: GraphEdgeKind, toNodeId: string): string {
  return `edge-${sha(`${organizationId}:${fromNodeId}:${kind}:${toNodeId}`).slice(0, 32)}`;
}

// ── records ──────────────────────────────────────────────────────────────────

export type GraphNode = {
  nodeId: string;
  organizationId: string;
  kind: GraphNodeKind;
  sourceKey: string; // the natural key the id is content-addressed on (e.g. "services/billing")
  label: string;
  confidence: GraphConfidence;
  provenance: GraphProvenance;
  attributes: Readonly<Record<string, string>>;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type GraphEdge = {
  edgeId: string;
  organizationId: string;
  fromNodeId: string;
  toNodeId: string;
  kind: GraphEdgeKind;
  confidence: GraphConfidence;
  provenance: GraphProvenance;
  changeSetId?: string; // when this edge records a change (changed_by), the ChangeSet behind it
  retractionReason?: string; // set when confidence === retracted (the kept correction)
  createdAt: string;
  updatedAt: string;
  version: number;
};
