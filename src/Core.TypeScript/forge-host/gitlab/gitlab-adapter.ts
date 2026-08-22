/**
 * forge-host/gitlab/gitlab-adapter.ts — GitLab stub implementation of ForgeHost.
 *
 * Proves the multi-host abstraction works. Implements listOpenPullRequests
 * (mapped to merge requests) via `glab` CLI. All other methods return
 * not-supported until needed.
 */

import { spawnSync } from "node:child_process";
import type { ForgeHost } from "../forge-host";
import type {
  Result, ForgeError, PullRequest, PrGateState, Issue,
  CheckRollup, CiRun, RepoInfo, BranchProtection,
  ThreadResolution, BatchResult, CommentRef, TreeEntry, CreateCommitOpts,
  ListPrOpts, ListMergedPrOpts, CreatePrOpts, ListIssueOpts, CreateIssueOpts, MergeMethod,
  CheckDefinition, CheckObservationOpts, CheckObservationPass,
} from "../types";
import { ok, err, forgeError } from "../result";

export class GitLabAdapter implements ForgeHost {
  readonly forgeName = "gitlab";
  readonly sourceName = "gitlab";
  private readonly owner: string;
  private readonly repo: string;

  constructor(owner: string, repo: string) {
    this.owner = owner;
    this.repo = repo;
  }

  private get project(): string {
    return `${this.owner}/${this.repo}`;
  }

  // ─── Check observations ───────────────────────────────────────────────
  //
  // Honestly not-supported. Returning an empty roster here would be far worse than
  // an error: a dashboard would then report "0 of 0 checks observed" and render
  // green, which is the exact defect the whole surface exists to refuse. GitLab CI
  // pipeline schedules map onto this contract cleanly when someone needs it.

  async listCheckDefinitions(
    _opts?: CheckObservationOpts,
  ): Promise<Result<readonly CheckDefinition[], ForgeError>> {
    return err(forgeError("not-supported", "listCheckDefinitions: not yet implemented for GitLab"));
  }

  async listLatestCheckObservations(
    _ref: string,
    _definitions: readonly CheckDefinition[],
    _opts?: CheckObservationOpts,
  ): Promise<Result<CheckObservationPass, ForgeError>> {
    return err(forgeError("not-supported", "listLatestCheckObservations: not yet implemented for GitLab"));
  }

  // ─── Implemented: listOpenPullRequests (via glab mr list) ─────────────

  async listOpenPullRequests(opts?: ListPrOpts): Promise<Result<readonly PullRequest[], ForgeError>> {
    const limit = opts?.limit ?? 50;
    const result = spawnSync("glab", [
      "mr", "list", "--repo", this.project,
      "--state", "opened", "--per-page", String(limit),
      "--output", "json",
    ], { encoding: "utf8", timeout: 30000 });

    if (result.error) {
      return err(forgeError("internal", `glab not found: ${result.error.message}`));
    }
    if (result.status !== 0) {
      return err(forgeError("internal", `glab exit ${result.status}: ${result.stderr ?? ""}`));
    }

    try {
      const mrs = JSON.parse(result.stdout) as Array<{
        iid: number; title: string; source_branch: string; target_branch: string;
        state: string; draft: boolean; web_url: string; updated_at: string;
        author: { username: string };
        merge_status: string;
      }>;

      return ok(mrs.map((mr): PullRequest => ({
        number: mr.iid,
        title: mr.title,
        headRef: mr.source_branch,
        baseRef: mr.target_branch,
        state: "open",
        isDraft: mr.draft,
        mergeStateStatus: mr.merge_status === "can_be_merged" ? "clean" : "blocked",
        reviewDecision: null,
        url: mr.web_url,
        updatedAt: mr.updated_at,
        author: mr.author?.username ?? "(unknown)",
      })));
    } catch (e) {
      return err(forgeError("parse-failure", `failed to parse glab output: ${e instanceof Error ? e.message : String(e)}`));
    }
  }

  // ─── Not yet implemented ──────────────────────────────────────────────

