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
// THE VERIFICATION-COST IDENTITY (why `requiredQuorum` lives on the same row as
// `sources`, and why the churn heatmap is its other half):
//
//   ongoing verification cost of a path  ==  change frequency  ×  quorum size
//
// Both factors are per-path, so the product is per-path — which turns "where
// should we split this module?" from taste into arithmetic. A file that is
// rewritten weekly AND sits behind a 4-agent Byzantine quorum costs ~4x the
// review of a weekly file behind a 2-agent one, every week, forever. That
// product is the thing worth minimising, and there are only two ways to move it:
// change the code less, or make less of the change land on a high-tier path
// (split the byte-locked surface away from the churning one, distribute the
// functionality across files so a typical edit touches fewer high-tier targets).
//
// This file supplies the SECOND factor exactly. The first factor — commit churn
// per path — has NO tooling in this repo as of 2026-08-13 (CHECKED: no
// hotspot/heatmap tool in-tree). Until it exists the identity is only half
// computable, so the split decisions Aaron wants to drive off it stay judgement
// calls. Aaron 2026-08-13: *"we can use heatmaps of changes to find hotspots in
// code/repo — those are areas that likely need some splitting and reduction on
// quorum size if possible."* The heatmap is a named PREREQUISITE — a separate
// piece of work, not a deferred edit hiding in this file.
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
import { trackedFiles as sharedTrackedFiles } from "../git/tracked-files";
import { changedFiles } from "../git/changed-files";

// ── Schema ────────────────────────────────────────────────────────────────

/** How a target's row got into the graph. */
export type TargetOrigin = "declared" | "derived";

/**
 * How many members a quorum needs is a function of WHAT IT MUST SURVIVE. The
 * tiers below name the fault, and `quorumSize` turns the fault into the count —
 * there is no path to a number that skips the model.
 *
 *  - `none`      — not a quorum at all. One observer, zero faults tolerated.
 *                  This is `vocab/words/witness.md`, named honestly so a witness
 *                  can never be mistaken for a quorum by reading the JSON.
 *  - `omission`  — a member may FAIL TO NOTICE (unavailable, timed out,
 *                  inattentive, out of depth) but never asserts a falsehood.
 *                  `f + 1` members: at least one non-faulty reviewer remains,
 *                  and one honest "this is broken" is decisive, because a defect
 *                  found is a defect. Requires the merge policy to let a single
 *                  member's finding block — a majority vote over findings would
 *                  break this sizing.
 *  - `byzantine` — a member may ASSERT A FALSE VERDICT (captured, hallucinating,
 *                  or confidently wrong about bytes it did not actually compare).
 *                  `3f + 1` members. Anchor: Pease, Shostak & Lamport, *Reaching
 *                  Agreement in the Presence of Faults* (JACM 1980); Castro &
 *                  Liskov, *Practical Byzantine Fault Tolerance* (OSDI 1999).
 */
export type FaultClass = "none" | "omission" | "byzantine";

export interface FaultModel {
  readonly faultClass: FaultClass;
  /** Faults tolerated. Non-negative integer — no floats anywhere in this file. */
  readonly f: number;
}

/**
 * The quorum tiers, ordered. `tierRank` is the total order; `TIER_FAULT_MODEL`
 * is the policy that maps each tier to what it must survive.
 */
export type QuorumTier = "T0" | "T1" | "T2" | "T3";

/** What kind of repo evidence put a target in its tier. */
export type EvidenceKind = "golden-vector" | "cross-oracle" | "treaty-transcript";

/**
 * One reason a target sits where it does. Recorded per target so the tier is
 * AUDITABLE — you can open the named `witness` file and see the golden vectors
 * for yourself, rather than trusting a number somebody typed.
 */
export interface QuorumEvidence {
  /** `EVIDENCE_RULES` id that fired. */
  readonly rule: string;
  readonly kind: EvidenceKind;
  /** Ordinal-least repo path that matched the rule — the checkable "why". */
  readonly witness: string;
  /** How many paths under `holder` matched this rule. */
  readonly count: number;
  /**
   * Target id whose `sources` contain `witness`. Equal to the owning target's
   * own id when the evidence is DIRECT; a different id when the evidence was
   * inherited across a `dependsOn` edge (see `computeQuorums`).
   */
  readonly holder: string;
}

/**
 * The required quorum for changes to one target.
 *
 * DELIBERATELY CARRIES NO SIZE FIELD. `vocab/words/quorum.md`: *"every 'get an
 * outside opinion' is a witness claim until it names f."* A bare count is
 * exactly that unnamed claim, so the schema makes one unrepresentable — the
 * only way to a number is `quorumSize(requiredQuorum.faultModel)`.
 */
export interface RequiredQuorum {
  readonly tier: QuorumTier;
  readonly faultModel: FaultModel;
  /**
   * Reviewer CLASSES, never agent names — binding a class to a roster is the
   * roster's job, not the graph's. Aaron 2026-08-13: *"likely we want different
   * reviewers per language."* Ordinal-sorted, deduplicated.
   */
  readonly reviewerClasses: readonly string[];
  /** Empty means the T1 floor applies: no byte-lock evidence found. */
  readonly evidence: readonly QuorumEvidence[];
}

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
  /**
   * How many agents must verify a change to this target, and against what
   * fault model. DERIVED from repo evidence by `computeQuorums` for EVERY
   * target — declared rows included — so `derive` is a drift gate on the
   * quorum exactly as it is on the edges.
   */
  readonly requiredQuorum: RequiredQuorum;
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

