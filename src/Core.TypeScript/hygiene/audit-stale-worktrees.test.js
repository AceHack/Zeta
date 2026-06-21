// audit-stale-worktrees.test.ts — basic correctness tests for the
// worktree-staleness auditor.
import { describe, expect, test } from "bun:test";
import { parseArgs, parseWorktreePorcelain, renderReport } from "./audit-stale-worktrees.js";
describe("parseArgs", () => {
    test("parses a root override with report and prune", () => {
        const parsed = parseArgs(["--root", "/repo/control", "--report", "out.md", "--prune"]);
        expect(parsed).toEqual({
            kind: "args",
            args: {
                root: "/repo/control",
                report: "out.md",
                prune: true,
            },
        });
    });
    test("rejects missing root path", () => {
        expect(parseArgs(["--root"])).toEqual({
            kind: "error",
            message: "--root requires a path",
        });
    });
    test("rejects another known flag where root expects a path", () => {
        expect(parseArgs(["--root", "--prune"])).toEqual({
            kind: "error",
            message: "--root requires a path",
        });
    });
    test("rejects another known flag where report expects a path", () => {
        expect(parseArgs(["--report", "--root"])).toEqual({
            kind: "error",
            message: "--report requires a path",
        });
    });
    test("rejects an empty root path", () => {
        expect(parseArgs(["--root", ""])).toEqual({
            kind: "error",
            message: "--root requires a path",
        });
    });
    test("rejects an empty report path", () => {
        expect(parseArgs(["--report", ""])).toEqual({
            kind: "error",
            message: "--report requires a path",
        });
    });
    test("rejects an unknown dash-prefixed token where report expects a path", () => {
        expect(parseArgs(["--report", "--verbose"])).toEqual({
            kind: "error",
            message: "--report requires a path",
        });
    });
});
describe("parseWorktreePorcelain", () => {
    test("parses a single live worktree block", () => {
        const stdout = ["worktree /Users/foo/repo", "HEAD abc1234567890", "branch refs/heads/main", ""].join("\n");
        const entries = parseWorktreePorcelain(stdout);
        expect(entries).toHaveLength(1);
        expect(entries[0].path).toBe("/Users/foo/repo");
        expect(entries[0].branch).toBe("refs/heads/main");
        expect(entries[0].prunable).toBe(false);
    });
    test("parses a prunable worktree block", () => {
        const stdout = [
            "worktree /tmp/zeta-stale",
            "HEAD def4567890abc",
            "branch refs/heads/some-old-branch",
            "prunable gitdir file points to non-existent location",
            "",
        ].join("\n");
        const entries = parseWorktreePorcelain(stdout);
        expect(entries).toHaveLength(1);
        expect(entries[0].path).toBe("/tmp/zeta-stale");
        expect(entries[0].prunable).toBe(true);
    });
    test("parses multiple blocks separated by blank lines", () => {
        const stdout = [
            "worktree /repo/a",
            "HEAD aaa",
            "branch refs/heads/a",
            "",
            "worktree /repo/b",
            "HEAD bbb",
            "branch refs/heads/b",
            "prunable orphan",
            "",
            "worktree /repo/c",
            "HEAD ccc",
            "",
        ].join("\n");
        const entries = parseWorktreePorcelain(stdout);
        expect(entries).toHaveLength(3);
        expect(entries[1].prunable).toBe(true);
        expect(entries[2].branch).toBeNull();
    });
    test("handles a detached HEAD worktree (no branch line)", () => {
        const stdout = ["worktree /repo/detached", "HEAD abcdef", "detached", ""].join("\n");
        const entries = parseWorktreePorcelain(stdout);
        expect(entries).toHaveLength(1);
        expect(entries[0].branch).toBeNull();
    });
    test("returns an empty array for empty input", () => {
        expect(parseWorktreePorcelain("")).toHaveLength(0);
    });
});
describe("renderReport", () => {
    test("renders a healthy report (no stale entries)", () => {
        const fixed = new Date("2026-05-14T00:00:00Z");
        const md = renderReport({
            totalWorktrees: 3,
            healthy: 3,
            stalePathExists: [],
            stalePathMissing: [],
        }, fixed, null);
        expect(md).toContain("Total worktrees: 3");
        expect(md).toContain("Healthy: 3");
        expect(md).toContain("Stale, path missing on disk: 0");
        expect(md).not.toContain("## Stale worktrees");
    });
    test("renders a stale-path-missing table", () => {
        const fixed = new Date("2026-05-14T00:00:00Z");
        const md = renderReport({
            totalWorktrees: 2,
            healthy: 1,
            stalePathExists: [],
            stalePathMissing: [{ path: "/tmp/zeta-stale", head: "abc", branch: "refs/heads/feature/x", prunable: true }],
        }, fixed, null);
        expect(md).toContain("Stale, path missing on disk: 1");
        expect(md).toContain("| `/tmp/zeta-stale` | `refs/heads/feature/x` |");
    });
    test("renders prune output when provided", () => {
        const fixed = new Date("2026-05-14T00:00:00Z");
        const md = renderReport({
            totalWorktrees: 1,
            healthy: 0,
            stalePathExists: [],
            stalePathMissing: [{ path: "/tmp/zeta-stale", head: null, branch: null, prunable: true }],
        }, fixed, "Removing worktrees/zeta-stale\n");
        expect(md).toContain("## Prune output");
        expect(md).toContain("Removing worktrees/zeta-stale");
    });
});
