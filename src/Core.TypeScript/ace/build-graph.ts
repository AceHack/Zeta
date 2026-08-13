#!/usr/bin/env bun
// build-graph.ts — the repo's BUILD dependency graph, and the "what does this
// change affect?" query over it.
//
// Sits beside `deps.ts` (which is the DEPLOY graph: Helm charts → Flux/ArgoCD
// sync-waves). Same `dependson` edge model, different dimension of the
// N-dimensional dependency space (081KSGS9H0008QG0R0031PBNGA): deps.ts holds
// the deploy-time axis, this holds the build-time axis.
//
// Doctrine (Aaron 2026-06-07, docs/research/2026-06-07-full-dep-graph-is-one-
// constructable-zeta-file-temple-of-everything-defined-not-calculated-carve-
// subsets-aaron.md): the graph is DEFINED, not CALCULATED. `build-graph.json`
// is the defined whole; a build is a carve — the reachable subgraph from the
// roots the change touched. Beacon anchor: Bazel (one static whole-repo build
// graph; building a target = its reachable subgraph), Nixpkgs (one defined
// expression graph, carve a subset).
//
// Two halves:
//   1. DERIVE — the graph's edges come from what the repo ALREADY declares
//      (.fsproj/.csproj <ProjectReference>, Cargo.toml `path =` deps,
//      lakefile.toml packages). Nothing is invented. `derive` is a drift gate:
//      regenerating must reproduce the checked-in content (the generator IS
//      the ECC — .claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md).
//   2. AFFECTED — given a changed-file set, which build targets (and which CI
//      legs) must run. Pure, total, deterministic, integer-only.
//
// THE SAFETY PROPERTY (this is the whole point — read before changing it):
//
//   A changed path that matches NO target's sources and NO declared-inert
//   pattern is UNKNOWN, and unknown escalates to FULL. Silence is never read
//   as "nothing to build". Same stance as `Wall.Whitebox` in
//   src/Core/DerivationProtocol.fs: an unknown licence BLOCKS; unknown is not
//   permissive.
//
//   Consequence: forgetting to add a new source tree to this graph makes CI do
//   MORE work, never less. The failure mode is a slow build, never a silent
//   green.
//
// Pure core (match/classify/close/decide), edge-only I/O — noninterference
// §13. No floats anywhere: the "run a full build anyway" sampler is BigInt
// modulo over the commit sha, so it replays exactly (DST, §7). Ordinal
// collation throughout — `ordinalCompare`, never `localeCompare`
// (.claude/rules/culture-invariant-by-default.md).

import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ── Schema ────────────────────────────────────────────────────────────────

/** How a target's row got into the graph. */
export type TargetOrigin = "declared" | "derived";

export interface BuildTarget {
  /** Stable id, `<kind>:<path-or-name>`. Ordinal-sorted in the file. */
  readonly id: string;
  /** Toolchain that builds it. */
  readonly kind: string;
  /** Globs whose change dirties this target. */
  readonly sources: readonly string[];
  /** Target ids this one consumes — if they dirty, so does this. */
  readonly dependsOn: readonly string[];
  /** CI legs that actually run this target today (`workflow/job`). */
  readonly legs: readonly string[];
  readonly origin: TargetOrigin;
}

export interface BuildGraph {
  readonly version: number;
  /** Globs that dirty EVERYTHING (toolchain pins, CI config, this graph). */
  readonly always: readonly string[];
  /**
   * Globs proven to drive no build target. An explicit allow-list: a path must
   * be NAMED here to be ignorable. Derived from gate.yml's existing docs-only
   * path-filter (lines 197-229) — not invented.
   */
  readonly inert: readonly string[];
  readonly targets: readonly BuildTarget[];
}

/**
 * Ordinal (code-unit) string order — the repo's canonical collation.
 *
 * Deliberately NOT `localeCompare`: that is culture-sensitive and linguistic,
 * so two machines can disagree on the order, which would make the affected-set
 * output machine-dependent and break DST replay. `<` / `>` on JS strings is
 * UTF-16 code-unit order, which is what the culture-invariant rule asks for.
 */
