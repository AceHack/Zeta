#!/usr/bin/env bun
// context-cost.ts — the drift-alert / DORA wiring for context-window minimization
// (B-1016). Measures the cold-boot context surface a harness loads, using the
// proven byte-cost meter (src/Core.TypeScript/byte-cost), compares it against a
// committed baseline/budget, and emits a drift report.
//
// Two enforcement points (B-1016 operating model):
//   - write-time (local, NOT PR): `--check` exits non-zero if any harness exceeds
//     its budget — the observe.ts / pre-push guard, before a surface lands.
//   - over-time (DORA): `--kpi` prints one metric line per harness (total bytes +
//     delta-from-baseline) for the DORA cost trend.
//
// (harness × surface) keying (Aaron 2026-06-04): each harness boots a DIFFERENT
// set of files; a harness's cost = the monoid sum over ITS boot manifest. The
// ByteCost unit is harness-agnostic; the manifest is what differs.
//
// NCI: measures only; removes no capability.
import { Glob } from "bun";
import { readFileSync, existsSync } from "node:fs";
import { measureText, sum, type ByteCost } from "../../src/Core.TypeScript/byte-cost/byte-cost";

/** A harness's cold-boot manifest: which repo files it loads at startup. */
export interface HarnessManifest {
  readonly harness: string;
  readonly globs: readonly string[];
}

/** The cold-boot surfaces, keyed by harness. Repo-measurable files only
 *  (e.g. ~/.claude/MEMORY.md is out-of-repo and measured separately). */
export const MANIFESTS: readonly HarnessManifest[] = [
  { harness: "claude-code", globs: ["CLAUDE.md", ".claude/rules/*.md"] },
];

export interface HarnessCost {
  readonly harness: string;
  readonly total: ByteCost;
  readonly files: ReadonlyArray<{ path: string; bytes: number }>;
}

/** Measure one harness from already-read file contents (pure — testable). */
export function measureHarness(harness: string, files: ReadonlyArray<{ path: string; text: string }>): HarnessCost {
  const perFile = files.map((f) => ({ path: f.path, bytes: measureText(f.text).bytes }));
  const total = sum(perFile.map((f) => ({ bytes: f.bytes })));
  return { harness, total, files: perFile };
}

export interface DriftVerdict {
  readonly harness: string;
  readonly current: number;
  readonly baseline: number;
  readonly budget: number;
  readonly delta: number;
  readonly overBudget: boolean;
}

/** Compare a measured cost to its baseline + budget (pure). overBudget => alert. */
export function assessDrift(cost: HarnessCost, baseline: number, budget: number): DriftVerdict {
  const current = cost.total.bytes;
  return {
    harness: cost.harness,
    current,
    baseline,
    budget,
    delta: current - baseline,
    overBudget: current > budget,
  };
}

// ── CLI (I/O at the edge) ──────────────────────────────────────────────────
interface Baseline {
  tolerance: number; // budget = round(baseline * (1 + tolerance))
  harnesses: Record<string, { total: number }>;
}

function measureAll(): HarnessCost[] {
  return MANIFESTS.map((m) => {
    const paths = m.globs
      .flatMap((g) => (g.includes("*") ? [...new Glob(g).scanSync({ cwd: ".", dot: true })] : existsSync(g) ? [g] : []))
      .sort();
    const files = paths.map((p) => ({ path: p, text: readFileSync(p, "utf8") }));
    return measureHarness(m.harness, files);
  });
}

if (import.meta.main) {
  const args = new Set(Bun.argv.slice(2));
  const baselinePath = "tools/observe/context-cost-baseline.json";
  const costs = measureAll();

  if (args.has("--write-baseline")) {
    const baseline: Baseline = {
      tolerance: 0.1,
      harnesses: Object.fromEntries(costs.map((c) => [c.harness, { total: c.total.bytes }])),
    };
    await Bun.write(baselinePath, JSON.stringify(baseline, null, 2) + "\n");
    console.log(`wrote baseline: ${costs.map((c) => `${c.harness}=${c.total.bytes}B`).join(" ")}`);
    process.exit(0);
  }

  const baseline = JSON.parse(readFileSync(baselinePath, "utf8")) as Baseline;
  let over = 0;
  for (const c of costs) {
    const base = baseline.harnesses[c.harness]?.total ?? c.total.bytes;
    const budget = Math.round(base * (1 + baseline.tolerance));
    const v = assessDrift(c, base, budget);
    if (v.overBudget) over++;
    if (args.has("--kpi")) {
      // DORA-style metric line (one per harness): trend-ingestable.
      console.log(`context_cost_bytes harness=${v.harness} total=${v.current} baseline=${v.baseline} delta=${v.delta} budget=${v.budget} over=${v.overBudget}`);
    } else {
      const sign = v.delta >= 0 ? "+" : "";
      console.log(`${v.overBudget ? "✗" : "✓"} ${v.harness}: ${v.current}B (${sign}${v.delta} vs baseline ${v.baseline}; budget ${v.budget})`);
      if (args.has("--verbose")) for (const f of c.files) console.log(`    ${f.bytes}B  ${f.path}`);
    }
  }

  if (args.has("--check") && over > 0) {
    console.error(`context-cost: ${over} harness(es) over budget — minimize before landing (B-1016).`);
    process.exit(1);
  }
  process.exit(0);
}
