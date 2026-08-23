/**
 * 2026-08-23-nerve-h1-vs-alpha-acyclicity.ts
 *
 * MEASUREMENT for docs/research/2026-08-23-local-to-global-obstruction-*.md
 *
 * Question: is the COMBINATORIAL obstruction (H^1 of the nerve of the cover, F_2 coefficients)
 * the same discriminator as the SEMANTIC one (alpha-acyclicity, i.e. BFMY: pairwise consistency
 * implies global consistency)?
 *
 * Method: compute both, independently, over an exhaustive family of small covers. The nerve
 * computation never calls GYO; GYO never sees the nerve. Disagreements are the finding.
 *
 * Pure, total, deterministic. Ordinal comparison only.
 * Run: bun docs/research/scripts/2026-08-23-nerve-h1-vs-alpha-acyclicity.ts
 */

import { isAlphaAcyclic, type Cover } from "../../../src/Core.TypeScript/cover-acyclicity/gyo.ts";

// === Combinatorics ==========================================================
//
// `combosOf` yields tuples of ELEMENTS rather than of indices. That is not a style preference:
// index tuples force `items[idx]` lookups, which under `noUncheckedIndexedAccess` are
// `T | undefined` and were the source of every non-null assertion in the first draft of this
// file. Carrying the elements themselves removes the lookup, so the soundness is structural
// rather than asserted.

function combosOf<T>(items: readonly T[], k: number): T[][] {
  const out: T[][] = [];
  const cur: T[] = [];
  const rec = (start: number): void => {
    if (cur.length === k) {
      out.push([...cur]);
      return;
    }
    for (let i = start; i < items.length; i++) {
      const item = items[i];
      if (item === undefined) continue;
      cur.push(item);
      rec(i + 1);
      cur.pop();
    }
  };
  rec(0);
  return out;
}

// === Nerve of a cover, and its F_2 cohomology ===============================
//
// Vertices: the cover's elements (BY INDEX - duplicates are distinct vertices, which matters,
// because the byte-lock cover is four elements with the SAME attribute set).
// A k-simplex {i0..ik} is in the nerve iff the intersection of those elements' attributes is
// nonempty. Closed under subsets, so it is a genuine simplicial complex.

/** A cover element paired with its position, so the nerve never needs an index lookup. */
interface Vertex {
  readonly i: number;
  readonly s: ReadonlySet<string>;
}

function intersectionNonempty(chosen: readonly ReadonlySet<string>[]): boolean {
  const [first, ...rest] = chosen;
  if (first === undefined) return true;
  let acc = [...first];
  for (const s of rest) {
    acc = acc.filter((a) => s.has(a));
    if (acc.length === 0) return false;
  }
  return acc.length > 0;
}

/** Key of a simplex, by vertex position. Ordinal string join - never `localeCompare`. */
function simplexKey(vs: readonly Vertex[]): string {
  return vs.map((v) => String(v.i)).join(",");
}

/** Index of the first row at or after `from` whose `bit` is set; -1 if none. */
function findPivotRow(rows: readonly bigint[], from: number, bit: bigint): number {
  for (let i = from; i < rows.length; i++) {
    const row = rows[i];
    if (row !== undefined && (row & bit) !== 0n) return i;
  }
  return -1;
}

/** Clear `bit` from every row except the pivot row, in place. */
function eliminateColumn(rs: bigint[], pivotIndex: number, pivotRow: bigint, bit: bigint): void {
  for (let i = 0; i < rs.length; i++) {
    const row = rs[i];
    if (i !== pivotIndex && row !== undefined && (row & bit) !== 0n) rs[i] = row ^ pivotRow;
  }
}

/** rank over GF(2) of a matrix given as rows of bitsets (bigint). */
function rankF2(rows: readonly bigint[]): number {
  const rs = [...rows];
  const all = rs.reduce((a, b) => a | b, 0n);
  if (all === 0n) return 0;
  let rank = 0;
  for (let b = all.toString(2).length - 1; b >= 0; b--) {
    const pivotBit = 1n << BigInt(b);
    const pr = findPivotRow(rs, rank, pivotBit);
    if (pr < 0) continue;
    const pivotRow = rs[pr];
    const rankRow = rs[rank];
    if (pivotRow === undefined || rankRow === undefined) continue;
    rs[rank] = pivotRow;
    rs[pr] = rankRow;
    eliminateColumn(rs, rank, pivotRow, pivotBit);
    rank++;
    if (rank === rs.length) break;
  }
  return rank;
}

interface NerveResult {
  readonly h0: number;
  readonly h1: number;
  readonly v: number;
  readonly e: number;
  readonly t: number;
}

function nerveCohomology(sets: readonly ReadonlySet<string>[]): NerveResult {
  const n = sets.length;
  const verts: Vertex[] = sets.map((s, i) => ({ i, s }));
  const simplices = (k: number): Vertex[][] =>
    combosOf(verts, k).filter((c) => intersectionNonempty(c.map((v) => v.s)));

  const edges = simplices(2);
  const tris = simplices(3);

  const eIdx = new Map<string, number>();
  edges.forEach((e, i) => eIdx.set(simplexKey(e), i));

  // delta^0 : C^0 (vertices) -> C^1 (edges).  (delta^0 f)(i,j) = f(j) - f(i).
  // Represent as rows = edges, columns = vertices; rank is the same either way.
  const d0: bigint[] = edges.map((e) => e.reduce((acc, v) => acc | (1n << BigInt(v.i)), 0n));

  // delta^1 : C^1 -> C^2.  (delta^1 g)(i,j,k) = g(j,k) - g(i,k) + g(i,j).
  const d1: bigint[] = tris.map((tri) => {
    const [a, b, c] = tri;
    if (a === undefined || b === undefined || c === undefined) return 0n;
    let row = 0n;
    for (const pair of [
      [b, c],
      [a, c],
      [a, b],
    ]) {
      const idx = eIdx.get(simplexKey(pair));
      if (idx !== undefined) row ^= 1n << BigInt(idx);
    }
    return row;
  });

  const rank0 = rankF2(d0);
  const rank1 = rankF2(d1);
  return { h0: n - rank0, h1: edges.length - rank1 - rank0, v: n, e: edges.length, t: tris.length };
}

