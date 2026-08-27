#!/usr/bin/env bun
/**
 * oscillation-registry.ts — which healer pairs commute, which need a declared order, and which
 * genuinely cannot be composed.
 *
 * WHY A REGISTRY AND NOT A CHECK. The obvious guard is "assert healer write-sets are disjoint",
 * and it is wrong. Overlap is not illegal — two healers may legitimately touch the same file, and
 * a templated rule family (the five `*-parity` detectors are one rule five times) would share a
 * write-set BY CONSTRUCTION. A disjointness assertion would refuse exactly the collapse we want.
 * Aaron 2026-08-27 named the right object:
 *
 *   "similar to our fixed point registry except it's an oscillation registry where you can tell if
 *    two rules will oscillate or override each other"
 *
 * So this records a RELATION per pair and fails only on the two that are actually defects.
 *
 * THE FOUR RELATIONS, in increasing order of how much they constrain composition:
 *
 *   disjoint   write-sets do not intersect. Commutes for a STRUCTURAL reason — the pair cannot
 *              interact, whatever either does. Cheapest and strongest.
 *   commutes   write-sets DO overlap and `a∘b == b∘a` anyway. Commutes for a SUBSTANTIVE reason:
 *              they touch the same bytes and agree. Distinguished from `disjoint` because the
 *              guarantee is weaker — it holds for these inputs, not by construction.
 *   override   `a∘b != b∘a`, and both orders reach a fixed point. Order is LOAD-BEARING. Legal,
 *              but only once someone declares which order is intended; an undeclared override is
 *              an invariant living in a `reduce` where no reader will find it.
 *   oscillate  alternating the pair never reaches a fixed point — each undoes the other. This is
 *              the only relation that is always a defect. Live instance: the 2026-07-08 MD032
 *              wrapper/resplitter pair the harness's own test still pins.
 *
 * WHY THE HARNESS DOES NOT ALREADY CATCH THIS. `healer-harness.ts` certifies idempotence,
 * closure, and convergence — of the COMPOSITE, in the ONE order `composeHealers` happens to fold.
 * That establishes the composite reaches *a* fixed point. It never establishes that it reaches
 * *the* fixed point, so a hardcoded order can be silently load-bearing. Measured 2026-08-27: the
 * five Tier-0 healers admit 120 orders and exactly one is certified. (They are all `disjoint`
 * today, so the order happens not to matter — a property of that roster, not of the harness.)
 *
 * COMPOSABILITY BECOMES A NUMBER. Override relations induce a priority DAG; its HEIGHT is the
 * measure. Height 1 — an antichain, no declared edges — is fully composable, and the whole roster
 * is then a SET rather than a sequence. That turns "composable" from a word into something that
 * can be tracked and can regress.
 *
 * PURE, AND THE TREES ARE INJECTED. Nothing here reads the filesystem or a clock; a caller
 * supplies the corpus. A pair can only disagree on inputs that BOTH of them touch, so a corpus
 * that triggers neither healer reports `disjoint` vacuously — `firedOn` is reported for exactly
 * that reason, and a registry built from a corpus that fires nothing is evidence of nothing.
 */

import type { FileTree, Healer } from "./healer-harness.ts";

export type PairRelation = "disjoint" | "commutes" | "override" | "oscillate";

export interface PairVerdict {
  readonly a: string;
  readonly b: string;
  readonly relation: PairRelation;
  /** Paths both healers wrote. Empty exactly when `disjoint`. */
  readonly sharedPaths: readonly string[];
  /** Corpus entries on which at least one of the pair changed something. */
  readonly firedOn: readonly string[];
}

