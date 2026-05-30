#!/usr/bin/env bun
// factory-health-monitor.ts -- Standing query for factory health signals.
//
// Detects conditions that need action across multiple surfaces:
// PR queue, backlog state, claim freshness, trajectory
// progress. Produces a structured JSON report suitable for the
// autonomous loop's tick-decision.
//
// This is the "detect" half of detect-trigger-repair (B-0250).

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface HealthSignal {
  surface: string;
  level: "ok" | "warning" | "critical";
  message: string;
  action?: string;
}

export interface HealthReport {
  timestamp: string;
  signals: HealthSignal[];
  summary: {
    ok: number;
    warning: number;
    critical: number;
  };
  recommendedAction: string | null;
}

export type LaneRunwayLane =
  | "codex"
  | "otto"
  | "lior"
  | "alexa"
  | "riven"
  | "other";

export type LaneRunwayNamedLane = Exclude<LaneRunwayLane, "other">;

export interface LaneRunwayServiceHealthObservation {
  lane: LaneRunwayNamedLane;
  healthy: boolean;
}

export interface LaneRunwaySnapshot {
  openPrBranches: string[];
  activeClaimBranches: string[];
  healthyServices?: Partial<Record<LaneRunwayNamedLane, boolean>>;
}

type ToolCommand = "bun" | "gh" | "git";
type ToolResult = { ok: boolean; stdout: string };

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const REPO = process.env.REPO ?? "Lucent-Financial-Group/Zeta";
const PRIMARY_LANES = ["codex", "otto", "lior", "alexa", "riven"] as const;

function run(cmd: ToolCommand, args: string[]): ToolResult {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: "utf-8",
    timeout: 30_000,
  });
  return { ok: r.status === 0, stdout: (r.stdout ?? "").trim() };
}

function fetchOpenPRs(): ToolResult {
  return run("gh", [
    "pr",
    "list",
    "--repo",
    REPO,
    "--state",
    "open",
    "--json",
    "number,title,createdAt,autoMergeRequest,headRefName",
    "--limit",
    "200",
  ]);
}

function fetchCodexLoopHealth(): ToolResult {
  return run("bun", [join(ROOT, ".codex/bin/codex-loop-health.ts")]);
}

