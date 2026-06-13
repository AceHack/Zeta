/**
 * forge-host/forge-host.ts — the ForgeHost interface.
 *
 * The single contract that all forge adapters implement. The core observe loop
 * and tools depend ONLY on this interface — they never name a specific host.
 *
 * All methods return Result<T, ForgeError>. Adapters that haven't implemented
 * a method return ForgeError with kind "not-supported" — never throw.
 */

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
  GitRef,
  GitCommitInfo,
  SearchPrOpts,
  SearchPrResult,
  ListPrOpts,
  ListMergedPrOpts,
  CreatePrOpts,
  ListIssueOpts,
  CreateIssueOpts,
  MergeMethod,
} from "./types";

export interface ForgeHost {
  /** Human-readable forge name (e.g. "github", "gitlab", "gitea"). */
  readonly forgeName: string;

  // ─── PR state ───────────────────────────────────────────────────────────

  /** List open pull requests / merge requests. */
  listOpenPullRequests(opts?: ListPrOpts): Promise<Result<readonly PullRequest[], ForgeError>>;

  /** Get a single PR by number. */
  getPullRequest(number: number): Promise<Result<PullRequest, ForgeError>>;

  /** Get the full gate state for a PR (checks, threads, merge-readiness). */
  getPrGateState(number: number): Promise<Result<PrGateState, ForgeError>>;

  /** List recently merged PRs. */
  listMergedPullRequests(opts?: ListMergedPrOpts): Promise<Result<readonly PullRequest[], ForgeError>>;

  // ─── PR actions ─────────────────────────────────────────────────────────

  /** Resolve a single review thread with a reply body. */
  resolveThread(threadId: string, body: string): Promise<Result<void, ForgeError>>;

  /** Batch-resolve multiple threads. Partial success is reported, not all-or-nothing. */
  resolveThreadsBatch(threads: readonly ThreadResolution[]): Promise<Result<BatchResult, ForgeError>>;

  /** Create a new pull request. */
  createPullRequest(opts: CreatePrOpts): Promise<Result<PullRequest, ForgeError>>;

  /** Enable auto-merge on a PR. */
  enableAutoMerge(prNumber: number, method?: MergeMethod): Promise<Result<void, ForgeError>>;

  /** Add a comment to a PR. */
  addPrComment(prNumber: number, body: string): Promise<Result<CommentRef, ForgeError>>;

  // ─── Issues ─────────────────────────────────────────────────────────────

  /** List open issues. */
  listOpenIssues(opts?: ListIssueOpts): Promise<Result<readonly Issue[], ForgeError>>;

  /** Create a new issue. */
  createIssue(opts: CreateIssueOpts): Promise<Result<Issue, ForgeError>>;

  // ─── CI state ───────────────────────────────────────────────────────────

  /** Get check/CI status for a ref (branch or SHA). */
  getCheckStatus(ref: string): Promise<Result<CheckRollup, ForgeError>>;

  /** List pending CI runs. */
  listPendingRuns(ref: string): Promise<Result<readonly CiRun[], ForgeError>>;

  // ─── Repository info ────────────────────────────────────────────────────

  /** Get repository metadata. */
  getRepoInfo(): Promise<Result<RepoInfo, ForgeError>>;

  /** Get branch protection rules for a branch. */
  getBranchProtection(branch: string): Promise<Result<BranchProtection, ForgeError>>;

  // ─── Git data API (bypass for saturated push) ───────────────────────────

  /** Create a blob (file content) via the forge's git data API. Returns blob SHA. */
  createBlob(content: string, encoding?: "utf-8" | "base64"): Promise<Result<string, ForgeError>>;

  /** Create a tree. Returns tree SHA. */
  createTree(tree: readonly TreeEntry[], baseTree?: string): Promise<Result<string, ForgeError>>;

  /** Create a commit. Returns commit SHA. */
  createCommit(opts: CreateCommitOpts): Promise<Result<string, ForgeError>>;

  /** Update a ref to point to a new SHA. */
  updateRef(ref: string, sha: string, force?: boolean): Promise<Result<void, ForgeError>>;

  // --- Git ref/commit read ---
  getRef(ref: string): Promise<Result<GitRef, ForgeError>>;
  getCommit(sha: string): Promise<Result<GitCommitInfo, ForgeError>>;

  // --- Search ---
  searchPullRequests(opts: SearchPrOpts): Promise<Result<readonly SearchPrResult[], ForgeError>>;
}
