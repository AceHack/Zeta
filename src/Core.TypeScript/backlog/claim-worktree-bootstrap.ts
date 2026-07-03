#!/usr/bin/env bun
// claim-worktree-bootstrap.ts -- create the git-native claim surface for a
// selected autonomous backlog row before any implementation edits happen.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

export interface BootstrapRequest {
  repoRoot: string;
  slug: string;
  backlogId: string;
  scope: string;
  durableTarget: string;
  paths: string[];
  sessionId: string;
  harness: string;
  claimedAt: string;
  eta: string;
  worktreeRoot: string;
  platformMirror: string;
}

export interface ActiveSignal {
  source: string;
  claim: string;
  paths: string[];
  updatedAt: string | null;
}

export interface PathOverlap {
  requestedPath: string;
  activePath: string;
  signal: ActiveSignal;
}

export interface BootstrapPlan {
  branch: string;
  worktreePath: string;
  claimRelativePath: string;
  claimFilePath: string;
  heartbeatFilePath: string;
  claimBody: string;
  heartbeatBody: string;
  commitSubject: string;
}

interface CommandResult {
  status: number;
  stdout: string;
  stderr: string;
}

export interface CommandRunner {
  run(command: string, args: readonly string[], options: { cwd?: string }): CommandResult;
}

interface CliArgs {
  request: BootstrapRequest;
  json: boolean;
  dryRun: boolean;
}

interface ParseState {
  request: BootstrapRequest;
  json: boolean;
  dryRun: boolean;
}

type ValueOptionHandler = (state: ParseState, value: string) => void;
type FlagOptionHandler = (state: ParseState) => void;

const GIT_BIN = "/usr/bin/git";
const CLAIM_PREFIX = "claim/";
const HEARTBEAT_NAME_PATTERN = /^[A-Za-z\d._/-]+$/;
const ZETA_ID_PATTERN = /^\d[\dA-HJKMNP-TV-Z]{25}$/;
const LEGACY_BACKLOG_ID_PATTERN = /^B-\d+(?:\.\d+)*$/;
const BACKLOG_SLUG_PATTERN = /^backlog-\d+(?:-\d+)*$/;
const BUG_SLUG_PATTERN = /^bug-\d+$/;
const ISSUE_SLUG_PATTERN = /^issue-[A-Za-z\d._-]+$/;
const TASK_SLUG_PATTERN = /^task-[a-z\d][a-z\d-]*$/;
const CLAIM_SLUG_PATTERNS = [BACKLOG_SLUG_PATTERN, BUG_SLUG_PATTERN, ISSUE_SLUG_PATTERN, TASK_SLUG_PATTERN];

const VALUE_OPTION_HANDLERS: Record<string, ValueOptionHandler> = {
  "--repo-root": (state, value) => {
    state.request.repoRoot = resolve(value);
    state.request.worktreeRoot = defaultWorktreeRoot(state.request.repoRoot);
  },
  "--worktree-root": (state, value) => {
    state.request.worktreeRoot = resolve(value);
  },
  "--slug": (state, value) => {
    state.request.slug = value;
  },
  "--backlog-id": (state, value) => {
    state.request.backlogId = value;
  },
  "--scope": (state, value) => {
    state.request.scope = value;
  },
  "--durable-target": (state, value) => {
    state.request.durableTarget = value;
  },
  "--path": (state, value) => {
    state.request.paths.push(value);
  },
  "--session-id": (state, value) => {
    state.request.sessionId = value;
  },
  "--claimed-at": (state, value) => {
    state.request.claimedAt = value;
  },
  "--eta": (state, value) => {
    state.request.eta = value;
  },
  "--platform-mirror": (state, value) => {
    state.request.platformMirror = value;
  },
};

const FLAG_OPTION_HANDLERS: Record<string, FlagOptionHandler> = {
  "--json": (state) => {
    state.json = true;
  },
  "--dry-run": (state) => {
    state.dryRun = true;
  },
};

function usage(): string {
  return [
    "Usage:",
    "  bun src/Core.TypeScript/backlog/claim-worktree-bootstrap.ts --slug backlog-0279 \\",
    "    --backlog-id 081KR2E4K0008QG0R000YTJS3Q --scope TEXT --durable-target PATH --path PATH [--path PATH...]",
    "",
    "Optional:",
    "  --repo-root DIR       Defaults to cwd",
    "  --worktree-root DIR   Defaults to ../Zeta-worktrees next to repo root",
    "  --session-id ID       Defaults to codex/<timestamp>-<slug>",
    "  --claimed-at ISO      Defaults to now",
    "  --eta ISO             Defaults to +45 minutes",
    "  --platform-mirror URL Defaults to GitHub PR pending",
    "  --dry-run             Emit the plan after overlap checks; do not write",
    "  --json                Emit JSON instead of text",
  ].join("\n");
}

