#!/usr/bin/env bun
// measure-triangle-corners.ts — the meter for a goal that had none.
//
// WHY THIS FILE EXISTS
// --------------------
// Aaron, 2026-09-06: "we have generator plus joins plus observability, and over time we want
// this triangle to move more data points to generators over observability, because
// observability costs more."
//
// That is a DIRECTION OF TRAVEL, and a direction with no instrument is an aspiration. Stated
// without a meter it can only ever be asserted, never checked, and this repo's standing
// refusal is that an unfalsifiable claim looks exactly like a satisfied one. So this file
// measures where the tracked bytes actually sit, and — the part that matters — how the
// composition MOVES between two revisions.
//
// WHAT IT IS NOT
// --------------
// It is not a cost model. Aaron's claim is that observability costs more; that is a claim about
// storage, re-reading, staleness and re-verification, and this measures NONE of those. It
// measures byte composition, which is a proxy that can be wrong in both directions (a tiny
// baseline file can cost enormous attention; a large generated table can cost nothing). The
// proxy is named here so it cannot be quoted as the cost measurement it is not.
//
// THE CLASSIFICATION IS THE ARGUABLE PART, SO IT IS PUBLISHED
// ----------------------------------------------------------
// A meter is good when anyone can inspect it and agree to its rules before the measurement
// (`.claude/rules/dual-use-detection-is-neutral-oracle-decides.md`). The rules are the exported
// `RULES` table below, first-match-wins, each with the reason it is where it is. Disagree with a
// row and the number changes — that is the intended failure mode, not a defect.
//
// Two classification calls worth arguing with up front:
//
//   * TESTS ARE GENERATORS, baselines and golden vectors are OBSERVABILITY. A test re-derives
//     its verdict on every run; a golden vector is a retained data point the test compares
//     against. This follows the diode in the research doc — an executable artifact is a
//     generator the next run can execute, a stored one is a point.
//
//   * PROSE IS REPORTED SEPARATELY, not folded into observability. The research doc argues
//     prose is an observation ABOUT a generator, which would put `docs/**` in the expensive
//     corner and make the headline ratio swing on the most contested call in the table. Folding
//     it in would let the classification decide the result. It is counted, shown, and left out
//     of the ratio.
//
// REFUSALS
// --------
//   * unclassified bytes over MAX_UNCLASSIFIED_FRACTION — a number computed over a tree the
//     rules do not cover is not a measurement of that tree. It names the largest uncovered
//     directories so the table can be extended.
//   * `--since <rev>` against a rev that does not resolve.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/measure-triangle-corners.ts [--at <rev>] [--since <rev>] [--json]

import { spawnSync } from "node:child_process";

export type Corner = "generator" | "joins" | "observability" | "prose" | "excluded" | "unclassified";

export interface Rule {
  readonly corner: Corner;
  readonly pattern: RegExp;
  readonly why: string;
}

/**
 * First match wins. Order is part of the measurement — a path matching two rows is counted
 * under the earlier one, so the specific exceptions are listed above the broad sweeps.
 */
