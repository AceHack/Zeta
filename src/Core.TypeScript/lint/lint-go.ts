#!/usr/bin/env bun
// lint-go.ts — Go formatting and linting checks.
//
// Post-install orchestration of native Go toolchains (go fmt / golangci-lint
// in src/Core.Go) — it runs in CI where Bun is already available, so it is
// OUR CODE, not shell.
//
// Usage:
//   bun src/Core.TypeScript/lint/lint-go.ts

import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// 3 levels up from src/Core.TypeScript/lint/ to repo root.
const REPO_ROOT = resolve(here, "..", "..", "..");
const GO_DIR = join(REPO_ROOT, "src", "Core.Go");

interface Step {
  readonly label: string;
  readonly cmd: readonly [string, ...string[]];
}

const STEPS: readonly Step[] = [
  { label: "Linting Go: go fmt", cmd: ["go", "fmt", "./..."] },
  { label: "Linting Go: golangci-lint", cmd: ["golangci-lint", "run", "./..."] },
];

function run(step: Step): boolean {
  console.log(`=== ${step.label} ===`);
  const [bin, ...args] = step.cmd;
  const result = spawnSync(bin, args, { cwd: GO_DIR, stdio: "inherit" });
  if (result.error) {
    console.error(`✗ ${step.label}: failed to start — ${result.error.message}`);
    return false;
  }
  if (result.status !== 0) {
    console.error(`✗ ${step.label}: exited with code ${result.status ?? "signal"}`);
    return false;
  }
  return true;
}

function main(): number {
  for (const step of STEPS) {
    if (!run(step)) return 1;
  }
  console.log("✓ Go linting checks passed successfully!");
  return 0;
}

process.exit(main());
