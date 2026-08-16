/**
 * MCP tool INTERFACE for the metrics + review subsystem.
 *
 * This module defines the tool descriptors and a typed dispatch surface so the
 * quantitative metrics and the qualitative review board can be exposed to agents
 * as MCP tools. It does NOT host an MCP server — the actual transport/hosting is
 * a // TODO at the bottom. Everything here is pure and testable: given a tool
 * name + args, it routes to the in-process handler and returns a typed result.
 *
 * Each tool is an explicit descriptor (name + description + input keys), and the
 * dispatch result is a discriminated union so an unknown-tool result is never
 * confused with a handler result (IMPLICIT-NOT-EXPLICIT is class error).
 */

import { analyzeSource, type CodeMetricsReport, type MetricThresholds } from "./code-metrics.ts";
import {
  evaluateReviewBoard,
  type CandidateFinding,
  type ReviewBoardOutcome,
  type ReviewerVote,
} from "./review-board.ts";

export const MetricsToolName = {
  AnalyzeSource: "analyze_source",
  RunReviewBoard: "run_review_board",
} as const;
export type MetricsToolName = (typeof MetricsToolName)[keyof typeof MetricsToolName];

export type McpToolDescriptor = {
  name: MetricsToolName;
  description: string;
  inputKeys: readonly string[];
};

/** The catalog an MCP server would advertise via list_tools. */
export const METRICS_TOOL_DESCRIPTORS: readonly McpToolDescriptor[] = [
  {
    name: MetricsToolName.AnalyzeSource,
    description: "Gather quantitative code metrics (longest function/class, file length, max nesting) for one source file and flag god-object risks.",
    inputKeys: ["filePath", "source", "thresholds?"],
  },
  {
    name: MetricsToolName.RunReviewBoard,
    description: "Run the >=3-agent qualitative review board over candidate findings and reviewer votes. Aggregates by union (k=1) on a recall purpose: every finding any reviewer raises is adopted, with the agreement count published as a confidence annotation rather than spent as a gate. `quorum` is the attendance floor only.",
    inputKeys: ["findings", "votes", "quorum?"],
  },
];

export type AnalyzeSourceArgs = {
  filePath: string;
  source: string;
  thresholds?: MetricThresholds;
};

export type RunReviewBoardArgs = {
  findings: readonly CandidateFinding[];
  votes: readonly ReviewerVote[];
  quorum?: number;
};

/** Result of dispatching a metrics tool call. */
export type MetricsToolResult =
  | { outcome: "ok"; tool: typeof MetricsToolName.AnalyzeSource; report: CodeMetricsReport }
  | { outcome: "ok"; tool: typeof MetricsToolName.RunReviewBoard; board: ReviewBoardOutcome }
  | { outcome: "feedback"; feedback: { reason: string; message: string } };

/**
 * In-process dispatch — the handler an MCP server's call_tool would delegate to.
 * Pure: no transport, no I/O. The server adapter (TODO) just unwraps MCP request
 * shapes into these typed args and re-wraps the result.
 */
export function dispatchMetricsTool(name: string, args: unknown): MetricsToolResult {
  if (name === MetricsToolName.AnalyzeSource) {
    const a = args as AnalyzeSourceArgs;
    if (typeof a?.filePath !== "string" || typeof a?.source !== "string") {
      return { outcome: "feedback", feedback: { reason: "bad_args", message: "analyze_source requires filePath and source strings" } };
    }
    const report = a.thresholds === undefined ? analyzeSource(a.filePath, a.source) : analyzeSource(a.filePath, a.source, a.thresholds);
    return { outcome: "ok", tool: MetricsToolName.AnalyzeSource, report };
  }

  if (name === MetricsToolName.RunReviewBoard) {
    const a = args as RunReviewBoardArgs;
    if (!Array.isArray(a?.findings) || !Array.isArray(a?.votes)) {
      return { outcome: "feedback", feedback: { reason: "bad_args", message: "run_review_board requires findings[] and votes[]" } };
    }
    const result = a.quorum === undefined
      ? evaluateReviewBoard({ findings: a.findings, votes: a.votes })
      : evaluateReviewBoard({ findings: a.findings, votes: a.votes, quorum: a.quorum });
    if (result.outcome === "feedback") {
      return { outcome: "feedback", feedback: result.feedback };
    }
    return { outcome: "ok", tool: MetricsToolName.RunReviewBoard, board: result.board };
  }

  return { outcome: "feedback", feedback: { reason: "unknown_tool", message: `no metrics tool named '${name}'` } };
}

// TODO(mcp-host): wrap dispatchMetricsTool in an actual MCP server.
//   - advertise METRICS_TOOL_DESCRIPTORS via the list_tools handler
//   - on call_tool(name, arguments): call dispatchMetricsTool(name, arguments)
//     and map MetricsToolResult -> MCP content blocks (text/JSON)
//   - run over stdio or HTTP transport per the cluster MCP gateway
//   - enforce hat-token preflight (validate_hat_token) before dispatch, per
//     V0_POLICY_AND_RUNTIME_BOUNDARIES.md — metrics reads are low-risk but the
//     review board publishes comments, which is a scoped authority.
