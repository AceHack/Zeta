import { spawnSync } from "node:child_process";
/**
 * forge-host/github/github-adapter.ts — GitHub implementation of ForgeHost.
 *
 * Wraps the `gh` CLI and GitHub GraphQL/REST APIs behind the ForgeHost interface.
 * All methods return Result<T, ForgeError> — never throw.
 */

import type { ForgeHost } from "../forge-host";
import type {
  Result,
  ForgeError,
  PullRequest,
  PrGateState,
  Issue,
  CheckRollup,
  CheckSummary,
  CiRun,
  RepoInfo,
  BranchProtection,
  ThreadResolution,
  BatchResult,
  CommentRef,
  TreeEntry,
  CreateCommitOpts,
  ListPrOpts,
  ListMergedPrOpts,
  CreatePrOpts,
  ListIssueOpts,
  CreateIssueOpts,
  MergeMethod,
  NextAction,
  CheckDefinition,
  CheckObservationOpts,
  CheckObservationPass,
} from "../types";
import { ok, err, forgeError } from "../result";
import { runGh, runGhJson } from "./gh-cli";
import { classifyGhError } from "./classify-error";
import { listGitHubCheckDefinitions, listGitHubCheckObservations } from "./check-observations.ts";

// ─── GitHub-specific raw response types ─────────────────────────────────────

interface GhPrListItem {
  number: number;
  title: string;
  headRefName: string;
  baseRefName: string;
  state: string;
  isDraft: boolean;
  mergeStateStatus: string;
  reviewDecision: string | null;
  url: string;
  updatedAt: string;
  author: { login: string };
}

// ─── Adapter ────────────────────────────────────────────────────────────────

export class GitHubAdapter implements ForgeHost {
  readonly forgeName = "github";
  /** Provenance stamped on every check definition and observation this adapter emits. */
  readonly sourceName = "github-actions";
  private readonly owner: string;
  private readonly repo: string;

  /**
   * `repoRoot` is where workflow SOURCES are read from, to derive each check's
   * expectation from the substrate's own `on:` declaration. `checkRef` is the ref
   * expectations are relative to (a PR-only workflow is on-demand *for main*).
   */
  private readonly repoRoot: string;
  private readonly checkRef: string;

  constructor(owner: string, repo: string, opts?: { readonly repoRoot?: string; readonly checkRef?: string }) {
    this.owner = owner;
    this.repo = repo;
    this.repoRoot = opts?.repoRoot ?? process.cwd();
    this.checkRef = opts?.checkRef ?? "main";
  }

  private get nwo(): string {
    return `${this.owner}/${this.repo}`;
  }

  // ─── Check observations (the drift dashboard's producer half) ───────────
  //
  // Delegated to ./check-observations.ts so the GitHub-specific mapping is testable
  // without an adapter instance and without `gh`. The roster is enumerated from
  // ACTIVE WORKFLOWS and the verdicts are LATEST-PER-WORKFLOW — never a run-list
  // window, which on this repo contained only 22 of 81 workflows when measured.

  async listCheckDefinitions(
    opts?: CheckObservationOpts,
  ): Promise<Result<readonly CheckDefinition[], ForgeError>> {
    void opts;
    return listGitHubCheckDefinitions(this.nwo, this.checkRef, { repoRoot: this.repoRoot }, this.sourceName);
  }

  async listLatestCheckObservations(
    ref: string,
    definitions: readonly CheckDefinition[],
    opts?: CheckObservationOpts,
  ): Promise<Result<CheckObservationPass, ForgeError>> {
    return listGitHubCheckObservations(this.nwo, ref, definitions, { repoRoot: this.repoRoot }, this.sourceName, opts);
  }

  // ─── PR state ───────────────────────────────────────────────────────────

  async listOpenPullRequests(opts?: ListPrOpts): Promise<Result<readonly PullRequest[], ForgeError>> {
    const limit = opts?.limit ?? 100;
    const result = runGhJson<GhPrListItem[]>([
      "pr", "list", "--repo", this.nwo, "--state", "open",
      "--json", "number,title,headRefName,baseRefName,state,isDraft,mergeStateStatus,reviewDecision,url,updatedAt,author",
      "--limit", String(limit),
    ]);
    if (!result.ok) return result;
    return ok(result.value.map(mapPr));
  }

