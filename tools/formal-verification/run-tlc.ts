#!/usr/bin/env bun
// run-tlc.ts — TS wrapper for TLA+/TLC model-checker invocation.
//
// Phase 1 of B-0183: replace `tests/Tests.FSharp/Formal/
// Tlc.Runner.Tests.fs` with a direct shell wrapper. The F# version
// was an xunit-test wrapper around shelling out to TLC; no F#
// operator-algebra logic was involved. This TS file is the natural
// shape: detect toolchain, shell to TLC, parse output, exit
// accordingly.
//
// Usage:
//   bun tools/formal-verification/run-tlc.ts <SpecName>
//     Runs TLC on tools/tla/specs/<SpecName>.tla with the matching
//     .cfg.
//
//   bun tools/formal-verification/run-tlc.ts --all
//     Run TLC on every spec the curated catalogue lists. Treats
//     missing-from-catalogue specs as failures (catalogue drift).
//     Per-failure stdout-tail printed for CI triage.
//
//   bun tools/formal-verification/run-tlc.ts --check-toolchain
//     Useful for CI gating + dev-local diagnostics.
//
// Exit codes (orthogonal — each code has one semantic):
//   0  success
//   1  TLC error / invariant violation / missing spec
//   2  toolchain not ready (java / jar absent)
//   3  argument / usage error (unknown flag, missing argument)
//
// Design notes:
//   - No xunit dependency
//   - No CI=true / OS / arch / workflow filtering needed: this script
//     runs only when the workflow that invokes it does (B-0183
//     Phase 2 wiring will land a Linux-only workflow that calls this)
//   - Trace-file cleanup matches the F# version's behavior:
//     <SpecName>_TTrace_*.tla, <SpecName>_TTrace_*.bin, MC*.tla
//   - working directory set to tools/tla/specs so TLC resolves
//     module names by file lookup

import { readdirSync, statSync, unlinkSync } from "node:fs";
import { delimiter, join } from "node:path";
import { spawnSync } from "node:child_process";

/** Exit codes (header doc contract):
 *    0  success
 *    1  TLC error / invariant violation / missing spec
 *    2  toolchain not ready (java / jar absent)
 *    3  argument / usage error (unknown flag, etc.)
 */

type ExitCode = 0 | 1 | 2 | 3;

