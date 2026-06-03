import type { DocScopeKind, DocType, MemoryPhase, MemoryTier } from "../../domain/src/index.ts";
import type {
  AgentObserveSnapshot,
  HierarchyReadout,
  PromptFlowReadout,
  RunStateReadout,
  RunTrace,
  ScopedReadout,
  ZetaIdDecimal,
} from "./observe.ts";
import type { RunScope } from "./run-scope.ts";

export const ContextPackItemKind = {
  WorkItem: "work_item",
  Initiative: "initiative",
  Project: "project",
  BusinessDocument: "business_document",
  ArchitectureDocument: "architecture_document",
  DecisionRecord: "decision_record",
  Discussion: "discussion",
  InboxAnchor: "inbox_anchor",
  Meeting: "meeting",
  Policy: "policy",
  Evidence: "evidence",
  HatCommunicationBrief: "hat_communication_brief",
  SupervisorSignal: "supervisor_signal",
  GraphNeighborhood: "graph_neighborhood",
  MemoryPointer: "memory_pointer",
  SynthesisBriefing: "synthesis_briefing",
  SynthesisRankedContext: "synthesis_ranked_context",
  SynthesisGapHypothesis: "synthesis_gap_hypothesis",
  SynthesisQuestion: "synthesis_question",
  SynthesisRecommendedAction: "synthesis_recommended_action",
  Trace: "trace",
  PromptFlow: "prompt_flow",
} as const;

export type ContextPackItemKind = (typeof ContextPackItemKind)[keyof typeof ContextPackItemKind];

export const ContextPackStatus = {
  Current: "current",
  Missing: "missing",
  Stale: "stale",
  Incomplete: "incomplete",
  Conflicted: "conflicted",
} as const;

export type ContextPackStatus = (typeof ContextPackStatus)[keyof typeof ContextPackStatus];

export const ContextPackFreshness = {
  Live: "live",
  Current: "current",
  Stale: "stale",
  Archived: "archived",
} as const;

export type ContextPackFreshness = (typeof ContextPackFreshness)[keyof typeof ContextPackFreshness];

export const ContextPackOmissionReason = {
  BuilderUnavailable: "builder_unavailable",
  AccessDenied: "access_denied",
  OutOfScope: "out_of_scope",
  NotIndexed: "not_indexed",
  StaleInput: "stale_input",
  ContradictionUnresolved: "contradiction_unresolved",
  RetrievalFailed: "retrieval_failed",
} as const;

export type ContextPackOmissionReason = (typeof ContextPackOmissionReason)[keyof typeof ContextPackOmissionReason];

export const ContextPackCurationStageKind = {
  DeterministicScope: "deterministic_scope",
  DocumentFocus: "document_focus",
  RequiredConsult: "required_consult",
  LifecycleAnchors: "lifecycle_anchors",
  InboxAnchors: "inbox_anchors",
  TelemetryEvidence: "telemetry_evidence",
  GraphTraversal: "graph_traversal",
  MemoryRecall: "memory_recall",
  EphemeralSynthesis: "ephemeral_synthesis",
  AdvisoryPromotion: "advisory_promotion",
  GapReview: "gap_review",
} as const;

export type ContextPackCurationStageKind = (typeof ContextPackCurationStageKind)[keyof typeof ContextPackCurationStageKind];

export const ContextPackSourcePointerKind = {
  DocUnit: "doc_unit",
  GitBlob: "git_blob",
  GraphNode: "graph_node",
  GraphEdge: "graph_edge",
  HindsightMemory: "hindsight_memory",
  WorkItem: "work_item",
  Decision: "decision",
  Discussion: "discussion",
  InboxAnchor: "inbox_anchor",
  Meeting: "meeting",
  QualityGate: "quality_gate",
  ScheduleBlock: "schedule_block",
  SupervisorSignal: "supervisor_signal",
  Trace: "trace",
  Metric: "metric",
  Log: "log",
  Policy: "policy",
} as const;

export type ContextPackSourcePointerKind = (typeof ContextPackSourcePointerKind)[keyof typeof ContextPackSourcePointerKind];

