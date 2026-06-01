import {
  HatBindingPhase,
  HatLevel,
  ScheduleBlockState,
  type HatBinding,
  type HatDefinition,
  type WorkScheduleBlock,
} from "../../domain/src/index.ts";
import { workMarketReadoutForHat, type HatWorkQueue } from "./work-market.ts";

export const SchedulePressureLevel = {
  Normal: "normal",
  AtRisk: "at_risk",
  Critical: "critical",
} as const;

export type SchedulePressureLevel = (typeof SchedulePressureLevel)[keyof typeof SchedulePressureLevel];

export const SchedulePressureSignalKind = {
  QueuePressure: "queue_pressure",
  StaleClaims: "stale_claims",
  ReviewLag: "review_lag",
  FailureRate: "failure_rate",
  HeartbeatReliability: "heartbeat_reliability",
  ExpiredHatBinding: "expired_hat_binding",
  ScheduleGap: "schedule_gap",
} as const;

export type SchedulePressureSignalKind =
  (typeof SchedulePressureSignalKind)[keyof typeof SchedulePressureSignalKind];

export const ScheduleCorrectiveActionKind = {
  RebalanceHatCapacity: "rebalance_hat_capacity",
  ShortenScheduleBlock: "shorten_schedule_block",
  ExtendFocusBlock: "extend_focus_block",
  ReassignAfterExpiry: "reassign_after_expiry",
  PauseLowPriorityWork: "pause_low_priority_work",
  OpenOfficeHours: "open_office_hours",
  RequestRmoExpand: "request_rmo_expand",
} as const;

export type ScheduleCorrectiveActionKind =
  (typeof ScheduleCorrectiveActionKind)[keyof typeof ScheduleCorrectiveActionKind];

export type SchedulePressureSignal = {
  readonly kind: SchedulePressureSignalKind;
  readonly severity: SchedulePressureLevel;
  readonly scoreContribution: number;
  readonly value: number | string | boolean;
  readonly unit?: string;
  readonly rationale: string;
};

export type ScheduleCorrectiveAction = {
  readonly actionId: string;
  readonly kind: ScheduleCorrectiveActionKind;
  readonly hatId: string;
  readonly label: string;
  readonly rationale: string;
};

export type SchedulePressureInput = {
  readonly organizationId: string;
  readonly hatId: string;
  readonly now: string;
  readonly workQueues: readonly HatWorkQueue[];
  readonly scheduleBlocks: readonly WorkScheduleBlock[];
  readonly bindings: readonly HatBinding[];
  readonly reviewLagMs: number;
  readonly failureRate: number;
  readonly heartbeatReliability: number;
};

export type SchedulePressure = {
  readonly organizationId: string;
  readonly hatId: string;
  readonly level: SchedulePressureLevel;
  readonly score: number;
  readonly queueDepth: number;
  readonly staleClaimCount: number;
  readonly activeScheduleBlockCount: number;
  readonly expiredBindingCount: number;
  readonly signals: readonly SchedulePressureSignal[];
  readonly correctiveActions: readonly ScheduleCorrectiveAction[];
};

export type SchedulePressureReadoutInput = {
  readonly organizationId: string;
  readonly hats: ReadonlyMap<string, HatDefinition>;
  readonly now: string;
  readonly workQueues: readonly HatWorkQueue[];
  readonly scheduleBlocks: readonly WorkScheduleBlock[];
  readonly bindings: readonly HatBinding[];
  readonly reviewLagMsByHat?: ReadonlyMap<string, number>;
  readonly failureRateByHat?: ReadonlyMap<string, number>;
  readonly heartbeatReliabilityByHat?: ReadonlyMap<string, number>;
};

export type SchedulePressureReadout = {
  readonly organizationId: string;
  readonly hatId: string;
  readonly visibleHatIds: readonly string[];
  readonly level: SchedulePressureLevel;
  readonly score: number;
  readonly pressures: readonly SchedulePressure[];
  readonly signals: readonly SchedulePressureSignal[];
  readonly correctiveActions: readonly ScheduleCorrectiveAction[];
};

export const MissionTrajectoryStatus = {
  OnTrack: "on_track",
  AtRisk: "at_risk",
  OffTrack: "off_track",
} as const;

