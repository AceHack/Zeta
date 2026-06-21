#!/usr/bin/env bun
/**
 * src/Core.TypeScript/ci/docker-nixos-install-sh-test.ts
 *
 * 081KSKBP80008QG0R000E3RKPK Phase 1 — TS wrapper for the Docker NixOS install.sh test
 * harness. Per .claude/rules/rule-0-no-sh-files.md: TS-over-bash for
 * DST + cross-platform. Wraps `docker build` of
 * src/Core.TypeScript/ci/dockerfiles/nixos-install-sh-test/Dockerfile with:
 *
 *   - exit-code mapping (build success = 0; build failure = 1)
 *   - log capture (saved to workspace-relative path for CI artifact)
 *   - timeout enforcement (default 600s — install.sh + mise + bun
 *     + claude-code download can take a while on cold cache)
 *   - build-context discipline (uses repo root as context;
 *     dockerfile is at the fixed path; doesn't pollute root with
 *     build artifacts)
 *
 * Composes with 081KSGS9H0008QG0R0011BC7T2 cascade #6 QEMU full-install test
 * (qemu-full-install-test.ts): Docker = fast iteration (~30-60 sec);
 * QEMU = end-to-end virtualized boot (~15 min). Both run on CI for
 * install-substrate PRs.
 *
 * Operator framing 2026-05-27: "we should add docker based nixos
 * install.sh testing so we can iterate quick that's an easy
 * dockerfile" → 081KSKBP80008QG0R000E3RKPK backlog row → this implementation.
 *
 * Usage:
 *   bun src/Core.TypeScript/ci/docker-nixos-install-sh-test.ts [--keep-image]
 *
 * Flags:
 *   --keep-image    Don't `docker rmi` after the test (default: cleanup)
 *
 * Env:
 *   DOCKER_BUILD_TIMEOUT_SEC   Override timeout (default 600)
 *   DOCKER_LOG_OUT_PATH        Override log path (default
 *                              .tools/docker-nixos-install-sh-test.log
 *                              — .tools/ is gitignored so the log
 *                              won't show as untracked)
 *
 * Exit codes:
 *   0 — Docker build succeeded (install.sh + mise + bun + claude-code
 *       all validated on NixOS userspace)
 *   1 — Docker build failed (one of the validation steps in the
 *       Dockerfile failed; see log)
 *   2 — Usage error / missing prerequisites (docker not installed,
 *       wrong working directory, etc.)
 *   124 — Timeout (build exceeded DOCKER_BUILD_TIMEOUT_SEC)
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

// Centralized docker invocation helper — single point for the
// sonarjs/no-os-command-from-path suppression (matches the pattern
// in src/Core.TypeScript/ci/audit-installer-iso-content.ts:186-194). Rationale:
// the `docker` binary comes from the runner's default PATH; the CI
// workflow doesn't pin an absolute path, and the binary name is
// stable across docker versions. The `maxBuffer` is set generously
// because `docker build --progress=plain` produces a lot of output
// per build step (could exceed Node's default 1 MiB).
function spawnDocker(args: string[], opts: { timeoutMs?: number } = {}): ReturnType<typeof spawnSync> {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  return spawnSync("docker", args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024, // 64 MiB — docker build output is verbose
    timeout: opts.timeoutMs,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

const DOCKERFILE_PATH = "src/Core.TypeScript/ci/dockerfiles/nixos-install-sh-test/Dockerfile";
const IMAGE_TAG = "zeta-nixos-install-sh-test:local";
const DEFAULT_TIMEOUT_SEC = 600;
// Default log path uses .tools/ which is .gitignored — prevents the
// log file from showing up as untracked in repo root after a local
// run (per Copilot review on PR #5393). Operator can override via
// DOCKER_LOG_OUT_PATH env var.
const DEFAULT_LOG_PATH = ".tools/docker-nixos-install-sh-test.log";

interface BuildResult {
  exitCode: 0 | 1 | 2 | 124;
  reason: string;
  logTail?: string;
}

function usage(): never {
  console.error("usage: bun src/Core.TypeScript/ci/docker-nixos-install-sh-test.ts [--keep-image]");
  console.error("");
  console.error("env:");
  console.error("  DOCKER_BUILD_TIMEOUT_SEC  override timeout (default 600)");
  console.error("  DOCKER_LOG_OUT_PATH       override log path");
  process.exit(2);
}

function checkPrereqs(): void {
  // Verify docker is installed (via centralized spawnDocker helper)
  const docker = spawnDocker(["--version"]);
  if (docker.status !== 0) {
    console.error("error: docker not installed or not on PATH");
    console.error("  install via the standard mechanism for your OS");
    process.exit(2);
  }

  // Verify we're at repo root (Dockerfile path is repo-relative)
  if (!existsSync(DOCKERFILE_PATH)) {
    console.error(`error: ${DOCKERFILE_PATH} not found`);
    console.error("  run from repo root: bun src/Core.TypeScript/ci/docker-nixos-install-sh-test.ts");
    process.exit(2);
  }

  // Verify .mise.toml is at repo root (Dockerfile COPYs it)
  if (!existsSync(".mise.toml")) {
    console.error("error: .mise.toml not found at repo root");
    process.exit(2);
  }
}

function runBuild(timeoutSec: number, logPath: string): BuildResult {
  const startMs = Date.now();
  const buildArgs = [
    "build",
    // Authenticate mise GitHub API lookups via a BuildKit secret (no 403 rate-limit);
    // mounted as a file for the install.sh RUN only, never baked into a layer (vs
    // --build-arg). DOCKER_BUILDKIT=1 (workflow env, inherited by spawnSync) enables it.
    "--secret",
    "id=github_token,env=GITHUB_TOKEN",
    "--file",
    DOCKERFILE_PATH,
    "--tag",
    IMAGE_TAG,
    // --progress=plain prints full output (vs --progress=auto which
    // collapses for terminals); we want full output captured to log
    "--progress=plain",
    // Build context = current dir (repo root)
    ".",
  ];

  console.log(`[081KSKBP80008QG0R000E3RKPK Phase 1] docker build ${buildArgs.join(" ")}`);
  console.log(`[081KSKBP80008QG0R000E3RKPK Phase 1] timeout: ${timeoutSec}s; log: ${logPath}`);

  // spawnDocker helper centralizes the sonarjs suppression + maxBuffer
  const result = spawnDocker(buildArgs, { timeoutMs: timeoutSec * 1000 });

  const elapsedSec = Math.floor((Date.now() - startMs) / 1000);

  // Capture full output to log file. spawnSync with encoding:"utf8"
  // returns strings; coerce explicitly to satisfy strict typecheck
  // (TS union of string|NonSharedBuffer in @types/node).
  const stdout = (result.stdout ?? "").toString();
  const stderr = (result.stderr ?? "").toString();
  const fullLog = stdout + stderr;
  writeFileSync(logPath, fullLog, "utf8");

  // Extract tail for the return-value reason
  const logTail = fullLog.split("\n").slice(-20).join("\n");

  // result.error is Error|undefined; the .code property is Node's
  // ErrnoException extension (not on base Error). Type-assert as
  // NodeJS.ErrnoException to access .code without TS complaint.
  const errCode = (result.error as NodeJS.ErrnoException | undefined)?.code;
  if (result.signal === "SIGTERM" || errCode === "ETIMEDOUT") {
    return {
      exitCode: 124,
      reason: `docker build timed out after ${timeoutSec}s (actual: ${elapsedSec}s)`,
      logTail,
    };
  }

  if (result.status === 0) {
    console.log(`[081KSKBP80008QG0R000E3RKPK Phase 1] SUCCESS — docker build completed in ${elapsedSec}s`);
    return {
      exitCode: 0,
      reason: `docker build succeeded in ${elapsedSec}s`,
      logTail,
    };
  }

  return {
    exitCode: 1,
    reason: `docker build failed (exit ${result.status}) after ${elapsedSec}s`,
    logTail,
  };
}

function cleanup(keepImage: boolean): void {
  if (keepImage) {
    console.log(`[081KSKBP80008QG0R000E3RKPK Phase 1] --keep-image set; image ${IMAGE_TAG} retained for inspection`);
    return;
  }
  // spawnDocker helper centralizes the sonarjs suppression
  const rm = spawnDocker(["rmi", "-f", IMAGE_TAG]);
  if (rm.status === 0) {
    console.log(`[081KSKBP80008QG0R000E3RKPK Phase 1] cleaned up image ${IMAGE_TAG}`);
  } else {
    console.error(`[081KSKBP80008QG0R000E3RKPK Phase 1] warning: docker rmi ${IMAGE_TAG} failed (non-fatal)`);
  }
}

function main(): void {
  // Parse args
  const args = process.argv.slice(2);
  let keepImage = false;
  for (const arg of args) {
    if (arg === "--keep-image") {
      keepImage = true;
    } else if (arg === "--help" || arg === "-h") {
      usage();
    } else {
      console.error(`error: unknown arg: ${arg}`);
      usage();
    }
  }

  // Resolve env overrides
  const timeoutSec = parseInt(process.env.DOCKER_BUILD_TIMEOUT_SEC ?? String(DEFAULT_TIMEOUT_SEC), 10);
  if (!Number.isFinite(timeoutSec) || timeoutSec <= 0) {
    console.error(
      `error: DOCKER_BUILD_TIMEOUT_SEC must be a positive integer (got: ${process.env.DOCKER_BUILD_TIMEOUT_SEC})`,
    );
    process.exit(2);
  }
  const logPath = resolve(process.env.DOCKER_LOG_OUT_PATH ?? DEFAULT_LOG_PATH);

  // Ensure log directory exists (Copilot review: use path.dirname
  // instead of lastIndexOf("/") for cross-platform support including
  // Windows backslash paths).
  const logDir = dirname(logPath);
  if (logDir && !existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }

  checkPrereqs();

  const result = runBuild(timeoutSec, logPath);

  console.log("");
  console.log(`[081KSKBP80008QG0R000E3RKPK Phase 1] result: ${result.reason}`);
  console.log(`[081KSKBP80008QG0R000E3RKPK Phase 1] log: ${logPath}`);

  if (result.exitCode !== 0) {
    console.log("[081KSKBP80008QG0R000E3RKPK Phase 1] tail of build log:");
    console.log("--- BEGIN TAIL ---");
    console.log(result.logTail);
    console.log("--- END TAIL ---");
  }

  cleanup(keepImage);

  process.exit(result.exitCode);
}

main();
