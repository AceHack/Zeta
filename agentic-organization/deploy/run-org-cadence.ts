/**
 * Prove TRACK A (Activate) in kind: the SAME cadence composition the always-on
 * worker drives (composeOrgCadenceLoops) advances real Cockroach state — the Work
 * OS living loop, the memory maintenance cycle, and change-control review — bounded
 * to a few ticks per lane. This is exactly what the deployed worker now runs on its
 * own cadences (A0 wired it into apps/workers/src/main.ts); here we run it bounded so
 * the effect is observable without waiting on the worker's intervals.
 *
 *   kubectl -n agentic-org port-forward svc/cockroach 26257:26257 &
 *   COCKROACH_DATABASE_URL=postgresql://root@localhost:26257/defaultdb?sslmode=disable \
 *     node --experimental-strip-types deploy/run-org-cadence.ts
 */

import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { env } from "node:process";

import { ChangeSetPhase, MemoryPhase, MemoryTier, OrgEventKind, ScheduleBlockState, ScheduleBlockType, ToolBundle, type ChangeSet, type MemoryRecord, type MemoryState, type OrgEvent } from "../packages/domain/src/index.ts";
import {
  ActionClass,
  PromptFlowGateKind,
  PromptFlowRunState,
  buildInternalOnlyPipeline,
  compilePromptFlowTasks,
  createContentAddressedEvidenceRef,
  createReputationOutcomeOrgEvent,
  materializeRmoCandidateReputation,
  projectReputationReadModelFromOrgEvents,
  rankRmoHatCandidates,
  selectRmoCandidateWithExploration,
  ReputationOutcomeClass,
  ReputationRiskTier,
  RunLifecyclePhase,
  RunScope,
  WorkMarketClaimOutcome,
  WorkMarketCompleteOutcome,
  WorkMarketMergeOutcome,
  WorkMarketQuorumOutcome,
  RuntimeLeaseState,
  WorkShardState,
  claimNextWorkShard,
  completeWorkClaim,
  evaluateWorkShardReviewQuorum,
  mergeReviewedWorkShards,
  reapStaleWorkClaims,
  workMarketReadoutForHat,
  type HatWorkQueue,
  type ScopedMetricAgent,
} from "../packages/application/src/index.ts";
import {
  createCockroachCoreStateMigrations,
  createCockroachSqlExecutor,
  createCockroachMemoryStateStore,
  createCockroachChangeSetStore,
  createCockroachOrgEventStore,
  CockroachTableName,
  splitSqlStatements,
} from "../packages/state-cockroach/src/index.ts";
import { composeOrgCadenceLoops, type ObserveActPromotionWindow } from "../apps/workers/src/org-cadence-composition.ts";
import {
  evaluateSimulationRisk,
  runOrgPolicySimulation,
} from "../packages/simulator/src/index.ts";
import type { CockroachSqlClient } from "../packages/state-cockroach/src/cockroach-sql-executor.ts";

const connectionString = env.COCKROACH_DATABASE_URL ?? "postgresql://root@localhost:26257/defaultdb?sslmode=disable";
const ORG = "org-lfg";
const NOW = Date.now();
const NOW_ISO = new Date(NOW).toISOString();
const id = (p: string) => `${p}-${randomUUID()}`;
const OBSERVE_ACT_WORK_ITEM_ID = id("work-observe-act");

function observeActPromotionWindowFromEvents(
  events: readonly OrgEvent[],
  now: number,
): ObserveActPromotionWindow {
  const occurredAt = events
    .map((event) => Date.parse(event.occurredAt))
    .filter((timestamp) => Number.isFinite(timestamp));
  const earliest = occurredAt.length === 0 ? now : Math.min(...occurredAt);
  const shadowSoakHours = Math.max(0, (now - earliest) / (60 * 60 * 1000));
  const shadowIllegalSelections = events.filter((event) =>
    event.evidenceRefs.some((ref) => ref.startsWith("observe-act:selector_rejected:") || ref === "observe-act:selected_slot:illegal")
  ).length;
  const divergenceCount = events.filter((event) =>
    event.evidenceRefs.some((ref) => ref.startsWith("observe-act:shadow_divergence:"))
  ).length;
  return {
    shadowTickCount: events.length,
    shadowSoakHours,
    shadowDivergenceRate: events.length === 0 ? 1 : divergenceCount / events.length,
    shadowIllegalSelections,
    primarySelectorRejections30m: events.filter((event) =>
      Date.parse(event.occurredAt) >= now - 30 * 60 * 1000 &&
      event.evidenceRefs.some((ref) => ref.startsWith("observe-act:selector_rejected:"))
    ).length,
    primaryControlBypassRejections30m: events.filter((event) =>
      Date.parse(event.occurredAt) >= now - 30 * 60 * 1000 &&
      event.evidenceRefs.some((ref) => ref.startsWith("observe-act:control_bypass_rejected:"))
    ).length,
  };
}