export type MissionTrajectoryStatus =
  (typeof MissionTrajectoryStatus)[keyof typeof MissionTrajectoryStatus];

export type MissionTrajectoryInput = {
  readonly organizationId: string;
  readonly missionId: string;
  readonly now: string;
  readonly startsAt: string;
  readonly targetAt: string;
  readonly targetProgress: number;
  readonly actualProgress: number;
  readonly tolerance?: number;
  readonly correctiveActionHatId?: string;
};

export type MissionTrajectory = {
  readonly organizationId: string;
  readonly missionId: string;
  readonly status: MissionTrajectoryStatus;
  readonly expectedProgress: number;
  readonly actualProgress: number;
  readonly lag: number;
  readonly elapsedRatio: number;
  readonly remainingRatio: number;
  readonly correctiveActions: readonly ScheduleCorrectiveAction[];
  readonly evidenceRefs: readonly string[];
};

export function evaluateMissionTrajectory(input: MissionTrajectoryInput): MissionTrajectory {
  const elapsedRatio = elapsedRatioForDates(input.startsAt, input.targetAt, input.now);
  const remainingRatio = round3(1 - elapsedRatio);
  const targetProgress = clamp01(input.targetProgress);
  const expectedProgress = round3(targetProgress * elapsedRatio);
  const actualProgress = round3(clamp01(input.actualProgress));
  const lag = round3(Math.max(0, expectedProgress - actualProgress));
  const tolerance = Math.max(0, input.tolerance ?? 0.1);
  const missedTarget = elapsedRatio >= 1 && actualProgress < round3(targetProgress - tolerance);
  const status =
    missedTarget || lag > tolerance * 2
      ? MissionTrajectoryStatus.OffTrack
      : lag > tolerance
        ? MissionTrajectoryStatus.AtRisk
        : MissionTrajectoryStatus.OnTrack;
  const correctiveActions = correctiveActionsForTrajectory(status, input.correctiveActionHatId ?? input.missionId);

  return {
    organizationId: input.organizationId,
    missionId: input.missionId,
    status,
    expectedProgress,
    actualProgress,
    lag,
    elapsedRatio: round3(elapsedRatio),
    remainingRatio,
    correctiveActions,
    evidenceRefs: [
      `mission:${input.missionId}`,
      `trajectory:${status}`,
      `expected:${expectedProgress}`,
      `actual:${actualProgress}`,
      `lag:${lag}`,
    ],
  };
}

export function computeSchedulePressure(input: SchedulePressureInput): SchedulePressure {
  const workMarket = workMarketReadoutForHat(input.workQueues, {
    organizationId: input.organizationId,
    hatId: input.hatId,
    now: input.now,
  });
  const activeBlocks = input.scheduleBlocks.filter((block) =>
    block.organizationId === input.organizationId &&
    blockBelongsToHat(block, input.bindings, input.hatId) &&
    activeAt(block, input.now),
  );
  const expiredBindings = input.bindings.filter((binding) =>
    binding.organizationId === input.organizationId &&
    binding.hatId === input.hatId &&
    binding.phase === HatBindingPhase.Expired,
  );

  const signals = [
    queuePressureSignal(workMarket.totalReadyShards),
    staleClaimSignal(workMarket.totalStaleClaims),
    reviewLagSignal(input.reviewLagMs),
    failureRateSignal(input.failureRate),
    heartbeatReliabilitySignal(input.heartbeatReliability),
    expiredBindingSignal(expiredBindings.length),
    scheduleGapSignal(activeBlocks.length, workMarket.totalReadyShards),
  ].filter((signal): signal is SchedulePressureSignal => signal !== undefined);

  const score = clamp01(signals.reduce((sum, signal) => sum + signal.scoreContribution, 0));
  const level = levelForScore(score, signals);
  const pressure: SchedulePressure = {
    organizationId: input.organizationId,
    hatId: input.hatId,
    level,
    score: round3(score),
    queueDepth: workMarket.totalReadyShards,
    staleClaimCount: workMarket.totalStaleClaims,
    activeScheduleBlockCount: activeBlocks.length,
    expiredBindingCount: expiredBindings.length,
    signals,
    correctiveActions: [],
  };
  return { ...pressure, correctiveActions: correctiveActionsForPressure(pressure) };
}

