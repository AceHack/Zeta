// src/Core.TypeScript/workflow-engine/agent-loop/work-lifecycle-state-machine.test.ts
//
// Unit tests for the pure-logic exports of work-lifecycle-state-machine.ts.

import { describe, expect, test } from "bun:test";

import {
  applyTransition,
  isTerminal,
  leadTimeSeconds,
  revisionCount,
  type BacklogRow,
  type WorkLifecycleState,
} from "./work-lifecycle-state-machine";

function row(id = "081KSKBP80008QG0R000B3Y19A.5"): BacklogRow {
  return {
    id,
    title: "Agent-loop MVP",
    priority: "P1",
    filePath: `docs/backlog/P1/${id}-foo.md`,
    trajectory: "workflow-engine",
  };
}

function backlog(): WorkLifecycleState {
  return { tag: "Backlog", row: row() };
}

describe("happy path: backlog → claim → InProgress → PrOpen → InReview → Approved → Merged", () => {
  test("Backlog → Claim → Claimed", () => {
    const r = applyTransition(backlog(), {
      tag: "Claim",
      agent: "otto",
      timestamp: "2026-05-28T00:00:00Z",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.tag).toBe("Claimed");
      if (r.state.tag === "Claimed") {
        expect(r.state.claimedBy).toBe("otto");
      }
    }
  });

  test("Claimed → StartWork → InProgress", () => {
    const claimed: WorkLifecycleState = {
      tag: "Claimed",
      row: row(),
      claimedBy: "otto",
      claimAt: "2026-05-28T00:00:00Z",
    };
    const r = applyTransition(claimed, { tag: "StartWork", branchRef: "feat/x" });
    expect(r.ok).toBe(true);
    if (r.ok && r.state.tag === "InProgress") {
      expect(r.state.branchRef).toBe("feat/x");
      expect(r.state.claimedBy).toBe("otto");
    }
  });

  test("InProgress → OpenPr → PrOpen", () => {
    const inprogress: WorkLifecycleState = {
      tag: "InProgress",
      row: row(),
      claimedBy: "otto",
      branchRef: "feat/x",
    };
    const r = applyTransition(inprogress, {
      tag: "OpenPr",
      prNumber: 5666,
      openedBy: "otto",
      openedAt: "2026-05-28T00:10:00Z",
    });
    expect(r.ok).toBe(true);
    if (r.ok && r.state.tag === "PrOpen") {
      expect(r.state.prNumber).toBe(5666);
    }
  });

  test("PrOpen → RequestReview → InReview", () => {
    const pr: WorkLifecycleState = {
      tag: "PrOpen",
      row: row(),
      prNumber: 5666,
      openedBy: "otto",
      openedAt: "2026-05-28T00:10:00Z",
    };
    const r = applyTransition(pr, {
      tag: "RequestReview",
      reviewers: ["aaron", "copilot"],
    });
    expect(r.ok).toBe(true);
    if (r.ok && r.state.tag === "InReview") {
      expect(r.state.reviewers).toEqual(["aaron", "copilot"]);
      expect(r.state.threadCount).toBe(0);
    }
  });

  test("InReview → ResolveAllThreads → Approved", () => {
    const review: WorkLifecycleState = {
      tag: "InReview",
      row: row(),
      prNumber: 5666,
      reviewers: ["aaron"],
      threadCount: 0,
    };
    const r = applyTransition(review, { tag: "ResolveAllThreads" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.tag).toBe("Approved");
  });

  test("Approved → Merge → Merged", () => {
    const approved: WorkLifecycleState = {
      tag: "Approved",
      row: row(),
      prNumber: 5666,
      approvedAt: "2026-05-28T00:30:00Z",
    };
    const r = applyTransition(approved, {
      tag: "Merge",
      mergeCommit: "abc123def",
      mergedAt: "2026-05-28T00:35:00Z",
    });
    expect(r.ok).toBe(true);
    if (r.ok && r.state.tag === "Merged") {
      expect(r.state.mergeCommit).toBe("abc123def");
    }
  });
});

describe("cycle-push-review-a-few-times pattern (the operator's question)", () => {
  test("InReview → ReceiveRevisionRequest → RevisionRequested", () => {
    const review: WorkLifecycleState = {
      tag: "InReview",
      row: row(),
      prNumber: 5666,
      reviewers: ["copilot"],
      threadCount: 0,
    };
    const r = applyTransition(review, {
      tag: "ReceiveRevisionRequest",
      threadIds: ["RT_111", "RT_222"],
    });
    expect(r.ok).toBe(true);
    if (r.ok && r.state.tag === "RevisionRequested") {
      expect(r.state.revisionCount).toBe(1);
      expect(r.state.threadIds).toEqual(["RT_111", "RT_222"]);
    }
  });

  test("RevisionRequested → PushRevision → RevisionPushed", () => {
    const requested: WorkLifecycleState = {
      tag: "RevisionRequested",
      row: row(),
      prNumber: 5666,
      revisionCount: 1,
      threadIds: ["RT_111"],
    };
    const r = applyTransition(requested, {
      tag: "PushRevision",
      sha: "deadbeef",
    });
    expect(r.ok).toBe(true);
    if (r.ok && r.state.tag === "RevisionPushed") {
      expect(r.state.lastPushSha).toBe("deadbeef");
      expect(r.state.revisionCount).toBe(1);
    }
  });

  test("RevisionPushed → RequestReview → InReview (the cycle-push loop)", () => {
    const pushed: WorkLifecycleState = {
      tag: "RevisionPushed",
      row: row(),
      prNumber: 5666,
      revisionCount: 1,
      lastPushSha: "deadbeef",
    };
    const r = applyTransition(pushed, {
      tag: "RequestReview",
      reviewers: ["copilot"],
    });
    expect(r.ok).toBe(true);
    if (r.ok && r.state.tag === "InReview") {
      // threadCount carries forward the revision-cycle iteration
      expect(r.state.threadCount).toBe(1);
    }
  });

  test("Multiple revision cycles increment revisionCount", () => {
    let state: WorkLifecycleState = {
      tag: "InReview",
      row: row(),
      prNumber: 5666,
      reviewers: ["copilot"],
      threadCount: 0,
    };

    // Cycle 1: revision requested → pushed → re-review requested
    let r = applyTransition(state, {
      tag: "ReceiveRevisionRequest",
      threadIds: ["RT_1"],
    });
    expect(r.ok).toBe(true);
    state = r.state;
    expect(revisionCount(state)).toBe(1);

    r = applyTransition(state, { tag: "PushRevision", sha: "sha1" });
    expect(r.ok).toBe(true);
    state = r.state;
    expect(revisionCount(state)).toBe(1);

    r = applyTransition(state, { tag: "RequestReview", reviewers: ["copilot"] });
    expect(r.ok).toBe(true);
    state = r.state;

    // Cycle 2: revision requested again → pushed again
    r = applyTransition(state, {
      tag: "ReceiveRevisionRequest",
      threadIds: ["RT_2"],
    });
    expect(r.ok).toBe(true);
    state = r.state;
    if (state.tag === "RevisionRequested") {
      expect(state.revisionCount).toBe(2);
    }

    // Cycle 3: revision requested again
    r = applyTransition(state, { tag: "PushRevision", sha: "sha2" });
    expect(r.ok).toBe(true);
    state = r.state;
    r = applyTransition(state, { tag: "RequestReview", reviewers: ["copilot"] });
    expect(r.ok).toBe(true);
    state = r.state;
    r = applyTransition(state, {
      tag: "ReceiveRevisionRequest",
      threadIds: ["RT_3"],
    });
    expect(r.ok).toBe(true);
    state = r.state;
    if (state.tag === "RevisionRequested") {
      expect(state.revisionCount).toBe(3);
    }
  });

  test("InReview after revision cycle → ResolveAllThreads → Approved (cycle resolves cleanly)", () => {
    const review: WorkLifecycleState = {
      tag: "InReview",
      row: row(),
      prNumber: 5666,
      reviewers: ["copilot"],
      threadCount: 2, // we've been through 2 revision cycles
    };
    const r = applyTransition(review, { tag: "ResolveAllThreads" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.tag).toBe("Approved");
  });
});

describe("close + abandon paths", () => {
  test("PrOpen → Close → Closed", () => {
    const pr: WorkLifecycleState = {
      tag: "PrOpen",
      row: row(),
      prNumber: 5666,
      openedBy: "otto",
      openedAt: "2026-05-28T00:00:00Z",
    };
    const r = applyTransition(pr, {
      tag: "Close",
      closedAt: "2026-05-28T01:00:00Z",
      reason: "superseded by other PR",
    });
    expect(r.ok).toBe(true);
    if (r.ok && r.state.tag === "Closed") {
      expect(r.state.reason).toBe("superseded by other PR");
    }
  });

  test("Backlog → Abandon → Abandoned", () => {
    const r = applyTransition(backlog(), {
      tag: "Abandon",
      reason: "operator-directed close",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.tag).toBe("Abandoned");
  });

  test("Claimed → Abandon → Abandoned", () => {
    const claimed: WorkLifecycleState = {
      tag: "Claimed",
      row: row(),
      claimedBy: "otto",
      claimAt: "2026-05-28T00:00:00Z",
    };
    const r = applyTransition(claimed, {
      tag: "Abandon",
      reason: "scope no longer relevant",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.tag).toBe("Abandoned");
  });
});

describe("illegal transitions", () => {
  test("Backlog → StartWork → illegal (must claim first)", () => {
    const r = applyTransition(backlog(), { tag: "StartWork", branchRef: "x" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("illegal transition");
  });

  test("Backlog → Merge → illegal (terminal transitions are not legal from Backlog)", () => {
    const r = applyTransition(backlog(), {
      tag: "Merge",
      mergeCommit: "x",
      mergedAt: "x",
    });
    expect(r.ok).toBe(false);
  });

  test("Merged → anything → illegal (terminal state)", () => {
    const merged: WorkLifecycleState = {
      tag: "Merged",
      row: row(),
      prNumber: 5666,
      mergeCommit: "abc",
      mergedAt: "2026-05-28T00:00:00Z",
    };
    const r = applyTransition(merged, { tag: "Approve", approvedAt: "x" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("terminal state");
  });

  test("Abandoned → anything → illegal", () => {
    const r = applyTransition(
      { tag: "Abandoned", row: row(), reason: "x" },
      { tag: "Claim", agent: "otto", timestamp: "x" },
    );
    expect(r.ok).toBe(false);
  });
});

describe("helpers", () => {
  test("isTerminal: Merged is terminal", () => {
    const merged: WorkLifecycleState = {
      tag: "Merged",
      row: row(),
      prNumber: 5666,
      mergeCommit: "abc",
      mergedAt: "x",
    };
    expect(isTerminal(merged)).toBe(true);
  });

  test("isTerminal: Backlog is NOT terminal", () => {
    expect(isTerminal(backlog())).toBe(false);
  });

  test("isTerminal: Closed is terminal", () => {
    const closed: WorkLifecycleState = {
      tag: "Closed",
      row: row(),
      prNumber: 5666,
      closedAt: "x",
      reason: "y",
    };
    expect(isTerminal(closed)).toBe(true);
  });

  test("revisionCount: in revision states", () => {
    const rev: WorkLifecycleState = {
      tag: "RevisionRequested",
      row: row(),
      prNumber: 5666,
      revisionCount: 3,
      threadIds: [],
    };
    expect(revisionCount(rev)).toBe(3);
  });

  test("revisionCount: zero in non-revision states", () => {
    expect(revisionCount(backlog())).toBe(0);
  });

  test("leadTimeSeconds: 30min lead time", () => {
    const sec = leadTimeSeconds("2026-05-28T00:00:00Z", "2026-05-28T00:30:00Z");
    expect(sec).toBe(1800);
  });
});

describe("integration: full happy path lifecycle", () => {
  test("Backlog → Claim → InProgress → PR → Review → 1 revision cycle → Approved → Merged", () => {
    let state: WorkLifecycleState = backlog();

    // Claim
    let r = applyTransition(state, {
      tag: "Claim",
      agent: "otto",
      timestamp: "2026-05-28T00:00:00Z",
    });
    expect(r.ok).toBe(true);
    state = r.state;
    expect(state.tag).toBe("Claimed");

    // Start work
    r = applyTransition(state, { tag: "StartWork", branchRef: "feat/x" });
    expect(r.ok).toBe(true);
    state = r.state;
    expect(state.tag).toBe("InProgress");

    // Open PR
    r = applyTransition(state, {
      tag: "OpenPr",
      prNumber: 5666,
      openedBy: "otto",
      openedAt: "2026-05-28T00:10:00Z",
    });
    expect(r.ok).toBe(true);
    state = r.state;
    expect(state.tag).toBe("PrOpen");

    // Request review
    r = applyTransition(state, { tag: "RequestReview", reviewers: ["copilot"] });
    expect(r.ok).toBe(true);
    state = r.state;
    expect(state.tag).toBe("InReview");

    // 1 revision cycle
    r = applyTransition(state, {
      tag: "ReceiveRevisionRequest",
      threadIds: ["RT_1"],
    });
    expect(r.ok).toBe(true);
    state = r.state;
    expect(state.tag).toBe("RevisionRequested");

    r = applyTransition(state, { tag: "PushRevision", sha: "abc" });
    expect(r.ok).toBe(true);
    state = r.state;
    expect(state.tag).toBe("RevisionPushed");

    r = applyTransition(state, { tag: "RequestReview", reviewers: ["copilot"] });
    expect(r.ok).toBe(true);
    state = r.state;
    expect(state.tag).toBe("InReview");

    // Threads resolved → Approved
    r = applyTransition(state, { tag: "ResolveAllThreads" });
    expect(r.ok).toBe(true);
    state = r.state;
    expect(state.tag).toBe("Approved");

    // Merge
    r = applyTransition(state, {
      tag: "Merge",
      mergeCommit: "abc123",
      mergedAt: "2026-05-28T00:30:00Z",
    });
    expect(r.ok).toBe(true);
    state = r.state;
    expect(state.tag).toBe("Merged");
    expect(isTerminal(state)).toBe(true);

    // Lead time: claimed at 00:00, merged at 00:30 = 1800 seconds
    expect(leadTimeSeconds("2026-05-28T00:00:00Z", "2026-05-28T00:30:00Z")).toBe(1800);
  });
});
