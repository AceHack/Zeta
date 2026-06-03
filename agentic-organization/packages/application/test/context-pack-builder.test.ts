import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  DepartmentId,
  DocLifecycleState,
  DocScopeKind,
  DocType,
  DiscussionAnchorType,
  DiscussionExpectedOutput,
  QualityGateKind,
  QualityGateOutcome,
  ScheduleBlockState,
  ScheduleBlockType,
  SupervisorChainLevel,
  SupervisorSignalStatus,
  SupervisorSignalToolType,
  GraphConfidence,
  GraphEdgeKind,
  GraphNodeKind,
  HatLevel,
  graphNodeId,
  type DocEntity,
  type DocUnit,
  type GraphEdge,
} from "../../domain/src/index.ts";
import {
  asZetaIdDecimal,
  buildHatDefinitions,
  ContextPackCurationStageKind,
  ContextPackAttentionLaneKind,
  ContextPackAttentionLaneRefKind,
  ContextPackCurationProfileId,
  ContextPackCurationProfileInstruction,
  ContextPackDocumentFocusProfileId,
  ContextPackConfidenceBasisKind,
  ContextPackAdvisoryPromotionDecisionStatus,
  ContextPackFreshness,
  ContextPackItemKind,
  ContextPackMemorySimilarityCategory,
  ContextPackInboxAnchorPriority,
  ContextPackInboxAnchorStatus,
  ContextPackOmissionReason,
  ContextPackSourcePointerKind,
  ContextPackStatus,
  ContextPackSynthesisRequirementDecision,
  ContextPackSynthesisRequirementReason,
  ContextPackUncertaintySeverity,
  ContextPackUncertaintySignalKind,
  DEFAULT_CONTEXT_PACK_ADVISORY_PROMOTION_POLICY_VERSION,
  createDefaultContextPackCompletenessPolicy,
  createDefaultContextPackAdvisoryPromotionPolicy,
  createDefaultContextPackSynthesisRequirementPolicy,
  evaluateContextPackReadiness,
  createDeterministicContextPackBuilder,
  createInMemoryContextPackDocumentPort,
  createInMemoryContextPackInboxAnchorPort,
  createInMemoryContextPackLifecycleAnchorPort,
  contextPackAdvisoryPromotionFingerprint,
  RunLifecyclePhase,
  RunScope,
  type ContextPackBuildRequest,
  type ContextPackAdvisoryPromotionPolicyPort,
  type ContextPackDocumentReadPort,
  type ContextPackEphemeralSynthesisPort,
  type ContextPackItem,
  type ContextPackLifecycleAnchorPort,
  type ContextPackInboxAnchor,
  type ContextPackMemoryRecallPort,
  type ContextPackTelemetryEvidencePort,
  type GraphStoreReader,
} from "../src/index.ts";

const observedAt = "2026-05-31T00:00:00.000Z";
const engineeringDirector = buildHatDefinitions().find((hat) => hat.id === "engineering_director")!;
const backendImplementer = buildHatDefinitions().find((hat) => hat.id === "backend_implementer")!;
const integrationEngineer = buildHatDefinitions().find((hat) => hat.id === "integration_engineer")!;
const productOwner = buildHatDefinitions().find((hat) => hat.id === "product_owner")!;
const architect = buildHatDefinitions().find((hat) => hat.id === "architect")!;
const qaReviewer = buildHatDefinitions().find((hat) => hat.id === "qa_reviewer")!;
const securityReviewer = buildHatDefinitions().find((hat) => hat.id === "security_reviewer")!;
const engineeringManager = buildHatDefinitions().find((hat) => hat.id === "engineering_manager")!;
const readinessReviewer = buildHatDefinitions().find((hat) => hat.id === "readiness_reviewer")!;
const tpm = buildHatDefinitions().find((hat) => hat.id === "tpm")!;
const releaseManager = buildHatDefinitions().find((hat) => hat.id === "release_manager")!;
const incidentCommander = buildHatDefinitions().find((hat) => hat.id === "incident_commander")!;
const memoryCurator = buildHatDefinitions().find((hat) => hat.id === "memory_curator")!;
const hatDesigner = buildHatDefinitions().find((hat) => hat.id === "hat_designer")!;
const costController = buildHatDefinitions().find((hat) => hat.id === "cost_controller")!;
const TestCurationProfile = {
  Id: "test_profile",
  PolicyVersion: "test_profile:v1",
  Instruction: "Test profile instruction",
  MutatedProjectId: "project-mutated-by-profile",
  MutatedWorkItemId: "work-mutated-by-profile",
  SyntheticItemId: "profile:synthetic-mutation",
  RequiredMemoryId: "test_profile_required_memory",
} as const;

test("deterministic context builder always includes a hat communication brief before synthesis", async () => {
  const synthesis: ContextPackEphemeralSynthesisPort = {
    synthesize: async (query) => {
      ok(query.items.some((item) => item.kind === ContextPackItemKind.HatCommunicationBrief));
      return {
        summary: "Communication context was available to synthesis.",
        briefing: {
          title: "Director communication briefing",
          summary: "The director should route blocker questions through the supervisor chain.",
          evidenceRefs: ["hat_brief:engineering_director"],
        },
        curationEvidenceRefs: ["hat_brief:engineering_director"],
      };
    },
  };
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [],
      entities: [],
    }),
    synthesis,
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));
  const brief = result.pack.items.find((item) => item.id === "hat_brief:engineering_director");

  equal(brief?.kind, ContextPackItemKind.HatCommunicationBrief);
  equal(brief?.required, true);
  equal(brief?.title, "Hat communication brief: Engineering Director");
  ok(brief?.summary.includes("Duty: Wear the Engineering Director hat"));
  ok(brief?.summary.includes("supervisor c_suite:cto"));
  ok(brief?.summary.includes("request_decision"));
  ok(brief?.summary.includes("required evidence: options, recommended path, tradeoffs"));
  ok(brief?.reasons.includes("hat-duty"));
  ok(brief?.reasons.includes("supervisor:cto"));
  ok(brief?.citationRefs?.includes("hat:engineering_director"));
  ok(brief?.citationRefs?.includes("hat:cto"));
  ok(brief?.sourcePointers?.some((pointer) =>
    pointer.kind === ContextPackSourcePointerKind.GraphNode &&
    pointer.nodeId === graphNodeId("org-lfg", GraphNodeKind.Hat, "engineering_director")
  ));
  ok(brief?.sourcePointers?.some((pointer) =>
    pointer.kind === ContextPackSourcePointerKind.GraphNode &&
    pointer.nodeId === graphNodeId("org-lfg", GraphNodeKind.Hat, "cto")
  ));
  ok(brief?.sourcePointers?.some((pointer) =>
    pointer.kind === ContextPackSourcePointerKind.Policy && pointer.policyId === "hat_communication_brief"
  ));
  ok(result.pack.items.some((item) =>
    item.kind === ContextPackItemKind.SynthesisBriefing &&
    item.sourcePointers?.some((pointer) =>
      pointer.kind === ContextPackSourcePointerKind.Policy && pointer.policyId === "hat_communication_brief"
    )
  ));
});

test("deterministic context builder marks required document lane missing when no source-of-truth docs are admitted", async () => {
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [],
      entities: [],
    }),
  });

  const result = await builder.build(request({
    hat: engineeringDirector,
    phase: RunLifecyclePhase.Blocked,
    scope: RunScope.Project,
    workItemId: "work-billing-blocked",
  }));

  ok(result.pack.curationPlan?.lanes.some((lane) =>
    lane.kind === ContextPackAttentionLaneKind.RequiredDocuments &&
    lane.required &&
    lane.refs.length === 0
  ));
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.nodeId === "required_curation_lane:required_documents" &&
    item.reason === ContextPackOmissionReason.NotIndexed &&
    item.message.includes("required_documents")
  ));
});

test("deterministic context builder makes required ephemeral synthesis absence visible for management blockers", async () => {
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({
          docUnitId: "billing-brd",
          type: DocType.Brd,
          title: "Billing BRD",
          summary: "Billing recovery business rules.",
        }),
      ],
      entities: [],
    }),
  });

  const result = await builder.build(request({
    hat: engineeringDirector,
    phase: RunLifecyclePhase.Blocked,
    scope: RunScope.Project,
    workItemId: "work-billing-blocked",
  }));

  ok(result.pack.curationPlan?.requiredStages?.includes(ContextPackCurationStageKind.EphemeralSynthesis));
  ok(!result.pack.curationTrace.some((stage) => stage.stage === ContextPackCurationStageKind.EphemeralSynthesis));
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.nodeId === "ephemeral_synthesis:required_unavailable" &&
    item.reason === ContextPackOmissionReason.RetrievalFailed &&
    item.message.includes("required for blocked management context")
  ));
  equal(evaluateContextPackReadiness(result.pack, observedAt), ContextPackStatus.Incomplete);
});

test("default synthesis requirement policy requires ephemeral curation for wake-requested context builds", async () => {
  const policy = createDefaultContextPackSynthesisRequirementPolicy();

  const result = await policy.evaluate({
    request: {
      ...request({
        hat: backendImplementer,
        phase: RunLifecyclePhase.Executing,
        scope: RunScope.WorkItem,
        workItemId: "work-execution",
      }),
      wakeContext: {
        reason: "hat_assignment_changed",
        requiresBuild: true,
        previousContextPackId: "ctx-stale-implementer",
      },
    },
    curationPlan: {
      lanes: [],
      requiredStages: [],
      deterministicInstructions: [],
    },
    items: [],
    omissions: [],
  });

  equal(result.decision, ContextPackSynthesisRequirementDecision.Required);
  equal(result.reason, ContextPackSynthesisRequirementReason.WakeRequestedContextBuild);
});

test("deterministic context builder marks missing ephemeral synthesis for wake-requested context builds", async () => {
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({
          docUnitId: "execution-runbook",
          type: DocType.Runbook,
          title: "Execution Runbook",
          summary: "Implementer execution context.",
        }),
      ],
      entities: [],
    }),
  });

  const result = await builder.build({
    ...request({
      hat: backendImplementer,
      phase: RunLifecyclePhase.Executing,
      scope: RunScope.WorkItem,
      workItemId: "work-execution",
    }),
    wakeContext: {
      reason: "hat_assignment_changed",
      requiresBuild: true,
      previousContextPackId: "ctx-stale-implementer",
    },
  });

  ok(result.pack.curationPlan?.requiredStages?.includes(ContextPackCurationStageKind.EphemeralSynthesis));
  ok(!result.pack.curationTrace.some((stage) => stage.stage === ContextPackCurationStageKind.EphemeralSynthesis));
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.nodeId === "ephemeral_synthesis:required_unavailable" &&
    item.reason === ContextPackOmissionReason.RetrievalFailed &&
    item.message.includes("wake-requested context build")
  ));
  equal(evaluateContextPackReadiness(result.pack, observedAt), ContextPackStatus.Incomplete);
});

test("deterministic context builder rejects hat communication briefs outside the active hat supervisor scope", async () => {
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [],
      entities: [],
    }),
    hatCommunicationBrief: {
      build: () => ({
        brief: {
          hatId: "backend_implementer",
          duty: "Wrong hat duty.",
          sourceLevel: "team_member",
          supervisor: {
            targetLevel: "manager",
            targetHatId: "security_director",
          },
          availableTools: [{
            toolType: "request_decision",
            useWhen: "wrong path",
            requiredEvidence: ["evidence"],
          }],
        },
        citationRefs: ["hat:backend_implementer", "hat:security_director"],
        sourcePointers: [
          { kind: ContextPackSourcePointerKind.GraphNode, nodeId: "backend_implementer" },
          { kind: ContextPackSourcePointerKind.GraphNode, nodeId: "security_director" },
          { kind: ContextPackSourcePointerKind.Policy, policyId: "hat_communication_brief", version: "test" },
        ],
        policyVersion: "test",
      }),
    },
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));

  ok(!result.pack.items.some((item) => item.kind === ContextPackItemKind.HatCommunicationBrief));
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.nodeId === "hat_communication_brief" &&
    item.reason === ContextPackOmissionReason.OutOfScope &&
    item.message.includes("must match active hat")
  ));
});

test("default hat communication brief derives supervisor level from the target hat definition", async () => {
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [],
      entities: [],
    }),
  });

  const result = await builder.build(request({
    hat: backendImplementer,
    scope: RunScope.WorkItem,
    phase: RunLifecyclePhase.Executing,
  }));
  const brief = result.pack.items.find((item) => item.kind === ContextPackItemKind.HatCommunicationBrief);

  ok(brief?.summary.includes("supervisor director:engineering_director"));
  ok(!brief?.summary.includes("supervisor manager:engineering_director"));
});

test("deterministic context builder records hat communication brief provider failures as omissions", async () => {
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [],
      entities: [],
    }),
    hatCommunicationBrief: {
      build: () => {
        throw new Error("policy store offline");
      },
    },
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));

  ok(!result.pack.items.some((item) => item.kind === ContextPackItemKind.HatCommunicationBrief));
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.nodeId === "hat_communication_brief" &&
    item.reason === ContextPackOmissionReason.RetrievalFailed &&
    item.message.includes("policy store offline")
  ));
});

test("deterministic context builder packs scoped documents, required consults, conflicts, and typed doc provenance", async () => {
  const documents = createInMemoryContextPackDocumentPort({
    corpus: [
      docUnit({
        docUnitId: "brd-billing",
        type: DocType.Brd,
        title: "Billing BRD",
        summary: "Customer billing must recover failed invoices.",
        boundHatIds: ["engineering_director"],
      }),
      docUnit({
        docUnitId: "release-handbook",
        type: DocType.Handbook,
        title: "Release Handbook",
        summary: "Every blocked release needs director escalation.",
        boundStageIds: [RunLifecyclePhase.Blocked],
      }),
      docUnit({
        docUnitId: "refund-policy-a",
        type: DocType.Policy,
        title: "Refund Policy",
        summary: "Refunds allowed for 30 days.",
        contentHash: "policy-a",
      }),
      docUnit({
        docUnitId: "refund-policy-b",
        type: DocType.Policy,
        title: "refund policy",
        summary: "Refunds allowed for 60 days.",
        contentHash: "policy-b",
      }),
      docUnit({
        docUnitId: "other-org",
        organizationId: "org-other",
        title: "Wrong org",
        summary: "Must never be packed.",
      }),
    ],
    entities: [entity("ent-billing", "Billing", ["billing service"])],
    sourceGraphVersion: "docs-v1",
  });
  const builder = createDeterministicContextPackBuilder({
    documents,
    policyVersion: "context-policy:v1",
    tokenBudget: 2048,
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));

  equal(result.pack.sourceGraphVersion, "docs-v1");
  equal(result.pack.policyVersion, "context-policy:v1");
  equal(result.pack.hatId, "engineering_director");
  ok(result.pack.items.some((item) => item.id === "doc:brd-billing"));
  ok(result.pack.items.some((item) => item.id === "doc:release-handbook"));
  ok(!result.pack.items.some((item) => item.id === "doc:other-org"));
  const brd = result.pack.items.find((item) => item.id === "doc:brd-billing");
  equal(brd?.kind, ContextPackItemKind.BusinessDocument);
  equal(brd?.required, true);
  deepEqual(brd?.sourcePointers?.[0], {
    kind: ContextPackSourcePointerKind.DocUnit,
    docUnitId: "brd-billing",
    organizationId: "org-lfg",
    docType: DocType.Brd,
    scopeKind: DocScopeKind.Project,
    scopeId: "project-billing",
    contentRef: "git://docs/brd-billing.md",
    contentHash: "hash-brd-billing",
    sourceId: "source-main",
    version: 1,
    provenanceChangeSetId: "cs-docs",
  });
  ok(result.pack.contradictions.some((contradiction) => contradiction.includes("refund-policy-a")));
  ok(result.pack.curationTrace.some((stage) => stage.stage === ContextPackCurationStageKind.DeterministicScope));
  ok(result.pack.curationTrace.some((stage) => stage.stage === ContextPackCurationStageKind.RequiredConsult));
});

test("deterministic context builder augments retrieved docs with graph neighborhoods and typed graph provenance", async () => {
  const graph = graphStore([
    edge("node-billing", GraphEdgeKind.DependsOn, "node-auth"),
    edge("node-web", GraphEdgeKind.DependsOn, "node-billing"),
    edge("node-billing", GraphEdgeKind.ChangedBy, "node-cs-1", GraphConfidence.Extracted, "cs-1"),
  ]);
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({
          docUnitId: "billing-adr",
          type: DocType.Adr,
          title: "Billing ADR",
          summary: "Billing depends on auth for invoice recovery.",
        }),
      ],
      entities: [entity("ent-billing", "Billing", [])],
      sourceGraphVersion: "docs-v2",
    }),
    graph,
    nodeIdForDocUnit: (unit) => unit.docUnitId === "billing-adr" ? "node-billing" : null,
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));

  const graphItem = result.pack.items.find((item) => item.id === "graph:node-billing");
  equal(graphItem?.kind, ContextPackItemKind.GraphNeighborhood);
  ok(graphItem?.summary.includes("outbound=2"));
  ok(graphItem?.sourcePointers?.some((pointer) =>
    pointer.kind === ContextPackSourcePointerKind.GraphNode && pointer.nodeId === "node-billing",
  ));
  ok(graphItem?.sourcePointers?.some((pointer) =>
    pointer.kind === ContextPackSourcePointerKind.GraphEdge && pointer.edgeId === "node-billing-depends_on-node-auth",
  ));
  ok(result.pack.curationTrace.some((stage) => stage.stage === ContextPackCurationStageKind.GraphTraversal));
});

