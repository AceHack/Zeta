#!/usr/bin/env bun
// refresh-worldview.ts — canonical pre-decide worldview snapshot.
//
// Gathers open PRs, recently merged PRs, open issues, and local git
// state into a single structured JSON payload. This is the refresh-
// before-decide tool — replaces ad-hoc `gh pr list`, `gh issue list`,
// `git status`, `git log` chains that the refresh-before-decide
// invariant requires before every tick decision.
//
// Origin: B-0159 (P1) + B-0262/263/264 backlog items requesting a
// canonical refresh script. Follows the same pattern as
// `poll-pr-gate.ts` and `poll-pr-gate-batch.ts` — TS+Bun, structured
// JSON output, `spawnSync` for CLI calls.
//
// Usage:
//   bun tools/github/refresh-worldview.ts
//   bun tools/github/refresh-worldview.ts --owner Lucent-Financial-Group --repo Zeta
//   bun tools/github/refresh-worldview.ts --pr-limit 20 --issue-limit 10
//
// Output: one JSON object on stdout, shape:
//   {
//     "owner": "Lucent-Financial-Group",
//     "repo": "Zeta",
//     "queriedAt": "2026-05-08T12:00:00.000Z",
//     "summary": "1 open PR, 3 recent merges, ...",
//     "openPRs": [ { number, title, headRefName, ... }, ... ],
//     "recentMerges": [ { number, title, mergedAt }, ... ],
//     "openIssues": [ { number, title, labels, createdAt }, ... ],
//     "gitState": { branch, uncommittedFiles, recentCommits },
//     "backlogDelta": { totalFiles, byPriority: { P0: n, P1: n, ... } },
//     "claims": [ { name: "claim/..." }, ... ],
//     "branchState": { current, ahead, behind, tracking },
//     "pendingCI": [ { id, status, workflowName, headBranch, createdAt }, ... ]
//   }
//
// Exit codes:
//   0 — query succeeded, JSON emitted
//   1 — invocation / argument error
//   2 — gh CLI returned non-zero (auth, rate-limit, etc.)
//   3 — output couldn't be parsed

import { spawnSync } from "node:child_process";

const SPAWN_MAX_BUFFER = 32 * 1024 * 1024; // 32 MiB

// --- Types ---

interface OpenPR {
  number: number;
  title: string;
  headRefName: string;
  createdAt: string;
  updatedAt: string;
  autoMergeRequest: { enabledAt?: string } | null;
  reviewDecision: string;
  isCrossRepository: boolean;
  headRepositoryOwner: { login: string };
}

interface MergedPR {
  number: number;
  title: string;
  mergedAt: string;
}

interface IssueLabel {
  name: string;
}

interface OpenIssue {
  number: number;
  title: string;
  labels: IssueLabel[];
  createdAt: string;
}

interface GitState {
  branch: string;
  uncommittedFiles: string[];
  recentCommits: string[];
}

interface BacklogDelta {
  totalFiles: number;
  byPriority: Record<string, number>;
}

interface ClaimBranch {
  name: string;
}

interface BranchState {
  current: string;
  ahead: number;
  behind: number;
  tracking: string | null;
}

interface PendingCIRun {
  id: number;
  status: string;
  workflowName: string;
  headBranch: string;
  createdAt: string;
}

export interface WorldviewSnapshot {
  owner: string;
  repo: string;
  queriedAt: string;
  summary: string;
  openPRs: OpenPR[];
  recentMerges: MergedPR[];
  openIssues: OpenIssue[];
  gitState: GitState;
  backlogDelta: BacklogDelta;
  claims: ClaimBranch[];
  branchState: BranchState;
  pendingCI: PendingCIRun[];
}

// --- CLI helpers (same pattern as poll-pr-gate.ts) ---