// ── Required quorum: policy ──────────────────────────────────────────────
//
// Aaron 2026-08-13, answering "how many reviewers?": *"the quorum size will be
// PATH DEPENDENT — like golden vectors and byte-locked treaties will require
// more reviews, and likely we want different reviewers per language."* So the
// answer is a function over this graph, not a constant, and the two signals he
// named are both discoverable in the tree (see `EVIDENCE_RULES`).
//
// STATUS OF EACH PIECE — the honest split:
//   CHECKED  — which tier a target lands in. Derived from file paths that exist
//              (~140 golden-vector files, ~385 cross-verify files, 16 treaty
//              transcripts), re-derived on every `derive`, drift-gated.
//   PROPOSED — the `f` chosen for each tier below, and the choice of fault
//              CLASS per tier. The ORDER (T3 > T2 > T1) follows from Aaron's
//              framing; the exact numbers are policy and are meant to be moved
//              once real agent-review data exists. They live in one table so
//              moving them is a one-line diff with a visible blast radius.

/**
 * Members required, from the fault model. The ONLY way to a number.
 *
 * `omission` ⇒ f+1 — survive f members that fail to notice.
 * `byzantine` ⇒ 3f+1 — survive f members that assert a falsehood, under
 * asynchrony (Pease–Shostak–Lamport 1980; PBFT 1999).
 *
 * Total and integer-exact: `f` is truncated and floored at 0, so a corrupt
 * model can never produce a fractional or negative requirement.
 */
export function quorumSize(m: FaultModel): number {
  const t = Math.trunc(m.f);
  // NaN/Infinity fall back to f=0 rather than propagating: a corrupt model must
  // yield the SMALLEST honest requirement it can still name (one observer), not
  // a NaN that every `>=` comparison silently passes.
  const f = Number.isFinite(t) ? Math.max(0, t) : 0;
  if (m.faultClass === "none") return 1;
  if (m.faultClass === "byzantine") return 3 * f + 1;
  return f + 1;
}

/**
 * Tier → fault model. PROPOSED policy; see the status note above.
 *
 * T0 — a change that reaches no build target at all (declared-inert paths).
 *      A single non-author observer. Named `none` rather than `omission, f=0`
 *      so the JSON never disguises a witness as a small quorum.
 * T1 — ordinary code with no byte-lock evidence. Two independent reviewers:
 *      tolerate one that misses the defect.
 * T2 — carries golden vectors for ONE oracle. The vectors themselves arbitrate
 *      (bytes match or they do not), so a reviewer cannot manufacture agreement
 *      — the realistic fault is failing to notice that locked bytes moved.
 *      Omission, f=2 ⇒ 3.
 * T3 — carries a CROSS-ORACLE byte-lock or a ratified treaty transcript. Here
 *      the verdict is an AGREEMENT claim across independent implementations,
 *      and a member asserting "the oracles agree" without having compared them
 *      manufactures consensus — a Byzantine fault by definition, not an
 *      omission. Byzantine, f=1 ⇒ 4. This is also the only tier where the
 *      3f+1 anchor is being used for the thing it was proved about.
 */
export const TIER_FAULT_MODEL: Readonly<Record<QuorumTier, FaultModel>> = {
  T0: { faultClass: "none", f: 0 },
  T1: { faultClass: "omission", f: 1 },
  T2: { faultClass: "omission", f: 2 },
  T3: { faultClass: "byzantine", f: 1 },
};

/** Total order on tiers. Size is monotone in rank, by construction of the table above. */
export function tierRank(t: QuorumTier): number {
  if (t === "T0") return 0;
  if (t === "T1") return 1;
  if (t === "T2") return 2;
  return 3;
}

export function maxTier(a: QuorumTier, b: QuorumTier): QuorumTier {
  return tierRank(a) >= tierRank(b) ? a : b;
}

/** The floor for any target that builds anything at all. */
export const DEFAULT_TIER: QuorumTier = "T1";

export interface EvidenceRule {
  readonly id: string;
  readonly kind: EvidenceKind;
  readonly tier: QuorumTier;
  /** Globs, matched by the same `matchGlob` the sources use. Ordinal, case-exact. */
  readonly paths: readonly string[];
}

/**
 * The evidence that raises a target above the T1 floor.
 *
 * Every rule is a PATH pattern, not a content grep. That is deliberate: a grep
 * for "treaty" hits ~30 files of prose commentary in `src/` where the word is
 * Mirror-register shorthand, which would derive a principled-looking tier from
 * noise. Path evidence is mechanical, stable under rewording, and each hit
 * names a file a reviewer can open.
 *
 * The table is meant to GROW — Aaron: *"there will likely have rules emerge
 * over time on how to split different areas."* Adding a signal is one row here
 * plus a re-derive; nothing else changes. Candidate next rows, deliberately NOT
 * added today because Aaron did not name them and each needs its own argument:
 * `legs: []` (a target with no CI leg has no mechanical check at all, so the
 * quorum is its only evidence) and crypto/keyring surfaces.
 */
export const EVIDENCE_RULES: readonly EvidenceRule[] = [
  {
    // Aaron: "golden vectors ... will require more reviews". Locked bytes for a
    // single oracle: `.claude/rules/no-binary-in-proof-lineage.md` keeps them
    // text, so a reviewer can actually diff them.
    id: "golden-vectors",
    kind: "golden-vector",
    tier: "T2",
    paths: [
      "**/golden-vectors*",
      "**/golden_vectors*",
      "**/*-golden.*",
      "**/*_golden.*",
      "**/*.golden.*",
      "**/_golden/**",
      "**/golden/**",
    ],
  },
  {
    // The N-oracle byte-lock: the same computation implemented in several
    // languages and required to produce identical bytes. Breaking it is a
    // cross-language divergence, which is why it outranks a single-oracle lock.
    id: "cross-oracle-bytelock",
    kind: "cross-oracle",
    tier: "T3",
    paths: [
      "tests/cross-verification/**",
      "**/*cross_verify*",
      "**/*cross-verify*",
      "**/*CrossVerify*",
      "**/*CrossVerification*",
    ],
  },
  {
    // Aaron: "byte-locked treaties". A treaty transcript is a ratified
    // agreement artifact — `db/shapes/cartridges/*.lines` records the ratifying
    // parties, and these files are the byte-locked half of that record.
    //
    // Deliberately matches the RECORD and its assertions, not every file with
    // "treaty" in the name: `src/Core/MarkdownTreaty.fs` and
    // `QuantumObservableTreaty.fs` are implementations of a treaty-shaped
    // feature, not ratified transcripts, and letting a naming coincidence set
    // a Byzantine tier is how a derivation stops meaning anything.
    id: "treaty-transcript",
    kind: "treaty-transcript",
    tier: "T3",
    paths: ["**/*treaty-transcript*", "**/*-treaty.json", "**/*-treaty.test.*", "**/*Treaty.Tests.*"],
  },
];

