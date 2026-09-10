#!/usr/bin/env bun
/**
 * repo-split-cut-cost.ts — measure the cut cost of a candidate repo split.
 *
 * Builds a file-level dependency graph over the tree (TypeScript relative
 * imports, MSBuild `ProjectReference`, Cargo `path =` dependencies), projects
 * it onto a candidate component assignment, and reports, per component:
 *
 *   - files, and how many of the graph's nodes they are
 *   - out-edges (this component depends on N files elsewhere)
 *   - in-edges  (N files elsewhere depend on this component)
 *   - the per-pair crossing counts, and which pairs are CYCLIC
 *
 * A component pair with edges in both directions is a cycle at the repo
 * boundary: it is not a boundary at all until one direction is broken. Those
 * pairs are printed with their witness edges so they can be broken by name.
 *
 * This is a MEASUREMENT, not a refactor. It moves nothing.
 *
 * Honest limits, stated so a reader does not over-read the output:
 *   - Only three edge kinds are read. Runtime coupling that travels by
 *     `Bun.spawn`, shell-out, file path, HTTP, or a documented convention is
 *     INVISIBLE here and is counted nowhere. A component reported with zero
 *     out-edges is "zero *static* out-edges", never "independent".
 *   - Bare-specifier imports (npm packages, `#`-imports) are ignored; only
 *     relative and rooted-in-repo specifiers become edges.
 *   - `docs/recovered-orphan-branches-*` and `references/` are excluded:
 *     preserved copies of other trees, not this tree's code.
 *
 * Usage:
 *   bun src/Core.TypeScript/research/repo-split-cut-cost.ts            # table
 *   bun src/Core.TypeScript/research/repo-split-cut-cost.ts --json     # machine
 *   bun src/Core.TypeScript/research/repo-split-cut-cost.ts --cycles   # witnesses
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, relative, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "..", "..", "..");

const EXCLUDED_PREFIXES = [
  "docs/recovered-orphan-branches-",
  "docs/recovered/",
  "references/",
  "node_modules/",
];

/**
 * The candidate components. Order matters: the FIRST matching prefix wins, so
 * more specific prefixes are listed before the trees that contain them.
 *
 * `rest` is everything unclaimed — deliberately kept as one bucket so the
 * "what stays behind" number is honest rather than hidden in a long tail.
 */
export interface Component {
  readonly name: string;
  readonly prefixes: readonly string[];
}

export const T = "src/Core.TypeScript/";

export const CANDIDATES: readonly Component[] = [
  {
    name: "ace",
    prefixes: [
      T + "ace/",
      "src/Core.CSharp.AceCanonical/",
      "src/Core.FSharp.AceCanonical/",
      "src/Core.Rust.AceCanonical/",
    ],
  },
  {
    name: "harness",
    prefixes: [
      T + "agent-bus/",
      T + "agent-heartbeats/",
      T + "agent-loops/",
      T + "orchestrator/",
      T + "orchestrator-checks/",
      T + "swarm/",
      T + "swarm-society/",
      T + "workflow-engine/",
      T + "forge-host/",
      T + "harny/",
      T + "model-backend/",
      T + "claude-hooks/",
      T + "claude-code-recovery/",
      T + "cursor/",
      T + "routines/",
      T + "peer-call/",
      T + "shadow/",
      T + "shadow-outlet/",
      T + "lanes/",
      T + "bg/",
      T + "observe/",
      T + "bus/",
      T + "corporate/",
      T + "drift-dashboard/",
      T + "tick-dial/",
      "src/SwarmRunner/",
      ".claude/",
      ".codex/",
      ".cursor/",
      ".gemini/",
      "hooks/",
      "hats/",
    ],
  },
  { name: "zflash", prefixes: [T + "zflash/", T + "installer/", T + "pam/"] },
  {
    name: "zetadb",
    prefixes: [T + "zetadb/", T + "browser-node/", T + "persistence/"],
  },
  {
    name: "zetafs",
    prefixes: [T + "dag-fs/", "experiments/zetafs-webdav/"],
  },
  {
    name: "k8s",
    prefixes: [
      "full-ai-cluster/",
      "infra/",
      "infrastructure/",
      "agentic-organization/",
      T + "cluster/",
    ],
  },
  { name: "hygiene", prefixes: [T + "hygiene/", T + "lint/"] },
  {
    name: "formal",
    prefixes: [
      "src/Core.Lean4/",
      "src/Core.Lean4.Cslib/",
      "src/Core.TLA/",
      "src/Core.Alloy/",
      "src/Core.Agda/",
      "src/Core.FSharp.Z3Verify/",
      "src/Core.QSharp.ReferenceOracle/",
    ],
  },
  { name: "wasm", prefixes: ["src/wasm-dla/"] },
  {
    name: "archive",
    prefixes: [
      "docs/history/",
      "docs/github/",
      "docs/pr-discussions/",
      "docs/recovered-orphan-branches-2026-05/",
      "docs/recovered/",
    ],
  },
  {
    name: "telemetry",
    prefixes: ["docs/observe-events/", "docs/drift-events/", "data/", "db/"],
  },
  {
    name: "english",
    prefixes: [
      "docs/research/",
      "docs/books/",
      "docs/letters/",
      "memory/",
      "vocab/",
      "universal/",
    ],
  },
  {
    name: "backlog",
    prefixes: ["docs/backlog/", "workitems/", "agendas/", "openspec/"],
  },
  { name: "tests", prefixes: ["tests/", "bench/"] },
  { name: "docs-other", prefixes: ["docs/"] },
  { name: "rest", prefixes: [""] },
];

