/**
 * Extract the real graphs this repo actually has, and measure whether any of them is hyperbolic
 * (Lumen, 2026-08-20).
 *
 * Run:  bun src/Core.TypeScript/research/repo-graph-hyperbolicity.ts
 *
 * Five graphs are extracted, chosen because they are the repo's genuine structural relations
 * rather than ones invented for the measurement:
 *
 *   1. ts-imports   -- relative `import ... from "./x"` edges between TypeScript modules
 *   2. fs-modules   -- `open Zeta.*` and qualified `Module.member` references between F# modules
 *   3. docs-links   -- relative markdown links between files under docs/
 *   4. skills       -- markdown links inside .claude/skills and .claude/rules
 *   5. commit-dag   -- git parent edges over the last N commits
 *
 * The workitem dependency graph is NOT among them, and that is a measured fact rather than an
 * omission: 303 of 311 `workitems/*.md` carry `depends_on: []`, so the graph has 8 non-isolated
 * nodes and cannot support a four-point estimate. Search terms used to establish this:
 * `^depends_on:`, `^blocked_by:`, `^blocks:`, `^parent:` across `workitems/*.md`.
 *
 * Every graph is reported against BOTH nulls (Erdos-Renyi at matched n,m and a degree-preserving
 * configuration model), because a small delta on its own identifies nothing -- see the header of
 * `gromov-hyperbolicity.ts`.
 */

import { readdirSync, readFileSync, type Dirent } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import {
  articulationPoints,
  balancedTree,
  configurationNull,
  cycle,
  degrees,
  edgeCount,
  erdosRenyiNull,
  fitPowerLaw,
  type Graph,
  graphFromEdges,
  grid,
  largestComponent,
  sampleDelta,
} from "./gromov-hyperbolicity.ts";

const ROOT = resolve(import.meta.dir, "../../..");
const SAMPLES = 400_000;
const SEED = 0x5e3da20260820n;

/**
 * The commit the measurement ran against. Load-bearing for honesty: the estimator is
 * deterministic given a graph, but the graph is the live repo and the repo grows. A first run
 * and a re-run six commits later differ in `n` and in every commit-DAG row -- which is not
 * non-determinism, it is a different input. Quoting a number without this SHA is quoting a
 * measurement of an object that no longer exists.
 */
const REPO_SHA = (() => {
  try {
    const p = Bun.spawnSync(["git", "rev-parse", "--short", "HEAD"], { cwd: ROOT });
    return new TextDecoder().decode(p.stdout).trim() || "unknown";
  } catch {
    return "unknown";
  }
})();

function walk(dir: string, pred: (p: string) => boolean, out: string[] = [], depth = 0): string[] {
  if (depth > 12) return out;
  // `withFileTypes` so the KIND arrives with the listing. A `readdirSync` then
  // `statSync` pair asks the filesystem twice: an entry can vanish or change kind
  // between the two, and the second call is racing an answer the first already had.
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const e = entry.name;
    if (e === "node_modules" || e === ".git" || e === "prior-art" || e === "bin" || e === "obj") continue;
    const p = join(dir, e);
    if (entry.isDirectory()) walk(p, pred, out, depth + 1);
    else if (entry.isFile() && pred(p)) out.push(p);
  }
  return out;
}

// -- 1. TypeScript import graph ----------------------------------------------------------------

function tsImportGraph(): Graph {
  const files = walk(join(ROOT, "src"), (p) => p.endsWith(".ts") && !p.endsWith(".d.ts"));
  const known = new Set(files.map((f) => relative(ROOT, f)));
  const edges: [string, string][] = [];
  const re = /(?:^|\n)\s*(?:import|export)[^\n;]*?from\s+["'](\.[^"']+)["']/g;
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    const from = relative(ROOT, f);
    for (const m of src.matchAll(re)) {
      const spec = m[1]!;
      const base = resolve(dirname(f), spec);
      for (const cand of [base, `${base}.ts`, join(base, "index.ts"), base.replace(/\.js$/, ".ts")]) {
        const rel = relative(ROOT, cand);
        if (known.has(rel)) {
          edges.push([from, rel]);
          break;
        }
      }
    }
  }
  return graphFromEdges(edges, [...known]);
}

// -- 2. F# module reference graph --------------------------------------------------------------

