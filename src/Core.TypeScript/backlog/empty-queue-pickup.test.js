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
    selected: { id: "081KR2E4K0008QG0R002MFK6AW", priority: "P1", title: "Test item", relativePath: "docs/backlog/P1/081KR2E4K0008QG0R002MFK6AW-test.md" },
    action: "claim-and-implement",
    reason: "highest-priority open unclaimed item",
    executionPrompt: "Claim and implement the smallest safe slice of 081KR2E4K0008QG0R002MFK6AW.",
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
    selected: { id: "081KR2E4K0008QG0R0035QVX6S", priority: "P0", title: "Big blob", relativePath: "docs/backlog/P0/081KR2E4K0008QG0R0035QVX6S-big.md" },
    action: "decompose-first",
    reason: "highest-priority open item needs decomposition",
    executionPrompt: "Decompose 081KR2E4K0008QG0R0035QVX6S into atomic children.",
    blocked: [],
    activeClaims: [],
});
const PICKUP_ZETA_ID = JSON.stringify({
    status: "selected",
    selected: { id: "081KR7JY10008QG0R000MH7PJT", priority: "P1", title: "Dotted item", relativePath: "docs/backlog/P1/081KR7JY10008QG0R000MH7PJT-dotted.md" },
    action: "claim-and-implement",
    reason: "highest-priority open unclaimed item",
    executionPrompt: "Claim and implement the smallest safe slice of 081KR7JY10008QG0R000MH7PJT.",
    blocked: [],
    activeClaims: [],
});
const TEST_REPO_ROOT = "test-repo";
const TEST_WORKTREE = "test-worktrees/backlog-0300";
const TEST_ZETA_WORKTREE = "test-worktrees/backlog-081kr7jy10008qg0r000mh7pjt";
const CLAIM_OK = JSON.stringify({
    branch: "claim/backlog-0300",
    worktreePath: TEST_WORKTREE,
    claimRelativePath: "docs/claims/backlog-0300.md",
});
const CLAIM_ZETA_OK = JSON.stringify({
    branch: "claim/backlog-081kr7jy10008qg0r000mh7pjt",
    worktreePath: TEST_ZETA_WORKTREE,
    claimRelativePath: "docs/claims/backlog-081kr7jy10008qg0r000mh7pjt.md",
});
describe("orchestrate", () => {
    test("stops at capacity gate when PR slots are full", () => {
        const runner = fakeRunner(new Map([
            ["gh", { status: 0, stdout: PR_LIST_FULL, stderr: "" }],
        ]));
        const result = orchestrate({ repoRoot: TEST_REPO_ROOT, maxOpenPrs: 3, worktreeRoot: null, json: true, dryRun: false }, runner);
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
        const result = orchestrate({ repoRoot: TEST_REPO_ROOT, maxOpenPrs: 3, worktreeRoot: null, json: true, dryRun: false }, runner);
        expect(result.status).toBe("claimed");
        expect(result.backlogId).toBe("081KR2E4K0008QG0R002MFK6AW");
        expect(result.branch).toBe("claim/backlog-0300");
        expect(result.worktreePath).toBe(TEST_WORKTREE);
        expect(result.decisions).toHaveLength(3);
        expect(result.executionPrompt).toContain("081KR2E4K0008QG0R002MFK6AW");
    });
    test("normalizes ZetaId backlog IDs into claim-safe slugs", () => {
        const runner = fakeRunner(new Map([
            ["gh", { status: 0, stdout: PR_LIST_EMPTY, stderr: "" }],
            ["autonomous-pickup", { status: 0, stdout: PICKUP_ZETA_ID, stderr: "" }],
            ["--slug backlog-081kr7jy10008qg0r000mh7pjt", { status: 0, stdout: CLAIM_ZETA_OK, stderr: "" }],
        ]));
        const result = orchestrate({ repoRoot: TEST_REPO_ROOT, maxOpenPrs: 3, worktreeRoot: null, json: true, dryRun: false }, runner);
        expect(result.status).toBe("claimed");
        expect(result.backlogId).toBe("081KR7JY10008QG0R000MH7PJT");
        expect(result.branch).toBe("claim/backlog-081kr7jy10008qg0r000mh7pjt");
        expect(result.worktreePath).toBe(TEST_ZETA_WORKTREE);
    });
    test("returns no-selection when picker finds nothing", () => {
        const runner = fakeRunner(new Map([
            ["gh", { status: 0, stdout: PR_LIST_EMPTY, stderr: "" }],
            ["autonomous-pickup", { status: 0, stdout: PICKUP_EMPTY, stderr: "" }],
        ]));
        const result = orchestrate({ repoRoot: TEST_REPO_ROOT, maxOpenPrs: 3, worktreeRoot: null, json: true, dryRun: false }, runner);
        expect(result.status).toBe("no-selection");
        expect(result.decisions).toHaveLength(2);
        expect(result.backlogId).toBeNull();
    });
    test("returns decompose-first when item needs decomposition", () => {
        const runner = fakeRunner(new Map([
            ["gh", { status: 0, stdout: PR_LIST_EMPTY, stderr: "" }],
            ["autonomous-pickup", { status: 0, stdout: PICKUP_DECOMPOSE, stderr: "" }],
        ]));
        const result = orchestrate({ repoRoot: TEST_REPO_ROOT, maxOpenPrs: 3, worktreeRoot: null, json: true, dryRun: false }, runner);
        expect(result.status).toBe("decompose-first");
        expect(result.backlogId).toBe("081KR2E4K0008QG0R0035QVX6S");
        expect(result.executionPrompt).toContain("Decompose");
        expect(result.decisions).toHaveLength(2);
    });
    test("reports error when claim-worktree-bootstrap fails", () => {
        const runner = fakeRunner(new Map([
            ["gh", { status: 0, stdout: PR_LIST_EMPTY, stderr: "" }],
            ["autonomous-pickup", { status: 0, stdout: PICKUP_SELECTED, stderr: "" }],
            ["claim-worktree-bootstrap", { status: 1, stdout: "{}", stderr: "claim branch already exists" }],
        ]));
        const result = orchestrate({ repoRoot: TEST_REPO_ROOT, maxOpenPrs: 3, worktreeRoot: null, json: true, dryRun: false }, runner);
        expect(result.error).toContain("claim-worktree-bootstrap failed");
        expect(result.decisions).toHaveLength(3);
    });
    test("reports error when capacity gate call fails", () => {
        const runner = fakeRunner(new Map([
            ["gh", { status: 1, stdout: "", stderr: "auth required" }],
        ]));
        const result = orchestrate({ repoRoot: TEST_REPO_ROOT, maxOpenPrs: 3, worktreeRoot: null, json: true, dryRun: false }, runner);
        expect(result.error).toContain("capacity gate failed");
        expect(result.status).toBe("wait-pr-capacity");
    });
    test("decision trace records all three steps on success", () => {
        const runner = fakeRunner(new Map([
            ["gh", { status: 0, stdout: PR_LIST_EMPTY, stderr: "" }],
            ["autonomous-pickup", { status: 0, stdout: PICKUP_SELECTED, stderr: "" }],
            ["claim-worktree-bootstrap", { status: 0, stdout: CLAIM_OK, stderr: "" }],
        ]));
        const result = orchestrate({ repoRoot: TEST_REPO_ROOT, maxOpenPrs: 3, worktreeRoot: null, json: true, dryRun: false }, runner);
        const steps = result.decisions.map(d => d.step);
        expect(steps).toEqual(["capacity-gate", "pickup", "claim-worktree"]);
    });
});