test("deterministic context builder adds scoped memory pointers and ephemeral synthesis without overriding deterministic context", async () => {
  const memory: ContextPackMemoryRecallPort = {
    recall: async (query) => ({
      memories: [
        {
          memoryId: "mem-1",
          providerId: "hindsight",
          summary: `Prior blocker related to ${query.workItemId}`,
          confidence: 0.82,
          retainedAt: "2026-05-30T00:00:00.000Z",
          creatingAgentId: "agent-prior",
          creatingHatAssignmentId: "hat-prior",
          advisory: true,
          governance: {
            tier: "work",
            phase: "active",
            scope: "work-billing-blocked",
            weight: 0.83,
            readFloor: 0.2,
            freshnessAt: "2026-05-31T00:00:00.000Z",
            outcome: {
              successCount: 4,
              failureCount: 1,
              inconclusiveCount: 0,
            },
            utility: {
              injectedCount: 7,
              citedCount: 5,
            },
          },
          reasons: ["hat-scoped recall"],
        },
      ],
    }),
  };
  const synthesis: ContextPackEphemeralSynthesisPort = {
    synthesize: async (query) => {
      equal(query.hatLevel, HatLevel.Director);
      equal(query.scope, RunScope.Project);
      equal(query.phase, RunLifecyclePhase.Blocked);
      equal(query.organizationId, "org-lfg");
      equal(query.projectId, "project-billing");
      equal(query.workItemId, "work-billing-blocked");
      const authorityLane = query.curationPlan.lanes.find((lane) => lane.kind === ContextPackAttentionLaneKind.Authority);
      equal(authorityLane?.required, true);
      ok(authorityLane?.refs.some((ref) =>
        ref.kind === ContextPackAttentionLaneRefKind.Item && ref.itemId === "hat_brief:engineering_director"
      ));
      const requiredDocsLane = query.curationPlan.lanes.find((lane) =>
        lane.kind === ContextPackAttentionLaneKind.RequiredDocuments
      );
      equal(requiredDocsLane?.required, true);
      ok(requiredDocsLane?.refs.some((ref) =>
        ref.kind === ContextPackAttentionLaneRefKind.Item && ref.itemId === "doc:billing-brd"
      ));
      const memoryLane = query.curationPlan.lanes.find((lane) => lane.kind === ContextPackAttentionLaneKind.Memory);
      equal(memoryLane?.required, false);
      ok(memoryLane?.refs.some((ref) =>
        ref.kind === ContextPackAttentionLaneRefKind.Item && ref.itemId === "memory:mem-1"
      ));
      const legalActionsLane = query.curationPlan.lanes.find((lane) =>
        lane.kind === ContextPackAttentionLaneKind.LegalActions
      );
      equal(legalActionsLane?.required, true);
      ok(legalActionsLane?.refs.some((ref) =>
        ref.kind === ContextPackAttentionLaneRefKind.LegalAction && ref.actionType === "meta.escalate"
      ));
      ok(query.curationPlan.deterministicInstructions.some((instruction) =>
        instruction.includes("Rank required documents and active graph context before advisory memory"),
      ));
      return {
        summary: `Synthesized ${query.items.length} deterministic items for ${query.hatId}`,
        briefing: {
          title: "Director blocker briefing",
          summary: "BRD-backed owner ambiguity requires director staffing decision.",
          evidenceRefs: ["doc:billing-brd"],
          confidence: 0.76,
          reasons: ["hat:director", "blocked-work"],
        },
        rankedContextRefs: [{
          itemId: "doc:billing-brd",
          reason: "Business rules are the highest-priority context for this blocker.",
          evidenceRefs: ["doc:billing-brd"],
        }],
        gapHypotheses: [{
          message: "Ownership evidence may be missing from the indexed meeting notes.",
          evidenceRefs: ["doc:billing-brd"],
          suggestedNextStep: "Ask the engineering manager for the owner decision record.",
        }],
        questions: [{
          question: "Which team owns failed invoice recovery?",
          audienceHatLevel: HatLevel.Manager,
          evidenceRefs: ["doc:billing-brd"],
        }],
        recommendedActionRefs: [{
          actionType: "meta.escalate",
          direction: "Escalate to engineering manager for owner assignment.",
          reason: "The BRD defines the recovery requirement but no owner is present in context.",
          evidenceRefs: ["doc:billing-brd"],
        }],
        lifecycleBlockers: ["director should resolve billing owner ambiguity"],
        curationEvidenceRefs: ["doc:billing-brd"],
      };
    },
  };
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({
          docUnitId: "billing-brd",
          type: DocType.Brd,
          title: "Billing BRD",
          summary: "Recover failed invoices.",
        }),
      ],
      entities: [],
    }),
    memory,
    synthesis,
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));

  ok(result.pack.curationPlan?.lanes.some((lane) =>
    lane.kind === ContextPackAttentionLaneKind.RequiredDocuments &&
    lane.refs.some((ref) => ref.kind === ContextPackAttentionLaneRefKind.Item && ref.itemId === "doc:billing-brd")
  ));
  ok(result.pack.curationPlan?.lanes.some((lane) =>
    lane.kind === ContextPackAttentionLaneKind.Memory &&
    lane.refs.some((ref) => ref.kind === ContextPackAttentionLaneRefKind.Item && ref.itemId === "memory:mem-1")
  ));
  const memoryItem = result.pack.items.find((item) => item.id === "memory:mem-1");
  equal(memoryItem?.kind, ContextPackItemKind.MemoryPointer);
  equal(memoryItem?.required, false);
  equal(memoryItem?.freshness, ContextPackFreshness.Current);
  deepEqual(memoryItem?.sourcePointers?.[0], {
    kind: ContextPackSourcePointerKind.HindsightMemory,
    providerId: "hindsight",
    memoryId: "mem-1",
    creatingAgentId: "agent-prior",
    creatingHatAssignmentId: "hat-prior",
    governance: {
      tier: "work",
      phase: "active",
      scope: "work-billing-blocked",
      weight: 0.83,
      readFloor: 0.2,
      freshnessAt: "2026-05-31T00:00:00.000Z",
      outcome: {
        successCount: 4,
        failureCount: 1,
        inconclusiveCount: 0,
      },
      utility: {
        injectedCount: 7,
        citedCount: 5,
      },
    },
    advisory: true,
  });
  ok(!result.pack.lifecycleBlockers.includes("director should resolve billing owner ambiguity"));
  const briefing = result.pack.items.find((item) => item.id === "synthesis:engineering_director:42:99");
  equal(briefing?.kind, ContextPackItemKind.SynthesisBriefing);
  equal(briefing?.required, false);
  equal(briefing?.title, "Director blocker briefing");
  equal(briefing?.summary, "BRD-backed owner ambiguity requires director staffing decision.");
  equal(briefing?.confidence, 0.76);
  deepEqual(briefing?.reasons, ["hat:director", "blocked-work"]);
  ok(briefing?.sourcePointers?.some((pointer) =>
    pointer.kind === ContextPackSourcePointerKind.DocUnit && pointer.docUnitId === "billing-brd"
  ));
  ok(result.pack.items.some((item) =>
    item.id === "synthesis:engineering_director:42:99:ranked:0:doc-billing-brd" &&
    item.kind === ContextPackItemKind.SynthesisRankedContext &&
    item.summary === "Business rules are the highest-priority context for this blocker." &&
    item.sourcePointers?.some((pointer) =>
      pointer.kind === ContextPackSourcePointerKind.DocUnit && pointer.docUnitId === "billing-brd"
    )
  ));
  ok(result.pack.items.some((item) =>
    item.id === "synthesis:engineering_director:42:99:gap:0" &&
    item.kind === ContextPackItemKind.SynthesisGapHypothesis &&
    item.summary.includes("Ask the engineering manager for the owner decision record") &&
    item.sourcePointers?.some((pointer) =>
      pointer.kind === ContextPackSourcePointerKind.DocUnit && pointer.docUnitId === "billing-brd"
    )
  ));
  ok(result.pack.items.some((item) =>
    item.id === "synthesis:engineering_director:42:99:question:0" &&
    item.kind === ContextPackItemKind.SynthesisQuestion &&
    item.reasons.includes("audience:manager") &&
    item.sourcePointers?.some((pointer) =>
      pointer.kind === ContextPackSourcePointerKind.DocUnit && pointer.docUnitId === "billing-brd"
    )
  ));
  ok(result.pack.items.some((item) =>
    item.id === "synthesis:engineering_director:42:99:action:0" &&
    item.kind === ContextPackItemKind.SynthesisRecommendedAction &&
    item.title === "Recommended action: Escalate to engineering manager for owner assignment." &&
    item.reasons.includes("action:meta.escalate") &&
    item.sourcePointers?.some((pointer) =>
      pointer.kind === ContextPackSourcePointerKind.DocUnit && pointer.docUnitId === "billing-brd"
    )
  ));
  ok(result.pack.curationTrace.some((stage) => stage.stage === ContextPackCurationStageKind.MemoryRecall));
  ok(result.pack.curationTrace.some((stage) =>
    stage.stage === ContextPackCurationStageKind.EphemeralSynthesis &&
    stage.evidenceRefs.includes("synthesis:engineering_director:42:99:action:0")
  ));
  ok(result.pack.curationTrace.some((stage) => stage.summary.includes("Synthesized")));
});

test("deterministic context builder caps synthesis confidence by cited deterministic evidence", async () => {
  const memory: ContextPackMemoryRecallPort = {
    recall: async () => ({
      memories: [{
        memoryId: "mem-low-confidence",
        providerId: "hindsight",
        summary: "Prior blocker is only weakly similar.",
        confidence: 0.42,
        retainedAt: "2026-05-30T00:00:00.000Z",
        creatingAgentId: "agent-prior",
        creatingHatAssignmentId: "hat-prior",
        advisory: true,
        reasons: ["weak similarity"],
      }],
    }),
  };
  const synthesis: ContextPackEphemeralSynthesisPort = {
    synthesize: async () => ({
      summary: "Overconfident synthesis should be calibrated by evidence.",
      briefing: {
        title: "Weak memory briefing",
        summary: "The model should not outrank its only cited evidence.",
        evidenceRefs: ["memory:mem-low-confidence"],
        confidence: 0.99,
        uncertaintyExplanation: "Only a weakly similar memory supports this briefing.",
      },
      gapHypotheses: [{
        message: "Weakly grounded gap hypothesis.",
        evidenceRefs: ["memory:mem-low-confidence", `required_curation_lane:${ContextPackAttentionLaneKind.RequiredDocuments}`],
        confidence: 0.91,
        uncertaintyExplanation: "The missing-document omission is not evidence, so memory remains the ceiling.",
      }],
      rankedContextRefs: [{
        itemId: "memory:mem-low-confidence",
        reason: "Weak memory should remain weakly ranked.",
        evidenceRefs: ["memory:mem-low-confidence"],
        uncertaintyExplanation: "Ranking is based only on weak memory similarity.",
      }],
      questions: [{
        question: "What stronger evidence can confirm this weak memory?",
        evidenceRefs: ["memory:mem-low-confidence"],
        uncertaintyExplanation: "Question confidence is limited by the weak memory pointer.",
      }],
      recommendedActionRefs: [{
        actionType: "meta.escalate",
        reason: "Escalate only as a weakly grounded advisory.",
        evidenceRefs: ["memory:mem-low-confidence"],
        uncertaintyExplanation: "Escalation is advisory until stronger evidence exists.",
      }],
      curationEvidenceRefs: ["memory:mem-low-confidence"],
    }),
  };
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({ corpus: [], entities: [] }),
    memory,
    synthesis,
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));

  const briefing = result.pack.items.find((item) => item.kind === ContextPackItemKind.SynthesisBriefing);
  const gap = result.pack.items.find((item) => item.kind === ContextPackItemKind.SynthesisGapHypothesis);
  const ranked = result.pack.items.find((item) => item.kind === ContextPackItemKind.SynthesisRankedContext);
  const question = result.pack.items.find((item) => item.kind === ContextPackItemKind.SynthesisQuestion);
  const action = result.pack.items.find((item) => item.kind === ContextPackItemKind.SynthesisRecommendedAction);
  equal(briefing?.confidence, 0.42);
  equal(gap?.confidence, 0.42);
  equal(ranked?.confidence, 0.42);
  equal(question?.confidence, 0.42);
  equal(action?.confidence, 0.42);
  equal(briefing?.confidenceBasis?.kind, ContextPackConfidenceBasisKind.CitedEvidenceCeiling);
  equal(briefing?.confidenceBasis?.modelConfidence, 0.99);
  equal(briefing?.confidenceBasis?.evidenceConfidenceCeiling, 0.42);
  deepEqual(briefing?.confidenceBasis?.citedEvidenceRefs, ["memory:mem-low-confidence"]);
  equal(briefing?.confidenceBasis?.uncertaintyExplanation, "Only a weakly similar memory supports this briefing.");
  equal(gap?.confidenceBasis?.kind, ContextPackConfidenceBasisKind.CitedEvidenceCeiling);
  equal(gap?.confidenceBasis?.modelConfidence, 0.91);
  deepEqual(gap?.confidenceBasis?.citedEvidenceRefs, ["memory:mem-low-confidence"]);
  equal(gap?.confidenceBasis?.uncertaintyExplanation, "The missing-document omission is not evidence, so memory remains the ceiling.");
  equal(ranked?.confidenceBasis?.kind, ContextPackConfidenceBasisKind.CitedEvidenceCeiling);
  equal(ranked?.confidenceBasis?.modelConfidence, undefined);
  equal(ranked?.confidenceBasis?.uncertaintyExplanation, "Ranking is based only on weak memory similarity.");
  equal(question?.confidenceBasis?.uncertaintyExplanation, "Question confidence is limited by the weak memory pointer.");
  equal(action?.confidenceBasis?.uncertaintyExplanation, "Escalation is advisory until stronger evidence exists.");
});

test("deterministic context builder sends typed uncertainty signals into synthesis and preserves cited signal basis", async () => {
  const stalePolicy = docUnit({
    docUnitId: "billing-owner-policy-old",
    type: DocType.Policy,
    title: "Old billing owner policy",
    summary: "Legacy policy still names the old owner.",
    status: DocLifecycleState.Stale,
  });
  const currentPolicy = docUnit({
    docUnitId: "billing-owner-policy-current",
    type: DocType.Policy,
    title: "Current billing owner policy",
    summary: "Current policy says platform owns billing recovery.",
  });
  const documents: ContextPackDocumentReadPort = {
    retrieve: async () => ({
      sourceGraphVersion: "docs-v-uncertainty",
      retrieval: {
        hits: [
          { unit: stalePolicy, score: 0.62, reasons: ["stale test fixture"], entities: [] },
          { unit: currentPolicy, score: 0.96, reasons: ["current test fixture"], entities: [] },
        ],
        consulted: [],
        conflicts: [{ a: currentPolicy, b: stalePolicy }],
        diagnostics: {
          corpusSize: 2,
          afterScope: 2,
          queryEntities: [],
          afterRecall: 2,
          preferredTypeBoosts: 1,
          staleDemoted: 1,
          conflictsSurfaced: 1,
          deterministicConsults: 0,
        },
      },
    }),
  };
  const memory: ContextPackMemoryRecallPort = {
    recall: async () => ({
      memories: [{
        memoryId: "mem-indirect-owner",
        providerId: "hindsight",
        summary: "A prior incident only indirectly suggests the billing owner.",
        confidence: 0.43,
        retainedAt: "2026-05-30T00:00:00.000Z",
        advisory: true,
        similarityCategory: ContextPackMemorySimilarityCategory.SameProjectDifferentWorkItem,
        reasons: ["weak similarity", "indirect memory"],
      }],
    }),
  };
  const synthesis: ContextPackEphemeralSynthesisPort = {
    synthesize: async (query) => {
      ok(query.uncertaintySignals.some((signal) =>
        signal.kind === ContextPackUncertaintySignalKind.StaleEvidence &&
        signal.severity === ContextPackUncertaintySeverity.High &&
        signal.evidenceRefs.includes("doc:billing-owner-policy-old")
      ));
      ok(query.uncertaintySignals.some((signal) =>
        signal.kind === ContextPackUncertaintySignalKind.ConflictingEvidence &&
        signal.evidenceRefs.includes("doc:billing-owner-policy-current") &&
        signal.evidenceRefs.includes("doc:billing-owner-policy-old")
      ));
      ok(query.uncertaintySignals.some((signal) =>
        signal.kind === ContextPackUncertaintySignalKind.LowConfidenceEvidence &&
        signal.evidenceRefs.includes("memory:mem-indirect-owner")
      ));
      ok(query.uncertaintySignals.some((signal) =>
        signal.kind === ContextPackUncertaintySignalKind.IndirectEvidence &&
        signal.message === "Evidence memory:mem-indirect-owner is advisory memory with same_project_different_work_item similarity, not source-of-truth context." &&
        signal.evidenceRefs.includes("memory:mem-indirect-owner")
      ));
      return {
        summary: "Synthesis saw deterministic uncertainty signals.",
        briefing: {
          title: "Uncertainty-aware blocker brief",
          summary: "Owner evidence is current but contradicted by stale and indirect context.",
          evidenceRefs: ["doc:billing-owner-policy-old", "memory:mem-indirect-owner"],
          confidence: 0.95,
          uncertaintyExplanation: "The cited evidence includes stale policy and weak indirect memory.",
        },
        curationEvidenceRefs: ["doc:billing-owner-policy-old", "memory:mem-indirect-owner"],
      };
    },
  };
  const builder = createDeterministicContextPackBuilder({ documents, memory, synthesis });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));

  const briefing = result.pack.items.find((item) => item.kind === ContextPackItemKind.SynthesisBriefing);
  equal(briefing?.confidence, 0.43);
  ok(briefing?.confidenceBasis?.uncertaintySignals?.some((signal) =>
    signal.kind === ContextPackUncertaintySignalKind.StaleEvidence &&
    signal.evidenceRefs.includes("doc:billing-owner-policy-old")
  ));
  ok(briefing?.confidenceBasis?.uncertaintySignals?.some((signal) =>
    signal.kind === ContextPackUncertaintySignalKind.LowConfidenceEvidence &&
    signal.evidenceRefs.includes("memory:mem-indirect-owner")
  ));
  const memoryItem = result.pack.items.find((item) => item.id === "memory:mem-indirect-owner");
  ok(memoryItem?.sourcePointers?.some((pointer) =>
    pointer.kind === ContextPackSourcePointerKind.HindsightMemory &&
    pointer.similarityCategory === ContextPackMemorySimilarityCategory.SameProjectDifferentWorkItem
  ));
  ok(result.pack.curationTrace.some((stage) =>
    stage.stage === ContextPackCurationStageKind.GapReview &&
    stage.evidenceRefs.includes("uncertainty:stale_evidence:doc-billing-owner-policy-old")
  ));
});

test("deterministic context builder profiles management blocker context for director synthesis", async () => {
  let graphLanePriority = 0;
  let activeWorkLanePriority = 0;
  let graphLaneRequired = false;
  let hasManagementInstruction = false;
  const synthesis: ContextPackEphemeralSynthesisPort = {
    synthesize: async (query) => {
      const graphLane = query.curationPlan.lanes.find((lane) => lane.kind === ContextPackAttentionLaneKind.GraphNeighborhood);
      const activeWorkLane = query.curationPlan.lanes.find((lane) => lane.kind === ContextPackAttentionLaneKind.ActiveWork);
      graphLanePriority = graphLane?.priority ?? 0;
      activeWorkLanePriority = activeWorkLane?.priority ?? 0;
      graphLaneRequired = graphLane?.required ?? false;
      hasManagementInstruction = query.curationPlan.deterministicInstructions.some((instruction) =>
        instruction === ContextPackCurationProfileInstruction.ManagementBlocker,
      );
      return { summary: "Management blocker profile captured." };
    },
  };
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({
          docUnitId: "billing-brd",
          type: DocType.Brd,
          title: "Billing BRD",
          summary: "Billing recovery business rules.",
        }),
      ],
      entities: [],
    }),
    graph: graphStore([edge("work-billing-blocked", GraphEdgeKind.References, "decision-billing-owner")]),
    graphRootNodeIds: () => ["work-billing-blocked"],
    synthesis,
  });

  const result = await builder.build(request({
    hat: engineeringDirector,
    phase: RunLifecyclePhase.Blocked,
    scope: RunScope.Project,
    workItemId: "work-billing-blocked",
  }));

  ok(result.pack.curationPlan?.deterministicInstructions.some((instruction) =>
    instruction === ContextPackCurationProfileInstruction.ManagementBlocker,
  ));
  equal(result.pack.curationPlan?.profileId, ContextPackCurationProfileId.ManagementBlocker);
  equal(graphLaneRequired, true);
  ok(graphLanePriority < activeWorkLanePriority);
  equal(hasManagementInstruction, true);
});

test("deterministic context builder passes hat wake context into query and ephemeral synthesis", async () => {
  let synthesisWakeReason: string | undefined;
  let synthesisPreviousPackId: string | undefined;
  let synthesisQuery = "";
  const synthesis: ContextPackEphemeralSynthesisPort = {
    synthesize: async (query) => {
      synthesisWakeReason = query.wakeContext?.reason;
      synthesisPreviousPackId = query.wakeContext?.previousContextPackId;
      synthesisQuery = query.query;
      return { summary: "Wake context captured." };
    },
  };
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({
          docUnitId: "billing-brd",
          type: DocType.Brd,
          title: "Billing BRD",
          summary: "Billing recovery business rules.",
        }),
      ],
      entities: [],
    }),
    synthesis,
  });
  const buildRequest = request({
    hat: engineeringDirector,
    phase: RunLifecyclePhase.Blocked,
    scope: RunScope.Project,
    workItemId: "work-billing-blocked",
  });

  await builder.build({
    ...buildRequest,
    wakeContext: {
      reason: "hat_assignment_changed",
      requiresBuild: true,
      previousContextPackId: "ctx-previous-director",
      previousStatus: ContextPackStatus.Current,
    },
  });

  equal(synthesisWakeReason, "hat_assignment_changed");
  equal(synthesisPreviousPackId, "ctx-previous-director");
  ok(synthesisQuery.includes("hat_assignment_changed"));
});

