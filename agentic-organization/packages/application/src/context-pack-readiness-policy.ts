import {
  ConfigLayerScopeKind,
  isTenantContextPackOmissionReason,
  isTenantContextPackUncertaintySeverity,
  isTenantContextPackUncertaintySignalKind,
  type TenantConfig,
  type TenantConfigLayer,
  type TenantContextPackCompletenessAppliesTo,
  type TenantContextPackContradictionHardStopRule,
  type TenantContextPackLifecycleBlockerHardStopRule,
  type TenantContextPackOmissionHardStopRule,
  type TenantContextPackReadinessPolicy,
  type TenantContextPackStaleHardStopRule,
  type TenantContextPackUncertaintyHardStopRule,
} from "../../domain/src/index.ts";
import {
  ContextPackCurationStageKind,
  ContextPackFreshness,
  ContextPackOmissionReason,
  ContextPackStatus,
  type ContextPack,
  type ContextPackCurationStageKind as ContextPackCurationStageKindType,
  type ContextPackOmissionReason as ContextPackOmissionReasonType,
  type ContextPackUncertaintySeverity,
  type ContextPackUncertaintySignalKind,
} from "./context-pack-contracts.ts";
import type { AgentObserveSnapshot } from "./observe.ts";
import { RunScope } from "./run-scope.ts";

export const REQUIRED_CURRENT_CONTEXT_PACK_STAGES: readonly ContextPackCurationStageKindType[] = [
  ContextPackCurationStageKind.DeterministicScope,
  ContextPackCurationStageKind.RequiredConsult,
  ContextPackCurationStageKind.GapReview,
];

export type ContextPackReadinessPolicyRequest = {
  pack: ContextPack;
  observedAt: string;
  snapshot?: AgentObserveSnapshot | undefined;
};

export type ContextPackReadinessPolicyResult = {
  status: ContextPackStatus;
  policyVersion: string;
  hardStopReasons: readonly string[];
};

export type ContextPackReadinessPolicyPort = {
  evaluate: (
    request: ContextPackReadinessPolicyRequest,
  ) => Promise<ContextPackReadinessPolicyResult> | ContextPackReadinessPolicyResult;
};

export type TenantConfigContextPackReadinessConfigReader = {
  get: (organizationId: string) => Promise<TenantConfig | null> | TenantConfig | null;
};

export type CreateTenantConfigContextPackReadinessPolicyInput = {
  tenantConfigs: TenantConfigContextPackReadinessConfigReader;
  fallback?: ContextPackReadinessPolicyPort | undefined;
};

type NormalizedUncertaintyHardStopRule = {
  ruleId: string;
  severity: ContextPackUncertaintySeverity;
  kinds: readonly ContextPackUncertaintySignalKind[];
  message: string;
  appliesTo: NormalizedReadinessAppliesTo;
};

type NormalizedOmissionHardStopRule = {
  ruleId: string;
  reasons: readonly ContextPackOmissionReasonType[];
  nodeIdPrefixes: readonly string[];
  message: string;
  appliesTo: NormalizedReadinessAppliesTo;
};

type NormalizedContradictionHardStopRule = {
  ruleId: string;
  message: string;
  appliesTo: NormalizedReadinessAppliesTo;
};

type NormalizedLifecycleBlockerHardStopRule = {
  ruleId: string;
  blockerPrefixes: readonly string[];
  message: string;
  appliesTo: NormalizedReadinessAppliesTo;
};

type NormalizedStaleHardStopRule = {
  ruleId: string;
  staleInputPrefixes: readonly string[];
  itemIdPrefixes: readonly string[];
  message: string;
  appliesTo: NormalizedReadinessAppliesTo;
};

type TenantContextPackReadinessLayerRules = {
  blocksInheritedUncertaintyHardStops: boolean;
  uncertaintyHardStops: readonly NormalizedUncertaintyHardStopRule[];
  blocksInheritedOmissionHardStops: boolean;
  omissionHardStops: readonly NormalizedOmissionHardStopRule[];
  blocksInheritedContradictionHardStops: boolean;
  contradictionHardStops: readonly NormalizedContradictionHardStopRule[];
  blocksInheritedLifecycleBlockerHardStops: boolean;
  lifecycleBlockerHardStops: readonly NormalizedLifecycleBlockerHardStopRule[];
  blocksInheritedStaleHardStops: boolean;
  staleHardStops: readonly NormalizedStaleHardStopRule[];
};