function assertObserveActPrimaryEvidence(event: OrgEvent): void {
  const requiredEvidence = [
    "observe-act:menu_hash:",
    "observe-act:selected_slot:4",
    "observe-act:veto_count:",
    "observe-act:prompt_flow:flow-backend-code-change",
    "observe-act:metric:prompt_flow.required_evidence",
  ];
  for (const expected of requiredEvidence) {
    const present = expected.endsWith(":")
      ? event.evidenceRefs.some((ref) => ref.startsWith(expected))
      : event.evidenceRefs.includes(expected);
    if (!present) throw new Error(`expected primary observe-act evidence ${expected}`);
  }
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString });
  const client: CockroachSqlClient = { query: async (sql, p) => ({ rows: (await pool.query(sql, p as unknown[])).rows }), transaction: async (op) => op(client) };
  const executor = createCockroachSqlExecutor({ client });
  for (const migration of createCockroachCoreStateMigrations()) {
    for (const s of splitSqlStatements(migration.sql)) await pool.query(s);
  }
  const orgEventStore = createCockroachOrgEventStore({ executor });

  // seed: an aged+useless memory (the maintenance lane should archive it) + an in_review ChangeSet
  const memId = id("mem-cadence");
  const at = NOW_ISO;
  const memRecord: MemoryRecord = { memoryId: memId, organizationId: ORG, tier: MemoryTier.Work, scope: "work-cadence", key: "old-note", value: "", protected: false, writtenBy: "system", writtenAt: at };
  const memState: MemoryState = { memoryId: memId, organizationId: ORG, phase: MemoryPhase.Active, confidence: 0.2, weight: 0.1, freshnessAt: new Date(NOW - 120 * 86_400_000).toISOString(), reinforcementCount: 1, outcome: { successCount: 0, failureCount: 5, inconclusiveCount: 0, workItemsObserved: [] }, utility: { injectedCount: 12, citedCount: 0 }, crossScope: { distinctScopes: [], firstObservedAt: at, lastObservedAt: at } };
  await createCockroachMemoryStateStore({ executor }).upsert(memRecord, memState);

  const csId = id("cs-cadence");
  const cs: ChangeSet = { changeSetId: csId, organizationId: ORG, workItemId: id("work"), proposerHatId: "code_author", title: "Cadence-driven change", targetRef: "feat/cadence", phase: ChangeSetPhase.InReview, pipelineId: buildInternalOnlyPipeline(ORG).pipelineId, currentStageIndex: 0, artifacts: [{ kind: "code_diff", path: "a.ts", diff: "+x", language: "ts" }], projections: [], revision: 2, openedAt: at, updatedAt: at };
  await createCockroachChangeSetStore({ executor }).upsert(cs);
  const reputationObservations = [
    reputationObservation("agent-observe-act", ReputationOutcomeClass.Quality, { kind: "binary" as const, success: true }, "evidence:agent-observe-act:quality-pass"),
    reputationObservation("agent-observe-act", ReputationOutcomeClass.Collaboration, { kind: "binary" as const, success: true }, "evidence:agent-observe-act:collaboration-pass"),
    reputationObservation("agent-explorer", ReputationOutcomeClass.Quality, { kind: "binary" as const, success: true }, "evidence:agent-explorer:quality-pass"),
    reputationObservation("agent-regressed", ReputationOutcomeClass.Quality, { kind: "binary" as const, success: false }, "evidence:agent-regressed:quality-fail"),
    reputationObservation("agent-regressed", ReputationOutcomeClass.Quality, { kind: "binary" as const, success: false }, "evidence:agent-regressed:quality-fail-2"),
  ];
  for (const [index, observation] of reputationObservations.entries()) {
    await orgEventStore.append(createReputationOutcomeOrgEvent({
      eventId: id(`evt-reputation-cadence-${index}`),
      observedAt: at,
      organizationId: ORG,
      observation,
      correlationId: "corr-reputation-cadence",
      causationId: "cause-reputation-cadence",
      traceId: "trace-reputation-cadence",
    }));
  }
  const seededEvents = await orgEventStore.listByOrganization(ORG, 200);
  const seededReputationEvents = seededEvents.filter((e) => e.kind === "reputation_outcome_observed");
  if (seededReputationEvents.length < reputationObservations.length) {
    throw new Error(`expected ${reputationObservations.length} durable reputation observations, found ${seededReputationEvents.length}`);
  }
  const reputationReadModel = projectReputationReadModelFromOrgEvents({ events: seededReputationEvents });
  const reputationRanked = rankRmoHatCandidates({
    hatId: "backend_implementer",
    candidates: ["agent-observe-act", "agent-explorer", "agent-regressed"].map((agentId) =>
      materializeRmoCandidateReputation({
        readModel: reputationReadModel,
        organizationId: ORG,
        agentId,
        hatId: "backend_implementer",
        workType: "code_change",
        currentLoad: 0,
        consecutiveAssignmentCount: agentId === "agent-observe-act" ? 4 : 0,
        recentSameHatAssignments: agentId === "agent-observe-act" ? 4 : 0,
      })),
  });
  const reputationSelection = selectRmoCandidateWithExploration({
    rankedCandidates: reputationRanked,
    riskTier: ReputationRiskTier.Normal,
    explorationSeed: "kind-reputation-proof",
    explorationRate: 1,
  });
  if (reputationSelection.outcome !== "selected") {
    throw new Error(`expected reputation-backed RMO selection, got ${reputationSelection.reason}`);
  }
  if (!reputationRanked.some((candidate) => candidate.reasonCodes.includes("posterior_reputation_evidence"))) {
    throw new Error("expected RMO candidates to carry posterior reputation evidence");
  }
  const testEvidenceRef = createContentAddressedEvidenceRef("test-result", { proof: "org-cadence", status: "green" });
  const diffEvidenceRef = createContentAddressedEvidenceRef("diff", { proof: "org-cadence", status: "reviewable" });
  const contextEvidenceRef = createContentAddressedEvidenceRef("context", { proof: "org-cadence", status: "loaded" });
  const workMarketProof = runWorkMarketProof({
    implementationEvidenceRef: createContentAddressedEvidenceRef("test-result", { proof: "work-market", status: "implemented" }),
    reviewEvidenceRef: createContentAddressedEvidenceRef("review", { proof: "work-market", status: "peer-approved" }),
  });
  const simulationReport = runOrgPolicySimulation({
    organizationId: ORG,
    seed: "kind-org-cadence-phase-2-7",
    stream: [
      { eventId: "sim-intake-1", kind: "work_intake", occurredAt: new Date(NOW - 900_000).toISOString(), workItemId: OBSERVE_ACT_WORK_ITEM_ID, priority: 100 },
      { eventId: "sim-complete-1", kind: "work_completed", occurredAt: new Date(NOW - 480_000).toISOString(), workItemId: OBSERVE_ACT_WORK_ITEM_ID, leadTimeMs: 420_000 },
      { eventId: "sim-review-1", kind: "review_lag", occurredAt: new Date(NOW - 420_000).toISOString(), workItemId: OBSERVE_ACT_WORK_ITEM_ID, lagMs: 180_000 },
      { eventId: "sim-stale-1", kind: "stale_claim", occurredAt: new Date(NOW - 360_000).toISOString(), workItemId: OBSERVE_ACT_WORK_ITEM_ID },
    ],
    baseline: {
      overlayId: "kind-baseline",
      autonomyLevel: "assisted",
      modelMapping: { backend_implementer: "gpt-5.5" },
      modelCostPerWorkItem: 10,
      gateQuorum: 2,
    },
    candidate: {
      overlayId: "kind-schedule-rebalance",
      autonomyLevel: "assisted",
      modelMapping: { backend_implementer: "gpt-5.5" },
      modelCostPerWorkItem: 10,
      schedulePolicy: "rebalance_critical_hats",
      leadTimeMultiplier: 0.5,
      reviewLagMultiplier: 0.5,
      staleClaimMultiplier: 0,
      gateQuorum: 2,
    },
  });
  const simulationDecision = evaluateSimulationRisk(simulationReport, {
    maxEscapedDefectRegression: 0,
    maxClassBEscapedDefectRegression: 0,
    maxIncidentRegression: 0,
    maxConformanceFailureRegression: 0,
    minThroughputDelta: 0,
  });
  if (simulationDecision.status !== "accepted") {
    throw new Error(`expected schedule policy simulation accepted, got ${simulationDecision.reason}`);
  }
  const simulationEvidenceRef = createContentAddressedEvidenceRef("simulation-report", {
    report: simulationReport,
    decision: simulationDecision,
  });
  const observeActScheduleBlock = {
    workScheduleBlockId: id("schedule-observe-act"),
    organizationId: ORG,
    projectId: "proj-observe-act",
    workItemId: OBSERVE_ACT_WORK_ITEM_ID,
    assignedAgentId: "agent-observe-act",
    assignedHatAssignmentId: "99",
    blockType: ScheduleBlockType.PrioritizedWork,
    state: ScheduleBlockState.Active,
    title: "KIND observe-act schedule authority",
    purpose: "Prove observe-act lifecycle commands require current schedule authority",
    startsAt: new Date(NOW - 60_000).toISOString(),
    endsAt: new Date(NOW + 600_000).toISOString(),
    scheduledAt: new Date(NOW - 120_000).toISOString(),
    scheduledBy: { agentId: "agent-rmo", hatAssignmentId: "hat-rmo" },
    metadata: { updatedAt: NOW_ISO, version: 1, correlationId: "corr-schedule-kind", causationId: "cause-schedule-kind", traceId: "trace-schedule-kind" },
  };
  await pool.query(
    `
      INSERT INTO ${CockroachTableName.WorkScheduleBlocks} (
        work_schedule_block_id,
        organization_id,
        project_id,
        team_id,
        work_item_id,
        discussion_anchor_id,
        assigned_agent_id,
        assigned_hat_assignment_id,
        block_type,
        state,
        title,
        purpose,
        starts_at,
        ends_at,
        scheduled_by_agent_id,
        scheduled_by_hat_assignment_id,
        scheduled_at,
        updated_at,
        version,
        correlation_id,
        causation_id,
        trace_id
      ) VALUES ($1, $2, $3, NULL, $4, NULL, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
    `.trim(),
    [
      observeActScheduleBlock.workScheduleBlockId,
      observeActScheduleBlock.organizationId,
      observeActScheduleBlock.projectId,
      observeActScheduleBlock.workItemId,
      observeActScheduleBlock.assignedAgentId,
      observeActScheduleBlock.assignedHatAssignmentId,
      observeActScheduleBlock.blockType,
      observeActScheduleBlock.state,
      observeActScheduleBlock.title,
      observeActScheduleBlock.purpose,
      observeActScheduleBlock.startsAt,
      observeActScheduleBlock.endsAt,
      observeActScheduleBlock.scheduledBy.agentId,
      observeActScheduleBlock.scheduledBy.hatAssignmentId,
      observeActScheduleBlock.scheduledAt,
      observeActScheduleBlock.metadata.updatedAt,
      observeActScheduleBlock.metadata.version,
      observeActScheduleBlock.metadata.correlationId,
      observeActScheduleBlock.metadata.causationId,
      observeActScheduleBlock.metadata.traceId,
    ],
  );
  const promptFlowTasks = compilePromptFlowTasks({
    definitions: [{
      promptFlowId: "flow-backend-code-change",
      version: "1.0.0",
      name: "Backend code-change flow",
      ownerDepartmentId: "engineering",
      allowedHatIds: ["backend_implementer"],
      requiredScope: RunScope.WorkItem,
      reviewerHatIds: ["code_reviewer"],
      rollbackPolicy: { kind: "compensating_action", description: "revert patch and release claim" },
      phases: [
        {
          phaseId: "context",
          label: "Load backend context",
          actionClass: ActionClass.WriteDoc,
          permittedUniversalActions: ["load_context"],
          directions: ["Load work item", "Load initiative constraints"],
          requiredToolBundles: [ToolBundle.Task],
          toolInjections: [{ tool: "repo.search", args: { workItemId: OBSERVE_ACT_WORK_ITEM_ID } }],
          contextArtifactRefs: [`work:${OBSERVE_ACT_WORK_ITEM_ID}`, "decision:observe-act"],
          requiredEvidenceRefs: [contextEvidenceRef],
          gate: { kind: PromptFlowGateKind.Evidence, requiredEvidenceRefs: [contextEvidenceRef] },
          timeoutSeconds: 300,
          retryLimit: 1,
          metrics: [{ id: "prompt_flow.context_artifacts", label: "context artifacts", value: 2, unit: "count" }],
        },
        {
          phaseId: "execute",
          label: "Execute backend change",
          actionClass: ActionClass.WriteCode,
          permittedUniversalActions: ["execute", "submit_evidence"],
          directions: ["Patch the smallest surface", "Run focused tests"],
          requiredToolBundles: [ToolBundle.Delivery],
          toolInjections: [{ tool: "repo.patch", args: { workItemId: OBSERVE_ACT_WORK_ITEM_ID } }],
          contextArtifactRefs: [`work:${OBSERVE_ACT_WORK_ITEM_ID}`, "decision:observe-act"],
          requiredEvidenceRefs: [testEvidenceRef, diffEvidenceRef],
          gate: { kind: PromptFlowGateKind.Evidence, requiredEvidenceRefs: [testEvidenceRef, diffEvidenceRef] },
          timeoutSeconds: 900,
          retryLimit: 2,
          metrics: [{ id: "prompt_flow.required_evidence", label: "required evidence", value: 2, unit: "count" }],
        },
      ],
    }],
    runs: [{
      runId: "prompt-flow-run-observe-act",
      promptFlowId: "flow-backend-code-change",
      definitionVersion: "1.0.0",
      workItemId: OBSERVE_ACT_WORK_ITEM_ID,
      scope: RunScope.WorkItem,
      currentPhaseId: "context",
      state: PromptFlowRunState.RunningPhase,
      priority: 100,
    }],
  });
  const observeActMetricAgents: readonly ScopedMetricAgent[] = [{
    id: "kind-required-evidence-metric",
    scope: RunScope.WorkItem,
    compute: async () => ({
      id: "prompt_flow.required_evidence",
      label: "required prompt-flow evidence",
      value: 2,
      unit: "count",
    }),
  }];
  const pinnedShadowWindow: ObserveActPromotionWindow = {
    shadowTickCount: 0,
    shadowSoakHours: 0,
    shadowDivergenceRate: 0,
    shadowIllegalSelections: 0,
    primarySelectorRejections30m: 0,
    primaryControlBypassRejections30m: 0,
  };
  const historicalShadow = composeOrgCadenceLoops({
    executor, organizationId: ORG, now: () => NOW - 24 * 60 * 60 * 1000, createId: id,
    intervals: { workOsMs: 0, memoryMaintenanceMs: 0, changeControlMs: 0, docMaintenanceMs: 0 },
    sleep: async () => {},
    intake: async () => null,
    workOsDriver: "observe-act-shadow",
    observeActPromotionWindow: pinnedShadowWindow,
    observeActWorkItems: async () => ({
      runId: "0",
      projectId: "proj-observe-act",
      workItemId: OBSERVE_ACT_WORK_ITEM_ID,
      scope: RunScope.WorkItem,
      phase: RunLifecyclePhase.AwaitingGate,
      hasGateApproval: true,
      hasEvidence: false,
      hatId: "backend_implementer",
      hatAssignmentId: "99",
      agentId: "agent-observe-act",
      scheduleBlocks: [observeActScheduleBlock],
      promptFlowTasks,
    }),
    observeActSelectSlot: () => 4,
    observeActMetricAgents,
    observeActRunCommand: async () => {
      throw new Error("historical observe-act shadow proof should not dispatch commands");
    },
    observeActDispatchTool: async () => {
      throw new Error("historical observe-act shadow proof should not dispatch MCP");
    },
    maxTicksPerLane: 1,
  });
  await historicalShadow.done;

  // run the SAME composition the worker drives, bounded to a few ticks per lane
  const laneTicks: { lane: string; tick: number; status: string }[] = [];
  const cadence = composeOrgCadenceLoops({
    executor, organizationId: ORG, now: () => NOW, createId: id,
    intervals: { workOsMs: 0, memoryMaintenanceMs: 0, changeControlMs: 0, docMaintenanceMs: 0 },
    sleep: async () => {},
    // synthetic pending work so the Work OS lane exercises in this bounded proof
    intake: async () => ({ projectId: id("proj"), initiativeId: id("init"), initiativeBranch: "feat/cadence-auto" }),
    workOsDriver: "observe-act-shadow",
    observeActPromotionWindow: pinnedShadowWindow,
    observeActWorkItems: async () => ({
      runId: "1",
      projectId: "proj-observe-act",
      workItemId: OBSERVE_ACT_WORK_ITEM_ID,
      scope: RunScope.WorkItem,
      phase: RunLifecyclePhase.AwaitingGate,
      hasGateApproval: true,
      hasEvidence: false,
      hatId: "backend_implementer",
      hatAssignmentId: "99",
      agentId: "agent-observe-act",
      scheduleBlocks: [observeActScheduleBlock],
      promptFlowTasks,
    }),
    observeActSelectSlot: () => 4,
    observeActMetricAgents,
    observeActRunCommand: async () => {
      throw new Error("org-cadence observe-act shadow proof should not dispatch commands");
    },
    observeActDispatchTool: async () => {
      throw new Error("org-cadence observe-act shadow proof should not dispatch MCP");
    },
    maxTicksPerLane: 3,
    observer: { record: (r) => laneTicks.push({ lane: r.lane, tick: r.tick, status: r.status }) },
  });
  await cadence.done;
  const observedShadowEvents = (await orgEventStore.listByOrganization(ORG, 100_000))
    .filter((event) => event.kind === OrgEventKind.ObserveActTick && event.subjectId === OBSERVE_ACT_WORK_ITEM_ID);
  if (!observedShadowEvents.some((event) => event.traceId === "observe-act-0")) {
    throw new Error("expected historical shadow soak to come from the observe-act lane");
  }
  if (!observedShadowEvents.some((event) => event.traceId === "observe-act-1")) {
    throw new Error("expected current shadow proof ticks from the observe-act lane");
  }
  const observedPromotionWindow = observeActPromotionWindowFromEvents(observedShadowEvents, NOW);
  if (observedPromotionWindow.shadowTickCount < 100 && observedPromotionWindow.shadowSoakHours < 24) {
    throw new Error(`expected measured observe-act shadow window to satisfy tick or soak gate, got ${JSON.stringify(observedPromotionWindow)}`);
  }
  if (observedPromotionWindow.shadowIllegalSelections !== 0 || observedPromotionWindow.shadowDivergenceRate > 0.05) {
    throw new Error(`expected clean observe-act shadow window, got ${JSON.stringify(observedPromotionWindow)}`);
  }

  const primaryPromotionTicks: { lane: string; tick: number; status: string }[] = [];
  const promoted = composeOrgCadenceLoops({
    executor, organizationId: ORG, now: () => NOW, createId: id,
    intervals: { workOsMs: 0, memoryMaintenanceMs: 0, changeControlMs: 0, docMaintenanceMs: 0 },
    sleep: async () => {},
    intake: async () => {
      throw new Error("promoted observe-act primary proof should not run legacy work-os");
    },
    workOsDriver: "observe-act-shadow",
    observeActPromotionWindow: observedPromotionWindow,
    observeActWorkItems: async () => ({
      runId: "2",
      projectId: "proj-observe-act",
      workItemId: OBSERVE_ACT_WORK_ITEM_ID,
      scope: RunScope.WorkItem,
      phase: RunLifecyclePhase.AwaitingGate,
      hasGateApproval: true,
      hasEvidence: false,
      hatId: "backend_implementer",
      hatAssignmentId: "99",
      agentId: "agent-observe-act",
      scheduleBlocks: [observeActScheduleBlock],
      promptFlowTasks,
    }),
    observeActSelectSlot: () => 4,
    observeActMetricAgents,
    observeActRunCommand: async () => ({ status: "accepted_primary_promotion" }),
    observeActDispatchTool: async () => {
      throw new Error("promoted observe-act primary proof should not dispatch MCP");
    },
    maxTicksPerLane: 1,
    observer: { record: (r) => primaryPromotionTicks.push({ lane: r.lane, tick: r.tick, status: r.status }) },
  });
  await promoted.done;
  const primaryPromotionStatus = primaryPromotionTicks.find((tick) => tick.lane === "observe-act-work-item")?.status;
  if (primaryPromotionStatus !== "observe-act:command:accepted_primary_promotion") {
    throw new Error(`expected observe-act primary promotion proof, got ${primaryPromotionStatus ?? "missing"}`);
  }
  if (!primaryPromotionTicks.some((tick) => tick.lane === "work-os" && tick.status === "work-os:observe-act-primary-suppressed")) {
    throw new Error("promoted observe-act primary proof did not suppress legacy work-os");
  }

  const memAfter = await createCockroachMemoryStateStore({ executor }).get(memId);
  const csAfter = await createCockroachChangeSetStore({ executor }).get(csId);
  const events = await orgEventStore.listByOrganization(ORG, 1000);
  const recent = events.filter((e) => e.kind.startsWith("work_item") || e.kind.startsWith("memory_") || e.kind.startsWith("change_set") || e.kind.startsWith("review_") || e.kind.startsWith("stage_"));
  const observeActEvents = events.filter((e) => e.kind === "observe_act_tick");
  const primaryPromotionEvent = observeActEvents.find((e) => e.traceId === "observe-act-2");
  if (!primaryPromotionEvent?.evidenceRefs.includes("observe-act-promotion:decision:shadow_window_clean")) {
    throw new Error("expected observe-act primary promotion decision evidence");
  }
  assertObserveActPrimaryEvidence(primaryPromotionEvent);
  const reputationEvents = events.filter((e) => e.kind === "reputation_outcome_observed");

  console.log(JSON.stringify({
    orgCadence: {
      laneTicks,
      observeActShadow: {
        ticked: laneTicks.some((tick) => tick.lane === "observe-act-work-item"),
        evidenceRows: observeActEvents.length,
        lastEvidenceRefs: observeActEvents[0]?.evidenceRefs ?? [],
        promptFlowEvidenceRows: observeActEvents.filter((e) => e.evidenceRefs.some((ref) => ref.startsWith("observe-act:prompt_flow:"))).length,
        shadowSelectedRows: laneTicks.filter((tick) => tick.lane === "observe-act-work-item" && tick.status === "observe-act-shadow:command:shadow_selected").length,
        scheduleBlockId: observeActScheduleBlock.workScheduleBlockId,
      },
      observeActPrimaryPromotion: {
        ticked: primaryPromotionTicks.some((tick) => tick.lane === "observe-act-work-item"),
        primaryStatus: primaryPromotionStatus,
        legacySuppressed: primaryPromotionTicks.some((tick) => tick.lane === "work-os" && tick.status === "work-os:observe-act-primary-suppressed"),
        measuredWindow: observedPromotionWindow,
        evidenceRefs: primaryPromotionEvent.evidenceRefs.filter((ref) => ref.startsWith("observe-act-promotion:")),
      },
      seededMemory: { memoryId: memId, phaseAfter: memAfter?.state.phase, weightAfter: memAfter?.state.weight, surfaces: memAfter?.state.phase !== MemoryPhase.Archived },
      seededChangeSet: { changeSetId: csId, phaseAfter: csAfter?.phase, revisionAfter: csAfter?.revision },
      reputation: {
        durableSeededEventRows: seededReputationEvents.length,
        finalWindowEventRows: reputationEvents.length,
        ranked: reputationRanked.map((candidate) => ({
          agentId: candidate.agentId,
          rank: candidate.rank,
          score: candidate.score,
          qualityMean: candidate.posterior?.quality.mean,
          qualityLcb: candidate.posterior?.quality.lowerConfidenceBound,
          uncertainty: candidate.posterior?.quality.uncertainty,
          reasons: candidate.reasonCodes,
        })),
        selection: reputationSelection.outcome === "selected"
          ? { agentId: reputationSelection.selected.agentId, reason: reputationSelection.reason }
          : { reason: reputationSelection.reason },
      },
      workMarket: workMarketProof,
      simulation: {
        evidenceRef: simulationEvidenceRef,
        decision: simulationDecision,
        baseline: simulationReport.baseline.metrics,
        candidate: simulationReport.candidate.metrics,
        scenarioKinds: simulationReport.scenarioKinds,
      },
      orgEventsObservedFromLanes: recent.length,
    },
  }, null, 2));
  await pool.end();
}