function fsModuleGraph(): Graph {
  const files = walk(join(ROOT, "src"), (p) => p.endsWith(".fs"));
  // module name -> file
  const moduleOf = new Map<string, string>();
  const contents = new Map<string, string>();
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    contents.set(f, src);
    const m = src.match(/^\s*(?:\[<RequireQualifiedAccess>\]\s*)?module\s+([A-Za-z0-9_.]+)/m);
    const name = m ? m[1]!.split(".").pop()! : f.split("/").pop()!.replace(/\.fs$/, "");
    if (!moduleOf.has(name)) moduleOf.set(name, relative(ROOT, f));
  }
  const edges: [string, string][] = [];
  for (const f of files) {
    const from = relative(ROOT, f);
    const src = contents.get(f)!;
    for (const [name, target] of moduleOf) {
      if (target === from) continue;
      if (name.length < 4) continue; // too short to be an unambiguous qualified reference
      // A qualified use `Name.` outside of comments, or an explicit open.
      const used = new RegExp(`(?:^|[^A-Za-z0-9_.\\/])${name}\\.[A-Za-z_]`).test(src);
      if (used) edges.push([from, target]);
    }
  }
  return graphFromEdges(edges, [...moduleOf.values()]);
}

// -- 3. docs markdown link graph ---------------------------------------------------------------

function docsLinkGraph(): Graph {
  const files = walk(join(ROOT, "docs"), (p) => p.endsWith(".md"));
  const known = new Set(files.map((f) => relative(ROOT, f)));
  const edges: [string, string][] = [];
  const re = /\]\(([^)\s#]+\.md)(?:#[^)]*)?\)/g;
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    const from = relative(ROOT, f);
    for (const m of src.matchAll(re)) {
      const target = relative(ROOT, resolve(dirname(f), m[1]!));
      if (known.has(target) && target !== from) edges.push([from, target]);
    }
  }
  return graphFromEdges(edges, [...known]);
}

// -- 4. skills + rules link graph --------------------------------------------------------------

function skillsGraph(): Graph {
  const files = [
    ...walk(join(ROOT, ".claude/skills"), (p) => p.endsWith(".md")),
    ...walk(join(ROOT, ".claude/rules"), (p) => p.endsWith(".md")),
    ...walk(join(ROOT, ".claude/agents"), (p) => p.endsWith(".md")),
  ];
  const known = new Set(files.map((f) => relative(ROOT, f)));
  const edges: [string, string][] = [];
  const re = /\]\(([^)\s#]+\.md)(?:#[^)]*)?\)/g;
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    const from = relative(ROOT, f);
    for (const m of src.matchAll(re)) {
      const target = relative(ROOT, resolve(dirname(f), m[1]!));
      if (known.has(target) && target !== from) edges.push([from, target]);
    }
  }
  return graphFromEdges(edges, [...known]);
}

// -- 5. git commit DAG -------------------------------------------------------------------------

async function commitDagGraph(limit = 20_000): Promise<Graph> {
  const proc = Bun.spawn(["git", "log", `-n${limit}`, "--format=%h %p", "HEAD"], { cwd: ROOT, stdout: "pipe" });
  const text = await new Response(proc.stdout).text();
  const edges: [string, string][] = [];
  const nodes: string[] = [];
  for (const line of text.split("\n")) {
    const parts = line.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) continue;
    const [child, ...parents] = parts;
    nodes.push(child!);
    for (const p of parents) edges.push([child!, p]);
  }
  return graphFromEdges(edges, nodes);
}

// -- reporting ---------------------------------------------------------------------------------

interface Stat {
  readonly mean: number;
  readonly lo: number;
  readonly hi: number;
}

function stat(xs: readonly number[]): Stat {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return { mean, lo: Math.min(...xs), hi: Math.max(...xs) };
}

interface Row {
  name: string;
  n: number;
  m: number;
  lccN: number;
  diam: number;
  delta: number;
  /** 2*delta_max/diam -- an EXTREME-value statistic, hence noisy. */
  deltaRel: number;
  /** delta_mean/diam -- the stable comparator, and the one the verdict is read off. */
  deltaMeanRel: number;
  erRel: Stat;
  erMeanRel: Stat;
  erDiam: Stat;
  cfgRel: Stat;
  cfgMeanRel: Stat;
  cfgDiam: Stat;
  alpha: number | null;
  ks: number | null;
  xMin: number | null;
  diverged: boolean;
  /** Cut vertices of the LCC: the nodes that are hubs in the strict (must-route-through) sense. */
  cuts: number;
  /** Highest-degree node of the LCC, and whether it is a cut vertex. Degree is not the test. */
  topDegree: number;
  topIsCut: boolean;
  topLabel: string;
}

