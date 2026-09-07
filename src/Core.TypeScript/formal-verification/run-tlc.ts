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

import { readFileSync, statSync } from "node:fs";
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

import {
  captureProcess, finishAttempt, identifyFile, inventory, jvmNeverStarted, prepareAttempt,
  runWithStartupRetry, sourceInputs, writeDiagnostic,
} from "./tlc-attempts";

type ExitCode = 0 | 1 | 2 | 3;

// Retry at most three explicit JVM startup failures; never a checker/fatal answer.
const JVM_RETRY_SETTLE_MS = 1500;
const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;

export { tlcJvmArguments };

function sleepSync(ms: number): void {
  const shared = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(shared, 0, 0, ms);
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
  readonly root: string;
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
  return { root, tlaJarPath, specsPath, javaPath, registry };
}

interface TlcResult {
  readonly exitCode: number;
  readonly signal: string | null;
  readonly processError: boolean;
  readonly stdout: string;
  readonly stderr: string;
  readonly ok: boolean;
  readonly reason: string;
}

function gitText(root: string, argv: readonly string[]): string {
  const result = spawnSync("git", [...argv], { cwd: root, encoding: "utf8", maxBuffer: SPAWN_MAX_BUFFER });
  if (result.status !== 0) throw new Error("git source identity refused: " + String(result.error ?? result.stderr));
  return result.stdout.trim();
}

function runAttempt(toolchain: Toolchain, model: TlcModel, attemptNumber: number): TlcResult {
  const started = new Date().toISOString();
  const prepared = prepareAttempt(join(toolchain.root, "TestResults", "tlc-diagnostics"), model.id, attemptNumber,
    toolchain.specsPath, () => sourceInputs(toolchain.root, toolchain.specsPath, [model.module + ".tla", model.config]));
  if (!prepared.ok) {
    process.stderr.write("TLC preparation retained at " + prepared.directory + "\n");
    return { exitCode: -1, signal: null, processError: true, stdout: "", stderr: "", ok: false, reason: prepared.error + "; diagnostics: " + prepared.directory };
  }
  const attempt = prepared.value;
  let stdout = "";
  let stderr = "";
  let stage = "source-identity";
  try {
    const argv = [...buildTlcArgv(toolchain.registry, model, toolchain.tlaJarPath, attempt.metadir, process.platform, process.arch, attempt.errorFile)];
    writeDiagnostic(attempt, "invocation.json", {
      Schema: 1, Stage: stage, Runner: "typescript", Model: model, Attempt: attemptNumber,
      StartedAtUtc: started, Java: toolchain.javaPath, Argv: argv, WorkingDirectory: attempt.workspace,
      TimeoutMilliseconds: 3_600_000, Inputs: attempt.inputs,
      SourceSnapshotMeaning: "working-tree input hashes; SourceCommit is checkout HEAD, not a clean-source assertion",
      SourceCommit: gitText(toolchain.root, ["rev-parse", "HEAD"]),
      RunnerRuntime: { Executable: identifyFile(process.execPath), Version: process.version, BunVersion: process.versions.bun ?? null },
      Jar: identifyFile(toolchain.tlaJarPath), Registry: identifyFile(join(toolchain.root, "registry/tlc-models.json")),
      RunnerSource: ["run-tlc.ts", "tlc-attempts.ts", "tlc-invocation.ts"].map((name) => identifyFile(join(import.meta.dir, name))),
    });
    // The attempt and invocation already exist if this identity subprocess fails.
    stage = "runtime-identity";
    const versionArgv = ["-XX:ErrorFile=" + join(attempt.directory, "version_hs_err_pid%p.log"), "-version"];
    writeDiagnostic(attempt, "runtime-invocation.json", { Stage: stage, Java: toolchain.javaPath, Argv: versionArgv, WorkingDirectory: attempt.workspace, TimeoutMilliseconds: 30000, KillSignal: "SIGKILL" });
    const versionOut = join(attempt.directory, "version-stdout.log");
    const versionErr = join(attempt.directory, "version-stderr.log");
    const version = captureProcess(toolchain.javaPath, versionArgv, attempt.workspace, versionOut, versionErr, 30000, "SIGKILL");
    writeDiagnostic(attempt, "runtime.json", {
      Stage: stage, Executable: identifyFile(toolchain.javaPath), Platform: process.platform, Architecture: process.arch,
      VersionArgv: versionArgv, ExitCode: version.status, Signal: version.signal,
      Error: version.error?.message ?? null, TimeoutMilliseconds: 30000,
      Stdout: identifyFile(versionOut), Stderr: identifyFile(versionErr),
    });
    if (version.status !== 0 || version.error !== undefined || version.signal !== null) throw new Error("runtime identity subprocess failed: " + String(version.error ?? version.signal ?? version.status));
    stage = "tlc-process";
    const result = captureProcess(toolchain.javaPath, argv, attempt.workspace, attempt.stdout, attempt.stderr, 3_600_000);
    // Raw streams are files, so spawn's buffered-output ceiling cannot truncate them.
    stdout = readFileSync(attempt.stdout, "utf8");
    stderr = readFileSync(attempt.stderr, "utf8");
    stage = "judgement";
    const exitCode = result.status ?? -1;
    const banner = judgeToolchainBanner(toolchain.registry, stdout);
    const judged = jvmNeverStarted(stdout, stderr)
      ? { ok: false, reason: "TLC DID NOT RUN: explicit JVM startup failure" }
      : !banner.ok ? banner : judgeTlcRun(model, exitCode, stdout);
    const ok = judged.ok && result.error === undefined && result.signal === null;
    const reason = ok ? "" : judged.reason || String(result.error ?? result.signal);
    writeDiagnostic(attempt, "completion.json", {
      Stage: "completed", FinishedAtUtc: new Date().toISOString(), ExitCode: result.status, Signal: result.signal,
      Error: result.error?.message ?? null, Expected: ok, Reason: reason,
      Stdout: identifyFile(attempt.stdout), Stderr: identifyFile(attempt.stderr),
      StateInventory: inventory(attempt.metadir), WorkspaceInventory: inventory(attempt.workspace),
      StateRetention: ok ? "delete this expected attempt only" : "retain complete attempt; no automatic size cap or purge",
    });
    finishAttempt(attempt, ok);
    if (!ok) process.stderr.write("TLC attempt retained at " + attempt.directory + "\n");
    return { exitCode, signal: result.signal, processError: result.error !== undefined, stdout, stderr, ok, reason: ok ? "" : reason + "; diagnostics: " + attempt.directory };
  } catch (error) {
    const detail = String(error);
    try { writeDiagnostic(attempt, "runner-failure.json", { Stage: stage, FinishedAtUtc: new Date().toISOString(), Error: detail }); }
    catch { /* The caller still names the unmodified attempt, including any partial logs. */ }
    process.stderr.write("TLC runner failure retained at " + attempt.directory + "\n");
    return { exitCode: -1, signal: null, processError: true, stdout, stderr, ok: false, reason: detail + "; diagnostics: " + attempt.directory };
  }
}

function runTlc(toolchain: Toolchain, model: TlcModel): TlcResult {
  const attempts = runWithStartupRetry(
    (number) => runAttempt(toolchain, model, number),
    (number) => {
      process.stderr.write("WARN: " + model.id + " -- explicit JVM startup failure on attempt " + String(number) + "/3; retained before retry\n");
      sleepSync(JVM_RETRY_SETTLE_MS);
    },
  );
  return attempts[attempts.length - 1]!;
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
