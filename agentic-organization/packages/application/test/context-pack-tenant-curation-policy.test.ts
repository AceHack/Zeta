import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  ConfigLayerScopeKind,
  DocType,
  TenantContextPackCurationInstruction,
  TenantContextPackCurationLaneKind,
  TenantContextPackCurationProfileId,
  defaultTenantConfig,
  type TenantConfig,
  type TenantConfigLayer,
} from "../../domain/src/index.ts";
import {
  ContextPackAttentionLaneKind,
  ContextPackCurationProfileId,
  ContextPackCurationProfileInstruction,
  ContextPackDocumentFocusProfileId,
  RunLifecyclePhase,
  RunScope,
  asZetaIdDecimal,
  buildHatDefinitions,
  createDefaultContextPackCurationIntentPolicy,
  createDefaultContextPackCurationProfilePolicy,
  createTenantConfigContextPackCurationIntentPolicy,
  createTenantConfigContextPackCurationProfilePolicy,
  listContextPackAttentionLaneDescriptors,
  listContextPackCurationProfileDescriptors,
  previewTenantContextPackCurationPolicy,
  TenantContextPackCurationPolicyVersionSegment,
  type ContextPackCurationProfilePolicyPort,
  type ContextPackCurationProfileRequest,
} from "../src/index.ts";

const TenantCurationAuthoringPreviewTestPriority = {
  LegalActions: 6,
} as const;

test("context-pack curation descriptors expose authoring-safe profile and lane previews", () => {
  const profiles = listContextPackCurationProfileDescriptors();
  const lanes = listContextPackAttentionLaneDescriptors();
  const security = profiles.find((profile) => profile.profileId === ContextPackCurationProfileId.SecurityControl);
  const memoryLane = lanes.find((lane) => lane.kind === ContextPackAttentionLaneKind.Memory);

  ok(security);
  ok(memoryLane);
  equal(security.documentFocus.profileId, ContextPackDocumentFocusProfileId.SecurityControl);
  equal(security.documentFocus.preferredDocTypes.includes(DocType.Policy), true);
  deepEqual(security.deterministicInstructions, [ContextPackCurationProfileInstruction.SecurityControl]);
  equal(memoryLane.defaultPriority, 50);
  equal(memoryLane.defaultRequired, false);
  ok(memoryLane.objective.includes("advisory color"));
});

test("tenant context-pack curation authoring preview shows unsaved retrieval focus and lane changes", async () => {
  const preview = await previewTenantContextPackCurationPolicy({
    policy: {
      profileId: TenantContextPackCurationProfileId.SecurityControl,
      requiredLanes: [TenantContextPackCurationLaneKind.Memory],
      lanePriorityOverrides: {
        [TenantContextPackCurationLaneKind.LegalActions]: TenantCurationAuthoringPreviewTestPriority.LegalActions,
      },
      blocksInheritedDeterministicInstructions: true,
      deterministicInstructions: [TenantContextPackCurationInstruction.SecurityControl],
    },
    request: { request: profileRequest().request },
  });

  equal(preview.documentFocus.profileId, ContextPackDocumentFocusProfileId.SecurityControl);
  equal(preview.documentFocus.preferredDocTypes.includes(DocType.Policy), true);
  equal(preview.curationProfile.profileId, ContextPackCurationProfileId.SecurityControl);
  equal(
    preview.curationProfile.lanePriorityOverrides?.[ContextPackAttentionLaneKind.LegalActions],
    TenantCurationAuthoringPreviewTestPriority.LegalActions,
  );
  equal(preview.curationProfile.requiredLanes?.includes(ContextPackAttentionLaneKind.Memory), true);
  deepEqual(preview.curationProfile.deterministicInstructions, [
    ContextPackCurationProfileInstruction.SecurityControl,
  ]);
  ok(preview.curationProfile.policyVersion.includes(TenantContextPackCurationPolicyVersionSegment.AuthoringPreview));
});