// ── Required quorum: reviewer classes ────────────────────────────────────

/**
 * Toolchain kind → reviewer class. `dotnet` is deliberately absent: it is a
 * toolchain, not a language, and Aaron asked for per-LANGUAGE reviewers — so
 * .NET targets are split into F# and C# by their project-file extension in
 * `reviewerClassesForTarget` (CHECKED 2026-08-13: 27 `.fsproj` dirs, 28
 * `.csproj` dirs, zero dirs carrying both).
 */
const KIND_REVIEWER_CLASS: Readonly<Record<string, string>> = {
  agda: "reviewer:agda",
  alloy: "reviewer:alloy",
  assemblyscript: "reviewer:assemblyscript",
  go: "reviewer:go",
  lean: "reviewer:lean4",
  markdown: "reviewer:markdown",
  python: "reviewer:python",
  qsharp: "reviewer:qsharp",
  rust: "reviewer:rust",
  shell: "reviewer:shell",
  tla: "reviewer:tlaplus",
  typescript: "reviewer:typescript",
};

/**
 * `tests/cross-verification/<noun>/<lang>-output.json` — the harness declares
 * its own participating oracles by filename, so the reviewer set for a
 * cross-verification change is DERIVED from the tree rather than guessed.
 * CHECKED 2026-08-13: 97 such files, all under `tests/cross-verification/`,
 * exactly these seven prefixes.
 */
const ORACLE_OUTPUT_REVIEWER_CLASS: Readonly<Record<string, string>> = {
  cs: "reviewer:csharp",
  fsharp: "reviewer:fsharp",
  go: "reviewer:go",
  mumps: "reviewer:mumps",
  python: "reviewer:python",
  rust: "reviewer:rust",
  ts: "reviewer:typescript",
};

const ORACLE_OUTPUT_SUFFIX = "-output.json";

/**
 * Reviewer class named by an oracle-output filename, or `""` for a path that is
 * not one. An UNRECOGNISED language prefix yields `reviewer:unknown:<prefix>`
 * rather than nothing: a new oracle language must show up loudly in the derived
 * JSON, never silently narrow the reviewer set. Same stance as unknown→full.
 */
export function oracleOutputReviewerClass(path: string): string {
  const base = path.slice(path.lastIndexOf("/") + 1);
  if (!base.endsWith(ORACLE_OUTPUT_SUFFIX)) return "";
  const lang = base.slice(0, base.length - ORACLE_OUTPUT_SUFFIX.length);
  if (lang === "") return "";
  return ORACLE_OUTPUT_REVIEWER_CLASS[lang] ?? `reviewer:unknown:${lang}`;
}

function dotnetReviewerClasses(root: string, targetId: string): readonly string[] {
  const dir = targetId.slice(targetId.indexOf(":") + 1);
  const abs = join(root, dir);
  if (!existsSync(abs)) return ["reviewer:dotnet"];
  const out = new Set<string>();
  for (const f of readdirSync(abs)) {
    if (f.endsWith(".fsproj")) out.add("reviewer:fsharp");
    else if (f.endsWith(".csproj")) out.add("reviewer:csharp");
  }
  // A .NET target with no project file at all is a graph bug, not a free pass:
  // name the toolchain so the requirement is non-empty and visibly coarse.
  if (out.size === 0) out.add("reviewer:dotnet");
  const arr = [...out];
  arr.sort(ordinalCompare);
  return arr;
}

// ── Required quorum: query ───────────────────────────────────────────────

export interface QuorumRequirement {
  readonly tier: QuorumTier;
  readonly faultModel: FaultModel;
  /** `quorumSize(faultModel)`, materialised for the caller. */
  readonly size: number;
  readonly reviewerClasses: readonly string[];
  /** The affected targets that actually set the tier — the accountable rows. */
  readonly drivenBy: readonly string[];
  readonly reason: string;
}

function quorumOf(
  tier: QuorumTier,
  classes: readonly string[],
  drivenBy: readonly string[],
  reason: string,
): QuorumRequirement {
  const faultModel = TIER_FAULT_MODEL[tier];
  return { tier, faultModel, size: quorumSize(faultModel), reviewerClasses: classes, drivenBy, reason };
}

/**
 * The quorum required to verify a change that affects `ids`.
 *
 * AGGREGATION IS **MAX**, and the alternatives are not close:
 *
 *  - **max is safe and is the only monotone choice.** A quorum is a FLOOR
 *    ("at least this many witnesses, tolerating this fault"), and one review
 *    session covers the whole change — so satisfying the largest floor
 *    satisfies every smaller one simultaneously. Monotonicity is the security
 *    property: adding a file to a change can only raise the requirement, never
 *    lower it.
 *  - **sum is nonsense.** Reviewers are not consumed per target. The same four
 *    agents reviewing a change that touches fifty T3 targets satisfy all fifty
 *    floors; summing would demand two hundred agents for one change and make
 *    large-but-shallow changes unmergeable.
 *  - **average is DANGEROUS — it is a live dilution attack.** Averaging is
 *    non-monotone: bundle one byte-locked treaty edit with ninety trivial
 *    T1 files and the mean falls, so the requirement DROPS exactly when the
 *    change got broader. An attacker (or an impatient agent) lowers the gate by
 *    adding noise. There is a regression test pinning this.
 *
 * Reviewer classes UNION rather than max — a change spanning F# and Rust needs
 * both, and "different reviewers per language" is precisely a union.
 *
 * An EMPTY affected set is T0, a witness: a docs-only change still gets one
 * non-author observer, never zero. Note the caller normally hands this
 * `AffectedDecision.affected`, and an unknown path has already forced that to
 * every target — so unknown escalates to the max tier with no special case here.
 */