/** Ordinal — never `localeCompare`, which orders differently per machine. */
function compareOrdinal(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Canonical, ordinal-sorted rendering. A `Map` has insertion order; comparing it directly would
 * measure that instead of behaviour. */
export function canonical(tree: FileTree): string {
  return JSON.stringify([...tree.entries()].sort((x, y) => compareOrdinal(x[0], y[0])));
}

/** Paths a healer added, removed, or changed. */
export function writeSet(h: Healer, tree: FileTree): ReadonlySet<string> {
  const out = new Set<string>();
  let healed: FileTree;
  try {
    healed = h.heal(tree);
  } catch {
    // A throwing healer writes nothing here. It is a defect, but it is the harness's defect to
    // report — conflating "crashed" with "wrote nothing" is how a broken healer looks composable.
    return out;
  }
  for (const [k, v] of tree) if (!healed.has(k) || healed.get(k) !== v) out.add(k);
  for (const k of healed.keys()) if (!tree.has(k)) out.add(k);
  return out;
}

/**
 * Does alternating `a` and `b` settle?
 *
 * Applies the composite repeatedly. Reaching a repeated state means a fixed point exists for this
 * order; exhausting the budget without one means the pair cycles, which is `oscillate`.
 */
function converges(a: Healer, b: Healer, tree: FileTree, maxIterations: number): boolean {
  const seen = new Set<string>();
  let cur = tree;
  for (let i = 0; i < maxIterations; i += 1) {
    const key = canonical(cur);
    // REVISITING A STATE IS A CYCLE, not convergence. An earlier version returned `true` here,
    // which is exactly inverted: x -> y -> x -> y revisits `x`, and reading that as "settled" made
    // the one relation this module exists to detect undetectable. Its own tests caught it.
    // A fixed point is `next === cur`, checked below; anything else that repeats is oscillation.
    if (seen.has(key)) return false;
    seen.add(key);
    let next: FileTree;
    try {
      next = b.heal(a.heal(cur));
    } catch {
      return true; // a throw is not an oscillation; it is a different defect.
    }
    if (canonical(next) === key) return true;
    cur = next;
  }
  return false;
}

/** Classify one unordered pair over one corpus. */
export function classifyPair(
  a: Healer,
  b: Healer,
  corpus: readonly { readonly name: string; readonly tree: FileTree }[],
  maxIterations = 12,
): PairVerdict {
  const shared = new Set<string>();
  const firedOn: string[] = [];
  let anyDisagreement = false;
  let anyOscillation = false;

  for (const { name, tree } of corpus) {
    const wa = writeSet(a, tree);
    const wb = writeSet(b, tree);
    if (wa.size > 0 || wb.size > 0) firedOn.push(name);
    for (const p of wa) if (wb.has(p)) shared.add(p);

    let ab: string;
    let ba: string;
    try {
      ab = canonical(b.heal(a.heal(tree)));
      ba = canonical(a.heal(b.heal(tree)));
    } catch {
      continue;
    }
    if (ab !== ba) anyDisagreement = true;

    // Convergence is checked UNCONDITIONALLY, and that is not defensive — it is the whole
    // difference between the two defects. An earlier version only checked it when the two
    // one-step composites disagreed, and its own tests caught the hole: `advance` (x->y, y->z)
    // with `reset` (z->x) produces the SAME value in both orders at step one, and yet iterating
    // the composite cycles x,y,x,y forever. Order-agreement at a single step says nothing about
    // whether repeated application settles, so a pair can oscillate while looking perfectly
    // commutative — which is the worst version, because it passes the cheap check.
    if (!converges(a, b, tree, maxIterations) || !converges(b, a, tree, maxIterations)) {
      anyOscillation = true;
    }
  }

  const sharedPaths = [...shared].sort(compareOrdinal);
  // Order matters: oscillation is the strongest finding and must not be masked by a corpus entry
  // where the pair happened to agree.
  const relation: PairRelation = anyOscillation
    ? "oscillate"
    : anyDisagreement
      ? "override"
      : sharedPaths.length > 0
        ? "commutes"
        : "disjoint";

  return { a: a.name, b: b.name, relation, sharedPaths, firedOn: [...firedOn].sort(compareOrdinal) };
}

/** A priority edge someone has declared: `before` must run before `after`. */
export interface DeclaredEdge {
  readonly before: string;
  readonly after: string;
  /** Required. An undocumented ordering is the thing this registry exists to surface. */
  readonly why: string;
}

export interface ExclusiveCategory {
  /** Ordinal-sorted healer names. Size >= 2. */
  readonly members: readonly string[];
}

export interface RegistryReport {
  readonly verdicts: readonly PairVerdict[];
  /** Always a defect. */
  readonly oscillating: readonly PairVerdict[];
  /**
   * Connected components of `oscillate` edges. Dual-use: the same period-k
   * that is a composition defect also *discovers* a mutually exclusive
   * writer-category (coproduct, not product). Not appointed. Override
   * (AB≠BA that still terminates) is DAG/monodromy and is NOT a member.
   */
  readonly exclusiveCategories: readonly ExclusiveCategory[];
  /** Order-dependent with no declared edge — legal once declared, refused until then. */
  readonly undeclaredOverrides: readonly PairVerdict[];
  /** Declared edges for pairs that turned out to commute. Not a failure; stale documentation. */
  readonly staleDeclarations: readonly DeclaredEdge[];
  /** Height of the DAG induced by override edges. 1 == antichain == fully composable. */
  readonly dagHeight: number;
  /** Pairs whose corpus fired nothing — the verdict is vacuous and says so. */
  readonly vacuousPairs: readonly PairVerdict[];
}

/**
 * Union-find over oscillate edges. Override / commute / disjoint do not join.
 * Categories are ordinal-sorted by first member, members ordinal-sorted.
 */
export function exclusiveCategories(verdicts: readonly PairVerdict[]): readonly ExclusiveCategory[] {
  const parent = new Map<string, string>();
  const find = (n: string): string => {
    const p = parent.get(n);
    if (p === undefined || p === n) {
      parent.set(n, n);
      return n;
    }
    const r = find(p);
    parent.set(n, r);
    return r;
  };
  const union = (a: string, b: string): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    if (compareOrdinal(ra, rb) < 0) parent.set(rb, ra);
    else parent.set(ra, rb);
  };
  for (const v of verdicts) {
    if (v.relation !== "oscillate") continue;
    union(v.a, v.b);
  }
  const groups = new Map<string, string[]>();
  for (const n of parent.keys()) {
    const r = find(n);
    groups.set(r, [...(groups.get(r) ?? []), n]);
  }
  return [...groups.values()]
    .map((members) => ({ members: [...new Set(members)].sort(compareOrdinal) }))
    .filter((c) => c.members.length >= 2)
    .sort((a, b) => compareOrdinal(a.members[0] ?? "", b.members[0] ?? ""));
}

