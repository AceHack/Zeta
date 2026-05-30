import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { ChangeSetPhase, ExternalSystem, WorkItemState, type ChangeSet, type ReviewStage } from "../../domain/src/index.ts";
import {
  createNullChangeControlPort,
  createFakeExternalPort,
  ReviewPipelineId,
  buildInternalOnlyPipeline,
  buildGitHubGatedPipeline,
  buildDefaultChangeControlPolicy,
  pipelineForWorkType,
  workItemStateForChangeSet,
  externalStateForChangeSet,
  ExternalDecision,
} from "../src/index.ts";

function changeSet(over: Partial<ChangeSet> = {}): ChangeSet {
  return {
    changeSetId: "cs-1", organizationId: "org-lfg", workItemId: "work-1", proposerHatId: "h",
    title: "t", targetRef: "feat/x", phase: ChangeSetPhase.InReview, pipelineId: "pl", currentStageIndex: 0,
    artifacts: [], projections: [], revision: 1, openedAt: "2026-05-30T00:00:00Z", updatedAt: "2026-05-30T00:00:00Z", ...over,
  };
}
const aStage: ReviewStage = { id: "external", ownerLabel: "external:github", authority: { kind: "external", system: ExternalSystem.GitHub }, gate: "external_approved", blocking: true, projectTo: ExternalSystem.GitHub };

test("internal-only pipeline has NO external and NO human stages (org ships with zero projections)", () => {
  const pl = buildInternalOnlyPipeline("org-lfg");
  equal(pl.pipelineId, ReviewPipelineId.InternalOnly);
  ok(pl.stages.every((s) => s.authority.kind !== "external" && s.authority.kind !== "human"));
  ok(pl.stages.every((s) => s.projectTo === undefined));
});

test("github-gated pipeline = internal-only PLUS exactly two appended stages (external + human)", () => {
  const internal = buildInternalOnlyPipeline("org-lfg");
  const github = buildGitHubGatedPipeline("org-lfg");
  equal(github.stages.length, internal.stages.length + 2);
  const tail = github.stages.slice(internal.stages.length);
  equal(tail[0]!.authority.kind, "external");
  equal(tail[0]!.projectTo, ExternalSystem.GitHub);
  equal(tail[1]!.authority.kind, "human");
});

test("policy selects a pipeline by work type, defaulting to internal-only", () => {
  const policy = buildDefaultChangeControlPolicy("org-lfg");
  equal(pipelineForWorkType(policy, "task").pipelineId, ReviewPipelineId.InternalOnly);
  policy.pipelineByWorkType["release"] = ReviewPipelineId.GitHubGated;
  equal(pipelineForWorkType(policy, "release").pipelineId, ReviewPipelineId.GitHubGated);
});

test("NullChangeControlPort runs internal-only — an external stage degrades to approved, never blocks", async () => {
  const port = createNullChangeControlPort();
  equal(port.system, ExternalSystem.None);
  const ref = await port.project(changeSet(), aStage);
  const state = await port.pull(ref);
  equal(state.decision, ExternalDecision.Approved); // internal-only → never blocks
});

test("fake external port: project is pending; flip to approved simulates a human approving the PR", async () => {
  let t = 1000;
  const port = createFakeExternalPort(ExternalSystem.GitHub, () => t);
  const ref = await port.project(changeSet(), aStage);
  equal((await port.pull(ref)).decision, ExternalDecision.Pending);
  port.approve(ref.externalId); // a human approves externally
  equal((await port.pull(ref)).decision, ExternalDecision.Approved);
  await port.merge(ref);
  ok(port.isMerged(ref.externalId));
});

test("fake external port: requestChanges flows the external bounce back", async () => {
  const port = createFakeExternalPort(ExternalSystem.Jira, () => 0);
  const ref = await port.project(changeSet(), aStage);
  port.requestChanges(ref.externalId);
  equal((await port.pull(ref)).decision, ExternalDecision.ChangesRequested);
});

test("reconciliation: ChangeSet phase maps into the canonical WorkItemState", () => {
  equal(workItemStateForChangeSet(ChangeSetPhase.InReview), WorkItemState.Review);
  equal(workItemStateForChangeSet(ChangeSetPhase.ChangesRequested), WorkItemState.InProgress);
  equal(workItemStateForChangeSet(ChangeSetPhase.Applied), WorkItemState.Done);
});

test("reconciliation: external systems see coarse states; Jira shows In Review / Done", () => {
  equal(externalStateForChangeSet(ExternalSystem.Jira, ChangeSetPhase.InReview), "In Review");
  equal(externalStateForChangeSet(ExternalSystem.Jira, ChangeSetPhase.Applied), "Done");
  equal(externalStateForChangeSet(ExternalSystem.GitHub, ChangeSetPhase.Applied), "merged");
  equal(externalStateForChangeSet(ExternalSystem.GitHub, ChangeSetPhase.InReview), "open");
});
