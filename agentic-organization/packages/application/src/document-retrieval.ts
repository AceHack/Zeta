/**
 * The 8-stage retrieval pipeline (D3) — the smarter-than-RAG core. Naive RAG = embed every
 * chunk -> top-k cosine -> stuff. This pipeline adds back, stage by stage, the structure RAG
 * throws away: SCOPE (don't search the whole corpus), ENTITY ANCHORING (one node, any
 * wording), STRUCTURE (summary-first + drill pointer, not shredded chunks), the GRAPH
 * neighborhood, KPI-WEIGHTED usefulness (not just similarity), CONFLICT/STALENESS handling,
 * and DETERMINISTIC stage/hat-bound consults (retrieval is a guarantee, not a hope).
 *
 * Each stage is a pure function; runRetrieval composes them and reports per-stage
 * diagnostics so the narrowing is observable. Hybrid vector recall + graph traversal are
 * the Hindsight/graph adapters (Stage 3/5 seams); here recall is deterministic lexical +
 * entity-anchor scoring so the pipeline shape is fully testable without a model.
 */

import {
  DocLifecycleState,
  isRetrievalEligible,
  type DocEntity,
  type DocUnit,
} from "../../domain/src/index.ts";
import { canonicalizeByTopic, entityKey, extractEntities } from "./document-entity-resolution.ts";

export type RetrievalScope = { kind: DocUnit["scopeKind"]; id: string };

/** The active context defines the LEGAL document scope (Stage 1's deterministic win). */
export type RetrievalContext = {
  organizationId: string;
  hatId?: string;
  stageId?: string; // workflow stage for deterministic consults alongside hat bindings
  workItemId?: string;
  scopes: readonly RetrievalScope[]; // this dept's + this project's + touched services' scopes
  preferredDocTypes?: readonly DocUnit["type"][] | undefined;
};

export type ScoredUnit = {
  unit: DocUnit;
  score: number;
  reasons: readonly string[];
  entities: readonly DocEntity[];
};

export type RetrievalDiagnostics = {
  corpusSize: number;
  afterScope: number;
  queryEntities: readonly string[];
  afterRecall: number;
  preferredTypeBoosts: number;
  staleDemoted: number;
  conflictsSurfaced: number;
  deterministicConsults: number;
};

export type RetrievalResult = {
  /** the summary-first ranked hits: summary + drill pointer, NOT raw chunks (Stage 4) */
  hits: readonly ScoredUnit[];
  /** stage/hat-bound handbooks ALWAYS injected regardless of the query (Stage 8 guarantee) */
  consulted: readonly DocUnit[];
  /** same-topic active-load-bearing disagreements, surfaced not averaged (Stage 7) */
  conflicts: readonly { a: DocUnit; b: DocUnit }[];
  diagnostics: RetrievalDiagnostics;
};

export type RetrievalDeps = {
  /** KPI signal: per doc unit, the consult-outcome counts from the consult ledger (Stage 6). */
  consultOutcomes?: ReadonlyMap<string, { success: number; failure: number }>;
  /** how many hits to return after multi-resolution packing (Stage 4 budget). */
  topK?: number;
};

// ── Stage 1 — scope pre-filter (deterministic; the biggest win) ──────────────

function inScope(unit: DocUnit, context: RetrievalContext): boolean {
  if (context.scopes.some((s) => s.kind === unit.scopeKind && s.id === unit.scopeId)) return true;
  // a unit bound to the active stage/hat is always in scope (deterministic consult substrate)
  if (context.stageId !== undefined && unit.boundStageIds.includes(context.stageId)) return true;
  if (context.hatId !== undefined && unit.boundHatIds.includes(context.hatId)) return true;
  return false;
}

export function scopePreFilter(corpus: readonly DocUnit[], context: RetrievalContext): readonly DocUnit[] {
  return corpus.filter((u) => u.organizationId === context.organizationId && isRetrievalEligible(u.status) && inScope(u, context));
}

// ── Stage 3 — hybrid recall over the scoped slice (entity-anchored lexical) ──

function lexicalScore(queryTokens: ReadonlySet<string>, unit: DocUnit): number {
  const unitTokens = new Set(entityKey(`${unit.title} ${unit.summary}`).split(" ").filter((t) => t.length > 0));
  if (unitTokens.size === 0 || queryTokens.size === 0) return 0;
  let overlap = 0;
  for (const t of queryTokens) if (unitTokens.has(t)) overlap += 1;
  return overlap / queryTokens.size; // fraction of query tokens matched
}

