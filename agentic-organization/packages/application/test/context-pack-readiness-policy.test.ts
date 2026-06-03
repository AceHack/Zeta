import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  ConfigLayerScopeKind,
  TenantContextPackOmissionReason,
  TenantContextPackUncertaintySeverity,
  TenantContextPackUncertaintySignalKind,
  defaultTenantConfig,
  type TenantConfig,
} from "../../domain/src/index.ts";
import {
  asZetaIdDecimal,
  ContextPackCurationStageKind,
  ContextPackFreshness,
  ContextPackItemKind,
  ContextPackOmissionReason,
  ContextPackSourcePointerKind,
  ContextPackStatus,
  ContextPackUncertaintySeverity,
  ContextPackUncertaintySignalKind,
  createDefaultContextPackReadinessPolicy,
  createTenantConfigContextPackReadinessPolicy,
  evaluateContextPackReadiness,
  buildHatDefinitions,
  RunScope,
  RunLifecyclePhase,
  type ContextPack,
  type ContextPackReadinessPolicyRequest,
} from "../src/index.ts";

const observedAt = "2026-06-02T12:00:00.000Z";

test("evaluateContextPackReadiness marks an unavailable builder pack as missing", () => {
  const status = evaluateContextPackReadiness(pack({
    omittedItemsWithReason: [{
      reason: ContextPackOmissionReason.BuilderUnavailable,
      message: "builder unavailable",
    }],
  }), observedAt);

  equal(status, ContextPackStatus.Missing);
});

test("evaluateContextPackReadiness marks contradictions and omissions as incomplete before current", () => {
  equal(
    evaluateContextPackReadiness(pack({ contradictions: ["BRD conflicts with ADR"] }), observedAt),
    ContextPackStatus.Conflicted,
  );
  equal(
    evaluateContextPackReadiness(pack({
      omittedItemsWithReason: [{ reason: ContextPackOmissionReason.NotIndexed, message: "missing BRD" }],
    }), observedAt),
    ContextPackStatus.Incomplete,
  );
});

test("evaluateContextPackReadiness marks stale or invalid context packs deterministically", () => {
  equal(
    evaluateContextPackReadiness(pack({ freshnessDeadline: "2026-06-02T11:59:59.000Z" }), observedAt),
    ContextPackStatus.Stale,
  );
  equal(
    evaluateContextPackReadiness(pack({ staleInputs: ["doc:outdated"] }), observedAt),
    ContextPackStatus.Stale,
  );
  equal(
    evaluateContextPackReadiness(pack({ generatedAt: "not-a-date" }), observedAt),
    ContextPackStatus.Incomplete,
  );
});

test("evaluateContextPackReadiness requires replayable provenance and required curation stages", () => {
  equal(
    evaluateContextPackReadiness(pack({
      items: [item({ sourcePointers: [] })],
    }), observedAt),
    ContextPackStatus.Incomplete,
  );
  equal(
    evaluateContextPackReadiness(pack({
      curationTrace: [{
        stage: ContextPackCurationStageKind.DeterministicScope,
        summary: "scope done",
        evidenceRefs: [],
      }],
    }), observedAt),
    ContextPackStatus.Incomplete,
  );
});

test("evaluateContextPackReadiness enforces policy-required curation plan stages", () => {
  equal(
    evaluateContextPackReadiness(pack({
      curationPlan: {
        deterministicInstructions: [],
        requiredStages: [ContextPackCurationStageKind.EphemeralSynthesis],
        lanes: [],
      },
    }), observedAt),
    ContextPackStatus.Incomplete,
  );
});

test("evaluateContextPackReadiness marks complete fresh replayable packs as current", () => {
  equal(evaluateContextPackReadiness(pack(), observedAt), ContextPackStatus.Current);
});

