import {
  ConfigLayerScopeKind,
  isTenantContextPackCurationInstruction,
  isTenantContextPackCurationLaneKind,
  isTenantContextPackCurationProfileId,
  type TenantConfig,
  type TenantConfigLayer,
  type TenantContextPackCurationPolicy,
} from "../../domain/src/index.ts";
import {
  DEFAULT_CONTEXT_PACK_CURATION_PROFILE_POLICY_VERSION,
  createDefaultContextPackCurationIntentPolicy,
  createDefaultContextPackCurationProfilePolicy,
  contextPackDocumentFocusForCurationProfile,
  type ContextPackCurationIntent,
  type ContextPackCurationIntentPolicyPort,
  type ContextPackCurationIntentRequest,
  type ContextPackCurationProfile,
  type ContextPackCurationProfilePolicyPort,
  type ContextPackCurationProfileRequest,
} from "./context-pack-builder.ts";
import {
  type ContextPackAttentionLaneKind as ContextPackAttentionLaneKindType,
} from "./context-pack-contracts.ts";

export type TenantConfigContextPackCurationProfileConfigReader = {
  get: (organizationId: string) => Promise<TenantConfig | null> | TenantConfig | null;
};

export type CreateTenantConfigContextPackCurationProfilePolicyInput = {
  tenantConfigs: TenantConfigContextPackCurationProfileConfigReader;
  fallback?: ContextPackCurationProfilePolicyPort | undefined;
};

export type CreateTenantConfigContextPackCurationIntentPolicyInput = {
  tenantConfigs: TenantConfigContextPackCurationProfileConfigReader;
  fallback?: ContextPackCurationIntentPolicyPort | undefined;
};

export const TenantContextPackCurationPolicyVersionSegment = {
  TenantContext: "tenant-context",
  AuthoringPreview: "tenant-context-preview",
} as const;

export type TenantContextPackCurationPolicyVersionSegment =
  (typeof TenantContextPackCurationPolicyVersionSegment)[keyof typeof TenantContextPackCurationPolicyVersionSegment];

export type PreviewTenantContextPackCurationPolicyInput = {
  policy: TenantContextPackCurationPolicy;
  request: ContextPackCurationIntentRequest;
  fallback?: ContextPackCurationIntentPolicyPort | undefined;
};

const TENANT_CONTEXT_PACK_CURATION_LAYER_SEPARATOR = "+";

const TenantContextPackLayerSpecificity = {
  [ConfigLayerScopeKind.Organization]: 0,
  [ConfigLayerScopeKind.Department]: 1,
  [ConfigLayerScopeKind.Hat]: 2,
  [ConfigLayerScopeKind.WorkItem]: 3,
} as const;

export function createTenantConfigContextPackCurationProfilePolicy(
  input: CreateTenantConfigContextPackCurationProfilePolicyInput,
): ContextPackCurationProfilePolicyPort {
  const fallback = input.fallback ?? createDefaultContextPackCurationProfilePolicy();
  return {
    async resolve(request): Promise<ContextPackCurationProfile> {
      const base = await fallback.resolve(request);
      const organizationId = request.request.snapshot.organizationId;
      if (!isNonEmptyString(organizationId)) return cloneContextPackCurationProfile(base);

      const config = await input.tenantConfigs.get(organizationId);
      if (config === null) return cloneContextPackCurationProfile(base);

      return profileWithTenantCurationLayers(base, config, request);
    },
  };
}

export function createTenantConfigContextPackCurationIntentPolicy(
  input: CreateTenantConfigContextPackCurationIntentPolicyInput,
): ContextPackCurationIntentPolicyPort {
  const fallback = input.fallback ?? createDefaultContextPackCurationIntentPolicy();
  return {
    async resolve(request): Promise<ContextPackCurationIntent> {
      const base = await fallback.resolve(request);
      const organizationId = request.request.snapshot.organizationId;
      if (!isNonEmptyString(organizationId)) return cloneContextPackCurationIntent(base);

      const config = await input.tenantConfigs.get(organizationId);
      if (config === null) return cloneContextPackCurationIntent(base);

      const curationProfile = profileWithTenantCurationLayers(
        base.curationProfile,
        config,
        curationProfileRequestFromIntentRequest(request),
      );
      return {
        documentFocus: contextPackDocumentFocusForCurationProfile(curationProfile, base.documentFocus),
        curationProfile,
      };
    },
  };
}

export async function previewTenantContextPackCurationPolicy(
  input: PreviewTenantContextPackCurationPolicyInput,
): Promise<ContextPackCurationIntent> {
  const fallback = input.fallback ?? createDefaultContextPackCurationIntentPolicy();
  const base = await fallback.resolve(input.request);
  const curationProfile = applyTenantContextPackCuration(base.curationProfile, input.policy);
  if (curationProfile === base.curationProfile) return cloneContextPackCurationIntent(base);

  const previewProfile = {
    ...curationProfile,
    policyVersion: tenantContextPackCurationPreviewPolicyVersion(base.curationProfile.policyVersion),
  };
  return {
    documentFocus: contextPackDocumentFocusForCurationProfile(previewProfile, base.documentFocus),
    curationProfile: previewProfile,
  };
}

function curationProfileRequestFromIntentRequest(
  request: ContextPackCurationIntentRequest,
): ContextPackCurationProfileRequest {
  return {
    request: request.request,
    items: [],
    omissions: [],
  };
}

