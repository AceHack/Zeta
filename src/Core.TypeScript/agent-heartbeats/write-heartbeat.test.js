// tools/agent-heartbeats/write-heartbeat.test.ts — B-0858.3 heartbeat-writer tests.
import { describe, expect, it } from "bun:test";
import { parseArgs, buildHeartbeatObservation, zetaIdToHex, heartbeatPath, heartbeatRepoRelPath, renderHeartbeat } from "./write-heartbeat";
import { pack, DEFAULT_ENV } from "../zeta-id/zeta-id";
// Empty env for tests — exclude any harness-set ZETA_AGENT_* + disable
// auto-push (tests do not have network).
const TEST_ENV = { ZETA_AGENT_HEARTBEAT_NO_PUSH: "1" };
const baseArgs = [];
describe("parseArgs", () => {
    it("zero args + empty env returns built-in defaults (stupid-simple per operator)", () => {
        const r = parseArgs([], TEST_ENV);
        if ("error" in r)
            throw new Error(r.error);
        expect(r.personaSlot).toBe(2);
        expect(r.personaName).toBe("otto");
        expect(r.authority).toBe("TrustedAgent");
        expect(r.momentum).toBe("Normal");
        expect(r.disposition).toBe("bounded-wait");
        expect(r.push).toBe(false); // disabled via TEST_ENV
        expect(r.repo).toBe("Lucent-Financial-Group/Zeta");
        expect(r.branch).toBe("agent-heartbeats"); // default per operator 2026-05-27
    });
    it("env vars override built-in defaults", () => {
        const r = parseArgs([], {
            ZETA_AGENT_PERSONA_SLOT: "5",
            ZETA_AGENT_PERSONA_NAME: "alexa",
            ZETA_AGENT_AUTHORITY: "Standard",
            ZETA_AGENT_HEARTBEAT_NO_PUSH: "1",
        });
        if ("error" in r)
            throw new Error(r.error);
        expect(r.personaSlot).toBe(5);
        expect(r.personaName).toBe("alexa");
        expect(r.authority).toBe("Standard");
    });
    it("CLI flag overrides env var", () => {
        const r = parseArgs(["--persona-name", "riven"], {
            ZETA_AGENT_PERSONA_NAME: "alexa",
            ZETA_AGENT_HEARTBEAT_NO_PUSH: "1",
        });
        if ("error" in r)
            throw new Error(r.error);
        expect(r.personaName).toBe("riven");
    });
    it("accepts all flags", () => {
        const r = parseArgs([
            ...baseArgs,
            "--authority", "Standard",
            "--momentum", "Elevated",
            "--chromosome", "7",
            "--location", "2",
            "--named-dep", "PR #5450 build-iso",
            "--disposition", "committed-substrate",
            "--parent-pr", "5450",
            "--dry-run",
            "--no-push",
        ], TEST_ENV);
        if ("error" in r)
            throw new Error(r.error);
        expect(r.authority).toBe("Standard");
        expect(r.momentum).toBe("Elevated");
        expect(r.chromosome).toBe(7);
        expect(r.location).toBe(2);
        expect(r.namedDep).toBe("PR #5450 build-iso");
        expect(r.disposition).toBe("committed-substrate");
        expect(r.parentPr).toBe(5450);
        expect(r.dryRun).toBe(true);
        expect(r.push).toBe(false);
    });
    it("--push overrides ZETA_AGENT_HEARTBEAT_NO_PUSH=1", () => {
        const r = parseArgs(["--push"], TEST_ENV);
        if ("error" in r)
            throw new Error(r.error);
        expect(r.push).toBe(true);
    });
    it("rejects out-of-range persona-slot", () => {
        expect("error" in parseArgs(["--persona-slot", "256"], TEST_ENV)).toBe(true);
        expect("error" in parseArgs(["--persona-slot", "-1"], TEST_ENV)).toBe(true);
    });
    it("rejects invalid persona-name (non-kebab-case)", () => {
        expect("error" in parseArgs(["--persona-name", "Otto"], TEST_ENV)).toBe(true);
        expect("error" in parseArgs(["--persona-name", "otto_cli"], TEST_ENV)).toBe(true);
        expect("error" in parseArgs(["--persona-name", "../etc"], TEST_ENV)).toBe(true);
    });
    it("rejects unknown flag", () => {
        expect("error" in parseArgs(["--bogus"], TEST_ENV)).toBe(true);
    });
    it("rejects non-integer numeric flags (NaN guard)", () => {
        expect("error" in parseArgs(["--chromosome", "foo"], TEST_ENV)).toBe(true);
        expect("error" in parseArgs(["--persona-slot", "abc"], TEST_ENV)).toBe(true);
        expect("error" in parseArgs(["--location", "1.5"], TEST_ENV)).toBe(true);
        expect("error" in parseArgs(["--parent-pr", "x"], TEST_ENV)).toBe(true);
    });
    it("rejects unknown authority/momentum tags", () => {
        expect("error" in parseArgs(["--authority", "Bogus"], TEST_ENV)).toBe(true);
        expect("error" in parseArgs(["--momentum", "Hyper"], TEST_ENV)).toBe(true);
    });
    it("accepts known authority + momentum enum values", () => {
        for (const auth of ["HumanVerified", "TrustedAgent", "Standard", "BestEffort", "Simulated", "Raw"]) {
            const r = parseArgs(["--authority", auth], TEST_ENV);
            expect("error" in r).toBe(false);
        }
        for (const mom of ["Background", "Normal", "Elevated", "High", "Critical", "Raw"]) {
            const r = parseArgs(["--momentum", mom], TEST_ENV);
            expect("error" in r).toBe(false);
        }
    });
    it("writeLocal default: push=true → false; push=false → true", () => {
        const pushArgs = parseArgs(["--push"], TEST_ENV);
        if ("error" in pushArgs)
            throw new Error(pushArgs.error);
        expect(pushArgs.push).toBe(true);
        expect(pushArgs.writeLocal).toBe(false); // safe on dirty branches
        const noPushArgs = parseArgs([], TEST_ENV); // TEST_ENV sets NO_PUSH=1
        if ("error" in noPushArgs)
            throw new Error(noPushArgs.error);
        expect(noPushArgs.push).toBe(false);
        expect(noPushArgs.writeLocal).toBe(true); // else nothing happens
    });
    it("--write-local explicit override", () => {
        const r = parseArgs(["--push", "--write-local"], TEST_ENV);
        if ("error" in r)
            throw new Error(r.error);
        expect(r.push).toBe(true);
        expect(r.writeLocal).toBe(true);
    });
    it("--no-write-local explicit override", () => {
        const r = parseArgs(["--no-push", "--no-write-local"], TEST_ENV);
        if ("error" in r)
            throw new Error(r.error);
        expect(r.push).toBe(false);
        expect(r.writeLocal).toBe(false);
    });
});
describe("heartbeatRepoRelPath", () => {
    it("uses POSIX separators regardless of host OS", () => {
        const ts = Date.UTC(2026, 4, 27, 13, 30, 0);
        const p = heartbeatRepoRelPath("otto", ts, "abc123");
        expect(p).toBe("docs/agent-heartbeats/otto/2026/05/27/abc123.md");
        expect(p.includes("\\")).toBe(false);
    });
});
describe("buildHeartbeatObservation", () => {
    it("sets category=3 (Heartbeat per registry)", () => {
        const args = parseArgs(baseArgs, TEST_ENV);
        if ("error" in args)
            throw new Error(args.error);
        const obs = buildHeartbeatObservation(args, 1234567890);
        expect(obs.category).toBe(3);
        expect(obs.firefly).toBe(1);
        expect(obs.version).toBe(1);
        expect(obs.persona).toBe(2);
    });
});
describe("zetaIdToHex", () => {
    it("pads to 32 hex chars", () => {
        expect(zetaIdToHex(0n)).toHaveLength(32);
        expect(zetaIdToHex(0n)).toBe("0".repeat(32));
        expect(zetaIdToHex(0xffn)).toBe("0".repeat(30) + "ff");
    });
    it("renders large bigint correctly", () => {
        const big = (1n << 127n) | 0xdeadbeefn;
        const hex = zetaIdToHex(big);
        expect(hex).toHaveLength(32);
        expect(hex.endsWith("deadbeef")).toBe(true);
        expect(hex.startsWith("8")).toBe(true);
    });
});
describe("heartbeatPath", () => {
    it("builds YYYY/MM/DD path with hex filename", () => {
        const ts = Date.UTC(2026, 4, 27, 13, 30, 0); // month 0-indexed (4=May)
        const path = heartbeatPath("/repo", "otto", ts, "abc123");
        expect(path).toBe("/repo/docs/agent-heartbeats/otto/2026/05/27/abc123.md");
    });
    it("pads month and day", () => {
        const ts = Date.UTC(2026, 0, 5, 0, 0, 0); // 2026-01-05
        const path = heartbeatPath("/repo", "otto", ts, "x");
        expect(path).toBe("/repo/docs/agent-heartbeats/otto/2026/01/05/x.md");
    });
});
describe("renderHeartbeat", () => {
    it("produces valid frontmatter with required fields", () => {
        const args = parseArgs([...baseArgs, "--named-dep", "PR #5450 CI", "--parent-pr", "5450"], TEST_ENV);
        if ("error" in args)
            throw new Error(args.error);
        const body = renderHeartbeat(args, "abc", 1779168600000);
        expect(body).toContain("---");
        expect(body).toContain("zetaid: abc");
        expect(body).toContain("category: 3");
        expect(body).toContain("agent: otto");
        expect(body).toContain("persona-slot: 2");
        expect(body).toContain("named-dep: \"PR #5450 CI\"");
        expect(body).toContain("parent-pr: 5450");
        expect(body).toContain("firefly: NoDirective");
    });
    it("omits optional fields when not provided", () => {
        const args = parseArgs(baseArgs, TEST_ENV);
        if ("error" in args)
            throw new Error(args.error);
        const body = renderHeartbeat(args, "abc", 1779168600000);
        expect(body).not.toContain("named-dep:");
        expect(body).not.toContain("parent-pr:");
    });
});
describe("end-to-end pack with DEFAULT_ENV", () => {
    it("packs without throwing; category bit field round-trips", () => {
        const args = parseArgs(baseArgs, TEST_ENV);
        if ("error" in args)
            throw new Error(args.error);
        const obs = buildHeartbeatObservation(args, Date.now());
        const id = pack(obs, DEFAULT_ENV);
        expect(typeof id).toBe("bigint");
        const hex = zetaIdToHex(id);
        expect(hex).toHaveLength(32);
        // Category bits at offset 65 width 4 = bits 65..68 inclusive
        const categoryBits = (id >> 65n) & 0xfn;
        expect(Number(categoryBits)).toBe(3);
    });
});