export function schedulePressureReadoutForHat(
  hat: HatDefinition,
  input: SchedulePressureReadoutInput,
): SchedulePressureReadout {
  const visibleHatIds = visibleScheduleHatIds(hat, input);
  const pressures = visibleHatIds.map((hatId) =>
    computeSchedulePressure({
      organizationId: input.organizationId,
      hatId,
      now: input.now,
      workQueues: input.workQueues,
      scheduleBlocks: input.scheduleBlocks.filter((block) => {
        const binding = input.bindings.find((candidate) => candidate.id === block.assignedHatAssignmentId);
        return binding?.hatId === hatId;
      }),
      bindings: input.bindings,
      reviewLagMs: input.reviewLagMsByHat?.get(hatId) ?? 0,
      failureRate: input.failureRateByHat?.get(hatId) ?? 0,
      heartbeatReliability: input.heartbeatReliabilityByHat?.get(hatId) ?? 1,
    }));
  const score = pressures.length === 0 ? 0 : Math.max(...pressures.map((pressure) => pressure.score));
  return {
    organizationId: input.organizationId,
    hatId: hat.id,
    visibleHatIds,
    level: levelForScore(score, pressures.flatMap((pressure) => pressure.signals)),
    score: round3(score),
    pressures,
    signals: pressures.flatMap((pressure) => pressure.signals),
    correctiveActions: dedupeActions(pressures.flatMap((pressure) => pressure.correctiveActions)),
  };
}

function queuePressureSignal(readyShardCount: number): SchedulePressureSignal | undefined {
  if (readyShardCount <= 0) return undefined;
  return {
    kind: SchedulePressureSignalKind.QueuePressure,
    severity: readyShardCount >= 6 ? SchedulePressureLevel.Critical : readyShardCount >= 2 ? SchedulePressureLevel.AtRisk : SchedulePressureLevel.Normal,
    scoreContribution: Math.min(readyShardCount / 6, 1) * 0.25,
    value: readyShardCount,
    unit: "shard",
    rationale: "ready shard depth consumes scheduled capacity",
  };
}

function staleClaimSignal(staleClaimCount: number): SchedulePressureSignal | undefined {
  if (staleClaimCount <= 0) return undefined;
  return {
    kind: SchedulePressureSignalKind.StaleClaims,
    severity: SchedulePressureLevel.Critical,
    scoreContribution: Math.min(0.25 + staleClaimCount * 0.05, 0.35),
    value: staleClaimCount,
    unit: "claim",
    rationale: "stale claims indicate scheduled work authority is not completing",
  };
}

function reviewLagSignal(reviewLagMs: number): SchedulePressureSignal | undefined {
  if (reviewLagMs <= 15 * 60 * 1000) return undefined;
  return {
    kind: SchedulePressureSignalKind.ReviewLag,
    severity: reviewLagMs >= 2 * 60 * 60 * 1000 ? SchedulePressureLevel.Critical : SchedulePressureLevel.AtRisk,
    scoreContribution: Math.min(reviewLagMs / (3 * 60 * 60 * 1000), 1) * 0.2,
    value: reviewLagMs,
    unit: "ms",
    rationale: "review lag blocks shard merge and release readiness",
  };
}

function failureRateSignal(failureRate: number): SchedulePressureSignal | undefined {
  if (failureRate <= 0.05) return undefined;
  return {
    kind: SchedulePressureSignalKind.FailureRate,
    severity: failureRate >= 0.25 ? SchedulePressureLevel.Critical : SchedulePressureLevel.AtRisk,
    scoreContribution: Math.min(failureRate / 0.35, 1) * 0.2,
    value: round3(failureRate),
    rationale: "high failure rate lowers schedule reliability and should trigger rotation or review",
  };
}

function heartbeatReliabilitySignal(reliability: number): SchedulePressureSignal | undefined {
  if (reliability >= 0.9) return undefined;
  return {
    kind: SchedulePressureSignalKind.HeartbeatReliability,
    severity: reliability < 0.6 ? SchedulePressureLevel.Critical : SchedulePressureLevel.AtRisk,
    scoreContribution: (1 - clamp01(reliability)) * 0.2,
    value: round3(reliability),
    rationale: "low heartbeat reliability is the schedule analogue of burnout or context loss",
  };
}

