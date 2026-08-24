#!/usr/bin/env bun
// lint-typescript.ts — runs the checks in `STEPS`, and says exactly which ones ran.
//
// TODAY `STEPS` HOLDS ONE CHECK: `tsc --noEmit`. This header used to describe the
// file as orchestrating "tsc, eslint, prettier, stylelint" and `main()` used to
// print "✓ TypeScript, Prettier, and style checks passed successfully!" — naming
// three tools while running one. eslint / prettier / stylelint are configured and
// pinned in package.json but are NOT invoked from here (workitem
// 081M0RBXF6J087G0R0023EX9X2). Their absence is a real gap; announcing them as
// passed was worse than the gap, because the CI log is where a reader goes to
// confirm what ran, and it told them something false on every green run.
//
// So the success line is DERIVED from `STEPS` (`successMessage`), never written
// out by hand: a step added to `STEPS` appears in the message for free, and a step
// removed cannot leave its name behind. `lint-typescript.test.ts` fails if the
// message names any tool that is not in `STEPS`.
//
// Do not re-describe this file by the tools it could run — only by the ones it does.
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

export interface Step {
  readonly label: string;
  /**
   * The tool this step actually executes — the ONLY source the success line is
   * allowed to name a tool from. Keep it the name a reader would grep the CI log
   * for (`tsc`, not `node`), and keep it a substring of `cmd`: the test asserts
   * that tie, so a step cannot declare one tool and shell out to another.
   */
  readonly tool: string;
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

export const STEPS: readonly Step[] = [
  { label: "TypeScript type check: tsc", tool: "tsc", cmd: TYPESCRIPT_COMPILER_COMMAND },
];

/** The tools `steps` executes, first-appearance order, deduplicated. */
export function toolsRun(steps: readonly Step[]): readonly string[] {
  return [...new Set(steps.map((step) => step.tool))];
}

/**
 * The line printed when every step passed — a FUNCTION OF WHAT RAN, not a
 * hand-maintained roster. An empty `STEPS` is not a pass and must not read like
 * one: nothing was checked, so the caller is told so and `main()` fails.
 */
export function successMessage(steps: readonly Step[]): string {
  const tools = toolsRun(steps);
  if (tools.length === 0) {
    return "✗ NOTHING RAN: STEPS is empty, so no check was performed. This is not a pass.";
  }
  const noun = tools.length === 1 ? "check" : "checks";
  return `✓ ${tools.length} ${noun} passed: ${tools.join(", ")}`;
}

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
  // A run that executed no check is not a green run. Guarding it here means the
  // only way to reach exit 0 is to have actually run something.
  if (STEPS.length === 0) {
    console.error(successMessage(STEPS));
    return 1;
  }
  for (const step of STEPS) {
    if (!run(step)) return 1;
  }
  console.log(successMessage(STEPS));
  return 0;
}

// Only run the linter when executed directly. Without this guard, importing the
// module (e.g. from lint-typescript.test.ts, to unit-test the 081KZKWB1FZ guard)
// would run the whole type check and then call process.exit — killing the test
// runner. Entry-point side effects and testable exports have to coexist.
if (import.meta.main) {
  process.exit(main());
}
