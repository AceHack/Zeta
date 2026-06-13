#!/usr/bin/env bun
// lint-csharp.ts — C# whitespace, style, and analyzer checks.
//
// Post-install orchestration of C# formatting checks via dotnet format
// — it runs in CI where Bun is already available, so it is OUR CODE, not shell.
//
// Usage:
//   bun src/Core.TypeScript/lint/lint-csharp.ts

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
  {
    label: "Whitespace checks (C#)",
    cmd: ["dotnet", "format", "whitespace", "Zeta.sln", "--verify-no-changes", "--include", "src/**/*.cs", "tests/**/*.cs", "bench/**/*.cs", "samples/**/*.cs"],
  },
  {
    label: "Code style checks (C#)",
    cmd: ["dotnet", "format", "style", "Zeta.sln", "--verify-no-changes", "--include", "src/**/*.cs", "tests/**/*.cs", "bench/**/*.cs", "samples/**/*.cs"],
  },
  {
    label: "Analyzer checks (C#)",
    cmd: ["dotnet", "format", "analyzers", "Zeta.sln", "--verify-no-changes", "--include", "src/**/*.cs", "tests/**/*.cs", "bench/**/*.cs", "samples/**/*.cs"],
  },
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
  console.log("✓ C# whitespace, style, and analyzer checks passed successfully!");
  return 0;
}

process.exit(main());
