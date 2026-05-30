/**
 * Document Intelligence (D0) — the document ontology + lifecycle as a House-DU, the
 * same shape as the memory / work / change-control lifecycles. A document is NOT a flat
 * chunk: it is a typed, scoped, bindable structural unit with a lifecycle, provenance
 * (the ChangeSet that introduced it), and a graph neighborhood. This module declares the
 * ontology axes, the lifecycle DU + legal transitions, and the record shapes the
 * Cockroach DocumentIntelligence tables persist. Behavior (ingestion, retrieval,
 * maintenance) rides on top in D1–D5.
 *
 * Lifecycle (design Part G):
 *   draft ─▶ in_review ─▶ active ─▶ stale ─▶ superseded (terminal-ish, re-review ↺ active)
 *                            │         ╲▶ archived (terminal)
 * Light-weight docs skip in_review (draft → active); load-bearing docs (handbook /
 * policy / architecture / adr) require the human-gated review before becoming canonical.
 */

// ── ontology axes (Part A) ───────────────────────────────────────────────────

/** WHAT a document is — drives which stage consults it + how it is treated. */
export const DocType = {
  Handbook: "handbook",
  Policy: "policy",
  Architecture: "architecture",
  Adr: "adr",
  Runbook: "runbook",
  Brd: "brd",
  Spec: "spec",
  Reference: "reference",
  MeetingNote: "meeting_note",
  DecisionRecord: "decision_record",
} as const;
export type DocType = (typeof DocType)[keyof typeof DocType];

/** WHERE a document applies — the scope axis used by the retrieval scope pre-filter. */
export const DocScopeKind = {
  Organization: "organization",
  Department: "department",
  Project: "project",
  Service: "service",
  Team: "team",
} as const;
export type DocScopeKind = (typeof DocScopeKind)[keyof typeof DocScopeKind];

/** Load-bearing docs require human-gated review before becoming canonical. */
export function isLoadBearing(type: DocType): boolean {
  return type === DocType.Handbook || type === DocType.Policy || type === DocType.Architecture || type === DocType.Adr;
}

// ── lifecycle DU (Part G) ────────────────────────────────────────────────────

export const DocLifecycleState = {
  Draft: "draft",
  InReview: "in_review",
  Active: "active",
  Stale: "stale",
  Superseded: "superseded",
  Archived: "archived",
} as const;
export type DocLifecycleState = (typeof DocLifecycleState)[keyof typeof DocLifecycleState];

const L = DocLifecycleState;

/**
 * The legal next states from a given lifecycle state. `isLoadBearing` gates the
 * draft transition: load-bearing docs must pass in_review; light-weight docs may go
 * straight to active (the autonomy dial). Every transition is observe→decide: this
 * computes the LEGAL set; an owner (hat / human / system) picks within it.
 */
export function legalDocTransitions(from: DocLifecycleState, loadBearing: boolean): readonly DocLifecycleState[] {
  switch (from) {
    case L.Draft:
      return loadBearing ? [L.InReview, L.Archived] : [L.Active, L.InReview, L.Archived];
    case L.InReview:
      return [L.Active, L.Draft, L.Archived]; // approved → active; bounced → draft
    case L.Active:
      return [L.Stale, L.Superseded, L.Archived];
    case L.Stale:
      return [L.Active, L.Superseded, L.Archived]; // re-review revives, or it is replaced/retired
    case L.Superseded:
      return [L.Archived]; // terminal-ish: kept for history, only archivable
    case L.Archived:
      return []; // terminal
    default:
      return [];
  }
}

export function isLegalDocTransition(from: DocLifecycleState, to: DocLifecycleState, loadBearing: boolean): boolean {
  return legalDocTransitions(from, loadBearing).includes(to);
}

/** Retrieval-eligible states: only `active` surfaces in default load-bearing retrieval. */
export function isRetrievalEligible(state: DocLifecycleState): boolean {
  return state === DocLifecycleState.Active;
}

// ── graph relations (Part B) ─────────────────────────────────────────────────

export const DocGraphRelation = {
  OwnedBy: "owned_by", // doc/service → hat
  ConsultedAt: "consulted_at", // handbook → workflow stage
  Supersedes: "supersedes", // newer canonical → older
  References: "references", // doc → doc/entity
  Governs: "governs", // policy → scope
} as const;
export type DocGraphRelation = (typeof DocGraphRelation)[keyof typeof DocGraphRelation];

// ── record shapes (persisted by the Cockroach DocumentIntelligence tables) ───

/** A connector-backed source of documents (a wiki, a repo, a Confluence space). */
export type DocSource = {
  docSourceId: string;
  organizationId: string;
  connectorKind: string; // "filesystem" | "github" | "confluence" | …
  label: string;
  syncCursor?: string; // per-source incremental cursor
  createdAt: string;
  updatedAt: string;
};

/** A structural semantic unit (section / procedure / decision) — NOT a fixed chunk. */
export type DocUnit = {
  docUnitId: string;
  organizationId: string;
  sourceId: string;
  type: DocType;
  scopeKind: DocScopeKind;
  scopeId: string; // the department/project/service/team id (or org id) it applies to
  title: string;
  summary: string; // the summary-first retrieval surface (Stage 4)
  contentRef: string; // pointer to the content (git path / Hindsight memory id) — content is NOT stored inline
  contentHash: string; // content-addressed: only changed units re-ingest
  status: DocLifecycleState;
  freshnessAt: string; // last verified-fresh moment
  boundHatIds: readonly string[]; // hats that always consult this unit
  boundStageIds: readonly string[]; // workflow stages bound to this unit (deterministic consult)
  supersedesId?: string; // the unit this canonical replaced
  provenanceChangeSetId?: string; // the ChangeSet that introduced this doc (provenance)
  createdAt: string;
  updatedAt: string;
  version: number;
};

/** A canonical entity (service, team, person, concept) referenced by doc units. */
export type DocEntity = {
  docEntityId: string;
  organizationId: string;
  canonicalName: string;
  kind: string; // "service" | "team" | "person" | "concept" | …
  aliases: readonly string[];
  createdAt: string;
  updatedAt: string;
};

/** A typed edge in the document/entity knowledge graph. */
export type DocGraphEdge = {
  docGraphEdgeId: string;
  organizationId: string;
  fromId: string;
  toId: string;
  relation: DocGraphRelation;
  createdAt: string;
};

/** The consult/outcome join — which unit was consulted at which stage/work (utility). */
export type DocConsultLedgerEntry = {
  docConsultId: string;
  organizationId: string;
  docUnitId: string;
  stageId: string;
  workItemId: string;
  consultedAt: string;
  outcome?: string; // joined later from the work outcome (the usefulness signal)
};
