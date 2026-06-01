import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  HatBindingPhase,
  ScheduleBlockState,
  ScheduleBlockType,
  type HatBinding,
  type WorkScheduleBlock,
} from "../../domain/src/index.ts";
import {
  MissionTrajectoryStatus,
  ScheduleCorrectiveActionKind,
  SchedulePressureLevel,
  computeSchedulePressure,
  evaluateMissionTrajectory,
  schedulePressureReadoutForHat,
} from "../src/index.ts";
import { buildHatDefinitions } from "../src/org-seed.ts";
import { WorkClaimState, WorkShardState, type HatWorkQueue } from "../src/work-market.ts";

const NOW = "2026-05-31T12:30:00.000Z";

test("mission trajectory marks late missions off track and emits capacity corrective actions", () => {
  const trajectory = evaluateMissionTrajectory({
    organizationId: "org-lfg",
    missionId: "mission-observe-act",
    now: "2026-05-31T12:00:00.000Z",
    startsAt: "2026-05-01T00:00:00.000Z",
    targetAt: "2026-06-30T00:00:00.000Z",
    targetProgress: 1,
    actualProgress: 0.18,
    tolerance: 0.08,
    correctiveActionHatId: "engineering_director",
  });

  equal(trajectory.status, MissionTrajectoryStatus.OffTrack);
  equal(trajectory.expectedProgress, 0.508);
  equal(trajectory.actualProgress, 0.18);
  equal(trajectory.lag, 0.328);
  deepEqual(
    trajectory.correctiveActions.map((action) => action.kind),
    [
      ScheduleCorrectiveActionKind.PauseLowPriorityWork,
      ScheduleCorrectiveActionKind.RebalanceHatCapacity,
      ScheduleCorrectiveActionKind.RequestRmoExpand,
    ],
  );
  ok(trajectory.evidenceRefs.includes("mission:mission-observe-act"));
  ok(trajectory.evidenceRefs.includes("trajectory:off_track"));
});

test("mission trajectory distinguishes at-risk and on-track schedules by tolerance", () => {
  const atRisk = evaluateMissionTrajectory({
    organizationId: "org-lfg",
    missionId: "mission-work-market",
    now: "2026-05-31T12:00:00.000Z",
    startsAt: "2026-05-01T00:00:00.000Z",
    targetAt: "2026-06-30T00:00:00.000Z",
    targetProgress: 1,
    actualProgress: 0.45,
    tolerance: 0.04,
    correctiveActionHatId: "technical_program_manager",
  });
  const onTrack = evaluateMissionTrajectory({
    organizationId: "org-lfg",
    missionId: "mission-work-market",
    now: "2026-05-31T12:00:00.000Z",
    startsAt: "2026-05-01T00:00:00.000Z",
    targetAt: "2026-06-30T00:00:00.000Z",
    targetProgress: 1,
    actualProgress: 0.49,
    tolerance: 0.04,
    correctiveActionHatId: "technical_program_manager",
  });

  equal(atRisk.status, MissionTrajectoryStatus.AtRisk);
  deepEqual(
    atRisk.correctiveActions.map((action) => action.kind),
    [
      ScheduleCorrectiveActionKind.ExtendFocusBlock,
      ScheduleCorrectiveActionKind.OpenOfficeHours,
    ],
  );
  equal(onTrack.status, MissionTrajectoryStatus.OnTrack);
  deepEqual(onTrack.correctiveActions, []);
});

test("schedule pressure combines queue depth, stale claims, review lag, failure rate, and reliability", () => {
  const pressure = computeSchedulePressure({
    organizationId: "org-lfg",
    hatId: "backend_implementer",
    now: NOW,
    workQueues: [queue({ readyShards: 6, staleClaimCount: 1 })],
    reviewLagMs: 3 * 60 * 60 * 1000,
    failureRate: 0.35,
    heartbeatReliability: 0.42,
    scheduleBlocks: [block({ endsAt: "2026-05-31T13:00:00.000Z" })],
    bindings: [binding({ phase: HatBindingPhase.Active })],
  });

  equal(pressure.level, SchedulePressureLevel.Critical);
  ok(pressure.score >= 0.8);
  deepEqual(
    pressure.signals.map((signal) => signal.kind),
    ["queue_pressure", "stale_claims", "review_lag", "failure_rate", "heartbeat_reliability"],
  );
  ok(pressure.correctiveActions.some((action) => action.kind === ScheduleCorrectiveActionKind.RebalanceHatCapacity));
  ok(pressure.correctiveActions.some((action) => action.kind === ScheduleCorrectiveActionKind.RequestRmoExpand));
});

