/**
 * Test-case management + test runs + regression detection (WORK_OS_OVERHAUL §C3).
 *
 * QA is a STANDING department, not a gate: it derives work scenarios off approved
 * BRDs, authors test cases, executes them (computer-use / browser-automation /
 * API / manual), records every run with evidence, and observes regressions
 * (a previously-passing case now failing) and failed features (a case that has
 * never passed). Failures open defects; the loop re-tests after the fix (W4).
 *
 * Everything here is pure domain. The actual execution is a port (qa.ts).
 */

/** How a test case is executed — the goal's "computer use / browser automation / manual". */
export const TestExecutionMode = {
  ComputerUse: "computer_use",
  BrowserAutomation: "browser_automation",
  Api: "api",
  Manual: "manual",
} as const;
export type TestExecutionMode = (typeof TestExecutionMode)[keyof typeof TestExecutionMode];

export const TestCaseStatus = {
  Draft: "draft",
  Active: "active",
  Retired: "retired",
} as const;
export type TestCaseStatus = (typeof TestCaseStatus)[keyof typeof TestCaseStatus];

export type TestStep = {
  ordinal: number;
  action: string;
  expectedResult: string;
};

export type TestCase = {
  testCaseId: string;
  suiteId: string;
  organizationId: string;
  projectId: string;
  initiativeId: string;
  brdId: string; // the BRD / acceptance criterion this case covers
  title: string;
  scenario: string; // a work-scenario derived off the BRD
  steps: readonly TestStep[];
  executionMode: TestExecutionMode;
  authoredByHatId: string; // a QA hat
  status: TestCaseStatus;
  createdAt: string;
};

export const TestRunOutcome = {
  Passed: "passed",
  Failed: "failed",
  Blocked: "blocked",
  Flaky: "flaky",
} as const;
export type TestRunOutcome = (typeof TestRunOutcome)[keyof typeof TestRunOutcome];

export type EvidenceRef = {
  kind: "screenshot" | "trace" | "log" | "repro";
  ref: string;
};

export type TestRun = {
  testRunId: string;
  testCaseId: string;
  suiteId: string;
  organizationId: string;
  initiativeBranch: string; // QA validates the branch, not main
  executorHatId: string;
  agentId: string;
  mode: TestExecutionMode;
  outcome: TestRunOutcome;
  evidence: readonly EvidenceRef[];
  startedAt: string;
  finishedAt: string;
};

/** A previously-passing test case whose latest run failed — an observed regression. */
export type Regression = {
  testCaseId: string;
  lastPassedRunId: string;
  failingRunId: string;
  detectedAt: string;
};

const isFail = (o: TestRunOutcome): boolean => o === TestRunOutcome.Failed || o === TestRunOutcome.Flaky;

/**
 * Detect regressions over run history: group by test case, order by finishedAt;
 * a regression exists when the LATEST run is a failure but some PRIOR run passed.
 * Pure + order-independent (sorts internally).
 */
export function detectRegressions(history: readonly TestRun[]): readonly Regression[] {
  const byCase = new Map<string, TestRun[]>();
  for (const run of history) {
    const list = byCase.get(run.testCaseId) ?? [];
    list.push(run);
    byCase.set(run.testCaseId, list);
  }
  const out: Regression[] = [];
  for (const [testCaseId, runs] of byCase) {
    const ordered = [...runs].sort((a, b) => Date.parse(a.finishedAt) - Date.parse(b.finishedAt));
    const latest = ordered[ordered.length - 1]!;
    if (!isFail(latest.outcome)) continue;
    // find the most recent prior PASS
    let lastPassed: TestRun | undefined;
    for (let i = ordered.length - 2; i >= 0; i -= 1) {
      if (ordered[i]!.outcome === TestRunOutcome.Passed) {
        lastPassed = ordered[i];
        break;
      }
    }
    if (lastPassed !== undefined) {
      out.push({ testCaseId, lastPassedRunId: lastPassed.testRunId, failingRunId: latest.testRunId, detectedAt: latest.finishedAt });
    }
  }
  return out;
}

/**
 * Failed features: ACTIVE test cases that have ≥1 run and have NEVER passed — a
 * new feature that does not yet meet its BRD scenario.
 */
export function failedFeatures(cases: readonly TestCase[], history: readonly TestRun[]): readonly string[] {
  const runsByCase = new Map<string, TestRun[]>();
  for (const run of history) {
    const list = runsByCase.get(run.testCaseId) ?? [];
    list.push(run);
    runsByCase.set(run.testCaseId, list);
  }
  return cases
    .filter((c) => c.status === TestCaseStatus.Active)
    .filter((c) => {
      const runs = runsByCase.get(c.testCaseId) ?? [];
      return runs.length > 0 && !runs.some((r) => r.outcome === TestRunOutcome.Passed);
    })
    .map((c) => c.testCaseId);
}
