import { deepEqual, equal, ok } from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  ActRejectionReason,
  ContextPackCurationProfileId,
  ContextPackCurationStageKind,
  ContextPackFreshness,
  ContextPackInboxAnchorPriority,
  ContextPackInboxAnchorStatus,
  ContextPackInboxWorkflowActionKind,
  ContextPackInboxWorkflowBatchKind,
  ContextPackItemKind,
  ContextPackOmissionReason,
  ContextPackRefreshReason,
  ContextPackSourcePointerKind,
  ContextPackStatus,
  ControlPlaneFlagKind,
  ControlPlaneRateLimitKind,
  ControlPlaneScopeKind,
  ObserveCommandType,
  RunLifecyclePhase,
  RunScope,
  TriAvailability,
  WorkClaimState,
  WorkShardState,
  asZetaIdDecimal,
  buildHatDefinitions,
  type ContextPackBuildRequest,
  type ContextPackEphemeralSynthesisPort,
  type ContextPackTelemetryEvidencePort,
  type ContextPackSnapshotRecord,
  type ControlPlaneFlag,
  type ControlPlaneRateLimit,
  type HatWorkQueue,
  type Menu16Slot,
} from "../../../packages/application/src/index.ts";
import {
  BusinessRuleEvaluationStatus,
  ConfigLayerScopeKind,
  DocLifecycleState,
  DocScopeKind,
  DocType,
  DiscussionAnchorType,
  DiscussionExpectedOutput,
  GraphConfidence,
  GraphEdgeKind,
  GraphNodeKind,
  HatLevel,
  MemoryPhase,
  MemoryTier,
  OrgEventKind,
  QualityGateKind,
  QualityGateOutcome,
  ScheduleBlockState,
  ScheduleBlockType,
  SupervisorChainLevel,
  SupervisorSignalStatus,
  SupervisorSignalToolType,
  TenantContextPackCompletenessSourceScope,
  TenantContextPackSynthesisRequirementReason,
  graphNodeId,
  defaultTenantConfig,
  type DocUnit,
  type GraphEdge,
  type MemoryRecord,
  type MemoryState,
  type OrgEvent,
} from "../../../packages/domain/src/index.ts";
import {
  CockroachDocConsultLedgerStoreStatement,
  CockroachContextPackAdvisoryPromotionDecisionStoreStatement,
  CockroachContextPackInboxAnchorStatement,
  CockroachMemoryStateStoreStatement,
  CockroachTenantConfigStoreStatement,
  createCockroachTenantConfigStore,
  createCockroachDocUnitStore,
  createCockroachGraphStore,
  createCockroachMemory,
  createCockroachMemoryStateStore,
} from "../../../packages/state-cockroach/src/index.ts";
import type { CockroachAnySqlStatement } from "../../../packages/state-cockroach/src/cockroach-sql-executor.ts";
import type { CockroachGenericSqlExecutor } from "../../../packages/state-cockroach/src/cockroach-sql-executor.ts";
import {
  createCockroachAgentCliContextPackBuilder,
  createAgentCliMcpDispatcher,
  resolveAgentCliProductionRuntime,
  runAgentCliMain,
  type AgentCliMainRuntime,
} from "../src/agent-cli-main.ts";

test("package metadata exposes observe-act as the production CLI entrypoint", async () => {
  const packageJsonUrl = new URL("../../../package.json", import.meta.url);
  const packageJson = JSON.parse(await readFile(fileURLToPath(packageJsonUrl), "utf8")) as {
    scripts?: Record<string, string>;
    bin?: Record<string, string>;
    engines?: Record<string, string>;
  };
  const mainEntrypointUrl = new URL("../src/main.ts", import.meta.url);
  const mainEntrypoint = await readFile(fileURLToPath(mainEntrypointUrl), "utf8");

  equal(packageJson.scripts?.["agent:observe"], "node --experimental-strip-types apps/agent-cli/src/main.ts");
  equal(packageJson.bin?.["agentic-org-observe"], "./apps/agent-cli/src/main.ts");
  equal(packageJson.engines?.node, ">=22.12.0");
  ok(mainEntrypoint.startsWith("#!/usr/bin/env -S node --experimental-strip-types\n"));
});

test("resolveAgentCliProductionRuntime fails closed without COCKROACH_DATABASE_URL", async () => {
  const resolved = await resolveAgentCliProductionRuntime({
    env: {},
    now: () => "2026-05-31T00:00:00.000Z",
  });

  deepEqual(resolved, {
    ok: false,
    message: "COCKROACH_DATABASE_URL is required for production observe-act CLI dispatch",
  });
});

test("createCockroachAgentCliContextPackBuilder composes production Cockroach docs, graph, and memory into observe context", async () => {
  const executor = fakeContextPackExecutor();
  await createCockroachDocUnitStore({ executor }).upsert(docUnit({
    docUnitId: "release-brd",
    type: DocType.Brd,
    title: "Release BRD",
    summary: "Release gate requires business approval.",
    boundHatIds: ["release_operator"],
    boundStageIds: [RunLifecyclePhase.AwaitingGate],
  }));
  const workNodeId = graphNodeId("org-1", GraphNodeKind.WorkItem, "work-1");
  const docNodeId = graphNodeId("org-1", GraphNodeKind.DocUnit, "release-brd");
  const projectNodeId = graphNodeId("org-1", GraphNodeKind.Project, "project-1");
  const initiativeNodeId = graphNodeId("org-1", GraphNodeKind.Initiative, "initiative-release");
  await createCockroachGraphStore({ executor }).upsertEdge(graphEdge(workNodeId, docNodeId));
  await createCockroachGraphStore({ executor }).upsertEdge(graphEdge(projectNodeId, docNodeId));
  await createCockroachGraphStore({ executor }).upsertEdge(graphEdge(initiativeNodeId, docNodeId));
  await createCockroachMemory({
    executor,
    idGenerator: { nextMemoryId: () => "mem-release" },
    clock: { now: () => Date.parse("2026-05-30T00:00:00.000Z") },
  }).retain({
    agentId: "agent-reviewer-1",
    hatAssignmentId: "hat-reviewer-1",
    projectId: "project-1",
    workItemId: "work-previous",
    promptFlowRunId: "run-previous",
  }, "Prior release review found that screenshots must be attached before sign-off.");
  await createCockroachMemoryStateStore({ executor }).upsert(releaseMemoryRecord(), releaseMemoryState());

  const result = await createCockroachAgentCliContextPackBuilder({ executor }).build(contextPackBuildRequest());

  ok(executor.statements.some((statement) =>
    statement.name === CockroachDocConsultLedgerStoreStatement.LoadOutcomeCounts &&
    statement.sql.includes("agentic_org_doc_consult_outcomes")
  ));
  ok(executor.statements.some((statement) =>
    statement.name === CockroachMemoryStateStoreStatement.ListByMemoryIds
  ));
  equal(result.pack.hatId, "release_operator");
  equal(result.pack.sourceGraphVersion, "cockroach-doc-units:v1");
  ok(result.pack.items.some((item) => item.id === "doc:release-brd"));
  ok(result.pack.items.some((item) =>
    item.sourcePointers?.some((pointer) =>
      pointer.kind === ContextPackSourcePointerKind.DocUnit &&
      pointer.docUnitId === "release-brd"
    ),
  ));
  ok(result.pack.items.some((item) =>
    item.id === `graph:${workNodeId}` &&
    item.sourcePointers?.some((pointer) =>
      pointer.kind === ContextPackSourcePointerKind.GraphEdge &&
      pointer.edgeId === `${workNodeId}-references-${docNodeId}`
    ),
  ));
  ok(result.pack.items.some((item) =>
    item.id === `graph:${projectNodeId}` &&
    item.title === "Project context for Release Platform" &&
    item.reasons.includes("project trajectory root")
  ));
  ok(result.pack.items.some((item) =>
    item.id === `graph:${initiativeNodeId}` &&
    item.title === "Initiative context for Release hardening" &&
    item.reasons.includes("initiative priority root") &&
    item.reasons.includes("hierarchy priority item root")
  ));
  const memoryItem = result.pack.items.find((item) => item.id === "memory:mem-release");
  equal(memoryItem?.kind, ContextPackItemKind.MemoryPointer);
  ok(memoryItem?.reasons.includes("governance-tier:work"));
  ok(memoryItem?.reasons.includes("governance-phase:active"));
  ok(memoryItem?.reasons.includes("governance-scope:work-1"));
  ok(memoryItem?.sourcePointers?.some((pointer) =>
      pointer.kind === ContextPackSourcePointerKind.HindsightMemory &&
      pointer.providerId === "cockroach_hindsight" &&
      pointer.memoryId === "mem-release" &&
      pointer.creatingAgentId === "agent-reviewer-1" &&
      pointer.creatingHatAssignmentId === "hat-reviewer-1" &&
      pointer.creatingProjectId === "project-1" &&
      pointer.creatingWorkItemId === "work-previous" &&
      pointer.creatingPromptFlowRunId === "run-previous" &&
      pointer.advisory === true
  ));
  ok(result.pack.items.some((item) =>
    item.id === "decision:decision-release-gate" &&
    item.kind === ContextPackItemKind.DecisionRecord
  ));
  ok(result.pack.items.some((item) =>
    item.id === "supervisor_signal:signal-release-blocker" &&
    item.sourcePointers?.some((pointer) =>
      pointer.kind === ContextPackSourcePointerKind.SupervisorSignal &&
      pointer.supervisorSignalId === "signal-release-blocker"
    )
  ));
});

