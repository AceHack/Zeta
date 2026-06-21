#!/usr/bin/env bun
/**
 * src/Core.TypeScript/ci/docker-windows-install-ps1-test.ts
 *
 * Slice 2c — TS wrapper for the Server-Core Docker test of tools/setup/install.ps1 (081KSKBP80008QG0R002J03WGA
 * Windows parity). Mirrors src/Core.TypeScript/ci/docker-nixos-install-sh-test.ts (per
 * .claude/rules/rule-0-no-sh-files.md: TS-over-bash). Wraps `docker build` of
 * src/Core.TypeScript/ci/dockerfiles/windows-install-ps1-test/Dockerfile with exit-code mapping, log capture
 * (CI artifact), and timeout enforcement.
 *
 * REQUIRES a Windows host with Docker in Windows-container mode (the windows-2025 GitHub runner).
 * Windows containers cannot run on Linux hosts.
 *
 * Usage:
 *   bun src/Core.TypeScript/ci/docker-windows-install-ps1-test.ts [--keep-image]
 *
 * Env:
 *   DOCKER_BUILD_TIMEOUT_SEC   override timeout (default 2400 — servercore pull + scoop + mise
 *                              install of .mise.toml runtimes is heavy on a cold runner)
 *   DOCKER_LOG_OUT_PATH        override log path (default .tools/docker-windows-install-ps1-test.log)
 *   GITHUB_TOKEN               (optional) GitHub API token forwarded to mise INSIDE the build as
 *                              MISE_GITHUB_TOKEN (--build-arg) so `mise install` authenticates
 *                              (5000 req/hr) instead of hitting the unauthenticated 60/hr -> 403.
 *                              See the Dockerfile's ARG MISE_GITHUB_TOKEN block for the full
 *                              rationale + leak mitigations (legacy Windows builder has no BuildKit
 *                              secret mounts, so --build-arg is the channel; the value is redacted
 *                              in the logged command below + the image is rmi'd in cleanup()).
 *                              DELIBERATELY OMITTED when --keep-image is set: a retained image's
 *                              `docker history` would carry the build-arg value, so a kept image must
 *                              never have the token baked in (mise then runs unauthenticated for that
 *                              run — a tolerable local-debug degradation). Unset -> mise stays
 *                              unauthenticated (identical to prior behavior).
 *
 * Exit codes: 0 build ok | 1 build failed | 2 usage/prereq | 124 timeout.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
function spawnDocker(args, opts = {}) {
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    return spawnSync("docker", args, {
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024, // docker build output is verbose
        timeout: opts.timeoutMs,
        stdio: ["ignore", "pipe", "pipe"],
    });
}
const DOCKERFILE_PATH = "src/Core.TypeScript/ci/dockerfiles/windows-install-ps1-test/Dockerfile";
const SMOKE_PATH = "src/Core.TypeScript/ci/windows-install-ps1-smoke.ts";
const IMAGE_TAG = "zeta-windows-install-ps1-test:local";
const DEFAULT_TIMEOUT_SEC = 2400;
const DEFAULT_LOG_PATH = ".tools/docker-windows-install-ps1-test.log";
function usage() {
    console.error("usage: bun src/Core.TypeScript/ci/docker-windows-install-ps1-test.ts [--keep-image]");
    console.error("");
    console.error("env:");
    console.error("  DOCKER_BUILD_TIMEOUT_SEC  override timeout (default 2400)");
    console.error("  DOCKER_LOG_OUT_PATH       override log path");
    console.error("  GITHUB_TOKEN              (optional) forwarded to mise as MISE_GITHUB_TOKEN (build-arg);");
    console.error("                           omitted when --keep-image is set (no token in a retained image)");
    process.exit(2);
}
function checkPrereqs() {
    const docker = spawnDocker(["--version"]);
    if (docker.status !== 0) {
        console.error("error: docker not installed or not on PATH");
        process.exit(2);
    }
    for (const p of [DOCKERFILE_PATH, ".mise.toml", SMOKE_PATH]) {
        if (!existsSync(p)) {
            console.error(`error: ${p} not found (run from repo root)`);
            process.exit(2);
        }
    }
}
function runBuild(timeoutSec, logPath, keepImage) {
    const startMs = Date.now();
    // NOTE: no --progress=plain — the windows-2025 runner uses the LEGACY docker builder (not
    // BuildKit/buildx), which rejects --progress. Output still streams to stdout/stderr (captured).
    //
    // mise GitHub-API token (rate-limit fix; sibling to the 4 Unix shields in #6273): forward the
    // ambient GITHUB_TOKEN into the build as MISE_GITHUB_TOKEN so `mise install` authenticates
    // (5000/hr) instead of hitting the unauthenticated 60/hr -> 403. The legacy Windows builder has
    // NO BuildKit `--mount=type=secret`, so --build-arg is the only build-time channel; the Dockerfile's
    // `ARG MISE_GITHUB_TOKEN` exposes it to the install RUN as an env var that mise inherits. See the
    // Dockerfile block for the full leak-mitigation reasoning (ephemeral token + image rmi'd in
    // cleanup() + the redaction below).
    //
    // --keep-image OMITS the token: cleanup() skips the `docker rmi -f` for a kept image, so its
    // `docker history` (where ARG values surface) would persist the token — bypassing the discard
    // mitigation. A retained image must therefore never carry it; mise runs unauthenticated for that
    // run (a tolerable local-debug degradation). Empty when unset -> unauthenticated (prior behavior).
    const ambientToken = process.env.GITHUB_TOKEN ?? "";
    const miseGithubToken = keepImage ? "" : ambientToken;
    if (keepImage && ambientToken !== "") {
        console.log("[Slice 2c] --keep-image set: OMITTING MISE_GITHUB_TOKEN so the retained image's history carries no token (mise runs unauthenticated for this run; GitHub rate-limit possible).");
    }
    const buildArgs = [
        "build",
        "--file",
        DOCKERFILE_PATH,
        "--build-arg",
        `MISE_GITHUB_TOKEN=${miseGithubToken}`,
        "--tag",
        IMAGE_TAG,
        ".",
    ];
    // REDACT the token value in the logged command — NEVER print the secret to CI logs. (GHA also
    // auto-masks GITHUB_TOKEN, but that's the backup; this explicit redaction is the primary defense.)
    const loggedArgs = buildArgs.map((a) => (a.startsWith("MISE_GITHUB_TOKEN=") ? "MISE_GITHUB_TOKEN=***" : a));
    console.log(`[Slice 2c] docker ${loggedArgs.join(" ")}`);
    console.log(`[Slice 2c] timeout: ${timeoutSec}s; log: ${logPath}`);
    const result = spawnDocker(buildArgs, { timeoutMs: timeoutSec * 1000 });
    const elapsedSec = Math.floor((Date.now() - startMs) / 1000);
    const stdout = (result.stdout ?? "").toString();
    const stderr = (result.stderr ?? "").toString();
    const fullLog = stdout + stderr;
    writeFileSync(logPath, fullLog, "utf8");
    const logTail = fullLog.split("\n").slice(-25).join("\n");
    const errCode = result.error?.code;
    if (result.signal === "SIGTERM" || errCode === "ETIMEDOUT") {
        return { exitCode: 124, reason: `docker build timed out after ${timeoutSec}s (actual: ${elapsedSec}s)`, logTail };
    }
    if (result.status === 0) {
        console.log(`[Slice 2c] SUCCESS — docker build completed in ${elapsedSec}s`);
        return { exitCode: 0, reason: `docker build succeeded in ${elapsedSec}s`, logTail };
    }
    return { exitCode: 1, reason: `docker build failed (exit ${result.status}) after ${elapsedSec}s`, logTail };
}
function cleanup(keepImage) {
    if (keepImage) {
        console.log(`[Slice 2c] --keep-image set; image ${IMAGE_TAG} retained`);
        return;
    }
    const rm = spawnDocker(["rmi", "-f", IMAGE_TAG]);
    if (rm.status === 0)
        console.log(`[Slice 2c] cleaned up image ${IMAGE_TAG}`);
    else
        console.error(`[Slice 2c] warning: docker rmi ${IMAGE_TAG} failed (non-fatal)`);
}
function main() {
    const args = process.argv.slice(2);
    let keepImage = false;
    for (const arg of args) {
        if (arg === "--keep-image")
            keepImage = true;
        else if (arg === "--help" || arg === "-h")
            usage();
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
    if (logDir && !existsSync(logDir))
        mkdirSync(logDir, { recursive: true });
    checkPrereqs();
    const result = runBuild(timeoutSec, logPath, keepImage);
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
