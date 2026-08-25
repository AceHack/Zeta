// PROBE — is semantics a QUOTIENT of syntax, and is the homoiconic regime CLOSED?
//
// Adjudicates the claim in docs/research/2026-08-25-is-semantics-a-quotient-of-syntax-*.md.
// Everything here is finite and exhaustive: no sampling, no fitting, no tolerance.
//
// The one invariant under test throughout is INJECTIVITY of a map, measured two ways that
// must agree (fibre-side and structure-side). Where they can disagree, that is the falsifier.
//
// Anchors: Birkhoff 1935 / Burris-Sankappanavar 1981 Thm 6.12 (homomorphism theorem);
// Goguen-Thatcher-Wagner-Wright 1977 (initial algebra semantics); McCarthy 1960 (quote/eval);
// Doran-Faux-Gates-Hubsch-Iga-Landweber 2008 (adinkras <-> doubly-even codes);
// Landauer 1961 / Bennett 1973 (erasure is what costs, bijection is free).

// ─────────────────────────────────────────────────────────────────────────────
// 1. The epi-mono factorisation, computed
// ─────────────────────────────────────────────────────────────────────────────

/** What a map T -> A actually is, measured rather than asserted. */
export interface Factorisation {
  /** |T| — size of the syntactic domain swept. */
  readonly domainSize: number;
  /** |image| — how much of the codomain the map reaches. */
  readonly imageSize: number;
  /** |A| — size of the semantic codomain swept. */
  readonly codomainSize: number;
  /** |T / ker| — the quotient's size. Equals imageSize by the homomorphism theorem. */
  readonly classes: number;
  /** largest fibre; 1 <=> injective ("no confusion"). */
  readonly maxFibre: number;
  /** log2(maxFibre) — the repo's own erasure metric (WSet.ErasureClassification). */
  readonly bitsErased: number;
  /** |A| - |image| — "junk" in the algebraic-specification sense. 0 <=> surjective. */
  readonly junk: number;
  readonly injective: boolean;
  readonly surjective: boolean;
  /** Semantics is a QUOTIENT of syntax exactly when it is surjective. */
  readonly isQuotient: boolean;
  /** ...and an ISO exactly when it is also injective (no junk AND no confusion). */
  readonly isIso: boolean;
  /** Homoiconic: a computable section exists, i.e. every semantic value names a syntax. */
  readonly hasSection: boolean;
}

/**
 * Factorise a map `sem : T -> A` over finite swept sets. `keyOf` is the codomain's
 * equality (ordinal string keys — culture-invariant by construction).
 */
export function factorise<T, A>(
  domain: readonly T[],
  codomain: readonly A[],
  sem: (t: T) => A,
  keyOf: (a: A) => string,
): Factorisation {
  const fibres = new Map<string, number>();
  for (const t of domain) {
    const k = keyOf(sem(t));
    fibres.set(k, (fibres.get(k) ?? 0) + 1);
  }
  const codKeys = new Set(codomain.map(keyOf));
  const maxFibre = fibres.size === 0 ? 0 : Math.max(...fibres.values());
  const imageSize = fibres.size;
  const codomainSize = codKeys.size;
  const injective = maxFibre <= 1;
  const surjective = imageSize === codomainSize;
  return {
    domainSize: domain.length,
    imageSize,
    codomainSize,
    classes: imageSize,
    maxFibre,
    bitsErased: maxFibre === 0 ? 0 : Math.log2(maxFibre),
    junk: codomainSize - imageSize,
    injective,
    surjective,
    isQuotient: surjective,
    isIso: surjective && injective,
    // For FINITE sets a section exists iff the map is surjective, and is computable by
    // canonical choice. The content of homoiconicity is therefore surjectivity PLUS the
    // canonicity of that choice — not mere existence. See the doc, section "what quote is".
    hasSection: surjective,
  };
}

