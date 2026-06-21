// audit-worktree-survey.test.ts -- focused coverage for the 081KDVJT3E008QG0R000SCFYN5
// worktree recovery survey classifier.

import { describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  classifyWorktrees,
  formatSurveyOutput,
  inspectWorktreeEntry,
  makeSurvey,
  parseArgs,
  parseWorktreePorcelain,
  renderMarkdown,
  type WorktreeEntry,
  type WorktreeInspection,
} from "./audit-worktree-survey.ts";

function entry(overrides: Partial<WorktreeEntry> = {}): WorktreeEntry {
  return {
    path: "/repo/worktree",
    head: "abc123",
    branch: "refs/heads/feature",
    locked: true,
    lockReason: "agent parked for recovery",
    prunable: false,
    ...overrides,
  };
}

function inspection(overrides: Partial<WorktreeInspection> = {}): WorktreeInspection {
  return {
    pathExists: true,
    dirty: false,
    headReachableFromMain: true,
    treeEquivalentToMain: null,
    patchEquivalentToMain: null,
    statusError: null,
    ...overrides,
  };
}

function runGit(repo: string, args: readonly string[]): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout.trim();
}

function commitFile(repo: string, path: string, content: string, message: string): void {
  writeFileSync(join(repo, path), content);
  runGit(repo, ["add", path]);
  runGit(repo, ["commit", "-m", message]);
}

describe("parseArgs", () => {
  test("parses root, report, and json flags", () => {
    expect(parseArgs(["--root", "/repo", "--report", "survey.md", "--json", "--dry"])).toEqual({
      kind: "args",
      args: {
        root: "/repo",
        report: "survey.md",
        json: true,
        dry: true,
      },
    });
  });

  test("rejects missing root path", () => {
    expect(parseArgs(["--root"])).toEqual({
      kind: "error",
      message: "--root requires a path",
    });
  });

  test("rejects another flag where report expects a path", () => {
    expect(parseArgs(["--report", "--json"])).toEqual({
      kind: "error",
      message: "--report requires a path",
    });
  });

  test("rejects unknown arguments", () => {
    expect(parseArgs(["--dry-run"])).toEqual({
      kind: "error",
      message: "Unknown argument: --dry-run",
    });
  });
});

describe("parseWorktreePorcelain", () => {
  test("parses live, prunable, and detached worktrees", () => {
    const stdout = [
      "worktree /repo/main",
      "HEAD aaa",
      "branch refs/heads/main",
      "locked active recovery lane",
      "",
      "worktree /repo/stale",
      "HEAD bbb",
      "branch refs/heads/old",
      "prunable gitdir file points to non-existent location",
      "",
      "worktree /repo/detached",
      "HEAD ccc",
      "detached",
      "locked",
      "",
    ]
      .join("\n")
      .replace(/\n/g, "\r\n");

    expect(parseWorktreePorcelain(stdout)).toEqual([
      {
        path: "/repo/main",
        head: "aaa",
        branch: "refs/heads/main",
        locked: true,
        lockReason: "active recovery lane",
        prunable: false,
      },
      {
        path: "/repo/stale",
        head: "bbb",
        branch: "refs/heads/old",
        locked: false,
        lockReason: null,
        prunable: true,
      },
      {
        path: "/repo/detached",
        head: "ccc",
        branch: null,
        locked: true,
        lockReason: null,
        prunable: false,
      },
    ]);
  });

  test("returns no entries for empty porcelain output", () => {
    expect(parseWorktreePorcelain("")).toEqual([]);
  });
});

