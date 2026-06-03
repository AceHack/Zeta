import {
  DocScopeKind,
  DocType,
  ContextPackInboxAnchorPriority,
  ContextPackInboxAnchorStatus,
  DepartmentId,
  DefaultTeamMemberSupervisorTools,
  GraphNodeKind,
  HatLevel,
  ToolBundle,
  ScheduleBlockType,
  SupervisorChainLevel,
  buildHatCommunicationBrief,
  graphNodeId,
  isActiveConfidence,
  isLoadBearing,
  type DecisionRecord,
  type DiscussionAnchor,
  type DocEntity,
  type DocUnit,
  type GraphEdge,
  type HatCommunicationBrief,
  type HatDefinition,
  type ContextPackInboxAnchor,
  type QualityGateEvaluation,
  type SupervisorSignal,
  type SupervisorSignalToolBrief,
  type WorkScheduleBlock,
} from "../../domain/src/index.ts";
export {
  ContextPackInboxAnchorPriority,
  ContextPackInboxAnchorStatus,
  type ContextPackInboxAnchor,
} from "../../domain/src/index.ts";
import { buildHatDefinitions } from "./org-seed.ts";
import {
  deriveNeighborhood,
  type GraphStoreReader,
} from "./knowledge-graph-intelligence.ts";
import {
  runRetrieval,
  type RetrievalContext,
  type RetrievalDeps,
  type RetrievalResult,
} from "./document-retrieval.ts";
import { activeGraphRootNodeIdsForSnapshot } from "./context-pack-scope-evaluator.ts";
import {
  admitContextPackAdvisoryPromotions,
  type ContextPackAdvisoryPromotionPolicyPort,
} from "./context-pack-advisory-promotion-policy.ts";
import {
  ContextPackCurationStageKind,
  ContextPackAttentionLaneKind,
  ContextPackConfidenceBasisKind,
  ContextPackFreshness,
  ContextPackItemKind,
  ContextPackOmissionReason,
  ContextPackSourcePointerKind,
  ContextPackUncertaintySeverity,
  ContextPackUncertaintySignalKind,
  RunLifecyclePhase,
  RunScope,
  type AgentObserveSnapshot,
  type AvailableOption,
  type ContextPack,
  type ContextPackAttentionLane,
  type ContextPackAttentionLaneKind as ContextPackAttentionLaneKindType,
  ContextPackAttentionLaneRefKind,
  type ContextPackAttentionLaneRef,
  type ContextPackBuildRequest,
  type ContextPackBuilderPort,
  type ContextPackConfidenceBasis,
  type ContextPackCurationStage,
  type ContextPackCurationPlan,
  type ContextPackItem,
  type ContextPackMemoryGovernanceExplanation,
  type ContextPackMemorySimilarityCategory,
  type ContextPackOmittedItem,
  type ContextPackSourcePointer,
  type ContextPackUncertaintySignal,
  type HierarchyReadout,
} from "./observe.ts";

export type ContextPackDocumentReadRequest = {
  query: string;
  retrievalContext: RetrievalContext;
  observedAt: string;
};

export type ContextPackDocumentReadResult = {
  retrieval: RetrievalResult;
  sourceGraphVersion: string;
};

export type ContextPackDocumentReadPort = {
  retrieve: (request: ContextPackDocumentReadRequest) => Promise<ContextPackDocumentReadResult>;
};

export type ContextPackDocumentFocusRequest = {
  request: ContextPackBuildRequest;
};

export type ContextPackDocumentFocus = {
  profileId: string;
  policyVersion: string;
  queryTerms: readonly string[];
  preferredDocTypes: readonly DocType[];
};

export type ContextPackDocumentFocusPolicyPort = {
  resolve: (request: ContextPackDocumentFocusRequest) =>
    Promise<ContextPackDocumentFocus> | ContextPackDocumentFocus;
};

export type ContextPackCurationIntentRequest = {
  request: ContextPackBuildRequest;
};

export type ContextPackCurationIntent = {
  documentFocus: ContextPackDocumentFocus;
  curationProfile: ContextPackCurationProfile;
};

export type ContextPackCurationIntentPolicyPort = {
  resolve: (request: ContextPackCurationIntentRequest) =>
    Promise<ContextPackCurationIntent> | ContextPackCurationIntent;
};

export type CreateInMemoryContextPackDocumentPortInput = {
  corpus: readonly DocUnit[];
  entities: readonly DocEntity[];
  retrievalDeps?: RetrievalDeps | undefined;
  sourceGraphVersion?: string | undefined;
};

export type ContextPackMemoryRecallRequest = {
  query: string;
  runId: string;
  observedAt: string;
  hatId: string;
  hatAssignmentId: string;
  agentId?: string | undefined;
  organizationId?: string | undefined;
  projectId?: string | undefined;
  teamId?: string | undefined;
  workItemId?: string | undefined;
};

export type ContextPackMemoryRecall = {
  memoryId: string;
  providerId: string;
  summary: string;
  confidence: number;
  retainedAt: string;
  advisory: boolean;
  reasons: readonly string[];
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
};

export type ContextPackMemoryRecallResult = {
  memories: readonly ContextPackMemoryRecall[];
  omittedItemsWithReason?: readonly ContextPackOmittedItem[] | undefined;
};

export type ContextPackMemoryRecallPort = {
  recall: (request: ContextPackMemoryRecallRequest) => Promise<ContextPackMemoryRecallResult>;
};

export type ContextPackEphemeralSynthesisRequest = {
  query: string;
  observedAt: string;
  hatId: string;
  hatLevel: HatLevel;
  scope: RunScope;
  phase: RunLifecyclePhase;
  agentId?: string | undefined;
  organizationId?: string | undefined;
  projectId?: string | undefined;
  teamId?: string | undefined;
  workItemId?: string | undefined;
  wakeContext?: ContextPackBuildRequest["wakeContext"] | undefined;
  legalActions: readonly ContextPackLegalActionRef[];
  curationPlan: ContextPackCurationPlan;
  items: readonly ContextPackItem[];
  omissions: readonly ContextPackOmittedItem[];
  contradictions: readonly string[];
  uncertaintySignals: readonly ContextPackUncertaintySignal[];
};

export type ContextPackLegalActionRef = Pick<AvailableOption, "actionType" | "toPhase" | "toScope" | "rationale">;

export type ContextPackEphemeralSynthesisBriefing = {
  title: string;
  summary: string;
  evidenceRefs: readonly string[];
  confidence?: number | undefined;
  uncertaintyExplanation?: string | undefined;
  reasons?: readonly string[] | undefined;
};

export type ContextPackEphemeralRankedContextRef = {
  itemId: string;
  reason: string;
  evidenceRefs: readonly string[];
  uncertaintyExplanation?: string | undefined;
};

export type ContextPackEphemeralGapHypothesis = {
  message: string;
  evidenceRefs: readonly string[];
  suggestedNextStep?: string | undefined;
  confidence?: number | undefined;
  uncertaintyExplanation?: string | undefined;
};

export type ContextPackEphemeralQuestion = {
  question: string;
  evidenceRefs: readonly string[];
  audienceHatLevel?: HatLevel | undefined;
  uncertaintyExplanation?: string | undefined;
};

export type ContextPackEphemeralRecommendedActionRef = {
  actionType: string;
  direction?: string | undefined;
  reason: string;
  evidenceRefs: readonly string[];
  uncertaintyExplanation?: string | undefined;
};

export type ContextPackEphemeralSynthesisResult = {
  summary: string;
  briefing?: ContextPackEphemeralSynthesisBriefing | undefined;
  rankedContextRefs?: readonly ContextPackEphemeralRankedContextRef[] | undefined;
  gapHypotheses?: readonly ContextPackEphemeralGapHypothesis[] | undefined;
  questions?: readonly ContextPackEphemeralQuestion[] | undefined;
  recommendedActionRefs?: readonly ContextPackEphemeralRecommendedActionRef[] | undefined;
  curationEvidenceRefs?: readonly string[] | undefined;
};

export type ContextPackEphemeralSynthesisPort = {
  synthesize: (request: ContextPackEphemeralSynthesisRequest) => Promise<ContextPackEphemeralSynthesisResult>;
};

export type ContextPackHatCommunicationBriefRequest = {
  observedAt: string;
  request: ContextPackBuildRequest;
};

export type ContextPackHatCommunicationBriefResult = {
  brief: HatCommunicationBrief;
  sourcePointers: readonly ContextPackSourcePointer[];
  citationRefs: readonly string[];
  policyVersion: string;
};

export type ContextPackHatCommunicationBriefPort = {
  build: (request: ContextPackHatCommunicationBriefRequest) =>
    Promise<ContextPackHatCommunicationBriefResult> | ContextPackHatCommunicationBriefResult;
};

export type ContextPackLifecycleAnchorRequest = {
  query: string;
  observedAt: string;
  request: ContextPackBuildRequest;
};

export type ContextPackLifecycleAnchorResult = {
  items: readonly ContextPackItem[];
  graphRootSeeds?: readonly ContextPackGraphRootSeed[] | undefined;
  omittedItemsWithReason?: readonly ContextPackOmittedItem[] | undefined;
};

export type ContextPackLifecycleAnchorPort = {
  load: (request: ContextPackLifecycleAnchorRequest) =>
    Promise<ContextPackLifecycleAnchorResult> | ContextPackLifecycleAnchorResult;
};

export type ContextPackInboxAnchorRequest = {
  query: string;
  observedAt: string;
  request: ContextPackBuildRequest;
};

export type ContextPackInboxAnchorResult = {
  items: readonly ContextPackItem[];
  graphRootSeeds?: readonly ContextPackGraphRootSeed[] | undefined;
  omittedItemsWithReason?: readonly ContextPackOmittedItem[] | undefined;
};

export type ContextPackInboxAnchorPort = {
  load: (request: ContextPackInboxAnchorRequest) =>
    Promise<ContextPackInboxAnchorResult> | ContextPackInboxAnchorResult;
};

export type CreateInMemoryContextPackLifecycleAnchorPortInput = {
  discussionAnchors?: readonly DiscussionAnchor[] | undefined;
  decisionRecords?: readonly DecisionRecord[] | undefined;
  qualityGateEvaluations?: readonly QualityGateEvaluation[] | undefined;
  workScheduleBlocks?: readonly WorkScheduleBlock[] | undefined;
  supervisorSignals?: readonly SupervisorSignal[] | undefined;
};

export type CreateInMemoryContextPackInboxAnchorPortInput = {
  inboxAnchors: readonly ContextPackInboxAnchor[];
};

export type CreateDefaultContextPackHatCommunicationBriefPortInput = {
  hats?: readonly HatDefinition[] | undefined;
};

export type ContextPackCompletenessPolicyRequest = {
  query: string;
  observedAt: string;
  request: ContextPackBuildRequest;
  documentUnits: readonly DocUnit[];
  items: readonly ContextPackItem[];
};

export type ContextPackCompletenessPolicyResult = {
  omittedItemsWithReason: readonly ContextPackOmittedItem[];
  lifecycleBlockers?: readonly string[] | undefined;
  evidenceRefs?: readonly string[] | undefined;
};

export type ContextPackCompletenessPolicyPort = {
  evaluate: (request: ContextPackCompletenessPolicyRequest) =>
    Promise<ContextPackCompletenessPolicyResult> | ContextPackCompletenessPolicyResult;
};

export type ContextPackCurationProfileRequest = {
  request: ContextPackBuildRequest;
  items: readonly ContextPackItem[];
  omissions: readonly ContextPackOmittedItem[];
};

export type ContextPackCurationProfile = {
  profileId: string;
  policyVersion: string;
  lanePriorityOverrides?: Partial<Record<ContextPackAttentionLaneKindType, number>> | undefined;
  requiredLanes?: readonly ContextPackAttentionLaneKindType[] | undefined;
  deterministicInstructions?: readonly string[] | undefined;
};

export type ContextPackCurationProfileDescriptor = {
  profileId: ContextPackCurationProfileId;
  policyVersion: string;
  documentFocus: ContextPackDocumentFocus;
  deterministicInstructions: readonly ContextPackCurationProfileInstruction[];
};

export type ContextPackAttentionLaneDescriptor = {
  kind: ContextPackAttentionLaneKindType;
  defaultPriority: number;
  defaultRequired: boolean;
  objective: string;
};

export type ContextPackCurationProfilePolicyPort = {
  resolve: (request: ContextPackCurationProfileRequest) =>
    Promise<ContextPackCurationProfile> | ContextPackCurationProfile;
};

export const ContextPackSynthesisRequirementDecision = {
  Required: "required",
  Optional: "optional",
} as const;

export type ContextPackSynthesisRequirementDecision =
  (typeof ContextPackSynthesisRequirementDecision)[keyof typeof ContextPackSynthesisRequirementDecision];

export const ContextPackSynthesisRequirementReason = {
  WakeRequestedContextBuild: "wake_requested_context_build",
  BlockedManagementContext: "blocked_management_context",
  DeterministicOnlyAllowed: "deterministic_only_allowed",
  TenantRequiresModelBriefing: "tenant_requires_model_briefing",
  TenantRequiresHighStakesReviewBriefing: "tenant_requires_high_stakes_review_briefing",
  TenantRequiresResourceAllocationBriefing: "tenant_requires_resource_allocation_briefing",
  TenantRequiresPriorityChangeBriefing: "tenant_requires_priority_change_briefing",
  TenantRequiresArchitectureTradeoffBriefing: "tenant_requires_architecture_tradeoff_briefing",
  TenantRequiresReleaseReadinessBriefing: "tenant_requires_release_readiness_briefing",
  TenantRequiresSecurityExceptionBriefing: "tenant_requires_security_exception_briefing",
  TenantRequiresCustomerScopeBriefing: "tenant_requires_customer_scope_briefing",
  TenantRequiresRuntimeOperationsBriefing: "tenant_requires_runtime_operations_briefing",
} as const;

export type ContextPackSynthesisRequirementReason =
  (typeof ContextPackSynthesisRequirementReason)[keyof typeof ContextPackSynthesisRequirementReason];

export type ContextPackSynthesisRequirementPolicyRequest = {
  request: ContextPackBuildRequest;
  curationPlan: ContextPackCurationPlan;
  items: readonly ContextPackItem[];
  omissions: readonly ContextPackOmittedItem[];
};

export type ContextPackSynthesisRequirement = {
  decision: ContextPackSynthesisRequirementDecision;
  reason: ContextPackSynthesisRequirementReason;
  policyVersion: string;
};

export type ContextPackSynthesisRequirementPolicyPort = {
  evaluate: (request: ContextPackSynthesisRequirementPolicyRequest) =>
    Promise<ContextPackSynthesisRequirement> | ContextPackSynthesisRequirement;
};

type ContextPackActiveHatCurationPolicy = {
  focusProfileId: ContextPackDocumentFocusProfileId;
  curationProfileId: ContextPackCurationProfileId;
  queryTerms: readonly string[];
  preferredDocTypes: readonly DocType[];
  lanePriorityOverrides: Partial<Record<ContextPackAttentionLaneKindType, number>>;
  requiredLanes?: readonly ContextPackAttentionLaneKindType[] | undefined;
  deterministicInstructions: readonly ContextPackCurationProfileInstruction[];
};

export type ContextPackCompletenessCandidate = {
  item: ContextPackItem;
  documentUnit?: DocUnit | undefined;
  sourcePointers: readonly ContextPackSourcePointer[];
};

export type ContextPackCompletenessRequirement = {
  id: string;
  itemKind: ContextPackItemKind;
  message: string;
  evidenceRef: string;
  appliesTo: (request: ContextPackCompletenessPolicyRequest) => boolean;
  isSatisfiedBy?: ((
    candidate: ContextPackCompletenessCandidate,
    request: ContextPackCompletenessPolicyRequest,
  ) => boolean) | undefined;
};

export type ContextPackGraphRootSeed = {
  nodeId: string;
  title?: string | undefined;
  citationRefs?: readonly string[] | undefined;
  reasons?: readonly string[] | undefined;
};

export type ContextPackTelemetryEvidenceRequest = {
  query: string;
  observedAt: string;
  request: ContextPackBuildRequest;
  items: readonly ContextPackItem[];
};

export type ContextPackTelemetryEvidenceResult = {
  items: readonly ContextPackItem[];
  omittedItemsWithReason?: readonly ContextPackOmittedItem[] | undefined;
  graphRootSeeds?: readonly ContextPackGraphRootSeed[] | undefined;
};

export type ContextPackTelemetryEvidencePort = {
  load: (
    request: ContextPackTelemetryEvidenceRequest,
  ) => Promise<ContextPackTelemetryEvidenceResult> | ContextPackTelemetryEvidenceResult;
};

export type CreateDeterministicContextPackBuilderInput = {
  documents: ContextPackDocumentReadPort;
  graph?: GraphStoreReader | undefined;
  memory?: ContextPackMemoryRecallPort | undefined;
  telemetryEvidence?: ContextPackTelemetryEvidencePort | undefined;
  synthesis?: ContextPackEphemeralSynthesisPort | undefined;
  inboxAnchors?: ContextPackInboxAnchorPort | undefined;
  lifecycleAnchors?: ContextPackLifecycleAnchorPort | undefined;
  hatCommunicationBrief?: ContextPackHatCommunicationBriefPort | undefined;
  curationIntentPolicy?: ContextPackCurationIntentPolicyPort | undefined;
  documentFocusPolicy?: ContextPackDocumentFocusPolicyPort | undefined;
  completenessPolicy?: ContextPackCompletenessPolicyPort | undefined;
  curationProfilePolicy?: ContextPackCurationProfilePolicyPort | undefined;
  synthesisRequirementPolicy?: ContextPackSynthesisRequirementPolicyPort | undefined;
  advisoryPromotionPolicy?: ContextPackAdvisoryPromotionPolicyPort | undefined;
  nodeIdForDocUnit?: ((unit: DocUnit) => string | null) | undefined;
  graphRootNodeIds?: ((request: ContextPackBuildRequest) => readonly string[]) | undefined;
  graphRootSeeds?: ((request: ContextPackBuildRequest) => readonly ContextPackGraphRootSeed[]) | undefined;
  policyVersion?: string | undefined;
  tokenBudget?: number | undefined;
  freshnessWindowMs?: number | undefined;
};

const DEFAULT_CONTEXT_PACK_POLICY_VERSION = "context-pack-builder:v1";
const DEFAULT_CONTEXT_PACK_TOKEN_BUDGET = 4096;
const DEFAULT_CONTEXT_PACK_FRESHNESS_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_IN_MEMORY_SOURCE_GRAPH_VERSION = "in-memory-documents";
export const DEFAULT_CONTEXT_PACK_DOCUMENT_FOCUS_POLICY_VERSION = "context-pack-document-focus:v1";
export const DEFAULT_CONTEXT_PACK_CURATION_PROFILE_POLICY_VERSION = "context-pack-curation-profile:v1";
export const DEFAULT_CONTEXT_PACK_SYNTHESIS_REQUIREMENT_POLICY_VERSION = "context-pack-synthesis-requirement:v1";
const CURATION_INTENT_NODE_ID = "context_pack_curation_intent";
const DOCUMENT_FOCUS_NODE_ID = "context_pack_document_focus";
const REQUIRED_CONTEXT_PACK_CURATION_LANE_NODE_ID_PREFIX = "required_curation_lane";
const REQUIRED_SYNTHESIS_UNAVAILABLE_NODE_ID = "ephemeral_synthesis:required_unavailable";
const DOCUMENT_RETRIEVAL_FAILED_MESSAGE = "document context retrieval failed";
const CURATION_INTENT_FAILED_MESSAGE = "context pack curation intent retrieval failed";
const DOCUMENT_FOCUS_POLICY_FAILED_MESSAGE = "document context focus policy failed";
const GRAPH_RETRIEVAL_FAILED_MESSAGE = "graph context retrieval failed";
const MEMORY_RETRIEVAL_FAILED_MESSAGE = "memory context retrieval failed";
const TELEMETRY_EVIDENCE_RETRIEVAL_FAILED_MESSAGE = "telemetry evidence retrieval failed";
const LIFECYCLE_ANCHOR_RETRIEVAL_FAILED_MESSAGE = "lifecycle anchor retrieval failed";
const INBOX_ANCHOR_RETRIEVAL_FAILED_MESSAGE = "inbox anchor retrieval failed";
const SYNTHESIS_FAILED_MESSAGE = "ephemeral synthesis failed";
const REQUIRED_SYNTHESIS_UNAVAILABLE_MESSAGE_BY_REASON = {
  [ContextPackSynthesisRequirementReason.WakeRequestedContextBuild]:
    "ephemeral synthesis is required for wake-requested context build but no synthesis adapter is configured",
  [ContextPackSynthesisRequirementReason.BlockedManagementContext]:
    "ephemeral synthesis is required for blocked management context but no synthesis adapter is configured",
  [ContextPackSynthesisRequirementReason.DeterministicOnlyAllowed]:
    "ephemeral synthesis is optional under deterministic-only policy but no synthesis adapter is configured",
  [ContextPackSynthesisRequirementReason.TenantRequiresModelBriefing]:
    "ephemeral synthesis is required by tenant model-briefing policy but no synthesis adapter is configured",
  [ContextPackSynthesisRequirementReason.TenantRequiresHighStakesReviewBriefing]:
    "ephemeral synthesis is required by tenant high-stakes review policy but no synthesis adapter is configured",
  [ContextPackSynthesisRequirementReason.TenantRequiresResourceAllocationBriefing]:
    "ephemeral synthesis is required by tenant resource-allocation policy but no synthesis adapter is configured",
  [ContextPackSynthesisRequirementReason.TenantRequiresPriorityChangeBriefing]:
    "ephemeral synthesis is required by tenant priority-change policy but no synthesis adapter is configured",
  [ContextPackSynthesisRequirementReason.TenantRequiresArchitectureTradeoffBriefing]:
    "ephemeral synthesis is required by tenant architecture-tradeoff policy but no synthesis adapter is configured",
  [ContextPackSynthesisRequirementReason.TenantRequiresReleaseReadinessBriefing]:
    "ephemeral synthesis is required by tenant release-readiness policy but no synthesis adapter is configured",
  [ContextPackSynthesisRequirementReason.TenantRequiresSecurityExceptionBriefing]:
    "ephemeral synthesis is required by tenant security-exception policy but no synthesis adapter is configured",
  [ContextPackSynthesisRequirementReason.TenantRequiresCustomerScopeBriefing]:
    "ephemeral synthesis is required by tenant customer-scope policy but no synthesis adapter is configured",
  [ContextPackSynthesisRequirementReason.TenantRequiresRuntimeOperationsBriefing]:
    "ephemeral synthesis is required by tenant runtime-operations policy but no synthesis adapter is configured",
} as const satisfies Record<ContextPackSynthesisRequirementReason, string>;
const HAT_COMMUNICATION_BRIEF_FAILED_MESSAGE = "hat communication brief retrieval failed";
const CURATION_PROFILE_FAILED_MESSAGE = "context pack curation profile retrieval failed";
const ADVISORY_PROMOTION_POLICY_FAILED_MESSAGE = "context pack advisory promotion policy failed";
const REQUIRED_CURATION_LANE_EMPTY_MESSAGE = "required context-pack curation lane has no refs";
const UNGROUNDED_SYNTHESIS_BRIEFING_MESSAGE = "ephemeral synthesis briefing was not grounded in deterministic evidence refs";
const UNGROUNDED_SYNTHESIS_ADVISORY_MESSAGE = "ephemeral synthesis advisory was not grounded in deterministic evidence refs";
const UNGROUNDED_SYNTHESIS_RANKED_TARGET_MESSAGE = "ephemeral synthesis ranked context target was not grounded in deterministic evidence refs";
const UNGROUNDED_SYNTHESIS_CURATION_EVIDENCE_MESSAGE = "ephemeral synthesis curation evidence was not grounded in deterministic evidence refs";
const ILLEGAL_SYNTHESIS_ACTION_MESSAGE = "synthesis recommended action is not legal in the current observe readout";
const LIFECYCLE_ANCHOR_REQUIRES_ACTIVE_WORK_SCOPE_MESSAGE = "lifecycle anchor item requires active work item scope";
const LIFECYCLE_ANCHOR_REQUIRES_SOURCE_POINTER_MESSAGE = "lifecycle anchor item lacks a lifecycle source pointer";
const LIFECYCLE_ANCHOR_REQUIRES_ACTIVE_WORK_POINTER_MESSAGE = "lifecycle anchor item lacks active work source pointer";
const LIFECYCLE_ANCHOR_OUTSIDE_ACTIVE_WORK_SCOPE_MESSAGE = "lifecycle anchor item is outside active work scope";
const SCHEDULE_ANCHOR_REQUIRES_HAT_ASSIGNMENT_PROVENANCE_MESSAGE = "schedule anchor lacks active hat assignment provenance";
const SCHEDULE_ANCHOR_OUTSIDE_ACTIVE_HAT_ASSIGNMENT_MESSAGE = "schedule anchor is outside active hat assignment";
const SCHEDULE_ANCHOR_OUTSIDE_ACTIVE_AGENT_ASSIGNMENT_MESSAGE = "schedule anchor is outside active agent assignment";
const SUPERVISOR_SIGNAL_REQUIRES_TARGET_HAT_ASSIGNMENT_PROVENANCE_MESSAGE = "supervisor signal lacks target hat assignment provenance";
const SUPERVISOR_SIGNAL_OUTSIDE_ACTIVE_TARGET_HAT_ASSIGNMENT_MESSAGE = "supervisor signal is outside active target hat assignment";
const INBOX_ANCHOR_REQUIRES_TARGET_HAT_ASSIGNMENT_PROVENANCE_MESSAGE = "inbox anchor lacks target hat assignment provenance";
const INBOX_ANCHOR_OUTSIDE_ACTIVE_TARGET_HAT_ASSIGNMENT_MESSAGE = "inbox anchor is outside active target hat assignment";
const INBOX_ANCHOR_OUTSIDE_ACTIVE_AGENT_ASSIGNMENT_MESSAGE = "inbox anchor is outside active agent assignment";
const DOC_REF_PREFIX = "doc:";
const INBOX_REF_PREFIX = "inbox:";
const SCHEDULE_BLOCK_REF_PREFIX = "schedule_block:";
const SUPERVISOR_SIGNAL_REF_PREFIX = "supervisor_signal:";
const WORK_REF_PREFIX = "work:";
const INBOX_ANCHOR_REASON = "inbox_anchor";
const INBOX_GRAPH_REASON = "inbox anchor";
const LIFECYCLE_SCHEDULE_BLOCK_REASON = "lifecycle_anchor:schedule_block";
const LIFECYCLE_MEETING_REASON = "lifecycle_anchor:meeting";
const LIFECYCLE_SUPERVISOR_SIGNAL_REASON = "lifecycle_anchor:supervisor_signal";
const LIFECYCLE_SCHEDULE_BLOCK_GRAPH_REASON = "lifecycle anchor:schedule_block";
const LIFECYCLE_MEETING_GRAPH_REASON = "lifecycle anchor:meeting";
const MEETING_SCHEDULE_ANCHOR_PREFIX = "schedule";
const HAT_COMMUNICATION_BRIEF_POLICY_ID = "hat_communication_brief";
const HAT_COMMUNICATION_BRIEF_POLICY_VERSION = "v1";
const DEFAULT_CONTEXT_PACK_HAT_CATALOG = buildHatDefinitions();
const DEFAULT_GRAPH_ROOT_REASON = "context graph seed";
const CONTEXT_REQUIREMENT_NODE_ID_PREFIX = "context_requirement";
const LIFECYCLE_ANCHORS_NODE_ID = "lifecycle_anchors";
const TELEMETRY_EVIDENCE_NODE_ID = "telemetry_evidence";
const SYNTHESIS_BRIEFING_ITEM_ID_PREFIX = "synthesis";
const SYNTHESIS_CURATION_EVIDENCE_NODE_ID_PREFIX = "synthesis_curation_evidence";
const UNCERTAINTY_SIGNAL_REF_PREFIX = "uncertainty";
const LOW_CONFIDENCE_EVIDENCE_THRESHOLD = 0.5;
const ContextPackAttentionPriority = {
  Authority: 10,
  RequiredDocuments: 20,
  ActiveWork: 30,
  GraphNeighborhood: 40,
  Memory: 50,
  Omissions: 60,
  LegalActions: 70,
} as const;
const ContextPackAttentionObjective = {
  Authority: "Understand the active hat duty, authority, supervisor route, and evidence protocol.",
  RequiredDocuments: "Resolve the moment against approved business, architecture, policy, and decision context.",
  ActiveWork: "Anchor the pack to the current work, project, team, and organization scope.",
  GraphNeighborhood: "Traverse live graph context for dependencies, decisions, meetings, traces, and blast radius.",
  Memory: "Use scoped memory only as advisory color after source-of-truth context.",
  Omissions: "Expose missing, stale, denied, contradicted, or unindexed context before acting.",
  LegalActions: "Constrain recommendations to observe actions that are legal for this hat and state.",
} as const;
const ContextPackDeterministicInstruction = {
  SourcePriority: "Rank required documents and active graph context before advisory memory.",
  AuthorityBoundaries: "Use the hat communication brief to keep questions, escalations, and resource requests on the supervisor chain.",
  GapDiscipline: "Turn omissions and contradictions into explicit questions or lifecycle blockers instead of inventing context.",
  LegalActionBoundary: "Recommend only actions present in the legal observe action lane.",
} as const;
export const ContextPackCurationProfileInstruction = {
  ManagementBlocker:
    "Resolve management blockers through business, architecture, policy, graph blast radius, and supervisor-routing evidence.",
  ImplementerExecution:
    "Start execution context with active work, acceptance criteria, prompt-flow phase, and directly governing repo docs.",
  ProductValidation:
    "Resolve product and business validation through customer need, BRD/RFP, acceptance criteria, signoff, and business-rule evidence.",
  ArchitectureDecision:
    "Resolve architecture decisions through CA, ADR, design constraints, integration boundaries, graph blast radius, and tradeoff evidence.",
  EvidenceReview:
    "Resolve review and verification through active work, runtime evidence, reproducibility, test runbooks, and bounce-back criteria.",
  SecurityControl:
    "Resolve security control work through credential policy, least privilege, audit evidence, omitted context, and legal review actions.",
  ProgramCoordination:
    "Resolve program coordination through initiative mission, dependencies, staffing, blockers, meetings, decisions, and supervisor-routing evidence.",
  ReleaseDelivery:
    "Resolve release delivery through release readiness, deployment evidence, merge gates, rollback runbooks, and delivery-gate evidence.",
  RuntimeOperations:
    "Resolve runtime operations through incident context, SLOs, traces, DLQs, scheduler triggers, runbooks, and remediation evidence.",
  KnowledgeStewardship:
    "Resolve memory and documentation stewardship through Hindsight attribution, document freshness, skill graph, consult outcome, and context-routing evidence.",
  CapabilityExpansion:
    "Resolve capability expansion through hat, tool, workflow, actor, and MCP registry proposals with architecture, security, rollout, and approval evidence.",
  CapacityFinance:
    "Resolve capacity and finance guardrails through budget ceilings, cost telemetry, runtime capacity, hat supply, and scaling evidence.",
} as const;
export type ContextPackCurationProfileInstruction =
  (typeof ContextPackCurationProfileInstruction)[keyof typeof ContextPackCurationProfileInstruction];
