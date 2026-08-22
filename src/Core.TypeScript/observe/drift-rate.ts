/**
 * drift-rate.ts — track red/green CI drift over sliding windows.
 *
 * The society doesn't block on CI failures. Instead it measures:
 * - What fraction of recent runs are red vs green?
 * - Is the ratio improving or worsening over time?
 * - Which workflows drift most? (the weak links)
 *
 * This is the SDV model (Static Driver Verifier): you earn the right to be
 * a gate by driving your false-alarm rate below a threshold. Until then,
 * you're a measurement, not a blocker.
 *
 * ## Forge-agnostic design
 *
 * Reads from `data/ci-runs.jsonl` — an append-only log of CI run outcomes.
 * Any forge host (GitHub, GitLab, Codeberg, decentralized git) can produce
 * this file in the same format. The tracker doesn't know or care which forge
 * generated the data.
 *
 * ## File format: data/ci-runs.jsonl
 *
 * One JSON object per line:
 *   { workflow: string, conclusion: "success"|"failure"|"cancelled", at: string, runId: string }
 *
 * The heartbeat workflow (or any forge adapter) appends to this file.
 * This module reads it and computes drift metrics.
 */

import { readFileSync } from "node:fs";

// ═══ Types ════════════════════════════════════════════════════════════════════

export interface CIRun {
  readonly workflow: string;
  readonly conclusion: "success" | "failure" | "cancelled";
  readonly at: string;
  readonly runId?: string;
}

export interface DriftWindow {
  /** Window label (e.g., "24h", "7d"). */
  readonly label: string;
  /** Total runs in the window. */
  readonly total: number;
  /** Successful runs. */
  readonly green: number;
  /** Failed runs. */
  readonly red: number;
  /** Cancelled (not counted toward the ratio). */
  readonly cancelled: number;
  /** Green ratio: green / (green + red). NaN if no decisive runs. */
  readonly greenRatio: number;
  /** Red ratio: red / (green + red). */
  readonly redRatio: number;
}

export interface WorkflowDrift {
  readonly workflow: string;
  readonly total: number;
  readonly green: number;
  readonly red: number;
  readonly greenRatio: number;
  /** Is this workflow trending better or worse? */
  readonly trend: "improving" | "stable" | "worsening";
}

export interface DriftSnapshot {
  /** Computed at this time. */
  readonly computedAt: string;
  /** Overall drift across all workflows. */
  readonly overall: DriftWindow[];
  /** Per-workflow breakdown (sorted worst-first). */
  readonly byWorkflow: readonly WorkflowDrift[];
  /** Is the society's code health improving? */
  readonly trending: "improving" | "stable" | "worsening";
  /** Human-readable one-liner. */
  readonly summary: string;
}

// ═══ Loading ══════════════════════════════════════════════════════════════════

export function loadCIRuns(path: string): CIRun[] {
  try {
    return readFileSync(path, "utf-8").trim().split("\n")
      .filter((l) => l.length > 0)
      .map((l) => JSON.parse(l))
      .filter((r) => r.workflow && r.conclusion && r.at);
  } catch { return []; }
}

// ═══ Computation ══════════════════════════════════════════════════════════════

function computeWindow(runs: readonly CIRun[], label: string, windowMs: number, nowMs: number): DriftWindow {
  const cutoff = nowMs - windowMs;
  const inWindow = runs.filter((r) => new Date(r.at).getTime() > cutoff);
  const green = inWindow.filter((r) => r.conclusion === "success").length;
  const red = inWindow.filter((r) => r.conclusion === "failure").length;
  const cancelled = inWindow.filter((r) => r.conclusion === "cancelled").length;
  const decisive = green + red;
  return {
    label,
    total: inWindow.length,
    green,
    red,
    cancelled,
    greenRatio: decisive > 0 ? green / decisive : 0,
    redRatio: decisive > 0 ? red / decisive : 0,
  };
}

