#!/usr/bin/env bun
// run-tlc.ts — TS wrapper for TLA+/TLC model-checker invocation.
//
// Phase 1 of 081KQNJ500008QG0R003EKJ8B5: replace `tests/Tests.FSharp/Formal/
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
//     Run TLC on every spec with a committed .cfg file under
//     tools/tla/specs/. Treats a missing paired .tla file as drift.
//     Per-failure stdout-tail printed for CI triage.
//
//   bun tools/formal-verification/run-tlc.ts --list
//     List every .cfg-backed spec that --all will run.
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
//     runs only when the workflow that invokes it does.
//   - No hand-maintained TLC catalogue: .cfg is the declaration that a
//     spec is runnable by TLC, so --all discovers cfg-backed specs.
//   - Trace-file cleanup matches the F# version's behavior:
//     <SpecName>_TTrace_*.tla, <SpecName>_TTrace_*.bin, MC*.tla
//   - working directory set to tools/tla/specs so TLC resolves
//     module names by file lookup
import { readdirSync, statSync, unlinkSync } from "node:fs";
import { delimiter, join } from "node:path";
import { spawnSync } from "node:child_process";
/** Max attempts per spec when the JVM CRASHES (native OOM / fatal error), NOT
 *  when TLC finds a real violation. Under `--all` the accumulated memory
 *  pressure of the sequential suite can make a fresh JVM fail to reserve its
 *  heap at startup (a flake: the spec passes when run alone). A real
 *  invariant/parse failure is deterministic and is NEVER retried. */
const MAX_JVM_ATTEMPTS = 3;
/** Settle delay between JVM-crash retries, so the prior process fully releases
 *  memory before the next attempt. Synchronous (the runner is sync). */
const JVM_RETRY_SETTLE_MS = 1500;
/** A JVM-level fatal crash (hs_err / native OOM / could-not-reserve-heap /
 *  SIGSEGV) — distinct from a TLC invariant violation (which TLC reports
 *  cleanly via stdout with a non-zero status). Only these are retried. */
function isJvmFatalCrash(stdout, stderr) {
    const blob = `${stdout}\n${stderr}`;
    return (/A fatal error has been detected by the Java Runtime Environment/i.test(blob) ||
        /There is insufficient memory for the Java Runtime Environment/i.test(blob) ||
        /Could not reserve enough space for .* object heap/i.test(blob) ||
        /hs_err_pid\d+/i.test(blob) ||
        /Native memory allocation \(\w+\) failed/i.test(blob));
}
/** Synchronous sleep (the runner is sync; avoids racing the next JVM start
 *  against the prior process's memory release). */
function sleepSync(ms) {
    const shared = new Int32Array(new SharedArrayBuffer(4));
    Atomics.wait(shared, 0, 0, ms);
}
/** Escape regex metacharacters so user-supplied spec names cannot
 *  cause unintended file matches in trace cleanup. Per #1412 P0
 *  CodeQL finding: a specName containing `.` or `*` would otherwise
 *  match unrelated files. */
function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;
function repoRoot() {
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
        encoding: "utf8",
        maxBuffer: SPAWN_MAX_BUFFER,
    });
    if (result.status !== 0)
        return process.cwd();
    return result.stdout.trim();
}
/** In-process PATH-scan equivalent of `which`. No shell-out (matches
 *  the F# Tlc.Runner.Tests.fs pattern; portable to Windows + minimal
 *  images that lack `/usr/bin/env which`). */
