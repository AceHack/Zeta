#!/usr/bin/env bun
/**
 * src/Core.TypeScript/persistence/windows/loop-wrapper.ts
 *
 * TS port of tools/persistence/windows/otto-loop-wrapper.ps1.
 * Per-tick entry point for the Zeta autonomous loop on Windows.
 * Task Scheduler runs this each minute (via bun).
 *
 * Parity with src/Core.TypeScript/kiro/kiro-loop-wrapper.ts (macOS).
 *
 * Runs the loop tick against a DEDICATED CLONE under
 * %LOCALAPPDATA%\zeta-otto-loop\Zeta — never the operator checkout.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

function timestamp(): string {
  return new Date().toISOString();
}

function main(): number {
  const localAppData = process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local");
  const base = join(localAppData, "zeta-otto-loop");
  const clone = join(base, "Zeta");
  const logDir = base;
  const logFile = join(logDir, "wrapper.log");
  const errFile = join(logDir, "wrapper.err");

  mkdirSync(base, { recursive: true });

  // Which ref the dedicated clone tracks
  const refFile = join(base, "loop-ref.txt");
  const ref = existsSync(refFile) ? readFileSync(refFile, "utf8").trim() : "main";

  // Verify tools on PATH
  const git = spawnSync("git", ["--version"], { encoding: "utf8" });
  if (git.status !== 0) {
    appendFileSync(errFile, `${timestamp()} ERROR git not on PATH\n`);
    return 1;
  }
  const bun = spawnSync("bun", ["--version"], { encoding: "utf8" });
  if (bun.status !== 0) {
    appendFileSync(errFile, `${timestamp()} ERROR bun not on PATH\n`);
    return 1;
  }

  // Clone-if-missing safety net
  if (!existsSync(join(clone, ".git"))) {
    const cloneResult = spawnSync("git", ["clone", "https://github.com/Lucent-Financial-Group/Zeta.git", clone], { encoding: "utf8" });
    appendFileSync(logFile, `${timestamp()} clone: exit ${cloneResult.status}\n`);
    spawnSync("git", ["-C", clone, "checkout", ref], { encoding: "utf8" });
  }

  // Set env for the tick
  process.env.ZETA_CLAUDE_LOOP_WORKTREE = clone;
  process.env.ZETA_CLAUDE_LOOP_STATE_DIR = join(base, "state");
  process.env.ZETA_CLAUDE_LOOP_LOG_DIR = logDir;
  process.env.ZETA_CLAUDE_LOOP_REF = ref;

  // Run the tick
  const tick = join(clone, ".claude", "bin", "claude-loop-tick.ts");
  const tickResult = spawnSync("bun", [tick], {
    cwd: clone,
    encoding: "utf8",
    env: process.env,
  });
  const tickExit = tickResult.status ?? 1;
  appendFileSync(logFile, `${timestamp()} tick exit=${tickExit}\n`);

  // Heartbeat push (gated to ~10 min)
  const hbStamp = join(base, "last-heartbeat-push.txt");
  let pushHb = true;
  if (existsSync(hbStamp)) {
    try {
      const last = new Date(readFileSync(hbStamp, "utf8").trim());
      if (Date.now() - last.getTime() < 10 * 60 * 1000) pushHb = false;
    } catch { pushHb = true; }
  }

  if (pushHb) {
    const hbScript = join(clone, "src", "Core.TypeScript", "agent-heartbeats", "write-heartbeat.ts");
    const hb = spawnSync("bun", [hbScript, "--push", "--persona-name", "otto-windows", "--disposition", "loop-tick"], {
      cwd: clone, encoding: "utf8", env: process.env,
    });
    if (hb.status === 0) {
      writeFileSync(hbStamp, new Date().toISOString());
    } else {
      appendFileSync(errFile, `${timestamp()} WARN heartbeat-push failed (exit ${hb.status})\n`);
    }
  }

  // Write tick result for observability
  writeFileSync(join(base, "last-tick-result.txt"), `${timestamp()} exit=${tickExit}`);
  return tickExit;
}

if (import.meta.main) {
  process.exit(main());
}

export { main };
