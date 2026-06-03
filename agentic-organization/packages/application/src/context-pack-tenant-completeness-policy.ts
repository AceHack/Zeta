import {
  ConfigLayerScopeKind,
  TenantContextPackCompletenessRequirementId,
  TenantContextPackCompletenessRequirementSetId,
  TenantContextPackCompletenessSourceScope,
  type TenantConfig,
  type TenantConfigLayer,
  type TenantContextPackCompletenessAppliesTo,
  type TenantContextPackCompletenessPolicy,
  type TenantContextPackCompletenessRequirementPolicy,
} from "../../domain/src/index.ts";
import {
  createDefaultContextPackCompletenessPolicy,
  type ContextPackCompletenessPolicyPort,
  type ContextPackCompletenessPolicyRequest,
  type ContextPackCompletenessPolicyResult,
} from "./context-pack-builder.ts";
import {
  ContextPackItemKind,
  ContextPackOmissionReason,
  type ContextPackItem,
  type ContextPackOmittedItem,
} from "./context-pack-contracts.ts";
import { contextPackSourcePointerIsOutsideActiveScope } from "./context-pack-scope-evaluator.ts";
import { RunLifecyclePhase, RunScope } from "./observe.ts";

export type TenantConfigContextPackCompletenessConfigReader = {
  get: (organizationId: string) => Promise<TenantConfig | null> | TenantConfig | null;
};

export type CreateTenantConfigContextPackCompletenessPolicyInput = {
  tenantConfigs: TenantConfigContextPackCompletenessConfigReader;
  fallback?: ContextPackCompletenessPolicyPort | undefined;
};

export type PreviewTenantContextPackCompletenessPolicyInput = {
  policy: TenantContextPackCompletenessPolicy;
  request: ContextPackCompletenessPolicyRequest;
  fallback?: ContextPackCompletenessPolicyPort | undefined;
};

export type TenantContextPackCompletenessRequirementSetDescriptor = {
  setId: TenantContextPackCompletenessRequirementSetId;
  requirements: readonly TenantContextPackCompletenessRequirementPolicy[];
};

type TenantContextPackCompletenessRequirement = {
  requirementId: string;
  itemKind: ContextPackItemKind;
  message: string;
  evidenceRef: string;
  requiredSourceScope: TenantContextPackCompletenessSourceScope;
  hardBlockMissingRequiredContext: boolean;
  appliesTo: NormalizedCompletenessAppliesTo;
};

type TenantContextPackCompletenessLayerRequirements = {
  blocksInheritedRequirements: boolean;
  requirements: readonly TenantContextPackCompletenessRequirement[];
};

type NormalizedCompletenessAppliesTo = {
  hatIds: readonly string[];
  departmentIds: readonly string[];
  phases: readonly RunLifecyclePhase[];
  scopes: readonly RunScope[];
  projectIds: readonly string[];
  teamIds: readonly string[];
  workItemIds: readonly string[];
};

const CONTEXT_REQUIREMENT_NODE_ID_PREFIX = "context_requirement";
const TENANT_COMPLETENESS_CONFIG_FAILURE_REQUIREMENT_ID = "tenant_completeness_config";
const TENANT_COMPLETENESS_CONFIG_FAILURE_MESSAGE = "tenant context-pack completeness config could not be loaded";
const TENANT_MANAGEMENT_BLOCKER_CORE_EVIDENCE_REF = "context_policy:tenant_management_blocker_core:v1";
const TENANT_RESOURCE_ALLOCATION_CORE_EVIDENCE_REF = "context_policy:tenant_resource_allocation_core:v1";
const TENANT_PRIORITY_CHANGE_CORE_EVIDENCE_REF = "context_policy:tenant_priority_change_core:v1";
const TENANT_BUDGET_CAPACITY_CORE_EVIDENCE_REF = "context_policy:tenant_budget_capacity_core:v1";
const TENANT_APPROVAL_CORE_EVIDENCE_REF = "context_policy:tenant_approval_core:v1";
const TENANT_ARCHITECTURE_TRADEOFF_CORE_EVIDENCE_REF = "context_policy:tenant_architecture_tradeoff_core:v1";
const TENANT_SECURITY_EXCEPTION_CORE_EVIDENCE_REF = "context_policy:tenant_security_exception_core:v1";
const TENANT_CUSTOMER_BUSINESS_SCOPE_CORE_EVIDENCE_REF = "context_policy:tenant_customer_business_scope_core:v1";
const TENANT_RELEASE_READINESS_CORE_EVIDENCE_REF = "context_policy:tenant_release_readiness_core:v1";
const TENANT_RUNTIME_OPERATIONS_CORE_EVIDENCE_REF = "context_policy:tenant_runtime_operations_core:v1";

