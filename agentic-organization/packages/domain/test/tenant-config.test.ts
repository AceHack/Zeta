import { equal } from "node:assert/strict";
import { test } from "node:test";

import { AutonomyLevel, defaultTenantConfig, stageRequiresHuman } from "../src/index.ts";

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
