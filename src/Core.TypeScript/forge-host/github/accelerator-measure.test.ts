/**
 * tools/github-accelerator-measurement/measure.test.ts
 *
 * Tests for 081KSNY2Z0008QG0R001JQABB4 Phase 2 measurement substrate.
 *
 * Tests parsing + computation + interpretation; gh CLI invocation
 * tested by integration (manual run + checking observable behavior).
 */

import { describe, expect, test } from "bun:test";
import {
  computeMetrics,
  computeSinceFromWindow,
  formatResult,
  interpretMetrics,
  parseArgs,
} from "./accelerator-measure";

describe("parseArgs", () => {
  test("default window is 24h", () => {
    const parsed = parseArgs(["bun", "measure.ts"]);
    if ("error" in parsed) throw new Error(parsed.error);
    expect(parsed.window.humanReadable).toBe("last 24h");
    expect(parsed.window.author).toBe("any");
  });

  test("--window 7d", () => {
    const parsed = parseArgs(["bun", "measure.ts", "--window", "7d"]);
    if ("error" in parsed) throw new Error(parsed.error);
    expect(parsed.window.humanReadable).toBe("last 7d");
  });

  test("--author @me", () => {
    const parsed = parseArgs(["bun", "measure.ts", "--author", "@me"]);
    if ("error" in parsed) throw new Error(parsed.error);
    expect(parsed.window.author).toBe("@me");
  });

  test("--since ISO8601", () => {
    const parsed = parseArgs(["bun", "measure.ts", "--since", "2026-05-28T00:00:00Z"]);
    if ("error" in parsed) throw new Error(parsed.error);
    expect(parsed.window.humanReadable).toBe("since 2026-05-28T00:00:00Z");
    expect(parsed.window.since).toBe("2026-05-28T00:00:00Z");
  });

  test("invalid window format returns error", () => {
    const parsed = parseArgs(["bun", "measure.ts", "--window", "invalid"]);
    expect("error" in parsed).toBe(true);
  });
});

describe("computeSinceFromWindow", () => {
  test("24h returns valid ISO", () => {
    const result = computeSinceFromWindow("24h");
    if ("error" in result) throw new Error(result.error);
    const date = new Date(result.since);
    expect(date.getTime()).toBeLessThan(Date.now());
    expect(date.getTime()).toBeGreaterThan(Date.now() - 25 * 60 * 60 * 1000);
  });

  test("7d returns ISO ~7 days ago", () => {
    const result = computeSinceFromWindow("7d");
    if ("error" in result) throw new Error(result.error);
    const date = new Date(result.since);
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    expect(Math.abs(date.getTime() - sevenDaysAgo)).toBeLessThan(60 * 1000);
  });

  test("2w returns ISO ~14 days ago", () => {
    const result = computeSinceFromWindow("2w");
    if ("error" in result) throw new Error(result.error);
    const date = new Date(result.since);
    const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    expect(Math.abs(date.getTime() - fourteenDaysAgo)).toBeLessThan(60 * 1000);
  });

  test("invalid format returns error", () => {
    const result = computeSinceFromWindow("blah");
    expect("error" in result).toBe(true);
  });
});

