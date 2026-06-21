import { describe, expect, test } from "bun:test";
import { orchestrate } from "./empty-queue-pickup";
function fakeRunner(responses) {
    return {
        run(command, args) {
            const key = [command, ...args].join(" ");
            for (const [pattern, response] of responses) {
                if (key.includes(pattern))
                    return response;
            }
            return { status: 1, stdout: "", stderr: `no fake for: ${key}` };
        },
    };
}
const PR_LIST_EMPTY = JSON.stringify([]);
const PR_LIST_FULL = JSON.stringify([{ number: 1 }, { number: 2 }, { number: 3 }]);
const PICKUP_SELECTED = JSON.stringify({
    status: "selected",
    selected: { id: "B-0300", priority: "P1", title: "Test item", relativePath: "docs/backlog/P1/B-0300-test.md" },
    action: "claim-and-implement",
    reason: "highest-priority open unclaimed item",
    executionPrompt: "Claim and implement the smallest safe slice of B-0300.",
    blocked: [],
    activeClaims: [],
});
const PICKUP_EMPTY = JSON.stringify({
    status: "empty",
    selected: null,
    action: null,
    reason: "no open unclaimed backlog items",
    executionPrompt: null,
    blocked: [],
    activeClaims: [],
});
const PICKUP_DECOMPOSE = JSON.stringify({
    status: "selected",
    selected: { id: "B-0301", priority: "P0", title: "Big blob", relativePath: "docs/backlog/P0/B-0301-big.md" },
    action: "decompose-first",
    reason: "highest-priority open item needs decomposition",
    executionPrompt: "Decompose B-0301 into atomic children.",
    blocked: [],
    activeClaims: [],
});
const PICKUP_DOTTED_ID = JSON.stringify({
    status: "selected",
    selected: { id: "B-0164.1", priority: "P1", title: "Dotted item", relativePath: "docs/backlog/P1/B-0164.1-dotted.md" },
    action: "claim-and-implement",
    reason: "highest-priority open unclaimed item",
    executionPrompt: "Claim and implement the smallest safe slice of B-0164.1.",
    blocked: [],
    activeClaims: [],
});
const CLAIM_OK = JSON.stringify({
    branch: "claim/backlog-0300",
    worktreePath: "/tmp/test-worktrees/backlog-0300",
    claimRelativePath: "docs/claims/backlog-0300.md",
});
const CLAIM_DOTTED_OK = JSON.stringify({
    branch: "claim/backlog-0164-1",
    worktreePath: "/tmp/test-worktrees/backlog-0164-1",
    claimRelativePath: "docs/claims/backlog-0164-1.md",
});
describe("orchestrate", () => {
    test("stops at capacity gate when PR slots are full", () => {
        const runner = fakeRunner(new Map([
            ["gh", { status: 0, stdout: PR_LIST_FULL, stderr: "" }],
        ]));
        const result = orchestrate({ repoRoot: "/tmp/repo", maxOpenPrs: 3, worktreeRoot: null, json: true, dryRun: false }, runner);
        expect(result.status).toBe("wait-pr-capacity");
        expect(result.decisions).toHaveLength(1);
        expect(result.decisions[0]?.step).toBe("capacity-gate");
    });
    test("proceeds through pickup when PR queue is empty", () => {
        const runner = fakeRunner(new Map([
            ["gh", { status: 0, stdout: PR_LIST_EMPTY, stderr: "" }],
            ["autonomous-pickup", { status: 0, stdout: PICKUP_SELECTED, stderr: "" }],
            ["claim-worktree-bootstrap", { status: 0, stdout: CLAIM_OK, stderr: "" }],
        ]));
        const result = orchestrate({ repoRoot: "/tmp/repo", maxOpenPrs: 3, worktreeRoot: null, json: true, dryRun: false }, runner);
        expect(result.status).toBe("claimed");
        expect(result.backlogId).toBe("B-0300");
        expect(result.branch).toBe("claim/backlog-0300");
        expect(result.worktreePath).toBe("/tmp/test-worktrees/backlog-0300");
        expect(result.decisions).toHaveLength(3);
        expect(result.executionPrompt).toContain("B-0300");
    });
    test("normalizes dotted backlog IDs into claim-safe slugs", () => {
        const runner = fakeRunner(new Map([
            ["gh", { status: 0, stdout: PR_LIST_EMPTY, stderr: "" }],
            ["autonomous-pickup", { status: 0, stdout: PICKUP_DOTTED_ID, stderr: "" }],
            ["--slug backlog-0164-1", { status: 0, stdout: CLAIM_DOTTED_OK, stderr: "" }],
        ]));
        const result = orchestrate({ repoRoot: "/tmp/repo", maxOpenPrs: 3, worktreeRoot: null, json: true, dryRun: false }, runner);
        expect(result.status).toBe("claimed");
        expect(result.backlogId).toBe("B-0164.1");
        expect(result.branch).toBe("claim/backlog-0164-1");
        expect(result.worktreePath).toBe("/tmp/test-worktrees/backlog-0164-1");
    });
    test("returns no-selection when picker finds nothing", () => {
        const runner = fakeRunner(new Map([
            ["gh", { status: 0, stdout: PR_LIST_EMPTY, stderr: "" }],
            ["autonomous-pickup", { status: 0, stdout: PICKUP_EMPTY, stderr: "" }],
        ]));
        const result = orchestrate({ repoRoot: "/tmp/repo", maxOpenPrs: 3, worktreeRoot: null, json: true, dryRun: false }, runner);
        expect(result.status).toBe("no-selection");
        expect(result.decisions).toHaveLength(2);
        expect(result.backlogId).toBeNull();
    });
    test("returns decompose-first when item needs decomposition", () => {
        const runner = fakeRunner(new Map([
            ["gh", { status: 0, stdout: PR_LIST_EMPTY, stderr: "" }],
            ["autonomous-pickup", { status: 0, stdout: PICKUP_DECOMPOSE, stderr: "" }],
        ]));
        const result = orchestrate({ repoRoot: "/tmp/repo", maxOpenPrs: 3, worktreeRoot: null, json: true, dryRun: false }, runner);
        expect(result.status).toBe("decompose-first");
        expect(result.backlogId).toBe("B-0301");
        expect(result.executionPrompt).toContain("Decompose");
        expect(result.decisions).toHaveLength(2);
    });
    test("reports error when claim-worktree-bootstrap fails", () => {
        const runner = fakeRunner(new Map([
            ["gh", { status: 0, stdout: PR_LIST_EMPTY, stderr: "" }],
            ["autonomous-pickup", { status: 0, stdout: PICKUP_SELECTED, stderr: "" }],
            ["claim-worktree-bootstrap", { status: 1, stdout: "{}", stderr: "claim branch already exists" }],
        ]));
        const result = orchestrate({ repoRoot: "/tmp/repo", maxOpenPrs: 3, worktreeRoot: null, json: true, dryRun: false }, runner);
        expect(result.error).toContain("claim-worktree-bootstrap failed");
        expect(result.decisions).toHaveLength(3);
    });
    test("reports error when capacity gate call fails", () => {
        const runner = fakeRunner(new Map([
            ["gh", { status: 1, stdout: "", stderr: "auth required" }],
        ]));
        const result = orchestrate({ repoRoot: "/tmp/repo", maxOpenPrs: 3, worktreeRoot: null, json: true, dryRun: false }, runner);
        expect(result.error).toContain("capacity gate failed");
        expect(result.status).toBe("wait-pr-capacity");
    });
    test("decision trace records all three steps on success", () => {
        const runner = fakeRunner(new Map([
            ["gh", { status: 0, stdout: PR_LIST_EMPTY, stderr: "" }],
            ["autonomous-pickup", { status: 0, stdout: PICKUP_SELECTED, stderr: "" }],
            ["claim-worktree-bootstrap", { status: 0, stdout: CLAIM_OK, stderr: "" }],
        ]));
        const result = orchestrate({ repoRoot: "/tmp/repo", maxOpenPrs: 3, worktreeRoot: null, json: true, dryRun: false }, runner);
        const steps = result.decisions.map(d => d.step);
        expect(steps).toEqual(["capacity-gate", "pickup", "claim-worktree"]);
    });
});