  async getPullRequest(number: number): Promise<Result<PullRequest, ForgeError>> {
    const result = runGhJson<GhPrListItem>([
      "pr", "view", String(number), "--repo", this.nwo,
      "--json", "number,title,headRefName,baseRefName,state,isDraft,mergeStateStatus,reviewDecision,url,updatedAt,author",
    ]);
    if (!result.ok) return result;
    return ok(mapPr(result.value));
  }

  async getPrGateState(number: number): Promise<Result<PrGateState, ForgeError>> {
    // Fetch PR + statusCheckRollup + reviewThreads in one call
    const prResult = runGhJson<{
      number: number;
      state: string;
      mergeStateStatus: string;
      autoMergeRequest: { enabledAt?: string } | null;
      mergeCommit: { oid: string } | null;
      statusCheckRollup: { status?: string; conclusion?: string; name?: string }[];
      reviewThreads: { nodes: { isResolved: boolean }[] };
    }>([
      "pr", "view", String(number), "--repo", this.nwo,
      "--json", "number,state,mergeStateStatus,autoMergeRequest,mergeCommit,statusCheckRollup,reviewThreads",
    ]);
    if (!prResult.ok) return prResult;

    const pr = prResult.value;
    const rollup = pr.statusCheckRollup ?? [];
    const checks = classifyChecks(rollup);
    const unresolvedThreads = (pr.reviewThreads?.nodes ?? []).filter(t => !t.isResolved).length;

    // Fetch required checks
    let requiredChecks = checks; // fallback: treat all as required
    const reqResult = runGhJson<{ name?: string }[]>([
      "pr", "checks", String(number), "--repo", this.nwo, "--required", "--json", "name",
    ]);
    if (reqResult.ok) {
      const requiredNames = new Set(reqResult.value.map(r => r.name).filter((n): n is string => !!n));
      requiredChecks = classifyChecks(rollup.filter(c => c.name && requiredNames.has(c.name)));
    }

    const state = mapPrState(pr.state);
    const gate = classifyGate(pr.mergeStateStatus, pr.state, requiredChecks, unresolvedThreads);
    const warnings: string[] = [];
    const nextAction = computeNextAction(state, gate, requiredChecks, unresolvedThreads);

    return ok({
      number: pr.number,
      state,
      gate,
      checks,
      requiredChecks,
      unresolvedThreads,
      autoMerge: pr.autoMergeRequest ? "armed" : "none",
      mergeCommit: pr.mergeCommit?.oid ?? null,
      warnings,
      nextAction,
    });
  }

  async listMergedPullRequests(opts?: ListMergedPrOpts): Promise<Result<readonly PullRequest[], ForgeError>> {
    const limit = opts?.limit ?? 20;
    const result = runGhJson<GhPrListItem[]>([
      "pr", "list", "--repo", this.nwo, "--state", "merged",
      "--json", "number,title,headRefName,baseRefName,state,isDraft,mergeStateStatus,reviewDecision,url,updatedAt,author",
      "--limit", String(limit),
    ]);
    if (!result.ok) return result;
    return ok(result.value.map(mapPr));
  }

  // ─── PR actions ─────────────────────────────────────────────────────────

  async resolveThread(threadId: string, body: string): Promise<Result<void, ForgeError>> {
    // Reply then resolve
    const replyResult = runGh([
      "api", "graphql",
      "-F", `thread_id=${threadId}`,
      "-F", `body=${body}`,
      "-f", `query=mutation($thread_id: ID!, $body: String!) { addPullRequestReviewThreadReply(input: { pullRequestReviewThreadId: $thread_id, body: $body }) { comment { id } } }`,
    ]);
    if (!replyResult.ok) return replyResult;

    const resolveResult = runGh([
      "api", "graphql",
      "-F", `thread_id=${threadId}`,
      "-f", `query=mutation($thread_id: ID!) { resolveReviewThread(input: { threadId: $thread_id }) { thread { isResolved } } }`,
    ]);
    if (!resolveResult.ok) return resolveResult;

    return ok(undefined);
  }

  async resolveThreadsBatch(threads: readonly ThreadResolution[]): Promise<Result<BatchResult, ForgeError>> {
    let resolved = 0;
    const failed: { threadId: string; error: ForgeError }[] = [];

    for (const t of threads) {
      const result = await this.resolveThread(t.threadId, t.body);
      if (result.ok) {
        resolved++;
      } else {
        failed.push({ threadId: t.threadId, error: result.error });
      }
    }

    return ok({ resolved, failed });
  }