function computeWorkflowDrift(runs: readonly CIRun[], nowMs: number): WorkflowDrift[] {
  const byWorkflow = new Map<string, CIRun[]>();
  for (const r of runs) {
    const list = byWorkflow.get(r.workflow) || [];
    list.push(r);
    byWorkflow.set(r.workflow, list);
  }

  const result: WorkflowDrift[] = [];
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const halfWeek = weekMs / 2;

  for (const [workflow, wfRuns] of byWorkflow) {
    const green = wfRuns.filter((r) => r.conclusion === "success").length;
    const red = wfRuns.filter((r) => r.conclusion === "failure").length;
    const decisive = green + red;
    const greenRatio = decisive > 0 ? green / decisive : 0;

    // Trend: compare first half vs second half of the window
    const midpoint = nowMs - halfWeek;
    const firstHalf = wfRuns.filter((r) => new Date(r.at).getTime() <= midpoint);
    const secondHalf = wfRuns.filter((r) => new Date(r.at).getTime() > midpoint);
    const firstGreen = firstHalf.filter((r) => r.conclusion === "success").length;
    const firstDecisive = firstHalf.filter((r) => r.conclusion !== "cancelled").length;
    const secondGreen = secondHalf.filter((r) => r.conclusion === "success").length;
    const secondDecisive = secondHalf.filter((r) => r.conclusion !== "cancelled").length;

    const firstRatio = firstDecisive > 0 ? firstGreen / firstDecisive : 0;
    const secondRatio = secondDecisive > 0 ? secondGreen / secondDecisive : 0;

    let trend: "improving" | "stable" | "worsening";
    if (secondRatio > firstRatio + 0.05) trend = "improving";
    else if (secondRatio < firstRatio - 0.05) trend = "worsening";
    else trend = "stable";

    result.push({ workflow, total: wfRuns.length, green, red, greenRatio, trend });
  }

  // Sort worst-first (lowest green ratio)
  result.sort((a, b) => a.greenRatio - b.greenRatio);
  return result;
}

/**
 * Compute the full drift snapshot from CI run data.
 */
export function computeDrift(runs: readonly CIRun[], nowMs?: number): DriftSnapshot {
  const now = nowMs ?? Date.now();
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;

  const windows = [
    computeWindow(runs, "1h", HOUR, now),
    computeWindow(runs, "24h", DAY, now),
    computeWindow(runs, "7d", 7 * DAY, now),
  ];

  const byWorkflow = computeWorkflowDrift(runs, now);

  // Overall trend: compare 24h green ratio to 7d green ratio
  const day = windows.find((w) => w.label === "24h")!;
  const week = windows.find((w) => w.label === "7d")!;
  let trending: "improving" | "stable" | "worsening";
  if (day.greenRatio > week.greenRatio + 0.05) trending = "improving";
  else if (day.greenRatio < week.greenRatio - 0.05) trending = "worsening";
  else trending = "stable";

  const weekPct = (week.greenRatio * 100).toFixed(0);
  const dayPct = (day.greenRatio * 100).toFixed(0);
  const worstWorkflow = byWorkflow[0];
  const summary = runs.length === 0
    ? "No CI run data — data/ci-runs.jsonl empty or missing"
    : `7d: ${weekPct}% green (${week.green}/${week.green + week.red}), 24h: ${dayPct}% green, trend: ${trending}${worstWorkflow && worstWorkflow.greenRatio < 0.8 ? `, weakest: ${worstWorkflow.workflow} (${(worstWorkflow.greenRatio * 100).toFixed(0)}%)` : ""}`;

  return {
    computedAt: new Date(now).toISOString(),
    overall: windows,
    byWorkflow,
    trending,
    summary,
  };
}

/**
 * Format for one-line CI logging.
 */
export function formatDrift(snapshot: DriftSnapshot): string {
  return `[drift-rate] ${snapshot.summary}`;
}
