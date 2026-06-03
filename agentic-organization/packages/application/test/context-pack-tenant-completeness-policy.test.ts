import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  ConfigLayerScopeKind,
  DocScopeKind,
  GraphNodeKind,
  TenantContextPackCompletenessRequirementId,
  TenantContextPackCompletenessRequirementSetId,
  TenantContextPackCompletenessSourceScope,
  defaultTenantConfig,
  graphNodeId,
  type TenantConfig,
  type TenantConfigLayer,
} from "../../domain/src/index.ts";
import {
  ContextPackFreshness,
  ContextPackItemKind,
  ContextPackOmissionReason,
  ContextPackSourcePointerKind,
  RunLifecyclePhase,
  RunScope,
  asZetaIdDecimal,
  buildHatDefinitions,
  createTenantConfigContextPackCompletenessPolicy,
  listTenantContextPackCompletenessRequirementSetDescriptors,
  previewTenantContextPackCompletenessPolicy,
  type ContextPackCompletenessPolicyPort,
  type ContextPackCompletenessPolicyRequest,
  type ContextPackItem,
} from "../src/index.ts";

test("tenant-config context-pack completeness policy requires scoped evidence for matching hats", async () => {
  const tenantConfig = tenantConfigWithLayers([{
    layerId: "hat-runtime-evidence",
    scope: { kind: ConfigLayerScopeKind.Hat, id: "engineering_director" },
    policy: {
      contextPack: {
        completeness: {
          requirements: [{
            requirementId: "runtime_validation_evidence",
            itemKind: ContextPackItemKind.Evidence,
            message: "runtime validation evidence is required before director unblock",
            evidenceRef: "context_policy:tenant_runtime_validation:v1",
            requiredSourceScope: TenantContextPackCompletenessSourceScope.ActiveScope,
            appliesTo: {
              phases: [RunLifecyclePhase.Blocked],
              scopes: [RunScope.WorkItem],
              hatIds: ["engineering_director"],
            },
          }],
        },
      },
    },
    updatedAt: "2026-06-01T00:00:00.000Z",
    version: 1,
  }]);
  const policy = createTenantConfigContextPackCompletenessPolicy({
    tenantConfigs: tenantConfigReader(tenantConfig),
    fallback: emptyCompletenessPolicy(),
  });

  const missing = await policy.evaluate(completenessRequest({ items: [] }));
  const satisfied = await policy.evaluate(completenessRequest({ items: [runtimeEvidenceItem()] }));

  equal(missing.omittedItemsWithReason[0]?.nodeId, "context_requirement:runtime_validation_evidence");
  equal(missing.omittedItemsWithReason[0]?.reason, ContextPackOmissionReason.NotIndexed);
  equal(missing.lifecycleBlockers?.[0], "runtime validation evidence is required before director unblock");
  deepEqual(missing.evidenceRefs, ["context_policy:tenant_runtime_validation:v1"]);
  deepEqual(satisfied.omittedItemsWithReason, []);
  deepEqual(satisfied.lifecycleBlockers, []);
  deepEqual(satisfied.evidenceRefs, ["context_policy:tenant_runtime_validation:v1"]);
});

test("tenant-config context-pack completeness policy rejects wrong-scope evidence when active scope is required", async () => {
  const tenantConfig = tenantConfigWithLayers([{
    layerId: "work-runtime-evidence",
    scope: { kind: ConfigLayerScopeKind.WorkItem, id: "work-billing" },
    policy: {
      contextPack: {
        completeness: {
          requirements: [{
            requirementId: "active_runtime_evidence",
            itemKind: ContextPackItemKind.Evidence,
            message: "active work runtime evidence is required",
            evidenceRef: "context_policy:tenant_active_runtime:v1",
            requiredSourceScope: TenantContextPackCompletenessSourceScope.ActiveScope,
          }],
        },
      },
    },
    updatedAt: "2026-06-01T00:00:00.000Z",
    version: 1,
  }]);
  const policy = createTenantConfigContextPackCompletenessPolicy({
    tenantConfigs: tenantConfigReader(tenantConfig),
    fallback: emptyCompletenessPolicy(),
  });

  const result = await policy.evaluate(completenessRequest({
    items: [runtimeEvidenceItem({ projectId: "project-unrelated" })],
  }));

  ok(result.omittedItemsWithReason.some((item) =>
    item.nodeId === "context_requirement:active_runtime_evidence" &&
    item.reason === ContextPackOmissionReason.NotIndexed
  ));
});

