/**
 * forge-host/types.ts — host-agnostic data types for the ForgeHost abstraction.
 *
 * These types define the contract between the core loop/tools and any forge host
 * (GitHub, GitLab, Gitea, etc.). No host-specific fields leak through this boundary.
 *
 * Architectural rule: "GitHub is NOT git-native — it's a plugin."
 * (src/Core.FSharp.Git/CredentialSource.fs, Aaron 2026-06-07)
 */

// ─── Result type (project convention: Result-over-exception) ────────────────

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

// ─── Error types ────────────────────────────────────────────────────────────

export type ForgeErrorKind =
  | "not-supported"      // adapter hasn't implemented this method
  | "auth-failure"       // credentials invalid or expired
  | "rate-limited"       // API rate limit hit
  | "not-found"          // resource doesn't exist
  | "network"            // transient network failure
  | "parse-failure"      // response couldn't be parsed
  | "permission-denied"  // valid auth but insufficient permissions
  | "internal";          // unexpected adapter error

export interface ForgeError {
  readonly kind: ForgeErrorKind;
  readonly message: string;
  readonly retryable: boolean;
  readonly raw?: unknown;
}

// ─── Forge detection ────────────────────────────────────────────────────────

export type ForgeType =
  | "github"
  | "gitlab"
  | "gitea"
  | "bitbucket"
  | "sourcehut"
  | "codeberg"
  | "unknown";

export interface DetectedForge {
  readonly forge: ForgeType;
  readonly owner: string;
  readonly repo: string;
  readonly host: string;
}

// ─── PR types ───────────────────────────────────────────────────────────────

export type PrState = "open" | "merged" | "closed";
export type MergeStateStatus = "clean" | "blocked" | "dirty" | "unstable" | "unknown";
export type ReviewDecision = "approved" | "changes-requested" | "review-required" | null;
export type MergeMethod = "merge" | "squash" | "rebase";

export interface PullRequest {
  readonly number: number;
  readonly title: string;
  readonly headRef: string;
  readonly baseRef: string;
  readonly state: PrState;
  readonly isDraft: boolean;
  readonly mergeStateStatus: MergeStateStatus;
  readonly reviewDecision: ReviewDecision;
  readonly url: string;
  readonly updatedAt: string;
  readonly author: string;
}

export type NextAction =
  | "wait-ci"
  | "fix-failed-checks"
  | "resolve-threads"
  | "rebase"
  | "verify-merge"
  | "none";

export interface CheckSummary {
  readonly ok: number;
  readonly inProgress: number;
  readonly pending: number;
  readonly failed: number;
}

export interface PrGateState {
  readonly number: number;
  readonly state: PrState;
  readonly gate: "clean" | "blocked" | "dirty" | "unstable" | "unknown";
  readonly checks: CheckSummary;
  readonly requiredChecks: CheckSummary;
  readonly unresolvedThreads: number;
  readonly autoMerge: "armed" | "none";
  readonly mergeCommit: string | null;
  readonly warnings: readonly string[];
  readonly nextAction: NextAction;
}

// ─── Thread types ───────────────────────────────────────────────────────────

export interface ThreadResolution {
  readonly threadId: string;
  readonly body: string;
}

export interface BatchResult {
  readonly resolved: number;
  readonly failed: readonly { readonly threadId: string; readonly error: ForgeError }[];
}

// ─── Issue types ────────────────────────────────────────────────────────────

export interface Issue {
  readonly number: number;
  readonly title: string;
  readonly body: string;
  readonly state: "open" | "closed";
  readonly url: string;
  readonly labels: readonly string[];
}

// ─── CI types ───────────────────────────────────────────────────────────────

export type CiConclusion =
  | "success" | "neutral" | "skipped"
  | "failure" | "cancelled" | "timed-out"
  | "startup-failure" | "action-required" | "stale";

export interface CiCheck {
  readonly name: string;
  readonly status: "queued" | "in-progress" | "completed";
  readonly conclusion: CiConclusion | null;
  readonly required: boolean;
}

export interface CheckRollup {
  readonly ref: string;
  readonly checks: readonly CiCheck[];
  readonly summary: CheckSummary;
  readonly requiredSummary: CheckSummary;
}

export interface CiRun {
  readonly id: string;
  readonly name: string;
  readonly status: "queued" | "in-progress";
  readonly headSha: string;
}

// ─── Repository info ────────────────────────────────────────────────────────

export interface RepoInfo {
  readonly owner: string;
  readonly name: string;
  readonly defaultBranch: string;
  readonly isPrivate: boolean;
  readonly url: string;
}

export interface BranchProtection {
  readonly requiredChecks: readonly string[];
  readonly requiresReview: boolean;
  readonly requiredReviewCount: number;
  readonly dismissesStaleReviews: boolean;
}

// ─── Git data API types ─────────────────────────────────────────────────────

export interface TreeEntry {
  readonly path: string;
  readonly mode: "100644" | "100755" | "040000" | "160000" | "120000";
  readonly type: "blob" | "tree" | "commit";
  readonly sha: string;
}

export interface CreateCommitOpts {
  readonly message: string;
  readonly tree: string;
  readonly parents: readonly string[];
}

// ─── Comment reference ──────────────────────────────────────────────────────

export interface CommentRef {
  readonly id: string;
  readonly url: string;
}

// ─── Option types ───────────────────────────────────────────────────────────

export interface ListPrOpts {
  readonly limit?: number;
  readonly orderBy?: "updated" | "created";
}

export interface ListMergedPrOpts {
  readonly limit?: number;
  readonly since?: string; // ISO 8601
}

export interface CreatePrOpts {
  readonly title: string;
  readonly body: string;
  readonly head: string;
  readonly base: string;
  readonly draft?: boolean;
}

export interface ListIssueOpts {
  readonly limit?: number;
  readonly labels?: readonly string[];
}

export interface CreateIssueOpts {
  readonly title: string;
  readonly body: string;
  readonly labels?: readonly string[];
}

// --- Git ref/commit read types ---

export interface GitRef {
  readonly ref: string;
  readonly sha: string;
}

export interface GitCommitInfo {
  readonly sha: string;
  readonly treeSha: string;
  readonly message: string;
  readonly parents: readonly string[];
}

// --- Extended PR search ---

export interface SearchPrOpts {
  readonly state?: "open" | "merged" | "closed" | "all";
  readonly search?: string;
  readonly limit?: number;
  readonly author?: string;
  readonly since?: string;
}

export interface SearchPrResult {
  readonly number: number;
  readonly state: "open" | "merged" | "closed";
  readonly createdAt: string;
  readonly mergedAt: string | null;
  readonly closedAt: string | null;
}
