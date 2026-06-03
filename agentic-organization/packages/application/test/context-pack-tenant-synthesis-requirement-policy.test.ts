import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  ConfigLayerScopeKind,
  TenantContextPackSynthesisRequirementReason as TenantSynthesisReason,
  TenantContextPackSynthesisRequirementSetId as TenantSynthesisSetId,
  defaultTenantConfig,
  type TenantConfig,
} from "../../domain/src/index.ts";
import {
  ContextPackSynthesisRequirementDecision,
  ContextPackSynthesisRequirementReason,
  RunLifecyclePhase,
  RunScope,
  asZetaIdDecimal,
  buildHatDefinitions,
  createDefaultContextPackSynthesisRequirementPolicy,
  createTenantConfigContextPackSynthesisRequirementPolicy,
  listTenantContextPackSynthesisRequirementSetDescriptors,
  previewTenantContextPackSynthesisRequirementPolicy,
  TenantContextPackSynthesisRequirementPolicyVersionSegment,
  type ContextPackSynthesisRequirementPolicyRequest,
} from "../src/index.ts";

const TenantSynthesisRequirementPreviewTestId = {
  ReleaseManagerHat: "release_manager",
  FallbackPolicyVersion: "fallback:v1",
} as const;

test("tenant synthesis requirement set descriptors expose authoring-safe phase and scope previews", () => {
  const descriptors = listTenantContextPackSynthesisRequirementSetDescriptors();
  const releaseReadiness = descriptors.find((descriptor) =>
    descriptor.setId === TenantSynthesisSetId.ReleaseReadinessCore
  );
  const runtimeOperations = descriptors.find((descriptor) =>
    descriptor.setId === TenantSynthesisSetId.RuntimeOperationsCore
  );

  ok(releaseReadiness);
  ok(runtimeOperations);
  const releaseRequirement = releaseReadiness.requirements[0];
  const runtimeRequirement = runtimeOperations.requirements[0];
  ok(releaseRequirement);
  ok(runtimeRequirement);
  ok(releaseRequirement.appliesTo);
  ok(runtimeRequirement.appliesTo);
  equal(releaseReadiness.requirements.length, 1);
  equal(releaseRequirement.reason, TenantSynthesisReason.TenantRequiresReleaseReadinessBriefing);
  equal(releaseRequirement.appliesTo.phases?.includes(RunLifecyclePhase.AwaitingReview), true);
  equal(releaseRequirement.appliesTo.scopes?.includes(RunScope.WorkItem), true);
  equal(releaseRequirement.appliesTo.scopes?.includes(RunScope.Project), true);
  equal(runtimeRequirement.reason, TenantSynthesisReason.TenantRequiresRuntimeOperationsBriefing);
  equal(runtimeRequirement.appliesTo.phases?.includes(RunLifecyclePhase.Failed), true);
  equal(runtimeRequirement.appliesTo.scopes?.includes(RunScope.Run), true);
});

test("tenant synthesis requirement authoring preview shows unsaved required model briefing", async () => {
  const releaseReadiness = listTenantContextPackSynthesisRequirementSetDescriptors().find((descriptor) =>
    descriptor.setId === TenantSynthesisSetId.ReleaseReadinessCore
  );
  ok(releaseReadiness);
  const releaseRequirement = releaseReadiness.requirements[0];
  ok(releaseRequirement);

  const preview = await previewTenantContextPackSynthesisRequirementPolicy({
    policy: {
      requirementSetIds: [TenantSynthesisSetId.ReleaseReadinessCore],
    },
    request: requirementRequest({
      hatId: TenantSynthesisRequirementPreviewTestId.ReleaseManagerHat,
      phase: RunLifecyclePhase.AwaitingReview,
      scope: RunScope.WorkItem,
    }),
    fallback: {
      evaluate: () => ({
        decision: ContextPackSynthesisRequirementDecision.Optional,
        reason: ContextPackSynthesisRequirementReason.DeterministicOnlyAllowed,
        policyVersion: TenantSynthesisRequirementPreviewTestId.FallbackPolicyVersion,
      }),
    },
  });

  equal(preview.decision, ContextPackSynthesisRequirementDecision.Required);
  equal(preview.reason, releaseRequirement.reason);
  ok(preview.policyVersion.includes(TenantContextPackSynthesisRequirementPolicyVersionSegment.AuthoringPreview));
});

