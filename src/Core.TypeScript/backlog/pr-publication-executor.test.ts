import { describe, expect, test } from "bun:test";
import {
  executePlan,
  extractPrUrl,
  substituteUrl,
  type CommandResult,
  type CommandRunner,
} from "./pr-publication-executor";
import { buildPublicationPlan, type PublicationInput, type PublicationPlan } from "./pr-publication-plan";

function input(overrides: Partial<PublicationInput> = {}): PublicationInput {
  return {
    backlogId: "B-0280",
    backlogTitle: "PR publication executor",
    backlogPath: "docs/backlog/P0/B-0280-autonomous-backlog-pr-publication-and-automerge-2026-05-08.md",
    branch: "claim/B-0280-pr-publication-executor",
    baseBranch: "main",
    bodyFilePath: "tmp/pr-bodies/B-0280.md",
    summary: ["adds the executor that runs push/create-pr/auto-merge"],
    checks: [{ command: "bun test", status: "passed" }],
    requiredChecks: { ok: 1, inProgress: 0, pending: 0, failed: 0 },
    unresolvedReviewThreads: 0,
    ...overrides,
  };
}

function plan(overrides: Partial<PublicationInput> = {}): PublicationPlan {
  return buildPublicationPlan(input(overrides));
}

type CommandLog = Array<{ argv: string[] }>;

function mockRunner(responses: Record<string, CommandResult>): { runner: CommandRunner; log: CommandLog } {
  const log: CommandLog = [];
  const runner: CommandRunner = {
    run(argv: string[]): CommandResult {
      log.push({ argv: [...argv] });
      const key = argv[0] ?? "";
      if (key === "git" && argv[1] === "push") return responses["push"] ?? { exitCode: 0, stdout: "", stderr: "" };
      if (key === "gh" && argv[1] === "pr" && argv[2] === "create")
        return responses["create-pr"] ?? { exitCode: 0, stdout: "", stderr: "" };
      if (key === "gh" && argv[1] === "pr" && argv[2] === "merge")
        return responses["arm-auto-merge"] ?? { exitCode: 0, stdout: "", stderr: "" };
      return { exitCode: 1, stdout: "", stderr: "unrecognized command" };
    },
  };
  return { runner, log };
}

const PR_URL = "https://github.com/Lucent-Financial-Group/Zeta/pull/2070";

describe("extractPrUrl", () => {
  test("extracts PR URL from gh output", () => {
    expect(extractPrUrl(PR_URL)).toBe(PR_URL);
    expect(extractPrUrl(`\n${PR_URL}\n`)).toBe(PR_URL);
    expect(extractPrUrl("Creating pull request...\n" + PR_URL)).toBe(PR_URL);
  });

  test("returns null when no PR URL is found", () => {
    expect(extractPrUrl("")).toBeNull();
    expect(extractPrUrl("error: something failed")).toBeNull();
    expect(extractPrUrl("https://github.com/owner/repo/issues/1")).toBeNull();
  });
});

describe("substituteUrl", () => {
  test("replaces <pr-url> placeholder", () => {
    const argv = ["gh", "pr", "merge", "<pr-url>", "--auto", "--squash"];
    expect(substituteUrl(argv, PR_URL)).toEqual(["gh", "pr", "merge", PR_URL, "--auto", "--squash"]);
  });

  test("leaves other args unchanged", () => {
    const argv = ["gh", "pr", "view"];
    expect(substituteUrl(argv, PR_URL)).toEqual(["gh", "pr", "view"]);
  });
});

describe("executePlan", () => {
  test("full happy path: push → create-pr → arm-auto-merge", () => {
    const p = plan();
    const { runner, log } = mockRunner({
      push: { exitCode: 0, stdout: "", stderr: "" },
      "create-pr": { exitCode: 0, stdout: PR_URL + "\n", stderr: "" },
      "arm-auto-merge": { exitCode: 0, stdout: "auto-merge enabled\n", stderr: "" },
    });

    const result = executePlan(p, runner);

    expect(result.pushed).toBe(true);
    expect(result.prCreated).toBe(true);
    expect(result.prUrl).toBe(PR_URL);
    expect(result.autoMergeArmed).toBe(true);
    expect(result.steps).toHaveLength(3);
    expect(log).toHaveLength(3);
    expect(log[0]?.argv[0]).toBe("git");
    expect(log[1]?.argv[0]).toBe("gh");
    expect(log[2]?.argv).toContain(PR_URL);
  });

  test("stops on push failure", () => {
    const p = plan();
    const { runner, log } = mockRunner({
      push: { exitCode: 128, stdout: "", stderr: "fatal: remote rejected" },
    });

    const result = executePlan(p, runner);

    expect(result.pushed).toBe(false);
    expect(result.prCreated).toBe(false);
    expect(result.prUrl).toBeNull();
    expect(result.autoMergeArmed).toBe(false);
    expect(result.steps).toHaveLength(1);
    expect(log).toHaveLength(1);
  });

  test("stops on create-pr failure", () => {
    const p = plan();
    const { runner, log } = mockRunner({
      push: { exitCode: 0, stdout: "", stderr: "" },
      "create-pr": { exitCode: 1, stdout: "", stderr: "already exists" },
    });

    const result = executePlan(p, runner);

    expect(result.pushed).toBe(true);
    expect(result.prCreated).toBe(false);
    expect(result.autoMergeArmed).toBe(false);
    expect(result.steps).toHaveLength(2);
    expect(log).toHaveLength(2);
  });

  test("skips auto-merge when plan disallows it", () => {
    const p = plan({ unresolvedReviewThreads: 1 });
    const { runner, log } = mockRunner({
      push: { exitCode: 0, stdout: "", stderr: "" },
      "create-pr": { exitCode: 0, stdout: PR_URL + "\n", stderr: "" },
    });

    const result = executePlan(p, runner);

    expect(result.pushed).toBe(true);
    expect(result.prCreated).toBe(true);
    expect(result.prUrl).toBe(PR_URL);
    expect(result.autoMergeArmed).toBe(false);
    expect(result.steps).toHaveLength(2);
    expect(log).toHaveLength(2);
  });

  test("handles auto-merge failure gracefully", () => {
    const p = plan();
    const { runner } = mockRunner({
      push: { exitCode: 0, stdout: "", stderr: "" },
      "create-pr": { exitCode: 0, stdout: PR_URL + "\n", stderr: "" },
      "arm-auto-merge": { exitCode: 1, stdout: "", stderr: "merge not allowed" },
    });

    const result = executePlan(p, runner);

    expect(result.pushed).toBe(true);
    expect(result.prCreated).toBe(true);
    expect(result.prUrl).toBe(PR_URL);
    expect(result.autoMergeArmed).toBe(false);
    expect(result.steps).toHaveLength(3);
  });

  test("skips auto-merge when PR URL cannot be parsed", () => {
    const p = plan();
    const { runner, log } = mockRunner({
      push: { exitCode: 0, stdout: "", stderr: "" },
      "create-pr": { exitCode: 0, stdout: "created but no url\n", stderr: "" },
    });

    const result = executePlan(p, runner);

    expect(result.pushed).toBe(true);
    expect(result.prCreated).toBe(true);
    expect(result.prUrl).toBeNull();
    expect(result.autoMergeArmed).toBe(false);
    expect(result.steps).toHaveLength(2);
    expect(log).toHaveLength(2);
  });
});
