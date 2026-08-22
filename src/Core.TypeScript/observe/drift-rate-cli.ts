#!/usr/bin/env bun
/**
 * drift-rate-cli.ts — record CI outcomes and report drift trends.
 *
 * Usage:
 *   # Report current drift rate (reads data/ci-runs.jsonl)
 *   bun src/Core.TypeScript/observe/drift-rate-cli.ts --report
 *
 *   # Record a run outcome (appends to data/ci-runs.jsonl)
 *   bun src/Core.TypeScript/observe/drift-rate-cli.ts --record \
 *     --workflow gate --conclusion success --run-id 12345
 *
 *   # JSON output
 *   bun src/Core.TypeScript/observe/drift-rate-cli.ts --report --json
 */

import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { loadCIRuns, computeDrift, formatDrift } from "./drift-rate";
import type { CIRun } from "./drift-rate";

function main(): void {
  const argv = process.argv.slice(2);
  const repoRoot = process.cwd();
  const dataPath = join(repoRoot, "data", "ci-runs.jsonl");

  if (argv.includes("--record")) {
    // Record a new CI run outcome
    const workflow = argValue(argv, "--workflow");
    const conclusion = argValue(argv, "--conclusion") as CIRun["conclusion"];
    const runId = argValue(argv, "--run-id") ?? "";

    if (!workflow || !conclusion) {
      console.error("Usage: --record --workflow <name> --conclusion <success|failure|cancelled>");
      process.exit(1);
    }

    if (!["success", "failure", "cancelled"].includes(conclusion)) {
      console.error(`Invalid conclusion: "${conclusion}". Must be success, failure, or cancelled.`);
      process.exit(1);
    }

    const record: CIRun = {
      workflow,
      conclusion,
      at: new Date().toISOString(),
      ...(runId ? { runId } : {}),
    };

    try {
      appendFileSync(dataPath, JSON.stringify(record) + "\n");
      console.log(`[drift-rate] recorded: ${workflow} = ${conclusion}`);
    } catch (err) {
      console.error(`[drift-rate] failed to write: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
    return;
  }

  if (argv.includes("--report") || argv.length === 0) {
    // Report current drift
    const runs = loadCIRuns(dataPath);
    const snapshot = computeDrift(runs);

    if (argv.includes("--json")) {
      console.log(JSON.stringify(snapshot, null, 2));
    } else {
      console.log(formatDrift(snapshot));
      if (runs.length > 0) {
        console.log(`  Windows: ${snapshot.overall.map((w) => `${w.label}=${(w.greenRatio * 100).toFixed(0)}%`).join(", ")}`);
        if (snapshot.byWorkflow.length > 0) {
          console.log(`  Workflows (worst-first):`);
          for (const wf of snapshot.byWorkflow.slice(0, 5)) {
            const pct = (wf.greenRatio * 100).toFixed(0);
            console.log(`    ${wf.workflow}: ${pct}% green (${wf.green}/${wf.green + wf.red}) [${wf.trend}]`);
          }
        }
      }
    }
    return;
  }

  console.error("Usage: --report | --record --workflow <name> --conclusion <success|failure|cancelled>");
  process.exit(1);
}

function argValue(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
}

main();
