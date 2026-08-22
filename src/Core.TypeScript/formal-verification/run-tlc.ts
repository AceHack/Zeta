#!/usr/bin/env bun
// run-tlc.ts -- TS wrapper for TLA+/TLC model-checker invocation.
//
// Source-owned command-line sibling of the xUnit TLC gate
// (tests/Tests.FSharp/Formal/Tlc.Runner.Tests.fs). BOTH build their argv from
// registry/tlc-models.json via tlc-invocation.ts, so THE COMMAND YOU RUN BY HAND
// IS THE COMMAND CI RUNS. That is the whole point: on 2026-08-13 a spec was
// measured here with -deadlock (which DISABLES deadlock checking) and checked
// there without it, and a hand-run green and a gated green were not the same
// result. This file may not add a flag of its own.
//
// Usage:
//   bun src/Core.TypeScript/formal-verification/run-tlc.ts <ModelId>
//     Runs one pinned model. The id is the registry key, which for a spec with
//     a single config is the spec name and otherwise names the config.
//
//   bun src/Core.TypeScript/formal-verification/run-tlc.ts --all
//     Every gate-tier model, i.e. exactly what the PR lane runs.
//
//   bun src/Core.TypeScript/formal-verification/run-tlc.ts --extended
//     Adds the extended-tier models, which are declared with a written reason
//     and deliberately not in the PR lane.
//
//   bun src/Core.TypeScript/formal-verification/run-tlc.ts --list
//   bun src/Core.TypeScript/formal-verification/run-tlc.ts --invocation <ModelId>
//     Prints the pinned command line, for quoting NEXT TO a recorded result.
//   bun src/Core.TypeScript/formal-verification/run-tlc.ts --check-toolchain
//
// Exit codes (orthogonal -- each code has one semantic):
//   0  success
//   1  a model disagreed with its pin / unknown model
//   2  toolchain not ready (java / jar absent)
//   3  argument / usage error

import { readdirSync, statSync, unlinkSync } from "node:fs";
import { delimiter, join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  buildTlcArgv,
  invocationLine,
  judgeToolchainBanner,
  judgeTlcRun,
  loadTlcRegistry,
  tlcJvmArguments,
  type TlcModel,
  type TlcRegistry,
} from "./tlc-invocation";

type ExitCode = 0 | 1 | 2 | 3;

/** Max attempts per model when the JVM CRASHES (native OOM / fatal error), NOT
 *  when TLC produces a verdict. Under --all the accumulated memory pressure of
 *  the sequential suite can make a fresh JVM fail to reserve its heap at startup.
 *  A real disagreement with the pin is deterministic and is NEVER retried. */
const MAX_JVM_ATTEMPTS = 3;
const JVM_RETRY_SETTLE_MS = 1500;
const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;

export { tlcJvmArguments };

function isJvmFatalCrash(stdout: string, stderr: string): boolean {
  const blob = stdout + "\n" + stderr;
  return (
    /A fatal error has been detected by the Java Runtime Environment/i.test(blob) ||
    /There is insufficient memory for the Java Runtime Environment/i.test(blob) ||
    /Could not reserve enough space for .* object heap/i.test(blob) ||
    /hs_err_pid\d+/i.test(blob) ||
    /Native memory allocation \(\w+\) failed/i.test(blob)
  );
}

function sleepSync(ms: number): void {
  const shared = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(shared, 0, 0, ms);
}

/** Escape regex metacharacters so a model name cannot cause unintended file
 *  matches in trace cleanup (CodeQL #1412 P0). */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function repoRoot(): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  if (result.status !== 0) return process.cwd();
  return result.stdout.trim();
}

/** In-process PATH scan. No shell-out; matches the F# runner. */
function which(exe: string): string | null {
  const pathEnv = process.env["PATH"] ?? "";
  if (pathEnv === "") return null;
  const isWindows = process.platform === "win32";
  const extensions = isWindows ? [".exe", ".cmd", ".bat", ""] : [""];
  for (const dir of pathEnv.split(delimiter)) {
    if (dir === "") continue;
    for (const ext of extensions) {
      const candidate = join(dir, exe + ext);
      try {
        if (statSync(candidate).isFile()) return candidate;
      } catch {
        // not present -- try next
      }
    }
  }
  return null;
}

