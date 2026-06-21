import { describe, expect, test } from "bun:test";
import { kiroExecutor, buildDoItemSpec } from "./kiro-executor";
const SAMPLE_ITEM = {
    id: "081KQNJ500008QG0R003SCWBDV",
    title: "Substrate-claim-checker TS tool",
    ready: true,
    ambiguous: false,
};
describe("kiroExecutor", () => {
    test("has just-bash tier", () => {
        const executor = kiroExecutor({ repoRoot: "/tmp/fake-repo" });
        expect(executor.tier).toBe("just-bash");
    });
    test("run returns a RunOutcome (never throws)", async () => {
        const executor = kiroExecutor({ repoRoot: "/tmp", timeoutMs: 5000 });
        // A simple echo script should succeed
        const result = await executor.run({ script: "echo hello", cwd: "/tmp" });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.stdout).toContain("hello");
            expect(result.exitCode).toBe(0);
        }
    });
    test("run captures failure without throwing", async () => {
        const executor = kiroExecutor({ repoRoot: "/tmp", timeoutMs: 5000 });
        const result = await executor.run({ script: "exit 42", cwd: "/tmp" });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.exitCode).toBe(42);
        }
    });
});
describe("buildDoItemSpec", () => {
    test("generates a script and spec for a backlog item", () => {
        const { spec, gated } = buildDoItemSpec(SAMPLE_ITEM, {
            repoRoot: "/tmp/fake-repo",
            agentId: "alexa",
        });
        expect(gated).toBe(false);
        expect(spec.script).toContain("081KQNJ500008QG0R003SCWBDV");
        expect(spec.script).toContain("claim/");
        expect(spec.script).toContain("alexa");
        expect(spec.script).toContain("git fetch origin main");
        expect(spec.script).toContain("git checkout -B");
        expect(spec.cwd).toBe("/tmp/fake-repo");
    });
    test("defaults agentId to 'alexa'", () => {
        const { spec } = buildDoItemSpec(SAMPLE_ITEM, { repoRoot: "/tmp/fake" });
        expect(spec.script).toContain("alexa");
    });
});
