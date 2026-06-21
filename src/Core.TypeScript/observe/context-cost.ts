#!/usr/bin/env bun
// context-cost.ts — the drift-alert / DORA wiring for context-window minimization
// (081KT7YW00008QG0R002T1XNWT). Measures the cold-boot context surface a harness loads, using the
// proven byte-cost meter (src/Core.TypeScript/byte-cost), compares it against a
// committed baseline/budget, and emits a drift report.
//
// (harness × surface) keying (Aaron 2026-06-04): each harness boots a DIFFERENT
// set of files; a harness's RESIDENT cost = the monoid sum over what actually
// loads at startup. Two surface modes (Aaron 2026-06-04, "both, labeled
// separately"):
//   - "whole"       : the whole file is resident (CLAUDE.md, .claude/rules/*).
//   - "description" : ONLY the frontmatter `description:` is resident at cold-boot
//                     (skills/agents/commands — the tool LIST); the body is the
//                     ON-DEMAND pool (loads only when invoked). Counting whole
//                     files would overcount; we report resident AND on-demand,
//                     kept distinct.
//
// Two enforcement points: --check (write-time local guard, gates on RESIDENT) and
// --kpi (DORA metric line). NCI: measures only.
import { Glob } from "bun";
import { readFileSync, existsSync } from "node:fs";
import { measureText, sum, type ByteCost } from "../byte-cost/byte-cost";

export type SurfaceMode = "whole" | "description";

export interface HarnessManifest {
  readonly harness: string;
  readonly surfaces: ReadonlyArray<{ glob: string; mode: SurfaceMode }>;
}

/** Cold-boot surfaces per harness (repo-measurable; ~/.claude/MEMORY.md is
 *  out-of-repo, reported separately by --verbose, not gated). */
export const MANIFESTS: readonly HarnessManifest[] = [
  {
    harness: "claude-code",
    surfaces: [
      { glob: "CLAUDE.md", mode: "whole" },
      { glob: ".claude/rules/*.md", mode: "whole" },
      { glob: ".claude/skills/*/SKILL.md", mode: "description" },
      { glob: ".claude/agents/*.md", mode: "description" },
      { glob: ".claude/commands/*.md", mode: "description" },
    ],
  },
];

/** Extract the frontmatter `description:` value (the part resident at cold-boot).
 *  Returns "" if absent. Single-line values per the skill/agent/command schema. */
export function frontmatterDescription(text: string): string {
  if (!text.startsWith("---")) return "";
  const end = text.indexOf("\n---", 3);
  const fm = end >= 0 ? text.slice(0, end) : text;
  for (const line of fm.split("\n")) {
    const m = line.match(/^description:\s*(.*)$/);
    if (m) return m[1]!.trim().replace(/^["']|["']$/g, "");
  }
  return "";
}

/** The resident (cold-boot-loaded) text of a surface, per its mode. */
export function residentText(text: string, mode: SurfaceMode): string {
  return mode === "whole" ? text : frontmatterDescription(text);
}

export interface MeasuredFile {
  readonly path: string;
  readonly mode: SurfaceMode;
  readonly resident: number; // bytes loaded at cold-boot
  readonly total: number; // whole-file bytes (= resident for "whole")
}

export interface HarnessCost {
  readonly harness: string;
  readonly resident: ByteCost; // the cold-boot cost (what --check gates on)
  readonly onDemand: ByteCost; // body pool that loads only when invoked
  readonly files: ReadonlyArray<MeasuredFile>;
}

/** Measure one harness from already-read files + their modes (pure — testable). */
export function measureHarness(
  harness: string,
  files: ReadonlyArray<{ path: string; text: string; mode: SurfaceMode }>,
): HarnessCost {
  const perFile: MeasuredFile[] = files.map((f) => {
    const total = measureText(f.text).bytes;
    const resident = measureText(residentText(f.text, f.mode)).bytes;
    return { path: f.path, mode: f.mode, resident, total };
  });
  const resident = sum(perFile.map((f) => ({ bytes: f.resident })));
  const onDemand = sum(perFile.map((f) => ({ bytes: f.total - f.resident })));
  return { harness, resident, onDemand, files: perFile };
}

export interface DriftVerdict {
  readonly harness: string;
  readonly current: number;
  readonly baseline: number;
  readonly budget: number;
  readonly delta: number;
  readonly overBudget: boolean;
}

/** Compare RESIDENT cost to baseline + budget (pure). overBudget => alert. */
export function assessDrift(cost: HarnessCost, baseline: number, budget: number): DriftVerdict {
  const current = cost.resident.bytes;
  return { harness: cost.harness, current, baseline, budget, delta: current - baseline, overBudget: current > budget };
}

// ── CLI (I/O at the edge) ──────────────────────────────────────────────────
interface Baseline {
  tolerance: number;
  harnesses: Record<string, { resident: number }>;
}

function measureAll(): HarnessCost[] {
  return MANIFESTS.map((m) => {
    const files = m.surfaces.flatMap((s) => {
      const paths = s.glob.includes("*")
        ? [...new Glob(s.glob).scanSync({ cwd: ".", dot: true })]
        : existsSync(s.glob)
          ? [s.glob]
          : [];
      return paths.sort().map((p) => ({ path: p, text: readFileSync(p, "utf8"), mode: s.mode }));
    });
    return measureHarness(m.harness, files);
  });
}

if (import.meta.main) {
  const args = new Set(Bun.argv.slice(2));
  const baselinePath = "src/Core.TypeScript/observe/context-cost-baseline.json";
  const costs = measureAll();

  if (args.has("--write-baseline")) {
    const baseline: Baseline = {
      tolerance: 0.1,
      harnesses: Object.fromEntries(costs.map((c) => [c.harness, { resident: c.resident.bytes }])),
    };
    await Bun.write(baselinePath, JSON.stringify(baseline, null, 2) + "\n");
    console.log(`wrote baseline: ${costs.map((c) => `${c.harness}=${c.resident.bytes}B resident`).join(" ")}`);
    process.exit(0);
  }

  const baseline = JSON.parse(readFileSync(baselinePath, "utf8")) as Baseline;
  let over = 0;
  for (const c of costs) {
    const base = baseline.harnesses[c.harness]?.resident ?? c.resident.bytes;
    const budget = Math.round(base * (1 + baseline.tolerance));
    const v = assessDrift(c, base, budget);
    if (v.overBudget) over++;
    if (args.has("--kpi")) {
      console.log(
        `context_cost_bytes harness=${v.harness} resident=${v.current} ondemand=${c.onDemand.bytes} baseline=${v.baseline} delta=${v.delta} budget=${v.budget} over=${v.overBudget}`,
      );
    } else {
      const sign = v.delta >= 0 ? "+" : "";
      console.log(
        `${v.overBudget ? "✗" : "✓"} ${v.harness}: ${v.current}B resident (${sign}${v.delta} vs baseline ${v.baseline}; budget ${v.budget}) + ${c.onDemand.bytes}B on-demand`,
      );
      if (args.has("--verbose")) for (const f of c.files) console.log(`    ${f.resident}B/${f.total}B ${f.mode === "description" ? "desc" : "whole"}  ${f.path}`);
    }
  }

  if (args.has("--check") && over > 0) {
    console.error(`context-cost: ${over} harness(es) over budget — minimize before landing (081KT7YW00008QG0R002T1XNWT).`);
    process.exit(1);
  }
  process.exit(0);
}