export function requiredQuorumForTargets(graph: BuildGraph, ids: readonly string[]): QuorumRequirement {
  const byId = new Map(graph.targets.map((t) => [t.id, t] as const));
  const classes = new Set<string>();
  let tier: QuorumTier = "T0";
  const seen: string[] = [];
  for (const id of ids) {
    const t = byId.get(id);
    if (t === undefined) continue;
    seen.push(id);
    tier = maxTier(tier, t.requiredQuorum.tier);
    for (const c of t.requiredQuorum.reviewerClasses) classes.add(c);
  }
  if (seen.length === 0) {
    return quorumOf("T0", [], [], "no build target affected — a witness, not a quorum");
  }
  const drivenBy = seen.filter((id) => byId.get(id)?.requiredQuorum.tier === tier);
  drivenBy.sort(ordinalCompare);
  const sortedClasses = [...classes];
  sortedClasses.sort(ordinalCompare);
  const model = TIER_FAULT_MODEL[tier];
  const reason =
    `max tier ${tier} over ${String(seen.length)} affected target(s), set by ${String(drivenBy.length)}; ` +
    `${model.faultClass} fault model tolerating f=${String(model.f)}`;
  return quorumOf(tier, sortedClasses, drivenBy, reason);
}

/** The same query, driven straight off an `affectedTargets` decision. */
export function requiredQuorumForChange(graph: BuildGraph, d: AffectedDecision): QuorumRequirement {
  return requiredQuorumForTargets(graph, d.affected);
}

// ── Derivation from what the repo already declares (edge I/O) ────────────

/**
 * What a freshly-derived row carries until `applyQuorums` overwrites it. Never
 * survives into the checked-in JSON — `deriveGraph` always ends with the real
 * computation — but it keeps `requiredQuorum` NON-OPTIONAL on `BuildTarget`, so
 * a target with no fault model is unrepresentable rather than merely unusual.
 */
const PLACEHOLDER_QUORUM: RequiredQuorum = {
  tier: DEFAULT_TIER,
  faultModel: TIER_FAULT_MODEL[DEFAULT_TIER],
  reviewerClasses: [],
  evidence: [],
};

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
  // NOTE: this roster is hand-maintained and can drift from `Zeta.sln`. `clis` was added
  // 2026-08-17 (081M08VM385087G0R001DTM0K6) when `clis/Zeta.Clis.fsproj` became the first new
  // *root-level* project since the roster was written. The failure mode is worth knowing: a
  // missing root does not produce a missing node quietly — `Tests.FSharp` references the project,
  // so `deriveDotnetTargets` emits the EDGE `dotnet:clis` while the NODE is never scanned, and the
  // graph's own "every dependsOn edge points at a target that exists" test goes red. That test is
  // the guard on this list; deriving the roster from the solution instead would remove the need
  // for one, at the cost of a bounded solution parse.
  for (const top of ["clis", "src", "tests", "bench", "samples", "vocab"]) {
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
      //
      // The two format legs are solution-scoped for the same reason, and were
      // MISSING here until 2026-08-19: `lint/lint-fsharp.ts` and
      // `lint/lint-csharp.ts` both run `dotnet format ... Zeta.sln`, i.e. over
      // EVERY project in the solution, not over the language their name implies.
      // Omitting them left `gate/lint-fsharp` and `gate/lint-csharp` claimed by
      // no target at all, so selecting jobs from this graph would have stopped
      // running both. Found by `hygiene/audit-build-graph-completeness.ts`
      // direction C.
      legs: ["gate/build-and-test", "gate/lint-csharp", "gate/lint-fsharp"],
      origin: "derived",
      requiredQuorum: PLACEHOLDER_QUORUM,
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
      // CORRECTED 2026-08-19. This used to read `legs: []` for all but
      // Core.Rust.Observe, with a comment calling that an honest statement of a
      // coverage gap. It was the opposite: it UNDER-reported real coverage.
      // `gate/lint-rust` runs `lint/lint-rust.ts`, which walks
      // `findCargoTomls(SRC_DIR)` and runs `cargo fmt --check` plus
      // `cargo clippy --all-targets -- -D warnings` on EVERY crate under src/.
      // So all 36 crates do carry a mechanical check; only the `cargo test` leg
      // (full-verify) is Observe-only. Stating `[]` made 35 targets invisible to
      // job selection — a wired graph would never have run lint-rust for a crate
      // change. Found by `hygiene/audit-build-graph-completeness.ts` direction A.
      legs:
        rel === "src/Core.Rust.Observe"
          ? ["gate/full-verify", "gate/lint-rust"]
          : ["gate/lint-rust"],
      origin: "derived",
      requiredQuorum: PLACEHOLDER_QUORUM,
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
      // Core.Lean4.Cslib is explicitly opt-in and not on the main gate; it is
      // rostered as UNCOVERED in `hygiene/audit-build-graph-completeness.ts`.
      //
      // The job id was WRONG until 2026-08-19: `lean-proof.yml` declares its job
      // as `type-check`, not `build`, so `lean-proof/build` named nothing. A
      // dangling leg can never be selected, which means a wired graph would have
      // skipped the Lean proof on every Lean change while direction A counted
      // the target as covered. Found by
      // `hygiene/audit-build-graph-completeness.ts` direction B.
      legs: rel === "src/Core.Lean4" ? ["lean-proof/type-check"] : [],
      origin: "derived",
      requiredQuorum: PLACEHOLDER_QUORUM,
    });
  }
  return out;
}