/** The canonical section (`quote`), when one exists: least-index preimage per value. */
export function findSection<T, A>(
  domain: readonly T[],
  sem: (t: T) => A,
  keyOf: (a: A) => string,
): Map<string, T> {
  const q = new Map<string, T>();
  for (const t of domain) {
    const k = keyOf(sem(t));
    if (!q.has(k)) q.set(k, t);
  }
  return q;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. The grammar lane — the yield map is the quotient, ambiguity is its kernel,
//    and the SPPF is its fibre.
// ─────────────────────────────────────────────────────────────────────────────

/** Derivation trees of `S -> a | S S`: the initial algebra of that signature. */
export type Tree = { readonly leaf: true } | { readonly leaf: false; readonly l: Tree; readonly r: Tree };

const treeCache = new Map<number, readonly Tree[]>();

/** Every derivation tree with exactly `n` leaves. This IS the free/term algebra, layer n. */
export function treesWithLeaves(n: number): readonly Tree[] {
  if (n <= 0) return [];
  if (n === 1) return [{ leaf: true }];
  const hit = treeCache.get(n);
  if (hit !== undefined) return hit;
  const out: Tree[] = [];
  for (let i = 1; i < n; i++) {
    for (const l of treesWithLeaves(i)) {
      for (const r of treesWithLeaves(n - i)) out.push({ leaf: false, l, r });
    }
  }
  treeCache.set(n, out);
  return out;
}

/** The yield homomorphism T_Sigma -> Sigma*: the only thing a parser is given. */
export function yieldOf(t: Tree): string {
  return t.leaf ? "a" : yieldOf(t.l) + yieldOf(t.r);
}

/** Structural identity of a tree (for counting distinct syntax). */
export function treeKey(t: Tree): string {
  return t.leaf ? "a" : `(${treeKey(t.l)}${treeKey(t.r)})`;
}

/**
 * The Catalan recurrence, computed from the GRAMMAR'S OWN bilinear decomposition rather
 * than from a table. This is the excluding invariant demanded by numerology-vs-number-theory:
 * Motzkin also opens 1,1,2 and diverges at n=4, so the count alone identifies nothing; the
 * self-convolution C_n = sum_i C_i * C_(n-1-i) is what identifies it, and it is exactly the
 * production `S -> S S` read as an operation.
 */
export function catalanBySelfConvolution(n: number): number {
  const c: number[] = [1];
  for (let m = 1; m <= n; m++) {
    let s = 0;
    for (let i = 0; i < m; i++) s += (c[i] ?? 0) * (c[m - 1 - i] ?? 0);
    c.push(s);
  }
  return c[n] ?? 0;
}

/** All strings over {a} of length <= n — the codomain the yield map lands in. */
export function allStringsUpTo(n: number, alphabet: readonly string[]): readonly string[] {
  let level: string[] = [""];
  const out: string[] = [""];
  for (let i = 0; i < n; i++) {
    const next: string[] = [];
    for (const s of level) for (const c of alphabet) next.push(s + c);
    out.push(...next);
    level = next;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. The WSet lane — `consolidate` IS the quotient map onto `WeightedSet`.
//    src/Core/WSet.fs (list, unconsolidated) is the free layer;
//    src/Core/WeightedSet.fs (Map, Zero-pruned) is the quotient layer.
// ─────────────────────────────────────────────────────────────────────────────

export type Entry = readonly [string, number];
/** The FREE object: a list. Concatenation is the free-monoid operation (`WSet.plus`). */
export type FreeWSet = readonly Entry[];

/** `WSet.consolidate` transcribed: group by key, sum, drop zeros, ordinal sort. */
export function consolidate(s: FreeWSet): FreeWSet {
  const m = new Map<string, number>();
  for (const [k, w] of s) m.set(k, (m.get(k) ?? 0) + w);
  return [...m.entries()]
    .filter(([, w]) => w !== 0)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

export function wsetKey(s: FreeWSet): string {
  return s.map(([k, w]) => `${k}:${w}`).join("|");
}

/** Every list of length exactly `len` over the given (key, weight) alphabet. */
export function allFreeWSets(len: number, keys: readonly string[], weights: readonly number[]): readonly FreeWSet[] {
  let acc: Entry[][] = [[]];
  for (let i = 0; i < len; i++) {
    const next: Entry[][] = [];
    for (const s of acc) for (const k of keys) for (const w of weights) next.push([...s, [k, w] as Entry]);
    acc = next;
  }
  return acc;
}

/**
 * The CONGRUENCE test — the real content of "consolidate is a quotient map".
 * Well-definedness on classes: consolidate(a ++ b) must depend on a and b only through
 * consolidate(a) and consolidate(b). If this fails, the quotient does not exist.
 */
export function congruenceCounterexamples(sets: readonly FreeWSet[]): number {
  let bad = 0;
  for (const a of sets) {
    for (const b of sets) {
      const direct = wsetKey(consolidate([...a, ...b]));
      const viaClasses = wsetKey(consolidate([...consolidate(a), ...consolidate(b)]));
      if (direct !== viaClasses) bad++;
    }
  }
  return bad;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. The closure boundary, priced — adinkra codes.
//    A coded adinkra's vertex set is F_2^N / C. Homoiconicity is the C = 0 row.
// ─────────────────────────────────────────────────────────────────────────────

/** The extended Hamming [8,4,4] code's standard generator basis, as 8-bit masks. */
export const HAMMING_8_4_GENERATORS: readonly number[] = [0b11111111, 0b11110000, 0b11001100, 0b10101010];

export function popcount(x: number): number {
  let c = 0;
  let v = x;
  while (v !== 0) {
    v &= v - 1;
    c++;
  }
  return c;
}

/** The F_2-span of a generator list (as a sorted list of codewords). */
export function span(gens: readonly number[]): readonly number[] {
  const out = new Set<number>([0]);
  for (const g of gens) {
    for (const c of [...out]) out.add(c ^ g);
  }
  return [...out].sort((a, b) => a - b);
}

/** Doubly-even: every codeword weight ≡ 0 (mod 4) — the adinkra condition (Gates et al.). */
export function isDoublyEven(code: readonly number[]): boolean {
  return code.every((c) => popcount(c) % 4 === 0);
}

/** Self-dual over F_2 at length n: C = C-perp, checked as orthogonality plus |C| = 2^(n/2). */
export function isSelfDual(code: readonly number[], n: number): boolean {
  for (const a of code) for (const b of code) if (popcount(a & b) % 2 !== 0) return false;
  return code.length === 2 ** (n / 2);
}

/** Minimum nonzero weight. For a linear code this is the minimum distance d. */
export function minDistance(code: readonly number[]): number {
  const nz = code.filter((c) => c !== 0).map(popcount);
  return nz.length === 0 ? Infinity : Math.min(...nz);
}

/**
 * The vertex quotient F_2^n / C — the coded adinkra's vertex set. Returns the number of
 * cosets and the (constant) fibre size, so the two independent readings of "bits erased"
 * can be compared: fibre-side log2|C| vs structure-side dim C.
 */
export function vertexQuotient(n: number, code: readonly number[]): {
  readonly vertices: number;
  readonly fibre: number;
  readonly bitsErasedFibreSide: number;
  readonly bitsErasedStructureSide: number;
} {
  const rep = new Map<number, number>();
  for (let x = 0; x < 2 ** n; x++) {
    let least = x;
    for (const c of code) least = Math.min(least, x ^ c);
    rep.set(least, (rep.get(least) ?? 0) + 1);
  }
  const fibres = [...rep.values()];
  const fibre = Math.max(...fibres);
  const minF = Math.min(...fibres);
  return {
    vertices: rep.size,
    // A subgroup quotient has constant fibre |C|; a ragged fibre would refute the reading.
    fibre: fibre === minF ? fibre : -1,
    bitsErasedFibreSide: Math.log2(fibre),
    bitsErasedStructureSide: Math.log2(code.length),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. The initiality dichotomy — a context-aware weighting is provably not a
//    Sigma-homomorphism, and state-splitting converts it into one.
// ─────────────────────────────────────────────────────────────────────────────

/** Context-FREE fold: weight depends on the production alone. This IS the unique hom. */
export function freeFold(t: Tree, wLeaf: number, wBranch: number): number {
  return t.leaf ? wLeaf : wBranch * freeFold(t.l, wLeaf, wBranch) * freeFold(t.r, wLeaf, wBranch);
}

/** Context-AWARE fold: a branch is discounted when it is a LEFT child (parent context). */
export function contextFold(t: Tree, wLeaf: number, wBranch: number, side: "root" | "l" | "r"): number {
  if (t.leaf) return wLeaf;
  const local = side === "l" ? wBranch * 0.5 : wBranch;
  return local * contextFold(t.l, wLeaf, wBranch, "l") * contextFold(t.r, wLeaf, wBranch, "r");
}

/**
 * State-splitting (parent annotation — Johnson 1998; Klein & Manning 2003): absorb the
 * context into the KEY by refining the nonterminal alphabet. After splitting, the SAME
 * context-aware numbers are produced by a context-FREE fold over the refined signature.
 * Returns the fold over the refinement, which must agree with `contextFold` everywhere.
 */
export function splitFold(t: Tree, wLeaf: number, wOf: (sym: "S^root" | "S^l" | "S^r") => number, side: "root" | "l" | "r"): number {
  if (t.leaf) return wLeaf;
  const sym = side === "root" ? "S^root" : side === "l" ? "S^l" : "S^r";
  return wOf(sym) * splitFold(t.l, wLeaf, wOf, "l") * splitFold(t.r, wLeaf, wOf, "r");
}

// ---------------------------------------------------------------------------
// 6. MANY representations at once - the congruence lattice, and why plurality
//    over one free object is always reconcilable.
//
//    Aaron 2026-08-25: "both adinkras can be true at once, many can."
//    The formal content: quotients of a fixed free object T form a COMPLETE LATTICE
//    (Con(T), Birkhoff 1935). Any two congruences have a meet, and both quotients
//    factor through T/(a AND b). So a family of quotients of ONE free object is
//    reconcilable BY CONSTRUCTION - the span always exists. That is the raw-vault
//    discipline (one version of the facts, many of the truth) as a theorem, and it
//    is the anti-Babel invariant with a mechanism instead of a hope.
//
//    Junk is the failure condition: a representation reaching values no syntax names
//    has elements with no preimage in T, so no span through T covers them.
// ---------------------------------------------------------------------------

/** A congruence, given as a class-labelling function on the free object. */
export type Congruence<T> = (t: T) => string;

/** Is `c` actually a congruence for the binary production S -> S S? (well-definedness) */
export function isCongruenceForBinaryOp<T>(
  domain: readonly T[],
  c: Congruence<T>,
  combine: (a: T, b: T) => T,
): number {
  const byClass = new Map<string, T[]>();
  for (const t of domain) {
    const k = c(t);
    const arr = byClass.get(k);
    if (arr === undefined) byClass.set(k, [t]);
    else arr.push(t);
  }
  let violations = 0;
  for (const [, as] of byClass) {
    for (const [, bs] of byClass) {
      const a0 = as[0];
      const b0 = bs[0];
      if (a0 === undefined || b0 === undefined) continue;
      const ref = c(combine(a0, b0));
      for (const a of as) for (const b of bs) if (c(combine(a, b)) !== ref) violations++;
    }
  }
  return violations;
}

/** The meet of two congruences: the common refinement both quotients factor through. */
export function meet<T>(a: Congruence<T>, b: Congruence<T>): Congruence<T> {
  return (t) => `${a(t)} ${b(t)}`;
}

export interface Reconciliation {
  readonly classesA: number;
  readonly classesB: number;
  readonly classesMeet: number;
  /** Both quotients are images of the meet - the span exists. */
  readonly aFactorsThroughMeet: boolean;
  readonly bFactorsThroughMeet: boolean;
  /** The joint map meet -> (A x B) is injective: the meet loses nothing either kept. */
  readonly meetIsExactlyTheJoin: boolean;
}

/**
 * Exhibit the span: two representations of the same free object, reconciled through their
 * meet, with NEITHER collapsed into the other. This is "reintegration is not reconvergence"
 * computed rather than asserted.
 */
export function reconcile<T>(domain: readonly T[], a: Congruence<T>, b: Congruence<T>): Reconciliation {
  const m = meet(a, b);
  const classesOf = (c: Congruence<T>) => new Set(domain.map(c)).size;
  const factors = (c: Congruence<T>): boolean => {
    const seen = new Map<string, string>();
    for (const t of domain) {
      const k = m(t);
      const v = c(t);
      const prev = seen.get(k);
      if (prev === undefined) seen.set(k, v);
      else if (prev !== v) return false;
    }
    return true;
  };
  const pairs = new Set(domain.map((t) => `${a(t)} ${b(t)}`));
  return {
    classesA: classesOf(a),
    classesB: classesOf(b),
    classesMeet: classesOf(m),
    aFactorsThroughMeet: factors(a),
    bFactorsThroughMeet: factors(b),
    meetIsExactlyTheJoin: pairs.size === classesOf(m),
  };
}

export function leafCount(t: Tree): number {
  return t.leaf ? 1 : leafCount(t.l) + leafCount(t.r);
}

export function depth(t: Tree): number {
  return t.leaf ? 0 : 1 + Math.max(depth(t.l), depth(t.r));
}
