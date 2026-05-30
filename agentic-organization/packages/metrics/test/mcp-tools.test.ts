import { equal, ok } from "node:assert/strict";
import { test } from "node:test";
import {
  METRICS_TOOL_DESCRIPTORS,
  MetricsToolName,
  dispatchMetricsTool,
} from "../src/mcp-tools.ts";
import { ReviewDimension, ReviewSeverity, ReviewStance } from "../src/review-board.ts";

test("descriptors advertise both tools", () => {
  const names = METRICS_TOOL_DESCRIPTORS.map((d) => d.name);
  ok(names.includes(MetricsToolName.AnalyzeSource));
  ok(names.includes(MetricsToolName.RunReviewBoard));
});

test("dispatch analyze_source returns a metrics report", () => {
  const result = dispatchMetricsTool(MetricsToolName.AnalyzeSource, { filePath: "x.ts", source: "function a(){return 1;}\n" });
  equal(result.outcome, "ok");
  if (result.outcome !== "ok" || result.tool !== MetricsToolName.AnalyzeSource) return;
  equal(result.report.filePath, "x.ts");
});

test("dispatch run_review_board routes through the board", () => {
  const finding = { findingId: "F1", dimension: ReviewDimension.Correctness, severity: ReviewSeverity.Major, subject: "x", comment: "c" };
  const mk = (a: string) => ({ reviewerAgentId: a, hatAssignmentId: `${a}-h`, findingId: "F1", stance: ReviewStance.Agree, rationale: "" });
  const result = dispatchMetricsTool(MetricsToolName.RunReviewBoard, { findings: [finding], votes: [mk("a"), mk("b"), mk("c")] });
  equal(result.outcome, "ok");
  if (result.outcome !== "ok" || result.tool !== MetricsToolName.RunReviewBoard) return;
  equal(result.board.adopted.length, 1);
});

test("unknown tool yields feedback", () => {
  const result = dispatchMetricsTool("nope", {});
  equal(result.outcome, "feedback");
  if (result.outcome !== "feedback") return;
  equal(result.feedback.reason, "unknown_tool");
});

test("bad args yield feedback", () => {
  const result = dispatchMetricsTool(MetricsToolName.AnalyzeSource, { filePath: 123 });
  equal(result.outcome, "feedback");
});