  async createPullRequest(opts: CreatePrOpts): Promise<Result<PullRequest, ForgeError>> {
    const args = [
      "pr", "create", "--repo", this.nwo,
      "--title", opts.title, "--body", opts.body,
      "--head", opts.head, "--base", opts.base,
    ];
    if (opts.draft) args.push("--draft");
    args.push("--json", "number,title,headRefName,baseRefName,state,isDraft,mergeStateStatus,reviewDecision,url,updatedAt,author");

    const result = runGhJson<GhPrListItem>(args);
    if (!result.ok) return result;
    return ok(mapPr(result.value));
  }

  async enableAutoMerge(prNumber: number, method?: MergeMethod): Promise<Result<void, ForgeError>> {
    const args = ["pr", "merge", String(prNumber), "--repo", this.nwo, "--auto"];
    if (method === "squash") args.push("--squash");
    else if (method === "rebase") args.push("--rebase");
    else args.push("--merge");

    const result = runGh(args);
    if (!result.ok) return result;
    return ok(undefined);
  }

  async addPrComment(prNumber: number, body: string): Promise<Result<CommentRef, ForgeError>> {
    const result = runGh([
      "pr", "comment", String(prNumber), "--repo", this.nwo, "--body", body,
    ]);
    if (!result.ok) return result;
    return ok({ id: "", url: `https://github.com/${this.nwo}/pull/${prNumber}` });
  }

  // ─── Issues ─────────────────────────────────────────────────────────────

  async listOpenIssues(opts?: ListIssueOpts): Promise<Result<readonly Issue[], ForgeError>> {
    const limit = opts?.limit ?? 50;
    const args = [
      "issue", "list", "--repo", this.nwo, "--state", "open",
      "--json", "number,title,body,state,url,labels",
      "--limit", String(limit),
    ];
    if (opts?.labels?.length) {
      for (const l of opts.labels) args.push("--label", l);
    }

    const result = runGhJson<{ number: number; title: string; body: string; state: string; url: string; labels: { name: string }[] }[]>(args);
    if (!result.ok) return result;
    return ok(result.value.map(i => ({
      number: i.number,
      title: i.title,
      body: i.body ?? "",
      state: i.state.toLowerCase() as "open" | "closed",
      url: i.url,
      labels: i.labels.map(l => l.name),
    })));
  }

  async createIssue(opts: CreateIssueOpts): Promise<Result<Issue, ForgeError>> {
    const args = [
      "issue", "create", "--repo", this.nwo,
      "--title", opts.title, "--body", opts.body,
    ];
    if (opts.labels?.length) {
      for (const l of opts.labels) args.push("--label", l);
    }
    // gh issue create doesn't return full JSON easily; use --json after create
    const result = runGh(args);
    if (!result.ok) return result;
    // Parse the URL from stdout (gh outputs the issue URL)
    const url = result.value.trim();
    const numMatch = url.match(/\/issues\/(\d+)/);
    return ok({
      number: numMatch ? parseInt(numMatch[1]!, 10) : 0,
      title: opts.title,
      body: opts.body,
      state: "open",
      url,
      labels: opts.labels ?? [],
    });
  }

  // ─── CI state ───────────────────────────────────────────────────────────

  async getCheckStatus(_ref: string): Promise<Result<CheckRollup, ForgeError>> {
    return err(forgeError("not-supported", "getCheckStatus: use getPrGateState for PR-level check status"));
  }

  async listPendingRuns(_ref: string): Promise<Result<readonly CiRun[], ForgeError>> {
    const runs: CiRun[] = [];
    for (const status of ["in_progress", "queued"]) {
      const result = runGhJson<{ databaseId: number; status: string; workflowName: string; headSha: string }[]>([
        "run", "list", "--repo", this.nwo, "--status", status,
        "--json", "databaseId,status,workflowName,headSha", "--limit", "20",
      ]);
      if (!result.ok) return result;
      for (const r of result.value) {
        runs.push({ id: String(r.databaseId), name: r.workflowName, status: status as "queued" | "in-progress", headSha: r.headSha });
      }
    }
    return ok(runs);
  }

  // ─── Repository info ────────────────────────────────────────────────────

  async getRepoInfo(): Promise<Result<RepoInfo, ForgeError>> {
    const result = runGhJson<{ owner: { login: string }; name: string; defaultBranchRef: { name: string }; isPrivate: boolean; url: string }>([
      "repo", "view", this.nwo, "--json", "owner,name,defaultBranchRef,isPrivate,url",
    ]);
    if (!result.ok) return result;
    return ok({
      owner: result.value.owner.login,
      name: result.value.name,
      defaultBranch: result.value.defaultBranchRef?.name ?? "main",
      isPrivate: result.value.isPrivate,
      url: result.value.url,
    });
  }

