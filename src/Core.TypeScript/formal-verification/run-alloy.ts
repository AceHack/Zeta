#!/usr/bin/env bun
// run-alloy.ts — TS wrapper for Alloy model-checker invocation.
//
// Phase 1 of B-0183 (sibling of run-tlc.ts): replace
// `tests/Tests.FSharp/Formal/Alloy.Runner.Tests.fs` with a direct
// shell wrapper. Same shape as run-tlc.ts.
//
// Usage:
//   bun tools/formal-verification/run-alloy.ts <SpecName>
//   bun tools/formal-verification/run-alloy.ts --all
//   bun tools/formal-verification/run-alloy.ts --check-toolchain
//
// AlloyRunner.java compiles to <runner-class-dir>/AlloyRunner.class
// on first use; idempotent (skips recompile if .class is newer than
// .java). Same compile-on-demand shape as the F# version.
//
// Output convention: AlloyRunner emits "OK"-prefixed lines for each
// command that proves; "FAIL " (with trailing space) for any
// counterexample or unsatisfiable run. Exit 0 only if the runner
// exits 0 AND no "FAIL " markers appear in stdout.

import { statSync, mkdirSync } from "node:fs";
import { delimiter, join } from "node:path";
import { spawnSync } from "node:child_process";

type ExitCode = 0 | 1 | 2 | 3;

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;

// Curated catalogue (matches F# Alloy.Runner.Tests.fs registration).
const CATALOGUE: readonly string[] = [
  "Spine",
  "InfoTheoreticSharder",
  "ThreeColoring",
];

function repoRoot(): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  if (result.status !== 0) return process.cwd();
  return result.stdout.trim();
}

/** In-process PATH-scan equivalent of `which`. No shell-out (matches
 *  the F# AlloyRunnerTests pattern; portable to Windows + minimal
 *  images that lack `/usr/bin/env which`). */
