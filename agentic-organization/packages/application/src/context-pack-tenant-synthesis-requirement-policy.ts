import {
  ConfigLayerScopeKind,
  TenantContextPackSynthesisRequirementReason,
  TenantContextPackSynthesisRequirementSetId,
  type TenantConfig,
  type TenantConfigLayer,
  type TenantContextPackCompletenessAppliesTo,
  type TenantContextPackSynthesisRequirementPolicy,
  type TenantContextPackSynthesisRequirementRule,
} from "../../domain/src/index.ts";
import {
  ContextPackSynthesisRequirementDecision,
  ContextPackSynthesisRequirementReason,
  DEFAULT_CONTEXT_PACK_SYNTHESIS_REQUIREMENT_POLICY_VERSION,
  createDefaultContextPackSynthesisRequirementPolicy,
  type ContextPackSynthesisRequirement,
  type ContextPackSynthesisRequirementPolicyPort,
  type ContextPackSynthesisRequirementPolicyRequest,
} from "./context-pack-builder.ts";
import { RunLifecyclePhase, RunScope } from "./observe.ts";

export type TenantConfigContextPackSynthesisRequirementConfigReader = {
  get: (organizationId: string) => Promise<TenantConfig | null> | TenantConfig | null;
};

export type CreateTenantConfigContextPackSynthesisRequirementPolicyInput = {
  tenantConfigs: TenantConfigContextPackSynthesisRequirementConfigReader;
  fallback?: ContextPackSynthesisRequirementPolicyPort | undefined;
};

export type PreviewTenantContextPackSynthesisRequirementPolicyInput = {
  policy: TenantContextPackSynthesisRequirementPolicy;
  request: ContextPackSynthesisRequirementPolicyRequest;
  fallback?: ContextPackSynthesisRequirementPolicyPort | undefined;
};

export type TenantContextPackSynthesisRequirementSetDescriptor = {
  setId: TenantContextPackSynthesisRequirementSetId;
  requirements: readonly TenantContextPackSynthesisRequirementRule[];
};

type TenantContextPackSynthesisRequirement = {
  requirementId: string;
  reason: ContextPackSynthesisRequirementReason;
  appliesTo: NormalizedSynthesisRequirementAppliesTo;
};

type TenantContextPackSynthesisRequirementLayer = {
  blocksInheritedRequirements: boolean;
  requirements: readonly TenantContextPackSynthesisRequirement[];
};

type NormalizedSynthesisRequirementAppliesTo = {
  hatIds: readonly string[];
  departmentIds: readonly string[];
  phases: readonly RunLifecyclePhase[];
  scopes: readonly RunScope[];
  projectIds: readonly string[];
  teamIds: readonly string[];
  workItemIds: readonly string[];
};

export const TenantContextPackSynthesisRequirementPolicyVersionSegment = {
  TenantContext: "tenant-context",
  AuthoringPreview: "tenant-context-preview",
} as const;

export type TenantContextPackSynthesisRequirementPolicyVersionSegment =
  (typeof TenantContextPackSynthesisRequirementPolicyVersionSegment)[keyof typeof TenantContextPackSynthesisRequirementPolicyVersionSegment];

const TENANT_CONTEXT_PACK_SYNTHESIS_REQUIREMENT_LAYER_SEPARATOR = "+";

const TenantSynthesisRequirementId = {
  HighStakesReviewModelBriefing: "tenant_high_stakes_review_model_briefing",
  ResourceAllocationModelBriefing: "tenant_resource_allocation_model_briefing",
  PriorityChangeModelBriefing: "tenant_priority_change_model_briefing",
  ArchitectureTradeoffModelBriefing: "tenant_architecture_tradeoff_model_briefing",
  ReleaseReadinessModelBriefing: "tenant_release_readiness_model_briefing",
  SecurityExceptionModelBriefing: "tenant_security_exception_model_briefing",
  CustomerBusinessScopeModelBriefing: "tenant_customer_business_scope_model_briefing",
  RuntimeOperationsModelBriefing: "tenant_runtime_operations_model_briefing",
} as const;

