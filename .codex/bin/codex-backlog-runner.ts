#!/usr/bin/env bun
// codex-backlog-runner.ts -- Tier 1 parallel trajectory/backlog pickup gate.
//
// This runner is intentionally a gate, not an unattended broad executor. It
// keeps a bounded number of non-overlapping PRs in flight. While the open PR
// count is below capacity, it picks trajectory enhancement first, then falls
// back to backlog pickup.

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

interface GateResult {
  status: "wait-pr-capacity" | "ready";
  openPrCount: number;
  totalOpenPrCount: number;
  capacityHeadPrefixes: string[];
  maxOpenPrs: number;
  availablePrSlots: number;
  activeClaims: string[];
  pickupSource: "trajectory" | "backlog" | null;
  pickup: unknown | null;
}

interface PickupStatus {
  status?: string;
}

export interface OpenPrListItem {
  number?: number;
  headRefName?: string;
  title?: string;
}

export interface RemoteClaimDiff {
  branch: string;
  paths: readonly string[];
}

export interface HeartbeatSignal {
  claim?: string;
  paths?: unknown;
  updated_at?: string;
  status?: string;
}

interface CapacityGate {
  status: "wait-pr-capacity" | "ready";
  availablePrSlots: number;
}

const DEFAULT_MAX_OPEN_PRS = 3;
const DEFAULT_CAPACITY_HEAD_PREFIXES = ["codex/"];
const HEARTBEAT_STALE_MS = 30 * 60 * 1000;

function usage(): string {
  return [
    "Usage:",
    "  bun .codex/bin/codex-backlog-runner.ts [--json] [--repo-root DIR] [--max-open-prs N] [--capacity-head-prefixes PREFIX[,PREFIX...]]",
    "",
    "Runs while capacity-scoped open PR count is below the bounded parallel PR capacity.",
    "Emits a trajectory-first pickup prompt, then falls back to backlog",
    "pickup when no trajectory action is available.",
    "By default, capacity is scoped to Codex PR branches (codex/).",
    "Use --capacity-head-prefixes all to restore global open-PR counting.",
  ].join("\n");
}

function positiveInteger(flag: string, value: string): number {
  if (!/^[1-9][0-9]*$/.test(value)) {
    throw new Error(`${flag} must be a positive integer`);
  }
  return Number(value);
}

function parseMaxOpenPrsFromEnv(): number {
  const raw = process.env.CODEX_BACKLOG_RUNNER_MAX_OPEN_PRS ?? process.env.ZETA_MAX_OPEN_PRS;
  return raw === undefined || raw.trim().length === 0 ? DEFAULT_MAX_OPEN_PRS : positiveInteger("CODEX_BACKLOG_RUNNER_MAX_OPEN_PRS", raw.trim());
}

function parseCapacityHeadPrefixes(value: string | undefined): string[] {
  if (value === undefined || value.trim().length === 0) {
    return DEFAULT_CAPACITY_HEAD_PREFIXES;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "all" || normalized === "*") {
    return [];
  }
  return uniqueSorted(
    value
      .split(",")
      .map((prefix) => normalizeHeadPrefix(prefix))
      .filter(Boolean),
  );
}

function parseCapacityHeadPrefixesFromEnv(): string[] {
  return parseCapacityHeadPrefixes(process.env.CODEX_BACKLOG_RUNNER_CAPACITY_HEAD_PREFIXES);
}

