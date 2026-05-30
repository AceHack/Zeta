import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  TestCaseStatus,
  TestExecutionMode,
  TestRunOutcome,
  detectRegressions,
  failedFeatures,
  type TestCase,
  type TestRun,
} from "../src/index.ts";

function tc(id: string): TestCase {
  return {
    testCaseId: id, suiteId: "s1", organizationId: "org-lfg", projectId: "p1", initiativeId: "i1",
    brdId: "brd1", title: id, scenario: "x", steps: [], executionMode: TestExecutionMode.BrowserAutomation,
    authoredByHatId: "qa_verifier", status: TestCaseStatus.Active, createdAt: "2026-05-30T00:00:00.000Z",
  };
}
function run(id: string, testCaseId: string, outcome: TestRunOutcome, finishedAt: string): TestRun {
  return {
    testRunId: id, testCaseId, suiteId: "s1", organizationId: "org-lfg", initiativeBranch: "feat/x",
    executorHatId: "browser_automation_qa", agentId: "a1", mode: TestExecutionMode.BrowserAutomation,
    outcome, evidence: [], startedAt: finishedAt, finishedAt,
  };
}

test("a regression is a previously-passing case whose latest run failed", () => {
  const history = [
    run("r1", "tc1", TestRunOutcome.Passed, "2026-05-30T01:00:00.000Z"),
    run("r2", "tc1", TestRunOutcome.Passed, "2026-05-30T02:00:00.000Z"),
    run("r3", "tc1", TestRunOutcome.Failed, "2026-05-30T03:00:00.000Z"), // regressed
  ];
  const regs = detectRegressions(history);
  equal(regs.length, 1);
  equal(regs[0]?.testCaseId, "tc1");
  equal(regs[0]?.lastPassedRunId, "r2");
  equal(regs[0]?.failingRunId, "r3");
});

test("a case that always failed is NOT a regression (it's a failed feature)", () => {
  const history = [
    run("r1", "tc2", TestRunOutcome.Failed, "2026-05-30T01:00:00.000Z"),
    run("r2", "tc2", TestRunOutcome.Failed, "2026-05-30T02:00:00.000Z"),
  ];
  equal(detectRegressions(history).length, 0);
  deepEqual([...failedFeatures([tc("tc2")], history)], ["tc2"]);
});

test("a case that failed then passed again is NOT a regression", () => {
  const history = [
    run("r1", "tc3", TestRunOutcome.Passed, "2026-05-30T01:00:00.000Z"),
    run("r2", "tc3", TestRunOutcome.Failed, "2026-05-30T02:00:00.000Z"),
    run("r3", "tc3", TestRunOutcome.Passed, "2026-05-30T03:00:00.000Z"), // recovered
  ];
  equal(detectRegressions(history).length, 0);
  equal(failedFeatures([tc("tc3")], history).length, 0);
});

test("detection is order-independent (sorts by finishedAt internally)", () => {
  const shuffled = [
    run("r3", "tc1", TestRunOutcome.Failed, "2026-05-30T03:00:00.000Z"),
    run("r1", "tc1", TestRunOutcome.Passed, "2026-05-30T01:00:00.000Z"),
    run("r2", "tc1", TestRunOutcome.Passed, "2026-05-30T02:00:00.000Z"),
  ];
  ok(detectRegressions(shuffled).length === 1);
});
