#!/usr/bin/env bun
// run-tlaps.ts — TS wrapper for TLAPS (the TLA+ Proof System) invocation.
//
// Rung 3 of the societal-emergence ladder
// (docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md §B-converge): where TLC
// (run-tlc.ts) model-checks the NCI safety invariant on a BOUNDED model
// (3 travelers, 3-element belief domain), TLAPS discharges it UNBOUNDED —
// an inductive-invariant proof that holds for ANY finite Travelers /
// BeliefDomain, machine-checked obligation-by-obligation by the backend
// provers (Zenon / Isabelle / SMT=Z3).
//
// Sibling of run-tlc.ts; same exit-code contract, same catalogue-drift
// discipline. The difference: tlapm PROVES (∀), tlc CHECKS (bounded ∃-search).
//
// Usage:
//   bun src/Core.TypeScript/formal-verification/run-tlaps.ts <SpecName>
//     Prove all obligations in tools/tla/specs/<SpecName>.tla.
//
//   bun src/Core.TypeScript/formal-verification/run-tlaps.ts --all
//     Prove every spec in the curated PROOF catalogue (specs that carry
//     THEOREM ... PROOF blocks). Missing-from-catalogue ⇒ failure (drift).
//
//   bun src/Core.TypeScript/formal-verification/run-tlaps.ts --check-toolchain
//     Verify tlapm is reachable (for CI gating + dev-local diagnostics).
//
// Exit codes (orthogonal — each code has one semantic):
//   0  success — all obligations proved
//   1  tlapm error / unproved obligation / missing spec
//   2  toolchain not ready (tlapm absent)
//   3  argument / usage error (unknown flag, missing argument)
//
// Design notes:
//   - tlapm is installed into a dedicated opam switch (`tlaps-build`) by
//     the cross-OS source build (no arm64 upstream binary exists). We
//     resolve the binary directly from the switch bin/ first, then fall
//     back to PATH, then to `opam exec`. This keeps the common path
//     shell-out-free (matches run-tlc.ts's in-process `which`).
//   - working directory set to tools/tla/specs so tlapm resolves module
//     names (and the .tlaps fingerprint dir) beside the spec.
//   - Z3 (SMT backend) must be on PATH for the SMT obligations; the apt/
//     brew manifests pin it (081KT2T2J0008QG0R001X9PWKR).

import { existsSync, statSync } from "node:fs";
import { delimiter, join } from "node:path";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";

type ExitCode = 0 | 1 | 2 | 3;

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;
const TLAPS_SWITCH = "tlaps-build";

// Curated catalogue of specs carrying machine-checked TLAPS proofs.
// Keep in sync as rungs land. Distinct from run-tlc.ts's CATALOGUE:
// that lists model-checked specs; this lists PROVEN ones.
const CATALOGUE: readonly string[] = ["NciSafetyProofs", "NciNonUrgencyProofs"];

function repoRoot(): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  if (result.status !== 0) return process.cwd();
  return result.stdout.trim();
}

/** In-process PATH-scan equivalent of `which` (no shell-out; matches
 *  run-tlc.ts). */
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
        if (statSync(candidate).isFile()) return candidate;
      } catch {
        // not present — try next
      }
    }
  }
  return null;
}

interface Toolchain {
  /** argv[0] to spawn. */
  readonly cmd: string;
  /** leading args before the spec name (e.g. `opam exec` wrapping). */
  readonly preArgs: readonly string[];
  readonly specsPath: string;
}

/** Does this candidate actually RUN? `existsSync` and `which` answer "a file
 *  is there"; the `opam exec` fallback answered nothing at all — it was
 *  returned whenever `opam` itself was on PATH, so the check reported
 *  "OK: TLAPS toolchain ready" on a machine with no tlapm and the lane then
 *  died at exit 127 one step later (run 28619870340, 2026-07-02). A check that
 *  cannot fail is not a check: probe the binary. */
function toolchainRuns(cmd: string, preArgs: readonly string[]): boolean {
  const probe = spawnSync(cmd, [...preArgs, "--version"], {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
    timeout: 60_000,
  });
  return probe.status === 0;
}

/** Resolve tlapm: opam switch bin/ first (the cross-OS source build's
 *  install location), then PATH, then `opam exec` as a last resort. Every
 *  candidate is probed before it is returned. */
function checkToolchain(root: string): Toolchain | null {
  const specsPath = join(root, "src", "Core.TLA", "specs");
  if (!existsSync(specsPath)) return null;

  const switchBin = join(homedir(), ".opam", TLAPS_SWITCH, "bin", "tlapm");
  const candidates: readonly { readonly cmd: string; readonly preArgs: readonly string[] }[] = [
    ...(existsSync(switchBin) ? [{ cmd: switchBin, preArgs: [] as readonly string[] }] : []),
    ...(which("tlapm") !== null ? [{ cmd: which("tlapm") ?? "tlapm", preArgs: [] as readonly string[] }] : []),
    ...(which("opam") !== null
      ? [
          {
            cmd: which("opam") ?? "opam",
            preArgs: ["exec", `--switch=${TLAPS_SWITCH}`, "--", "tlapm"] as readonly string[],
          },
        ]
      : []),
  ];

  for (const candidate of candidates) {
    if (toolchainRuns(candidate.cmd, candidate.preArgs)) {
      return { cmd: candidate.cmd, preArgs: candidate.preArgs, specsPath };
    }
  }
  return null;
}