const TenantContextPackLayerSpecificity = {
  [ConfigLayerScopeKind.Organization]: 0,
  [ConfigLayerScopeKind.Department]: 1,
  [ConfigLayerScopeKind.Hat]: 2,
  [ConfigLayerScopeKind.WorkItem]: 3,
} as const;

const EMPTY_COMPLETENESS_APPLIES_TO: NormalizedCompletenessAppliesTo = {
  hatIds: [],
  departmentIds: [],
  phases: [],
  scopes: [],
  projectIds: [],
  teamIds: [],
  workItemIds: [],
};

const TENANT_CONTEXT_PACK_COMPLETENESS_REQUIREMENT_SETS:
  Readonly<Record<TenantContextPackCompletenessRequirementSetId, readonly TenantContextPackCompletenessRequirementPolicy[]>> = {
    [TenantContextPackCompletenessRequirementSetId.ManagementBlockerCore]: [{
      requirementId: TenantContextPackCompletenessRequirementId.ManagementBlockerBusiness,
      itemKind: ContextPackItemKind.BusinessDocument,
      message: "management blocker business context is required",
      evidenceRef: TENANT_MANAGEMENT_BLOCKER_CORE_EVIDENCE_REF,
      requiredSourceScope: TenantContextPackCompletenessSourceScope.ActiveScope,
    }, {
      requirementId: TenantContextPackCompletenessRequirementId.ManagementBlockerArchitecture,
      itemKind: ContextPackItemKind.ArchitectureDocument,
      message: "management blocker architecture context is required",
      evidenceRef: TENANT_MANAGEMENT_BLOCKER_CORE_EVIDENCE_REF,
      requiredSourceScope: TenantContextPackCompletenessSourceScope.ActiveScope,
    }, {
      requirementId: TenantContextPackCompletenessRequirementId.ManagementBlockerPolicy,
      itemKind: ContextPackItemKind.Policy,
      message: "management blocker governing policy is required",
      evidenceRef: TENANT_MANAGEMENT_BLOCKER_CORE_EVIDENCE_REF,
      requiredSourceScope: TenantContextPackCompletenessSourceScope.ActiveScope,
    }, {
      requirementId: TenantContextPackCompletenessRequirementId.ManagementBlockerGraph,
      itemKind: ContextPackItemKind.GraphNeighborhood,
      message: "management blocker blast-radius graph is required",
      evidenceRef: TENANT_MANAGEMENT_BLOCKER_CORE_EVIDENCE_REF,
      requiredSourceScope: TenantContextPackCompletenessSourceScope.Any,
    }],
    [TenantContextPackCompletenessRequirementSetId.ResourceAllocationCore]: [{
      requirementId: TenantContextPackCompletenessRequirementId.ResourceAllocationPolicy,
      itemKind: ContextPackItemKind.Policy,
      message: "resource allocation policy is required",
      evidenceRef: TENANT_RESOURCE_ALLOCATION_CORE_EVIDENCE_REF,
      requiredSourceScope: TenantContextPackCompletenessSourceScope.ActiveScope,
    }, {
      requirementId: TenantContextPackCompletenessRequirementId.ResourceAllocationCapacityEvidence,
      itemKind: ContextPackItemKind.Evidence,
      message: "resource allocation capacity evidence is required",
      evidenceRef: TENANT_RESOURCE_ALLOCATION_CORE_EVIDENCE_REF,
      requiredSourceScope: TenantContextPackCompletenessSourceScope.ActiveScope,
    }, {
      requirementId: TenantContextPackCompletenessRequirementId.ResourceAllocationDecision,
      itemKind: ContextPackItemKind.DecisionRecord,
      message: "resource allocation decision is required",
      evidenceRef: TENANT_RESOURCE_ALLOCATION_CORE_EVIDENCE_REF,
      requiredSourceScope: TenantContextPackCompletenessSourceScope.ActiveScope,
    }],
    [TenantContextPackCompletenessRequirementSetId.PriorityChangeCore]: [{
      requirementId: TenantContextPackCompletenessRequirementId.PriorityChangeBusinessContext,
      itemKind: ContextPackItemKind.BusinessDocument,
      message: "priority change business context is required",
      evidenceRef: TENANT_PRIORITY_CHANGE_CORE_EVIDENCE_REF,
      requiredSourceScope: TenantContextPackCompletenessSourceScope.ActiveScope,
    }, {
      requirementId: TenantContextPackCompletenessRequirementId.PriorityChangeImpactEvidence,
      itemKind: ContextPackItemKind.Evidence,
      message: "priority change impact evidence is required",
      evidenceRef: TENANT_PRIORITY_CHANGE_CORE_EVIDENCE_REF,
      requiredSourceScope: TenantContextPackCompletenessSourceScope.ActiveScope,
    }, {
      requirementId: TenantContextPackCompletenessRequirementId.PriorityChangeDecision,
      itemKind: ContextPackItemKind.DecisionRecord,
      message: "priority change decision is required",
      evidenceRef: TENANT_PRIORITY_CHANGE_CORE_EVIDENCE_REF,
      requiredSourceScope: TenantContextPackCompletenessSourceScope.ActiveScope,
    }, {
      requirementId: TenantContextPackCompletenessRequirementId.PriorityChangeGraph,
      itemKind: ContextPackItemKind.GraphNeighborhood,
      message: "priority change dependency graph is required",
      evidenceRef: TENANT_PRIORITY_CHANGE_CORE_EVIDENCE_REF,
      requiredSourceScope: TenantContextPackCompletenessSourceScope.Any,
    }],
    [TenantContextPackCompletenessRequirementSetId.BudgetCapacityCore]: [{
      requirementId: TenantContextPackCompletenessRequirementId.BudgetCapacityPolicy,
      itemKind: ContextPackItemKind.Policy,
      message: "budget capacity policy is required",
      evidenceRef: TENANT_BUDGET_CAPACITY_CORE_EVIDENCE_REF,
      requiredSourceScope: TenantContextPackCompletenessSourceScope.ActiveScope,
    }, {
      requirementId: TenantContextPackCompletenessRequirementId.BudgetCapacityTelemetryEvidence,
      itemKind: ContextPackItemKind.Evidence,
      message: "budget capacity telemetry evidence is required",
      evidenceRef: TENANT_BUDGET_CAPACITY_CORE_EVIDENCE_REF,
      requiredSourceScope: TenantContextPackCompletenessSourceScope.ActiveScope,
    }, {
      requirementId: TenantContextPackCompletenessRequirementId.BudgetCapacityDecision,
      itemKind: ContextPackItemKind.DecisionRecord,
      message: "budget capacity decision is required",
      evidenceRef: TENANT_BUDGET_CAPACITY_CORE_EVIDENCE_REF,
      requiredSourceScope: TenantContextPackCompletenessSourceScope.ActiveScope,
    }],
    [TenantContextPackCompletenessRequirementSetId.TenantApprovalCore]: [{
      requirementId: TenantContextPackCompletenessRequirementId.TenantApprovalPolicy,
      itemKind: ContextPackItemKind.Policy,
      message: "tenant approval policy is required",
      evidenceRef: TENANT_APPROVAL_CORE_EVIDENCE_REF,
      requiredSourceScope: TenantContextPackCompletenessSourceScope.ActiveScope,
    }, {
      requirementId: TenantContextPackCompletenessRequirementId.TenantApprovalDecision,
      itemKind: ContextPackItemKind.DecisionRecord,
      message: "tenant approval decision is required",
      evidenceRef: TENANT_APPROVAL_CORE_EVIDENCE_REF,
      requiredSourceScope: TenantContextPackCompletenessSourceScope.ActiveScope,
    }, {
      requirementId: TenantContextPackCompletenessRequirementId.TenantApprovalEvidence,
      itemKind: ContextPackItemKind.Evidence,
      message: "tenant approval evidence is required",
      evidenceRef: TENANT_APPROVAL_CORE_EVIDENCE_REF,
      requiredSourceScope: TenantContextPackCompletenessSourceScope.ActiveScope,
    }],
    [TenantContextPackCompletenessRequirementSetId.ArchitectureTradeoffCore]: [{
      requirementId: TenantContextPackCompletenessRequirementId.ArchitectureTradeoffDecision,
      itemKind: ContextPackItemKind.DecisionRecord,
      message: "architecture tradeoff CA or ADR decision is required",
      evidenceRef: TENANT_ARCHITECTURE_TRADEOFF_CORE_EVIDENCE_REF,
      requiredSourceScope: TenantContextPackCompletenessSourceScope.ActiveScope,
    }, {
      requirementId: TenantContextPackCompletenessRequirementId.ArchitectureTradeoffArchitecture,
      itemKind: ContextPackItemKind.ArchitectureDocument,
      message: "current architecture tradeoff context is required",
      evidenceRef: TENANT_ARCHITECTURE_TRADEOFF_CORE_EVIDENCE_REF,
      requiredSourceScope: TenantContextPackCompletenessSourceScope.ActiveScope,
    }, {
      requirementId: TenantContextPackCompletenessRequirementId.ArchitectureTradeoffBusiness,
      itemKind: ContextPackItemKind.BusinessDocument,
      message: "architecture tradeoff business rule context is required",
      evidenceRef: TENANT_ARCHITECTURE_TRADEOFF_CORE_EVIDENCE_REF,
      requiredSourceScope: TenantContextPackCompletenessSourceScope.ActiveScope,
    }, {
      requirementId: TenantContextPackCompletenessRequirementId.ArchitectureTradeoffGraph,
      itemKind: ContextPackItemKind.GraphNeighborhood,
      message: "architecture tradeoff affected service graph is required",
      evidenceRef: TENANT_ARCHITECTURE_TRADEOFF_CORE_EVIDENCE_REF,
      requiredSourceScope: TenantContextPackCompletenessSourceScope.Any,
    }],
    [TenantContextPackCompletenessRequirementSetId.SecurityExceptionCore]: [{
      requirementId: TenantContextPackCompletenessRequirementId.SecurityExceptionPolicy,
      itemKind: ContextPackItemKind.Policy,
      message: "security exception least-privilege policy is required",
      evidenceRef: TENANT_SECURITY_EXCEPTION_CORE_EVIDENCE_REF,
      requiredSourceScope: TenantContextPackCompletenessSourceScope.ActiveScope,
    }, {
      requirementId: TenantContextPackCompletenessRequirementId.SecurityExceptionCredentialEvidence,
      itemKind: ContextPackItemKind.Evidence,
      message: "security exception credential and audit evidence is required",
      evidenceRef: TENANT_SECURITY_EXCEPTION_CORE_EVIDENCE_REF,
      requiredSourceScope: TenantContextPackCompletenessSourceScope.ActiveScope,
    }, {
      requirementId: TenantContextPackCompletenessRequirementId.SecurityExceptionRiskDecision,
      itemKind: ContextPackItemKind.DecisionRecord,
      message: "security exception threat-risk decision is required",
      evidenceRef: TENANT_SECURITY_EXCEPTION_CORE_EVIDENCE_REF,
      requiredSourceScope: TenantContextPackCompletenessSourceScope.ActiveScope,
    }],
    [TenantContextPackCompletenessRequirementSetId.CustomerBusinessScopeCore]: [{
      requirementId: TenantContextPackCompletenessRequirementId.CustomerBusinessScopeRequirements,
      itemKind: ContextPackItemKind.BusinessDocument,
      message: "customer business scope requirements are required",
      evidenceRef: TENANT_CUSTOMER_BUSINESS_SCOPE_CORE_EVIDENCE_REF,
      requiredSourceScope: TenantContextPackCompletenessSourceScope.ActiveScope,
    }, {
      requirementId: TenantContextPackCompletenessRequirementId.CustomerBusinessScopeCustomerInput,
      itemKind: ContextPackItemKind.Meeting,
      message: "customer business scope customer input is required",
      evidenceRef: TENANT_CUSTOMER_BUSINESS_SCOPE_CORE_EVIDENCE_REF,
      requiredSourceScope: TenantContextPackCompletenessSourceScope.ActiveScope,
    }, {
      requirementId: TenantContextPackCompletenessRequirementId.CustomerBusinessScopeValidation,
      itemKind: ContextPackItemKind.Evidence,
      message: "customer business scope validation outcome is required",
      evidenceRef: TENANT_CUSTOMER_BUSINESS_SCOPE_CORE_EVIDENCE_REF,
      requiredSourceScope: TenantContextPackCompletenessSourceScope.ActiveScope,
    }, {
      requirementId: TenantContextPackCompletenessRequirementId.CustomerBusinessScopeProductDecision,
      itemKind: ContextPackItemKind.DecisionRecord,
      message: "customer business scope product decision is required",
      evidenceRef: TENANT_CUSTOMER_BUSINESS_SCOPE_CORE_EVIDENCE_REF,
      requiredSourceScope: TenantContextPackCompletenessSourceScope.ActiveScope,
    }],
    [TenantContextPackCompletenessRequirementSetId.ReleaseReadinessCore]: [{
      requirementId: TenantContextPackCompletenessRequirementId.ReleaseDeploymentEvidence,
      itemKind: ContextPackItemKind.Evidence,
      message: "release deployment evidence is required",
      evidenceRef: TENANT_RELEASE_READINESS_CORE_EVIDENCE_REF,
      requiredSourceScope: TenantContextPackCompletenessSourceScope.ActiveScope,
    }, {
      requirementId: TenantContextPackCompletenessRequirementId.ReleaseReadinessMeeting,
      itemKind: ContextPackItemKind.Meeting,
      message: "release readiness meeting notes are required",
      evidenceRef: TENANT_RELEASE_READINESS_CORE_EVIDENCE_REF,
      requiredSourceScope: TenantContextPackCompletenessSourceScope.ActiveScope,
    }],
    [TenantContextPackCompletenessRequirementSetId.RuntimeOperationsCore]: [{
      requirementId: TenantContextPackCompletenessRequirementId.RuntimeRunbookPolicy,
      itemKind: ContextPackItemKind.Policy,
      message: "runtime operations runbook policy is required",
      evidenceRef: TENANT_RUNTIME_OPERATIONS_CORE_EVIDENCE_REF,
      requiredSourceScope: TenantContextPackCompletenessSourceScope.ActiveScope,
    }, {
      requirementId: TenantContextPackCompletenessRequirementId.RuntimeIncidentEvidence,
      itemKind: ContextPackItemKind.Evidence,
      message: "runtime incident evidence is required",
      evidenceRef: TENANT_RUNTIME_OPERATIONS_CORE_EVIDENCE_REF,
      requiredSourceScope: TenantContextPackCompletenessSourceScope.ActiveScope,
    }],
  };