export const ContextPackCurationProfileId = {
  Default: "default",
  ManagementBlocker: "management_blocker",
  ImplementerExecution: "implementer_execution",
  ProductValidation: "product_validation",
  ArchitectureDecision: "architecture_decision",
  EvidenceReview: "evidence_review",
  SecurityControl: "security_control",
  ProgramCoordination: "program_coordination",
  ReleaseDelivery: "release_delivery",
  RuntimeOperations: "runtime_operations",
  KnowledgeStewardship: "knowledge_stewardship",
  CapabilityExpansion: "capability_expansion",
  CapacityFinance: "capacity_finance",
} as const;
export type ContextPackCurationProfileId =
  (typeof ContextPackCurationProfileId)[keyof typeof ContextPackCurationProfileId];
const HatCommunicationBriefReason = {
  Duty: "hat-duty",
  SupervisorRouting: "supervisor-routing",
  UpwardTools: "upward-tools",
  EvidenceProtocol: "evidence-protocol",
} as const;

export const ContextPackDocumentFocusProfileId = {
  Default: "default",
  ManagementBlocker: "management_blocker",
  ImplementerExecution: "implementer_execution",
  ProductValidation: "product_validation",
  ArchitectureDecision: "architecture_decision",
  EvidenceReview: "evidence_review",
  SecurityControl: "security_control",
  ProgramCoordination: "program_coordination",
  ReleaseDelivery: "release_delivery",
  RuntimeOperations: "runtime_operations",
  KnowledgeStewardship: "knowledge_stewardship",
  CapabilityExpansion: "capability_expansion",
  CapacityFinance: "capacity_finance",
} as const;
export type ContextPackDocumentFocusProfileId =
  (typeof ContextPackDocumentFocusProfileId)[keyof typeof ContextPackDocumentFocusProfileId];
const ContextPackDocumentFocusTerm = {
  BusinessRules: "business rules",
  CustomerRequirements: "customer requirements",
  Architecture: "architecture",
  Decision: "decision",
  Policy: "policy",
  Blocker: "blocker",
  AcceptanceCriteria: "acceptance criteria",
  Implementation: "implementation",
  Runbook: "runbook",
  TestEvidence: "test evidence",
  Rfp: "rfp",
  BusinessValidation: "business validation",
  Signoff: "signoff",
  Tradeoff: "tradeoff",
  IntegrationBoundary: "integration boundary",
  Reproducibility: "reproducibility",
  RuntimeEvidence: "runtime evidence",
  CredentialProxy: "credential proxy",
  LeastPrivilege: "least privilege",
  AuditEvidence: "audit evidence",
  Initiative: "initiative",
  Dependency: "dependency",
  Staffing: "staffing",
  Schedule: "schedule",
  Release: "release",
  Deployment: "deployment",
  Rollback: "rollback",
  Incident: "incident",
  Slo: "slo",
  Trigger: "trigger",
  Dlq: "dlq",
  Telemetry: "telemetry",
  Memory: "memory",
  Freshness: "freshness",
  Drift: "drift",
  ProjectSkill: "project skill",
  Capability: "capability",
  Workflow: "workflow",
  Registry: "registry",
  Budget: "budget",
  Capacity: "capacity",
  Cost: "cost",
  HatSupply: "hat supply",
} as const;

type ContextPackDocumentFocusTemplate = {
  profileId: ContextPackDocumentFocusProfileId;
  queryTerms: readonly string[];
  preferredDocTypes: readonly DocType[];
};

const ContextPackDocumentFocusByCurationProfile: Partial<Record<ContextPackCurationProfileId, ContextPackDocumentFocusTemplate>> = {
  [ContextPackCurationProfileId.ManagementBlocker]: {
    profileId: ContextPackDocumentFocusProfileId.ManagementBlocker,
    queryTerms: [
      ContextPackDocumentFocusTerm.BusinessRules,
      ContextPackDocumentFocusTerm.CustomerRequirements,
      ContextPackDocumentFocusTerm.Architecture,
      ContextPackDocumentFocusTerm.Decision,
      ContextPackDocumentFocusTerm.Policy,
      ContextPackDocumentFocusTerm.Blocker,
    ],
    preferredDocTypes: [
      DocType.Brd,
      DocType.Architecture,
      DocType.Adr,
      DocType.Policy,
      DocType.DecisionRecord,
    ],
  },
  [ContextPackCurationProfileId.ImplementerExecution]: {
    profileId: ContextPackDocumentFocusProfileId.ImplementerExecution,
    queryTerms: [
      ContextPackDocumentFocusTerm.AcceptanceCriteria,
      ContextPackDocumentFocusTerm.Implementation,
      ContextPackDocumentFocusTerm.Architecture,
      ContextPackDocumentFocusTerm.Runbook,
      ContextPackDocumentFocusTerm.TestEvidence,
    ],
    preferredDocTypes: [
      DocType.Spec,
      DocType.Runbook,
      DocType.Architecture,
      DocType.Adr,
      DocType.Brd,
    ],
  },
  [ContextPackCurationProfileId.ProductValidation]: {
    profileId: ContextPackDocumentFocusProfileId.ProductValidation,
    queryTerms: [
      ContextPackDocumentFocusTerm.CustomerRequirements,
      ContextPackDocumentFocusTerm.BusinessRules,
      ContextPackDocumentFocusTerm.Rfp,
      ContextPackDocumentFocusTerm.AcceptanceCriteria,
      ContextPackDocumentFocusTerm.BusinessValidation,
      ContextPackDocumentFocusTerm.Signoff,
    ],
    preferredDocTypes: [
      DocType.Brd,
      DocType.Spec,
      DocType.DecisionRecord,
      DocType.Policy,
    ],
  },
  [ContextPackCurationProfileId.ArchitectureDecision]: {
    profileId: ContextPackDocumentFocusProfileId.ArchitectureDecision,
    queryTerms: [
      ContextPackDocumentFocusTerm.Architecture,
      ContextPackDocumentFocusTerm.Decision,
      ContextPackDocumentFocusTerm.Tradeoff,
      ContextPackDocumentFocusTerm.IntegrationBoundary,
      ContextPackDocumentFocusTerm.Policy,
    ],
    preferredDocTypes: [
      DocType.Architecture,
      DocType.Adr,
      DocType.Policy,
      DocType.DecisionRecord,
    ],
  },
  [ContextPackCurationProfileId.EvidenceReview]: {
    profileId: ContextPackDocumentFocusProfileId.EvidenceReview,
    queryTerms: [
      ContextPackDocumentFocusTerm.TestEvidence,
      ContextPackDocumentFocusTerm.RuntimeEvidence,
      ContextPackDocumentFocusTerm.Reproducibility,
      ContextPackDocumentFocusTerm.AcceptanceCriteria,
      ContextPackDocumentFocusTerm.Runbook,
    ],
    preferredDocTypes: [
      DocType.DecisionRecord,
      DocType.Runbook,
      DocType.Spec,
      DocType.Brd,
    ],
  },
  [ContextPackCurationProfileId.SecurityControl]: {
    profileId: ContextPackDocumentFocusProfileId.SecurityControl,
    queryTerms: [
      ContextPackDocumentFocusTerm.CredentialProxy,
      ContextPackDocumentFocusTerm.LeastPrivilege,
      ContextPackDocumentFocusTerm.Policy,
      ContextPackDocumentFocusTerm.AuditEvidence,
      ContextPackDocumentFocusTerm.Decision,
    ],
    preferredDocTypes: [
      DocType.Policy,
      DocType.Adr,
      DocType.DecisionRecord,
      DocType.Architecture,
      DocType.Runbook,
    ],
  },
  [ContextPackCurationProfileId.ProgramCoordination]: {
    profileId: ContextPackDocumentFocusProfileId.ProgramCoordination,
    queryTerms: [
      ContextPackDocumentFocusTerm.Initiative,
      ContextPackDocumentFocusTerm.Dependency,
      ContextPackDocumentFocusTerm.Staffing,
      ContextPackDocumentFocusTerm.Schedule,
      ContextPackDocumentFocusTerm.Blocker,
      ContextPackDocumentFocusTerm.Decision,
    ],
    preferredDocTypes: [
      DocType.Handbook,
      DocType.DecisionRecord,
      DocType.Brd,
      DocType.Spec,
      DocType.Policy,
    ],
  },
  [ContextPackCurationProfileId.ReleaseDelivery]: {
    profileId: ContextPackDocumentFocusProfileId.ReleaseDelivery,
    queryTerms: [
      ContextPackDocumentFocusTerm.Release,
      ContextPackDocumentFocusTerm.Deployment,
      ContextPackDocumentFocusTerm.Rollback,
      ContextPackDocumentFocusTerm.RuntimeEvidence,
      ContextPackDocumentFocusTerm.Policy,
      ContextPackDocumentFocusTerm.Decision,
    ],
    preferredDocTypes: [
      DocType.Runbook,
      DocType.DecisionRecord,
      DocType.Policy,
      DocType.Spec,
      DocType.Adr,
    ],
  },
  [ContextPackCurationProfileId.RuntimeOperations]: {
    profileId: ContextPackDocumentFocusProfileId.RuntimeOperations,
    queryTerms: [
      ContextPackDocumentFocusTerm.Incident,
      ContextPackDocumentFocusTerm.Slo,
      ContextPackDocumentFocusTerm.Telemetry,
      ContextPackDocumentFocusTerm.Dlq,
      ContextPackDocumentFocusTerm.Trigger,
      ContextPackDocumentFocusTerm.Runbook,
    ],
    preferredDocTypes: [
      DocType.Runbook,
      DocType.Policy,
      DocType.DecisionRecord,
      DocType.Reference,
      DocType.Architecture,
      DocType.Adr,
    ],
  },
  [ContextPackCurationProfileId.KnowledgeStewardship]: {
    profileId: ContextPackDocumentFocusProfileId.KnowledgeStewardship,
    queryTerms: [
      ContextPackDocumentFocusTerm.Freshness,
      ContextPackDocumentFocusTerm.Drift,
      ContextPackDocumentFocusTerm.ProjectSkill,
      ContextPackDocumentFocusTerm.Policy,
      ContextPackDocumentFocusTerm.Decision,
      ContextPackDocumentFocusTerm.Memory,
    ],
    preferredDocTypes: [
      DocType.Handbook,
      DocType.Policy,
      DocType.DecisionRecord,
      DocType.Reference,
      DocType.Architecture,
    ],
  },
  [ContextPackCurationProfileId.CapabilityExpansion]: {
    profileId: ContextPackDocumentFocusProfileId.CapabilityExpansion,
    queryTerms: [
      ContextPackDocumentFocusTerm.Capability,
      ContextPackDocumentFocusTerm.Workflow,
      ContextPackDocumentFocusTerm.Registry,
      ContextPackDocumentFocusTerm.CredentialProxy,
      ContextPackDocumentFocusTerm.Architecture,
      ContextPackDocumentFocusTerm.Policy,
    ],
    preferredDocTypes: [
      DocType.Policy,
      DocType.Architecture,
      DocType.Adr,
      DocType.DecisionRecord,
      DocType.Spec,
      DocType.Handbook,
    ],
  },
  [ContextPackCurationProfileId.CapacityFinance]: {
    profileId: ContextPackDocumentFocusProfileId.CapacityFinance,
    queryTerms: [
      ContextPackDocumentFocusTerm.Budget,
      ContextPackDocumentFocusTerm.Cost,
      ContextPackDocumentFocusTerm.Capacity,
      ContextPackDocumentFocusTerm.HatSupply,
      ContextPackDocumentFocusTerm.Initiative,
      ContextPackDocumentFocusTerm.Policy,
    ],
    preferredDocTypes: [
      DocType.Policy,
      DocType.DecisionRecord,
      DocType.Reference,
      DocType.Handbook,
      DocType.Brd,
    ],
  },
} as const;

const ContextPackCurationInstructionByProfile:
  Partial<Record<ContextPackCurationProfileId, ContextPackCurationProfileInstruction>> = {
    [ContextPackCurationProfileId.ManagementBlocker]: ContextPackCurationProfileInstruction.ManagementBlocker,
    [ContextPackCurationProfileId.ImplementerExecution]: ContextPackCurationProfileInstruction.ImplementerExecution,
    [ContextPackCurationProfileId.ProductValidation]: ContextPackCurationProfileInstruction.ProductValidation,
    [ContextPackCurationProfileId.ArchitectureDecision]: ContextPackCurationProfileInstruction.ArchitectureDecision,
    [ContextPackCurationProfileId.EvidenceReview]: ContextPackCurationProfileInstruction.EvidenceReview,
    [ContextPackCurationProfileId.SecurityControl]: ContextPackCurationProfileInstruction.SecurityControl,
    [ContextPackCurationProfileId.ProgramCoordination]: ContextPackCurationProfileInstruction.ProgramCoordination,
    [ContextPackCurationProfileId.ReleaseDelivery]: ContextPackCurationProfileInstruction.ReleaseDelivery,
    [ContextPackCurationProfileId.RuntimeOperations]: ContextPackCurationProfileInstruction.RuntimeOperations,
    [ContextPackCurationProfileId.KnowledgeStewardship]: ContextPackCurationProfileInstruction.KnowledgeStewardship,
    [ContextPackCurationProfileId.CapabilityExpansion]: ContextPackCurationProfileInstruction.CapabilityExpansion,
    [ContextPackCurationProfileId.CapacityFinance]: ContextPackCurationProfileInstruction.CapacityFinance,
  } as const;
const SynthesisAdvisoryIdPart = {
  Ranked: "ranked",
  Gap: "gap",
  Question: "question",
  Action: "action",
} as const;
const SynthesisAdvisoryReason = {
  RankedContext: "ranked_context",
  GapHypothesis: "gap_hypothesis",
  FollowUpQuestion: "follow_up_question",
  RecommendedAction: "recommended_action",
} as const;
const MANAGEMENT_BLOCKER_CONTEXT_POLICY_EVIDENCE_REF = "context_policy:default_management_blocker:v1";
const MANAGEMENT_CONTEXT_HAT_LEVELS: ReadonlySet<HatLevel> = new Set([
  HatLevel.ExecutiveBoard,
  HatLevel.CSuite,
  HatLevel.Director,
  HatLevel.Manager,
]);
const EXECUTION_CONTEXT_HAT_LEVELS: ReadonlySet<HatLevel> = new Set([
  HatLevel.Lead,
  HatLevel.IndividualContributor,
]);
const MANAGEMENT_CONTEXT_SCOPES: ReadonlySet<RunScope> = new Set([
  RunScope.WorkItem,
  RunScope.Initiative,
  RunScope.Project,
  RunScope.Organization,
]);
const EVIDENCE_REVIEW_PHASES: ReadonlySet<RunLifecyclePhase> = new Set([
  RunLifecyclePhase.Executing,
  RunLifecyclePhase.AwaitingGate,
  RunLifecyclePhase.AwaitingEvidence,
  RunLifecyclePhase.AwaitingReview,
]);
const ContextPackHatApprovalScopeNeedle = {
  Architecture: "architecture",
  Audit: "audit",
  Brd: "brd",
  Business: "business",
  Credential: "credential",
  Dangerous: "dangerous",
  Product: "product",
  Review: "review",
  Security: "security",
  Signoff: "signoff",
  AutomationExpansion: "automation_expansion",
  Budget: "budget",
  Capacity: "capacity",
  Coordination: "coordination",
  Cost: "cost",
  Delivery: "delivery",
  Documentation: "documentation",
  HatProposal: "hat_proposal",
  Health: "health",
  Incident: "incident",
  Initiative: "initiative",
  Memory: "memory",
  Merge: "merge",
  Mission: "mission",
  Observability: "observability",
  Operations: "operations",
  Readiness: "readiness",
  Release: "release",
  Rollback: "rollback",
  Staffing: "staffing",
  ToolRegistry: "tool_registry",
  Tpm: "tpm",
  Capability: "capability",
} as const;
type ContextPackHatApprovalScopeNeedle =
  (typeof ContextPackHatApprovalScopeNeedle)[keyof typeof ContextPackHatApprovalScopeNeedle];

const ManagementBlockerLanePriorityOverlay: Partial<Record<ContextPackAttentionLaneKindType, number>> = {
  [ContextPackAttentionLaneKind.RequiredDocuments]: 15,
  [ContextPackAttentionLaneKind.GraphNeighborhood]: 20,
  [ContextPackAttentionLaneKind.ActiveWork]: 30,
  [ContextPackAttentionLaneKind.Omissions]: 35,
  [ContextPackAttentionLaneKind.LegalActions]: 40,
};

export const ContextPackCompletenessRequirementId = {
  ManagementBlockerBusiness: "management_blocker_business",
  ManagementBlockerArchitecture: "management_blocker_architecture",
  ManagementBlockerPolicy: "management_blocker_policy",
  ManagementBlockerGraph: "management_blocker_graph",
} as const;

export type ContextPackCompletenessRequirementId =
  (typeof ContextPackCompletenessRequirementId)[keyof typeof ContextPackCompletenessRequirementId];

export const DEFAULT_CONTEXT_PACK_COMPLETENESS_REQUIREMENTS: readonly ContextPackCompletenessRequirement[] = [
  {
    id: ContextPackCompletenessRequirementId.ManagementBlockerBusiness,
    itemKind: ContextPackItemKind.BusinessDocument,
    message: "required management blocker business context is not indexed for this hat and scope",
    evidenceRef: MANAGEMENT_BLOCKER_CONTEXT_POLICY_EVIDENCE_REF,
    appliesTo: isManagementBlockerContextRequest,
    isSatisfiedBy: candidateHasActiveScopeDocUnitSource,
  },
  {
    id: ContextPackCompletenessRequirementId.ManagementBlockerArchitecture,
    itemKind: ContextPackItemKind.ArchitectureDocument,
    message: "required management blocker architecture context is not indexed for this hat and scope",
    evidenceRef: MANAGEMENT_BLOCKER_CONTEXT_POLICY_EVIDENCE_REF,
    appliesTo: isManagementBlockerContextRequest,
    isSatisfiedBy: candidateHasActiveScopeDocUnitSource,
  },
  {
    id: ContextPackCompletenessRequirementId.ManagementBlockerPolicy,
    itemKind: ContextPackItemKind.Policy,
    message: "required management blocker policy context is not indexed for this hat and scope",
    evidenceRef: MANAGEMENT_BLOCKER_CONTEXT_POLICY_EVIDENCE_REF,
    appliesTo: isManagementBlockerContextRequest,
    isSatisfiedBy: candidateHasActiveScopeDocUnitSource,
  },
  {
    id: ContextPackCompletenessRequirementId.ManagementBlockerGraph,
    itemKind: ContextPackItemKind.GraphNeighborhood,
    message: "required management blocker graph context is not indexed for this hat and scope",
    evidenceRef: MANAGEMENT_BLOCKER_CONTEXT_POLICY_EVIDENCE_REF,
    appliesTo: isManagementBlockerContextRequest,
    isSatisfiedBy: candidateHasActiveScopeGraphRoot,
  },
] as const;

export function createDefaultContextPackCompletenessPolicy(
  requirements: readonly ContextPackCompletenessRequirement[] = DEFAULT_CONTEXT_PACK_COMPLETENESS_REQUIREMENTS,
): ContextPackCompletenessPolicyPort {
  return {
    evaluate(request): ContextPackCompletenessPolicyResult {
      const missing = requirements
        .filter((requirement) => requirement.appliesTo(request))
        .filter((requirement) => !request.items.some((item) => requirementSatisfiedByItem(requirement, item, request)))
        .map((requirement): ContextPackOmittedItem => ({
          nodeId: contextRequirementNodeId(requirement.id),
          reason: ContextPackOmissionReason.NotIndexed,
          message: requirement.message,
        }));

      return {
        omittedItemsWithReason: missing,
        lifecycleBlockers: missing.map((item) => item.message),
        evidenceRefs: uniqueStrings(
          requirements
            .filter((requirement) => requirement.appliesTo(request))
            .map((requirement) => requirement.evidenceRef),
        ),
      };
    },
  };
}

export function createDefaultContextPackCurationIntentPolicy(): ContextPackCurationIntentPolicyPort {
  return {
    resolve(intentRequest): ContextPackCurationIntent {
      const activeHatPolicy = resolveDefaultContextPackActiveHatPolicy(intentRequest.request);
      if (activeHatPolicy !== undefined) {
        return {
          documentFocus: documentFocusForActiveHatPolicy(activeHatPolicy, DEFAULT_CONTEXT_PACK_DOCUMENT_FOCUS_POLICY_VERSION),
          curationProfile: curationProfileForActiveHatPolicy(activeHatPolicy, DEFAULT_CONTEXT_PACK_CURATION_PROFILE_POLICY_VERSION),
        };
      }
      return {
        documentFocus: defaultContextPackDocumentFocus(),
        curationProfile: defaultContextPackCurationProfile(),
      };
    },
  };
}

export function createDefaultContextPackDocumentFocusPolicy(): ContextPackDocumentFocusPolicyPort {
  const intentPolicy = createDefaultContextPackCurationIntentPolicy();
  return {
    async resolve(focusRequest): Promise<ContextPackDocumentFocus> {
      return (await intentPolicy.resolve(focusRequest)).documentFocus;
    },
  };
}

export function createDefaultContextPackCurationProfilePolicy(): ContextPackCurationProfilePolicyPort {
  const intentPolicy = createDefaultContextPackCurationIntentPolicy();
  return {
    async resolve(profileRequest): Promise<ContextPackCurationProfile> {
      return (await intentPolicy.resolve(profileRequest)).curationProfile;
    },
  };
}

