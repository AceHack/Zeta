import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { OrgEventKind, TestRunOutcome, type OrgEvent, type TestRun } from "../../domain/src/index.ts";
import { deriveTestCasesFromBrd, createDeterministicExecutor, runQaCycle, type QaCycleDeps } from "../src/index.ts";

function harness(plan: Map<string, TestRunOutcome>, cases: ReturnType<typeof deriveTestCasesFromBrd>, priorRuns: readonly TestRun[] = []) {
  const events: OrgEvent[] = [];
  const defects: { failingTestCaseId: string }[] = [];
  let n = 0;
  const deps: QaCycleDeps = {
    organizationId: "org-lfg",
    initiativeBranch: "feat/x",
    workItemIdByTestCase: new Map(cases.map((c) => [c.testCaseId, `wi-${c.testCaseId}`])),
    cases,
    priorRuns,
    executor: createDeterministicExecutor(plan),
    qaHatId: "qa_verifier",
    qaAgentId: "agent-qa-1",
    createId: (p: string) => `${p}-${++n}`,
    nowIso: () => new Date(1_700_000_000_000 + n * 1000).toISOString(),
    appendEvent: async (e: OrgEvent) => void events.push(e),
    openDefect: async (input) => { defects.push(input); return { defectId: `def-${defects.length}` }; },
  };
  return { deps, events, defects };
}

test("QA derives one active test case per BRD acceptance criterion", () => {
  const cases = deriveTestCasesFromBrd(
    { brdId: "brd1", projectId: "p1", initiativeId: "i1", suiteId: "s1", authoredByHatId: "qa_verifier", acceptanceCriteria: ["login works", "logout works", "session expires"] },
    { organizationId: "org-lfg", createId: (p) => `${p}-${Math.random()}`, nowIso: () => "2026-05-30T00:00:00.000Z" },
  );
  equal(cases.length, 3);
  ok(cases.every((c) => c.brdId === "brd1" && c.status === "active"));
});

test("a standing QA cycle runs every case, records runs, and opens a defect on failure", async () => {
  const cases = deriveTestCasesFromBrd(
    { brdId: "brd1", projectId: "p1", initiativeId: "i1", suiteId: "s1", authoredByHatId: "qa_verifier", acceptanceCriteria: ["a", "b"] },
    { organizationId: "org-lfg", createId: (() => { let i = 0; return () => `tc-${++i}`; })(), nowIso: () => "2026-05-30T00:00:00.000Z" },
  );
  const plan = new Map([["tc-1", TestRunOutcome.Passed], ["tc-2", TestRunOutcome.Failed]]);
  const { deps, events, defects } = harness(plan, cases);
  const report = await runQaCycle(deps);

  equal(report.runs.length, 2);
  equal(report.defectsOpened, 1); // the failing case opened a defect
  equal(defects[0]?.failingTestCaseId, "tc-2");
  equal(report.summary.runs, 2);
  equal(report.summary.failures, 1);
  // events: 2 test_run_recorded + 1 defect_opened
  equal(events.filter((e) => e.kind === OrgEventKind.TestRunRecorded).length, 2);
  equal(events.filter((e) => e.kind === OrgEventKind.DefectOpened).length, 1);
});

test("the QA cycle detects a regression against prior runs and emits regression_detected", async () => {
  const cases = deriveTestCasesFromBrd(
    { brdId: "brd1", projectId: "p1", initiativeId: "i1", suiteId: "s1", authoredByHatId: "qa_verifier", acceptanceCriteria: ["a"] },
    { organizationId: "org-lfg", createId: (() => { let i = 0; return () => `tc-${++i}`; })(), nowIso: () => "2026-05-30T00:00:00.000Z" },
  );
  // tc-1 passed before; now it fails → regression
  const prior: TestRun[] = [{
    testRunId: "r0", testCaseId: "tc-1", suiteId: "s1", organizationId: "org-lfg", initiativeBranch: "feat/x",
    executorHatId: "qa", agentId: "a", mode: "browser_automation" as const, outcome: TestRunOutcome.Passed,
    evidence: [], startedAt: "2023-01-01T00:00:00.000Z", finishedAt: "2023-01-01T00:00:00.000Z", // before the cycle clock
  }];
  const { deps, events } = harness(new Map([["tc-1", TestRunOutcome.Failed]]), cases, prior);
  const report = await runQaCycle(deps);
  equal(report.regressions.length, 1);
  equal(report.regressions[0]?.testCaseId, "tc-1");
  equal(events.filter((e) => e.kind === OrgEventKind.RegressionDetected).length, 1);
});