describe("computeMetrics", () => {
  const baseWindow = { humanReadable: "test", since: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), author: "any" as const };

  test("empty PRs produces zero metrics", () => {
    const metrics = computeMetrics([], baseWindow);
    expect(metrics.totalPRsInWindow).toBe(0);
    expect(metrics.merged).toBe(0);
    expect(metrics.compressionRatio).toBe(0);
  });

  test("all merged → compression ratio 1.0", () => {
    const prs = [
      { number: 1, state: "MERGED" as const, createdAt: "2026-05-28T00:00:00Z", mergedAt: "2026-05-28T01:00:00Z", closedAt: null },
      { number: 2, state: "MERGED" as const, createdAt: "2026-05-28T00:00:00Z", mergedAt: "2026-05-28T01:00:00Z", closedAt: null },
    ];
    const metrics = computeMetrics(prs, baseWindow);
    expect(metrics.merged).toBe(2);
    expect(metrics.closedNoMerge).toBe(0);
    expect(metrics.compressionRatio).toBe(1.0);
    expect(metrics.bulkRejectionRate).toBe(0);
  });

  test("half merged half closed-no-merge → compression ratio 0.5", () => {
    const prs = [
      { number: 1, state: "MERGED" as const, createdAt: "2026-05-28T00:00:00Z", mergedAt: "2026-05-28T01:00:00Z", closedAt: null },
      { number: 2, state: "CLOSED" as const, createdAt: "2026-05-28T00:00:00Z", mergedAt: null, closedAt: "2026-05-28T01:00:00Z" },
    ];
    const metrics = computeMetrics(prs, baseWindow);
    expect(metrics.merged).toBe(1);
    expect(metrics.closedNoMerge).toBe(1);
    expect(metrics.compressionRatio).toBe(0.5);
    expect(metrics.bulkRejectionRate).toBe(0.5);
  });

  test("open PRs don't affect compression ratio", () => {
    const prs = [
      { number: 1, state: "MERGED" as const, createdAt: "2026-05-28T00:00:00Z", mergedAt: "2026-05-28T01:00:00Z", closedAt: null },
      { number: 2, state: "OPEN" as const, createdAt: "2026-05-28T00:00:00Z", mergedAt: null, closedAt: null },
    ];
    const metrics = computeMetrics(prs, baseWindow);
    expect(metrics.merged).toBe(1);
    expect(metrics.stillOpen).toBe(1);
    expect(metrics.compressionRatio).toBe(1.0); // 1 merged / 1 decided
    expect(metrics.inFlightFraction).toBe(0.5); // 1/2 still open
  });

  test("throughputPerHour computed correctly", () => {
    const prs = [
      { number: 1, state: "MERGED" as const, createdAt: "2026-05-28T00:00:00Z", mergedAt: "2026-05-28T01:00:00Z", closedAt: null },
      { number: 2, state: "MERGED" as const, createdAt: "2026-05-28T00:00:00Z", mergedAt: "2026-05-28T02:00:00Z", closedAt: null },
    ];
    const metrics = computeMetrics(prs, baseWindow);
    expect(metrics.throughputPerHour).toBeGreaterThan(0);
    expect(metrics.throughputPerHour).toBeLessThan(1); // 2 merged in 24h ≈ 0.083
  });
});

describe("interpretMetrics", () => {
  test("compressionRatio >= 0.8 → high tier", () => {
    const result = interpretMetrics({
      totalPRsInWindow: 10,
      merged: 9,
      closedNoMerge: 1,
      stillOpen: 0,
      compressionRatio: 0.9,
      throughputPerHour: 0.5,
      bulkRejectionRate: 0.1,
      inFlightFraction: 0,
    });
    expect(result.tier).toBe("high");
    expect(result.note).toContain("90%");
  });

  test("compressionRatio 0.5-0.8 → medium tier", () => {
    const result = interpretMetrics({
      totalPRsInWindow: 10,
      merged: 6,
      closedNoMerge: 4,
      stillOpen: 0,
      compressionRatio: 0.6,
      throughputPerHour: 0.5,
      bulkRejectionRate: 0.4,
      inFlightFraction: 0,
    });
    expect(result.tier).toBe("medium");
    expect(result.note).toContain("60%");
  });

  test("compressionRatio < 0.5 → low tier", () => {
    const result = interpretMetrics({
      totalPRsInWindow: 10,
      merged: 2,
      closedNoMerge: 8,
      stillOpen: 0,
      compressionRatio: 0.2,
      throughputPerHour: 0.5,
      bulkRejectionRate: 0.8,
      inFlightFraction: 0,
    });
    expect(result.tier).toBe("low");
    expect(result.note).toContain("20%");
  });
});

describe("formatResult", () => {
  test("success result formats with rowId 081KSNY2Z0008QG0R001JQABB4", () => {
    const formatted = formatResult({
      kind: "success",
      window: { humanReadable: "test", since: "2026-05-28T00:00:00Z", author: "any" },
      metrics: {
        totalPRsInWindow: 10,
        merged: 8,
        closedNoMerge: 2,
        stillOpen: 0,
        compressionRatio: 0.8,
        throughputPerHour: 0.5,
        bulkRejectionRate: 0.2,
        inFlightFraction: 0,
      },
    });
    expect(formatted.exitCode).toBe(0);
    expect(formatted.stdout).toContain("081KSNY2Z0008QG0R001JQABB4");
    expect(formatted.stdout).toContain("Phase 2");
  });

  test("gh-cli-not-found exits 2 with install help", () => {
    const formatted = formatResult({ kind: "gh-cli-not-found" });
    expect(formatted.exitCode).toBe(2);
    expect(formatted.stdout).toContain("install gh CLI");
  });

  test("no-data-in-window returns 0 with suggestion", () => {
    const formatted = formatResult({
      kind: "no-data-in-window",
      window: { humanReadable: "test", since: "2026-05-28T00:00:00Z", author: "any" },
    });
    expect(formatted.exitCode).toBe(0);
    expect(formatted.stdout).toContain("wider window");
  });
});
