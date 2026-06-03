/**
 * Tenant configuration (C0) — the org as a generic configurable runtime. Everything that was
 * hardcoded becomes per-tenant DATA: which review stages require a human (the autonomy dial),
 * which workflow pipeline a work type uses, which handbooks bind to which stages, and which
 * skills are enabled. One tenant flips a stage from agent-decided to human-gated by editing
 * config — no code change. The domain shape is storage-neutral: SQL adapters can keep it in JSONB,
 * while Git/file adapters can keep the same versioned document in a repository.
 */

/** How much a tenant trusts agents to act without a human in the loop. */
export const AutonomyLevel = {
  Manual: "manual", // a human gates every load-bearing decision
  Assisted: "assisted", // agents decide; humans gate only the highest-stakes stages
  Autonomous: "autonomous", // agents decide end to end; humans audit after the fact
} as const;
export type AutonomyLevel = (typeof AutonomyLevel)[keyof typeof AutonomyLevel];

/**
 * The autonomy dial as data. `level` sets the default; `humanGatedStageIds` is the explicit
 * allow-list of review stages that REQUIRE a human regardless of level (a tenant can always
 * pin a specific stage to human review even when otherwise autonomous).
 */
export type AutonomyPolicy = {
  level: AutonomyLevel;
  humanGatedStageIds: readonly string[];
};

/** Which review pipeline a work type uses (so the workflow is config, not hardcoded). */
export type WorkflowConfig = {
  pipelineByWorkType: Readonly<Record<string, string>>; // workItemType → pipelineId
  defaultPipelineId: string;
};

/** Which handbook (doc unit) binds to which workflow stage (deterministic consult). */
export type HandbookBinding = { stageId: string; docUnitId: string };

export const ConfigLayerScopeKind = {
  Organization: "organization",
  Department: "department",
  Hat: "hat",
  WorkItem: "work_item",
} as const;
export type ConfigLayerScopeKind = (typeof ConfigLayerScopeKind)[keyof typeof ConfigLayerScopeKind];

export type ConfigLayerScope = {
  kind: ConfigLayerScopeKind;
  id: string;
};

export type TenantConfigLayerPolicy = {
  model?: string | undefined;
  budgetDeltaTokens?: number | undefined;
  directives?: readonly string[] | undefined;
  blocksInheritedDirectives?: boolean | undefined;
  contextPack?: TenantContextPackPolicy | undefined;
};

export type TenantContextPackPolicy = {
  curation?: TenantContextPackCurationPolicy | undefined;
  completeness?: TenantContextPackCompletenessPolicy | undefined;
  readiness?: TenantContextPackReadinessPolicy | undefined;
  synthesisRequirement?: TenantContextPackSynthesisRequirementPolicy | undefined;
};

export const TenantContextPackUncertaintySignalKind = {
  StaleEvidence: "stale_evidence",
  ConflictingEvidence: "conflicting_evidence",
  LowConfidenceEvidence: "low_confidence_evidence",
  IndirectEvidence: "indirect_evidence",
} as const;
export type TenantContextPackUncertaintySignalKind =
  (typeof TenantContextPackUncertaintySignalKind)[keyof typeof TenantContextPackUncertaintySignalKind];

export const TenantContextPackUncertaintySeverity = {
  Low: "low",
  Medium: "medium",
  High: "high",
} as const;
export type TenantContextPackUncertaintySeverity =
  (typeof TenantContextPackUncertaintySeverity)[keyof typeof TenantContextPackUncertaintySeverity];

export const TenantContextPackOmissionReason = {
  BuilderUnavailable: "builder_unavailable",
  AccessDenied: "access_denied",
  OutOfScope: "out_of_scope",
  NotIndexed: "not_indexed",
  StaleInput: "stale_input",
  ContradictionUnresolved: "contradiction_unresolved",
  RetrievalFailed: "retrieval_failed",
} as const;
export type TenantContextPackOmissionReason =
  (typeof TenantContextPackOmissionReason)[keyof typeof TenantContextPackOmissionReason];