export function ordinalCompare(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

const byTargetId = (a: BuildTarget, b: BuildTarget): number => ordinalCompare(a.id, b.id);

// ── Glob matching (deterministic, ordinal, no regex-injection surface) ────

/**
 * Match a path against a glob supporting `**` (zero or more whole segments)
 * and `*` (zero or more chars within one segment). Everything else is a
 * literal, compared ordinally. Total: never throws.
 */
export function matchGlob(pattern: string, path: string): boolean {
  return matchSegments(pattern.split("/"), 0, path.split("/"), 0);
}

function matchSegments(pat: readonly string[], pi: number, seg: readonly string[], si: number): boolean {
  if (pi === pat.length) return si === seg.length;
  const p = pat[pi];
  if (p === "**") {
    // `**` absorbs zero or more segments.
    for (let k = si; k <= seg.length; k++) {
      if (matchSegments(pat, pi + 1, seg, k)) return true;
    }
    return false;
  }
  if (si >= seg.length) return false;
  const s = seg[si];
  if (s === undefined || p === undefined) return false;
  if (!matchSegmentGlob(p, s)) return false;
  return matchSegments(pat, pi + 1, seg, si + 1);
}

/** Match one path segment against a pattern segment containing `*`. */
export function matchSegmentGlob(pattern: string, segment: string): boolean {
  const parts = pattern.split("*");
  if (parts.length === 1) return pattern === segment;
  const first = parts[0] ?? "";
  const last = parts[parts.length - 1] ?? "";
  if (!segment.startsWith(first)) return false;
  if (segment.length < first.length + last.length) return false;
  if (!segment.endsWith(last)) return false;
  let cursor = first.length;
  for (let i = 1; i < parts.length - 1; i++) {
    const mid = parts[i] ?? "";
    if (mid === "") continue;
    const at = segment.indexOf(mid, cursor);
    if (at === -1 || at + mid.length > segment.length - last.length) return false;
    cursor = at + mid.length;
  }
  return true;
}

export function matchesAny(patterns: readonly string[], path: string): boolean {
  for (const p of patterns) {
    if (matchGlob(p, path)) return true;
  }
  return false;
}

/** Strip leading `./` and normalize separators. */
export function normalizePath(p: string): string {
  let out = p.replace(/\\/g, "/");
  while (out.startsWith("./")) out = out.slice(2);
  return out;
}

/** Parse `git diff --name-only` output into a deterministic path list. */
export function parseChangedFiles(text: string): readonly string[] {
  const out: string[] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (t !== "") out.push(normalizePath(t));
  }
  out.sort(ordinalCompare);
  return out;
}

// ── Classification + closure ─────────────────────────────────────────────

export type PathClass =
  | { readonly kind: "always"; readonly path: string }
  | { readonly kind: "target"; readonly path: string; readonly targets: readonly string[] }
  | { readonly kind: "inert"; readonly path: string }
  | { readonly kind: "unknown"; readonly path: string };

/**
 * Classify one changed path. Order matters and is deliberate:
 * always → target → inert → unknown. `always` outranks `inert` so a path
 * listed in both still escalates.
 */
export function classifyPath(graph: BuildGraph, path: string): PathClass {
  const p = normalizePath(path);
  if (matchesAny(graph.always, p)) return { kind: "always", path: p };
  const hits: string[] = [];
  for (const t of graph.targets) {
    if (matchesAny(t.sources, p)) hits.push(t.id);
  }
  if (hits.length > 0) {
    hits.sort(ordinalCompare);
    return { kind: "target", path: p, targets: hits };
  }
  if (matchesAny(graph.inert, p)) return { kind: "inert", path: p };
  return { kind: "unknown", path: p };
}

/**
 * Close a seed set upward over reverse `dependsOn` edges: if Y is dirty and X
 * dependsOn Y, X is dirty. Fixed-point iteration — terminates even if the
 * declared edges contain a cycle (a cycle is a graph bug, not a hang).
 */
