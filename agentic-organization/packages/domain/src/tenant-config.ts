/**
 * Tenant configuration (C0) — the org as a generic configurable runtime. Everything that was
 * hardcoded becomes per-tenant DATA: which review stages require a human (the autonomy dial),
 * which workflow pipeline a work type uses, which handbooks bind to which stages, and which
 * skills are enabled. One tenant flips a stage from agent-decided to human-gated by editing
 * config — no code change. Stored as one config row per org (JSONB), versioned.
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

export type TenantConfig = {
  organizationId: string;
  autonomy: AutonomyPolicy;
  workflow: WorkflowConfig;
  handbookBindings: readonly HandbookBinding[];
  enabledSkills: readonly string[];
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