test("tenant-config context-pack synthesis requirement policy can require synthesis for matching lower-risk work", async () => {
  const tenantConfig = tenantConfigWithLayers([{
    layerId: "org-require-synthesis",
    scope: { kind: ConfigLayerScopeKind.Organization, id: "org-lfg" },
    policy: {
      contextPack: {
        synthesisRequirement: {
          requirements: [{
            requirementId: "implementer_execution_model_briefing",
            reason: TenantSynthesisReason.TenantRequiresModelBriefing,
            appliesTo: {
              phases: [RunLifecyclePhase.Executing],
              scopes: [RunScope.WorkItem],
              hatIds: ["backend_implementer"],
            },
          }],
        },
      },
    },
    updatedAt: "2026-06-01T00:00:00.000Z",
    version: 1,
  }]);
  const policy = createTenantConfigContextPackSynthesisRequirementPolicy({
    tenantConfigs: tenantConfigReader(tenantConfig),
    fallback: createDefaultContextPackSynthesisRequirementPolicy(),
  });

  const result = await policy.evaluate(requirementRequest({
    hatId: "backend_implementer",
    phase: RunLifecyclePhase.Executing,
    scope: RunScope.WorkItem,
  }));

  equal(result.decision, ContextPackSynthesisRequirementDecision.Required);
  equal(result.reason, TenantSynthesisReason.TenantRequiresModelBriefing);
  ok(result.policyVersion.includes("tenant-context"));
  ok(result.policyVersion.includes("org-require-synthesis"));
});

test("tenant-config context-pack synthesis requirement policy only relaxes default synthesis when a layer explicitly blocks inheritance", async () => {
  const tenantConfig = tenantConfigWithLayers([{
    layerId: "hat-deterministic-only",
    scope: { kind: ConfigLayerScopeKind.Hat, id: "engineering_director" },
    policy: {
      contextPack: {
        synthesisRequirement: {
          blocksInheritedRequirements: true,
        },
      },
    },
    updatedAt: "2026-06-01T00:10:00.000Z",
    version: 1,
  }]);
  const policy = createTenantConfigContextPackSynthesisRequirementPolicy({
    tenantConfigs: tenantConfigReader(tenantConfig),
    fallback: createDefaultContextPackSynthesisRequirementPolicy(),
  });

  const result = await policy.evaluate(requirementRequest({
    hatId: "engineering_director",
    phase: RunLifecyclePhase.Blocked,
    scope: RunScope.Project,
  }));

  equal(result.decision, ContextPackSynthesisRequirementDecision.Optional);
  equal(result.reason, ContextPackSynthesisRequirementReason.DeterministicOnlyAllowed);
  ok(result.policyVersion.includes("hat-deterministic-only"));
});

test("tenant-config context-pack synthesis requirement policy expands matrix-backed named requirement sets", async () => {
  const tenantConfig = tenantConfigWithLayers([{
    layerId: "org-director-synthesis-sets",
    scope: { kind: ConfigLayerScopeKind.Organization, id: "org-lfg" },
    policy: {
      contextPack: {
        synthesisRequirement: {
          requirementSetIds: [
            TenantSynthesisSetId.ResourceAllocationCore,
            TenantSynthesisSetId.PriorityChangeCore,
            TenantSynthesisSetId.ReleaseReadinessCore,
            TenantSynthesisSetId.RuntimeOperationsCore,
          ],
        },
      },
    },
    updatedAt: "2026-06-01T00:05:00.000Z",
    version: 1,
  }]);
  const policy = createTenantConfigContextPackSynthesisRequirementPolicy({
    tenantConfigs: tenantConfigReader(tenantConfig),
    fallback: createDefaultContextPackSynthesisRequirementPolicy(),
  });

  const allocationResult = await policy.evaluate(requirementRequest({
    hatId: "engineering_director",
    phase: RunLifecyclePhase.Blocked,
    scope: RunScope.Project,
  }));
  const priorityResult = await policy.evaluate(requirementRequest({
    hatId: "engineering_director",
    phase: RunLifecyclePhase.AwaitingGate,
    scope: RunScope.Project,
  }));
  const releaseResult = await policy.evaluate(requirementRequest({
    hatId: "release_manager",
    phase: RunLifecyclePhase.AwaitingReview,
    scope: RunScope.WorkItem,
  }));
  const runtimeResult = await policy.evaluate(requirementRequest({
    hatId: "release_operator",
    phase: RunLifecyclePhase.Failed,
    scope: RunScope.Run,
  }));

  equal(allocationResult.decision, ContextPackSynthesisRequirementDecision.Required);
  equal(allocationResult.reason, TenantSynthesisReason.TenantRequiresResourceAllocationBriefing);
  equal(priorityResult.decision, ContextPackSynthesisRequirementDecision.Required);
  equal(priorityResult.reason, TenantSynthesisReason.TenantRequiresPriorityChangeBriefing);
  equal(releaseResult.decision, ContextPackSynthesisRequirementDecision.Required);
  equal(releaseResult.reason, TenantSynthesisReason.TenantRequiresReleaseReadinessBriefing);
  equal(runtimeResult.decision, ContextPackSynthesisRequirementDecision.Required);
  equal(runtimeResult.reason, TenantSynthesisReason.TenantRequiresRuntimeOperationsBriefing);
});