export const ContextPackMemorySimilarityCategory = {
  SameHatSameWorkItem: "same_hat_same_work_item",
  SameWorkItem: "same_work_item",
  SameHatDifferentWorkItem: "same_hat_different_work_item",
  SameProjectDifferentWorkItem: "same_project_different_work_item",
  ProjectScoped: "project_scoped",
  CrossProject: "cross_project",
} as const;

export type ContextPackMemorySimilarityCategory =
  (typeof ContextPackMemorySimilarityCategory)[keyof typeof ContextPackMemorySimilarityCategory];

export type ContextPackMemoryGovernanceOutcome = {
  successCount: number;
  failureCount: number;
  inconclusiveCount: number;
};

export type ContextPackMemoryGovernanceUtility = {
  injectedCount: number;
  citedCount: number;
};

export type ContextPackMemoryGovernanceExplanation = {
  tier: MemoryTier;
  phase: MemoryPhase;
  scope: string;
  weight: number;
  readFloor: number;
  freshnessAt: string;
  outcome: ContextPackMemoryGovernanceOutcome;
  utility: ContextPackMemoryGovernanceUtility;
};

export type ContextPackSourcePointer =
  | {
      kind: typeof ContextPackSourcePointerKind.DocUnit;
      docUnitId: string;
      organizationId?: string | undefined;
      docType?: DocType | undefined;
      scopeKind?: DocScopeKind | undefined;
      scopeId?: string | undefined;
      contentRef: string;
      contentHash: string;
      sourceId: string;
      version: number;
      provenanceChangeSetId?: string | undefined;
    }
  | {
      kind: typeof ContextPackSourcePointerKind.GitBlob;
      path: string;
      commitSha?: string | undefined;
      blobSha?: string | undefined;
    }
  | {
      kind: typeof ContextPackSourcePointerKind.GraphNode;
      nodeId: string;
      graphVersion?: string | undefined;
    }
  | {
      kind: typeof ContextPackSourcePointerKind.GraphEdge;
      edgeId: string;
      fromNodeId: string;
      toNodeId: string;
      graphVersion?: string | undefined;
    }
  | {
      kind: typeof ContextPackSourcePointerKind.HindsightMemory;
      providerId: string;
      memoryId: string;
      creatingAgentId?: string | undefined;
      creatingHatAssignmentId?: string | undefined;
      creatingProjectId?: string | undefined;
      creatingWorkItemId?: string | undefined;
      creatingPromptFlowRunId?: string | undefined;
      recallAgentId?: string | undefined;
      recallHatAssignmentId?: string | undefined;
      recallProjectId?: string | undefined;
      recallWorkItemId?: string | undefined;
      recallQueryId?: string | undefined;
      similarityCategory?: ContextPackMemorySimilarityCategory | undefined;
      governance?: ContextPackMemoryGovernanceExplanation | undefined;
      advisory: boolean;
    }
  | { kind: typeof ContextPackSourcePointerKind.WorkItem; workItemId: string }
  | { kind: typeof ContextPackSourcePointerKind.Decision; decisionId: string }
  | { kind: typeof ContextPackSourcePointerKind.Discussion; discussionId: string }
  | {
      kind: typeof ContextPackSourcePointerKind.InboxAnchor;
      inboxAnchorId: string;
      targetHatAssignmentId?: string | undefined;
      targetAgentId?: string | undefined;
    }
  | {
      kind: typeof ContextPackSourcePointerKind.Meeting;
      meetingId: string;
      workScheduleBlockId?: string | undefined;
      discussionAnchorId?: string | undefined;
    }
  | { kind: typeof ContextPackSourcePointerKind.QualityGate; qualityGateEvaluationId: string }
  | {
      kind: typeof ContextPackSourcePointerKind.ScheduleBlock;
      workScheduleBlockId: string;
      assignedHatAssignmentId?: string | undefined;
      assignedAgentId?: string | undefined;
    }
  | {
      kind: typeof ContextPackSourcePointerKind.SupervisorSignal;
      supervisorSignalId: string;
      targetHatAssignmentId?: string | undefined;
    }
  | { kind: typeof ContextPackSourcePointerKind.Trace; traceId: string }
  | { kind: typeof ContextPackSourcePointerKind.Metric; source: string; query: string; seriesId?: string | undefined }
  | { kind: typeof ContextPackSourcePointerKind.Log; source: string; query: string; logRef: string }
  | { kind: typeof ContextPackSourcePointerKind.Policy; policyId: string; version?: string | undefined };

