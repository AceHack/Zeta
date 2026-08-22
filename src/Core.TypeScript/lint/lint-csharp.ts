#!/usr/bin/env bun
// lint-csharp.ts — C# whitespace, style, and analyzer checks.
//
// Post-install orchestration of C# formatting checks via dotnet format
// — it runs in CI where Bun is already available, so it is OUR CODE, not shell.
//
// Usage:
//   bun src/Core.TypeScript/lint/lint-csharp.ts

import { spawnSync, type SpawnSyncReturns } from "node:child_process";
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
    label: "Restore solution for C# formatting",
    cmd: ["dotnet", "restore", "Zeta.sln"],
  },
  {
    label: "Whitespace checks (C#)",
    cmd: [
      "dotnet",
      "format",
      "whitespace",
      "Zeta.sln",
      "--no-restore",
      "--verify-no-changes",
      "--include",
      "src/**/*.cs",
      "tests/**/*.cs",
      "bench/**/*.cs",
      "samples/**/*.cs",
    ],
  },
  {
    label: "Code style checks (C#)",
    cmd: [
      "dotnet",
      "format",
      "style",
      "Zeta.sln",
      "--no-restore",
      "--verify-no-changes",
      "--include",
      "src/**/*.cs",
      "tests/**/*.cs",
      "bench/**/*.cs",
      "samples/**/*.cs",
    ],
  },
  {
    label: "Analyzer checks (C#)",
    cmd: [
      "dotnet",
      "format",
      "analyzers",
      "Zeta.sln",
      "--no-restore",
      "--verify-no-changes",
      "--include",
      "src/**/*.cs",
      "tests/**/*.cs",
      "bench/**/*.cs",
      "samples/**/*.cs",
    ],
  },
];

const RETRYABLE_WORKSPACE_FAILURES = ["The server disconnected unexpectedly", "Restore operation failed", "MSB4166"];
const TRANSIENT_DOTNET_EXIT_CODES = new Set([139]);

function retryReason(result: SpawnSyncReturns<string>, output: string): string | undefined {
  if (result.signal !== null) {
    return `process ended by signal ${result.signal}`;
  }
  if (result.status !== null && TRANSIENT_DOTNET_EXIT_CODES.has(result.status)) {
    return `dotnet exited ${String(result.status)}`;
  }
  if (RETRYABLE_WORKSPACE_FAILURES.some((fragment) => output.includes(fragment))) {
    return "workspace load failure";
  }
  return undefined;
}

function run(step: Step): boolean {
  console.log(`=== ${step.label} ===`);
  const [bin, ...args] = step.cmd;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const result = spawnSync(bin, args, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);

    if (result.error) {
      console.error(`✗ ${step.label}: failed to start — ${result.error.message}`);
      return false;
    }
    if (result.status === 0) {
      return true;
    }

    const reason = attempt === 1 ? retryReason(result, result.stdout + result.stderr) : undefined;
    if (reason !== undefined) {
      console.warn(`↻ ${step.label}: ${reason}; retrying once before treating it as deterministic`);
      continue;
    }

    const exitCode = result.status === null ? "signal" : String(result.status);
    console.error(`✗ ${step.label}: exited with code ${exitCode}`);
    return false;
  }
  return false;
}

function main(): number {
  for (const step of STEPS) {
    if (!run(step)) return 1;
  }
  console.log("✓ C# whitespace, style, and analyzer checks passed successfully!");
  return 0;
}

process.exit(main());