/** Null replicates. One draw from a null is a sample of size 1; comparing to it is not a test. */
const REPLICATES = 7;

function measure(name: string, g: Graph): Row {
  const lcc = largestComponent(g);
  const m = edgeCount(lcc);
  const r = sampleDelta(lcc, SAMPLES, SEED);
  const relOf = (x: ReturnType<typeof sampleDelta>): number => x.deltaRelative;
  const meanRelOf = (x: ReturnType<typeof sampleDelta>): number =>
    x.diameterObserved > 0 ? x.deltaMean / x.diameterObserved : 0;

  const erRuns: ReturnType<typeof sampleDelta>[] = [];
  const cfgRuns: ReturnType<typeof sampleDelta>[] = [];
  for (let k = 0; k < REPLICATES; k++) {
    const off = BigInt(k) * 1000n;
    const er = largestComponent(erdosRenyiNull(lcc.n, m, SEED + 1n + off));
    const cfg = largestComponent(configurationNull(lcc, SEED + 2n + off));
    erRuns.push(sampleDelta(er, SAMPLES, SEED + 3n + off));
    cfgRuns.push(sampleDelta(cfg, SAMPLES, SEED + 4n + off));
  }
  const fit = fitPowerLaw(degrees(lcc).filter((d) => d > 0));
  const cutSet = new Set(articulationPoints(lcc));
  const degs = degrees(lcc);
  let top = 0;
  for (let i = 1; i < lcc.n; i++) if (degs[i]! > degs[top]!) top = i;
  return {
    name,
    n: g.n,
    m: edgeCount(g),
    lccN: lcc.n,
    diam: r.diameterObserved,
    delta: r.deltaMaxObserved,
    deltaRel: r.deltaRelative,
    deltaMeanRel: meanRelOf(r),
    erRel: stat(erRuns.map(relOf)),
    erMeanRel: stat(erRuns.map(meanRelOf)),
    erDiam: stat(erRuns.map((x) => x.diameterObserved)),
    cfgRel: stat(cfgRuns.map(relOf)),
    cfgMeanRel: stat(cfgRuns.map(meanRelOf)),
    cfgDiam: stat(cfgRuns.map((x) => x.diameterObserved)),
    alpha: fit?.alpha ?? null,
    ks: fit?.ks ?? null,
    xMin: fit?.xMin ?? null,
    diverged: fit?.diverged ?? false,
    cuts: cutSet.size,
    topDegree: lcc.n > 0 ? degs[top]! : 0,
    topIsCut: cutSet.has(top),
    topLabel: lcc.labels?.[top] ?? String(top),
  };
}

function fmt(x: number | null, d = 3): string {
  return x === null ? "--" : x.toFixed(d);
}

function band(s: Stat, d = 3): string {
  return `${s.mean.toFixed(d)}[${s.lo.toFixed(d)}-${s.hi.toFixed(d)}]`;
}

const rows: Row[] = [];

// Calibration anchors go in the SAME table as the repo graphs. A measurement you cannot compare
// to a known answer is not a measurement.
rows.push(measure("ANCHOR balanced-tree(3,6)", balancedTree(3, 6)));
rows.push(measure("ANCHOR grid(30)", grid(30)));
rows.push(measure("ANCHOR cycle(200)", cycle(200)));

rows.push(measure("ts-imports", tsImportGraph()));
rows.push(measure("fs-modules", fsModuleGraph()));
rows.push(measure("docs-links", docsLinkGraph()));
rows.push(measure("skills+rules", skillsGraph()));
rows.push(measure("commit-dag", await commitDagGraph()));

