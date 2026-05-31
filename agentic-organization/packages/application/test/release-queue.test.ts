import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  ChangeArtifactKind,
  ChangeSetPhase,
  type ChangeSet,
} from "../../domain/src/index.ts";
import {
  ReleaseQueueActionKind,
  ReleaseQueueState,
  planReleaseQueue,
} from "../src/release-queue.ts";

function changeSet(
  changeSetId: string,
  input: Partial<ChangeSet> = {},
): ChangeSet {
  return {
    changeSetId,
    organizationId: "org-release",
    workItemId: `work-${changeSetId}`,
    proposerHatId: "implementation_engineer",
    title: `Change ${changeSetId}`,
    targetRef: `refs/heads/${changeSetId}`,
    phase: ChangeSetPhase.Approved,
    pipelineId: "internal-only",
    currentStageIndex: 0,
    artifacts: [{
      kind: ChangeArtifactKind.CodeDiff,
      path: `src/${changeSetId}.ts`,
      diff: "+ok",
      language: "typescript",
    }],
    projections: [],
    revision: 1,
    openedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...input,
  };
}

test("release queue applies a green approved batch in priority order", () => {
  const result = planReleaseQueue({
    approvedChangeSets: [
      changeSet("new", { updatedAt: "2026-01-02T00:00:00.000Z" }),
      changeSet("old", { updatedAt: "2026-01-01T00:00:00.000Z" }),
    ],
    maxBatchSize: 2,
    evaluateBatch: () => ({ green: true, evidenceRefs: ["test-run:green"] }),
  });

  equal(result.state, ReleaseQueueState.BatchGreen);
  deepEqual(result.actions.map((action) => action.changeSetId), ["old", "new"]);
  ok(result.actions.every((action) => action.kind === ReleaseQueueActionKind.Apply));
  deepEqual(result.actions.flatMap((action) => action.evidenceRefs), ["test-run:green", "test-run:green"]);
});

test("release queue prioritizes retry pressure before age", () => {
  const result = planReleaseQueue({
    approvedChangeSets: [
      changeSet("older", { revision: 1, updatedAt: "2026-01-01T00:00:00.000Z" }),
      changeSet("retried", { revision: 3, updatedAt: "2026-01-03T00:00:00.000Z" }),
      changeSet("newer", { revision: 1, updatedAt: "2026-01-02T00:00:00.000Z" }),
    ],
    maxBatchSize: 2,
    evaluateBatch: () => ({ green: true, evidenceRefs: ["test-run:green"] }),
  });

  deepEqual(result.batch.map((cs) => cs.changeSetId), ["retried", "older"]);
});

test("release queue bisects a red batch and requests changes only for the culprit", () => {
  const result = planReleaseQueue({
    approvedChangeSets: [changeSet("a"), changeSet("b"), changeSet("c")],
    maxBatchSize: 3,
    evaluateBatch: (batch) => ({
      green: !batch.some((cs) => cs.changeSetId === "b"),
      evidenceRefs: [`batch:${batch.map((cs) => cs.changeSetId).join("+")}`],
    }),
  });

  equal(result.state, ReleaseQueueState.BatchBisected);
  deepEqual(result.actions.map((action) => [action.kind, action.changeSetId]), [
    [ReleaseQueueActionKind.Apply, "a"],
    [ReleaseQueueActionKind.RequestChanges, "b"],
    [ReleaseQueueActionKind.Apply, "c"],
  ]);
});

test("release queue does not apply both halves of an interaction-red stack", () => {
  const result = planReleaseQueue({
    approvedChangeSets: [changeSet("a"), changeSet("b")],
    maxBatchSize: 2,
    evaluateBatch: (batch) => ({
      green: batch.map((cs) => cs.changeSetId).join("+") !== "a+b",
      evidenceRefs: [`batch:${batch.map((cs) => cs.changeSetId).join("+")}`],
    }),
  });

  equal(result.state, ReleaseQueueState.BatchBisected);
  deepEqual(result.actions.map((action) => [action.kind, action.changeSetId]), [
    [ReleaseQueueActionKind.Apply, "a"],
    [ReleaseQueueActionKind.RequestChanges, "b"],
  ]);
});

test("release queue reuses a known red result instead of reevaluating it", () => {
  let wholeBatchEvaluations = 0;
  const result = planReleaseQueue({
    approvedChangeSets: [changeSet("a"), changeSet("b")],
    maxBatchSize: 2,
    evaluateBatch: (batch) => {
      const ids = batch.map((cs) => cs.changeSetId).join("+");
      if (ids === "a+b") wholeBatchEvaluations += 1;
      return {
        green: ids !== "a+b",
        evidenceRefs: [`batch:${ids}`],
      };
    },
  });

  equal(wholeBatchEvaluations, 1);
  deepEqual(result.actions.map((action) => [action.kind, action.changeSetId]), [
    [ReleaseQueueActionKind.Apply, "a"],
    [ReleaseQueueActionKind.RequestChanges, "b"],
  ]);
});

test("release queue idles when no approved change sets are ready", () => {
  const result = planReleaseQueue({
    approvedChangeSets: [],
    maxBatchSize: 4,
    evaluateBatch: () => ({ green: true, evidenceRefs: [] }),
  });

  equal(result.state, ReleaseQueueState.Idle);
  deepEqual(result.actions, []);
});
