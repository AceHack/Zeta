import { describe, expect, test } from "bun:test";
import {
  buildHealthReport,
  collectStandingQuerySignals,
  classifyClaimPathCollisions,
  classifyBranchLane,
  classifyLaneRunway,
  classifyParallelRunway,
  codexLoopServiceHealthFromJson,
  classifyLocalWorktreeDirt,
  findClaimPathCollisions,
  laneRunwayServiceHealthFromObservations,
  laneRunwaySnapshotFromObservations,
  localWorktreeDirtObservationFromStatus,
  parseClaimPathSet,
  parseGitWorktreeListPorcelain,
  parseLocalWorktreeDirtScanLimit,
  runHealthCheck,
  type HealthSignal,
  type StandingQueryTriggerSource,
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
    expect(classifyBranchLane("origin/claim/codex-loop-20260529")).toBe("codex");
    expect(classifyBranchLane("otto-cli/b0355-bootstrap")).toBe("otto");
    expect(classifyBranchLane("otto-bg-worker/tick-shard")).toBe("otto");
    expect(classifyBranchLane("lior-pr-cleanup")).toBe("lior");
    expect(classifyBranchLane("kiro/bootstrap")).toBe("alexa");
    expect(classifyBranchLane("claim/kiro-background-service")).toBe("alexa");
    expect(classifyBranchLane("riven-loop-health")).toBe("riven");
    expect(classifyBranchLane("chore/unowned-work")).toBe("other");
  });

  test("parseClaimPathSet accepts initial and planned path-set headings", () => {
    expect(
      parseClaimPathSet(
        [
          "# Claim",
          "",
          "Initial intended path set:",
          "",
          "- `tools/health/factory-health-monitor.ts`",
          "- ./docs/trajectory.md",
        ].join("\n"),
      ),
    ).toEqual(["docs/trajectory.md", "tools/health/factory-health-monitor.ts"]);

    expect(
      parseClaimPathSet(
        [
          "# Claim",
          "",
          "Planned path set:",
          "",
          "- `tools/health/factory-health-monitor.test.ts`",
          "",
          "## Notes",
          "- `ignored-after-heading.md`",
        ].join("\n"),
      ),
    ).toEqual(["tools/health/factory-health-monitor.test.ts"]);
  });

  test("parseClaimPathSet falls back to durable target paths", () => {
    expect(
      parseClaimPathSet(
        [
          "# Claim",
          "",
          "- **Durable target:** `tools/health/factory-health-monitor.ts`, docs/claims/example.md, https://example.invalid, `claim/not-a-path-branch`",
        ].join("\n"),
      ),
    ).toEqual(["docs/claims/example.md", "tools/health/factory-health-monitor.ts"]);

    expect(
      parseClaimPathSet(["# Claim", "", "- **Durable target:** PR from `claim/codex-loop-branch-only`"].join("\n")),
    ).toEqual([]);
  });

  test("findClaimPathCollisions detects exact and glob ownership overlap", () => {
    expect(
      findClaimPathCollisions([
        { claimBranch: "origin/claim/codex-health", paths: ["tools/health/**"] },
        {
          claimBranch: "claim/otto-health-test",
          paths: ["tools/health/factory-health-monitor.ts"],
        },
        { claimBranch: "claim/lior-doc", paths: ["docs/only.md"] },
      ]),
    ).toEqual([
      {
        path: "tools/health/** overlaps tools/health/factory-health-monitor.ts",
        claimBranches: ["claim/codex-health", "claim/otto-health-test"],
      },
    ]);
  });

  test("findClaimPathCollisions canonicalizes overlap messages", () => {
    const forward = findClaimPathCollisions([
      { claimBranch: "claim/a", paths: ["tools/health/**"] },
      { claimBranch: "claim/b", paths: ["tools/health/file.ts"] },
    ]);
    const reversed = findClaimPathCollisions([
      { claimBranch: "claim/b", paths: ["tools/health/file.ts"] },
      { claimBranch: "claim/a", paths: ["tools/health/**"] },
    ]);

    expect(forward).toEqual(reversed);
    expect(forward[0]?.path).toBe("tools/health/** overlaps tools/health/file.ts");
  });

  test("classifyClaimPathCollisions emits lane-runway warnings only for collisions", () => {
    expect(
      classifyClaimPathCollisions([
        { claimBranch: "claim/a", paths: ["docs/a.md"] },
        { claimBranch: "claim/b", paths: ["docs/b.md"] },
      ]),
    ).toEqual([]);

    expect(
      classifyClaimPathCollisions([
        { claimBranch: "claim/a", paths: ["docs/shared.md"] },
        { claimBranch: "claim/b", paths: ["docs/shared.md"] },
      ]),
    ).toEqual([
      {
        surface: "lane-runway",
        level: "warning",
        message: "claim-path collision on docs/shared.md: claim/a, claim/b",
        action: "inspect remote claim files and release or hand off one owner before writing claimed paths",
      },
    ]);
  });

  test("parseGitWorktreeListPorcelain extracts local worktree branches", () => {
    expect(
      parseGitWorktreeListPorcelain(
        [
          "worktree /repo/Zeta",
          "HEAD abc123",
          "branch refs/heads/main",
          "",
          "worktree /repo/Zeta-worktrees/codex-health",
          "HEAD def456",
          "branch refs/heads/claim/codex-health",
          "",
          "worktree /repo/detached",
          "HEAD 789abc",
          "detached",
        ].join("\n"),
      ),
    ).toEqual([
      { path: "/repo/Zeta", branch: "main" },
      { path: "/repo/Zeta-worktrees/codex-health", branch: "claim/codex-health" },
      { path: "/repo/detached", branch: null },
    ]);
  });

  test("classifyLocalWorktreeDirt warns about dirty same-machine worktrees", () => {
    const observation = localWorktreeDirtObservationFromStatus(
      { path: "/repo/Zeta-worktrees/codex-health", branch: "claim/codex-health" },
      [" M tools/health/factory-health-monitor.ts", "?? docs/claims/codex-health.md"].join("\n"),
    );

    expect(observation).toEqual({
      path: "/repo/Zeta-worktrees/codex-health",
      branch: "claim/codex-health",
      dirtyEntries: 2,
      modifiedEntries: 1,
      untrackedEntries: 1,
    });
    expect(classifyLocalWorktreeDirt(observation === null ? [] : [observation])).toEqual([
      {
        surface: "lane-runway",
        level: "warning",
        message: "local dirty worktree claim/codex-health: 2 dirty file(s) (1 modified, 1 untracked)",
        action: "inspect local worktree status before treating same-machine lane/path ownership as free",
      },
    ]);
    expect(localWorktreeDirtObservationFromStatus({ path: "/repo/Zeta", branch: "main" }, "")).toBeNull();
  });

  test("parseLocalWorktreeDirtScanLimit falls back on malformed values", () => {
    expect(parseLocalWorktreeDirtScanLimit(undefined)).toBe(60);
    expect(parseLocalWorktreeDirtScanLimit("12")).toBe(12);
    expect(parseLocalWorktreeDirtScanLimit("0")).toBe(0);
    expect(parseLocalWorktreeDirtScanLimit("not-a-number")).toBe(60);
    expect(parseLocalWorktreeDirtScanLimit("-1")).toBe(60);
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
      action: "classify owner or assign an explicit lane before treating as runway",
    });
  });

  test("classifyParallelRunway warns when Codex has no active item", () => {
    expect(
      classifyParallelRunway(
        {
          openPrBranches: ["otto-cli/bootstrap"],
          activeClaimBranches: ["claim/lior-doc"],
        },
        { lane: "codex", minimumActiveItems: 1, targetActiveItems: 2 },
      ),
    ).toEqual([
      {
        surface: "lane-runway",
        level: "warning",
        message: "codex: parallel runway below minimum (0/1 active item(s), target 2)",
        action: "open or advance a bounded codex PR before treating the lane as idle",
      },
    ]);
  });

  test("classifyParallelRunway distinguishes under-target and target-met runway", () => {
    expect(
      classifyParallelRunway(
        {
          openPrBranches: ["claim/codex-doc-packet"],
          activeClaimBranches: ["origin/claim/codex-doc-packet"],
        },
        { lane: "codex", minimumActiveItems: 1, targetActiveItems: 2 },
      ),
    ).toEqual([
      {
        surface: "lane-runway",
        level: "ok",
        message: "codex: parallel runway above minimum but below target (1/2 active item(s))",
      },
    ]);

    expect(
      classifyParallelRunway(
        {
          openPrBranches: ["codex/health-signal"],
          activeClaimBranches: ["claim/codex-doc-packet"],
        },
        { lane: "codex", minimumActiveItems: 1, targetActiveItems: 2 },
      ),
    ).toEqual([
      {
        surface: "lane-runway",
        level: "ok",
        message: "codex: parallel runway target met (2/2 active item(s))",
      },
    ]);
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
      activeClaimBranches: ["claim/codex-loop-20260529", "claim/kiro-background-service"],
      healthyServices: { codex: true, alexa: false },
    });
  });

  test("laneRunwayServiceHealthFromObservations builds monitor adapter input", () => {
    expect(
      laneRunwayServiceHealthFromObservations([
        { lane: "codex", healthy: true },
        { lane: "riven", healthy: false },
      ]),
    ).toEqual({
      codex: true,
      riven: false,
    });
    expect(laneRunwayServiceHealthFromObservations([])).toBeUndefined();
  });

  test("codexLoopServiceHealthFromJson maps probe severity to lane health", () => {
    expect(codexLoopServiceHealthFromJson('{"severity":"ok"}')).toBe(true);
    expect(codexLoopServiceHealthFromJson('{"severity":"attention"}')).toBe(false);
    expect(codexLoopServiceHealthFromJson('{"severity":"stuck"}')).toBe(false);
    expect(codexLoopServiceHealthFromJson('{"severity":"unknown"}')).toBeNull();
    expect(codexLoopServiceHealthFromJson("not json")).toBeNull();
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

    const report = buildHealthReport(signals, "2026-05-07T15:10:00.000Z");

    expect(report.summary).toEqual({ ok: 1, warning: 1, critical: 1 });
    expect(report.recommendedAction).toBe("wake runner");
    expect(report.timestamp).toBe("2026-05-07T15:10:00.000Z");
  });

  test("collectStandingQuerySignals preserves trigger source order", () => {
    const sources: StandingQueryTriggerSource[] = [
      {
        surface: "lane-runway",
        collect: () => [{ surface: "lane-runway", level: "ok", message: "codex active" }],
      },
      {
        surface: "backlog",
        collect: () => [{ surface: "backlog", level: "warning", message: "P1 queue high" }],
      },
    ];

    expect(collectStandingQuerySignals(sources)).toEqual([
      { surface: "lane-runway", level: "ok", message: "codex active" },
      { surface: "backlog", level: "warning", message: "P1 queue high" },
    ]);
  });

  test("collectStandingQuerySignals converts source failures to bounded warnings", () => {
    const sources: StandingQueryTriggerSource[] = [
      {
        surface: "claims",
        failureAction: "inspect claim refs",
        collect: () => {
          throw new Error("boom");
        },
      },
    ];

    expect(collectStandingQuerySignals(sources)).toEqual([
      {
        surface: "claims",
        level: "warning",
        message: "claims standing-query source failed",
        action: "inspect claim refs",
      },
    ]);
  });

  test(
    "runHealthCheck returns a valid HealthReport shape",
    () => {
      const report = getReport();

      expect(report).toHaveProperty("timestamp");
      expect(report).toHaveProperty("signals");
      expect(report).toHaveProperty("summary");
      expect(Array.isArray(report.signals)).toBe(true);
      expect(typeof report.summary.ok).toBe("number");
      expect(typeof report.summary.warning).toBe("number");
      expect(typeof report.summary.critical).toBe("number");
    },
    HEALTH_CHECK_TIMEOUT_MS,
  );

  test(
    "summary counts match signal levels",
    () => {
      const report = getReport();

      const okCount = report.signals.filter((s) => s.level === "ok").length;
      const warnCount = report.signals.filter((s) => s.level === "warning").length;
      const critCount = report.signals.filter((s) => s.level === "critical").length;

      expect(report.summary.ok).toBe(okCount);
      expect(report.summary.warning).toBe(warnCount);
      expect(report.summary.critical).toBe(critCount);
    },
    HEALTH_CHECK_TIMEOUT_MS,
  );

  test(
    "all signals have required fields",
    () => {
      const report = getReport();

      for (const signal of report.signals) {
        expect(typeof signal.surface).toBe("string");
        expect(["ok", "warning", "critical"]).toContain(signal.level);
        expect(typeof signal.message).toBe("string");
        expect(signal.message.length).toBeGreaterThan(0);
      }
    },
    HEALTH_CHECK_TIMEOUT_MS,
  );

  test(
    "timestamp is valid ISO 8601",
    () => {
      const report = getReport();
      const parsed = new Date(report.timestamp);
      expect(parsed.getTime()).not.toBeNaN();
    },
    HEALTH_CHECK_TIMEOUT_MS,
  );

  test(
    "at least one signal covers each expected surface",
    () => {
      const report = getReport();
      const surfaces = new Set(report.signals.map((s) => s.surface));

      expect(surfaces.has("lane-runway")).toBe(true);
      expect(surfaces.has("pr-queue") || surfaces.has("backlog")).toBe(true);
      expect(surfaces.has("cadence")).toBe(true);
    },
    HEALTH_CHECK_TIMEOUT_MS,
  );
});