const TenantContextPackLayerSpecificity = {
  [ConfigLayerScopeKind.Organization]: 0,
  [ConfigLayerScopeKind.Department]: 1,
  [ConfigLayerScopeKind.Hat]: 2,
  [ConfigLayerScopeKind.WorkItem]: 3,
} as const;

const EMPTY_SYNTHESIS_REQUIREMENT_APPLIES_TO: NormalizedSynthesisRequirementAppliesTo = {
  hatIds: [],
  departmentIds: [],
  phases: [],
  scopes: [],
  projectIds: [],
  teamIds: [],
  workItemIds: [],
};

const TENANT_CONTEXT_PACK_SYNTHESIS_REQUIREMENT_SETS:
  Readonly<Record<TenantContextPackSynthesisRequirementSetId, readonly TenantContextPackSynthesisRequirementRule[]>> = {
    [TenantContextPackSynthesisRequirementSetId.HighStakesReviewCore]: [{
      requirementId: TenantSynthesisRequirementId.HighStakesReviewModelBriefing,
      reason: TenantContextPackSynthesisRequirementReason.TenantRequiresHighStakesReviewBriefing,
      appliesTo: {
        phases: [RunLifecyclePhase.AwaitingReview],
        scopes: [RunScope.WorkItem],
      },
    }],
    [TenantContextPackSynthesisRequirementSetId.ResourceAllocationCore]: [{
      requirementId: TenantSynthesisRequirementId.ResourceAllocationModelBriefing,
      reason: TenantContextPackSynthesisRequirementReason.TenantRequiresResourceAllocationBriefing,
      appliesTo: {
        phases: [RunLifecyclePhase.Blocked],
        scopes: [RunScope.Project, RunScope.Initiative],
      },
    }],
    [TenantContextPackSynthesisRequirementSetId.PriorityChangeCore]: [{
      requirementId: TenantSynthesisRequirementId.PriorityChangeModelBriefing,
      reason: TenantContextPackSynthesisRequirementReason.TenantRequiresPriorityChangeBriefing,
      appliesTo: {
        phases: [RunLifecyclePhase.AwaitingGate, RunLifecyclePhase.Blocked],
        scopes: [RunScope.Project, RunScope.Initiative],
      },
    }],
    [TenantContextPackSynthesisRequirementSetId.ArchitectureTradeoffCore]: [{
      requirementId: TenantSynthesisRequirementId.ArchitectureTradeoffModelBriefing,
      reason: TenantContextPackSynthesisRequirementReason.TenantRequiresArchitectureTradeoffBriefing,
      appliesTo: {
        phases: [RunLifecyclePhase.AwaitingGate, RunLifecyclePhase.AwaitingReview, RunLifecyclePhase.Blocked],
        scopes: [RunScope.WorkItem, RunScope.Project],
      },
    }],
    [TenantContextPackSynthesisRequirementSetId.ReleaseReadinessCore]: [{
      requirementId: TenantSynthesisRequirementId.ReleaseReadinessModelBriefing,
      reason: TenantContextPackSynthesisRequirementReason.TenantRequiresReleaseReadinessBriefing,
      appliesTo: {
        phases: [RunLifecyclePhase.AwaitingReview],
        scopes: [RunScope.WorkItem, RunScope.Project],
      },
    }],
    [TenantContextPackSynthesisRequirementSetId.SecurityExceptionCore]: [{
      requirementId: TenantSynthesisRequirementId.SecurityExceptionModelBriefing,
      reason: TenantContextPackSynthesisRequirementReason.TenantRequiresSecurityExceptionBriefing,
      appliesTo: {
        phases: [RunLifecyclePhase.AwaitingGate, RunLifecyclePhase.Blocked],
        scopes: [RunScope.WorkItem, RunScope.Project],
      },
    }],
    [TenantContextPackSynthesisRequirementSetId.CustomerBusinessScopeCore]: [{
      requirementId: TenantSynthesisRequirementId.CustomerBusinessScopeModelBriefing,
      reason: TenantContextPackSynthesisRequirementReason.TenantRequiresCustomerScopeBriefing,
      appliesTo: {
        phases: [RunLifecyclePhase.AwaitingGate, RunLifecyclePhase.Blocked],
        scopes: [RunScope.WorkItem, RunScope.Project],
      },
    }],
    [TenantContextPackSynthesisRequirementSetId.RuntimeOperationsCore]: [{
      requirementId: TenantSynthesisRequirementId.RuntimeOperationsModelBriefing,
      reason: TenantContextPackSynthesisRequirementReason.TenantRequiresRuntimeOperationsBriefing,
      appliesTo: {
        phases: [RunLifecyclePhase.Failed, RunLifecyclePhase.Blocked],
        scopes: [RunScope.Run, RunScope.WorkItem],
      },
    }],
  };