test("deterministic context builder uses management document focus before retrieval", async () => {
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({
          docUnitId: "customer-rules",
          type: DocType.Brd,
          title: "Customer rulebook",
          summary: "Revenue approval criteria.",
        }),
        docUnit({
          docUnitId: "runtime-design",
          type: DocType.Architecture,
          title: "System design",
          summary: "Service partitioning boundaries.",
        }),
        docUnit({
          docUnitId: "operator-notes",
          type: DocType.Runbook,
          title: "Operator notes",
          summary: "Console maintenance rotation.",
        }),
      ],
      entities: [],
    }),
  });

  const result = await builder.build(request({
    hat: engineeringDirector,
    phase: RunLifecyclePhase.Blocked,
    scope: RunScope.Project,
    workItemId: "work-billing-blocked",
  }));

  ok(result.pack.items.some((item) => item.id === "doc:customer-rules"));
  ok(result.pack.items.some((item) => item.id === "doc:runtime-design"));
  ok(!result.pack.items.some((item) => item.id === "doc:operator-notes"));
  ok(result.pack.curationTrace.some((stage) =>
    stage.stage === ContextPackCurationStageKind.DocumentFocus &&
    stage.summary.includes("management_blocker") &&
    stage.summary.includes("context-pack-document-focus:v1") &&
    stage.evidenceRefs.includes(`preferred-doc-type:${DocType.Brd}`) &&
    stage.evidenceRefs.includes(`preferred-doc-type:${DocType.Architecture}`) &&
    stage.evidenceRefs.includes("focus-term:business rules")
  ));
});

test("deterministic context builder uses pre-retrieval curation intent for document focus and final profile", async () => {
  let capturedQuery = "";
  let capturedPreferredDocTypes: readonly DocType[] = [];
  const documents: ContextPackDocumentReadPort = {
    retrieve: async (retrievalRequest) => {
      capturedQuery = retrievalRequest.query;
      capturedPreferredDocTypes = retrievalRequest.retrievalContext.preferredDocTypes ?? [];
      return {
        sourceGraphVersion: "test-docs:v1",
        retrieval: {
          consulted: [],
          hits: [],
          conflicts: [],
          diagnostics: {
            corpusSize: 0,
            afterScope: 0,
            queryEntities: [],
            afterRecall: 0,
            preferredTypeBoosts: 0,
            staleDemoted: 0,
            conflictsSurfaced: 0,
            deterministicConsults: 0,
          },
        },
      };
    },
  };
  const builder = createDeterministicContextPackBuilder({
    documents,
    curationIntentPolicy: {
      resolve: () => ({
        documentFocus: {
          profileId: ContextPackDocumentFocusProfileId.SecurityControl,
          policyVersion: "test-curation-intent:v1",
          queryTerms: ["credential proxy", "least privilege", "audit evidence"],
          preferredDocTypes: [DocType.Policy, DocType.Adr, DocType.DecisionRecord],
        },
        curationProfile: {
          profileId: ContextPackCurationProfileId.SecurityControl,
          policyVersion: "test-curation-intent:v1",
          deterministicInstructions: [ContextPackCurationProfileInstruction.SecurityControl],
        },
      }),
    },
  });

  const result = await builder.build(request({
    hat: engineeringDirector,
    phase: RunLifecyclePhase.Blocked,
    scope: RunScope.WorkItem,
    workItemId: "work-billing-blocked",
  }));

  equal(result.pack.curationPlan?.profileId, ContextPackCurationProfileId.SecurityControl);
  ok(capturedQuery.includes("least privilege"));
  ok(!capturedQuery.includes("business rules"));
  deepEqual(capturedPreferredDocTypes, [DocType.Policy, DocType.Adr, DocType.DecisionRecord]);
  ok(result.pack.curationTrace.some((stage) =>
    stage.stage === ContextPackCurationStageKind.DocumentFocus &&
    stage.summary.includes("security_control") &&
    stage.summary.includes("test-curation-intent:v1") &&
    stage.evidenceRefs.includes(`preferred-doc-type:${DocType.Policy}`) &&
    stage.evidenceRefs.includes("focus-term:least privilege")
  ));
});

test("deterministic context builder reports document-focus policy failures separately from retrieval failures", async () => {
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [],
      entities: [],
    }),
    documentFocusPolicy: {
      resolve: () => {
        throw new Error("focus policy offline");
      },
    },
  });

  const result = await builder.build(request({
    hat: engineeringDirector,
    phase: RunLifecyclePhase.Blocked,
    scope: RunScope.Project,
    workItemId: "work-billing-blocked",
  }));

  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.nodeId === "context_pack_document_focus" &&
    item.reason === ContextPackOmissionReason.RetrievalFailed &&
    item.message.includes("document context focus policy failed") &&
    item.message.includes("focus policy offline") &&
    !item.message.includes("document context retrieval failed")
  ));
});

test("deterministic context builder profiles implementer execution context around active work", async () => {
  let activeWorkLanePriority = 0;
  let requiredDocumentsLanePriority = 0;
  let graphLaneRequired = true;
  let hasImplementerInstruction = false;
  const synthesis: ContextPackEphemeralSynthesisPort = {
    synthesize: async (query) => {
      const activeWorkLane = query.curationPlan.lanes.find((lane) => lane.kind === ContextPackAttentionLaneKind.ActiveWork);
      const requiredDocumentsLane = query.curationPlan.lanes.find((lane) =>
        lane.kind === ContextPackAttentionLaneKind.RequiredDocuments
      );
      const graphLane = query.curationPlan.lanes.find((lane) => lane.kind === ContextPackAttentionLaneKind.GraphNeighborhood);
      activeWorkLanePriority = activeWorkLane?.priority ?? 0;
      requiredDocumentsLanePriority = requiredDocumentsLane?.priority ?? 0;
      graphLaneRequired = graphLane?.required ?? true;
      hasImplementerInstruction = query.curationPlan.deterministicInstructions.some((instruction) =>
        instruction === ContextPackCurationProfileInstruction.ImplementerExecution,
      );
      return { summary: "Implementer execution profile captured." };
    },
  };
  const lifecycleAnchors: ContextPackLifecycleAnchorPort = {
    load: () => ({
      items: [{
        id: "decision:billing-acceptance",
        kind: ContextPackItemKind.DecisionRecord,
        title: "Billing acceptance criteria decision",
        summary: "The implementer must keep failed invoice recovery deterministic.",
        sourceRef: "decision:billing-acceptance",
        required: true,
        freshness: ContextPackFreshness.Live,
        confidence: 0.95,
        reasons: ["lifecycle_anchor:decision"],
        citationRefs: ["decision:billing-acceptance", "work:work-billing-blocked"],
        sourcePointers: [
          { kind: ContextPackSourcePointerKind.Decision, decisionId: "billing-acceptance" },
          { kind: ContextPackSourcePointerKind.WorkItem, workItemId: "work-billing-blocked" },
        ],
      }],
    }),
  };
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({
          docUnitId: "billing-adr",
          type: DocType.Adr,
          title: "Billing ADR",
          summary: "Billing recovery architecture.",
        }),
      ],
      entities: [],
    }),
    lifecycleAnchors,
    synthesis,
  });

  const result = await builder.build(request({
    hat: backendImplementer,
    phase: RunLifecyclePhase.Executing,
    scope: RunScope.WorkItem,
    workItemId: "work-billing-blocked",
  }));

  ok(result.pack.curationPlan?.deterministicInstructions.some((instruction) =>
    instruction === ContextPackCurationProfileInstruction.ImplementerExecution,
  ));
  equal(result.pack.curationPlan?.profileId, ContextPackCurationProfileId.ImplementerExecution);
  ok(activeWorkLanePriority < requiredDocumentsLanePriority);
  equal(graphLaneRequired, false);
  equal(hasImplementerInstruction, true);
});

test("deterministic context builder curates product hats around customer and business validation evidence", async () => {
  let profileId: string | undefined;
  let hasProductInstruction = false;
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({
          docUnitId: "customer-rfp",
          type: DocType.Brd,
          title: "Customer RFP",
          summary: "Customer needs final business validation before release.",
        }),
        docUnit({
          docUnitId: "test-runbook",
          type: DocType.Runbook,
          title: "Test runbook",
          summary: "Implementation runbook should not outrank customer evidence for product owner.",
        }),
      ],
      entities: [],
    }),
    synthesis: {
      synthesize: async (query) => {
        profileId = query.curationPlan.profileId;
        hasProductInstruction = query.curationPlan.deterministicInstructions.includes(
          ContextPackCurationProfileInstruction.ProductValidation,
        );
        return { summary: "Product validation profile captured." };
      },
    },
  });

  const result = await builder.build(request({
    hat: productOwner,
    phase: RunLifecyclePhase.AwaitingGate,
    scope: RunScope.WorkItem,
    workItemId: "work-billing-blocked",
  }));

  equal(result.pack.curationPlan?.profileId, ContextPackCurationProfileId.ProductValidation);
  equal(profileId, ContextPackCurationProfileId.ProductValidation);
  equal(hasProductInstruction, true);
  ok(result.pack.items.some((item) => item.id === "doc:customer-rfp"));
  ok(result.pack.curationTrace.some((stage) =>
    stage.stage === ContextPackCurationStageKind.DocumentFocus &&
    stage.summary.includes("product_validation") &&
    stage.evidenceRefs.includes(`preferred-doc-type:${DocType.Brd}`) &&
    stage.evidenceRefs.includes("focus-term:customer requirements")
  ));
});

test("deterministic context builder curates architecture hats around CA, ADR, and design authority", async () => {
  let requiredDocumentsLanePriority = 0;
  let graphLanePriority = 0;
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({
          docUnitId: "billing-ca",
          type: DocType.Architecture,
          title: "Billing CA",
          summary: "Architecture constraints for invoice recovery.",
        }),
        docUnit({
          docUnitId: "billing-adr",
          type: DocType.Adr,
          title: "Billing ADR",
          summary: "ADR records retry boundary decisions.",
        }),
        docUnit({
          docUnitId: "customer-brd",
          type: DocType.Brd,
          title: "Customer BRD",
          summary: "Business rules stay available but are not architecture focus.",
        }),
      ],
      entities: [],
    }),
    synthesis: {
      synthesize: async (query) => {
        const requiredDocsLane = query.curationPlan.lanes.find((lane) =>
          lane.kind === ContextPackAttentionLaneKind.RequiredDocuments
        );
        const graphLane = query.curationPlan.lanes.find((lane) =>
          lane.kind === ContextPackAttentionLaneKind.GraphNeighborhood
        );
        requiredDocumentsLanePriority = requiredDocsLane?.priority ?? 0;
        graphLanePriority = graphLane?.priority ?? 0;
        ok(query.curationPlan.deterministicInstructions.includes(
          ContextPackCurationProfileInstruction.ArchitectureDecision,
        ));
        return { summary: "Architecture decision profile captured." };
      },
    },
  });

  const result = await builder.build(request({
    hat: architect,
    phase: RunLifecyclePhase.AwaitingGate,
    scope: RunScope.WorkItem,
    workItemId: "work-billing-blocked",
  }));

  equal(result.pack.curationPlan?.profileId, ContextPackCurationProfileId.ArchitectureDecision);
  ok(requiredDocumentsLanePriority < graphLanePriority);
  ok(result.pack.items.some((item) => item.id === "doc:billing-ca"));
  ok(result.pack.items.some((item) => item.id === "doc:billing-adr"));
});

test("deterministic context builder curates review and QA hats around evidence and reproducibility", async () => {
  let activeWorkLanePriority = 0;
  let requiredDocumentsLanePriority = 0;
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({
          docUnitId: "qa-evidence",
          type: DocType.DecisionRecord,
          title: "QA Evidence",
          summary: "Runtime validation reproduced the defect with screenshots.",
        }),
        docUnit({
          docUnitId: "browser-runbook",
          type: DocType.Runbook,
          title: "Browser QA Runbook",
          summary: "Browser automation captures evidence and reproduction steps.",
        }),
        docUnit({
          docUnitId: "architecture-background",
          type: DocType.Architecture,
          title: "Architecture Background",
          summary: "Design background should not be primary QA context.",
        }),
      ],
      entities: [],
    }),
    synthesis: {
      synthesize: async (query) => {
        const activeWorkLane = query.curationPlan.lanes.find((lane) =>
          lane.kind === ContextPackAttentionLaneKind.ActiveWork
        );
        const requiredDocsLane = query.curationPlan.lanes.find((lane) =>
          lane.kind === ContextPackAttentionLaneKind.RequiredDocuments
        );
        activeWorkLanePriority = activeWorkLane?.priority ?? 0;
        requiredDocumentsLanePriority = requiredDocsLane?.priority ?? 0;
        ok(query.curationPlan.deterministicInstructions.includes(
          ContextPackCurationProfileInstruction.EvidenceReview,
        ));
        return { summary: "Evidence review profile captured." };
      },
    },
  });

  const result = await builder.build(request({
    hat: qaReviewer,
    phase: RunLifecyclePhase.AwaitingReview,
    scope: RunScope.WorkItem,
    workItemId: "work-billing-blocked",
  }));

  equal(result.pack.curationPlan?.profileId, ContextPackCurationProfileId.EvidenceReview);
  ok(activeWorkLanePriority < requiredDocumentsLanePriority);
  ok(result.pack.items.some((item) => item.id === "doc:qa-evidence"));
  ok(result.pack.items.some((item) => item.id === "doc:browser-runbook"));
});

test("deterministic context builder retrieves active hat department docs even when project belongs to another department", async () => {
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({
          docUnitId: "qa-department-runbook",
          type: DocType.Runbook,
          scopeKind: DocScopeKind.Department,
          scopeId: DepartmentId.QaAndVerification,
          title: "QA Department Runbook",
          summary: "QA verification hats must reproduce issues and attach evidence before signoff.",
        }),
        docUnit({
          docUnitId: "engineering-department-runbook",
          type: DocType.Runbook,
          scopeKind: DocScopeKind.Department,
          scopeId: "eng",
          title: "Engineering Department Runbook",
          summary: "Engineering implementation docs are project department context.",
        }),
      ],
      entities: [],
    }),
  });

  const result = await builder.build(request({
    hat: qaReviewer,
    phase: RunLifecyclePhase.AwaitingReview,
    scope: RunScope.WorkItem,
    workItemId: "work-billing-blocked",
  }));

  ok(result.pack.items.some((item) => item.id === "doc:qa-department-runbook"));
  ok(result.pack.items.some((item) => item.id === "doc:engineering-department-runbook"));
});

test("deterministic context builder lets active-hat archetypes beat broad execution fallback", async () => {
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({
          docUnitId: "billing-ca",
          type: DocType.Architecture,
          title: "Billing CA",
          summary: "Architecture constraints for invoice recovery.",
        }),
        docUnit({
          docUnitId: "credential-policy",
          type: DocType.Policy,
          title: "Credential Policy",
          summary: "Credential scopes require least privilege.",
        }),
        docUnit({
          docUnitId: "qa-runbook",
          type: DocType.Runbook,
          title: "QA Runbook",
          summary: "QA execution means reproducing and attaching evidence.",
        }),
      ],
      entities: [],
    }),
  });

  const architectureResult = await builder.build(request({
    hat: architect,
    phase: RunLifecyclePhase.Executing,
    scope: RunScope.WorkItem,
    workItemId: "work-billing-blocked",
  }));
  const securityResult = await builder.build(request({
    hat: securityReviewer,
    phase: RunLifecyclePhase.Executing,
    scope: RunScope.WorkItem,
    workItemId: "work-billing-blocked",
  }));
  const qaResult = await builder.build(request({
    hat: qaReviewer,
    phase: RunLifecyclePhase.Executing,
    scope: RunScope.WorkItem,
    workItemId: "work-billing-blocked",
  }));

  equal(architectureResult.pack.curationPlan?.profileId, ContextPackCurationProfileId.ArchitectureDecision);
  equal(securityResult.pack.curationPlan?.profileId, ContextPackCurationProfileId.SecurityControl);
  equal(qaResult.pack.curationPlan?.profileId, ContextPackCurationProfileId.EvidenceReview);
});

test("deterministic context builder preserves specialist context while adding blocker emphasis", async () => {
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({
          docUnitId: "product-blocker-brd",
          type: DocType.Brd,
          title: "Product Blocker BRD",
          summary: "Business rules for blocked product validation.",
        }),
        docUnit({
          docUnitId: "security-blocker-policy",
          type: DocType.Policy,
          title: "Security Blocker Policy",
          summary: "Credential controls still apply while blocked.",
        }),
        docUnit({
          docUnitId: "architecture-blocker-adr",
          type: DocType.Adr,
          title: "Architecture Blocker ADR",
          summary: "Architecture tradeoff evidence for blocked decisions.",
        }),
      ],
      entities: [],
    }),
  });

  const productResult = await builder.build(request({
    hat: productOwner,
    phase: RunLifecyclePhase.Blocked,
    scope: RunScope.WorkItem,
    workItemId: "work-billing-blocked",
  }));
  const securityResult = await builder.build(request({
    hat: securityReviewer,
    phase: RunLifecyclePhase.Blocked,
    scope: RunScope.WorkItem,
    workItemId: "work-billing-blocked",
  }));
  const architectureResult = await builder.build(request({
    hat: architect,
    phase: RunLifecyclePhase.Blocked,
    scope: RunScope.WorkItem,
    workItemId: "work-billing-blocked",
  }));

  equal(productResult.pack.curationPlan?.profileId, ContextPackCurationProfileId.ProductValidation);
  ok(productResult.pack.curationPlan?.deterministicInstructions.includes(
    ContextPackCurationProfileInstruction.ProductValidation,
  ));
  ok(productResult.pack.curationPlan?.deterministicInstructions.includes(
    ContextPackCurationProfileInstruction.ManagementBlocker,
  ));
  equal(securityResult.pack.curationPlan?.profileId, ContextPackCurationProfileId.SecurityControl);
  equal(architectureResult.pack.curationPlan?.profileId, ContextPackCurationProfileId.ArchitectureDecision);
});

test("deterministic context builder reports blocker-overlay required lanes for specialist profiles", async () => {
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({
          docUnitId: "product-blocker-brd",
          type: DocType.Brd,
          title: "Product Blocker BRD",
          summary: "Business rules for blocked product validation.",
        }),
      ],
      entities: [],
    }),
  });

  const result = await builder.build(request({
    hat: productOwner,
    phase: RunLifecyclePhase.Blocked,
    scope: RunScope.WorkItem,
    workItemId: "work-billing-blocked",
  }));

  equal(result.pack.curationPlan?.profileId, ContextPackCurationProfileId.ProductValidation);
  ok(result.pack.curationPlan?.lanes.some((lane) =>
    lane.kind === ContextPackAttentionLaneKind.GraphNeighborhood &&
    lane.required &&
    lane.refs.length === 0
  ));
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.nodeId === "required_curation_lane:graph_neighborhood" &&
    item.reason === ContextPackOmissionReason.NotIndexed
  ));
});