export function reverseClosure(graph: BuildGraph, seed: Iterable<string>): readonly string[] {
  const dirty = new Set<string>(seed);
  let changed = true;
  while (changed) {
    changed = false;
    for (const t of graph.targets) {
      if (dirty.has(t.id)) continue;
      for (const dep of t.dependsOn) {
        if (dirty.has(dep)) {
          dirty.add(t.id);
          changed = true;
          break;
        }
      }
    }
  }
  const out = [...dirty];
  out.sort(ordinalCompare);
  return out;
}

export interface AffectedDecision {
  /** `full` = every target runs. `selective` = only `affected` run. */
  readonly mode: "full" | "selective";
  /** Why, in one line — printed into the CI summary so a green is auditable. */
  readonly reason: string;
  readonly affected: readonly string[];
  /** Targets deliberately NOT run. affected ∪ skipped == every target id. */
  readonly skipped: readonly string[];
  /** CI legs the affected targets belong to. */
  readonly legs: readonly string[];
  /** Paths that matched nothing — each one forced `mode: "full"`. */
  readonly unknownPaths: readonly string[];
  /** Paths that matched an `always` glob. */
  readonly escalatingPaths: readonly string[];
}

export function allTargetIds(graph: BuildGraph): readonly string[] {
  const ids = graph.targets.map((t) => t.id);
  ids.sort(ordinalCompare);
  return ids;
}

function legsOf(graph: BuildGraph, ids: readonly string[]): readonly string[] {
  const set = new Set<string>();
  const byId = new Map(graph.targets.map((t) => [t.id, t] as const));
  for (const id of ids) {
    for (const leg of byId.get(id)?.legs ?? []) set.add(leg);
  }
  const out = [...set];
  out.sort(ordinalCompare);
  return out;
}

interface Seeded {
  readonly seed: ReadonlySet<string>;
  readonly unknownPaths: readonly string[];
  readonly escalatingPaths: readonly string[];
}

function seedFromChanges(graph: BuildGraph, changedPaths: readonly string[]): Seeded {
  const seed = new Set<string>();
  const unknownPaths: string[] = [];
  const escalatingPaths: string[] = [];
  for (const raw of changedPaths) {
    const c = classifyPath(graph, raw);
    if (c.kind === "always") escalatingPaths.push(c.path);
    else if (c.kind === "target") for (const id of c.targets) seed.add(id);
    else if (c.kind === "unknown") unknownPaths.push(c.path);
  }
  unknownPaths.sort(ordinalCompare);
  escalatingPaths.sort(ordinalCompare);
  return { seed, unknownPaths, escalatingPaths };
}

function escalationReasons(
  s: Seeded,
  forceFull: { readonly full: boolean; readonly reason: string } | undefined,
): readonly string[] {
  const reasons: string[] = [];
  if (forceFull?.full === true) reasons.push(forceFull.reason);
  if (s.escalatingPaths.length > 0) {
    reasons.push(`always-glob touched: ${s.escalatingPaths.join(", ")}`);
  }
  if (s.unknownPaths.length > 0) {
    reasons.push(
      `unknown path not covered by any target or the inert list (fail-safe to full): ${s.unknownPaths.join(", ")}`,
    );
  }
  return reasons;
}

/**
 * The query: given the changed-file set, which targets must build?
 *
 * `forceFull` is the caller's out-of-band escalation (non-PR event, sampled
 * full run, operator override). It is OR-ed with the graph's own escalations.
 */