// === Exhaustive family ======================================================

function subsetsOf(attrs: readonly string[]): ReadonlySet<string>[] {
  const out: ReadonlySet<string>[] = [];
  for (let m = 1; m < 1 << attrs.length; m++) {
    const s = new Set<string>();
    for (const [i, a] of attrs.entries()) if (m & (1 << i)) s.add(a);
    out.push(s);
  }
  return out;
}

function toCover(sets: readonly ReadonlySet<string>[]): Cover {
  // gyo.ts CoverEdge.attributes is `readonly string[]`, NOT a Set. Passing a Set happens to work
  // (canonicalizeCover spreads it) but relying on that is a check that did not run looking like
  // one that passed, so it is converted explicitly here.
  return sets.map((s, i) => ({ name: "R" + String(i), attributes: [...s].sort() }));
}

/** Running counts for one family of covers. */
interface Tally {
  checked: number;
  agree: number;
  /** GYO says CYCLIC (no gluing guarantee) but H^1 = 0 -> the invariant ACQUITS wrongly. */
  falseNeg: number;
  /** GYO says ACYCLIC but H^1 != 0 -> the invariant CONVICTS wrongly. */
  falsePos: number;
  acyclicCount: number;
  readonly disagreements: string[];
}

function describeDisagreement(sets: readonly ReadonlySet<string>[], acyclic: boolean, nerve: NerveResult): string {
  const shape = sets.map((s) => "{" + [...s].sort().join("") + "}").join(" ");
  return (
    shape +
    `  GYO=${acyclic ? "ACYCLIC" : "CYCLIC"}  H^1=${String(nerve.h1)}  H^0=${String(nerve.h0)}` +
    `  (V=${String(nerve.v)},E=${String(nerve.e)},T=${String(nerve.t)})`
  );
}

function tallyCover(t: Tally, sets: readonly ReadonlySet<string>[]): void {
  const acyclic = isAlphaAcyclic(toCover(sets));
  const nerve = nerveCohomology(sets);
  // Predictor under test: H^1(nerve; F_2) == 0  <->  alpha-acyclic
  const predicted = nerve.h1 === 0;
  t.checked++;
  if (acyclic) t.acyclicCount++;
  if (predicted === acyclic) {
    t.agree++;
    return;
  }
  if (acyclic) t.falsePos++;
  else t.falseNeg++;
  if (t.disagreements.length < 12) t.disagreements.push(describeDisagreement(sets, acyclic, nerve));
}

function run(attrs: readonly string[], maxSize: number): void {
  const subs = subsetsOf(attrs);
  const t: Tally = {
    checked: 0,
    agree: 0,
    falseNeg: 0,
    falsePos: 0,
    acyclicCount: 0,
    disagreements: [],
  };

  for (let size = 2; size <= maxSize; size++) {
    for (const sets of combosOf(subs, size)) tallyCover(t, sets);
  }

  console.log(
    `attrs=${attrs.join("")} maxSize=${String(maxSize)}: covers=${String(t.checked)} acyclic=${String(t.acyclicCount)} agree=${String(t.agree)} disagree=${String(t.checked - t.agree)}  [wrong-acquittals(H^1=0 but CYCLIC)=${String(t.falseNeg)}  wrong-convictions(H^1!=0 but ACYCLIC)=${String(t.falsePos)}]`,
  );
  for (const d of t.disagreements) console.log(`   DISAGREE  ${d}`);
}

console.log("=== nerve H^1 (F_2) vs GYO alpha-acyclicity ===");
run(["A", "B", "C"], 3);
run(["A", "B", "C"], 4);
run(["A", "B", "C", "D"], 3);
run(["A", "B", "C", "D"], 4);

// === The two named covers ===================================================
console.log("\n=== named covers ===");
const threeCycle = [new Set(["A", "B"]), new Set(["B", "C"]), new Set(["C", "A"])];
const nc = nerveCohomology(threeCycle);
console.log(
  `3-cycle {AB}{BC}{CA}: GYO=${isAlphaAcyclic(toCover(threeCycle)) ? "ACYCLIC" : "CYCLIC"} H^0=${String(nc.h0)} H^1=${String(nc.h1)} (V=${String(nc.v)},E=${String(nc.e)},T=${String(nc.t)})`,
);

const filled = [...threeCycle, new Set(["A", "B", "C"])];
const fc = nerveCohomology(filled);
console.log(
  `+ {ABC}          : GYO=${isAlphaAcyclic(toCover(filled)) ? "ACYCLIC" : "CYCLIC"} H^0=${String(fc.h0)} H^1=${String(fc.h1)} (V=${String(fc.v)},E=${String(fc.e)},T=${String(fc.t)})`,
);

// The BYTE-LOCK cover: four oracles, each producing a section over the WHOLE domain.
for (const k of [2, 3, 4, 6]) {
  const bytelock = Array.from({ length: k }, () => new Set(["whole-output"]));
  const bl = nerveCohomology(bytelock);
  console.log(
    `byte-lock cover, ${String(k)} oracles over one domain: H^0=${String(bl.h0)} H^1=${String(bl.h1)} (V=${String(bl.v)},E=${String(bl.e)},T=${String(bl.t)})`,
  );
}