export type ContextPackDrillTarget = {
  targetKind: ContextPackSourcePointerKind;
  targetId: string;
  routeRef: string;
  label: string;
  sourcePointer: ContextPackSourcePointer;
  governance?: ContextPackMemoryGovernanceExplanation | undefined;
};

export type ContextPackDrillTargetGroup = {
  itemId: string;
  itemKind: ContextPackItemKind;
  itemTitle: string;
  targets: readonly ContextPackDrillTarget[];
};

export const ContextPackConfidenceBasisKind = {
  CitedEvidenceCeiling: "cited_evidence_ceiling",
} as const;

export type ContextPackConfidenceBasisKind =
  (typeof ContextPackConfidenceBasisKind)[keyof typeof ContextPackConfidenceBasisKind];

export const ContextPackUncertaintySignalKind = {
  StaleEvidence: "stale_evidence",
  ConflictingEvidence: "conflicting_evidence",
  LowConfidenceEvidence: "low_confidence_evidence",
  IndirectEvidence: "indirect_evidence",
} as const;

export type ContextPackUncertaintySignalKind =
  (typeof ContextPackUncertaintySignalKind)[keyof typeof ContextPackUncertaintySignalKind];

export const ContextPackUncertaintySeverity = {
  Low: "low",
  Medium: "medium",
  High: "high",
} as const;

export type ContextPackUncertaintySeverity =
  (typeof ContextPackUncertaintySeverity)[keyof typeof ContextPackUncertaintySeverity];

export type ContextPackUncertaintySignal = {
  kind: ContextPackUncertaintySignalKind;
  severity: ContextPackUncertaintySeverity;
  evidenceRefs: readonly string[];
  message: string;
};

export type ContextPackUncertaintyGroup = {
  kind: ContextPackUncertaintySignalKind;
  severity: ContextPackUncertaintySeverity;
  count: number;
  evidenceRefs: readonly string[];
  messages: readonly string[];
};

export type ContextPackUncertaintySummary = {
  signalCount: number;
  highSeverityCount: number;
  mediumSeverityCount: number;
  lowSeverityCount: number;
  groups: readonly ContextPackUncertaintyGroup[];
  highestSeverity?: ContextPackUncertaintySeverity | undefined;
};

export type ContextPackConfidenceBasis = {
  kind: typeof ContextPackConfidenceBasisKind.CitedEvidenceCeiling;
  evidenceConfidenceCeiling: number;
  citedEvidenceRefs: readonly string[];
  modelConfidence?: number | undefined;
  uncertaintyExplanation?: string | undefined;
  uncertaintySignals?: readonly ContextPackUncertaintySignal[] | undefined;
};

export type ContextPackItem = {
  id: string;
  kind: ContextPackItemKind;
  title: string;
  summary: string;
  sourceRef: string;
  required: boolean;
  freshness: ContextPackFreshness;
  confidence: number;
  confidenceBasis?: ContextPackConfidenceBasis | undefined;
  reasons: readonly string[];
  citationRefs?: readonly string[] | undefined;
  sourcePointers?: readonly ContextPackSourcePointer[] | undefined;
};

export type ContextPackOmittedItem = {
  nodeId?: string | undefined;
  reason: ContextPackOmissionReason;
  message: string;
};

export type ContextPackCurationStage = {
  stage: ContextPackCurationStageKind;
  summary: string;
  evidenceRefs: readonly string[];
};

export const ContextPackAttentionLaneKind = {
  Authority: "authority",
  ActiveWork: "active_work",
  RequiredDocuments: "required_documents",
  GraphNeighborhood: "graph_neighborhood",
  Memory: "memory",
  Omissions: "omissions",
  LegalActions: "legal_actions",
} as const;

export type ContextPackAttentionLaneKind =
  (typeof ContextPackAttentionLaneKind)[keyof typeof ContextPackAttentionLaneKind];