export function listTenantContextPackCompletenessRequirementSetDescriptors():
  readonly TenantContextPackCompletenessRequirementSetDescriptor[] {
  return (Object.entries(TENANT_CONTEXT_PACK_COMPLETENESS_REQUIREMENT_SETS) as [
    TenantContextPackCompletenessRequirementSetId,
    readonly TenantContextPackCompletenessRequirementPolicy[],
  ][]).map(([setId, requirements]) => ({
    setId,
    requirements: requirements.map(cloneTenantCompletenessRequirementPolicy),
  }));
}

export function createTenantConfigContextPackCompletenessPolicy(
  input: CreateTenantConfigContextPackCompletenessPolicyInput,
): ContextPackCompletenessPolicyPort {
  const fallback = input.fallback ?? createDefaultContextPackCompletenessPolicy();
  return {
    async evaluate(request): Promise<ContextPackCompletenessPolicyResult> {
      const base = cloneCompletenessPolicyResult(await fallback.evaluate(request));
      const organizationId = request.request.snapshot.organizationId;
      if (!isNonEmptyString(organizationId)) return base;

      let config: TenantConfig | null;
      try {
        config = await input.tenantConfigs.get(organizationId);
      } catch {
        return completenessResultWithConfigFailure(base);
      }

      if (config === null) return base;
      return completenessResultWithTenantRequirements(base, config, request);
    },
  };
}

