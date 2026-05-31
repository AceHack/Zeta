# G1 Release Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a release-queue cadence lane that batches approved ChangeSets, evaluates the batched stack once, applies green batches, and bisects red batches to isolate failing changes.

**Architecture:** Keep release orchestration pure in `packages/application/src/release-queue.ts`; the worker lane adapts the planner to Cockroach-backed `ChangeSetStore` reads/writes and existing change-control kernel events. Approved ChangeSets become the durable queue input; the existing change-control lane no longer auto-applies approved ChangeSets.

**Tech Stack:** TypeScript, native Node test runner, existing change-control kernel, existing Cockroach ChangeSet store, worker cadence lanes, KIND proof runner.

---

## Task 1: Pure Release Queue Planner

**Files:**

- Create: `packages/application/src/release-queue.ts`
- Create: `packages/application/test/release-queue.test.ts`
- Modify: `packages/application/src/index.ts`

- [ ] **Step 1: Write failing planner tests**

```ts
test("release queue applies a green approved batch in priority order", () => {
  const result = planReleaseQueue({
    approvedChangeSets: [changeSet("old", { updatedAt: "2026-01-01T00:00:00.000Z" }), changeSet("new")],
    maxBatchSize: 2,
    evaluateBatch: () => ({ green: true, evidenceRefs: ["test-run:green"] }),
  });

  deepEqual(result.actions.map((action) => action.changeSetId), ["old", "new"]);
  ok(result.actions.every((action) => action.kind === ReleaseQueueActionKind.Apply));
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- --test-name-pattern="release queue"`

Expected: fail because `release-queue.ts` and `planReleaseQueue` do not exist.

- [ ] **Step 3: Implement minimal planner**

Add House-DU action kinds:

```ts
export const ReleaseQueueActionKind = {
  Apply: "apply",
  Requeue: "requeue",
  RequestChanges: "request_changes",
} as const;
```

The first green planner only sorts approved ChangeSets by retry count then age, takes `maxBatchSize`, and returns `Apply` actions with the batch evidence refs.

- [ ] **Step 4: Add RED bisect test**

```ts
test("release queue bisects a red batch and requests changes only for the culprit", () => {
  const result = planReleaseQueue({
    approvedChangeSets: [changeSet("a"), changeSet("b"), changeSet("c")],
    maxBatchSize: 3,
    evaluateBatch: (batch) => ({
      green: !batch.some((cs) => cs.changeSetId === "b"),
      evidenceRefs: [`batch:${batch.map((cs) => cs.changeSetId).join("+")}`],
    }),
  });

  deepEqual(result.actions.map((action) => [action.kind, action.changeSetId]), [
    [ReleaseQueueActionKind.Apply, "a"],
    [ReleaseQueueActionKind.RequestChanges, "b"],
    [ReleaseQueueActionKind.Apply, "c"],
  ]);
});
```

- [ ] **Step 5: Implement recursive bisect**

For a red batch:

- If batch length is 1, emit `RequestChanges`.
- Otherwise evaluate left and right halves recursively.
- Green sub-batches emit `Apply` actions for every member.

- [ ] **Step 6: Export planner types**

Add `release-queue.ts` exports to `packages/application/src/index.ts`.

### Task 2: Worker Lane

**Files:**

- Modify: `apps/workers/src/org-cadence-lanes.ts`
- Modify: `apps/workers/src/org-cadence-composition.ts`
- Modify: `apps/workers/test/org-cadence-lanes.test.ts`

- [ ] **Step 1: Write failing lane tests**

Add tests proving:

- the release-queue lane reads `ChangeSetPhase.Approved`, applies a green batch through `applyChangeSet`, persists applied ChangeSets, and appends events;
- a red single-change batch moves that ChangeSet to `changes_requested` and leaves green peers applied;
- read/write errors degrade the lane instead of throwing.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- --test-name-pattern="release-queue"`

Expected: fail because `createReleaseQueueCadenceLane` does not exist.

- [ ] **Step 3: Implement the lane**

Add `createReleaseQueueCadenceLane` with dependencies:

- `reader.listByOrgPhase(organizationId, ChangeSetPhase.Approved)`
- `writer.upsert(changeSet)`
- `pipelineFor(changeSet)`
- `appendEvent(event)`
- `evaluateBatch(batch)`.

For each planner action:

- `Apply`: call existing `applyChangeSet` and persist/emit its result.
- `RequestChanges`: persist the ChangeSet as `changes_requested` and append a `changes_requested` event carrying release-queue evidence.
- `Requeue`: do not mutate.

- [ ] **Step 4: Stop change-control auto-apply**

Remove the approved→applied block from `createChangeControlCadenceLane`. Approved ChangeSets now wait for the release queue.

- [ ] **Step 5: Compose the lane**

Add `releaseQueueMs` to `OrgCadenceIntervals`, default `30_000`, compose the lane in `composeOrgCadenceLoops`, and include it in the worker `Promise.all`.

### Task 3: KIND Proof and Documentation

**Files:**

- Create: `deploy/run-release-queue.ts`
- Modify: `docs/ORCHESTRATION_MOAT_ROADMAP.md`
- Modify: `docs/NORTH_STAR_ALIGNMENT_CHECKPOINT.md`

- [ ] **Step 1: Write live proof runner**

The proof seeds three approved ChangeSets in live Cockroach:

- one green before a red culprit;
- one red culprit;
- one green after the culprit.

It runs the release-queue lane once with a deterministic evaluator, then asserts:

- two ChangeSets are `applied`;
- one ChangeSet is `changes_requested`;
- the ledger contains two `change_set_applied` events and one `changes_requested` event;
- output JSON includes `"PROOF": "PASS"`.

- [ ] **Step 2: Verify locally**

Run:

- `npm run typecheck`
- `npm test`

- [ ] **Step 3: Prove in KIND**

Rebuild worker image from HEAD, load into `agentic-org`, roll out deployment, verify fresh worker boot has the release-queue lane and `failureCount:0`, then run `deploy/run-release-queue.ts` through a Cockroach port-forward and require `PROOF: PASS`.

- [ ] **Step 4: Review and commit**

Request subagent review on the G1 diff, fix high-confidence findings with regression tests, rerun verification and KIND proof, update checkpoint docs with exact image hash/pod/proof id, then commit with `Co-Authored-By: Codex <noreply@openai.com>`.

## Self-Review

- Spec coverage: G1 roadmap requirements map to Task 1 planner, Task 2 lane/composition, and Task 3 KIND proof/docs.
- Placeholder scan: no TBD/TODO/implement-later placeholders.
- Type consistency: planner action names, lane factory name, and interval key are stable across tasks.