test("tenant-config context-pack completeness policy drops malformed requirements and preserves fallback result", async () => {
  const tenantConfig = tenantConfigWithLayers([{
    layerId: "bad-completeness",
    scope: { kind: ConfigLayerScopeKind.Organization, id: "org-lfg" },
    policy: {
      contextPack: {
        completeness: {
          requirements: [{
            requirementId: "",
            itemKind: "not-a-kind",
            message: "",
            evidenceRef: "",
            requiredSourceScope: "not-a-scope",
          }, {
            requirementId: "security_policy",
            itemKind: ContextPackItemKind.Policy,
            message: "security policy is required",
            evidenceRef: "context_policy:tenant_security:v1",
            appliesTo: {
              phases: ["not-a-phase", RunLifecyclePhase.Blocked],
              scopes: ["not-a-scope", RunScope.WorkItem],
            },
          }],
        },
      },
    },
    updatedAt: "2026-06-01T00:00:00.000Z",
    version: 1,
  } as unknown as TenantConfigLayer]);
  const policy = createTenantConfigContextPackCompletenessPolicy({
    tenantConfigs: tenantConfigReader(tenantConfig),
    fallback: {
      evaluate: () => ({
        omittedItemsWithReason: [{
          nodeId: "context_requirement:fallback",
          reason: ContextPackOmissionReason.NotIndexed,
          message: "fallback requirement",
        }],
        lifecycleBlockers: ["fallback blocker"],
        evidenceRefs: ["context_policy:fallback:v1"],
      }),
    },
  });

  const result = await policy.evaluate(completenessRequest({ items: [] }));

  ok(result.omittedItemsWithReason.some((item) => item.nodeId === "context_requirement:fallback"));
  ok(result.omittedItemsWithReason.some((item) => item.nodeId === "context_requirement:security_policy"));
  ok(!result.omittedItemsWithReason.some((item) => item.nodeId === "context_requirement:"));
  ok(result.lifecycleBlockers?.includes("fallback blocker"));
  ok(result.lifecycleBlockers?.includes("security policy is required"));
  ok(result.evidenceRefs?.includes("context_policy:fallback:v1"));
  ok(result.evidenceRefs?.includes("context_policy:tenant_security:v1"));
});

test("tenant-config context-pack completeness policy expands reusable requirement sets", async () => {
  const tenantConfig = tenantConfigWithLayers([{
    layerId: "release-readiness-set",
    scope: { kind: ConfigLayerScopeKind.Organization, id: "org-lfg" },
    policy: {
      contextPack: {
        completeness: {
          requirementSetIds: [TenantContextPackCompletenessRequirementSetId.ReleaseReadinessCore],
        },
      },
    },
    updatedAt: "2026-06-01T00:00:00.000Z",
    version: 1,
  }]);
  const policy = createTenantConfigContextPackCompletenessPolicy({
    tenantConfigs: tenantConfigReader(tenantConfig),
    fallback: emptyCompletenessPolicy(),
  });

  const missing = await policy.evaluate(completenessRequest({ items: [] }));
  const satisfied = await policy.evaluate(completenessRequest({ items: [
    runtimeEvidenceItem(),
    readinessMeetingItem(),
  ] }));

  ok(missing.omittedItemsWithReason.some((item) =>
    item.nodeId === contextRequirementNodeId(TenantContextPackCompletenessRequirementId.ReleaseDeploymentEvidence)
  ));
  ok(missing.omittedItemsWithReason.some((item) =>
    item.nodeId === contextRequirementNodeId(TenantContextPackCompletenessRequirementId.ReleaseReadinessMeeting)
  ));
  deepEqual(satisfied.omittedItemsWithReason, []);
});