test("expired hat bindings produce a legal reassignment path through RMO", () => {
  const pressure = computeSchedulePressure({
    organizationId: "org-lfg",
    hatId: "backend_implementer",
    now: NOW,
    workQueues: [queue({ readyShards: 2 })],
    reviewLagMs: 0,
    failureRate: 0,
    heartbeatReliability: 0.95,
    scheduleBlocks: [block()],
    bindings: [binding({ phase: HatBindingPhase.Expired, endedAt: "2026-05-31T12:00:00.000Z" })],
  });

  equal(pressure.level, SchedulePressureLevel.AtRisk);
  ok(pressure.signals.some((signal) => signal.kind === "expired_hat_binding"));
  ok(pressure.correctiveActions.some((action) => action.kind === ScheduleCorrectiveActionKind.ReassignAfterExpiry));
  ok(pressure.correctiveActions.some((action) => action.kind === ScheduleCorrectiveActionKind.RequestRmoExpand));
});

test("low pressure keeps corrective actions narrow and avoids reassignment churn", () => {
  const pressure = computeSchedulePressure({
    organizationId: "org-lfg",
    hatId: "backend_implementer",
    now: NOW,
    workQueues: [queue({ readyShards: 1 })],
    reviewLagMs: 5 * 60 * 1000,
    failureRate: 0,
    heartbeatReliability: 0.98,
    scheduleBlocks: [block()],
    bindings: [binding({ phase: HatBindingPhase.Active })],
  });

  equal(pressure.level, SchedulePressureLevel.Normal);
  deepEqual(pressure.correctiveActions.map((action) => action.kind), [ScheduleCorrectiveActionKind.ExtendFocusBlock]);
});

test("schedule pressure does not let another hat's active block hide this hat's schedule gap", () => {
  const pressure = computeSchedulePressure({
    organizationId: "org-lfg",
    hatId: "backend_implementer",
    now: NOW,
    workQueues: [queue({ readyShards: 1 })],
    reviewLagMs: 0,
    failureRate: 0,
    heartbeatReliability: 1,
    scheduleBlocks: [block({ assignedHatAssignmentId: "binding-qa" })],
    bindings: [
      binding({ id: "binding-backend", hatId: "backend_implementer" }),
      binding({ id: "binding-qa", hatId: "qa_verifier" }),
    ],
  });

  equal(pressure.activeScheduleBlockCount, 0);
  ok(pressure.signals.some((signal) => signal.kind === "schedule_gap"));
});

test("schedulePressureReadoutForHat rolls subordinate queues and bindings up to director scope", () => {
  const hats = buildHatDefinitions();
  const byId = new Map(hats.map((hat) => [hat.id, hat]));
  const director = byId.get("engineering_director") ?? byId.get("cto")!;

  const readout = schedulePressureReadoutForHat(director, {
    organizationId: "org-lfg",
    hats: byId,
    now: NOW,
    workQueues: [queue({ hatId: "backend_implementer", readyShards: 4, staleClaimCount: 1 })],
    scheduleBlocks: [block({ assignedHatAssignmentId: "binding-backend" })],
    bindings: [binding({ id: "binding-backend", hatId: "backend_implementer", phase: HatBindingPhase.Expired })],
    reviewLagMsByHat: new Map([["backend_implementer", 2 * 60 * 60 * 1000]]),
    failureRateByHat: new Map([["backend_implementer", 0.2]]),
    heartbeatReliabilityByHat: new Map([["backend_implementer", 0.5]]),
  });

  equal(readout.hatId, director.id);
  equal(readout.visibleHatIds.includes("backend_implementer"), true);
  equal(readout.pressures[0]?.hatId, "backend_implementer");
  equal(readout.pressures[0]?.level, SchedulePressureLevel.Critical);
  ok(readout.correctiveActions.some((action) => action.kind === ScheduleCorrectiveActionKind.ReassignAfterExpiry));
});