await main();

function reputationObservation(
  agentId: string,
  outcomeClass: ReputationOutcomeClass,
  signal: { kind: "binary"; success: boolean },
  evidenceRef: string,
) {
  return {
    organizationId: ORG,
    agentId,
    hatId: "backend_implementer",
    workType: "code_change",
    outcomeClass,
    observedAt: NOW_ISO,
    signal,
    evidenceRef,
  };
}

function runWorkMarketProof(input: {
  implementationEvidenceRef: string;
  reviewEvidenceRef: string;
}) {
  const first = claimNextWorkShard(workMarketQueue("queue-kind-work-market"), claimInput("agent-backend-1", "claim-api", "fence-api"));
  if (first.outcome !== WorkMarketClaimOutcome.Claimed) throw new Error("expected first same-hat shard claim");
  const second = claimNextWorkShard(first.queue, claimInput("agent-backend-2", "claim-worker", "fence-worker"));
  if (second.outcome !== WorkMarketClaimOutcome.Claimed) throw new Error("expected second same-hat shard claim");
  if (first.claim.shardId === second.claim.shardId) throw new Error("same-hat agents duplicated a shard claim");
  if (first.runtimeLease.fencingToken !== first.claim.fencingToken || second.runtimeLease.fencingToken !== second.claim.fencingToken) {
    throw new Error("expected runtime leases to carry claim fencing tokens");
  }
  const duplicateRuntimeLease = claimNextWorkShard(second.queue, claimInput("agent-backend-3", "claim-duplicate-runtime", "fence-duplicate-runtime", {
    runtimeLeaseId: first.runtimeLease.leaseId,
  }));
  if (duplicateRuntimeLease.outcome !== WorkMarketClaimOutcome.Rejected || duplicateRuntimeLease.reason !== "duplicate_runtime_lease_id") {
    throw new Error("expected duplicate runtime lease id rejection");
  }

  const afterFirstComplete = completeWorkClaim(second.queue, {
    claimId: first.claim.claimId,
    fencingToken: first.claim.fencingToken,
    now: new Date(NOW + 60_000).toISOString(),
    completedAt: new Date(NOW + 60_000).toISOString(),
    evidenceRefs: [input.implementationEvidenceRef],
  });
  if (afterFirstComplete.outcome !== WorkMarketCompleteOutcome.Completed) throw new Error(`expected first completion, got ${afterFirstComplete.reason}`);
  const afterSecondComplete = completeWorkClaim(afterFirstComplete.queue, {
    claimId: second.claim.claimId,
    fencingToken: second.claim.fencingToken,
    now: new Date(NOW + 120_000).toISOString(),
    completedAt: new Date(NOW + 120_000).toISOString(),
    evidenceRefs: [input.implementationEvidenceRef],
  });
  if (afterSecondComplete.outcome !== WorkMarketCompleteOutcome.Completed) throw new Error(`expected second completion, got ${afterSecondComplete.reason}`);

  const selfOnly = evaluateWorkShardReviewQuorum(afterSecondComplete.queue, {
    shardId: first.claim.shardId,
    producerAgentId: first.claim.ownerAgentId,
    approvals: [{
      reviewerAgentId: first.claim.ownerAgentId,
      reviewerHatId: "backend_implementer",
      approved: true,
      evidenceRef: "evidence:self-review",
      reviewedAt: new Date(NOW + 180_000).toISOString(),
    }],
  });
  if (selfOnly.outcome !== WorkMarketQuorumOutcome.Rejected || selfOnly.reason !== "self_only_review") {
    throw new Error("expected self-only review quorum rejection");
  }

  const firstReview = peerReview(afterSecondComplete.queue, first.claim.shardId, first.claim.ownerAgentId, input.reviewEvidenceRef);
  const secondReview = peerReview(firstReview.queue, second.claim.shardId, second.claim.ownerAgentId, input.reviewEvidenceRef);
  const merged = mergeReviewedWorkShards(secondReview.queue, {
    shardIds: [first.claim.shardId, second.claim.shardId],
    reviews: [firstReview.review, secondReview.review],
    mergedAt: new Date(NOW + 240_000).toISOString(),
  });
  if (merged.outcome !== WorkMarketMergeOutcome.Merged) throw new Error(`expected reviewed shard merge, got ${merged.reason}`);

  const staleClaim = claimNextWorkShard(workMarketQueue("queue-kind-stale"), claimInput("agent-backend-1", "claim-stale", "fence-stale", {
    now: new Date(NOW - 60_000).toISOString(),
    leaseExpiresAt: NOW_ISO,
  }));
  if (staleClaim.outcome !== WorkMarketClaimOutcome.Claimed) throw new Error("expected stale claim setup");
  const reaped = reapStaleWorkClaims(staleClaim.queue, { now: NOW_ISO, reason: "lease_expired" });
  if (reaped.reapedClaims.length !== 1) throw new Error("expected stale claim reaped");
  const reclaimed = claimNextWorkShard(reaped.queue, claimInput("agent-backend-2", "claim-reclaimed", "fence-reclaimed"));
  if (reclaimed.outcome !== WorkMarketClaimOutcome.Claimed) throw new Error("expected stale shard reclaimed");
  const oldToken = completeWorkClaim(reclaimed.queue, {
    claimId: staleClaim.claim.claimId,
    fencingToken: staleClaim.claim.fencingToken,
    now: new Date(NOW + 60_000).toISOString(),
    completedAt: new Date(NOW + 60_000).toISOString(),
    evidenceRefs: [input.implementationEvidenceRef],
  });
  if (oldToken.outcome !== WorkMarketCompleteOutcome.Rejected) throw new Error("expected old fencing token completion rejection");

  const staleRuntimeLease = claimNextWorkShard(workMarketQueue("queue-kind-runtime-stale"), claimInput("agent-backend-1", "claim-runtime-stale", "fence-runtime-stale", {
    heartbeatDeadlineAt: new Date(NOW + 60_000).toISOString(),
    leaseExpiresAt: new Date(NOW + 600_000).toISOString(),
  }));
  if (staleRuntimeLease.outcome !== WorkMarketClaimOutcome.Claimed) throw new Error("expected stale runtime lease setup");
  const runtimeReaped = reapStaleWorkClaims(staleRuntimeLease.queue, { now: new Date(NOW + 120_000).toISOString(), reason: "runtime_lease_stale" });
  if (runtimeReaped.reapedClaims.length !== 1) throw new Error("expected runtime-stale claim reaped");
  if (runtimeReaped.queue.runtimeLeases?.[0]?.state !== RuntimeLeaseState.Expired) throw new Error("expected runtime lease expired during reaping");

  const mismatchedRuntimeLease = claimNextWorkShard(workMarketQueue("queue-kind-runtime-mismatch"), claimInput("agent-backend-1", "claim-runtime-mismatch", "fence-runtime-mismatch", {
    leaseExpiresAt: new Date(NOW + 600_000).toISOString(),
  }));
  if (mismatchedRuntimeLease.outcome !== WorkMarketClaimOutcome.Claimed) throw new Error("expected mismatched runtime lease setup");
  const mismatchedRuntimeQueue = {
    ...mismatchedRuntimeLease.queue,
    runtimeLeases: mismatchedRuntimeLease.queue.runtimeLeases?.map((lease) => ({ ...lease, workspaceRef: "worktree:wrong-runtime" })),
  };
  const mismatchReaped = reapStaleWorkClaims(mismatchedRuntimeQueue, { now: new Date(NOW + 120_000).toISOString(), reason: "runtime_lease_authority_mismatch" });
  if (mismatchReaped.reapedClaims.length !== 1) throw new Error("expected authority-mismatched runtime lease reaped");

  const readout = workMarketReadoutForHat([second.queue], {
    organizationId: ORG,
    hatId: "backend_implementer",
    now: new Date(NOW + 30_000).toISOString(),
  });

  return {
    sameHatDistinctClaims: [first.claim.shardId, second.claim.shardId],
    activeClaimReadout: {
      queuePressure: readout.queuePressure,
      readyShards: readout.totalReadyShards,
      claimedShards: readout.totalClaimedShards,
      activeClaims: readout.queues[0]?.activeClaims.map((claim) => claim.claimId) ?? [],
    },
    selfOnlyReviewRejected: selfOnly.reason,
    mergedShardCount: merged.shardIds.length,
    staleClaimReaped: reaped.reapedClaims.map((claim) => claim.claimId),
    staleCompletionRejected: oldToken.reason,
    runtimeLeaseIds: [first.runtimeLease.leaseId, second.runtimeLease.leaseId],
    duplicateRuntimeLeaseRejected: duplicateRuntimeLease.reason,
    runtimeLeaseStaleReaped: runtimeReaped.reapedClaims.map((claim) => claim.claimId),
    runtimeLeaseMismatchReaped: mismatchReaped.reapedClaims.map((claim) => claim.claimId),
    mergeEvidenceRefs: merged.evidenceRefs,
  };
}

