/**
 * Work-batch metrics — the rolled-up health of a work group (WORK_OS_OVERHAUL
 * §C2). A pure fold over the batch's member work items + the org_event trace
 * (+ a test-run summary supplied by the QA layer in W3). These metrics are what
 * a Lead/Director/exec sees in their scoped readout (observe-for-hat.ts) and are
 * the signal the memory KPI layer will later correlate against.
 *
 * Pure + order-independent: same inputs → same metrics.
 */

import { OrgEventKind, WorkItemState, WorkItemType, type OrgEvent, type WorkItem } from "../../domain/src/index.ts";

export type TestSummary = {
  runs: number;
  failures: number;
  regressionsOpen: number;
  defectsOpenedInTestSetup: number;
};

export type WorkBatchMetrics = {
  batchId: string;
  total: number;
  done: number;
  completionPct: number; // 0..1
  blocked: number;
  inReview: number;
  openDefects: number;
  defectsOpenedInTestSetup: number; // QA found these while authoring/setting up tests
  qaBounceBacks: number; // review → in_progress rework count (churn signal)
  testRuns: number;
  testFailures: number;
  passRate: number; // 0..1 (1 when no runs yet)
  regressionsOpen: number;
  movementScore: number; // 0..1 — fraction of work not stuck (higher = healthier)
};

const ZERO_TESTS: TestSummary = { runs: 0, failures: 0, regressionsOpen: 0, defectsOpenedInTestSetup: 0 };

export function rollUpBatchMetrics(input: {
  batchId: string;
  items: readonly WorkItem[];
  events: readonly OrgEvent[];
  tests?: TestSummary;
}): WorkBatchMetrics {
  const { batchId, items, events } = input;
  const tests = input.tests ?? ZERO_TESTS;
  const itemIds = new Set(items.map((i) => i.workItemId));

  const total = items.length;
  const done = items.filter((i) => i.state === WorkItemState.Done).length;
  const blocked = items.filter((i) => i.state === WorkItemState.Blocked).length;
  const inReview = items.filter((i) => i.state === WorkItemState.Review).length;
  const openDefects = items.filter((i) => i.workItemType === WorkItemType.Defect && i.state !== WorkItemState.Done).length;

  // QA bounce-back = a work-item transition review → in_progress (rework) for a batch member.
  const qaBounceBacks = events.filter(
    (e) =>
      e.kind === OrgEventKind.WorkItemTransition &&
      itemIds.has(e.subjectId) &&
      e.fromState === WorkItemState.Review &&
      e.toState === WorkItemState.InProgress,
  ).length;

  const completionPct = total === 0 ? 1 : done / total;
  const passRate = tests.runs === 0 ? 1 : (tests.runs - tests.failures) / tests.runs;
  const movementScore = total === 0 ? 1 : Math.max(0, 1 - blocked / total);

  return {
    batchId,
    total,
    done,
    completionPct,
    blocked,
    inReview,
    openDefects,
    defectsOpenedInTestSetup: tests.defectsOpenedInTestSetup,
    qaBounceBacks,
    testRuns: tests.runs,
    testFailures: tests.failures,
    passRate,
    regressionsOpen: tests.regressionsOpen,
    movementScore,
  };
}

export type ScopeMetrics = {
  batchCount: number;
  total: number;
  done: number;
  completionPct: number;
  blocked: number;
  openDefects: number;
  qaBounceBacks: number;
  regressionsOpen: number;
  movementScore: number;
};

/** Aggregate batch metrics into a scope-level rollup (department / org view). */
export function aggregateMetrics(list: readonly WorkBatchMetrics[]): ScopeMetrics {
  const sum = (pick: (m: WorkBatchMetrics) => number): number => list.reduce((acc, m) => acc + pick(m), 0);
  const total = sum((m) => m.total);
  const done = sum((m) => m.done);
  const blocked = sum((m) => m.blocked);
  return {
    batchCount: list.length,
    total,
    done,
    completionPct: total === 0 ? 1 : done / total,
    blocked,
    openDefects: sum((m) => m.openDefects),
    qaBounceBacks: sum((m) => m.qaBounceBacks),
    regressionsOpen: sum((m) => m.regressionsOpen),
    movementScore: total === 0 ? 1 : Math.max(0, 1 - blocked / total),
  };
}