export function affectedTargets(
  graph: BuildGraph,
  changedPaths: readonly string[],
  forceFull?: { readonly full: boolean; readonly reason: string },
): AffectedDecision {
  const s = seedFromChanges(graph, changedPaths);
  const all = allTargetIds(graph);
  const reasons = escalationReasons(s, forceFull);

  if (reasons.length > 0) {
    return {
      mode: "full",
      reason: reasons.join(" | "),
      affected: all,
      skipped: [],
      legs: legsOf(graph, all),
      unknownPaths: s.unknownPaths,
      escalatingPaths: s.escalatingPaths,
    };
  }

  const affected = reverseClosure(graph, s.seed);
  const affectedSet = new Set(affected);
  const skipped = all.filter((id) => !affectedSet.has(id));
  const reason =
    affected.length === 0
      ? "no build target touched (all changed paths are declared-inert)"
      : `${String(affected.length)} of ${String(all.length)} targets reachable from the change`;
  return {
    mode: "selective",
    reason,
    affected,
    skipped,
    legs: legsOf(graph, affected),
    unknownPaths: s.unknownPaths,
    escalatingPaths: s.escalatingPaths,
  };
}

// ── "Full builds sometimes" ──────────────────────────────────────────────

export interface FullBuildPolicy {
  /** GitHub event name driving the run. */
  readonly eventName: string;
  /** Head commit sha (hex). The deterministic sampling entropy. */
  readonly headSha: string;
  /** Run a full build on 1-in-N sampled PR commits. 0 disables, 1 = always. */
  readonly sampleEveryN: number;
}

export interface FullBuildVerdict {
  readonly full: boolean;
  readonly reason: string;
}

/**
 * Decide whether this run must be full regardless of what changed.
 *
 * Two mechanisms, both integer-exact and replayable:
 *
 *  1. EVENT — anything that is not a `pull_request` is full. This preserves
 *     gate.yml's existing invariant (path-filter's `nonpr` fast path, lines
 *     162-169): selective building is a per-PR optimisation and is NEVER the
 *     mechanism that hides a change from main-tip CI.
 *  2. SAMPLING — 1-in-N PR head commits run full anyway, chosen by BigInt
 *     modulo over the sha's leading 64 bits. No RNG, no clock, no float: the
 *     same sha always yields the same answer on every machine, so "why did
 *     this PR run full?" has an exact answer and DST replay is unaffected.
 *     This is what catches graph rot — a missing edge surfaces as a red full
 *     run within ~N PRs instead of never. Off by default (`sampleEveryN: 0`);
 *     the repo's established pattern is scheduled full sweeps, and sampling is
 *     a complement to that, not a replacement.
 */
export function shouldRunFullBuild(p: FullBuildPolicy): FullBuildVerdict {
  if (p.eventName !== "pull_request") {
    return { full: true, reason: `event '${p.eventName}' is not a pull_request — full build always` };
  }
  const n = Math.trunc(p.sampleEveryN);
  if (n === 1) return { full: true, reason: "sampleEveryN=1 — every run is full" };
  if (n <= 0) return { full: false, reason: "sampling disabled" };

  const hex = p.headSha.trim().toLowerCase().replace(/^0x/, "").slice(0, 16);
  if (hex.length === 0 || /[^0-9a-f]/.test(hex)) {
    return { full: true, reason: `unparseable head sha '${p.headSha}' — fail-safe to full build` };
  }
  const bucket = BigInt(`0x${hex}`) % BigInt(n);
  if (bucket === 0n) return { full: true, reason: `sampled full build (sha bucket 0 of ${String(n)})` };
  return { full: false, reason: `not sampled (sha bucket ${bucket.toString()} of ${String(n)})` };
}

// ── Coverage declaration — a green must never be ambiguous ───────────────

export interface CoverageProblem {
  readonly kind: "unaccounted" | "double-counted" | "unknown-id";
  readonly id: string;
}

function byProblem(a: CoverageProblem, b: CoverageProblem): number {
  const byId = ordinalCompare(a.id, b.id);
  if (byId !== 0) return byId;
  return ordinalCompare(a.kind, b.kind);
}

/**
 * Assert the decision ACCOUNTS FOR every target: each target id appears in
 * exactly one of `affected` / `skipped`, and nothing appears that is not in
 * the graph.
 *
 * This is the guard against the defect class that keeps recurring: a target
 * that is neither run nor declared-skipped is invisible, and its absence reads
 * as green. Wiring this into CI means a run publishes "these legs ran, these
 * were skipped and why" — so "passed" always carries its coverage with it.
 */