test("createCockroachAgentCliContextPackBuilder composes production per-hat inbox anchors", async () => {
  const executor = fakeContextPackExecutor();
  const inboxNodeId = graphNodeId("org-1", GraphNodeKind.InboxAnchor, "inbox-release-blocker");
  const workNodeId = graphNodeId("org-1", GraphNodeKind.WorkItem, "work-1");
  await createCockroachGraphStore({ executor }).upsertEdge(graphEdge(inboxNodeId, workNodeId));

  const result = await createCockroachAgentCliContextPackBuilder({ executor }).build(contextPackBuildRequest());

  ok(executor.statements.some((statement) =>
    statement.name === CockroachContextPackInboxAnchorStatement.ListInboxAnchorsForHat
  ));
  const inboxItem = result.pack.items.find((item) => item.id === "inbox:inbox-release-blocker");
  equal(inboxItem?.kind, ContextPackItemKind.InboxAnchor);
  ok(inboxItem?.sourcePointers?.some((pointer) =>
    pointer.kind === ContextPackSourcePointerKind.InboxAnchor &&
    pointer.inboxAnchorId === "inbox-release-blocker" &&
    pointer.targetHatAssignmentId === "99" &&
    pointer.targetAgentId === "agent-release-1"
  ));
  ok(result.pack.items.some((item) =>
    item.id === `graph:${inboxNodeId}` &&
    item.reasons.includes("inbox anchor")
  ));
});

test("createCockroachAgentCliContextPackBuilder composes optional grounded ephemeral synthesis", async () => {
  const executor = fakeContextPackExecutor();
  await createCockroachDocUnitStore({ executor }).upsert(docUnit({
    docUnitId: "release-brd",
    type: DocType.Brd,
    title: "Release BRD",
    summary: "Release gate requires business approval.",
    boundHatIds: ["release_operator"],
    boundStageIds: [RunLifecyclePhase.AwaitingGate],
  }));
  const synthesis: ContextPackEphemeralSynthesisPort = {
    synthesize: async (request) => ({
      summary: `Briefed ${request.hatId} at ${request.scope}/${request.phase}`,
      briefing: {
        title: "Release operator briefing",
        summary: "Business approval is the release gate focus.",
        evidenceRefs: ["doc:release-brd"],
        reasons: ["hat:release_operator"],
      },
      curationEvidenceRefs: ["doc:release-brd"],
    }),
  };

  const result = await createCockroachAgentCliContextPackBuilder({ executor, synthesis }).build(contextPackBuildRequest());

  ok(result.pack.items.some((item) =>
    item.id === "synthesis:release_operator:1:99" &&
    item.kind === ContextPackItemKind.SynthesisBriefing &&
    item.sourcePointers?.some((pointer) =>
      pointer.kind === ContextPackSourcePointerKind.DocUnit &&
      pointer.docUnitId === "release-brd"
    )
  ));
  ok(result.pack.curationTrace.some((stage) =>
    stage.stage === ContextPackCurationStageKind.EphemeralSynthesis &&
    stage.summary === "Briefed release_operator at work_item/awaiting_gate"
  ));
});

test("createCockroachAgentCliContextPackBuilder composes optional LGTM runtime evidence from scoped lifecycle anchors", async () => {
  const executor = fakeContextPackExecutor();
  const telemetryEvidence: ContextPackTelemetryEvidencePort = {
    load: async (query) => {
      ok(query.items.some((item) =>
        item.sourcePointers?.some((pointer) =>
          pointer.kind === ContextPackSourcePointerKind.Trace &&
          pointer.traceId === "trace-gate-release"
        )
      ));
      return {
        items: [{
          id: "telemetry:runtime:trace-gate-release",
          kind: ContextPackItemKind.Trace,
          title: "Release gate runtime trace",
          summary: "LGTM runtime evidence links the release gate trace to the active work item.",
          sourceRef: "trace:trace-gate-release",
          required: false,
          freshness: ContextPackFreshness.Live,
          confidence: 0.93,
          reasons: ["lgtm:runtime_evidence"],
          citationRefs: ["trace:trace-gate-release", "metric:mimir:release"],
          sourcePointers: [
            { kind: ContextPackSourcePointerKind.Trace, traceId: "trace-gate-release" },
            { kind: ContextPackSourcePointerKind.WorkItem, workItemId: "work-1" },
            {
              kind: ContextPackSourcePointerKind.Metric,
              source: "mimir",
              query: "sum by (trace_id) (agentic_runtime_signal)",
              seriesId: "trace-gate-release",
            },
          ],
        }],
      };
    },
  };

  const result = await createCockroachAgentCliContextPackBuilder({ executor, telemetryEvidence }).build(contextPackBuildRequest());

  ok(result.pack.items.some((item) =>
    item.id === "telemetry:runtime:trace-gate-release" &&
    item.sourcePointers?.some((pointer) =>
      pointer.kind === ContextPackSourcePointerKind.Metric &&
      pointer.source === "mimir"
    )
  ));
  ok(result.pack.curationTrace.some((stage) =>
    stage.stage === ContextPackCurationStageKind.TelemetryEvidence &&
    stage.evidenceRefs.includes("telemetry:runtime:trace-gate-release")
  ));
});

test("createCockroachAgentCliContextPackBuilder wires deny-by-default advisory promotion policy", async () => {
  const executor = fakeContextPackExecutor();
  await createCockroachDocUnitStore({ executor }).upsert(docUnit({
    docUnitId: "billing-brd",
    type: DocType.Brd,
    title: "Billing BRD",
    summary: "Billing recovery requires a named owner.",
    scopeKind: DocScopeKind.Project,
    scopeId: "project-1",
    boundHatIds: ["engineering_director"],
    boundStageIds: [RunLifecyclePhase.Blocked],
  }));
  const missingArchitectureRef = "context_requirement:management_blocker_architecture";
  const synthesis: ContextPackEphemeralSynthesisPort = {
    synthesize: async (request) => {
      ok(request.omissions.some((item) => item.nodeId === missingArchitectureRef));
      return {
        summary: "Director blocker gap was grounded in admitted docs and deterministic omissions.",
        gapHypotheses: [{
          message: "Architecture owner decision is missing.",
          evidenceRefs: ["doc:billing-brd", missingArchitectureRef],
          confidence: 0.91,
        }],
        curationEvidenceRefs: ["doc:billing-brd"],
      };
    },
  };

  const result = await createCockroachAgentCliContextPackBuilder({ executor, synthesis }).build(
    managementBlockerContextPackBuildRequest(),
  );

  ok(result.pack.items.some((item) =>
    item.id === "synthesis:engineering_director:2:100:gap:0" &&
    item.kind === ContextPackItemKind.SynthesisGapHypothesis &&
    item.citationRefs?.includes(missingArchitectureRef)
  ));
  ok(!result.pack.lifecycleBlockers.some((blocker) => blocker.includes("Architecture owner decision is missing")));
  ok(result.pack.curationTrace.some((stage) =>
    stage.stage === ContextPackCurationStageKind.AdvisoryPromotion &&
    stage.summary === "promoted 0 synthesis advisories; omissions=0"
  ));
  ok(executor.statements.some((statement) =>
    statement.name === CockroachContextPackAdvisoryPromotionDecisionStoreStatement.ListForPromotion
  ));
  ok(executor.statements.some((statement) =>
    statement.name === CockroachTenantConfigStoreStatement.Get
  ));
});

test("createCockroachAgentCliContextPackBuilder applies production management-blocker completeness policy", async () => {
  const executor = fakeContextPackExecutor();

  const result = await createCockroachAgentCliContextPackBuilder({ executor }).build(
    managementBlockerContextPackBuildRequest(),
  );

  ok(result.pack.items.some((item) => item.kind === ContextPackItemKind.GraphNeighborhood));
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.nodeId === "context_requirement:management_blocker_business" &&
    item.reason === ContextPackOmissionReason.NotIndexed
  ));
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.nodeId === "context_requirement:management_blocker_architecture" &&
    item.reason === ContextPackOmissionReason.NotIndexed
  ));
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.nodeId === "context_requirement:management_blocker_policy" &&
    item.reason === ContextPackOmissionReason.NotIndexed
  ));
  ok(result.pack.curationTrace.some((stage) =>
    stage.stage === ContextPackCurationStageKind.RequiredConsult &&
    stage.evidenceRefs.includes("context_policy:default_management_blocker:v1")
  ));
});

test("createCockroachAgentCliContextPackBuilder applies tenant-config completeness requirements", async () => {
  const executor = fakeContextPackExecutor();
  await createCockroachTenantConfigStore({ executor }).upsert({
    ...defaultTenantConfig("org-1", "2026-06-01T00:00:00.000Z"),
    layers: [{
      layerId: "tenant-release-runtime-evidence",
      scope: { kind: ConfigLayerScopeKind.Hat, id: "release_operator" },
      policy: {
        contextPack: {
          completeness: {
            requirements: [{
              requirementId: "release_readiness_meeting",
              itemKind: ContextPackItemKind.Meeting,
              message: "release readiness meeting notes are required",
              evidenceRef: "context_policy:tenant_release_readiness:v1",
              requiredSourceScope: TenantContextPackCompletenessSourceScope.ActiveScope,
            }],
          },
        },
      },
      updatedAt: "2026-06-01T00:00:00.000Z",
      version: 1,
    }],
  });

  const result = await createCockroachAgentCliContextPackBuilder({ executor }).build(
    contextPackBuildRequest(),
  );

  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.nodeId === "context_requirement:release_readiness_meeting" &&
    item.reason === ContextPackOmissionReason.NotIndexed
  ));
  ok(result.pack.lifecycleBlockers.includes("release readiness meeting notes are required"));
  ok(result.pack.curationTrace.some((stage) =>
    stage.stage === ContextPackCurationStageKind.RequiredConsult &&
    stage.evidenceRefs.includes("context_policy:tenant_release_readiness:v1")
  ));
});