test("deterministic context builder routes architecture bundles without stealing generic readiness work", async () => {
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({
          docUnitId: "integration-architecture",
          type: DocType.Architecture,
          title: "Integration Architecture",
          summary: "Integration work depends on architecture boundaries.",
        }),
        docUnit({
          docUnitId: "engineering-readiness",
          type: DocType.Handbook,
          title: "Engineering Readiness",
          summary: "Generic engineering readiness is not release readiness.",
        }),
      ],
      entities: [],
    }),
  });

  const architectureBundleResult = await builder.build(request({
    hat: integrationEngineer,
    phase: RunLifecyclePhase.Executing,
    scope: RunScope.WorkItem,
    workItemId: "work-billing-blocked",
  }));
  const engineeringManagerResult = await builder.build(request({
    hat: engineeringManager,
    phase: RunLifecyclePhase.Executing,
    scope: RunScope.WorkItem,
    workItemId: "work-billing-blocked",
  }));
  const readinessReviewerResult = await builder.build(request({
    hat: readinessReviewer,
    phase: RunLifecyclePhase.AwaitingReview,
    scope: RunScope.WorkItem,
    workItemId: "work-billing-blocked",
  }));

  equal(architectureBundleResult.pack.curationPlan?.profileId, ContextPackCurationProfileId.ArchitectureDecision);
  ok(engineeringManagerResult.pack.curationPlan?.profileId !== ContextPackCurationProfileId.ReleaseDelivery);
  equal(readinessReviewerResult.pack.curationPlan?.profileId, ContextPackCurationProfileId.EvidenceReview);
});

test("deterministic context builder curates remaining organizational archetypes from active hat attributes", async () => {
  const cases = [
    {
      hat: tpm,
      expectedProfileId: ContextPackCurationProfileId.ProgramCoordination,
      expectedInstruction: ContextPackCurationProfileInstruction.ProgramCoordination,
      departmentId: DepartmentId.ProgramAndInitiativeManagement,
      docType: DocType.Handbook,
      docUnitId: "program-coordination-handbook",
    },
    {
      hat: releaseManager,
      expectedProfileId: ContextPackCurationProfileId.ReleaseDelivery,
      expectedInstruction: ContextPackCurationProfileInstruction.ReleaseDelivery,
      departmentId: DepartmentId.DeliveryAndRelease,
      docType: DocType.Runbook,
      docUnitId: "release-readiness-runbook",
    },
    {
      hat: incidentCommander,
      expectedProfileId: ContextPackCurationProfileId.RuntimeOperations,
      expectedInstruction: ContextPackCurationProfileInstruction.RuntimeOperations,
      departmentId: DepartmentId.OperationsAndInfrastructure,
      docType: DocType.Runbook,
      docUnitId: "incident-runtime-runbook",
    },
    {
      hat: memoryCurator,
      expectedProfileId: ContextPackCurationProfileId.KnowledgeStewardship,
      expectedInstruction: ContextPackCurationProfileInstruction.KnowledgeStewardship,
      departmentId: DepartmentId.MemoryAndKnowledge,
      docType: DocType.Handbook,
      docUnitId: "memory-stewardship-handbook",
    },
    {
      hat: hatDesigner,
      expectedProfileId: ContextPackCurationProfileId.CapabilityExpansion,
      expectedInstruction: ContextPackCurationProfileInstruction.CapabilityExpansion,
      departmentId: DepartmentId.CapabilityAndAutomationExpansion,
      docType: DocType.Policy,
      docUnitId: "capability-expansion-policy",
    },
    {
      hat: costController,
      expectedProfileId: ContextPackCurationProfileId.CapacityFinance,
      expectedInstruction: ContextPackCurationProfileInstruction.CapacityFinance,
      departmentId: DepartmentId.OperationsAndInfrastructure,
      docType: DocType.Policy,
      docUnitId: "capacity-budget-policy",
    },
  ] as const;

  for (const testCase of cases) {
    equal(typeof testCase.expectedProfileId, "string");
    equal(typeof testCase.expectedInstruction, "string");

    let synthesisProfileId: string | undefined;
    let hasExpectedInstruction = false;
    const builder = createDeterministicContextPackBuilder({
      documents: createInMemoryContextPackDocumentPort({
        corpus: [
          docUnit({
            docUnitId: testCase.docUnitId,
            type: testCase.docType,
            scopeKind: DocScopeKind.Department,
            scopeId: testCase.departmentId,
            title: testCase.docUnitId,
            summary: `Governing context for ${testCase.expectedProfileId}.`,
          }),
        ],
        entities: [],
      }),
      synthesis: {
        synthesize: async (query) => {
          synthesisProfileId = query.curationPlan.profileId;
          hasExpectedInstruction = query.curationPlan.deterministicInstructions.includes(testCase.expectedInstruction);
          return { summary: `Captured ${testCase.expectedProfileId}.` };
        },
      },
    });

    const result = await builder.build(request({
      hat: testCase.hat,
      phase: RunLifecyclePhase.Executing,
      scope: RunScope.WorkItem,
      workItemId: "work-billing-blocked",
    }));

    equal(result.pack.curationPlan?.profileId, testCase.expectedProfileId);
    equal(synthesisProfileId, testCase.expectedProfileId);
    equal(hasExpectedInstruction, true);
    ok(result.pack.items.some((item) => item.id === `doc:${testCase.docUnitId}`));
  }
});

test("deterministic context builder curates security hats around policy, credentials, and audit evidence", async () => {
  let omissionsLanePriority = 0;
  let legalActionsLanePriority = 0;
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({
          docUnitId: "credential-policy",
          type: DocType.Policy,
          title: "Credential Proxy Policy",
          summary: "Credential proxy scopes require least privilege and audit evidence.",
        }),
        docUnit({
          docUnitId: "security-adr",
          type: DocType.Adr,
          title: "Security ADR",
          summary: "External API access is reviewed through security gates.",
        }),
        docUnit({
          docUnitId: "implementation-spec",
          type: DocType.Spec,
          title: "Implementation Spec",
          summary: "Implementation detail should not outrank credential policy.",
        }),
      ],
      entities: [],
    }),
    synthesis: {
      synthesize: async (query) => {
        const omissionsLane = query.curationPlan.lanes.find((lane) =>
          lane.kind === ContextPackAttentionLaneKind.Omissions
        );
        const legalActionsLane = query.curationPlan.lanes.find((lane) =>
          lane.kind === ContextPackAttentionLaneKind.LegalActions
        );
        omissionsLanePriority = omissionsLane?.priority ?? 0;
        legalActionsLanePriority = legalActionsLane?.priority ?? 0;
        ok(query.curationPlan.deterministicInstructions.includes(
          ContextPackCurationProfileInstruction.SecurityControl,
        ));
        return { summary: "Security control profile captured." };
      },
    },
  });

  const result = await builder.build(request({
    hat: securityReviewer,
    phase: RunLifecyclePhase.AwaitingGate,
    scope: RunScope.WorkItem,
    workItemId: "work-billing-blocked",
  }));

  equal(result.pack.curationPlan?.profileId, ContextPackCurationProfileId.SecurityControl);
  ok(omissionsLanePriority < legalActionsLanePriority);
  ok(result.pack.items.some((item) => item.id === "doc:credential-policy"));
  ok(result.pack.items.some((item) => item.id === "doc:security-adr"));
});

test("deterministic context builder snapshots evidence and scope before curation profile policy can inspect it", async () => {
  let synthesisWorkItemId: string | undefined;
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({
          docUnitId: "billing-brd",
          type: DocType.Brd,
          title: "Billing BRD",
          summary: "Recover failed invoices.",
        }),
      ],
      entities: [],
    }),
    curationProfilePolicy: {
      resolve: (profileRequest) => {
        profileRequest.request.snapshot.projectId = TestCurationProfile.MutatedProjectId;
        profileRequest.request.snapshot.workItemId = TestCurationProfile.MutatedWorkItemId;
        (profileRequest.items as ContextPackItem[]).push({
          id: TestCurationProfile.SyntheticItemId,
          kind: ContextPackItemKind.Evidence,
          title: "Synthetic profile mutation",
          summary: "This item was generated by a mutating profile adapter.",
          sourceRef: "profile:mutation",
          required: true,
          freshness: ContextPackFreshness.Live,
          confidence: 1,
          reasons: ["synthetic profile mutation"],
          citationRefs: [TestCurationProfile.SyntheticItemId],
        });
        return {
          profileId: TestCurationProfile.Id,
          policyVersion: TestCurationProfile.PolicyVersion,
          lanePriorityOverrides: {
            [ContextPackAttentionLaneKind.RequiredDocuments]: 10,
          },
          deterministicInstructions: [TestCurationProfile.Instruction],
        };
      },
    },
    synthesis: {
      synthesize: async (query) => {
        synthesisWorkItemId = query.workItemId;
        return {
          summary: "Profile policy mutations should not become deterministic.",
          curationEvidenceRefs: [TestCurationProfile.SyntheticItemId],
        };
      },
    },
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));
  const synthesisTrace = result.pack.curationTrace.find((stage) =>
    stage.stage === ContextPackCurationStageKind.EphemeralSynthesis
  );

  equal(result.pack.projectId, "project-billing");
  equal(result.pack.workItemId, "work-billing-blocked");
  equal(synthesisWorkItemId, "work-billing-blocked");
  equal(result.pack.curationPlan?.profileId, TestCurationProfile.Id);
  equal(result.pack.curationPlan?.policyVersion, TestCurationProfile.PolicyVersion);
  ok(!result.pack.items.some((item) => item.id === TestCurationProfile.SyntheticItemId));
  ok(!synthesisTrace?.evidenceRefs.includes(TestCurationProfile.SyntheticItemId));
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.nodeId === `synthesis_curation_evidence:${TestCurationProfile.SyntheticItemId}` &&
    item.reason === ContextPackOmissionReason.RetrievalFailed
  ));
});

test("deterministic context builder turns empty required curation lanes into explicit omissions", async () => {
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({
          docUnitId: "billing-brd",
          type: DocType.Brd,
          title: "Billing BRD",
          summary: "Recover failed invoices.",
        }),
      ],
      entities: [],
    }),
    curationProfilePolicy: {
      resolve: () => ({
        profileId: TestCurationProfile.RequiredMemoryId,
        policyVersion: TestCurationProfile.PolicyVersion,
        requiredLanes: [ContextPackAttentionLaneKind.Memory],
      }),
    },
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));
  const memoryLane = result.pack.curationPlan?.lanes.find((lane) => lane.kind === ContextPackAttentionLaneKind.Memory);
  const omissionsLane = result.pack.curationPlan?.lanes.find((lane) => lane.kind === ContextPackAttentionLaneKind.Omissions);

  equal(memoryLane?.required, true);
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.nodeId === `required_curation_lane:${ContextPackAttentionLaneKind.Memory}` &&
    item.reason === ContextPackOmissionReason.NotIndexed
  ));
  ok(omissionsLane?.refs.some((ref) =>
    ref.kind === ContextPackAttentionLaneRefKind.Omission &&
    ref.omissionRef === `required_curation_lane:${ContextPackAttentionLaneKind.Memory}`
  ));
});

test("deterministic context builder injects scoped lifecycle anchors before synthesis", async () => {
  const synthesis: ContextPackEphemeralSynthesisPort = {
    synthesize: async (query) => {
      ok(query.items.some((item) => item.id === "discussion:disc-billing-owner"));
      ok(query.items.some((item) => item.id === "decision:decision-billing-owner"));
      ok(query.items.some((item) => item.id === "quality_gate:gate-billing-runtime"));
      ok(query.items.some((item) => item.id === "schedule_block:schedule-billing-meeting"));
      ok(query.items.some((item) => item.id === "supervisor_signal:signal-billing-blocker"));
      const activeWorkLane = query.curationPlan.lanes.find((lane) => lane.kind === ContextPackAttentionLaneKind.ActiveWork);
      ok(activeWorkLane?.refs.some((ref) =>
        ref.kind === ContextPackAttentionLaneRefKind.Item && ref.itemId === "decision:decision-billing-owner"
      ));
      ok(activeWorkLane?.refs.some((ref) =>
        ref.kind === ContextPackAttentionLaneRefKind.Item && ref.itemId === "quality_gate:gate-billing-runtime"
      ));
      ok(activeWorkLane?.refs.some((ref) =>
        ref.kind === ContextPackAttentionLaneRefKind.Item && ref.itemId === "supervisor_signal:signal-billing-blocker"
      ));
      return {
        summary: "Lifecycle anchors were visible before synthesis.",
        rankedContextRefs: [{
          itemId: "decision:decision-billing-owner",
          reason: "The owner decision is the highest-priority blocker context.",
          evidenceRefs: ["decision:decision-billing-owner"],
        }],
      };
    },
  };
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [],
      entities: [],
    }),
    lifecycleAnchors: createInMemoryContextPackLifecycleAnchorPort({
      discussionAnchors: [discussionAnchor()],
      decisionRecords: [decisionRecord()],
      qualityGateEvaluations: [qualityGateEvaluation()],
      workScheduleBlocks: [workScheduleBlock()],
      supervisorSignals: [supervisorSignal()],
    }),
    synthesis,
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));

  const decision = result.pack.items.find((item) => item.id === "decision:decision-billing-owner");
  equal(decision?.kind, ContextPackItemKind.DecisionRecord);
  equal(decision?.required, true);
  ok(decision?.sourcePointers?.some((pointer) =>
    pointer.kind === ContextPackSourcePointerKind.Decision && pointer.decisionId === "decision-billing-owner"
  ));
  ok(decision?.sourcePointers?.some((pointer) =>
    pointer.kind === ContextPackSourcePointerKind.Discussion && pointer.discussionId === "disc-billing-owner"
  ));
  ok(decision?.sourcePointers?.some((pointer) =>
    pointer.kind === ContextPackSourcePointerKind.GraphNode &&
    pointer.nodeId === graphNodeId("org-lfg", GraphNodeKind.Decision, "decision-billing-owner")
  ));
  const supervisorSignalItem = result.pack.items.find((item) => item.id === "supervisor_signal:signal-billing-blocker");
  equal(supervisorSignalItem?.kind, ContextPackItemKind.SupervisorSignal);
  ok(supervisorSignalItem?.sourcePointers?.some((pointer) =>
    pointer.kind === ContextPackSourcePointerKind.SupervisorSignal &&
    pointer.supervisorSignalId === "signal-billing-blocker"
  ));
  const meetingItem = result.pack.items.find((item) => item.id === "schedule_block:schedule-billing-meeting");
  equal(meetingItem?.kind, ContextPackItemKind.Meeting);
  ok(meetingItem?.sourcePointers?.some((pointer) =>
    pointer.kind === ContextPackSourcePointerKind.Meeting &&
    pointer.meetingId === "schedule:schedule-billing-meeting" &&
    pointer.workScheduleBlockId === "schedule-billing-meeting" &&
    pointer.discussionAnchorId === "disc-billing-owner"
  ));
  ok(meetingItem?.sourcePointers?.some((pointer) =>
    pointer.kind === ContextPackSourcePointerKind.GraphNode &&
    pointer.nodeId === graphNodeId("org-lfg", GraphNodeKind.Meeting, "schedule:schedule-billing-meeting")
  ));
  ok(result.pack.items.some((item) =>
    item.id === "synthesis:engineering_director:42:99:ranked:0:decision-decision-billing-owner" &&
    item.kind === ContextPackItemKind.SynthesisRankedContext
  ));
  ok(result.pack.curationTrace.some((stage) =>
    stage.stage === ContextPackCurationStageKind.LifecycleAnchors &&
    stage.evidenceRefs.includes("decision:decision-billing-owner") &&
    stage.evidenceRefs.includes("quality_gate:gate-billing-runtime")
  ));
});

test("deterministic context builder admits broader work-item lifecycle anchors under team scope", async () => {
  const { teamId: _teamId, ...broaderDiscussionAnchor } = discussionAnchor();
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [],
      entities: [],
    }),
    lifecycleAnchors: createInMemoryContextPackLifecycleAnchorPort({
      discussionAnchors: [{
        ...broaderDiscussionAnchor,
        discussionAnchorId: "disc-billing-program",
        title: "Billing program discussion",
      }],
    }),
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));

  ok(result.pack.items.some((item) => item.id === "discussion:disc-billing-program"));
});

test("deterministic context builder excludes supervisor signals targeted to another hat assignment", async () => {
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [],
      entities: [],
    }),
    lifecycleAnchors: createInMemoryContextPackLifecycleAnchorPort({
      supervisorSignals: [
        supervisorSignal(),
        {
          ...supervisorSignal(),
          supervisorSignalId: "signal-other-hat",
          targetHatAssignmentId: "101",
        },
      ],
    }),
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));

  ok(result.pack.items.some((item) => item.id === "supervisor_signal:signal-billing-blocker"));
  ok(!result.pack.items.some((item) => item.id === "supervisor_signal:signal-other-hat"));
});

test("deterministic context builder admits active inbox anchors before synthesis and omits other-hat inbox anchors", async () => {
  const synthesis: ContextPackEphemeralSynthesisPort = {
    synthesize: async (query) => {
      ok(query.items.some((item) => item.id === "inbox:inbox-active-blocker"));
      ok(!query.items.some((item) => item.id === "inbox:inbox-other-hat"));
      const activeWorkLane = query.curationPlan.lanes.find((lane) => lane.kind === ContextPackAttentionLaneKind.ActiveWork);
      ok(activeWorkLane?.refs.some((ref) =>
        ref.kind === ContextPackAttentionLaneRefKind.Item && ref.itemId === "inbox:inbox-active-blocker"
      ));
      return {
        summary: "Inbox anchor was visible before synthesis.",
        rankedContextRefs: [{
          itemId: "inbox:inbox-active-blocker",
          reason: "The inbox item explains why this hat woke up.",
          evidenceRefs: ["inbox:inbox-active-blocker"],
        }],
      };
    },
  };
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({ corpus: [], entities: [] }),
    inboxAnchors: createInMemoryContextPackInboxAnchorPort({
      inboxAnchors: [
        inboxAnchor(),
        {
          ...inboxAnchor(),
          inboxAnchorId: "inbox-other-hat",
          targetHatAssignmentId: "101",
          title: "Other hat blocker inbox",
        },
      ],
    }),
    synthesis,
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));

  const inboxItem = result.pack.items.find((item) => item.id === "inbox:inbox-active-blocker");
  equal(inboxItem?.kind, ContextPackItemKind.InboxAnchor);
  equal(inboxItem?.required, true);
  ok(inboxItem?.sourcePointers?.some((pointer) =>
    pointer.kind === ContextPackSourcePointerKind.InboxAnchor &&
    pointer.inboxAnchorId === "inbox-active-blocker" &&
    pointer.targetHatAssignmentId === "99" &&
    pointer.targetAgentId === "agent-director"
  ));
  ok(inboxItem?.sourcePointers?.some((pointer) =>
    pointer.kind === ContextPackSourcePointerKind.WorkItem && pointer.workItemId === "work-billing-blocked"
  ));
  ok(!result.pack.items.some((item) => item.id === "inbox:inbox-other-hat"));
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.nodeId === "inbox:inbox-other-hat" &&
    item.reason === ContextPackOmissionReason.OutOfScope
  ));
  ok(result.pack.items.some((item) =>
    item.id === "synthesis:engineering_director:42:99:ranked:0:inbox-inbox-active-blocker" &&
    item.kind === ContextPackItemKind.SynthesisRankedContext
  ));
});

test("deterministic context builder uses accepted inbox anchors as graph traversal roots", async () => {
  const inboxNodeId = graphNodeId("org-lfg", GraphNodeKind.InboxAnchor, "inbox-active-blocker");
  const graph = graphStore([
    edge(inboxNodeId, GraphEdgeKind.References, graphNodeId("org-lfg", GraphNodeKind.WorkItem, "work-billing-blocked")),
  ]);
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({ corpus: [], entities: [] }),
    inboxAnchors: createInMemoryContextPackInboxAnchorPort({
      inboxAnchors: [inboxAnchor()],
    }),
    graph,
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));

  ok(result.pack.items.some((item) =>
    item.id === `graph:${inboxNodeId}` &&
    item.reasons.includes("inbox anchor")
  ));
});

