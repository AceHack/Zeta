/**
 * runMemoryMaintenanceCycle (MEM6) — the Memory & Knowledge department's daily
 * cycle, structured exactly like the org cycle: determinism computes the legal
 * action set per memory; the appropriate hat chooses within it; every action is
 * one org_event. Pure: returns the state updates + the events; the runtime
 * persists + appends them.
 *
 * Asymmetry (the safety property): GOOD NEWS AUTO-APPLIES, BAD NEWS ASKS A HAT.
 *   Stage A (automatic, reversible): decay/weight recompute, archive-at-zero,
 *     confidence reinforcement when it rose.
 *   Stage B (hat-decided, clamped to the legal set): demotion, promotion, conflict.
 *   protected memories are excluded from auto-overwrite/auto-demote/decay.
 */

import {
  MemoryPhase,
  MemoryTier,
  OrgEventKind,
  isLegalMemoryTransition,
  type MemoryEnvelope,
  type OrgEvent,
} from "../../domain/src/index.ts";
import { chooseWithinLegal, firstLegalChooser, type OrgChooser } from "./org-decision.ts";
import { computeRestingWeight, archiveFloorFor } from "./memory-ranking.ts";
import { recomputeConfidence } from "./memory-kpi.ts";

export const MemoryDemotionChoice = {
  Keep: "keep",
  Demote: "demote",
  RequestEvidence: "request-evidence",
} as const;
export type MemoryDemotionChoice = (typeof MemoryDemotionChoice)[keyof typeof MemoryDemotionChoice];

export const MemoryConflictChoice = {
  KeepThis: "keep-this",
  DemoteThis: "demote-this",
  ArchiveThis: "archive-this",
} as const;
export type MemoryConflictChoice = (typeof MemoryConflictChoice)[keyof typeof MemoryConflictChoice];

export type PromotionTarget = { toTier: MemoryTier; toScope: string };

export type MemoryStateUpdate = {
  memoryId: string;
  nextPhase: MemoryPhase;
  nextWeight: number;
  nextConfidence: number;
  archivedAt?: string;
};

export type MemoryMaintenanceDeps = {
  organizationId: string;
  now: number;
  createId: (prefix: string) => string;
  /** flag thresholds (§7.1 Stage B) */
  demotionFailureFloor?: number; // default 3
  demotionFailureRatio?: number; // default 0.6
  promotionDistinctScopes?: number; // default 3
  /** Stage-B hat choosers — default safe: keep / no-promote / keep-this */
  chooseDemotion?: OrgChooser<MemoryDemotionChoice>;
  choosePromotion?: OrgChooser<boolean>; // approve target?
  chooseConflict?: OrgChooser<MemoryConflictChoice>;
};

export type MemoryMaintenanceReport = {
  recomputed: number;
  archived: readonly string[];
  reinforced: readonly string[];
  demotionCandidates: readonly string[];
  demoted: readonly string[];
  promotionCandidates: readonly string[];
  promoted: readonly { memoryId: string; target: PromotionTarget }[];
  conflictsResolved: readonly string[];
  updates: readonly MemoryStateUpdate[];
  events: readonly OrgEvent[];
};

const MEMORY_DEPT_CHAIN = ["executive_board", "coo", "memory_director"] as const;

function nextScopeTier(tier: MemoryTier): MemoryTier | null {
  if (tier === MemoryTier.Work) return MemoryTier.Hat;
  if (tier === MemoryTier.Hat) return MemoryTier.Department;
  return null; // agent/department/org don't promote up this ladder
}