test("createCockroachAgentCliContextPackBuilder applies tenant curation intent before document retrieval", async () => {
  const executor = fakeContextPackExecutor();
  await createCockroachTenantConfigStore({ executor }).upsert({
    ...defaultTenantConfig("org-1", "2026-06-01T00:00:00.000Z"),
    layers: [{
      layerId: "tenant-security-curation",
      scope: { kind: ConfigLayerScopeKind.Hat, id: "release_operator" },
      policy: {
        contextPack: {
          curation: {
            profileId: ContextPackCurationProfileId.SecurityControl,
            blocksInheritedDeterministicInstructions: true,
          },
        },
      },
      updatedAt: "2026-06-01T00:00:00.000Z",
      version: 1,
    }],
  });

  const result = await createCockroachAgentCliContextPackBuilder({ executor }).build(
    contextPackBuildRequest(),
  );
  const documentFocus = result.pack.curationTrace.find((stage) =>
    stage.stage === ContextPackCurationStageKind.DocumentFocus
  );

  equal(result.pack.curationPlan?.profileId, ContextPackCurationProfileId.SecurityControl);
  ok(documentFocus?.summary.includes("security_control"));
  ok(documentFocus?.evidenceRefs.includes("focus-term:least privilege"));
  ok(documentFocus?.evidenceRefs.includes(`preferred-doc-type:${DocType.Policy}`));
});

test("createCockroachAgentCliContextPackBuilder applies tenant-config synthesis requirements", async () => {
  const executor = fakeContextPackExecutor();
  await createCockroachTenantConfigStore({ executor }).upsert({
    ...defaultTenantConfig("org-1", "2026-06-01T00:00:00.000Z"),
    layers: [{
      layerId: "tenant-release-model-briefing",
      scope: { kind: ConfigLayerScopeKind.Hat, id: "release_operator" },
      policy: {
        contextPack: {
          synthesisRequirement: {
            requirements: [{
              requirementId: "release_operator_model_briefing",
              reason: TenantContextPackSynthesisRequirementReason.TenantRequiresModelBriefing,
              appliesTo: {
                phases: [RunLifecyclePhase.AwaitingGate],
                scopes: [RunScope.WorkItem],
              },
            }],
          },
        },
      },
      updatedAt: "2026-06-01T00:00:00.000Z",
      version: 1,
    }],
  });

  const result = await createCockroachAgentCliContextPackBuilder({ executor }).build(
    contextPackBuildRequest(),
  );

  ok(result.pack.curationPlan?.requiredStages?.includes(ContextPackCurationStageKind.EphemeralSynthesis));
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.nodeId === "ephemeral_synthesis:required_unavailable" &&
    item.reason === ContextPackOmissionReason.RetrievalFailed
  ));
});

test("runAgentCliMain routes selected command slots through supplied production runtime", async () => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const commands: string[] = [];
  const events: OrgEvent[] = [];
  const workflowLookups: unknown[] = [];

  const exitCode = await runAgentCliMain({
    argv: [
      "observe",
      "--hat",
      "release_operator",
      "--scope",
      RunScope.WorkItem,
      "--phase",
      RunLifecyclePhase.AwaitingGate,
      "--run-id",
      "1",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-release-1",
      "--organization",
      "org-1",
      "--project",
      "project-1",
      "--work-item",
      "work-1",
      "--gate-approved",
      "--select-index",
      "4",
    ],
    env: {},
    now: () => "2026-05-31T00:00:00.000Z",
    writeStdout: (text) => {
      stdout.push(text);
    },
    writeStderr: (text) => {
      stderr.push(text);
    },
    runtime: {
      runCommand: async (commandType) => {
        commands.push(commandType);
        return { status: "accepted" };
      },
      dispatchTool: async () => ({ outcome: "feedback", feedback: { reason: "unused", message: "unused" } }),
      appendObserveActTick: async (event) => {
        events.push(event);
      },
      contextPackBuilder: {
        build: async (request) => ({
          pack: {
            id: "ctx-production-release",
            runId: request.snapshot.runId,
            scope: request.snapshot.scope,
            hatAssignmentId: request.snapshot.hatAssignmentId,
            hatId: request.snapshot.hat.id,
            agentId: request.snapshot.agentId,
            organizationId: request.snapshot.organizationId,
            projectId: request.snapshot.projectId,
            workItemId: request.snapshot.workItemId,
            generatedAt: request.observedAt,
            freshnessDeadline: "2026-05-31T00:15:00.000Z",
            sourceGraphVersion: "git-index:main",
            policyVersion: "context-policy:v1",
            tokenBudget: 2048,
            items: [
              {
                id: "brd-release",
                kind: ContextPackItemKind.BusinessDocument,
                title: "Release BRD",
                summary: "Required release business context.",
                sourceRef: "doc:brd-release",
                required: true,
                freshness: ContextPackFreshness.Current,
                confidence: 0.98,
                reasons: ["required release gate context"],
                sourcePointers: [
                  {
                    kind: ContextPackSourcePointerKind.DocUnit,
                    docUnitId: "brd-release",
                    organizationId: "org-1",
                    scopeKind: DocScopeKind.Project,
                    scopeId: "project-1",
                    contentRef: "doc:brd-release",
                    contentHash: "hash-brd-release",
                    sourceId: "source-docs",
                    version: 7,
                    provenanceChangeSetId: "cs-release-docs",
                  },
                ],
              },
            ],
            omittedItemsWithReason: [],
            contradictions: [],
            staleInputs: [],
            lifecycleBlockers: [],
            curationTrace: [
              {
                stage: ContextPackCurationStageKind.DeterministicScope,
                summary: "scoped release operator",
                evidenceRefs: ["work:work-1"],
              },
              {
                stage: ContextPackCurationStageKind.RequiredConsult,
                summary: "loaded release BRD",
                evidenceRefs: ["doc:brd-release"],
              },
              {
                stage: ContextPackCurationStageKind.GapReview,
                summary: "no gaps",
                evidenceRefs: [],
              },
            ],
          },
        }),
      },
      availableSecretScopes: ["github:write"],
      loadContextPackInboxWorkflow: async (lookup) => {
        workflowLookups.push(lookup);
        return {
          organizationId: "org-1",
          targetHatAssignmentId: "99",
          targetAgentId: "agent-release-1",
          observedAt: "2026-05-31T00:00:00.000Z",
          summary: {
            totalVisibleCount: 2,
            urgentUnreadCount: 1,
            normalUnreadCount: 0,
            readCount: 0,
            snoozedDueCount: 0,
            snoozedFutureCount: 1,
          },
          batches: [
            {
              kind: ContextPackInboxWorkflowBatchKind.UrgentUnread,
              items: [{
                inboxAnchorId: "inbox-release-blocker",
                organizationId: "org-1",
                projectId: "project-1",
                workItemId: "work-1",
                targetHatAssignmentId: "99",
                targetAgentId: "agent-release-1",
                title: "Release blocker inbox",
                summary: "Release operator wakeup was triggered by missing gate evidence.",
                priority: ContextPackInboxAnchorPriority.Urgent,
                status: ContextPackInboxAnchorStatus.Unread,
                deliveredAt: "2026-05-31T00:40:00.000Z",
                sourceRef: "supervisor_signal:signal-release-blocker",
                traceId: "trace-release-inbox",
                actions: [
                  {
                    kind: ContextPackInboxWorkflowActionKind.MarkRead,
                    targetStatus: ContextPackInboxAnchorStatus.Read,
                    requiresSnoozedUntil: false,
                  },
                  {
                    kind: ContextPackInboxWorkflowActionKind.Snooze,
                    targetStatus: ContextPackInboxAnchorStatus.Snoozed,
                    requiresSnoozedUntil: true,
                  },
                  {
                    kind: ContextPackInboxWorkflowActionKind.Dismiss,
                    targetStatus: ContextPackInboxAnchorStatus.Dismissed,
                    requiresSnoozedUntil: false,
                  },
                ],
              }],
            },
            {
              kind: ContextPackInboxWorkflowBatchKind.SnoozedFuture,
              items: [{
                inboxAnchorId: "inbox-release-followup",
                organizationId: "org-1",
                projectId: "project-1",
                workItemId: "work-1",
                targetHatAssignmentId: "99",
                targetAgentId: "agent-release-1",
                title: "Release follow-up",
                summary: "Follow up after the review window.",
                priority: ContextPackInboxAnchorPriority.Normal,
                status: ContextPackInboxAnchorStatus.Snoozed,
                deliveredAt: "2026-05-31T00:45:00.000Z",
                snoozedUntil: "2026-05-31T01:00:00.000Z",
                actions: [
                  {
                    kind: ContextPackInboxWorkflowActionKind.MarkRead,
                    targetStatus: ContextPackInboxAnchorStatus.Read,
                    requiresSnoozedUntil: false,
                  },
                ],
              }],
            },
          ],
        };
      },
      shutdown: async () => undefined,
    } as AgentCliMainRuntime & { appendObserveActTick: (event: OrgEvent) => Promise<void> },
  });

  equal(exitCode, 0);
  deepEqual(workflowLookups, [{
    organizationId: "org-1",
    projectId: "project-1",
    targetHatAssignmentId: "99",
    targetAgentId: "agent-release-1",
    observedAt: "2026-05-31T00:00:00.000Z",
  }]);
  deepEqual(commands, [ObserveCommandType.LifecycleTransition]);
  equal(stderr.join(""), "");
  ok(stdout.join("").includes("inbox workflow: total=2 urgent=1 normal=0 due=0 future=1 read=0"));
  ok(stdout.join("").includes("- inbox urgent_unread inbox-release-blocker urgent/unread Release blocker inbox actions=mark_read,snooze,dismiss"));
  ok(stdout.join("").includes("- inbox snoozed_future inbox-release-followup normal/snoozed until=2026-05-31T01:00:00.000Z Release follow-up actions=mark_read"));
  ok(stdout.join("").includes("action: dispatched command"));
  equal(events.length, 1);
  equal(events[0]?.kind, OrgEventKind.ObserveActTick);
  ok(events[0]?.evidenceRefs.some((ref) => ref.startsWith("observe-act:menu_hash:")));
  ok(events[0]?.evidenceRefs.includes("observe-act:selected_slot:4"));
  ok(events[0]?.evidenceRefs.includes("observe-act:selected_impl:command"));
  ok(events[0]?.evidenceRefs.includes("observe-act:action_outcome:dispatched"));
  ok(events[0]?.evidenceRefs.includes("observe-act:context_pack:ctx-production-release"));
  ok(events[0]?.evidenceRefs.includes("observe-act:context_status:current"));
  ok(events[0]?.evidenceRefs.includes("observe-act:context_required_count:1"));
  ok(events[0]?.evidenceRefs.includes("observe-act:context_omission_count:0"));
  ok(events[0]?.evidenceRefs.includes("observe-act:context_required_item:brd-release"));
  ok(events[0]?.evidenceRefs.includes("observe-act:context_source_graph:git-index:main"));
  ok(events[0]?.evidenceRefs.includes("observe-act:context_policy:context-policy:v1"));
  ok(events[0]?.evidenceRefs.includes("observe-act:context_curation_stage:deterministic_scope"));
  ok(events[0]?.evidenceRefs.includes("observe-act:context_curation_stage:required_consult"));
  ok(events[0]?.evidenceRefs.includes("observe-act:context_curation_stage:gap_review"));
  ok(events[0]?.evidenceRefs.includes("observe-act:context_source:doc_unit:brd-release:7"));
});

