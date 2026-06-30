#!/usr/bin/env bun
// github-review-thread-observation.ts — input-side bridge for B-0164.1.
//
// Every prior B-0164.1 slice worked the *internal* side of the protocol:
// detect (detectReviewThreadDisagreement), file (fileReviewThreadDisagreement),
// record (recordReviewThreadObservation), reconcile (divergence-reconcile.ts).
// None map a GitHub PR review thread *into* the recorder's input shape. This
// module is that missing glue: a pure, deterministic transform from a GitHub
// GraphQL `PullRequestReviewThread` node + a loop's verdict → a validated
// `ReviewThreadObservation`.
//
// It is below the blocked end-to-end boundary by construction: no live `gh`
// call, no concurrent-loop harness, no GitHub review submission. A future
// live caller fetches review threads (a richer query than poll-pr-gate.ts's
// minimal `nodes{isResolved}`), derives its own machine-comparable conclusion,
// and feeds each thread through this adapter before calling
// recordReviewThreadObservation.
//
// Load-bearing correctness property: `threadId` is taken from the thread's
// GraphQL `id`, the canonical stable identifier for a PullRequestReviewThread.
// detectReviewThreadDisagreement compares observations only when prNumber AND
// threadId match — so two loops reviewing the *same* GitHub thread must produce
// the *same* threadId, or the same-thread match silently fails and a real
// disagreement is never preserved. Centralizing + testing this id extraction
// is the point of the adapter.
//
// The `conclusion` is caller-supplied: this module is intentionally
// vocabulary-neutral. How a loop turns a thread's state into a
// machine-comparable verdict ("resolve" / "needs-fix" / ...) is a policy the
// architect + the future live loop own, not this adapter.
//
// GitHub GraphQL field reference (subset modeled here):
//   https://docs.github.com/en/graphql/reference/objects
//   - PullRequestReviewThread.id (ID!), .isResolved (Boolean!),
//     .comments (PullRequestReviewCommentConnection!)
//   - PullRequestReviewComment.body (String!), .author (Actor → .login)
// The `reviewThreads.nodes { isResolved }` shape is also confirmed in-repo by
// tools/github/poll-pr-gate.ts.

import type { LoopIdentity, ReviewThreadObservation } from "./divergence-shard.ts";

/** Subset of a GitHub GraphQL `PullRequestReviewComment` node. */
export interface GitHubReviewThreadCommentNode {
  readonly body: string;
  readonly author?: { readonly login?: string | null } | null;
}

/**
 * Subset of a GitHub GraphQL `PullRequestReviewThread` node. Only the fields
 * this adapter reads are modeled; a live caller's query may select more.
 */
export interface GitHubReviewThreadNode {
  /** The canonical stable thread identifier (GraphQL `id`, ID!). */
  readonly id: string;
  readonly isResolved: boolean;
  readonly comments?: {
    readonly nodes?: ReadonlyArray<GitHubReviewThreadCommentNode | null> | null;
  } | null;
}

export interface GitHubReviewThreadObservationInput {
  readonly thread: GitHubReviewThreadNode;
  readonly prNumber: number;
  readonly identity: LoopIdentity;
  /**
   * The loop's machine-comparable verdict for this thread. Caller-derived;
   * this adapter prescribes no conclusion vocabulary.
   */
  readonly conclusion: string;
  /**
   * The loop's human-readable evidence/framing. When omitted, defaults to the
   * thread's existing comment text (a sensible fallback so a filed divergence
   * shard is still readable per AC #3 even when a loop supplies no framing).
   */
  readonly body?: string;
}

function nonBlank(value: string, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${field} must be non-blank`);
  }
  return trimmed;
}

/** Structural validation of the modeled GitHub review-thread subset. */
export function validateGitHubReviewThreadNode(thread: GitHubReviewThreadNode): void {
  if (thread === null || typeof thread !== "object") {
    throw new Error("review thread node must be an object");
  }
  nonBlank(thread.id, "review thread id");
  if (typeof thread.isResolved !== "boolean") {
    throw new Error("review thread isResolved must be a boolean");
  }
  const comments = thread.comments;
  if (comments !== undefined && comments !== null) {
    const nodes = comments.nodes;
    if (nodes !== undefined && nodes !== null && !Array.isArray(nodes)) {
      throw new Error("review thread comments.nodes must be an array");
    }
  }
}

/**
 * Joins the thread's comment bodies into a single human-readable evidence
 * block, one comment per paragraph, prefixed with the author login when known.
 * Pure; tolerant of missing/null comment nodes and absent authors. Returns ""
 * when the thread has no readable comments.
 */
export function reviewThreadCommentsText(thread: GitHubReviewThreadNode): string {
  validateGitHubReviewThreadNode(thread);
  const nodes = thread.comments?.nodes ?? [];
  return nodes
    .flatMap((node) => {
      if (node === null || node === undefined || typeof node.body !== "string") {
        return [];
      }
      const body = node.body.trim();
      if (body.length === 0) {
        return [];
      }
      const login = node.author?.login?.trim();
      return [login && login.length > 0 ? `@${login}: ${body}` : body];
    })
    .join("\n\n");
}

/**
 * Maps a GitHub review-thread node + a loop's verdict → a validated
 * `ReviewThreadObservation` ready for recordReviewThreadObservation /
 * detectReviewThreadDisagreement.
 *
 * - `threadId` = the thread's GraphQL `id` (stable cross-loop match key).
 * - `conclusion` = the caller's machine-comparable verdict (vocabulary-neutral).
 * - `body` = the caller's framing, or the thread's comment text when omitted.
 *
 * Throws on a non-positive-integer prNumber, blank id/conclusion/identity
 * fields, or (only when body is omitted) a thread with no readable comments.
 */
export function githubReviewThreadToObservation(
  input: GitHubReviewThreadObservationInput,
): ReviewThreadObservation {
  validateGitHubReviewThreadNode(input.thread);
  if (!Number.isInteger(input.prNumber) || input.prNumber <= 0) {
    throw new Error(`prNumber must be a positive integer: ${input.prNumber}`);
  }
  const identity: LoopIdentity = {
    agent: nonBlank(input.identity.agent, "identity.agent"),
    model: nonBlank(input.identity.model, "identity.model"),
    harness: nonBlank(input.identity.harness, "identity.harness"),
  };
  const conclusion = nonBlank(input.conclusion, "conclusion");
  const body =
    input.body === undefined
      ? nonBlank(
          reviewThreadCommentsText(input.thread),
          "body (no framing supplied and thread has no readable comments)",
        )
      : nonBlank(input.body, "body");

  return {
    identity,
    prNumber: input.prNumber,
    threadId: nonBlank(input.thread.id, "review thread id"),
    conclusion,
    body,
  };
}
