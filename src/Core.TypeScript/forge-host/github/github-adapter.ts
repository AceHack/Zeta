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
  CheckDefinition,
  CheckObservationOpts,
  CheckObservationPass,
} from "../types";
import { ok, err, forgeError } from "../result";
import { githubRestRequest, resolveGitHubToken, runGh, runGhJson } from "./gh-cli";
import { listGitHubCheckDefinitions, listGitHubCheckObservations } from "./check-observations.ts";
import { restCreatePull, restGetPull, restListPulls, restPullToPr, type GithubRest } from "./github-pr-rest.ts";
import { observeMerge, observeOpenPullRequests } from "./github-merge-observe.ts";

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
  private readonly rest: GithubRest;
  /// Leftover `gh` porcelain until those verbs are REST. Injected in DST tests so a missing binary is not a 500ms spawn.
  private readonly porcelain: (args: readonly string[]) => Result<string, ForgeError>;

  constructor(
    owner: string,
    repo: string,
    opts?: {
      readonly repoRoot?: string;
      readonly checkRef?: string;
      readonly rest?: GithubRest;
      readonly porcelain?: (args: readonly string[]) => Result<string, ForgeError>;
    },
  ) {
    this.owner = owner;
    this.repo = repo;
    this.repoRoot = opts?.repoRoot ?? process.cwd();
    this.checkRef = opts?.checkRef ?? "main";
    this.porcelain = opts?.porcelain ?? ((args) => runGh(args));
    if (opts?.rest !== undefined) {
      this.rest = opts.rest;
    } else {
      // Per-instance memo (actor state), not a process global. DST tests inject `rest`.
      let cached: string | null | undefined;
      this.rest = {
        request: (method, path, body) => {
          if (cached === undefined) cached = resolveGitHubToken();
          return githubRestRequest(method, path, body, { token: cached });
        },
      };
    }
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
    // GraphQL one-shot: REST list does not carry mergeStateStatus, so observe()'s
    // World.forgeState.cleanPrCount would stay 0 (a quiet-loop bug).
    return observeOpenPullRequests(this.rest, this.nwo, opts?.limit ?? 20);
  }

  async getPullRequest(number: number): Promise<Result<PullRequest, ForgeError>> {
    const result = await restGetPull(this.rest, this.nwo, number);
    if (!result.ok) return result;
    return ok(restPullToPr(result.value));
  }

  async getPrGateState(number: number): Promise<Result<PrGateState, ForgeError>> {
    return observeMerge(this.rest, this.nwo, number);
  }

  async listMergedPullRequests(opts?: ListMergedPrOpts): Promise<Result<readonly PullRequest[], ForgeError>> {
    const result = await restListPulls(this.rest, this.nwo, { state: "closed", limit: 100, sort: "updated" });
    if (!result.ok) return result;
    const sinceMs = opts?.since !== undefined ? new Date(opts.since).getTime() : null;
    const merged = result.value
      .filter((p) => typeof p.merged_at === "string" && p.merged_at.length > 0)
      .filter((p) => sinceMs === null || new Date(p.merged_at ?? "").getTime() >= sinceMs)
      .slice(0, opts?.limit ?? 20)
      .map(restPullToPr);
    return ok(merged);
  }

  // ─── PR actions ─────────────────────────────────────────────────────────

  async resolveThread(threadId: string, body: string): Promise<Result<void, ForgeError>> {
    // Reply then resolve
    const replyResult = this.porcelain([
      "api", "graphql",
      "-F", `thread_id=${threadId}`,
      "-F", `body=${body}`,
      "-f", `query=mutation($thread_id: ID!, $body: String!) { addPullRequestReviewThreadReply(input: { pullRequestReviewThreadId: $thread_id, body: $body }) { comment { id } } }`,
    ]);
    if (!replyResult.ok) return replyResult;

    const resolveResult = this.porcelain([
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
    const result = await restCreatePull(this.rest, this.nwo, opts);
    if (!result.ok) return result;
    return ok(restPullToPr(result.value));
  }

  async enableAutoMerge(prNumber: number, method?: MergeMethod): Promise<Result<void, ForgeError>> {
    const merge_method = method === "rebase" ? "rebase" : method === "merge" ? "merge" : "squash";
    const result = await this.rest.request("PUT", `repos/${this.nwo}/pulls/${String(prNumber)}/auto-merge`, { merge_method });
    if (!result.ok) return result;
    return ok(undefined);
  }

  async addPrComment(prNumber: number, body: string): Promise<Result<CommentRef, ForgeError>> {
    const result = await this.rest.request("POST", `repos/${this.nwo}/issues/${String(prNumber)}/comments`, { body });
    if (!result.ok) return result;
    let parsed: unknown;
    try {
      parsed = JSON.parse(result.value);
    } catch (e) {
      return err(forgeError("parse-failure", `addPrComment: ${e instanceof Error ? e.message : String(e)}`));
    }
    const id = typeof parsed === "object" && parsed !== null ? (parsed as { id?: unknown }).id : undefined;
    const url = typeof parsed === "object" && parsed !== null ? (parsed as { html_url?: unknown }).html_url : undefined;
    return ok({
      id: typeof id === "number" ? String(id) : typeof id === "string" ? id : "",
      url: typeof url === "string" ? url : `https://github.com/${this.nwo}/pull/${String(prNumber)}`,
    });
  }

  // ─── Issues ─────────────────────────────────────────────────────────────

  async listOpenIssues(opts?: ListIssueOpts): Promise<Result<readonly Issue[], ForgeError>> {
    const perPage = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
    const result = await this.rest.request("GET", `repos/${this.nwo}/issues?state=open&per_page=${String(perPage)}`);
    if (!result.ok) return result;
    let parsed: unknown;
    try {
      parsed = JSON.parse(result.value);
    } catch (e) {
      return err(forgeError("parse-failure", `listOpenIssues: ${e instanceof Error ? e.message : String(e)}`));
    }
    if (!Array.isArray(parsed)) return err(forgeError("parse-failure", "listOpenIssues: expected array"));
    const issues: Issue[] = [];
    for (const item of parsed) {
      if (typeof item !== "object" || item === null) continue;
      const row = item as { pull_request?: unknown; number?: unknown; title?: unknown; body?: unknown; state?: unknown; html_url?: unknown; labels?: unknown };
      if (row.pull_request !== undefined) continue;
      if (typeof row.number !== "number" || typeof row.title !== "string") continue;
      const labels: string[] = [];
      if (Array.isArray(row.labels)) {
        for (const l of row.labels) {
          if (typeof l === "object" && l !== null && typeof (l as { name?: unknown }).name === "string") {
            labels.push((l as { name: string }).name);
          }
        }
      }
      issues.push({
        number: row.number,
        title: row.title,
        body: typeof row.body === "string" ? row.body : "",
        state: row.state === "closed" ? "closed" : "open",
        url: typeof row.html_url === "string" ? row.html_url : "",
        labels,
      });
    }
    return ok(issues);
  }

  async createIssue(opts: CreateIssueOpts): Promise<Result<Issue, ForgeError>> {
    const payload: { title: string; body: string; labels?: readonly string[] } = { title: opts.title, body: opts.body };
    if (opts.labels !== undefined && opts.labels.length > 0) payload.labels = opts.labels;
    const result = await this.rest.request("POST", `repos/${this.nwo}/issues`, payload);
    if (!result.ok) return result;
    let parsed: unknown;
    try {
      parsed = JSON.parse(result.value);
    } catch (e) {
      return err(forgeError("parse-failure", `createIssue: ${e instanceof Error ? e.message : String(e)}`));
    }
    if (typeof parsed !== "object" || parsed === null) return err(forgeError("parse-failure", "createIssue: expected object"));
    const row = parsed as { number?: unknown; html_url?: unknown };
    return ok({
      number: typeof row.number === "number" ? row.number : 0,
      title: opts.title,
      body: opts.body,
      state: "open",
      url: typeof row.html_url === "string" ? row.html_url : "",
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

  // ─── Git data API (REST via injected `rest`, no `gh`) ───────────────────

  async createBlob(content: string, encoding?: "utf-8" | "base64"): Promise<Result<string, ForgeError>> {
    return this.restSha("POST", `repos/${this.nwo}/git/blobs`, { content, encoding: encoding ?? "utf-8" }, "createBlob");
  }

  async createTree(tree: readonly TreeEntry[], baseTree?: string): Promise<Result<string, ForgeError>> {
    return this.restSha("POST", `repos/${this.nwo}/git/trees`, { base_tree: baseTree, tree }, "createTree");
  }

  async createCommit(opts: CreateCommitOpts): Promise<Result<string, ForgeError>> {
    return this.restSha("POST", `repos/${this.nwo}/git/commits`, { message: opts.message, tree: opts.tree, parents: opts.parents }, "createCommit");
  }

  async updateRef(ref: string, sha: string, force?: boolean): Promise<Result<void, ForgeError>> {
    const result = await this.rest.request("PATCH", `repos/${this.nwo}/git/refs/${ref}`, { sha, force: force ?? false });
    if (!result.ok) return result;
    return ok(undefined);
  }

  async getRef(ref: string): Promise<Result<import("../types").GitRef, ForgeError>> {
    const r = await this.rest.request("GET", `repos/${this.nwo}/git/ref/${ref}`);
    if (!r.ok) return r;
    const parsed = parseJsonObject(r.value, "getRef");
    if (!parsed.ok) return parsed;
    const obj = parsed.value as { ref?: unknown; object?: { sha?: unknown } };
    if (typeof obj.ref !== "string" || typeof obj.object?.sha !== "string") {
      return err(forgeError("parse-failure", "getRef: unexpected shape"));
    }
    return ok({ ref: obj.ref, sha: obj.object.sha });
  }

  async getCommit(sha: string): Promise<Result<import("../types").GitCommitInfo, ForgeError>> {
    const r = await this.rest.request("GET", `repos/${this.nwo}/git/commits/${sha}`);
    if (!r.ok) return r;
    const parsed = parseJsonObject(r.value, "getCommit");
    if (!parsed.ok) return parsed;
    const obj = parsed.value as { sha?: unknown; tree?: { sha?: unknown }; message?: unknown; parents?: unknown };
    if (typeof obj.sha !== "string" || typeof obj.tree?.sha !== "string" || typeof obj.message !== "string" || !Array.isArray(obj.parents)) {
      return err(forgeError("parse-failure", "getCommit: unexpected shape"));
    }
    return ok({
      sha: obj.sha,
      treeSha: obj.tree.sha,
      message: obj.message,
      parents: obj.parents.map((p) => (typeof p === "object" && p !== null && typeof (p as { sha?: unknown }).sha === "string" ? (p as { sha: string }).sha : "")).filter((s) => s.length > 0),
    });
  }

  private async restSha(method: string, path: string, body: unknown, label: string): Promise<Result<string, ForgeError>> {
    const r = await this.rest.request(method, path, body);
    if (!r.ok) return r;
    const parsed = parseJsonObject(r.value, label);
    if (!parsed.ok) return parsed;
    const sha = (parsed.value as { sha?: unknown }).sha;
    if (typeof sha !== "string" || sha.length === 0) return err(forgeError("parse-failure", `${label}: missing sha`));
    return ok(sha);
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

function parseJsonObject(text: string, label: string): Result<Record<string, unknown>, ForgeError> {
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return err(forgeError("parse-failure", `${label}: expected object`));
    }
    return ok(parsed as Record<string, unknown>);
  } catch (e) {
    return err(forgeError("parse-failure", `${label}: ${e instanceof Error ? e.message : String(e)}`));
  }
}

function mapPrState(state: string): "open" | "merged" | "closed" {
  const lower = state.toLowerCase();
  if (lower === "merged") return "merged";
  if (lower === "closed") return "closed";
  return "open";
}