export function verifyCoverage(graph: BuildGraph, d: AffectedDecision): readonly CoverageProblem[] {
  const problems: CoverageProblem[] = [];
  const known = new Set(allTargetIds(graph));
  const seen = new Map<string, number>();
  for (const id of [...d.affected, ...d.skipped]) {
    seen.set(id, (seen.get(id) ?? 0) + 1);
    if (!known.has(id)) problems.push({ kind: "unknown-id", id });
  }
  for (const id of known) {
    const n = seen.get(id) ?? 0;
    if (n === 0) problems.push({ kind: "unaccounted", id });
    else if (n > 1) problems.push({ kind: "double-counted", id });
  }
  problems.sort(byProblem);
  return problems;
}

// ── Derivation from what the repo already declares (edge I/O) ────────────

function listDirs(root: string, rel: string): readonly string[] {
  const abs = join(root, rel);
  if (!existsSync(abs)) return [];
  const out: string[] = [];
  for (const e of readdirSync(abs, { withFileTypes: true })) {
    if (e.isDirectory()) out.push(e.name);
  }
  out.sort(ordinalCompare);
  return out;
}

/** `<ProjectReference Include="..\Foo\Foo.fsproj" />` → repo-relative paths. */
export function parseProjectReferences(xml: string, projectDir: string): readonly string[] {
  const out: string[] = [];
  const re = /<ProjectReference\s[^>]*?Include\s*=\s*"([^"]+)"/gs;
  for (const m of xml.matchAll(re)) {
    const raw = m[1];
    if (raw === undefined) continue;
    out.push(resolveRelative(projectDir, raw.replace(/\\/g, "/")));
  }
  out.sort(ordinalCompare);
  return out;
}

/** `zeta-core-merkle = { path = "../Core.Rust.Merkle" }` → repo-relative dirs. */
export function parseCargoPathDeps(toml: string, crateDir: string): readonly string[] {
  const out: string[] = [];
  const re = /path\s*=\s*"([^"]+)"/g;
  for (const m of toml.matchAll(re)) {
    const raw = m[1];
    if (raw === undefined) continue;
    out.push(resolveRelative(crateDir, raw));
  }
  const unique = [...new Set(out)];
  unique.sort(ordinalCompare);
  return unique;
}

