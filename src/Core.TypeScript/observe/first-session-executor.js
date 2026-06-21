/**
 * first-session-executor.ts — probe + execute credential setup on installed nodes.
 *
 * Slice 3: gh auth login is load-bearing; optional vendors delegate to their CLIs
 * when present. Probing reuses manifest paths from zeta-creds-manifest.
 */
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DEFAULT_MANIFEST } from "../installer/zeta-creds-manifest";
export const SERIAL_PREFIX = "zeta-first-session:";
export function defaultShellRunner() {
    return {
        run(cmd, args) {
            const proc = Bun.spawnSync([cmd, ...args], { stdout: "pipe", stderr: "pipe" });
            return { exitCode: proc.exitCode };
        },
        spawnInteractive(cmd, args) {
            const proc = Bun.spawnSync([cmd, ...args], {
                stdin: "inherit",
                stdout: "inherit",
                stderr: "inherit",
            });
            return { exitCode: proc.exitCode };
        },
        which(cmd) {
            const proc = Bun.spawnSync(["which", cmd], { stdout: "pipe", stderr: "pipe" });
            if (proc.exitCode !== 0)
                return null;
            return proc.stdout.toString().trim() || null;
        },
    };
}
const VENDOR_MANIFEST_ID = {
    gh: "gh-cli",
    claude: "claude",
    codex: "codex",
    gemini: "gemini",
};
export function expandHome(path, home = homedir()) {
    return path.startsWith("~/") ? join(home, path.slice(2)) : path;
}
export function manifestPathsForVendor(vendor, home = homedir()) {
    const entry = DEFAULT_MANIFEST.credentials.find((c) => c.id === VENDOR_MANIFEST_ID[vendor]);
    return (entry?.paths ?? []).map((p) => expandHome(p, home));
}
/** Probe one vendor — gh uses `gh auth status`; others check manifest paths. */
export function probeVendorStatus(vendor, runner, home = homedir()) {
    if (vendor === "gh") {
        const gh = runner.which("gh");
        if (!gh)
            return "missing";
        return runner.run("gh", ["auth", "status"]).exitCode === 0 ? "ready" : "missing";
    }
    const paths = manifestPathsForVendor(vendor, home);
    return paths.some((p) => existsSync(p)) ? "ready" : "missing";
}
export function probeAllCredentials(runner, home = homedir()) {
    return {
        gh: probeVendorStatus("gh", runner, home),
        claude: probeVendorStatus("claude", runner, home),
        codex: probeVendorStatus("codex", runner, home),
        gemini: probeVendorStatus("gemini", runner, home),
    };
}
/** Execute interactive credential setup for one vendor. */
export function executeSetupCredential(vendor, runner = defaultShellRunner(), home = homedir()) {
    switch (vendor) {
        case "gh": {
            if (!runner.which("gh")) {
                return { outcome: "failed", message: "gh binary not found on PATH" };
            }
            console.log(`${SERIAL_PREFIX} gh-auth-begin`);
            const login = runner.spawnInteractive("gh", ["auth", "login"]);
            if (login.exitCode !== 0) {
                console.log(`${SERIAL_PREFIX} gh-auth-failed`);
                return { outcome: "failed", message: "gh auth login failed or was cancelled" };
            }
            runner.run("gh", ["auth", "setup-git"]);
            const status = runner.run("gh", ["auth", "status"]);
            if (status.exitCode !== 0) {
                console.log(`${SERIAL_PREFIX} gh-auth-failed`);
                return { outcome: "failed", message: "gh auth status still failing after login" };
            }
            console.log(`${SERIAL_PREFIX} gh-auth-ok`);
            return { outcome: "ready", message: "GitHub CLI authenticated" };
        }
        case "claude": {
            const bin = runner.which("claude") ?? join(home, ".bun/bin/claude");
            if (!existsSync(bin) && !runner.which("claude")) {
                return { outcome: "failed", message: "claude CLI not found — install via agent-clis manifest" };
            }
            const cmd = runner.which("claude") ?? bin;
            console.log(`${SERIAL_PREFIX} claude-login-begin`);
            const r = runner.spawnInteractive(cmd, ["login"]);
            if (r.exitCode !== 0) {
                console.log(`${SERIAL_PREFIX} claude-login-failed`);
                return { outcome: "failed", message: "claude login failed or was cancelled" };
            }
            return probeVendorStatus("claude", runner, home) === "ready"
                ? { outcome: "ready", message: "Claude Code authenticated" }
                : { outcome: "failed", message: "claude login exited 0 but credentials not found" };
        }
        case "codex": {
            const bin = runner.which("codex") ?? join(home, ".bun/bin/codex");
            if (!existsSync(bin) && !runner.which("codex")) {
                return { outcome: "failed", message: "codex CLI not found — install via agent-clis manifest" };
            }
            const cmd = runner.which("codex") ?? bin;
            console.log(`${SERIAL_PREFIX} codex-login-begin`);
            const r = runner.spawnInteractive(cmd, ["login", "--device-auth"]);
            if (r.exitCode !== 0) {
                console.log(`${SERIAL_PREFIX} codex-login-failed`);
                return { outcome: "failed", message: "codex login failed or was cancelled" };
            }
            return probeVendorStatus("codex", runner, home) === "ready"
                ? { outcome: "ready", message: "Codex CLI authenticated" }
                : { outcome: "failed", message: "codex login exited 0 but auth.json not found" };
        }
        case "gemini": {
            const cmd = runner.which("gemini");
            if (!cmd) {
                return { outcome: "failed", message: "gemini CLI not found — install via agent-clis manifest" };
            }
            console.log(`${SERIAL_PREFIX} gemini-login-begin`);
            const r = runner.spawnInteractive(cmd, ["auth", "login"]);
            if (r.exitCode !== 0) {
                console.log(`${SERIAL_PREFIX} gemini-login-failed`);
                return { outcome: "failed", message: "gemini auth login failed or was cancelled" };
            }
            return probeVendorStatus("gemini", runner, home) === "ready"
                ? { outcome: "ready", message: "Gemini CLI authenticated" }
                : { outcome: "failed", message: "gemini auth login exited 0 but oauth_creds.json not found" };
        }
    }
}