export function listTenantContextPackSynthesisRequirementSetDescriptors():
  readonly TenantContextPackSynthesisRequirementSetDescriptor[] {
  return (Object.entries(TENANT_CONTEXT_PACK_SYNTHESIS_REQUIREMENT_SETS) as [
    TenantContextPackSynthesisRequirementSetId,
    readonly TenantContextPackSynthesisRequirementRule[],
  ][]).map(([setId, requirements]) => ({
    setId,
    requirements: requirements.map(cloneTenantSynthesisRequirementRule),
  }));
}

export function createTenantConfigContextPackSynthesisRequirementPolicy(
  input: CreateTenantConfigContextPackSynthesisRequirementPolicyInput,
): ContextPackSynthesisRequirementPolicyPort {
  const fallback = input.fallback ?? createDefaultContextPackSynthesisRequirementPolicy();
  return {
    async evaluate(request): Promise<ContextPackSynthesisRequirement> {
      const base = cloneSynthesisRequirement(await fallback.evaluate(request));
      const organizationId = request.request.snapshot.organizationId;
      if (!isNonEmptyString(organizationId)) return base;

      let config: TenantConfig | null;
      try {
        config = await input.tenantConfigs.get(organizationId);
      } catch {
        return base;
      }

      if (config === null) return base;
      return synthesisRequirementWithTenantLayers(base, config, request);
    },
  };
}

export async function previewTenantContextPackSynthesisRequirementPolicy(
  input: PreviewTenantContextPackSynthesisRequirementPolicyInput,
): Promise<ContextPackSynthesisRequirement> {
  const fallback = input.fallback ?? createDefaultContextPackSynthesisRequirementPolicy();
  const base = cloneSynthesisRequirement(await fallback.evaluate(input.request));
  const requirements = [
    ...requirementSetRulesFrom(input.policy.requirementSetIds),
    ...requirementsFrom(input.policy.requirements),
  ].filter((requirement) => requirementApplies(requirement, input.request));
  const effectiveRequirement = requirements[0];
  if (effectiveRequirement !== undefined) {
    return {
      decision: ContextPackSynthesisRequirementDecision.Required,
      reason: effectiveRequirement.reason,
      policyVersion: tenantSynthesisRequirementPreviewPolicyVersion(base.policyVersion),
    };
  }

  if (input.policy.blocksInheritedRequirements === true) {
    return {
      decision: ContextPackSynthesisRequirementDecision.Optional,
      reason: ContextPackSynthesisRequirementReason.DeterministicOnlyAllowed,
      policyVersion: tenantSynthesisRequirementPreviewPolicyVersion(base.policyVersion),
    };
  }

  return base;
}

