/**
 * first-session-executor.ts — probe + execute credential setup on installed nodes.
 *
 * Slice 3: temporary cluster foothold is `gh auth login` (first target today).
 * Long-term: Zeta distributed IdP (ADR 2026-07-08) + ZetaDB/DagFs as git
 * backend/client replacement — keep CI behind identity-auth-provider seam.
 * Optional vendors delegate to their CLIs when present.
 */

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  IDENTITY_AUTH_SERIAL,
  createMockIdentityAuthProvider,
  createSkipIdentityAuthProvider,
  resolveIdentityAuthMode,
  serialLinesForIdentityAuth,
  type IdentityAuthMode,
} from "../ci/identity-auth-provider";
import { DEFAULT_MANIFEST } from "../installer/zeta-creds-manifest";
import type { CredStatus, CredVendor } from "./first-session";

export const SERIAL_PREFIX = "zeta-first-session:";

export interface ShellRunner {
  readonly run: (cmd: string, args: readonly string[]) => { readonly exitCode: number };
  readonly spawnInteractive: (cmd: string, args: readonly string[]) => { readonly exitCode: number };
  readonly which: (cmd: string) => string | null;
}

export interface ExecuteSetupOptions {
  readonly authMode?: IdentityAuthMode;
  readonly log?: (line: string) => void;
}

export function defaultShellRunner(): ShellRunner {
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
      if (proc.exitCode !== 0) return null;
      return proc.stdout.toString().trim() || null;
    },
  };
}

const VENDOR_MANIFEST_ID: Readonly<Record<CredVendor, string>> = {
  gh: "gh-cli",
  claude: "claude",
  codex: "codex",
  gemini: "gemini",
};

export function expandHome(path: string, home = homedir()): string {
  return path.startsWith("~/") ? join(home, path.slice(2)) : path;
}

export function manifestPathsForVendor(vendor: CredVendor, home = homedir()): readonly string[] {
  const entry = DEFAULT_MANIFEST.credentials.find((c) => c.id === VENDOR_MANIFEST_ID[vendor]);
  return (entry?.paths ?? []).map((p) => expandHome(p, home));
}

/** Probe one vendor — gh uses `gh auth status`; others check manifest paths. */
export function probeVendorStatus(vendor: CredVendor, runner: ShellRunner, home = homedir()): CredStatus {
  if (vendor === "gh") {
    const gh = runner.which("gh");
    if (!gh) return "missing";
    return runner.run("gh", ["auth", "status"]).exitCode === 0 ? "ready" : "missing";
  }
  const paths = manifestPathsForVendor(vendor, home);
  return paths.some((p) => existsSync(p)) ? "ready" : "missing";
}

export function probeAllCredentials(runner: ShellRunner, home = homedir()): Readonly<Record<CredVendor, CredStatus>> {
  return {
    gh: probeVendorStatus("gh", runner, home),
    claude: probeVendorStatus("claude", runner, home),
    codex: probeVendorStatus("codex", runner, home),
    gemini: probeVendorStatus("gemini", runner, home),
  };
}

export type SetupOutcome = "ready" | "failed" | "skipped";

export interface SetupResult {
  readonly outcome: SetupOutcome;
  readonly message: string;
}

/** Execute interactive credential setup for one vendor. */
export function executeSetupCredential(
  vendor: CredVendor,
  runner: ShellRunner = defaultShellRunner(),
  home = homedir(),
  options: ExecuteSetupOptions = {},
): SetupResult {
  const log = options.log ?? ((line: string) => console.log(line));
  const authMode = options.authMode ?? resolveIdentityAuthMode();

  switch (vendor) {
    case "gh": {
      // Temporary foothold vendor. CI: mock or skip via ZETA_IDENTITY_AUTH_MODE
      // (ADR 2026-07-08 mock device-code). Production: live gh. Successor: Zeta IdP.
      if (authMode === "mock") {
        const result = createMockIdentityAuthProvider().authenticate();
        for (const line of serialLinesForIdentityAuth(result)) log(line);
        return {
          outcome: result.outcome === "ready" ? "ready" : "failed",
          message: result.message,
        };
      }
      if (authMode === "skip") {
        const result = createSkipIdentityAuthProvider().authenticate();
        for (const line of serialLinesForIdentityAuth(result)) log(line);
        return { outcome: "skipped", message: result.message };
      }
      if (!runner.which("gh")) {
        return { outcome: "failed", message: "gh binary not found on PATH" };
      }
      log(IDENTITY_AUTH_SERIAL.liveBegin);
      const login = runner.spawnInteractive("gh", ["auth", "login"]);
      if (login.exitCode !== 0) {
        log(IDENTITY_AUTH_SERIAL.liveFailed);
        return { outcome: "failed", message: "gh auth login failed or was cancelled" };
      }
      runner.run("gh", ["auth", "setup-git"]);
      const status = runner.run("gh", ["auth", "status"]);
      if (status.exitCode !== 0) {
        log(IDENTITY_AUTH_SERIAL.liveFailed);
        return { outcome: "failed", message: "gh auth status still failing after login" };
      }
      log(IDENTITY_AUTH_SERIAL.liveOk);
      return { outcome: "ready", message: "GitHub CLI authenticated (temporary foothold)" };
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