for (const r of rows) {
  console.log(`\n### ${r.name}`);
  console.log(`    n=${r.n}  m=${r.m}  lcc=${r.lccN}  diam>=${r.diam}  delta_max_obs=${r.delta}`);
  console.log(`    d_rel      = ${fmt(r.deltaRel)}   vs ER ${band(r.erRel)}   vs CFG ${band(r.cfgRel)}`);
  console.log(
    `    d_meanRel  = ${fmt(r.deltaMeanRel, 4)}   vs ER ${band(r.erMeanRel, 4)}   vs CFG ${band(r.cfgMeanRel, 4)}`,
  );
  const alphaNote =
    r.alpha === null
      ? "refused (degenerate tail)"
      : r.diverged
        ? `${fmt(r.alpha, 2)} DIVERGED - not a power law`
        : `${fmt(r.alpha, 2)} (KS=${fmt(r.ks, 3)}, xmin=${fmt(r.xMin, 0)})`;
  console.log(`    degree fit = ${alphaNote}`);
  console.log(`    diam       : graph ${r.diam}   ER ${band(r.erDiam, 1)}   CFG ${band(r.cfgDiam, 1)}`);
  // The verdict, computed rather than narrated -- and it REFUSES more often than it concludes.
  //
  // Two guards, both installed after the grid ANCHOR was misclassified as "more hyperbolic than
  // its null" (2026-08-20). A grid is the canonical FLAT space, so that verdict was wrong, and
  // it was wrong for a reason worth carrying:
  //
  //   (a) DIAMETER CONFOUND. Randomising a grid collapses its diameter from ~56 to ~6. Any
  //       quantity divided by "its own diameter" is then comparing two different scales, so a
  //       null whose diameter differs by more than 1.5x cannot be compared to at all.
  //   (b) STATISTIC DISAGREEMENT. d_rel (extreme value) and d_meanRel (bulk) can point opposite
  //       ways. When they do, there is no signal -- there is one number that flatters the
  //       hypothesis and another that does not.
  const diamRatio = r.cfgDiam.mean > 0 ? r.diam / r.cfgDiam.mean : Infinity;
  const relVerdict = r.deltaRel < r.cfgRel.lo ? -1 : r.deltaRel > r.cfgRel.hi ? 1 : 0;
  const meanVerdict = r.deltaMeanRel < r.cfgMeanRel.lo ? -1 : r.deltaMeanRel > r.cfgMeanRel.hi ? 1 : 0;
  if (r.deltaMeanRel === 0 && r.cfgMeanRel.hi === 0) {
    console.log(`    VERDICT    : DEGENERATE - delta is identically 0 in graph AND null; no information`);
  } else if (diamRatio > 1.5 || diamRatio < 1 / 1.5) {
    console.log(
      `    VERDICT    : INCOMPARABLE - null diameter differs by ${diamRatio.toFixed(1)}x; delta/diam is not a valid comparator here`,
    );
  } else if (relVerdict !== meanVerdict) {
    console.log(`    VERDICT    : NO SIGNAL - d_rel and d_meanRel disagree (${relVerdict} vs ${meanVerdict})`);
  } else if (relVerdict === -1) {
    console.log(`    VERDICT    : MORE hyperbolic than its degree-preserving null (both statistics agree)`);
  } else if (relVerdict === 1) {
    console.log(`    VERDICT    : LESS hyperbolic than its degree-preserving null (both statistics agree)`);
  } else {
    console.log(`    VERDICT    : INSIDE the null band - the degree sequence explains it; hyperbolicity adds nothing`);
  }
  // Placement on the anchor scale is the reading that IS valid within a single graph.
  const scale =
    r.deltaRel < 0.05
      ? "tree-like (0.00)"
      : r.deltaRel < 0.35
        ? "between tree and grid, tree side"
        : r.deltaRel < 0.7
          ? "between tree and grid, middle"
          : "grid/cycle-like (flat, NOT hyperbolic)";
  console.log(
    `    cut-vertices: ${r.cuts}/${r.lccN} (${((100 * r.cuts) / Math.max(1, r.lccN)).toFixed(1)}% are must-route-through hubs; the rest are routable-around oracles)`,
  );
  console.log(`    top-degree  : ${r.topDegree} (${r.topLabel}) -- ${r.topIsCut ? "IS" : "is NOT"} a cut vertex`);
  console.log(`    anchor-scale: d_rel ${r.deltaRel.toFixed(3)} -> ${scale}   [tree 0.000 | grid 0.821 | cycle 0.980]`);
}

console.log();
console.log(`samples/graph = ${SAMPLES}, null replicates = ${REPLICATES}, seed = 0x${SEED.toString(16)}`);
console.log("DETERMINISM, stated precisely: the ESTIMATOR is seeded and replays exactly on a FIXED graph.");
console.log("The INPUT is the live repo, which grows -- so n, m and the commit-DAG rows move between runs.");
console.log("Pin results to a commit SHA when quoting them. This run:", REPO_SHA);
console.log(
  "d_rel = 2*delta_max/diam (extreme-value, noisy). d_meanRel = delta_mean/diam (stable; the verdict uses this).",
);
console.log("Sampled delta is a LOWER BOUND on delta_max: a large value CONVICTS, a small value never ACQUITS.");
