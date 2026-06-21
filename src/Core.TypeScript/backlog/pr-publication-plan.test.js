import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPrBody, buildPrTitle, buildPublicationPlan, decideAutoMerge, normalizeBranchRef, validatePublicationInput, writePrBodyFile, } from "./pr-publication-plan";
function input(overrides = {}) {
    return {
        backlogId: "081KR2E4K0008QG0R0022RVRCZ",
        backlogTitle: "Autonomous backlog pickup - PR publication and auto-merge",
        backlogPath: "docs/backlog/P0/081KR2E4K0008QG0R0022RVRCZ-autonomous-backlog-pr-publication-and-automerge-2026-05-08.md",
        branch: "claim/task-b0280-pr-publication-plan",
        baseBranch: "main",
        bodyFilePath: "tmp/pr-bodies/081KR2E4K0008QG0R0022RVRCZ.md",
        summary: [
            "adds a deterministic PR publication packet",
            "keeps auto-merge arming behind review-thread and required-check gates",
        ],
        checks: [
            { command: "bun test src/Core.TypeScript/backlog/pr-publication-plan.test.ts", status: "passed" },
            { command: "bun run typecheck", status: "running", notes: "CI may still be pending" },
        ],
        requiredChecks: { ok: 4, inProgress: 2, pending: 1, failed: 0 },
        unresolvedReviewThreads: 0,
        ...overrides,
    };
}
describe("decideAutoMerge", () => {
    test("allows clean or pending required checks when no review threads are open", () => {
        expect(decideAutoMerge(input())).toEqual({
            allowed: true,
            reason: "no unresolved review threads and no failed required checks",
        });
    });
    test("blocks unresolved review threads", () => {
        expect(decideAutoMerge(input({ unresolvedReviewThreads: 2 }))).toEqual({
            allowed: false,
            reason: "2 unresolved review thread(s)",
        });
    });
    test("blocks failed required checks", () => {
        expect(decideAutoMerge(input({ requiredChecks: { ok: 4, inProgress: 0, pending: 0, failed: 1 } }))).toEqual({
            allowed: false,
            reason: "1 required check(s) failed",
        });
    });
});
describe("buildPublicationPlan", () => {
    test("builds title, markdown body, and argv command plan", () => {
        const plan = buildPublicationPlan(input());
        expect(plan.prTitle).toBe("feat(backlog): advance 081KR2E4K0008QG0R0022RVRCZ Autonomous backlog pickup - PR publication and auto-merge");
        expect(plan.prBody).toContain("## Backlog row");
        expect(plan.prBody).toContain("081KR2E4K0008QG0R0022RVRCZ");
        expect(plan.prBody).toContain("Decision: arm auto-merge");
        expect(plan.bodyFilePath).toBe("tmp/pr-bodies/081KR2E4K0008QG0R0022RVRCZ.md");
        expect(plan.commands.commit).toEqual([
            "git",
            "commit",
            "-m",
            "feat(backlog): advance 081KR2E4K0008QG0R0022RVRCZ Autonomous backlog pickup - PR publication and auto-merge",
            "-m",
            "Co-Authored-By: Codex <noreply@openai.com>",
        ]);
        expect(plan.commands.push).toEqual(["git", "push", "-u", "origin", "claim/task-b0280-pr-publication-plan"]);
        expect(plan.commands.createPr).toContain("--body-file");
        expect(plan.commands.createPr).toContain("tmp/pr-bodies/081KR2E4K0008QG0R0022RVRCZ.md");
        expect(plan.commands.armAutoMerge).toEqual([
            "gh",
            "pr",
            "merge",
            "<pr-url>",
            "--repo",
            "Lucent-Financial-Group/Zeta",
            "--auto",
            "--squash",
        ]);
    });
    test("omits auto-merge command when the gate is not safe", () => {
        const plan = buildPublicationPlan(input({ unresolvedReviewThreads: 1 }));
        expect(plan.autoMerge.allowed).toBe(false);
        expect(plan.commands.armAutoMerge).toBeNull();
    });
    test("writes the generated PR body to the configured body file once", () => {
        const dir = mkdtempSync(join(tmpdir(), "zeta-pr-body-"));
        const originalCwd = process.cwd();
        const bodyFilePath = "body/body.md";
        try {
            process.chdir(dir);
            const plan = buildPublicationPlan(input({ bodyFilePath }));
            writePrBodyFile(plan);
            expect(readFileSync(join(dir, bodyFilePath), "utf8")).toBe(plan.prBody);
            expect(() => {
                writePrBodyFile(plan);
            }).toThrow();
        }
        finally {
            process.chdir(originalCwd);
            rmSync(dir, { force: true, recursive: true });
        }
    });
});
describe("validation", () => {
    test("refuses default branch publication", () => {
        expect(() => validatePublicationInput(input({ branch: "main" }))).toThrow("refusing to publish from default branch");
        expect(() => validatePublicationInput(input({ branch: "refs/heads/main" }))).toThrow("refusing to publish from default branch");
        expect(() => validatePublicationInput(input({ branch: "refs/remotes/origin/main" }))).toThrow("refusing to publish from default branch");
        expect(() => validatePublicationInput(input({ branch: "origin/main" }))).toThrow("refusing to publish from default branch");
        expect(() => validatePublicationInput(input({ branch: "upstream/main" }))).toThrow("refusing to publish from default branch");
    });
    test("requires focused checks and safe backlog path", () => {
        expect(() => validatePublicationInput(input({ checks: [] }))).toThrow("at least one focused check");
        expect(() => validatePublicationInput(input({ backlogPath: "../outside.md" }))).toThrow("unsafe repo-relative path");
        expect(() => {
            validatePublicationInput(input({ bodyFilePath: "-body.md" }));
        }).toThrow("unsafe PR body file path");
        expect(() => {
            validatePublicationInput(input({ bodyFilePath: "/tmp/body.md" }));
        }).toThrow("unsafe repo-relative path");
        expect(() => {
            validatePublicationInput(input({ bodyFilePath: "C:/tmp/body.md" }));
        }).toThrow("unsafe repo-relative path");
        expect(() => {
            validatePublicationInput(input({ bodyFilePath: "C:../outside/body.md" }));
        }).toThrow("unsafe repo-relative path");
        expect(() => {
            validatePublicationInput(input({ bodyFilePath: "../body.md" }));
        }).toThrow("unsafe repo-relative path");
        expect(() => {
            validatePublicationInput(input({ bodyFilePath: "tmp/../body.md" }));
        }).toThrow("unsafe repo-relative path");
        expect(() => {
            validatePublicationInput(input({ bodyFilePath: ".git/body.md" }));
        }).toThrow("unsafe repo-relative path");
    });
    test("formats body check notes without mutating input", () => {
        const body = buildPrBody(input());
        expect(body).toContain("- running: `bun run typecheck` — CI may still be pending");
    });
    test("rejects empty normalized refs", () => {
        expect(() => validatePublicationInput(input({ branch: "refs/heads/" }))).toThrow("invalid normalized branch ref");
        expect(() => validatePublicationInput(input({ branch: "refs/remotes/origin/" }))).toThrow("invalid normalized branch ref");
        expect(() => validatePublicationInput(input({ baseBranch: "refs/heads/" }))).toThrow("invalid normalized baseBranch ref");
    });
    test("rejects option-like and malformed normalized refs", () => {
        expect(() => validatePublicationInput(input({ branch: "refs/heads/-claim" }))).toThrow("invalid normalized branch ref");
        expect(() => validatePublicationInput(input({ branch: "-claim" }))).toThrow("invalid normalized branch ref");
        expect(() => validatePublicationInput(input({ baseBranch: "refs/heads/-main" }))).toThrow("invalid normalized baseBranch ref");
        expect(() => validatePublicationInput(input({ branch: "claim..bad" }))).toThrow("invalid normalized branch ref");
        expect(() => validatePublicationInput(input({ branch: "claim/@{bad" }))).toThrow("invalid normalized branch ref");
        expect(() => validatePublicationInput(input({ branch: "claim/bad.lock" }))).toThrow("invalid normalized branch ref");
        expect(() => validatePublicationInput(input({ branch: "claim bad" }))).toThrow("invalid normalized branch ref");
    });
    test("rejects non-branch refs that keep a refs prefix", () => {
        expect(() => validatePublicationInput(input({ branch: "refs/tags/v1" }))).toThrow("invalid normalized branch ref");
        expect(() => validatePublicationInput(input({ branch: "refs/remotes/origin" }))).toThrow("invalid normalized branch ref");
        expect(() => validatePublicationInput(input({ baseBranch: "refs/tags/v1" }))).toThrow("invalid normalized baseBranch ref");
    });
    test("trims long PR titles", () => {
        const title = buildPrTitle(input({
            backlogTitle: "a very long publication automation title that intentionally exceeds the usual GitHub scan width and should be trimmed for readability",
        }));
        expect(title.length).toBeLessThanOrEqual(120);
        expect(title.endsWith("…")).toBe(true);
    });
    test("normalizes full refs before command construction", () => {
        expect(normalizeBranchRef("refs/heads/claim/task-b0280-pr-publication-plan")).toBe("claim/task-b0280-pr-publication-plan");
        expect(normalizeBranchRef("refs/remotes/origin/claim/task-b0280-pr-publication-plan")).toBe("claim/task-b0280-pr-publication-plan");
        expect(normalizeBranchRef("origin/main")).toBe("main");
        expect(normalizeBranchRef("upstream/main")).toBe("main");
        expect(normalizeBranchRef("release/main")).toBe("release/main");
        expect(normalizeBranchRef("refs/heads/release/main")).toBe("release/main");
        expect(normalizeBranchRef("origin/claim/task-b0280-pr-publication-plan")).toBe("origin/claim/task-b0280-pr-publication-plan");
        const plan = buildPublicationPlan(input({
            branch: "refs/heads/claim/task-b0280-pr-publication-plan",
            baseBranch: "refs/heads/main",
        }));
        expect(plan.commands.push).toEqual(["git", "push", "-u", "origin", "claim/task-b0280-pr-publication-plan"]);
        expect(plan.commands.createPr).toContain("main");
        expect(plan.commands.createPr).toContain("claim/task-b0280-pr-publication-plan");
        expect(plan.commands.commit).toContain("Co-Authored-By: Codex <noreply@openai.com>");
    });
    test("preserves literal origin-prefixed branch names", () => {
        const plan = buildPublicationPlan(input({
            branch: "origin/feature",
            baseBranch: "refs/heads/main",
        }));
        expect(plan.commands.push).toEqual(["git", "push", "-u", "origin", "origin/feature"]);
        expect(plan.commands.createPr).toContain("origin/feature");
    });
});