test("tenant completeness requirement set descriptors expose authoring-safe evidence and scope previews", () => {
  const descriptors = listTenantContextPackCompletenessRequirementSetDescriptors();
  const releaseReadiness = descriptors.find((descriptor) =>
    descriptor.setId === TenantContextPackCompletenessRequirementSetId.ReleaseReadinessCore
  );
  const runtimeOperations = descriptors.find((descriptor) =>
    descriptor.setId === TenantContextPackCompletenessRequirementSetId.RuntimeOperationsCore
  );

  ok(releaseReadiness);
  ok(runtimeOperations);
  const deploymentEvidence = releaseReadiness.requirements.find((requirement) =>
    requirement.requirementId === TenantContextPackCompletenessRequirementId.ReleaseDeploymentEvidence
  );
  const incidentEvidence = runtimeOperations.requirements.find((requirement) =>
    requirement.requirementId === TenantContextPackCompletenessRequirementId.RuntimeIncidentEvidence
  );
  ok(deploymentEvidence);
  ok(incidentEvidence);
  equal(deploymentEvidence.itemKind, ContextPackItemKind.Evidence);
  equal(deploymentEvidence.requiredSourceScope, TenantContextPackCompletenessSourceScope.ActiveScope);
  equal(deploymentEvidence.evidenceRef, "context_policy:tenant_release_readiness_core:v1");
  ok(deploymentEvidence.message.includes("deployment evidence"));
  equal(incidentEvidence.itemKind, ContextPackItemKind.Evidence);
  equal(incidentEvidence.requiredSourceScope, TenantContextPackCompletenessSourceScope.ActiveScope);
  ok(incidentEvidence.message.includes("runtime incident"));
});

test("tenant completeness authoring preview shows unsaved hard blockers before persistence", async () => {
  const securityExceptionDescriptor = listTenantContextPackCompletenessRequirementSetDescriptors().find((descriptor) =>
    descriptor.setId === TenantContextPackCompletenessRequirementSetId.SecurityExceptionCore
  );
  ok(securityExceptionDescriptor);
  const securityPolicyRequirement = securityExceptionDescriptor.requirements.find((requirement) =>
    requirement.requirementId === TenantContextPackCompletenessRequirementId.SecurityExceptionPolicy
  );
  ok(securityPolicyRequirement);
  const preview = await previewTenantContextPackCompletenessPolicy({
    policy: {
      requirementSetIds: [TenantContextPackCompletenessRequirementSetId.SecurityExceptionCore],
      hardBlockMissingRequiredContext: true,
    },
    request: completenessRequest({ items: [] }),
    fallback: emptyCompletenessPolicy(),
  });

  ok(preview.omittedItemsWithReason.some((item) =>
    item.nodeId === contextRequirementNodeId(TenantContextPackCompletenessRequirementId.SecurityExceptionPolicy)
  ));
  ok(preview.lifecycleBlockers?.includes(securityPolicyRequirement.message));
  ok(preview.evidenceRefs?.includes(securityPolicyRequirement.evidenceRef));
});

test("tenant-config context-pack completeness policy expands matrix-backed director requirement sets", async () => {
  const cases = [{
    setId: TenantContextPackCompletenessRequirementSetId.ManagementBlockerCore,
    expectedRequirementIds: [
      TenantContextPackCompletenessRequirementId.ManagementBlockerBusiness,
      TenantContextPackCompletenessRequirementId.ManagementBlockerArchitecture,
      TenantContextPackCompletenessRequirementId.ManagementBlockerPolicy,
      TenantContextPackCompletenessRequirementId.ManagementBlockerGraph,
    ],
  }, {
    setId: TenantContextPackCompletenessRequirementSetId.ArchitectureTradeoffCore,
    expectedRequirementIds: [
      TenantContextPackCompletenessRequirementId.ArchitectureTradeoffDecision,
      TenantContextPackCompletenessRequirementId.ArchitectureTradeoffArchitecture,
      TenantContextPackCompletenessRequirementId.ArchitectureTradeoffBusiness,
      TenantContextPackCompletenessRequirementId.ArchitectureTradeoffGraph,
    ],
  }, {
    setId: TenantContextPackCompletenessRequirementSetId.SecurityExceptionCore,
    expectedRequirementIds: [
      TenantContextPackCompletenessRequirementId.SecurityExceptionPolicy,
      TenantContextPackCompletenessRequirementId.SecurityExceptionCredentialEvidence,
      TenantContextPackCompletenessRequirementId.SecurityExceptionRiskDecision,
    ],
  }, {
    setId: TenantContextPackCompletenessRequirementSetId.CustomerBusinessScopeCore,
    expectedRequirementIds: [
      TenantContextPackCompletenessRequirementId.CustomerBusinessScopeRequirements,
      TenantContextPackCompletenessRequirementId.CustomerBusinessScopeCustomerInput,
      TenantContextPackCompletenessRequirementId.CustomerBusinessScopeValidation,
      TenantContextPackCompletenessRequirementId.CustomerBusinessScopeProductDecision,
    ],
  }] as const;

  for (const testCase of cases) {
    const tenantConfig = tenantConfigWithLayers([{
      layerId: `matrix-set-${testCase.setId}`,
      scope: { kind: ConfigLayerScopeKind.Organization, id: "org-lfg" },
      policy: {
        contextPack: {
          completeness: {
            requirementSetIds: [testCase.setId],
          },
        },
      },
      updatedAt: "2026-06-01T00:00:00.000Z",
      version: 1,
    }]);
    const policy = createTenantConfigContextPackCompletenessPolicy({
      tenantConfigs: tenantConfigReader(tenantConfig),
      fallback: emptyCompletenessPolicy(),
    });

    const result = await policy.evaluate(completenessRequest({ items: [] }));

    for (const requirementId of testCase.expectedRequirementIds) {
      ok(
        result.omittedItemsWithReason.some((item) => item.nodeId === contextRequirementNodeId(requirementId)),
        `${testCase.setId} should emit ${requirementId}`,
      );
    }
  }
});