test("tenant-config context-pack synthesis requirement policy ignores unknown set ids while preserving valid set siblings", async () => {
  const tenantConfig = tenantConfigWithLayers([{
    layerId: "org-mixed-synthesis-sets",
    scope: { kind: ConfigLayerScopeKind.Organization, id: "org-lfg" },
    policy: {
      contextPack: {
        synthesisRequirement: {
          requirementSetIds: [
            "not-a-synthesis-set",
            TenantSynthesisSetId.SecurityExceptionCore,
          ],
        },
      },
    },
    updatedAt: "2026-06-01T00:06:00.000Z",
    version: 1,
  } as unknown as NonNullable<TenantConfig["layers"]>[number]]);
  const policy = createTenantConfigContextPackSynthesisRequirementPolicy({
    tenantConfigs: tenantConfigReader(tenantConfig),
    fallback: {
      evaluate: () => ({
        decision: ContextPackSynthesisRequirementDecision.Optional,
        reason: ContextPackSynthesisRequirementReason.DeterministicOnlyAllowed,
        policyVersion: "fallback:v1",
      }),
    },
  });

  const result = await policy.evaluate(requirementRequest({
    hatId: "security_director",
    phase: RunLifecyclePhase.AwaitingGate,
    scope: RunScope.WorkItem,
  }));

  equal(result.decision, ContextPackSynthesisRequirementDecision.Required);
  equal(result.reason, TenantSynthesisReason.TenantRequiresSecurityExceptionBriefing);
  ok(result.policyVersion.includes("org-mixed-synthesis-sets"));
});

test("tenant-config context-pack synthesis requirement policy ignores malformed and non-matching layers", async () => {
  const tenantConfig = tenantConfigWithLayers([{
    layerId: "bad-synthesis-policy",
    scope: { kind: ConfigLayerScopeKind.Organization, id: "org-lfg" },
    policy: {
      contextPack: {
        synthesisRequirement: {
          requirements: [{
            requirementId: "",
            reason: "not-a-reason",
            appliesTo: {
              phases: ["not-a-phase"],
              scopes: ["not-a-scope"],
            },
          }],
        },
      },
    },
    updatedAt: "2026-06-01T00:00:00.000Z",
    version: 1,
  } as unknown as NonNullable<TenantConfig["layers"]>[number]]);
  const policy = createTenantConfigContextPackSynthesisRequirementPolicy({
    tenantConfigs: tenantConfigReader(tenantConfig),
    fallback: {
      evaluate: () => ({
        decision: ContextPackSynthesisRequirementDecision.Optional,
        reason: ContextPackSynthesisRequirementReason.DeterministicOnlyAllowed,
        policyVersion: "fallback:v1",
      }),
    },
  });

  const result = await policy.evaluate(requirementRequest({
    hatId: "backend_implementer",
    phase: RunLifecyclePhase.Executing,
    scope: RunScope.WorkItem,
  }));

  equal(result.decision, ContextPackSynthesisRequirementDecision.Optional);
  equal(result.reason, ContextPackSynthesisRequirementReason.DeterministicOnlyAllowed);
  equal(result.policyVersion, "fallback:v1");
});

function tenantConfigReader(config: TenantConfig): { get: (organizationId: string) => Promise<TenantConfig | null> } {
  return {
    get: async (organizationId) => organizationId === config.organizationId ? config : null,
  };
}

function tenantConfigWithLayers(layers: NonNullable<TenantConfig["layers"]>): TenantConfig {
  return {
    ...defaultTenantConfig("org-lfg", "2026-06-01T00:00:00.000Z"),
    layers,
  };
}

function requirementRequest(input: {
  hatId: string;
  phase: RunLifecyclePhase;
  scope: RunScope;
}): ContextPackSynthesisRequirementPolicyRequest {
  const hat = buildHatDefinitions().find((candidate) => candidate.id === input.hatId);
  if (hat === undefined) throw new Error(`${input.hatId} missing`);
  return {
    request: {
      observedAt: "2026-06-01T00:00:00.000Z",
      snapshot: {
        runId: asZetaIdDecimal("42"),
        scope: input.scope,
        phase: input.phase,
        trace: { traceId: "trace-1", correlationId: "corr-1", causationId: "cause-1" },
        hasGateApproval: false,
        hasEvidence: false,
        hatAssignmentId: asZetaIdDecimal("99"),
        hat,
        agentId: "agent-context",
        organizationId: "org-lfg",
        projectId: "project-billing",
        teamId: "team-platform",
        workItemId: "work-billing",
      },
      readout: {
        runId: asZetaIdDecimal("42"),
        scope: input.scope,
        phase: input.phase,
        trace: { traceId: "trace-1", correlationId: "corr-1", causationId: "cause-1" },
        observedAt: "2026-06-01T00:00:00.000Z",
        options: [],
        vetoedOptions: [],
        deterministicRulesApplied: [],
      },
      metrics: { scope: input.scope, blocks: [] },
      promptFlows: { tasks: [], vetoedTasks: [] },
      hierarchy: {
        level: hat.level,
        projects: [],
        initiatives: [],
        metrics: [],
        policyViolations: [],
        priorityScope: "department_initiatives",
        priorityItems: [],
        scopedMetrics: [],
        actions: [],
        vetoedActions: [],
      },
    },
    curationPlan: { lanes: [], deterministicInstructions: [] },
    items: [],
    omissions: [],
  };
}