export const ContextPackAttentionLaneRefKind = {
  Item: "item",
  Omission: "omission",
  LegalAction: "legal_action",
  ScopeAnchor: "scope_anchor",
} as const;

export type ContextPackAttentionLaneRefKind =
  (typeof ContextPackAttentionLaneRefKind)[keyof typeof ContextPackAttentionLaneRefKind];

export type ContextPackAttentionLaneRef =
  | { kind: typeof ContextPackAttentionLaneRefKind.Item; itemId: string }
  | { kind: typeof ContextPackAttentionLaneRefKind.Omission; omissionRef: string }
  | { kind: typeof ContextPackAttentionLaneRefKind.LegalAction; actionType: string }
  | { kind: typeof ContextPackAttentionLaneRefKind.ScopeAnchor; anchorRef: string };

export type ContextPackAttentionLane = {
  kind: ContextPackAttentionLaneKind;
  priority: number;
  objective: string;
  required: boolean;
  refs: readonly ContextPackAttentionLaneRef[];
};

export type ContextPackCurationPlan = {
  profileId?: string | undefined;
  policyVersion?: string | undefined;
  lanes: readonly ContextPackAttentionLane[];
  deterministicInstructions: readonly string[];
  requiredStages?: readonly ContextPackCurationStageKind[] | undefined;
};

export type ContextPack = {
  id: string;
  runId: ZetaIdDecimal;
  scope: RunScope;
  hatAssignmentId: ZetaIdDecimal;
  hatId: string;
  generatedAt: string;
  freshnessDeadline: string;
  sourceGraphVersion: string;
  policyVersion: string;
  tokenBudget: number;
  items: readonly ContextPackItem[];
  omittedItemsWithReason: readonly ContextPackOmittedItem[];
  contradictions: readonly string[];
  staleInputs: readonly string[];
  lifecycleBlockers: readonly string[];
  uncertaintySignals?: readonly ContextPackUncertaintySignal[] | undefined;
  curationTrace: readonly ContextPackCurationStage[];
  curationPlan?: ContextPackCurationPlan | undefined;
  agentId?: string | undefined;
  organizationId?: string | undefined;
  projectId?: string | undefined;
  teamId?: string | undefined;
  workItemId?: string | undefined;
};

export type ContextPackSummary = {
  requiredItemCount: number;
  optionalItemCount: number;
  omissionCount: number;
  contradictionCount: number;
  staleInputCount: number;
  lifecycleBlockerCount: number;
  uncertaintySignalCount: number;
};

export type ContextReadout = {
  status: ContextPackStatus;
  pack: ContextPack;
  requiredItems: readonly ContextPackItem[];
  optionalItems: readonly ContextPackItem[];
  omittedItemsWithReason: readonly ContextPackOmittedItem[];
  contradictions: readonly string[];
  staleInputs: readonly string[];
  lifecycleBlockers: readonly string[];
  uncertainty: ContextPackUncertaintySummary;
  drillTargetGroups: readonly ContextPackDrillTargetGroup[];
  summary: ContextPackSummary;
};

export type QueryContext = {
  runId: ZetaIdDecimal;
  scope: RunScope;
  hatAssignmentId: ZetaIdDecimal;
  trace: RunTrace;
};

export type ContextPackBuildRequest = {
  snapshot: AgentObserveSnapshot;
  readout: RunStateReadout;
  metrics: ScopedReadout;
  promptFlows: PromptFlowReadout;
  hierarchy: HierarchyReadout;
  observedAt: string;
  wakeContext?: ContextPackWakeContext | undefined;
};

export type ContextPackWakeContext = {
  reason: string;
  requiresBuild: boolean;
  previousContextPackId?: string | undefined;
  previousStatus?: ContextPackStatus | undefined;
  previousRecordedAt?: string | undefined;
  previousGeneratedAt?: string | undefined;
};

export type ContextPackBuildResult = {
  pack: ContextPack;
};

export type ContextPackBuilderPort = {
  build: (request: ContextPackBuildRequest) => Promise<ContextPackBuildResult>;
};