export async function previewTenantContextPackCompletenessPolicy(
  input: PreviewTenantContextPackCompletenessPolicyInput,
): Promise<ContextPackCompletenessPolicyResult> {
  const fallback = input.fallback ?? createDefaultContextPackCompletenessPolicy();
  const base = cloneCompletenessPolicyResult(await fallback.evaluate(input.request));
  const hardBlockMissingRequiredContext = input.policy.hardBlockMissingRequiredContext !== false;
  const requirements = [
    ...requirementSetRequirementsFrom(input.policy.requirementSetIds, hardBlockMissingRequiredContext),
    ...completenessRequirementsFrom(input.policy.requirements, hardBlockMissingRequiredContext),
  ].filter((requirement) => requirementApplies(requirement, input.request));
  if (requirements.length === 0) return base;

  return completenessResultWithEffectiveRequirements({
    base,
    request: input.request,
    requirements,
    inheritsFallback: input.policy.blocksInheritedRequirements !== true,
  });
}

function completenessResultWithTenantRequirements(
  base: ContextPackCompletenessPolicyResult,
  config: TenantConfig,
  request: ContextPackCompletenessPolicyRequest,
): ContextPackCompletenessPolicyResult {
  const plan = tenantCompletenessPlanFor(config, request);
  if (plan.requirements.length === 0) return plan.inheritsFallback ? base : emptyCompletenessPolicyResult();
  return completenessResultWithEffectiveRequirements({
    base,
    request,
    requirements: plan.requirements,
    inheritsFallback: plan.inheritsFallback,
  });
}

