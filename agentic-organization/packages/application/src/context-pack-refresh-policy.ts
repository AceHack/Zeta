import {
  ContextPackStatus,
  type AgentObserveSnapshot,
} from "./observe.ts";
import type { ContextPackSnapshotRecord } from "./context-pack-snapshot-store.ts";

export const ContextPackRefreshReason = {
  FirstHatWake: "first_hat_wake",
  HatAssignmentChanged: "hat_assignment_changed",
  HatChanged: "hat_changed",
  ScopeChanged: "scope_changed",
  PreviousExpired: "previous_expired",
  PreviousNotCurrent: "previous_not_current",
  Reusable: "reusable",
} as const;

export type ContextPackRefreshReason =
  (typeof ContextPackRefreshReason)[keyof typeof ContextPackRefreshReason];

export type DecideContextPackRefreshInput = {
  current: AgentObserveSnapshot;
  observedAt: string;
  previous: ContextPackSnapshotRecord | null;
};

export type ContextPackRefreshDecision = {
  reason: ContextPackRefreshReason;
  requiresBuild: boolean;
  previousContextPackId?: string | undefined;
  previousStatus?: ContextPackStatus | undefined;
  previousRecordedAt?: string | undefined;
  previousGeneratedAt?: string | undefined;
};

export function decideContextPackRefresh(input: DecideContextPackRefreshInput): ContextPackRefreshDecision {
  const previous = input.previous;
  if (previous === null) {
    return {
      reason: ContextPackRefreshReason.FirstHatWake,
      requiresBuild: true,
    };
  }

  const previousPack = previous.context.pack;
  const base = {
    previousContextPackId: previousPack.id,
    previousStatus: previous.context.status,
    previousRecordedAt: previous.recordedAt,
    previousGeneratedAt: previousPack.generatedAt,
  };

  if (previousPack.hatAssignmentId !== input.current.hatAssignmentId) {
    return {
      ...base,
      reason: ContextPackRefreshReason.HatAssignmentChanged,
      requiresBuild: true,
    };
  }

  if (previousPack.hatId !== input.current.hat.id) {
    return {
      ...base,
      reason: ContextPackRefreshReason.HatChanged,
      requiresBuild: true,
    };
  }

  if (!sameContextScope(previousPack, input.current)) {
    return {
      ...base,
      reason: ContextPackRefreshReason.ScopeChanged,
      requiresBuild: true,
    };
  }

  if (isExpired(previousPack.freshnessDeadline, input.observedAt)) {
    return {
      ...base,
      reason: ContextPackRefreshReason.PreviousExpired,
      requiresBuild: true,
    };
  }

  if (previous.context.status !== ContextPackStatus.Current) {
    return {
      ...base,
      reason: ContextPackRefreshReason.PreviousNotCurrent,
      requiresBuild: true,
    };
  }

  return {
    ...base,
    reason: ContextPackRefreshReason.Reusable,
    requiresBuild: false,
  };
}

function isExpired(freshnessDeadline: string, observedAt: string): boolean {
  const freshnessDeadlineMillis = Date.parse(freshnessDeadline);
  const observedAtMillis = Date.parse(observedAt);
  if (!Number.isFinite(freshnessDeadlineMillis) || !Number.isFinite(observedAtMillis)) return true;
  return freshnessDeadlineMillis <= observedAtMillis;
}

function sameContextScope(
  previous: ContextPackSnapshotRecord["context"]["pack"],
  current: AgentObserveSnapshot,
): boolean {
  return (
    previous.organizationId === current.organizationId &&
    previous.projectId === current.projectId &&
    previous.teamId === current.teamId &&
    previous.workItemId === current.workItemId &&
    previous.scope === current.scope &&
    previous.agentId === current.agentId
  );
}