export function listContextPackCurationProfileDescriptors(): readonly ContextPackCurationProfileDescriptor[] {
  return Object.values(ContextPackCurationProfileId).map((profileId) => {
    const instruction = ContextPackCurationInstructionByProfile[profileId];
    return {
      profileId,
      policyVersion: DEFAULT_CONTEXT_PACK_CURATION_PROFILE_POLICY_VERSION,
      documentFocus: contextPackDocumentFocusForCurationProfile({
        profileId,
        policyVersion: DEFAULT_CONTEXT_PACK_CURATION_PROFILE_POLICY_VERSION,
      }),
      deterministicInstructions: instruction === undefined ? [] : [instruction],
    };
  });
}

export function listContextPackAttentionLaneDescriptors(): readonly ContextPackAttentionLaneDescriptor[] {
  return [
    attentionLaneDescriptor(
      ContextPackAttentionLaneKind.Authority,
      ContextPackAttentionPriority.Authority,
      true,
      ContextPackAttentionObjective.Authority,
    ),
    attentionLaneDescriptor(
      ContextPackAttentionLaneKind.RequiredDocuments,
      ContextPackAttentionPriority.RequiredDocuments,
      true,
      ContextPackAttentionObjective.RequiredDocuments,
    ),
    attentionLaneDescriptor(
      ContextPackAttentionLaneKind.ActiveWork,
      ContextPackAttentionPriority.ActiveWork,
      true,
      ContextPackAttentionObjective.ActiveWork,
    ),
    attentionLaneDescriptor(
      ContextPackAttentionLaneKind.GraphNeighborhood,
      ContextPackAttentionPriority.GraphNeighborhood,
      false,
      ContextPackAttentionObjective.GraphNeighborhood,
    ),
    attentionLaneDescriptor(
      ContextPackAttentionLaneKind.Memory,
      ContextPackAttentionPriority.Memory,
      false,
      ContextPackAttentionObjective.Memory,
    ),
    attentionLaneDescriptor(
      ContextPackAttentionLaneKind.Omissions,
      ContextPackAttentionPriority.Omissions,
      false,
      ContextPackAttentionObjective.Omissions,
    ),
    attentionLaneDescriptor(
      ContextPackAttentionLaneKind.LegalActions,
      ContextPackAttentionPriority.LegalActions,
      true,
      ContextPackAttentionObjective.LegalActions,
    ),
  ];
}

function attentionLaneDescriptor(
  kind: ContextPackAttentionLaneKindType,
  defaultPriority: number,
  defaultRequired: boolean,
  objective: string,
): ContextPackAttentionLaneDescriptor {
  return {
    kind,
    defaultPriority,
    defaultRequired,
    objective,
  };
}

export function createDefaultContextPackSynthesisRequirementPolicy(): ContextPackSynthesisRequirementPolicyPort {
  return {
    evaluate(requirementRequest): ContextPackSynthesisRequirement {
      if (isWakeRequestedContextBuild(requirementRequest.request)) {
        return {
          decision: ContextPackSynthesisRequirementDecision.Required,
          reason: ContextPackSynthesisRequirementReason.WakeRequestedContextBuild,
          policyVersion: DEFAULT_CONTEXT_PACK_SYNTHESIS_REQUIREMENT_POLICY_VERSION,
        };
      }
      if (isManagementBlockerCurationProfileRequest(requirementRequest.request)) {
        return {
          decision: ContextPackSynthesisRequirementDecision.Required,
          reason: ContextPackSynthesisRequirementReason.BlockedManagementContext,
          policyVersion: DEFAULT_CONTEXT_PACK_SYNTHESIS_REQUIREMENT_POLICY_VERSION,
        };
      }
      return {
        decision: ContextPackSynthesisRequirementDecision.Optional,
        reason: ContextPackSynthesisRequirementReason.DeterministicOnlyAllowed,
        policyVersion: DEFAULT_CONTEXT_PACK_SYNTHESIS_REQUIREMENT_POLICY_VERSION,
      };
    },
  };
}

function isWakeRequestedContextBuild(request: ContextPackBuildRequest): boolean {
  return request.wakeContext?.requiresBuild === true;
}

export function createInMemoryContextPackDocumentPort(
  input: CreateInMemoryContextPackDocumentPortInput,
): ContextPackDocumentReadPort {
  return {
    async retrieve(request): Promise<ContextPackDocumentReadResult> {
      return {
        retrieval: runRetrieval(
          request.query,
          request.retrievalContext,
          input.corpus,
          input.entities,
          input.retrievalDeps,
        ),
        sourceGraphVersion: input.sourceGraphVersion ?? DEFAULT_IN_MEMORY_SOURCE_GRAPH_VERSION,
      };
    },
  };
}

export function createInMemoryContextPackLifecycleAnchorPort(
  input: CreateInMemoryContextPackLifecycleAnchorPortInput,
): ContextPackLifecycleAnchorPort {
  return {
    load(request): ContextPackLifecycleAnchorResult {
      const scoped = lifecycleAnchorScope(request.request);
      const discussionAnchors = (input.discussionAnchors ?? []).filter((anchor) =>
        lifecycleRecordMatchesScope(anchor, scoped)
      );
      const decisionRecords = (input.decisionRecords ?? []).filter((record) =>
        lifecycleRecordMatchesScope(record, scoped)
      );
      const qualityGateEvaluations = (input.qualityGateEvaluations ?? []).filter((evaluation) =>
        lifecycleRecordMatchesScope(evaluation, scoped)
      );
      const workScheduleBlocks = (input.workScheduleBlocks ?? []).filter((block) =>
        lifecycleRecordMatchesScope(block, scoped) &&
        optionalMatches(block.assignedAgentId, scoped.agentId) &&
        optionalMatches(block.assignedHatAssignmentId, scoped.hatAssignmentId)
      );
      const supervisorSignals = (input.supervisorSignals ?? []).filter((signal) =>
        supervisorSignalMatchesScope(signal, scoped)
      );

      const items = [
        ...discussionAnchors.map(discussionAnchorContextItem),
        ...decisionRecords.map(decisionRecordContextItem),
        ...qualityGateEvaluations.map(qualityGateEvaluationContextItem),
        ...workScheduleBlocks.map(workScheduleBlockContextItem),
        ...supervisorSignals.map(supervisorSignalContextItem),
      ];
      return {
        items,
        graphRootSeeds: [
          ...discussionAnchors.map(discussionAnchorGraphRootSeed),
          ...decisionRecords.map(decisionRecordGraphRootSeed),
          ...qualityGateEvaluations.map(qualityGateEvaluationGraphRootSeed),
          ...workScheduleBlocks.flatMap(workScheduleBlockGraphRootSeeds),
          ...supervisorSignals.map(supervisorSignalGraphRootSeed),
        ],
      };
    },
  };
}

export function createInMemoryContextPackInboxAnchorPort(
  input: CreateInMemoryContextPackInboxAnchorPortInput,
): ContextPackInboxAnchorPort {
  return {
    load(request): ContextPackInboxAnchorResult {
      const inboxAnchors = input.inboxAnchors.filter((anchor) => contextPackInboxAnchorIsVisible(anchor, request.observedAt));
      return {
        items: inboxAnchors.map(inboxAnchorContextItem),
        graphRootSeeds: inboxAnchors.map(inboxAnchorGraphRootSeed),
      };
    },
  };
}

function contextPackInboxAnchorIsVisible(anchor: ContextPackInboxAnchor, observedAt: string): boolean {
  if (anchor.status === ContextPackInboxAnchorStatus.Dismissed) return false;
  if (anchor.status !== ContextPackInboxAnchorStatus.Snoozed) return true;
  if (anchor.snoozedUntil === undefined) return false;
  const snoozedUntil = Date.parse(anchor.snoozedUntil);
  const observed = Date.parse(observedAt);
  return Number.isFinite(snoozedUntil) && Number.isFinite(observed) && snoozedUntil <= observed;
}

type LifecycleAnchorScope = {
  organizationId?: string | undefined;
  projectId?: string | undefined;
  teamId?: string | undefined;
  workItemId?: string | undefined;
  agentId?: string | undefined;
  hatAssignmentId: string;
};

type ScopedLifecycleRecord = {
  organizationId: string;
  projectId: string;
  teamId?: string | undefined;
  workItemId: string;
};

function lifecycleAnchorScope(request: ContextPackBuildRequest): LifecycleAnchorScope {
  return {
    organizationId: request.snapshot.organizationId,
    projectId: request.snapshot.projectId,
    teamId: request.snapshot.teamId,
    workItemId: request.snapshot.workItemId,
    agentId: request.snapshot.agentId,
    hatAssignmentId: request.snapshot.hatAssignmentId,
  };
}

function lifecycleRecordMatchesScope(record: ScopedLifecycleRecord, scope: LifecycleAnchorScope): boolean {
  return (
    requiredLifecycleAnchorMatches(record.organizationId, scope.organizationId) &&
    requiredLifecycleAnchorMatches(record.projectId, scope.projectId) &&
    optionalLifecycleAnchorMatches(record.teamId, scope.teamId) &&
    requiredLifecycleAnchorMatches(record.workItemId, scope.workItemId)
  );
}

function supervisorSignalMatchesScope(signal: SupervisorSignal, scope: LifecycleAnchorScope): boolean {
  return (
    requiredLifecycleAnchorMatches(signal.organizationId, scope.organizationId) &&
    requiredLifecycleAnchorMatches(signal.projectId, scope.projectId) &&
    optionalLifecycleAnchorMatches(signal.teamId, scope.teamId) &&
    requiredLifecycleAnchorMatches(signal.relatedWorkItemId, scope.workItemId) &&
    signal.targetHatAssignmentId === scope.hatAssignmentId
  );
}

function optionalMatches(actual: string | undefined, expected: string | undefined): boolean {
  return expected === undefined || actual === expected;
}

function optionalLifecycleAnchorMatches(actual: string | undefined, expected: string | undefined): boolean {
  return expected === undefined || actual === undefined || actual === expected;
}

function requiredLifecycleAnchorMatches(actual: string | undefined, expected: string | undefined): boolean {
  return actual !== undefined && (expected === undefined || actual === expected);
}

function discussionAnchorContextItem(anchor: DiscussionAnchor): ContextPackItem {
  return {
    id: `discussion:${anchor.discussionAnchorId}`,
    kind: ContextPackItemKind.Discussion,
    title: anchor.title,
    summary: `${anchor.purpose} Expected outputs: ${anchor.expectedOutputs.join(", ")}.`,
    sourceRef: `discussion:${anchor.discussionAnchorId}`,
    required: false,
    freshness: ContextPackFreshness.Current,
    confidence: 0.95,
    reasons: [
      "lifecycle_anchor:discussion",
      `discussion_type:${anchor.discussionAnchorType}`,
      ...anchor.expectedOutputs.map((output) => `expected_output:${output}`),
    ],
    citationRefs: [`discussion:${anchor.discussionAnchorId}`, `work:${anchor.workItemId}`],
    sourcePointers: [
      { kind: ContextPackSourcePointerKind.Discussion, discussionId: anchor.discussionAnchorId },
      { kind: ContextPackSourcePointerKind.WorkItem, workItemId: anchor.workItemId },
      { kind: ContextPackSourcePointerKind.Trace, traceId: anchor.metadata.traceId },
      discussionAnchorGraphNodePointer(anchor),
    ],
  };
}

function decisionRecordContextItem(record: DecisionRecord): ContextPackItem {
  return {
    id: `decision:${record.decisionRecordId}`,
    kind: ContextPackItemKind.DecisionRecord,
    title: record.title,
    summary: `${record.decision} Rationale: ${record.rationale}`,
    sourceRef: `decision:${record.decisionRecordId}`,
    required: true,
    freshness: ContextPackFreshness.Current,
    confidence: 0.98,
    reasons: [
      "lifecycle_anchor:decision",
      `discussion:${record.discussionAnchorId}`,
      ...record.followUpWorkItemIds.map((workItemId) => `follow_up:${workItemId}`),
    ],
    citationRefs: [`decision:${record.decisionRecordId}`, `discussion:${record.discussionAnchorId}`],
    sourcePointers: [
      { kind: ContextPackSourcePointerKind.Decision, decisionId: record.decisionRecordId },
      { kind: ContextPackSourcePointerKind.Discussion, discussionId: record.discussionAnchorId },
      { kind: ContextPackSourcePointerKind.WorkItem, workItemId: record.workItemId },
      { kind: ContextPackSourcePointerKind.Trace, traceId: record.metadata.traceId },
      decisionRecordGraphNodePointer(record),
    ],
  };
}

function qualityGateEvaluationContextItem(evaluation: QualityGateEvaluation): ContextPackItem {
  return {
    id: `quality_gate:${evaluation.qualityGateEvaluationId}`,
    kind: ContextPackItemKind.Evidence,
    title: `Quality gate: ${evaluation.gateKind}`,
    summary: `${evaluation.outcome}: ${evaluation.summary}`,
    sourceRef: `quality_gate:${evaluation.qualityGateEvaluationId}`,
    required: true,
    freshness: ContextPackFreshness.Current,
    confidence: 0.97,
    reasons: [
      "lifecycle_anchor:quality_gate",
      `gate:${evaluation.gateKind}`,
      `outcome:${evaluation.outcome}`,
      ...evaluation.evaluatedArtifactIds.map((artifactId) => `artifact:${artifactId}`),
    ],
    citationRefs: [`quality_gate:${evaluation.qualityGateEvaluationId}`, `discussion:${evaluation.discussionAnchorId}`],
    sourcePointers: [
      { kind: ContextPackSourcePointerKind.QualityGate, qualityGateEvaluationId: evaluation.qualityGateEvaluationId },
      { kind: ContextPackSourcePointerKind.Discussion, discussionId: evaluation.discussionAnchorId },
      { kind: ContextPackSourcePointerKind.WorkItem, workItemId: evaluation.workItemId },
      { kind: ContextPackSourcePointerKind.Trace, traceId: evaluation.metadata.traceId },
      qualityGateEvaluationGraphNodePointer(evaluation),
    ],
  };
}

function inboxAnchorContextItem(anchor: ContextPackInboxAnchor): ContextPackItem {
  const workItemCitationRefs = anchor.workItemId === undefined ? [] : [`${WORK_REF_PREFIX}${anchor.workItemId}`];
  const workItemSourcePointers: readonly ContextPackSourcePointer[] = anchor.workItemId === undefined
    ? []
    : [{ kind: ContextPackSourcePointerKind.WorkItem, workItemId: anchor.workItemId }];
  return {
    id: `${INBOX_REF_PREFIX}${anchor.inboxAnchorId}`,
    kind: ContextPackItemKind.InboxAnchor,
    title: anchor.title,
    summary: `${anchor.priority}/${anchor.status}: ${anchor.summary}`,
    sourceRef: anchor.sourceRef ?? `${INBOX_REF_PREFIX}${anchor.inboxAnchorId}`,
    required: anchor.priority === ContextPackInboxAnchorPriority.Urgent,
    freshness: ContextPackFreshness.Live,
    confidence: 0.97,
    reasons: [
      INBOX_ANCHOR_REASON,
      `priority:${anchor.priority}`,
      `status:${anchor.status}`,
      `target_hat_assignment:${anchor.targetHatAssignmentId}`,
      ...(anchor.targetAgentId === undefined ? [] : [`target_agent:${anchor.targetAgentId}`]),
    ],
    citationRefs: [
      `${INBOX_REF_PREFIX}${anchor.inboxAnchorId}`,
      ...workItemCitationRefs,
      `hat_assignment:${anchor.targetHatAssignmentId}`,
    ],
    sourcePointers: [
      {
        kind: ContextPackSourcePointerKind.InboxAnchor,
        inboxAnchorId: anchor.inboxAnchorId,
        targetHatAssignmentId: anchor.targetHatAssignmentId,
        ...(anchor.targetAgentId === undefined ? {} : { targetAgentId: anchor.targetAgentId }),
      },
      ...workItemSourcePointers,
      ...(anchor.traceId === undefined ? [] : [{ kind: ContextPackSourcePointerKind.Trace, traceId: anchor.traceId } as const]),
      inboxAnchorGraphNodePointer(anchor),
    ],
  };
}

function workScheduleBlockContextItem(block: WorkScheduleBlock): ContextPackItem {
  const meetingId = meetingIdForScheduleBlock(block);
  return {
    id: `schedule_block:${block.workScheduleBlockId}`,
    kind: block.blockType === ScheduleBlockType.Meeting ? ContextPackItemKind.Meeting : ContextPackItemKind.Evidence,
    title: block.title,
    summary: `${block.blockType}/${block.state}: ${block.purpose} Window: ${block.startsAt} -> ${block.endsAt}.`,
    sourceRef: `schedule_block:${block.workScheduleBlockId}`,
    required: block.blockType === ScheduleBlockType.Meeting,
    freshness: ContextPackFreshness.Live,
    confidence: 0.96,
    reasons: [
      LIFECYCLE_SCHEDULE_BLOCK_REASON,
      ...(block.blockType === ScheduleBlockType.Meeting ? [LIFECYCLE_MEETING_REASON] : []),
      `block_type:${block.blockType}`,
      `state:${block.state}`,
      `hat_assignment:${block.assignedHatAssignmentId}`,
    ],
    citationRefs: [
      `schedule_block:${block.workScheduleBlockId}`,
      ...(meetingId === undefined ? [] : [`meeting:${meetingId}`]),
      `work:${block.workItemId}`,
      ...(block.discussionAnchorId === undefined ? [] : [`discussion:${block.discussionAnchorId}`]),
    ],
    sourcePointers: [
      {
        kind: ContextPackSourcePointerKind.ScheduleBlock,
        workScheduleBlockId: block.workScheduleBlockId,
        assignedHatAssignmentId: block.assignedHatAssignmentId,
        assignedAgentId: block.assignedAgentId,
      },
      ...(meetingId === undefined
        ? []
        : [{
            kind: ContextPackSourcePointerKind.Meeting,
            meetingId,
            workScheduleBlockId: block.workScheduleBlockId,
            ...(block.discussionAnchorId === undefined ? {} : { discussionAnchorId: block.discussionAnchorId }),
          } as const]),
      { kind: ContextPackSourcePointerKind.WorkItem, workItemId: block.workItemId },
      { kind: ContextPackSourcePointerKind.Trace, traceId: block.metadata.traceId },
      ...(block.discussionAnchorId === undefined
        ? []
        : [{ kind: ContextPackSourcePointerKind.Discussion, discussionId: block.discussionAnchorId } as const]),
      ...workScheduleBlockGraphNodePointers(block),
    ],
  };
}

function supervisorSignalContextItem(signal: SupervisorSignal): ContextPackItem {
  return {
    id: `supervisor_signal:${signal.supervisorSignalId}`,
    kind: ContextPackItemKind.SupervisorSignal,
    title: signal.title,
    summary: `${signal.toolType}/${signal.status}: ${signal.message}`,
    sourceRef: `supervisor_signal:${signal.supervisorSignalId}`,
    required: true,
    freshness: ContextPackFreshness.Live,
    confidence: 0.97,
    reasons: [
      LIFECYCLE_SUPERVISOR_SIGNAL_REASON,
      `tool:${signal.toolType}`,
      `status:${signal.status}`,
      `source_level:${signal.sourceLevel}`,
      `target_level:${signal.targetLevel}`,
      `target_hat_assignment:${signal.targetHatAssignmentId}`,
    ],
    citationRefs: [
      `supervisor_signal:${signal.supervisorSignalId}`,
      `work:${signal.relatedWorkItemId}`,
      `hat_assignment:${signal.targetHatAssignmentId}`,
    ],
    sourcePointers: [
      {
        kind: ContextPackSourcePointerKind.SupervisorSignal,
        supervisorSignalId: signal.supervisorSignalId,
        targetHatAssignmentId: signal.targetHatAssignmentId,
      },
      { kind: ContextPackSourcePointerKind.WorkItem, workItemId: signal.relatedWorkItemId },
      supervisorSignalGraphNodePointer(signal),
    ],
  };
}

function discussionAnchorGraphRootSeed(anchor: DiscussionAnchor): ContextPackGraphRootSeed {
  return {
    nodeId: graphNodeId(anchor.organizationId, GraphNodeKind.Discussion, anchor.discussionAnchorId),
    title: `Discussion context for ${anchor.title}`,
    citationRefs: [`discussion:${anchor.discussionAnchorId}`],
    reasons: ["lifecycle anchor:discussion"],
  };
}

function decisionRecordGraphRootSeed(record: DecisionRecord): ContextPackGraphRootSeed {
  return {
    nodeId: graphNodeId(record.organizationId, GraphNodeKind.Decision, record.decisionRecordId),
    title: `Decision context for ${record.title}`,
    citationRefs: [`decision:${record.decisionRecordId}`],
    reasons: ["lifecycle anchor:decision"],
  };
}

function qualityGateEvaluationGraphRootSeed(evaluation: QualityGateEvaluation): ContextPackGraphRootSeed {
  return {
    nodeId: graphNodeId(evaluation.organizationId, GraphNodeKind.QualityGate, evaluation.qualityGateEvaluationId),
    title: `Quality gate context for ${evaluation.gateKind}`,
    citationRefs: [`quality_gate:${evaluation.qualityGateEvaluationId}`],
    reasons: ["lifecycle anchor:quality_gate"],
  };
}

function inboxAnchorGraphRootSeed(anchor: ContextPackInboxAnchor): ContextPackGraphRootSeed {
  return {
    nodeId: graphNodeId(anchor.organizationId, GraphNodeKind.InboxAnchor, anchor.inboxAnchorId),
    title: `Inbox context for ${anchor.title}`,
    citationRefs: [`${INBOX_REF_PREFIX}${anchor.inboxAnchorId}`],
    reasons: [INBOX_GRAPH_REASON],
  };
}

function workScheduleBlockGraphRootSeeds(block: WorkScheduleBlock): readonly ContextPackGraphRootSeed[] {
  const scheduleSeed: ContextPackGraphRootSeed = {
    nodeId: graphNodeId(block.organizationId, GraphNodeKind.ScheduleBlock, block.workScheduleBlockId),
    title: `Schedule context for ${block.title}`,
    citationRefs: [`schedule_block:${block.workScheduleBlockId}`],
    reasons: [LIFECYCLE_SCHEDULE_BLOCK_GRAPH_REASON],
  };
  const meetingId = meetingIdForScheduleBlock(block);
  if (meetingId === undefined) return [scheduleSeed];
  return [
    scheduleSeed,
    {
      nodeId: graphNodeId(block.organizationId, GraphNodeKind.Meeting, meetingId),
      title: `Meeting context for ${block.title}`,
      citationRefs: [`meeting:${meetingId}`, `schedule_block:${block.workScheduleBlockId}`],
      reasons: [LIFECYCLE_MEETING_GRAPH_REASON],
    },
  ];
}

function supervisorSignalGraphRootSeed(signal: SupervisorSignal): ContextPackGraphRootSeed {
  return {
    nodeId: graphNodeId(signal.organizationId, GraphNodeKind.SupervisorSignal, signal.supervisorSignalId),
    title: `Supervisor signal context for ${signal.title}`,
    citationRefs: [`supervisor_signal:${signal.supervisorSignalId}`],
    reasons: ["lifecycle anchor:supervisor_signal"],
  };
}

function discussionAnchorGraphNodePointer(anchor: DiscussionAnchor): ContextPackSourcePointer {
  return {
    kind: ContextPackSourcePointerKind.GraphNode,
    nodeId: graphNodeId(anchor.organizationId, GraphNodeKind.Discussion, anchor.discussionAnchorId),
  };
}

function decisionRecordGraphNodePointer(record: DecisionRecord): ContextPackSourcePointer {
  return {
    kind: ContextPackSourcePointerKind.GraphNode,
    nodeId: graphNodeId(record.organizationId, GraphNodeKind.Decision, record.decisionRecordId),
  };
}

function qualityGateEvaluationGraphNodePointer(evaluation: QualityGateEvaluation): ContextPackSourcePointer {
  return {
    kind: ContextPackSourcePointerKind.GraphNode,
    nodeId: graphNodeId(evaluation.organizationId, GraphNodeKind.QualityGate, evaluation.qualityGateEvaluationId),
  };
}

function inboxAnchorGraphNodePointer(anchor: ContextPackInboxAnchor): ContextPackSourcePointer {
  return {
    kind: ContextPackSourcePointerKind.GraphNode,
    nodeId: graphNodeId(anchor.organizationId, GraphNodeKind.InboxAnchor, anchor.inboxAnchorId),
  };
}

function workScheduleBlockGraphNodePointers(block: WorkScheduleBlock): readonly ContextPackSourcePointer[] {
  const schedulePointer: ContextPackSourcePointer = {
    kind: ContextPackSourcePointerKind.GraphNode,
    nodeId: graphNodeId(block.organizationId, GraphNodeKind.ScheduleBlock, block.workScheduleBlockId),
  };
  const meetingId = meetingIdForScheduleBlock(block);
  if (meetingId === undefined) return [schedulePointer];
  return [
    schedulePointer,
    {
      kind: ContextPackSourcePointerKind.GraphNode,
      nodeId: graphNodeId(block.organizationId, GraphNodeKind.Meeting, meetingId),
    },
  ];
}

function meetingIdForScheduleBlock(block: WorkScheduleBlock): string | undefined {
  return block.blockType === ScheduleBlockType.Meeting
    ? `${MEETING_SCHEDULE_ANCHOR_PREFIX}:${block.workScheduleBlockId}`
    : undefined;
}

function supervisorSignalGraphNodePointer(signal: SupervisorSignal): ContextPackSourcePointer {
  return {
    kind: ContextPackSourcePointerKind.GraphNode,
    nodeId: graphNodeId(signal.organizationId, GraphNodeKind.SupervisorSignal, signal.supervisorSignalId),
  };
}

