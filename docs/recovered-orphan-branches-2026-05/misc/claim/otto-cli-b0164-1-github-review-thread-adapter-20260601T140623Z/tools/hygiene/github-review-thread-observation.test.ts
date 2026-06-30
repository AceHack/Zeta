import { describe, expect, test } from "bun:test";

import { detectReviewThreadDisagreement } from "./divergence-shard.ts";
import type { LoopIdentity } from "./divergence-shard.ts";
import {
  githubReviewThreadToObservation,
  reviewThreadCommentsText,
  validateGitHubReviewThreadNode,
  type GitHubReviewThreadNode,
} from "./github-review-thread-observation.ts";

const TICK = "2026-06-01T14:30:00Z";
const AUTH = "maintainer directive 2026-05-14: edge-runner drive; keep pushing";

const OTTO: LoopIdentity = { agent: "otto", model: "claude-opus-4-8", harness: "claude-code" };
const CODEX: LoopIdentity = { agent: "codex-loop", model: "gpt-5.5", harness: "codex" };

function thread(overrides: Partial<GitHubReviewThreadNode> = {}): GitHubReviewThreadNode {
  return {
    id: "PRRT_kwExampleThreadId",
    isResolved: false,
    comments: {
      nodes: [
        { body: "This call can throw on a null path.", author: { login: "reviewer-bot" } },
        { body: "Disagree — the caller already guards null.", author: { login: "otto" } },
      ],
    },
    ...overrides,
  };
}