function parseArgs(argv: string[]): { json: boolean; repoRoot: string; maxOpenPrs: number; capacityHeadPrefixes: string[] } {
  const out = {
    json: false,
    repoRoot: process.cwd(),
    maxOpenPrs: parseMaxOpenPrsFromEnv(),
    capacityHeadPrefixes: parseCapacityHeadPrefixesFromEnv(),
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") {
      out.json = true;
    } else if (arg === "--repo-root") {
      const value = argv[++i];
      if (value === undefined || value.startsWith("--")) {
        throw new Error("--repo-root requires a value");
      }
      out.repoRoot = value;
    } else if (arg === "--max-open-prs") {
      const value = argv[++i];
      if (value === undefined || value.startsWith("--")) {
        throw new Error("--max-open-prs requires a value");
      }
      out.maxOpenPrs = positiveInteger("--max-open-prs", value);
    } else if (arg === "--capacity-head-prefixes") {
      const value = argv[++i];
      if (value === undefined || value.startsWith("--")) {
        throw new Error("--capacity-head-prefixes requires a value");
      }
      out.capacityHeadPrefixes = parseCapacityHeadPrefixes(value);
    } else if (arg === "--help" || arg === "-h") {
      process.stdout.write(`${usage()}\n`);
      process.exit(0);
    } else {
      throw new Error(`unknown arg: ${arg}`);
    }
  }
  out.repoRoot = resolve(out.repoRoot);
  return out;
}

