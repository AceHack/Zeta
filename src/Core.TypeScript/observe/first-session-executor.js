import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  IDENTITY_AUTH_SERIAL,
  createMockIdentityAuthProvider,
  createSkipIdentityAuthProvider,
  resolveIdentityAuthMode,
  serialLinesForIdentityAuth
} from "../ci/identity-auth-provider";
import { DEFAULT_MANIFEST } from "../installer/zeta-creds-manifest";
export const SERIAL_PREFIX = "zeta-first-session:";
export function defaultShellRunner() {
  return {
    run(cmd, args) {
      return { exitCode: Bun.spawnSync([cmd, ...args], { stdout: "pipe", stderr: "pipe" }).exitCode };
    },
    spawnInteractive(cmd, args) {
      return { exitCode: Bun.spawnSync([cmd, ...args], {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit"
      }).exitCode };
    },
    which(cmd) {
      const proc = Bun.spawnSync(["which", cmd], { stdout: "pipe", stderr: "pipe" });
      if (proc.exitCode !== 0)
        return null;
      return proc.stdout.toString().trim() || null;
    }
  };
}
const VENDOR_MANIFEST_ID = {
  gh: "gh-cli",
  claude: "claude",
  codex: "codex",
  gemini: "gemini"
};
export function expandHome(path, home = homedir()) {
  return path.startsWith("~/") ? join(home, path.slice(2)) : path;
}
export function manifestPathsForVendor(vendor, home = homedir()) {
  return (DEFAULT_MANIFEST.credentials.find((c) => c.id === VENDOR_MANIFEST_ID[vendor])?.paths ?? []).map((p) => expandHome(p, home));
}
export function probeVendorStatus(vendor, runner, home = homedir()) {
  if (vendor === "gh") {
    if (!runner.which("gh"))
      return "missing";
    return runner.run("gh", ["auth", "status"]).exitCode === 0 ? "ready" : "missing";
  }
  return manifestPathsForVendor(vendor, home).some((p) => existsSync(p)) ? "ready" : "missing";
}
export function probeAllCredentials(runner, home = homedir()) {
  return {
    gh: probeVendorStatus("gh", runner, home),
    claude: probeVendorStatus("claude", runner, home),
    codex: probeVendorStatus("codex", runner, home),
    gemini: probeVendorStatus("gemini", runner, home)
  };
}
export function executeSetupCredential(vendor, runner = defaultShellRunner(), home = homedir(), options = {}) {
  const log = options.log ?? ((line) => console.log(line)), authMode = options.authMode ?? resolveIdentityAuthMode();
  switch (vendor) {
    case "gh": {
      if (authMode === "mock") {
        const result = createMockIdentityAuthProvider().authenticate();
        for (const line of serialLinesForIdentityAuth(result))
          log(line);
        return {
          outcome: result.outcome === "ready" ? "ready" : "failed",
          message: result.message
        };
      }
      if (authMode === "skip") {
        const result = createSkipIdentityAuthProvider().authenticate();
        for (const line of serialLinesForIdentityAuth(result))
          log(line);
        return { outcome: "skipped", message: result.message };
      }
      if (!runner.which("gh"))
        return { outcome: "failed", message: "gh binary not found on PATH" };
      log(IDENTITY_AUTH_SERIAL.liveBegin);
      if (runner.spawnInteractive("gh", ["auth", "login"]).exitCode !== 0) {
        log(IDENTITY_AUTH_SERIAL.liveFailed);
        return { outcome: "failed", message: "gh auth login failed or was cancelled" };
      }
      runner.run("gh", ["auth", "setup-git"]);
      if (runner.run("gh", ["auth", "status"]).exitCode !== 0) {
        log(IDENTITY_AUTH_SERIAL.liveFailed);
        return { outcome: "failed", message: "gh auth status still failing after login" };
      }
      log(IDENTITY_AUTH_SERIAL.liveOk);
      return { outcome: "ready", message: "GitHub CLI authenticated (temporary foothold)" };
    }
    case "claude": {
      const bin = runner.which("claude") ?? join(home, ".bun/bin/claude");
      if (!existsSync(bin) && !runner.which("claude"))
        return { outcome: "failed", message: "claude CLI not found \u2014 install via agent-clis manifest" };
      const cmd = runner.which("claude") ?? bin;
      console.log(`${SERIAL_PREFIX} claude-login-begin`);
      if (runner.spawnInteractive(cmd, ["login"]).exitCode !== 0) {
        console.log(`${SERIAL_PREFIX} claude-login-failed`);
        return { outcome: "failed", message: "claude login failed or was cancelled" };
      }
      return probeVendorStatus("claude", runner, home) === "ready" ? { outcome: "ready", message: "Claude Code authenticated" } : { outcome: "failed", message: "claude login exited 0 but credentials not found" };
    }
    case "codex": {
      const bin = runner.which("codex") ?? join(home, ".bun/bin/codex");
      if (!existsSync(bin) && !runner.which("codex"))
        return { outcome: "failed", message: "codex CLI not found \u2014 install via agent-clis manifest" };
      const cmd = runner.which("codex") ?? bin;
      console.log(`${SERIAL_PREFIX} codex-login-begin`);
      if (runner.spawnInteractive(cmd, ["login", "--device-auth"]).exitCode !== 0) {
        console.log(`${SERIAL_PREFIX} codex-login-failed`);
        return { outcome: "failed", message: "codex login failed or was cancelled" };
      }
      return probeVendorStatus("codex", runner, home) === "ready" ? { outcome: "ready", message: "Codex CLI authenticated" } : { outcome: "failed", message: "codex login exited 0 but auth.json not found" };
    }
    case "gemini": {
      const cmd = runner.which("gemini");
      if (!cmd)
        return { outcome: "failed", message: "gemini CLI not found \u2014 install via agent-clis manifest" };
      console.log(`${SERIAL_PREFIX} gemini-login-begin`);
      if (runner.spawnInteractive(cmd, ["auth", "login"]).exitCode !== 0) {
        console.log(`${SERIAL_PREFIX} gemini-login-failed`);
        return { outcome: "failed", message: "gemini auth login failed or was cancelled" };
      }
      return probeVendorStatus("gemini", runner, home) === "ready" ? { outcome: "ready", message: "Gemini CLI authenticated" } : { outcome: "failed", message: "gemini auth login exited 0 but oauth_creds.json not found" };
    }
  }
}