export type TenantContextPackUncertaintyHardStopRule = {
  ruleId: string;
  severity: TenantContextPackUncertaintySeverity;
  kinds?: readonly TenantContextPackUncertaintySignalKind[] | undefined;
  message: string;
  appliesTo?: TenantContextPackCompletenessAppliesTo | undefined;
};

export type TenantContextPackOmissionHardStopRule = {
  ruleId: string;
  reasons?: readonly TenantContextPackOmissionReason[] | undefined;
  nodeIdPrefixes?: readonly string[] | undefined;
  message: string;
  appliesTo?: TenantContextPackCompletenessAppliesTo | undefined;
};

export type TenantContextPackContradictionHardStopRule = {
  ruleId: string;
  message: string;
  appliesTo?: TenantContextPackCompletenessAppliesTo | undefined;
};

export type TenantContextPackLifecycleBlockerHardStopRule = {
  ruleId: string;
  blockerPrefixes?: readonly string[] | undefined;
  message: string;
  appliesTo?: TenantContextPackCompletenessAppliesTo | undefined;
};

export type TenantContextPackStaleHardStopRule = {
  ruleId: string;
  staleInputPrefixes?: readonly string[] | undefined;
  itemIdPrefixes?: readonly string[] | undefined;
  message: string;
  appliesTo?: TenantContextPackCompletenessAppliesTo | undefined;
};

export type TenantContextPackReadinessPolicy = {
  uncertaintyHardStops?: readonly TenantContextPackUncertaintyHardStopRule[] | undefined;
  blocksInheritedUncertaintyHardStops?: boolean | undefined;
  omissionHardStops?: readonly TenantContextPackOmissionHardStopRule[] | undefined;
  blocksInheritedOmissionHardStops?: boolean | undefined;
  contradictionHardStops?: readonly TenantContextPackContradictionHardStopRule[] | undefined;
  blocksInheritedContradictionHardStops?: boolean | undefined;
  lifecycleBlockerHardStops?: readonly TenantContextPackLifecycleBlockerHardStopRule[] | undefined;
  blocksInheritedLifecycleBlockerHardStops?: boolean | undefined;
  staleHardStops?: readonly TenantContextPackStaleHardStopRule[] | undefined;
  blocksInheritedStaleHardStops?: boolean | undefined;
};

