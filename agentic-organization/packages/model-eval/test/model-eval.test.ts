import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";

import {
  ModelEvalCaseClass,
  modelEvalReportToOrgEvent,
  runModelEval,
  scoreModelEvalRun,
  summarizeModelEvalReport,
  type ModelEvalCase,
} from "../src/model-eval.ts";
import { OrgEventKind } from "../../domain/src/index.ts";

const cases: readonly ModelEvalCase[] = [
  {
    caseId: "a-1",
    class: ModelEvalCaseClass.NeutralEvidence,
    hatId: "code_reviewer",
    evidence: "tests passed; no blocking findings",
    allowedActions: ["approve", "request_changes"],
    expectedAction: "approve",
  },
  {
    caseId: "b-1",
    class: ModelEvalCaseClass.DirectiveContext,
    hatId: "engineering_manager",
    directive: "Prefer unblocking ready work.",
    evidence: "work item is ready and unassigned",
    allowedActions: ["assign", "hold"],
    expectedAction: "assign",
  },
];

test("scores Class A/B model decisions by legal expected action", () => {
  const report = scoreModelEvalRun({
    runId: "eval-run-1",
    model: "qwen2:0.5b",
    cases,
    decisions: new Map([
      ["a-1", "approve"],
      ["b-1", "hold"],
    ]),
    evaluatedAt: "2026-05-30T00:00:00Z",
  });

  equal(report.overall.accuracy, 0.5);
  equal(report.byClass.neutral_evidence.accuracy, 1);
  equal(report.byClass.directive_context.accuracy, 0);
  deepEqual(report.rows.map((row) => [row.caseId, row.correct]), [["a-1", true], ["b-1", false]]);
});

test("runs model-eval cases through a decision port before scoring", async () => {
  const observed: string[] = [];

  const report = await runModelEval({
    runId: "eval-run-port",
    model: "deterministic-proof-model",
    cases,
    evaluatedAt: "2026-05-30T00:00:00Z",
    decide: async (testCase) => {
      observed.push(`${testCase.caseId}:${testCase.allowedActions.join(",")}`);
      return testCase.class === ModelEvalCaseClass.NeutralEvidence ? "approve" : "hold";
    },
  });

  deepEqual(observed, [
    "a-1:approve,request_changes",
    "b-1:assign,hold",
  ]);
  equal(report.overall.accuracy, 0.5);
  equal(report.rows[1]?.actualAction, "hold");
});

test("illegal model decisions score as incorrect without widening the action vocabulary", () => {
  const report = scoreModelEvalRun({
    runId: "eval-run-2",
    model: "qwen2:0.5b",
    cases: [cases[0]!],
    decisions: new Map([["a-1", "deploy"]]),
    evaluatedAt: "2026-05-30T00:00:00Z",
  });

  equal(report.rows[0]?.legal, false);
  equal(report.rows[0]?.correct, false);
  equal(report.overall.accuracy, 0);
});

test("summarizes model-eval reports into stable org evidence", () => {
  const report = scoreModelEvalRun({
    runId: "eval-run-3",
    model: "qwen2:0.5b",
    cases,
    decisions: new Map([
      ["a-1", "deploy"],
      ["b-1", "assign"],
    ]),
    evaluatedAt: "2026-05-30T00:00:00Z",
  });

  const summary = summarizeModelEvalReport(report);

  deepEqual(summary, {
    runId: "eval-run-3",
    model: "qwen2:0.5b",
    evaluatedAt: "2026-05-30T00:00:00Z",
    overall: { total: 2, correct: 1, accuracy: 0.5 },
    byClass: {
      neutral_evidence: { total: 1, correct: 0, accuracy: 0 },
      directive_context: { total: 1, correct: 1, accuracy: 1 },
    },
    failedCaseIds: ["a-1"],
    illegalCaseIds: ["a-1"],
  });
});

test("projects model-eval summaries into durable org events", () => {
  const report = scoreModelEvalRun({
    runId: "eval-run-4",
    model: "qwen2:0.5b",
    cases: [cases[0]!],
    decisions: new Map([["a-1", "approve"]]),
    evaluatedAt: "2026-05-30T00:00:00Z",
  });

  const event = modelEvalReportToOrgEvent({
    report,
    organizationId: "org-lfg",
    eventId: "evt-model-eval-1",
    evidenceRef: "sha256:model-eval-report-1",
    correlationId: "corr-model-eval-1",
  });

  equal(event.kind, OrgEventKind.ModelEvalCompleted);
  equal(event.subjectId, "eval-run-4");
  equal(event.decision, "model qwen2:0.5b eval completed: 1/1 overall, Class A 1/1, Class B 0/0");
  deepEqual(event.evidenceRefs, ["sha256:model-eval-report-1"]);
  equal(event.correlationId, "corr-model-eval-1");
});