export function assign(
  path: string,
  components: readonly Component[] = CANDIDATES,
): string {
  for (const c of components) {
    for (const p of c.prefixes) {
      if (p === "" || path.startsWith(p)) return c.name;
    }
  }
  return "rest";
}

function tracked(): string[] {
  const out = execFileSync("git", ["ls-files", "-z"], {
    cwd: REPO_ROOT,
    maxBuffer: 512 * 1024 * 1024,
    encoding: "utf8",
  });
  return out.split("\u0000").filter((f) => f.length > 0);
}

export interface Edge {
  readonly from: string;
  readonly to: string;
  readonly kind: "ts" | "msbuild" | "cargo";
}

// ---------------------------------------------------------------- TypeScript

const TS_EXT = [".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs"];

function resolveTs(fromFile: string, spec: string): string | null {
  if (!spec.startsWith(".") && !spec.startsWith("/")) return null;
  const base = spec.startsWith("/")
    ? join(REPO_ROOT, spec)
    : resolve(REPO_ROOT, dirname(fromFile), spec);
  const rel = (p: string) => normalize(relative(REPO_ROOT, p));
  // Exact hit first (a specifier that already carries its extension).
  if (existsSync(base) && statSync(base).isFile()) return rel(base);
  // `./x.js` in a TS tree means `./x.ts` on disk.
  for (const ext of TS_EXT) {
    if (base.endsWith(ext)) {
      const stem = base.slice(0, -ext.length);
      for (const alt of TS_EXT) {
        if (existsSync(stem + alt)) return rel(stem + alt);
      }
    }
  }
  for (const ext of TS_EXT) {
    if (existsSync(base + ext)) return rel(base + ext);
  }
  for (const ext of TS_EXT) {
    const idx = join(base, "index" + ext);
    if (existsSync(idx)) return rel(idx);
  }
  return null;
}

const IMPORT_RE =
  /(?:^|[\s;}])(?:import|export)\s+(?:[^'"()]*?\sfrom\s+)?["']([^"']+)["']/g;
const DYNAMIC_RE = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
const REQUIRE_RE = /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g;

function tsEdges(files: string[]): Edge[] {
  const edges: Edge[] = [];
  const isTs = (f: string) => TS_EXT.some((e) => f.endsWith(e));
  for (const f of files) {
    if (!isTs(f)) continue;
    let src: string;
    try {
      src = readFileSync(join(REPO_ROOT, f), "utf8");
    } catch {
      continue;
    }
    const specs = new Set<string>();
    for (const re of [IMPORT_RE, DYNAMIC_RE, REQUIRE_RE]) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src)) !== null) specs.add(m[1]!);
    }
    for (const spec of specs) {
      const to = resolveTs(f, spec);
      if (to !== null && to !== f) edges.push({ from: f, to, kind: "ts" });
    }
  }
  return edges;
}

// ------------------------------------------------------------------- MSBuild

const PROJREF_RE = /<ProjectReference\s+Include\s*=\s*"([^"]+)"/g;

function msbuildEdges(files: string[]): Edge[] {
  const edges: Edge[] = [];
  for (const f of files) {
    if (!/\.(fs|cs|vb)proj$/.test(f)) continue;
    let src: string;
    try {
      src = readFileSync(join(REPO_ROOT, f), "utf8");
    } catch {
      continue;
    }
    PROJREF_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = PROJREF_RE.exec(src)) !== null) {
      const raw = m[1]!.replace(/\\/g, "/");
      const abs = resolve(REPO_ROOT, dirname(f), raw);
      const rel = normalize(relative(REPO_ROOT, abs));
      if (existsSync(abs)) edges.push({ from: f, to: rel, kind: "msbuild" });
    }
  }
  return edges;
}

// --------------------------------------------------------------------- Cargo

const CARGO_PATH_RE = /path\s*=\s*"([^"]+)"/g;

function cargoEdges(files: string[]): Edge[] {
  const edges: Edge[] = [];
  for (const f of files) {
    if (!f.endsWith("Cargo.toml")) continue;
    let src: string;
    try {
      src = readFileSync(join(REPO_ROOT, f), "utf8");
    } catch {
      continue;
    }
    CARGO_PATH_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = CARGO_PATH_RE.exec(src)) !== null) {
      const abs = resolve(REPO_ROOT, dirname(f), m[1]!, "Cargo.toml");
      const rel = normalize(relative(REPO_ROOT, abs));
      if (existsSync(abs) && rel !== f)
        edges.push({ from: f, to: rel, kind: "cargo" });
    }
  }
  return edges;
}