test("tenant-config context-pack curation policy layers scoped hat overrides over the default profile", async () => {
  const tenantConfig = tenantConfigWithLayers([{
    layerId: "org-context",
    scope: { kind: ConfigLayerScopeKind.Organization, id: "org-lfg" },
    policy: {
      contextPack: {
        curation: {
          requiredLanes: [TenantContextPackCurationLaneKind.Memory],
          lanePriorityOverrides: { [TenantContextPackCurationLaneKind.Memory]: 12 },
          deterministicInstructions: [TenantContextPackCurationInstruction.KnowledgeStewardship],
        },
      },
    },
    updatedAt: "2026-06-01T00:00:00.000Z",
    version: 1,
  }, {
    layerId: "hat-context",
    scope: { kind: ConfigLayerScopeKind.Hat, id: "engineering_director" },
    policy: {
      contextPack: {
        curation: {
          profileId: TenantContextPackCurationProfileId.SecurityControl,
          blocksInheritedDeterministicInstructions: true,
          deterministicInstructions: [TenantContextPackCurationInstruction.SecurityControl],
        },
      },
    },
    updatedAt: "2026-06-01T00:10:00.000Z",
    version: 1,
  }, {
    layerId: "work-context",
    scope: { kind: ConfigLayerScopeKind.WorkItem, id: "work-billing" },
    policy: {
      contextPack: {
        curation: {
          requiredLanes: [TenantContextPackCurationLaneKind.GraphNeighborhood],
          lanePriorityOverrides: { [TenantContextPackCurationLaneKind.LegalActions]: 7 },
          deterministicInstructions: [TenantContextPackCurationInstruction.ArchitectureDecision],
        },
      },
    },
    updatedAt: "2026-06-01T00:20:00.000Z",
    version: 1,
  }]);
  const policy = createTenantConfigContextPackCurationProfilePolicy({
    tenantConfigs: tenantConfigReader(tenantConfig),
    fallback: createDefaultContextPackCurationProfilePolicy(),
  });

  const profile = await policy.resolve(profileRequest());

  equal(profile.profileId, ContextPackCurationProfileId.SecurityControl);
  ok(profile.policyVersion.includes("tenant-context"));
  ok(profile.policyVersion.includes("org-context"));
  ok(profile.policyVersion.includes("hat-context"));
  ok(profile.policyVersion.includes("work-context"));
  equal(profile.lanePriorityOverrides?.[ContextPackAttentionLaneKind.Memory], 12);
  equal(profile.lanePriorityOverrides?.[ContextPackAttentionLaneKind.LegalActions], 7);
  ok(profile.requiredLanes?.includes(ContextPackAttentionLaneKind.Memory));
  ok(profile.requiredLanes?.includes(ContextPackAttentionLaneKind.GraphNeighborhood));
  deepEqual(profile.deterministicInstructions, [
    ContextPackCurationProfileInstruction.SecurityControl,
    ContextPackCurationProfileInstruction.ArchitectureDecision,
  ]);
});

test("tenant-config context-pack curation intent aligns document focus with scoped hat overrides before retrieval", async () => {
  const tenantConfig = tenantConfigWithLayers([{
    layerId: "hat-context",
    scope: { kind: ConfigLayerScopeKind.Hat, id: "engineering_director" },
    policy: {
      contextPack: {
        curation: {
          profileId: TenantContextPackCurationProfileId.SecurityControl,
          blocksInheritedDeterministicInstructions: true,
          deterministicInstructions: [TenantContextPackCurationInstruction.SecurityControl],
        },
      },
    },
    updatedAt: "2026-06-01T00:10:00.000Z",
    version: 1,
  }]);
  const policy = createTenantConfigContextPackCurationIntentPolicy({
    tenantConfigs: tenantConfigReader(tenantConfig),
    fallback: createDefaultContextPackCurationIntentPolicy(),
  });

  const intent = await policy.resolve({ request: profileRequest().request });

  equal(intent.curationProfile.profileId, ContextPackCurationProfileId.SecurityControl);
  equal(intent.documentFocus.profileId, ContextPackDocumentFocusProfileId.SecurityControl);
  ok(intent.documentFocus.policyVersion.includes("tenant-context"));
  ok(intent.documentFocus.queryTerms.includes("least privilege"));
  ok(!intent.documentFocus.queryTerms.includes("business rules"));
  deepEqual(intent.curationProfile.deterministicInstructions, [
    ContextPackCurationProfileInstruction.SecurityControl,
  ]);
});

test("tenant-config context-pack curation policy drops malformed layer values and keeps fallback curation", async () => {
  const tenantConfig = tenantConfigWithLayers([{
    layerId: "bad-context",
    scope: { kind: ConfigLayerScopeKind.Organization, id: "org-lfg" },
    policy: {
      contextPack: {
        curation: {
          profileId: "",
          requiredLanes: ["not-a-lane", ContextPackAttentionLaneKind.Memory],
          lanePriorityOverrides: {
            [ContextPackAttentionLaneKind.Memory]: -1,
            [ContextPackAttentionLaneKind.LegalActions]: 8,
            "not-a-lane": 1,
          },
          deterministicInstructions: ["", TenantContextPackCurationInstruction.ProductValidation],
        },
      },
    },
    updatedAt: "2026-06-01T00:00:00.000Z",
    version: 1,
  } as unknown as TenantConfigLayer]);
  const fallbackProfileId = ContextPackCurationProfileId.ManagementBlocker;
  const fallback: ContextPackCurationProfilePolicyPort = {
    resolve: () => ({
      profileId: fallbackProfileId,
      policyVersion: "fallback:v1",
      deterministicInstructions: [ContextPackCurationProfileInstruction.ManagementBlocker],
    }),
  };
  const policy = createTenantConfigContextPackCurationProfilePolicy({
    tenantConfigs: tenantConfigReader(tenantConfig),
    fallback,
  });

  const profile = await policy.resolve(profileRequest());

  equal(profile.profileId, fallbackProfileId);
  equal(profile.lanePriorityOverrides?.[ContextPackAttentionLaneKind.Memory], undefined);
  equal(profile.lanePriorityOverrides?.[ContextPackAttentionLaneKind.LegalActions], 8);
  ok(profile.requiredLanes?.includes(ContextPackAttentionLaneKind.Memory));
  deepEqual(profile.deterministicInstructions, [
    ContextPackCurationProfileInstruction.ManagementBlocker,
    ContextPackCurationProfileInstruction.ProductValidation,
  ]);
});