describe("githubReviewThreadToObservation", () => {
  test("maps the GraphQL thread id to threadId and carries identity + conclusion", () => {
    const obs = githubReviewThreadToObservation({
      thread: thread(),
      prNumber: 4147,
      identity: OTTO,
      conclusion: "needs-fix",
      body: "Otto: the null guard is incomplete on the early-return path.",
    });

    expect(obs.threadId).toBe("PRRT_kwExampleThreadId");
    expect(obs.prNumber).toBe(4147);
    expect(obs.identity).toEqual(OTTO);
    expect(obs.conclusion).toBe("needs-fix");
    expect(obs.body).toBe("Otto: the null guard is incomplete on the early-return path.");
  });

  test("defaults body to the thread's comment text when no framing is supplied", () => {
    const obs = githubReviewThreadToObservation({
      thread: thread(),
      prNumber: 4147,
      identity: CODEX,
      conclusion: "resolve",
    });

    expect(obs.body).toBe(
      "@reviewer-bot: This call can throw on a null path.\n\n@otto: Disagree — the caller already guards null.",
    );
  });

  test("two loops keying off the same GitHub thread produce matching threadId → detector fires", () => {
    const common = thread({ id: "PRRT_sameThread" });
    const loopA = githubReviewThreadToObservation({
      thread: common,
      prNumber: 4147,
      identity: OTTO,
      conclusion: "needs-fix",
      body: "Otto: keep the thread open.",
    });
    const loopB = githubReviewThreadToObservation({
      thread: common,
      prNumber: 4147,
      identity: CODEX,
      conclusion: "resolve",
      body: "Codex: the concern is addressed; resolve.",
    });

    const result = detectReviewThreadDisagreement({ tick: TICK, loopA, loopB, operativeAuthorization: AUTH });
    expect(result.kind).toBe("disagreement");
    if (result.kind === "disagreement") {
      expect(result.divergenceInput.topic).toContain("PRRT_sameThread");
    }
  });

  test("same conclusion on the same thread → no disagreement", () => {
    const common = thread({ id: "PRRT_sameThread" });
    const loopA = githubReviewThreadToObservation({
      thread: common,
      prNumber: 4147,
      identity: OTTO,
      conclusion: "resolve",
      body: "Otto: addressed.",
    });
    const loopB = githubReviewThreadToObservation({
      thread: common,
      prNumber: 4147,
      identity: CODEX,
      conclusion: "resolve",
      body: "Codex: addressed.",
    });

    const result = detectReviewThreadDisagreement({ tick: TICK, loopA, loopB, operativeAuthorization: AUTH });
    expect(result.kind).toBe("no-disagreement");
    if (result.kind === "no-disagreement") {
      expect(result.reason).toBe("same-conclusion");
    }
  });

  test("different GitHub thread ids → different-thread no-op even with differing conclusions", () => {
    const loopA = githubReviewThreadToObservation({
      thread: thread({ id: "PRRT_threadA" }),
      prNumber: 4147,
      identity: OTTO,
      conclusion: "needs-fix",
      body: "Otto on thread A.",
    });
    const loopB = githubReviewThreadToObservation({
      thread: thread({ id: "PRRT_threadB" }),
      prNumber: 4147,
      identity: CODEX,
      conclusion: "resolve",
      body: "Codex on thread B.",
    });

    const result = detectReviewThreadDisagreement({ tick: TICK, loopA, loopB, operativeAuthorization: AUTH });
    expect(result.kind).toBe("no-disagreement");
    if (result.kind === "no-disagreement") {
      expect(result.reason).toBe("different-thread");
    }
  });

  test("rejects a blank thread id", () => {
    expect(() =>
      githubReviewThreadToObservation({
        thread: thread({ id: "   " }),
        prNumber: 4147,
        identity: OTTO,
        conclusion: "needs-fix",
        body: "x",
      }),
    ).toThrow(/review thread id/);
  });

  test("rejects a non-boolean isResolved", () => {
    expect(() =>
      githubReviewThreadToObservation({
        thread: thread({ isResolved: undefined as unknown as boolean }),
        prNumber: 4147,
        identity: OTTO,
        conclusion: "needs-fix",
        body: "x",
      }),
    ).toThrow(/isResolved/);
  });

  test("rejects a non-positive prNumber", () => {
    expect(() =>
      githubReviewThreadToObservation({
        thread: thread(),
        prNumber: 0,
        identity: OTTO,
        conclusion: "needs-fix",
        body: "x",
      }),
    ).toThrow(/prNumber/);
  });

  test("rejects a blank conclusion", () => {
    expect(() =>
      githubReviewThreadToObservation({
        thread: thread(),
        prNumber: 4147,
        identity: OTTO,
        conclusion: "   ",
        body: "x",
      }),
    ).toThrow(/conclusion/);
  });

  test("rejects a blank identity field", () => {
    expect(() =>
      githubReviewThreadToObservation({
        thread: thread(),
        prNumber: 4147,
        identity: { ...OTTO, model: "" },
        conclusion: "needs-fix",
        body: "x",
      }),
    ).toThrow(/identity\.model/);
  });

  test("errors when body is omitted and the thread has no readable comments", () => {
    expect(() =>
      githubReviewThreadToObservation({
        thread: { id: "PRRT_empty", isResolved: true, comments: { nodes: [] } },
        prNumber: 4147,
        identity: OTTO,
        conclusion: "resolve",
      }),
    ).toThrow(/body/);
  });
});

describe("reviewThreadCommentsText", () => {
  test("prefixes author login and joins comments by paragraph", () => {
    expect(reviewThreadCommentsText(thread())).toBe(
      "@reviewer-bot: This call can throw on a null path.\n\n@otto: Disagree — the caller already guards null.",
    );
  });

  test("tolerates null comment nodes and missing authors", () => {
    const node: GitHubReviewThreadNode = {
      id: "PRRT_mixed",
      isResolved: false,
      comments: {
        nodes: [null, { body: "no author here" }, { body: "   " }, { body: "kept", author: { login: null } }],
      },
    };
    expect(reviewThreadCommentsText(node)).toBe("no author here\n\nkept");
  });

  test("returns empty string when a thread has no comments", () => {
    expect(reviewThreadCommentsText({ id: "PRRT_none", isResolved: true })).toBe("");
  });
});

describe("validateGitHubReviewThreadNode", () => {
  test("accepts a well-formed node", () => {
    expect(() => validateGitHubReviewThreadNode(thread())).not.toThrow();
  });

  test("rejects a non-array comments.nodes", () => {
    expect(() =>
      validateGitHubReviewThreadNode({
        id: "PRRT_bad",
        isResolved: false,
        comments: { nodes: "oops" as unknown as [] },
      }),
    ).toThrow(/comments\.nodes/);
  });
});
