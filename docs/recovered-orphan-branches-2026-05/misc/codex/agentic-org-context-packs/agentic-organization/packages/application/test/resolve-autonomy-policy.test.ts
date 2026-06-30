import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";

import { AutonomyLevel, type AutonomyPolicy } from "../../domain/src/index.ts";
import { DEFAULT_AUTONOMY_POLICY, resolveAutonomyPolicy } from "../src/index.ts";

test("no tenant config (null) → the default policy + source default + reason no_tenant_config", () => {
  const r = resolveAutonomyPolicy(null);
  equal(r.source, "default");
  equal(r.reason, "no_tenant_config");
  deepEqual(r.policy, DEFAULT_AUTONOMY_POLICY);
});

test("no tenant config (undefined) → the default policy + source default + reason no_tenant_config", () => {
  const r = resolveAutonomyPolicy(undefined);
  equal(r.source, "default");
  equal(r.reason, "no_tenant_config");
  deepEqual(r.policy, DEFAULT_AUTONOMY_POLICY);
});

test("malformed level (not an AutonomyLevel value) → default + reason malformed_autonomy", () => {
  // JSONB can be corrupt; an unknown level must fall back to the default, never crash.
  const corrupt = { level: "ultra", humanGatedStageIds: [] } as unknown as AutonomyPolicy;
  const r = resolveAutonomyPolicy(corrupt);
  equal(r.source, "default");
  equal(r.reason, "malformed_autonomy");
  deepEqual(r.policy, DEFAULT_AUTONOMY_POLICY);
});

test("malformed humanGatedStageIds (not an array) → default + reason malformed_autonomy", () => {
  const corrupt = { level: AutonomyLevel.Manual, humanGatedStageIds: "human-qa-signoff" } as unknown as AutonomyPolicy;
  const r = resolveAutonomyPolicy(corrupt);
  equal(r.source, "default");
  equal(r.reason, "malformed_autonomy");
  deepEqual(r.policy, DEFAULT_AUTONOMY_POLICY);
});

test("malformed humanGatedStageIds (array with a non-string) → default + reason malformed_autonomy", () => {
  const corrupt = { level: AutonomyLevel.Manual, humanGatedStageIds: ["ok", 42] } as unknown as AutonomyPolicy;
  const r = resolveAutonomyPolicy(corrupt);
  equal(r.source, "default");
  equal(r.reason, "malformed_autonomy");
  deepEqual(r.policy, DEFAULT_AUTONOMY_POLICY);
});

test("valid Manual tenant → source tenant-config + level manual", () => {
  const tenant: AutonomyPolicy = { level: AutonomyLevel.Manual, humanGatedStageIds: ["security"] };
  const r = resolveAutonomyPolicy(tenant);
  equal(r.source, "tenant-config");
  equal(r.reason, undefined);
  equal(r.policy.level, AutonomyLevel.Manual);
  deepEqual(r.policy.humanGatedStageIds, ["security"]);
});

test("valid Autonomous tenant with empty pins → source tenant-config", () => {
  const tenant: AutonomyPolicy = { level: AutonomyLevel.Autonomous, humanGatedStageIds: [] };
  const r = resolveAutonomyPolicy(tenant);
  equal(r.source, "tenant-config");
  equal(r.policy.level, AutonomyLevel.Autonomous);
  deepEqual(r.policy.humanGatedStageIds, []);
});

test("a valid tenant policy is normalized to exactly {level, humanGatedStageIds} — no extra keys leak through", () => {
  const tenant = {
    level: AutonomyLevel.Assisted,
    humanGatedStageIds: ["human-qa-signoff"],
    extra: "should-not-survive",
    nested: { a: 1 },
  } as unknown as AutonomyPolicy;
  const r = resolveAutonomyPolicy(tenant);
  equal(r.source, "tenant-config");
  deepEqual(Object.keys(r.policy).sort(), ["humanGatedStageIds", "level"]);
  deepEqual(r.policy, { level: AutonomyLevel.Assisted, humanGatedStageIds: ["human-qa-signoff"] });
});