test("tenant-config context-pack completeness policy expands management operating requirement sets", async () => {
  const cases = [{
    setId: TenantContextPackCompletenessRequirementSetId.ResourceAllocationCore,
    expectedRequirementIds: [
      TenantContextPackCompletenessRequirementId.ResourceAllocationPolicy,
      TenantContextPackCompletenessRequirementId.ResourceAllocationCapacityEvidence,
      TenantContextPackCompletenessRequirementId.ResourceAllocationDecision,
    ],
  }, {
    setId: TenantContextPackCompletenessRequirementSetId.PriorityChangeCore,
    expectedRequirementIds: [
      TenantContextPackCompletenessRequirementId.PriorityChangeBusinessContext,
      TenantContextPackCompletenessRequirementId.PriorityChangeImpactEvidence,
      TenantContextPackCompletenessRequirementId.PriorityChangeDecision,
      TenantContextPackCompletenessRequirementId.PriorityChangeGraph,
    ],
  }, {
    setId: TenantContextPackCompletenessRequirementSetId.BudgetCapacityCore,
    expectedRequirementIds: [
      TenantContextPackCompletenessRequirementId.BudgetCapacityPolicy,
      TenantContextPackCompletenessRequirementId.BudgetCapacityTelemetryEvidence,
      TenantContextPackCompletenessRequirementId.BudgetCapacityDecision,
    ],
  }, {
    setId: TenantContextPackCompletenessRequirementSetId.TenantApprovalCore,
    expectedRequirementIds: [
      TenantContextPackCompletenessRequirementId.TenantApprovalPolicy,
      TenantContextPackCompletenessRequirementId.TenantApprovalDecision,
      TenantContextPackCompletenessRequirementId.TenantApprovalEvidence,
    ],
  }] as const;

  for (const testCase of cases) {
    const tenantConfig = tenantConfigWithLayers([{
      layerId: `management-operating-set-${testCase.setId}`,
      scope: { kind: ConfigLayerScopeKind.Organization, id: "org-lfg" },
      policy: {
        contextPack: {
          completeness: {
            requirementSetIds: [testCase.setId],
          },
        },
      },
      updatedAt: "2026-06-01T00:00:00.000Z",
      version: 1,
    }]);
    const policy = createTenantConfigContextPackCompletenessPolicy({
      tenantConfigs: tenantConfigReader(tenantConfig),
      fallback: emptyCompletenessPolicy(),
    });

    const result = await policy.evaluate(completenessRequest({ items: [] }));

    for (const requirementId of testCase.expectedRequirementIds) {
      ok(
        result.omittedItemsWithReason.some((item) => item.nodeId === contextRequirementNodeId(requirementId)),
        `${testCase.setId} should emit ${requirementId}`,
      );
    }
  }
});