export function classifyBranchLane(branchName: string): LaneRunwayLane {
  const branch = branchName.trim().replace(/^origin\//, "");

  if (/^(codex\/|claim\/codex-)/.test(branch)) return "codex";
  if (
    /^(otto\/|otto-cli\/|otto-bg-worker\/|otto-desktop\/|otto-vscode\/|claim\/otto-)/.test(
      branch,
    )
  ) {
    return "otto";
  }
  if (/^(lior\/|lior-|claim\/lior-)/.test(branch)) return "lior";
  if (/^(alexa\/|kiro\/|claim\/alexa-|claim\/kiro-)/.test(branch)) {
    return "alexa";
  }
  if (/^(riven\/|riven-|claim\/riven-)/.test(branch)) return "riven";

  return "other";
}

export function classifyLaneRunway(
  snapshot: LaneRunwaySnapshot,
): HealthSignal[] {
  const openPrCounts = new Map<LaneRunwayLane, number>();
  const claimCounts = new Map<LaneRunwayLane, number>();

  for (const lane of [...PRIMARY_LANES, "other"] as LaneRunwayLane[]) {
    openPrCounts.set(lane, 0);
    claimCounts.set(lane, 0);
  }

  for (const branch of snapshot.openPrBranches) {
    const lane = classifyBranchLane(branch);
    openPrCounts.set(lane, (openPrCounts.get(lane) ?? 0) + 1);
  }

  for (const branch of snapshot.activeClaimBranches) {
    const lane = classifyBranchLane(branch);
    claimCounts.set(lane, (claimCounts.get(lane) ?? 0) + 1);
  }

  const signals = PRIMARY_LANES.map((lane): HealthSignal => {
    const openPrs = openPrCounts.get(lane) ?? 0;
    const claims = claimCounts.get(lane) ?? 0;
    const serviceHealthy = snapshot.healthyServices?.[lane];

    if (openPrs > 0 || claims > 0) {
      return {
        surface: "lane-runway",
        level: "ok",
        message: `${lane}: active (${openPrs} open PR(s), ${claims} active claim(s))`,
      };
    }

    if (serviceHealthy === false) {
      return {
        surface: "lane-runway",
        level: "warning",
        message: `${lane}: no open PRs or claims and service unhealthy`,
        action: `inspect ${lane} background service before treating lane as quiet`,
      };
    }

    return {
      surface: "lane-runway",
      level: "ok",
      message: `${lane}: quiet runway (0 open PRs, 0 active claims)`,
    };
  });

  const otherOpenPrs = openPrCounts.get("other") ?? 0;
  const otherClaims = claimCounts.get("other") ?? 0;
  if (otherOpenPrs > 0 || otherClaims > 0) {
    signals.push({
      surface: "lane-runway",
      level: "warning",
      message: `other: ${otherOpenPrs} open PR(s), ${otherClaims} active claim(s) outside named lanes`,
      action:
        "classify owner or assign an explicit lane before treating as runway",
    });
  }

  return signals;
}

export function laneRunwaySnapshotFromObservations(
  openPrJson: string,
  remoteClaimBranches: string,
  healthyServices?: LaneRunwaySnapshot["healthyServices"],
): LaneRunwaySnapshot {
  const prs = JSON.parse(openPrJson) as Array<{
    headRefName?: string | null;
  }>;
  const openPrBranches = prs
    .map((pr) => pr.headRefName?.trim())
    .filter((branch): branch is string => Boolean(branch));
  const activeClaimBranches = remoteClaimBranches
    .split("\n")
    .map((branch) => branch.trim().replace(/^origin\//, ""))
    .filter(Boolean);

  return {
    openPrBranches,
    activeClaimBranches,
    ...(healthyServices ? { healthyServices } : {}),
  };
}

export function laneRunwayServiceHealthFromObservations(
  observations: LaneRunwayServiceHealthObservation[],
): Partial<Record<LaneRunwayNamedLane, boolean>> | undefined {
  if (observations.length === 0) {
    return undefined;
  }

  const healthyServices: Partial<Record<LaneRunwayNamedLane, boolean>> = {};
  for (const observation of observations) {
    healthyServices[observation.lane] = observation.healthy;
  }
  return healthyServices;
}

export function codexLoopServiceHealthFromJson(output: string): boolean | null {
  try {
    const parsed = JSON.parse(output) as { severity?: unknown };
    if (parsed.severity === "ok") {
      return true;
    }
    if (parsed.severity === "attention" || parsed.severity === "stuck") {
      return false;
    }
    return null;
  } catch {
    return null;
  }
}

function fetchLaneRunwayServiceHealth():
  | LaneRunwaySnapshot["healthyServices"]
  | undefined {
  const codexHealth = codexLoopServiceHealthFromJson(
    fetchCodexLoopHealth().stdout,
  );
  if (codexHealth === null) {
    return undefined;
  }
  return laneRunwayServiceHealthFromObservations([
    { lane: "codex", healthy: codexHealth },
  ]);
}

function checkLaneRunway(openPRs: ToolResult): HealthSignal[] {
  if (!openPRs.ok) {
    return [
      {
        surface: "lane-runway",
        level: "warning",
        message: "Could not query PR branches for lane-runway signals",
        action: "inspect gh CLI state before trusting lane runway",
      },
    ];
  }

  const claims = run("git", [
    "branch",
    "-r",
    "--list",
    "origin/claim/*",
  ]);

  if (!claims.ok) {
    return [
      {
        surface: "lane-runway",
        level: "warning",
        message: "Could not query claim branches for lane-runway signals",
        action: "inspect git remote state before trusting lane runway",
      },
    ];
  }

  try {
    return classifyLaneRunway(
      laneRunwaySnapshotFromObservations(
        openPRs.stdout,
        claims.stdout,
        fetchLaneRunwayServiceHealth(),
      ),
    );
  } catch {
    return [
      {
        surface: "lane-runway",
        level: "warning",
        message: "Could not parse lane-runway observations",
      },
    ];
  }
}

function checkPRQueue(openPRs: ToolResult): HealthSignal[] {
  const signals: HealthSignal[] = [];
  const r = openPRs;

  if (!r.ok) {
    signals.push({
      surface: "pr-queue",
      level: "warning",
      message: "Could not query PR queue (gh CLI issue)",
    });
    return signals;
  }

  try {
    const prs = JSON.parse(r.stdout) as Array<{
      number: number;
      title: string;
      createdAt: string;
      autoMergeRequest: { enabledAt: string } | null;
    }>;

    if (prs.length === 0) {
      signals.push({
        surface: "pr-queue",
        level: "ok",
        message: "PR queue empty — runway available for new work",
        action: "run autonomous-pickup to select next backlog item",
      });
    } else {
      const stale = prs.filter((pr) => {
        const age =
          Date.now() - new Date(pr.createdAt).getTime();
        return age > 24 * 60 * 60 * 1000;
      });

      if (stale.length > 0) {
        signals.push({
          surface: "pr-queue",
          level: "warning",
          message: `${stale.length} PR(s) older than 24h: ${stale.map((p) => `#${p.number}`).join(", ")}`,
          action: "investigate stale PRs — check CI status and unresolved threads",
        });
      }

      const noAutoMerge = prs.filter((pr) => !pr.autoMergeRequest);
      if (noAutoMerge.length > 0) {
        signals.push({
          surface: "pr-queue",
          level: "warning",
          message: `${noAutoMerge.length} PR(s) without auto-merge: ${noAutoMerge.map((p) => `#${p.number}`).join(", ")}`,
          action: "arm auto-merge on qualifying PRs",
        });
      }

      if (stale.length === 0 && noAutoMerge.length === 0) {
        signals.push({
          surface: "pr-queue",
          level: "ok",
          message: `${prs.length} PR(s) open, all auto-merge armed and fresh`,
        });
      }
    }
  } catch {
    signals.push({
      surface: "pr-queue",
      level: "warning",
      message: "Could not parse PR queue response",
    });
  }

  return signals;
}

function checkBacklogHealth(): HealthSignal[] {
  const signals: HealthSignal[] = [];
  const backlogDir = join(ROOT, "docs/backlog");

  let p0Count = 0;
  let p1Count = 0;
  let totalOpen = 0;

  for (const priority of ["P0", "P1", "P2", "P3"]) {
    const dir = join(backlogDir, priority);
    try {
      const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
      for (const file of files) {
        const content = readFileSync(join(dir, file), "utf-8");
        const statusMatch = content.match(/^status:\s*(\S+)/m);
        if (statusMatch && statusMatch[1] === "open") {
          totalOpen++;
          if (priority === "P0") p0Count++;
          if (priority === "P1") p1Count++;
        }
      }
    } catch {
      // directory may not exist
    }
  }

  if (p0Count > 5) {
    signals.push({
      surface: "backlog",
      level: "critical",
      message: `${p0Count} open P0 items — too many critical items`,
      action: "triage P0 items: close resolved, decompose blobs, deprioritize if not truly P0",
    });
  } else if (p0Count > 0) {
    signals.push({
      surface: "backlog",
      level: "ok",
      message: `${p0Count} open P0, ${p1Count} open P1, ${totalOpen} total open`,
    });
  } else if (totalOpen > 0) {
    signals.push({
      surface: "backlog",
      level: "ok",
      message: `0 open P0, ${p1Count} open P1, ${totalOpen} total open`,
    });
  }

  if (totalOpen === 0) {
    signals.push({
      surface: "backlog",
      level: "critical",
      message: "No open backlog items — factory has no work queue",
      action: "file new backlog items from trajectories or gap analysis",
    });
  }

  return signals;
}

function checkClaimFreshness(): HealthSignal[] {
  const signals: HealthSignal[] = [];
  const r = run("git", [
    "branch",
    "-r",
    "--list",
    "origin/claim/*",
  ]);

  if (!r.ok) {
    signals.push({
      surface: "claims",
      level: "warning",
      message: "Could not query claim branches",
      action: "inspect local git remote state and credentials before trusting claim freshness",
    });
    return signals;
  }

  if (!r.stdout) {
    signals.push({
      surface: "claims",
      level: "ok",
      message: "No active claim branches",
    });
    return signals;
  }

  const branches = r.stdout
    .split("\n")
    .map((b) => b.trim())
    .filter(Boolean);

  if (branches.length > 5) {
    signals.push({
      surface: "claims",
      level: "warning",
      message: `${branches.length} claim branches — possible stale claims`,
      action: "audit claim branches for completed or abandoned work",
    });
  } else {
    signals.push({
      surface: "claims",
      level: "ok",
      message: `${branches.length} active claim branch(es)`,
    });
  }

  return signals;
}

function checkWorkingTreeCleanliness(): HealthSignal[] {
  const signals: HealthSignal[] = [];
  const r = run("git", ["status", "--porcelain"]);

  if (!r.ok) {
    signals.push({
      surface: "working-tree",
      level: "warning",
      message: "Could not check working tree status",
    });
    return signals;
  }

  const lines = r.stdout.split("\n").filter(Boolean);
  const untracked = lines.filter((l) => l.startsWith("??"));
  const modified = lines.filter((l) => !l.startsWith("??"));

  if (modified.length > 0) {
    signals.push({
      surface: "working-tree",
      level: "warning",
      message: `${modified.length} modified file(s) not committed`,
      action: "review uncommitted changes — commit or stash",
    });
  }

  if (untracked.length > 5) {
    signals.push({
      surface: "working-tree",
      level: "warning",
      message: `${untracked.length} untracked file(s) — possible artifacts`,
      action: "clean up or .gitignore untracked files",
    });
  }

  if (modified.length === 0 && untracked.length <= 5) {
    const untrackedNote =
      untracked.length === 0
        ? "Working tree clean"
        : `No modified files; ${untracked.length} untracked local file(s) present`;
    signals.push({
      surface: "working-tree",
      level: "ok",
      message: untrackedNote,
    });
  }

  return signals;
}

function checkTrajectoryProgress(): HealthSignal[] {
  const signals: HealthSignal[] = [];
  const trajDir = join(ROOT, "docs/trajectories");

  try {
    const entries = readdirSync(trajDir, { withFileTypes: true });
    const trajectories = entries.filter((e) => e.isDirectory());

    let activeCount = 0;
    let stalledCount = 0;

    for (const traj of trajectories) {
      const resumePath = join(trajDir, traj.name, "RESUME.md");
      try {
        const stat = statSync(resumePath);
        const age = Date.now() - stat.mtimeMs;
        const daysSinceUpdate = age / (24 * 60 * 60 * 1000);

        if (daysSinceUpdate > 7) {
          stalledCount++;
        } else {
          activeCount++;
        }
      } catch {
        // no RESUME.md
      }
    }

    signals.push({
      surface: "trajectories",
      level: stalledCount > 0 ? "warning" : "ok",
      message: `${activeCount} active, ${stalledCount} stalled trajectory(ies)`,
      ...(stalledCount > 0
        ? { action: "refresh stalled trajectories or mark as paused" }
        : {}),
    });
  } catch {
    signals.push({
      surface: "trajectories",
      level: "warning",
      message: "Could not inspect trajectory directory",
      action: "verify docs/trajectories exists and is readable",
    });
  }

  return signals;
}

function checkLostFiles(): HealthSignal[] {
  const signals: HealthSignal[] = [];

  const deletedRecent = run("git", [
    "log",
    "--all",
    "--diff-filter=D",
    "--since=7 days ago",
    "--name-only",
    "--pretty=format:",
  ]);

  if (deletedRecent.ok) {
    const deleted = deletedRecent.stdout
      .split("\n")
      .filter((l) => l.trim().length > 0);
    if (deleted.length > 0) {
      signals.push({
        surface: "lost-files",
        level: "warning",
        message: `${deleted.length} file(s) deleted in last 7 days`,
        action:
          "audit recent deletions — check if content was captured elsewhere before removal",
      });
    }
  }

  const stash = run("git", ["stash", "list"]);
  if (stash.ok && stash.stdout.length > 0) {
    const stashCount = stash.stdout.split("\n").filter(Boolean).length;
    if (stashCount > 0) {
      signals.push({
        surface: "lost-files",
        level: "warning",
        message: `${stashCount} stash entry(ies) — possible lost work-in-progress`,
        action: "review stash entries — pop or drop",
      });
    }
  }

  const closedNotMerged = run("gh", [
    "pr",
    "list",
    "--repo",
    REPO,
    "--state",
    "closed",
    "--limit",
    "20",
    "--json",
    "number,mergedAt,closedAt,title",
  ]);

  if (closedNotMerged.ok) {
    try {
      const prs = JSON.parse(closedNotMerged.stdout) as Array<{
        number: number;
        mergedAt: string | null;
        closedAt: string;
        title: string;
      }>;
      const unmerged = prs.filter((pr) => {
        if (pr.mergedAt) return false;
        const age = Date.now() - new Date(pr.closedAt).getTime();
        return age < 30 * 24 * 60 * 60 * 1000;
      });

      if (unmerged.length > 0) {
        signals.push({
          surface: "lost-files",
          level: "warning",
          message: `${unmerged.length} closed-not-merged PR(s) in last 30 days: ${unmerged.map((p) => `#${p.number}`).join(", ")}`,
          action:
            "check if closed-not-merged PRs contain unrecovered content",
        });
      }
    } catch {
      // parse failure
    }
  }

  const orphanBranches = run("git", [
    "for-each-ref",
    "--no-merged",
    "origin/main",
    "--format=%(refname:short)",
    "refs/remotes/origin/",
  ]);

  if (orphanBranches.ok && orphanBranches.stdout) {
    const branches = orphanBranches.stdout.split("\n").filter(Boolean);
    const nonClaim = branches.filter(
      (b) => !b.includes("claim/") && !b.includes("origin/main"),
    );
    if (nonClaim.length > 10) {
      signals.push({
        surface: "lost-files",
        level: "warning",
        message: `${nonClaim.length} orphan branch(es) not merged to main`,
        action:
          "audit orphan branches for unrecovered content — per LOST-FILES-LOCATIONS.md class 2",
      });
    }
  }

  const worktrees = run("git", ["worktree", "list", "--porcelain"]);
  if (worktrees.ok) {
    const wtPaths = worktrees.stdout
      .split("\n")
      .filter((l) => l.startsWith("worktree "));
    if (wtPaths.length > 1) {
      signals.push({
        surface: "lost-files",
        level: "warning",
        message: `${wtPaths.length - 1} extra worktree(s) — possible subagent remnants`,
        action:
          "check worktrees for uncommitted changes — per LOST-FILES-LOCATIONS.md class 7",
      });
    }
  }

  const drafts = run("gh", [
    "pr",
    "list",
    "--repo",
    REPO,
    "--state",
    "open",
    "--json",
    "number,isDraft,title",
  ]);

  if (drafts.ok) {
    try {
      const prs = JSON.parse(drafts.stdout) as Array<{
        number: number;
        isDraft: boolean;
        title: string;
      }>;
      const draftPRs = prs.filter((pr) => pr.isDraft);
      if (draftPRs.length > 0) {
        signals.push({
          surface: "lost-files",
          level: "warning",
          message: `${draftPRs.length} draft PR(s): ${draftPRs.map((p) => `#${p.number}`).join(", ")}`,
          action:
            "review draft PRs — publish or close — per LOST-FILES-LOCATIONS.md class 8",
        });
      }
    } catch {
      // parse failure
    }
  }

  const memoryRefs = run("bun", [
    join(ROOT, "tools/hygiene/audit-memory-references.ts"),
  ]);
  if (memoryRefs.ok && memoryRefs.stdout.includes("BROKEN")) {
    const brokenCount = (memoryRefs.stdout.match(/BROKEN/g) || []).length;
    signals.push({
      surface: "lost-files",
      level: "warning",
      message: `${brokenCount} broken memory reference(s) — possible deleted memory files`,
      action:
        "fix broken memory references — per LOST-FILES-LOCATIONS.md class 15",
    });
  }

  if (signals.length === 0) {
    signals.push({
      surface: "lost-files",
      level: "ok",
      message: "No lost-file signals detected",
    });
  }

  return signals;
}

function checkRecentCommitCadence(): HealthSignal[] {
  const signals: HealthSignal[] = [];
  const r = run("git", [
    "log",
    "--oneline",
    "--since=24 hours ago",
    "--format=%H",
  ]);

  if (!r.ok) {
    signals.push({
      surface: "cadence",
      level: "warning",
      message: "Could not query recent commit cadence",
      action: "inspect local git state before trusting cadence health",
    });
    return signals;
  }

  const commits = r.stdout.split("\n").filter(Boolean);
  if (commits.length === 0) {
    signals.push({
      surface: "cadence",
      level: "critical",
      message: "No commits in the last 24 hours — factory may be idle",
      action: "check autonomous loop status and backlog runner",
    });
  } else {
    signals.push({
      surface: "cadence",
      level: "ok",
      message: `${commits.length} commit(s) in last 24h`,
    });
  }

  return signals;
}

export function buildHealthReport(
  allSignals: HealthSignal[],
  timestamp = new Date().toISOString(),
): HealthReport {
  const summary = {
    ok: allSignals.filter((s) => s.level === "ok").length,
    warning: allSignals.filter((s) => s.level === "warning").length,
    critical: allSignals.filter((s) => s.level === "critical").length,
  };

  const critical = allSignals.filter((s) => s.level === "critical");
  const warnings = allSignals.filter((s) => s.level === "warning");

  let recommendedAction: string | null = null;
  const firstCritical = critical[0];
  const firstWarning = warnings[0];
  if (firstCritical) {
    recommendedAction = firstCritical.action ?? firstCritical.message;
  } else if (firstWarning) {
    recommendedAction = firstWarning.action ?? firstWarning.message;
  }

  return {
    timestamp,
    signals: allSignals,
    summary,
    recommendedAction,
  };
}

export function runHealthCheck(): HealthReport {
  const openPRs = fetchOpenPRs();

  return buildHealthReport([
    ...checkLaneRunway(openPRs),
    ...checkPRQueue(openPRs),
    ...checkBacklogHealth(),
    ...checkClaimFreshness(),
    ...checkWorkingTreeCleanliness(),
    ...checkTrajectoryProgress(),
    ...checkLostFiles(),
    ...checkRecentCommitCadence(),
  ]);
}

function printHelp(): void {
  console.log(`Usage: bun tools/health/factory-health-monitor.ts [--json]

Options:
  --json   Emit the health report as JSON.
  --help   Show this help text.`);
}

function parseArgs(args: string[]): { json: boolean; help: boolean } {
  const parsed = { json: false, help: false };
  for (const arg of args) {
    if (arg === "--json") {
      parsed.json = true;
    } else if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else {
      console.error(`Unknown argument: ${arg}`);
      printHelp();
      process.exit(2);
    }
  }
  return parsed;
}

if (import.meta.main) {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const report = runHealthCheck();

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Factory Health Report — ${report.timestamp}`);
    console.log("=".repeat(50));

    for (const signal of report.signals) {
      const icon =
        signal.level === "ok"
          ? "[OK]"
          : signal.level === "warning"
            ? "[!!]"
            : "[XX]";
      console.log(`${icon} ${signal.surface}: ${signal.message}`);
      if (signal.action) {
        console.log(`     -> ${signal.action}`);
      }
    }

    console.log("=".repeat(50));
    console.log(
      `Summary: ${report.summary.ok} ok, ${report.summary.warning} warning, ${report.summary.critical} critical`,
    );
    if (report.recommendedAction) {
      console.log(`Recommended: ${report.recommendedAction}`);
    }
  }
}
