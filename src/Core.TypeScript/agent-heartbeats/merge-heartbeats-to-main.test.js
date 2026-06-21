// tools/agent-heartbeats/merge-heartbeats-to-main.test.ts — B-0858.4 merge-tool tests.
import { describe, expect, it } from "bun:test";
import { parseArgs } from "./merge-heartbeats-to-main";
const TEST_ENV = {};
describe("parseArgs", () => {
    it("zero args returns built-in defaults", () => {
        const r = parseArgs([], TEST_ENV);
        if ("error" in r)
            throw new Error(r.error);
        expect(r.repo).toBe("Lucent-Financial-Group/Zeta");
        expect(r.head).toBe("agent-heartbeats");
        expect(r.base).toBe("main");
        expect(r.dryRun).toBe(false);
    });
    it("env vars override repo/head", () => {
        const r = parseArgs([], { ZETA_AGENT_REPO: "fork/Zeta", ZETA_AGENT_BRANCH: "heartbeats-v2" });
        if ("error" in r)
            throw new Error(r.error);
        expect(r.repo).toBe("fork/Zeta");
        expect(r.head).toBe("heartbeats-v2");
    });
    it("CLI flags override env + defaults", () => {
        const r = parseArgs(["--repo", "x/y", "--head", "h", "--base", "b", "--dry-run"], TEST_ENV);
        if ("error" in r)
            throw new Error(r.error);
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