/** Resolve `base` + a `../`-relative path into a normalized repo-relative path. */
export function resolveRelative(base: string, rel: string): string {
  const parts = base.split("/").filter((s) => s !== "");
  for (const seg of rel.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
}

function projectFilesIn(root: string, rel: string): readonly string[] {
  const abs = join(root, rel);
  if (!existsSync(abs)) return [];
  const out: string[] = [];
  for (const f of readdirSync(abs)) {
    if (f.endsWith(".fsproj") || f.endsWith(".csproj")) out.push(`${rel}/${f}`);
  }
  return out;
}

/**
 * Scan the project-bearing roots at depth 0 and 1. Deliberately does NOT
 * recurse: an unscanned tree yields UNKNOWN paths, which escalate to a full
 * build — loud and safe — whereas an unbounded walk would drag in
 * `references/prior-art/` (gigabytes, gitignored; see CLAUDE.md).
 */
function findProjectFiles(root: string): readonly string[] {
  const out: string[] = [];
  for (const top of ["src", "tests", "bench", "samples", "vocab"]) {
    out.push(...projectFilesIn(root, top));
    for (const dir of listDirs(root, top)) out.push(...projectFilesIn(root, `${top}/${dir}`));
  }
  out.sort(ordinalCompare);
  return out;
}

function dirOf(path: string): string {
  return path.slice(0, path.lastIndexOf("/"));
}

function deriveDotnetTargets(root: string): readonly BuildTarget[] {
  const out: BuildTarget[] = [];
  for (const proj of findProjectFiles(root)) {
    const dir = dirOf(proj);
    const refs = parseProjectReferences(readFileSync(join(root, proj), "utf8"), dir);
    const dependsOn = [...new Set(refs.map((r) => `dotnet:${dirOf(r)}`))];
    dependsOn.sort(ordinalCompare);
    out.push({
      id: `dotnet:${dir}`,
      kind: "dotnet",
      sources: [`${dir}/**`],
      dependsOn,
      // gate.yml builds the solution as one unit (`dotnet build Zeta.sln`), so
      // every .NET target shares one leg. The per-project edges are still
      // real and are what a finer-grained build would carve on.
      legs: ["gate/build-and-test"],
      origin: "derived",
    });
  }
  return out;
}

function deriveRustTargets(root: string): readonly BuildTarget[] {
  const out: BuildTarget[] = [];
  for (const dir of listDirs(root, "src")) {
    const rel = `src/${dir}`;
    const manifest = join(root, rel, "Cargo.toml");
    if (!existsSync(manifest)) continue;
    out.push({
      id: `rust:${rel}`,
      kind: "rust",
      sources: [`${rel}/**`],
      dependsOn: parseCargoPathDeps(readFileSync(manifest, "utf8"), rel).map((p) => `rust:${p}`),
      // Only Core.Rust.Observe is wired into gate.yml today (line 1583). The
      // other 35 crates are graph-visible but leg-less: `legs: []` states that
      // coverage gap honestly rather than implying coverage that does not exist.
      legs: rel === "src/Core.Rust.Observe" ? ["gate/full-verify"] : [],
      origin: "derived",
    });
  }
  return out;
}

function deriveLeanTargets(root: string): readonly BuildTarget[] {
  const out: BuildTarget[] = [];
  for (const dir of listDirs(root, "src")) {
    const rel = `src/${dir}`;
    if (!existsSync(join(root, rel, "lakefile.toml"))) continue;
    out.push({
      id: `lean:${rel}`,
      kind: "lean",
      sources: [`${rel}/**`],
      dependsOn: [],
      // Core.Lean4.Cslib is explicitly opt-in and not on the main gate.
      legs: rel === "src/Core.Lean4" ? ["lean-proof/build"] : [],
      origin: "derived",
    });
  }
  return out;
}

/**
 * Derive the `origin: "derived"` targets from the repo's own manifests.
 * Reads only declared edges — invents nothing.
 */
export function deriveTargets(root: string): readonly BuildTarget[] {
  const targets = [...deriveDotnetTargets(root), ...deriveRustTargets(root), ...deriveLeanTargets(root)];
  targets.sort(byTargetId);
  return targets;
}

/** Regenerate the graph: declared rows preserved verbatim, derived rows replaced. */
export function deriveGraph(root: string, base: BuildGraph): BuildGraph {
  const merged = [...base.targets.filter((t) => t.origin === "declared"), ...deriveTargets(root)];
  merged.sort(byTargetId);
  return { version: base.version, always: base.always, inert: base.inert, targets: merged };
}

export const GRAPH_PATH = "src/Core.TypeScript/ace/build-graph.json";

export function loadGraph(root: string): BuildGraph {
  return JSON.parse(readFileSync(join(root, GRAPH_PATH), "utf8")) as BuildGraph;
}

/**
 * Canonical serialization — the CONTENT lock the drift gate compares against.
 *
 * Deliberately content-canonical rather than byte-canonical: prettier owns the
 * file's on-disk formatting (`format:check` reflows JSON arrays), so comparing
 * raw bytes would put the drift gate and the formatter in a permanent fight.
 * Both sides of every comparison pass through this function, so the gate is
 * exact on content and blind to whitespace.
 */
export function serializeGraph(g: BuildGraph): string {
  return `${JSON.stringify(g, null, 2)}\n`;
}

/** True when two graphs carry identical content, whatever their formatting. */
export function graphsEqual(a: BuildGraph, b: BuildGraph): boolean {
  return serializeGraph(a) === serializeGraph(b);
}

// ── CLI (edge only) ──────────────────────────────────────────────────────

function usage(): string {
  return [
    "ace build-graph — the build dependency graph and its affected-set query",
    "",
    "  affected [--changed <file>] [--event <name>] [--sha <hex>] [--sample-every <n>] [--json]",
    "      Read `git diff --name-only` output (file or stdin) and print the",
    "      affected targets, the CI legs, and the coverage declaration.",
    "",
    "  derive [--write]",
    "      Regenerate the derived rows from the repo's own manifests.",
    "      Default exits 1 on drift (CI gate); --write updates the file.",
    "",
    "  explain <path>",
    "      Show how one path classifies.",
  ].join("\n");
}

async function readChanged(file: string | undefined): Promise<readonly string[]> {
  if (file !== undefined) return parseChangedFiles(readFileSync(file, "utf8"));
  return parseChangedFiles(await Bun.stdin.text());
}

function flag(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

function runDerive(root: string, write: boolean): number {
  const base = loadGraph(root);
  const next = deriveGraph(root, base);
  const inSync = graphsEqual(next, base);
  if (write) {
    // Only rewrite on a CONTENT change, so a no-op derive never clobbers
    // prettier's formatting of an already-correct file.
    if (inSync) console.log(`${GRAPH_PATH} already current.`);
    else {
      writeFileSync(join(root, GRAPH_PATH), serializeGraph(next));
      console.log(`${GRAPH_PATH} updated — run prettier --write on it before committing.`);
    }
    return 0;
  }
  if (inSync) {
    console.log(`${GRAPH_PATH} is in sync with the repo's declared manifests. ✓`);
    return 0;
  }
  console.error(
    `::error::${GRAPH_PATH} has drifted from the repo's declared build manifests.\n` +
      `Run: bun src/Core.TypeScript/ace/build-graph.ts derive --write`,
  );
  return 1;
}

function printDecision(d: AffectedDecision): void {
  console.log(`mode:    ${d.mode}`);
  console.log(`reason:  ${d.reason}`);
  console.log(`legs:    ${d.legs.join(", ") || "(none)"}`);
  console.log(`ran:     ${String(d.affected.length)} target(s)`);
  console.log(`skipped: ${String(d.skipped.length)} target(s)`);
  for (const id of d.affected) console.log(`  + ${id}`);
}

async function runAffected(graph: BuildGraph, argv: readonly string[]): Promise<number> {
  const changed = await readChanged(flag(argv, "--changed"));
  const force = shouldRunFullBuild({
    eventName: flag(argv, "--event") ?? "pull_request",
    headSha: flag(argv, "--sha") ?? "",
    sampleEveryN: Number.parseInt(flag(argv, "--sample-every") ?? "0", 10) || 0,
  });
  const decision = affectedTargets(graph, changed, force);
  const problems = verifyCoverage(graph, decision);
  if (argv.includes("--json")) console.log(JSON.stringify({ ...decision, coverageProblems: problems }, null, 2));
  else printDecision(decision);
  if (problems.length > 0) {
    console.error(`::error::coverage declaration incomplete: ${JSON.stringify(problems)}`);
    return 1;
  }
  return 0;
}

export async function main(argv: readonly string[], root: string): Promise<number> {
  const cmd = argv[0];
  if (cmd === undefined || cmd === "--help" || cmd === "-h") {
    console.log(usage());
    return cmd === undefined ? 1 : 0;
  }
  if (cmd === "derive") return runDerive(root, argv.includes("--write"));

  const graph = loadGraph(root);
  if (cmd === "explain") {
    const p = argv[1];
    if (p === undefined) {
      console.error("explain needs a path");
      return 1;
    }
    console.log(JSON.stringify(classifyPath(graph, p), null, 2));
    return 0;
  }
  if (cmd === "affected") return runAffected(graph, argv);

  console.error(usage());
  return 1;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2), process.cwd()));
}
