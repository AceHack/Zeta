import { describe, expect, test } from "bun:test";
import { classifyRemoteClaimCleanup, collectRemoteClaimState, parseClaimPaths, parseDurableTarget, parseRemoteClaimRefs, } from "./remote-only-state";
class FakeRunner {
    calls = [];
    callOptions = [];
    responses;
    constructor(responses) {
        this.responses = responses;
    }
    run(command, args, options) {
        const key = [command, ...args].join("\0");
        this.calls.push(key);
        const callOptions = {};
        if (options.timeoutMs !== undefined) {
            callOptions.timeoutMs = options.timeoutMs;
        }
        this.callOptions.push(callOptions);
        return this.responses.get(key) ?? { status: 1, stdout: "", stderr: `missing fake response: ${key}` };
    }
}
function ok(stdout) {
    return { status: 0, stdout, stderr: "" };
}
function gitKey(args) {
    return ["/usr/bin/git", "-C", "/repo/Zeta", ...args].join("\0");
}
const claimBody = [
    "# Claim - task-remote-only",
    "",
    "- **Session ID:** codex/example",
    "- **Harness:** codex",
    "- **Durable target:** src/Core.TypeScript/claims/remote-only-state.ts",
    "",
    "## Notes",
    "",
    "Initial intended path set:",
    "",
    "- `src/Core.TypeScript/claims/remote-only-state.ts`",
    "- `src/Core.TypeScript/claims/remote-only-state.test.ts`",
    "",
].join("\n");
describe("parseRemoteClaimRefs", () => {
    test("parses claim branch refs from ls-remote output", () => {
        expect(parseRemoteClaimRefs("abc123\trefs/heads/claim/task-remote-only\nfed456 refs/heads/claim/backlog-0209\n")).toEqual([
            {
                sha: "abc123",
                ref: "refs/heads/claim/task-remote-only",
                branch: "claim/task-remote-only",
                slug: "task-remote-only",
            },
            {
                sha: "fed456",
                ref: "refs/heads/claim/backlog-0209",
                branch: "claim/backlog-0209",
                slug: "backlog-0209",
            },
        ]);
    });
    test("fails closed on non-claim refs", () => {
        expect(() => parseRemoteClaimRefs("abc123\trefs/heads/main\n")).toThrow("unexpected non-claim ref");
    });
});
describe("claim file parsers", () => {
    test("extract durable target and intended paths", () => {
        expect(parseDurableTarget(claimBody)).toBe("src/Core.TypeScript/claims/remote-only-state.ts");
        expect(parseClaimPaths(claimBody)).toEqual([
            "src/Core.TypeScript/claims/remote-only-state.ts",
            "src/Core.TypeScript/claims/remote-only-state.test.ts",
        ]);
    });
});
describe("collectRemoteClaimState", () => {
    test("uses remote git surfaces and never local broadcast state", () => {
        const responses = new Map([
            [gitKey(["fetch", "--prune", "origin"]), ok("")],
            [
                gitKey(["ls-remote", "--heads", "origin", "claim/*"]),
                ok("abc123\trefs/heads/claim/task-remote-only\n"),
            ],
            [gitKey(["merge-base", "--is-ancestor", "abc123", "origin/main"]), { status: 1, stdout: "", stderr: "" }],
            [gitKey(["show", "origin/claim/task-remote-only:docs/claims/task-remote-only.md"]), ok(claimBody)],
        ]);
        const runner = new FakeRunner(responses);
        const state = collectRemoteClaimState(runner, "/repo/Zeta");
        expect(state.errors).toEqual([]);
        expect(state.claims).toHaveLength(1);
        expect(state.claims[0]?.ref.slug).toBe("task-remote-only");
        expect(state.claims[0]?.cleanup.disposition).toBe("active");
        expect(state.claims[0]?.paths).toContain("src/Core.TypeScript/claims/remote-only-state.ts");
        expect(runner.calls.join("\n")).not.toContain("broadcast");
        expect(runner.calls.join("\n")).not.toContain("agent-heartbeats");
    });
    test("bounds remote network git calls with a timeout", () => {
        const responses = new Map([
            [gitKey(["fetch", "--prune", "origin"]), ok("")],
            [
                gitKey(["ls-remote", "--heads", "origin", "claim/*"]),
                ok("abc123\trefs/heads/claim/task-remote-only\n"),
            ],
            [gitKey(["merge-base", "--is-ancestor", "abc123", "origin/main"]), { status: 1, stdout: "", stderr: "" }],
            [gitKey(["show", "origin/claim/task-remote-only:docs/claims/task-remote-only.md"]), ok(claimBody)],
        ]);
        const runner = new FakeRunner(responses);
        collectRemoteClaimState(runner, "/repo/Zeta", "origin", true, 1234);
        expect(runner.callOptions[0]?.timeoutMs).toBe(1234);
        expect(runner.callOptions[1]?.timeoutMs).toBe(1234);
        expect(runner.callOptions[2]?.timeoutMs).toBeUndefined();
        expect(runner.callOptions[3]?.timeoutMs).toBeUndefined();
    });
    test("records per-claim read failures without dropping the ref", () => {
        const responses = new Map([
            [gitKey(["ls-remote", "--heads", "origin", "claim/*"]), ok("abc123\trefs/heads/claim/missing-file\n")],
            [gitKey(["merge-base", "--is-ancestor", "abc123", "origin/main"]), { status: 1, stdout: "", stderr: "" }],
            [
                gitKey(["show", "origin/claim/missing-file:docs/claims/missing-file.md"]),
                { status: 128, stdout: "", stderr: "fatal: path not found" },
            ],
        ]);
        const state = collectRemoteClaimState(new FakeRunner(responses), "/repo/Zeta", "origin", false);
        expect(state.claims[0]?.ref.slug).toBe("missing-file");
        expect(state.claims[0]?.body).toBeNull();
        expect(state.claims[0]?.cleanup.disposition).toBe("missing-claim-file");
        expect(state.errors[0]).toContain("claim/missing-file");
    });
    test("classifies merged claim heads as cleanup residue", () => {
        const responses = new Map([
            [gitKey(["ls-remote", "--heads", "origin", "claim/*"]), ok("abc123\trefs/heads/claim/task-remote-only\n")],
            [gitKey(["merge-base", "--is-ancestor", "abc123", "origin/main"]), ok("")],
            [gitKey(["show", "origin/claim/task-remote-only:docs/claims/task-remote-only.md"]), ok(claimBody)],
        ]);
        const state = collectRemoteClaimState(new FakeRunner(responses), "/repo/Zeta", "origin", false);
        expect(state.errors).toEqual([]);
        expect(state.claims[0]?.cleanup).toMatchObject({
            disposition: "merged-claim-residue",
            mergedToMain: true,
        });
        expect(state.claims[0]?.cleanup.nextAction).toContain("release commit");
    });
    test("classifies unknown merge state without treating the claim as free", () => {
        expect(classifyRemoteClaimCleanup(true, null)).toMatchObject({
            disposition: "merge-state-unknown",
            mergedToMain: null,
        });
    });
});
