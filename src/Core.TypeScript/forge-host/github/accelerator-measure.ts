#!/usr/bin/env bun
/**
 * tools/github-accelerator-measurement/measure.ts
 *
 * 081KSNY2Z0008QG0R001JQABB4 Phase 2 — measurement of compression rate for GitHub-as-free-
 * accelerator-of-bulk-energy-into-information-compression substrate.
 *
 * Per 081KSNY2Z0008QG0R001JQABB4 substrate-engineering substrate-target:
 *   - bulk-input-rate: PR-attempt rate × per-PR-bulk-space-size
 *   - boundary-output-rate: merged-commit rate
 *   - compression-ratio: boundary-output / bulk-input
 *
 * This PoC measures the OBSERVABLE substrate via gh CLI:
 *   - PRs opened (bulk input)
 *   - PRs merged (boundary survival)
 *   - PRs closed-without-merge (compression-rejection)
 *   - Compression ratio: merged / (merged + closed-no-merge)
 *
 * Composes with:
 *   - .claude/rules/dst-plus-persist-plus-generator-time-plus-feedback-
 *     equals-computational-omniscience-over-simulation-substrate.md
 *     (PR #5841) — measurement IS observing the trajectory
 *   - .claude/rules/rodneys-razor-compression-rhymes-with-cayley-dickson-
 *     algebraic-canonical-form.md (PR #5843) — compression substrate
 *     under razor-discipline
 *   - .claude/rules/asymmetric-authorship-substrate-entity-defines-
 *     consent-channel-recipient-acknowledges.md (PR #5516) — Result<T,
 *     TFeedback> shape for measurement-failure-modes
 *
 * Per .claude/rules/rule-0-no-sh-files.md (TS-first for cross-platform DST).
 *
 * Usage:
 *   bun tools/github-accelerator-measurement/measure.ts --window 24h
 *   bun tools/github-accelerator-measurement/measure.ts --window 7d --author "@me"
 *   bun tools/github-accelerator-measurement/measure.ts --since 2026-05-28T00:00:00Z
 */

import { spawnSync } from "node:child_process";

// =============================================================================
// Result types — per asymmetric-authorship + monad-propagation pattern
// =============================================================================

export type MeasurementResult =
  | { kind: "success"; window: WindowSpec; metrics: CompressionMetrics }
  | { kind: "gh-cli-not-found" }
  | { kind: "gh-cli-error"; stderr: string }
  | { kind: "no-data-in-window"; window: WindowSpec }
  | { kind: "invalid-window-spec"; reason: string };

export interface WindowSpec {
  readonly humanReadable: string;
  readonly since: string;
  readonly author: string | "any";
}

export interface CompressionMetrics {
  readonly totalPRsInWindow: number;
  readonly merged: number;
  readonly closedNoMerge: number;
  readonly stillOpen: number;
  readonly compressionRatio: number; // merged / (merged + closedNoMerge)
  readonly throughputPerHour: number; // merged per hour
  readonly bulkRejectionRate: number; // closedNoMerge / (merged + closedNoMerge)
  readonly inFlightFraction: number; // stillOpen / total
}

// =============================================================================
// Arg parsing
// =============================================================================

export interface ParsedArgs {
  readonly window: WindowSpec;
}