  async getBranchProtection(_branch: string): Promise<Result<BranchProtection, ForgeError>> {
    return err(forgeError("not-supported", "getBranchProtection: not yet implemented for GitHub adapter"));
  }

  // ─── Git data API ──────────────────────────────────────────────────────

  async createBlob(content: string, encoding?: "utf-8" | "base64"): Promise<Result<string, ForgeError>> {
    const body = JSON.stringify({ content, encoding: encoding ?? "utf-8" });
    const result = spawnSync("gh", ["api", "-X", "POST", `repos/${this.nwo}/git/blobs`, "--input", "-"], { input: body, encoding: "utf8", maxBuffer: 64*1024*1024, timeout: 30000 });
    if (result.status !== 0) return err(classifyGhError(result.status, result.stderr ?? ""));
    try { return ok((JSON.parse(result.stdout) as { sha: string }).sha); }
    catch (e) { return err(forgeError("parse-failure", `createBlob: ${e instanceof Error ? e.message : String(e)}`)); }
  }

  async createTree(tree: readonly TreeEntry[], baseTree?: string): Promise<Result<string, ForgeError>> {
    const body = JSON.stringify({ base_tree: baseTree, tree });
    const result = spawnSync("gh", ["api", "-X", "POST", `repos/${this.nwo}/git/trees`, "--input", "-"], { input: body, encoding: "utf8", maxBuffer: 64*1024*1024, timeout: 30000 });
    if (result.status !== 0) return err(classifyGhError(result.status, result.stderr ?? ""));
    try { return ok((JSON.parse(result.stdout) as { sha: string }).sha); }
    catch (e) { return err(forgeError("parse-failure", `createTree: ${e instanceof Error ? e.message : String(e)}`)); }
  }

  async createCommit(opts: CreateCommitOpts): Promise<Result<string, ForgeError>> {
    const body = JSON.stringify({ message: opts.message, tree: opts.tree, parents: opts.parents });
    const result = spawnSync("gh", ["api", "-X", "POST", `repos/${this.nwo}/git/commits`, "--input", "-"], { input: body, encoding: "utf8", maxBuffer: 64*1024*1024, timeout: 30000 });
    if (result.status !== 0) return err(classifyGhError(result.status, result.stderr ?? ""));
    try { return ok((JSON.parse(result.stdout) as { sha: string }).sha); }
    catch (e) { return err(forgeError("parse-failure", `createCommit: ${e instanceof Error ? e.message : String(e)}`)); }
  }

  async updateRef(ref: string, sha: string, force?: boolean): Promise<Result<void, ForgeError>> {
    const body = JSON.stringify({ sha, force: force ?? false });
    const result = spawnSync("gh", ["api", "-X", "PATCH", `repos/${this.nwo}/git/refs/${ref}`, "--input", "-"], {
      input: body, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 30000,
    });
    if (result.status !== 0) return err(classifyGhError(result.status, result.stderr ?? ""));
    return ok(undefined);
  }

  async getRef(ref: string): Promise<Result<import("../types").GitRef, ForgeError>> {
    const r = runGhJson<{ ref: string; object: { sha: string } }>(["api", `repos/${this.nwo}/git/ref/${ref}`]);
    if (!r.ok) return r;
    return ok({ ref: r.value.ref, sha: r.value.object.sha });
  }

  async getCommit(sha: string): Promise<Result<import("../types").GitCommitInfo, ForgeError>> {
    const r = runGhJson<{ sha: string; tree: { sha: string }; message: string; parents: { sha: string }[] }>(["api", `repos/${this.nwo}/git/commits/${sha}`]);
    if (!r.ok) return r;
    return ok({ sha: r.value.sha, treeSha: r.value.tree.sha, message: r.value.message, parents: r.value.parents.map(p => p.sha) });
  }

  async searchPullRequests(opts: import("../types").SearchPrOpts): Promise<Result<readonly import("../types").SearchPrResult[], ForgeError>> {
    const args = ["pr", "list", "--repo", this.nwo, "--limit", String(opts.limit ?? 100), "--json", "number,state,createdAt,mergedAt,closedAt"];
    if (opts.state && opts.state !== "all") args.push("--state", opts.state);
    if (opts.search) args.push("--search", opts.search);
    if (opts.author) args.push("--author", opts.author);
    const r = runGhJson<{ number: number; state: string; createdAt: string; mergedAt: string | null; closedAt: string | null }[]>(args);
    if (!r.ok) return r;
    let results = r.value.map(pr => ({ number: pr.number, state: mapPrState(pr.state), createdAt: pr.createdAt, mergedAt: pr.mergedAt, closedAt: pr.closedAt }));
    if (opts.since) {
      const sinceMs = new Date(opts.since).getTime();
      results = results.filter(pr => new Date(pr.createdAt).getTime() >= sinceMs);
    }
    return ok(results);
  }
}

