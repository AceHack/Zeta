// tools/agent-heartbeats/merge-heartbeats-to-main.test.ts — 081KSKBP80008QG0R001KK9WV6.4 merge-tool tests.

import { describe, expect, it } from "bun:test";
import { armOutcome, armingEnabled, parseArgs } from "./merge-heartbeats-to-main";

const TEST_ENV = {} as NodeJS.ProcessEnv;

describe("parseArgs", () => {
  it("zero args returns built-in defaults", () => {
    const r = parseArgs([], TEST_ENV);
    if ("error" in r) throw new Error(r.error);
    expect(r.repo).toBe("Lucent-Financial-Group/Zeta");
    expect(r.head).toBe("agent-heartbeats");
    expect(r.base).toBe("main");
    expect(r.dryRun).toBe(false);
  });

  it("env vars override repo/head", () => {
    const r = parseArgs([], { ZETA_AGENT_REPO: "fork/Zeta", ZETA_AGENT_BRANCH: "heartbeats-v2" });
    if ("error" in r) throw new Error(r.error);
    expect(r.repo).toBe("fork/Zeta");
    expect(r.head).toBe("heartbeats-v2");
  });

  it("CLI flags override env + defaults", () => {
    const r = parseArgs(["--repo", "x/y", "--head", "h", "--base", "b", "--dry-run"], TEST_ENV);
    if ("error" in r) throw new Error(r.error);
    expect(r.repo).toBe("x/y");
    expect(r.head).toBe("h");
    expect(r.base).toBe("b");
    expect(r.dryRun).toBe(true);
  });

  it("rejects malformed --repo", () => {
    expect("error" in parseArgs(["--repo", "no-slash"], TEST_ENV)).toBe(true);
  });

  it("rejects unknown flag", () => {
    expect("error" in parseArgs(["--bogus"], TEST_ENV)).toBe(true);
  });
});

// Regression falsifier for the 2026-08-14 contract change: a failed auto-merge ARM must not
// destroy a successful PR. The prior code returned { error, code: 3 } here and dropped the PR
// number, so a completed flush reported total failure -- society-heartbeat and agent-heartbeat
// were red on every run partly because of it. These tests fail if that collapse comes back.
describe("armOutcome", () => {
  const pr = { number: 10397, url: "https://example.invalid/pr/10397", reused: true } as const;

  it("arming succeeded -> armed, no armError", () => {
    const r = armOutcome(pr, 0, "");
    expect(r.armed).toBe(true);
    expect(r.armError).toBeUndefined();
    expect(r.number).toBe(10397);
  });

  it("arming failed -> STILL a success shape, carrying the PR and the reason", () => {
    const r = armOutcome(pr, 1, "  GraphQL: Resource not accessible by personal access token (enablePullRequestAutoMerge)\n");
    // The load-bearing assertion: the PR survives an arming failure.
    expect(r.number).toBe(10397);
    expect(r.url).toBe(pr.url);
    expect(r.reused).toBe(true);
    expect(r.armed).toBe(false);
    expect(r.armError).toBe("GraphQL: Resource not accessible by personal access token (enablePullRequestAutoMerge)");
  });

  it("a non-zero status other than 1 is still a non-fatal unarmed outcome", () => {
    const r = armOutcome({ ...pr, reused: false }, 127, "gh: command not found");
    expect(r.armed).toBe(false);
    expect(r.reused).toBe(false);
    expect(r.armError).toBe("gh: command not found");
  });
});

// GraphQL is the budget that rate-limits this repo (GraphQL 1147/5000 points vs REST 33/5000
// requests, measured 2026-08-14) and enablePullRequestAutoMerge is GraphQL-ONLY. The arming
// call is therefore opt-in. These fail if it silently becomes default-on again.
describe("armingEnabled", () => {
  it("is OFF by default -- an unset env does not spend GraphQL budget", () => {
    expect(armingEnabled({} as NodeJS.ProcessEnv)).toBe(false);
  });

  it("is ON only for the exact opt-in value", () => {
    expect(armingEnabled({ ZETA_FLUSH_ARM_AUTOMERGE: "1" } as NodeJS.ProcessEnv)).toBe(true);
  });

  it("truthy-looking values are NOT the opt-in", () => {
    for (const v of ["true", "yes", "0", "", "on"]) {
      expect(armingEnabled({ ZETA_FLUSH_ARM_AUTOMERGE: v } as NodeJS.ProcessEnv)).toBe(false);
    }
  });
});
