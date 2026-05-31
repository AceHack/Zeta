#!/usr/bin/env bun
/**
 * tools/ci/docker-windows-install-ps1-test.ts
 *
 * Slice 2c — TS wrapper for the Server-Core Docker test of tools/setup/install.ps1 (B-0857
 * Windows parity). Mirrors tools/ci/docker-nixos-install-sh-test.ts (per
 * .claude/rules/rule-0-no-sh-files.md: TS-over-bash). Wraps `docker build` of
 * tools/ci/dockerfiles/windows-install-ps1-test/Dockerfile with exit-code mapping, log capture
 * (CI artifact), and timeout enforcement.
 *
 * REQUIRES a Windows host with Docker in Windows-container mode (the windows-2022 GitHub runner).
 * Windows containers cannot run on Linux hosts.
 *
 * Usage:
 *   bun tools/ci/docker-windows-install-ps1-test.ts [--keep-image]
 *
 * Env:
 *   DOCKER_BUILD_TIMEOUT_SEC   override timeout (default 2400 — servercore pull + scoop + mise
 *                              install of .mise.toml runtimes is heavy on a cold runner)
 *   DOCKER_LOG_OUT_PATH        override log path (default .tools/docker-windows-install-ps1-test.log)
 *
 * Exit codes: 0 build ok | 1 build failed | 2 usage/prereq | 124 timeout.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

function spawnDocker(args: string[], opts: { timeoutMs?: number } = {}): ReturnType<typeof spawnSync> {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  return spawnSync("docker", args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024, // docker build output is verbose
    timeout: opts.timeoutMs,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

const DOCKERFILE_PATH = "tools/ci/dockerfiles/windows-install-ps1-test/Dockerfile";
const IMAGE_TAG = "zeta-windows-install-ps1-test:local";
const DEFAULT_TIMEOUT_SEC = 2400;
const DEFAULT_LOG_PATH = ".tools/docker-windows-install-ps1-test.log";

interface BuildResult {
  exitCode: 0 | 1 | 2 | 124;
  reason: string;
  logTail?: string;
}

function usage(): never {
  console.error("usage: bun tools/ci/docker-windows-install-ps1-test.ts [--keep-image]");
  console.error("");
  console.error("env:");
  console.error("  DOCKER_BUILD_TIMEOUT_SEC  override timeout (default 2400)");
  console.error("  DOCKER_LOG_OUT_PATH       override log path");
  process.exit(2);
}

function checkPrereqs(): void {
  const docker = spawnDocker(["--version"]);
  if (docker.status !== 0) {
    console.error("error: docker not installed or not on PATH");
    process.exit(2);
  }
  for (const p of [DOCKERFILE_PATH, ".mise.toml", "tools/ci/windows-install-ps1-smoke.ts"]) {
    if (!existsSync(p)) {
      console.error(`error: ${p} not found (run from repo root)`);
      process.exit(2);
    }
  }
}

function runBuild(timeoutSec: number, logPath: string): BuildResult {
  const startMs = Date.now();
  // NOTE: no --progress=plain — the windows-2022 runner uses the LEGACY docker builder (not
  // BuildKit/buildx), which rejects --progress. Output still streams to stdout/stderr (captured).
  const buildArgs = ["build", "--file", DOCKERFILE_PATH, "--tag", IMAGE_TAG, "."];
  console.log(`[Slice 2c] docker build ${buildArgs.join(" ")}`);
  console.log(`[Slice 2c] timeout: ${timeoutSec}s; log: ${logPath}`);

  const result = spawnDocker(buildArgs, { timeoutMs: timeoutSec * 1000 });
  const elapsedSec = Math.floor((Date.now() - startMs) / 1000);

  const stdout = (result.stdout ?? "").toString();
  const stderr = (result.stderr ?? "").toString();
  const fullLog = stdout + stderr;
  writeFileSync(logPath, fullLog, "utf8");
  const logTail = fullLog.split("\n").slice(-25).join("\n");

  const errCode = (result.error as NodeJS.ErrnoException | undefined)?.code;
  if (result.signal === "SIGTERM" || errCode === "ETIMEDOUT") {
    return { exitCode: 124, reason: `docker build timed out after ${timeoutSec}s (actual: ${elapsedSec}s)`, logTail };
  }
  if (result.status === 0) {
    console.log(`[Slice 2c] SUCCESS — docker build completed in ${elapsedSec}s`);
    return { exitCode: 0, reason: `docker build succeeded in ${elapsedSec}s`, logTail };
  }
  return { exitCode: 1, reason: `docker build failed (exit ${result.status}) after ${elapsedSec}s`, logTail };
}

function cleanup(keepImage: boolean): void {
  if (keepImage) {
    console.log(`[Slice 2c] --keep-image set; image ${IMAGE_TAG} retained`);
    return;
  }
  const rm = spawnDocker(["rmi", "-f", IMAGE_TAG]);
  if (rm.status === 0) console.log(`[Slice 2c] cleaned up image ${IMAGE_TAG}`);
  else console.error(`[Slice 2c] warning: docker rmi ${IMAGE_TAG} failed (non-fatal)`);
}

function main(): void {
  const args = process.argv.slice(2);
  let keepImage = false;
  for (const arg of args) {
    if (arg === "--keep-image") keepImage = true;
    else if (arg === "--help" || arg === "-h") usage();
    else {
      console.error(`error: unknown arg: ${arg}`);
      usage();
    }
  }

  const timeoutSec = parseInt(process.env.DOCKER_BUILD_TIMEOUT_SEC ?? String(DEFAULT_TIMEOUT_SEC), 10);
  if (!Number.isFinite(timeoutSec) || timeoutSec <= 0) {
    console.error(`error: DOCKER_BUILD_TIMEOUT_SEC must be a positive integer (got: ${process.env.DOCKER_BUILD_TIMEOUT_SEC})`);
    process.exit(2);
  }
  const logPath = resolve(process.env.DOCKER_LOG_OUT_PATH ?? DEFAULT_LOG_PATH);
  const logDir = dirname(logPath);
  if (logDir && !existsSync(logDir)) mkdirSync(logDir, { recursive: true });

  checkPrereqs();
  const result = runBuild(timeoutSec, logPath);
  console.log("");
  console.log(`[Slice 2c] result: ${result.reason}`);
  console.log(`[Slice 2c] log: ${logPath}`);
  if (result.exitCode !== 0) {
    console.log("[Slice 2c] tail of build log:");
    console.log("--- BEGIN TAIL ---");
    console.log(result.logTail);
    console.log("--- END TAIL ---");
  }
  cleanup(keepImage);
  process.exit(result.exitCode);
}

main();