function runGhOrExit(args: string[], context: string): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- gh is a
  // standard CI/dev dependency invoked by name; convention used across
  // tools/github/poll-pr-gate.ts, tools/peer-call/, tools/audit-packages.ts.
  const result = spawnSync("gh", args, {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  if (result.error) {
    process.stderr.write(
      `${context}: failed to launch gh: ${result.error.message}\n`,
    );
    process.exit(1);
  }
  if (result.status !== 0) {
    process.stderr.write(
      `${context}: gh exited ${result.status}: ${result.stderr || result.stdout}\n`,
    );
    process.exit(2);
  }
  return result.stdout;
}

function runGitOrExit(args: string[], context: string): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- git is a
  // standard dev dependency invoked by name; used for local repo state queries.
  const result = spawnSync("git", args, {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  if (result.error) {
    process.stderr.write(
      `${context}: failed to launch git: ${result.error.message}\n`,
    );
    process.exit(1);
  }
  if (result.status !== 0) {
    process.stderr.write(
      `${context}: git exited ${result.status}: ${result.stderr || result.stdout}\n`,
    );
    process.exit(2);
  }
  return result.stdout;
}

function parseJsonOrExit<T>(raw: string, context: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${context}: JSON parse error: ${msg}\n`);
    process.stderr.write(
      `first 200 bytes of output: ${raw.slice(0, 200)}\n`,
    );
    process.exit(3);
  }
}

// --- Data fetchers ---

function fetchOpenPRs(owner: string, repo: string, limit: number): OpenPR[] {
  const stdout = runGhOrExit(
    [
      "pr",
      "list",
      "--repo",
      `${owner}/${repo}`,
      "--state",
      "open",
      "--json",
      "number,title,headRefName,createdAt,updatedAt,autoMergeRequest,reviewDecision,isCrossRepository,headRepositoryOwner",
      "--limit",
      String(limit),
    ],
    "fetchOpenPRs",
  );
  return parseJsonOrExit<OpenPR[]>(stdout, "fetchOpenPRs");
}

function fetchRecentMerges(
  owner: string,
  repo: string,
  limit: number,
): MergedPR[] {
  const stdout = runGhOrExit(
    [
      "pr",
      "list",
      "--repo",
      `${owner}/${repo}`,
      "--state",
      "merged",
      "--json",
      "number,title,mergedAt",
      "--limit",
      String(limit),
    ],
    "fetchRecentMerges",
  );
  return parseJsonOrExit<MergedPR[]>(stdout, "fetchRecentMerges");
}

function fetchOpenIssues(
  owner: string,
  repo: string,
  limit: number,
): OpenIssue[] {
  const stdout = runGhOrExit(
    [
      "issue",
      "list",
      "--repo",
      `${owner}/${repo}`,
      "--state",
      "open",
      "--json",
      "number,title,labels,createdAt",
      "--limit",
      String(limit),
    ],
    "fetchOpenIssues",
  );
  return parseJsonOrExit<OpenIssue[]>(stdout, "fetchOpenIssues");
}

function fetchGitState(): GitState {
  // Current branch — empty stdout means detached HEAD
  const branchStdout = runGitOrExit(
    ["branch", "--show-current"],
    "fetchGitState.branch",
  );
  const branch = branchStdout.trim() || "HEAD (detached)";

  // Uncommitted changes via git status --porcelain
  const statusStdout = runGitOrExit(
    ["status", "--porcelain"],
    "fetchGitState.status",
  );
  const uncommittedFiles = statusStdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  // Recent commits
  const logStdout = runGitOrExit(
    ["log", "--oneline", "-10"],
    "fetchGitState.log",
  );
  const recentCommits = logStdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return { branch, uncommittedFiles, recentCommits };
}

function fetchBacklogDelta(): BacklogDelta {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync(
    "find",
    ["docs/backlog", "-name", "B-*.md", "-type", "f"],
    { encoding: "utf8", maxBuffer: SPAWN_MAX_BUFFER },
  );
  const files = (result.stdout || "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const byPriority: Record<string, number> = {};
  for (const f of files) {
    const match = f.match(/docs\/backlog\/(P\d+)\//);
    const key = match ? match[1]! : "unknown";
    byPriority[key] = (byPriority[key] ?? 0) + 1;
  }
  return { totalFiles: files.length, byPriority };
}

function fetchClaimBranches(): ClaimBranch[] {
  const stdout = runGitOrExit(
    ["branch", "-r", "--list", "origin/claim/*"],
    "fetchClaimBranches",
  );
  return stdout
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => ({ name: l.replace(/^origin\//, "") }));
}

function fetchBranchState(): BranchState {
  const branchStdout = runGitOrExit(
    ["branch", "--show-current"],
    "fetchBranchState.branch",
  );
  const current = branchStdout.trim() || "HEAD (detached)";

  let tracking: string | null = null;
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const trackResult = spawnSync(
    "git",
    ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
    { encoding: "utf8", maxBuffer: SPAWN_MAX_BUFFER },
  );
  if (trackResult.status === 0 && trackResult.stdout.trim()) {
    tracking = trackResult.stdout.trim();
  }

  let ahead = 0;
  let behind = 0;
  const compareRef = tracking ?? "origin/main";
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const countResult = spawnSync(
    "git",
    ["rev-list", "--left-right", "--count", `${compareRef}...HEAD`],
    { encoding: "utf8", maxBuffer: SPAWN_MAX_BUFFER },
  );
  if (countResult.status === 0) {
    const parts = countResult.stdout.trim().split(/\s+/);
    behind = Number.parseInt(parts[0] ?? "0", 10) || 0;
    ahead = Number.parseInt(parts[1] ?? "0", 10) || 0;
  }

  return { current, ahead, behind, tracking };
}

function fetchPendingCI(owner: string, repo: string): PendingCIRun[] {
  const runs: PendingCIRun[] = [];
  for (const status of ["in_progress", "queued"]) {
    const stdout = runGhOrExit(
      [
        "run",
        "list",
        "--repo",
        `${owner}/${repo}`,
        "--status",
        status,
        "--json",
        "databaseId,status,workflowName,headBranch,createdAt",
        "--limit",
        "20",
      ],
      `fetchPendingCI(${status})`,
    );
    const parsed = parseJsonOrExit<
      Array<{
        databaseId: number;
        status: string;
        workflowName: string;
        headBranch: string;
        createdAt: string;
      }>
    >(stdout, `fetchPendingCI(${status})`);
    for (const r of parsed) {
      runs.push({
        id: r.databaseId,
        status: r.status,
        workflowName: r.workflowName,
        headBranch: r.headBranch,
        createdAt: r.createdAt,
      });
    }
  }
  return runs;
}

// --- Arg parsing ---

interface ParsedArgs {
  owner: string;
  repo: string;
  prLimit: number;
  mergeLimit: number;
  issueLimit: number;
}

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {
    owner: "Lucent-Financial-Group",
    repo: "Zeta",
    prLimit: 50,
    mergeLimit: 5,
    issueLimit: 20,
  };
  const requireValue = (flag: string, v: string | undefined): string => {
    if (v === undefined || v.startsWith("-")) {
      process.stderr.write(`${flag} requires a value\n`);
      process.exit(1);
    }
    return v;
  };
  const requirePositiveInt = (flag: string, v: string): number => {
    const n = Number.parseInt(v, 10);
    if (!Number.isFinite(n) || n <= 0) {
      process.stderr.write(
        `${flag} must be a positive integer (got ${v})\n`,
      );
      process.exit(1);
    }
    return n;
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;
    if (arg === "--owner") {
      out.owner = requireValue("--owner", argv[++i]);
    } else if (arg === "--repo") {
      out.repo = requireValue("--repo", argv[++i]);
    } else if (arg === "--pr-limit") {
      out.prLimit = requirePositiveInt(
        "--pr-limit",
        requireValue("--pr-limit", argv[++i]),
      );
    } else if (arg === "--merge-limit") {
      out.mergeLimit = requirePositiveInt(
        "--merge-limit",
        requireValue("--merge-limit", argv[++i]),
      );
    } else if (arg === "--issue-limit") {
      out.issueLimit = requirePositiveInt(
        "--issue-limit",
        requireValue("--issue-limit", argv[++i]),
      );
    } else if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        "Usage: refresh-worldview.ts [--owner X] [--repo Y]\n" +
          "       [--pr-limit N] [--merge-limit N] [--issue-limit N]\n" +
          "\n" +
          "Gathers open PRs, recent merges, open issues, and git state\n" +
          "into a single structured JSON snapshot for the refresh-before-\n" +
          "decide invariant.\n",
      );
      process.exit(0);
    } else {
      process.stderr.write(`unknown arg: ${arg}\n`);
      process.exit(1);
    }
  }
  return out;
}

// --- Summary builder ---

function plural(n: number, singular: string, pluralForm?: string): string {
  return `${n} ${n === 1 ? singular : (pluralForm ?? singular + "s")}`;
}

function buildSummary(
  openPRs: OpenPR[],
  recentMerges: MergedPR[],
  openIssues: OpenIssue[],
  gitState: GitState,
  backlogDelta: BacklogDelta,
  claims: ClaimBranch[],
  branchState: BranchState,
  pendingCI: PendingCIRun[],
): string {
  const parts: string[] = [];
  parts.push(plural(openPRs.length, "open PR"));
  parts.push(plural(recentMerges.length, "recent merge"));
  parts.push(plural(openIssues.length, "open issue"));
  parts.push(plural(claims.length, "claim"));
  parts.push(plural(backlogDelta.totalFiles, "backlog item"));
  if (pendingCI.length > 0)
    parts.push(plural(pendingCI.length, "CI run") + " pending");
  if (gitState.uncommittedFiles.length > 0)
    parts.push(plural(gitState.uncommittedFiles.length, "dirty file"));
  if (branchState.behind > 0) parts.push(`${branchState.behind} behind`);
  if (branchState.ahead > 0) parts.push(`${branchState.ahead} ahead`);
  return parts.join(", ");
}

// --- Main ---

export function main(argv: string[]): number {
  const args = parseArgs(argv);
  const openPRs = fetchOpenPRs(args.owner, args.repo, args.prLimit);
  const recentMerges = fetchRecentMerges(
    args.owner,
    args.repo,
    args.mergeLimit,
  );
  const openIssues = fetchOpenIssues(
    args.owner,
    args.repo,
    args.issueLimit,
  );
  const gitState = fetchGitState();
  const backlogDelta = fetchBacklogDelta();
  const claims = fetchClaimBranches();
  const branchState = fetchBranchState();
  const pendingCI = fetchPendingCI(args.owner, args.repo);

  const summary = buildSummary(
    openPRs,
    recentMerges,
    openIssues,
    gitState,
    backlogDelta,
    claims,
    branchState,
    pendingCI,
  );

  const snapshot: WorldviewSnapshot = {
    owner: args.owner,
    repo: args.repo,
    queriedAt: new Date().toISOString(),
    summary,
    openPRs,
    recentMerges,
    openIssues,
    gitState,
    backlogDelta,
    claims,
    branchState,
    pendingCI,
  };

  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
