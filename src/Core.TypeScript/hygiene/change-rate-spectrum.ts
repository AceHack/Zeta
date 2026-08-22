#!/usr/bin/env bun
// change-rate-spectrum.ts — the empirical leg of math REPORT #4 (DV2.0 hub stability).
//
// Measures, from git history, the two facts REPORT #4 named as decisive and unmeasured:
//   1. THE SPECTRUM: per-file change rate. Hub uniqueness (Theorem A's corollary) holds iff the
//      spectrum is GAPPED — rates cluster with inter-cluster gaps; gapless regions are
//      author-chosen cut placements.
//   2. THE PARNAS INEQUALITY (Parnas 1972): rho(interface surface) < rho(implementations).
//      Ferry 9's "interfaces are the hubs" is DV2.0 *composed with* this premise.
//
// Honest-metric notes (v2 — the v1 draft over-weighted young files):
//   - rate = commits / weeks-since-first-touch with weeks FLOORED AT 4 — a day-old file with
//     23 commits is burst-authoring, not a 145/wk satellite; the floor damps the artifact.
//   - the gap analysis runs on MATURE files only (first touch ≥ MATURE_WEEKS ago): young files
//     still finding their rate and smear the spectrum.
//   - gappedness = largest gap / median of POSITIVE gaps (ties at 0 otherwise zero the median).
//   - the rules-vs-research pair is reported as an OBSERVATION, not a Parnas instance:
//     docs/research ferries are append-once archives (touched ~once, then immutable), which is
//     a different axis than interface-vs-implementation churn.
//
// Advisory tool (exit 0 unless git fails); prints a report. Run:
//   bun src/Core.TypeScript/hygiene/change-rate-spectrum.ts [--top N]
import { execSync } from "node:child_process";

const topN = (() => {
  const i = process.argv.indexOf("--top");
  return i >= 0 ? Number(process.argv[i + 1] ?? 15) : 15;
})();

const raw = execSync("git log --pretty=format:%ct --name-only", {
  maxBuffer: 1024 * 1024 * 512,
}).toString();

type Stat = { commits: number; first: number };
const stats = new Map<string, Stat>();
let epoch = 0;
for (const line of raw.split("\n")) {
  if (line === "") continue;
  if (/^\d+$/.test(line)) {
    epoch = Number(line);
    continue;
  }
  const s = stats.get(line);
  if (s === undefined) stats.set(line, { commits: 1, first: epoch });
  else {
    s.commits++;
    if (epoch < s.first) s.first = epoch;
  }
}

const live = new Set(
  execSync("git ls-files", { maxBuffer: 1024 * 1024 * 64 }).toString().split("\n").filter(Boolean),
);
const now = Date.now() / 1000;
const WEEK = 7 * 24 * 3600;
const FLOOR_WEEKS = 4; // damp burst-authoring of young files
const MATURE_WEEKS = 6; // spectrum runs on files at least this old

type Row = { path: string; commits: number; ageWeeks: number; rate: number };
const rows: Row[] = [];
for (const [path, s] of stats) {
  if (!live.has(path)) continue;
  const ageWeeks = (now - s.first) / WEEK;
  rows.push({ path, commits: s.commits, ageWeeks, rate: s.commits / Math.max(ageWeeks, FLOOR_WEEKS) });
}
rows.sort((a, b) => b.rate - a.rate);

console.log(`change-rate spectrum v2 — ${rows.length} live files (rate floor ${FLOOR_WEEKS}w)`);
console.log(`\nTOP ${topN} hottest (the satellite end):`);
for (const r of rows.slice(0, topN)) {
  console.log(
    `  ${r.rate.toFixed(2)}/wk  ${String(r.commits).padStart(4)} commits  age ${r.ageWeeks.toFixed(1)}w  ${r.path}`,
  );
}

// ── 1. the spectrum and its gaps — mature files only ───────────────────────────────────────
const mature = rows.filter((r) => r.ageWeeks >= MATURE_WEEKS);
const logs = mature.map((r) => Math.log10(r.rate)).sort((a, b) => a - b);
const gaps: { size: number; below: number; above: number }[] = [];
for (let i = 1; i < logs.length; i++) {
  gaps.push({ size: logs[i]! - logs[i - 1]!, below: logs[i - 1]!, above: logs[i]! });
}
const sorted = [...gaps].sort((a, b) => b.size - a.size);
const positive = gaps.filter((g) => g.size > 0).map((g) => g.size).sort((a, b) => a - b);
const medianPos = positive[Math.floor(positive.length / 2)] ?? 0;
const gappedness = medianPos > 0 ? (sorted[0]?.size ?? 0) / medianPos : 0;

console.log(`\nspectrum (mature files only, age ≥ ${MATURE_WEEKS}w: ${mature.length} files):`);
for (const g of sorted.slice(0, 5)) {
  console.log(
    `  gap ${g.size.toFixed(3)} between ${(10 ** g.below).toFixed(4)}/wk and ${(10 ** g.above).toFixed(4)}/wk`,
  );
}
console.log(
  `gappedness (largest gap / median positive gap): ${gappedness.toFixed(1)} — ${gappedness > 10 ? "GAPPED (canonical hub cuts exist in this region)" : "weakly gapped / continuum (cut placement is partly authored)"}`,
);

// ── 2. the Parnas inequality (code) + the archive observation (docs) ────────────────────────
function group(name: string, pred: (p: string) => boolean): { name: string; mean: number; n: number } {
  const g = rows.filter((r) => pred(r.path));
  const mean = g.reduce((s, r) => s + r.rate, 0) / Math.max(g.length, 1);
  return { name, mean, n: g.length };
}

const iface = group("src/Core.Abstractions", (p) => p.startsWith("src/Core.Abstractions/") && !p.includes("/obj/"));
const impl = group("src/Core impls (.fs)", (p) => p.startsWith("src/Core/") && p.endsWith(".fs"));
const holds = iface.mean < impl.mean;
console.log(`\nPARNAS [code]: rho(${iface.name}) ${holds ? "<" : ">="} rho(${impl.name})  →  ${holds ? "HOLDS" : "FAILS"}`);
console.log(`  ${iface.name}: mean ${iface.mean.toFixed(4)}/wk over ${iface.n} files`);
console.log(`  ${impl.name}: mean ${impl.mean.toFixed(4)}/wk over ${impl.n} files`);
console.log(`  ratio impl/iface: ${(impl.mean / iface.mean).toFixed(2)}x`);

const rules = group(".claude/rules/*.md", (p) => p.startsWith(".claude/rules/") && p.endsWith(".md"));
const research = group("docs/research/*.md", (p) => p.startsWith("docs/research/") && p.endsWith(".md"));
console.log(`\nOBSERVATION [docs — not a Parnas pair]:`);
console.log(`  ${rules.name}: mean ${rules.mean.toFixed(4)}/wk over ${rules.n} files (living hubs — re-carved)`);
console.log(`  ${research.name}: mean ${research.mean.toFixed(4)}/wk over ${research.n} files (append-once archive)`);
console.log(
  `  reading: research ferries are written once and frozen (rate → 0 with age); rules are the\n` +
  `  factory's living carved surface. Low archive rate is the ARCHIVE contract holding, not a\n` +
  `  hub/satellite inversion — the satellite axis for rules is rules.bak + the docs they point to.`,
);

console.log(
  "\n(Interpretation per docs/research/2026-06-12-dv2-hub-stability-and-the-forced-shape-math-team-REPORT-4.md §2/§5.)",
);