/**
 * Derive the `origin: "derived"` targets from the repo's own manifests.
 * Reads only declared edges — invents nothing.
 *
 * The `requiredQuorum` on each row here is a PLACEHOLDER: `applyQuorums`
 * recomputes it for every target, declared and derived alike, as the last step
 * of `deriveGraph`. Nothing downstream should read the placeholder.
 */
export function deriveTargets(root: string): readonly BuildTarget[] {
  const targets = [...deriveDotnetTargets(root), ...deriveRustTargets(root), ...deriveLeanTargets(root)];
  targets.sort(byTargetId);
  return targets;
}

// ── Quorum derivation (edge I/O) ─────────────────────────────────────────

/**
 * The repo's TRACKED file set, ordinal-sorted.
 *
 * Deliberately `git ls-files` and not a directory walk. The quorum is content
 * that lands in a byte-compared JSON and is enforced by a drift gate, so its
 * input must be identical on every machine — and a walk of the working tree
 * picks up build outputs, caches and untracked scratch, which differ per
 * checkout and would make `derive` fail spuriously (or, worse, silently change
 * a tier). The tracked set is the same everywhere.
 *
 * Throws on failure rather than returning empty: an empty file list would
 * silently demote every target to the T1 floor, which is precisely the
 * "a skipped check looks like a passed check" failure this graph exists to
 * prevent.
 *
 * The mechanism now lives in `../git/tracked-files.ts` and this is a thin
 * alias over it. That move is the point rather than tidying: the reasoning
 * above sat here as PROSE, and the next checker built - hygiene's
 * `unexecuted-test-files.ts` - hand-rolled a working-tree walk anyway and
 * shipped the identical machine-dependence defect (081KZYXRYR8087G0R003E6JZA4).
 * A lesson each author must re-derive is a lesson one of them will miss, so it
 * is now a function they can only call.
 */
export function trackedFiles(root: string): readonly string[] {
  return sharedTrackedFiles(root);
}

/**
 * Order on evidence for the same rule, used to pick ONE canonical entry so the
 * derived JSON does not depend on iteration order. Direct evidence beats
 * inherited; then ordinal-least witness path; then ordinal-least holder.
 */
function compareEvidence(selfId: string, a: QuorumEvidence, b: QuorumEvidence): number {
  const aDirect = a.holder === selfId ? 0 : 1;
  const bDirect = b.holder === selfId ? 0 : 1;
  if (aDirect !== bDirect) return aDirect - bDirect;
  const byWitness = ordinalCompare(a.witness, b.witness);
  if (byWitness !== 0) return byWitness;
  return ordinalCompare(a.holder, b.holder);
}

/**
 * Everything that transitively CONSUMES `id` — the targets whose own build
 * breaks when `id` changes. This is `reverseClosure` restated per-target and
 * without the seed itself, and it is the direction evidence must travel: see
 * `computeQuorums`.
 */
export function consumerClosure(graph: BuildGraph, id: string): readonly string[] {
  const consumers = new Map<string, string[]>();
  for (const t of graph.targets) {
    for (const d of t.dependsOn) {
      const list = consumers.get(d) ?? [];
      list.push(t.id);
      consumers.set(d, list);
    }
  }
  const out = new Set<string>();
  const stack = [...(consumers.get(id) ?? [])];
  while (stack.length > 0) {
    const next = stack.pop();
    if (next === undefined || out.has(next)) continue;
    out.add(next);
    for (const c of consumers.get(next) ?? []) stack.push(c);
  }
  out.delete(id);
  const arr = [...out];
  arr.sort(ordinalCompare);
  return arr;
}

/** Direct evidence: rules that fire on files matching a target's own `sources`. */
function directEvidence(
  graph: BuildGraph,
  files: readonly string[],
): ReadonlyMap<string, ReadonlyMap<string, QuorumEvidence>> {
  const out = new Map<string, Map<string, QuorumEvidence>>();
  // Pre-filter: only files that trip at least one rule can matter, which keeps
  // the target cross-product small (~500 files, not ~30k).
  const hits: { readonly path: string; readonly rule: EvidenceRule }[] = [];
  for (const path of files) {
    // A DECLARED-INERT path drives no build, so it cannot be build-verification
    // evidence — however suggestive its name. Without this, `docs/history/
    // pr-reviews/PR-…-cross-verify….md` would put the markdown-lint leg
    // (`sources: **/*.md`) into the Byzantine tier, making every documentation
    // edit cost four reviewers on the strength of a filename.
    if (matchesAny(graph.inert, path)) continue;
    for (const rule of EVIDENCE_RULES) {
      if (matchesAny(rule.paths, path)) hits.push({ path, rule });
    }
  }
  for (const { path, rule } of hits) {
    for (const t of finestTargetsCovering(graph, path)) {
      const per = out.get(t) ?? new Map<string, QuorumEvidence>();
      out.set(t, per);
      const prev = per.get(rule.id);
      const next: QuorumEvidence = {
        rule: rule.id,
        kind: rule.kind,
        witness: path,
        count: (prev?.count ?? 0) + 1,
        holder: t,
      };
      // Keep the ordinal-least witness, but accumulate the count over all hits.
      if (prev === undefined || ordinalCompare(path, prev.witness) < 0) per.set(rule.id, next);
      else per.set(rule.id, { ...prev, count: next.count });
    }
  }
  return out;
}

/**
 * How path-scoped a glob is: the number of leading segments containing no
 * wildcard. `src/Core.TypeScript/ace/**` → 3, `tests/cross-verification/**` and
 * `src/Core.Rust.Merkle/**` → 2, `**` and `**\/*.md` → 0.
 */
export function globSpecificity(pattern: string): number {
  let n = 0;
  for (const seg of pattern.split("/")) {
    if (seg.includes("*")) break;
    n++;
  }
  return n;
}