// ------------------------------------------------------------------ analysis

export interface PairStat {
  readonly a: string;
  readonly b: string;
  readonly aToB: number;
  readonly bToA: number;
  readonly cyclic: boolean;
}

export interface Report {
  readonly files: number;
  readonly edges: number;
  readonly perComponent: Record<
    string,
    { files: number; internal: number; out: number; in: number }
  >;
  readonly pairs: PairStat[];
}

export function analyse(
  files: string[],
  edges: Edge[],
  components: readonly Component[] = CANDIDATES,
): Report {
  const compOf = new Map<string, string>();
  for (const f of files) compOf.set(f, assign(f, components));

  const per: Record<
    string,
    { files: number; internal: number; out: number; in: number }
  > = {};
  for (const c of components)
    per[c.name] = { files: 0, internal: 0, out: 0, in: 0 };
  for (const f of files) {
    const c = compOf.get(f)!;
    (per[c] ??= { files: 0, internal: 0, out: 0, in: 0 }).files += 1;
  }

  const pairCount = new Map<string, number>();
  for (const e of edges) {
    const a = compOf.get(e.from);
    const b = compOf.get(e.to);
    if (a === undefined || b === undefined) continue;
    if (a === b) {
      per[a]!.internal += 1;
      continue;
    }
    per[a]!.out += 1;
    per[b]!.in += 1;
    const k = `${a}\u0000${b}`;
    pairCount.set(k, (pairCount.get(k) ?? 0) + 1);
  }

  const seen = new Set<string>();
  const pairs: PairStat[] = [];
  for (const k of pairCount.keys()) {
    const [a, b] = k.split("\u0000") as [string, string];
    const key = [a, b].sort().join("\u0000");
    if (seen.has(key)) continue;
    seen.add(key);
    const aToB = pairCount.get(`${a}\u0000${b}`) ?? 0;
    const bToA = pairCount.get(`${b}\u0000${a}`) ?? 0;
    pairs.push({ a, b, aToB, bToA, cyclic: aToB > 0 && bToA > 0 });
  }
  pairs.sort((x, y) => y.aToB + y.bToA - (x.aToB + x.bToA));

  return { files: files.length, edges: edges.length, perComponent: per, pairs };
}

/**
 * Edges are extracted only from files OUTSIDE `EXCLUDED_PREFIXES`. Those trees
 * are preserved copies of other checkouts (round 2's Cut A material), so their
 * import statements describe a tree that no longer exists; reading them would
 * manufacture edges the live repo does not have. They still appear in the file
 * counts and in the change-rate fold, where they are real.
 */
export function buildEdges(files: string[]): Edge[] {
  const live = files.filter(
    (f) => !EXCLUDED_PREFIXES.some((p) => f.startsWith(p)),
  );
  return [...tsEdges(live), ...msbuildEdges(live), ...cargoEdges(live)];
}

function main(): void {
  const argv = process.argv.slice(2);
  const files = tracked();
  const edges = buildEdges(files);
  const report = analyse(files, edges);

  if (argv.includes("--json")) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    return;
  }

  const compOf = new Map<string, string>();
  for (const f of files) compOf.set(f, assign(f));

  process.stdout.write(
    `tracked files: ${report.files}\n` +
      `static edges (ts + msbuild + cargo): ${report.edges}\n\n`,
  );

  process.stdout.write(
    "component   files   internal-edges   out-edges   in-edges\n",
  );
  for (const [name, s] of Object.entries(report.perComponent)) {
    process.stdout.write(
      `${name.padEnd(11)} ${String(s.files).padStart(5)}   ` +
        `${String(s.internal).padStart(14)}   ${String(s.out).padStart(9)}   ` +
        `${String(s.in).padStart(8)}\n`,
    );
  }

  process.stdout.write("\ncrossing pairs (a<->b), cyclic marked *:\n");
  for (const p of report.pairs) {
    process.stdout.write(
      `${p.cyclic ? "*" : " "} ${p.a} -> ${p.b}: ${p.aToB}   ` +
        `${p.b} -> ${p.a}: ${p.bToA}\n`,
    );
  }

  if (argv.includes("--cycles")) {
    process.stdout.write("\ncycle witnesses (the edges that must be broken):\n");
    for (const p of report.pairs.filter((q) => q.cyclic)) {
      process.stdout.write(`\n== ${p.a} <-> ${p.b} ==\n`);
      for (const dir of [
        [p.a, p.b],
        [p.b, p.a],
      ] as const) {
        const w = edges.filter(
          (e) => compOf.get(e.from) === dir[0] && compOf.get(e.to) === dir[1],
        );
        process.stdout.write(`  ${dir[0]} -> ${dir[1]} (${w.length}):\n`);
        for (const e of w.slice(0, 40))
          process.stdout.write(`    ${e.from}  ->  ${e.to}\n`);
        if (w.length > 40)
          process.stdout.write(`    ... ${w.length - 40} more\n`);
      }
    }
  }
}

if (import.meta.main) main();