// ─── Mapping helpers ────────────────────────────────────────────────────────

function mapPr(raw: GhPrListItem): PullRequest {
  return {
    number: raw.number,
    title: raw.title,
    headRef: raw.headRefName,
    baseRef: raw.baseRefName,
    state: mapPrState(raw.state),
    isDraft: raw.isDraft,
    mergeStateStatus: mapMergeState(raw.mergeStateStatus),
    reviewDecision: mapReviewDecision(raw.reviewDecision),
    url: raw.url,
    updatedAt: raw.updatedAt,
    author: raw.author?.login ?? "(unknown)",
  };
}

function mapPrState(state: string): "open" | "merged" | "closed" {
  const lower = state.toLowerCase();
  if (lower === "merged") return "merged";
  if (lower === "closed") return "closed";
  return "open";
}

function mapMergeState(status: string): "clean" | "blocked" | "dirty" | "unstable" | "unknown" {
  const lower = status.toLowerCase();
  if (lower === "clean") return "clean";
  if (lower === "blocked") return "blocked";
  if (lower === "dirty" || lower === "behind") return "dirty";
  if (lower === "unstable") return "unstable";
  return "unknown";
}

function mapReviewDecision(decision: string | null): "approved" | "changes-requested" | "review-required" | null {
  if (!decision) return null;
  const lower = decision.toLowerCase();
  if (lower === "approved") return "approved";
  if (lower === "changes_requested") return "changes-requested";
  if (lower === "review_required") return "review-required";
  return null;
}

// ─── Check classification (mirrors poll-pr-gate.ts logic) ───────────────────

const OK_CONCLUSIONS = new Set(["SUCCESS", "NEUTRAL", "SKIPPED"]);
const BLOCKING_CONCLUSIONS = new Set(["FAILURE", "CANCELLED", "TIMED_OUT", "STARTUP_FAILURE", "ACTION_REQUIRED", "STALE", "ERROR"]);
const PENDING_STATUSES = new Set(["QUEUED", "PENDING", "EXPECTED", "REQUESTED", "WAITING"]);

function classifyChecks(rollup: { status?: string; conclusion?: string; name?: string }[]): CheckSummary {
  let okCount = 0, inProgress = 0, pending = 0, failed = 0;
  for (const c of rollup) {
    if (c.status === "IN_PROGRESS") { inProgress++; continue; }
    if (c.status && PENDING_STATUSES.has(c.status)) { pending++; continue; }
    if (c.conclusion && OK_CONCLUSIONS.has(c.conclusion)) { okCount++; continue; }
    if (c.conclusion && BLOCKING_CONCLUSIONS.has(c.conclusion)) { failed++; }
  }
  return { ok: okCount, inProgress, pending, failed };
}

function classifyGate(
  mergeStateStatus: string, state: string, requiredChecks: CheckSummary, unresolvedThreads: number,
): "clean" | "blocked" | "dirty" | "unstable" | "unknown" {
  if (state === "MERGED" || state === "CLOSED") return "clean";
  if (mergeStateStatus === "DIRTY" || mergeStateStatus === "BEHIND") return "dirty";
  if (mergeStateStatus === "UNSTABLE") return "unstable";
  if (requiredChecks.failed > 0) return "blocked";
  if (mergeStateStatus === "BLOCKED") return "blocked";
  if (mergeStateStatus === "CLEAN" && unresolvedThreads === 0) return "clean";
  return "unknown";
}

function computeNextAction(
  state: "open" | "merged" | "closed",
  gate: string,
  requiredChecks: CheckSummary,
  unresolvedThreads: number,
): NextAction {
  if (state === "merged") return "verify-merge";
  if (state === "closed") return "none";
  if (gate === "dirty") return "rebase";
  if (requiredChecks.failed > 0) return "fix-failed-checks";
  if (unresolvedThreads > 0) return "resolve-threads";
  if (requiredChecks.inProgress > 0 || requiredChecks.pending > 0) return "wait-ci";
  return "none";
}