function preferredDocTypeScore(preferredDocTypes: ReadonlySet<DocUnit["type"]>, unit: DocUnit): number {
  return preferredDocTypes.has(unit.type) ? 0.2 : 0;
}

// ── the orchestrator ─────────────────────────────────────────────────────────

export function runRetrieval(
  query: string,
  context: RetrievalContext,
  corpus: readonly DocUnit[],
  entities: readonly DocEntity[],
  deps: RetrievalDeps = {},
): RetrievalResult {
  const topK = deps.topK ?? 5;
  const outcomes = deps.consultOutcomes ?? new Map<string, { success: number; failure: number }>();

  // Stage 1 — scope pre-filter
  const scoped = scopePreFilter(corpus, context);

  // Stage 2 — entity resolution (graph-anchored)
  const queryEntities = extractEntities(query, entities);
  const queryEntityIds = new Set(queryEntities.map((e) => e.docEntityId));

  // Stage 3 — hybrid recall over the scoped slice + entity-anchor boost
  const queryTokens = new Set(entityKey(query).split(" ").filter((t) => t.length > 0));
  const preferredDocTypes = new Set(context.preferredDocTypes ?? []);
  let preferredTypeBoosts = 0;
  let scored: ScoredUnit[] = scoped
    .map((unit) => {
      const reasons: string[] = [];
      let score = lexicalScore(queryTokens, unit);
      if (score > 0) reasons.push(`lexical:${score.toFixed(2)}`);
      // entity anchoring: a unit mentioning a resolved query entity is boosted (any wording)
      const unitEntities = extractEntities(`${unit.title} ${unit.summary}`, entities);
      if (unitEntities.some((e) => queryEntityIds.has(e.docEntityId))) {
        score += 0.5;
        reasons.push("entity-anchored");
      }
      const typeScore = preferredDocTypeScore(preferredDocTypes, unit);
      if (typeScore > 0) {
        preferredTypeBoosts += 1;
        score += typeScore;
        reasons.push(`preferred-doc-type:${unit.type}`);
      }
      return { unit, score, reasons, entities: unitEntities };
    })
    .filter((s) => s.score > 0);

  // Stage 5 — graph augmentation seam (stub until G): entities already attached are the
  // anchor for traversal; the neighborhood join lands in the Knowledge Graph track.

  // Stage 6 — KPI-weighted rerank (usefulness, not just similarity)
  scored = scored.map((s) => {
    const o = outcomes.get(s.unit.docUnitId);
    if (o !== undefined && o.success + o.failure > 0) {
      const utility = (o.success - o.failure) / (o.success + o.failure);
      return { ...s, score: s.score + 0.4 * utility, reasons: [...s.reasons, `kpi:${utility.toFixed(2)}`] };
    }
    return s;
  });

  // Stage 7 — conflict + staleness handling
  let staleDemoted = 0;
  scored = scored.map((s) => {
    if (s.unit.status === DocLifecycleState.Stale) {
      staleDemoted += 1;
      return { ...s, score: s.score * 0.25, reasons: [...s.reasons, "stale-demoted"] };
    }
    return s;
  });
  const conflicts = canonicalizeByTopic(scoped).flatMap((g) => g.conflicts);

  // Stage 4 — multi-resolution: rank, then pack the top-K summary-first hits (drill via ref)
  scored.sort((a, b) => b.score - a.score || a.unit.docUnitId.localeCompare(b.unit.docUnitId));
  const hits = scored.slice(0, topK);

  // Stage 8 — deterministic consultation: stage/hat-bound handbooks ALWAYS inject
  const consulted = corpus.filter((u) =>
    u.organizationId === context.organizationId &&
    isRetrievalEligible(u.status) &&
    (
      (context.stageId !== undefined && u.boundStageIds.includes(context.stageId)) ||
      (context.hatId !== undefined && u.boundHatIds.includes(context.hatId))
    )
  );

  return {
    hits,
    consulted,
    conflicts,
    diagnostics: {
      corpusSize: corpus.length,
      afterScope: scoped.length,
      queryEntities: queryEntities.map((e) => e.docEntityId),
      afterRecall: scored.length,
      preferredTypeBoosts,
      staleDemoted,
      conflictsSurfaced: conflicts.length,
      deterministicConsults: consulted.length,
    },
  };
}
