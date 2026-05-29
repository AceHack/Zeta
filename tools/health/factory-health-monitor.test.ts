import { describe, expect, test } from "bun:test";
import {
  buildHealthReport,
  classifyBranchLane,
  classifyLaneRunway,
  laneRunwaySnapshotFromObservations,
  runHealthCheck,
  type HealthSignal,
} from "./factory-health-monitor";

const HEALTH_CHECK_TIMEOUT_MS = 20_000;
let cachedReport: ReturnType<typeof runHealthCheck> | undefined;

function getReport(): ReturnType<typeof runHealthCheck> {
  cachedReport ??= runHealthCheck();
  return cachedReport;
}

describe("factory-health-monitor", () => {
  test("classifyBranchLane maps known branch prefixes to lanes", () => {
    expect(classifyBranchLane("codex/health-fix")).toBe("codex");
    expect(classifyBranchLane("origin/claim/codex-loop-20260529")).toBe(
      "codex",
    );
    expect(classifyBranchLane("otto-cli/b0355-bootstrap")).toBe("otto");
    expect(classifyBranchLane("otto-bg-worker/tick-shard")).toBe("otto");
    expect(classifyBranchLane("lior-pr-cleanup")).toBe("lior");
    expect(classifyBranchLane("kiro/bootstrap")).toBe("alexa");
    expect(classifyBranchLane("claim/kiro-background-service")).toBe("alexa");
    expect(classifyBranchLane("riven-loop-health")).toBe("riven");
    expect(classifyBranchLane("chore/unowned-work")).toBe("other");
  });

  test("classifyLaneRunway distinguishes active, quiet, and unhealthy lanes", () => {
    const signals = classifyLaneRunway({
      openPrBranches: ["codex/source-patch", "otto-cli/bootstrap"],
      activeClaimBranches: ["claim/codex-loop-20260529"],
      healthyServices: {
        codex: true,
        otto: true,
        lior: true,
        alexa: true,
        riven: false,
      },
    });

    expect(signals).toContainEqual({
      surface: "lane-runway",
      level: "ok",
      message: "codex: active (1 open PR(s), 1 active claim(s))",
    });
    expect(signals).toContainEqual({
      surface: "lane-runway",
      level: "ok",
      message: "lior: quiet runway (0 open PRs, 0 active claims)",
    });
    expect(signals).toContainEqual({
      surface: "lane-runway",
      level: "warning",
      message: "riven: no open PRs or claims and service unhealthy",
      action: "inspect riven background service before treating lane as quiet",
    });
  });

  test("classifyLaneRunway warns about branches outside named lanes", () => {
    const signals = classifyLaneRunway({
      openPrBranches: ["chore/no-owner"],
      activeClaimBranches: ["claim/task-unowned-work"],
    });

    expect(signals).toContainEqual({
      surface: "lane-runway",
      level: "warning",
      message: "other: 1 open PR(s), 1 active claim(s) outside named lanes",
      action:
        "classify owner or assign an explicit lane before treating as runway",
    });
  });

  test("laneRunwaySnapshotFromObservations builds classifier input", () => {
    const snapshot = laneRunwaySnapshotFromObservations(
      JSON.stringify([
        {
          number: 1,
          title: "Codex source patch",
          createdAt: "2026-05-29T21:00:00Z",
          autoMergeRequest: null,
          headRefName: "codex/source-patch",
        },
        {
          number: 2,
          title: "Otto bootstrap",
          createdAt: "2026-05-29T21:05:00Z",
          autoMergeRequest: { enabledAt: "2026-05-29T21:06:00Z" },
          headRefName: "otto-cli/bootstrap",
        },
        { headRefName: null },
      ]),
      "  origin/claim/codex-loop-20260529\norigin/claim/kiro-background-service\n\n",
      { codex: true, alexa: false },
    );

    expect(snapshot).toEqual({
      openPrBranches: ["codex/source-patch", "otto-cli/bootstrap"],
      activeClaimBranches: [
        "claim/codex-loop-20260529",
        "claim/kiro-background-service",
      ],
      healthyServices: { codex: true, alexa: false },
    });
  });

  test("buildHealthReport summarizes deterministic signals", () => {
    const signals: HealthSignal[] = [
      { surface: "pr-queue", level: "ok", message: "ready" },
      {
        surface: "claims",
        level: "warning",
        message: "claim drift",
        action: "audit claims",
      },
      {
        surface: "cadence",
        level: "critical",
        message: "idle",
        action: "wake runner",
      },
    ];

    const report = buildHealthReport(
      signals,
      "2026-05-07T15:10:00.000Z",
    );

    expect(report.summary).toEqual({ ok: 1, warning: 1, critical: 1 });
    expect(report.recommendedAction).toBe("wake runner");
    expect(report.timestamp).toBe("2026-05-07T15:10:00.000Z");
  });

  test("runHealthCheck returns a valid HealthReport shape", () => {
    const report = getReport();

    expect(report).toHaveProperty("timestamp");
    expect(report).toHaveProperty("signals");
    expect(report).toHaveProperty("summary");
    expect(Array.isArray(report.signals)).toBe(true);
    expect(typeof report.summary.ok).toBe("number");
    expect(typeof report.summary.warning).toBe("number");
    expect(typeof report.summary.critical).toBe("number");
  }, HEALTH_CHECK_TIMEOUT_MS);

  test("summary counts match signal levels", () => {
    const report = getReport();

    const okCount = report.signals.filter((s) => s.level === "ok").length;
    const warnCount = report.signals.filter(
      (s) => s.level === "warning",
    ).length;
    const critCount = report.signals.filter(
      (s) => s.level === "critical",
    ).length;

    expect(report.summary.ok).toBe(okCount);
    expect(report.summary.warning).toBe(warnCount);
    expect(report.summary.critical).toBe(critCount);
  }, HEALTH_CHECK_TIMEOUT_MS);

  test("all signals have required fields", () => {
    const report = getReport();

    for (const signal of report.signals) {
      expect(typeof signal.surface).toBe("string");
      expect(["ok", "warning", "critical"]).toContain(signal.level);
      expect(typeof signal.message).toBe("string");
      expect(signal.message.length).toBeGreaterThan(0);
    }
  }, HEALTH_CHECK_TIMEOUT_MS);

  test("timestamp is valid ISO 8601", () => {
    const report = getReport();
    const parsed = new Date(report.timestamp);
    expect(parsed.getTime()).not.toBeNaN();
  }, HEALTH_CHECK_TIMEOUT_MS);

  test("at least one signal covers each expected surface", () => {
    const report = getReport();
    const surfaces = new Set(report.signals.map((s) => s.surface));

    expect(surfaces.has("lane-runway")).toBe(true);
    expect(surfaces.has("pr-queue") || surfaces.has("backlog")).toBe(true);
    expect(surfaces.has("cadence")).toBe(true);
  }, HEALTH_CHECK_TIMEOUT_MS);
});