describe("classifyWorktrees", () => {
  test("marks clean worktrees whose HEAD is on origin/main as already covered", () => {
    const items = classifyWorktrees([entry()], {
      inspect: () => inspection(),
    });

    expect(items[0]!.bucket).toBe("ALREADY-COVERED");
    expect(items[0]!.reason).toContain("reachable from origin/main");
  });

  test("marks dirty worktrees as needing recovery", () => {
    const items = classifyWorktrees([entry()], {
      inspect: () => inspection({ dirty: true, headReachableFromMain: false }),
    });

    expect(items[0]!.bucket).toBe("NEEDS-RECOVERY");
    expect(items[0]!.reason).toContain("uncommitted or untracked");
  });

  test("marks missing prunable entries without a recorded HEAD as obsolete", () => {
    const items = classifyWorktrees([entry({ head: null, prunable: true })], {
      inspect: () => inspection({ pathExists: false, dirty: null, headReachableFromMain: null }),
    });

    expect(items[0]!.bucket).toBe("OBSOLETE");
    expect(items[0]!.reason).toContain("prunable");
  });

  test("marks missing prunable entries with uncovered commits as needing recovery", () => {
    const items = classifyWorktrees([entry({ prunable: true })], {
      inspect: () =>
        inspection({
          pathExists: false,
          dirty: null,
          headReachableFromMain: false,
          treeEquivalentToMain: false,
          patchEquivalentToMain: false,
        }),
    });

    expect(items[0]!.bucket).toBe("NEEDS-RECOVERY");
    expect(items[0]!.reason).toContain("HEAD is not known covered");
  });

  test("marks missing non-prunable entries as needing recovery", () => {
    const items = classifyWorktrees([entry()], {
      inspect: () => inspection({ pathExists: false, dirty: null, headReachableFromMain: null }),
    });

    expect(items[0]!.bucket).toBe("NEEDS-RECOVERY");
    expect(items[0]!.reason).toContain("did not mark");
  });

  test("marks clean but uncovered worktrees as needing recovery", () => {
    const items = classifyWorktrees([entry()], {
      inspect: () =>
        inspection({
          headReachableFromMain: false,
          treeEquivalentToMain: false,
          patchEquivalentToMain: false,
        }),
    });

    expect(items[0]!.bucket).toBe("NEEDS-RECOVERY");
    expect(items[0]!.reason).toContain("not known reachable, merge-tree-equivalent, or patch-equivalent");
  });

  test("marks clean delta-equivalent worktrees as already covered", () => {
    const items = classifyWorktrees([entry()], {
      inspect: () => inspection({ headReachableFromMain: false, treeEquivalentToMain: true }),
    });

    expect(items[0]!.bucket).toBe("ALREADY-COVERED");
    expect(items[0]!.reason).toContain("match a historical origin/main delta");
  });

  test("marks clean patch-equivalent worktrees as already covered", () => {
    const items = classifyWorktrees([entry()], {
      inspect: () => inspection({ headReachableFromMain: false, patchEquivalentToMain: true }),
    });

    expect(items[0]!.bucket).toBe("ALREADY-COVERED");
    expect(items[0]!.reason).toContain("patch-equivalent");
  });

  test("marks status read failures as needing recovery", () => {
    const items = classifyWorktrees([entry()], {
      inspect: () => inspection({ dirty: null, headReachableFromMain: null, statusError: "fatal: not a git repo" }),
    });

    expect(items[0]!.bucket).toBe("NEEDS-RECOVERY");
    expect(items[0]!.reason).toContain("status could not be read");
  });
});