function expiredBindingSignal(expiredBindingCount: number): SchedulePressureSignal | undefined {
  if (expiredBindingCount <= 0) return undefined;
  return {
    kind: SchedulePressureSignalKind.ExpiredHatBinding,
    severity: SchedulePressureLevel.AtRisk,
    scoreContribution: Math.min(0.35 + expiredBindingCount * 0.05, 0.5),
    value: expiredBindingCount,
    unit: "binding",
    rationale: "expired hat bindings vacate capacity and must route through reassignment",
  };
}

function scheduleGapSignal(activeBlockCount: number, readyShardCount: number): SchedulePressureSignal | undefined {
  if (activeBlockCount > 0 || readyShardCount === 0) return undefined;
  return {
    kind: SchedulePressureSignalKind.ScheduleGap,
    severity: SchedulePressureLevel.AtRisk,
    scoreContribution: 0.2,
    value: true,
    rationale: "ready work exists with no active schedule block",
  };
}

function correctiveActionsForPressure(pressure: SchedulePressure): readonly ScheduleCorrectiveAction[] {
  const actions: ScheduleCorrectiveAction[] = [];
  const hasExpired = pressure.signals.some((signal) => signal.kind === SchedulePressureSignalKind.ExpiredHatBinding);
  const hasQueue = pressure.queueDepth > 0 || pressure.staleClaimCount > 0;
  const hasReliability = pressure.signals.some((signal) => signal.kind === SchedulePressureSignalKind.HeartbeatReliability || signal.kind === SchedulePressureSignalKind.FailureRate);

  if (hasExpired) actions.push(action(ScheduleCorrectiveActionKind.ReassignAfterExpiry, pressure.hatId, "Reassign expired hat", "expired hat capacity must return to supervisor/RMO assignment"));
  if (pressure.level === SchedulePressureLevel.Critical && hasQueue) {
    actions.push(action(ScheduleCorrectiveActionKind.RebalanceHatCapacity, pressure.hatId, "Rebalance hat capacity", "queue and SLA pressure exceed scheduled capacity"));
  }
  if ((pressure.level === SchedulePressureLevel.Critical || hasExpired) && hasQueue) {
    actions.push(action(ScheduleCorrectiveActionKind.RequestRmoExpand, pressure.hatId, "Request RMO expansion", "additional legal candidates may be needed for this hat"));
  }
  if (hasReliability) actions.push(action(ScheduleCorrectiveActionKind.ShortenScheduleBlock, pressure.hatId, "Shorten unreliable block", "reliability pressure suggests rotating or shortening the current block"));
  if (pressure.level === SchedulePressureLevel.AtRisk && hasQueue) {
    actions.push(action(ScheduleCorrectiveActionKind.OpenOfficeHours, pressure.hatId, "Open office hours", "coordination may unblock queued work before expanding capacity"));
  }
  if (pressure.level === SchedulePressureLevel.Critical) {
    actions.push(action(ScheduleCorrectiveActionKind.PauseLowPriorityWork, pressure.hatId, "Pause low-priority work", "critical pressure should protect the highest-priority trajectory"));
  }
  if (actions.length === 0 && pressure.queueDepth > 0) {
    actions.push(action(ScheduleCorrectiveActionKind.ExtendFocusBlock, pressure.hatId, "Extend focus block", "low pressure with ready work should preserve context instead of reassigning"));
  }
  return dedupeActions(actions);
}

function correctiveActionsForTrajectory(
  status: MissionTrajectoryStatus,
  hatId: string,
): readonly ScheduleCorrectiveAction[] {
  if (status === MissionTrajectoryStatus.OnTrack) return [];
  if (status === MissionTrajectoryStatus.AtRisk) {
    return dedupeActions([
      action(ScheduleCorrectiveActionKind.ExtendFocusBlock, hatId, "Extend focus block", "mission trajectory is behind expected progress but still recoverable inside tolerance bounds"),
      action(ScheduleCorrectiveActionKind.OpenOfficeHours, hatId, "Open office hours", "mission trajectory needs coordination before adding capacity"),
    ]);
  }
  return dedupeActions([
    action(ScheduleCorrectiveActionKind.RebalanceHatCapacity, hatId, "Rebalance hat capacity", "mission trajectory is off track against target slope"),
    action(ScheduleCorrectiveActionKind.RequestRmoExpand, hatId, "Request RMO expansion", "mission trajectory may require more legal hat capacity"),
    action(ScheduleCorrectiveActionKind.PauseLowPriorityWork, hatId, "Pause low-priority work", "off-track mission should protect the highest-priority trajectory"),
  ]);
}