function synthesisRequirementWithTenantLayers(
  base: ContextPackSynthesisRequirement,
  config: TenantConfig,
  request: ContextPackSynthesisRequirementPolicyRequest,
): ContextPackSynthesisRequirement {
  let inheritedRequirement: ContextPackSynthesisRequirement | null =
    base.decision === ContextPackSynthesisRequirementDecision.Required ? base : null;
  let requirements: TenantContextPackSynthesisRequirement[] = [];
  const appliedLayerIds: string[] = [];

  for (const layer of [...(config.layers ?? [])]
    .filter((layer) => tenantConfigLayerMatches(layer, request))
    .sort(compareTenantConfigLayers)) {
    const layerRequirement = tenantSynthesisRequirementLayer(layer, request);
    if (layerRequirement === null) continue;
    if (layerRequirement.blocksInheritedRequirements) {
      inheritedRequirement = null;
      requirements = [];
    }
    requirements.push(...layerRequirement.requirements);
    appliedLayerIds.push(layer.layerId);
  }

  const effectiveTenantRequirement = requirements.find((requirement) => requirementApplies(requirement, request));
  if (effectiveTenantRequirement !== undefined) {
    return {
      decision: ContextPackSynthesisRequirementDecision.Required,
      reason: effectiveTenantRequirement.reason,
      policyVersion: tenantSynthesisRequirementPolicyVersion(base.policyVersion, config.version, appliedLayerIds),
    };
  }
  if (inheritedRequirement !== null) {
    return appliedLayerIds.length === 0
      ? inheritedRequirement
      : {
          ...inheritedRequirement,
          policyVersion: tenantSynthesisRequirementPolicyVersion(base.policyVersion, config.version, appliedLayerIds),
        };
  }
  if (appliedLayerIds.length === 0) return base;
  return {
    decision: ContextPackSynthesisRequirementDecision.Optional,
    reason: ContextPackSynthesisRequirementReason.DeterministicOnlyAllowed,
    policyVersion: tenantSynthesisRequirementPolicyVersion(base.policyVersion, config.version, appliedLayerIds),
  };
}

function tenantSynthesisRequirementLayer(
  layer: TenantConfigLayer,
  request: ContextPackSynthesisRequirementPolicyRequest,
): TenantContextPackSynthesisRequirementLayer | null {
  const policy = tenantContextPackSynthesisRequirementPolicy(layer.policy.contextPack?.synthesisRequirement);
  if (policy === null) return null;
  const requirements = [
    ...requirementSetRulesFrom(policy.requirementSetIds),
    ...requirementsFrom(policy.requirements),
  ].filter((requirement) => requirementApplies(requirement, request));
  if (requirements.length === 0 && policy.blocksInheritedRequirements !== true) return null;
  return {
    blocksInheritedRequirements: policy.blocksInheritedRequirements === true,
    requirements,
  };
}

function tenantContextPackSynthesisRequirementPolicy(value: unknown): TenantContextPackSynthesisRequirementPolicy | null {
  return isRecord(value) ? value as TenantContextPackSynthesisRequirementPolicy : null;
}

function requirementSetRulesFrom(
  requirementSetIds: readonly string[] | undefined,
): readonly TenantContextPackSynthesisRequirement[] {
  if (!Array.isArray(requirementSetIds)) return [];
  return uniqueStrings(requirementSetIds).flatMap((requirementSetId) => {
    const normalized = tenantSynthesisRequirementSetId(requirementSetId);
    return normalized === null ? [] : requirementsFrom(TENANT_CONTEXT_PACK_SYNTHESIS_REQUIREMENT_SETS[normalized]);
  });
}

function requirementsFrom(
  requirements: readonly TenantContextPackSynthesisRequirementRule[] | undefined,
): readonly TenantContextPackSynthesisRequirement[] {
  if (!Array.isArray(requirements)) return [];
  return requirements.flatMap((requirement) => {
    const normalized = tenantSynthesisRequirement(requirement);
    return normalized === null ? [] : [normalized];
  });
}

