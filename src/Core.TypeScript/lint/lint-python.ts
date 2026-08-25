#!/usr/bin/env bun
// lint-python.ts — Python sync, formatting, linting, and type checking.
//
// Post-install orchestration of native Python toolchains (uv + ruff + mypy
// in src/Core.Python) — it runs in CI where Bun is already available, so it is
// OUR CODE, not shell.
//
// Usage:
//   bun src/Core.TypeScript/lint/lint-python.ts

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// 3 levels up from src/Core.TypeScript/lint/ to repo root.
const REPO_ROOT = resolve(here, "..", "..", "..");

/**
 * Every Python project in the repo, each linted in its own `uv` project.
 *
 * This was `src/Core.Python` alone, and the omission was invisible rather than
 * deliberate: `src/Arc.Python` had 23 passing tests and a clean ruff/mypy state
 * that NO CI CHECK LOOKED AT. A lane nothing lints is a lane that drifts, and
 * "it passes locally" is exactly the claim CI exists to stop us from making.
 *
 * Adding a project here is the whole wiring — no workflow change is needed,
 * because `lint (Python)` already runs this script.
 */
interface PyProject {
  readonly dir: string;
  /**
   * What mypy is pointed at. Per-project because the layouts genuinely differ
   * — `Core.Python` uses `src/`, `Arc.Python` ships `zeta_arc/` at the root —
   * and a single hardcoded `src/` made mypy exit 2 ("Cannot read file 'src'")
   * on the second project. Caught by running this script, not by reading it.
   */
  readonly typeCheck: readonly string[];
}

const PY_PROJECTS: readonly PyProject[] = [
  { dir: join(REPO_ROOT, "src", "Core.Python"), typeCheck: ["src/", "tests/"] },
  { dir: join(REPO_ROOT, "src", "Arc.Python"), typeCheck: ["zeta_arc/", "tests/"] },
];

interface Step {
  readonly label: string;
  readonly cmd: readonly [string, ...string[]];
}

const stepsFor = (project: PyProject): readonly Step[] => [
  { label: "Linting Python: uv sync", cmd: ["uv", "sync"] },
  { label: "Linting Python: ruff check", cmd: ["uv", "run", "ruff", "check"] },
  { label: "Linting Python: ruff format --check", cmd: ["uv", "run", "ruff", "format", "--check"] },
  { label: "Linting Python: mypy", cmd: ["uv", "run", "mypy", ...project.typeCheck] },
];

function run(step: Step, dir: string): boolean {
  const where = basename(dir);
  console.log(`=== ${step.label} [${where}] ===`);
  const [bin, ...args] = step.cmd;
  const result = spawnSync(bin, args, { cwd: dir, stdio: "inherit" });
  if (result.error) {
    console.error(`✗ ${step.label} [${where}]: failed to start — ${result.error.message}`);
    return false;
  }
  if (result.status !== 0) {
    console.error(`✗ ${step.label} [${where}]: exited with code ${result.status ?? "signal"}`);
    return false;
  }
  return true;
}

function main(): number {
  for (const project of PY_PROJECTS) {
    // A project that vanished is a wiring error, not a pass. Fail loudly
    // rather than silently linting nothing — the whole defect this fixes was
    // a lane nobody was checking.
    if (!existsSync(project.dir)) {
      console.error(`✗ Python project not found: ${project.dir}`);
      return 1;
    }
    for (const step of stepsFor(project)) {
      if (!run(step, project.dir)) return 1;
    }
  }
  console.log(`✓ Python linting checks passed for ${PY_PROJECTS.length} projects!`);
  return 0;
}

process.exit(main());