export const RULES: readonly Rule[] = [
  // --- observability: retained data points, specific enough to outrank the sweeps below ---
  { corner: "observability", pattern: /(^|\/)testdata\//, why: "retained fixtures a check compares against" },
  { corner: "observability", pattern: /(^|\/)__snapshots__\//, why: "retained snapshots" },
  { corner: "observability", pattern: /\.snap$/, why: "retained snapshot" },
  { corner: "observability", pattern: /golden-?vectors?[^/]*\.json$/i, why: "the byte-lock treaty's retained points" },
  { corner: "observability", pattern: /golden-seed[^/]*\.json$/i, why: "retained seed vectors" },
  { corner: "observability", pattern: /\.baseline\.json$/, why: "retained baseline an audit compares against" },
  { corner: "observability", pattern: /BASELINE[^/]*\.md$/, why: "retained baseline, prose-shaped but a data point" },
  { corner: "observability", pattern: /^db\//, why: "the ledgers — stored facts" },
  { corner: "observability", pattern: /^workitems\/events\//, why: "the event log — stored facts" },
  { corner: "observability", pattern: /^docs\/history\//, why: "the PR-review archive — retained observations" },
  { corner: "observability", pattern: /^docs\/recovered/, why: "preserved observations" },
  { corner: "observability", pattern: /^docs\/github\//, why: "captured GitHub state — retained facts" },
  { corner: "observability", pattern: /^docs\/observe-events\//, why: "captured events — retained facts" },
  { corner: "observability", pattern: /^docs\/hygiene-history\//, why: "captured audit history — retained facts" },
  { corner: "observability", pattern: /^data\//, why: "measured datasets — retained points" },
  { corner: "observability", pattern: /^memory\//, why: "retained observations" },
  { corner: "observability", pattern: /\.(jsonl|csv|tsv|dot)$/i, why: "record-per-line or tabular data — points, not rules" },

  // --- joins: wiring and relationships ---
  { corner: "joins", pattern: /^\.github\/workflows\//, why: "wiring: which check runs where" },
  { corner: "joins", pattern: /[^/]*roster[^/]*\.json$/i, why: "declared relationship set" },
  { corner: "joins", pattern: /[^/]*consumers[^/]*\.json$/i, why: "declared relationship set" },
  { corner: "joins", pattern: /(^|\/)(package|bun|cargo|paket)\.(json|lock|toml)$/i, why: "dependency relationships" },
  // Caught by the reachability test: `package-lock.json` does not match `package.json`, so it
  // fell through the wiring rows into the residual-JSON sweep and was counted as observability.
  { corner: "joins", pattern: /(^|\/)(package-lock|npm-shrinkwrap|yarn)\.(json|lock)$/i, why: "resolved dependency graph" },
  { corner: "joins", pattern: /\.(sln|fsproj|csproj|props|targets)$/i, why: "build graph edges" },
  { corner: "joins", pattern: /^infra\/.*\.(ya?ml|json)$/, why: "declarative wiring between components" },
  { corner: "joins", pattern: /^full-ai-cluster\/.*\.(ya?ml|json)$/, why: "declarative wiring between components" },
  { corner: "joins", pattern: /^flake\.(nix|lock)$/, why: "pinned dependency graph" },
  { corner: "joins", pattern: /\.(lock|lockb)$/i, why: "pinned dependency graph" },
  { corner: "joins", pattern: /\.ya?ml$/i, why: "declarative configuration — wiring" },

  // --- generator: code that produces behaviour, tests included ---
  { corner: "generator", pattern: /\.(ts|tsx|js|mjs|cjs|fs|fsx|fsi|cs|rs|py|go|lean|nix|sh|wat|zig|c|h)$/, why: "executable: produces its output on demand" },
  { corner: "generator", pattern: /^gen\//, why: "the generators" },
  { corner: "generator", pattern: /\.(jsx|tla|als|cfg|wat|wasm|ml|mli|hs|kt|java|swift|rb|lua|sql)$/i, why: "executable or model-checkable: produces its result on demand" },
  // JSON beside code is fixture or captured data far more often than it is a rule; the
  // roster/consumers/lock/project rows above have already claimed the wiring cases.
  { corner: "observability", pattern: /\.json$/i, why: "residual JSON: fixtures and captured data, after wiring rows above" },

  // --- prose: counted, shown, excluded from the ratio (see header) ---
  { corner: "prose", pattern: /\.(md|mdx|txt|adoc)$/i, why: "narrative; contested corner, reported separately" },
  { corner: "prose", pattern: /\.pdf$/i, why: "third-party reference documents — narrative, not our data points" },

  // --- excluded: bytes that are in the tree but are not OUR points in any corner ---
  // Declared rather than silently swept, because moving them into a corner is how a meter
  // gets a flattering answer. Reported separately and kept out of every number.
  { corner: "excluded", pattern: /\.(jar|zip|gz|tgz|ico|gif|mp4|ttf|otf)$/i, why: "vendored or packaged binaries we did not author" },
  { corner: "excluded", pattern: /\.(png|jpe?g|svg|webp|woff2?|css)$/i, why: "presentation assets — no corner of the triangle" },
  { corner: "excluded", pattern: /\.html?$/i, why: "rendered presentation surface" },
];

/** A tree with more than this fraction unclassified is not measured, it is guessed at. */
export const MAX_UNCLASSIFIED_FRACTION = 0.2;

export function classify(path: string): { corner: Corner; why: string } {
  for (const rule of RULES) {
    if (rule.pattern.test(path)) return { corner: rule.corner, why: rule.why };
  }
  return { corner: "unclassified", why: "no rule matched" };
}

export interface CornerTotals {
  readonly bytes: number;
  readonly files: number;
}

export type Composition = Readonly<Record<Corner, CornerTotals>>;

export interface TreeEntry {
  readonly path: string;
  readonly bytes: number;
}

export function compose(entries: readonly TreeEntry[]): Composition {
  const out: Record<Corner, { bytes: number; files: number }> = {
    generator: { bytes: 0, files: 0 },
    joins: { bytes: 0, files: 0 },
    observability: { bytes: 0, files: 0 },
    prose: { bytes: 0, files: 0 },
    excluded: { bytes: 0, files: 0 },
    unclassified: { bytes: 0, files: 0 },
  };
  for (const e of entries) {
    const c = classify(e.path).corner;
    out[c].bytes += e.bytes;
    out[c].files += 1;
  }
  return out;
}

/** Excluded bytes are outside the measurement entirely, so they are not in the denominator. */
export function unclassifiedFraction(c: Composition): number {
  const total = (Object.keys(c) as Corner[])
    .filter((k) => k !== "excluded")
    .reduce((n, k) => n + c[k].bytes, 0);
  return total === 0 ? 0 : c.unclassified.bytes / total;
}

/**
 * The headline number: observability bytes per generator byte. Lower is the direction of
 * travel Aaron named. Returns null when there is no generator corner to divide by — an
 * undefined ratio must never be reported as zero.
 */
export function observabilityPerGenerator(c: Composition): number | null {
  return c.generator.bytes === 0 ? null : c.observability.bytes / c.generator.bytes;
}

/**
 * MDL's objective, in bytes: the total description length of the tree is the generator plus
 * the observations it has not (yet) subsumed. Rissanen's point is why the direction of travel
 * has an OPTIMUM rather than an endpoint — an over-fitted generator that is larger than the
 * data it replaces has made the description longer, not shorter. Prose and excluded bytes are
 * not part of the description of the data, so they are not in it.
 */
export function descriptionLength(c: Composition): number {
  return c.generator.bytes + c.observability.bytes;
}

const SPAWN_MAX_BUFFER = 256 * 1024 * 1024;

export function readTree(rev: string, cwd: string): readonly TreeEntry[] {
  const r = spawnSync("git", ["ls-tree", "-r", "-l", "--full-tree", rev], {
    cwd,
    encoding: "utf-8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  if (r.status !== 0) {
    throw new Error(`git ls-tree failed for rev '${rev}': ${(r.stderr ?? "").trim()}`);
  }
  const out: TreeEntry[] = [];
  for (const line of (r.stdout ?? "").split("\n")) {
    if (line.length === 0) continue;
    // <mode> <type> <sha> <size>\t<path>
    const tab = line.indexOf("\t");
    if (tab < 0) continue;
    const meta = line.slice(0, tab).split(/\s+/);
    const type = meta[1];
    const size = meta[3];
    if (type !== "blob" || size === undefined) continue;
    const bytes = Number.parseInt(size, 10);
    if (!Number.isFinite(bytes)) continue;
    out.push({ path: line.slice(tab + 1), bytes });
  }
  return out;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function topUnclassifiedDirs(entries: readonly TreeEntry[], limit: number): readonly { dir: string; bytes: number }[] {
  const acc = new Map<string, number>();
  for (const e of entries) {
    if (classify(e.path).corner !== "unclassified") continue;
    const slash = e.path.indexOf("/");
    const dir = slash < 0 ? "(root)" : e.path.slice(0, e.path.indexOf("/", slash + 1) < 0 ? slash : e.path.indexOf("/", slash + 1));
    acc.set(dir, (acc.get(dir) ?? 0) + e.bytes);
  }
  return [...acc.entries()]
    .map(([dir, bytes]) => ({ dir, bytes }))
    .sort((a, b) => (b.bytes !== a.bytes ? b.bytes - a.bytes : a.dir < b.dir ? -1 : a.dir > b.dir ? 1 : 0))
    .slice(0, limit);
}

function main(): number {
  const argv = process.argv.slice(2);
  // A flag whose value is missing must refuse rather than silently fall back — `--since` with
  // no rev would otherwise read as "no comparison requested", which is a check that did not run.
  const flagValue = (name: string): string | undefined => {
    const i = argv.indexOf(name);
    if (i < 0) return undefined;
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) {
      console.error(`REFUSED: ${name} requires a git rev.`);
      process.exit(2);
    }
    return v;
  };
  const at = flagValue("--at") ?? "HEAD";
  const since = flagValue("--since");
  const asJson = argv.includes("--json");
  const cwd = process.cwd();

  const now = readTree(at, cwd);
  const comp = compose(now);
  const frac = unclassifiedFraction(comp);

  if (frac > MAX_UNCLASSIFIED_FRACTION) {
    console.error(
      `REFUSED: ${(frac * 100).toFixed(1)}% of tracked bytes are unclassified ` +
        `(ceiling ${(MAX_UNCLASSIFIED_FRACTION * 100).toFixed(0)}%).`,
    );
    console.error("A composition computed over a tree the rules do not cover is a guess, not a measurement.");
    console.error("Largest uncovered directories — extend RULES to cover them:");
    for (const d of topUnclassifiedDirs(now, 10)) console.error(`  ${fmtBytes(d.bytes).padStart(10)}  ${d.dir}`);
    return 1;
  }

  const ratio = observabilityPerGenerator(comp);
  let prev: Composition | undefined;
  if (since !== undefined) prev = compose(readTree(since, cwd));

  if (asJson) {
    console.log(JSON.stringify({ at, since, composition: comp, observabilityPerGenerator: ratio, previous: prev }, null, 2));
    return 0;
  }

  console.log(`triangle composition at ${at}`);
  for (const c of ["generator", "joins", "observability", "prose", "excluded", "unclassified"] as Corner[]) {
    const line = `  ${c.padEnd(14)} ${fmtBytes(comp[c].bytes).padStart(10)}  ${String(comp[c].files).padStart(6)} files`;
    if (prev === undefined) { console.log(line); continue; }
    const d = comp[c].bytes - prev[c].bytes;
    const sign = d > 0 ? "+" : d < 0 ? "-" : " ";
    console.log(`${line}   ${sign}${fmtBytes(Math.abs(d))}`);
  }
  console.log("");
  console.log(`  observability per generator byte: ${ratio === null ? "undefined (no generator bytes)" : ratio.toFixed(3)}`);
  console.log(`  description length (generator + observability): ${fmtBytes(descriptionLength(comp))}`);
  if (prev !== undefined) {
    const p = observabilityPerGenerator(prev);
    if (p === null || ratio === null) {
      console.log("  direction of travel: undefined at one endpoint — not reported");
    } else {
      const moved = ratio - p;
      console.log(`  at ${since}: ${p.toFixed(3)}  →  ${moved <= 0 ? "TOWARD generators" : "TOWARD observability"} (${moved >= 0 ? "+" : ""}${moved.toFixed(3)})`);
    }
  }
  console.log("");
  console.log("  prose is excluded from the ratio on purpose — see the header. This is a byte");
  console.log("  composition, NOT a cost measurement; Aaron's cost claim is unmeasured here.");
  return 0;
}

if (import.meta.main) process.exit(main());