function timestampId(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function plusMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function requireValue(flag: string, value: string | undefined): string {
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function defaultWorktreeRoot(repoRoot: string): string {
  return resolve(dirname(repoRoot), "Zeta-worktrees");
}

function parseArgs(argv: readonly string[], now = new Date()): CliArgs {
  const repoRoot = resolve(process.cwd());
  const state: ParseState = {
    request: {
      repoRoot,
      slug: "",
      backlogId: "",
      scope: "",
      durableTarget: "",
      paths: [],
      sessionId: "",
      harness: "codex",
      claimedAt: now.toISOString(),
      eta: plusMinutes(now, 45).toISOString(),
      worktreeRoot: defaultWorktreeRoot(repoRoot),
      platformMirror: "GitHub PR pending",
    },
    json: false,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? "";
    const valueHandler = VALUE_OPTION_HANDLERS[arg];
    if (valueHandler !== undefined) {
      valueHandler(state, requireValue(arg, argv[i + 1]));
      i++;
    } else if (FLAG_OPTION_HANDLERS[arg] !== undefined) {
      FLAG_OPTION_HANDLERS[arg](state);
    } else if (arg === "--help" || arg === "-h") {
      process.stdout.write(`${usage()}\n`);
      process.exit(0);
    } else {
      throw new Error(`unknown arg: ${arg}`);
    }
  }

  if (state.request.sessionId.length === 0 && state.request.slug.length > 0) {
    state.request.sessionId = `codex/${timestampId(now)}-${state.request.slug}`;
  }

  validateRequest(state.request);
  return state;
}

function validateSlug(slug: string): void {
  if (!CLAIM_SLUG_PATTERNS.some((pattern) => pattern.test(slug))) {
    throw new Error(`invalid claim slug: ${slug}`);
  }
}

function normalizeRepoPath(path: string): string {
  const noBackslash = path.replace(/\\/g, "/");
  const withoutDot = noBackslash.replace(/^\.\//, "");
  let end = withoutDot.length;
  while (end > 0 && withoutDot.charCodeAt(end - 1) === 47) {
    end--;
  }
  return withoutDot.slice(0, end);
}

function validateRepoPath(path: string): void {
  const normalized = normalizeRepoPath(path);
  if (
    normalized.length === 0 ||
    normalized === "." ||
    normalized.startsWith("/") ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    normalized === ".git" ||
    normalized.startsWith(".git/")
  ) {
    throw new Error(`unsafe repo-relative path: ${path}`);
  }
}

function validateRequest(request: BootstrapRequest): void {
  validateSlug(request.slug);
  if (!ZETA_ID_PATTERN.test(request.backlogId) && !LEGACY_BACKLOG_ID_PATTERN.test(request.backlogId)) {
    throw new Error(`invalid backlog id: ${request.backlogId}`);
  }
  if (request.scope.trim().length === 0) {
    throw new Error("--scope is required");
  }
  validateRepoPath(request.durableTarget);
  if (request.paths.length === 0) {
    throw new Error("at least one --path is required");
  }
  for (const path of request.paths) {
    validateRepoPath(path);
  }
  if (!HEARTBEAT_NAME_PATTERN.test(request.sessionId)) {
    throw new Error(`session id is not heartbeat-safe: ${request.sessionId}`);
  }
}

export function pathsOverlap(left: string, right: string): boolean {
  const a = normalizeRepoPath(left);
  const b = normalizeRepoPath(right);
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

export function findPathOverlaps(
  requestedPaths: readonly string[],
  activeSignals: readonly ActiveSignal[],
): PathOverlap[] {
  const overlaps: PathOverlap[] = [];
  for (const requestedPath of requestedPaths) {
    for (const signal of activeSignals) {
      for (const activePath of signal.paths) {
        if (pathsOverlap(requestedPath, activePath)) {
          overlaps.push({ requestedPath, activePath, signal });
        }
      }
    }
  }
  return overlaps;
}

function claimBody(request: BootstrapRequest, branch: string): string {
  const pathBullets = request.paths.map((path) => `- \`${normalizeRepoPath(path)}\``).join("\n");
  return [
    `# Claim - ${request.slug}`,
    "",
    `- **Session ID:** ${request.sessionId}`,
    `- **Harness:** ${request.harness}`,
    `- **Claimed at:** ${request.claimedAt}`,
    `- **ETA:** ${request.eta}`,
    `- **Scope:** ${request.scope}`,
    `- **Durable target:** ${normalizeRepoPath(request.durableTarget)}`,
    `- **Platform mirror:** ${request.platformMirror}`,
    "",
    "## Notes",
    "",
    `Branch: \`${branch}\``,
    "",
    "Initial intended path set:",
    "",
    pathBullets,
    "",
  ].join("\n");
}

function heartbeatBody(request: BootstrapRequest, branch: string, worktreePath: string): string {
  return `${JSON.stringify(
    {
      session: request.sessionId,
      harness: request.harness,
      claim: request.slug,
      branch,
      worktree: worktreePath,
      paths: request.paths.map(normalizeRepoPath),
      updated_at: request.claimedAt,
      status: "active",
    },
    null,
    2,
  )}\n`;
}

export function buildBootstrapPlan(request: BootstrapRequest, gitCommonDir: string): BootstrapPlan {
  validateRequest(request);
  const branch = `${CLAIM_PREFIX}${request.slug}`;
  const worktreePath = resolve(request.worktreeRoot, request.slug);
  const claimRelativePath = `docs/claims/${request.slug}.md`;
  const heartbeatFilePath = join(gitCommonDir, "agent-heartbeats", `${request.sessionId.replace(/\//g, "-")}.json`);
  return {
    branch,
    worktreePath,
    claimRelativePath,
    claimFilePath: join(worktreePath, claimRelativePath),
    heartbeatFilePath,
    claimBody: claimBody(request, branch),
    heartbeatBody: heartbeatBody(request, branch, worktreePath),
    commitSubject: `claim: ${request.slug} - ${request.scope}`,
  };
}

function spawnRunner(): CommandRunner {
  return {
    run(command: string, args: readonly string[], options: { cwd?: string }): CommandResult {
      const result = spawnSync(command, [...args], {
        cwd: options.cwd,
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024,
      });
      return {
        status: result.status ?? 1,
        stdout: result.stdout,
        stderr: result.stderr.length > 0 ? result.stderr : String(result.error ?? ""),
      };
    },
  };
}

function git(runner: CommandRunner, repoRoot: string, args: readonly string[]): CommandResult {
  return runner.run(GIT_BIN, ["-C", repoRoot, ...args], {});
}

function mustGit(runner: CommandRunner, repoRoot: string, args: readonly string[]): string {
  const result = git(runner, repoRoot, args);
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function optionalGitLines(runner: CommandRunner, repoRoot: string, args: readonly string[]): string[] {
  const result = git(runner, repoRoot, args);
  if (result.status !== 0) {
    return [];
  }
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function gitCommonDir(runner: CommandRunner, repoRoot: string): string {
  const raw = mustGit(runner, repoRoot, ["rev-parse", "--git-common-dir"]);
  return isAbsolute(raw) ? raw : resolve(repoRoot, raw);
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function readLocalHeartbeatSignals(commonDir: string): ActiveSignal[] {
  const dir = join(commonDir, "agent-heartbeats");
  if (!isDirectory(dir)) {
    return [];
  }
  const signals: ActiveSignal[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }
    const file = join(dir, entry.name);
    try {
      const parsed = JSON.parse(readFileSync(file, "utf8")) as {
        claim?: string;
        paths?: unknown;
        updated_at?: string;
      };
      if (Array.isArray(parsed.paths)) {
        signals.push({
          source: file,
          claim: parsed.claim ?? entry.name.replace(/\.json$/, ""),
          paths: parsed.paths.filter((path): path is string => typeof path === "string"),
          updatedAt: parsed.updated_at ?? null,
        });
      }
    } catch {
      continue;
    }
  }
  return signals;
}

function readRemoteClaimSignals(runner: CommandRunner, repoRoot: string, targetBranch: string): ActiveSignal[] {
  const branches = optionalGitLines(runner, repoRoot, ["branch", "-r", "--list", "origin/claim/*"]);
  return branches
    .filter((branch) => branch !== `origin/${targetBranch}`)
    .map((branch): ActiveSignal => {
      const paths = optionalGitLines(runner, repoRoot, ["diff", "--name-only", `origin/main...${branch}`]);
      return {
        source: branch,
        claim: branch.replace(/^origin\/claim\//, ""),
        paths,
        updatedAt: null,
      };
    });
}

function ensureNoExistingClaim(runner: CommandRunner, repoRoot: string, plan: BootstrapPlan): void {
  const remoteBranch = git(runner, repoRoot, ["ls-remote", "--heads", "origin", plan.branch]);
  if (remoteBranch.status === 0 && remoteBranch.stdout.trim().length > 0) {
    throw new Error(`claim branch already exists: ${plan.branch}`);
  }
  const claimOnMain = git(runner, repoRoot, ["cat-file", "-e", `origin/main:${plan.claimRelativePath}`]);
  if (claimOnMain.status === 0) {
    throw new Error(`claim file already exists on origin/main: ${plan.claimRelativePath}`);
  }
}

export function collectActiveSignals(
  runner: CommandRunner,
  repoRoot: string,
  gitCommonDirPath: string,
  targetBranch: string,
): ActiveSignal[] {
  return [...readRemoteClaimSignals(runner, repoRoot, targetBranch), ...readLocalHeartbeatSignals(gitCommonDirPath)];
}

export function assertNoPathOverlaps(paths: readonly string[], signals: readonly ActiveSignal[]): void {
  const overlaps = findPathOverlaps(paths, signals);
  if (overlaps.length === 0) {
    return;
  }
  const details = overlaps
    .map((overlap) => `${overlap.requestedPath} overlaps ${overlap.signal.source}:${overlap.activePath}`)
    .join("\n");
  throw new Error(`active claim/path overlap detected:\n${details}`);
}

function writePlanFiles(plan: BootstrapPlan): void {
  mkdirSync(dirname(plan.heartbeatFilePath), { recursive: true });
  writeFileSync(plan.heartbeatFilePath, plan.heartbeatBody);
  mkdirSync(dirname(plan.claimFilePath), { recursive: true });
  writeFileSync(plan.claimFilePath, plan.claimBody);
}

export function executeBootstrap(request: BootstrapRequest, runner: CommandRunner = spawnRunner()): BootstrapPlan {
  const repoRoot = resolve(request.repoRoot);
  mustGit(runner, repoRoot, ["fetch", "--prune", "origin"]);
  const commonDir = gitCommonDir(runner, repoRoot);
  const plan = buildBootstrapPlan({ ...request, repoRoot }, commonDir);
  ensureNoExistingClaim(runner, repoRoot, plan);
  assertNoPathOverlaps(request.paths, collectActiveSignals(runner, repoRoot, commonDir, plan.branch));
  if (existsSync(plan.worktreePath)) {
    throw new Error(`worktree path already exists: ${plan.worktreePath}`);
  }

  mkdirSync(request.worktreeRoot, { recursive: true });
  mustGit(runner, repoRoot, ["worktree", "add", "-b", plan.branch, plan.worktreePath, "origin/main"]);
  writePlanFiles(plan);
  mustGit(runner, plan.worktreePath, ["add", plan.claimRelativePath]);
  mustGit(runner, plan.worktreePath, [
    "commit",
    "-m",
    plan.commitSubject,
    "-m",
    "Co-Authored-By: Codex <noreply@openai.com>",
  ]);
  mustGit(runner, plan.worktreePath, ["push", "-u", "origin", plan.branch]);
  return plan;
}

function planOnly(request: BootstrapRequest, runner: CommandRunner): BootstrapPlan {
  const repoRoot = resolve(request.repoRoot);
  mustGit(runner, repoRoot, ["fetch", "--prune", "origin"]);
  const commonDir = gitCommonDir(runner, repoRoot);
  const plan = buildBootstrapPlan({ ...request, repoRoot }, commonDir);
  ensureNoExistingClaim(runner, repoRoot, plan);
  assertNoPathOverlaps(request.paths, collectActiveSignals(runner, repoRoot, commonDir, plan.branch));
  return plan;
}

function printPlan(plan: BootstrapPlan, json: boolean): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    return;
  }
  process.stdout.write(`claim-branch: ${plan.branch}\n`);
  process.stdout.write(`worktree: ${plan.worktreePath}\n`);
  process.stdout.write(`claim-file: ${plan.claimRelativePath}\n`);
  process.stdout.write(`heartbeat: ${plan.heartbeatFilePath}\n`);
}

export function main(argv: readonly string[]): number {
  try {
    const { request, json, dryRun } = parseArgs(argv);
    const plan = dryRun ? planOnly(request, spawnRunner()) : executeBootstrap(request);
    printPlan(plan, json);
    return 0;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${usage()}\n`);
    return 1;
  }
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
