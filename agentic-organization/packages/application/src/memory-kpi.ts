/**
 * KPI / outcome correlation (MEM5) — wired to the org's own trace, not a separate
 * outcome system. When a work item finalizes, every memory that was in scope during
 * it gets its outcome bumped, deduped on workItemId (a memory injected 20× during
 * one work item counts once), and its confidence recomputed from the success/failure
 * ratio. Reinforcement auto-applies; demotion routes to a hat (§7) — that asymmetry
 * is handled by the maintenance cycle (MEM6), not here.
 *
 *   workItemVerdict(...)        — merged → success; rejected/recovery/stall → failure
 *   bumpOutcome(prev, verdict)  — workItem-deduped outcome $inc
 *   recomputeConfidence(state)  — Laplace (success+1)/(total+2), clamped
 *   planOutcomeCorrelation(...) — pure: which memories update, to what
 */

import {
  MemoryPhase,
  type MemoryEnvelope,
  type MemoryInjectionRecord,
  type MemoryOutcomeCorrelation,
} from "../../domain/src/index.ts";
import { clamp01 } from "./memory-ranking.ts";

export const OutcomeVerdict = {
  Success: "success",
  Failure: "failure",
  Inconclusive: "inconclusive",
} as const;
export type OutcomeVerdict = (typeof OutcomeVerdict)[keyof typeof OutcomeVerdict];

const MAX_OBSERVED_WORK_ITEMS = 200; // FIFO cap — keep the observed set bounded

/** merged (all gates passed) → success; gate-rejected / recovery / stall → failure. */
export function workItemVerdict(reachedMerged: boolean, tookRecoveryPath: boolean): OutcomeVerdict {
  if (reachedMerged) return OutcomeVerdict.Success;
  if (tookRecoveryPath) return OutcomeVerdict.Failure;
  return OutcomeVerdict.Inconclusive;
}

/**
 * Bump the outcome counters for one work-item verdict, deduped on workItemId: if
 * this work item already contributed, the outcome is unchanged (no double count).
 */
export function bumpOutcome(
  prev: MemoryOutcomeCorrelation,
  verdict: OutcomeVerdict,
  workItemId: string,
  at: string,
): MemoryOutcomeCorrelation {
  if (prev.workItemsObserved.includes(workItemId)) return prev;
  const observed = [...prev.workItemsObserved, workItemId].slice(-MAX_OBSERVED_WORK_ITEMS);
  return {
    successCount: prev.successCount + (verdict === OutcomeVerdict.Success ? 1 : 0),
    failureCount: prev.failureCount + (verdict === OutcomeVerdict.Failure ? 1 : 0),
    inconclusiveCount: prev.inconclusiveCount + (verdict === OutcomeVerdict.Inconclusive ? 1 : 0),
    lastOutcomeAt: at,
    workItemsObserved: observed,
  };
}

/**
 * Recompute confidence from the success/failure ratio — Laplace-smoothed
 * (success+1)/(success+failure+2): 0.5 at zero evidence, converging to the true
 * ratio as KPI accumulates. Inconclusive outcomes don't move confidence.
 */
export function recomputeConfidence(outcome: MemoryOutcomeCorrelation): number {
  const total = outcome.successCount + outcome.failureCount;
  return clamp01((outcome.successCount + 1) / (total + 2));
}

export type OutcomeCorrelationUpdate = {
  memoryId: string;
  nextOutcome: MemoryOutcomeCorrelation;
  nextConfidence: number;
  verdict: OutcomeVerdict;
};

/**
 * Pure correlation planner: given the injection ledger for a finalized work item
 * and the current envelopes of the injected memories, produce the per-memory
 * outcome + confidence updates. Archived memories are skipped (they no longer
 * participate). One update per distinct injected memory.
 */
export function planOutcomeCorrelation(
  injections: readonly MemoryInjectionRecord[],
  envelopesById: ReadonlyMap<string, MemoryEnvelope>,
  verdict: OutcomeVerdict,
  workItemId: string,
  at: string,
): readonly OutcomeCorrelationUpdate[] {
  const seen = new Set<string>();
  const updates: OutcomeCorrelationUpdate[] = [];
  for (const inj of injections) {
    if (seen.has(inj.memoryId)) continue;
    seen.add(inj.memoryId);
    const env = envelopesById.get(inj.memoryId);
    if (env === undefined || env.state.phase === MemoryPhase.Archived) continue;
    const nextOutcome = bumpOutcome(env.state.outcome, verdict, workItemId, at);
    if (nextOutcome === env.state.outcome) continue; // already counted this work item
    updates.push({
      memoryId: inj.memoryId,
      nextOutcome,
      nextConfidence: recomputeConfidence(nextOutcome),
      verdict,
    });
  }
  return updates;
}
