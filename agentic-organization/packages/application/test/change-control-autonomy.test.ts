import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { AutonomyLevel } from "../../domain/src/index.ts";
import { applyAutonomyPolicy, buildGitHubGatedPipeline, buildInternalOnlyPipeline } from "../src/index.ts";

const github = buildGitHubGatedPipeline("org-lfg");

test("Autonomous tenant: the human QA sign-off is DOWNGRADED to the agent (no human in the loop)", () => {
  const p = applyAutonomyPolicy(github, { level: AutonomyLevel.Autonomous, humanGatedStageIds: [] });
  const signoff = p.stages.find((s) => s.id === "human-qa-signoff")!;
  equal(signoff.authority.kind, "hat", "an autonomous tenant lets the agent do the QA sign-off");
  if (signoff.authority.kind === "hat") equal(signoff.authority.hatId, "qa_lead");
});

test("Assisted tenant with the QA sign-off pinned: it STAYS human; other stages are agent-decided", () => {
  const p = applyAutonomyPolicy(github, { level: AutonomyLevel.Assisted, humanGatedStageIds: ["human-qa-signoff"] });
  equal(p.stages.find((s) => s.id === "human-qa-signoff")!.authority.kind, "human");
  equal(p.stages.find((s) => s.id === "internal-code-review")!.authority.kind, "hat", "unpinned stages stay agent");
});

test("Manual tenant: every AGENT (hat) stage becomes human — the dial turned all the way up on the agent↔human axis", () => {
  const p = applyAutonomyPolicy(buildInternalOnlyPipeline("org-lfg"), { level: AutonomyLevel.Manual, humanGatedStageIds: [] });
  equal(p.stages.find((s) => s.id === "internal-code-review")!.authority.kind, "human", "an agent code-review stage is gated to a human");
  equal(p.stages.find((s) => s.id === "internal-qa")!.authority.kind, "human", "an agent QA stage is gated to a human");
});

test("Manual tenant: a QUORUM stage KEEPS its quorum — the dial layers human review, it does NOT strip the 3-of-3 gate", () => {
  // regression: gating a quorum stage to a single human would silently drop the security
  // quorum (the human-resume path hardcodes gateSatisfiable=true). The dial must leave it intact.
  const p = applyAutonomyPolicy(buildInternalOnlyPipeline("org-lfg"), { level: AutonomyLevel.Manual, humanGatedStageIds: ["security"] });
  const security = p.stages.find((s) => s.id === "security")!;
  equal(security.authority.kind, "quorum", "the security quorum is NOT rewritten to a single human");
  if (security.authority.kind === "quorum") equal(security.authority.threshold, 3, "the 3-of-3 threshold survives the dial");
});

test("Manual tenant: an EXTERNAL stage KEEPS its external authority — the dial never synthesizes a bogus hat id", () => {
  // regression: gating then ungating an external stage would round-trip into {kind:"hat",hatId:"external:github"},
  // a hat no one holds. The dial must leave external authorities (their own system gate) untouched.
  const p = applyAutonomyPolicy(github, { level: AutonomyLevel.Manual, humanGatedStageIds: ["external-code-review"] });
  equal(p.stages.find((s) => s.id === "external-code-review")!.authority.kind, "external", "the external authority is preserved");
});

test("the SAME base pipeline runs autonomous for one tenant and human-gated for another (config, not code)", () => {
  const autonomous = applyAutonomyPolicy(github, { level: AutonomyLevel.Autonomous, humanGatedStageIds: [] });
  const gated = applyAutonomyPolicy(github, { level: AutonomyLevel.Manual, humanGatedStageIds: [] });
  const humanCount = (p: typeof github) => p.stages.filter((s) => s.authority.kind === "human").length;
  equal(humanCount(autonomous), 0, "autonomous: no humans (the QA sign-off is downgraded to the agent)");
  // Manual promotes the 2 hat stages (code-review, QA) to human; the already-human QA sign-off stays human;
  // the quorum + external stages keep their own (stronger) authority. 2 + 1 = 3.
  ok(humanCount(gated) > humanCount(autonomous), "same pipeline, opposite human-gating, by data alone");
  equal(humanCount(gated), 3, "two agent stages promoted + the QA sign-off; quorum + external preserved");
});