test("tenant-config context-pack readiness policy hard-stops matching uncertainty signals", async () => {
  const tenantConfig = tenantConfigWithLayers([{
    layerId: "hat-stale-evidence-hard-stop",
    scope: { kind: ConfigLayerScopeKind.Hat, id: "engineering_director" },
    policy: {
      contextPack: {
        readiness: {
          uncertaintyHardStops: [{
            ruleId: "director_stale_evidence_stop",
            severity: TenantContextPackUncertaintySeverity.High,
            kinds: [TenantContextPackUncertaintySignalKind.StaleEvidence],
            message: "director cannot unblock with stale governing evidence",
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
  const policy = createTenantConfigContextPackReadinessPolicy({
    tenantConfigs: tenantConfigReader(tenantConfig),
    fallback: createDefaultContextPackReadinessPolicy(),
  });

  const result = await policy.evaluate(readinessRequest({
    pack: pack({
      uncertaintySignals: [{
        kind: ContextPackUncertaintySignalKind.StaleEvidence,
        severity: ContextPackUncertaintySeverity.High,
        evidenceRefs: ["doc:old-brd"],
        message: "Only stale BRD evidence is available.",
      }],
    }),
  }));

  equal(result.status, ContextPackStatus.Incomplete);
  ok(result.policyVersion.includes("tenant-context-readiness"));
  ok(result.policyVersion.includes("hat-stale-evidence-hard-stop"));
  equal(result.hardStopReasons[0], "director cannot unblock with stale governing evidence");
});

test("tenant-config context-pack readiness policy hard-stops matching omissions", async () => {
  const tenantConfig = tenantConfigWithLayers([{
    layerId: "director-required-doc-omission-stop",
    scope: { kind: ConfigLayerScopeKind.Hat, id: "engineering_director" },
    policy: {
      contextPack: {
        readiness: {
          omissionHardStops: [{
            ruleId: "director_missing_indexed_context_stop",
            reasons: [TenantContextPackOmissionReason.NotIndexed],
            message: "director cannot unblock while required governing context is not indexed",
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
  const policy = createTenantConfigContextPackReadinessPolicy({
    tenantConfigs: tenantConfigReader(tenantConfig),
    fallback: createDefaultContextPackReadinessPolicy(),
  });

  const result = await policy.evaluate(readinessRequest({
    pack: pack({
      omittedItemsWithReason: [{
        nodeId: "context_requirement:management_blocker:business_document",
        reason: ContextPackOmissionReason.NotIndexed,
        message: "Missing business document context for management blocker.",
      }],
    }),
  }));

  equal(result.status, ContextPackStatus.Incomplete);
  ok(result.policyVersion.includes("tenant-context-readiness"));
  ok(result.policyVersion.includes("director-required-doc-omission-stop"));
  equal(result.hardStopReasons[0], "director cannot unblock while required governing context is not indexed");
});

test("tenant-config context-pack readiness policy hard-stops contradictions for matching hats", async () => {
  const tenantConfig = tenantConfigWithLayers([{
    layerId: "director-contradiction-stop",
    scope: { kind: ConfigLayerScopeKind.Hat, id: "engineering_director" },
    policy: {
      contextPack: {
        readiness: {
          contradictionHardStops: [{
            ruleId: "director_conflicted_governance_stop",
            message: "director cannot unblock while governing context is contradicted",
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
  const policy = createTenantConfigContextPackReadinessPolicy({
    tenantConfigs: tenantConfigReader(tenantConfig),
    fallback: createDefaultContextPackReadinessPolicy(),
  });

  const result = await policy.evaluate(readinessRequest({
    pack: pack({
      contradictions: ["BRD says platform owns billing recovery; ADR says payments owns it."],
    }),
  }));

  equal(result.status, ContextPackStatus.Conflicted);
  ok(result.policyVersion.includes("tenant-context-readiness"));
  ok(result.policyVersion.includes("director-contradiction-stop"));
  equal(result.hardStopReasons[0], "director cannot unblock while governing context is contradicted");
});

test("tenant-config context-pack readiness policy hard-stops matching lifecycle blockers", async () => {
  const tenantConfig = tenantConfigWithLayers([{
    layerId: "director-approved-blocker-stop",
    scope: { kind: ConfigLayerScopeKind.Hat, id: "engineering_director" },
    policy: {
      contextPack: {
        readiness: {
          lifecycleBlockerHardStops: [{
            ruleId: "director_approved_blocker_stop",
            blockerPrefixes: ["approved blocker:"],
            message: "director cannot unblock while approved context blockers remain",
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
  const policy = createTenantConfigContextPackReadinessPolicy({
    tenantConfigs: tenantConfigReader(tenantConfig),
    fallback: createDefaultContextPackReadinessPolicy(),
  });

  const result = await policy.evaluate(readinessRequest({
    pack: pack({
      lifecycleBlockers: ["approved blocker: verify billing owner decision before unblocking"],
    }),
  }));

  equal(result.status, ContextPackStatus.Incomplete);
  ok(result.policyVersion.includes("tenant-context-readiness"));
  ok(result.policyVersion.includes("director-approved-blocker-stop"));
  equal(result.hardStopReasons[0], "director cannot unblock while approved context blockers remain");
});

test("tenant-config context-pack readiness policy hard-stops matching stale inputs", async () => {
  const tenantConfig = tenantConfigWithLayers([{
    layerId: "director-stale-doc-stop",
    scope: { kind: ConfigLayerScopeKind.Hat, id: "engineering_director" },
    policy: {
      contextPack: {
        readiness: {
          staleHardStops: [{
            ruleId: "director_stale_doc_stop",
            staleInputPrefixes: ["doc:"],
            message: "director cannot unblock while governing documents are stale",
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
  const policy = createTenantConfigContextPackReadinessPolicy({
    tenantConfigs: tenantConfigReader(tenantConfig),
    fallback: createDefaultContextPackReadinessPolicy(),
  });

  const result = await policy.evaluate(readinessRequest({
    pack: pack({
      staleInputs: ["doc:billing-owner-policy-old"],
    }),
  }));

  equal(result.status, ContextPackStatus.Incomplete);
  ok(result.policyVersion.includes("tenant-context-readiness"));
  ok(result.policyVersion.includes("director-stale-doc-stop"));
  equal(result.hardStopReasons[0], "director cannot unblock while governing documents are stale");
});

test("tenant-config context-pack readiness policy ignores malformed or non-matching readiness rules", async () => {
  const tenantConfig = tenantConfigWithLayers([{
    layerId: "bad-readiness-rules",
    scope: { kind: ConfigLayerScopeKind.Organization, id: "org-lfg" },
    policy: {
      contextPack: {
        readiness: {
          uncertaintyHardStops: [{
            ruleId: "",
            severity: "not-a-severity",
            kinds: ["not-a-kind"],
            message: "",
          }, {
            ruleId: "runtime_only",
            severity: TenantContextPackUncertaintySeverity.High,
            kinds: [TenantContextPackUncertaintySignalKind.ConflictingEvidence],
            message: "runtime conflicts stop execution",
            appliesTo: {
              phases: [RunLifecyclePhase.Executing],
              scopes: [RunScope.WorkItem],
            },
          }],
          omissionHardStops: [{
            ruleId: "",
            reasons: ["not-a-reason"],
            message: "",
          }, {
            ruleId: "access_denied_only",
            reasons: [TenantContextPackOmissionReason.AccessDenied],
            message: "access denied stops execution",
            appliesTo: {
              phases: [RunLifecyclePhase.Executing],
              scopes: [RunScope.WorkItem],
            },
          }],
          contradictionHardStops: [{
            ruleId: "",
            message: "",
          }, {
            ruleId: "qa_only_contradiction",
            message: "qa contradictions stop execution",
            appliesTo: {
              phases: [RunLifecyclePhase.Executing],
              scopes: [RunScope.WorkItem],
            },
          }],
          lifecycleBlockerHardStops: [{
            ruleId: "",
            blockerPrefixes: [""],
            message: "",
          }, {
            ruleId: "executing_blocker_only",
            blockerPrefixes: ["approved blocker:"],
            message: "execution blockers stop execution",
            appliesTo: {
              phases: [RunLifecyclePhase.Executing],
              scopes: [RunScope.WorkItem],
            },
          }],
          staleHardStops: [{
            ruleId: "",
            staleInputPrefixes: [""],
            message: "",
          }, {
            ruleId: "executing_stale_doc_only",
            staleInputPrefixes: ["doc:"],
            message: "stale docs stop execution",
            appliesTo: {
              phases: [RunLifecyclePhase.Executing],
              scopes: [RunScope.WorkItem],
            },
          }],
        },
      },
    },
    updatedAt: "2026-06-01T00:00:00.000Z",
    version: 1,
  } as unknown as NonNullable<TenantConfig["layers"]>[number]]);
  const policy = createTenantConfigContextPackReadinessPolicy({
    tenantConfigs: tenantConfigReader(tenantConfig),
    fallback: createDefaultContextPackReadinessPolicy(),
  });

  const result = await policy.evaluate(readinessRequest({
    pack: pack({
      uncertaintySignals: [{
        kind: ContextPackUncertaintySignalKind.StaleEvidence,
        severity: ContextPackUncertaintySeverity.High,
        evidenceRefs: ["doc:old-brd"],
        message: "Only stale BRD evidence is available.",
      }],
    }),
  }));

  equal(result.status, ContextPackStatus.Current);
  equal(result.hardStopReasons.length, 0);
});

function pack(overrides: Partial<ContextPack> = {}): ContextPack {
  return {
    id: "ctx-test",
    runId: asZetaIdDecimal("42"),
    scope: RunScope.WorkItem,
    hatAssignmentId: asZetaIdDecimal("99"),
    hatId: "engineering_director",
    generatedAt: "2026-06-02T11:00:00.000Z",
    freshnessDeadline: "2026-06-02T13:00:00.000Z",
    sourceGraphVersion: "graph:v1",
    policyVersion: "policy:v1",
    tokenBudget: 2048,
    items: [item()],
    omittedItemsWithReason: [],
    contradictions: [],
    staleInputs: [],
    lifecycleBlockers: [],
    curationTrace: [
      {
        stage: ContextPackCurationStageKind.DeterministicScope,
        summary: "scope done",
        evidenceRefs: [],
      },
      {
        stage: ContextPackCurationStageKind.RequiredConsult,
        summary: "consult done",
        evidenceRefs: [],
      },
      {
        stage: ContextPackCurationStageKind.GapReview,
        summary: "gaps reviewed",
        evidenceRefs: [],
      },
    ],
    ...overrides,
  };
}

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

function readinessRequest(input: { pack: ContextPack }): ContextPackReadinessPolicyRequest {
  const hat = buildHatDefinitions().find((candidate) => candidate.id === "engineering_director");
  if (hat === undefined) throw new Error("engineering_director missing");
  return {
    pack: input.pack,
    observedAt,
    snapshot: {
      runId: asZetaIdDecimal("42"),
      scope: RunScope.WorkItem,
      phase: RunLifecyclePhase.Blocked,
      trace: { traceId: "trace-1", correlationId: "corr-1", causationId: "cause-1" },
      hasGateApproval: false,
      hasEvidence: false,
      hatAssignmentId: asZetaIdDecimal("99"),
      hat,
      agentId: "agent-director-1",
      organizationId: "org-lfg",
      projectId: "project-1",
      teamId: "team-1",
      workItemId: "work-1",
    },
  };
}

function item(overrides: Partial<ContextPack["items"][number]> = {}): ContextPack["items"][number] {
  return {
    id: "doc:brd",
    kind: ContextPackItemKind.BusinessDocument,
    title: "BRD",
    summary: "Business rules for the current work.",
    sourceRef: "doc:brd",
    required: true,
    freshness: ContextPackFreshness.Current,
    confidence: 0.9,
    reasons: ["required-doc"],
    sourcePointers: [{ kind: ContextPackSourcePointerKind.WorkItem, workItemId: "work-1" }],
    ...overrides,
  };
}
