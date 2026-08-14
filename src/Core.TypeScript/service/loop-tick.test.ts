import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TICK_PATH = join(import.meta.dir, "loop-tick.ts");

function runTick(args: string[], env: NodeJS.ProcessEnv = {}): { status: number; stdout: string; stderr: string } {
  const result = spawnSync("bun", [TICK_PATH, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      ...env,
    },
    timeout: 10_000,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function writeExecutable(path: string, content: string): void {
  writeFileSync(path, content);
  chmodSync(path, 0o755);
}

describe("loop-tick", () => {
  test("exits with usage when --persona not provided", () => {
    const r = runTick([]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("Usage:");
    expect(r.stderr).toContain("--persona");
  });

  test("exits with error for unknown persona", () => {
    const r = runTick(["--persona", "unknown-agent"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("Unknown persona");
  });

  test("runs successfully for valid persona (kiro) — acquires lock and ticks", () => {
    const root = mkdtempSync(join(tmpdir(), "zeta-loop-tick-"));
    try {
      const home = join(root, "home");
      const bin = join(home, ".local", "bin");
      const worktree = join(root, "worktree");
      const stateDir = join(root, "state");
      const logDir = join(root, "logs");

      mkdirSync(bin, { recursive: true });
      mkdirSync(worktree, { recursive: true });

      // Inject the executable port explicitly. The test must never reach the network or
      // depend on whichever git and gh happen to be installed on the runner.
      writeExecutable(
        join(bin, "git"),
        ["#!/usr/bin/env bash", 'case "$1" in', "  fetch|branch|status) exit 0 ;;", "  *) exit 0 ;;", "esac", ""].join(
          "\n",
        ),
      );
      writeExecutable(
        join(bin, "gh"),
        ["#!/usr/bin/env bash", 'if [ "$1" = "pr" ] && [ "$2" = "list" ]; then', "  echo 0", "fi", "exit 0", ""].join(
          "\n",
        ),
      );

      const r = runTick(["--persona", "kiro"], {
        HOME: home,
        ZETA_LOOP_WORKTREE: worktree,
        ZETA_LOOP_STATE_DIR: stateDir,
        ZETA_LOOP_LOG_DIR: logDir,
        ZETA_LOOP_TOOL_PATH_PREFIX: bin,
        ZETA_LOOP_DRY_RUN: "1",
        ZETA_LOOP_FETCH_TIMEOUT_SECONDS: "1",
        ZETA_LOOP_LOCK_TTL_SECONDS: "1",
      });

      expect(r.status).toBe(0);
      expect(r.stderr).not.toContain("Unknown persona");
      expect(r.stderr).not.toContain("Usage:");
      expect(existsSync(join(stateDir, "heartbeats", "kiro-tick.json"))).toBe(true);
      expect(readFileSync(join(logDir, "runner.log"), "utf8")).toContain("tick complete");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
