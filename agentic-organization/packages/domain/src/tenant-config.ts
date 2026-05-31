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