function completenessResultWithEffectiveRequirements(input: {
  base: ContextPackCompletenessPolicyResult;
  request: ContextPackCompletenessPolicyRequest;
  requirements: readonly TenantContextPackCompletenessRequirement[];
  inheritsFallback: boolean;
}): ContextPackCompletenessPolicyResult {
  const inherited = input.inheritsFallback ? input.base : emptyCompletenessPolicyResult();

  const omissions: ContextPackOmittedItem[] = [];
  const lifecycleBlockers: string[] = [];
  const evidenceRefs: string[] = [];
  for (const requirement of input.requirements) {
    evidenceRefs.push(requirement.evidenceRef);
    if (requirementSatisfied(requirement, input.request)) continue;
    omissions.push({
      nodeId: contextRequirementNodeId(requirement.requirementId),
      reason: ContextPackOmissionReason.NotIndexed,
      message: requirement.message,
    });
    if (requirement.hardBlockMissingRequiredContext) {
      lifecycleBlockers.push(requirement.message);
    }
  }

  return {
    omittedItemsWithReason: uniqueOmittedItems([
      ...inherited.omittedItemsWithReason,
      ...omissions,
    ]),
    lifecycleBlockers: uniqueStrings([
      ...(inherited.lifecycleBlockers ?? []),
      ...lifecycleBlockers,
    ]),
    evidenceRefs: uniqueStrings([
      ...(inherited.evidenceRefs ?? []),
      ...evidenceRefs,
    ]),
  };
}