function fileExists(path: string): boolean {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}

interface Toolchain {
  readonly tlaJarPath: string;
  readonly specsPath: string;
  readonly javaPath: string;
  readonly registry: TlcRegistry;
}

function checkToolchain(root: string): Toolchain | null {
  const registry = loadTlcRegistry(root);
  const tlaJarPath = join(root, registry.toolchain.jar);
  const specsPath = join(root, "src", "Core.TLA", "specs");
  const javaPath = which("java");
  if (javaPath === null) return null;
  if (!fileExists(tlaJarPath)) return null;
  if (!fileExists(specsPath)) return null;
  return { tlaJarPath, specsPath, javaPath, registry };
}

function cleanupTraceFiles(specsPath: string, moduleName: string): void {
  let entries: readonly import("node:fs").Dirent[];
  try {
    entries = readdirSync(specsPath, { withFileTypes: true });
  } catch {
    return;
  }
  const safeName = escapeRegex(moduleName);
  const traceTla = new RegExp("^" + safeName + "_TTrace_.*\\.tla$");
  const traceBin = new RegExp("^" + safeName + "_TTrace_.*\\.bin$");
  const mcTla = /^MC.*\.tla$/;
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (traceTla.test(e.name) || traceBin.test(e.name) || mcTla.test(e.name)) {
      try {
        unlinkSync(join(specsPath, e.name));
      } catch {
        // best-effort cleanup
      }
    }
  }
}

interface TlcResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly ok: boolean;
  readonly reason: string;
}

function runTlc(toolchain: Toolchain, model: TlcModel): TlcResult {
  let stdout = "";
  let stderr = "";
  let status: number | null = -1;
  const metadir = join("/tmp", "tlc_run_" + model.id + "_" + String(process.pid));
  const argv = buildTlcArgv(toolchain.registry, model, toolchain.tlaJarPath, metadir);
  for (let attempt = 1; attempt <= MAX_JVM_ATTEMPTS; attempt++) {
    const result = spawnSync(toolchain.javaPath, [...argv], {
      cwd: toolchain.specsPath,
      encoding: "utf8",
      maxBuffer: SPAWN_MAX_BUFFER,
      timeout: 3_600_000,
    });
    cleanupTraceFiles(toolchain.specsPath, model.module);
    stdout = result.stdout ?? "";
    stderr = result.stderr ?? "";
    status = result.status;
    if (judgeTlcRun(model, status ?? -1, stdout).ok) break;
    // Only a JVM CRASH is a flake worth retrying. A model that disagrees with
    // its pin is deterministic and must surface on the first attempt.
    if (attempt < MAX_JVM_ATTEMPTS && isJvmFatalCrash(stdout, stderr)) {
      process.stderr.write(
        "WARN: " + model.id + " -- JVM fatal crash (not a TLC verdict) on attempt " +
        String(attempt) + "/" + String(MAX_JVM_ATTEMPTS) + "; settling and retrying\n",
      );
      sleepSync(JVM_RETRY_SETTLE_MS);
      continue;
    }
    break;
  }
  const banner = judgeToolchainBanner(toolchain.registry, stdout);
  if (!banner.ok) {
    return { exitCode: status ?? -1, stdout, stderr, ok: false, reason: banner.reason };
  }
  const judgement = judgeTlcRun(model, status ?? -1, stdout);
  return { exitCode: status ?? -1, stdout, stderr, ok: judgement.ok, reason: judgement.reason };
}

function describeModel(model: TlcModel): string {
  const verdict = model.expect === "valid" ? "expect clean" : "expect violation: " + String(model.expectDetail);
  return model.id.padEnd(34) + model.tier.padEnd(10) + verdict;
}

