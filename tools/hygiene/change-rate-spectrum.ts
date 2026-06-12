#!/usr/bin/env bun
// change-rate-spectrum.ts — the empirical leg of math REPORT #4 (DV2.0 hub stability).
//
// Measures, from git history, the two facts REPORT #4 named as decisive and unmeasured:
//   1. THE SPECTRUM: per-file change rate (commits/week since first touch). Hub uniqueness
//      (Theorem A's corollary) holds iff the spectrum is GAPPED — rates cluster with
//      inter-cluster gaps; gapless regions are author-chosen cut placements.
//   2. THE PARNAS INEQUALITY (Parnas 1972): rho(interface surface) < rho(implementations).
//      Ferry 9's "interfaces are the hubs" is DV2.0 *composed with* this premise; measuring it
//      converts the claim from prose to fact. Two instances:
//        code:  src/Core.Abstractions/** (interface surface) vs src/Core/**/*.fs (impls)
//        rules: .claude/rules/*.md (carved-sentence hubs) vs docs/research/*.md (satellites)
//
// Advisory tool (exit 0 always unless git itself fails); prints a report. Run:
//   bun tools/hygiene/change-rate-spectrum.ts [--top N]
import { execSync } from "node:child_process";

const topN = (() => {
  const i = process.argv.indexOf("--top");
  return i >= 0 ? Number(process.argv[i + 1] ?? 20) : 20;
})();

// One pass over history: per-file commit count + first/last touch epoch.
const raw = execSync("git log --pretty=format:%ct --name-only", {
  maxBuffer: 1024 * 1024 * 512,
}).toString();

type Stat = { commits: number; first: number; last: number };
const stats = new Map<string, Stat>();
let epoch = 0;
for (const line of raw.split("\n")) {
  if (line === "") continue;
  if (/^\d+$/.test(line)) {
    epoch = Number(line);
    continue;
  }
  const s = stats.get(line);
  if (s === undefined) stats.set(line, { commits: 1, first: epoch, last: epoch });
  else {
    s.commits++;
    if (epoch < s.first) s.first = epoch; // log is reverse-chronological; keep min/max anyway
    if (epoch > s.last) s.last = epoch;
  }
}

// Only files that still exist at HEAD (deleted files are history's business, not the spectrum's).
const live = new Set(
  execSync("git ls-files", { maxBuffer: 1024 * 1024 * 64 }).toString().split("\n").filter(Boolean),
);
const now = Date.now() / 1000;
const WEEK = 7 * 24 * 3600;

type Row = { path: string; commits: number; weeks: number; rate: number };
const rows: Row[] = [];
for (const [path, s] of stats) {
  if (!live.has(path)) continue;
  const weeks = Math.max((now - s.first) / WEEK, 1 / 7); // floor: one day
  rows.push({ path, commits: s.commits, weeks, rate: s.commits / weeks });
}
rows.sort((a, b) => b.rate - a.rate);

// ── 1. The spectrum and its gaps ────────────────────────────────────────────────────────────
// Work in log-space (rates span orders of magnitude). A "gap" is a large jump between adjacent
// sorted log-rates; gappedness = largest gap / median gap. Gapped spectrum => canonical hubs.
const logs = rows.map((r) => Math.log10(r.rate)).sort((a, b) => a - b);
const gaps: { at: number; size: number; below: number; above: number }[] = [];
for (let i = 1; i < logs.length; i++) {
  const lo = logs[i - 1]!;
  const hi = logs[i]!;
  gaps.push({ at: i, size: hi - lo, below: lo, above: hi });
}
const sorted = [...gaps].sort((a, b) => b.size - a.size);
const median = [...gaps].sort((a, b) => a.size - b.size)[Math.floor(gaps.length / 2)]?.size ?? 0;

console.log(`change-rate spectrum — ${rows.length} live files, ${stats.size} historical paths`);
console.log(`rates: max ${rows[0]?.rate.toFixed(3)}/wk (${rows[0]?.path})`);
console.log(`       min ${rows[rows.length - 1]?.rate.toFixed(4)}/wk`);
console.log(`\nTOP ${topN} hottest files (the satellite end):`);
for (const r of rows.slice(0, topN)) {
  console.log(`  ${r.rate.toFixed(3)}/wk  ${r.commits} commits  ${r.path}`);
}
console.log(`\nlargest log10 gaps (candidate hub/satellite cluster boundaries):`);
for (const g of sorted.slice(0, 5)) {
  console.log(
    `  gap ${g.size.toFixed(3)} between ${(10 ** g.below).toFixed(4)}/wk and ${(10 ** g.above).toFixed(4)}/wk`,
  );
}
const gappedness = median > 0 ? sorted[0]!.size / median : Infinity;
console.log(
  `gappedness (largest gap / median gap): ${gappedness.toFixed(1)} — ${gappedness > 10 ? "GAPPED (canonical hub cuts exist)" : "weakly gapped / continuum (cut placement is partly authored)"}`,
);

// ── 2. The Parnas inequality, two instances ─────────────────────────────────────────────────
function group(name: string, pred: (p: string) => boolean): { name: string; mean: number; n: number } {
  const g = rows.filter((r) => pred(r.path));
  const mean = g.reduce((s, r) => s + r.rate, 0) / Math.max(g.length, 1);
  return { name, mean, n: g.length };
}

function parnas(label: string, iface: ReturnType<typeof group>, impl: ReturnType<typeof group>) {
  const holds = iface.mean < impl.mean;
  console.log(`\nPARNAS [${label}]: rho(${iface.name}) ${holds ? "<" : ">="} rho(${impl.name})  →  ${holds ? "HOLDS" : "FAILS"}`);
  console.log(`  ${iface.name}: mean ${iface.mean.toFixed(4)}/wk over ${iface.n} files`);
  console.log(`  ${impl.name}: mean ${impl.mean.toFixed(4)}/wk over ${impl.n} files`);
  console.log(`  ratio impl/iface: ${(impl.mean / iface.mean).toFixed(2)}x`);
}

parnas(
  "code",
  group("src/Core.Abstractions", (p) => p.startsWith("src/Core.Abstractions/") && !p.includes("/obj/")),
  group("src/Core impls (.fs)", (p) => p.startsWith("src/Core/") && p.endsWith(".fs")),
);
parnas(
  "rules",
  group(".claude/rules hubs", (p) => p.startsWith(".claude/rules/") && p.endsWith(".md")),
  group("docs/research satellites", (p) => p.startsWith("docs/research/") && p.endsWith(".md")),
);

console.log(
  "\n(Interpretation per docs/research/2026-06-12-dv2-hub-stability-and-the-forced-shape-math-team-REPORT-4.md §2/§5.)",
);
