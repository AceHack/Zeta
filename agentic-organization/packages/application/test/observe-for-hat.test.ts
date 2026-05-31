import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  HatBindingPhase,
  ChangeArtifactKind,
  ChangeSetPhase,
  HatLevel,
  OrgEventKind,
  ScheduleBlockState,
  ScheduleBlockType,
  WorkItemState,
  WorkItemType,
  WorkItemSource,
  WorkBatchState,
  type ChangeSet,
  type HatBinding,
  type HatDefinition,
  type OrgEvent,
  type WorkBatch,
  type WorkItem,
  type WorkScheduleBlock,
} from "../../domain/src/index.ts";
import { buildHatDefinitions } from "../src/org-seed.ts";
import { RecordingTelemetry, rollUpBatchMetrics, aggregateMetrics } from "../../observability/src/index.ts";
import { observeForHat, authorityScopeOf, AuthorityScope, type OrgWorkState } from "../src/observe-for-hat.ts";
import { WorkClaimState, WorkShardState, type HatWorkQueue } from "../src/work-market.ts";
import { ScheduleCorrectiveActionKind, SchedulePressureLevel } from "../src/schedule-optimizer.ts";

function wi(id: string, type: WorkItemType, state: WorkItemState, batchId: string): WorkItem {
  return {
    workItemId: id, organizationId: "org-lfg", workItemType: type, state, title: id, description: "d",
    projectId: "proj-1", initiativeId: "init-1", batchId, source: WorkItemSource.Internal,
    createdAt: "2026-05-30T00:00:00.000Z", createdBy: { agentId: "a", hatAssignmentId: "ha" },
  };
}
function batch(id: string, ownerHatId: string): WorkBatch {
  return {
    batchId: id, organizationId: "org-lfg", scopeKind: "initiative", scopeId: "init-1",
    ownerHatId, state: WorkBatchState.Active, capacityPlannedHats: 2,
    createdAt: "2026-05-30T00:00:00.000Z", updatedAt: "2026-05-30T00:00:00.000Z",
  };
}
function bounceBack(itemId: string): OrgEvent {
  return {
    id: `evt-${itemId}`, kind: OrgEventKind.WorkItemTransition, occurredAt: "2026-05-30T01:00:00.000Z",
    organizationId: "org-lfg", subjectId: itemId, fromState: WorkItemState.Review, toState: WorkItemState.InProgress,
    decision: "QA failed; rework", supervisorChain: [], evidenceRefs: [], correlationId: "c", causationId: "c", traceId: "t",
  };
}

function changeSet(changeSetId: string, workItemId: string, openedAt: string): ChangeSet {
  return {
    changeSetId,
    organizationId: "org-lfg",
    workItemId,
    proposerHatId: "backend_implementer",
    title: changeSetId,
    targetRef: `branch/${changeSetId}`,
    phase: ChangeSetPhase.Applied,
    pipelineId: "internal-only",
    currentStageIndex: 0,
    artifacts: [{ kind: ChangeArtifactKind.CodeDiff, path: "src/app.ts", diff: "+1", language: "ts" }],
    projections: [],
    revision: 1,
    openedAt,
    updatedAt: openedAt,
  };
}

function changeEvent(kind: OrgEventKind, subjectId: string, occurredAt: string, actorHatId = "release_manager"): OrgEvent {
  return {
    id: `${kind}-${subjectId}-${occurredAt}`,
    kind,
    occurredAt,
    organizationId: "org-lfg",
    actorHatId,
    subjectId,
    decision: `${kind} ${subjectId}`,
    supervisorChain: [],
    evidenceRefs: [],
    correlationId: subjectId,
    causationId: subjectId,
    traceId: subjectId,
  };
}

test("batch metrics: completion %, open defects, and QA bounce-backs fold from items + events", () => {
  const items = [
    wi("a", WorkItemType.Task, WorkItemState.Done, "b1"),
    wi("c", WorkItemType.Task, WorkItemState.InProgress, "b1"),
    wi("d", WorkItemType.Defect, WorkItemState.Review, "b1"),
    wi("e", WorkItemType.Task, WorkItemState.Blocked, "b1"),
  ];
  const events = [bounceBack("d"), bounceBack("d")]; // the defect bounced twice
  const m = rollUpBatchMetrics({ batchId: "b1", items, events });
  equal(m.total, 4);
  equal(m.done, 1);
  equal(m.completionPct, 0.25);
  equal(m.blocked, 1);
  equal(m.inReview, 1);
  equal(m.openDefects, 1);
  equal(m.qaBounceBacks, 2);
  equal(m.movementScore, 0.75); // 1 - blocked/total
});