function specExists(toolchain: Toolchain, specName: string): boolean {
  return existsSync(join(toolchain.specsPath, `${specName}.tla`));
}

interface TlapmResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly success: boolean;
}

function runTlapm(toolchain: Toolchain, specName: string): TlapmResult {
  const result = spawnSync(
    toolchain.cmd,
    [...toolchain.preArgs, `${specName}.tla`],
    {
      cwd: toolchain.specsPath,
      encoding: "utf8",
      maxBuffer: SPAWN_MAX_BUFFER,
      timeout: 600_000, // 10 min hard cap per spec (proof search > model check)
    },
  );
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const combined = `${stdout}\n${stderr}`;
  // tlapm exits 0 when every obligation is proved. Belt-and-suspenders:
  // require exit 0 AND absence of an unproved/failed-obligation marker.
  const hasFailureMarker =
    /obligation.*failed/i.test(combined) ||
    /\bunproved\b/i.test(combined) ||
    /could not be proved/i.test(combined);
  const success = result.status === 0 && !hasFailureMarker;
  return { exitCode: result.status ?? -1, stdout, stderr, success };
}

function runOne(toolchain: Toolchain, specName: string): ExitCode {
  if (!specExists(toolchain, specName)) {
    process.stderr.write(
      `ERROR: ${specName}.tla not found in ${toolchain.specsPath}\n`,
    );
    return 1;
  }
  process.stdout.write(`proving ${specName} with tlapm...\n`);
  const result = runTlapm(toolchain, specName);
  if (result.success) {
    process.stdout.write(`OK: ${specName} — all obligations proved\n`);
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
  const failureDetails: { spec: string; result: TlapmResult }[] = [];
  for (const specName of CATALOGUE) {
    if (!specExists(toolchain, specName)) {
      process.stderr.write(
        `MISSING: ${specName} (no .tla in ${toolchain.specsPath})\n`,
      );
      missing.push(specName);
      continue;
    }
    process.stdout.write(`proving ${specName} with tlapm...\n`);
    const result = runTlapm(toolchain, specName);
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
    `summary: ${String(passed.length)} proved, ${String(failed.length)} failed, ${String(missing.length)} missing-from-catalogue (out of ${String(CATALOGUE.length)} catalogued)\n`,
  );
  if (failureDetails.length > 0) {
    process.stderr.write("\n--- failure details ---\n");
    for (const fd of failureDetails) {
      process.stderr.write(
        `\n[${fd.spec}] (rerun with: bun src/Core.TypeScript/formal-verification/run-tlaps.ts ${fd.spec})\n`,
      );
      const tail = fd.result.stdout.split("\n").slice(-30).join("\n");
      process.stderr.write(tail);
      if (!tail.endsWith("\n")) process.stderr.write("\n");
    }
  }
  if (failed.length > 0 || missing.length > 0) {
    if (failed.length > 0) process.stderr.write(`\nfailed: ${failed.join(", ")}\n`);
    if (missing.length > 0) process.stderr.write(`missing: ${missing.join(", ")}\n`);
    return 1;
  }
  return 0;
}

function main(argv: readonly string[]): ExitCode {
  const root = repoRoot();
  process.chdir(root);

  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    process.stdout.write("Usage:\n");
    process.stdout.write("  bun src/Core.TypeScript/formal-verification/run-tlaps.ts <SpecName>\n");
    process.stdout.write("  bun src/Core.TypeScript/formal-verification/run-tlaps.ts --all\n");
    process.stdout.write("  bun src/Core.TypeScript/formal-verification/run-tlaps.ts --check-toolchain\n");
    return 0;
  }

  if (argv[0] === "--check-toolchain") {
    const tc = checkToolchain(root);
    if (tc === null) {
      process.stderr.write(
        "ERROR: TLAPS toolchain not ready (need tlapm in ~/.opam/tlaps-build/bin, on PATH, or via opam). Run the TLAPS install.\n",
      );
      return 2;
    }
    process.stdout.write("OK: TLAPS toolchain ready\n");
    return 0;
  }

  const toolchain = checkToolchain(root);
  if (toolchain === null) {
    process.stderr.write(
      "ERROR: TLAPS toolchain not ready (need tlapm in ~/.opam/tlaps-build/bin, on PATH, or via opam). Run the TLAPS install.\n",
    );
    return 2;
  }

  if (argv[0] === "--all") return runAll(toolchain);

  const specName = argv[0] ?? "";
  if (specName.startsWith("--")) {
    process.stderr.write(`unknown flag: ${specName}\n`);
    process.stderr.write("use --help\n");
    return 3;
  }
  return runOne(toolchain, specName);
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