function pairKey(x: string, y: string): string {
  return JSON.stringify([x, y].sort(compareOrdinal));
}

/**
 * Longest chain in the override DAG, counted in nodes.
 *
 * Cycles cannot arise: an edge is only added for a pair, and a cycle among declared edges would be
 * a contradictory declaration. `seen` guards it anyway rather than recursing forever, because a
 * stack overflow is a worse report than a wrong number.
 */
export function dagHeight(nodes: readonly string[], edges: readonly DeclaredEdge[]): number {
  const succ = new Map<string, string[]>();
  for (const e of edges) succ.set(e.before, [...(succ.get(e.before) ?? []), e.after]);
  const depth = new Map<string, number>();
  const walk = (n: string, seen: ReadonlySet<string>): number => {
    const cached = depth.get(n);
    if (cached !== undefined) return cached;
    if (seen.has(n)) return 1;
    const next = seen === undefined ? new Set([n]) : new Set([...seen, n]);
    let best = 1;
    for (const s of succ.get(n) ?? []) best = Math.max(best, 1 + walk(s, next));
    depth.set(n, best);
    return best;
  };
  let h = nodes.length === 0 ? 0 : 1;
  for (const n of nodes) h = Math.max(h, walk(n, new Set<string>()));
  return h;
}

/** Build the registry over every unordered pair. */
export function buildRegistry(
  healers: readonly Healer[],
  corpus: readonly { readonly name: string; readonly tree: FileTree }[],
  declared: readonly DeclaredEdge[] = [],
  maxIterations = 12,
): RegistryReport {
  const verdicts: PairVerdict[] = [];
  for (let i = 0; i < healers.length; i += 1) {
    for (let j = i + 1; j < healers.length; j += 1) {
      verdicts.push(classifyPair(healers[i]!, healers[j]!, corpus, maxIterations));
    }
  }
  const declaredKeys = new Set(declared.map((e) => pairKey(e.before, e.after)));

  const oscillating = verdicts.filter((v) => v.relation === "oscillate");
  const overrides = verdicts.filter((v) => v.relation === "override");
  const undeclaredOverrides = overrides.filter((v) => !declaredKeys.has(pairKey(v.a, v.b)));
  const overrideKeys = new Set(overrides.map((v) => pairKey(v.a, v.b)));
  const staleDeclarations = declared.filter((e) => !overrideKeys.has(pairKey(e.before, e.after)));
  // A pair that fired on nothing tells you nothing. Reported so a green registry built from an
  // inert corpus cannot be read as evidence of composability.
  const vacuousPairs = verdicts.filter((v) => v.firedOn.length === 0);

  const applicable = declared.filter((e) => overrideKeys.has(pairKey(e.before, e.after)));
  return {
    verdicts: [...verdicts].sort((x, y) => compareOrdinal(x.a, y.a) || compareOrdinal(x.b, y.b)),
    oscillating,
    exclusiveCategories: exclusiveCategories(verdicts),
    undeclaredOverrides,
    staleDeclarations,
    dagHeight: dagHeight(healers.map((h) => h.name), applicable),
    vacuousPairs,
  };
}