/**
 * The targets that own a path's EVIDENCE: those covering it with the most
 * path-scoped glob, ordinal-sorted.
 *
 * Evidence attaches to the FINEST covering target, not to every covering
 * target. A repo-wide extension glob is a lint leg — `leg:markdown` is
 * `**\/*.md` and `ts:repo` is `**\/*.ts` — and a lint leg is not the artifact a
 * byte-lock protects. Without this rule the single file
 * `tests/cross-verification/zeta-id/README.md` puts EVERY markdown edit in the
 * repo into the Byzantine tier, which is over-review, and over-review is
 * ignored review.
 *
 * Note what this does NOT do: when no path-scoped target covers a file, the
 * repo-wide leg is genuinely the finest thing that covers it and does inherit
 * the tier. That is not a leak, it is the graph reporting that the tree has no
 * target at that granularity — see `ts:repo` in the report.
 */
export function finestTargetsCovering(graph: BuildGraph, path: string): readonly string[] {
  let best = -1;
  const out: string[] = [];
  for (const t of graph.targets) {
    // A LINT LEG NEVER HOLDS EVIDENCE. The paragraph above says a repo-wide glob
    // is a lint leg and "a lint leg is not the artifact a byte-lock protects";
    // until 2026-08-19 that was enforced only INDIRECTLY, by `globSpecificity`
    // losing to a path-scoped target. That works while every leg is
    // extension-scoped (`leg:markdown` = `**\/*.md`) and some path-scoped target
    // happens to cover the evidence file. It collapses the moment a leg's glob is
    // universal.
    //
    // MEASURED REGRESSION that forced this to become explicit (caught by
    // `build-graph.test.ts` "a sample-app change does NOT", in the PR that
    // introduced it): a `leg:tree-structure` target with `sources: ["**"]` --
    // added because `lint-no-empty-dirs` and `lint-structural-hygiene` really are
    // whole-tree properties -- became a covering target for EVERY file, so it
    // absorbed `cross-oracle-bytelock` / `golden-vectors` / `treaty-transcript`
    // evidence and went T3. Since it is also affected by every change, the
    // required quorum for a README edit went from T1/2 reviewers to T3/4. Every
    // change in the repo, not just the one the test sampled.
    //
    // The doctrine was right; only its implementation was incidental. Stated
    // directly, it is total: a leg is a CI grouping, not an artifact, so it can
    // never be the thing whose bytes are locked. `ts:repo` is deliberately NOT a
    // leg -- it is a real source target and keeps inheriting T3 as before.
    //
    // What this gives up, stated rather than hidden: when an evidence file is
    // covered by NO non-leg target, its evidence is now dropped instead of
    // landing on the leg. That case is a real gap in the target set and deserves
    // its own report; it does not deserve to be signalled by doubling the review
    // quorum for the entire repository.
    if (t.kind === "leg") continue;
    let spec = -1;
    for (const s of t.sources) {
      if (matchGlob(s, path)) spec = Math.max(spec, globSpecificity(s));
    }
    if (spec < 0 || spec < best) continue;
    if (spec > best) {
      best = spec;
      out.length = 0;
    }
    out.push(t.id);
  }
  out.sort(ordinalCompare);
  return out;
}

/**
 * Compute every target's `RequiredQuorum` from the tracked tree.
 *
 * EVIDENCE FLOWS TO A TARGET FROM ITS CONSUMERS — the SAME direction dirt
 * flows, which is what makes it sound. `reverseClosure` says: if Y changes, X
 * must rebuild. Read that as evidence and it says: if consumer X's own sources
 * hold the byte-lock vectors, then a change to Y is CHECKED AGAINST those
 * vectors, so Y is a byte-locked path and must be reviewed as one. Without it,
 * every .NET oracle library reads as untested, because the .NET byte-lock
 * vectors live in the test projects rather than beside the code.
 *
 * The opposite direction is the tempting bug and was written first here: taking
 * evidence from a target's DEPENDENCIES makes every benchmark and sample app
 * inherit `src/Core`'s tier, which is exactly wrong — nothing byte-locked runs
 * when `samples/CrmSample` changes, because nothing consumes it. A quorum that
 * demands four Byzantine-tolerant reviewers for a sample edit is over-review,
 * and over-review is ignored review.
 *
 * KNOWN COARSENESS, stated rather than hidden: propagation is only as
 * fine-grained as the targets. `dotnet:tests/Tests.FSharp` is a single target
 * holding 30 cross-verify files, so every project it references inherits T3 —
 * including projects no byte-lock actually touches. This errs toward MORE
 * review, which is the safe direction and the same stance as unknown→full, but
 * it is over-approximation and should tighten if .NET test targets are ever
 * split per-assembly.
 */
export function computeQuorums(root: string, graph: BuildGraph): ReadonlyMap<string, RequiredQuorum> {
  const files = trackedFiles(root);
  const direct = directEvidence(graph, files);
  const byId = new Map(graph.targets.map((x) => [x.id, x] as const));
  const out = new Map<string, RequiredQuorum>();

  for (const t of graph.targets) {
    const merged = mergeEvidence(graph, direct, t.id);
    const evidence = [...merged.values()];
    evidence.sort((a, b) => ordinalCompare(a.rule, b.rule));
    const tier = tierFromEvidence(evidence);
    const reviewerClasses = reviewerClassesFor(root, byId, files, t, evidence);
    out.set(t.id, { tier, faultModel: TIER_FAULT_MODEL[tier], reviewerClasses, evidence });
  }
  return out;
}

/** A target's own evidence, plus whatever its consumers' evidence covers it. */
function mergeEvidence(
  graph: BuildGraph,
  direct: ReadonlyMap<string, ReadonlyMap<string, QuorumEvidence>>,
  id: string,
): ReadonlyMap<string, QuorumEvidence> {
  const merged = new Map<string, QuorumEvidence>();
  for (const [ruleId, ev] of direct.get(id) ?? []) merged.set(ruleId, ev);
  for (const consumerId of consumerClosure(graph, id)) {
    for (const [ruleId, ev] of direct.get(consumerId) ?? []) {
      const prev = merged.get(ruleId);
      if (prev === undefined || compareEvidence(id, ev, prev) < 0) merged.set(ruleId, ev);
    }
  }
  return merged;
}