export const TenantContextPackCurationProfileId = {
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
export type TenantContextPackCurationProfileId =
  (typeof TenantContextPackCurationProfileId)[keyof typeof TenantContextPackCurationProfileId];

export const TenantContextPackCurationLaneKind = {
  Authority: "authority",
  RequiredDocuments: "required_documents",
  ActiveWork: "active_work",
  GraphNeighborhood: "graph_neighborhood",
  Memory: "memory",
  Omissions: "omissions",
  LegalActions: "legal_actions",
} as const;
export type TenantContextPackCurationLaneKind =
  (typeof TenantContextPackCurationLaneKind)[keyof typeof TenantContextPackCurationLaneKind];

export const TenantContextPackCurationInstruction = {
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
export type TenantContextPackCurationInstruction =
  (typeof TenantContextPackCurationInstruction)[keyof typeof TenantContextPackCurationInstruction];

export type TenantContextPackCurationPolicy = {
  profileId?: TenantContextPackCurationProfileId | undefined;
  lanePriorityOverrides?: Partial<Record<TenantContextPackCurationLaneKind, number>> | undefined;
  requiredLanes?: readonly TenantContextPackCurationLaneKind[] | undefined;
  deterministicInstructions?: readonly TenantContextPackCurationInstruction[] | undefined;
  blocksInheritedDeterministicInstructions?: boolean | undefined;
};

export function isTenantContextPackCurationProfileId(
  value: unknown,
): value is TenantContextPackCurationProfileId {
  return Object.values(TenantContextPackCurationProfileId).includes(value as TenantContextPackCurationProfileId);
}

export function isTenantContextPackCurationLaneKind(
  value: unknown,
): value is TenantContextPackCurationLaneKind {
  return Object.values(TenantContextPackCurationLaneKind).includes(value as TenantContextPackCurationLaneKind);
}

export function isTenantContextPackCurationInstruction(
  value: unknown,
): value is TenantContextPackCurationInstruction {
  return Object.values(TenantContextPackCurationInstruction).includes(value as TenantContextPackCurationInstruction);
}

export function isTenantContextPackUncertaintySignalKind(
  value: unknown,
): value is TenantContextPackUncertaintySignalKind {
  return Object.values(TenantContextPackUncertaintySignalKind).includes(value as TenantContextPackUncertaintySignalKind);
}

export function isTenantContextPackUncertaintySeverity(
  value: unknown,
): value is TenantContextPackUncertaintySeverity {
  return Object.values(TenantContextPackUncertaintySeverity).includes(value as TenantContextPackUncertaintySeverity);
}

export function isTenantContextPackOmissionReason(
  value: unknown,
): value is TenantContextPackOmissionReason {
  return Object.values(TenantContextPackOmissionReason).includes(value as TenantContextPackOmissionReason);
}

export const TenantContextPackCompletenessSourceScope = {
  Any: "any",
  ActiveScope: "active_scope",
} as const;
export type TenantContextPackCompletenessSourceScope =
  (typeof TenantContextPackCompletenessSourceScope)[keyof typeof TenantContextPackCompletenessSourceScope];

export const TenantContextPackCompletenessRequirementSetId = {
  ManagementBlockerCore: "management_blocker_core",
  ResourceAllocationCore: "resource_allocation_core",
  PriorityChangeCore: "priority_change_core",
  BudgetCapacityCore: "budget_capacity_core",
  TenantApprovalCore: "tenant_approval_core",
  ArchitectureTradeoffCore: "architecture_tradeoff_core",
  SecurityExceptionCore: "security_exception_core",
  CustomerBusinessScopeCore: "customer_business_scope_core",
  ReleaseReadinessCore: "release_readiness_core",
  RuntimeOperationsCore: "runtime_operations_core",
} as const;
export type TenantContextPackCompletenessRequirementSetId =
  (typeof TenantContextPackCompletenessRequirementSetId)[keyof typeof TenantContextPackCompletenessRequirementSetId];

export const TenantContextPackCompletenessRequirementId = {
  ManagementBlockerBusiness: "management_blocker_business",
  ManagementBlockerArchitecture: "management_blocker_architecture",
  ManagementBlockerPolicy: "management_blocker_policy",
  ManagementBlockerGraph: "management_blocker_graph",
  ResourceAllocationPolicy: "resource_allocation_policy",
  ResourceAllocationCapacityEvidence: "resource_allocation_capacity_evidence",
  ResourceAllocationDecision: "resource_allocation_decision",
  PriorityChangeBusinessContext: "priority_change_business_context",
  PriorityChangeImpactEvidence: "priority_change_impact_evidence",
  PriorityChangeDecision: "priority_change_decision",
  PriorityChangeGraph: "priority_change_graph",
  BudgetCapacityPolicy: "budget_capacity_policy",
  BudgetCapacityTelemetryEvidence: "budget_capacity_telemetry_evidence",
  BudgetCapacityDecision: "budget_capacity_decision",
  TenantApprovalPolicy: "tenant_approval_policy",
  TenantApprovalDecision: "tenant_approval_decision",
  TenantApprovalEvidence: "tenant_approval_evidence",
  ArchitectureTradeoffDecision: "architecture_tradeoff_decision",
  ArchitectureTradeoffArchitecture: "architecture_tradeoff_architecture",
  ArchitectureTradeoffBusiness: "architecture_tradeoff_business",
  ArchitectureTradeoffGraph: "architecture_tradeoff_graph",
  SecurityExceptionPolicy: "security_exception_policy",
  SecurityExceptionCredentialEvidence: "security_exception_credential_evidence",
  SecurityExceptionRiskDecision: "security_exception_risk_decision",
  CustomerBusinessScopeRequirements: "customer_business_scope_requirements",
  CustomerBusinessScopeCustomerInput: "customer_business_scope_customer_input",
  CustomerBusinessScopeValidation: "customer_business_scope_validation",
  CustomerBusinessScopeProductDecision: "customer_business_scope_product_decision",
  ReleaseDeploymentEvidence: "release_deployment_evidence",
  ReleaseReadinessMeeting: "release_readiness_meeting",
  RuntimeRunbookPolicy: "runtime_runbook_policy",
  RuntimeIncidentEvidence: "runtime_incident_evidence",
} as const;
export type TenantContextPackCompletenessRequirementId =
  (typeof TenantContextPackCompletenessRequirementId)[keyof typeof TenantContextPackCompletenessRequirementId];

export type TenantContextPackCompletenessAppliesTo = {
  hatIds?: readonly string[] | undefined;
  departmentIds?: readonly string[] | undefined;
  phases?: readonly string[] | undefined;
  scopes?: readonly string[] | undefined;
  projectIds?: readonly string[] | undefined;
  teamIds?: readonly string[] | undefined;
  workItemIds?: readonly string[] | undefined;
};

export type TenantContextPackCompletenessRequirementPolicy = {
  requirementId: string;
  itemKind: string;
  message: string;
  evidenceRef: string;
  requiredSourceScope?: TenantContextPackCompletenessSourceScope | undefined;
  appliesTo?: TenantContextPackCompletenessAppliesTo | undefined;
};

export type TenantContextPackCompletenessPolicy = {
  requirementSetIds?: readonly TenantContextPackCompletenessRequirementSetId[] | undefined;
  blocksInheritedRequirements?: boolean | undefined;
  hardBlockMissingRequiredContext?: boolean | undefined;
  requirements?: readonly TenantContextPackCompletenessRequirementPolicy[] | undefined;
};

export const TenantContextPackSynthesisRequirementReason = {
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
export type TenantContextPackSynthesisRequirementReason =
  (typeof TenantContextPackSynthesisRequirementReason)[keyof typeof TenantContextPackSynthesisRequirementReason];

export const TenantContextPackSynthesisRequirementSetId = {
  HighStakesReviewCore: "high_stakes_review_core",
  ResourceAllocationCore: "resource_allocation_core",
  PriorityChangeCore: "priority_change_core",
  ArchitectureTradeoffCore: "architecture_tradeoff_core",
  ReleaseReadinessCore: "release_readiness_core",
  SecurityExceptionCore: "security_exception_core",
  CustomerBusinessScopeCore: "customer_business_scope_core",
  RuntimeOperationsCore: "runtime_operations_core",
} as const;
export type TenantContextPackSynthesisRequirementSetId =
  (typeof TenantContextPackSynthesisRequirementSetId)[keyof typeof TenantContextPackSynthesisRequirementSetId];

export type TenantContextPackSynthesisRequirementRule = {
  requirementId: string;
  reason: TenantContextPackSynthesisRequirementReason;
  appliesTo?: TenantContextPackCompletenessAppliesTo | undefined;
};

export type TenantContextPackSynthesisRequirementPolicy = {
  requirementSetIds?: readonly TenantContextPackSynthesisRequirementSetId[] | undefined;
  requirements?: readonly TenantContextPackSynthesisRequirementRule[] | undefined;
  blocksInheritedRequirements?: boolean | undefined;
};

export type TenantConfigLayer = {
  layerId: string;
  scope: ConfigLayerScope;
  policy: TenantConfigLayerPolicy;
  updatedAt: string;
  version: number;
};

export type ResolvedTenantDecisionConfig = {
  model?: string | undefined;
  budgetDeltaTokens: number;
  directives: readonly string[];
  appliedLayerIds: readonly string[];
};

export type TenantConfig = {
  organizationId: string;
  autonomy: AutonomyPolicy;
  workflow: WorkflowConfig;
  handbookBindings: readonly HandbookBinding[];
  enabledSkills: readonly string[];
  layers?: readonly TenantConfigLayer[] | undefined;
  updatedAt: string;
  version: number;
};

/** A sane default config for a fresh tenant: assisted autonomy, internal-only pipeline. */
export function defaultTenantConfig(organizationId: string, nowIso: string): TenantConfig {
  return {
    organizationId,
    autonomy: { level: AutonomyLevel.Assisted, humanGatedStageIds: ["human-qa-signoff"] },
    workflow: { pipelineByWorkType: {}, defaultPipelineId: "internal-only" },
    handbookBindings: [],
    enabledSkills: [],
    layers: [],
    updatedAt: nowIso,
    version: 1,
  };
}

/**
 * Does a given review stage require a human under this tenant's autonomy policy?
 * - explicit pin always wins;
 * - Manual gates everything; Autonomous gates nothing extra; Assisted gates only the pinned set.
 */
export function stageRequiresHuman(policy: AutonomyPolicy, stageId: string): boolean {
  if (policy.humanGatedStageIds.includes(stageId)) return true;
  return policy.level === AutonomyLevel.Manual;
}

export type ResolveLayeredTenantConfigInput = {
  organizationId: string;
  departmentId?: string | undefined;
  hatId?: string | undefined;
  workItemId?: string | undefined;
  layers: readonly TenantConfigLayer[];
};

export function resolveLayeredTenantConfig(input: ResolveLayeredTenantConfigInput): ResolvedTenantDecisionConfig {
  const matching = input.layers
    .filter((layer) => layerMatches(layer.scope, input))
    .sort(compareLayersForResolution);
  let model: string | undefined;
  let budgetDeltaTokens = 0;
  let directives: string[] = [];
  const appliedLayerIds: string[] = [];

  for (const layer of matching) {
    appliedLayerIds.push(layer.layerId);
    if (layer.policy.model !== undefined) {
      model = layer.policy.model;
    }

    budgetDeltaTokens += layer.policy.budgetDeltaTokens ?? 0;

    if (layer.policy.blocksInheritedDirectives === true) {
      directives = [];
    }

    directives.push(...(layer.policy.directives ?? []));
  }

  return {
    ...(model === undefined ? {} : { model }),
    budgetDeltaTokens,
    directives,
    appliedLayerIds,
  };
}

function compareLayersForResolution(left: TenantConfigLayer, right: TenantConfigLayer): number {
  const specificity = layerSpecificity(left.scope.kind) - layerSpecificity(right.scope.kind);
  if (specificity !== 0) return specificity;
  const updatedAt = left.updatedAt.localeCompare(right.updatedAt);
  if (updatedAt !== 0) return updatedAt;
  const version = left.version - right.version;
  if (version !== 0) return version;
  return left.layerId.localeCompare(right.layerId);
}

function layerMatches(scope: ConfigLayerScope, input: ResolveLayeredTenantConfigInput): boolean {
  switch (scope.kind) {
    case ConfigLayerScopeKind.Organization:
      return scope.id === input.organizationId;
    case ConfigLayerScopeKind.Department:
      return scope.id === input.departmentId;
    case ConfigLayerScopeKind.Hat:
      return scope.id === input.hatId;
    case ConfigLayerScopeKind.WorkItem:
      return scope.id === input.workItemId;
  }
}

function layerSpecificity(kind: ConfigLayerScopeKind): number {
  switch (kind) {
    case ConfigLayerScopeKind.Organization:
      return 0;
    case ConfigLayerScopeKind.Department:
      return 1;
    case ConfigLayerScopeKind.Hat:
      return 2;
    case ConfigLayerScopeKind.WorkItem:
      return 3;
  }
}