test("deterministic context builder admits active-hat inbox anchors without active work provenance", async () => {
  const inboxNodeId = graphNodeId("org-lfg", GraphNodeKind.InboxAnchor, "inbox-active-blocker");
  const projectNodeId = graphNodeId("org-lfg", GraphNodeKind.Project, "project-billing");
  const graph = graphStore([
    edge(inboxNodeId, GraphEdgeKind.References, projectNodeId),
  ]);
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({ corpus: [], entities: [] }),
    inboxAnchors: createInMemoryContextPackInboxAnchorPort({
      inboxAnchors: [inboxAnchor({ workItemId: undefined })],
    }),
    graph,
  });

  const result = await builder.build(request({ workItemId: undefined }));

  const inboxItem = result.pack.items.find((item) => item.id === "inbox:inbox-active-blocker");
  equal(inboxItem?.kind, ContextPackItemKind.InboxAnchor);
  ok(inboxItem?.sourcePointers?.some((pointer) =>
    pointer.kind === ContextPackSourcePointerKind.InboxAnchor &&
    pointer.targetHatAssignmentId === "99"
  ));
  ok(!inboxItem?.sourcePointers?.some((pointer) => pointer.kind === ContextPackSourcePointerKind.WorkItem));
  ok(!inboxItem?.citationRefs?.includes("work:undefined"));
  ok(result.pack.items.some((item) =>
    item.id === `graph:${inboxNodeId}` &&
    item.reasons.includes("inbox anchor")
  ));
  ok(!result.pack.omittedItemsWithReason.some((item) => item.nodeId === "inbox:inbox-active-blocker"));
});

test("deterministic context builder uses lifecycle anchors as graph traversal roots", async () => {
  const decisionNodeId = graphNodeId("org-lfg", GraphNodeKind.Decision, "decision-billing-owner");
  const gateNodeId = graphNodeId("org-lfg", GraphNodeKind.QualityGate, "gate-billing-runtime");
  const meetingNodeId = graphNodeId("org-lfg", GraphNodeKind.Meeting, "schedule:schedule-billing-meeting");
  const signalNodeId = graphNodeId("org-lfg", GraphNodeKind.SupervisorSignal, "signal-billing-blocker");
  const graph = graphStore([
    edge(decisionNodeId, GraphEdgeKind.References, graphNodeId("org-lfg", GraphNodeKind.WorkItem, "work-billing-blocked")),
    edge(gateNodeId, GraphEdgeKind.References, decisionNodeId),
    edge(meetingNodeId, GraphEdgeKind.References, decisionNodeId),
    edge(signalNodeId, GraphEdgeKind.References, gateNodeId),
  ]);
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [],
      entities: [],
    }),
    lifecycleAnchors: createInMemoryContextPackLifecycleAnchorPort({
      discussionAnchors: [discussionAnchor()],
      decisionRecords: [decisionRecord()],
      qualityGateEvaluations: [qualityGateEvaluation()],
      workScheduleBlocks: [workScheduleBlock()],
      supervisorSignals: [supervisorSignal()],
    }),
    graph,
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));

  ok(result.pack.items.some((item) =>
    item.id === `graph:${decisionNodeId}` &&
    item.reasons.includes("lifecycle anchor:decision")
  ));
  ok(result.pack.items.some((item) =>
    item.id === `graph:${gateNodeId}` &&
    item.reasons.includes("lifecycle anchor:quality_gate")
  ));
  ok(result.pack.items.some((item) =>
    item.id === `graph:${meetingNodeId}` &&
    item.reasons.includes("lifecycle anchor:meeting")
  ));
  ok(result.pack.items.some((item) =>
    item.id === `graph:${signalNodeId}` &&
    item.reasons.includes("lifecycle anchor:supervisor_signal")
  ));
});

test("deterministic context builder merges duplicate graph root citation refs and reasons", async () => {
  const workNodeId = graphNodeId("org-lfg", GraphNodeKind.WorkItem, "work-billing-blocked");
  const graph = graphStore([]);
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [],
      entities: [],
    }),
    graph,
    graphRootSeeds: () => [
      {
        nodeId: workNodeId,
        title: "Work item lifecycle root",
        citationRefs: ["work:work-billing-blocked"],
        reasons: ["work-item lifecycle root"],
      },
      {
        nodeId: workNodeId,
        title: "Priority work root",
        citationRefs: ["priority:work-billing-blocked"],
        reasons: ["hierarchy priority item root"],
      },
    ],
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));
  const graphItem = result.pack.items.find((item) => item.id === `graph:${workNodeId}`);

  equal(graphItem?.title, "Work item lifecycle root");
  ok(graphItem?.citationRefs?.includes("work:work-billing-blocked"));
  ok(graphItem?.citationRefs?.includes("priority:work-billing-blocked"));
  ok(graphItem?.reasons.includes("work-item lifecycle root"));
  ok(graphItem?.reasons.includes("hierarchy priority item root"));
});

test("deterministic context builder preserves semantic graph roots over colliding document roots", async () => {
  const workNodeId = graphNodeId("org-lfg", GraphNodeKind.WorkItem, "work-billing-blocked");
  const graph = graphStore([]);
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({
          docUnitId: "billing-brd",
          type: DocType.Brd,
          title: "Billing BRD",
          summary: "Recover failed invoices.",
        }),
      ],
      entities: [],
    }),
    graph,
    nodeIdForDocUnit: () => workNodeId,
    graphRootSeeds: () => [{
      nodeId: workNodeId,
      title: "Work-rooted blocker context",
      citationRefs: ["work:work-billing-blocked"],
      reasons: ["work-rooted director context"],
    }],
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));
  const graphItem = result.pack.items.find((item) => item.id === `graph:${workNodeId}`);

  equal(graphItem?.title, "Work-rooted blocker context");
  ok(graphItem?.citationRefs?.includes("doc:billing-brd"));
  ok(graphItem?.citationRefs?.includes("work:work-billing-blocked"));
  ok(graphItem?.reasons.includes("document graph traversal"));
  ok(graphItem?.reasons.includes("work-rooted director context"));
});

test("deterministic context builder preserves explicit graph root titles while merging lifecycle provenance", async () => {
  const decisionNodeId = graphNodeId("org-lfg", GraphNodeKind.Decision, "decision-billing-owner");
  const graph = graphStore([
    edge(decisionNodeId, GraphEdgeKind.References, graphNodeId("org-lfg", GraphNodeKind.WorkItem, "work-billing-blocked")),
  ]);
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [],
      entities: [],
    }),
    lifecycleAnchors: createInMemoryContextPackLifecycleAnchorPort({
      decisionRecords: [decisionRecord()],
    }),
    graph,
    graphRootSeeds: () => [{
      nodeId: decisionNodeId,
      title: "Director-curated blocker decision context",
      citationRefs: ["director_root:decision-billing-owner"],
      reasons: ["director curated root"],
    }],
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));
  const graphItem = result.pack.items.find((item) => item.id === `graph:${decisionNodeId}`);

  equal(graphItem?.title, "Director-curated blocker decision context");
  ok(graphItem?.reasons.includes("director curated root"));
  ok(graphItem?.reasons.includes("lifecycle anchor:decision"));
  ok(graphItem?.citationRefs?.includes("director_root:decision-billing-owner"));
  ok(graphItem?.citationRefs?.includes("decision:decision-billing-owner"));
});

test("deterministic context builder records lifecycle anchor retrieval failures as omissions", async () => {
  const lifecycleAnchors: ContextPackLifecycleAnchorPort = {
    load: async () => {
      throw new Error("anchor store unavailable");
    },
  };
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [],
      entities: [],
    }),
    lifecycleAnchors,
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));

  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.nodeId === "lifecycle_anchors" &&
    item.reason === ContextPackOmissionReason.RetrievalFailed &&
    item.message.includes("anchor store unavailable")
  ));
  ok(result.pack.curationTrace.some((stage) =>
    stage.stage === ContextPackCurationStageKind.LifecycleAnchors &&
    stage.evidenceRefs.includes("lifecycle_anchors")
  ));
});

test("deterministic context builder rejects lifecycle anchors without active work scope", async () => {
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [],
      entities: [],
    }),
    lifecycleAnchors: createInMemoryContextPackLifecycleAnchorPort({
      decisionRecords: [decisionRecord()],
      supervisorSignals: [supervisorSignal()],
    }),
  });

  const result = await builder.build(request({ workItemId: undefined }));

  ok(!result.pack.items.some((item) => item.id === "decision:decision-billing-owner"));
  ok(!result.pack.items.some((item) => item.id === "supervisor_signal:signal-billing-blocker"));
});

test("deterministic context builder omits out-of-scope lifecycle adapter output and drops its graph roots", async () => {
  const leakedNodeId = graphNodeId("org-lfg", GraphNodeKind.Decision, "decision-leaked");
  const lifecycleAnchors: ContextPackLifecycleAnchorPort = {
    load: () => ({
      items: [
        {
          id: "decision:decision-leaked",
          kind: ContextPackItemKind.DecisionRecord,
          title: "Wrong work decision",
          summary: "This belongs to another work item.",
          sourceRef: "decision:decision-leaked",
          required: true,
          freshness: ContextPackFreshness.Current,
          confidence: 0.9,
          reasons: ["lifecycle_anchor:decision"],
          citationRefs: ["decision:decision-leaked"],
          sourcePointers: [
            { kind: ContextPackSourcePointerKind.Decision, decisionId: "decision-leaked" },
            { kind: ContextPackSourcePointerKind.WorkItem, workItemId: "work-other" },
            { kind: ContextPackSourcePointerKind.GraphNode, nodeId: leakedNodeId },
          ],
        },
      ],
      graphRootSeeds: [{
        nodeId: leakedNodeId,
        title: "Leaked decision root",
        reasons: ["lifecycle anchor:decision"],
      }],
    }),
  };
  const graph = graphStore([
    edge(leakedNodeId, GraphEdgeKind.References, graphNodeId("org-lfg", GraphNodeKind.WorkItem, "work-other")),
  ]);
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [],
      entities: [],
    }),
    lifecycleAnchors,
    graph,
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));

  ok(!result.pack.items.some((item) => item.id === "decision:decision-leaked"));
  ok(!result.pack.items.some((item) => item.id === `graph:${leakedNodeId}`));
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.nodeId === "decision:decision-leaked" &&
    item.reason === ContextPackOmissionReason.OutOfScope
  ));
});

test("deterministic context builder omits lifecycle adapter schedule anchors for another hat assignment", async () => {
  const scheduleNodeId = graphNodeId("org-lfg", GraphNodeKind.ScheduleBlock, "schedule-other-hat");
  const lifecycleAnchors: ContextPackLifecycleAnchorPort = {
    load: () => ({
      items: [
        {
          id: "schedule_block:schedule-other-hat",
          kind: ContextPackItemKind.Meeting,
          title: "Other hat meeting",
          summary: "This schedule belongs to another hat assignment.",
          sourceRef: "schedule_block:schedule-other-hat",
          required: true,
          freshness: ContextPackFreshness.Live,
          confidence: 0.96,
          reasons: ["lifecycle_anchor:schedule_block", "hat_assignment:101"],
          citationRefs: ["schedule_block:schedule-other-hat", "work:work-billing-blocked"],
          sourcePointers: [
            {
              kind: ContextPackSourcePointerKind.ScheduleBlock,
              workScheduleBlockId: "schedule-other-hat",
              assignedHatAssignmentId: "101",
              assignedAgentId: "agent-other",
            },
            { kind: ContextPackSourcePointerKind.WorkItem, workItemId: "work-billing-blocked" },
            { kind: ContextPackSourcePointerKind.GraphNode, nodeId: scheduleNodeId },
          ],
        },
      ],
      graphRootSeeds: [{ nodeId: scheduleNodeId, reasons: ["lifecycle anchor:schedule_block"] }],
    }),
  };
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({ corpus: [], entities: [] }),
    lifecycleAnchors,
    graph: graphStore([]),
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));

  ok(!result.pack.items.some((item) => item.id === "schedule_block:schedule-other-hat"));
  ok(!result.pack.items.some((item) => item.id === `graph:${scheduleNodeId}`));
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.nodeId === "schedule_block:schedule-other-hat" &&
    item.reason === ContextPackOmissionReason.OutOfScope &&
    item.message.includes("schedule anchor is outside active hat assignment")
  ));
});

test("deterministic context builder omits lifecycle adapter schedule anchors without schedule provenance", async () => {
  const scheduleNodeId = graphNodeId("org-lfg", GraphNodeKind.ScheduleBlock, "schedule-mislabelled");
  const lifecycleAnchors: ContextPackLifecycleAnchorPort = {
    load: () => ({
      items: [
        {
          id: "schedule_block:schedule-mislabelled",
          kind: ContextPackItemKind.Meeting,
          title: "Mislabelled schedule",
          summary: "This claims schedule context but only carries discussion provenance.",
          sourceRef: "schedule_block:schedule-mislabelled",
          required: true,
          freshness: ContextPackFreshness.Live,
          confidence: 0.96,
          reasons: ["lifecycle_anchor:schedule_block"],
          citationRefs: ["schedule_block:schedule-mislabelled", "work:work-billing-blocked"],
          sourcePointers: [
            { kind: ContextPackSourcePointerKind.Discussion, discussionId: "disc-billing-owner" },
            { kind: ContextPackSourcePointerKind.WorkItem, workItemId: "work-billing-blocked" },
            { kind: ContextPackSourcePointerKind.GraphNode, nodeId: scheduleNodeId },
          ],
        },
      ],
      graphRootSeeds: [{ nodeId: scheduleNodeId, reasons: ["lifecycle anchor:schedule_block"] }],
    }),
  };
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({ corpus: [], entities: [] }),
    lifecycleAnchors,
    graph: graphStore([]),
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));

  ok(!result.pack.items.some((item) => item.id === "schedule_block:schedule-mislabelled"));
  ok(!result.pack.items.some((item) => item.id === `graph:${scheduleNodeId}`));
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.nodeId === "schedule_block:schedule-mislabelled" &&
    item.reason === ContextPackOmissionReason.OutOfScope &&
    item.message.includes("schedule anchor lacks active hat assignment provenance")
  ));
});

test("deterministic context builder omits lifecycle adapter supervisor signals targeted to another hat assignment", async () => {
  const signalNodeId = graphNodeId("org-lfg", GraphNodeKind.SupervisorSignal, "signal-other-hat");
  const lifecycleAnchors: ContextPackLifecycleAnchorPort = {
    load: () => ({
      items: [
        {
          id: "supervisor_signal:signal-other-hat",
          kind: ContextPackItemKind.SupervisorSignal,
          title: "Other target signal",
          summary: "This signal targets a different active hat assignment.",
          sourceRef: "supervisor_signal:signal-other-hat",
          required: false,
          freshness: ContextPackFreshness.Live,
          confidence: 0.95,
          reasons: ["lifecycle_anchor:supervisor_signal", "target_hat_assignment:101"],
          citationRefs: ["supervisor_signal:signal-other-hat", "work:work-billing-blocked"],
          sourcePointers: [
            {
              kind: ContextPackSourcePointerKind.SupervisorSignal,
              supervisorSignalId: "signal-other-hat",
              targetHatAssignmentId: "101",
            },
            { kind: ContextPackSourcePointerKind.WorkItem, workItemId: "work-billing-blocked" },
            { kind: ContextPackSourcePointerKind.GraphNode, nodeId: signalNodeId },
          ],
        },
      ],
      graphRootSeeds: [{ nodeId: signalNodeId, reasons: ["lifecycle anchor:supervisor_signal"] }],
    }),
  };
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({ corpus: [], entities: [] }),
    lifecycleAnchors,
    graph: graphStore([]),
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));

  ok(!result.pack.items.some((item) => item.id === "supervisor_signal:signal-other-hat"));
  ok(!result.pack.items.some((item) => item.id === `graph:${signalNodeId}`));
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.nodeId === "supervisor_signal:signal-other-hat" &&
    item.reason === ContextPackOmissionReason.OutOfScope &&
    item.message.includes("supervisor signal is outside active target hat assignment")
  ));
});

test("deterministic context builder omits lifecycle adapter supervisor signals without target provenance", async () => {
  const signalNodeId = graphNodeId("org-lfg", GraphNodeKind.SupervisorSignal, "signal-mislabelled");
  const lifecycleAnchors: ContextPackLifecycleAnchorPort = {
    load: () => ({
      items: [
        {
          id: "supervisor_signal:signal-mislabelled",
          kind: ContextPackItemKind.SupervisorSignal,
          title: "Mislabelled supervisor signal",
          summary: "This claims supervisor signal context but only carries discussion provenance.",
          sourceRef: "supervisor_signal:signal-mislabelled",
          required: false,
          freshness: ContextPackFreshness.Live,
          confidence: 0.95,
          reasons: ["lifecycle_anchor:supervisor_signal"],
          citationRefs: ["supervisor_signal:signal-mislabelled", "work:work-billing-blocked"],
          sourcePointers: [
            { kind: ContextPackSourcePointerKind.Discussion, discussionId: "disc-billing-owner" },
            { kind: ContextPackSourcePointerKind.WorkItem, workItemId: "work-billing-blocked" },
            { kind: ContextPackSourcePointerKind.GraphNode, nodeId: signalNodeId },
          ],
        },
      ],
      graphRootSeeds: [{ nodeId: signalNodeId, reasons: ["lifecycle anchor:supervisor_signal"] }],
    }),
  };
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({ corpus: [], entities: [] }),
    lifecycleAnchors,
    graph: graphStore([]),
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));

  ok(!result.pack.items.some((item) => item.id === "supervisor_signal:signal-mislabelled"));
  ok(!result.pack.items.some((item) => item.id === `graph:${signalNodeId}`));
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.nodeId === "supervisor_signal:signal-mislabelled" &&
    item.reason === ContextPackOmissionReason.OutOfScope &&
    item.message.includes("supervisor signal lacks target hat assignment provenance")
  ));
});

test("deterministic context builder carries memory recall omissions into the context pack", async () => {
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [],
      entities: [],
    }),
    memory: {
      recall: async () => ({
        memories: [],
        omittedItemsWithReason: [
          {
            nodeId: "memory_scope:missing_work_item_id",
            reason: ContextPackOmissionReason.OutOfScope,
            message: "memory recall requires work-item scope for context-pack retrieval",
          },
        ],
      }),
    },
  });

  const result = await builder.build(request({ workItemId: undefined }));

  equal(result.pack.omittedItemsWithReason[0]?.nodeId, "memory_scope:missing_work_item_id");
  equal(result.pack.omittedItemsWithReason[0]?.reason, ContextPackOmissionReason.OutOfScope);
  ok(result.pack.curationTrace.some((stage) =>
    stage.stage === ContextPackCurationStageKind.MemoryRecall &&
    stage.evidenceRefs.includes("memory_scope:missing_work_item_id")
  ));
});

test("deterministic context builder traverses explicit work graph roots without requiring document roots", async () => {
  const graph = graphStore([
    edge("work-billing-blocked", GraphEdgeKind.References, "decision-owner-missing"),
    edge("decision-owner-missing", GraphEdgeKind.ChangedBy, "meeting-escalation"),
  ]);
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [],
      entities: [],
      sourceGraphVersion: "docs-empty",
    }),
    graph,
    graphRootNodeIds: (context) => [context.snapshot.workItemId ?? "missing-work"],
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));

  const graphItem = result.pack.items.find((item) => item.id === "graph:work-billing-blocked");
  equal(graphItem?.kind, ContextPackItemKind.GraphNeighborhood);
  ok(graphItem?.sourcePointers?.some((pointer) =>
    pointer.kind === ContextPackSourcePointerKind.GraphEdge && pointer.edgeId === "work-billing-blocked-references-decision-owner-missing",
  ));
});