function completenessResultWithConfigFailure(
  base: ContextPackCompletenessPolicyResult,
): ContextPackCompletenessPolicyResult {
  return {
    omittedItemsWithReason: uniqueOmittedItems([
      ...base.omittedItemsWithReason,
      {
        nodeId: contextRequirementNodeId(TENANT_COMPLETENESS_CONFIG_FAILURE_REQUIREMENT_ID),
        reason: ContextPackOmissionReason.RetrievalFailed,
        message: TENANT_COMPLETENESS_CONFIG_FAILURE_MESSAGE,
      },
    ]),
    lifecycleBlockers: uniqueStrings([
      ...(base.lifecycleBlockers ?? []),
      TENANT_COMPLETENESS_CONFIG_FAILURE_MESSAGE,
    ]),
    evidenceRefs: [...(base.evidenceRefs ?? [])],
  };
}

function tenantCompletenessPlanFor(
  config: TenantConfig,
  request: ContextPackCompletenessPolicyRequest,
): { inheritsFallback: boolean; requirements: readonly TenantContextPackCompletenessRequirement[] } {
  let inheritsFallback = true;
  let requirements: TenantContextPackCompletenessRequirement[] = [];
  for (const layer of [...(config.layers ?? [])]
    .filter((layer) => tenantConfigLayerMatches(layer, request))
    .sort(compareTenantConfigLayers)) {
    const layerRequirements = tenantCompletenessLayerRequirements(layer, request);
    if (layerRequirements === null) continue;
    if (layerRequirements.blocksInheritedRequirements) {
      inheritsFallback = false;
      requirements = [];
    }
    requirements.push(...layerRequirements.requirements);
  }
  return { inheritsFallback, requirements: requirementsByLatestId(requirements) };
}

function tenantCompletenessLayerRequirements(
  layer: TenantConfigLayer,
  request: ContextPackCompletenessPolicyRequest,
): TenantContextPackCompletenessLayerRequirements | null {
  const completeness = tenantContextPackCompletenessPolicy(layer.policy.contextPack?.completeness);
  if (completeness === null) return null;
  const hardBlockMissingRequiredContext = completeness.hardBlockMissingRequiredContext !== false;
  const requirements = [
    ...requirementSetRequirementsFrom(completeness.requirementSetIds, hardBlockMissingRequiredContext),
    ...completenessRequirementsFrom(completeness.requirements, hardBlockMissingRequiredContext),
  ].filter((requirement) => requirementApplies(requirement, request));
  if (requirements.length === 0) return null;
  return {
    blocksInheritedRequirements: completeness.blocksInheritedRequirements === true,
    requirements,
  };
}

function tenantContextPackCompletenessPolicy(value: unknown): TenantContextPackCompletenessPolicy | null {
  return isRecord(value) ? value as TenantContextPackCompletenessPolicy : null;
}

function requirementSetRequirementsFrom(
  requirementSetIds: readonly string[] | undefined,
  hardBlockMissingRequiredContext: boolean,
): readonly TenantContextPackCompletenessRequirement[] {
  if (!Array.isArray(requirementSetIds)) return [];
  return uniqueStrings(requirementSetIds).flatMap((requirementSetId) => {
    const normalized = tenantCompletenessRequirementSetId(requirementSetId);
    if (normalized === null) return [];
    return completenessRequirementsFrom(
      TENANT_CONTEXT_PACK_COMPLETENESS_REQUIREMENT_SETS[normalized],
      hardBlockMissingRequiredContext,
    );
  });
}

function cloneTenantCompletenessRequirementPolicy(
  requirement: TenantContextPackCompletenessRequirementPolicy,
): TenantContextPackCompletenessRequirementPolicy {
  return {
    requirementId: requirement.requirementId,
    itemKind: requirement.itemKind,
    message: requirement.message,
    evidenceRef: requirement.evidenceRef,
    ...(requirement.requiredSourceScope === undefined
      ? {}
      : { requiredSourceScope: requirement.requiredSourceScope }),
    ...(requirement.appliesTo === undefined ? {} : { appliesTo: cloneAppliesTo(requirement.appliesTo) }),
  };
}