describe("inspectWorktreeEntry", () => {
  test("marks squashed branch changes as covered after later main edits to the same file", () => {
    const repo = mkdtempSync(join(tmpdir(), "zeta-worktree-survey-"));
    try {
      runGit(repo, ["init", "-b", "main"]);
      runGit(repo, ["config", "user.email", "test@example.com"]);
      runGit(repo, ["config", "user.name", "Zeta Test"]);

      commitFile(repo, "tracked.txt", "base\n", "base");
      runGit(repo, ["checkout", "-b", "feature"]);
      commitFile(repo, "tracked.txt", "feature line one\n", "feature one");
      commitFile(repo, "tracked.txt", "feature final\n", "feature two");
      const featureHead = runGit(repo, ["rev-parse", "HEAD"]);

      runGit(repo, ["checkout", "main"]);
      commitFile(repo, "tracked.txt", "feature final\n", "squash feature");
      commitFile(repo, "tracked.txt", "feature final\nlater main work\n", "later main");
      runGit(repo, ["update-ref", "refs/remotes/origin/main", "HEAD"]);

      const result = inspectWorktreeEntry(entry({ path: repo, head: featureHead }));
      expect(result.dirty).toBe(false);
      expect(result.headReachableFromMain).toBe(false);
      expect(result.treeEquivalentToMain).toBe(true);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test("marks branch changes as covered when included in a larger squash commit", () => {
    const repo = mkdtempSync(join(tmpdir(), "zeta-worktree-survey-"));
    try {
      runGit(repo, ["init", "-b", "main"]);
      runGit(repo, ["config", "user.email", "test@example.com"]);
      runGit(repo, ["config", "user.name", "Zeta Test"]);

      commitFile(repo, "tracked.txt", "base\n", "base");
      commitFile(repo, "other.txt", "base\n", "other base");
      runGit(repo, ["checkout", "-b", "feature"]);
      commitFile(repo, "tracked.txt", "feature substrate\n", "feature substrate");
      const featureHead = runGit(repo, ["rev-parse", "HEAD"]);

      runGit(repo, ["checkout", "main"]);
      writeFileSync(join(repo, "tracked.txt"), "feature substrate\n");
      writeFileSync(join(repo, "other.txt"), "batched unrelated work\n");
      runGit(repo, ["add", "tracked.txt", "other.txt"]);
      runGit(repo, ["commit", "-m", "squash batch"]);
      runGit(repo, ["update-ref", "refs/remotes/origin/main", "HEAD"]);

      const result = inspectWorktreeEntry(entry({ path: repo, head: featureHead }));
      expect(result.dirty).toBe(false);
      expect(result.headReachableFromMain).toBe(false);
      expect(result.treeEquivalentToMain).toBe(true);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test("marks branch hunks as covered when adjacent squash edits changed context", () => {
    const repo = mkdtempSync(join(tmpdir(), "zeta-worktree-survey-"));
    try {
      runGit(repo, ["init", "-b", "main"]);
      runGit(repo, ["config", "user.email", "test@example.com"]);
      runGit(repo, ["config", "user.name", "Zeta Test"]);

      commitFile(repo, "tracked.txt", "a\nb\nc\n", "base");
      runGit(repo, ["checkout", "-b", "feature"]);
      commitFile(repo, "tracked.txt", "a\nB\nc\n", "feature hunk");
      const featureHead = runGit(repo, ["rev-parse", "HEAD"]);

      runGit(repo, ["checkout", "main"]);
      commitFile(repo, "tracked.txt", "a\nB\nC\n", "squash adjacent hunk");
      runGit(repo, ["update-ref", "refs/remotes/origin/main", "HEAD"]);

      const result = inspectWorktreeEntry(entry({ path: repo, head: featureHead }));
      expect(result.dirty).toBe(false);
      expect(result.headReachableFromMain).toBe(false);
      expect(result.treeEquivalentToMain).toBe(true);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test("marks deletion-only branch hunks as covered when adjacent squash edits changed context", () => {
    const repo = mkdtempSync(join(tmpdir(), "zeta-worktree-survey-"));
    try {
      runGit(repo, ["init", "-b", "main"]);
      runGit(repo, ["config", "user.email", "test@example.com"]);
      runGit(repo, ["config", "user.name", "Zeta Test"]);

      commitFile(repo, "tracked.txt", "a\nb\nc\n", "base");
      runGit(repo, ["checkout", "-b", "feature"]);
      commitFile(repo, "tracked.txt", "a\nc\n", "feature deletion");
      const featureHead = runGit(repo, ["rev-parse", "HEAD"]);

      runGit(repo, ["checkout", "main"]);
      commitFile(repo, "tracked.txt", "a\nC\n", "squash deletion with adjacent edit");
      runGit(repo, ["update-ref", "refs/remotes/origin/main", "HEAD"]);

      const result = inspectWorktreeEntry(entry({ path: repo, head: featureHead }));
      expect(result.dirty).toBe(false);
      expect(result.headReachableFromMain).toBe(false);
      expect(result.treeEquivalentToMain).toBe(true);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test("does not mark deletion-only branch hunks as covered when deleted lines remain", () => {
    const repo = mkdtempSync(join(tmpdir(), "zeta-worktree-survey-"));
    try {
      runGit(repo, ["init", "-b", "main"]);
      runGit(repo, ["config", "user.email", "test@example.com"]);
      runGit(repo, ["config", "user.name", "Zeta Test"]);

      commitFile(repo, "tracked.txt", "a\nb\nc\n", "base");
      runGit(repo, ["checkout", "-b", "feature"]);
      commitFile(repo, "tracked.txt", "a\nc\n", "feature deletion");
      const featureHead = runGit(repo, ["rev-parse", "HEAD"]);

      runGit(repo, ["checkout", "main"]);
      commitFile(repo, "tracked.txt", "a\nb\nC\n", "adjacent edit without deletion");
      runGit(repo, ["update-ref", "refs/remotes/origin/main", "HEAD"]);

      const result = inspectWorktreeEntry(entry({ path: repo, head: featureHead }));
      expect(result.dirty).toBe(false);
      expect(result.headReachableFromMain).toBe(false);
      expect(result.treeEquivalentToMain).toBe(false);
      expect(result.patchEquivalentToMain).toBe(false);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test("does not mark overwritten historical branch results as covered", () => {
    const repo = mkdtempSync(join(tmpdir(), "zeta-worktree-survey-"));
    try {
      runGit(repo, ["init", "-b", "main"]);
      runGit(repo, ["config", "user.email", "test@example.com"]);
      runGit(repo, ["config", "user.name", "Zeta Test"]);

      commitFile(repo, "tracked.txt", "A\n", "base");
      runGit(repo, ["checkout", "-b", "feature"]);
      commitFile(repo, "tracked.txt", "B\n", "feature result");
      const featureHead = runGit(repo, ["rev-parse", "HEAD"]);

      runGit(repo, ["checkout", "main"]);
      commitFile(repo, "tracked.txt", "B\n", "squash feature result");
      commitFile(repo, "tracked.txt", "C\n", "overwrite feature result");
      runGit(repo, ["update-ref", "refs/remotes/origin/main", "HEAD"]);

      const result = inspectWorktreeEntry(entry({ path: repo, head: featureHead }));
      expect(result.dirty).toBe(false);
      expect(result.headReachableFromMain).toBe(false);
      expect(result.treeEquivalentToMain).toBe(false);
      expect(result.patchEquivalentToMain).toBe(false);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test("does not mark unrelated matching text as covered", () => {
    const repo = mkdtempSync(join(tmpdir(), "zeta-worktree-survey-"));
    try {
      runGit(repo, ["init", "-b", "main"]);
      runGit(repo, ["config", "user.email", "test@example.com"]);
      runGit(repo, ["config", "user.name", "Zeta Test"]);

      commitFile(repo, "tracked.txt", "a\nb\nc\n", "base");
      runGit(repo, ["checkout", "-b", "feature"]);
      commitFile(repo, "tracked.txt", "a\nB\nc\n", "feature hunk");
      const featureHead = runGit(repo, ["rev-parse", "HEAD"]);

      runGit(repo, ["checkout", "main"]);
      commitFile(repo, "tracked.txt", "a\nb\nc\nB\n", "append unrelated matching text");
      runGit(repo, ["update-ref", "refs/remotes/origin/main", "HEAD"]);

      const result = inspectWorktreeEntry(entry({ path: repo, head: featureHead }));
      expect(result.dirty).toBe(false);
      expect(result.headReachableFromMain).toBe(false);
      expect(result.treeEquivalentToMain).toBe(false);
      expect(result.patchEquivalentToMain).toBe(false);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test("marks mode-only branch changes as covered when main retained the mode", () => {
    const repo = mkdtempSync(join(tmpdir(), "zeta-worktree-survey-"));
    try {
      runGit(repo, ["init", "-b", "main"]);
      runGit(repo, ["config", "user.email", "test@example.com"]);
      runGit(repo, ["config", "user.name", "Zeta Test"]);

      const scriptPath = join(repo, "script.sh");
      commitFile(repo, "script.sh", "#!/usr/bin/env bash\necho hi\n", "base script");
      runGit(repo, ["checkout", "-b", "feature"]);
      chmodSync(scriptPath, 0o755);
      runGit(repo, ["add", "script.sh"]);
      runGit(repo, ["commit", "-m", "make script executable"]);
      const featureHead = runGit(repo, ["rev-parse", "HEAD"]);

      runGit(repo, ["checkout", "main"]);
      chmodSync(scriptPath, 0o755);
      runGit(repo, ["add", "script.sh"]);
      runGit(repo, ["commit", "-m", "squash executable mode"]);
      runGit(repo, ["update-ref", "refs/remotes/origin/main", "HEAD"]);

      const result = inspectWorktreeEntry(entry({ path: repo, head: featureHead }));
      expect(result.dirty).toBe(false);
      expect(result.headReachableFromMain).toBe(false);
      expect(result.treeEquivalentToMain).toBe(true);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test("marks exact later first-parent commit deltas as covered after unrelated main work", () => {
    const repo = mkdtempSync(join(tmpdir(), "zeta-worktree-survey-"));
    try {
      runGit(repo, ["init", "-b", "main"]);
      runGit(repo, ["config", "user.email", "test@example.com"]);
      runGit(repo, ["config", "user.name", "Zeta Test"]);

      commitFile(repo, "tracked.txt", "base\n", "base");
      commitFile(repo, "other.txt", "base\n", "other base");
      runGit(repo, ["checkout", "-b", "feature"]);
      commitFile(repo, "tracked.txt", "feature substrate\n", "feature substrate");
      const featureHead = runGit(repo, ["rev-parse", "HEAD"]);

      runGit(repo, ["checkout", "main"]);
      commitFile(repo, "other.txt", "unrelated earlier main work\n", "unrelated main");
      commitFile(repo, "tracked.txt", "feature substrate\n", "exact feature squash");
      runGit(repo, ["update-ref", "refs/remotes/origin/main", "HEAD"]);

      const result = inspectWorktreeEntry(entry({ path: repo, head: featureHead }));
      expect(result.dirty).toBe(false);
      expect(result.headReachableFromMain).toBe(false);
      expect(result.treeEquivalentToMain).toBe(true);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test("handles large branch deltas without degrading coverage to unknown", () => {
    const repo = mkdtempSync(join(tmpdir(), "zeta-worktree-survey-"));
    try {
      runGit(repo, ["init", "-b", "main"]);
      runGit(repo, ["config", "user.email", "test@example.com"]);
      runGit(repo, ["config", "user.name", "Zeta Test"]);

      commitFile(repo, "tracked.txt", "base\n", "base");
      runGit(repo, ["checkout", "-b", "feature"]);
      commitFile(repo, "large.txt", `${"x".repeat(2 * 1024 * 1024)}\n`, "large feature");
      const featureHead = runGit(repo, ["rev-parse", "HEAD"]);

      runGit(repo, ["checkout", "main"]);
      writeFileSync(join(repo, "large.txt"), `${"x".repeat(2 * 1024 * 1024)}\n`);
      writeFileSync(join(repo, "tracked.txt"), "base\nbatched unrelated work\n");
      runGit(repo, ["add", "large.txt", "tracked.txt"]);
      runGit(repo, ["commit", "-m", "squash large batch"]);
      runGit(repo, ["update-ref", "refs/remotes/origin/main", "HEAD"]);

      const result = inspectWorktreeEntry(entry({ path: repo, head: featureHead }));
      expect(result.dirty).toBe(false);
      expect(result.headReachableFromMain).toBe(false);
      expect(result.treeEquivalentToMain).toBe(true);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test("handles large covered branch diffs without spawn buffer exhaustion", () => {
    const repo = mkdtempSync(join(tmpdir(), "zeta-worktree-survey-"));
    try {
      runGit(repo, ["init", "-b", "main"]);
      runGit(repo, ["config", "user.email", "test@example.com"]);
      runGit(repo, ["config", "user.name", "Zeta Test"]);

      const largeFeatureContent = "covered branch payload\n".repeat(90_000);
      commitFile(repo, "large.txt", "base\n", "base");
      commitFile(repo, "other.txt", "base\n", "other base");
      runGit(repo, ["checkout", "-b", "feature"]);
      commitFile(repo, "large.txt", largeFeatureContent, "large feature substrate");
      const featureHead = runGit(repo, ["rev-parse", "HEAD"]);

      runGit(repo, ["checkout", "main"]);
      writeFileSync(join(repo, "large.txt"), largeFeatureContent);
      writeFileSync(join(repo, "other.txt"), "batched unrelated work\n");
      runGit(repo, ["add", "large.txt", "other.txt"]);
      runGit(repo, ["commit", "-m", "large squash batch"]);
      runGit(repo, ["update-ref", "refs/remotes/origin/main", "HEAD"]);

      const result = inspectWorktreeEntry(entry({ path: repo, head: featureHead }));
      expect(result.headReachableFromMain).toBe(false);
      expect(result.treeEquivalentToMain).toBe(true);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test("does not mark reverted historical branch deltas as covered", () => {
    const repo = mkdtempSync(join(tmpdir(), "zeta-worktree-survey-"));
    try {
      runGit(repo, ["init", "-b", "main"]);
      runGit(repo, ["config", "user.email", "test@example.com"]);
      runGit(repo, ["config", "user.name", "Zeta Test"]);

      commitFile(repo, "tracked.txt", "base\n", "base");
      runGit(repo, ["checkout", "-b", "feature"]);
      commitFile(repo, "tracked.txt", "feature substrate\n", "feature substrate");
      const featureHead = runGit(repo, ["rev-parse", "HEAD"]);

      runGit(repo, ["checkout", "main"]);
      commitFile(repo, "tracked.txt", "feature substrate\n", "squash feature");
      commitFile(repo, "tracked.txt", "base\n", "revert feature");
      runGit(repo, ["update-ref", "refs/remotes/origin/main", "HEAD"]);

      const result = inspectWorktreeEntry(entry({ path: repo, head: featureHead }));
      expect(result.headReachableFromMain).toBe(false);
      expect(result.treeEquivalentToMain).toBe(false);
      expect(result.patchEquivalentToMain).toBe(false);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test("checks missing prunable worktree HEAD coverage from the repository context", () => {
    const repo = mkdtempSync(join(tmpdir(), "zeta-worktree-survey-"));
    try {
      runGit(repo, ["init", "-b", "main"]);
      runGit(repo, ["config", "user.email", "test@example.com"]);
      runGit(repo, ["config", "user.name", "Zeta Test"]);

      commitFile(repo, "tracked.txt", "base\n", "base");
      runGit(repo, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
      runGit(repo, ["checkout", "-b", "feature"]);
      commitFile(repo, "tracked.txt", "unique committed work\n", "unique feature");
      const featureHead = runGit(repo, ["rev-parse", "HEAD"]);

      const missingPath = join(repo, "deleted-linked-worktree");
      const result = inspectWorktreeEntry(entry({ path: missingPath, head: featureHead, prunable: true }), repo);
      expect(result.pathExists).toBe(false);
      expect(result.dirty).toBe(null);
      expect(result.headReachableFromMain).toBe(false);
      expect(result.treeEquivalentToMain).toBe(false);
      expect(result.patchEquivalentToMain).toBe(false);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});

describe("renderMarkdown", () => {
  test("surveys only locked or prunable worktrees", () => {
    const survey = makeSurvey(
      [
        entry({ path: "/repo/unlocked", locked: false, lockReason: null, prunable: false }),
        entry({ path: "/repo/locked", locked: true, prunable: false }),
        entry({ path: "/repo/prunable", locked: false, lockReason: null, prunable: true }),
      ],
      { inspect: () => inspection() },
      new Date("2026-05-31T14:32:00Z"),
      null,
    );

    expect(survey.items.map((item) => item.path)).toEqual(["/repo/locked", "/repo/prunable"]);
    expect(survey.totals.worktrees).toBe(2);
  });

  test("renders totals and bucket tables", () => {
    const survey = makeSurvey(
      [entry({ path: "/repo/dirty" }), entry({ path: "/repo/stale", head: null, prunable: true })],
      {
        inspect: (e) =>
          e.path.endsWith("stale")
            ? inspection({ pathExists: false, dirty: null, headReachableFromMain: null })
            : inspection({ dirty: true, headReachableFromMain: false }),
      },
      new Date("2026-05-31T14:32:00Z"),
      "`/repo`",
    );

    const md = renderMarkdown(survey);
    expect(md).toContain("Generated: 2026-05-31T14:32:00.000Z");
    expect(md).toContain("Root: `` `/repo` ``");
    expect(md).toContain("- Surveyed locked/prunable worktrees: 2");
    expect(md).toContain("- NEEDS-RECOVERY: 1");
    expect(md).toContain("- OBSOLETE: 1");
    expect(md).toContain("## NEEDS-RECOVERY");
    expect(md).toContain("## OBSOLETE");
    expect(md).toContain("| `/repo/dirty` |");
    expect(md).toContain("| `/repo/stale` |");
  });

  test("escapes markdown table cells", () => {
    const survey = makeSurvey(
      [entry({ path: "/repo/has|pipe\\slash", branch: "refs/heads/has`tick" })],
      {
        inspect: () =>
          inspection({
            dirty: null,
            headReachableFromMain: null,
            statusError: "fatal: reason|with\nnewline",
          }),
      },
      new Date("2026-05-31T14:32:00Z"),
      null,
    );

    const md = renderMarkdown(survey);
    expect(md).toContain("`/repo/has\\|pipe\\\\slash`");
    expect(md).toContain("``refs/heads/has`tick``");
    expect(md).toContain("fatal: reason\\|with<br>newline");
  });

  test("uses longer code fences for values with edge backticks", () => {
    const survey = makeSurvey(
      [entry({ path: "`/repo/edge`", branch: "refs/heads/``edge" })],
      { inspect: () => inspection() },
      new Date("2026-05-31T14:32:00Z"),
      null,
    );

    const md = renderMarkdown(survey);
    expect(md).toContain("`` `/repo/edge` ``");
    expect(md).toContain("```refs/heads/``edge```");
  });

  test("formats report output with a trailing newline", () => {
    const survey = makeSurvey([entry()], { inspect: () => inspection() }, new Date("2026-05-31T14:32:00Z"), null);

    expect(formatSurveyOutput(survey, false).endsWith("\n")).toBe(true);
    expect(formatSurveyOutput(survey, true).endsWith("\n")).toBe(true);
  });
});