export function createDefaultContextPackHatCommunicationBriefPort(
  input: CreateDefaultContextPackHatCommunicationBriefPortInput = {},
): ContextPackHatCommunicationBriefPort {
  const hats = input.hats ?? DEFAULT_CONTEXT_PACK_HAT_CATALOG;
  return {
    build(request): ContextPackHatCommunicationBriefResult {
      const hat = request.request.snapshot.hat;
      const targetHatId = hat.reportsToHatIds[0] ?? hat.id;
      const sourceLevel = supervisorChainLevelForHatLevel(hat.level);
      const targetHat = targetHatId === hat.id ? hat : hats.find((candidate) => candidate.id === targetHatId);
      if (targetHat === undefined) {
        throw new Error(`target supervisor hat '${targetHatId}' is not in the communication brief catalog`);
      }
      const targetLevel = supervisorChainLevelForHatLevel(targetHat.level);
      return {
        brief: buildHatCommunicationBrief({
          hatId: hat.id,
          duty: `Wear the ${hat.name} hat for ${request.request.snapshot.scope}/${request.request.readout.phase}.`,
          sourceLevel,
          targetLevel,
          targetHatId,
          availableTools: DefaultTeamMemberSupervisorTools,
        }),
        citationRefs: [
          `hat:${hat.id}`,
          `hat:${targetHatId}`,
          `policy:${HAT_COMMUNICATION_BRIEF_POLICY_ID}:${HAT_COMMUNICATION_BRIEF_POLICY_VERSION}`,
        ],
        sourcePointers: [
          ...hatCommunicationBriefGraphPointers(request.request, targetHatId),
          {
            kind: ContextPackSourcePointerKind.Policy,
            policyId: HAT_COMMUNICATION_BRIEF_POLICY_ID,
            version: HAT_COMMUNICATION_BRIEF_POLICY_VERSION,
          },
        ],
        policyVersion: HAT_COMMUNICATION_BRIEF_POLICY_VERSION,
      };
    },
  };
}

function hatCommunicationBriefGraphPointers(
  request: ContextPackBuildRequest,
  targetHatId: string,
): readonly ContextPackSourcePointer[] {
  const organizationId = request.snapshot.organizationId;
  if (organizationId === undefined) return [];
  return [
    {
      kind: ContextPackSourcePointerKind.GraphNode,
      nodeId: graphNodeId(organizationId, GraphNodeKind.Hat, request.snapshot.hat.id),
    },
    {
      kind: ContextPackSourcePointerKind.GraphNode,
      nodeId: graphNodeId(organizationId, GraphNodeKind.Hat, targetHatId),
    },
  ];
}

function contextRequirementNodeId(requirementId: string): string {
  return `${CONTEXT_REQUIREMENT_NODE_ID_PREFIX}:${requirementId}`;
}

function legalActionsForSynthesis(options: readonly AvailableOption[]): readonly ContextPackLegalActionRef[] {
  return options.map((option) => ({
    actionType: option.actionType,
    toPhase: option.toPhase,
    toScope: option.toScope,
    rationale: option.rationale,
  }));
}

function contextPackCurationPlanFor(
  request: ContextPackBuildRequest,
  items: readonly ContextPackItem[],
  omissions: readonly ContextPackOmittedItem[],
  profile: ContextPackCurationProfile,
): ContextPackCurationPlan {
  const effectiveProfile = contextPackProfileWithManagementBlockerOverlay(request, profile);
  const lanes: ContextPackAttentionLane[] = [
    attentionLane(
      ContextPackAttentionLaneKind.Authority,
      contextPackAttentionLanePriority(effectiveProfile, ContextPackAttentionLaneKind.Authority, ContextPackAttentionPriority.Authority),
      ContextPackAttentionObjective.Authority,
      contextPackAttentionLaneRequired(effectiveProfile, ContextPackAttentionLaneKind.Authority, true),
      items
        .filter((item) => item.kind === ContextPackItemKind.HatCommunicationBrief)
        .map(itemLaneRef),
    ),
    attentionLane(
      ContextPackAttentionLaneKind.RequiredDocuments,
      contextPackAttentionLanePriority(effectiveProfile, ContextPackAttentionLaneKind.RequiredDocuments, ContextPackAttentionPriority.RequiredDocuments),
      ContextPackAttentionObjective.RequiredDocuments,
      contextPackAttentionLaneRequired(effectiveProfile, ContextPackAttentionLaneKind.RequiredDocuments, true),
      items
        .filter((item) => item.required && sourceOfTruthContextItemKinds.has(item.kind))
        .map(itemLaneRef),
    ),
    attentionLane(
      ContextPackAttentionLaneKind.ActiveWork,
      contextPackAttentionLanePriority(effectiveProfile, ContextPackAttentionLaneKind.ActiveWork, ContextPackAttentionPriority.ActiveWork),
      ContextPackAttentionObjective.ActiveWork,
      contextPackAttentionLaneRequired(effectiveProfile, ContextPackAttentionLaneKind.ActiveWork, true),
      [
        ...deterministicScopeEvidenceRefs(request).map(scopeAnchorLaneRef),
        ...items
          .filter((item) => activeWorkContextItemKinds.has(item.kind))
          .map(itemLaneRef),
      ],
    ),
    attentionLane(
      ContextPackAttentionLaneKind.GraphNeighborhood,
      contextPackAttentionLanePriority(effectiveProfile, ContextPackAttentionLaneKind.GraphNeighborhood, ContextPackAttentionPriority.GraphNeighborhood),
      ContextPackAttentionObjective.GraphNeighborhood,
      contextPackAttentionLaneRequired(effectiveProfile, ContextPackAttentionLaneKind.GraphNeighborhood, false),
      items
        .filter((item) => item.kind === ContextPackItemKind.GraphNeighborhood)
        .map(itemLaneRef),
    ),
    attentionLane(
      ContextPackAttentionLaneKind.Memory,
      contextPackAttentionLanePriority(effectiveProfile, ContextPackAttentionLaneKind.Memory, ContextPackAttentionPriority.Memory),
      ContextPackAttentionObjective.Memory,
      contextPackAttentionLaneRequired(effectiveProfile, ContextPackAttentionLaneKind.Memory, false),
      items
        .filter((item) => item.kind === ContextPackItemKind.MemoryPointer)
        .map(itemLaneRef),
    ),
    attentionLane(
      ContextPackAttentionLaneKind.Omissions,
      contextPackAttentionLanePriority(effectiveProfile, ContextPackAttentionLaneKind.Omissions, ContextPackAttentionPriority.Omissions),
      ContextPackAttentionObjective.Omissions,
      contextPackAttentionLaneRequired(effectiveProfile, ContextPackAttentionLaneKind.Omissions, omissions.length > 0),
      omissions.map(omissionLaneRef),
    ),
    attentionLane(
      ContextPackAttentionLaneKind.LegalActions,
      contextPackAttentionLanePriority(effectiveProfile, ContextPackAttentionLaneKind.LegalActions, ContextPackAttentionPriority.LegalActions),
      ContextPackAttentionObjective.LegalActions,
      contextPackAttentionLaneRequired(effectiveProfile, ContextPackAttentionLaneKind.LegalActions, true),
      legalActionsForSynthesis(request.readout.options).map(legalActionLaneRef),
    ),
  ];

  return {
    profileId: effectiveProfile.profileId,
    policyVersion: effectiveProfile.policyVersion,
    lanes: lanes.sort((left, right) => left.priority - right.priority),
    deterministicInstructions: uniqueStrings([
      ...Object.values(ContextPackDeterministicInstruction),
      ...(effectiveProfile.deterministicInstructions ?? []),
    ]),
  };
}

function contextPackProfileWithManagementBlockerOverlay(
  request: ContextPackBuildRequest,
  profile: ContextPackCurationProfile,
): ContextPackCurationProfile {
  if (
    !isManagementBlockerCurationProfileRequest(request) ||
    profile.profileId === ContextPackCurationProfileId.ManagementBlocker
  ) {
    return profile;
  }
  return {
    ...profile,
    lanePriorityOverrides: mergeMinimumLanePriorities(
      profile.lanePriorityOverrides ?? {},
      ManagementBlockerLanePriorityOverlay,
    ),
    requiredLanes: uniqueStrings([
      ...(profile.requiredLanes ?? []),
      ContextPackAttentionLaneKind.GraphNeighborhood,
    ]) as readonly ContextPackAttentionLaneKindType[],
    deterministicInstructions: uniqueStrings([
      ...(profile.deterministicInstructions ?? []),
      ContextPackCurationProfileInstruction.ManagementBlocker,
    ]),
  };
}

function contextPackCurationPlanWithRequiredStages(
  plan: ContextPackCurationPlan,
  requiredStages: readonly ContextPackCurationStageKind[],
): ContextPackCurationPlan {
  const mergedRequiredStages = uniqueStrings([
    ...(plan.requiredStages ?? []),
    ...requiredStages,
  ]) as readonly ContextPackCurationStageKind[];
  return {
    ...plan,
    ...(mergedRequiredStages.length === 0 ? {} : { requiredStages: mergedRequiredStages }),
  };
}

function mergeMinimumLanePriorities(
  base: Partial<Record<ContextPackAttentionLaneKindType, number>>,
  overlay: Partial<Record<ContextPackAttentionLaneKindType, number>>,
): Partial<Record<ContextPackAttentionLaneKindType, number>> {
  const merged: Partial<Record<ContextPackAttentionLaneKindType, number>> = { ...base };
  for (const [kind, priority] of Object.entries(overlay) as [ContextPackAttentionLaneKindType, number][]) {
    const current = merged[kind];
    merged[kind] = current === undefined ? priority : Math.min(current, priority);
  }
  return merged;
}

function contextPackAttentionLanePriority(
  profile: ContextPackCurationProfile,
  kind: ContextPackAttentionLaneKindType,
  fallback: number,
): number {
  return profile.lanePriorityOverrides?.[kind] ?? fallback;
}

function contextPackAttentionLaneRequired(
  profile: ContextPackCurationProfile,
  kind: ContextPackAttentionLaneKindType,
  fallback: boolean,
): boolean {
  return fallback || (profile.requiredLanes ?? []).includes(kind);
}

function requiredCurationLaneOmissions(plan: ContextPackCurationPlan): readonly ContextPackOmittedItem[] {
  return plan.lanes
    .filter((lane) => lane.required && lane.refs.length === 0)
    .map((lane) => ({
      nodeId: requiredCurationLaneNodeId(lane.kind),
      reason: ContextPackOmissionReason.NotIndexed,
      message: `${REQUIRED_CURATION_LANE_EMPTY_MESSAGE}: ${lane.kind}`,
    }));
}

function requiredSynthesisUnavailableOmission(
  requirement: ContextPackSynthesisRequirement,
): ContextPackOmittedItem {
  return {
    nodeId: REQUIRED_SYNTHESIS_UNAVAILABLE_NODE_ID,
    reason: ContextPackOmissionReason.RetrievalFailed,
    message: `${REQUIRED_SYNTHESIS_UNAVAILABLE_MESSAGE_BY_REASON[requirement.reason]}; policy=${requirement.policyVersion}; reason=${requirement.reason}`,
  };
}

function requiredCurationLaneNodeId(kind: ContextPackAttentionLaneKindType): string {
  return `${REQUIRED_CONTEXT_PACK_CURATION_LANE_NODE_ID_PREFIX}:${kind}`;
}

async function contextPackCurationIntentFor(
  policy: ContextPackCurationIntentPolicyPort,
  request: ContextPackBuildRequest,
): Promise<{ intent: ContextPackCurationIntent; omissions: readonly ContextPackOmittedItem[] }> {
  try {
    return {
      intent: cloneContextPackCurationIntent(await policy.resolve({
        request: cloneContextPackBuildRequest(request),
      })),
      omissions: [],
    };
  } catch (error) {
    return {
      intent: defaultContextPackCurationIntent(),
      omissions: [{
        nodeId: CURATION_INTENT_NODE_ID,
        reason: ContextPackOmissionReason.RetrievalFailed,
        message: `${CURATION_INTENT_FAILED_MESSAGE}: ${errorMessage(error)}`,
      }],
    };
  }
}

async function contextPackDocumentFocusFor(
  policy: ContextPackDocumentFocusPolicyPort,
  request: ContextPackBuildRequest,
): Promise<{ focus: ContextPackDocumentFocus; omissions: readonly ContextPackOmittedItem[] }> {
  try {
    return {
      focus: cloneContextPackDocumentFocus(await policy.resolve({
        request: cloneContextPackBuildRequest(request),
      })),
      omissions: [],
    };
  } catch (error) {
    return {
      focus: defaultContextPackDocumentFocus(),
      omissions: [{
        nodeId: DOCUMENT_FOCUS_NODE_ID,
        reason: ContextPackOmissionReason.RetrievalFailed,
        message: `${DOCUMENT_FOCUS_POLICY_FAILED_MESSAGE}: ${errorMessage(error)}`,
      }],
    };
  }
}

function defaultContextPackDocumentFocus(): ContextPackDocumentFocus {
  return {
    profileId: ContextPackDocumentFocusProfileId.Default,
    policyVersion: DEFAULT_CONTEXT_PACK_DOCUMENT_FOCUS_POLICY_VERSION,
    queryTerms: [],
    preferredDocTypes: [],
  };
}

export function contextPackDocumentFocusForCurationProfile(
  profile: ContextPackCurationProfile,
  fallback: ContextPackDocumentFocus = defaultContextPackDocumentFocus(),
): ContextPackDocumentFocus {
  const template = contextPackDocumentFocusTemplateForProfile(profile.profileId);
  if (template === undefined) return cloneContextPackDocumentFocus(fallback);
  return {
    profileId: template.profileId,
    policyVersion: profile.policyVersion,
    queryTerms: [...template.queryTerms],
    preferredDocTypes: [...template.preferredDocTypes],
  };
}

function contextPackDocumentFocusTemplateForProfile(
  profileId: string,
): ContextPackDocumentFocusTemplate | undefined {
  return Object.values(ContextPackCurationProfileId).includes(profileId as ContextPackCurationProfileId)
    ? ContextPackDocumentFocusByCurationProfile[profileId as ContextPackCurationProfileId]
    : undefined;
}

function defaultContextPackCurationIntent(): ContextPackCurationIntent {
  return {
    documentFocus: defaultContextPackDocumentFocus(),
    curationProfile: defaultContextPackCurationProfile(),
  };
}

function documentFocusForActiveHatPolicy(
  activeHatPolicy: ContextPackActiveHatCurationPolicy,
  policyVersion: string,
): ContextPackDocumentFocus {
  return {
    profileId: activeHatPolicy.focusProfileId,
    policyVersion,
    queryTerms: [...activeHatPolicy.queryTerms],
    preferredDocTypes: [...activeHatPolicy.preferredDocTypes],
  };
}

function curationProfileForActiveHatPolicy(
  activeHatPolicy: ContextPackActiveHatCurationPolicy,
  policyVersion: string,
): ContextPackCurationProfile {
  return {
    profileId: activeHatPolicy.curationProfileId,
    policyVersion,
    lanePriorityOverrides: { ...activeHatPolicy.lanePriorityOverrides },
    ...(activeHatPolicy.requiredLanes === undefined ? {} : { requiredLanes: [...activeHatPolicy.requiredLanes] }),
    deterministicInstructions: [...activeHatPolicy.deterministicInstructions],
  };
}

async function contextPackCurationProfileFor(
  policy: ContextPackCurationProfilePolicyPort | undefined,
  request: ContextPackBuildRequest,
  items: readonly ContextPackItem[],
  omissions: readonly ContextPackOmittedItem[],
  fallbackProfile: ContextPackCurationProfile,
): Promise<{ profile: ContextPackCurationProfile; omissions: readonly ContextPackOmittedItem[] }> {
  if (policy === undefined) {
    return { profile: cloneContextPackCurationProfile(fallbackProfile), omissions: [] };
  }
  try {
    return {
      profile: cloneContextPackCurationProfile(await policy.resolve({
        request: cloneContextPackBuildRequest(request),
        items: cloneContextPackItems(items),
        omissions: cloneContextPackOmissions(omissions),
      })),
      omissions: [],
    };
  } catch (error) {
    return {
      profile: defaultContextPackCurationProfile(),
      omissions: [{
        reason: ContextPackOmissionReason.RetrievalFailed,
        message: `${CURATION_PROFILE_FAILED_MESSAGE}: ${errorMessage(error)}`,
      }],
    };
  }
}

function defaultContextPackCurationProfile(): ContextPackCurationProfile {
  return {
    profileId: ContextPackCurationProfileId.Default,
    policyVersion: DEFAULT_CONTEXT_PACK_CURATION_PROFILE_POLICY_VERSION,
  };
}

const sourceOfTruthContextItemKinds: ReadonlySet<ContextPackItemKind> = new Set([
  ContextPackItemKind.WorkItem,
  ContextPackItemKind.Initiative,
  ContextPackItemKind.Project,
  ContextPackItemKind.BusinessDocument,
  ContextPackItemKind.ArchitectureDocument,
  ContextPackItemKind.DecisionRecord,
  ContextPackItemKind.Discussion,
  ContextPackItemKind.InboxAnchor,
  ContextPackItemKind.Meeting,
  ContextPackItemKind.Policy,
  ContextPackItemKind.Evidence,
  ContextPackItemKind.PromptFlow,
]);

const activeWorkContextItemKinds: ReadonlySet<ContextPackItemKind> = new Set([
  ContextPackItemKind.WorkItem,
  ContextPackItemKind.DecisionRecord,
  ContextPackItemKind.Discussion,
  ContextPackItemKind.InboxAnchor,
  ContextPackItemKind.Meeting,
  ContextPackItemKind.Evidence,
  ContextPackItemKind.SupervisorSignal,
  ContextPackItemKind.PromptFlow,
]);

function attentionLane(
  kind: ContextPackAttentionLaneKindType,
  priority: number,
  objective: string,
  required: boolean,
  refs: readonly ContextPackAttentionLaneRef[],
): ContextPackAttentionLane {
  return {
    kind,
    priority,
    objective,
    required,
    refs: uniqueLaneRefs(refs),
  };
}

function itemLaneRef(item: ContextPackItem): ContextPackAttentionLaneRef {
  return {
    kind: ContextPackAttentionLaneRefKind.Item,
    itemId: item.id,
  };
}

function scopeAnchorLaneRef(anchorRef: string): ContextPackAttentionLaneRef {
  return {
    kind: ContextPackAttentionLaneRefKind.ScopeAnchor,
    anchorRef,
  };
}

function omissionLaneRef(omission: ContextPackOmittedItem): ContextPackAttentionLaneRef {
  return {
    kind: ContextPackAttentionLaneRefKind.Omission,
    omissionRef: omission.nodeId ?? `omission:${omission.reason}`,
  };
}

function legalActionLaneRef(action: ContextPackLegalActionRef): ContextPackAttentionLaneRef {
  return {
    kind: ContextPackAttentionLaneRefKind.LegalAction,
    actionType: action.actionType,
  };
}