function profileWithTenantCurationLayers(
  base: ContextPackCurationProfile,
  config: TenantConfig,
  request: ContextPackCurationProfileRequest,
): ContextPackCurationProfile {
  const matchingLayers = [...(config.layers ?? [])]
    .filter((layer) => tenantConfigLayerMatches(layer, request))
    .sort(compareTenantConfigLayers);
  let profile = cloneContextPackCurationProfile(base);
  const appliedLayerIds: string[] = [];

  for (const layer of matchingLayers) {
    const curation = tenantContextPackCurationPolicy(layer.policy.contextPack?.curation);
    if (curation === null) continue;
    const updated = applyTenantContextPackCuration(profile, curation);
    if (updated === profile) continue;
    profile = updated;
    appliedLayerIds.push(layer.layerId);
  }

  if (appliedLayerIds.length === 0) return profile;
  return {
    ...profile,
    policyVersion: tenantContextPackCurationPolicyVersion(base.policyVersion, config.version, appliedLayerIds),
  };
}

function applyTenantContextPackCuration(
  base: ContextPackCurationProfile,
  curation: TenantContextPackCurationPolicy,
): ContextPackCurationProfile {
  const profileId = contextPackCurationProfileId(curation.profileId);
  const lanePriorityOverrides = lanePriorityOverridesFrom(curation.lanePriorityOverrides);
  const requiredLanes = laneKindsFrom(curation.requiredLanes);
  const deterministicInstructions = deterministicInstructionsFrom(curation.deterministicInstructions);
  if (
    profileId === undefined &&
    Object.keys(lanePriorityOverrides).length === 0 &&
    requiredLanes.length === 0 &&
    deterministicInstructions.length === 0 &&
    curation.blocksInheritedDeterministicInstructions !== true
  ) {
    return base;
  }

  return {
    ...base,
    ...(profileId === undefined ? {} : { profileId }),
    lanePriorityOverrides: {
      ...(base.lanePriorityOverrides ?? {}),
      ...lanePriorityOverrides,
    },
    requiredLanes: uniqueLaneKinds([
      ...(base.requiredLanes ?? []),
      ...requiredLanes,
    ]),
    deterministicInstructions: deterministicInstructionsFor(base, curation, deterministicInstructions),
  };
}

function tenantContextPackCurationPolicy(value: unknown): TenantContextPackCurationPolicy | null {
  return isRecord(value) ? value as TenantContextPackCurationPolicy : null;
}

function deterministicInstructionsFor(
  base: ContextPackCurationProfile,
  curation: TenantContextPackCurationPolicy,
  layerInstructions: readonly string[],
): readonly string[] {
  const inherited = curation.blocksInheritedDeterministicInstructions === true
    ? []
    : [...(base.deterministicInstructions ?? [])];
  return uniqueStrings([...inherited, ...layerInstructions]);
}

function tenantContextPackCurationPolicyVersion(
  basePolicyVersion: string,
  configVersion: number,
  appliedLayerIds: readonly string[],
): string {
  return [
    basePolicyVersion || DEFAULT_CONTEXT_PACK_CURATION_PROFILE_POLICY_VERSION,
    TenantContextPackCurationPolicyVersionSegment.TenantContext,
    String(configVersion),
    ...appliedLayerIds,
  ].join(TENANT_CONTEXT_PACK_CURATION_LAYER_SEPARATOR);
}

function tenantContextPackCurationPreviewPolicyVersion(basePolicyVersion: string): string {
  return [
    basePolicyVersion || DEFAULT_CONTEXT_PACK_CURATION_PROFILE_POLICY_VERSION,
    TenantContextPackCurationPolicyVersionSegment.AuthoringPreview,
  ].join(TENANT_CONTEXT_PACK_CURATION_LAYER_SEPARATOR);
}

function tenantConfigLayerMatches(
  layer: TenantConfigLayer,
  request: ContextPackCurationProfileRequest,
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

function lanePriorityOverridesFrom(
  input: Readonly<Record<string, number>> | undefined,
): Partial<Record<ContextPackAttentionLaneKindType, number>> {
  if (!isRecord(input)) return {};
  const overrides: Partial<Record<ContextPackAttentionLaneKindType, number>> = {};
  for (const [kind, priority] of Object.entries(input)) {
    if (!isTenantContextPackCurationLaneKind(kind) || !Number.isFinite(priority) || priority < 0) continue;
    overrides[kind as ContextPackAttentionLaneKindType] = priority;
  }
  return overrides;
}

function laneKindsFrom(input: readonly string[] | undefined): readonly ContextPackAttentionLaneKindType[] {
  if (!Array.isArray(input)) return [];
  return uniqueLaneKinds(input.flatMap((kind) => {
    return isTenantContextPackCurationLaneKind(kind) ? [kind as ContextPackAttentionLaneKindType] : [];
  }));
}

function contextPackCurationProfileId(value: unknown): string | undefined {
  return isTenantContextPackCurationProfileId(value) ? value : undefined;
}

function deterministicInstructionsFrom(input: readonly string[] | undefined): readonly string[] {
  if (!Array.isArray(input)) return [];
  return uniqueStrings(input.flatMap((value) => {
    return isTenantContextPackCurationInstruction(value) ? [value] : [];
  }));
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
    documentFocus: {
      ...intent.documentFocus,
      queryTerms: [...intent.documentFocus.queryTerms],
      preferredDocTypes: [...intent.documentFocus.preferredDocTypes],
    },
    curationProfile: cloneContextPackCurationProfile(intent.curationProfile),
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uniqueLaneKinds(
  values: readonly ContextPackAttentionLaneKindType[],
): readonly ContextPackAttentionLaneKindType[] {
  return [...new Set(values)];
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}