function run(repoRoot: string, command: string, args: string[]): { status: number; stdout: string; stderr: string } {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${process.env.HOME ?? "/Users/acehack"}/.bun/bin`,
    },
    maxBuffer: 32 * 1024 * 1024,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? String(result.error ?? ""),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseOpenPrListOutput(stdout: string): OpenPrListItem[] {
  const prs: OpenPrListItem[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const encoded = line.trim();
    if (encoded.length === 0) {
      continue;
    }
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as unknown;
    if (!isRecord(parsed)) {
      throw new Error(`gh api returned a non-object open PR row: ${decoded}`);
    }

    const pr: OpenPrListItem = {};
    if (typeof parsed.number === "number") {
      pr.number = parsed.number;
    }
    if (typeof parsed.headRefName === "string") {
      pr.headRefName = parsed.headRefName;
    }
    if (typeof parsed.title === "string") {
      pr.title = parsed.title;
    }
    prs.push(pr);
  }
  return prs;
}

function openPrList(repoRoot: string): OpenPrListItem[] {
  const result = run(repoRoot, "gh", [
    "api",
    "--paginate",
    "repos/{owner}/{repo}/pulls?state=open&per_page=100",
    "--jq",
    ".[] | {number: .number, headRefName: .head.ref, title: .title} | @base64",
  ]);
  if (result.status !== 0) {
    throw new Error(`gh api --paginate failed while reading capacity signals: ${result.stderr || result.stdout}`);
  }
  return parseOpenPrListOutput(result.stdout);
}

function normalizeHeadPrefix(prefix: string): string {
  return prefix.trim().toLowerCase();
}

export function capacityPrCount(openPrs: readonly OpenPrListItem[], headPrefixes: readonly string[]): number {
  if (headPrefixes.length === 0) {
    return openPrs.length;
  }
  const normalizedPrefixes = headPrefixes.map(normalizeHeadPrefix).filter(Boolean);
  return openPrs.filter((pr) => {
    const headRefName = (pr.headRefName ?? "").toLowerCase();
    return normalizedPrefixes.some((prefix) => headRefName.startsWith(prefix));
  }).length;
}

export function activeClaimsFromOpenPrs(openPrs: readonly OpenPrListItem[]): string[] {
  const claims: string[] = [];
  for (const pr of openPrs) {
    if (pr.headRefName !== undefined && pr.headRefName.trim().length > 0) {
      claims.push(pr.headRefName.trim());
    }
    if (pr.title !== undefined && pr.title.trim().length > 0) {
      claims.push(`pr-${pr.number ?? "unknown"}:${pr.title.trim()}`);
    }
  }
  return [...new Set(claims)].sort((a, b) => a.localeCompare(b));
}

function openPrActiveClaims(repoRoot: string, openPrs?: readonly OpenPrListItem[]): string[] {
  return activeClaimsFromOpenPrs(openPrs ?? openPrList(repoRoot));
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))].sort((a, b) => a.localeCompare(b));
}

export function activeClaimsFromRemoteClaimDiffs(remoteClaims: readonly RemoteClaimDiff[]): string[] {
  const claims: string[] = [];
  for (const signal of remoteClaims) {
    const branch = signal.branch.trim().replace(/^origin\//, "");
    if (branch.length > 0) {
      claims.push(branch);
    }
    for (const path of signal.paths) {
      const normalizedPath = path.trim().replaceAll("\\", "/");
      if (branch.length > 0 && normalizedPath.length > 0) {
        claims.push(`${branch}:${normalizedPath}`);
      }
      if (normalizedPath.length > 0) {
        claims.push(normalizedPath);
      }
    }
  }
  return uniqueSorted(claims);
}

function isTerminalHeartbeat(status: string | undefined): boolean {
  const normalized = status?.trim().toLowerCase() ?? "";
  return (
    normalized === "merged-cleaned" ||
    normalized === "merged-cleanup-complete" ||
    normalized === "stale-cleanup-complete" ||
    normalized === "cleanup-complete" ||
    normalized === "complete" ||
    normalized === "released" ||
    normalized === "abandoned" ||
    normalized === "done"
  );
}

function isFreshHeartbeat(updatedAt: string | undefined, now: Date, staleMs: number): boolean {
  if (updatedAt === undefined || updatedAt.trim().length === 0) {
    return true;
  }
  const updated = Date.parse(updatedAt);
  if (!Number.isFinite(updated)) {
    return true;
  }
  return Math.abs(now.getTime() - updated) <= staleMs;
}

export function activeClaimsFromHeartbeatSignals(
  signals: readonly HeartbeatSignal[],
  now: Date = new Date(),
  staleMs: number = HEARTBEAT_STALE_MS,
): string[] {
  const claims: string[] = [];
  for (const signal of signals) {
    if (isTerminalHeartbeat(signal.status) || !isFreshHeartbeat(signal.updated_at, now, staleMs)) {
      continue;
    }
    const claim = signal.claim?.trim() || "unknown-heartbeat";
    claims.push(`heartbeat:${claim}`);
    if (!Array.isArray(signal.paths)) {
      continue;
    }
    for (const rawPath of signal.paths) {
      if (typeof rawPath !== "string") {
        continue;
      }
      const normalizedPath = rawPath.trim().replaceAll("\\", "/");
      if (normalizedPath.length === 0) {
        continue;
      }
      claims.push(normalizedPath);
      claims.push(`heartbeat:${claim}:${normalizedPath}`);
    }
  }
  return uniqueSorted(claims);
}

function gitLines(repoRoot: string, args: string[]): string[] {
  const result = run(repoRoot, "git", args);
  if (result.status !== 0) {
    return [];
  }
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function remoteClaimDiffs(repoRoot: string): RemoteClaimDiff[] {
  return gitLines(repoRoot, ["branch", "-r", "--list", "origin/claim/*"]).map((branch) => ({
    branch,
    paths: gitLines(repoRoot, ["diff", "--name-only", `origin/main...${branch}`]),
  }));
}

function gitCommonDir(repoRoot: string): string | null {
  const raw = gitLines(repoRoot, ["rev-parse", "--git-common-dir"])[0];
  if (raw === undefined) {
    return null;
  }
  return isAbsolute(raw) ? raw : resolve(repoRoot, raw);
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function heartbeatSignals(repoRoot: string): HeartbeatSignal[] {
  const commonDir = gitCommonDir(repoRoot);
  if (commonDir === null) {
    return [];
  }
  const dir = join(commonDir, "agent-heartbeats");
  if (!isDirectory(dir)) {
    return [];
  }

  const signals: HeartbeatSignal[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }
    const file = join(dir, entry.name);
    try {
      const parsed = JSON.parse(readFileSync(file, "utf8")) as HeartbeatSignal;
      signals.push(parsed);
    } catch {
      continue;
    }
  }
  return signals;
}

function activeClaims(repoRoot: string, openPrs?: readonly OpenPrListItem[]): string[] {
  return uniqueSorted([
    ...openPrActiveClaims(repoRoot, openPrs),
    ...activeClaimsFromRemoteClaimDiffs(remoteClaimDiffs(repoRoot)),
    ...activeClaimsFromHeartbeatSignals(heartbeatSignals(repoRoot)),
  ]);
}

function runPicker(repoRoot: string, script: string, activeClaims: readonly string[]): unknown {
  const claimArgs = activeClaims.flatMap((claim) => ["--active-claim", claim]);
  const result = run(repoRoot, "bun", [script, "--json", ...claimArgs]);
  if (result.status !== 0) {
    throw new Error(`${script} failed: ${result.stderr || result.stdout}`);
  }
  return JSON.parse(result.stdout) as unknown;
}

function isSelected(pickup: unknown): boolean {
  return typeof pickup === "object" && pickup !== null && (pickup as PickupStatus).status === "selected";
}

export function capacityGate(openPrCount: number, maxOpenPrs: number): CapacityGate {
  const availablePrSlots = Math.max(0, maxOpenPrs - openPrCount);
  return {
    status: openPrCount >= maxOpenPrs ? "wait-pr-capacity" : "ready",
    availablePrSlots,
  };
}

function pickup(repoRoot: string, activeClaims: readonly string[]): { source: "trajectory" | "backlog" | null; value: unknown | null } {
  const trajectory = runPicker(repoRoot, "tools/trajectories/autonomous-pickup.ts", activeClaims);
  if (isSelected(trajectory)) {
    return { source: "trajectory", value: trajectory };
  }

  const backlog = runPicker(repoRoot, "tools/backlog/autonomous-pickup.ts", activeClaims);
  return { source: "backlog", value: backlog };
}

function printText(result: GateResult): void {
  const scope =
    result.capacityHeadPrefixes.length === 0 ? "all" : result.capacityHeadPrefixes.join(",");
  if (result.status === "wait-pr-capacity") {
    process.stdout.write(
      `wait-pr-capacity: ${result.openPrCount}/${result.maxOpenPrs} capacity PR slot(s) used (scope=${scope}; total_open=${result.totalOpenPrCount})\n`,
    );
    return;
  }
  process.stdout.write(
    `pr-capacity: ${result.openPrCount}/${result.maxOpenPrs} capacity-scoped open, ${result.availablePrSlots} slot(s) available (scope=${scope}; total_open=${result.totalOpenPrCount})\n`,
  );
  process.stdout.write(`pickup-source: ${result.pickupSource ?? "none"}\n`);
  process.stdout.write(`${JSON.stringify(result.pickup, null, 2)}\n`);
}

export function main(argv: string[]): number {
  let args: { json: boolean; repoRoot: string; maxOpenPrs: number; capacityHeadPrefixes: string[] };
  try {
    args = parseArgs(argv);
    const openPrs = openPrList(args.repoRoot);
    const count = capacityPrCount(openPrs, args.capacityHeadPrefixes);
    const gate = capacityGate(count, args.maxOpenPrs);
    const claims = gate.status === "ready" ? activeClaims(args.repoRoot, openPrs) : [];
    const selected = gate.status === "ready" ? pickup(args.repoRoot, claims) : { source: null, value: null };
    const result: GateResult = {
      status: gate.status,
      openPrCount: count,
      totalOpenPrCount: openPrs.length,
      capacityHeadPrefixes: args.capacityHeadPrefixes,
      maxOpenPrs: args.maxOpenPrs,
      availablePrSlots: gate.availablePrSlots,
      activeClaims: claims,
      pickupSource: selected.source,
      pickup: selected.value,
    };

    if (args.json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      printText(result);
    }
    return 0;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${usage()}\n`);
    return 1;
  }
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
