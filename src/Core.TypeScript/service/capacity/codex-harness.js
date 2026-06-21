/**
 * service/capacity/codex-harness.ts — Codex CLI invocation helpers.
 *
 * Extracted from .codex/bin/codex-loop-tick.ts for testability.
 */
import { join } from "node:path";
const DEFAULT_ORIGIN = "codex-launchd-loop";
const DEFAULT_SURFACE = "codex-background-service";
const DEFAULT_SESSION = "codex/launchd-loop";
export function codexExecArgs(config) {
    const args = ["exec", "-C", config.worktree];
    if (config.bypassApprovals) {
        args.push("--dangerously-bypass-approvals-and-sandbox");
    }
    else {
        args.push("-a", "never", "-s", "danger-full-access");
    }
    args.push(config.prompt);
    return args;
}
export function codexLoopEnv(config) {
    return {
        ZETA_AGENT_ORIGIN: config.origin ?? DEFAULT_ORIGIN,
        ZETA_AGENT_SURFACE: config.surface ?? DEFAULT_SURFACE,
        ZETA_CODEX_LOOP_RUN_ID: config.runId,
        ZETA_CODEX_LOOP_SESSION: config.session ?? DEFAULT_SESSION,
    };
}
export function buildCodexPrompt(config = {}) {
    const home = config.home ?? process.env["HOME"] ?? "/Users/acehack";
    const broadcastDir = join(home, ".local/share/zeta-broadcasts");
    const promptRunId = config.runId ?? process.env["ZETA_CODEX_LOOP_RUN_ID"] ?? "unknown";
    const promptOrigin = config.origin ?? DEFAULT_ORIGIN;
    const promptSurface = config.surface ?? DEFAULT_SURFACE;
    return [
        `You are Vera (Codex agent), trajectory manager. Run ID: ${promptRunId}.`,
        `Origin: ${promptOrigin}. Surface: ${promptSurface}.`,
        `Read broadcasts first: ${broadcastDir}/*.md`,
        `Walk assigned trajectories. Decompose only what you hit mid-stride.`,
        `Own every PR through merge. Learn from peer patterns.`,
        `Write status to ${broadcastDir}/codex.md at cycle end.`,
        `Report: open PRs, active claims, drift, one forward action or exact blocker.`,
    ].join(" ");
}