function peerReview(queue: HatWorkQueue, shardId: string, producerAgentId: string, evidenceRef: string) {
  const review = evaluateWorkShardReviewQuorum(queue, {
    shardId,
    producerAgentId,
    approvals: [{
      reviewerAgentId: `agent-reviewer-${shardId}`,
      reviewerHatId: "architect_reviewer",
      approved: true,
      evidenceRef,
      reviewedAt: new Date(NOW + 180_000).toISOString(),
    }],
  });
  if (review.outcome !== WorkMarketQuorumOutcome.Accepted) throw new Error(`expected peer review accepted, got ${review.reason}`);
  return review;
}

function claimInput(
  ownerAgentId: string,
  claimId: string,
  fencingToken: string,
  override: Partial<Parameters<typeof claimNextWorkShard>[1]> = {},
): Parameters<typeof claimNextWorkShard>[1] {
  return {
    ownerAgentId,
    hatAssignmentId: `${ownerAgentId}-backend-hat`,
    claimId,
    fencingToken,
    now: NOW_ISO,
    leaseExpiresAt: override.leaseExpiresAt ?? new Date(NOW + 300_000).toISOString(),
    heartbeatDeadlineAt: override.heartbeatDeadlineAt ?? override.leaseExpiresAt ?? new Date(NOW + 300_000).toISOString(),
    runtimeLeaseId: override.runtimeLeaseId ?? `${claimId}-runtime-lease`,
    scheduleBlockId: `${ownerAgentId}-block`,
    runtimeSessionId: `${ownerAgentId}-session`,
    workspaceRef: `worktree:${ownerAgentId}`,
    credentialScope: `tenant:${ORG}:repo:agentic-organization`,
    compensatingAction: "release_claim_and_requeue_shard",
    ...override,
  };
}

function workMarketQueue(queueId: string): HatWorkQueue {
  return {
    queueId,
    organizationId: ORG,
    hatId: "backend_implementer",
    scope: { kind: "project", id: "proj-observe-act" },
    priorityClass: "p1",
    slaDeadlineAt: new Date(NOW + 3_600_000).toISOString(),
    shardability: "by_component",
    requiredSkills: ["typescript", "worker-lanes"],
    reviewQuorum: {
      requiredApprovals: 1,
      reviewerHatIds: ["architect_reviewer", "qa_reviewer"],
      allowProducerApproval: false,
    },
    shards: [
      {
        shardId: `${queueId}-api`,
        workItemId: "work-observe-act-api",
        title: "Implement work-market API",
        priority: 100,
        state: WorkShardState.Ready,
        dependencyShardIds: [],
        mergePolicy: "independent",
      },
      {
        shardId: `${queueId}-worker`,
        workItemId: "work-observe-act-worker",
        title: "Implement work-market worker lane",
        priority: 90,
        state: WorkShardState.Ready,
        dependencyShardIds: [],
        mergePolicy: "independent",
      },
    ],
    claims: [],
    reviews: [],
  };
}