function which(exe: string): string | null {
  const pathEnv = process.env["PATH"] ?? "";
  if (pathEnv === "") return null;
  const isWindows = process.platform === "win32";
  const extensions = isWindows ? [".exe", ".cmd", ".bat", ""] : [""];
  for (const dir of pathEnv.split(delimiter)) {
    if (dir === "") continue;
    for (const ext of extensions) {
      const candidate = join(dir, `${exe}${ext}`);
      try {
        const s = statSync(candidate);
        if (s.isFile()) return candidate;
      } catch {
        // not present — try next
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
  readonly alloyJarPath: string;
  readonly alloyRunnerSource: string;
  readonly runnerClassDir: string;
  readonly runnerClassFile: string;
  readonly specsPath: string;
  readonly javaPath: string;
  readonly javacPath: string;
}

function checkToolchain(root: string): Toolchain | null {
  const alloyJarPath = join(root, "tools", "alloy", "alloy.jar");
  const alloyRunnerSource = join(root, "tools", "alloy", "AlloyRunner.java");
  const runnerClassDir = join(root, "tools", "alloy", "classes");
  const runnerClassFile = join(runnerClassDir, "AlloyRunner.class");
  const specsPath = join(root, "tools", "alloy", "specs");
  const javaPath = which("java");
  const javacPath = which("javac");
  if (javaPath === null || javacPath === null) return null;
  if (!fileExists(alloyJarPath)) return null;
  if (!fileExists(alloyRunnerSource)) return null;
  if (!fileExists(specsPath)) return null;
  return {
    alloyJarPath,
    alloyRunnerSource,
    runnerClassDir,
    runnerClassFile,
    specsPath,
    javaPath,
    javacPath,
  };
}

/** True iff the .class file exists and is newer than the .java source. */
function classIsFresh(toolchain: Toolchain): boolean {
  if (!fileExists(toolchain.runnerClassFile)) return false;
  try {
    const sourceMtime = statSync(toolchain.alloyRunnerSource).mtimeMs;
    const classMtime = statSync(toolchain.runnerClassFile).mtimeMs;
    return classMtime >= sourceMtime;
  } catch {
    return false;
  }
}

function compileRunnerIfNeeded(toolchain: Toolchain): boolean {
  if (classIsFresh(toolchain)) return true;
  try {
    mkdirSync(toolchain.runnerClassDir, { recursive: true });
  } catch {
    // best-effort
  }
  const result = spawnSync(
    toolchain.javacPath,
    [
      "-cp",
      toolchain.alloyJarPath,
      "-d",
      toolchain.runnerClassDir,
      toolchain.alloyRunnerSource,
    ],
    {
      encoding: "utf8",
      maxBuffer: SPAWN_MAX_BUFFER,
      timeout: 120_000,
    },
  );
  if (result.status !== 0) {
    process.stderr.write(
      `ERROR: javac failed compiling AlloyRunner.java (exit ${String(result.status)})\n`,
    );
    if (result.stderr) process.stderr.write(`${result.stderr}\n`);
    return false;
  }
  return classIsFresh(toolchain);
}

interface AlloyResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly success: boolean;
}

function runAlloy(toolchain: Toolchain, specName: string): AlloyResult {
  const specFile = join(toolchain.specsPath, `${specName}.als`);
  if (!fileExists(specFile)) {
    return {
      exitCode: -1,
      stdout: "",
      stderr: `Alloy spec not found: ${specFile}`,
      success: false,
    };
  }
  // Classpath separator differs across OSes. F# version handles
  // Windows here too; we match.
  const classpathSep = process.platform === "win32" ? ";" : ":";
  const cp = `${toolchain.alloyJarPath}${classpathSep}${toolchain.runnerClassDir}`;
  const result = spawnSync(
    toolchain.javaPath,
    ["-cp", cp, "AlloyRunner", specFile],
    {
      encoding: "utf8",
      maxBuffer: SPAWN_MAX_BUFFER,
      timeout: 60_000,
    },
  );
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  // AlloyRunner emits "OK ..." per command that proves; "FAIL " (with
  // trailing space) for any counterexample or unsat run. Match the
  // F# behavior: success iff exit 0 AND no "FAIL " in stdout.
  const success = result.status === 0 && !stdout.includes("FAIL ");
  return {
    exitCode: result.status ?? -1,
    stdout,
    stderr,
    success,
  };
}

function specExists(toolchain: Toolchain, specName: string): boolean {
  return fileExists(join(toolchain.specsPath, `${specName}.als`));
}

function runOne(toolchain: Toolchain, specName: string): ExitCode {
  if (!specExists(toolchain, specName)) {
    process.stderr.write(
      `ERROR: ${specName}.als not found in ${toolchain.specsPath}\n`,
    );
    return 1;
  }
  process.stdout.write(`running Alloy on ${specName}...\n`);
  const result = runAlloy(toolchain, specName);
  if (result.success) {
    process.stdout.write(`OK: ${specName} — all commands proved cleanly\n`);
    return 0;
  }
  process.stderr.write(`FAIL: ${specName} (exit ${String(result.exitCode)})\n`);
  process.stderr.write("--- stdout ---\n");
  process.stderr.write(result.stdout);
  if (result.stderr !== "") {
    process.stderr.write("--- stderr ---\n");
    process.stderr.write(result.stderr);
  }
  return 1;
}

function runAll(toolchain: Toolchain): ExitCode {
  const passed: string[] = [];
  const failed: string[] = [];
  const missing: string[] = [];
  const failureDetails: { spec: string; result: AlloyResult }[] = [];
  for (const specName of CATALOGUE) {
    if (!specExists(toolchain, specName)) {
      // Missing-from-catalogue is catalogue drift (rename / delete),
      // NOT acceptable skip. Treat as failure to gate against drift.
      process.stderr.write(
        `MISSING: ${specName} (no .als in ${toolchain.specsPath})\n`,
      );
      missing.push(specName);
      continue;
    }
    process.stdout.write(`running Alloy on ${specName}...\n`);
    const result = runAlloy(toolchain, specName);
    if (result.success) {
      process.stdout.write(`  OK: ${specName}\n`);
      passed.push(specName);
    } else {
      process.stderr.write(
        `  FAIL: ${specName} (exit ${String(result.exitCode)})\n`,
      );
      failed.push(specName);
      failureDetails.push({ spec: specName, result });
    }
  }
  process.stdout.write("\n");
  process.stdout.write(
    `summary: ${String(passed.length)} passed, ${String(failed.length)} failed, ${String(missing.length)} missing-from-catalogue (out of ${String(CATALOGUE.length)} catalogued)\n`,
  );
  if (failureDetails.length > 0) {
    process.stderr.write("\n--- failure details ---\n");
    for (const fd of failureDetails) {
      process.stderr.write(
        `\n[${fd.spec}] (rerun with: bun tools/formal-verification/run-alloy.ts ${fd.spec})\n`,
      );
      const tail = fd.result.stdout.split("\n").slice(-30).join("\n");
      process.stderr.write(tail);
      if (!tail.endsWith("\n")) process.stderr.write("\n");
      if (fd.result.stderr !== "") {
        process.stderr.write("--- stderr ---\n");
        const errTail = fd.result.stderr.split("\n").slice(-15).join("\n");
        process.stderr.write(errTail);
        if (!errTail.endsWith("\n")) process.stderr.write("\n");
      }
    }
  }
  if (failed.length > 0 || missing.length > 0) {
    if (failed.length > 0) {
      process.stderr.write(`\nfailed: ${failed.join(", ")}\n`);
    }
    if (missing.length > 0) {
      process.stderr.write(`missing: ${missing.join(", ")}\n`);
    }
    return 1;
  }
  return 0;
}

function main(argv: readonly string[]): ExitCode {
  const root = repoRoot();
  process.chdir(root);

  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    process.stdout.write("Usage:\n");
    process.stdout.write("  bun tools/formal-verification/run-alloy.ts <SpecName>\n");
    process.stdout.write("  bun tools/formal-verification/run-alloy.ts --all\n");
    process.stdout.write("  bun tools/formal-verification/run-alloy.ts --check-toolchain\n");
    return 0;
  }

  if (argv[0] === "--check-toolchain") {
    const tc = checkToolchain(root);
    if (tc === null) {
      process.stderr.write(
        "ERROR: Alloy toolchain not ready (need java + javac on PATH + tools/alloy/alloy.jar + tools/alloy/AlloyRunner.java). Run tools/setup/install.sh\n",
      );
      return 2;
    }
    if (!compileRunnerIfNeeded(tc)) {
      process.stderr.write("ERROR: AlloyRunner.java failed to compile\n");
      return 2;
    }
    process.stdout.write("OK: Alloy toolchain ready\n");
    return 0;
  }

  const toolchain = checkToolchain(root);
  if (toolchain === null) {
    process.stderr.write(
      "ERROR: Alloy toolchain not ready (need java + javac on PATH + tools/alloy/alloy.jar + tools/alloy/AlloyRunner.java). Run tools/setup/install.sh\n",
    );
    return 2;
  }
  if (!compileRunnerIfNeeded(toolchain)) {
    process.stderr.write("ERROR: AlloyRunner.java failed to compile\n");
    return 2;
  }

  if (argv[0] === "--all") {
    return runAll(toolchain);
  }

  const specName = argv[0] ?? "";
  if (specName.startsWith("--")) {
    // Exit 3 for argument/usage error; distinguishable from
    // exit 2 (toolchain not ready). Same orthogonal-exit-code
    // contract as run-tlc.ts.
    process.stderr.write(`unknown flag: ${specName}\n`);
    process.stderr.write("use --help\n");
    return 3;
  }
  return runOne(toolchain, specName);
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