function queue(input: {
  hatId?: string;
  readyShards?: number;
  staleClaimCount?: number;
} = {}): HatWorkQueue {
  const readyShards = input.readyShards ?? 0;
  const staleClaimCount = input.staleClaimCount ?? 0;
  return {
    queueId: `queue-${input.hatId ?? "backend_implementer"}`,
    organizationId: "org-lfg",
    hatId: input.hatId ?? "backend_implementer",
    scope: { kind: "project", id: "project-1" },
    shardability: "by_component",
    requiredSkills: ["typescript"],
    reviewQuorum: { requiredApprovals: 1, reviewerHatIds: ["architect_reviewer"] },
    shards: [
      ...Array.from({ length: readyShards }, (_, index) => ({
        shardId: `ready-${index}`,
        workItemId: `work-${index}`,
        title: `Ready ${index}`,
        priority: 100 - index,
        state: WorkShardState.Ready,
        dependencyShardIds: [],
        mergePolicy: "independent" as const,
      })),
      ...Array.from({ length: staleClaimCount }, (_, index) => ({
        shardId: `stale-${index}`,
        workItemId: `stale-work-${index}`,
        title: `Stale ${index}`,
        priority: 50 - index,
        state: WorkShardState.Claimed,
        dependencyShardIds: [],
        mergePolicy: "independent" as const,
        claimedByClaimId: `claim-stale-${index}`,
      })),
    ],
    claims: Array.from({ length: staleClaimCount }, (_, index) => ({
      claimId: `claim-stale-${index}`,
      shardId: `stale-${index}`,
      ownerAgentId: "agent-backend",
      hatAssignmentId: "binding-backend",
      fencingToken: `fence-${index}`,
      leaseExpiresAt: "2026-05-31T12:00:00.000Z",
      heartbeatAt: "2026-05-31T11:55:00.000Z",
      scheduleBlockId: "block-backend",
      runtimeSessionId: "session-backend",
      workspaceRef: "worktree:backend",
      credentialScope: "tenant:org-lfg:repo:agentic-organization",
      compensatingAction: "release_claim_and_requeue_shard",
      state: WorkClaimState.Active,
      claimedAt: "2026-05-31T11:45:00.000Z",
    })),
    reviews: [],
  };
}

function block(input: Partial<WorkScheduleBlock> = {}): WorkScheduleBlock {
  return {
    workScheduleBlockId: "block-backend",
    organizationId: "org-lfg",
    projectId: "project-1",
    workItemId: "work-1",
    assignedAgentId: "agent-backend",
    assignedHatAssignmentId: "binding-backend",
    blockType: ScheduleBlockType.PrioritizedWork,
    state: ScheduleBlockState.Active,
    title: "Backend focus",
    purpose: "Implement backend shard",
    startsAt: "2026-05-31T12:00:00.000Z",
    endsAt: "2026-05-31T13:00:00.000Z",
    scheduledAt: "2026-05-31T11:30:00.000Z",
    scheduledBy: { agentId: "agent-manager", hatAssignmentId: "binding-manager" },
    metadata: { updatedAt: "2026-05-31T11:30:00.000Z", version: 1, correlationId: "corr", causationId: "cause", traceId: "trace" },
    ...input,
  };
}

function binding(input: Partial<HatBinding> = {}): HatBinding {
  return {
    id: "binding-backend",
    organizationId: "org-lfg",
    hatId: "backend_implementer",
    wearerAgentId: "agent-backend",
    phase: HatBindingPhase.Active,
    boundAt: "2026-05-31T11:00:00.000Z",
    warmupEndsAt: "2026-05-31T11:05:00.000Z",
    expiresAt: "2026-05-31T12:00:00.000Z",
    activatedAt: "2026-05-31T11:05:00.000Z",
    ...input,
  };
}
