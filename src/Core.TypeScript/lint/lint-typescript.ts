#!/usr/bin/env bun
// lint-typescript.ts — TypeScript type checking, formatting, and linting checks.
//
// Post-install orchestration of TypeScript tools (tsc, eslint, prettier, stylelint)
// — it runs in CI where Bun is already available, so it is OUR CODE, not shell.
//
// Usage:
//   bun src/Core.TypeScript/lint/lint-typescript.ts

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { classifyExit, describeDisposition, type ExitDisposition } from "../hygiene/signal-death.ts";

const here = dirname(fileURLToPath(import.meta.url));
// 3 levels up from src/Core.TypeScript/lint/ to repo root.
const REPO_ROOT = resolve(here, "..", "..", "..");

// ── 081KZKWB1FZ: unprovisioned-environment guard ─────────────────────────────
// `tsc` cannot tell "this module is not declared" (a real error) from "this module
// is declared but was never installed here" (an unprovisioned checkout). Both come
// out as TS2307, and the second kind reads exactly like a finding — which is how a
// phantom `Cannot find module 'playwright'` convinced TWO independent reviewers
// that lint was red on main while CI was green on the same commit.
//
// So: reclassify ONLY the declared-but-not-installed ones. A TS2307 for a module
// that is genuinely absent from package.json stays a real error and is still
// reported — this guard must never be able to hide one.

/** `@scope/pkg/sub` -> `@scope/pkg`; `pkg/sub` -> `pkg`. */
export function packageBaseName(specifier: string): string {
  const parts = specifier.split("/");
  if (specifier.startsWith("@")) return parts.slice(0, 2).join("/");
  return parts[0] ?? specifier;
}

/** Every dependency name declared in the root package.json, any section. */
function declaredDependencies(repoRoot: string): ReadonlySet<string> {
  try {
    const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as Record<string, unknown>;
    const names = new Set<string>();
    for (const section of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
      const block = pkg[section];
      if (block && typeof block === "object") {
        for (const name of Object.keys(block as Record<string, unknown>)) names.add(name);
      }
    }
    return names;
  } catch {
    return new Set<string>();
  }
}

/** Module names in TS2307 diagnostics that are DECLARED but not installed. */
export function missingInstalledDeps(
  tscOutput: string,
  declared: ReadonlySet<string>,
  isInstalled: (name: string) => boolean,
): readonly string[] {
  const found = new Set<string>();
  const re = /error TS2307: Cannot find module '([^']+)'/g;
  for (const match of tscOutput.matchAll(re)) {
    const base = packageBaseName(match[1] ?? "");
    // Relative/absolute imports are never a provisioning problem.
    if (!base || base.startsWith(".") || base.startsWith("/")) continue;
    if (declared.has(base) && !isInstalled(base)) found.add(base);
  }
  return [...found].sort();
}

function reportUnprovisionedEnvironment(tscOutput: string): boolean {
  const declared = declaredDependencies(REPO_ROOT);
  const missing = missingInstalledDeps(tscOutput, declared, (name) =>
    existsSync(join(REPO_ROOT, "node_modules", name)),
  );
  if (missing.length === 0) return false;

  console.error("");
  console.error("╔══════════════════════════════════════════════════════════════════════════╗");
  console.error("║  THESE ARE NOT TYPE ERRORS — your environment is unprovisioned.          ║");
  console.error("╚══════════════════════════════════════════════════════════════════════════╝");
  console.error("");
  console.error("  Declared in package.json but absent from node_modules:");
  for (const name of missing) console.error(`    - ${name}`);
  console.error("");
  console.error("  Fix:  bun install        (or re-run tools/setup/install.sh)");
  console.error("");
  console.error("  CI installs devDependencies as its own step, so these TS2307s do NOT");
  console.error("  reproduce there. Do not report them as findings — see 081KZKWB1FZ.");
  console.error("");
  return true;
}

interface Step {
  readonly label: string;
  readonly cmd: readonly [string, ...string[]];
}

// Execute TypeScript under Node. Bun 1.3.14 can crash during teardown after a
// successful large-repository traversal, turning a clean check into SIGTRAP.
export const TYPESCRIPT_COMPILER_COMMAND: readonly [string, ...string[]] = [
  "node",
  "node_modules/typescript/bin/tsc",
  "--noEmit",
  "--pretty",
  "false",
  "-p",
  "tsconfig.json",
];

const STEPS: readonly Step[] = [{ label: "TypeScript type check: tsc", cmd: TYPESCRIPT_COMPILER_COMMAND }];

function run(step: Step): boolean {
  console.log(`=== ${step.label} ===`);
  const [bin, ...args] = step.cmd;
  let crashedOnFirstAttempt: ExitDisposition | null = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const result = spawnSync(bin, args, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    process.stdout.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");

    const disposition = classifyExit(result);

    if (disposition.kind === "never-started") {
      console.error(`✗ ${step.label}: failed to start — ${disposition.message}`);
      return false;
    }
    if (disposition.kind === "completed") {
      // A RETRY BOUNDS DURATION, NOT CORRECTNESS. If the first attempt died on
      // a signal, the green second attempt must not erase that — otherwise a
      // nondeterministic crash is laundered into a silent pass and nobody ever
      // learns the rate. Say it out loud, on the success path, every time.
      if (crashedOnFirstAttempt !== null) {
        console.warn(
          `⚠ ${step.label}: PASSED ON RETRY after ${describeDisposition(crashedOnFirstAttempt)}. ` +
            "This run is NOT clean — a toolchain process crashed on identical input. " +
            "Record it (docs/research/2026-08-15-139-and-134-are-signal-deaths-*.md) — 147 such crashes were\n" +
            "counted across every runtime on one machine in the week this was written, and a crash nobody\n" +
            "records is a data point missing from the series that finds the cause.",
        );
      }
      return true;
    }
    if (attempt === 1 && disposition.kind === "signal") {
      crashedOnFirstAttempt = disposition;
      console.warn(`↻ ${step.label}: ${describeDisposition(disposition)} — retrying ONCE`);
      continue;
    }

    if (disposition.kind === "signal") {
      console.error(`✗ ${step.label}: ${describeDisposition(disposition)} on both attempts`);
    } else {
      console.error(`✗ ${step.label}: exited with code ${disposition.code}`);
    }
    // 081KZKWB1FZ: before the caller treats this as a type-error failure, say
    // plainly when the real cause is an unprovisioned checkout.
    reportUnprovisionedEnvironment(`${result.stdout ?? ""}${result.stderr ?? ""}`);
    return false;
  }
  return false;
}

function main(): number {
  for (const step of STEPS) {
    if (!run(step)) return 1;
  }
  console.log("✓ TypeScript, Prettier, and style checks passed successfully!");
  return 0;
}

// Only run the linter when executed directly. Without this guard, importing the
// module (e.g. from lint-typescript.test.ts, to unit-test the 081KZKWB1FZ guard)
// would run the whole type check and then call process.exit — killing the test
// runner. Entry-point side effects and testable exports have to coexist.
if (import.meta.main) {
  process.exit(main());
}
