import { equal } from "node:assert/strict";
import { test } from "node:test";

import {
  AutonomyLevel,
  ConfigLayerScopeKind,
  defaultTenantConfig,
  resolveLayeredTenantConfig,
  stageRequiresHuman,
  type TenantConfigLayer,
} from "../src/index.ts";

test("the autonomy dial is data: an explicit pin always requires a human", () => {
  const policy = { level: AutonomyLevel.Autonomous, humanGatedStageIds: ["human-qa-signoff"] };
  equal(stageRequiresHuman(policy, "human-qa-signoff"), true, "a pinned stage is human-gated even when autonomous");
  equal(stageRequiresHuman(policy, "internal-code-review"), false, "an unpinned stage is agent-decided when autonomous");
});

test("Manual gates every stage; Autonomous gates nothing extra", () => {
  equal(stageRequiresHuman({ level: AutonomyLevel.Manual, humanGatedStageIds: [] }, "any-stage"), true);
  equal(stageRequiresHuman({ level: AutonomyLevel.Autonomous, humanGatedStageIds: [] }, "any-stage"), false);
});

test("the default tenant config is assisted autonomy with the QA signoff pinned to a human", () => {
  const c = defaultTenantConfig("org-lfg", "2026-05-30T00:00:00Z");
  equal(c.autonomy.level, AutonomyLevel.Assisted);
  equal(stageRequiresHuman(c.autonomy, "human-qa-signoff"), true);
  equal(c.workflow.defaultPipelineId, "internal-only");
});

test("layered tenant config resolves first-non-nil model overrides by specificity", () => {
  const resolved = resolveLayeredTenantConfig({
    organizationId: "org-lfg",
    departmentId: "engineering",
    hatId: "code_reviewer",
    workItemId: "work-1",
    layers: [
      layer(ConfigLayerScopeKind.Organization, "org-lfg", { model: "qwen2:0.5b" }),
      layer(ConfigLayerScopeKind.Department, "engineering", { model: "qwen2:1.5b" }),
      layer(ConfigLayerScopeKind.Hat, "code_reviewer", { model: "qwen2:7b" }),
    ],
  });

  equal(resolved.model, "qwen2:7b");
});

test("layered tenant config stacks integer budget adjustments", () => {
  const resolved = resolveLayeredTenantConfig({
    organizationId: "org-lfg",
    departmentId: "engineering",
    hatId: "code_reviewer",
    layers: [
      layer(ConfigLayerScopeKind.Organization, "org-lfg", { budgetDeltaTokens: 1_000 }),
      layer(ConfigLayerScopeKind.Department, "engineering", { budgetDeltaTokens: 500 }),
      layer(ConfigLayerScopeKind.Hat, "code_reviewer", { budgetDeltaTokens: -100 }),
    ],
  });

  equal(resolved.budgetDeltaTokens, 1_400);
});

test("layered tenant config can block inherited directives", () => {
  const resolved = resolveLayeredTenantConfig({
    organizationId: "org-lfg",
    departmentId: "engineering",
    hatId: "code_reviewer",
    layers: [
      layer(ConfigLayerScopeKind.Organization, "org-lfg", { directives: ["use small model"] }),
      layer(ConfigLayerScopeKind.Hat, "code_reviewer", { blocksInheritedDirectives: true, directives: ["review strictly"] }),
    ],
  });

  equal(resolved.directives.join("|"), "review strictly");
});

test("same-specificity layers resolve deterministically by timestamp, version, then id", () => {
  const older = layer(ConfigLayerScopeKind.Hat, "code_reviewer", { model: "qwen2:1.5b" }, {
    layerId: "hat-old",
    updatedAt: "2026-05-30T00:00:00Z",
    version: 1,
  });
  const newer = layer(ConfigLayerScopeKind.Hat, "code_reviewer", { model: "qwen2:7b" }, {
    layerId: "hat-new",
    updatedAt: "2026-05-30T01:00:00Z",
    version: 2,
  });

  const left = resolveLayeredTenantConfig({
    organizationId: "org-lfg",
    hatId: "code_reviewer",
    layers: [newer, older],
  });
  const right = resolveLayeredTenantConfig({
    organizationId: "org-lfg",
    hatId: "code_reviewer",
    layers: [older, newer],
  });

  equal(left.model, "qwen2:7b");
  equal(right.model, "qwen2:7b");
  equal(left.appliedLayerIds.join("|"), "hat-old|hat-new");
  equal(right.appliedLayerIds.join("|"), "hat-old|hat-new");
});

function layer(
  scopeKind: ConfigLayerScopeKind,
  scopeId: string,
  policy: Parameters<typeof resolveLayeredTenantConfig>[0]["layers"][number]["policy"],
  over: Partial<Pick<TenantConfigLayer, "layerId" | "updatedAt" | "version">> = {},
) {
  return {
    layerId: over.layerId ?? `${scopeKind}-${scopeId}`,
    scope: { kind: scopeKind, id: scopeId },
    policy,
    updatedAt: over.updatedAt ?? "2026-05-30T00:00:00Z",
    version: over.version ?? 1,
  };
}