test("tenant-config context-pack completeness policy uses observe active-scope provenance for non-document anchors", async () => {
  const tenantConfig = tenantConfigWithLayers([{
    layerId: "resource-signal",
    scope: { kind: ConfigLayerScopeKind.Hat, id: "engineering_director" },
    policy: {
      contextPack: {
        completeness: {
          requirements: [{
            requirementId: "active_resource_signal",
            itemKind: ContextPackItemKind.SupervisorSignal,
            message: "active resource signal is required",
            evidenceRef: "context_policy:tenant_active_resource_signal:v1",
            requiredSourceScope: TenantContextPackCompletenessSourceScope.ActiveScope,
          }, {
            requirementId: "active_priority_graph",
            itemKind: ContextPackItemKind.GraphNeighborhood,
            message: "active priority graph is required",
            evidenceRef: "context_policy:tenant_active_priority_graph:v1",
            requiredSourceScope: TenantContextPackCompletenessSourceScope.ActiveScope,
          }],
        },
      },
    },
    updatedAt: "2026-06-01T00:00:00.000Z",
    version: 1,
  }]);
  const policy = createTenantConfigContextPackCompletenessPolicy({
    tenantConfigs: tenantConfigReader(tenantConfig),
    fallback: emptyCompletenessPolicy(),
  });

  const missing = await policy.evaluate(completenessRequest({
    items: [
      supervisorSignalItem({ targetHatAssignmentId: "101" }),
      activeGraphItem({ nodeId: graphNodeId("org-lfg", GraphNodeKind.WorkItem, "work-other") }),
    ],
  }));
  const satisfied = await policy.evaluate(completenessRequest({
    items: [
      supervisorSignalItem(),
      activeGraphItem({ nodeId: graphNodeId("org-lfg", GraphNodeKind.WorkItem, "work-billing") }),
    ],
  }));

  ok(missing.omittedItemsWithReason.some((item) => item.nodeId === contextRequirementNodeId("active_resource_signal")));
  ok(missing.omittedItemsWithReason.some((item) => item.nodeId === contextRequirementNodeId("active_priority_graph")));
  deepEqual(satisfied.omittedItemsWithReason, []);
  deepEqual(satisfied.lifecycleBlockers, []);
});

test("tenant-config context-pack completeness policy satisfies tenant approval requirements with active evidence", async () => {
  const tenantConfig = tenantConfigWithLayers([{
    layerId: "tenant-approval-set",
    scope: { kind: ConfigLayerScopeKind.Organization, id: "org-lfg" },
    policy: {
      contextPack: {
        completeness: {
          requirementSetIds: [TenantContextPackCompletenessRequirementSetId.TenantApprovalCore],
        },
      },
    },
    updatedAt: "2026-06-01T00:00:00.000Z",
    version: 1,
  }]);
  const policy = createTenantConfigContextPackCompletenessPolicy({
    tenantConfigs: tenantConfigReader(tenantConfig),
    fallback: emptyCompletenessPolicy(),
  });

  const missing = await policy.evaluate(completenessRequest({ items: [] }));
  const satisfied = await policy.evaluate(completenessRequest({ items: [
    activePolicyItem(),
    runtimeEvidenceItem(),
    activeDecisionItem(),
  ] }));

  ok(missing.omittedItemsWithReason.some((item) =>
    item.nodeId === contextRequirementNodeId(TenantContextPackCompletenessRequirementId.TenantApprovalPolicy)
  ));
  ok(missing.omittedItemsWithReason.some((item) =>
    item.nodeId === contextRequirementNodeId(TenantContextPackCompletenessRequirementId.TenantApprovalDecision)
  ));
  ok(missing.omittedItemsWithReason.some((item) =>
    item.nodeId === contextRequirementNodeId(TenantContextPackCompletenessRequirementId.TenantApprovalEvidence)
  ));
  deepEqual(satisfied.omittedItemsWithReason, []);
  deepEqual(satisfied.lifecycleBlockers, []);
});