test("tenant-config context-pack curation policy ignores unknown persisted vocabulary values", async () => {
  const tenantConfig = tenantConfigWithLayers([{
    layerId: "unknown-context-vocabulary",
    scope: { kind: ConfigLayerScopeKind.Organization, id: "org-lfg" },
    policy: {
      contextPack: {
        curation: {
          profileId: "tenant-custom-profile",
          requiredLanes: ["tenant-custom-lane", TenantContextPackCurationLaneKind.Memory],
          lanePriorityOverrides: {
            [TenantContextPackCurationLaneKind.LegalActions]: 9,
            "tenant-custom-lane": 1,
          },
          deterministicInstructions: [
            "tenant-custom-instruction",
            TenantContextPackCurationInstruction.ReleaseDelivery,
          ],
        },
      },
    },
    updatedAt: "2026-06-01T00:00:00.000Z",
    version: 1,
  } as unknown as TenantConfigLayer]);
  const fallbackProfileId = ContextPackCurationProfileId.ImplementerExecution;
  const policy = createTenantConfigContextPackCurationProfilePolicy({
    tenantConfigs: tenantConfigReader(tenantConfig),
    fallback: {
      resolve: () => ({
        profileId: fallbackProfileId,
        policyVersion: "fallback:v1",
      }),
    },
  });

  const profile = await policy.resolve(profileRequest());

  equal(profile.profileId, fallbackProfileId);
  equal(profile.lanePriorityOverrides?.[ContextPackAttentionLaneKind.LegalActions], 9);
  ok(profile.requiredLanes?.includes(ContextPackAttentionLaneKind.Memory));
  deepEqual(profile.deterministicInstructions, [
    ContextPackCurationProfileInstruction.ReleaseDelivery,
  ]);
});

test("tenant-config context-pack curation policy falls back without organization scope", async () => {
  let tenantLookups = 0;
  const fallbackProfileId = ContextPackCurationProfileId.ImplementerExecution;
  const policy = createTenantConfigContextPackCurationProfilePolicy({
    tenantConfigs: {
      get: async () => {
        tenantLookups += 1;
        return null;
      },
    },
    fallback: {
      resolve: () => ({
        profileId: fallbackProfileId,
        policyVersion: "fallback:v1",
      }),
    },
  });

  const profile = await policy.resolve(profileRequest({ organizationId: undefined }));

  equal(tenantLookups, 0);
  equal(profile.profileId, fallbackProfileId);
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

function profileRequest(overrides: { organizationId?: string | undefined } = {}): ContextPackCurationProfileRequest {
  const hat = buildHatDefinitions().find((candidate) => candidate.id === "engineering_director");
  if (hat === undefined) throw new Error("engineering_director missing");
  return {
    request: {
      observedAt: "2026-06-01T00:00:00.000Z",
      snapshot: {
        runId: asZetaIdDecimal("42"),
        scope: RunScope.WorkItem,
        phase: RunLifecyclePhase.Blocked,
        trace: { traceId: "trace-1", correlationId: "corr-1", causationId: "cause-1" },
        hasGateApproval: false,
        hasEvidence: false,
        hatAssignmentId: asZetaIdDecimal("99"),
        hat,
        agentId: "agent-director",
        ...("organizationId" in overrides ? optionalOrganizationId(overrides.organizationId) : { organizationId: "org-lfg" }),
        projectId: "project-billing",
        teamId: "team-platform",
        workItemId: "work-billing",
      },
      readout: {
        runId: asZetaIdDecimal("42"),
        scope: RunScope.WorkItem,
        phase: RunLifecyclePhase.Blocked,
        trace: { traceId: "trace-1", correlationId: "corr-1", causationId: "cause-1" },
        observedAt: "2026-06-01T00:00:00.000Z",
        options: [],
        vetoedOptions: [],
        deterministicRulesApplied: [],
      },
      metrics: { scope: RunScope.WorkItem, blocks: [] },
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
    items: [],
    omissions: [],
  };
}

function optionalOrganizationId(organizationId: string | undefined): { organizationId?: string | undefined } {
  return organizationId === undefined ? {} : { organizationId };
}