test("runAgentCliMain persists context-pack refresh evidence through observe-act events", async () => {
  const events: OrgEvent[] = [];
  const latestLookups: unknown[] = [];

  const exitCode = await runAgentCliMain({
    argv: [
      "observe",
      "--hat",
      "engineering_director",
      "--hat-assignment",
      "77",
      "--agent",
      "agent-director-1",
      "--organization",
      "org-1",
      "--project",
      "project-1",
      "--work-item",
      "work-1",
      "--scope",
      RunScope.Project,
      "--phase",
      RunLifecyclePhase.Blocked,
      "--select-index",
      "13",
    ],
    env: {},
    now: () => "2026-06-02T12:00:00.000Z",
    writeStdout: () => undefined,
    writeStderr: () => undefined,
    runtime: {
      runCommand: async () => ({ status: "unused" }),
      dispatchTool: async () => ({ status: "unused" }),
      loadLatestContextPackSnapshot: async (lookup) => {
        latestLookups.push(lookup);
        return previousDirectorContextPackSnapshot();
      },
      appendObserveActTick: async (event) => {
        events.push(event);
      },
      shutdown: async () => undefined,
    } as AgentCliMainRuntime & { appendObserveActTick: (event: OrgEvent) => Promise<void> },
  });

  equal(exitCode, 0);
  deepEqual(latestLookups, [{ organizationId: "org-1", agentId: "agent-director-1" }]);
  equal(events.length, 1);
  ok(events[0]?.evidenceRefs.includes(`observe-act:context_refresh_reason:${ContextPackRefreshReason.HatAssignmentChanged}`));
  ok(events[0]?.evidenceRefs.includes("observe-act:context_refresh_policy_requires_build:true"));
  ok(events[0]?.evidenceRefs.includes("observe-act:previous_context_pack:ctx-previous-director"));
  ok(events[0]?.evidenceRefs.includes(`observe-act:previous_context_status:${ContextPackStatus.Current}`));
});

test("runAgentCliMain persists context refresh lookup failures as observe-act evidence", async () => {
  const events: OrgEvent[] = [];
  const stderr: string[] = [];

  const exitCode = await runAgentCliMain({
    argv: [
      "observe",
      "--hat",
      "engineering_director",
      "--hat-assignment",
      "77",
      "--agent",
      "agent-director-1",
      "--organization",
      "org-1",
      "--project",
      "project-1",
      "--work-item",
      "work-1",
      "--scope",
      RunScope.Project,
      "--phase",
      RunLifecyclePhase.Blocked,
      "--select-index",
      "13",
    ],
    env: {},
    now: () => "2026-06-02T12:00:00.000Z",
    writeStdout: () => undefined,
    writeStderr: (text) => stderr.push(text),
    runtime: {
      runCommand: async () => ({ status: "unused" }),
      dispatchTool: async () => ({ status: "unused" }),
      loadLatestContextPackSnapshot: async () => {
        throw new Error("snapshot index unavailable");
      },
      appendObserveActTick: async (event) => {
        events.push(event);
      },
      shutdown: async () => undefined,
    } as AgentCliMainRuntime & { appendObserveActTick: (event: OrgEvent) => Promise<void> },
  });

  equal(exitCode, 1);
  ok(stderr.join("").includes("agent CLI context-pack previous snapshot lookup failed: snapshot index unavailable"));
  equal(events.length, 1);
  ok(events[0]?.evidenceRefs.includes("observe-act:failure:context_refresh_lookup_failed"));
  ok(events[0]?.evidenceRefs.includes("observe-act:failure_message:snapshot index unavailable"));
});

function contextPackBuildRequest(): ContextPackBuildRequest {
  const releaseOperator = buildHatDefinitions().find((hat) => hat.id === "release_operator");
  if (releaseOperator === undefined) throw new Error("release_operator hat missing");
  return {
    snapshot: {
      runId: asZetaIdDecimal("1"),
      scope: RunScope.WorkItem,
      phase: RunLifecyclePhase.AwaitingGate,
      trace: { correlationId: "corr-ctx", causationId: "cause-ctx", traceId: "trace-ctx" },
      hasGateApproval: true,
      hasEvidence: false,
      hatAssignmentId: asZetaIdDecimal("99"),
      hat: releaseOperator,
      agentId: "agent-release-1",
      organizationId: "org-1",
      projectId: "project-1",
      workItemId: "work-1",
    },
    readout: {
      runId: asZetaIdDecimal("1"),
      scope: RunScope.WorkItem,
      phase: RunLifecyclePhase.AwaitingGate,
      trace: { correlationId: "corr-ctx", causationId: "cause-ctx", traceId: "trace-ctx" },
      observedAt: "2026-05-31T00:00:00.000Z",
      options: [],
      vetoedOptions: [],
      deterministicRulesApplied: [],
    },
    metrics: { scope: RunScope.WorkItem, blocks: [] },
    promptFlows: { tasks: [], vetoedTasks: [] },
    hierarchy: {
      level: HatLevel.IndividualContributor,
      projects: [
        {
          projectId: "project-1",
          organizationId: "org-1",
          departmentId: "engineering",
          name: "Release Platform",
          status: "active",
          trajectory: [],
          metrics: [],
        },
      ],
      initiatives: [
        {
          initiativeId: "initiative-release",
          projectId: "project-1",
          organizationId: "org-1",
          title: "Release hardening",
          status: "active",
          priorityScore: 99,
          metrics: [],
        },
      ],
      metrics: [],
      policyViolations: [],
      priorityScope: "current_work_item",
      priorityItems: [
        {
          itemId: "initiative-release",
          kind: "initiative",
          label: "Release hardening",
          scope: RunScope.Project,
          priorityScore: 99,
          metrics: [],
          rationale: "release readiness is blocked by missing evidence",
        },
      ],
      scopedMetrics: [],
      actions: [],
      vetoedActions: [],
    },
    observedAt: "2026-05-31T00:00:00.000Z",
  };
}

function previousDirectorContextPackSnapshot(): ContextPackSnapshotRecord {
  return {
    context: {
      status: ContextPackStatus.Current,
      pack: {
        id: "ctx-previous-director",
        runId: asZetaIdDecimal("41"),
        scope: RunScope.Project,
        hatAssignmentId: asZetaIdDecimal("76"),
        hatId: "engineering_director",
        agentId: "agent-director-1",
        organizationId: "org-1",
        projectId: "project-1",
        workItemId: "work-1",
        generatedAt: "2026-06-02T11:55:00.000Z",
        freshnessDeadline: "2026-06-02T12:05:00.000Z",
        sourceGraphVersion: "git-index:previous",
        policyVersion: "context-policy:v1",
        tokenBudget: 4096,
        items: [],
        omittedItemsWithReason: [],
        contradictions: [],
        staleInputs: [],
        lifecycleBlockers: [],
        curationTrace: [],
      },
      requiredItems: [],
      optionalItems: [],
      omittedItemsWithReason: [],
      contradictions: [],
      staleInputs: [],
      lifecycleBlockers: [],
      uncertainty: {
        signalCount: 0,
        highSeverityCount: 0,
        mediumSeverityCount: 0,
        lowSeverityCount: 0,
        groups: [],
      },
      drillTargetGroups: [],
      summary: {
        requiredItemCount: 0,
        optionalItemCount: 0,
        omissionCount: 0,
        contradictionCount: 0,
        staleInputCount: 0,
        lifecycleBlockerCount: 0,
        uncertaintySignalCount: 0,
      },
    },
    recordedAt: "2026-06-02T11:55:00.000Z",
    trace: {
      traceId: "trace-previous-director",
      correlationId: "corr-previous-director",
      causationId: "cause-previous-director",
    },
  };
}

function managementBlockerContextPackBuildRequest(): ContextPackBuildRequest {
  const engineeringDirector = buildHatDefinitions().find((hat) => hat.id === "engineering_director");
  if (engineeringDirector === undefined) throw new Error("engineering_director hat missing");
  return {
    snapshot: {
      runId: asZetaIdDecimal("2"),
      scope: RunScope.Project,
      phase: RunLifecyclePhase.Blocked,
      trace: { correlationId: "corr-mgmt", causationId: "cause-mgmt", traceId: "trace-mgmt" },
      hasGateApproval: false,
      hasEvidence: false,
      hatAssignmentId: asZetaIdDecimal("100"),
      hat: engineeringDirector,
      agentId: "agent-director-1",
      organizationId: "org-1",
      projectId: "project-1",
      workItemId: "work-blocked-1",
    },
    readout: {
      runId: asZetaIdDecimal("2"),
      scope: RunScope.Project,
      phase: RunLifecyclePhase.Blocked,
      trace: { correlationId: "corr-mgmt", causationId: "cause-mgmt", traceId: "trace-mgmt" },
      observedAt: "2026-05-31T00:00:00.000Z",
      options: [],
      vetoedOptions: [],
      deterministicRulesApplied: [],
    },
    metrics: { scope: RunScope.Project, blocks: [] },
    promptFlows: { tasks: [], vetoedTasks: [] },
    hierarchy: {
      level: HatLevel.Director,
      projects: [
        {
          projectId: "project-1",
          organizationId: "org-1",
          departmentId: "engineering",
          name: "Release Platform",
          status: "active",
          trajectory: [],
          metrics: [],
        },
      ],
      initiatives: [],
      metrics: [],
      policyViolations: [],
      priorityScope: "department_initiatives",
      priorityItems: [],
      scopedMetrics: [],
      actions: [],
      vetoedActions: [],
    },
    observedAt: "2026-05-31T00:00:00.000Z",
  };
}