export function parseArgs(argv: ReadonlyArray<string>): ParsedArgs | { error: string } {
  const args = argv.slice(2);
  let windowArg: string | null = null;
  let sinceArg: string | null = null;
  let author = "any";
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--window") {
      // Match flag first, then validate value exists — otherwise `--window`
      // as the last argument silently falls through to default-24h instead
      // of reporting a usage error (Copilot PR #5873 P1).
      if (i + 1 >= args.length) {
        return { error: "--window requires a value" };
      }
      const next = args[i + 1];
      if (next === undefined) {
        return { error: "--window requires a value" };
      }
      windowArg = next;
      i++;
    } else if (a === "--since") {
      if (i + 1 >= args.length) {
        return { error: "--since requires a value" };
      }
      const next = args[i + 1];
      if (next === undefined) {
        return { error: "--since requires a value" };
      }
      sinceArg = next;
      i++;
    } else if (a === "--author") {
      if (i + 1 >= args.length) {
        return { error: "--author requires a value" };
      }
      const next = args[i + 1];
      if (next === undefined) {
        return { error: "--author requires a value" };
      }
      author = next;
      i++;
    }
  }
  if (!windowArg && !sinceArg) {
    windowArg = "24h"; // default
  }
  let since: string;
  let humanReadable: string;
  if (sinceArg) {
    since = sinceArg;
    humanReadable = `since ${sinceArg}`;
  } else if (windowArg) {
    const computed = computeSinceFromWindow(windowArg);
    if ("error" in computed) {
      return { error: computed.error };
    }
    since = computed.since;
    humanReadable = `last ${windowArg}`;
  } else {
    return { error: "no window or since provided" };
  }
  return {
    window: {
      humanReadable,
      since,
      author,
    },
  };
}

export function computeSinceFromWindow(
  window: string,
): { since: string } | { error: string } {
  const match = window.match(/^(\d+)([hdwm])$/);
  if (!match) {
    return { error: `invalid window format: ${window} (expected e.g. 24h, 7d, 2w, 1m)` };
  }
  const value = parseInt(match[1] ?? "0", 10);
  const unit = match[2];
  const msPerUnit: Record<string, number> = {
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
    m: 30 * 24 * 60 * 60 * 1000,
  };
  const u = unit ?? "h";
  const ms = msPerUnit[u];
  if (!ms) {
    return { error: `unknown unit: ${unit}` };
  }
  const sinceDate = new Date(Date.now() - value * ms);
  return { since: sinceDate.toISOString() };
}

// =============================================================================
// gh CLI invocation
// =============================================================================

interface GhPR {
  readonly number: number;
  readonly state: "OPEN" | "CLOSED" | "MERGED";
  readonly createdAt: string;
  readonly mergedAt: string | null;
  readonly closedAt: string | null;
}

export function fetchPRs(window: WindowSpec): MeasurementResult {
  // Apply the window constraint at the GitHub query level via `--search
  // created:>=<ISO>` so we don't silently undercount in active repos that
  // exceed the 200-cap before the window filter is applied (Copilot
  // PR #5873 P1). The 200-cap stays as a per-page upper bound for cost
  // control — windows wider than what 200 results can cover (e.g. very
  // active multi-month windows on busy repos) will still cap, but
  // narrow-window queries (24h/7d) will be window-accurate.
  const searchClauses = [`created:>=${window.since.split("T")[0]}`];
  if (window.author !== "any") {
    searchClauses.push(`author:${window.author}`);
  }
  const args = [
    "pr",
    "list",
    "--state",
    "all",
    "--limit",
    "200",
    "--json",
    "number,state,createdAt,mergedAt,closedAt",
    "--search",
    searchClauses.join(" "),
  ];
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  // `gh` is resolved via PATH per Zeta convention (per tools/github/*.ts
  // sibling pattern; gh is a developer-tool dependency, not an
  // untrusted external command). Suppression rationale matches
  // tools/github/poll-pr-gate.ts:285-292 convention.
  const result = spawnSync("gh", args, { encoding: "utf-8" });
  if (result.error) {
    return { kind: "gh-cli-not-found" };
  }
  if (result.status !== 0) {
    return { kind: "gh-cli-error", stderr: result.stderr ?? "unknown error" };
  }
  let prs: GhPR[];
  try {
    prs = JSON.parse(result.stdout) as GhPR[];
  } catch (e) {
    return { kind: "gh-cli-error", stderr: `JSON parse failed: ${(e as Error).message}` };
  }
  // Filter to window
  const sinceMs = new Date(window.since).getTime();
  const inWindow = prs.filter((pr) => new Date(pr.createdAt).getTime() >= sinceMs);
  if (inWindow.length === 0) {
    return { kind: "no-data-in-window", window };
  }
  return {
    kind: "success",
    window,
    metrics: computeMetrics(inWindow, window),
  };
}