type NormalizedReadinessAppliesTo = {
  hatIds: readonly string[];
  departmentIds: readonly string[];
  phases: readonly string[];
  scopes: readonly RunScope[];
  projectIds: readonly string[];
  teamIds: readonly string[];
  workItemIds: readonly string[];
};

const DEFAULT_CONTEXT_PACK_READINESS_POLICY_VERSION = "context-pack-readiness:default:v1";
const TENANT_CONTEXT_PACK_READINESS_POLICY_VERSION_SEGMENT = "tenant-context-readiness";
const TENANT_CONTEXT_PACK_READINESS_LAYER_SEPARATOR = "+";

const TenantContextPackLayerSpecificity = {
  [ConfigLayerScopeKind.Organization]: 0,
  [ConfigLayerScopeKind.Department]: 1,
  [ConfigLayerScopeKind.Hat]: 2,
  [ConfigLayerScopeKind.WorkItem]: 3,
} as const;

const EMPTY_READINESS_APPLIES_TO: NormalizedReadinessAppliesTo = {
  hatIds: [],
  departmentIds: [],
  phases: [],
  scopes: [],
  projectIds: [],
  teamIds: [],
  workItemIds: [],
};

export function evaluateContextPackReadiness(pack: ContextPack, observedAt: string): ContextPackStatus {
  if (pack.omittedItemsWithReason.some((item) => item.reason === ContextPackOmissionReason.BuilderUnavailable)) {
    return ContextPackStatus.Missing;
  }
  if (pack.contradictions.length > 0) return ContextPackStatus.Conflicted;
  if (pack.omittedItemsWithReason.length > 0) return ContextPackStatus.Incomplete;
  if (contextPackHasInvalidTimestamps(pack, observedAt)) return ContextPackStatus.Incomplete;
  if (contextPackIsStale(pack, observedAt)) return ContextPackStatus.Stale;
  if (pack.items.length === 0) return ContextPackStatus.Incomplete;
  if (contextPackHasMissingProvenance(pack)) return ContextPackStatus.Incomplete;
  if (contextPackHasMissingRequiredCurationStage(pack)) return ContextPackStatus.Incomplete;
  return ContextPackStatus.Current;
}

export function createDefaultContextPackReadinessPolicy(): ContextPackReadinessPolicyPort {
  return {
    evaluate(request): ContextPackReadinessPolicyResult {
      return {
        status: evaluateContextPackReadiness(request.pack, request.observedAt),
        policyVersion: DEFAULT_CONTEXT_PACK_READINESS_POLICY_VERSION,
        hardStopReasons: [],
      };
    },
  };
}

export function createTenantConfigContextPackReadinessPolicy(
  input: CreateTenantConfigContextPackReadinessPolicyInput,
): ContextPackReadinessPolicyPort {
  const fallback = input.fallback ?? createDefaultContextPackReadinessPolicy();
  return {
    async evaluate(request): Promise<ContextPackReadinessPolicyResult> {
      const base = cloneContextPackReadinessPolicyResult(await fallback.evaluate(request));
      const organizationId = request.snapshot?.organizationId ?? request.pack.organizationId;
      if (!isNonEmptyString(organizationId) || request.snapshot === undefined) return base;

      let config: TenantConfig | null;
      try {
        config = await input.tenantConfigs.get(organizationId);
      } catch {
        return base;
      }

      if (config === null) return base;
      return contextPackReadinessWithTenantLayers(base, config, request);
    },
  };
}

export function contextPackHasInvalidTimestamps(pack: ContextPack, observedAt: string): boolean {
  return (
    Number.isNaN(Date.parse(pack.generatedAt)) ||
    Number.isNaN(Date.parse(pack.freshnessDeadline)) ||
    Number.isNaN(Date.parse(observedAt))
  );
}

export function contextPackIsStale(pack: ContextPack, observedAt: string): boolean {
  return (
    pack.staleInputs.length > 0 ||
    pack.items.some((item) => item.freshness === ContextPackFreshness.Stale || item.freshness === ContextPackFreshness.Archived) ||
    Date.parse(pack.freshnessDeadline) <= Date.parse(observedAt)
  );
}

export function contextPackHasMissingProvenance(pack: ContextPack): boolean {
  return pack.items.some((item) => item.sourcePointers === undefined || item.sourcePointers.length === 0);
}