type FakeContextPackExecutor = CockroachGenericSqlExecutor & {
  statements: readonly CockroachAnySqlStatement[];
};

function fakeContextPackExecutor(): FakeContextPackExecutor {
  const docRows = new Map<string, Record<string, unknown>>();
  const graphEdgeRows = new Map<string, Record<string, unknown>>();
  const memoryRows = new Map<string, Record<string, unknown>>();
  const memoryStateRows = new Map<string, Record<string, unknown>>();
  const tenantConfigRows = new Map<string, Record<string, unknown>>();
  const statements: CockroachAnySqlStatement[] = [];
  const execute = async (statement: CockroachAnySqlStatement) => {
    statements.push(statement);
    const sql = statement.sql;
    const parameters = statement.parameters;
    if (sql.includes("INSERT INTO") && sql.includes("agentic_org_doc_units")) {
      const row = docRowFromParameters(parameters);
      docRows.set(row["doc_unit_id"] as string, row);
      return { rows: [] };
    }
    if (sql.includes("INSERT INTO") && sql.includes("agentic_org_graph_edges")) {
      const row = graphEdgeRowFromParameters(parameters);
      graphEdgeRows.set(row["edge_id"] as string, row);
      return { rows: [] };
    }
    if (sql.includes("INSERT INTO") && sql.includes("agentic_org_hindsight_memory")) {
      const row = memoryRowFromParameters(parameters);
      memoryRows.set(row["memory_id"] as string, row);
      return { rows: [] };
    }
    if (sql.includes("INSERT INTO") && sql.includes("agentic_org_memory_state")) {
      const row = memoryStateRowFromParameters(parameters);
      memoryStateRows.set(row["memory_id"] as string, row);
      return { rows: [] };
    }
    if (sql.includes("INSERT INTO") && sql.includes("agentic_org_tenant_config")) {
      tenantConfigRows.set(parameters[0] as string, {
        organization_id: parameters[0],
        config: parameters[1],
        updated_at: parameters[2],
        version: parameters[3],
      });
      return { rows: [] };
    }
    if (sql.includes("agentic_org_tenant_config") && sql.includes("WHERE organization_id = $1")) {
      const row = tenantConfigRows.get(parameters[0] as string);
      return { rows: row === undefined ? [] : [row] };
    }
    if (sql.includes("agentic_org_doc_units") && sql.includes("scope_kind = $2 AND scope_id = $3")) {
      return {
        rows: [...docRows.values()].filter((row) =>
          row["organization_id"] === parameters[0] &&
          row["scope_kind"] === parameters[1] &&
          row["scope_id"] === parameters[2]
        ),
      };
    }
    if (sql.includes("agentic_org_doc_units") && sql.includes("status = $2")) {
      return {
        rows: [...docRows.values()].filter((row) =>
          row["organization_id"] === parameters[0] &&
          row["status"] === parameters[1]
        ),
      };
    }
    if (sql.includes("agentic_org_graph_edges") && sql.includes("from_node_id = $2")) {
      return {
        rows: [...graphEdgeRows.values()].filter((row) =>
          row["organization_id"] === parameters[0] &&
          row["from_node_id"] === parameters[1] &&
          row["confidence"] !== GraphConfidence.Retracted
        ),
      };
    }
    if (sql.includes("agentic_org_graph_edges") && sql.includes("to_node_id = $2")) {
      return {
        rows: [...graphEdgeRows.values()].filter((row) =>
          row["organization_id"] === parameters[0] &&
          row["to_node_id"] === parameters[1] &&
          row["confidence"] !== GraphConfidence.Retracted
        ),
      };
    }
    if (sql.includes("agentic_org_graph_edges")) return { rows: [] };
    if (sql.includes("agentic_org_hindsight_memory") && sql.includes("WHERE project_id = $1")) {
      return {
        rows: [...memoryRows.values()].filter((row) => row["project_id"] === parameters[0]),
      };
    }
    if (sql.includes("agentic_org_memory_state") && sql.includes("memory_id IN")) {
      const memoryIds = new Set(parameters.slice(1));
      return {
        rows: [...memoryStateRows.values()].filter((row) =>
          row["organization_id"] === parameters[0] &&
          memoryIds.has(row["memory_id"])
        ),
      };
    }
    if (sql.includes("agentic_org_discussion_anchors") && sql.includes("work_item_id = $3")) {
      return { rows: [releaseDiscussionAnchorRow()] };
    }
    if (sql.includes("agentic_org_decision_records") && sql.includes("work_item_id = $3")) {
      return { rows: [releaseDecisionRecordRow()] };
    }
    if (sql.includes("agentic_org_quality_gate_evaluations") && sql.includes("work_item_id = $3")) {
      return { rows: [releaseQualityGateRow()] };
    }
    if (sql.includes("agentic_org_work_schedule_blocks") && sql.includes("work_item_id = $3")) {
      return { rows: [releaseScheduleBlockRow()] };
    }
    if (sql.includes("agentic_org_supervisor_signals") && sql.includes("related_work_item_id = $3")) {
      return { rows: [releaseSupervisorSignalRow()] };
    }
    if (sql.includes("agentic_org_context_pack_inbox_anchors")) {
      return { rows: [releaseInboxAnchorRow()] };
    }
    return { rows: [] };
  };
  return {
    statements,
    execute,
    executeTransaction: async (operation: (executor: { execute: typeof execute }) => unknown) =>
      await operation({ execute }),
  } as FakeContextPackExecutor;
}

function releaseDiscussionAnchorRow(): Record<string, unknown> {
  return {
    discussion_anchor_id: "discussion-release-gate",
    organization_id: "org-1",
    project_id: "project-1",
    team_id: null,
    work_item_id: "work-1",
    discussion_anchor_type: DiscussionAnchorType.WorkItem,
    title: "Release gate discussion",
    purpose: "Decide if release evidence is sufficient.",
    expected_outputs: [DiscussionExpectedOutput.Decision, DiscussionExpectedOutput.GateResult],
    created_by_agent_id: "agent-manager-1",
    created_by_hat_assignment_id: "hat-manager-1",
    created_at: new Date("2026-05-31T00:00:00.000Z"),
    updated_at: new Date("2026-05-31T00:00:00.000Z"),
    version: "1",
    correlation_id: "corr-discussion-release",
    causation_id: "cause-discussion-release",
    trace_id: "trace-discussion-release",
  };
}

function releaseDecisionRecordRow(): Record<string, unknown> {
  return {
    decision_record_id: "decision-release-gate",
    organization_id: "org-1",
    project_id: "project-1",
    team_id: null,
    work_item_id: "work-1",
    discussion_anchor_id: "discussion-release-gate",
    title: "Release evidence owner",
    decision: "Release operator owns missing evidence collection.",
    rationale: "The blocker is in release readiness evidence.",
    alternatives_considered: ["defer release", "skip screenshots"],
    follow_up_work_item_ids: [],
    decided_by_agent_id: "agent-manager-1",
    decided_by_hat_assignment_id: "hat-manager-1",
    decided_at: new Date("2026-05-31T00:10:00.000Z"),
    updated_at: new Date("2026-05-31T00:10:00.000Z"),
    version: "1",
    correlation_id: "corr-decision-release",
    causation_id: "cause-decision-release",
    trace_id: "trace-decision-release",
  };
}

function releaseQualityGateRow(): Record<string, unknown> {
  return {
    quality_gate_evaluation_id: "quality-gate-release",
    organization_id: "org-1",
    project_id: "project-1",
    team_id: null,
    work_item_id: "work-1",
    discussion_anchor_id: "discussion-release-gate",
    gate_kind: QualityGateKind.ReleaseReadiness,
    outcome: QualityGateOutcome.ChangesRequested,
    summary: "Release evidence is still incomplete.",
    evaluated_artifact_ids: ["doc:release-brd"],
    business_rule_results: [{
      ruleId: "release-evidence",
      status: BusinessRuleEvaluationStatus.PartiallySatisfied,
      evidenceArtifactIds: ["doc:release-brd"],
      notes: "Screenshots still missing.",
    }],
    evaluated_by_agent_id: "agent-reviewer-1",
    evaluated_by_hat_assignment_id: "hat-reviewer-1",
    evaluated_at: new Date("2026-05-31T00:20:00.000Z"),
    updated_at: new Date("2026-05-31T00:20:00.000Z"),
    version: "1",
    correlation_id: "corr-gate-release",
    causation_id: "cause-gate-release",
    trace_id: "trace-gate-release",
  };
}