test("deterministic context builder preserves semantic graph root seed metadata for hat-specific context", async () => {
  const graph = graphStore([
    edge("project-billing", GraphEdgeKind.References, "decision-budget-risk"),
  ]);
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [],
      entities: [],
      sourceGraphVersion: "docs-empty",
    }),
    graph,
    graphRootSeeds: () => [
      {
        nodeId: "project-billing",
        title: "Project context for Billing Platform",
        citationRefs: ["project:project-billing"],
        reasons: ["project trajectory root", "director priority scope"],
      },
    ],
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));

  const graphItem = result.pack.items.find((item) => item.id === "graph:project-billing");
  equal(graphItem?.title, "Project context for Billing Platform");
  deepEqual(graphItem?.reasons, ["project trajectory root", "director priority scope"]);
  ok(graphItem?.citationRefs?.includes("project:project-billing"));
  ok(graphItem?.sourcePointers?.some((pointer) =>
    pointer.kind === ContextPackSourcePointerKind.GraphEdge &&
    pointer.edgeId === "project-billing-references-decision-budget-risk",
  ));
});

test("deterministic context builder preserves semantic graph root titles while merging raw root provenance", async () => {
  const graph = graphStore([
    edge("project-billing", GraphEdgeKind.References, "decision-budget-risk"),
  ]);
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [],
      entities: [],
    }),
    graph,
    graphRootNodeIds: () => ["project-billing"],
    graphRootSeeds: () => [
      {
        nodeId: "project-billing",
        title: "Project context for Billing Platform",
        citationRefs: ["project:project-billing"],
        reasons: ["project trajectory root"],
      },
    ],
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));
  const graphItems = result.pack.items.filter((item) => item.id === "graph:project-billing");

  equal(graphItems.length, 1);
  equal(graphItems[0]?.title, "Project context for Billing Platform");
  deepEqual(graphItems[0]?.reasons, ["project trajectory root", "context graph seed"]);
  ok(graphItems[0]?.citationRefs?.includes("project:project-billing"));
  ok(graphItems[0]?.citationRefs?.includes("graph:project-billing"));
});

test("deterministic context builder records policy completeness omissions for missing required context", async () => {
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [],
      entities: [],
    }),
    completenessPolicy: {
      evaluate: () => ({
        omittedItemsWithReason: [
          {
            nodeId: "brd:billing",
            reason: ContextPackOmissionReason.NotIndexed,
            message: "required BRD is not indexed for blocked director review",
          },
        ],
        lifecycleBlockers: ["missing required BRD"],
        evidenceRefs: ["policy:director-blocker-context"],
      }),
    },
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));

  equal(result.pack.omittedItemsWithReason[0]?.reason, ContextPackOmissionReason.NotIndexed);
  ok(result.pack.lifecycleBlockers.includes("missing required BRD"));
  ok(result.pack.curationTrace.some((stage) => stage.evidenceRefs.includes("policy:director-blocker-context")));
});

test("default context completeness policy requires management blocker business, architecture, policy, and graph context", async () => {
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({
          docUnitId: "billing-brd",
          type: DocType.Brd,
          title: "Billing BRD",
          summary: "Recover failed invoices.",
        }),
      ],
      entities: [],
    }),
    completenessPolicy: createDefaultContextPackCompletenessPolicy(),
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));

  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.nodeId === "context_requirement:management_blocker_architecture" &&
    item.reason === ContextPackOmissionReason.NotIndexed
  ));
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.nodeId === "context_requirement:management_blocker_policy" &&
    item.reason === ContextPackOmissionReason.NotIndexed
  ));
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.nodeId === "context_requirement:management_blocker_graph" &&
    item.reason === ContextPackOmissionReason.NotIndexed
  ));
  ok(!result.pack.omittedItemsWithReason.some((item) =>
    item.nodeId === "context_requirement:management_blocker_business"
  ));
  ok(result.pack.lifecycleBlockers.some((blocker) => blocker.includes("management blocker architecture context")));
  ok(result.pack.curationTrace.some((stage) =>
    stage.stage === ContextPackCurationStageKind.RequiredConsult &&
    stage.evidenceRefs.includes("context_policy:default_management_blocker:v1")
  ));
});

test("default context completeness policy ignores wrong-scope documents even when hat-bound retrieval includes them", async () => {
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({
          docUnitId: "other-project-brd",
          type: DocType.Brd,
          scopeKind: DocScopeKind.Project,
          scopeId: "project-unrelated",
          title: "Unrelated BRD",
          summary: "A different project has billing-like wording.",
          boundHatIds: ["engineering_director"],
        }),
        docUnit({
          docUnitId: "other-project-ca",
          type: DocType.Architecture,
          scopeKind: DocScopeKind.Project,
          scopeId: "project-unrelated",
          title: "Unrelated CA",
          summary: "A different project architecture note.",
          boundHatIds: ["engineering_director"],
        }),
        docUnit({
          docUnitId: "org-policy",
          type: DocType.Policy,
          scopeKind: DocScopeKind.Organization,
          scopeId: "org-lfg",
          title: "Company escalation policy",
          summary: "Blocked management work requires scoped business and architecture context.",
        }),
      ],
      entities: [],
    }),
    completenessPolicy: createDefaultContextPackCompletenessPolicy(),
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));

  ok(result.pack.items.some((item) => item.id === "doc:other-project-brd"));
  ok(result.pack.items.some((item) => item.id === "doc:other-project-ca"));
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.nodeId === "context_requirement:management_blocker_business" &&
    item.reason === ContextPackOmissionReason.NotIndexed
  ));
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.nodeId === "context_requirement:management_blocker_architecture" &&
    item.reason === ContextPackOmissionReason.NotIndexed
  ));
  ok(!result.pack.omittedItemsWithReason.some((item) =>
    item.nodeId === "context_requirement:management_blocker_policy"
  ));
});

test("deterministic context builder rejects synthesis grounded only in wrong-scope documents", async () => {
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({
          docUnitId: "other-project-brd",
          type: DocType.Brd,
          scopeKind: DocScopeKind.Project,
          scopeId: "project-unrelated",
          title: "Unrelated BRD",
          summary: "A different project has billing-like wording.",
          boundHatIds: ["engineering_director"],
        }),
      ],
      entities: [],
    }),
    synthesis: {
      synthesize: async () => ({
        summary: "Wrong-scope docs should not ground advice.",
        briefing: {
          title: "Wrong-scope briefing",
          summary: "This only cites an unrelated project document.",
          evidenceRefs: ["doc:other-project-brd"],
        },
        rankedContextRefs: [{
          itemId: "doc:other-project-brd",
          reason: "This unrelated document should not become ranked context.",
          evidenceRefs: ["doc:other-project-brd"],
        }],
        curationEvidenceRefs: ["doc:other-project-brd"],
      }),
    },
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));
  const synthesisTrace = result.pack.curationTrace.find((stage) =>
    stage.stage === ContextPackCurationStageKind.EphemeralSynthesis
  );

  ok(result.pack.items.some((item) => item.id === "doc:other-project-brd"));
  ok(!result.pack.items.some((item) => item.kind === ContextPackItemKind.SynthesisBriefing));
  ok(!result.pack.items.some((item) => item.kind === ContextPackItemKind.SynthesisRankedContext));
  ok(!synthesisTrace?.evidenceRefs.includes("doc:other-project-brd"));
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.reason === ContextPackOmissionReason.RetrievalFailed &&
    item.message.includes("ephemeral synthesis briefing was not grounded")
  ));
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.reason === ContextPackOmissionReason.RetrievalFailed &&
    item.message.includes("ephemeral synthesis advisory was not grounded")
  ));
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.nodeId === "synthesis_curation_evidence:doc:other-project-brd" &&
    item.reason === ContextPackOmissionReason.RetrievalFailed
  ));
});

test("deterministic context builder rejects synthesis grounded through wrong-scope document graph citations", async () => {
  const wrongScopeDocNodeId = graphNodeId("org-lfg", GraphNodeKind.DocUnit, "other-project-brd");
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({
          docUnitId: "other-project-brd",
          type: DocType.Brd,
          scopeKind: DocScopeKind.Project,
          scopeId: "project-unrelated",
          title: "Unrelated BRD",
          summary: "A different project has billing-like wording.",
          boundHatIds: ["engineering_director"],
        }),
      ],
      entities: [],
    }),
    graph: graphStore([]),
    nodeIdForDocUnit: () => wrongScopeDocNodeId,
    synthesis: {
      synthesize: async () => ({
        summary: "Wrong-scope graph citations should not ground advice.",
        rankedContextRefs: [{
          itemId: `graph:${wrongScopeDocNodeId}`,
          reason: "A graph item with only wrong-scope document provenance should not be grounded.",
          evidenceRefs: [`graph:${wrongScopeDocNodeId}`],
        }],
        curationEvidenceRefs: [`graph:${wrongScopeDocNodeId}`],
      }),
    },
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));
  const graphItem = result.pack.items.find((item) => item.id === `graph:${wrongScopeDocNodeId}`);
  const synthesisTrace = result.pack.curationTrace.find((stage) =>
    stage.stage === ContextPackCurationStageKind.EphemeralSynthesis
  );

  ok(graphItem?.citationRefs?.includes("doc:other-project-brd"));
  ok(!result.pack.items.some((item) => item.kind === ContextPackItemKind.SynthesisRankedContext));
  ok(!synthesisTrace?.evidenceRefs.includes(`graph:${wrongScopeDocNodeId}`));
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.reason === ContextPackOmissionReason.RetrievalFailed &&
    item.message.includes("ephemeral synthesis advisory was not grounded")
  ));
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.nodeId === `synthesis_curation_evidence:graph:${wrongScopeDocNodeId}` &&
    item.reason === ContextPackOmissionReason.RetrievalFailed
  ));
});

test("deterministic context builder rejects synthesis grounded through wrong-scope graph-only roots", async () => {
  const wrongProjectNodeId = graphNodeId("org-lfg", GraphNodeKind.Project, "project-unrelated");
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [],
      entities: [],
    }),
    graph: graphStore([]),
    graphRootSeeds: () => [{
      nodeId: wrongProjectNodeId,
      title: "Wrong project graph root",
      citationRefs: [`graph:${wrongProjectNodeId}`],
      reasons: ["test wrong project graph root"],
    }],
    synthesis: {
      synthesize: async () => ({
        summary: "Wrong-scope graph-only roots should not ground advice.",
        rankedContextRefs: [{
          itemId: `graph:${wrongProjectNodeId}`,
          reason: "A graph-only item for another project should not be grounded.",
          evidenceRefs: [`graph:${wrongProjectNodeId}`],
        }],
        curationEvidenceRefs: [`graph:${wrongProjectNodeId}`],
      }),
    },
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));
  const synthesisTrace = result.pack.curationTrace.find((stage) =>
    stage.stage === ContextPackCurationStageKind.EphemeralSynthesis
  );

  ok(result.pack.items.some((item) => item.id === `graph:${wrongProjectNodeId}`));
  ok(!result.pack.items.some((item) => item.kind === ContextPackItemKind.SynthesisRankedContext));
  ok(!synthesisTrace?.evidenceRefs.includes(`graph:${wrongProjectNodeId}`));
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.reason === ContextPackOmissionReason.RetrievalFailed &&
    item.message.includes("ephemeral synthesis advisory was not grounded")
  ));
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.nodeId === `synthesis_curation_evidence:graph:${wrongProjectNodeId}` &&
    item.reason === ContextPackOmissionReason.RetrievalFailed
  ));
});

test("deterministic context builder admits synthesis grounded in active initiative and priority work graph roots", async () => {
  const initiativeNodeId = graphNodeId("org-lfg", GraphNodeKind.Initiative, "init-billing");
  const priorityWorkNodeId = graphNodeId("org-lfg", GraphNodeKind.WorkItem, "work-billing-blocked");
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [],
      entities: [],
    }),
    graph: graphStore([]),
    graphRootSeeds: () => [
      {
        nodeId: initiativeNodeId,
        title: "Billing recovery initiative",
        citationRefs: [`graph:${initiativeNodeId}`],
        reasons: ["active initiative root"],
      },
      {
        nodeId: priorityWorkNodeId,
        title: "Blocked billing priority",
        citationRefs: [`graph:${priorityWorkNodeId}`],
        reasons: ["priority work root"],
      },
    ],
    synthesis: {
      synthesize: async () => ({
        summary: "Director context needs both the initiative and priority work roots.",
        rankedContextRefs: [
          {
            itemId: `graph:${initiativeNodeId}`,
            reason: "The active initiative frames the director decision.",
            evidenceRefs: [`graph:${initiativeNodeId}`],
          },
          {
            itemId: `graph:${priorityWorkNodeId}`,
            reason: "The priority work item explains the active blocker.",
            evidenceRefs: [`graph:${priorityWorkNodeId}`],
          },
        ],
        curationEvidenceRefs: [`graph:${initiativeNodeId}`, `graph:${priorityWorkNodeId}`],
      }),
    },
  });

  const result = await builder.build(request({ workItemId: "work-billing" }));
  const synthesisTrace = result.pack.curationTrace.find((stage) =>
    stage.stage === ContextPackCurationStageKind.EphemeralSynthesis
  );

  ok(result.pack.items.some((item) =>
    item.kind === ContextPackItemKind.SynthesisRankedContext &&
    item.reasons.includes(`target:graph:${initiativeNodeId}`)
  ));
  ok(result.pack.items.some((item) =>
    item.kind === ContextPackItemKind.SynthesisRankedContext &&
    item.reasons.includes(`target:graph:${priorityWorkNodeId}`)
  ));
  ok(synthesisTrace?.evidenceRefs.includes(`graph:${initiativeNodeId}`));
  ok(synthesisTrace?.evidenceRefs.includes(`graph:${priorityWorkNodeId}`));
});

test("deterministic context builder rejects synthesis grounded through lifecycle items with mixed-scope document citations", async () => {
  const activeDocId = "billing-brd";
  const wrongScopeDocId = "other-project-brd";
  const mixedDecisionId = "decision:mixed-doc-provenance";
  const lifecycleAnchors: ContextPackLifecycleAnchorPort = {
    load: () => ({
      items: [{
        id: mixedDecisionId,
        kind: ContextPackItemKind.DecisionRecord,
        title: "Mixed provenance decision",
        summary: "This active decision cites one active BRD and one unrelated BRD.",
        sourceRef: mixedDecisionId,
        freshness: ContextPackFreshness.Live,
        confidence: 0.95,
        required: true,
        reasons: ["lifecycle_anchor:decision"],
        citationRefs: [
          mixedDecisionId,
          "work:work-billing-blocked",
          `doc:${activeDocId}`,
          `doc:${wrongScopeDocId}`,
        ],
        sourcePointers: [
          { kind: ContextPackSourcePointerKind.Decision, decisionId: "mixed-doc-provenance" },
          { kind: ContextPackSourcePointerKind.WorkItem, workItemId: "work-billing-blocked" },
          {
            kind: ContextPackSourcePointerKind.DocUnit,
            docUnitId: activeDocId,
            organizationId: "org-lfg",
            docType: DocType.Brd,
            scopeKind: DocScopeKind.Project,
            scopeId: "project-billing",
            contentRef: `git://docs/${activeDocId}.md`,
            contentHash: `hash-${activeDocId}`,
            sourceId: "source-main",
            version: 1,
            provenanceChangeSetId: "cs-docs",
          },
        ],
      }],
    }),
  };
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({
          docUnitId: activeDocId,
          type: DocType.Brd,
          title: "Billing BRD",
          summary: "Recover failed invoices.",
        }),
        docUnit({
          docUnitId: wrongScopeDocId,
          type: DocType.Brd,
          scopeKind: DocScopeKind.Project,
          scopeId: "project-unrelated",
          title: "Unrelated BRD",
          summary: "Another project has tempting but irrelevant business rules.",
          boundHatIds: ["engineering_director"],
        }),
      ],
      entities: [],
    }),
    lifecycleAnchors,
    synthesis: {
      synthesize: async () => ({
        summary: "Mixed-scope lifecycle citations should not ground advice.",
        rankedContextRefs: [{
          itemId: mixedDecisionId,
          reason: "A lifecycle item with any wrong-scope document citation should not be grounded.",
          evidenceRefs: [mixedDecisionId],
        }],
        curationEvidenceRefs: [mixedDecisionId],
      }),
    },
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));
  const lifecycleItem = result.pack.items.find((item) => item.id === mixedDecisionId);
  const synthesisTrace = result.pack.curationTrace.find((stage) =>
    stage.stage === ContextPackCurationStageKind.EphemeralSynthesis
  );

  ok(lifecycleItem?.citationRefs?.includes(`doc:${activeDocId}`));
  ok(lifecycleItem?.citationRefs?.includes(`doc:${wrongScopeDocId}`));
  ok(!result.pack.items.some((item) => item.kind === ContextPackItemKind.SynthesisRankedContext));
  ok(!synthesisTrace?.evidenceRefs.includes(mixedDecisionId));
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.reason === ContextPackOmissionReason.RetrievalFailed &&
    item.message.includes("ephemeral synthesis advisory was not grounded")
  ));
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.nodeId === `synthesis_curation_evidence:${mixedDecisionId}` &&
    item.reason === ContextPackOmissionReason.RetrievalFailed
  ));
});

test("deterministic context builder rejects synthesis grounded through wrong-scope graph edges", async () => {
  const activeProjectNodeId = graphNodeId("org-lfg", GraphNodeKind.Project, "project-billing");
  const wrongProjectNodeId = graphNodeId("org-lfg", GraphNodeKind.Project, "project-unrelated");
  const edgeOnlyItemId = "decision:cross-project-edge";
  const lifecycleAnchors: ContextPackLifecycleAnchorPort = {
    load: () => ({
      items: [{
        id: edgeOnlyItemId,
        kind: ContextPackItemKind.DecisionRecord,
        title: "Cross-project graph edge",
        summary: "This deterministic item only has a graph edge from active project to unrelated project.",
        sourceRef: edgeOnlyItemId,
        freshness: ContextPackFreshness.Live,
        confidence: 0.95,
        required: true,
        reasons: ["test wrong graph edge"],
        citationRefs: [edgeOnlyItemId, "graph:edge-cross-project"],
        sourcePointers: [
          { kind: ContextPackSourcePointerKind.Decision, decisionId: "cross-project-edge" },
          { kind: ContextPackSourcePointerKind.WorkItem, workItemId: "work-billing-blocked" },
          {
            kind: ContextPackSourcePointerKind.GraphEdge,
            edgeId: "edge-cross-project",
            fromNodeId: activeProjectNodeId,
            toNodeId: wrongProjectNodeId,
          },
        ],
      }],
    }),
  };
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [],
      entities: [],
    }),
    lifecycleAnchors,
    synthesis: {
      synthesize: async () => ({
        summary: "Cross-project graph edges should not ground advice.",
        rankedContextRefs: [{
          itemId: edgeOnlyItemId,
          reason: "A graph edge to a wrong project should not be synthesis ground.",
          evidenceRefs: [edgeOnlyItemId],
        }],
        curationEvidenceRefs: [edgeOnlyItemId],
      }),
    },
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));
  const synthesisTrace = result.pack.curationTrace.find((stage) =>
    stage.stage === ContextPackCurationStageKind.EphemeralSynthesis
  );

  ok(result.pack.items.some((item) => item.id === edgeOnlyItemId));
  ok(!result.pack.items.some((item) => item.kind === ContextPackItemKind.SynthesisRankedContext));
  ok(!synthesisTrace?.evidenceRefs.includes(edgeOnlyItemId));
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.reason === ContextPackOmissionReason.RetrievalFailed &&
    item.message.includes("ephemeral synthesis advisory was not grounded")
  ));
});