function action(
  kind: ScheduleCorrectiveActionKind,
  hatId: string,
  label: string,
  rationale: string,
): ScheduleCorrectiveAction {
  return { actionId: `schedule.${kind}.${hatId}`, kind, hatId, label, rationale };
}

function visibleScheduleHatIds(hat: HatDefinition, input: SchedulePressureReadoutInput): readonly string[] {
  const queueHatIds = new Set(input.workQueues.map((queue) => queue.hatId));
  const bindingHatIds = new Set(input.bindings.map((binding) => binding.hatId));
  const candidateHatIds = new Set([...queueHatIds, ...bindingHatIds, hat.id]);
  if (hat.level === HatLevel.ExecutiveBoard || hat.level === HatLevel.CSuite) return [...candidateHatIds].sort();

  const subtree = authoritySubtree(hat.id, input.hats);
  if (hat.level === HatLevel.Director) {
    return [...candidateHatIds]
      .filter((hatId) => subtree.has(hatId) || input.hats.get(hatId)?.departmentId === hat.departmentId || hatId === hat.id)
      .sort();
  }
  if (hat.level === HatLevel.Manager || hat.level === HatLevel.Lead) {
    return [...candidateHatIds].filter((hatId) => subtree.has(hatId) || hatId === hat.id).sort();
  }
  return [hat.id];
}

function authoritySubtree(hatId: string, byId: ReadonlyMap<string, HatDefinition>): ReadonlySet<string> {
  const out = new Set<string>();
  const stack = [hatId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (out.has(current)) continue;
    out.add(current);
    for (const child of byId.get(current)?.supervisesHatIds ?? []) stack.push(child);
  }
  return out;
}

function activeAt(block: WorkScheduleBlock, now: string): boolean {
  const nowMs = Date.parse(now);
  const startsAt = Date.parse(block.startsAt);
  const endsAt = Date.parse(block.endsAt);
  return block.state === ScheduleBlockState.Active && Number.isFinite(nowMs) && startsAt <= nowMs && nowMs < endsAt;
}

function elapsedRatioForDates(startsAt: string, targetAt: string, now: string): number {
  const startsAtMs = Date.parse(startsAt);
  const targetAtMs = Date.parse(targetAt);
  const nowMs = Date.parse(now);
  if (!Number.isFinite(startsAtMs) || !Number.isFinite(targetAtMs) || !Number.isFinite(nowMs)) return 0;
  if (targetAtMs <= startsAtMs) return nowMs >= targetAtMs ? 1 : 0;
  return clamp01((nowMs - startsAtMs) / (targetAtMs - startsAtMs));
}

function blockBelongsToHat(
  block: WorkScheduleBlock,
  bindings: readonly HatBinding[],
  hatId: string,
): boolean {
  return bindings.some((binding) =>
    binding.id === block.assignedHatAssignmentId &&
    binding.hatId === hatId
  );
}

function levelForScore(score: number, signals: readonly SchedulePressureSignal[]): SchedulePressureLevel {
  if (score >= 0.75 || signals.some((signal) => signal.severity === SchedulePressureLevel.Critical && signal.kind === SchedulePressureSignalKind.StaleClaims)) {
    return SchedulePressureLevel.Critical;
  }
  if (score >= 0.3 || signals.some((signal) => signal.severity === SchedulePressureLevel.AtRisk)) return SchedulePressureLevel.AtRisk;
  return SchedulePressureLevel.Normal;
}

function dedupeActions(actions: readonly ScheduleCorrectiveAction[]): readonly ScheduleCorrectiveAction[] {
  const byId = new Map<string, ScheduleCorrectiveAction>();
  for (const candidate of actions) byId.set(candidate.actionId, candidate);
  return [...byId.values()].sort((left, right) => left.actionId.localeCompare(right.actionId));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