export function contextPackHasMissingRequiredCurationStage(pack: ContextPack): boolean {
  const actualStages = new Set(pack.curationTrace.map((entry) => entry.stage));
  return uniqueRequiredCurationStages(pack).some((stage) => !actualStages.has(stage));
}

function uniqueRequiredCurationStages(pack: ContextPack): readonly ContextPackCurationStageKindType[] {
  return [...new Set([
    ...REQUIRED_CURRENT_CONTEXT_PACK_STAGES,
    ...(pack.curationPlan?.requiredStages ?? []),
  ])];
}

function contextPackReadinessWithTenantLayers(
  base: ContextPackReadinessPolicyResult,
  config: TenantConfig,
  request: ContextPackReadinessPolicyRequest,
): ContextPackReadinessPolicyResult {
  const uncertaintyRules: NormalizedUncertaintyHardStopRule[] = [];
  const omissionRules: NormalizedOmissionHardStopRule[] = [];
  const contradictionRules: NormalizedContradictionHardStopRule[] = [];
  const lifecycleBlockerRules: NormalizedLifecycleBlockerHardStopRule[] = [];
  const staleRules: NormalizedStaleHardStopRule[] = [];
  const appliedLayerIds: string[] = [];

  for (const layer of [...(config.layers ?? [])]
    .filter((layer) => tenantConfigLayerMatches(layer, request))
    .sort(compareTenantConfigLayers)) {
    const layerRules = tenantReadinessLayerRules(layer);
    if (layerRules === null) continue;
    if (layerRules.blocksInheritedUncertaintyHardStops) {
      uncertaintyRules.length = 0;
    }
    if (layerRules.blocksInheritedOmissionHardStops) {
      omissionRules.length = 0;
    }
    if (layerRules.blocksInheritedContradictionHardStops) {
      contradictionRules.length = 0;
    }
    if (layerRules.blocksInheritedLifecycleBlockerHardStops) {
      lifecycleBlockerRules.length = 0;
    }
    if (layerRules.blocksInheritedStaleHardStops) {
      staleRules.length = 0;
    }
    uncertaintyRules.push(...layerRules.uncertaintyHardStops.filter((rule) => ruleApplies(rule, request)));
    omissionRules.push(...layerRules.omissionHardStops.filter((rule) => ruleApplies(rule, request)));
    contradictionRules.push(...layerRules.contradictionHardStops.filter((rule) => ruleApplies(rule, request)));
    lifecycleBlockerRules.push(...layerRules.lifecycleBlockerHardStops.filter((rule) => ruleApplies(rule, request)));
    staleRules.push(...layerRules.staleHardStops.filter((rule) => ruleApplies(rule, request)));
    appliedLayerIds.push(layer.layerId);
  }

  const hardStopReasons = uniqueStrings([
    ...base.hardStopReasons,
    ...uncertaintyRules
      .filter((rule) => ruleMatchesPackUncertainty(rule, request.pack))
      .map((rule) => rule.message),
    ...omissionRules
      .filter((rule) => ruleMatchesPackOmissions(rule, request.pack))
      .map((rule) => rule.message),
    ...contradictionRules
      .filter(() => packHasContradictions(request.pack))
      .map((rule) => rule.message),
    ...lifecycleBlockerRules
      .filter((rule) => ruleMatchesLifecycleBlockers(rule, request.pack))
      .map((rule) => rule.message),
    ...staleRules
      .filter((rule) => ruleMatchesStaleness(rule, request.pack))
      .map((rule) => rule.message),
  ]);

  if (appliedLayerIds.length === 0 && hardStopReasons.length === base.hardStopReasons.length) return base;
  return {
    status: statusWithHardStops(base.status, hardStopReasons),
    policyVersion: tenantReadinessPolicyVersion(base.policyVersion, config.version, appliedLayerIds),
    hardStopReasons,
  };
}