  async getPullRequest(_number: number): Promise<Result<PullRequest, ForgeError>> {
    return err(forgeError("not-supported", "GitLab: getPullRequest not yet implemented"));
  }
  async getPrGateState(_number: number): Promise<Result<PrGateState, ForgeError>> {
    return err(forgeError("not-supported", "GitLab: getPrGateState not yet implemented"));
  }
  async listMergedPullRequests(_opts?: ListMergedPrOpts): Promise<Result<readonly PullRequest[], ForgeError>> {
    return err(forgeError("not-supported", "GitLab: listMergedPullRequests not yet implemented"));
  }
  async resolveThread(_threadId: string, _body: string): Promise<Result<void, ForgeError>> {
    return err(forgeError("not-supported", "GitLab: resolveThread not yet implemented"));
  }
  async resolveThreadsBatch(_threads: readonly ThreadResolution[]): Promise<Result<BatchResult, ForgeError>> {
    return err(forgeError("not-supported", "GitLab: resolveThreadsBatch not yet implemented"));
  }
  async createPullRequest(_opts: CreatePrOpts): Promise<Result<PullRequest, ForgeError>> {
    return err(forgeError("not-supported", "GitLab: createPullRequest not yet implemented"));
  }
  async enableAutoMerge(_prNumber: number, _method?: MergeMethod): Promise<Result<void, ForgeError>> {
    return err(forgeError("not-supported", "GitLab: enableAutoMerge not yet implemented"));
  }
  async addPrComment(_prNumber: number, _body: string): Promise<Result<CommentRef, ForgeError>> {
    return err(forgeError("not-supported", "GitLab: addPrComment not yet implemented"));
  }
  async listOpenIssues(_opts?: ListIssueOpts): Promise<Result<readonly Issue[], ForgeError>> {
    return err(forgeError("not-supported", "GitLab: listOpenIssues not yet implemented"));
  }
  async createIssue(_opts: CreateIssueOpts): Promise<Result<Issue, ForgeError>> {
    return err(forgeError("not-supported", "GitLab: createIssue not yet implemented"));
  }
  async getCheckStatus(_ref: string): Promise<Result<CheckRollup, ForgeError>> {
    return err(forgeError("not-supported", "GitLab: getCheckStatus not yet implemented"));
  }
  async listPendingRuns(_ref: string): Promise<Result<readonly CiRun[], ForgeError>> {
    return err(forgeError("not-supported", "GitLab: listPendingRuns not yet implemented"));
  }
  async getRepoInfo(): Promise<Result<RepoInfo, ForgeError>> {
    return err(forgeError("not-supported", "GitLab: getRepoInfo not yet implemented"));
  }
  async getBranchProtection(_branch: string): Promise<Result<BranchProtection, ForgeError>> {
    return err(forgeError("not-supported", "GitLab: getBranchProtection not yet implemented"));
  }
  async createBlob(_content: string, _encoding?: "utf-8" | "base64"): Promise<Result<string, ForgeError>> {
    return err(forgeError("not-supported", "GitLab: createBlob not yet implemented"));
  }
  async createTree(_tree: readonly TreeEntry[], _baseTree?: string): Promise<Result<string, ForgeError>> {
    return err(forgeError("not-supported", "GitLab: createTree not yet implemented"));
  }
  async createCommit(_opts: CreateCommitOpts): Promise<Result<string, ForgeError>> {
    return err(forgeError("not-supported", "GitLab: createCommit not yet implemented"));
  }
  async updateRef(_ref: string, _sha: string, _force?: boolean): Promise<Result<void, ForgeError>> {
    return err(forgeError("not-supported", "GitLab: updateRef not yet implemented"));
  }
  async getRef(_ref: string): Promise<Result<import("../types").GitRef, ForgeError>> {
    return err(forgeError("not-supported", "GitLab: getRef not yet implemented"));
  }
  async getCommit(_sha: string): Promise<Result<import("../types").GitCommitInfo, ForgeError>> {
    return err(forgeError("not-supported", "GitLab: getCommit not yet implemented"));
  }
  async searchPullRequests(_opts: import("../types").SearchPrOpts): Promise<Result<readonly import("../types").SearchPrResult[], ForgeError>> {
    return err(forgeError("not-supported", "GitLab: searchPullRequests not yet implemented"));
  }
}