function releaseScheduleBlockRow(): Record<string, unknown> {
  return {
    work_schedule_block_id: "schedule-release-gate",
    organization_id: "org-1",
    project_id: "project-1",
    team_id: null,
    work_item_id: "work-1",
    discussion_anchor_id: "discussion-release-gate",
    assigned_agent_id: "agent-release-1",
    assigned_hat_assignment_id: "99",
    block_type: ScheduleBlockType.Review,
    state: ScheduleBlockState.Active,
    title: "Release gate review",
    purpose: "Review release evidence before moving the gate.",
    starts_at: new Date("2026-05-31T00:00:00.000Z"),
    ends_at: new Date("2026-05-31T01:00:00.000Z"),
    scheduled_by_agent_id: "agent-manager-1",
    scheduled_by_hat_assignment_id: "hat-manager-1",
    scheduled_at: new Date("2026-05-30T23:00:00.000Z"),
    updated_at: new Date("2026-05-30T23:00:00.000Z"),
    version: "1",
    correlation_id: "corr-schedule-release",
    causation_id: "cause-schedule-release",
    trace_id: "trace-schedule-release",
  };
}

function releaseSupervisorSignalRow(): Record<string, unknown> {
  return {
    supervisor_signal_id: "signal-release-blocker",
    organization_id: "org-1",
    project_id: "project-1",
    team_id: "",
    source_level: SupervisorChainLevel.TeamMember,
    target_level: SupervisorChainLevel.Manager,
    target_hat_assignment_id: "99",
    sender_agent_id: "agent-reviewer-1",
    sender_hat_assignment_id: "hat-reviewer-1",
    tool_type: SupervisorSignalToolType.ReportBlocker,
    status: SupervisorSignalStatus.Sent,
    title: "Release evidence blocker",
    message: "Release screenshots are missing.",
    related_work_item_id: "work-1",
    created_at: new Date("2026-05-31T00:30:00.000Z"),
  };
}

function releaseInboxAnchorRow(): Record<string, unknown> {
  return {
    inbox_anchor_id: "inbox-release-blocker",
    organization_id: "org-1",
    project_id: "project-1",
    team_id: null,
    work_item_id: "work-1",
    target_hat_assignment_id: "99",
    target_agent_id: "agent-release-1",
    title: "Release blocker inbox",
    summary: "Release operator wakeup was triggered by missing gate evidence.",
    priority: ContextPackInboxAnchorPriority.Urgent,
    status: ContextPackInboxAnchorStatus.Unread,
    delivered_at: new Date("2026-05-31T00:40:00.000Z"),
    source_ref: "supervisor_signal:signal-release-blocker",
    trace_id: "trace-release-inbox",
  };
}

function graphEdge(fromNodeId: string, toNodeId: string): GraphEdge {
  return {
    edgeId: `${fromNodeId}-references-${toNodeId}`,
    organizationId: "org-1",
    fromNodeId,
    toNodeId,
    kind: GraphEdgeKind.References,
    confidence: GraphConfidence.Extracted,
    provenance: { source: "test", method: "unit", observedAt: "2026-05-31T00:00:00.000Z" },
    createdAt: "2026-05-31T00:00:00.000Z",
    updatedAt: "2026-05-31T00:00:00.000Z",
    version: 1,
  };
}

function graphEdgeRowFromParameters(parameters: readonly unknown[]): Record<string, unknown> {
  return {
    edge_id: parameters[0],
    organization_id: parameters[1],
    from_node_id: parameters[2],
    to_node_id: parameters[3],
    kind: parameters[4],
    confidence: parameters[5],
    provenance: parameters[6],
    change_set_id: parameters[7],
    retraction_reason: parameters[8],
    created_at: parameters[9],
    updated_at: parameters[10],
    version: parameters[11],
  };
}

function docRowFromParameters(parameters: readonly unknown[]): Record<string, unknown> {
  return {
    doc_unit_id: parameters[0],
    organization_id: parameters[1],
    source_id: parameters[2],
    type: parameters[3],
    scope_kind: parameters[4],
    scope_id: parameters[5],
    title: parameters[6],
    summary: parameters[7],
    content_ref: parameters[8],
    content_hash: parameters[9],
    status: parameters[10],
    freshness_at: parameters[11],
    bound_hat_ids: parameters[12],
    bound_stage_ids: parameters[13],
    supersedes_id: parameters[14],
    provenance_change_set_id: parameters[15],
    created_at: parameters[16],
    updated_at: parameters[17],
    version: parameters[18],
  };
}

function docUnit(overrides: Partial<DocUnit>): DocUnit {
  const id = overrides.docUnitId ?? "doc";
  return {
    docUnitId: id,
    organizationId: "org-1",
    sourceId: "source-main",
    type: DocType.Runbook,
    scopeKind: DocScopeKind.Project,
    scopeId: "project-1",
    title: "Doc",
    summary: "Release context",
    contentRef: `git://docs/${id}.md`,
    contentHash: `hash-${id}`,
    status: DocLifecycleState.Active,
    freshnessAt: "2026-05-30T00:00:00.000Z",
    boundHatIds: [],
    boundStageIds: [],
    provenanceChangeSetId: "cs-docs",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-30T00:00:00.000Z",
    version: 1,
    ...overrides,
  };
}

function memoryRowFromParameters(parameters: readonly unknown[]): Record<string, unknown> {
  return {
    memory_id: parameters[0],
    agent_id: parameters[1],
    hat_assignment_id: parameters[2],
    project_id: parameters[3],
    work_item_id: parameters[4],
    prompt_flow_run_id: parameters[5],
    content: parameters[6],
    retained_at_ms: Date.parse("2026-05-30T00:00:00.000Z"),
  };
}

function releaseMemoryRecord(): MemoryRecord {
  return {
    memoryId: "mem-release",
    organizationId: "org-1",
    tier: MemoryTier.Work,
    scope: "work-1",
    key: "release-evidence-screenshots",
    value: "Prior release review found that screenshots must be attached before sign-off.",
    protected: false,
    writtenBy: "release_operator",
    writtenAt: "2026-05-30T00:00:00.000Z",
  };
}

function releaseMemoryState(): MemoryState {
  return {
    memoryId: "mem-release",
    organizationId: "org-1",
    phase: MemoryPhase.Active,
    confidence: 0.95,
    freshnessAt: "2026-05-31T00:00:00.000Z",
    weight: 0.9,
    reinforcementCount: 2,
    outcome: {
      successCount: 4,
      failureCount: 0,
      inconclusiveCount: 0,
      workItemsObserved: ["work-1"],
    },
    utility: {
      injectedCount: 8,
      citedCount: 7,
    },
    crossScope: {
      distinctScopes: ["work-1"],
      firstObservedAt: "2026-05-30T00:00:00.000Z",
      lastObservedAt: "2026-05-31T00:00:00.000Z",
    },
  };
}

function memoryStateRowFromParameters(parameters: readonly unknown[]): Record<string, unknown> {
  return {
    memory_id: parameters[0],
    organization_id: parameters[1],
    tier: parameters[2],
    scope: parameters[3],
    key: parameters[4],
    phase: parameters[5],
    confidence: parameters[6],
    weight: parameters[7],
    freshness_at: parameters[8],
    reinforcement_count: parameters[9],
    protected: parameters[10],
    written_by: parameters[11],
    written_at: parameters[12],
    context_hint: parameters[13],
    outcome: parameters[14],
    utility: parameters[15],
    cross_scope: parameters[16],
    archived_at: parameters[17],
  };
}

test("runAgentCliMain loads work-market queues from env and renders queue pressure", async () => {
  const stdout: string[] = [];

  const exitCode = await runAgentCliMain({
    argv: [
      "observe",
      "--hat",
      "backend_implementer",
      "--scope",
      RunScope.WorkItem,
      "--phase",
      RunLifecyclePhase.Observing,
      "--run-id",
      "7",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-backend-1",
      "--organization",
      "org-1",
      "--project",
      "project-1",
      "--work-item",
      "work-1",
      "--select-index",
      "13",
    ],
    env: {
      AGENTIC_ORG_WORK_MARKET_QUEUES_JSON: JSON.stringify([workMarketQueue()]),
    },
    now: () => "2026-05-31T12:30:00.000Z",
    writeStdout: (text) => {
      stdout.push(text);
    },
    writeStderr: () => undefined,
    runtime: {
      runCommand: async () => ({ status: "unused" }),
      dispatchTool: async () => ({ status: "unused" }),
      shutdown: async () => undefined,
    },
  });

  equal(exitCode, 0);
  const rendered = stdout.join("\n");
  ok(rendered.includes("work market: elevated"));
  ok(rendered.includes("- active claim claim-stale shard=shard-claimed owner=agent-backend-2 fence=fence-stale"));
});

test("runAgentCliMain rejects malformed work-market review state as typed setup feedback", async () => {
  const stderr: string[] = [];
  let shutdowns = 0;

  const exitCode = await runAgentCliMain({
    argv: [
      "observe",
      "--hat",
      "backend_implementer",
      "--scope",
      RunScope.WorkItem,
      "--phase",
      RunLifecyclePhase.Observing,
      "--select-index",
      "13",
    ],
    env: {
      AGENTIC_ORG_WORK_MARKET_QUEUES_JSON: JSON.stringify([{ ...workMarketQueue(), reviews: "not-array" }]),
    },
    now: () => "2026-05-31T12:30:00.000Z",
    writeStdout: () => undefined,
    writeStderr: (text) => {
      stderr.push(text);
    },
    runtime: {
      runCommand: async () => ({ status: "unused" }),
      dispatchTool: async () => ({ status: "unused" }),
      shutdown: async () => {
        shutdowns += 1;
      },
    },
  });

  equal(exitCode, 2);
  equal(shutdowns, 1);
  ok(stderr.join("").includes("work-market queue reviews must be an array"));
});

test("runAgentCliMain reports malformed env JSON as typed setup feedback instead of throwing", async () => {
  const stderr: string[] = [];
  let shutdowns = 0;

  const exitCode = await runAgentCliMain({
    argv: ["observe", "--hat", "release_operator", "--scope", RunScope.WorkItem],
    env: { AGENTIC_ORG_PROMPT_FLOW_TASKS_JSON: "{" },
    now: () => "2026-05-31T00:00:00.000Z",
    writeStdout: () => undefined,
    writeStderr: (text) => {
      stderr.push(text);
    },
    runtime: {
      runCommand: async () => ({ status: "accepted" }),
      dispatchTool: async () => ({ status: "unused" }),
      shutdown: async () => {
        shutdowns += 1;
      },
    },
  });

  equal(exitCode, 2);
  equal(shutdowns, 1);
  ok(stderr.join("").includes("agent CLI setup failed:"));
});