/** `true` when nothing in the report is a defect. Stale declarations and vacuity are reported, not failed. */
export function isClean(r: RegistryReport): boolean {
  return r.oscillating.length === 0 && r.undeclaredOverrides.length === 0;
}

export function renderReport(r: RegistryReport): string {
  const lines: string[] = [];
  const counts = new Map<PairRelation, number>();
  for (const v of r.verdicts) counts.set(v.relation, (counts.get(v.relation) ?? 0) + 1);
  lines.push(`pairs: ${r.verdicts.length}  dag-height: ${r.dagHeight}`);
  for (const rel of ["disjoint", "commutes", "override", "oscillate"] as const) {
    lines.push(`  ${rel.padEnd(10)} ${counts.get(rel) ?? 0}`);
  }
  if (r.vacuousPairs.length > 0) {
    lines.push(
      `  NOTE: ${r.vacuousPairs.length} pair(s) fired on NOTHING in this corpus — their verdict is vacuous.`,
    );
  }
  for (const v of r.oscillating) {
    lines.push(`  OSCILLATE ${v.a} <-> ${v.b} — never reaches a fixed point. This is always a defect.`);
  }
  for (const c of r.exclusiveCategories) {
    lines.push(
      `  EXCLUSIVE CATEGORY {${c.members.join(", ")}} — discovered from oscillate edges; coproduct, not appointed.`,
    );
  }
  for (const v of r.undeclaredOverrides) {
    lines.push(
      `  UNDECLARED OVERRIDE ${v.a} <-> ${v.b} on ${v.sharedPaths.length} shared path(s) — order is load-bearing and undocumented. Declare the edge with a reason, or make them commute.`,
    );
  }
  for (const e of r.staleDeclarations) {
    lines.push(`  STALE DECLARATION ${e.before} -> ${e.after} — these commute now; the edge documents nothing.`);
  }
  return lines.join("\n");
}