function cloneTenantSynthesisRequirementRule(
  rule: TenantContextPackSynthesisRequirementRule,
): TenantContextPackSynthesisRequirementRule {
  return {
    requirementId: rule.requirementId,
    reason: rule.reason,
    ...(rule.appliesTo === undefined ? {} : { appliesTo: cloneAppliesTo(rule.appliesTo) }),
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

function tenantSynthesisRequirement(
  requirement: TenantContextPackSynthesisRequirementRule,
): TenantContextPackSynthesisRequirement | null {
  const requirementId = optionalString(requirement.requirementId);
  const reason = tenantSynthesisRequirementReason(requirement.reason);
  if (requirementId === undefined || reason === null) return null;
  return {
    requirementId,
    reason,
    appliesTo: normalizedAppliesTo(requirement.appliesTo),
  };
}

function tenantSynthesisRequirementReason(value: unknown): ContextPackSynthesisRequirementReason | null {
  switch (value) {
    case TenantContextPackSynthesisRequirementReason.TenantRequiresModelBriefing:
      return ContextPackSynthesisRequirementReason.TenantRequiresModelBriefing;
    case TenantContextPackSynthesisRequirementReason.TenantRequiresHighStakesReviewBriefing:
      return ContextPackSynthesisRequirementReason.TenantRequiresHighStakesReviewBriefing;
    case TenantContextPackSynthesisRequirementReason.TenantRequiresResourceAllocationBriefing:
      return ContextPackSynthesisRequirementReason.TenantRequiresResourceAllocationBriefing;
    case TenantContextPackSynthesisRequirementReason.TenantRequiresPriorityChangeBriefing:
      return ContextPackSynthesisRequirementReason.TenantRequiresPriorityChangeBriefing;
    case TenantContextPackSynthesisRequirementReason.TenantRequiresArchitectureTradeoffBriefing:
      return ContextPackSynthesisRequirementReason.TenantRequiresArchitectureTradeoffBriefing;
    case TenantContextPackSynthesisRequirementReason.TenantRequiresReleaseReadinessBriefing:
      return ContextPackSynthesisRequirementReason.TenantRequiresReleaseReadinessBriefing;
    case TenantContextPackSynthesisRequirementReason.TenantRequiresSecurityExceptionBriefing:
      return ContextPackSynthesisRequirementReason.TenantRequiresSecurityExceptionBriefing;
    case TenantContextPackSynthesisRequirementReason.TenantRequiresCustomerScopeBriefing:
      return ContextPackSynthesisRequirementReason.TenantRequiresCustomerScopeBriefing;
    case TenantContextPackSynthesisRequirementReason.TenantRequiresRuntimeOperationsBriefing:
      return ContextPackSynthesisRequirementReason.TenantRequiresRuntimeOperationsBriefing;
    default:
      return null;
  }
}

function tenantSynthesisRequirementSetId(value: unknown): TenantContextPackSynthesisRequirementSetId | null {
  return typeof value === "string" &&
      Object.values(TenantContextPackSynthesisRequirementSetId).includes(value as TenantContextPackSynthesisRequirementSetId)
    ? value as TenantContextPackSynthesisRequirementSetId
    : null;
}

function requirementApplies(
  requirement: TenantContextPackSynthesisRequirement,
  request: ContextPackSynthesisRequirementPolicyRequest,
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
): NormalizedSynthesisRequirementAppliesTo {
  if (!isRecord(appliesTo)) return EMPTY_SYNTHESIS_REQUIREMENT_APPLIES_TO;
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
  request: ContextPackSynthesisRequirementPolicyRequest,
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

function tenantSynthesisRequirementPolicyVersion(
  basePolicyVersion: string,
  configVersion: number,
  appliedLayerIds: readonly string[],
): string {
  return [
    basePolicyVersion || DEFAULT_CONTEXT_PACK_SYNTHESIS_REQUIREMENT_POLICY_VERSION,
    TenantContextPackSynthesisRequirementPolicyVersionSegment.TenantContext,
    String(configVersion),
    ...appliedLayerIds,
  ].join(TENANT_CONTEXT_PACK_SYNTHESIS_REQUIREMENT_LAYER_SEPARATOR);
}

function tenantSynthesisRequirementPreviewPolicyVersion(basePolicyVersion: string): string {
  return [
    basePolicyVersion || DEFAULT_CONTEXT_PACK_SYNTHESIS_REQUIREMENT_POLICY_VERSION,
    TenantContextPackSynthesisRequirementPolicyVersionSegment.AuthoringPreview,
  ].join(TENANT_CONTEXT_PACK_SYNTHESIS_REQUIREMENT_LAYER_SEPARATOR);
}

function filterMatches<T extends string>(allowedValues: readonly T[], value: T | undefined): boolean {
  return allowedValues.length === 0 || (value !== undefined && allowedValues.includes(value));
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

function cloneSynthesisRequirement(requirement: ContextPackSynthesisRequirement): ContextPackSynthesisRequirement {
  return { ...requirement };
}