function uniqueLaneRefs(refs: readonly ContextPackAttentionLaneRef[]): readonly ContextPackAttentionLaneRef[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = contextPackAttentionLaneRefKey(ref);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function contextPackAttentionLaneRefKey(ref: ContextPackAttentionLaneRef): string {
  switch (ref.kind) {
    case ContextPackAttentionLaneRefKind.Item:
      return `${ref.kind}:${ref.itemId}`;
    case ContextPackAttentionLaneRefKind.Omission:
      return `${ref.kind}:${ref.omissionRef}`;
    case ContextPackAttentionLaneRefKind.LegalAction:
      return `${ref.kind}:${ref.actionType}`;
    case ContextPackAttentionLaneRefKind.ScopeAnchor:
      return `${ref.kind}:${ref.anchorRef}`;
  }
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return Array.from(new Set(values));
}

function resolveDefaultContextPackActiveHatPolicy(
  request: ContextPackBuildRequest,
): ContextPackActiveHatCurationPolicy | undefined {
  if (isManagementBlockerCurationProfileRequest(request) && !isSpecialistCurationProfileRequest(request)) {
    return {
      focusProfileId: ContextPackDocumentFocusProfileId.ManagementBlocker,
      curationProfileId: ContextPackCurationProfileId.ManagementBlocker,
      queryTerms: [
        ContextPackDocumentFocusTerm.BusinessRules,
        ContextPackDocumentFocusTerm.CustomerRequirements,
        ContextPackDocumentFocusTerm.Architecture,
        ContextPackDocumentFocusTerm.Decision,
        ContextPackDocumentFocusTerm.Policy,
        ContextPackDocumentFocusTerm.Blocker,
      ],
      preferredDocTypes: [
        DocType.Brd,
        DocType.Architecture,
        DocType.Adr,
        DocType.Policy,
        DocType.DecisionRecord,
      ],
      lanePriorityOverrides: {
        [ContextPackAttentionLaneKind.RequiredDocuments]: 15,
        [ContextPackAttentionLaneKind.GraphNeighborhood]: 20,
        [ContextPackAttentionLaneKind.ActiveWork]: 30,
        [ContextPackAttentionLaneKind.Omissions]: 35,
        [ContextPackAttentionLaneKind.LegalActions]: 40,
      },
      requiredLanes: [ContextPackAttentionLaneKind.GraphNeighborhood],
      deterministicInstructions: [ContextPackCurationProfileInstruction.ManagementBlocker],
    };
  }
  if (isCapacityFinanceCurationProfileRequest(request)) {
    return {
      focusProfileId: ContextPackDocumentFocusProfileId.CapacityFinance,
      curationProfileId: ContextPackCurationProfileId.CapacityFinance,
      queryTerms: [
        ContextPackDocumentFocusTerm.Budget,
        ContextPackDocumentFocusTerm.Cost,
        ContextPackDocumentFocusTerm.Capacity,
        ContextPackDocumentFocusTerm.HatSupply,
        ContextPackDocumentFocusTerm.Initiative,
        ContextPackDocumentFocusTerm.Policy,
      ],
      preferredDocTypes: [
        DocType.Policy,
        DocType.DecisionRecord,
        DocType.Reference,
        DocType.Handbook,
        DocType.Brd,
      ],
      lanePriorityOverrides: {
        [ContextPackAttentionLaneKind.ActiveWork]: 15,
        [ContextPackAttentionLaneKind.GraphNeighborhood]: 20,
        [ContextPackAttentionLaneKind.RequiredDocuments]: 25,
        [ContextPackAttentionLaneKind.Omissions]: 30,
        [ContextPackAttentionLaneKind.LegalActions]: 35,
        [ContextPackAttentionLaneKind.Memory]: 50,
      },
      deterministicInstructions: [ContextPackCurationProfileInstruction.CapacityFinance],
    };
  }
  if (isSecurityControlCurationProfileRequest(request)) {
    return {
      focusProfileId: ContextPackDocumentFocusProfileId.SecurityControl,
      curationProfileId: ContextPackCurationProfileId.SecurityControl,
      queryTerms: [
        ContextPackDocumentFocusTerm.CredentialProxy,
        ContextPackDocumentFocusTerm.LeastPrivilege,
        ContextPackDocumentFocusTerm.Policy,
        ContextPackDocumentFocusTerm.AuditEvidence,
        ContextPackDocumentFocusTerm.Decision,
      ],
      preferredDocTypes: [
        DocType.Policy,
        DocType.Adr,
        DocType.DecisionRecord,
        DocType.Architecture,
        DocType.Runbook,
      ],
      lanePriorityOverrides: {
        [ContextPackAttentionLaneKind.RequiredDocuments]: 15,
        [ContextPackAttentionLaneKind.Omissions]: 20,
        [ContextPackAttentionLaneKind.ActiveWork]: 30,
        [ContextPackAttentionLaneKind.LegalActions]: 35,
        [ContextPackAttentionLaneKind.GraphNeighborhood]: 40,
        [ContextPackAttentionLaneKind.Memory]: 60,
      },
      deterministicInstructions: [ContextPackCurationProfileInstruction.SecurityControl],
    };
  }
  if (isProductValidationCurationProfileRequest(request)) {
    return {
      focusProfileId: ContextPackDocumentFocusProfileId.ProductValidation,
      curationProfileId: ContextPackCurationProfileId.ProductValidation,
      queryTerms: [
        ContextPackDocumentFocusTerm.CustomerRequirements,
        ContextPackDocumentFocusTerm.BusinessRules,
        ContextPackDocumentFocusTerm.Rfp,
        ContextPackDocumentFocusTerm.AcceptanceCriteria,
        ContextPackDocumentFocusTerm.BusinessValidation,
        ContextPackDocumentFocusTerm.Signoff,
      ],
      preferredDocTypes: [
        DocType.Brd,
        DocType.Spec,
        DocType.DecisionRecord,
        DocType.Policy,
      ],
      lanePriorityOverrides: {
        [ContextPackAttentionLaneKind.RequiredDocuments]: 15,
        [ContextPackAttentionLaneKind.ActiveWork]: 20,
        [ContextPackAttentionLaneKind.GraphNeighborhood]: 30,
        [ContextPackAttentionLaneKind.Omissions]: 35,
        [ContextPackAttentionLaneKind.LegalActions]: 40,
        [ContextPackAttentionLaneKind.Memory]: 55,
      },
      deterministicInstructions: [ContextPackCurationProfileInstruction.ProductValidation],
    };
  }
  if (isArchitectureDecisionCurationProfileRequest(request)) {
    return {
      focusProfileId: ContextPackDocumentFocusProfileId.ArchitectureDecision,
      curationProfileId: ContextPackCurationProfileId.ArchitectureDecision,
      queryTerms: [
        ContextPackDocumentFocusTerm.Architecture,
        ContextPackDocumentFocusTerm.Decision,
        ContextPackDocumentFocusTerm.Tradeoff,
        ContextPackDocumentFocusTerm.IntegrationBoundary,
        ContextPackDocumentFocusTerm.Policy,
      ],
      preferredDocTypes: [
        DocType.Architecture,
        DocType.Adr,
        DocType.Policy,
        DocType.DecisionRecord,
      ],
      lanePriorityOverrides: {
        [ContextPackAttentionLaneKind.RequiredDocuments]: 15,
        [ContextPackAttentionLaneKind.GraphNeighborhood]: 20,
        [ContextPackAttentionLaneKind.ActiveWork]: 30,
        [ContextPackAttentionLaneKind.Omissions]: 40,
        [ContextPackAttentionLaneKind.LegalActions]: 45,
        [ContextPackAttentionLaneKind.Memory]: 60,
      },
      deterministicInstructions: [ContextPackCurationProfileInstruction.ArchitectureDecision],
    };
  }
  if (isProgramCoordinationCurationProfileRequest(request)) {
    return {
      focusProfileId: ContextPackDocumentFocusProfileId.ProgramCoordination,
      curationProfileId: ContextPackCurationProfileId.ProgramCoordination,
      queryTerms: [
        ContextPackDocumentFocusTerm.Initiative,
        ContextPackDocumentFocusTerm.Dependency,
        ContextPackDocumentFocusTerm.Staffing,
        ContextPackDocumentFocusTerm.Schedule,
        ContextPackDocumentFocusTerm.Blocker,
        ContextPackDocumentFocusTerm.Decision,
      ],
      preferredDocTypes: [
        DocType.Handbook,
        DocType.DecisionRecord,
        DocType.Brd,
        DocType.Spec,
        DocType.Policy,
      ],
      lanePriorityOverrides: {
        [ContextPackAttentionLaneKind.ActiveWork]: 15,
        [ContextPackAttentionLaneKind.GraphNeighborhood]: 20,
        [ContextPackAttentionLaneKind.RequiredDocuments]: 25,
        [ContextPackAttentionLaneKind.Omissions]: 35,
        [ContextPackAttentionLaneKind.LegalActions]: 40,
        [ContextPackAttentionLaneKind.Memory]: 55,
      },
      deterministicInstructions: [ContextPackCurationProfileInstruction.ProgramCoordination],
    };
  }
  if (isReleaseDeliveryCurationProfileRequest(request)) {
    return {
      focusProfileId: ContextPackDocumentFocusProfileId.ReleaseDelivery,
      curationProfileId: ContextPackCurationProfileId.ReleaseDelivery,
      queryTerms: [
        ContextPackDocumentFocusTerm.Release,
        ContextPackDocumentFocusTerm.Deployment,
        ContextPackDocumentFocusTerm.Rollback,
        ContextPackDocumentFocusTerm.RuntimeEvidence,
        ContextPackDocumentFocusTerm.Policy,
        ContextPackDocumentFocusTerm.Decision,
      ],
      preferredDocTypes: [
        DocType.Runbook,
        DocType.DecisionRecord,
        DocType.Policy,
        DocType.Spec,
        DocType.Adr,
      ],
      lanePriorityOverrides: {
        [ContextPackAttentionLaneKind.RequiredDocuments]: 15,
        [ContextPackAttentionLaneKind.ActiveWork]: 20,
        [ContextPackAttentionLaneKind.GraphNeighborhood]: 30,
        [ContextPackAttentionLaneKind.Omissions]: 35,
        [ContextPackAttentionLaneKind.LegalActions]: 40,
        [ContextPackAttentionLaneKind.Memory]: 55,
      },
      deterministicInstructions: [ContextPackCurationProfileInstruction.ReleaseDelivery],
    };
  }
  if (isRuntimeOperationsCurationProfileRequest(request)) {
    return {
      focusProfileId: ContextPackDocumentFocusProfileId.RuntimeOperations,
      curationProfileId: ContextPackCurationProfileId.RuntimeOperations,
      queryTerms: [
        ContextPackDocumentFocusTerm.Incident,
        ContextPackDocumentFocusTerm.Slo,
        ContextPackDocumentFocusTerm.Telemetry,
        ContextPackDocumentFocusTerm.Dlq,
        ContextPackDocumentFocusTerm.Trigger,
        ContextPackDocumentFocusTerm.Runbook,
      ],
      preferredDocTypes: [
        DocType.Runbook,
        DocType.Policy,
        DocType.DecisionRecord,
        DocType.Reference,
        DocType.Architecture,
        DocType.Adr,
      ],
      lanePriorityOverrides: {
        [ContextPackAttentionLaneKind.ActiveWork]: 15,
        [ContextPackAttentionLaneKind.GraphNeighborhood]: 20,
        [ContextPackAttentionLaneKind.RequiredDocuments]: 25,
        [ContextPackAttentionLaneKind.Omissions]: 30,
        [ContextPackAttentionLaneKind.LegalActions]: 35,
        [ContextPackAttentionLaneKind.Memory]: 55,
      },
      deterministicInstructions: [ContextPackCurationProfileInstruction.RuntimeOperations],
    };
  }
  if (isKnowledgeStewardshipCurationProfileRequest(request)) {
    return {
      focusProfileId: ContextPackDocumentFocusProfileId.KnowledgeStewardship,
      curationProfileId: ContextPackCurationProfileId.KnowledgeStewardship,
      queryTerms: [
        ContextPackDocumentFocusTerm.Freshness,
        ContextPackDocumentFocusTerm.Drift,
        ContextPackDocumentFocusTerm.ProjectSkill,
        ContextPackDocumentFocusTerm.Policy,
        ContextPackDocumentFocusTerm.Decision,
        ContextPackDocumentFocusTerm.Memory,
      ],
      preferredDocTypes: [
        DocType.Handbook,
        DocType.Policy,
        DocType.DecisionRecord,
        DocType.Reference,
        DocType.Architecture,
      ],
      lanePriorityOverrides: {
        [ContextPackAttentionLaneKind.Memory]: 15,
        [ContextPackAttentionLaneKind.RequiredDocuments]: 20,
        [ContextPackAttentionLaneKind.GraphNeighborhood]: 30,
        [ContextPackAttentionLaneKind.ActiveWork]: 35,
        [ContextPackAttentionLaneKind.Omissions]: 40,
        [ContextPackAttentionLaneKind.LegalActions]: 45,
      },
      deterministicInstructions: [ContextPackCurationProfileInstruction.KnowledgeStewardship],
    };
  }
  if (isCapabilityExpansionCurationProfileRequest(request)) {
    return {
      focusProfileId: ContextPackDocumentFocusProfileId.CapabilityExpansion,
      curationProfileId: ContextPackCurationProfileId.CapabilityExpansion,
      queryTerms: [
        ContextPackDocumentFocusTerm.Capability,
        ContextPackDocumentFocusTerm.Workflow,
        ContextPackDocumentFocusTerm.Registry,
        ContextPackDocumentFocusTerm.CredentialProxy,
        ContextPackDocumentFocusTerm.Architecture,
        ContextPackDocumentFocusTerm.Policy,
      ],
      preferredDocTypes: [
        DocType.Policy,
        DocType.Architecture,
        DocType.Adr,
        DocType.DecisionRecord,
        DocType.Spec,
        DocType.Handbook,
      ],
      lanePriorityOverrides: {
        [ContextPackAttentionLaneKind.RequiredDocuments]: 15,
        [ContextPackAttentionLaneKind.GraphNeighborhood]: 20,
        [ContextPackAttentionLaneKind.ActiveWork]: 25,
        [ContextPackAttentionLaneKind.Omissions]: 35,
        [ContextPackAttentionLaneKind.LegalActions]: 40,
        [ContextPackAttentionLaneKind.Memory]: 55,
      },
      deterministicInstructions: [ContextPackCurationProfileInstruction.CapabilityExpansion],
    };
  }
  if (isEvidenceReviewCurationProfileRequest(request)) {
    return {
      focusProfileId: ContextPackDocumentFocusProfileId.EvidenceReview,
      curationProfileId: ContextPackCurationProfileId.EvidenceReview,
      queryTerms: [
        ContextPackDocumentFocusTerm.TestEvidence,
        ContextPackDocumentFocusTerm.RuntimeEvidence,
        ContextPackDocumentFocusTerm.Reproducibility,
        ContextPackDocumentFocusTerm.AcceptanceCriteria,
        ContextPackDocumentFocusTerm.Runbook,
      ],
      preferredDocTypes: [
        DocType.DecisionRecord,
        DocType.Runbook,
        DocType.Spec,
        DocType.Brd,
      ],
      lanePriorityOverrides: {
        [ContextPackAttentionLaneKind.ActiveWork]: 15,
        [ContextPackAttentionLaneKind.RequiredDocuments]: 25,
        [ContextPackAttentionLaneKind.GraphNeighborhood]: 35,
        [ContextPackAttentionLaneKind.Omissions]: 40,
        [ContextPackAttentionLaneKind.LegalActions]: 45,
        [ContextPackAttentionLaneKind.Memory]: 55,
      },
      deterministicInstructions: [ContextPackCurationProfileInstruction.EvidenceReview],
    };
  }
  if (isImplementerExecutionCurationProfileRequest(request)) {
    return {
      focusProfileId: ContextPackDocumentFocusProfileId.ImplementerExecution,
      curationProfileId: ContextPackCurationProfileId.ImplementerExecution,
      queryTerms: [
        ContextPackDocumentFocusTerm.AcceptanceCriteria,
        ContextPackDocumentFocusTerm.Implementation,
        ContextPackDocumentFocusTerm.Architecture,
        ContextPackDocumentFocusTerm.Runbook,
        ContextPackDocumentFocusTerm.TestEvidence,
      ],
      preferredDocTypes: [
        DocType.Spec,
        DocType.Runbook,
        DocType.Architecture,
        DocType.Adr,
        DocType.Brd,
      ],
      lanePriorityOverrides: {
        [ContextPackAttentionLaneKind.ActiveWork]: 15,
        [ContextPackAttentionLaneKind.RequiredDocuments]: 25,
        [ContextPackAttentionLaneKind.LegalActions]: 35,
        [ContextPackAttentionLaneKind.GraphNeighborhood]: 50,
        [ContextPackAttentionLaneKind.Memory]: 60,
      },
      deterministicInstructions: [ContextPackCurationProfileInstruction.ImplementerExecution],
    };
  }
  return undefined;
}

function isManagementBlockerContextRequest(request: ContextPackCompletenessPolicyRequest): boolean {
  return (
    MANAGEMENT_CONTEXT_HAT_LEVELS.has(request.request.snapshot.hat.level) &&
    request.request.readout.phase === RunLifecyclePhase.Blocked &&
    MANAGEMENT_CONTEXT_SCOPES.has(request.request.snapshot.scope)
  );
}

function isManagementBlockerCurationProfileRequest(request: ContextPackBuildRequest): boolean {
  return (
    MANAGEMENT_CONTEXT_HAT_LEVELS.has(request.snapshot.hat.level) &&
    request.readout.phase === RunLifecyclePhase.Blocked &&
    MANAGEMENT_CONTEXT_SCOPES.has(request.snapshot.scope)
  );
}

function isSpecialistCurationProfileRequest(request: ContextPackBuildRequest): boolean {
  return (
    isCapacityFinanceCurationProfileRequest(request) ||
    isSecurityControlCurationProfileRequest(request) ||
    isProductValidationCurationProfileRequest(request) ||
    isArchitectureDecisionCurationProfileRequest(request) ||
    isProgramCoordinationCurationProfileRequest(request) ||
    isReleaseDeliveryCurationProfileRequest(request) ||
    isRuntimeOperationsCurationProfileRequest(request) ||
    isKnowledgeStewardshipCurationProfileRequest(request) ||
    isCapabilityExpansionCurationProfileRequest(request) ||
    isEvidenceReviewCurationProfileRequest(request)
  );
}

function isImplementerExecutionCurationProfileRequest(request: ContextPackBuildRequest): boolean {
  return (
    EXECUTION_CONTEXT_HAT_LEVELS.has(request.snapshot.hat.level) &&
    request.readout.phase === RunLifecyclePhase.Executing
  );
}

function isProductValidationCurationProfileRequest(request: ContextPackBuildRequest): boolean {
  return (
    hatHasToolBundle(request.snapshot.hat, ToolBundle.Business) ||
      hatHasApprovalScopeContaining(request.snapshot.hat, ContextPackHatApprovalScopeNeedle.Brd) ||
      hatHasApprovalScopeContaining(request.snapshot.hat, ContextPackHatApprovalScopeNeedle.Product) ||
      hatHasApprovalScopeContaining(request.snapshot.hat, ContextPackHatApprovalScopeNeedle.Business)
  );
}

function isArchitectureDecisionCurationProfileRequest(request: ContextPackBuildRequest): boolean {
  return (
    hatDepartmentIs(request.snapshot.hat, DepartmentId.Architecture) ||
      hatHasToolBundle(request.snapshot.hat, ToolBundle.Architecture) ||
      hatHasApprovalScopeContaining(request.snapshot.hat, ContextPackHatApprovalScopeNeedle.Architecture)
  );
}

function isProgramCoordinationCurationProfileRequest(request: ContextPackBuildRequest): boolean {
  return (
    hatDepartmentIs(request.snapshot.hat, DepartmentId.ProgramAndInitiativeManagement) ||
      (hatHasToolBundle(request.snapshot.hat, ToolBundle.PortfolioAndInitiative) &&
        hatHasToolBundle(request.snapshot.hat, ToolBundle.TeamRuntime)) ||
      hatHasApprovalScopeContaining(request.snapshot.hat, ContextPackHatApprovalScopeNeedle.Initiative) ||
      hatHasApprovalScopeContaining(request.snapshot.hat, ContextPackHatApprovalScopeNeedle.Tpm) ||
      hatHasApprovalScopeContaining(request.snapshot.hat, ContextPackHatApprovalScopeNeedle.Staffing) ||
      hatHasApprovalScopeContaining(request.snapshot.hat, ContextPackHatApprovalScopeNeedle.Coordination) ||
      hatHasApprovalScopeContaining(request.snapshot.hat, ContextPackHatApprovalScopeNeedle.Mission)
  );
}

function isReleaseDeliveryCurationProfileRequest(request: ContextPackBuildRequest): boolean {
  return (
    hatDepartmentIs(request.snapshot.hat, DepartmentId.DeliveryAndRelease) ||
      hatHasApprovalScopeContaining(request.snapshot.hat, ContextPackHatApprovalScopeNeedle.Release) ||
      hatHasApprovalScopeContaining(request.snapshot.hat, ContextPackHatApprovalScopeNeedle.Delivery) ||
      hatHasApprovalScopeContaining(request.snapshot.hat, ContextPackHatApprovalScopeNeedle.Rollback) ||
      hatHasApprovalScopeContaining(request.snapshot.hat, ContextPackHatApprovalScopeNeedle.Merge)
  );
}

function isRuntimeOperationsCurationProfileRequest(request: ContextPackBuildRequest): boolean {
  return (
    hatDepartmentIs(request.snapshot.hat, DepartmentId.OperationsAndInfrastructure) ||
      hatDepartmentIs(request.snapshot.hat, DepartmentId.ObservabilityAndEvidence) ||
      hatHasToolBundle(request.snapshot.hat, ToolBundle.NatsAndDlqOperations) ||
      hatHasToolBundle(request.snapshot.hat, ToolBundle.OzAndHermesRuntime) ||
      hatHasApprovalScopeContaining(request.snapshot.hat, ContextPackHatApprovalScopeNeedle.Incident) ||
      hatHasApprovalScopeContaining(request.snapshot.hat, ContextPackHatApprovalScopeNeedle.Operations) ||
      hatHasApprovalScopeContaining(request.snapshot.hat, ContextPackHatApprovalScopeNeedle.Health) ||
      hatHasApprovalScopeContaining(request.snapshot.hat, ContextPackHatApprovalScopeNeedle.Observability)
  );
}

function isKnowledgeStewardshipCurationProfileRequest(request: ContextPackBuildRequest): boolean {
  return (
    hatDepartmentIs(request.snapshot.hat, DepartmentId.MemoryAndKnowledge) ||
      hatDepartmentIs(request.snapshot.hat, DepartmentId.DocumentationAndProjectSkills) ||
      hatHasApprovalScopeContaining(request.snapshot.hat, ContextPackHatApprovalScopeNeedle.Memory) ||
      hatHasApprovalScopeContaining(request.snapshot.hat, ContextPackHatApprovalScopeNeedle.Documentation)
  );
}

function isCapabilityExpansionCurationProfileRequest(request: ContextPackBuildRequest): boolean {
  return (
    hatDepartmentIs(request.snapshot.hat, DepartmentId.CapabilityAndAutomationExpansion) ||
      hatHasApprovalScopeContaining(request.snapshot.hat, ContextPackHatApprovalScopeNeedle.HatProposal) ||
      hatHasApprovalScopeContaining(request.snapshot.hat, ContextPackHatApprovalScopeNeedle.AutomationExpansion) ||
      hatHasApprovalScopeContaining(request.snapshot.hat, ContextPackHatApprovalScopeNeedle.Capability) ||
      hatHasApprovalScopeContaining(request.snapshot.hat, ContextPackHatApprovalScopeNeedle.ToolRegistry)
  );
}

function isCapacityFinanceCurationProfileRequest(request: ContextPackBuildRequest): boolean {
  return (
    hatHasApprovalScopeContaining(request.snapshot.hat, ContextPackHatApprovalScopeNeedle.Budget) ||
      hatHasApprovalScopeContaining(request.snapshot.hat, ContextPackHatApprovalScopeNeedle.Cost) ||
      hatHasApprovalScopeContaining(request.snapshot.hat, ContextPackHatApprovalScopeNeedle.Capacity)
  );
}

function isEvidenceReviewCurationProfileRequest(request: ContextPackBuildRequest): boolean {
  return (
    EVIDENCE_REVIEW_PHASES.has(request.readout.phase) &&
    (hatDepartmentIs(request.snapshot.hat, DepartmentId.QaAndVerification) ||
      hatDepartmentIs(request.snapshot.hat, DepartmentId.QaEngineering) ||
      hatHasToolBundle(request.snapshot.hat, ToolBundle.ReviewAndGates) ||
      hatHasApprovalScopeContaining(request.snapshot.hat, ContextPackHatApprovalScopeNeedle.Review) ||
      hatHasApprovalScopeContaining(request.snapshot.hat, ContextPackHatApprovalScopeNeedle.Signoff))
  );
}

function isSecurityControlCurationProfileRequest(request: ContextPackBuildRequest): boolean {
  return (
    hatDepartmentIs(request.snapshot.hat, DepartmentId.SecurityAndCompliance) ||
      hatHasApprovalScopeContaining(request.snapshot.hat, ContextPackHatApprovalScopeNeedle.Security) ||
      hatHasApprovalScopeContaining(request.snapshot.hat, ContextPackHatApprovalScopeNeedle.Credential) ||
      hatHasApprovalScopeContaining(request.snapshot.hat, ContextPackHatApprovalScopeNeedle.Audit) ||
      hatHasApprovalScopeContaining(request.snapshot.hat, ContextPackHatApprovalScopeNeedle.Dangerous)
  );
}

function hatHasToolBundle(hat: HatDefinition, toolBundle: ToolBundle): boolean {
  return hat.allowedToolBundles.includes(toolBundle);
}

function hatDepartmentIs(hat: HatDefinition, departmentId: DepartmentId): boolean {
  return hat.departmentId === departmentId;
}

function hatHasApprovalScopeContaining(hat: HatDefinition, needle: ContextPackHatApprovalScopeNeedle): boolean {
  return hat.approvalScopes.some((scope) => scope.includes(needle));
}

function requirementSatisfiedByItem(
  requirement: ContextPackCompletenessRequirement,
  item: ContextPackItem,
  request: ContextPackCompletenessPolicyRequest,
): boolean {
  if (item.kind !== requirement.itemKind) return false;
  const candidate = completenessCandidateForItem(item, request.documentUnits);
  return requirement.isSatisfiedBy?.(candidate, request) ?? true;
}

function completenessCandidateForItem(
  item: ContextPackItem,
  documentUnits: readonly DocUnit[],
): ContextPackCompletenessCandidate {
  const sourcePointers = item.sourcePointers ?? [];
  const documentUnitsById = new Map(documentUnits.map((unit) => [unit.docUnitId, unit]));
  const documentUnit = sourcePointers
    .filter((pointer) => pointer.kind === ContextPackSourcePointerKind.DocUnit)
    .map((pointer) => documentUnitsById.get(pointer.docUnitId))
    .find((unit): unit is DocUnit => unit !== undefined);
  return {
    item,
    sourcePointers,
    ...(documentUnit === undefined ? {} : { documentUnit }),
  };
}

function candidateHasActiveScopeDocUnitSource(
  candidate: ContextPackCompletenessCandidate,
  request: ContextPackCompletenessPolicyRequest,
): boolean {
  if (candidate.documentUnit !== undefined) {
    return docUnitMatchesActiveContextScope(candidate.documentUnit, request.request);
  }
  return candidate.sourcePointers.some((pointer) => {
    if (pointer.kind !== ContextPackSourcePointerKind.DocUnit) return false;
    return (
      optionalContextValueMatches(pointer.organizationId, request.request.snapshot.organizationId) &&
      pointer.scopeKind !== undefined &&
      pointer.scopeId !== undefined &&
      activeDocScopesFor(request.request).some((scope) => pointer.scopeKind === scope.kind && pointer.scopeId === scope.id)
    );
  });
}

function synthesisGroundingItemsFor(
  items: readonly ContextPackItem[],
  request: ContextPackBuildRequest,
): readonly ContextPackItem[] {
  const activeDocRefs = activeScopeDocumentEvidenceRefsFor(items, request);
  return items.filter((item) => contextItemIsActiveScopeSynthesisGround(item, request, activeDocRefs));
}

function contextItemIsActiveScopeSynthesisGround(
  item: ContextPackItem,
  request: ContextPackBuildRequest,
  activeDocRefs: ReadonlySet<string>,
): boolean {
  const docPointers = (item.sourcePointers ?? []).filter((pointer) =>
    isDocUnitSourcePointer(pointer)
  );
  if (!itemDocCitationRefs(item).every((ref) => activeDocRefs.has(ref))) {
    return false;
  }
  if (!contextItemGraphPointersMatchActiveScope(item, request)) {
    return false;
  }
  if (docPointers.length === 0) {
    return true;
  }
  return docPointers.every((pointer) => docPointerMatchesActiveScope(pointer, request));
}

function contextItemGraphPointersMatchActiveScope(
  item: ContextPackItem,
  request: ContextPackBuildRequest,
): boolean {
  const graphNodes = (item.sourcePointers ?? []).filter((pointer) =>
    pointer.kind === ContextPackSourcePointerKind.GraphNode
  );
  const graphEdges = (item.sourcePointers ?? []).filter((pointer) =>
    pointer.kind === ContextPackSourcePointerKind.GraphEdge
  );
  if (graphNodes.length === 0 && graphEdges.length === 0) return true;
  if (itemDocCitationRefs(item).length > 0) return true;
  const activeRootNodeIds = activeGraphRootNodeIdsFor(request);
  const nodeMatched = graphNodes.length === 0 || graphNodes.some((pointer) => activeRootNodeIds.has(pointer.nodeId));
  const edgesMatched = graphEdges.every((pointer) =>
    graphEdgePointerMatchesActiveScope(pointer, item, activeRootNodeIds)
  );
  if (nodeMatched && edgesMatched) return true;
  return graphEdges.length === 0 && contextItemHasActiveWorkItemPointer(item, request);
}

function graphEdgePointerMatchesActiveScope(
  pointer: Extract<ContextPackSourcePointer, { kind: typeof ContextPackSourcePointerKind.GraphEdge }>,
  item: ContextPackItem,
  activeRootNodeIds: ReadonlySet<string>,
): boolean {
  return (
    activeRootNodeIds.has(pointer.fromNodeId) && activeRootNodeIds.has(pointer.toNodeId)
  ) || contextItemHasActiveGraphTraversalRootForEdge(item, pointer, activeRootNodeIds);
}

function contextItemHasActiveGraphTraversalRootForEdge(
  item: ContextPackItem,
  edge: Extract<ContextPackSourcePointer, { kind: typeof ContextPackSourcePointerKind.GraphEdge }>,
  activeRootNodeIds: ReadonlySet<string>,
): boolean {
  return (item.sourcePointers ?? []).some((pointer) =>
    pointer.kind === ContextPackSourcePointerKind.GraphNode &&
    activeRootNodeIds.has(pointer.nodeId) &&
    (pointer.nodeId === edge.fromNodeId || pointer.nodeId === edge.toNodeId)
  );
}

function contextItemHasActiveWorkItemPointer(
  item: ContextPackItem,
  request: ContextPackBuildRequest,
): boolean {
  return (item.sourcePointers ?? []).some((pointer) =>
    pointer.kind === ContextPackSourcePointerKind.WorkItem &&
    request.snapshot.workItemId !== undefined &&
    pointer.workItemId === request.snapshot.workItemId
  );
}

function activeScopeDocumentEvidenceRefsFor(
  items: readonly ContextPackItem[],
  request: ContextPackBuildRequest,
): ReadonlySet<string> {
  const refs: string[] = [];
  for (const item of items) {
    const activeDocPointers = (item.sourcePointers ?? [])
      .filter(isDocUnitSourcePointer)
      .filter((pointer) => docPointerMatchesActiveScope(pointer, request));
    if (activeDocPointers.length === 0) continue;
    refs.push(...activeDocPointers.map((pointer) => `${DOC_REF_PREFIX}${pointer.docUnitId}`));
  }
  return new Set(refs);
}

function itemDocCitationRefs(item: ContextPackItem): readonly string[] {
  return (item.citationRefs ?? []).filter((ref) => ref.startsWith(DOC_REF_PREFIX));
}

function isDocUnitSourcePointer(
  pointer: ContextPackSourcePointer,
): pointer is Extract<ContextPackSourcePointer, { kind: typeof ContextPackSourcePointerKind.DocUnit }> {
  return pointer.kind === ContextPackSourcePointerKind.DocUnit;
}

function docPointerMatchesActiveScope(
  pointer: Extract<ContextPackSourcePointer, { kind: typeof ContextPackSourcePointerKind.DocUnit }>,
  request: ContextPackBuildRequest,
): boolean {
  return (
    optionalContextValueMatches(pointer.organizationId, request.snapshot.organizationId) &&
    pointer.scopeKind !== undefined &&
    pointer.scopeId !== undefined &&
    activeDocScopesFor(request).some((scope) => pointer.scopeKind === scope.kind && pointer.scopeId === scope.id)
  );
}

function docUnitMatchesActiveContextScope(unit: DocUnit, request: ContextPackBuildRequest): boolean {
  if (!optionalContextValueMatches(unit.organizationId, request.snapshot.organizationId)) return false;
  return activeDocScopesFor(request).some((scope) => unit.scopeKind === scope.kind && unit.scopeId === scope.id);
}

function activeDocScopesFor(request: ContextPackBuildRequest): readonly { kind: DocScopeKind; id: string }[] {
  return retrievalScopesFor(request.snapshot, request.hierarchy);
}

function candidateHasActiveScopeGraphRoot(
  candidate: ContextPackCompletenessCandidate,
  request: ContextPackCompletenessPolicyRequest,
): boolean {
  const activeNodeIds = activeGraphRootNodeIdsFor(request.request);
  return candidate.sourcePointers.some((pointer) =>
    pointer.kind === ContextPackSourcePointerKind.GraphNode && activeNodeIds.has(pointer.nodeId)
  );
}

function activeGraphRootNodeIdsFor(request: ContextPackBuildRequest): ReadonlySet<string> {
  return activeGraphRootNodeIdsForSnapshot(request.snapshot, request.hierarchy);
}

function optionalContextValueMatches(actual: string | undefined, expected: string | undefined): boolean {
  if (actual === undefined) return false;
  return expected === undefined || actual === expected;
}

export function createDeterministicContextPackBuilder(
  input: CreateDeterministicContextPackBuilderInput,
): ContextPackBuilderPort {
  return {
    async build(request): Promise<{ pack: ContextPack }> {
      const observedAt = request.observedAt;
      const omissions: ContextPackOmittedItem[] = [];
      const curationIntent = await contextPackCurationIntentFor(
        input.curationIntentPolicy ?? createDefaultContextPackCurationIntentPolicy(),
        request,
      );
      omissions.push(...curationIntent.omissions);
      const documentFocus = input.documentFocusPolicy === undefined
        ? { focus: curationIntent.intent.documentFocus, omissions: [] }
        : await contextPackDocumentFocusFor(input.documentFocusPolicy, request);
      omissions.push(...documentFocus.omissions);
      const query = contextPackQuery(request, documentFocus.focus);
      const curationTrace: ContextPackCurationStage[] = [
        {
          stage: ContextPackCurationStageKind.DeterministicScope,
          summary: deterministicScopeSummary(request),
          evidenceRefs: deterministicScopeEvidenceRefs(request),
        },
        documentFocusCurationStage(documentFocus.focus),
      ];
      const retrievalContext = retrievalContextFor(request, omissions, documentFocus.focus);

      let documentResult: ContextPackDocumentReadResult;
      try {
        documentResult = await input.documents.retrieve({ query, retrievalContext, observedAt });
      } catch (error) {
        throw new Error(`${DOCUMENT_RETRIEVAL_FAILED_MESSAGE}: ${errorMessage(error)}`);
      }

      const documentUnits = uniqueDocUnits([
        ...documentResult.retrieval.consulted,
        ...documentResult.retrieval.hits.map((hit) => hit.unit),
      ]);
      const items: ContextPackItem[] = [];
      const hatCommunicationBrief = await hatCommunicationBriefContextItem(
        input.hatCommunicationBrief ?? createDefaultContextPackHatCommunicationBriefPort(),
        request,
        observedAt,
      );
      if (hatCommunicationBrief.ok) {
        items.push(hatCommunicationBrief.item);
      } else {
        omissions.push(hatCommunicationBrief.omission);
      }
      items.push(...documentUnits.map((unit) => docUnitContextItem(unit, request)));
      const contradictions = documentResult.retrieval.conflicts.map((conflict) =>
        `document conflict: ${conflict.a.docUnitId} conflicts with ${conflict.b.docUnitId}`,
      );
      curationTrace.push({
        stage: ContextPackCurationStageKind.RequiredConsult,
        summary: `retrieved ${documentResult.retrieval.hits.length} ranked docs and ${documentResult.retrieval.consulted.length} deterministic consults`,
        evidenceRefs: documentUnits.map((unit) => `doc:${unit.docUnitId}`),
      });

      const lifecycleAnchorGraphRootSeeds: ContextPackGraphRootSeed[] = [];
      if (input.lifecycleAnchors !== undefined) {
        const lifecycleAnchorResult = await lifecycleAnchorItemsFor(input.lifecycleAnchors, request, query, observedAt);
        items.push(...lifecycleAnchorResult.items);
        omissions.push(...lifecycleAnchorResult.omissions);
        lifecycleAnchorGraphRootSeeds.push(...lifecycleAnchorResult.graphRootSeeds);
        curationTrace.push({
          stage: ContextPackCurationStageKind.LifecycleAnchors,
          summary: `loaded ${lifecycleAnchorResult.items.length} lifecycle anchors; omissions=${lifecycleAnchorResult.omissions.length}`,
          evidenceRefs: [
            ...lifecycleAnchorResult.items.map((item) => item.id),
            ...lifecycleAnchorResult.omissions.map(contextOmissionRef),
          ],
        });
      }

      const inboxAnchorGraphRootSeeds: ContextPackGraphRootSeed[] = [];
      if (input.inboxAnchors !== undefined) {
        const inboxAnchorResult = await inboxAnchorItemsFor(input.inboxAnchors, request, query, observedAt);
        items.push(...inboxAnchorResult.items);
        omissions.push(...inboxAnchorResult.omissions);
        inboxAnchorGraphRootSeeds.push(...inboxAnchorResult.graphRootSeeds);
        curationTrace.push({
          stage: ContextPackCurationStageKind.InboxAnchors,
          summary: `loaded ${inboxAnchorResult.items.length} inbox anchors; omissions=${inboxAnchorResult.omissions.length}`,
          evidenceRefs: [
            ...inboxAnchorResult.items.map((item) => item.id),
            ...inboxAnchorResult.omissions.map(contextOmissionRef),
          ],
        });
      }

      const telemetryGraphRootSeeds: ContextPackGraphRootSeed[] = [];
      if (input.telemetryEvidence !== undefined) {
        const telemetryResult = await telemetryEvidenceItemsFor(input.telemetryEvidence, request, query, observedAt, items);
        items.push(...telemetryResult.items);
        omissions.push(...telemetryResult.omissions);
        telemetryGraphRootSeeds.push(...telemetryResult.graphRootSeeds);
        curationTrace.push({
          stage: ContextPackCurationStageKind.TelemetryEvidence,
          summary: `loaded ${telemetryResult.items.length} telemetry evidence items; omissions=${telemetryResult.omissions.length}`,
          evidenceRefs: [
            ...telemetryResult.items.map((item) => item.id),
            ...telemetryResult.omissions.map((omission) => omission.nodeId ?? omission.reason),
          ],
        });
      }

      if (input.graph !== undefined) {
        const graphResult = await graphItemsForRoots(
          input.graph,
          graphRootsFor(
            request,
            documentUnits,
            input.nodeIdForDocUnit,
            input.graphRootNodeIds,
            input.graphRootSeeds,
            lifecycleAnchorGraphRootSeeds,
            inboxAnchorGraphRootSeeds,
            telemetryGraphRootSeeds,
          ),
          request,
        );
        items.push(...graphResult.items);
        omissions.push(...graphResult.omissions);
        curationTrace.push({
          stage: ContextPackCurationStageKind.GraphTraversal,
          summary: `augmented ${graphResult.items.length} graph neighborhoods`,
          evidenceRefs: graphResult.items.map((item) => item.id),
        });
      }

      if (input.memory !== undefined) {
        const memoryResult = await memoryItemsFor(input.memory, request, query);
        items.push(...memoryResult.items);
        omissions.push(...memoryResult.omissions);
        curationTrace.push({
          stage: ContextPackCurationStageKind.MemoryRecall,
          summary: `recalled ${memoryResult.items.length} scoped advisory memories; omissions=${memoryResult.omissions.length}`,
          evidenceRefs: [
            ...memoryResult.items.map((item) => item.id),
            ...memoryResult.omissions.map((omission) => omission.nodeId ?? omission.reason),
          ],
        });
      }

      const lifecycleBlockers: string[] = [];
      if (input.completenessPolicy !== undefined) {
        const completeness = await input.completenessPolicy.evaluate({
          query,
          observedAt,
          request: cloneContextPackBuildRequest(request),
          documentUnits: cloneDocUnits(documentUnits),
          items: cloneContextPackItems(items),
        });
        omissions.push(...completeness.omittedItemsWithReason);
        lifecycleBlockers.push(...(completeness.lifecycleBlockers ?? []));
        curationTrace.push({
          stage: ContextPackCurationStageKind.RequiredConsult,
          summary: `policy completeness omissions=${completeness.omittedItemsWithReason.length}`,
          evidenceRefs: completeness.evidenceRefs ?? [],
        });
      }

      const curationProfile = await contextPackCurationProfileFor(
        input.curationProfilePolicy,
        request,
        items,
        omissions,
        curationIntent.intent.curationProfile,
      );
      omissions.push(...curationProfile.omissions);
      let curationPlan = contextPackCurationPlanFor(
        request,
        synthesisGroundingItemsFor(items, request),
        omissions,
        curationProfile.profile,
      );
      const laneOmissions = requiredCurationLaneOmissions(curationPlan);
      if (laneOmissions.length > 0) {
        omissions.push(...laneOmissions);
        curationPlan = contextPackCurationPlanFor(
          request,
          synthesisGroundingItemsFor(items, request),
          omissions,
          curationProfile.profile,
        );
      }

      const synthesisRequirementPolicy = input.synthesisRequirementPolicy ?? createDefaultContextPackSynthesisRequirementPolicy();
      const synthesisRequirement = await synthesisRequirementPolicy.evaluate({
        request: cloneContextPackBuildRequest(request),
        curationPlan: cloneContextPackCurationPlan(curationPlan),
        items: cloneContextPackItems(items),
        omissions: cloneContextPackOmissions(omissions),
      });
      curationPlan = contextPackCurationPlanWithRequiredStages(
        curationPlan,
        synthesisRequirement.decision === ContextPackSynthesisRequirementDecision.Required
          ? [ContextPackCurationStageKind.EphemeralSynthesis]
          : [],
      );
      const synthesisGroundingItems = synthesisGroundingItemsFor(items, request);
      const uncertaintySignals = contextPackUncertaintySignalsFor(
        synthesisGroundingItems,
        omissions,
        documentResult.retrieval.conflicts,
      );

      if (input.synthesis !== undefined) {
        try {
          const deterministicItems = cloneContextPackItems(synthesisGroundingItems);
          const deterministicOmissions = cloneContextPackOmissions(omissions);
          const deterministicContradictions = [...contradictions];
          const deterministicUncertaintySignals = cloneContextPackUncertaintySignals(uncertaintySignals);
          const synthesis = await input.synthesis.synthesize({
            query,
            observedAt,
            hatId: request.snapshot.hat.id,
            hatLevel: request.snapshot.hat.level,
            scope: request.snapshot.scope,
            phase: request.readout.phase,
            agentId: request.snapshot.agentId,
            organizationId: request.snapshot.organizationId,
            projectId: request.snapshot.projectId,
            teamId: request.snapshot.teamId,
            workItemId: request.snapshot.workItemId,
            wakeContext: request.wakeContext === undefined ? undefined : { ...request.wakeContext },
            legalActions: legalActionsForSynthesis(request.readout.options),
            curationPlan: cloneContextPackCurationPlan(curationPlan),
            items: cloneContextPackItems(deterministicItems),
            omissions: cloneContextPackOmissions(deterministicOmissions),
            contradictions: [...deterministicContradictions],
            uncertaintySignals: cloneContextPackUncertaintySignals(deterministicUncertaintySignals),
          });
          const admittedSynthesisItemIds: string[] = [];
          const admittedSynthesisItems: ContextPackItem[] = [];
          const rejectedSynthesisRefs: string[] = [];
          const briefing = synthesisBriefingContextItem(
            synthesis.briefing,
            deterministicItems,
            request,
            deterministicUncertaintySignals,
          );
          if (briefing.ok) {
            if (briefing.item !== undefined) {
              items.push(briefing.item);
              admittedSynthesisItems.push(briefing.item);
              admittedSynthesisItemIds.push(briefing.item.id);
            }
          } else {
            omissions.push(briefing.omission);
            rejectedSynthesisRefs.push(contextOmissionRef(briefing.omission));
          }
          const curationEvidence = groundedSynthesisCurationEvidenceRefs(
            synthesis.curationEvidenceRefs ?? [],
            deterministicItems,
          );
          omissions.push(...curationEvidence.omissions);
          rejectedSynthesisRefs.push(...curationEvidence.omissions.map(contextOmissionRef));
          const advisories = synthesisAdvisoryContextItems(
            synthesis,
            deterministicItems,
            deterministicOmissions,
            request,
            deterministicUncertaintySignals,
          );
          items.push(...advisories.items);
          omissions.push(...advisories.omissions);
          admittedSynthesisItems.push(...advisories.items);
          admittedSynthesisItemIds.push(...advisories.items.map((item) => item.id));
          rejectedSynthesisRefs.push(...advisories.omissions.map(contextOmissionRef));
          curationTrace.push({
            stage: ContextPackCurationStageKind.EphemeralSynthesis,
            summary: synthesis.summary,
            evidenceRefs: uniqueStrings([
              ...curationEvidence.evidenceRefs,
              ...admittedSynthesisItemIds,
              ...rejectedSynthesisRefs,
            ]),
          });
          if (input.advisoryPromotionPolicy !== undefined) {
            try {
              const promotionResult = await input.advisoryPromotionPolicy.evaluate({
                query,
                observedAt,
                request: cloneContextPackBuildRequest(request),
                deterministicItems: cloneContextPackItems(deterministicItems),
                advisoryItems: cloneContextPackItems(admittedSynthesisItems),
                omissions: cloneContextPackOmissions(omissions),
                curationPlan: cloneContextPackCurationPlan(curationPlan),
              });
              const admittedPromotions = admitContextPackAdvisoryPromotions({
                result: promotionResult,
                deterministicItems,
                advisoryItems: admittedSynthesisItems,
              });
              lifecycleBlockers.push(...admittedPromotions.promotions.map((promotion) => promotion.lifecycleBlocker));
              omissions.push(...admittedPromotions.omittedItemsWithReason);
              curationTrace.push({
                stage: ContextPackCurationStageKind.AdvisoryPromotion,
                summary: `promoted ${admittedPromotions.promotions.length} synthesis advisories; omissions=${admittedPromotions.omittedItemsWithReason.length}`,
                evidenceRefs: admittedPromotions.evidenceRefs,
              });
            } catch (error) {
              omissions.push({
                reason: ContextPackOmissionReason.RetrievalFailed,
                message: `${ADVISORY_PROMOTION_POLICY_FAILED_MESSAGE}: ${errorMessage(error)}`,
              });
            }
          }
        } catch (error) {
          omissions.push({
            reason: ContextPackOmissionReason.RetrievalFailed,
            message: `${SYNTHESIS_FAILED_MESSAGE}: ${errorMessage(error)}`,
          });
        }
      } else if (synthesisRequirement.decision === ContextPackSynthesisRequirementDecision.Required) {
        omissions.push(requiredSynthesisUnavailableOmission(synthesisRequirement));
      }

      curationTrace.push({
        stage: ContextPackCurationStageKind.GapReview,
        summary: `omissions=${omissions.length}; contradictions=${contradictions.length}; uncertaintySignals=${uncertaintySignals.length}`,
        evidenceRefs: [
          ...omissions.map((omission) => omission.nodeId ?? omission.reason),
          ...uncertaintySignals.map(contextPackUncertaintySignalRef),
        ],
      });

      return {
        pack: {
          id: `ctx:${request.snapshot.runId}:${request.snapshot.hatAssignmentId}:${request.observedAt}`,
          runId: request.snapshot.runId,
          scope: request.snapshot.scope,
          hatAssignmentId: request.snapshot.hatAssignmentId,
          hatId: request.snapshot.hat.id,
          generatedAt: observedAt,
          freshnessDeadline: new Date(Date.parse(observedAt) + (input.freshnessWindowMs ?? DEFAULT_CONTEXT_PACK_FRESHNESS_WINDOW_MS)).toISOString(),
          sourceGraphVersion: documentResult.sourceGraphVersion,
          policyVersion: input.policyVersion ?? DEFAULT_CONTEXT_PACK_POLICY_VERSION,
          tokenBudget: input.tokenBudget ?? DEFAULT_CONTEXT_PACK_TOKEN_BUDGET,
          items,
          omittedItemsWithReason: omissions,
          contradictions,
          staleInputs: staleInputsFor(documentUnits),
          lifecycleBlockers,
          uncertaintySignals,
          curationTrace,
          curationPlan,
          ...contextPackScope(request.snapshot),
        },
      };
    },
  };
}

function retrievalContextFor(
  request: ContextPackBuildRequest,
  omissions: ContextPackOmittedItem[],
  focus: ContextPackDocumentFocus,
): RetrievalContext {
  const organizationId = request.snapshot.organizationId;
  if (organizationId === undefined) {
    omissions.push({
      reason: ContextPackOmissionReason.OutOfScope,
      message: "context pack retrieval requires an organization id",
    });
  }
  return {
    organizationId: organizationId ?? "",
    hatId: request.snapshot.hat.id,
    stageId: request.readout.phase,
    scopes: retrievalScopesFor(request.snapshot, request.hierarchy),
    preferredDocTypes: focus.preferredDocTypes,
    ...(request.snapshot.workItemId === undefined ? {} : { workItemId: request.snapshot.workItemId }),
  };
}

function retrievalScopesFor(snapshot: AgentObserveSnapshot, hierarchy: HierarchyReadout): readonly { kind: DocScopeKind; id: string }[] {
  const scopes: { kind: DocScopeKind; id: string }[] = [];
  if (snapshot.organizationId !== undefined) scopes.push({ kind: DocScopeKind.Organization, id: snapshot.organizationId });
  if (snapshot.projectId !== undefined) scopes.push({ kind: DocScopeKind.Project, id: snapshot.projectId });
  if (snapshot.teamId !== undefined) scopes.push({ kind: DocScopeKind.Team, id: snapshot.teamId });
  scopes.push({ kind: DocScopeKind.Department, id: snapshot.hat.departmentId });
  for (const documentationScope of snapshot.hat.documentationScopes) {
    scopes.push({ kind: DocScopeKind.Department, id: documentationScope });
  }
  const departmentId = hierarchy.projects.find((project) => project.projectId === snapshot.projectId)?.departmentId;
  if (departmentId !== undefined) scopes.push({ kind: DocScopeKind.Department, id: departmentId });
  return uniqueScopes(scopes);
}

function uniqueScopes(scopes: readonly { kind: DocScopeKind; id: string }[]): readonly { kind: DocScopeKind; id: string }[] {
  const seen = new Set<string>();
  return scopes.filter((scope) => {
    const key = `${scope.kind}:${scope.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function contextPackQuery(request: ContextPackBuildRequest, focus: ContextPackDocumentFocus): string {
  return [
    request.snapshot.hat.id,
    request.readout.phase,
    request.snapshot.scope,
    request.wakeContext?.reason,
    request.snapshot.projectId,
    request.snapshot.teamId,
    request.snapshot.workItemId,
    ...focus.queryTerms,
    ...request.hierarchy.priorityItems.map((item) => item.label),
    ...request.metrics.blocks.map((block) => `${block.label} ${block.value}`),
  ].filter((part): part is string => part !== undefined && part.length > 0).join(" ");
}

function documentFocusCurationStage(focus: ContextPackDocumentFocus): ContextPackCurationStage {
  return {
    stage: ContextPackCurationStageKind.DocumentFocus,
    summary: `document focus profile=${focus.profileId}; policy=${focus.policyVersion}; preferredDocTypes=${focus.preferredDocTypes.length}; queryTerms=${focus.queryTerms.length}`,
    evidenceRefs: [
      `document-focus-profile:${focus.profileId}`,
      `document-focus-policy:${focus.policyVersion}`,
      ...focus.preferredDocTypes.map((docType) => `preferred-doc-type:${docType}`),
      ...focus.queryTerms.map((term) => `focus-term:${term}`),
    ],
  };
}

function deterministicScopeSummary(request: ContextPackBuildRequest): string {
  return `scoped ${request.snapshot.hat.id} at ${request.snapshot.scope}/${request.readout.phase}`;
}

function deterministicScopeEvidenceRefs(request: ContextPackBuildRequest): readonly string[] {
  return [
    `hat:${request.snapshot.hat.id}`,
    `run:${request.snapshot.runId}`,
    ...(request.snapshot.organizationId === undefined ? [] : [`org:${request.snapshot.organizationId}`]),
    ...(request.snapshot.projectId === undefined ? [] : [`project:${request.snapshot.projectId}`]),
    ...(request.snapshot.teamId === undefined ? [] : [`team:${request.snapshot.teamId}`]),
    ...(request.snapshot.workItemId === undefined ? [] : [`work:${request.snapshot.workItemId}`]),
  ];
}

function uniqueDocUnits(units: readonly DocUnit[]): readonly DocUnit[] {
  const seen = new Set<string>();
  return units.filter((unit) => {
    if (seen.has(unit.docUnitId)) return false;
    seen.add(unit.docUnitId);
    return true;
  });
}

function docUnitContextItem(unit: DocUnit, request: ContextPackBuildRequest): ContextPackItem {
  return {
    id: `doc:${unit.docUnitId}`,
    kind: itemKindForDocType(unit.type),
    title: unit.title,
    summary: unit.summary,
    sourceRef: unit.contentRef,
    required: docUnitIsRequired(unit, request),
    freshness: freshnessForDocUnit(unit),
    confidence: docConfidence(unit),
    reasons: reasonsForDocUnit(unit, request),
    citationRefs: [`doc:${unit.docUnitId}`],
    sourcePointers: [docUnitSourcePointer(unit)],
  };
}

function itemKindForDocType(type: DocType): ContextPackItemKind {
  switch (type) {
    case DocType.Brd:
      return ContextPackItemKind.BusinessDocument;
    case DocType.Architecture:
    case DocType.Adr:
      return ContextPackItemKind.ArchitectureDocument;
    case DocType.DecisionRecord:
      return ContextPackItemKind.DecisionRecord;
    case DocType.MeetingNote:
      return ContextPackItemKind.Meeting;
    case DocType.Policy:
      return ContextPackItemKind.Policy;
    default:
      return ContextPackItemKind.Evidence;
  }
}

function docUnitIsRequired(unit: DocUnit, request: ContextPackBuildRequest): boolean {
  return (
    unit.boundHatIds.includes(request.snapshot.hat.id) ||
    unit.boundStageIds.includes(request.readout.phase) ||
    unit.type === DocType.Brd ||
    unit.type === DocType.Architecture ||
    unit.type === DocType.Adr ||
    unit.type === DocType.Policy ||
    isLoadBearing(unit.type)
  );
}

function freshnessForDocUnit(unit: DocUnit): ContextPackFreshness {
  switch (unit.status) {
    case "active":
      return ContextPackFreshness.Current;
    case "stale":
      return ContextPackFreshness.Stale;
    case "archived":
    case "superseded":
      return ContextPackFreshness.Archived;
    default:
      return ContextPackFreshness.Live;
  }
}

function docConfidence(unit: DocUnit): number {
  return docUnitIsCanonical(unit) ? 1 : 0.85;
}

function docUnitIsCanonical(unit: DocUnit): boolean {
  return unit.status === "active" && isLoadBearing(unit.type);
}

function reasonsForDocUnit(unit: DocUnit, request: ContextPackBuildRequest): readonly string[] {
  return [
    ...(unit.boundHatIds.includes(request.snapshot.hat.id) ? ["hat-bound consult"] : []),
    ...(unit.boundStageIds.includes(request.readout.phase) ? ["stage-bound consult"] : []),
    ...(unit.type === DocType.Brd ? ["business requirement"] : []),
    ...(unit.type === DocType.Adr || unit.type === DocType.Architecture ? ["architecture requirement"] : []),
    `scope:${unit.scopeKind}:${unit.scopeId}`,
  ];
}

function docUnitSourcePointer(unit: DocUnit): ContextPackSourcePointer {
  return {
    kind: ContextPackSourcePointerKind.DocUnit,
    docUnitId: unit.docUnitId,
    organizationId: unit.organizationId,
    docType: unit.type,
    scopeKind: unit.scopeKind,
    scopeId: unit.scopeId,
    contentRef: unit.contentRef,
    contentHash: unit.contentHash,
    sourceId: unit.sourceId,
    version: unit.version,
    ...(unit.provenanceChangeSetId === undefined ? {} : { provenanceChangeSetId: unit.provenanceChangeSetId }),
  };
}

async function hatCommunicationBriefContextItem(
  port: ContextPackHatCommunicationBriefPort,
  request: ContextPackBuildRequest,
  observedAt: string,
): Promise<{ ok: true; item: ContextPackItem } | { ok: false; omission: ContextPackOmittedItem }> {
  try {
    const result = await port.build({ request: cloneContextPackBuildRequest(request), observedAt });
    const validation = validateHatCommunicationBriefResult(result, request);
    if (validation !== undefined) {
      return hatCommunicationBriefOmission(validation, ContextPackOmissionReason.OutOfScope);
    }
    if (result.sourcePointers.length === 0 || result.citationRefs.length === 0) {
      return hatCommunicationBriefOmission("hat communication brief requires replayable provenance");
    }
    return {
      ok: true,
      item: {
        id: `hat_brief:${result.brief.hatId}`,
        kind: ContextPackItemKind.HatCommunicationBrief,
        title: `Hat communication brief: ${request.snapshot.hat.name}`,
        summary: hatCommunicationBriefSummary(result.brief),
        sourceRef: `policy:${HAT_COMMUNICATION_BRIEF_POLICY_ID}:${result.brief.hatId}`,
        required: true,
        freshness: ContextPackFreshness.Live,
        confidence: 1,
        reasons: [
          HatCommunicationBriefReason.Duty,
          HatCommunicationBriefReason.SupervisorRouting,
          HatCommunicationBriefReason.UpwardTools,
          HatCommunicationBriefReason.EvidenceProtocol,
          `supervisor:${result.brief.supervisor.targetHatId}`,
          `policy:${result.policyVersion}`,
        ],
        citationRefs: result.citationRefs,
        sourcePointers: result.sourcePointers,
      },
    };
  } catch (error) {
    return hatCommunicationBriefOmission(errorMessage(error));
  }
}

function validateHatCommunicationBriefResult(
  result: ContextPackHatCommunicationBriefResult,
  request: ContextPackBuildRequest,
): string | undefined {
  if (result.brief.hatId !== request.snapshot.hat.id) {
    return "hat communication brief must match active hat";
  }
  const allowedSupervisors = request.snapshot.hat.reportsToHatIds;
  const targetHatId = result.brief.supervisor.targetHatId;
  const rootSelfTarget = allowedSupervisors.length === 0 && targetHatId === request.snapshot.hat.id;
  if (!rootSelfTarget && !allowedSupervisors.includes(targetHatId)) {
    return "hat communication brief supervisor must match active hat supervisor graph";
  }
  return undefined;
}

function hatCommunicationBriefOmission(
  message: string,
  reason: ContextPackOmissionReason = ContextPackOmissionReason.RetrievalFailed,
): { ok: false; omission: ContextPackOmittedItem } {
  return {
    ok: false,
    omission: {
      nodeId: HAT_COMMUNICATION_BRIEF_POLICY_ID,
      reason,
      message: `${HAT_COMMUNICATION_BRIEF_FAILED_MESSAGE}: ${message}`,
    },
  };
}

function hatCommunicationBriefSummary(brief: ReturnType<typeof buildHatCommunicationBrief>): string {
  return [
    `Duty: ${brief.duty}`,
    `Route upward signals from ${brief.sourceLevel} to supervisor ${brief.supervisor.targetLevel}:${brief.supervisor.targetHatId}.`,
    `Available upward tools: ${brief.availableTools.map(formatSupervisorToolBrief).join("; ")}.`,
  ].join(" ");
}

function formatSupervisorToolBrief(tool: SupervisorSignalToolBrief): string {
  return `${tool.toolType} when ${tool.useWhen}; required evidence: ${tool.requiredEvidence.join(", ")}`;
}

function supervisorChainLevelForHatLevel(level: HatLevel): SupervisorChainLevel {
  switch (level) {
    case HatLevel.ExecutiveBoard:
      return SupervisorChainLevel.ExecutiveBoard;
    case HatLevel.CSuite:
      return SupervisorChainLevel.CSuite;
    case HatLevel.Director:
      return SupervisorChainLevel.Director;
    case HatLevel.Manager:
      return SupervisorChainLevel.Manager;
    case HatLevel.Lead:
    case HatLevel.IndividualContributor:
      return SupervisorChainLevel.TeamMember;
  }
}

type ContextPackGraphRoot = {
  nodeId: string;
  title: string;
  citationRefs: readonly string[];
  reasons: readonly string[];
};

function graphRootsFor(
  request: ContextPackBuildRequest,
  units: readonly DocUnit[],
  nodeIdForDocUnit: ((unit: DocUnit) => string | null) | undefined,
  graphRootNodeIds: ((request: ContextPackBuildRequest) => readonly string[]) | undefined,
  graphRootSeeds: ((request: ContextPackBuildRequest) => readonly ContextPackGraphRootSeed[]) | undefined,
  lifecycleAnchorGraphRootSeeds: readonly ContextPackGraphRootSeed[] = [],
  inboxAnchorGraphRootSeeds: readonly ContextPackGraphRootSeed[] = [],
  telemetryGraphRootSeeds: readonly ContextPackGraphRootSeed[] = [],
): readonly ContextPackGraphRoot[] {
  return mergeGraphRootsByNodeId([
    ...(graphRootSeeds?.(cloneContextPackBuildRequest(request)) ?? []).map(graphRootForSeed),
    ...lifecycleAnchorGraphRootSeeds.map(graphRootForSeed),
    ...inboxAnchorGraphRootSeeds.map(graphRootForSeed),
    ...telemetryGraphRootSeeds.map(graphRootForSeed),
    ...graphRootsForDocuments(units, nodeIdForDocUnit),
    ...(graphRootNodeIds?.(cloneContextPackBuildRequest(request)) ?? []).map((nodeId) => graphRootForSeed({ nodeId })),
  ]);
}

function mergeGraphRootsByNodeId(roots: readonly ContextPackGraphRoot[]): readonly ContextPackGraphRoot[] {
  const merged = new Map<string, ContextPackGraphRoot>();
  for (const root of roots) {
    const existing = merged.get(root.nodeId);
    if (existing === undefined) {
      merged.set(root.nodeId, root);
      continue;
    }
    merged.set(root.nodeId, {
      ...existing,
      citationRefs: uniqueStrings([...existing.citationRefs, ...root.citationRefs]),
      reasons: uniqueStrings([...existing.reasons, ...root.reasons]),
    });
  }
  return [...merged.values()];
}

function graphRootForSeed(seed: ContextPackGraphRootSeed): ContextPackGraphRoot {
  return {
    nodeId: seed.nodeId,
    title: seed.title ?? `Graph neighborhood for ${seed.nodeId}`,
    citationRefs: seed.citationRefs ?? [`graph:${seed.nodeId}`],
    reasons: seed.reasons ?? [DEFAULT_GRAPH_ROOT_REASON],
  };
}

function graphRootsForDocuments(
  units: readonly DocUnit[],
  nodeIdForDocUnit: ((unit: DocUnit) => string | null) | undefined,
): readonly ContextPackGraphRoot[] {
  if (nodeIdForDocUnit === undefined) return [];
  return units.flatMap((unit) => {
    const nodeId = nodeIdForDocUnit(cloneDocUnit(unit));
    if (nodeId === null) return [];
    return [
      {
        nodeId,
        title: `Graph neighborhood for ${unit.title}`,
        citationRefs: [`doc:${unit.docUnitId}`, `graph:${nodeId}`],
        reasons: ["document graph traversal"],
      },
    ];
  });
}

async function graphItemsForRoots(
  graph: GraphStoreReader,
  roots: readonly ContextPackGraphRoot[],
  request: ContextPackBuildRequest,
): Promise<{ items: readonly ContextPackItem[]; omissions: readonly ContextPackOmittedItem[] }> {
  const items: ContextPackItem[] = [];
  const omissions: ContextPackOmittedItem[] = [];
  for (const root of roots) {
    try {
      const [neighborhood, outEdges, inEdges] = await Promise.all([
        deriveNeighborhood(graph, request.snapshot.organizationId ?? "", root.nodeId),
        graph.outEdges(request.snapshot.organizationId ?? "", root.nodeId),
        graph.inEdges(request.snapshot.organizationId ?? "", root.nodeId),
      ]);
      const activeOut = outEdges.filter((edge) => isActiveConfidence(edge.confidence));
      const activeIn = inEdges.filter((edge) => isActiveConfidence(edge.confidence));
      items.push({
        id: `graph:${root.nodeId}`,
        kind: ContextPackItemKind.GraphNeighborhood,
        title: root.title,
        summary: `outbound=${activeOut.length}; inbound=${activeIn.length}; changes=${neighborhood.changeSets.length}`,
        sourceRef: `graph:${root.nodeId}`,
        required: false,
        freshness: ContextPackFreshness.Live,
        confidence: 0.9,
        reasons: root.reasons,
        citationRefs: root.citationRefs,
        sourcePointers: [
          { kind: ContextPackSourcePointerKind.GraphNode, nodeId: root.nodeId },
          ...activeOut.map(graphEdgeSourcePointer),
          ...activeIn.map(graphEdgeSourcePointer),
        ],
      });
    } catch (error) {
      omissions.push({
        nodeId: root.nodeId,
        reason: ContextPackOmissionReason.RetrievalFailed,
        message: `${GRAPH_RETRIEVAL_FAILED_MESSAGE}: ${errorMessage(error)}`,
      });
    }
  }
  return { items, omissions };
}

function synthesisBriefingContextItem(
  briefing: ContextPackEphemeralSynthesisBriefing | undefined,
  items: readonly ContextPackItem[],
  request: ContextPackBuildRequest,
  uncertaintySignals: readonly ContextPackUncertaintySignal[],
): { ok: true; item?: ContextPackItem | undefined } | { ok: false; omission: ContextPackOmittedItem } {
  if (briefing === undefined) return { ok: true };
  if (briefing.evidenceRefs.length === 0) {
    return ungroundedSynthesisBriefingOmission();
  }
  const citedItems = contextItemsForEvidenceRefs(items, briefing.evidenceRefs);
  if (citedItems.length !== briefing.evidenceRefs.length) {
    return ungroundedSynthesisBriefingOmission();
  }
  const sourcePointers = uniqueSourcePointers(citedItems.flatMap((item) => item.sourcePointers ?? []));
  if (sourcePointers.length === 0) {
    return ungroundedSynthesisBriefingOmission();
  }
  return {
    ok: true,
    item: {
      id: synthesisBriefingItemId(request),
      kind: ContextPackItemKind.SynthesisBriefing,
      title: briefing.title,
      summary: briefing.summary,
      sourceRef: `synthesis:${request.snapshot.hat.id}:${request.snapshot.runId}`,
      required: false,
      freshness: ContextPackFreshness.Live,
      confidence: calibratedSynthesisConfidence(briefing.confidence, citedItems),
      confidenceBasis: synthesisConfidenceBasis(
        briefing.confidence,
        citedItems,
        briefing.uncertaintyExplanation,
        uncertaintySignalsForCitedItems(citedItems, uncertaintySignals),
      ),
      reasons: briefing.reasons ?? [`hat:${request.snapshot.hat.id}`, `scope:${request.snapshot.scope}`],
      citationRefs: briefing.evidenceRefs,
      sourcePointers,
    },
  };
}

function synthesisAdvisoryContextItems(
  synthesis: ContextPackEphemeralSynthesisResult,
  items: readonly ContextPackItem[],
  groundingOmissions: readonly ContextPackOmittedItem[],
  request: ContextPackBuildRequest,
  uncertaintySignals: readonly ContextPackUncertaintySignal[],
): { items: readonly ContextPackItem[]; omissions: readonly ContextPackOmittedItem[] } {
  const converted: ContextPackItem[] = [];
  const omissions: ContextPackOmittedItem[] = [];
  const append = (
    result: { ok: true; item: ContextPackItem } | { ok: false; omission: ContextPackOmittedItem },
  ): void => {
    if (result.ok) converted.push(result.item);
    else omissions.push(result.omission);
  };

  (synthesis.rankedContextRefs ?? []).forEach((ranked, index) => {
    append(synthesisRankedContextItem(ranked, index, items, groundingOmissions, request, uncertaintySignals));
  });
  (synthesis.gapHypotheses ?? []).forEach((gap, index) => {
    append(synthesisGapHypothesisItem(gap, index, items, groundingOmissions, request, uncertaintySignals));
  });
  (synthesis.questions ?? []).forEach((question, index) => {
    append(synthesisQuestionItem(question, index, items, groundingOmissions, request, uncertaintySignals));
  });
  (synthesis.recommendedActionRefs ?? []).forEach((action, index) => {
    append(synthesisRecommendedActionItem(action, index, items, groundingOmissions, request, uncertaintySignals));
  });

  return { items: converted, omissions };
}

function groundedSynthesisCurationEvidenceRefs(
  evidenceRefs: readonly string[],
  items: readonly ContextPackItem[],
): { evidenceRefs: readonly string[]; omissions: readonly ContextPackOmittedItem[] } {
  const validItemIds = new Set(items.map((item) => item.id));
  const accepted: string[] = [];
  const omissions: ContextPackOmittedItem[] = [];
  for (const evidenceRef of uniqueStrings(evidenceRefs)) {
    if (validItemIds.has(evidenceRef)) {
      accepted.push(evidenceRef);
      continue;
    }
    omissions.push(ungroundedSynthesisCurationEvidenceOmission(evidenceRef));
  }
  return { evidenceRefs: accepted, omissions };
}

function contextPackUncertaintySignalsFor(
  items: readonly ContextPackItem[],
  omissions: readonly ContextPackOmittedItem[],
  conflicts: readonly { a: DocUnit; b: DocUnit }[],
): readonly ContextPackUncertaintySignal[] {
  const signals: ContextPackUncertaintySignal[] = [];
  const itemIds = new Set(items.map((item) => item.id));
  items.forEach((item) => {
    if (item.freshness === ContextPackFreshness.Stale || item.freshness === ContextPackFreshness.Archived) {
      signals.push({
        kind: ContextPackUncertaintySignalKind.StaleEvidence,
        severity: ContextPackUncertaintySeverity.High,
        evidenceRefs: [item.id],
        message: `Evidence ${item.id} is ${item.freshness}.`,
      });
    }
    if (item.confidence < LOW_CONFIDENCE_EVIDENCE_THRESHOLD) {
      signals.push({
        kind: ContextPackUncertaintySignalKind.LowConfidenceEvidence,
        severity: ContextPackUncertaintySeverity.Medium,
        evidenceRefs: [item.id],
        message: `Evidence ${item.id} confidence ${item.confidence} is below the strong-evidence threshold.`,
      });
    }
    if (item.kind === ContextPackItemKind.MemoryPointer && memoryPointerIsAdvisory(item)) {
      const similarityCategory = memoryPointerSimilarityCategoryFor(item);
      signals.push({
        kind: ContextPackUncertaintySignalKind.IndirectEvidence,
        severity: ContextPackUncertaintySeverity.Medium,
        evidenceRefs: [item.id],
        message: memoryPointerIndirectEvidenceMessage(item.id, similarityCategory),
      });
    }
  });
  conflicts.forEach((conflict) => {
    const evidenceRefs = [`doc:${conflict.a.docUnitId}`, `doc:${conflict.b.docUnitId}`].filter((ref) => itemIds.has(ref));
    if (evidenceRefs.length > 1) {
      signals.push({
        kind: ContextPackUncertaintySignalKind.ConflictingEvidence,
        severity: ContextPackUncertaintySeverity.High,
        evidenceRefs,
        message: `Documents ${conflict.a.docUnitId} and ${conflict.b.docUnitId} conflict.`,
      });
    }
  });
  omissions
    .filter((omission) => omission.reason === ContextPackOmissionReason.StaleInput && omission.nodeId !== undefined)
    .forEach((omission) => {
      signals.push({
        kind: ContextPackUncertaintySignalKind.StaleEvidence,
        severity: ContextPackUncertaintySeverity.High,
        evidenceRefs: [omission.nodeId!],
        message: omission.message,
      });
    });
  return uniqueContextPackUncertaintySignals(signals);
}

function memoryPointerIsAdvisory(item: ContextPackItem): boolean {
  return (item.sourcePointers ?? []).some((pointer) =>
    pointer.kind === ContextPackSourcePointerKind.HindsightMemory && pointer.advisory
  );
}

function memoryPointerSimilarityCategoryFor(item: ContextPackItem): ContextPackMemorySimilarityCategory | undefined {
  for (const pointer of item.sourcePointers ?? []) {
    if (pointer.kind === ContextPackSourcePointerKind.HindsightMemory && pointer.similarityCategory !== undefined) {
      return pointer.similarityCategory;
    }
  }
  return undefined;
}

function memoryPointerIndirectEvidenceMessage(
  itemId: string,
  similarityCategory: ContextPackMemorySimilarityCategory | undefined,
): string {
  if (similarityCategory === undefined) {
    return `Evidence ${itemId} is advisory memory, not source-of-truth context.`;
  }
  return `Evidence ${itemId} is advisory memory with ${similarityCategory} similarity, not source-of-truth context.`;
}

function uniqueContextPackUncertaintySignals(
  signals: readonly ContextPackUncertaintySignal[],
): readonly ContextPackUncertaintySignal[] {
  const byKey = new Map<string, ContextPackUncertaintySignal>();
  signals.forEach((signal) => {
    const evidenceRefs = uniqueStrings(signal.evidenceRefs);
    const key = `${signal.kind}:${evidenceRefs.join("|")}`;
    if (!byKey.has(key)) {
      byKey.set(key, { ...signal, evidenceRefs });
    }
  });
  return [...byKey.values()];
}

function contextPackUncertaintySignalRef(signal: ContextPackUncertaintySignal): string {
  return [
    UNCERTAINTY_SIGNAL_REF_PREFIX,
    signal.kind,
    ...signal.evidenceRefs.map(synthesisIdToken),
  ].join(":");
}

function uncertaintySignalsForCitedItems(
  citedItems: readonly ContextPackItem[],
  signals: readonly ContextPackUncertaintySignal[],
): readonly ContextPackUncertaintySignal[] {
  const citedItemIds = new Set(citedItems.map((item) => item.id));
  return signals.filter((signal) => signal.evidenceRefs.some((ref) => citedItemIds.has(ref)));
}

function synthesisRankedContextItem(
  ranked: ContextPackEphemeralRankedContextRef,
  index: number,
  items: readonly ContextPackItem[],
  omissions: readonly ContextPackOmittedItem[],
  request: ContextPackBuildRequest,
  uncertaintySignals: readonly ContextPackUncertaintySignal[],
): { ok: true; item: ContextPackItem } | { ok: false; omission: ContextPackOmittedItem } {
  if (
    ranked.evidenceRefs.length === 0 ||
    !contextEvidenceRefsAreGrounded(items, omissions, ranked.evidenceRefs)
  ) {
    return ungroundedSynthesisAdvisoryOmission();
  }
  if (contextItemsForEvidenceRefs(items, [ranked.itemId]).length !== 1) {
    return ungroundedSynthesisRankedTargetOmission(ranked.itemId);
  }
  return groundedSynthesisAdvisoryItem({
    evidenceRefs: ranked.evidenceRefs,
    items,
    omissions,
    id: `${synthesisBaseId(request)}:${SynthesisAdvisoryIdPart.Ranked}:${index}:${synthesisIdToken(ranked.itemId)}`,
    kind: ContextPackItemKind.SynthesisRankedContext,
    title: `Ranked context: ${ranked.itemId}`,
    summary: ranked.reason,
    sourceRef: `${synthesisBaseRef(request)}:${SynthesisAdvisoryIdPart.Ranked}:${index}:${synthesisIdToken(ranked.itemId)}`,
    reasons: [SynthesisAdvisoryReason.RankedContext, `target:${ranked.itemId}`],
    uncertaintyExplanation: ranked.uncertaintyExplanation,
    uncertaintySignals,
  });
}

function synthesisGapHypothesisItem(
  gap: ContextPackEphemeralGapHypothesis,
  index: number,
  items: readonly ContextPackItem[],
  omissions: readonly ContextPackOmittedItem[],
  request: ContextPackBuildRequest,
  uncertaintySignals: readonly ContextPackUncertaintySignal[],
): { ok: true; item: ContextPackItem } | { ok: false; omission: ContextPackOmittedItem } {
  return groundedSynthesisAdvisoryItem({
    evidenceRefs: gap.evidenceRefs,
    items,
    omissions,
    id: `${synthesisBaseId(request)}:${SynthesisAdvisoryIdPart.Gap}:${index}`,
    kind: ContextPackItemKind.SynthesisGapHypothesis,
    title: "Gap hypothesis",
    summary: gap.suggestedNextStep === undefined ? gap.message : `${gap.message} Suggested next step: ${gap.suggestedNextStep}`,
    sourceRef: `${synthesisBaseRef(request)}:${SynthesisAdvisoryIdPart.Gap}:${index}`,
    confidence: gap.confidence,
    reasons: [SynthesisAdvisoryReason.GapHypothesis],
    uncertaintyExplanation: gap.uncertaintyExplanation,
    uncertaintySignals,
  });
}

function synthesisQuestionItem(
  question: ContextPackEphemeralQuestion,
  index: number,
  items: readonly ContextPackItem[],
  omissions: readonly ContextPackOmittedItem[],
  request: ContextPackBuildRequest,
  uncertaintySignals: readonly ContextPackUncertaintySignal[],
): { ok: true; item: ContextPackItem } | { ok: false; omission: ContextPackOmittedItem } {
  return groundedSynthesisAdvisoryItem({
    evidenceRefs: question.evidenceRefs,
    items,
    omissions,
    id: `${synthesisBaseId(request)}:${SynthesisAdvisoryIdPart.Question}:${index}`,
    kind: ContextPackItemKind.SynthesisQuestion,
    title: "Follow-up question",
    summary: question.question,
    sourceRef: `${synthesisBaseRef(request)}:${SynthesisAdvisoryIdPart.Question}:${index}`,
    reasons: [
      SynthesisAdvisoryReason.FollowUpQuestion,
      ...(question.audienceHatLevel === undefined ? [] : [`audience:${question.audienceHatLevel}`]),
    ],
    uncertaintyExplanation: question.uncertaintyExplanation,
    uncertaintySignals,
  });
}

function synthesisRecommendedActionItem(
  action: ContextPackEphemeralRecommendedActionRef,
  index: number,
  items: readonly ContextPackItem[],
  omissions: readonly ContextPackOmittedItem[],
  request: ContextPackBuildRequest,
  uncertaintySignals: readonly ContextPackUncertaintySignal[],
): { ok: true; item: ContextPackItem } | { ok: false; omission: ContextPackOmittedItem } {
  if (!request.readout.options.some((option) => option.actionType === action.actionType)) {
    return illegalSynthesisActionOmission(action.actionType);
  }
  const actionLabel = action.direction ?? action.actionType;
  return groundedSynthesisAdvisoryItem({
    evidenceRefs: action.evidenceRefs,
    items,
    omissions,
    id: `${synthesisBaseId(request)}:${SynthesisAdvisoryIdPart.Action}:${index}`,
    kind: ContextPackItemKind.SynthesisRecommendedAction,
    title: `Recommended action: ${actionLabel}`,
    summary: action.reason,
    sourceRef: `${synthesisBaseRef(request)}:${SynthesisAdvisoryIdPart.Action}:${index}`,
    reasons: [SynthesisAdvisoryReason.RecommendedAction, `action:${action.actionType}`],
    uncertaintyExplanation: action.uncertaintyExplanation,
    uncertaintySignals,
  });
}

function groundedSynthesisAdvisoryItem(input: {
  evidenceRefs: readonly string[];
  items: readonly ContextPackItem[];
  omissions: readonly ContextPackOmittedItem[];
  id: string;
  kind: ContextPackItemKind;
  title: string;
  summary: string;
  sourceRef: string;
  reasons: readonly string[];
  confidence?: number | undefined;
  uncertaintyExplanation?: string | undefined;
  uncertaintySignals: readonly ContextPackUncertaintySignal[];
}): { ok: true; item: ContextPackItem } | { ok: false; omission: ContextPackOmittedItem } {
  if (input.evidenceRefs.length === 0) return ungroundedSynthesisAdvisoryOmission();
  if (!contextEvidenceRefsAreGrounded(input.items, input.omissions, input.evidenceRefs)) {
    return ungroundedSynthesisAdvisoryOmission();
  }
  const citedItems = uniqueContextItems(contextItemsForEvidenceRefs(input.items, input.evidenceRefs));
  const sourcePointers = uniqueSourcePointers(citedItems.flatMap((item) => item.sourcePointers ?? []));
  if (sourcePointers.length === 0) return ungroundedSynthesisAdvisoryOmission();
  return {
    ok: true,
    item: {
      id: input.id,
      kind: input.kind,
      title: input.title,
      summary: input.summary,
      sourceRef: input.sourceRef,
      required: false,
      freshness: ContextPackFreshness.Live,
      confidence: calibratedSynthesisConfidence(input.confidence, citedItems),
      confidenceBasis: synthesisConfidenceBasis(
        input.confidence,
        citedItems,
        input.uncertaintyExplanation,
        uncertaintySignalsForCitedItems(citedItems, input.uncertaintySignals),
      ),
      reasons: input.reasons,
      citationRefs: input.evidenceRefs,
      sourcePointers,
    },
  };
}

function contextEvidenceRefsAreGrounded(
  items: readonly ContextPackItem[],
  omissions: readonly ContextPackOmittedItem[],
  evidenceRefs: readonly string[],
): boolean {
  const itemEvidenceRefs = new Set(items.flatMap((item) => [
    item.id,
    item.sourceRef,
    ...(item.citationRefs ?? []),
  ]));
  const omissionEvidenceRefs = new Set(omissions.map(contextOmissionRef));
  return evidenceRefs.every((ref) => itemEvidenceRefs.has(ref) || omissionEvidenceRefs.has(ref));
}

function uniqueContextItems(items: readonly ContextPackItem[]): readonly ContextPackItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function contextItemsForEvidenceRefs(
  items: readonly ContextPackItem[],
  evidenceRefs: readonly string[],
): readonly ContextPackItem[] {
  return evidenceRefs.flatMap((ref) => {
    const item = items.find((candidate) =>
      candidate.id === ref ||
      candidate.sourceRef === ref ||
      (candidate.citationRefs ?? []).includes(ref)
    );
    return item === undefined ? [] : [item];
  });
}

function ungroundedSynthesisBriefingOmission(): { ok: false; omission: ContextPackOmittedItem } {
  return {
    ok: false,
    omission: {
      reason: ContextPackOmissionReason.RetrievalFailed,
      message: UNGROUNDED_SYNTHESIS_BRIEFING_MESSAGE,
    },
  };
}

function ungroundedSynthesisAdvisoryOmission(): { ok: false; omission: ContextPackOmittedItem } {
  return {
    ok: false,
    omission: {
      reason: ContextPackOmissionReason.RetrievalFailed,
      message: UNGROUNDED_SYNTHESIS_ADVISORY_MESSAGE,
    },
  };
}

function ungroundedSynthesisRankedTargetOmission(itemId: string): { ok: false; omission: ContextPackOmittedItem } {
  return {
    ok: false,
    omission: {
      nodeId: `${SYNTHESIS_CURATION_EVIDENCE_NODE_ID_PREFIX}:${itemId}`,
      reason: ContextPackOmissionReason.RetrievalFailed,
      message: UNGROUNDED_SYNTHESIS_RANKED_TARGET_MESSAGE,
    },
  };
}

function illegalSynthesisActionOmission(actionType: string): { ok: false; omission: ContextPackOmittedItem } {
  return {
    ok: false,
    omission: {
      nodeId: `synthesis_action:${actionType}`,
      reason: ContextPackOmissionReason.OutOfScope,
      message: ILLEGAL_SYNTHESIS_ACTION_MESSAGE,
    },
  };
}

function ungroundedSynthesisCurationEvidenceOmission(evidenceRef: string): ContextPackOmittedItem {
  return {
    nodeId: `${SYNTHESIS_CURATION_EVIDENCE_NODE_ID_PREFIX}:${evidenceRef}`,
    reason: ContextPackOmissionReason.RetrievalFailed,
    message: UNGROUNDED_SYNTHESIS_CURATION_EVIDENCE_MESSAGE,
  };
}

function contextOmissionRef(omission: ContextPackOmittedItem): string {
  return omission.nodeId ?? omission.reason;
}

function synthesisBriefingItemId(request: ContextPackBuildRequest): string {
  return synthesisBaseId(request);
}

function synthesisBaseId(request: ContextPackBuildRequest): string {
  return [
    SYNTHESIS_BRIEFING_ITEM_ID_PREFIX,
    request.snapshot.hat.id,
    request.snapshot.runId,
    request.snapshot.hatAssignmentId,
  ].join(":");
}

function synthesisBaseRef(request: ContextPackBuildRequest): string {
  return `${SYNTHESIS_BRIEFING_ITEM_ID_PREFIX}:${request.snapshot.hat.id}:${request.snapshot.runId}`;
}

function synthesisIdToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}

function minimumContextItemConfidence(items: readonly ContextPackItem[]): number {
  return items.reduce((minimum, item) => Math.min(minimum, item.confidence), 1);
}

function calibratedSynthesisConfidence(
  modelConfidence: number | undefined,
  citedItems: readonly ContextPackItem[],
): number {
  const evidenceCeiling = minimumContextItemConfidence(citedItems);
  if (modelConfidence === undefined) return evidenceCeiling;
  return Math.min(modelConfidence, evidenceCeiling);
}

function synthesisConfidenceBasis(
  modelConfidence: number | undefined,
  citedItems: readonly ContextPackItem[],
  uncertaintyExplanation: string | undefined,
  uncertaintySignals: readonly ContextPackUncertaintySignal[],
): ContextPackConfidenceBasis {
  return {
    kind: ContextPackConfidenceBasisKind.CitedEvidenceCeiling,
    evidenceConfidenceCeiling: minimumContextItemConfidence(citedItems),
    citedEvidenceRefs: citedItems.map((item) => item.id),
    ...(modelConfidence === undefined ? {} : { modelConfidence }),
    ...(uncertaintyExplanation === undefined ? {} : { uncertaintyExplanation }),
    ...(uncertaintySignals.length === 0
      ? {}
      : { uncertaintySignals: cloneContextPackUncertaintySignals(uncertaintySignals) }),
  };
}

function uniqueSourcePointers(pointers: readonly ContextPackSourcePointer[]): readonly ContextPackSourcePointer[] {
  const seen = new Set<string>();
  return pointers.filter((pointer) => {
    const key = contextPackSourcePointerKey(pointer);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function contextPackSourcePointerKey(pointer: ContextPackSourcePointer): string {
  switch (pointer.kind) {
    case ContextPackSourcePointerKind.DocUnit:
      return `${pointer.kind}:${pointer.docUnitId}:${pointer.version}`;
    case ContextPackSourcePointerKind.GitBlob:
      return `${pointer.kind}:${pointer.path}:${pointer.commitSha ?? ""}:${pointer.blobSha ?? ""}`;
    case ContextPackSourcePointerKind.GraphNode:
      return `${pointer.kind}:${pointer.nodeId}`;
    case ContextPackSourcePointerKind.GraphEdge:
      return `${pointer.kind}:${pointer.edgeId}`;
    case ContextPackSourcePointerKind.HindsightMemory:
      return `${pointer.kind}:${pointer.providerId}:${pointer.memoryId}`;
    case ContextPackSourcePointerKind.WorkItem:
      return `${pointer.kind}:${pointer.workItemId}`;
    case ContextPackSourcePointerKind.Decision:
      return `${pointer.kind}:${pointer.decisionId}`;
    case ContextPackSourcePointerKind.Discussion:
      return `${pointer.kind}:${pointer.discussionId}`;
    case ContextPackSourcePointerKind.InboxAnchor:
      return `${pointer.kind}:${pointer.inboxAnchorId}:${pointer.targetHatAssignmentId ?? ""}:${pointer.targetAgentId ?? ""}`;
    case ContextPackSourcePointerKind.Meeting:
      return `${pointer.kind}:${pointer.meetingId}:${pointer.workScheduleBlockId ?? ""}:${pointer.discussionAnchorId ?? ""}`;
    case ContextPackSourcePointerKind.QualityGate:
      return `${pointer.kind}:${pointer.qualityGateEvaluationId}`;
    case ContextPackSourcePointerKind.ScheduleBlock:
      return `${pointer.kind}:${pointer.workScheduleBlockId}`;
    case ContextPackSourcePointerKind.SupervisorSignal:
      return `${pointer.kind}:${pointer.supervisorSignalId}`;
    case ContextPackSourcePointerKind.Trace:
      return `${pointer.kind}:${pointer.traceId}`;
    case ContextPackSourcePointerKind.Metric:
      return `${pointer.kind}:${pointer.source}:${pointer.query}:${pointer.seriesId ?? ""}`;
    case ContextPackSourcePointerKind.Log:
      return `${pointer.kind}:${pointer.source}:${pointer.query}:${pointer.logRef}`;
    case ContextPackSourcePointerKind.Policy:
      return `${pointer.kind}:${pointer.policyId}:${pointer.version ?? ""}`;
  }
}

function graphEdgeSourcePointer(edge: GraphEdge): ContextPackSourcePointer {
  return {
    kind: ContextPackSourcePointerKind.GraphEdge,
    edgeId: edge.edgeId,
    fromNodeId: edge.fromNodeId,
    toNodeId: edge.toNodeId,
  };
}

async function telemetryEvidenceItemsFor(
  telemetryEvidence: ContextPackTelemetryEvidencePort,
  request: ContextPackBuildRequest,
  query: string,
  observedAt: string,
  items: readonly ContextPackItem[],
): Promise<{
  items: readonly ContextPackItem[];
  omissions: readonly ContextPackOmittedItem[];
  graphRootSeeds: readonly ContextPackGraphRootSeed[];
}> {
  try {
    const result = await telemetryEvidence.load({
      query,
      observedAt,
      request: cloneContextPackBuildRequest(request),
      items: cloneContextPackItems(items),
    });
    return {
      items: cloneContextPackItems(result.items),
      omissions: result.omittedItemsWithReason ?? [],
      graphRootSeeds: cloneGraphRootSeeds(result.graphRootSeeds ?? []),
    };
  } catch (error) {
    return {
      items: [],
      omissions: [{
        nodeId: TELEMETRY_EVIDENCE_NODE_ID,
        reason: ContextPackOmissionReason.RetrievalFailed,
        message: `${TELEMETRY_EVIDENCE_RETRIEVAL_FAILED_MESSAGE}: ${errorMessage(error)}`,
      }],
      graphRootSeeds: [],
    };
  }
}

async function memoryItemsFor(
  memory: ContextPackMemoryRecallPort,
  request: ContextPackBuildRequest,
  query: string,
): Promise<{ items: readonly ContextPackItem[]; omissions: readonly ContextPackOmittedItem[] }> {
  try {
    const recalled = await memory.recall({
      query,
      runId: request.snapshot.runId,
      observedAt: request.observedAt,
      hatId: request.snapshot.hat.id,
      hatAssignmentId: request.snapshot.hatAssignmentId,
      agentId: request.snapshot.agentId,
      organizationId: request.snapshot.organizationId,
      projectId: request.snapshot.projectId,
      teamId: request.snapshot.teamId,
      workItemId: request.snapshot.workItemId,
    });
    return {
      items: recalled.memories.map(memoryContextItem),
      omissions: recalled.omittedItemsWithReason ?? [],
    };
  } catch (error) {
    return {
      items: [],
      omissions: [
        {
          reason: ContextPackOmissionReason.RetrievalFailed,
          message: `${MEMORY_RETRIEVAL_FAILED_MESSAGE}: ${errorMessage(error)}`,
        },
      ],
    };
  }
}

async function lifecycleAnchorItemsFor(
  lifecycleAnchors: ContextPackLifecycleAnchorPort,
  request: ContextPackBuildRequest,
  query: string,
  observedAt: string,
): Promise<{
  items: readonly ContextPackItem[];
  omissions: readonly ContextPackOmittedItem[];
  graphRootSeeds: readonly ContextPackGraphRootSeed[];
}> {
  try {
    const result = await lifecycleAnchors.load({ query, observedAt, request: cloneContextPackBuildRequest(request) });
    const validated = validateLifecycleAnchorItems(result.items, request);
    const acceptedGraphNodeIds = graphNodeIdsForContextItems(validated.items);
    return {
      items: validated.items,
      omissions: [...(result.omittedItemsWithReason ?? []), ...validated.omissions],
      graphRootSeeds: (result.graphRootSeeds ?? []).filter((seed) => acceptedGraphNodeIds.has(seed.nodeId)),
    };
  } catch (error) {
    return {
      items: [],
      graphRootSeeds: [],
      omissions: [
        {
          nodeId: LIFECYCLE_ANCHORS_NODE_ID,
          reason: ContextPackOmissionReason.RetrievalFailed,
          message: `${LIFECYCLE_ANCHOR_RETRIEVAL_FAILED_MESSAGE}: ${errorMessage(error)}`,
        },
      ],
    };
  }
}

async function inboxAnchorItemsFor(
  inboxAnchors: ContextPackInboxAnchorPort,
  request: ContextPackBuildRequest,
  query: string,
  observedAt: string,
): Promise<{
  items: readonly ContextPackItem[];
  omissions: readonly ContextPackOmittedItem[];
  graphRootSeeds: readonly ContextPackGraphRootSeed[];
}> {
  try {
    const result = await inboxAnchors.load({ query, observedAt, request: cloneContextPackBuildRequest(request) });
    const validated = validateInboxAnchorItems(result.items, request);
    const acceptedGraphNodeIds = graphNodeIdsForContextItems(validated.items);
    return {
      items: validated.items,
      omissions: [...(result.omittedItemsWithReason ?? []), ...validated.omissions],
      graphRootSeeds: (result.graphRootSeeds ?? []).filter((seed) => acceptedGraphNodeIds.has(seed.nodeId)),
    };
  } catch (error) {
    return {
      items: [],
      graphRootSeeds: [],
      omissions: [
        {
          nodeId: INBOX_REF_PREFIX.replace(/:$/, ""),
          reason: ContextPackOmissionReason.RetrievalFailed,
          message: `${INBOX_ANCHOR_RETRIEVAL_FAILED_MESSAGE}: ${errorMessage(error)}`,
        },
      ],
    };
  }
}

function validateLifecycleAnchorItems(
  items: readonly ContextPackItem[],
  request: ContextPackBuildRequest,
): { items: readonly ContextPackItem[]; omissions: readonly ContextPackOmittedItem[] } {
  const accepted: ContextPackItem[] = [];
  const omissions: ContextPackOmittedItem[] = [];
  for (const item of items) {
    const violation = lifecycleAnchorItemScopeViolation(item, request);
    if (violation === null) {
      accepted.push(item);
      continue;
    }
    omissions.push({
      nodeId: item.id,
      reason: ContextPackOmissionReason.OutOfScope,
      message: violation,
    });
  }
  return { items: accepted, omissions };
}

function validateInboxAnchorItems(
  items: readonly ContextPackItem[],
  request: ContextPackBuildRequest,
): { items: readonly ContextPackItem[]; omissions: readonly ContextPackOmittedItem[] } {
  const accepted: ContextPackItem[] = [];
  const omissions: ContextPackOmittedItem[] = [];
  for (const item of items) {
    const violation = inboxAnchorItemScopeViolation(item, request);
    if (violation === null) {
      accepted.push(item);
      continue;
    }
    omissions.push({
      nodeId: item.id,
      reason: ContextPackOmissionReason.OutOfScope,
      message: violation,
    });
  }
  return { items: accepted, omissions };
}

function inboxAnchorItemScopeViolation(item: ContextPackItem, request: ContextPackBuildRequest): string | null {
  const sourcePointers = item.sourcePointers ?? [];
  const inboxPointers = sourcePointers.filter((pointer) => pointer.kind === ContextPackSourcePointerKind.InboxAnchor);
  if (inboxPointers.length === 0) {
    return INBOX_ANCHOR_REQUIRES_TARGET_HAT_ASSIGNMENT_PROVENANCE_MESSAGE;
  }
  const activeHatAssignmentId = request.snapshot.hatAssignmentId;
  const activeAgentId = request.snapshot.agentId;
  for (const pointer of inboxPointers) {
    if (pointer.targetHatAssignmentId === undefined) {
      return INBOX_ANCHOR_REQUIRES_TARGET_HAT_ASSIGNMENT_PROVENANCE_MESSAGE;
    }
    if (pointer.targetHatAssignmentId !== activeHatAssignmentId) {
      return INBOX_ANCHOR_OUTSIDE_ACTIVE_TARGET_HAT_ASSIGNMENT_MESSAGE;
    }
    if (activeAgentId !== undefined && pointer.targetAgentId !== undefined && pointer.targetAgentId !== activeAgentId) {
      return INBOX_ANCHOR_OUTSIDE_ACTIVE_AGENT_ASSIGNMENT_MESSAGE;
    }
  }
  const workItemViolation = optionalActiveWorkItemScopeViolation(sourcePointers, request);
  if (workItemViolation !== null) {
    return workItemViolation;
  }
  return null;
}

function optionalActiveWorkItemScopeViolation(
  sourcePointers: readonly ContextPackSourcePointer[],
  request: ContextPackBuildRequest,
): string | null {
  const activeWorkItemId = request.snapshot.workItemId;
  const workItemPointers = sourcePointers.filter((pointer) => pointer.kind === ContextPackSourcePointerKind.WorkItem);
  if (activeWorkItemId === undefined || workItemPointers.length === 0) return null;
  return workItemPointers.some((pointer) => pointer.workItemId === activeWorkItemId)
    ? null
    : LIFECYCLE_ANCHOR_OUTSIDE_ACTIVE_WORK_SCOPE_MESSAGE;
}

function lifecycleAnchorItemScopeViolation(item: ContextPackItem, request: ContextPackBuildRequest): string | null {
  const activeWorkItemId = request.snapshot.workItemId;
  if (activeWorkItemId === undefined) {
    return LIFECYCLE_ANCHOR_REQUIRES_ACTIVE_WORK_SCOPE_MESSAGE;
  }
  const sourcePointers = item.sourcePointers ?? [];
  if (!sourcePointers.some(isLifecycleAnchorSourcePointer)) {
    return LIFECYCLE_ANCHOR_REQUIRES_SOURCE_POINTER_MESSAGE;
  }
  const workItemPointers = sourcePointers.filter((pointer) => pointer.kind === ContextPackSourcePointerKind.WorkItem);
  if (workItemPointers.length === 0) {
    return LIFECYCLE_ANCHOR_REQUIRES_ACTIVE_WORK_POINTER_MESSAGE;
  }
  if (!workItemPointers.some((pointer) => pointer.workItemId === activeWorkItemId)) {
    return LIFECYCLE_ANCHOR_OUTSIDE_ACTIVE_WORK_SCOPE_MESSAGE;
  }
  const scheduleViolation = scheduleAnchorScopeViolation(item, sourcePointers, request);
  if (scheduleViolation !== null) {
    return scheduleViolation;
  }
  const supervisorSignalViolation = supervisorSignalAnchorScopeViolation(item, sourcePointers, request);
  if (supervisorSignalViolation !== null) {
    return supervisorSignalViolation;
  }
  return null;
}

function scheduleAnchorScopeViolation(
  item: ContextPackItem,
  sourcePointers: readonly ContextPackSourcePointer[],
  request: ContextPackBuildRequest,
): string | null {
  const schedulePointers = sourcePointers.filter((pointer) =>
    pointer.kind === ContextPackSourcePointerKind.ScheduleBlock
  );
  if (schedulePointers.length === 0) {
    return itemClaimsScheduleAnchor(item) ? SCHEDULE_ANCHOR_REQUIRES_HAT_ASSIGNMENT_PROVENANCE_MESSAGE : null;
  }
  const activeHatAssignmentId = request.snapshot.hatAssignmentId;
  const activeAgentId = request.snapshot.agentId;
  for (const pointer of schedulePointers) {
    if (pointer.assignedHatAssignmentId === undefined) {
      return SCHEDULE_ANCHOR_REQUIRES_HAT_ASSIGNMENT_PROVENANCE_MESSAGE;
    }
    if (pointer.assignedHatAssignmentId !== activeHatAssignmentId) {
      return SCHEDULE_ANCHOR_OUTSIDE_ACTIVE_HAT_ASSIGNMENT_MESSAGE;
    }
    if (activeAgentId !== undefined && pointer.assignedAgentId !== undefined && pointer.assignedAgentId !== activeAgentId) {
      return SCHEDULE_ANCHOR_OUTSIDE_ACTIVE_AGENT_ASSIGNMENT_MESSAGE;
    }
  }
  return null;
}

function supervisorSignalAnchorScopeViolation(
  item: ContextPackItem,
  sourcePointers: readonly ContextPackSourcePointer[],
  request: ContextPackBuildRequest,
): string | null {
  const supervisorSignalPointers = sourcePointers.filter((pointer) =>
    pointer.kind === ContextPackSourcePointerKind.SupervisorSignal
  );
  if (supervisorSignalPointers.length === 0) {
    return itemClaimsSupervisorSignalAnchor(item)
      ? SUPERVISOR_SIGNAL_REQUIRES_TARGET_HAT_ASSIGNMENT_PROVENANCE_MESSAGE
      : null;
  }
  const activeHatAssignmentId = request.snapshot.hatAssignmentId;
  for (const pointer of supervisorSignalPointers) {
    if (pointer.targetHatAssignmentId === undefined) {
      return SUPERVISOR_SIGNAL_REQUIRES_TARGET_HAT_ASSIGNMENT_PROVENANCE_MESSAGE;
    }
    if (pointer.targetHatAssignmentId !== activeHatAssignmentId) {
      return SUPERVISOR_SIGNAL_OUTSIDE_ACTIVE_TARGET_HAT_ASSIGNMENT_MESSAGE;
    }
  }
  return null;
}

function itemClaimsScheduleAnchor(item: ContextPackItem): boolean {
  return (
    item.kind === ContextPackItemKind.Meeting ||
    item.id.startsWith(SCHEDULE_BLOCK_REF_PREFIX) ||
    item.sourceRef.startsWith(SCHEDULE_BLOCK_REF_PREFIX) ||
    (item.citationRefs ?? []).some((ref) => ref.startsWith(SCHEDULE_BLOCK_REF_PREFIX)) ||
    item.reasons.includes(LIFECYCLE_SCHEDULE_BLOCK_REASON)
  );
}

function itemClaimsSupervisorSignalAnchor(item: ContextPackItem): boolean {
  return (
    item.kind === ContextPackItemKind.SupervisorSignal ||
    item.id.startsWith(SUPERVISOR_SIGNAL_REF_PREFIX) ||
    item.sourceRef.startsWith(SUPERVISOR_SIGNAL_REF_PREFIX) ||
    (item.citationRefs ?? []).some((ref) => ref.startsWith(SUPERVISOR_SIGNAL_REF_PREFIX)) ||
    item.reasons.includes(LIFECYCLE_SUPERVISOR_SIGNAL_REASON)
  );
}

function isLifecycleAnchorSourcePointer(pointer: ContextPackSourcePointer): boolean {
  return (
    pointer.kind === ContextPackSourcePointerKind.Decision ||
    pointer.kind === ContextPackSourcePointerKind.Discussion ||
    pointer.kind === ContextPackSourcePointerKind.Meeting ||
    pointer.kind === ContextPackSourcePointerKind.QualityGate ||
    pointer.kind === ContextPackSourcePointerKind.ScheduleBlock ||
    pointer.kind === ContextPackSourcePointerKind.SupervisorSignal
  );
}

function graphNodeIdsForContextItems(items: readonly ContextPackItem[]): ReadonlySet<string> {
  return new Set(
    items.flatMap((item) =>
      (item.sourcePointers ?? []).flatMap((pointer) =>
        pointer.kind === ContextPackSourcePointerKind.GraphNode ? [pointer.nodeId] : []
      )
    ),
  );
}

function memoryContextItem(memory: ContextPackMemoryRecall): ContextPackItem {
  return {
    id: `memory:${memory.memoryId}`,
    kind: ContextPackItemKind.MemoryPointer,
    title: `Memory ${memory.memoryId}`,
    summary: memory.summary,
    sourceRef: `${memory.providerId}:${memory.memoryId}`,
    required: !memory.advisory,
    freshness: ContextPackFreshness.Current,
    confidence: memory.confidence,
    reasons: memory.reasons,
    citationRefs: [`memory:${memory.memoryId}`],
    sourcePointers: [
      {
        kind: ContextPackSourcePointerKind.HindsightMemory,
        providerId: memory.providerId,
        memoryId: memory.memoryId,
        ...(memory.creatingAgentId === undefined ? {} : { creatingAgentId: memory.creatingAgentId }),
        ...(memory.creatingHatAssignmentId === undefined ? {} : { creatingHatAssignmentId: memory.creatingHatAssignmentId }),
        ...(memory.creatingProjectId === undefined ? {} : { creatingProjectId: memory.creatingProjectId }),
        ...(memory.creatingWorkItemId === undefined ? {} : { creatingWorkItemId: memory.creatingWorkItemId }),
        ...(memory.creatingPromptFlowRunId === undefined ? {} : { creatingPromptFlowRunId: memory.creatingPromptFlowRunId }),
        ...(memory.recallAgentId === undefined ? {} : { recallAgentId: memory.recallAgentId }),
        ...(memory.recallHatAssignmentId === undefined ? {} : { recallHatAssignmentId: memory.recallHatAssignmentId }),
        ...(memory.recallProjectId === undefined ? {} : { recallProjectId: memory.recallProjectId }),
        ...(memory.recallWorkItemId === undefined ? {} : { recallWorkItemId: memory.recallWorkItemId }),
        ...(memory.recallQueryId === undefined ? {} : { recallQueryId: memory.recallQueryId }),
        ...(memory.similarityCategory === undefined ? {} : { similarityCategory: memory.similarityCategory }),
        ...(memory.governance === undefined ? {} : { governance: cloneMemoryGovernanceExplanation(memory.governance) }),
        advisory: memory.advisory,
      },
    ],
  };
}

function staleInputsFor(units: readonly DocUnit[]): readonly string[] {
  return units
    .filter((unit) => unit.status === "stale" || unit.status === "superseded" || unit.status === "archived")
    .map((unit) => unit.docUnitId);
}

function contextPackScope(snapshot: AgentObserveSnapshot): Pick<ContextPack, "agentId" | "organizationId" | "projectId" | "teamId" | "workItemId"> {
  return {
    ...(snapshot.agentId === undefined ? {} : { agentId: snapshot.agentId }),
    ...(snapshot.organizationId === undefined ? {} : { organizationId: snapshot.organizationId }),
    ...(snapshot.projectId === undefined ? {} : { projectId: snapshot.projectId }),
    ...(snapshot.teamId === undefined ? {} : { teamId: snapshot.teamId }),
    ...(snapshot.workItemId === undefined ? {} : { workItemId: snapshot.workItemId }),
  };
}

function cloneContextPackItems(items: readonly ContextPackItem[]): ContextPackItem[] {
  return items.map((item) => ({
    ...item,
    ...(item.confidenceBasis === undefined
      ? {}
      : {
          confidenceBasis: {
            ...item.confidenceBasis,
            citedEvidenceRefs: [...item.confidenceBasis.citedEvidenceRefs],
            ...(item.confidenceBasis.uncertaintySignals === undefined
              ? {}
              : { uncertaintySignals: cloneContextPackUncertaintySignals(item.confidenceBasis.uncertaintySignals) }),
          },
        }),
    reasons: [...item.reasons],
    ...(item.citationRefs === undefined ? {} : { citationRefs: [...item.citationRefs] }),
    ...(item.sourcePointers === undefined
      ? {}
      : { sourcePointers: item.sourcePointers.map(cloneContextPackSourcePointer) }),
  }));
}

function cloneContextPackSourcePointer(pointer: ContextPackSourcePointer): ContextPackSourcePointer {
  if (pointer.kind !== ContextPackSourcePointerKind.HindsightMemory || pointer.governance === undefined) {
    return { ...pointer };
  }
  return {
    ...pointer,
    governance: cloneMemoryGovernanceExplanation(pointer.governance),
  };
}

function cloneMemoryGovernanceExplanation(
  governance: ContextPackMemoryGovernanceExplanation,
): ContextPackMemoryGovernanceExplanation {
  return {
    ...governance,
    outcome: { ...governance.outcome },
    utility: { ...governance.utility },
  };
}

function cloneContextPackUncertaintySignals(
  signals: readonly ContextPackUncertaintySignal[],
): ContextPackUncertaintySignal[] {
  return signals.map((signal) => ({
    ...signal,
    evidenceRefs: [...signal.evidenceRefs],
  }));
}

function cloneGraphRootSeeds(seeds: readonly ContextPackGraphRootSeed[]): ContextPackGraphRootSeed[] {
  return seeds.map((seed) => ({
    ...seed,
    ...(seed.citationRefs === undefined ? {} : { citationRefs: [...seed.citationRefs] }),
    ...(seed.reasons === undefined ? {} : { reasons: [...seed.reasons] }),
  }));
}

function cloneContextPackOmissions(omissions: readonly ContextPackOmittedItem[]): ContextPackOmittedItem[] {
  return omissions.map((omission) => ({ ...omission }));
}

function cloneDocUnits(units: readonly DocUnit[]): DocUnit[] {
  return units.map(cloneDocUnit);
}

function cloneDocUnit(unit: DocUnit): DocUnit {
  return {
    ...unit,
    boundHatIds: [...unit.boundHatIds],
    boundStageIds: [...unit.boundStageIds],
  };
}

function cloneContextPackBuildRequest(request: ContextPackBuildRequest): ContextPackBuildRequest {
  return structuredClone(request) as ContextPackBuildRequest;
}

function cloneContextPackDocumentFocus(focus: ContextPackDocumentFocus): ContextPackDocumentFocus {
  return {
    ...focus,
    queryTerms: [...focus.queryTerms],
    preferredDocTypes: [...focus.preferredDocTypes],
  };
}

function cloneContextPackCurationProfile(profile: ContextPackCurationProfile): ContextPackCurationProfile {
  return {
    profileId: profile.profileId,
    policyVersion: profile.policyVersion,
    ...(profile.lanePriorityOverrides === undefined ? {} : { lanePriorityOverrides: { ...profile.lanePriorityOverrides } }),
    ...(profile.requiredLanes === undefined ? {} : { requiredLanes: [...profile.requiredLanes] }),
    ...(profile.deterministicInstructions === undefined
      ? {}
      : { deterministicInstructions: [...profile.deterministicInstructions] }),
  };
}

function cloneContextPackCurationIntent(intent: ContextPackCurationIntent): ContextPackCurationIntent {
  return {
    documentFocus: cloneContextPackDocumentFocus(intent.documentFocus),
    curationProfile: cloneContextPackCurationProfile(intent.curationProfile),
  };
}

function cloneContextPackCurationPlan(plan: ContextPackCurationPlan): ContextPackCurationPlan {
  return {
    profileId: plan.profileId,
    policyVersion: plan.policyVersion,
    deterministicInstructions: [...plan.deterministicInstructions],
    ...(plan.requiredStages === undefined ? {} : { requiredStages: [...plan.requiredStages] }),
    lanes: plan.lanes.map((lane) => ({
      ...lane,
      refs: lane.refs.map((ref) => ({ ...ref })),
    })),
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
