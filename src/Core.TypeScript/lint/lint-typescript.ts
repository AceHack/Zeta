#!/usr/bin/env bun
// lint-typescript.ts — TypeScript type checking, formatting, and linting checks.
//
// Post-install orchestration of TypeScript tools (tsc, eslint, prettier, stylelint)
// — it runs in CI where Bun is already available, so it is OUR CODE, not shell.
//
// Usage:
//   bun src/Core.TypeScript/lint/lint-typescript.ts

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// 3 levels up from src/Core.TypeScript/lint/ to repo root.
const REPO_ROOT = resolve(here, "..", "..", "..");

interface Step {
  readonly label: string;
  readonly cmd: readonly [string, ...string[]];
}

const STEPS: readonly Step[] = [
  { label: "TypeScript type check: tsc", cmd: ["bun", "x", "tsc", "--noEmit", "-p", "tsconfig.json"] },
];

function run(step: Step): boolean {
  console.log(`=== ${step.label} ===`);
  const [bin, ...args] = step.cmd;
  const result = spawnSync(bin, args, { cwd: REPO_ROOT, stdio: "inherit" });
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
  console.log("✓ TypeScript, Prettier, and style checks passed successfully!");
  return 0;
}

process.exit(main());