test("runAgentCliMain reports production runtime bootstrap failures as typed setup feedback", async () => {
  const stderr: string[] = [];

  const exitCode = await runAgentCliMain({
    argv: ["observe", "--hat", "release_operator", "--scope", RunScope.WorkItem],
    env: { COCKROACH_DATABASE_URL: "postgresql://root@127.0.0.1:1/defaultdb?sslmode=disable" },
    now: () => "2026-05-31T00:00:00.000Z",
    writeStdout: () => undefined,
    writeStderr: (text) => {
      stderr.push(text);
    },
  });

  equal(exitCode, 2);
  ok(stderr.join("").includes("agent CLI setup failed:"));
});

test("runAgentCliMain persists control-bypass rejection evidence", async () => {
  const events: OrgEvent[] = [];

  const exitCode = await runAgentCliMain({
    argv: [
      "observe",
      "--hat",
      "release_operator",
      "--scope",
      RunScope.WorkItem,
      "--phase",
      RunLifecyclePhase.AwaitingGate,
      "--run-id",
      "4",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-release-1",
      "--organization",
      "org-1",
      "--project",
      "project-1",
      "--work-item",
      "work-control-bypass",
      "--gate-approved",
      "--select-index",
      "4",
    ],
    env: {},
    now: () => "2026-05-31T00:00:00.000Z",
    writeStdout: () => undefined,
    writeStderr: () => undefined,
    runtime: {
      runCommand: async () => ({ status: "unused" }),
      dispatchTool: async () => ({ status: "unused" }),
      authorizeSlot: async () => ({
        status: "denied",
        reason: ActRejectionReason.ControlPlaneDenied,
        message: "ESTOP active",
      }),
      appendObserveActTick: async (event) => {
        events.push(event);
      },
      shutdown: async () => undefined,
    } as AgentCliMainRuntime & { appendObserveActTick: (event: OrgEvent) => Promise<void> },
  });

  equal(exitCode, 1);
  equal(events.length, 1);
  ok(events[0]?.evidenceRefs.includes("observe-act:control_bypass_rejected:control_plane_denied:4"));
});

test("runAgentCliMain wires production control-plane authorization for prompt-flow tool secrets", async () => {
  const events: OrgEvent[] = [];
  let loadedContext = false;

  const exitCode = await runAgentCliMain({
    argv: [
      "observe",
      "--hat",
      "release_operator",
      "--scope",
      RunScope.WorkItem,
      "--phase",
      RunLifecyclePhase.AwaitingGate,
      "--run-id",
      "6",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-release-1",
      "--organization",
      "org-secret-prod",
      "--project",
      "project-1",
      "--work-item",
      "work-prompt-flow-secret",
      "--gate-approved",
      "--select-index",
      "6",
    ],
    env: {
      AGENTIC_ORG_PROMPT_FLOW_TASKS_JSON: JSON.stringify([{
        taskId: "task-secret-context",
        workItemId: "work-prompt-flow-secret",
        title: "Load release context",
        promptFlowId: "flow-release",
        label: "load release context",
        scope: RunScope.WorkItem,
        priority: 100,
        allowedHatIds: ["release_operator"],
        directions: ["Load scoped release context."],
        toolInjections: [{ tool: "github.publish_release", requiredSecretScopes: ["github:write"] }],
        metrics: [],
        contextArtifactRefs: [],
      }]),
    },
    now: () => "2026-05-31T00:00:00.000Z",
    writeStdout: () => undefined,
    writeStderr: () => undefined,
    runtime: {
      runCommand: async () => ({ status: "unused" }),
      dispatchTool: async () => ({ status: "unused" }),
      loadPromptFlowContext: async () => {
        loadedContext = true;
        return {
          taskId: "task-secret-context",
          promptFlowId: "flow-release",
          directions: [],
          toolInjections: [],
          metrics: [],
          contextArtifacts: [],
        };
      },
      loadControlPlaneFlags: async () => [],
      availableSecretScopes: [],
      appendObserveActTick: async (event) => {
        events.push(event);
      },
      shutdown: async () => undefined,
    } as AgentCliMainRuntime & {
      appendObserveActTick: (event: OrgEvent) => Promise<void>;
      loadControlPlaneFlags: (organizationId: string, evaluatedAt: string) => Promise<readonly ControlPlaneFlag[]>;
      availableSecretScopes: readonly string[];
    },
  });

  equal(exitCode, 1);
  equal(loadedContext, false);
  equal(events.length, 1);
  ok(events[0]?.evidenceRefs.includes("observe-act:selected_slot:6"));
});

test("runAgentCliMain wires production control-plane authorization for active flags", async () => {
  const events: OrgEvent[] = [];
  let commandDispatched = false;

  const exitCode = await runAgentCliMain({
    argv: [
      "observe",
      "--hat",
      "release_operator",
      "--scope",
      RunScope.WorkItem,
      "--phase",
      RunLifecyclePhase.AwaitingGate,
      "--run-id",
      "7",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-release-1",
      "--organization",
      "org-freeze-prod",
      "--project",
      "project-1",
      "--work-item",
      "work-command-freeze",
      "--gate-approved",
      "--select-index",
      "4",
    ],
    env: {},
    now: () => "2026-05-31T00:00:00.000Z",
    writeStdout: () => undefined,
    writeStderr: () => undefined,
    runtime: {
      runCommand: async () => {
        commandDispatched = true;
        return { status: "should_not_dispatch" };
      },
      dispatchTool: async () => ({ status: "unused" }),
      loadControlPlaneFlags: async () => [{
        controlPlaneFlagId: "flag-org-freeze",
        organizationId: "org-freeze-prod",
        scope: { kind: ControlPlaneScopeKind.Organization },
        flag: ControlPlaneFlagKind.Freeze,
        reason: "operator freeze",
        setByHatId: "incident_commander",
        setAt: "2026-05-31T00:00:00.000Z",
      }],
      appendObserveActTick: async (event) => {
        events.push(event);
      },
      shutdown: async () => undefined,
    } as AgentCliMainRuntime & {
      appendObserveActTick: (event: OrgEvent) => Promise<void>;
      loadControlPlaneFlags: (organizationId: string, evaluatedAt: string) => Promise<readonly ControlPlaneFlag[]>;
    },
  });

  equal(exitCode, 1);
  equal(commandDispatched, false);
  equal(events.length, 1);
  ok(events[0]?.evidenceRefs.includes("observe-act:control_bypass_rejected:control_plane_denied:4"));
});

test("runAgentCliMain loads active production rate limits before selected prompt-flow tool dispatch", async () => {
  const events: OrgEvent[] = [];
  let loadedContext = false;

  const exitCode = await runAgentCliMain({
    argv: [
      "observe",
      "--hat",
      "release_operator",
      "--scope",
      RunScope.WorkItem,
      "--phase",
      RunLifecyclePhase.AwaitingGate,
      "--run-id",
      "8",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-release-1",
      "--organization",
      "org-rate-limit-prod",
      "--project",
      "project-1",
      "--work-item",
      "work-command-rate-limit",
      "--gate-approved",
      "--select-index",
      "6",
    ],
    env: {
      AGENTIC_ORG_PROMPT_FLOW_TASKS_JSON: JSON.stringify([{
        taskId: "task-rate-limit-context",
        workItemId: "work-command-rate-limit",
        title: "Load release context",
        promptFlowId: "flow-release-rate-limit",
        label: "load release context",
        scope: RunScope.WorkItem,
        priority: 100,
        allowedHatIds: ["release_operator"],
        directions: ["Load scoped release context."],
        toolInjections: [{ tool: "github.publish_release", requiredSecretScopes: ["github:write"] }],
        metrics: [],
        contextArtifactRefs: [],
      }]),
    },
    now: () => "2026-05-31T00:00:00.000Z",
    writeStdout: () => undefined,
    writeStderr: () => undefined,
    runtime: {
      runCommand: async () => ({ status: "unused" }),
      dispatchTool: async () => ({ status: "unused" }),
      loadPromptFlowContext: async () => {
        loadedContext = true;
        return {
          taskId: "task-rate-limit-context",
          promptFlowId: "flow-release-rate-limit",
          directions: [],
          toolInjections: [],
          metrics: [],
          contextArtifacts: [],
        };
      },
      loadControlPlaneFlags: async () => [],
      loadControlPlaneRateLimits: async () => [{
        rateLimitId: "rate-limit-tools",
        organizationId: "org-rate-limit-prod",
        scope: { kind: ControlPlaneScopeKind.Tenant, tenantId: "org-rate-limit-prod" },
        kind: ControlPlaneRateLimitKind.ExternalProviderCalls,
        window: {
          startedAt: "2026-05-30T23:59:00.000Z",
          endsAt: "2026-05-31T00:01:00.000Z",
        },
        limit: 1,
        used: 1,
      }],
      availableSecretScopes: ["github:write"],
      appendObserveActTick: async (event) => {
        events.push(event);
      },
      shutdown: async () => undefined,
    } as AgentCliMainRuntime & {
      appendObserveActTick: (event: OrgEvent) => Promise<void>;
      loadControlPlaneFlags: (organizationId: string, evaluatedAt: string) => Promise<readonly ControlPlaneFlag[]>;
      loadControlPlaneRateLimits: (
        organizationId: string,
        evaluatedAt: string,
      ) => Promise<readonly ControlPlaneRateLimit[]>;
      availableSecretScopes: readonly string[];
    },
  });

  equal(exitCode, 1);
  equal(loadedContext, false);
  equal(events.length, 1);
  ok(events[0]?.evidenceRefs.includes("observe-act:control_bypass_rejected:control_plane_denied:6"));
});