function cloneAppliesTo(appliesTo: TenantContextPackCompletenessAppliesTo): TenantContextPackCompletenessAppliesTo {
  return {
    ...(appliesTo.hatIds === undefined ? {} : { hatIds: [...appliesTo.hatIds] }),
    ...(appliesTo.departmentIds === undefined ? {} : { departmentIds: [...appliesTo.departmentIds] }),
    ...(appliesTo.phases === undefined ? {} : { phases: [...appliesTo.phases] }),
    ...(appliesTo.scopes === undefined ? {} : { scopes: [...appliesTo.scopes] }),
    ...(appliesTo.projectIds === undefined ? {} : { projectIds: [...appliesTo.projectIds] }),
    ...(appliesTo.teamIds === undefined ? {} : { teamIds: [...appliesTo.teamIds] }),
    ...(appliesTo.workItemIds === undefined ? {} : { workItemIds: [...appliesTo.workItemIds] }),
  };
}

function completenessRequirementsFrom(
  requirements: readonly TenantContextPackCompletenessRequirementPolicy[] | undefined,
  hardBlockMissingRequiredContext: boolean,
): readonly TenantContextPackCompletenessRequirement[] {
  if (!Array.isArray(requirements)) return [];
  return requirements.flatMap((requirement) => {
    const normalized = tenantCompletenessRequirement(requirement, hardBlockMissingRequiredContext);
    return normalized === null ? [] : [normalized];
  });
}

function tenantCompletenessRequirement(
  requirement: TenantContextPackCompletenessRequirementPolicy,
  hardBlockMissingRequiredContext: boolean,
): TenantContextPackCompletenessRequirement | null {
  const requirementId = optionalString(requirement.requirementId);
  const itemKind = contextPackItemKind(requirement.itemKind);
  const message = optionalString(requirement.message);
  const evidenceRef = optionalString(requirement.evidenceRef);
  const sourceScope = tenantCompletenessSourceScope(requirement.requiredSourceScope);
  if (
    requirementId === undefined ||
    itemKind === null ||
    message === undefined ||
    evidenceRef === undefined ||
    sourceScope === null
  ) {
    return null;
  }
  return {
    requirementId,
    itemKind,
    message,
    evidenceRef,
    requiredSourceScope: sourceScope,
    hardBlockMissingRequiredContext,
    appliesTo: normalizedAppliesTo(requirement.appliesTo),
  };
}

function requirementSatisfied(
  requirement: TenantContextPackCompletenessRequirement,
  request: ContextPackCompletenessPolicyRequest,
): boolean {
  return request.items.some((item) =>
    item.kind === requirement.itemKind &&
    (requirement.requiredSourceScope === TenantContextPackCompletenessSourceScope.Any ||
      itemHasActiveScopeSourcePointer(item, request))
  );
}

function itemHasActiveScopeSourcePointer(
  item: ContextPackItem,
  request: ContextPackCompletenessPolicyRequest,
): boolean {
  return (item.sourcePointers ?? []).some((pointer) =>
    !contextPackSourcePointerIsOutsideActiveScope(pointer, item, request.request.snapshot, request.request.hierarchy)
  );
}

function requirementApplies(
  requirement: TenantContextPackCompletenessRequirement,
  request: ContextPackCompletenessPolicyRequest,
): boolean {
  const snapshot = request.request.snapshot;
  return filterMatches(requirement.appliesTo.hatIds, snapshot.hat.id) &&
    filterMatches(requirement.appliesTo.departmentIds, snapshot.hat.departmentId) &&
    filterMatches(requirement.appliesTo.phases, snapshot.phase) &&
    filterMatches(requirement.appliesTo.scopes, snapshot.scope) &&
    filterMatches(requirement.appliesTo.projectIds, snapshot.projectId) &&
    filterMatches(requirement.appliesTo.teamIds, snapshot.teamId) &&
    filterMatches(requirement.appliesTo.workItemIds, snapshot.workItemId);
}

function normalizedAppliesTo(
  appliesTo: TenantContextPackCompletenessAppliesTo | undefined,
): NormalizedCompletenessAppliesTo {
  if (!isRecord(appliesTo)) return EMPTY_COMPLETENESS_APPLIES_TO;
  return {
    hatIds: nonEmptyStrings(appliesTo.hatIds),
    departmentIds: nonEmptyStrings(appliesTo.departmentIds),
    phases: runLifecyclePhasesFrom(appliesTo.phases),
    scopes: runScopesFrom(appliesTo.scopes),
    projectIds: nonEmptyStrings(appliesTo.projectIds),
    teamIds: nonEmptyStrings(appliesTo.teamIds),
    workItemIds: nonEmptyStrings(appliesTo.workItemIds),
  };
}

function tenantConfigLayerMatches(
  layer: TenantConfigLayer,
  request: ContextPackCompletenessPolicyRequest,
): boolean {
  const snapshot = request.request.snapshot;
  switch (layer.scope.kind) {
    case ConfigLayerScopeKind.Organization:
      return layer.scope.id === snapshot.organizationId;
    case ConfigLayerScopeKind.Department:
      return layer.scope.id === snapshot.hat.departmentId;
    case ConfigLayerScopeKind.Hat:
      return layer.scope.id === snapshot.hat.id;
    case ConfigLayerScopeKind.WorkItem:
      return layer.scope.id === snapshot.workItemId;
  }
}