function tenantReadinessLayerRules(layer: TenantConfigLayer): TenantContextPackReadinessLayerRules | null {
  const policy = tenantContextPackReadinessPolicy(layer.policy.contextPack?.readiness);
  if (policy === null) return null;
  const uncertaintyHardStops = uncertaintyHardStopRulesFrom(policy.uncertaintyHardStops);
  const omissionHardStops = omissionHardStopRulesFrom(policy.omissionHardStops);
  const contradictionHardStops = contradictionHardStopRulesFrom(policy.contradictionHardStops);
  const lifecycleBlockerHardStops = lifecycleBlockerHardStopRulesFrom(policy.lifecycleBlockerHardStops);
  const staleHardStops = staleHardStopRulesFrom(policy.staleHardStops);
  if (
    uncertaintyHardStops.length === 0 &&
    omissionHardStops.length === 0 &&
    contradictionHardStops.length === 0 &&
    lifecycleBlockerHardStops.length === 0 &&
    staleHardStops.length === 0 &&
    policy.blocksInheritedUncertaintyHardStops !== true &&
    policy.blocksInheritedOmissionHardStops !== true &&
    policy.blocksInheritedContradictionHardStops !== true &&
    policy.blocksInheritedLifecycleBlockerHardStops !== true &&
    policy.blocksInheritedStaleHardStops !== true
  ) {
    return null;
  }
  return {
    blocksInheritedUncertaintyHardStops: policy.blocksInheritedUncertaintyHardStops === true,
    uncertaintyHardStops,
    blocksInheritedOmissionHardStops: policy.blocksInheritedOmissionHardStops === true,
    omissionHardStops,
    blocksInheritedContradictionHardStops: policy.blocksInheritedContradictionHardStops === true,
    contradictionHardStops,
    blocksInheritedLifecycleBlockerHardStops: policy.blocksInheritedLifecycleBlockerHardStops === true,
    lifecycleBlockerHardStops,
    blocksInheritedStaleHardStops: policy.blocksInheritedStaleHardStops === true,
    staleHardStops,
  };
}

function tenantContextPackReadinessPolicy(value: unknown): TenantContextPackReadinessPolicy | null {
  return isRecord(value) ? value as TenantContextPackReadinessPolicy : null;
}

function uncertaintyHardStopRulesFrom(
  rules: readonly TenantContextPackUncertaintyHardStopRule[] | undefined,
): readonly NormalizedUncertaintyHardStopRule[] {
  if (!Array.isArray(rules)) return [];
  return rules.flatMap((rule) => {
    const normalized = uncertaintyHardStopRule(rule);
    return normalized === null ? [] : [normalized];
  });
}

function uncertaintyHardStopRule(
  rule: TenantContextPackUncertaintyHardStopRule,
): NormalizedUncertaintyHardStopRule | null {
  const ruleId = optionalString(rule.ruleId);
  const message = optionalString(rule.message);
  const severity = uncertaintySeverity(rule.severity);
  if (ruleId === undefined || message === undefined || severity === null) return null;
  return {
    ruleId,
    severity,
    kinds: uncertaintyKinds(rule.kinds),
    message,
    appliesTo: normalizedAppliesTo(rule.appliesTo),
  };
}

function omissionHardStopRulesFrom(
  rules: readonly TenantContextPackOmissionHardStopRule[] | undefined,
): readonly NormalizedOmissionHardStopRule[] {
  if (!Array.isArray(rules)) return [];
  return rules.flatMap((rule) => {
    const normalized = omissionHardStopRule(rule);
    return normalized === null ? [] : [normalized];
  });
}

function omissionHardStopRule(
  rule: TenantContextPackOmissionHardStopRule,
): NormalizedOmissionHardStopRule | null {
  const ruleId = optionalString(rule.ruleId);
  const message = optionalString(rule.message);
  if (ruleId === undefined || message === undefined) return null;
  return {
    ruleId,
    reasons: omissionReasons(rule.reasons),
    nodeIdPrefixes: nonEmptyStrings(rule.nodeIdPrefixes),
    message,
    appliesTo: normalizedAppliesTo(rule.appliesTo),
  };
}

function contradictionHardStopRulesFrom(
  rules: readonly TenantContextPackContradictionHardStopRule[] | undefined,
): readonly NormalizedContradictionHardStopRule[] {
  if (!Array.isArray(rules)) return [];
  return rules.flatMap((rule) => {
    const normalized = contradictionHardStopRule(rule);
    return normalized === null ? [] : [normalized];
  });
}

function contradictionHardStopRule(
  rule: TenantContextPackContradictionHardStopRule,
): NormalizedContradictionHardStopRule | null {
  const ruleId = optionalString(rule.ruleId);
  const message = optionalString(rule.message);
  if (ruleId === undefined || message === undefined) return null;
  return {
    ruleId,
    message,
    appliesTo: normalizedAppliesTo(rule.appliesTo),
  };
}