test("tenant-config context-pack completeness policy lets inline requirements refine set requirements by id", async () => {
  const tenantConfig = tenantConfigWithLayers([{
    layerId: "release-readiness-set-refined",
    scope: { kind: ConfigLayerScopeKind.Organization, id: "org-lfg" },
    policy: {
      contextPack: {
        completeness: {
          requirementSetIds: [TenantContextPackCompletenessRequirementSetId.ReleaseReadinessCore],
          requirements: [{
            requirementId: TenantContextPackCompletenessRequirementId.ReleaseReadinessMeeting,
            itemKind: ContextPackItemKind.Meeting,
            message: "tenant-specific readiness minutes are required",
            evidenceRef: "context_policy:tenant_specific_readiness:v2",
            requiredSourceScope: TenantContextPackCompletenessSourceScope.ActiveScope,
          }],
        },
      },
    },
    updatedAt: "2026-06-01T00:00:00.000Z",
    version: 1,
  }]);
  const policy = createTenantConfigContextPackCompletenessPolicy({
    tenantConfigs: tenantConfigReader(tenantConfig),
    fallback: emptyCompletenessPolicy(),
  });

  const result = await policy.evaluate(completenessRequest({ items: [] }));
  const readinessOmissions = result.omittedItemsWithReason.filter((item) =>
    item.nodeId === contextRequirementNodeId(TenantContextPackCompletenessRequirementId.ReleaseReadinessMeeting)
  );

  equal(readinessOmissions.length, 1);
  equal(readinessOmissions[0]?.message, "tenant-specific readiness minutes are required");
  ok(result.evidenceRefs?.includes("context_policy:tenant_specific_readiness:v2"));
});

test("tenant-config context-pack completeness policy lets specific layers refine less-specific requirements by id", async () => {
  const tenantConfig = tenantConfigWithLayers([{
    layerId: "org-runtime",
    scope: { kind: ConfigLayerScopeKind.Organization, id: "org-lfg" },
    policy: {
      contextPack: {
        completeness: {
          requirements: [{
            requirementId: "runtime_validation_evidence",
            itemKind: ContextPackItemKind.Evidence,
            message: "org runtime evidence is required",
            evidenceRef: "context_policy:org_runtime:v1",
          }],
        },
      },
    },
    updatedAt: "2026-06-01T00:00:00.000Z",
    version: 1,
  }, {
    layerId: "hat-runtime",
    scope: { kind: ConfigLayerScopeKind.Hat, id: "engineering_director" },
    policy: {
      contextPack: {
        completeness: {
          requirements: [{
            requirementId: "runtime_validation_evidence",
            itemKind: ContextPackItemKind.Evidence,
            message: "director runtime evidence is required",
            evidenceRef: "context_policy:director_runtime:v2",
          }],
        },
      },
    },
    updatedAt: "2026-06-01T00:01:00.000Z",
    version: 1,
  }]);
  const policy = createTenantConfigContextPackCompletenessPolicy({
    tenantConfigs: tenantConfigReader(tenantConfig),
    fallback: emptyCompletenessPolicy(),
  });

  const result = await policy.evaluate(completenessRequest({ items: [] }));
  const runtimeOmissions = result.omittedItemsWithReason.filter((item) =>
    item.nodeId === contextRequirementNodeId("runtime_validation_evidence")
  );

  equal(runtimeOmissions.length, 1);
  equal(runtimeOmissions[0]?.message, "director runtime evidence is required");
  ok(!result.lifecycleBlockers?.includes("org runtime evidence is required"));
  ok(result.lifecycleBlockers?.includes("director runtime evidence is required"));
});

test("tenant-config context-pack completeness policy lets valid specific layers block inherited requirements", async () => {
  const tenantConfig = tenantConfigWithLayers([{
    layerId: "org-policy",
    scope: { kind: ConfigLayerScopeKind.Organization, id: "org-lfg" },
    policy: {
      contextPack: {
        completeness: {
          requirements: [{
            requirementId: "org_security_policy",
            itemKind: ContextPackItemKind.Policy,
            message: "org security policy is required",
            evidenceRef: "context_policy:org_security:v1",
          }],
        },
      },
    },
    updatedAt: "2026-06-01T00:00:00.000Z",
    version: 1,
  }, {
    layerId: "hat-release-readiness",
    scope: { kind: ConfigLayerScopeKind.Hat, id: "engineering_director" },
    policy: {
      contextPack: {
        completeness: {
          blocksInheritedRequirements: true,
          requirementSetIds: [TenantContextPackCompletenessRequirementSetId.ReleaseReadinessCore],
        },
      },
    },
    updatedAt: "2026-06-01T00:01:00.000Z",
    version: 1,
  }]);
  const policy = createTenantConfigContextPackCompletenessPolicy({
    tenantConfigs: tenantConfigReader(tenantConfig),
    fallback: fallbackPolicy("fallback_default"),
  });

  const result = await policy.evaluate(completenessRequest({ items: [] }));

  ok(!result.omittedItemsWithReason.some((item) => item.nodeId === contextRequirementNodeId("fallback_default")));
  ok(!result.omittedItemsWithReason.some((item) => item.nodeId === contextRequirementNodeId("org_security_policy")));
  ok(result.omittedItemsWithReason.some((item) =>
    item.nodeId === contextRequirementNodeId(TenantContextPackCompletenessRequirementId.ReleaseReadinessMeeting)
  ));
});