test("runAgentCliMain loads prompt-flow context and persists observe-act tick evidence", async () => {
  const stdout: string[] = [];
  const events: OrgEvent[] = [];

  const exitCode = await runAgentCliMain({
    argv: [
      "observe",
      "--hat",
      "release_operator",
      "--scope",
      RunScope.WorkItem,
      "--phase",
      RunLifecyclePhase.AwaitingGate,
      "--run-id",
      "2",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-release-1",
      "--organization",
      "org-1",
      "--project",
      "project-1",
      "--work-item",
      "work-prompt-flow",
      "--gate-approved",
      "--select-index",
      "6",
    ],
    env: {
      AGENTIC_ORG_PROMPT_FLOW_TASKS_JSON: JSON.stringify([{
        taskId: "task-context",
        workItemId: "work-prompt-flow",
        title: "Load implementation context",
        promptFlowId: "flow-code-change",
        label: "load context",
        scope: RunScope.WorkItem,
        priority: 100,
        allowedHatIds: ["release_operator"],
        directions: ["Read the scoped implementation plan."],
        toolInjections: [],
        metrics: [{ id: "flow.ready", label: "flow ready", value: true }],
        contextArtifactRefs: ["artifact:plan"],
      }]),
    },
    now: () => "2026-05-31T00:00:00.000Z",
    writeStdout: (text) => {
      stdout.push(text);
    },
    writeStderr: () => undefined,
    runtime: {
      runCommand: async () => ({ status: "unused" }),
      dispatchTool: async () => ({ status: "unused" }),
      loadPromptFlowContext: async (request) => ({
        taskId: request.taskId,
        promptFlowId: request.promptFlowId,
        directions: request.directions,
        toolInjections: request.toolInjections,
        metrics: request.metrics,
        contextArtifacts: [{ id: "artifact:plan", label: "Plan", value: "phase plan" }],
      }),
      appendObserveActTick: async (event) => {
        events.push(event);
      },
      shutdown: async () => undefined,
    } as AgentCliMainRuntime & { appendObserveActTick: (event: OrgEvent) => Promise<void> },
  });

  equal(exitCode, 0);
  ok(stdout.join("").includes("action: loaded context task-context"));
  equal(events.length, 1);
  ok(events[0]?.evidenceRefs.includes("observe-act:selected_slot:6"));
  ok(events[0]?.evidenceRefs.includes("observe-act:prompt_flow:flow-code-change"));
});

test("runAgentCliMain persists replayable context-pack snapshots through the runtime port", async () => {
  const snapshots: string[] = [];
  const exitCode = await runAgentCliMain({
    argv: [
      "observe",
      "--hat",
      "release_operator",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-release-1",
      "--organization",
      "org-1",
      "--project",
      "project-1",
      "--work-item",
      "work-1",
      "--scope",
      "work_item",
      "--phase",
      "awaiting_gate",
      "--gate-approved",
      "--select-index",
      "4",
    ],
    env: {},
    now: () => "2026-05-31T12:00:00.000Z",
    writeStdout: () => {},
    writeStderr: () => {},
    runtime: {
      runCommand: async () => ({ ok: true }),
      dispatchTool: async () => ({ ok: true }),
      recordContextPackSnapshot: async (snapshot) => {
        snapshots.push(JSON.stringify({
          contextPackId: snapshot.context.pack.id,
          status: snapshot.context.status,
          recordedAt: snapshot.recordedAt,
          trace: snapshot.trace,
        }));
      },
      shutdown: async () => {},
    },
  });

  equal(exitCode, 0);
  equal(snapshots.length, 1);
  deepEqual(JSON.parse(snapshots[0]!), {
    contextPackId: "ctx:1:99:missing-builder",
    status: "missing",
    recordedAt: "2026-05-31T12:00:00.000Z",
    trace: {
      correlationId: "observe-cli-1",
      causationId: "observe-cli-1",
      traceId: "observe-cli-1",
    },
  });
});

test("runAgentCliMain persists glass-halo status evidence", async () => {
  const stdout: string[] = [];
  const events: OrgEvent[] = [];

  const exitCode = await runAgentCliMain({
    argv: [
      "observe",
      "--hat",
      "release_operator",
      "--scope",
      RunScope.WorkItem,
      "--phase",
      RunLifecyclePhase.AwaitingGate,
      "--run-id",
      "5",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-release-1",
      "--organization",
      "org-1",
      "--project",
      "project-1",
      "--work-item",
      "work-status",
      "--gate-approved",
      "--select-index",
      "13",
    ],
    env: {
      AGENTIC_ORG_PROMPT_FLOW_TASKS_JSON: JSON.stringify([{
        taskId: "task-status",
        workItemId: "work-status",
        title: "Load implementation context",
        promptFlowId: "flow-status",
        label: "load context",
        scope: RunScope.WorkItem,
        priority: 100,
        allowedHatIds: ["release_operator"],
        directions: ["Read the scoped implementation plan."],
        toolInjections: [],
        metrics: [],
        contextArtifactRefs: [],
      }]),
    },
    now: () => "2026-05-31T00:00:00.000Z",
    writeStdout: (text) => {
      stdout.push(text);
    },
    writeStderr: () => undefined,
    runtime: {
      runCommand: async () => {
        throw new Error("status must not dispatch command side effects");
      },
      dispatchTool: async () => {
        throw new Error("status must not dispatch MCP side effects");
      },
      appendObserveActTick: async (event) => {
        events.push(event);
      },
      shutdown: async () => undefined,
    } as AgentCliMainRuntime & { appendObserveActTick: (event: OrgEvent) => Promise<void> },
  });

  equal(exitCode, 0);
  ok(stdout.join("").includes("action: status glass_halo_status work_item awaiting_gate"));
  equal(events.length, 1);
  ok(events[0]?.evidenceRefs.includes("observe-act:selected_slot:13"));
  ok(events[0]?.evidenceRefs.includes("observe-act:status:glass_halo_status"));
  ok(events[0]?.evidenceRefs.includes("observe-act:status_scope:work_item"));
  ok(events[0]?.evidenceRefs.includes("observe-act:status_phase:awaiting_gate"));
  ok(events[0]?.evidenceRefs.includes("observe-act:prompt_flow:flow-status"));
});

test("runAgentCliMain persists selector rejection evidence from local model fallback", async () => {
  const events: OrgEvent[] = [];

  const exitCode = await runAgentCliMain({
    argv: [
      "observe",
      "--hat",
      "release_operator",
      "--scope",
      RunScope.WorkItem,
      "--phase",
      RunLifecyclePhase.AwaitingGate,
      "--run-id",
      "3",
      "--hat-assignment",
      "99",
      "--agent",
      "agent-release-1",
      "--organization",
      "org-1",
      "--project",
      "project-1",
      "--work-item",
      "work-selector",
      "--gate-approved",
    ],
    env: {
      AGENTIC_ORG_LLM_BASE_URL: "http://ollama:11434",
      AGENTIC_ORG_LLM_MODEL: "llama3.1",
    },
    fetchImpl: (async () =>
      new Response(JSON.stringify({ message: { content: JSON.stringify({ slot: 15, reason: "try escalation" }) }, model: "llama3.1" }))) as typeof fetch,
    now: () => "2026-05-31T00:00:00.000Z",
    writeStdout: () => undefined,
    writeStderr: () => undefined,
    runtime: {
      runCommand: async () => ({ status: "accepted" }),
      dispatchTool: async () => ({ status: "unused" }),
      appendObserveActTick: async (event) => {
        events.push(event);
      },
      shutdown: async () => undefined,
    } as AgentCliMainRuntime & { appendObserveActTick: (event: OrgEvent) => Promise<void> },
  });

  equal(exitCode, 0);
  equal(events.length, 1);
  ok(events[0]?.evidenceRefs.includes("observe-act:selected_slot:4"));
  ok(events[0]?.evidenceRefs.includes("observe-act:selector_rejected:non_selectable_slot:15"));
  ok(events[0]?.evidenceRefs.includes("observe-act:selector_rejected_fallback_slot:4"));
});

test("createAgentCliMcpDispatcher dispatches in-process metrics tools and returns typed unknown-tool feedback", async () => {
  const dispatchTool = createAgentCliMcpDispatcher();
  const slot: Menu16Slot = {
    index: 0,
    direction: "commit.a",
    label: "metrics",
    availability: TriAvailability.True,
  };

  const report = await dispatchTool("analyze_source", {
    filePath: "sample.ts",
    source: "export function tiny() { return 1; }\n",
  }, slot);
  const unknown = await dispatchTool("missing_tool", {}, slot);

  equal((report as { outcome?: string }).outcome, "ok");
  deepEqual(unknown, {
    outcome: "feedback",
    feedback: {
      reason: "unknown_tool",
      message: "no metrics tool named 'missing_tool'",
    },
  });
});

function workMarketQueue(overrides: Partial<HatWorkQueue> = {}): HatWorkQueue {
  return {
    queueId: "queue-backend-project-1",
    organizationId: "org-1",
    hatId: "backend_implementer",
    scope: { kind: "project", id: "project-1" },
    priorityClass: "high",
    slaDeadlineAt: "2026-05-31T14:00:00.000Z",
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
        ownerAgentId: "agent-backend-2",
        hatAssignmentId: "hat-backend-2",
        fencingToken: "fence-stale",
        leaseExpiresAt: "2026-05-31T12:00:00.000Z",
        heartbeatAt: "2026-05-31T11:55:00.000Z",
        scheduleBlockId: "block-1",
        runtimeSessionId: "session-1",
        workspaceRef: "worktree:agent-backend-2",
        credentialScope: "tenant:org-1:repo:agentic-organization",
        compensatingAction: "release_claim_and_requeue_shard",
        state: WorkClaimState.Active,
        claimedAt: "2026-05-31T11:45:00.000Z",
      },
    ],
    runtimeLeases: [],
    reviews: [],
    ...overrides,
  };
}
