import { describe, expect, test } from "bun:test";
import { buildCodexPrompt, codexExecArgs, codexLoopEnv } from "../service/capacity/codex-harness";
describe("codex-loop-tick service contract", () => {
    test("launches Codex with the current noninteractive bypass flag", () => {
        expect(codexExecArgs({ worktree: "/repo/Zeta", prompt: "go", bypassApprovals: true })).toEqual([
            "exec",
            "-C",
            "/repo/Zeta",
            "--dangerously-bypass-approvals-and-sandbox",
            "go",
        ]);
    });
    test("keeps an explicit fallback for local no-bypass smoke runs", () => {
        expect(codexExecArgs({ worktree: "/repo/Zeta", prompt: "go", bypassApprovals: false })).toEqual([
            "exec",
            "-C",
            "/repo/Zeta",
            "-a",
            "never",
            "-s",
            "danger-full-access",
            "go",
        ]);
    });
    test("imports runner helpers without executing the loop", () => {
        expect(typeof buildCodexPrompt).toBe("function");
        expect(typeof codexExecArgs).toBe("function");
        expect(typeof codexLoopEnv).toBe("function");
    });
    test("marks headless loop runs distinctly from foreground Codex chat", () => {
        expect(codexLoopEnv({
            runId: "20260513T224509Z",
            origin: "codex-launchd-loop",
            surface: "codex-background-service",
            session: "codex/launchd-loop",
        })).toEqual({
            ZETA_AGENT_ORIGIN: "codex-launchd-loop",
            ZETA_AGENT_SURFACE: "codex-background-service",
            ZETA_CODEX_LOOP_RUN_ID: "20260513T224509Z",
            ZETA_CODEX_LOOP_SESSION: "codex/launchd-loop",
        });
        const prompt = buildCodexPrompt({
            home: "/tmp/zeta-home",
            runId: "20260513T224509Z",
            origin: "codex-launchd-loop",
            surface: "codex-background-service",
            session: "codex/launchd-loop",
        });
        expect(prompt).toContain("Vera");
        expect(prompt).toContain("codex-background-service");
        expect(prompt).toContain("codex-launchd-loop");
        expect(prompt).toContain("20260513T224509Z");
        expect(prompt).toContain("broadcasts");
    });
    test("prompt includes home path for broadcasts", () => {
        const prompt = buildCodexPrompt({ home: "/tmp/zeta-home" });
        expect(prompt).toContain("/tmp/zeta-home/.local/share/zeta-broadcasts");
        expect(prompt).toContain("Vera");
    });
});
