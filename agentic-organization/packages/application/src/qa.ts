/**
 * QA standing department (WORK_OS_OVERHAUL §C3). QA continuously: derives test
 * scenarios off approved BRDs, executes them through a TestExecutor port
 * (computer-use / browser-automation / API / manual), records every run with
 * evidence, detects regressions + failed features, and opens defects for
 * failures — the feedback loop that evolves the product. Determinism computes
 * what must run + how a result is recorded; the executor drives the actual
 * test; every run + regression + defect is one org_event.
 */

import {
  OrgEventKind,
  TestCaseStatus,
  TestExecutionMode,
  TestRunOutcome,
  detectRegressions,
  failedFeatures,
  type EvidenceRef,
  type OrgEvent,
  type Regression,
  type TestCase,
  type TestRun,
} from "../../domain/src/index.ts";
import type { TestSummary } from "../../observability/src/work-batch-metrics.ts";

/** A BRD acceptance criterion — the legal SOURCE a QA scenario is derived from. */
export type BrdInput = {
  brdId: string;
  projectId: string;
  initiativeId: string;
  suiteId: string;
  authoredByHatId: string;
  acceptanceCriteria: readonly string[];
  executionMode?: TestExecutionMode;
};

/**
 * Derive test cases off a BRD: one active case per acceptance criterion, the
 * scenario phrased from the criterion. Deterministic — the BRD is the legal
 * source; QA cannot invent coverage outside it.
 */
export function deriveTestCasesFromBrd(
  brd: BrdInput,
  deps: { organizationId: string; createId: (prefix: string) => string; nowIso: () => string },
): readonly TestCase[] {
  const mode = brd.executionMode ?? TestExecutionMode.BrowserAutomation;
  return brd.acceptanceCriteria.map((criterion, i) => ({
    testCaseId: deps.createId("tc"),
    suiteId: brd.suiteId,
    organizationId: deps.organizationId,
    projectId: brd.projectId,
    initiativeId: brd.initiativeId,
    brdId: brd.brdId,
    title: `AC-${i + 1}: ${criterion}`,
    scenario: `Given the feature for "${criterion}", when QA exercises it, then it satisfies the criterion.`,
    steps: [
      { ordinal: 1, action: `set up the scenario for: ${criterion}`, expectedResult: "scenario ready" },
      { ordinal: 2, action: `exercise the behavior for: ${criterion}`, expectedResult: criterion },
    ],
    executionMode: mode,
    authoredByHatId: brd.authoredByHatId,
    status: TestCaseStatus.Active,
    createdAt: deps.nowIso(),
  }));
}

/** The execution port — the real runner is computer-use / browser / API; tests use a fake. */
export type TestExecutor = {
  execute(
    testCase: TestCase,
    ctx: { initiativeBranch: string },
  ): Promise<{ outcome: TestRunOutcome; evidence: readonly EvidenceRef[] }>;
};

/** Deterministic executor for tests + degraded mode: outcome per a supplied plan (default Passed). */
export function createDeterministicExecutor(plan: ReadonlyMap<string, TestRunOutcome>): TestExecutor {
  return {
    async execute(testCase) {
      const outcome = plan.get(testCase.testCaseId) ?? TestRunOutcome.Passed;
      return { outcome, evidence: [{ kind: "trace", ref: `trace://${testCase.testCaseId}` }] };
    },
  };
}

export type QaCycleDeps = {
  organizationId: string;
  initiativeBranch: string;
  workItemIdByTestCase: ReadonlyMap<string, string>; // a failing case → the work item to attach the defect
  cases: readonly TestCase[]; // active cases to run this cycle
  priorRuns: readonly TestRun[]; // history (for regression detection)
  executor: TestExecutor;
  qaHatId: string;
  qaAgentId: string;
  createId: (prefix: string) => string;
  nowIso: () => string;
  appendEvent: (event: OrgEvent) => Promise<void>;
  openDefect: (input: { failingTestCaseId: string; workItemId?: string; evidence: readonly EvidenceRef[] }) => Promise<{ defectId: string }>;
};

export type QaCycleReport = {
  runs: readonly TestRun[];
  regressions: readonly Regression[];
  failedFeatures: readonly string[];
  defectsOpened: number;
  summary: TestSummary;
};

function event(deps: QaCycleDeps, kind: OrgEventKind, subjectId: string, decision: string, evidenceRefs: readonly string[]): OrgEvent {
  return {
    id: deps.createId("evt"),
    kind,
    occurredAt: deps.nowIso(),
    organizationId: deps.organizationId,
    actorHatId: deps.qaHatId,
    actorAgentId: deps.qaAgentId,
    subjectId,
    decision,
    supervisorChain: [],
    evidenceRefs,
    correlationId: deps.initiativeBranch,
    causationId: deps.initiativeBranch,
    traceId: deps.initiativeBranch,
  };
}

const isFailure = (o: TestRunOutcome): boolean => o === TestRunOutcome.Failed || o === TestRunOutcome.Flaky;

/**
 * One QA cycle: run each active case, record runs, detect regressions + failed
 * features, open a defect for every fresh failure. The standing loop (W6 fires
 * it on a NATS cadence independent of feature work).
 */
export async function runQaCycle(deps: QaCycleDeps): Promise<QaCycleReport> {
  const newRuns: TestRun[] = [];
  for (const testCase of deps.cases) {
    if (testCase.status !== TestCaseStatus.Active) continue;
    const startedAt = deps.nowIso();
    const result = await deps.executor.execute(testCase, { initiativeBranch: deps.initiativeBranch });
    const run: TestRun = {
      testRunId: deps.createId("run"),
      testCaseId: testCase.testCaseId,
      suiteId: testCase.suiteId,
      organizationId: deps.organizationId,
      initiativeBranch: deps.initiativeBranch,
      executorHatId: deps.qaHatId,
      agentId: deps.qaAgentId,
      mode: testCase.executionMode,
      outcome: result.outcome,
      evidence: result.evidence,
      startedAt,
      finishedAt: deps.nowIso(),
    };
    newRuns.push(run);
    await deps.appendEvent(event(deps, OrgEventKind.TestRunRecorded, run.testRunId, `${testCase.title} → ${run.outcome}`, run.evidence.map((e) => e.ref)));
  }

  const allRuns = [...deps.priorRuns, ...newRuns];
  const regressions = detectRegressions(allRuns);
  for (const r of regressions) {
    await deps.appendEvent(event(deps, OrgEventKind.RegressionDetected, r.testCaseId, `regression: ${r.testCaseId} passed (${r.lastPassedRunId}) then failed (${r.failingRunId})`, [r.failingRunId]));
  }

  const failed = failedFeatures(deps.cases, allRuns);

  let defectsOpened = 0;
  for (const run of newRuns) {
    if (!isFailure(run.outcome)) continue;
    const wi = deps.workItemIdByTestCase.get(run.testCaseId);
    const { defectId } = await deps.openDefect({ failingTestCaseId: run.testCaseId, ...(wi !== undefined ? { workItemId: wi } : {}), evidence: run.evidence });
    defectsOpened += 1;
    await deps.appendEvent(event(deps, OrgEventKind.DefectOpened, defectId, `defect ${defectId} opened from failed test ${run.testCaseId}`, run.evidence.map((e) => e.ref)));
  }

  const failures = newRuns.filter((r) => isFailure(r.outcome)).length;
  const summary: TestSummary = {
    runs: newRuns.length,
    failures,
    regressionsOpen: regressions.length,
    defectsOpenedInTestSetup: defectsOpened,
  };

  return { runs: newRuns, regressions, failedFeatures: failed, defectsOpened, summary };
}