test("the QA gate term: passRate is neutral with no runs, drops with failures", () => {
  const base = { batchId: "b1", items: [wi("a", WorkItemType.Task, WorkItemState.Done, "b1")], events: [] };
  equal(rollUpBatchMetrics(base).passRate, 1);
  equal(rollUpBatchMetrics({ ...base, tests: { runs: 4, failures: 1, regressionsOpen: 1, defectsOpenedInTestSetup: 2 } }).passRate, 0.75);
});

test("aggregateMetrics rolls batch metrics up to a scope-level view (department/org)", () => {
  const m1 = rollUpBatchMetrics({ batchId: "b1", items: [wi("a", WorkItemType.Task, WorkItemState.Done, "b1")], events: [] });
  const m2 = rollUpBatchMetrics({ batchId: "b2", items: [wi("b", WorkItemType.Task, WorkItemState.Blocked, "b2")], events: [] });
  const scope = aggregateMetrics([m1, m2]);
  equal(scope.batchCount, 2);
  equal(scope.total, 2);
  equal(scope.done, 1);
  equal(scope.completionPct, 0.5);
  equal(scope.blocked, 1);
});

test("observeForHat carries internal DORA KPIs for in-scope initiative work", () => {
  const hats = buildHatDefinitions();
  const byId = new Map<string, HatDefinition>(hats.map((h) => [h.id, h]));
  const ceo = byId.get("ceo")!;
  const batchOne = batch("b-init-1", "engineering_manager");
  const batchTwo = batch("b-init-2", "release_manager");
  const itemOne = wi("work-1", WorkItemType.Task, WorkItemState.Done, "b-init-1");
  const itemTwo = wi("work-2", WorkItemType.Task, WorkItemState.Done, "b-init-2");
  const changeSets = [
    changeSet("cs-1", "work-1", "2026-05-31T00:00:00.000Z"),
    changeSet("cs-2", "work-2", "2026-05-31T02:00:00.000Z"),
  ];
  const events = [
    changeEvent(OrgEventKind.ChangeSetOpened, "cs-1", "2026-05-31T00:00:00.000Z"),
    changeEvent(OrgEventKind.ChangesRequested, "cs-1", "2026-05-31T01:00:00.000Z", "qa_verifier"),
    changeEvent(OrgEventKind.ChangeSetApplied, "cs-1", "2026-05-31T03:00:00.000Z"),
    changeEvent(OrgEventKind.ChangeSetOpened, "cs-2", "2026-05-31T02:00:00.000Z"),
    changeEvent(OrgEventKind.ChangeSetApplied, "cs-2", "2026-05-31T04:00:00.000Z"),
  ];

  const readout = observeForHat(ceo, {
    hats: byId,
    batches: [batchOne, batchTwo],
    itemsByBatch: new Map([
      ["b-init-1", [itemOne]],
      ["b-init-2", [itemTwo]],
    ]),
    events,
    changeSets,
  });

  equal(readout.batches[0]!.metrics.dora.deploymentCount, 1);
  equal(readout.batches[0]!.metrics.dora.changeFailureRate, 1);
  equal(readout.batches[1]!.metrics.dora.deploymentCount, 1);
  equal(readout.scopeRollup.dora.deploymentCount, 2);
  equal(readout.scopeRollup.dora.changeFailureRate, 0.5);
});

test("observeForHat exports internal DORA KPIs through telemetry when requested", () => {
  const hats = buildHatDefinitions();
  const byId = new Map<string, HatDefinition>(hats.map((h) => [h.id, h]));
  const ceo = byId.get("ceo")!;
  const telemetry = new RecordingTelemetry();
  const item = wi("work-telemetry", WorkItemType.Task, WorkItemState.Done, "b-telemetry");

  observeForHat(ceo, {
    hats: byId,
    batches: [batch("b-telemetry", "engineering_manager")],
    itemsByBatch: new Map([["b-telemetry", [item]]]),
    events: [
      changeEvent(OrgEventKind.ChangeSetOpened, "cs-telemetry", "2026-05-31T00:00:00.000Z"),
      changeEvent(OrgEventKind.ChangeSetApplied, "cs-telemetry", "2026-05-31T01:00:00.000Z"),
    ],
    changeSets: [changeSet("cs-telemetry", "work-telemetry", "2026-05-31T00:00:00.000Z")],
    telemetry,
  });

  ok(telemetry.metrics.some((metric) => metric.name === "org_dora_deployments_total" && metric.value === 1));
  ok(telemetry.metrics.some((metric) => metric.name === "org_dora_lead_time_ms" && metric.value === 60 * 60 * 1000));
});

