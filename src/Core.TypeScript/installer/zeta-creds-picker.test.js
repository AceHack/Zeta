// zeta-creds-picker.test.ts — B-0852.3a picker tests.
//
// Tests parseArgs (pure) + runPicker (against a mock readline-like interface).
import { describe, expect, it } from "bun:test";
import { parseArgs, runPicker, buildVerifyArgs } from "./zeta-creds-picker";
describe("parseArgs", () => {
    it("accepts well-formed args with --passphrase-env", () => {
        const r = parseArgs(["--usb-uuid", "u1", "--output", "/o", "--passphrase-env", "P"]);
        if ("error" in r)
            throw new Error(r.error);
        expect(r.usbUuid).toBe("u1");
        expect(r.output).toBe("/o");
        expect(r.passphraseEnv).toBe("P");
        expect(r.persona).toBe(null);
        expect(r.dryRun).toBe(false);
    });
    it("accepts --persona + --dry-run", () => {
        const r = parseArgs([
            "--usb-uuid", "u1", "--output", "/o", "--passphrase-file", "/pp",
            "--persona", "otto", "--dry-run",
        ]);
        if ("error" in r)
            throw new Error(r.error);
        expect(r.persona).toBe("otto");
        expect(r.dryRun).toBe(true);
        expect(r.passphraseFile).toBe("/pp");
    });
    it("rejects missing --usb-uuid", () => {
        const r = parseArgs(["--output", "/o", "--passphrase-env", "P"]);
        expect("error" in r).toBe(true);
    });
    it("rejects missing --output", () => {
        const r = parseArgs(["--usb-uuid", "u1", "--passphrase-env", "P"]);
        expect("error" in r).toBe(true);
    });
    it("rejects no passphrase source", () => {
        const r = parseArgs(["--usb-uuid", "u1", "--output", "/o"]);
        expect("error" in r).toBe(true);
    });
    it("rejects unknown flag", () => {
        const r = parseArgs(["--bogus"]);
        expect("error" in r).toBe(true);
    });
    it("--verify flag is opt-in (default false)", () => {
        const r = parseArgs(["--usb-uuid", "u1", "--output", "/o", "--passphrase-env", "P"]);
        if ("error" in r)
            throw new Error(r.error);
        expect(r.verify).toBe(false);
    });
    it("--verify flag parsed when passed", () => {
        const r = parseArgs(["--usb-uuid", "u1", "--output", "/o", "--passphrase-env", "P", "--verify"]);
        if ("error" in r)
            throw new Error(r.error);
        expect(r.verify).toBe(true);
    });
});
describe("buildVerifyArgs", () => {
    it("composes restore CLI args with --dry-run + provided tmpdir", () => {
        const parsed = parseArgs(["--usb-uuid", "u1", "--output", "/mnt/boot/zeta-creds.enc", "--passphrase-env", "ZETA_PP", "--verify"]);
        if ("error" in parsed)
            throw new Error(parsed.error);
        const args = buildVerifyArgs(parsed, "/tmp/verify-x");
        expect(args).toContain("tools/installer/zeta-creds-restore.ts");
        expect(args).toContain("--usb-uuid");
        expect(args).toContain("u1");
        expect(args).toContain("--input");
        expect(args).toContain("/mnt/boot/zeta-creds.enc");
        expect(args).toContain("--target-root");
        expect(args).toContain("/tmp/verify-x");
        expect(args).toContain("--dry-run");
        expect(args).toContain("--passphrase-env");
        expect(args).toContain("ZETA_PP");
    });
    it("propagates --passphrase-file when picker used file source", () => {
        const parsed = parseArgs(["--usb-uuid", "u2", "--output", "/o", "--passphrase-file", "/pp"]);
        if ("error" in parsed)
            throw new Error(parsed.error);
        const args = buildVerifyArgs(parsed, "/tmp/t");
        expect(args).toContain("--passphrase-file");
        expect(args).toContain("/pp");
        expect(args).not.toContain("--passphrase-env");
    });
    it("propagates --persona when set", () => {
        const parsed = parseArgs(["--usb-uuid", "u3", "--output", "/o", "--passphrase-env", "P", "--persona", "otto"]);
        if ("error" in parsed)
            throw new Error(parsed.error);
        const args = buildVerifyArgs(parsed, "/tmp/t");
        expect(args).toContain("--persona");
        expect(args).toContain("otto");
    });
});
// Mock readline-like interface for testing runPicker against scripted answers.
function mockRl(answers) {
    let idx = 0;
    return {
        question: (_prompt) => Promise.resolve(answers[idx++] ?? ""),
        close: () => { },
    };
}
describe("runPicker", () => {
    it("returns no bake-args when operator defers everything (no persona)", async () => {
        const rl = mockRl([
            "d", // gh-cli
            // claude/gemini/codex auto-skip (persona-scoped + no persona)
            // ssh-host-keys / ssh-operator-pubkey: prompt depending on handler/scope
            "d", "d", "d", "d", "d", "d", "d", "d",
        ]);
        const args = await runPicker(rl, null);
        expect(args.length).toBe(0);
    });
    it("bakes gh-cli with literal value when chosen", async () => {
        // Skip persona-scoped (no persona); gh-cli is the first global cred.
        // Answers: bake, literal, value, then defer remaining
        const rl = mockRl([
            "b", "l", "ghp_test_value",
            "d", "d", "d", "d", "d", "d", "d", "d",
        ]);
        const args = await runPicker(rl, null);
        expect(args.length).toBeGreaterThanOrEqual(1);
        const gh = args.find((a) => a.startsWith("gh-cli="));
        expect(gh).toBe("gh-cli=ghp_test_value");
    });
    it("skips empty literal value", async () => {
        const rl = mockRl([
            "b", "l", "", // gh-cli bake, literal, EMPTY
            "d", "d", "d", "d", "d", "d", "d", "d",
        ]);
        const args = await runPicker(rl, null);
        expect(args.find((a) => a.startsWith("gh-cli="))).toBeUndefined();
    });
    it("uses @file syntax when operator picks file source", async () => {
        const rl = mockRl([
            "b", "f", "/tmp/test-file",
            "d", "d", "d", "d", "d", "d", "d", "d",
        ]);
        const args = await runPicker(rl, null);
        const gh = args.find((a) => a.startsWith("gh-cli="));
        expect(gh).toBe("gh-cli=@/tmp/test-file");
    });
    it("uses env: syntax when operator picks env source", async () => {
        const rl = mockRl([
            "b", "e", "GH_TOKEN",
            "d", "d", "d", "d", "d", "d", "d", "d",
        ]);
        const args = await runPicker(rl, null);
        const gh = args.find((a) => a.startsWith("gh-cli="));
        expect(gh).toBe("gh-cli=env:GH_TOKEN");
    });
    it("auto-skips persona-scoped creds when no persona", async () => {
        const rl = mockRl(Array(15).fill("d"));
        const args = await runPicker(rl, null);
        // claude/gemini/codex are persona-scoped; auto-skip means NO prompt fired
        // for them. With persona=null, only the global ones get bake/defer prompts.
        expect(args.find((a) => a.startsWith("claude="))).toBeUndefined();
        expect(args.find((a) => a.startsWith("gemini="))).toBeUndefined();
        expect(args.find((a) => a.startsWith("codex="))).toBeUndefined();
    });
    it("bakes persona-scoped cred when persona supplied", async () => {
        // With persona, claude/gemini/codex are baked-capable. Order matches
        // DEFAULT_MANIFEST iteration.
        const rl = mockRl([
            "d", // gh-cli
            "b", "l", '{"creds":"otto-claude"}', // claude bake literal
            "d", "d", // gemini, codex
            "d", "d", "d", "d", "d", "d", // remaining
        ]);
        const args = await runPicker(rl, "otto");
        expect(args.find((a) => a.startsWith("claude="))).toBe('claude={"creds":"otto-claude"}');
    });
    it("treats empty choice as defer", async () => {
        const rl = mockRl(Array(15).fill(""));
        const args = await runPicker(rl, null);
        expect(args.length).toBe(0);
    });
    it("treats unrecognized choice as defer", async () => {
        const rl = mockRl(Array(15).fill("xyz"));
        const args = await runPicker(rl, null);
        expect(args.length).toBe(0);
    });
    it("skip explicit returns no bake", async () => {
        const rl = mockRl(Array(15).fill("s"));
        const args = await runPicker(rl, null);
        expect(args.length).toBe(0);
    });
});
