/**
 * Recall → re-rank composition (MEM7, §13.3) — the seam between the recall engine
 * (Hindsight: semantic + BM25 + graph + temporal fusion) and our governance layer
 * (KPI-weighted weight + decay + archive floor). Hindsight returns ordered
 * candidates; we join each to our Cockroach MemoryState and RE-RANK by the §4
 * weight, drop anything below its tier's read floor, and pack into the budget.
 *
 * Decoupled from Hindsight by a generic RecalledCandidate, so the in-process fake
 * and the Cockroach-only degraded path compose the same way.
 */

import type { MemoryEnvelope } from "../../domain/src/index.ts";
import { computeMemoryWeight, readFloorFor, type RetrievalCtx } from "./memory-ranking.ts";
import type { HydratedMemory } from "./memory-injection.ts";

/** A candidate from the recall engine: our join id, the content text, an optional semantic score. */
export type RecalledCandidate = {
  memoryId: string;
  value: string;
  semanticScore?: number; // 0..1; if absent we use the engine's rank position (caller derives)
};

/**
 * Re-rank recall candidates by our §4 weight (each candidate carries its OWN
 * semantic score), drop below-read-floor, sort weight-desc (stable, id tiebreak),
 * pack to budget, and hydrate the text. Candidates with no MemoryState envelope
 * (recalled content with no governance row yet) are skipped — they cannot be
 * weighted, so they cannot be surfaced.
 */
export function rerankRecalled(
  candidates: readonly RecalledCandidate[],
  envelopesById: ReadonlyMap<string, MemoryEnvelope>,
  ctx: RetrievalCtx,
  budget: { maxCount: number },
): readonly HydratedMemory[] {
  const hydrated: HydratedMemory[] = [];
  for (const cand of candidates) {
    const env = envelopesById.get(cand.memoryId);
    if (env === undefined) continue;
    const perCandidateCtx: RetrievalCtx = { ...ctx, semanticScore: cand.semanticScore ?? 0.5 };
    const weight = computeMemoryWeight(env, perCandidateCtx);
    if (weight < readFloorFor(env.tier)) continue;
    hydrated.push({
      envelope: env,
      weight,
      freshness: 0, // components not needed for the block; weight is the rank key
      outcome: 0,
      utility: 0,
      semantic: cand.semanticScore ?? 0.5,
      value: cand.value,
    });
  }
  hydrated.sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    return a.envelope.memoryId < b.envelope.memoryId ? -1 : 1;
  });
  return hydrated.slice(0, Math.max(0, budget.maxCount));
}

/** Derive a positional semantic score from an ordered recall list (no numeric score). */
export function positionalSemanticScore(rank: number, count: number): number {
  if (count <= 1) return 1;
  return 1 - rank / count;
}
