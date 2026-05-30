/**
 * Memory ranking + retrieval (MEM3) — the deterministic core of "how likely a
 * memory is to surface; zero means never again". Pure functions over the Cockroach
 * envelope:
 *
 *   computeMemoryWeight(env, ctx)  — the composite weight (semantic × freshness ×
 *                                    confidence × KPI-outcome × utility + scope boosts)
 *   computeFreshness / outcomeRatio / utilityRatio — the components
 *   isBelowArchiveFloor / isAboveReadFloor — the per-tier floors
 *   retrieveRanked(envelopes, ctx, budget) — the candidate set, weight-ranked,
 *                                    floor-filtered, greedily packed to a count budget
 *
 * The scope-union (hat ⊕ agent ⊕ work ⊕ department ⊕ org) is selected by the store
 * (listByScopes); this module ranks what comes back. The agent never widens the set
 * — it only chooses which surfaced memories to rely on and cite.
 */

import { MemoryTier, type MemoryEnvelope } from "../../domain/src/index.ts";

export type RetrievalCtx = {
  now: number; // ms epoch
  organizationId: string;
  hatId: string;
  agentId: string;
  workItemId: string;
  departmentId?: string;
  /** optional semantic similarity (e.g. Hindsight/Ollama cosine); 0.5 if absent */
  semanticScore?: number;
};

export type RankedMemory = {
  envelope: MemoryEnvelope;
  weight: number;
  freshness: number;
  outcome: number;
  utility: number;
  semantic: number;
};

export type RetrievalBudget = {
  maxCount: number; // top-N packed into the prompt
};

// Per-tier half-lives (days) — freshness reaches 0 at 2× half-life.
const HALF_LIFE_DAYS: Record<MemoryTier, number> = {
  [MemoryTier.Work]: 30,
  [MemoryTier.Hat]: 120,
  [MemoryTier.Agent]: 120,
  [MemoryTier.Department]: 180,
  [MemoryTier.Org]: 365,
};

// Below the read floor a memory is not surfaced; below the archive floor it is
// moved to phase Archived and never surfaces again (weight → 0 forever).
const READ_FLOOR: Record<MemoryTier, number> = {
  [MemoryTier.Work]: 0.35,
  [MemoryTier.Hat]: 0.3,
  [MemoryTier.Agent]: 0.3,
  [MemoryTier.Department]: 0.3,
  [MemoryTier.Org]: 0.25,
};

const ARCHIVE_FLOOR: Record<MemoryTier, number> = {
  [MemoryTier.Work]: 0.15,
  [MemoryTier.Hat]: 0.15,
  [MemoryTier.Agent]: 0.15,
  [MemoryTier.Department]: 0.15,
  [MemoryTier.Org]: 0.1,
};

const DAY_MS = 86_400_000;

export function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export function computeFreshness(env: MemoryEnvelope, now: number): number {
  const halfLifeDays = HALF_LIFE_DAYS[env.tier];
  const elapsedDays = (now - Date.parse(env.state.freshnessAt)) / DAY_MS;
  return Math.max(0, 1 - elapsedDays / (2 * halfLifeDays));
}

/** success/(success+failure) — neutral 0.5 until ≥3 outcome samples. */
export function outcomeRatio(env: MemoryEnvelope): number {
  const o = env.state.outcome;
  const total = o.successCount + o.failureCount;
  return total < 3 ? 0.5 : o.successCount / total;
}

/** cited/injected — neutral 0.5 until ≥5 injections; injected-never-cited → 0. */
export function utilityRatio(env: MemoryEnvelope): number {
  const u = env.state.utility;
  return u.injectedCount < 5 ? 0.5 : Math.min(1, u.citedCount / u.injectedCount);
}

export function computeMemoryWeight(env: MemoryEnvelope, ctx: RetrievalCtx): number {
  const freshness = computeFreshness(env, ctx.now);
  const confidence = clamp01(env.state.confidence);
  const outcome = outcomeRatio(env);
  const utility = utilityRatio(env);
  const semantic = ctx.semanticScore ?? 0.5;

  const base =
    0.3 * semantic + 0.2 * freshness + 0.15 * confidence + 0.2 * outcome + 0.15 * utility;

  // additive scope boosts (capped) — the directly-bound role/actor/work get a nudge.
  const hatScope = env.tier === MemoryTier.Hat && env.scope === ctx.hatId ? 0.05 : 0;
  const personalScope = env.tier === MemoryTier.Agent && env.scope === ctx.agentId ? 0.05 : 0;
  const workLocal = env.tier === MemoryTier.Work && env.scope === ctx.workItemId ? 0.05 : 0;

  return clamp01(base + hatScope + personalScope + workLocal);
}

/**
 * The "resting" weight — the nightly recompute with no active binding. Semantic
 * similarity is query-relative, so with no query it contributes 0 (not the
 * retrieval-time don't-penalize default of 0.5): this weight measures a memory's
 * INTRINSIC value (freshness × confidence × KPI × utility). The maintenance cycle
 * (MEM6) caches it on the state row and compares it to the archive floor, so a
 * genuinely-decayed memory falls to zero and is retired forever.
 */
export function computeRestingWeight(env: MemoryEnvelope, now: number): number {
  const freshness = computeFreshness(env, now);
  const confidence = clamp01(env.state.confidence);
  const outcome = outcomeRatio(env);
  const utility = utilityRatio(env);
  return clamp01(0.2 * freshness + 0.15 * confidence + 0.2 * outcome + 0.15 * utility);
}

export function archiveFloorFor(tier: MemoryTier): number {
  return ARCHIVE_FLOOR[tier];
}

export function readFloorFor(tier: MemoryTier): number {
  return READ_FLOOR[tier];
}

export function isBelowArchiveFloor(env: MemoryEnvelope, ctx: RetrievalCtx): boolean {
  return computeMemoryWeight(env, ctx) < ARCHIVE_FLOOR[env.tier];
}

export function isAboveReadFloor(env: MemoryEnvelope, ctx: RetrievalCtx): boolean {
  return computeMemoryWeight(env, ctx) >= READ_FLOOR[env.tier];
}

/** The scope-union set (org ⊕ department ⊕ hat ⊕ agent ⊕ work) to query. */
export function scopeUnionFor(ctx: RetrievalCtx): readonly string[] {
  const scopes = [ctx.organizationId, ctx.hatId, ctx.agentId, ctx.workItemId];
  if (ctx.departmentId !== undefined) scopes.push(ctx.departmentId);
  return [...new Set(scopes)];
}

function toRanked(env: MemoryEnvelope, ctx: RetrievalCtx): RankedMemory {
  return {
    envelope: env,
    weight: computeMemoryWeight(env, ctx),
    freshness: computeFreshness(env, ctx.now),
    outcome: outcomeRatio(env),
    utility: utilityRatio(env),
    semantic: ctx.semanticScore ?? 0.5,
  };
}

/**
 * The deterministic retrieval: rank the candidate envelopes by weight, drop any
 * below their tier's read floor, sort weight-desc (stable, memoryId tiebreak for
 * determinism), and greedily pack the top-N into the count budget.
 */
export function retrieveRanked(
  envelopes: readonly MemoryEnvelope[],
  ctx: RetrievalCtx,
  budget: RetrievalBudget,
): readonly RankedMemory[] {
  const ranked = envelopes
    .map((env) => toRanked(env, ctx))
    .filter((r) => r.weight >= READ_FLOOR[r.envelope.tier])
    .sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight;
      return a.envelope.memoryId < b.envelope.memoryId ? -1 : 1;
    });
  return ranked.slice(0, Math.max(0, budget.maxCount));
}