/** The maximum tier any fired rule asserts, floored at `DEFAULT_TIER`. */
function tierFromEvidence(evidence: readonly QuorumEvidence[]): QuorumTier {
  const ruleById = new Map(EVIDENCE_RULES.map((r) => [r.id, r] as const));
  let tier: QuorumTier = DEFAULT_TIER;
  for (const e of evidence) {
    const rule = ruleById.get(e.rule);
    if (rule !== undefined) tier = maxTier(tier, rule.tier);
  }
  return tier;
}

/** The language class(es) a target's own code is written in. */
function languageClassesOf(root: string, t: BuildTarget): readonly string[] {
  if (t.kind === "dotnet") return dotnetReviewerClasses(root, t.id);
  return [KIND_REVIEWER_CLASS[t.kind] ?? `reviewer:unknown:${t.kind}`];
}

function reviewerClassesFor(
  root: string,
  byId: ReadonlyMap<string, BuildTarget>,
  files: readonly string[],
  t: BuildTarget,
  evidence: readonly QuorumEvidence[],
): readonly string[] {
  const classes = new Set<string>(languageClassesOf(root, t));
  // A target whose sources contain the cross-verification harness's own
  // per-language output files needs a reviewer for each language named there.
  for (const path of files) {
    if (!matchesAny(t.sources, path)) continue;
    const cls = oracleOutputReviewerClass(path);
    if (cls !== "") classes.add(cls);
  }
  // Evidence inherited across an edge carries its holder's language too: if the
  // C# test project is what byte-locks this library, a C# reviewer is
  // implicated even when the library itself is F#.
  for (const ev of evidence) {
    if (ev.holder === t.id) continue;
    const holder = byId.get(ev.holder);
    if (holder !== undefined) for (const c of languageClassesOf(root, holder)) classes.add(c);
  }
  const arr = [...classes];
  arr.sort(ordinalCompare);
  return arr;
}

/** Replace every target's `requiredQuorum` with the freshly derived one. */
export function applyQuorums(root: string, graph: BuildGraph): BuildGraph {
  const quorums = computeQuorums(root, graph);
  const targets = graph.targets.map((t) => ({
    ...t,
    requiredQuorum: quorums.get(t.id) ?? {
      tier: DEFAULT_TIER,
      faultModel: TIER_FAULT_MODEL[DEFAULT_TIER],
      reviewerClasses: [],
      evidence: [],
    },
  }));
  targets.sort(byTargetId);
  return { version: graph.version, always: graph.always, inert: graph.inert, targets };
}

/**
 * Regenerate the graph: declared rows preserved verbatim EXCEPT their
 * `requiredQuorum`, which is derived for every row so a hand-edited quorum
 * contradicts the derivation and fails the drift gate — exactly as a
 * hand-edited edge does.
 */
export function deriveGraph(root: string, base: BuildGraph): BuildGraph {
  const merged = [...base.targets.filter((t) => t.origin === "declared"), ...deriveTargets(root)];
  merged.sort(byTargetId);
  return applyQuorums(root, { version: base.version, always: base.always, inert: base.inert, targets: merged });
}

export const GRAPH_PATH = "src/Core.TypeScript/ace/build-graph.json";

export function loadGraph(root: string): BuildGraph {
  return JSON.parse(readFileSync(join(root, GRAPH_PATH), "utf8")) as BuildGraph;
}

// ── The derivation's INPUT SET (the pre-push trigger) ────────────────────

/** The deriver itself: edit it and every derived row is suspect. */
export const DERIVER_PATH = "src/Core.TypeScript/ace/build-graph.ts";

/**
 * Every path whose ADDITION, REMOVAL or EDIT can change what `deriveGraph`
 * produces — the derivation's input set, stated as globs.
 *
 * WHY IT EXISTS: `derive` is exact but whole-repo, and a check that runs
 * unconditionally on every push is a check that gets switched off. This list is
 * the cheap PREDICATE in front of it: no matching path in the change ⇒ the
 * derived artifact provably cannot have moved ⇒ skip the derivation entirely.
 *
 * IT IS BUILT FROM THE RULES, NOT COPIED FROM THEM. `EVIDENCE_RULES` is spread in
 * rather than transcribed, so adding an evidence row (the table is meant to grow —
 * see its own note) extends the trigger in the same edit. A hand-copied list is a
 * second source of truth that goes stale silently, which for a guard means going
 * quiet — the failure mode with no symptom.
 *
 * The four hand-written classes are the derivation's OTHER readers, and each names
 * the function that reads it:
 *
 *   - `*.fsproj` / `*.csproj`   `deriveDotnetTargets` (existence + `ProjectReference`)
 *                               and `dotnetReviewerClasses` (which language reviews it)
 *   - `Cargo.toml`             `deriveRustTargets` (existence + `path =` deps)
 *   - `lakefile.toml`          `deriveLeanTargets` (existence)
 *   - `*-output.json`          `oracleOutputReviewerClass` (which oracles participate)
 *   - the graph + this file    the base rows, `always`/`inert`, and the deriver itself
 *
 * OVER- rather than under-approximate, deliberately: the globs ignore the depth
 * limit in `findProjectFiles` and the `inert` filter in `directEvidence`, so some
 * matches trigger a derivation that turns out clean. That costs ~1.3s. The opposite
 * error costs a CI round trip and, worse, teaches an author the guard does not
 * cover them.
 */
export const DERIVATION_INPUT_GLOBS: readonly string[] = [
  ...EVIDENCE_RULES.flatMap((r) => r.paths),
  "**/*.fsproj",
  "**/*.csproj",
  "**/Cargo.toml",
  "**/lakefile.toml",
  `**/*${ORACLE_OUTPUT_SUFFIX}`,
  GRAPH_PATH,
  DERIVER_PATH,
];

