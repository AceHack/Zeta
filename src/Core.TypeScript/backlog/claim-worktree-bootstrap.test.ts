import { describe, expect, test } from "bun:test";
import {
  assertNoPathOverlaps,
  buildBootstrapPlan,
  findPathOverlaps,
  pathsOverlap,
  type ActiveSignal,
  type BootstrapRequest,
} from "./claim-worktree-bootstrap";

function request(overrides: Partial<BootstrapRequest> = {}): BootstrapRequest {
  return {
    repoRoot: "/repo/Zeta",
    slug: "backlog-0279",
    backlogId: "081KR2E4K0008QG0R000YTJS3Q",
    scope: "Build claim and worktree bootstrap",
    durableTarget: "docs/backlog/P0/081KR2E4K0008QG0R000YTJS3Q-autonomous-backlog-claim-worktree-bootstrap-2026-05-08.md",
    paths: ["src/Core.TypeScript/backlog/claim-worktree-bootstrap.ts", "src/Core.TypeScript/backlog/claim-worktree-bootstrap.test.ts"],
    sessionId: "codex/20260508T0529Z-b0279",
    harness: "codex",
    claimedAt: "2026-05-08T05:29:00Z",
    eta: "2026-05-08T06:15:00Z",
    worktreeRoot: "/worktrees",
    platformMirror: "GitHub PR pending",
    ...overrides,
  };
}

function signal(overrides: Partial<ActiveSignal> = {}): ActiveSignal {
  return {
    source: "origin/claim/other",
    claim: "other",
    paths: ["src/Zeta.Core/"],
    updatedAt: null,
    ...overrides,
  };
}

describe("pathsOverlap", () => {
  test("matches exact files and directory prefixes", () => {
    expect(pathsOverlap("src/Core.TypeScript/backlog/foo.ts", "src/Core.TypeScript/backlog/foo.ts")).toBe(true);
    expect(pathsOverlap("src/Core.TypeScript/backlog/foo.ts", "src/Core.TypeScript/backlog/")).toBe(true);
    expect(pathsOverlap("src/Core.TypeScript/backlog", "src/Core.TypeScript/backlog/foo.ts")).toBe(true);
  });

  test("does not confuse sibling prefixes", () => {
    expect(pathsOverlap("src/Core.TypeScript/backlogger/foo.ts", "src/Core.TypeScript/backlog")).toBe(false);
    expect(pathsOverlap("docs/backlog/P0/081KR2E4K0008QG0R000YTJS3Q.md", "docs/backlog/P1/081KR2E4K0008QG0R000YTJS3Q.md")).toBe(false);
  });
});

describe("findPathOverlaps", () => {
  test("returns all active overlap evidence", () => {
    const overlaps = findPathOverlaps(
      ["src/Core.TypeScript/backlog/claim-worktree-bootstrap.ts", "docs/backlog/P0/081KR2E4K0008QG0R000YTJS3Q.md"],
      [
        signal({ source: "origin/claim/a", claim: "a", paths: ["src/Core.TypeScript/backlog/"] }),
        signal({ source: "heartbeat.json", claim: "b", paths: ["docs/backlog/P0/081KR2E4K0008QG0R000YTJS3Q.md"] }),
      ],
    );

    expect(overlaps.map((overlap) => overlap.signal.claim)).toEqual(["a", "b"]);
    expect(overlaps[0]?.requestedPath).toBe("src/Core.TypeScript/backlog/claim-worktree-bootstrap.ts");
    expect(overlaps[1]?.activePath).toBe("docs/backlog/P0/081KR2E4K0008QG0R000YTJS3Q.md");
  });

  test("assertNoPathOverlaps fails closed with concrete evidence", () => {
    expect(() =>
      assertNoPathOverlaps(
        ["src/Core.TypeScript/backlog/claim-worktree-bootstrap.ts"],
        [signal({ source: "origin/claim/a", claim: "a", paths: ["src/Core.TypeScript/backlog/"] })],
      ),
    ).toThrow("active claim/path overlap detected");
  });
});

describe("buildBootstrapPlan", () => {
  test("builds claim branch, heartbeat, and claim-file substrate", () => {
    const plan = buildBootstrapPlan(request(), "/repo/Zeta/.git");

    expect(plan.branch).toBe("claim/backlog-0279");
    expect(plan.worktreePath).toBe("/worktrees/backlog-0279");
    expect(plan.claimRelativePath).toBe("docs/claims/backlog-0279.md");
    expect(plan.claimFilePath).toBe("/worktrees/backlog-0279/docs/claims/backlog-0279.md");
    expect(plan.heartbeatFilePath).toBe("/repo/Zeta/.git/agent-heartbeats/codex-20260508T0529Z-b0279.json");
    expect(plan.commitSubject).toBe("claim: backlog-0279 - Build claim and worktree bootstrap");
    expect(plan.claimBody).toContain("Initial intended path set");
    expect(plan.claimBody).toContain("`src/Core.TypeScript/backlog/claim-worktree-bootstrap.ts`");
    expect(JSON.parse(plan.heartbeatBody)).toMatchObject({
      session: "codex/20260508T0529Z-b0279",
      claim: "backlog-0279",
      branch: "claim/backlog-0279",
      status: "active",
    });
  });

  test("accepts normalized dotted backlog child slugs", () => {
    const plan = buildBootstrapPlan(
      request({
        slug: "backlog-0164-1",
        backlogId: "081KR7JY10008QG0R000MH7PJT",
        durableTarget: "docs/backlog/P1/081KR7JY10008QG0R000MH7PJT-child-row.md",
      }),
      "/repo/Zeta/.git",
    );

    expect(plan.branch).toBe("claim/backlog-0164-1");
    expect(plan.claimRelativePath).toBe("docs/claims/backlog-0164-1.md");
    expect(plan.worktreePath).toBe("/worktrees/backlog-0164-1");
  });

  test("rejects non-numeric backlog suffix slugs", () => {
    expect(() => buildBootstrapPlan(request({ slug: "backlog-0164-alpha" }), "/repo/Zeta/.git")).toThrow(
      "invalid claim slug",
    );
  });

  test("rejects absolute or parent-traversal path claims", () => {
    expect(() => buildBootstrapPlan(request({ paths: ["/tmp/outside"] }), "/repo/Zeta/.git")).toThrow(
      "unsafe repo-relative path",
    );
    expect(() => buildBootstrapPlan(request({ paths: ["../outside"] }), "/repo/Zeta/.git")).toThrow(
      "unsafe repo-relative path",
    );
  });
});
