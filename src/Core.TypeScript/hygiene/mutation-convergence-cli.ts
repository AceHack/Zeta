#!/usr/bin/env bun
/**
 * mutation-convergence-cli.ts — per-tick registry convergence measurement.
 *
 * Called by the heartbeat workflow (all agents). Reads the freedom ledger
 * and all transcripts, computes escape rate + churn, logs a one-liner.
 *
 * Exit codes:
 *   0 — measured successfully (converging or not)
 *   1 — fatal error (missing deps, crash)
 *
 * Output: a single formatted line to stdout (appears as ::notice:: in CI).
 */

import { measureConvergence, formatConvergence } from "./mutation-convergence";

function main(): void {
  const repoRoot = process.argv.includes("--repo-root")
    ? process.argv[process.argv.indexOf("--repo-root") + 1]!
    : process.cwd();

  try {
    const snapshot = measureConvergence(repoRoot);
    const line = formatConvergence(snapshot);
    console.log(line);

    // Per-tick escape profile detail (intoDefined vs intoUndefined)
    if (snapshot.totalEntries > 0) {
      const definedPct = snapshot.totalEntries > 0
        ? ((snapshot.escapeIntoDefined / snapshot.totalEntries) * 100).toFixed(1)
        : "0.0";
      const undefinedPct = snapshot.totalEntries > 0
        ? ((snapshot.escapeIntoUndefined / snapshot.totalEntries) * 100).toFixed(1)
        : "0.0";
      console.log(
        `[escape-profile] intoDefined=${definedPct}% (grammar too narrow) intoUndefined=${undefinedPct}% (system growing)`,
      );
    }

    // Emit as a GitHub annotation so it's visible in the step summary
    if (snapshot.converging) {
      console.log(`::notice::${line}`);
    } else if (snapshot.totalEntries > 0) {
      // Not converging but has data — worth attention
      console.log(`::warning::${line}`);
    }
  } catch (err) {
    // Non-fatal for the tick, but announce the failure
    console.error(`[mutation-convergence] FAILED: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main();