/**
 * The subset of `changed` that can move the derived graph, ordinal-sorted. Empty
 * means the change cannot have drifted `build-graph.json` — the only case in which
 * skipping the derivation is sound.
 */
export function derivationInputsTouched(changed: readonly string[]): readonly string[] {
  const out = new Set<string>();
  for (const p of changed) {
    const path = normalizePath(p);
    if (matchesAny(DERIVATION_INPUT_GLOBS, path)) out.add(path);
  }
  const arr = [...out];
  arr.sort(ordinalCompare);
  return arr;
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
    "  drift-check [--base <ref>] [--changed <file>]",
    "      Pre-push guard: run `derive` ONLY when the change touches a path the",
    "      graph derives from. Scopes itself to <ref>..HEAD plus the index by",
    "      default (--base defaults to origin/main); exits 1 on drift, naming",
    "      the fix. Cheap no-op otherwise, which is why it can stay in preflight.",
    "",
    "  quorum [--changed <file>] [--json]",
    "      Read the changed-file set and print the required verification quorum:",
    "      tier, fault model, member count, and the reviewer classes needed.",
    "",
    "  explain <path>",
    "      Show how one path classifies, and the quorum each matched target needs.",
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
      `Run: ${DERIVE_FIX_COMMAND}`,
  );
  return 1;
}

/** The one line every drift message must carry: the fix, runnable as printed. */
export const DERIVE_FIX_COMMAND = "bun src/Core.TypeScript/ace/build-graph.ts derive --write";

/**
 * Pre-push guard: run the exact drift check, but ONLY when the change touches a
 * derivation input.
 *
 * The two halves are load-bearing in opposite directions. The predicate keeps the
 * guard cheap enough to survive (a multi-minute check on every push is a check
 * somebody deletes; ~0.2s when it does not apply is a check nobody notices). The
 * derivation keeps it EXACT — it is the same `deriveGraph` the CI gate asserts, so
 * a pass here means the gate passes, and there is no second, approximate notion of
 * drift to disagree with the first.
 *
 * The message names the fix verbatim, because that is the whole value: on
 * 2026-08-14 three PRs hit this gate in CI and all three were fixed in minutes by
 * running exactly this one command.
 */
async function runDriftCheck(root: string, argv: readonly string[]): Promise<number> {
  const explicit = argv.includes("--changed");
  const base = flag(argv, "--base") ?? "origin/main";
  const changed = explicit ? await readChanged(flag(argv, "--changed")) : changedFiles(root, base);

  if (changed !== undefined) {
    const touched = derivationInputsTouched(changed);
    if (touched.length === 0) {
      console.log(
        `build-graph drift-check: no derivation input in ${String(changed.length)} changed path(s) — skipped.`,
      );
      return 0;
    }
    console.log(`build-graph drift-check: ${String(touched.length)} derivation input(s) touched, e.g.`);
    for (const p of touched.slice(0, 3)) console.log(`  ${p}`);
  } else {
    // Unresolvable base (no `origin/main`, detached checkout). Check rather than
    // skip: an unscoped guard that stays silent is the skipped-check-wearing-a-
    // passed-check's-face failure this repo keeps paying for.
    console.log(`build-graph drift-check: cannot scope the change against '${base}' — checking anyway.`);
  }

  const graph = loadGraph(root);
  if (graphsEqual(deriveGraph(root, graph), graph)) {
    console.log(`build-graph drift-check: ${GRAPH_PATH} is in sync. ✓`);
    return 0;
  }
  console.error(
    `::error::${GRAPH_PATH} has drifted from the repo's declared build manifests.\n` +
      `This change adds or removes a file the graph derives from, so the checked-in\n` +
      `artifact no longer reproduces. CI's cross-verify gate fails on exactly this.\n` +
      `Run: ${DERIVE_FIX_COMMAND}\n` +
      `Then: bunx prettier --write ${GRAPH_PATH}  (and commit it with the change)`,
  );
  return 1;
}

function printQuorum(q: QuorumRequirement): void {
  console.log(`tier:      ${q.tier}`);
  console.log(`fault:     ${q.faultModel.faultClass}, f=${String(q.faultModel.f)}`);
  console.log(`members:   ${String(q.size)}`);
  console.log(`reviewers: ${q.reviewerClasses.join(", ") || "(none)"}`);
  console.log(`reason:    ${q.reason}`);
  for (const id of q.drivenBy) console.log(`  ! ${id}`);
}

async function runQuorum(graph: BuildGraph, argv: readonly string[]): Promise<number> {
  const changed = await readChanged(flag(argv, "--changed"));
  // No `forceFull` here on purpose: a SAMPLED full BUILD is a build-cost policy
  // and must not silently inflate the review requirement. The graph's own
  // escalations (always-globs, unknown paths) still apply, and those genuinely
  // do widen what a reviewer is accountable for.
  const decision = affectedTargets(graph, changed);
  const q = requiredQuorumForChange(graph, decision);
  if (argv.includes("--json")) console.log(JSON.stringify({ decision, quorum: q }, null, 2));
  else printQuorum(q);
  return 0;
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
  if (cmd === "drift-check") return runDriftCheck(root, argv);

  const graph = loadGraph(root);
  if (cmd === "explain") {
    const p = argv[1];
    if (p === undefined) {
      console.error("explain needs a path");
      return 1;
    }
    const c = classifyPath(graph, p);
    const quorum =
      c.kind === "target" ? requiredQuorumForTargets(graph, c.targets) : requiredQuorumForTargets(graph, []);
    console.log(JSON.stringify({ ...c, quorum }, null, 2));
    return 0;
  }
  if (cmd === "affected") return runAffected(graph, argv);
  if (cmd === "quorum") return runQuorum(graph, argv);

  console.error(usage());
  return 1;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2), process.cwd()));
}