function runOne(toolchain: Toolchain, model: TlcModel): ExitCode {
  process.stdout.write("running TLC on " + model.id + " (" + model.module + " under " + model.config + ")...\n");
  const result = runTlc(toolchain, model);
  if (result.ok) {
    process.stdout.write("OK: " + model.id + " -- agrees with its pin\n");
    return 0;
  }
  process.stderr.write("FAIL: " + model.id + " -- " + result.reason + "\n");
  process.stderr.write("invocation: " + invocationLine(toolchain.registry, model) + "\n");
  process.stderr.write("--- stdout tail ---\n");
  process.stderr.write(result.stdout.split("\n").slice(-30).join("\n") + "\n");
  if (result.stderr !== "") {
    process.stderr.write("--- stderr ---\n");
    process.stderr.write(result.stderr);
  }
  return 1;
}

function runMany(toolchain: Toolchain, models: readonly TlcModel[]): ExitCode {
  if (models.length === 0) {
    process.stderr.write("ERROR: no models selected\n");
    return 1;
  }
  const passed: string[] = [];
  const failed: { id: string; reason: string }[] = [];
  for (const model of models) {
    process.stdout.write("running TLC on " + model.id + "...\n");
    const result = runTlc(toolchain, model);
    if (result.ok) {
      process.stdout.write("  OK: " + model.id + "\n");
      passed.push(model.id);
    } else {
      process.stderr.write("  FAIL: " + model.id + " -- " + result.reason + "\n");
      failed.push({ id: model.id, reason: result.reason });
    }
  }
  process.stdout.write("\nsummary: " + String(passed.length) + " agree with their pin, " + String(failed.length) + " do not (out of " + String(models.length) + ")\n");
  if (failed.length > 0) {
    process.stderr.write("\n--- disagreements ---\n");
    for (const f of failed) process.stderr.write(f.id + ": " + f.reason + "\n");
    return 1;
  }
  return 0;
}

function usage(): void {
  process.stdout.write("Usage:\n");
  process.stdout.write("  bun src/Core.TypeScript/formal-verification/run-tlc.ts <ModelId>\n");
  process.stdout.write("  bun src/Core.TypeScript/formal-verification/run-tlc.ts --all\n");
  process.stdout.write("  bun src/Core.TypeScript/formal-verification/run-tlc.ts --extended\n");
  process.stdout.write("  bun src/Core.TypeScript/formal-verification/run-tlc.ts --list\n");
  process.stdout.write("  bun src/Core.TypeScript/formal-verification/run-tlc.ts --invocation <ModelId>\n");
  process.stdout.write("  bun src/Core.TypeScript/formal-verification/run-tlc.ts --check-toolchain\n");
}

function main(argv: readonly string[]): ExitCode {
  const root = repoRoot();
  process.chdir(root);
  const first = argv[0] ?? "";

  if (argv.length === 0 || first === "--help" || first === "-h") {
    usage();
    return 0;
  }

  if (first === "--list") {
    const registry = loadTlcRegistry(root);
    for (const model of registry.models) process.stdout.write(describeModel(model) + "\n");
    return 0;
  }

  if (first === "--invocation") {
    const registry = loadTlcRegistry(root);
    const id = argv[1] ?? "";
    const model = registry.models.find((m) => m.id === id);
    if (model === undefined) {
      process.stderr.write("unknown model id: " + id + " (try --list)\n");
      return 3;
    }
    process.stdout.write(invocationLine(registry, model) + "\n");
    return 0;
  }

  const toolchain = checkToolchain(root);
  if (first === "--check-toolchain") {
    if (toolchain === null) {
      process.stderr.write("ERROR: TLC toolchain not ready (need java on PATH + the committed jar). Run tools/setup/install.sh\n");
      return 2;
    }
    process.stdout.write("OK: TLC toolchain ready\n");
    return 0;
  }
  if (toolchain === null) {
    process.stderr.write("ERROR: TLC toolchain not ready (need java on PATH + the committed jar). Run tools/setup/install.sh\n");
    return 2;
  }

  const models = toolchain.registry.models;
  if (first === "--all") {
    return runMany(toolchain, models.filter((m) => m.tier === "gate"));
  }
  if (first === "--extended") {
    return runMany(toolchain, models);
  }
  if (first.startsWith("--")) {
    process.stderr.write("unknown flag: " + first + "\n");
    usage();
    return 3;
  }
  const model = models.find((m) => m.id === first);
  if (model === undefined) {
    process.stderr.write("unknown model id: " + first + " (try --list)\n");
    return 1;
  }
  return runOne(toolchain, model);
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