test("deterministic context builder snapshots deterministic evidence before completeness policy can mutate it", async () => {
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({
          docUnitId: "billing-brd",
          type: DocType.Brd,
          title: "Billing BRD",
          summary: "Recover failed invoices.",
        }),
      ],
      entities: [],
    }),
    completenessPolicy: {
      evaluate: (policyRequest) => {
        (policyRequest.items as ContextPackItem[]).push({
          id: "policy:synthetic-mutation",
          kind: ContextPackItemKind.Evidence,
          title: "Synthetic policy mutation",
          summary: "This item was generated by a mutating policy adapter.",
          sourceRef: "policy:mutation",
          required: true,
          freshness: ContextPackFreshness.Live,
          confidence: 1,
          reasons: ["synthetic policy mutation"],
          citationRefs: ["policy:synthetic-mutation"],
        });
        return { omittedItemsWithReason: [] };
      },
    },
    synthesis: {
      synthesize: async () => ({
        summary: "Policy mutations should not become deterministic.",
        curationEvidenceRefs: ["policy:synthetic-mutation"],
      }),
    },
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));
  const synthesisTrace = result.pack.curationTrace.find((stage) =>
    stage.stage === ContextPackCurationStageKind.EphemeralSynthesis
  );

  ok(!result.pack.items.some((item) => item.id === "policy:synthetic-mutation"));
  ok(!synthesisTrace?.evidenceRefs.includes("policy:synthetic-mutation"));
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.nodeId === "synthesis_curation_evidence:policy:synthetic-mutation" &&
    item.reason === ContextPackOmissionReason.RetrievalFailed
  ));
});

test("deterministic context builder snapshots request scope before completeness policy can mutate it", async () => {
  let synthesisWorkItemId: string | undefined;
  const buildRequest = request({ workItemId: "work-billing-blocked" });
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({
          docUnitId: "billing-brd",
          type: DocType.Brd,
          title: "Billing BRD",
          summary: "Recover failed invoices.",
        }),
      ],
      entities: [],
    }),
    completenessPolicy: {
      evaluate: (policyRequest) => {
        (policyRequest.request.snapshot as ContextPackBuildRequest["snapshot"]).workItemId = "work-mutated-by-policy";
        (policyRequest.request.snapshot as ContextPackBuildRequest["snapshot"]).projectId = "project-mutated-by-policy";
        return { omittedItemsWithReason: [] };
      },
    },
    synthesis: {
      synthesize: async (query) => {
        synthesisWorkItemId = query.workItemId;
        return {
          summary: "Policy request mutation should not change synthesis scope.",
          curationEvidenceRefs: ["doc:billing-brd"],
        };
      },
    },
  });

  const result = await builder.build(buildRequest);

  equal(result.pack.workItemId, "work-billing-blocked");
  equal(result.pack.projectId, "project-billing");
  equal(synthesisWorkItemId, "work-billing-blocked");
  equal(buildRequest.snapshot.workItemId, "work-billing-blocked");
  equal(buildRequest.snapshot.projectId, "project-billing");
});

test("deterministic context builder snapshots request scope before lifecycle adapters can mutate it", async () => {
  let synthesisScope: { projectId?: string | undefined; workItemId?: string | undefined } = {};
  const buildRequest = request({ workItemId: "work-billing-blocked" });
  const lifecycleAnchors: ContextPackLifecycleAnchorPort = {
    load: (lifecycleRequest) => {
      lifecycleRequest.request.snapshot.projectId = "project-mutated-by-lifecycle";
      lifecycleRequest.request.snapshot.workItemId = "work-mutated-by-lifecycle";
      return {
        items: [{
          id: "decision:decision-original-work",
          kind: ContextPackItemKind.DecisionRecord,
          title: "Original work decision",
          summary: "The original work item still owns this decision.",
          sourceRef: "decision:decision-original-work",
          freshness: ContextPackFreshness.Live,
          confidence: 0.95,
          required: true,
          reasons: ["lifecycle_anchor:decision"],
          citationRefs: ["decision:decision-original-work", "work:work-billing-blocked"],
          sourcePointers: [
            { kind: ContextPackSourcePointerKind.Decision, decisionId: "decision-original-work" },
            { kind: ContextPackSourcePointerKind.WorkItem, workItemId: "work-billing-blocked" },
          ],
        }],
      };
    },
  };
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({
          docUnitId: "billing-brd",
          type: DocType.Brd,
          title: "Billing BRD",
          summary: "Recover failed invoices.",
        }),
      ],
      entities: [],
    }),
    lifecycleAnchors,
    synthesis: {
      synthesize: async (query) => {
        synthesisScope = { projectId: query.projectId, workItemId: query.workItemId };
        return {
          summary: "Original scope is stable.",
          rankedContextRefs: [{
            itemId: "decision:decision-original-work",
            reason: "The original work decision remains in scope.",
            evidenceRefs: ["decision:decision-original-work"],
          }],
          curationEvidenceRefs: ["decision:decision-original-work"],
        };
      },
    },
  });

  const result = await builder.build(buildRequest);

  equal(result.pack.projectId, "project-billing");
  equal(result.pack.workItemId, "work-billing-blocked");
  equal(synthesisScope.projectId, "project-billing");
  equal(synthesisScope.workItemId, "work-billing-blocked");
  equal(buildRequest.snapshot.projectId, "project-billing");
  equal(buildRequest.snapshot.workItemId, "work-billing-blocked");
  ok(result.pack.items.some((item) => item.id === "decision:decision-original-work"));
  ok(result.pack.items.some((item) => item.kind === ContextPackItemKind.SynthesisRankedContext));
});

test("deterministic context builder snapshots document units before graph-root callbacks can mutate them", async () => {
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({
          docUnitId: "billing-brd",
          type: DocType.Brd,
          title: "Billing BRD",
          summary: "Recover failed invoices.",
        }),
      ],
      entities: [],
    }),
    graph: graphStore([]),
    nodeIdForDocUnit: (unit) => {
      unit.status = DocLifecycleState.Stale;
      unit.scopeId = "project-mutated-by-graph-root";
      return "node-billing-brd";
    },
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));

  deepEqual(result.pack.staleInputs, []);
  const docItem = result.pack.items.find((item) => item.id === "doc:billing-brd");
  ok(docItem?.sourcePointers?.some((pointer) =>
    pointer.kind === ContextPackSourcePointerKind.DocUnit &&
    pointer.docUnitId === "billing-brd" &&
    pointer.scopeId === "project-billing"
  ));
});

test("default context completeness policy requires graph context rooted in the active work scope", async () => {
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({ docUnitId: "billing-brd", type: DocType.Brd, title: "Billing BRD", summary: "Recover failed invoices." }),
        docUnit({ docUnitId: "billing-ca", type: DocType.Architecture, title: "Billing CA", summary: "Billing recovery architecture." }),
        docUnit({ docUnitId: "billing-policy", type: DocType.Policy, title: "Billing Policy", summary: "Billing recovery policy." }),
      ],
      entities: [],
    }),
    graph: graphStore([
      edge("work-other", GraphEdgeKind.References, "decision-other"),
    ]),
    graphRootNodeIds: () => ["work-other"],
    completenessPolicy: createDefaultContextPackCompletenessPolicy(),
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));

  ok(result.pack.items.some((item) => item.id === "graph:work-other"));
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.nodeId === "context_requirement:management_blocker_graph" &&
    item.reason === ContextPackOmissionReason.NotIndexed
  ));
});

test("default context completeness policy accepts source-backed active-scope documents and graph roots", async () => {
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({ docUnitId: "billing-brd", type: DocType.Brd, title: "Billing BRD", summary: "Recover failed invoices." }),
        docUnit({
          docUnitId: "department-ca",
          type: DocType.Architecture,
          scopeKind: DocScopeKind.Department,
          scopeId: "eng",
          title: "Engineering CA",
          summary: "Engineering architecture for blocked billing recovery.",
        }),
        docUnit({
          docUnitId: "org-policy",
          type: DocType.Policy,
          scopeKind: DocScopeKind.Organization,
          scopeId: "org-lfg",
          title: "Company escalation policy",
          summary: "Management blockers require scoped context.",
          boundStageIds: [RunLifecyclePhase.Blocked],
        }),
      ],
      entities: [],
    }),
    graph: graphStore([
      edge("work-billing-blocked", GraphEdgeKind.References, "decision-owner-missing"),
    ]),
    graphRootNodeIds: (context) => [context.snapshot.workItemId ?? "missing-work"],
    completenessPolicy: createDefaultContextPackCompletenessPolicy(),
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));

  ok(!result.pack.omittedItemsWithReason.some((item) =>
    item.nodeId?.startsWith("context_requirement:management_blocker")
  ));
});

test("default context completeness policy does not apply management blocker rules to individual contributor work", async () => {
  const implementer = buildHatDefinitions().find((hat) => hat.id === "backend_implementer")!;
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [],
      entities: [],
    }),
    completenessPolicy: createDefaultContextPackCompletenessPolicy(),
  });

  const result = await builder.build(request({
    hat: implementer,
    scope: RunScope.WorkItem,
    phase: RunLifecyclePhase.Executing,
  }));

  ok(!result.pack.omittedItemsWithReason.some((item) =>
    item.nodeId?.startsWith("context_requirement:management_blocker")
  ));
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.nodeId === "required_curation_lane:required_documents" &&
    item.reason === ContextPackOmissionReason.NotIndexed
  ));
  ok(result.pack.curationTrace.some((stage) =>
    stage.stage === ContextPackCurationStageKind.RequiredConsult &&
    stage.summary === "policy completeness omissions=0"
  ));
});

test("deterministic context builder ignores legacy raw synthesis status fields without dropping grounded advisories", async () => {
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({
          docUnitId: "billing-brd",
          type: DocType.Brd,
          title: "Billing BRD",
          summary: "Recover failed invoices.",
        }),
      ],
      entities: [],
    }),
    synthesis: {
      synthesize: async () => ({
        summary: "Legacy raw blocker with grounded advisory",
        rankedContextRefs: [{
          itemId: "doc:billing-brd",
          reason: "The grounded advisory should survive legacy raw status fields.",
          evidenceRefs: ["doc:billing-brd"],
        }],
        lifecycleBlockers: ["invented blocker"],
        contradictions: ["invented contradiction"],
      }),
    },
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));

  ok(!result.pack.lifecycleBlockers.includes("invented blocker"));
  ok(!result.pack.contradictions.includes("invented contradiction"));
  ok(result.pack.items.some((item) =>
    item.kind === ContextPackItemKind.SynthesisRankedContext &&
    item.summary.includes("grounded advisory should survive")
  ));
});

test("deterministic context builder promotes admitted synthesis advisories only through policy", async () => {
  const promotedGapBlocker = "director must verify billing owner before unblocking execution";
  const invalidPromotionBlocker = "missing synthesis advisory must not become a blocker";
  const admittedGapId = "synthesis:engineering_director:42:99:gap:0";
  const promotionPolicy: ContextPackAdvisoryPromotionPolicyPort = {
    evaluate: async (policyRequest) => {
      equal(policyRequest.advisoryItems.some((item) => item.id === admittedGapId), true);
      equal(policyRequest.request.snapshot.workItemId, "work-billing-blocked");
      const mutableRequest = policyRequest.request as ContextPackBuildRequest;
      mutableRequest.snapshot.projectId = "project-mutated-by-promotion-policy";
      const mutableAdvisories = policyRequest.advisoryItems as ContextPackItem[];
      mutableAdvisories[0] = {
        ...mutableAdvisories[0]!,
        summary: "mutated by promotion policy",
      };
      return {
        promotions: [
          {
            sourceItemId: admittedGapId,
            lifecycleBlocker: promotedGapBlocker,
            evidenceRefs: [admittedGapId, "doc:billing-brd"],
          },
          {
            sourceItemId: "synthesis:not-admitted",
            lifecycleBlocker: invalidPromotionBlocker,
            evidenceRefs: ["doc:billing-brd"],
          },
          {
            sourceItemId: admittedGapId,
            lifecycleBlocker: promotedGapBlocker,
            evidenceRefs: [admittedGapId, "doc:billing-brd"],
          },
        ],
      };
    },
  };
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({
          docUnitId: "billing-brd",
          type: DocType.Brd,
          title: "Billing BRD",
          summary: "Recover failed invoices.",
        }),
      ],
      entities: [],
    }),
    synthesis: {
      synthesize: async () => ({
        summary: "Grounded gap should stay advisory until policy promotes it.",
        gapHypotheses: [{
          message: "Ownership evidence may be missing from the indexed meeting notes.",
          evidenceRefs: ["doc:billing-brd"],
          suggestedNextStep: "Ask the engineering manager for the owner decision record.",
        }],
        curationEvidenceRefs: ["doc:billing-brd"],
      }),
    },
    advisoryPromotionPolicy: promotionPolicy,
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));

  ok(result.pack.lifecycleBlockers.includes(promotedGapBlocker));
  equal(result.pack.lifecycleBlockers.filter((blocker) => blocker === promotedGapBlocker).length, 1);
  ok(!result.pack.lifecycleBlockers.includes(invalidPromotionBlocker));
  equal(result.pack.projectId, "project-billing");
  const admittedGap = result.pack.items.find((item) => item.id === admittedGapId);
  equal(admittedGap?.kind, ContextPackItemKind.SynthesisGapHypothesis);
  ok(!admittedGap?.summary.includes("mutated by promotion policy"));
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.nodeId === "advisory_promotion:synthesis:not-admitted" &&
    item.reason === ContextPackOmissionReason.OutOfScope &&
    item.message.includes("advisory promotion source item was not admitted")
  ));
  ok(result.pack.curationTrace.some((stage) =>
    stage.stage === ContextPackCurationStageKind.AdvisoryPromotion &&
    stage.evidenceRefs.includes(admittedGapId) &&
    stage.evidenceRefs.includes("advisory_promotion:synthesis:not-admitted")
  ));
});

test("default advisory promotion policy leaves omission-grounded gaps advisory without hat approval", async () => {
  const missingOwnerRef = "context_requirement:owner_decision";
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({
          docUnitId: "billing-brd",
          type: DocType.Brd,
          title: "Billing BRD",
          summary: "Recover failed invoices.",
        }),
      ],
      entities: [],
    }),
    completenessPolicy: {
      evaluate: async () => ({
        omittedItemsWithReason: [{
          nodeId: missingOwnerRef,
          reason: ContextPackOmissionReason.NotIndexed,
          message: "owner decision record is not indexed for this blocker",
        }],
      }),
    },
    synthesis: {
      synthesize: async (query) => {
        ok(query.omissions.some((item) => item.nodeId === missingOwnerRef));
        return {
          summary: "Grounded omission gap should be eligible for deterministic promotion.",
          gapHypotheses: [{
            message: "Ownership evidence may be missing from indexed meeting notes.",
            evidenceRefs: ["doc:billing-brd", missingOwnerRef],
            confidence: 0.86,
          }],
          curationEvidenceRefs: ["doc:billing-brd"],
        };
      },
    },
    advisoryPromotionPolicy: createDefaultContextPackAdvisoryPromotionPolicy(),
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));

  const gap = result.pack.items.find((item) => item.id === "synthesis:engineering_director:42:99:gap:0");
  equal(gap?.kind, ContextPackItemKind.SynthesisGapHypothesis);
  ok(gap?.citationRefs?.includes(missingOwnerRef));
  ok(gap?.sourcePointers?.some((pointer) =>
    pointer.kind === ContextPackSourcePointerKind.DocUnit && pointer.docUnitId === "billing-brd"
  ));
  ok(!result.pack.lifecycleBlockers.some((blocker) =>
    blocker.includes("Ownership evidence may be missing from indexed meeting notes")
  ));
  ok(result.pack.curationTrace.some((stage) =>
    stage.stage === ContextPackCurationStageKind.AdvisoryPromotion &&
    stage.summary === "promoted 0 synthesis advisories; omissions=0"
  ));
});

test("default advisory promotion policy promotes only hat-approved matching advisory fingerprints", async () => {
  const missingOwnerRef = "context_requirement:owner_decision";
  const approvedBlocker = "approved blocker: verify billing owner decision before unblocking";
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({
          docUnitId: "billing-brd",
          type: DocType.Brd,
          title: "Billing BRD",
          summary: "Recover failed invoices.",
        }),
      ],
      entities: [],
    }),
    completenessPolicy: {
      evaluate: async () => ({
        omittedItemsWithReason: [{
          nodeId: missingOwnerRef,
          reason: ContextPackOmissionReason.NotIndexed,
          message: "owner decision record is not indexed for this blocker",
        }],
      }),
    },
    synthesis: {
      synthesize: async () => ({
        summary: "Grounded omission gap should be eligible for deterministic promotion.",
        gapHypotheses: [{
          message: "Ownership evidence may be missing from indexed meeting notes.",
          evidenceRefs: ["doc:billing-brd", missingOwnerRef],
          confidence: 0.86,
        }],
        curationEvidenceRefs: ["doc:billing-brd"],
      }),
    },
    advisoryPromotionPolicy: createDefaultContextPackAdvisoryPromotionPolicy({
      decisions: {
        listForPromotion: async (policyRequest) => {
          const gap = policyRequest.advisoryItems.find((item) =>
            item.id === "synthesis:engineering_director:42:99:gap:0"
          );
          if (gap === undefined) return [];
          return [{
            decisionId: "approval-owner-gap",
            status: ContextPackAdvisoryPromotionDecisionStatus.Approved,
            policyVersion: DEFAULT_CONTEXT_PACK_ADVISORY_PROMOTION_POLICY_VERSION,
            lifecycleBlocker: approvedBlocker,
            fingerprint: contextPackAdvisoryPromotionFingerprint(gap),
            evidenceRefs: [missingOwnerRef, "model-only-unadmitted-ref"],
            hatId: "engineering_director",
            hatAssignmentId: "99",
            organizationId: "org-lfg",
            projectId: "project-billing",
            workItemId: "work-billing-blocked",
            curationProfileId: policyRequest.curationPlan?.profileId,
          }];
        },
      },
    }),
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));

  ok(result.pack.lifecycleBlockers.includes(approvedBlocker));
  ok(result.pack.curationTrace.some((stage) =>
    stage.stage === ContextPackCurationStageKind.AdvisoryPromotion &&
    stage.evidenceRefs.includes("synthesis:engineering_director:42:99:gap:0") &&
    stage.evidenceRefs.includes("advisory_promotion_decision:approval-owner-gap") &&
    stage.evidenceRefs.includes(missingOwnerRef) &&
    !stage.evidenceRefs.includes("model-only-unadmitted-ref")
  ));
});

test("deterministic context builder omits synthesis briefings that are not grounded in deterministic evidence", async () => {
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({
          docUnitId: "billing-brd",
          type: DocType.Brd,
          title: "Billing BRD",
          summary: "Recover failed invoices.",
        }),
      ],
      entities: [],
    }),
    synthesis: {
      synthesize: async () => ({
        summary: "Briefing references a missing source.",
        briefing: {
          title: "Ungrounded briefing",
          summary: "A claim with no deterministic citation.",
          evidenceRefs: ["doc:not-in-pack"],
        },
        curationEvidenceRefs: ["doc:billing-brd"],
      }),
    },
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));

  ok(!result.pack.items.some((item) => item.kind === ContextPackItemKind.SynthesisBriefing));
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.reason === ContextPackOmissionReason.RetrievalFailed &&
    item.message.includes("ephemeral synthesis briefing was not grounded")
  ));
});