test("tenant-config context-pack completeness policy ignores malformed inherited-block layers", async () => {
  const tenantConfig = tenantConfigWithLayers([{
    layerId: "malformed-blocker",
    scope: { kind: ConfigLayerScopeKind.Hat, id: "engineering_director" },
    policy: {
      contextPack: {
        completeness: {
          blocksInheritedRequirements: true,
          requirementSetIds: ["unknown-set"],
          requirements: [{
            requirementId: "",
            itemKind: "not-a-kind",
            message: "",
            evidenceRef: "",
          }],
        },
      },
    },
    updatedAt: "2026-06-01T00:01:00.000Z",
    version: 1,
  } as unknown as TenantConfigLayer]);
  const policy = createTenantConfigContextPackCompletenessPolicy({
    tenantConfigs: tenantConfigReader(tenantConfig),
    fallback: fallbackPolicy("fallback_default"),
  });

  const result = await policy.evaluate(completenessRequest({ items: [] }));

  ok(result.omittedItemsWithReason.some((item) => item.nodeId === contextRequirementNodeId("fallback_default")));
});

test("tenant-config context-pack completeness policy can make missing tenant context non-blocking", async () => {
  const tenantConfig = tenantConfigWithLayers([{
    layerId: "soft-evidence",
    scope: { kind: ConfigLayerScopeKind.Hat, id: "engineering_director" },
    policy: {
      contextPack: {
        completeness: {
          hardBlockMissingRequiredContext: false,
          requirements: [{
            requirementId: "soft_observability_evidence",
            itemKind: ContextPackItemKind.Evidence,
            message: "observability evidence should be attached",
            evidenceRef: "context_policy:tenant_soft_observability:v1",
          }],
        },
      },
    },
    updatedAt: "2026-06-01T00:00:00.000Z",
    version: 1,
  }]);
  const policy = createTenantConfigContextPackCompletenessPolicy({
    tenantConfigs: tenantConfigReader(tenantConfig),
    fallback: emptyCompletenessPolicy(),
  });

  const result = await policy.evaluate(completenessRequest({ items: [] }));

  ok(result.omittedItemsWithReason.some((item) => item.nodeId === contextRequirementNodeId("soft_observability_evidence")));
  deepEqual(result.lifecycleBlockers, []);
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

function emptyCompletenessPolicy(): ContextPackCompletenessPolicyPort {
  return {
    evaluate: () => ({
      omittedItemsWithReason: [],
      lifecycleBlockers: [],
      evidenceRefs: [],
    }),
  };
}

function fallbackPolicy(requirementId: string): ContextPackCompletenessPolicyPort {
  return {
    evaluate: () => ({
      omittedItemsWithReason: [{
        nodeId: contextRequirementNodeId(requirementId),
        reason: ContextPackOmissionReason.NotIndexed,
        message: `${requirementId} is missing`,
      }],
      lifecycleBlockers: [`${requirementId} is missing`],
      evidenceRefs: [`context_policy:${requirementId}:v1`],
    }),
  };
}

function contextRequirementNodeId(requirementId: string): string {
  return `context_requirement:${requirementId}`;
}

function completenessRequest(input: {
  items: readonly ContextPackItem[];
}): ContextPackCompletenessPolicyRequest {
  const hat = buildHatDefinitions().find((candidate) => candidate.id === "engineering_director");
  if (hat === undefined) throw new Error("engineering_director missing");
  return {
    query: "director billing blocker",
    observedAt: "2026-06-01T00:00:00.000Z",
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
        organizationId: "org-lfg",
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
    documentUnits: [],
    items: input.items,
  };
}

function runtimeEvidenceItem(overrides: { projectId?: string | undefined } = {}): ContextPackItem {
  return {
    id: "evidence:runtime-validation",
    kind: ContextPackItemKind.Evidence,
    title: "Runtime validation",
    summary: "Runtime evidence proves the billing blocker state.",
    sourceRef: "evidence:runtime-validation",
    required: true,
    freshness: ContextPackFreshness.Current,
    confidence: 1,
    reasons: ["tenant-completeness-test"],
    citationRefs: ["doc:runtime-validation"],
    sourcePointers: [{
      kind: ContextPackSourcePointerKind.DocUnit,
      docUnitId: "runtime-validation",
      organizationId: "org-lfg",
      scopeKind: DocScopeKind.Project,
      scopeId: overrides.projectId ?? "project-billing",
      contentRef: "git://docs/runtime-validation.md",
      contentHash: "hash-runtime",
      sourceId: "source-main",
      version: 1,
    }],
  };
}

function readinessMeetingItem(): ContextPackItem {
  return {
    id: "meeting:release-readiness",
    kind: ContextPackItemKind.Meeting,
    title: "Release readiness meeting",
    summary: "Release readiness meeting notes for the active work item.",
    sourceRef: "meeting:release-readiness",
    required: true,
    freshness: ContextPackFreshness.Current,
    confidence: 1,
    reasons: ["tenant-completeness-test"],
    sourcePointers: [{
      kind: ContextPackSourcePointerKind.WorkItem,
      workItemId: "work-billing",
    }],
  };
}

function supervisorSignalItem(overrides: { targetHatAssignmentId?: string | undefined } = {}): ContextPackItem {
  return {
    id: "signal:resource-allocation",
    kind: ContextPackItemKind.SupervisorSignal,
    title: "Resource allocation signal",
    summary: "Supervisor signal asks the director hat to allocate capacity.",
    sourceRef: "signal:resource-allocation",
    required: true,
    freshness: ContextPackFreshness.Current,
    confidence: 1,
    reasons: ["tenant-completeness-test"],
    sourcePointers: [{
      kind: ContextPackSourcePointerKind.SupervisorSignal,
      supervisorSignalId: "signal-resource-allocation",
      targetHatAssignmentId: overrides.targetHatAssignmentId ?? "99",
    }],
  };
}

function activeGraphItem(input: { nodeId: string }): ContextPackItem {
  return {
    id: "graph:priority-impact",
    kind: ContextPackItemKind.GraphNeighborhood,
    title: "Priority impact graph",
    summary: "Graph neighborhood around the active priority work item.",
    sourceRef: "graph:priority-impact",
    required: true,
    freshness: ContextPackFreshness.Current,
    confidence: 1,
    reasons: ["tenant-completeness-test"],
    sourcePointers: [{
      kind: ContextPackSourcePointerKind.GraphNode,
      nodeId: input.nodeId,
    }],
  };
}

function activePolicyItem(): ContextPackItem {
  return {
    id: "policy:tenant-approval",
    kind: ContextPackItemKind.Policy,
    title: "Tenant approval policy",
    summary: "Tenant approval policy governing the active work item.",
    sourceRef: "policy:tenant-approval",
    required: true,
    freshness: ContextPackFreshness.Current,
    confidence: 1,
    reasons: ["tenant-completeness-test"],
    sourcePointers: [{
      kind: ContextPackSourcePointerKind.WorkItem,
      workItemId: "work-billing",
    }],
  };
}

function activeDecisionItem(): ContextPackItem {
  return {
    id: "decision:tenant-approval",
    kind: ContextPackItemKind.DecisionRecord,
    title: "Tenant approval decision",
    summary: "Approval decision tied to the active billing work item.",
    sourceRef: "decision:tenant-approval",
    required: true,
    freshness: ContextPackFreshness.Current,
    confidence: 1,
    reasons: ["tenant-completeness-test"],
    sourcePointers: [{
      kind: ContextPackSourcePointerKind.Decision,
      decisionId: "decision-tenant-approval",
    }, {
      kind: ContextPackSourcePointerKind.WorkItem,
      workItemId: "work-billing",
    }],
  };
}