function lifecycleBlockerHardStopRulesFrom(
  rules: readonly TenantContextPackLifecycleBlockerHardStopRule[] | undefined,
): readonly NormalizedLifecycleBlockerHardStopRule[] {
  if (!Array.isArray(rules)) return [];
  return rules.flatMap((rule) => {
    const normalized = lifecycleBlockerHardStopRule(rule);
    return normalized === null ? [] : [normalized];
  });
}

function lifecycleBlockerHardStopRule(
  rule: TenantContextPackLifecycleBlockerHardStopRule,
): NormalizedLifecycleBlockerHardStopRule | null {
  const ruleId = optionalString(rule.ruleId);
  const message = optionalString(rule.message);
  if (ruleId === undefined || message === undefined) return null;
  return {
    ruleId,
    blockerPrefixes: nonEmptyStrings(rule.blockerPrefixes),
    message,
    appliesTo: normalizedAppliesTo(rule.appliesTo),
  };
}

function staleHardStopRulesFrom(
  rules: readonly TenantContextPackStaleHardStopRule[] | undefined,
): readonly NormalizedStaleHardStopRule[] {
  if (!Array.isArray(rules)) return [];
  return rules.flatMap((rule) => {
    const normalized = staleHardStopRule(rule);
    return normalized === null ? [] : [normalized];
  });
}

function staleHardStopRule(
  rule: TenantContextPackStaleHardStopRule,
): NormalizedStaleHardStopRule | null {
  const ruleId = optionalString(rule.ruleId);
  const message = optionalString(rule.message);
  if (ruleId === undefined || message === undefined) return null;
  return {
    ruleId,
    staleInputPrefixes: nonEmptyStrings(rule.staleInputPrefixes),
    itemIdPrefixes: nonEmptyStrings(rule.itemIdPrefixes),
    message,
    appliesTo: normalizedAppliesTo(rule.appliesTo),
  };
}

function ruleMatchesPackUncertainty(rule: NormalizedUncertaintyHardStopRule, pack: ContextPack): boolean {
  return (pack.uncertaintySignals ?? []).some((signal) =>
    signal.severity === rule.severity &&
    (rule.kinds.length === 0 || rule.kinds.includes(signal.kind))
  );
}

function ruleMatchesPackOmissions(rule: NormalizedOmissionHardStopRule, pack: ContextPack): boolean {
  return pack.omittedItemsWithReason.some((omission) =>
    (rule.reasons.length === 0 || rule.reasons.includes(omission.reason)) &&
    (
      rule.nodeIdPrefixes.length === 0 ||
      (omission.nodeId !== undefined && rule.nodeIdPrefixes.some((prefix) => omission.nodeId?.startsWith(prefix)))
    )
  );
}

function packHasContradictions(pack: ContextPack): boolean {
  return pack.contradictions.length > 0;
}

function ruleMatchesLifecycleBlockers(rule: NormalizedLifecycleBlockerHardStopRule, pack: ContextPack): boolean {
  return pack.lifecycleBlockers.some((blocker) =>
    rule.blockerPrefixes.length === 0 ||
    rule.blockerPrefixes.some((prefix) => blocker.startsWith(prefix))
  );
}

function ruleMatchesStaleness(rule: NormalizedStaleHardStopRule, pack: ContextPack): boolean {
  return staleInputsMatch(rule, pack) || staleItemsMatch(rule, pack);
}

function staleInputsMatch(rule: NormalizedStaleHardStopRule, pack: ContextPack): boolean {
  return pack.staleInputs.some((staleInput) =>
    rule.staleInputPrefixes.length === 0 ||
    rule.staleInputPrefixes.some((prefix) => staleInput.startsWith(prefix))
  );
}

function staleItemsMatch(rule: NormalizedStaleHardStopRule, pack: ContextPack): boolean {
  return pack.items.some((item) =>
    (item.freshness === ContextPackFreshness.Stale || item.freshness === ContextPackFreshness.Archived) &&
    (
      rule.itemIdPrefixes.length === 0 ||
      rule.itemIdPrefixes.some((prefix) => item.id.startsWith(prefix))
    )
  );
}

function uncertaintySeverity(value: unknown): ContextPackUncertaintySeverity | null {
  return isTenantContextPackUncertaintySeverity(value) ? value : null;
}