test("deterministic context builder omits ungrounded structured synthesis advisories", async () => {
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({
          docUnitId: "billing-brd",
          type: DocType.Brd,
          title: "Billing BRD",
          summary: "Recover failed invoices.",
        }),
      ],
      entities: [],
    }),
    synthesis: {
      synthesize: async () => ({
        summary: "Advisory references are not in context.",
        rankedContextRefs: [{
          itemId: "doc:not-in-pack",
          reason: "Missing item should not be promoted.",
          evidenceRefs: ["doc:not-in-pack"],
        }],
        gapHypotheses: [{
          message: "Unsupported gap.",
          evidenceRefs: ["doc:not-in-pack"],
        }],
        questions: [{
          question: "Unsupported question?",
          evidenceRefs: ["doc:not-in-pack"],
        }],
        recommendedActionRefs: [{
          actionType: "meta.escalate",
          direction: "Unsupported action",
          reason: "No deterministic evidence.",
          evidenceRefs: ["doc:not-in-pack"],
        }],
      }),
    },
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));

  ok(!result.pack.items.some((item) =>
    item.kind === ContextPackItemKind.SynthesisRankedContext ||
    item.kind === ContextPackItemKind.SynthesisGapHypothesis ||
    item.kind === ContextPackItemKind.SynthesisQuestion ||
    item.kind === ContextPackItemKind.SynthesisRecommendedAction
  ));
  equal(result.pack.omittedItemsWithReason.filter((item) =>
    item.reason === ContextPackOmissionReason.RetrievalFailed &&
    item.message.includes("ephemeral synthesis advisory was not grounded")
  ).length, 4);
  ok(result.pack.curationTrace.some((stage) =>
    stage.stage === ContextPackCurationStageKind.EphemeralSynthesis &&
    stage.evidenceRefs.includes("retrieval_failed")
  ));
});

test("deterministic context builder omits ranked synthesis advisories targeting missing context items", async () => {
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({
          docUnitId: "billing-brd",
          type: DocType.Brd,
          title: "Billing BRD",
          summary: "Recover failed invoices.",
        }),
      ],
      entities: [],
    }),
    synthesis: {
      synthesize: async () => ({
        summary: "Ranked target must already exist in deterministic context.",
        rankedContextRefs: [{
          itemId: "doc:not-in-pack",
          reason: "A fake ranked target should not enter the director dashboard.",
          evidenceRefs: ["doc:billing-brd"],
        }],
      }),
    },
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));

  ok(!result.pack.items.some((item) => item.kind === ContextPackItemKind.SynthesisRankedContext));
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.reason === ContextPackOmissionReason.RetrievalFailed &&
    item.message.includes("ephemeral synthesis ranked context target was not grounded")
  ));
});

test("deterministic context builder omits synthesis action advisories outside legal observe actions", async () => {
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({
          docUnitId: "billing-brd",
          type: DocType.Brd,
          title: "Billing BRD",
          summary: "Recover failed invoices.",
        }),
      ],
      entities: [],
    }),
    synthesis: {
      synthesize: async () => ({
        summary: "The model asks for an unavailable action.",
        recommendedActionRefs: [{
          actionType: "work.merge",
          reason: "This action is not legal in the current readout.",
          evidenceRefs: ["doc:billing-brd"],
        }],
        curationEvidenceRefs: ["doc:billing-brd"],
      }),
    },
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));

  ok(!result.pack.items.some((item) => item.kind === ContextPackItemKind.SynthesisRecommendedAction));
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.reason === ContextPackOmissionReason.OutOfScope &&
    item.message.includes("synthesis recommended action is not legal")
  ));
});

test("deterministic context builder omits ungrounded synthesis curation evidence refs from the trace", async () => {
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({
          docUnitId: "billing-brd",
          type: DocType.Brd,
          title: "Billing BRD",
          summary: "Recover failed invoices.",
        }),
      ],
      entities: [],
    }),
    synthesis: {
      synthesize: async () => ({
        summary: "Curation evidence should stay replayable.",
        curationEvidenceRefs: ["doc:billing-brd", "doc:not-in-pack"],
      }),
    },
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));
  const synthesisTrace = result.pack.curationTrace.find((stage) =>
    stage.stage === ContextPackCurationStageKind.EphemeralSynthesis
  );

  ok(synthesisTrace?.evidenceRefs.includes("doc:billing-brd"));
  ok(!synthesisTrace?.evidenceRefs.includes("doc:not-in-pack"));
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.nodeId === "synthesis_curation_evidence:doc:not-in-pack" &&
    item.reason === ContextPackOmissionReason.RetrievalFailed &&
    item.message.includes("ephemeral synthesis curation evidence was not grounded")
  ));
});

test("deterministic context builder snapshots deterministic evidence before synthesis can mutate it", async () => {
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({
          docUnitId: "billing-brd",
          type: DocType.Brd,
          title: "Billing BRD",
          summary: "Recover failed invoices.",
        }),
      ],
      entities: [],
    }),
    synthesis: {
      synthesize: async (query) => {
        (query.items as ContextPackItem[]).push({
          id: "doc:synthetic-mutation",
          kind: ContextPackItemKind.Evidence,
          title: "Synthetic mutation",
          summary: "This item was generated by the synthesis adapter.",
          sourceRef: "synthesis:mutation",
          required: true,
          freshness: ContextPackFreshness.Live,
          confidence: 1,
          reasons: ["synthetic mutation"],
          citationRefs: ["doc:synthetic-mutation"],
        });
        return {
          summary: "Mutated evidence should not become deterministic.",
          briefing: {
            title: "Ungrounded mutated briefing",
            summary: "This only cites adapter-mutated context.",
            evidenceRefs: ["doc:synthetic-mutation"],
          },
          curationEvidenceRefs: ["doc:synthetic-mutation"],
        };
      },
    },
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));
  const synthesisTrace = result.pack.curationTrace.find((stage) =>
    stage.stage === ContextPackCurationStageKind.EphemeralSynthesis
  );

  ok(!result.pack.items.some((item) => item.id === "doc:synthetic-mutation"));
  ok(!result.pack.items.some((item) => item.kind === ContextPackItemKind.SynthesisBriefing));
  ok(!synthesisTrace?.evidenceRefs.includes("doc:synthetic-mutation"));
  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.reason === ContextPackOmissionReason.RetrievalFailed &&
    item.message.includes("ephemeral synthesis briefing was not grounded")
  ));
});

test("deterministic context builder gives ranked advisory items collision-safe ids", async () => {
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [
        docUnit({
          docUnitId: "billing-brd",
          type: DocType.Brd,
          title: "Billing BRD",
          summary: "Recover failed invoices.",
        }),
        docUnit({
          docUnitId: "a/b",
          type: DocType.DecisionRecord,
          title: "Billing slash decision",
          summary: "Billing recovery first ranked target.",
        }),
        docUnit({
          docUnitId: "a b",
          type: DocType.DecisionRecord,
          title: "Billing space decision",
          summary: "Billing recovery second ranked target.",
        }),
      ],
      entities: [],
    }),
    synthesis: {
      synthesize: async () => ({
        summary: "Ranked context collision check.",
        rankedContextRefs: [
          { itemId: "doc:a/b", reason: "first", evidenceRefs: ["doc:billing-brd"] },
          { itemId: "doc:a b", reason: "second", evidenceRefs: ["doc:billing-brd"] },
        ],
        curationEvidenceRefs: ["doc:billing-brd"],
      }),
    },
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));
  const rankedIds = result.pack.items
    .filter((item) => item.kind === ContextPackItemKind.SynthesisRankedContext)
    .map((item) => item.id);

  equal(rankedIds.length, 2);
  equal(new Set(rankedIds).size, 2);
});

test("deterministic context builder records optional source failures as omissions instead of throwing", async () => {
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({
      corpus: [docUnit({ docUnitId: "billing-brd", type: DocType.Brd, title: "Billing BRD", summary: "Recover failed invoices." })],
      entities: [],
    }),
    graph: {
      outEdges: async () => {
        throw new Error("graph offline");
      },
      inEdges: async () => [],
    },
    nodeIdForDocUnit: () => "node-billing",
  });

  const result = await builder.build(request({ workItemId: "work-billing-blocked" }));

  equal(result.pack.omittedItemsWithReason[0]?.reason, ContextPackOmissionReason.RetrievalFailed);
  ok(result.pack.omittedItemsWithReason[0]?.message.includes("graph offline"));
});

test("deterministic context builder injects scoped LGTM telemetry evidence before synthesis", async () => {
  const telemetryEvidence: ContextPackTelemetryEvidencePort = {
    load: async (query) => {
      equal(query.request.snapshot.workItemId, "work-billing");
      return {
        items: [{
          id: "telemetry:runtime:trace-billing-timeout",
          kind: ContextPackItemKind.Trace,
          title: "Runtime timeout trace",
          summary: "Tempo trace shows billing timeout across 7 spans.",
          sourceRef: "trace:trace-billing-timeout",
          required: false,
          freshness: ContextPackFreshness.Live,
          confidence: 0.94,
          reasons: ["lgtm:tempo", "telemetry:runtime_incident"],
          citationRefs: ["trace:trace-billing-timeout", "log:loki:billing-timeout", "metric:mimir:latency"],
          sourcePointers: [
            { kind: ContextPackSourcePointerKind.Trace, traceId: "trace-billing-timeout" },
            { kind: ContextPackSourcePointerKind.WorkItem, workItemId: "work-billing" },
          ],
        }],
      };
    },
  };
  const synthesis: ContextPackEphemeralSynthesisPort = {
    synthesize: async (query) => {
      ok(query.items.some((item) => item.id === "telemetry:runtime:trace-billing-timeout"));
      return {
        summary: "Telemetry-aware briefing.",
        briefing: {
          title: "Billing runtime telemetry",
          summary: "Timeout traces are the active runtime signal.",
          evidenceRefs: ["telemetry:runtime:trace-billing-timeout"],
          reasons: ["runtime_telemetry"],
        },
        curationEvidenceRefs: ["telemetry:runtime:trace-billing-timeout"],
      };
    },
  };
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({ corpus: [], entities: [] }),
    telemetryEvidence,
    synthesis,
  });

  const result = await builder.build(request({ scope: RunScope.WorkItem, phase: RunLifecyclePhase.Failed }));

  ok(result.pack.items.some((item) =>
    item.id === "telemetry:runtime:trace-billing-timeout" &&
    item.kind === ContextPackItemKind.Trace &&
    item.sourcePointers?.some((pointer) =>
      pointer.kind === ContextPackSourcePointerKind.Trace &&
      pointer.traceId === "trace-billing-timeout"
    )
  ));
  ok(result.pack.curationTrace.some((stage) =>
    stage.stage === ContextPackCurationStageKind.TelemetryEvidence &&
    stage.evidenceRefs.includes("telemetry:runtime:trace-billing-timeout")
  ));
  ok(result.pack.items.some((item) =>
    item.kind === ContextPackItemKind.SynthesisBriefing &&
    item.sourcePointers?.some((pointer) =>
      pointer.kind === ContextPackSourcePointerKind.Trace &&
      pointer.traceId === "trace-billing-timeout"
    )
  ));
});

test("deterministic context builder records LGTM telemetry evidence failures as omissions", async () => {
  const telemetryEvidence: ContextPackTelemetryEvidencePort = {
    load: async () => {
      throw new Error("tempo unavailable");
    },
  };
  const builder = createDeterministicContextPackBuilder({
    documents: createInMemoryContextPackDocumentPort({ corpus: [], entities: [] }),
    telemetryEvidence,
  });

  const result = await builder.build(request({ scope: RunScope.WorkItem, phase: RunLifecyclePhase.Failed }));

  ok(result.pack.omittedItemsWithReason.some((item) =>
    item.nodeId === "telemetry_evidence" &&
    item.reason === ContextPackOmissionReason.RetrievalFailed &&
    item.message.includes("tempo unavailable")
  ));
  ok(result.pack.curationTrace.some((stage) =>
    stage.stage === ContextPackCurationStageKind.TelemetryEvidence &&
    stage.evidenceRefs.includes("telemetry_evidence")
  ));
});

function request(overrides: Partial<ContextPackBuildRequest["snapshot"]> = {}): ContextPackBuildRequest {
  const snapshot: ContextPackBuildRequest["snapshot"] = {
    runId: asZetaIdDecimal("42"),
    scope: RunScope.Project,
    phase: RunLifecyclePhase.Blocked,
    trace: { correlationId: "corr-1", causationId: "cause-1", traceId: "trace-1" },
    hasGateApproval: false,
    hasEvidence: false,
    hatAssignmentId: asZetaIdDecimal("99"),
    hat: engineeringDirector,
    agentId: "agent-director",
    organizationId: "org-lfg",
    projectId: "project-billing",
    teamId: "team-platform",
    workItemId: "work-billing",
    ...overrides,
  };
  return {
    snapshot,
    readout: {
      runId: asZetaIdDecimal("42"),
      scope: snapshot.scope,
      phase: snapshot.phase,
      trace: { correlationId: "corr-1", causationId: "cause-1", traceId: "trace-1" },
      observedAt,
      options: [
        {
          actionType: "meta.escalate",
          toPhase: RunLifecyclePhase.Blocked,
          toScope: RunScope.Project,
          requiresGate: false,
          requiresEvidence: false,
          rationale: "Escalate blocker to the supervisor chain.",
        },
      ],
      vetoedOptions: [],
      deterministicRulesApplied: [],
    },
    metrics: { scope: snapshot.scope, blocks: [{ id: "blocked.count", label: "blocked count", value: 1 }] },
    promptFlows: { tasks: [], vetoedTasks: [] },
    hierarchy: {
      level: snapshot.hat.level,
      projects: [
        {
          projectId: "project-billing",
          organizationId: "org-lfg",
          departmentId: "eng",
          name: "Billing Platform",
          status: "active",
          trajectory: [],
          metrics: [],
        },
      ],
      initiatives: [
        {
          initiativeId: "init-billing",
          projectId: "project-billing",
          organizationId: "org-lfg",
          title: "Billing recovery",
          status: "active",
          priorityScore: 99,
          metrics: [],
        },
      ],
      metrics: [],
      policyViolations: [],
      priorityScope: "department_initiatives",
      priorityItems: [
        {
          itemId: "work-billing-blocked",
          kind: "work_item",
          label: "Billing blocker",
          scope: RunScope.WorkItem,
          priorityScore: 100,
          metrics: [],
          rationale: "blocked customer billing recovery",
        },
      ],
      scopedMetrics: [],
      actions: [],
      vetoedActions: [],
    },
    observedAt,
  };
}

function actor() {
  return {
    agentId: "agent-director",
    hatAssignmentId: "99",
  };
}

function metadata() {
  return {
    updatedAt: observedAt,
    version: 1,
    correlationId: "corr-anchors",
    causationId: "cause-anchors",
    traceId: "trace-anchors",
  };
}

function discussionAnchor() {
  return {
    discussionAnchorId: "disc-billing-owner",
    organizationId: "org-lfg",
    projectId: "project-billing",
    teamId: "team-platform",
    workItemId: "work-billing-blocked",
    discussionAnchorType: DiscussionAnchorType.WorkItem,
    title: "Billing owner discussion",
    purpose: "Resolve owner for failed invoice recovery.",
    expectedOutputs: [DiscussionExpectedOutput.Decision, DiscussionExpectedOutput.FollowUp],
    createdAt: observedAt,
    createdBy: actor(),
    metadata: metadata(),
  };
}

function decisionRecord() {
  return {
    decisionRecordId: "decision-billing-owner",
    organizationId: "org-lfg",
    projectId: "project-billing",
    teamId: "team-platform",
    workItemId: "work-billing-blocked",
    discussionAnchorId: "disc-billing-owner",
    title: "Billing recovery owner",
    decision: "Platform owns failed invoice recovery.",
    rationale: "Platform already owns billing workflow telemetry and incident response.",
    alternativesConsidered: ["payments team", "support operations"],
    followUpWorkItemIds: ["work-platform-runbook"],
    decidedAt: observedAt,
    decidedBy: actor(),
    metadata: metadata(),
  };
}

function qualityGateEvaluation() {
  return {
    qualityGateEvaluationId: "gate-billing-runtime",
    organizationId: "org-lfg",
    projectId: "project-billing",
    teamId: "team-platform",
    workItemId: "work-billing-blocked",
    discussionAnchorId: "disc-billing-owner",
    gateKind: QualityGateKind.RuntimeValidation,
    outcome: QualityGateOutcome.ChangesRequested,
    summary: "QA reproduced failed invoice recovery after the first patch.",
    evaluatedArtifactIds: ["trace:billing-recovery-fail"],
    businessRuleResults: [],
    evaluatedAt: observedAt,
    evaluatedBy: actor(),
    metadata: metadata(),
  };
}

function workScheduleBlock() {
  return {
    workScheduleBlockId: "schedule-billing-meeting",
    organizationId: "org-lfg",
    projectId: "project-billing",
    teamId: "team-platform",
    workItemId: "work-billing-blocked",
    discussionAnchorId: "disc-billing-owner",
    assignedAgentId: "agent-director",
    assignedHatAssignmentId: "99",
    blockType: ScheduleBlockType.Meeting,
    state: ScheduleBlockState.Active,
    title: "Billing blocker meeting",
    purpose: "Decide how to unblock failed invoice recovery.",
    startsAt: "2026-05-31T00:00:00.000Z",
    endsAt: "2026-05-31T00:30:00.000Z",
    scheduledAt: observedAt,
    scheduledBy: actor(),
    metadata: metadata(),
  };
}

function supervisorSignal() {
  return {
    supervisorSignalId: "signal-billing-blocker",
    organizationId: "org-lfg",
    projectId: "project-billing",
    teamId: "team-platform",
    sourceLevel: SupervisorChainLevel.TeamMember,
    targetLevel: SupervisorChainLevel.Manager,
    targetHatAssignmentId: "99",
    sender: {
      agentId: "agent-implementer",
      hatAssignmentId: "98",
    },
    toolType: SupervisorSignalToolType.ReportBlocker,
    status: SupervisorSignalStatus.Sent,
    title: "Billing recovery remains blocked",
    message: "Runtime validation still reproduces the invoice recovery failure.",
    relatedWorkItemId: "work-billing-blocked",
    createdAt: observedAt,
  };
}

function inboxAnchor(overrides: Partial<ContextPackInboxAnchor> = {}): ContextPackInboxAnchor {
  return {
    inboxAnchorId: "inbox-active-blocker",
    organizationId: "org-lfg",
    projectId: "project-billing",
    teamId: "team-platform",
    workItemId: "work-billing-blocked",
    targetHatAssignmentId: "99",
    targetAgentId: "agent-director",
    title: "Billing blocker inbox",
    summary: "Director wakeup was triggered by a blocker inbox item.",
    priority: ContextPackInboxAnchorPriority.Urgent,
    status: ContextPackInboxAnchorStatus.Unread,
    deliveredAt: observedAt,
    traceId: "trace-inbox-active-blocker",
    ...overrides,
  };
}

function docUnit(overrides: Partial<DocUnit>): DocUnit {
  const id = overrides.docUnitId ?? "doc";
  return {
    docUnitId: id,
    organizationId: "org-lfg",
    sourceId: "source-main",
    type: DocType.Runbook,
    scopeKind: DocScopeKind.Project,
    scopeId: "project-billing",
    title: "Doc",
    summary: "Billing context",
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

function entity(docEntityId: string, canonicalName: string, aliases: readonly string[]): DocEntity {
  return {
    docEntityId,
    organizationId: "org-lfg",
    canonicalName,
    kind: "service",
    aliases,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-30T00:00:00.000Z",
  };
}

function edge(
  fromNodeId: string,
  kind: GraphEdgeKind,
  toNodeId: string,
  confidence: GraphConfidence = GraphConfidence.Extracted,
  changeSetId?: string,
): GraphEdge {
  return {
    edgeId: `${fromNodeId}-${kind}-${toNodeId}`,
    organizationId: "org-lfg",
    fromNodeId,
    toNodeId,
    kind,
    confidence,
    provenance: { source: "test", method: "parse", observedAt },
    ...(changeSetId === undefined ? {} : { changeSetId }),
    createdAt: observedAt,
    updatedAt: observedAt,
    version: 1,
  };
}

function graphStore(edges: readonly GraphEdge[]): GraphStoreReader {
  return {
    outEdges: async (_organizationId, fromNodeId) => edges.filter((candidate) => candidate.fromNodeId === fromNodeId),
    inEdges: async (_organizationId, toNodeId) => edges.filter((candidate) => candidate.toNodeId === toNodeId),
  };
}