function compareTenantConfigLayers(left: TenantConfigLayer, right: TenantConfigLayer): number {
  const specificity = TenantContextPackLayerSpecificity[left.scope.kind] -
    TenantContextPackLayerSpecificity[right.scope.kind];
  if (specificity !== 0) return specificity;
  const updatedAt = left.updatedAt.localeCompare(right.updatedAt);
  if (updatedAt !== 0) return updatedAt;
  const version = left.version - right.version;
  if (version !== 0) return version;
  return left.layerId.localeCompare(right.layerId);
}

function contextRequirementNodeId(requirementId: string): string {
  return `${CONTEXT_REQUIREMENT_NODE_ID_PREFIX}:${requirementId}`;
}

function filterMatches<T extends string>(allowedValues: readonly T[], value: T | undefined): boolean {
  return allowedValues.length === 0 || (value !== undefined && allowedValues.includes(value));
}

function contextPackItemKind(value: unknown): ContextPackItemKind | null {
  return typeof value === "string" && Object.values(ContextPackItemKind).includes(value as ContextPackItemKind)
    ? value as ContextPackItemKind
    : null;
}

function tenantCompletenessSourceScope(
  value: unknown,
): TenantContextPackCompletenessSourceScope | null {
  if (value === undefined) return TenantContextPackCompletenessSourceScope.Any;
  return typeof value === "string" &&
      Object.values(TenantContextPackCompletenessSourceScope).includes(value as TenantContextPackCompletenessSourceScope)
    ? value as TenantContextPackCompletenessSourceScope
    : null;
}

function tenantCompletenessRequirementSetId(
  value: unknown,
): TenantContextPackCompletenessRequirementSetId | null {
  return typeof value === "string" &&
      Object.values(TenantContextPackCompletenessRequirementSetId).includes(value as TenantContextPackCompletenessRequirementSetId)
    ? value as TenantContextPackCompletenessRequirementSetId
    : null;
}

function runLifecyclePhasesFrom(input: readonly string[] | undefined): readonly RunLifecyclePhase[] {
  if (!Array.isArray(input)) return [];
  return uniqueStrings(input.flatMap((value) =>
    Object.values(RunLifecyclePhase).includes(value as RunLifecyclePhase) ? [value as RunLifecyclePhase] : []
  ));
}

function runScopesFrom(input: readonly string[] | undefined): readonly RunScope[] {
  if (!Array.isArray(input)) return [];
  return uniqueStrings(input.flatMap((value) =>
    Object.values(RunScope).includes(value as RunScope) ? [value as RunScope] : []
  ));
}

function nonEmptyStrings(input: readonly string[] | undefined): readonly string[] {
  if (!Array.isArray(input)) return [];
  return uniqueStrings(input.flatMap((value) => {
    const normalized = optionalString(value);
    return normalized === undefined ? [] : [normalized];
  }));
}

function optionalString(value: unknown): string | undefined {
  return isNonEmptyString(value) ? value.trim() : undefined;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uniqueStrings<T extends string>(values: readonly T[]): readonly T[] {
  return [...new Set(values)];
}

function uniqueOmittedItems(values: readonly ContextPackOmittedItem[]): readonly ContextPackOmittedItem[] {
  const seen = new Set<string>();
  const result: ContextPackOmittedItem[] = [];
  for (const value of values) {
    const key = value.nodeId ?? `${value.reason}:${value.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function requirementsByLatestId(
  values: readonly TenantContextPackCompletenessRequirement[],
): readonly TenantContextPackCompletenessRequirement[] {
  const byRequirementId = new Map<string, TenantContextPackCompletenessRequirement>();
  for (const value of values) {
    if (byRequirementId.has(value.requirementId)) {
      byRequirementId.delete(value.requirementId);
    }
    byRequirementId.set(value.requirementId, value);
  }
  return [...byRequirementId.values()];
}

function cloneCompletenessPolicyResult(
  result: ContextPackCompletenessPolicyResult,
): ContextPackCompletenessPolicyResult {
  return {
    omittedItemsWithReason: [...result.omittedItemsWithReason],
    lifecycleBlockers: [...(result.lifecycleBlockers ?? [])],
    evidenceRefs: [...(result.evidenceRefs ?? [])],
  };
}

function emptyCompletenessPolicyResult(): ContextPackCompletenessPolicyResult {
  return {
    omittedItemsWithReason: [],
    lifecycleBlockers: [],
    evidenceRefs: [],
  };
}