/** Escape regex metacharacters so user-supplied spec names cannot
 *  cause unintended file matches in trace cleanup. Per #1412 P0
 *  CodeQL finding: a specName containing `.` or `*` would otherwise
 *  match unrelated files. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;

// Curated spec catalogue (matches F# Tlc.Runner.Tests.fs registration).
// Keep in sync with `[<Fact>]` entries in
// `tests/Tests.FSharp/Formal/Tlc.Runner.Tests.fs` until the F#
// retirement (B-0183 Phase 3).
const CATALOGUE: readonly string[] = [
  "SmokeCheck",
  "TickMonotonicity",
  "OperatorLifecycleRace",
  "TransactionInterleaving",
  "TwoPCSink",
  "InfoTheoreticSharder",
  "RecursiveCountingLFP",
  "FeatureFlagsResolution",
  "DbspSpec",
  "CircuitRegistration",
  "SpineAsyncProtocol",
  "NciSafety",
  "NciLiveness",
  "NciNonUrgency",
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
 *  the F# Tlc.Runner.Tests.fs pattern; portable to Windows + minimal
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
  readonly tlaJarPath: string;
  readonly specsPath: string;
  readonly javaPath: string;
}

function checkToolchain(root: string): Toolchain | null {
  const tlaJarPath = join(root, "tools", "tla", "tla2tools.jar");
  const specsPath = join(root, "tools", "tla", "specs");
  const javaPath = which("java");
  if (javaPath === null) return null;
  if (!fileExists(tlaJarPath)) return null;
  if (!fileExists(specsPath)) return null;
  return { tlaJarPath, specsPath, javaPath };
}

function cleanupTraceFiles(specsPath: string, specName: string): void {
  let entries: readonly import("node:fs").Dirent[];
  try {
    entries = readdirSync(specsPath, { withFileTypes: true });
  } catch {
    return;
  }
  // Escape regex meta-characters in specName before embedding.
  // Without this, a specName like "X.Y" or "X*Y" would match
  // unrelated files and delete them. Per CodeQL #1412 P0 finding.
  const safeName = escapeRegex(specName);
  const traceTla = new RegExp(`^${safeName}_TTrace_.*\\.tla$`);
  const traceBin = new RegExp(`^${safeName}_TTrace_.*\\.bin$`);
  const mcTla = /^MC.*\.tla$/;
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (traceTla.test(e.name) || traceBin.test(e.name) || mcTla.test(e.name)) {
      try {
        unlinkSync(join(specsPath, e.name));
      } catch {
        // best-effort cleanup; ignore failures
      }
    }
  }
}

interface TlcResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly success: boolean;
}

function runTlc(toolchain: Toolchain, specName: string): TlcResult {
  // Run from specsPath so TLC's file-resolution finds <SpecName>.tla
  // and <SpecName>.cfg without absolute-path arguments.
  const result = spawnSync(
    toolchain.javaPath,
    ["-cp", toolchain.tlaJarPath, "tlc2.TLC", specName],
    {
      cwd: toolchain.specsPath,
      encoding: "utf8",
      maxBuffer: SPAWN_MAX_BUFFER,
      timeout: 300_000, // 5 min hard cap per spec
    },
  );
  cleanupTraceFiles(toolchain.specsPath, specName);
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  // TLC exits 0 on success; non-zero on parse error / invariant
  // violation / deadlock-detection / etc. Cross-check against the
  // success marker in stdout for belt-and-suspenders.
  const success =
    result.status === 0 &&
    stdout.includes("Model checking completed. No error has been found");
  return {
    exitCode: result.status ?? -1,
    stdout,
    stderr,
    success,
  };
}

function specExists(toolchain: Toolchain, specName: string): boolean {
  return (
    fileExists(join(toolchain.specsPath, `${specName}.tla`)) &&
    fileExists(join(toolchain.specsPath, `${specName}.cfg`))
  );
}

function runOne(toolchain: Toolchain, specName: string): ExitCode {
  if (!specExists(toolchain, specName)) {
    process.stderr.write(
      `ERROR: ${specName}.tla or ${specName}.cfg not found in ${toolchain.specsPath}\n`,
    );
    return 1;
  }
  process.stdout.write(`running TLC on ${specName}...\n`);
  const result = runTlc(toolchain, specName);
  if (result.success) {
    process.stdout.write(`OK: ${specName} — model checking completed cleanly\n`);
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
  const failureDetails: { spec: string; result: TlcResult }[] = [];
  for (const specName of CATALOGUE) {
    if (!specExists(toolchain, specName)) {
      // Per #1412 P1 finding: a missing catalogued spec is
      // catalogue drift (renamed / deleted), NOT an acceptable
      // skip. Treat it as a failure so --all gates against drift.
      process.stderr.write(
        `MISSING: ${specName} (no .tla or .cfg in ${toolchain.specsPath})\n`,
      );
      missing.push(specName);
      continue;
    }
    process.stdout.write(`running TLC on ${specName}...\n`);
    const result = runTlc(toolchain, specName);
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
  // Per #1412 P2 finding: print a failure-tail per failed spec so
  // CI triage doesn't require re-running with --one. Cap at last
  // ~30 lines of stdout each to keep summary readable.
  if (failureDetails.length > 0) {
    process.stderr.write("\n--- failure details ---\n");
    for (const fd of failureDetails) {
      process.stderr.write(`\n[${fd.spec}] (rerun with: bun tools/formal-verification/run-tlc.ts ${fd.spec})\n`);
      const tail = fd.result.stdout.split("\n").slice(-30).join("\n");
      process.stderr.write(tail);
      if (!tail.endsWith("\n")) process.stderr.write("\n");
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
    process.stdout.write("  bun tools/formal-verification/run-tlc.ts <SpecName>\n");
    process.stdout.write("  bun tools/formal-verification/run-tlc.ts --all\n");
    process.stdout.write("  bun tools/formal-verification/run-tlc.ts --check-toolchain\n");
    return 0;
  }

  if (argv[0] === "--check-toolchain") {
    const tc = checkToolchain(root);
    if (tc === null) {
      process.stderr.write(
        "ERROR: TLC toolchain not ready (need java on PATH + tools/tla/tla2tools.jar). Run tools/setup/install.sh\n",
      );
      return 2;
    }
    process.stdout.write("OK: TLC toolchain ready\n");
    return 0;
  }

  const toolchain = checkToolchain(root);
  if (toolchain === null) {
    process.stderr.write(
      "ERROR: TLC toolchain not ready (need java on PATH + tools/tla/tla2tools.jar). Run tools/setup/install.sh\n",
    );
    return 2;
  }

  if (argv[0] === "--all") {
    return runAll(toolchain);
  }

  const specName = argv[0] ?? "";
  if (specName.startsWith("--")) {
    // Per #1412 P0 finding: distinguish argument errors from
    // toolchain-not-ready errors. Exit 3 = usage error so callers
    // (CI, dev) can tell them apart.
    process.stderr.write(`unknown flag: ${specName}\n`);
    process.stderr.write("use --help\n");
    return 3;
  }
  return runOne(toolchain, specName);
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