function uncertaintyKinds(values: readonly unknown[] | undefined): readonly ContextPackUncertaintySignalKind[] {
  if (!Array.isArray(values)) return [];
  return uniqueStrings(values.filter(isTenantContextPackUncertaintySignalKind));
}

function omissionReasons(values: readonly unknown[] | undefined): readonly ContextPackOmissionReasonType[] {
  if (!Array.isArray(values)) return [];
  return uniqueStrings(values.filter(isTenantContextPackOmissionReason));
}

function normalizedAppliesTo(appliesTo: TenantContextPackCompletenessAppliesTo | undefined): NormalizedReadinessAppliesTo {
  if (!isRecord(appliesTo)) return EMPTY_READINESS_APPLIES_TO;
  return {
    hatIds: nonEmptyStrings(appliesTo.hatIds),
    departmentIds: nonEmptyStrings(appliesTo.departmentIds),
    phases: nonEmptyStrings(appliesTo.phases),
    scopes: runScopesFrom(appliesTo.scopes),
    projectIds: nonEmptyStrings(appliesTo.projectIds),
    teamIds: nonEmptyStrings(appliesTo.teamIds),
    workItemIds: nonEmptyStrings(appliesTo.workItemIds),
  };
}

function ruleApplies(
  rule: { appliesTo: NormalizedReadinessAppliesTo },
  request: ContextPackReadinessPolicyRequest,
): boolean {
  const snapshot = request.snapshot;
  if (snapshot === undefined) return false;
  return filterMatches(rule.appliesTo.hatIds, snapshot.hat.id) &&
    filterMatches(rule.appliesTo.departmentIds, snapshot.hat.departmentId) &&
    filterMatches(rule.appliesTo.phases, snapshot.phase) &&
    filterMatches(rule.appliesTo.scopes, snapshot.scope) &&
    filterMatches(rule.appliesTo.projectIds, snapshot.projectId) &&
    filterMatches(rule.appliesTo.teamIds, snapshot.teamId) &&
    filterMatches(rule.appliesTo.workItemIds, snapshot.workItemId);
}

function tenantConfigLayerMatches(layer: TenantConfigLayer, request: ContextPackReadinessPolicyRequest): boolean {
  const snapshot = request.snapshot;
  if (snapshot === undefined) return false;
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

function statusWithHardStops(
  baseStatus: ContextPackStatus,
  hardStopReasons: readonly string[],
): ContextPackStatus {
  if (hardStopReasons.length === 0) return baseStatus;
  if (baseStatus === ContextPackStatus.Current || baseStatus === ContextPackStatus.Stale) {
    return ContextPackStatus.Incomplete;
  }
  return baseStatus;
}

function tenantReadinessPolicyVersion(
  baseVersion: string,
  configVersion: number,
  appliedLayerIds: readonly string[],
): string {
  return [
    baseVersion,
    TENANT_CONTEXT_PACK_READINESS_POLICY_VERSION_SEGMENT,
    `v${configVersion}`,
    ...appliedLayerIds,
  ].join(TENANT_CONTEXT_PACK_READINESS_LAYER_SEPARATOR);
}

function cloneContextPackReadinessPolicyResult(
  result: ContextPackReadinessPolicyResult,
): ContextPackReadinessPolicyResult {
  return {
    ...result,
    hardStopReasons: [...result.hardStopReasons],
  };
}

function runScopesFrom(values: readonly unknown[] | undefined): readonly RunScope[] {
  if (!Array.isArray(values)) return [];
  return uniqueStrings(values.filter(isRunScope));
}

function isRunScope(value: unknown): value is RunScope {
  return typeof value === "string" && Object.values(RunScope).includes(value as RunScope);
}

function filterMatches<T extends string>(values: readonly T[], actual: T | string | undefined): boolean {
  return values.length === 0 || (actual !== undefined && values.includes(actual as T));
}

function optionalString(value: unknown): string | undefined {
  return isNonEmptyString(value) ? value : undefined;
}

function nonEmptyStrings(values: readonly unknown[] | undefined): readonly string[] {
  if (!Array.isArray(values)) return [];
  return uniqueStrings(values.filter(isNonEmptyString));
}

function uniqueStrings<T extends string>(values: readonly T[]): readonly T[] {
  return [...new Set(values)];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