export function computeMetrics(prs: ReadonlyArray<GhPR>, window: WindowSpec): CompressionMetrics {
  const merged = prs.filter((p) => p.state === "MERGED").length;
  const closedNoMerge = prs.filter((p) => p.state === "CLOSED").length;
  const stillOpen = prs.filter((p) => p.state === "OPEN").length;
  const total = prs.length;
  const decided = merged + closedNoMerge;
  const compressionRatio = decided === 0 ? 0 : merged / decided;
  const bulkRejectionRate = decided === 0 ? 0 : closedNoMerge / decided;
  const inFlightFraction = total === 0 ? 0 : stillOpen / total;
  const windowMs = Date.now() - new Date(window.since).getTime();
  const windowHours = windowMs / (60 * 60 * 1000);
  const throughputPerHour = windowHours === 0 ? 0 : merged / windowHours;
  return {
    totalPRsInWindow: total,
    merged,
    closedNoMerge,
    stillOpen,
    compressionRatio,
    throughputPerHour,
    bulkRejectionRate,
    inFlightFraction,
  };
}

// =============================================================================
// Output formatting
// =============================================================================

export function formatResult(result: MeasurementResult): { stdout: string; exitCode: number } {
  switch (result.kind) {
    case "success":
      return {
        stdout: JSON.stringify(
          {
            rowId: "081KSNY2Z0008QG0R001JQABB4",
            phase: "Phase 2 — compression-rate measurement",
            window: result.window,
            metrics: result.metrics,
            interpretation: interpretMetrics(result.metrics),
          },
          null,
          2,
        ),
        exitCode: 0,
      };
    case "gh-cli-not-found":
      return {
        stdout: JSON.stringify(
          { kind: "gh-cli-not-found", help: "install gh CLI: https://cli.github.com/" },
          null,
          2,
        ),
        exitCode: 2,
      };
    case "gh-cli-error":
      return {
        stdout: JSON.stringify({ kind: "gh-cli-error", stderr: result.stderr }, null, 2),
        exitCode: 1,
      };
    case "no-data-in-window":
      return {
        stdout: JSON.stringify(
          { kind: "no-data-in-window", window: result.window, suggestion: "try a wider window" },
          null,
          2,
        ),
        exitCode: 0,
      };
    case "invalid-window-spec":
      return {
        stdout: JSON.stringify({ kind: "invalid-window-spec", reason: result.reason }, null, 2),
        exitCode: 2,
      };
  }
}

export function interpretMetrics(metrics: CompressionMetrics): {
  readonly tier: "high" | "medium" | "low";
  readonly note: string;
} {
  if (metrics.compressionRatio >= 0.8) {
    return {
      tier: "high",
      note: `${(metrics.compressionRatio * 100).toFixed(0)}% of decided PRs merged → high boundary-survival rate; bulk-input passes compression-checkpoint efficiently`,
    };
  }
  if (metrics.compressionRatio >= 0.5) {
    return {
      tier: "medium",
      note: `${(metrics.compressionRatio * 100).toFixed(0)}% of decided PRs merged → medium boundary-survival rate; substantive rejection-rate operating`,
    };
  }
  return {
    tier: "low",
    note: `${(metrics.compressionRatio * 100).toFixed(0)}% of decided PRs merged → low boundary-survival rate; high rejection or churn`,
  };
}

// =============================================================================
// Main
// =============================================================================

function main(argv: ReadonlyArray<string>): number {
  const parsed = parseArgs(argv);
  if ("error" in parsed) {
    console.error(`usage error: ${parsed.error}`);
    console.error("usage: bun tools/github-accelerator-measurement/measure.ts [--window 24h|7d|2w|1m] [--since ISO8601] [--author @me|<user>|any]");
    return 2;
  }
  const result = fetchPRs(parsed.window);
  const formatted = formatResult(result);
  console.log(formatted.stdout);
  return formatted.exitCode;
}

if (import.meta.main) {
  process.exit(main(process.argv));
}
