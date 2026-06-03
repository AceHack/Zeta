import { equal } from "node:assert/strict";
import { test } from "node:test";

import {
  AutonomyLevel,
  ConfigLayerScopeKind,
  TenantContextPackCompletenessRequirementSetId,
  TenantContextPackCompletenessSourceScope,
  TenantContextPackCurationInstruction,
  TenantContextPackCurationLaneKind,
  TenantContextPackCurationProfileId,
  TenantContextPackSynthesisRequirementReason,
  TenantContextPackSynthesisRequirementSetId,
  defaultTenantConfig,
} from "../../domain/src/index.ts";
import {
  ContextPackAttentionLaneKind,
  ContextPackCurationProfileId,
  ContextPackItemKind,
} from "../../application/src/index.ts";
import { createCockroachTenantConfigStore } from "../src/cockroach-tenant-config-store.ts";
import type { CockroachGenericSqlExecutor } from "../src/cockroach-sql-executor.ts";

function fakeExecutor(): CockroachGenericSqlExecutor {
  const rows = new Map<string, Record<string, unknown>>();
  const exec = async (s: { sql: string; parameters: readonly unknown[] }) => {
    const p = s.parameters;
    if (s.sql.includes("INSERT INTO")) { rows.set(p[0] as string, { organization_id: p[0], config: p[1], updated_at: p[2], version: p[3] }); return { rows: [] }; }
    if (s.sql.includes("WHERE organization_id = $1")) { const r = rows.get(p[0] as string); return { rows: r ? [r] : [] }; }
    return { rows: [] };
  };
  return { execute: exec, executeTransaction: async (op: (e: { execute: typeof exec }) => unknown) => op({ execute: exec }) } as unknown as CockroachGenericSqlExecutor;
}

test("tenant config store round-trips the whole config (autonomy + workflow + bindings)", async () => {
  const store = createCockroachTenantConfigStore({ executor: fakeExecutor() });
  const c = { ...defaultTenantConfig("org-lfg", "2026-05-30T00:00:00Z"), autonomy: { level: AutonomyLevel.Manual, humanGatedStageIds: ["external-code-review"] } };
  await store.upsert(c);
  const got = await store.get("org-lfg");
  equal(got?.organizationId, "org-lfg");
  equal(got?.autonomy.level, AutonomyLevel.Manual);
  equal(got?.autonomy.humanGatedStageIds[0], "external-code-review");
  equal(got?.workflow.defaultPipelineId, "internal-only");
});

test("tenant config store round-trips context-pack curation layer policy", async () => {
  const store = createCockroachTenantConfigStore({ executor: fakeExecutor() });
  const c = {
    ...defaultTenantConfig("org-lfg", "2026-05-30T00:00:00Z"),
    layers: [{
      layerId: "hat-context-policy",
      scope: { kind: ConfigLayerScopeKind.Hat, id: "engineering_director" },
      policy: {
        contextPack: {
          curation: {
            profileId: TenantContextPackCurationProfileId.SecurityControl,
            requiredLanes: [TenantContextPackCurationLaneKind.Memory],
            lanePriorityOverrides: { [TenantContextPackCurationLaneKind.LegalActions]: 8 },
            deterministicInstructions: [TenantContextPackCurationInstruction.SecurityControl],
            blocksInheritedDeterministicInstructions: true,
          },
          completeness: {
            requirementSetIds: [
              TenantContextPackCompletenessRequirementSetId.ReleaseReadinessCore,
              TenantContextPackCompletenessRequirementSetId.CustomerBusinessScopeCore,
            ],
            blocksInheritedRequirements: true,
            hardBlockMissingRequiredContext: false,
            requirements: [{
              requirementId: "credential_owner_evidence",
              itemKind: ContextPackItemKind.Evidence,
              message: "credential-owner evidence is required",
              evidenceRef: "context_policy:tenant_credential_owner:v1",
              requiredSourceScope: TenantContextPackCompletenessSourceScope.ActiveScope,
            }],
          },
          synthesisRequirement: {
            requirementSetIds: [TenantContextPackSynthesisRequirementSetId.ReleaseReadinessCore],
            blocksInheritedRequirements: true,
            requirements: [{
              requirementId: "director_blocker_model_briefing",
              reason: TenantContextPackSynthesisRequirementReason.TenantRequiresModelBriefing,
              appliesTo: {
                phases: ["blocked"],
                scopes: ["project"],
                hatIds: ["engineering_director"],
              },
            }],
          },
        },
      },
      updatedAt: "2026-05-30T00:10:00Z",
      version: 1,
    }],
  };

  await store.upsert(c);
  const got = await store.get("org-lfg");

  equal(got?.layers?.[0]?.policy.contextPack?.curation?.profileId, ContextPackCurationProfileId.SecurityControl);
  equal(got?.layers?.[0]?.policy.contextPack?.curation?.requiredLanes?.[0], ContextPackAttentionLaneKind.Memory);
  equal(
    got?.layers?.[0]?.policy.contextPack?.curation?.lanePriorityOverrides?.[ContextPackAttentionLaneKind.LegalActions],
    8,
  );
  equal(got?.layers?.[0]?.policy.contextPack?.curation?.blocksInheritedDeterministicInstructions, true);
  equal(
    got?.layers?.[0]?.policy.contextPack?.completeness?.requirements?.[0]?.requirementId,
    "credential_owner_evidence",
  );
  equal(
    got?.layers?.[0]?.policy.contextPack?.completeness?.requirements?.[0]?.requiredSourceScope,
    TenantContextPackCompletenessSourceScope.ActiveScope,
  );
  equal(
    got?.layers?.[0]?.policy.contextPack?.completeness?.requirementSetIds?.[0],
    TenantContextPackCompletenessRequirementSetId.ReleaseReadinessCore,
  );
  equal(
    got?.layers?.[0]?.policy.contextPack?.completeness?.requirementSetIds?.[1],
    TenantContextPackCompletenessRequirementSetId.CustomerBusinessScopeCore,
  );
  equal(got?.layers?.[0]?.policy.contextPack?.completeness?.blocksInheritedRequirements, true);
  equal(got?.layers?.[0]?.policy.contextPack?.completeness?.hardBlockMissingRequiredContext, false);
  equal(
    got?.layers?.[0]?.policy.contextPack?.synthesisRequirement?.requirementSetIds?.[0],
    TenantContextPackSynthesisRequirementSetId.ReleaseReadinessCore,
  );
  equal(
    got?.layers?.[0]?.policy.contextPack?.synthesisRequirement?.requirements?.[0]?.reason,
    TenantContextPackSynthesisRequirementReason.TenantRequiresModelBriefing,
  );
  equal(got?.layers?.[0]?.policy.contextPack?.synthesisRequirement?.blocksInheritedRequirements, true);
  equal(got?.layers?.[0]?.policy.contextPack?.synthesisRequirement?.requirements?.[0]?.appliesTo?.phases?.[0], "blocked");
});

test("tenant config store returns null for an unconfigured org (caller uses the default)", async () => {
  const store = createCockroachTenantConfigStore({ executor: fakeExecutor() });
  equal(await store.get("org-missing"), null);
});
