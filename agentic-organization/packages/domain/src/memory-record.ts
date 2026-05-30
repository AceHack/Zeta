/**
 * Memory domain (DYNAMIC_MEMORY_SYSTEM_DESIGN). A logical memory is split into
 * CONTENT (written rarely; embedded for recall by Hindsight) and STATE (updated
 * continuously; drives the retrieval weight). They join by a content-addressed
 * `memoryId`. Memory is scoped to where in the org it belongs — the tier ladder
 * org → department → hat → agent → work — and retrieval pulls the UNION for a
 * binding (an agent wearing a hat on a work item), ranked by weight.
 *
 * This is pure domain. The recall engine (Hindsight) + the ranking/decay/KPI
 * logic live in the application layer.
 */

/** Where a memory belongs — the scope ladder (mirrors the org hierarchy + work). */
export const MemoryTier = {
  Org: "org",
  Department: "department",
  Hat: "hat",
  Agent: "agent",
  Work: "work",
} as const;
export type MemoryTier = (typeof MemoryTier)[keyof typeof MemoryTier];

/** Lifecycle phase (House-DU, mirrors HatBinding). Archived is terminal. */
export const MemoryPhase = {
  Draft: "draft",
  Active: "active",
  Reinforced: "reinforced",
  Stale: "stale",
  Demoted: "demoted",
  Promoted: "promoted",
  Conflicted: "conflicted",
  Archived: "archived",
} as const;
export type MemoryPhase = (typeof MemoryPhase)[keyof typeof MemoryPhase];

export const TerminalMemoryPhases: ReadonlySet<MemoryPhase> = new Set([MemoryPhase.Archived]);

export function isTerminalMemory(phase: MemoryPhase): boolean {
  return TerminalMemoryPhases.has(phase);
}

/** CONTENT — the memory text + addressing. Written rarely; the recall hub. */
export type MemoryRecord = {
  memoryId: string; // uuid v5 from org:tier:scope:key — stable join + idempotency key
  organizationId: string;
  tier: MemoryTier;
  scope: string; // org-lfg | DepartmentId | hatId | agentId | workItemId
  key: string; // stable slug, e.g. "review:require-rollback-plan"
  value: string;
  contextHint?: string;
  protected: boolean; // cannot be auto-overwritten / auto-demoted
  writtenBy: string; // hatId | agentId | "system" | "human"
  writtenAt: string;
};

export type MemoryOutcomeCorrelation = {
  successCount: number;
  failureCount: number;
  inconclusiveCount: number;
  lastOutcomeAt?: string;
  workItemsObserved: readonly string[]; // FIFO-capped, dedup
};

export type MemoryUtilityCorrelation = {
  injectedCount: number;
  citedCount: number;
  lastInjectedAt?: string;
};

export type MemoryCrossScopeObservations = {
  distinctScopes: readonly string[]; // promotion signal (work→hat, hat→department)
  firstObservedAt: string;
  lastObservedAt: string;
};

/** STATE — the mutable weight signals. Updated continuously; never embedded. */
export type MemoryState = {
  memoryId: string;
  organizationId: string;
  phase: MemoryPhase;
  confidence: number; // 0..1
  freshnessAt: string; // last confirmed; freshness decays from here
  weight: number; // 0..1 — last computed retrieval weight (cached)
  reinforcementCount: number;
  outcome: MemoryOutcomeCorrelation;
  utility: MemoryUtilityCorrelation;
  crossScope: MemoryCrossScopeObservations;
  archivedAt?: string;
};

/**
 * The Cockroach projection of a memory — its immutable addressing plus its
 * mutable STATE, WITHOUT the embedded text (the text lives in Hindsight and is
 * hydrated only when the memory actually surfaces). Ranking + retrieval operate
 * entirely on envelopes; no Hindsight round-trip per candidate.
 */
export type MemoryEnvelope = {
  memoryId: string;
  organizationId: string;
  tier: MemoryTier;
  scope: string;
  key: string;
  contextHint?: string;
  protected: boolean;
  writtenBy: string;
  writtenAt: string;
  state: MemoryState;
};

/** One injection-ledger row — which memory was injected into which turn/work. */
export type MemoryInjectionRecord = {
  injectionId: string;
  organizationId: string;
  memoryId: string;
  workItemId: string;
  hatId: string;
  agentId: string;
  promptFlowRunId: string;
  weightAtInjection: number;
  cited: boolean;
  injectedAt: string;
};