function which(exe) {
    const pathEnv = process.env["PATH"] ?? "";
    if (pathEnv === "")
        return null;
    const isWindows = process.platform === "win32";
    const extensions = isWindows ? [".exe", ".cmd", ".bat", ""] : [""];
    for (const dir of pathEnv.split(delimiter)) {
        if (dir === "")
            continue;
        for (const ext of extensions) {
            const candidate = join(dir, `${exe}${ext}`);
            try {
                const s = statSync(candidate);
                if (s.isFile())
                    return candidate;
            }
            catch {
                // not present — try next
            }
        }
    }
    return null;
}
function fileExists(path) {
    try {
        statSync(path);
        return true;
    }
    catch {
        return false;
    }
}
function checkToolchain(root) {
    const tlaJarPath = join(root, "src", "Core.TLA", "tla2tools.jar");
    const specsPath = join(root, "src", "Core.TLA", "specs");
    const javaPath = which("java");
    if (javaPath === null)
        return null;
    if (!fileExists(tlaJarPath))
        return null;
    if (!fileExists(specsPath))
        return null;
    return { tlaJarPath, specsPath, javaPath };
}
function cleanupTraceFiles(specsPath, specName) {
    let entries;
    try {
        entries = readdirSync(specsPath, { withFileTypes: true });
    }
    catch {
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
        if (!e.isFile())
            continue;
        if (traceTla.test(e.name) || traceBin.test(e.name) || mcTla.test(e.name)) {
            try {
                unlinkSync(join(specsPath, e.name));
            }
            catch {
                // best-effort cleanup; ignore failures
            }
        }
    }
}
function runTlc(toolchain, specName) {
    // Run from specsPath so TLC's file-resolution finds <SpecName>.tla
    // and <SpecName>.cfg without absolute-path arguments.
    //
    // Retry ONLY on a JVM fatal crash (native OOM at startup under the suite's
    // accumulated memory pressure) — never on a real TLC failure, which is
    // deterministic and must surface on the first attempt.
    let stdout = "";
    let stderr = "";
    let status = -1;
    for (let attempt = 1; attempt <= MAX_JVM_ATTEMPTS; attempt++) {
        const result = spawnSync(toolchain.javaPath, ["-cp", toolchain.tlaJarPath, "tlc2.TLC", specName], {
            cwd: toolchain.specsPath,
            encoding: "utf8",
            maxBuffer: SPAWN_MAX_BUFFER,
            timeout: 300_000, // 5 min hard cap per spec
        });
        cleanupTraceFiles(toolchain.specsPath, specName);
        stdout = result.stdout ?? "";
        stderr = result.stderr ?? "";
        status = result.status;
        // TLC exits 0 on success; non-zero on parse error / invariant
        // violation / deadlock-detection / etc. Cross-check against the
        // success marker in stdout for belt-and-suspenders.
        const ok = result.status === 0 &&
            stdout.includes("Model checking completed. No error has been found");
        if (ok)
            break;
        // Only a JVM CRASH (not a TLC violation) is a flake worth retrying.
        if (attempt < MAX_JVM_ATTEMPTS && isJvmFatalCrash(stdout, stderr)) {
            process.stderr.write(`WARN: ${specName} — JVM fatal crash (not a TLC violation) on attempt ${String(attempt)}/${String(MAX_JVM_ATTEMPTS)}; settling ${String(JVM_RETRY_SETTLE_MS)}ms and retrying\n`);
            sleepSync(JVM_RETRY_SETTLE_MS);
            continue;
        }
        break; // deterministic TLC failure, or out of retries — surface it
    }
    const success = status === 0 &&
        stdout.includes("Model checking completed. No error has been found");
    return {
        exitCode: status ?? -1,
        stdout,
        stderr,
        success,
    };
}
function specExists(toolchain, specName) {
    return (fileExists(join(toolchain.specsPath, `${specName}.tla`)) &&
        fileExists(join(toolchain.specsPath, `${specName}.cfg`)));
}
function configuredSpecNames(specsPath) {
    let entries;
    try {
        entries = readdirSync(specsPath, { withFileTypes: true });
    }
    catch {
        return [];
    }
    return entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".cfg"))
        .map((entry) => entry.name.slice(0, -".cfg".length))
        .sort((a, b) => a.localeCompare(b));
}
function runOne(toolchain, specName) {
    if (!specExists(toolchain, specName)) {
        process.stderr.write(`ERROR: ${specName}.tla or ${specName}.cfg not found in ${toolchain.specsPath}\n`);
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
function runAll(toolchain) {
    const specs = configuredSpecNames(toolchain.specsPath);
    const passed = [];
    const failed = [];
    const missing = [];
    const failureDetails = [];
    if (specs.length === 0) {
        process.stderr.write(`ERROR: no .cfg-backed TLC specs found in ${toolchain.specsPath}\n`);
        return 1;
    }
    for (const specName of specs) {
        if (!specExists(toolchain, specName)) {
            // A committed .cfg declares that TLC should be able to run this
            // spec. A missing paired .tla is drift, not an acceptable skip.
            process.stderr.write(`MISSING: ${specName} (has .cfg but no paired .tla in ${toolchain.specsPath})\n`);
            missing.push(specName);
            continue;
        }
        process.stdout.write(`running TLC on ${specName}...\n`);
        const result = runTlc(toolchain, specName);
        if (result.success) {
            process.stdout.write(`  OK: ${specName}\n`);
            passed.push(specName);
        }
        else {
            process.stderr.write(`  FAIL: ${specName} (exit ${String(result.exitCode)})\n`);
            failed.push(specName);
            failureDetails.push({ spec: specName, result });
        }
    }
    process.stdout.write("\n");
    process.stdout.write(`summary: ${String(passed.length)} passed, ${String(failed.length)} failed, ${String(missing.length)} missing-paired-tla (out of ${String(specs.length)} cfg-backed)\n`);
    // Per #1412 P2 finding: print a failure-tail per failed spec so
    // CI triage doesn't require re-running with --one. Cap at last
    // ~30 lines of stdout each to keep summary readable.
    if (failureDetails.length > 0) {
        process.stderr.write("\n--- failure details ---\n");
        for (const fd of failureDetails) {
            process.stderr.write(`\n[${fd.spec}] (rerun with: bun tools/formal-verification/run-tlc.ts ${fd.spec})\n`);
            const tail = fd.result.stdout.split("\n").slice(-30).join("\n");
            process.stderr.write(tail);
            if (!tail.endsWith("\n"))
                process.stderr.write("\n");
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
function main(argv) {
    const root = repoRoot();
    process.chdir(root);
    if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
        process.stdout.write("Usage:\n");
        process.stdout.write("  bun tools/formal-verification/run-tlc.ts <SpecName>\n");
        process.stdout.write("  bun tools/formal-verification/run-tlc.ts --all\n");
        process.stdout.write("  bun tools/formal-verification/run-tlc.ts --list\n");
        process.stdout.write("  bun tools/formal-verification/run-tlc.ts --check-toolchain\n");
        return 0;
    }
    if (argv[0] === "--list") {
        const specsPath = join(root, "src", "Core.TLA", "specs");
        for (const specName of configuredSpecNames(specsPath)) {
            process.stdout.write(`${specName}\n`);
        }
        return 0;
    }
    if (argv[0] === "--check-toolchain") {
        const tc = checkToolchain(root);
        if (tc === null) {
            process.stderr.write("ERROR: TLC toolchain not ready (need java on PATH + src/Core.TLA/tla2tools.jar). Run tools/setup/install.sh\n");
            return 2;
        }
        process.stdout.write("OK: TLC toolchain ready\n");
        return 0;
    }
    const toolchain = checkToolchain(root);
    if (toolchain === null) {
        process.stderr.write("ERROR: TLC toolchain not ready (need java on PATH + src/Core.TLA/tla2tools.jar). Run tools/setup/install.sh\n");
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