export function runMemoryMaintenanceCycle(
  envelopes: readonly MemoryEnvelope[],
  deps: MemoryMaintenanceDeps,
): MemoryMaintenanceReport {
  const at = new Date(deps.now).toISOString();
  const failFloor = deps.demotionFailureFloor ?? 3;
  const failRatio = deps.demotionFailureRatio ?? 0.6;
  const promoScopes = deps.promotionDistinctScopes ?? 3;
  const chooseDemotion = deps.chooseDemotion ?? firstLegalChooser<MemoryDemotionChoice>();
  const choosePromotion = deps.choosePromotion ?? ((legal: readonly boolean[]) => ({ index: legal.indexOf(false), reason: "default: do not auto-promote" }));
  const chooseConflict = deps.chooseConflict ?? firstLegalChooser<MemoryConflictChoice>();

  const updates: MemoryStateUpdate[] = [];
  const events: OrgEvent[] = [];
  const archived: string[] = [];
  const reinforced: string[] = [];
  const demotionCandidates: string[] = [];
  const demoted: string[] = [];
  const promotionCandidates: string[] = [];
  const promoted: { memoryId: string; target: PromotionTarget }[] = [];
  const conflictsResolved: string[] = [];
  let recomputed = 0;

  const event = (kind: OrgEventKind, subjectId: string, from: MemoryPhase | undefined, to: MemoryPhase | undefined, decision: string, actorHatId?: string): OrgEvent => {
    const corr = deps.createId("memcorr");
    return {
      id: deps.createId("memevt"),
      kind,
      occurredAt: at,
      organizationId: deps.organizationId,
      subjectId,
      decision,
      supervisorChain: [...MEMORY_DEPT_CHAIN],
      evidenceRefs: [],
      correlationId: corr,
      causationId: corr,
      traceId: corr,
      ...(actorHatId !== undefined ? { actorHatId } : {}),
      ...(from !== undefined ? { fromState: from } : {}),
      ...(to !== undefined ? { toState: to } : {}),
    };
  };

  for (const env of envelopes) {
    if (env.state.phase === MemoryPhase.Archived) continue;
    const s = env.state;
    recomputed += 1;

    // ── Stage A: decay + resting weight (always) ─────────────────────────────
    const restingWeight = computeRestingWeight(env, deps.now);

    // confidence reinforcement — auto-apply only when it ROSE; protected: no decay
    const recomputedConf = env.protected ? s.confidence : recomputeConfidence(s.outcome);
    let nextConfidence = s.confidence;
    if (!env.protected && recomputedConf > s.confidence + 1e-9) {
      nextConfidence = recomputedConf;
      reinforced.push(env.memoryId);
      events.push(event(OrgEventKind.MemoryReinforced, env.memoryId, undefined, undefined, `confidence reinforced ${s.confidence.toFixed(2)} → ${recomputedConf.toFixed(2)} (KPI up)`));
    }

    // archive-at-zero — protected memories are never auto-archived
    if (!env.protected && restingWeight <= archiveFloorFor(env.tier)) {
      updates.push({ memoryId: env.memoryId, nextPhase: MemoryPhase.Archived, nextWeight: 0, nextConfidence, archivedAt: at });
      archived.push(env.memoryId);
      events.push(event(OrgEventKind.MemoryArchived, env.memoryId, s.phase, MemoryPhase.Archived, `weight ${restingWeight.toFixed(2)} ≤ archive floor ${archiveFloorFor(env.tier)} — archived; never surfaces again`));
      continue; // archived this memory; no Stage B
    }

    // ── Stage B: hat-decided (flagged candidates, clamped to legal set) ───────
    let nextPhase = s.phase;

    // conflict resolution
    if (s.phase === MemoryPhase.Conflicted) {
      const legal: MemoryConflictChoice[] = [MemoryConflictChoice.KeepThis, MemoryConflictChoice.DemoteThis, MemoryConflictChoice.ArchiveThis];
      const choice = chooseWithinLegal(legal, `conflict:${env.memoryId}`, chooseConflict);
      if (choice.outcome === "chosen") {
        const target = choice.option === MemoryConflictChoice.KeepThis ? MemoryPhase.Active : choice.option === MemoryConflictChoice.DemoteThis ? MemoryPhase.Demoted : MemoryPhase.Archived;
        if (isLegalMemoryTransition(s.phase, target)) {
          nextPhase = target;
          conflictsResolved.push(env.memoryId);
          events.push(event(OrgEventKind.MemoryConflictFlagged, env.memoryId, s.phase, target, `conflict resolved by memory_reviewer: ${choice.option}`, "memory_reviewer"));
          if (target === MemoryPhase.Archived) {
            updates.push({ memoryId: env.memoryId, nextPhase, nextWeight: 0, nextConfidence, archivedAt: at });
            archived.push(env.memoryId);
            continue;
          }
        }
      }
    }

    // demotion candidate — failureCount ≥ floor AND failure ratio ≥ threshold
    const totalOutcome = s.outcome.successCount + s.outcome.failureCount;
    const ratio = totalOutcome > 0 ? s.outcome.failureCount / totalOutcome : 0;
    if (!env.protected && nextPhase !== MemoryPhase.Demoted && s.outcome.failureCount >= failFloor && ratio >= failRatio && isLegalMemoryTransition(s.phase, MemoryPhase.Demoted)) {
      demotionCandidates.push(env.memoryId);
      const legal: MemoryDemotionChoice[] = [MemoryDemotionChoice.Keep, MemoryDemotionChoice.Demote, MemoryDemotionChoice.RequestEvidence];
      const choice = chooseWithinLegal(legal, `demotion:${env.memoryId}`, chooseDemotion);
      if (choice.outcome === "chosen" && choice.option === MemoryDemotionChoice.Demote) {
        nextPhase = MemoryPhase.Demoted;
        demoted.push(env.memoryId);
        events.push(event(OrgEventKind.MemoryDemoted, env.memoryId, s.phase, MemoryPhase.Demoted, `demoted by memory_reviewer: ${s.outcome.failureCount} failures, ratio ${ratio.toFixed(2)}`, "memory_reviewer"));
      }
    }

    // promotion candidate — observed across ≥ N distinct scopes
    const target = nextScopeTier(env.tier);
    if (target !== null && nextPhase === s.phase && s.crossScope.distinctScopes.length >= promoScopes && isLegalMemoryTransition(s.phase, MemoryPhase.Promoted)) {
      promotionCandidates.push(env.memoryId);
      const legal = [true, false];
      const promoTarget: PromotionTarget = { toTier: target, toScope: deps.organizationId };
      const choice = chooseWithinLegal(legal, `promotion:${env.memoryId}`, choosePromotion);
      if (choice.outcome === "chosen" && choice.option === true) {
        nextPhase = MemoryPhase.Promoted;
        promoted.push({ memoryId: env.memoryId, target: promoTarget });
        events.push(event(OrgEventKind.MemoryPromoted, env.memoryId, s.phase, MemoryPhase.Promoted, `promoted ${env.tier} → ${target} by knowledge_router; source kept (derived_from)`, "knowledge_router"));
      }
    }

    updates.push({ memoryId: env.memoryId, nextPhase, nextWeight: restingWeight, nextConfidence });
  }

  events.push(event(OrgEventKind.MemoryMaintenanceCycle, deps.organizationId, undefined, undefined, `memory maintenance cycle: ${recomputed} recomputed, ${archived.length} archived, ${reinforced.length} reinforced, ${demoted.length} demoted, ${promoted.length} promoted`));

  return { recomputed, archived, reinforced, demotionCandidates, demoted, promotionCandidates, promoted, conflictsResolved, updates, events };
}