test("observeForHat is DIFFERENT per authority scope: exec sees all, IC sees only its own", () => {
  const hats = buildHatDefinitions();
  const byId = new Map<string, HatDefinition>(hats.map((h) => [h.id, h]));
  const lead = hats.find((h) => h.level === HatLevel.Lead)!;
  const ic = hats.find((h) => h.level === HatLevel.IndividualContributor)!;
  const ceo = byId.get("ceo")!;

  const batches = [batch("b-lead", lead.id), batch("b-other", "release_manager")];
  const itemsByBatch = new Map<string, readonly WorkItem[]>([
    ["b-lead", [wi("a", WorkItemType.Task, WorkItemState.Done, "b-lead")]],
    ["b-other", [wi("b", WorkItemType.Task, WorkItemState.InProgress, "b-other")]],
  ]);
  const state: OrgWorkState = { hats: byId, batches, itemsByBatch, events: [] };

  // exec: organization scope → sees ALL batches
  const ceoView = observeForHat(ceo, state);
  equal(ceoView.authorityScope, AuthorityScope.Organization);
  equal(ceoView.batches.length, 2);
  equal(ceoView.scopeRollup.total, 2); // org-wide rollup

  // the lead: team scope → sees its own batch (self in subtree)
  const leadView = observeForHat(lead, state);
  equal(leadView.authorityScope, AuthorityScope.Team);
  ok(leadView.batches.some((b) => b.batch.batchId === "b-lead"));
  ok(!leadView.batches.some((b) => b.batch.batchId === "b-other"));

  // an IC: individual scope → sees only batches it owns (none here)
  const icView = observeForHat(ic, state);
  equal(icView.authorityScope, AuthorityScope.Individual);
  equal(icView.batches.length, 0);
});

test("legal priority classes are clamped by level (IC strictly fewer than exec)", () => {
  const hats = buildHatDefinitions();
  const byId = new Map(hats.map((h) => [h.id, h]));
  const state: OrgWorkState = { hats: byId, batches: [], itemsByBatch: new Map(), events: [] };
  const ceo = observeForHat(byId.get("ceo")!, state);
  const ic = observeForHat(hats.find((h) => h.level === HatLevel.IndividualContributor)!, state);
  ok(ceo.legalPriorityClasses.length > ic.legalPriorityClasses.length);
});

test("observeForHat includes same-hat work-market queue pressure and claim status", () => {
  const hats = buildHatDefinitions();
  const byId = new Map<string, HatDefinition>(hats.map((h) => [h.id, h]));
  const backend = byId.get("backend_implementer")!;
  const state: OrgWorkState = {
    hats: byId,
    batches: [],
    itemsByBatch: new Map(),
    events: [],
    workQueues: [backendQueue()],
    now: "2026-05-31T12:30:00.000Z",
  };

  const readout = observeForHat(backend, state);

  equal(readout.workMarket.totalReadyShards, 1);
  equal(readout.workMarket.totalClaimedShards, 1);
  equal(readout.workMarket.totalStaleClaims, 1);
  equal(readout.workMarket.queuePressure, "elevated");
  equal(readout.workMarket.queues[0]?.activeClaims[0]?.claimId, "claim-stale");
});

test("observeForHat rolls subordinate work-market pressure up to executive scope", () => {
  const hats = buildHatDefinitions();
  const byId = new Map<string, HatDefinition>(hats.map((h) => [h.id, h]));
  const ceo = byId.get("ceo")!;
  const state: OrgWorkState = {
    organizationId: "org-lfg",
    hats: byId,
    batches: [],
    itemsByBatch: new Map(),
    events: [],
    workQueues: [backendQueue()],
    now: "2026-05-31T12:30:00.000Z",
  };

  const readout = observeForHat(ceo, state);

  equal(readout.workMarket.hatId, "ceo");
  equal(readout.workMarket.totalReadyShards, 1);
  equal(readout.workMarket.totalClaimedShards, 1);
  equal(readout.workMarket.queues[0]?.queueId, "queue-backend-project-1");
});

test("observeForHat exposes schedule pressure and legal reassignment actions", () => {
  const hats = buildHatDefinitions();
  const byId = new Map<string, HatDefinition>(hats.map((h) => [h.id, h]));
  const ceo = byId.get("ceo")!;
  const state: OrgWorkState = {
    organizationId: "org-lfg",
    hats: byId,
    batches: [],
    itemsByBatch: new Map(),
    events: [],
    workQueues: [backendQueue()],
    scheduleBlocks: [scheduleBlock()],
    hatBindings: [hatBinding({ phase: HatBindingPhase.Expired })],
    now: "2026-05-31T12:30:00.000Z",
    reviewLagMsByHat: new Map([["backend_implementer", 2 * 60 * 60 * 1000]]),
    failureRateByHat: new Map([["backend_implementer", 0.25]]),
    heartbeatReliabilityByHat: new Map([["backend_implementer", 0.5]]),
  };

  const readout = observeForHat(ceo, state);

  equal(readout.schedulePressure.level, SchedulePressureLevel.Critical);
  equal(readout.schedulePressure.visibleHatIds.includes("backend_implementer"), true);
  ok(readout.schedulePressure.signals.some((signal) => signal.kind === "expired_hat_binding"));
  ok(readout.schedulePressure.correctiveActions.some((action) => action.kind === ScheduleCorrectiveActionKind.ReassignAfterExpiry));
});

test("authorityScopeOf maps every level", () => {
  equal(authorityScopeOf(HatLevel.ExecutiveBoard), AuthorityScope.Organization);
  equal(authorityScopeOf(HatLevel.Director), AuthorityScope.Department);
  equal(authorityScopeOf(HatLevel.Lead), AuthorityScope.Team);
  equal(authorityScopeOf(HatLevel.IndividualContributor), AuthorityScope.Individual);
});

function backendQueue(): HatWorkQueue {
  return {
    queueId: "queue-backend-project-1",
    organizationId: "org-lfg",
    hatId: "backend_implementer",
    scope: { kind: "project", id: "proj-1" },
    shardability: "by_component",
    requiredSkills: ["typescript"],
    reviewQuorum: {
      requiredApprovals: 1,
      reviewerHatIds: ["architect_reviewer"],
      allowProducerApproval: false,
    },
    shards: [
      {
        shardId: "shard-ready",
        workItemId: "work-ready",
        title: "Ready shard",
        priority: 80,
        state: WorkShardState.Ready,
        dependencyShardIds: [],
        mergePolicy: "independent",
      },
      {
        shardId: "shard-claimed",
        workItemId: "work-claimed",
        title: "Claimed shard",
        priority: 90,
        state: WorkShardState.Claimed,
        dependencyShardIds: [],
        mergePolicy: "independent",
        claimedByClaimId: "claim-stale",
      },
    ],
    claims: [
      {
        claimId: "claim-stale",
        shardId: "shard-claimed",
        ownerAgentId: "agent-backend-1",
        hatAssignmentId: "hat-backend-1",
        fencingToken: "fence-1",
        leaseExpiresAt: "2026-05-31T12:00:00.000Z",
        heartbeatAt: "2026-05-31T11:55:00.000Z",
        scheduleBlockId: "block-1",
        runtimeSessionId: "session-1",
        workspaceRef: "worktree:agent-backend-1",
        credentialScope: "tenant:org-lfg:repo:agentic-organization",
        compensatingAction: "release_claim_and_requeue_shard",
        state: WorkClaimState.Active,
        claimedAt: "2026-05-31T11:45:00.000Z",
      },
    ],
    reviews: [],
  };
}

function scheduleBlock(input: Partial<WorkScheduleBlock> = {}): WorkScheduleBlock {
  return {
    workScheduleBlockId: "block-backend",
    organizationId: "org-lfg",
    projectId: "proj-1",
    workItemId: "work-claimed",
    assignedAgentId: "agent-backend-1",
    assignedHatAssignmentId: "hat-backend-1",
    blockType: ScheduleBlockType.PrioritizedWork,
    state: ScheduleBlockState.Active,
    title: "Backend focus",
    purpose: "Implement backend shard",
    startsAt: "2026-05-31T12:00:00.000Z",
    endsAt: "2026-05-31T13:00:00.000Z",
    scheduledAt: "2026-05-31T11:30:00.000Z",
    scheduledBy: { agentId: "agent-manager", hatAssignmentId: "hat-manager" },
    metadata: { updatedAt: "2026-05-31T11:30:00.000Z", version: 1, correlationId: "corr", causationId: "cause", traceId: "trace" },
    ...input,
  };
}

function hatBinding(input: Partial<HatBinding> = {}): HatBinding {
  return {
    id: "hat-backend-1",
    organizationId: "org-lfg",
    hatId: "backend_implementer",
    wearerAgentId: "agent-backend-1",
    phase: HatBindingPhase.Active,
    boundAt: "2026-05-31T11:00:00.000Z",
    warmupEndsAt: "2026-05-31T11:05:00.000Z",
    expiresAt: "2026-05-31T12:00:00.000Z",
    activatedAt: "2026-05-31T11:05:00.000Z",
    ...input,
  };
}
