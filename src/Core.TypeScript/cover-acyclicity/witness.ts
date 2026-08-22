/**
 * witness.ts - the SEMANTIC half: pairwise consistency, global consistency, and the search for a
 * locally-consistent-but-globally-inconsistent instance.
 *
 * ---------------------------------------------------------------------------------------------
 * WHY THIS FILE EXISTS
 *
 * `gyo.ts` decides a SYNTACTIC property of a cover's shape. On its own that is a restatement of a
 * definition: an implementation of GYO tested only against hand-labelled "this one is acyclic"
 * examples proves that I can label examples, not that the criterion means anything.
 *
 * What makes it a falsifier is the other side of the BFMY biconditional, computed independently:
 *
 *   alpha-acyclic  <=>  every pairwise-consistent instance is globally consistent
 *
 * This file computes the RIGHT-HAND side by exhaustion over small instances - no GYO anywhere in
 * it. The test suite then asserts the two agree. If either side is wrong, they disagree, and the
 * suite goes red. That is the check that cannot pass vacuously.
 *
 * DEFINITIONS (BFMY 1983; Honeyman, Ladner & Yannakakis, IPL 10(1):14-19, 1980):
 *   - PAIRWISE CONSISTENT: for every pair of cover elements, the two relations agree on the
 *     projection onto their shared attributes. (This is exactly the "compatible family" /
 *     gluing condition of the relational presheaf - Abramsky 2013, Prop. 2.2.)
 *   - GLOBALLY CONSISTENT (= has a UNIVERSAL RELATION): there is a relation U over all attributes
 *     with projection onto each cover element equal to that element's relation.
 *
 * The computational shortcut used for global consistency, and why it is sound: any such U is a
 * subset of the natural join J (each of U's tuples projects into every relation), so
 * proj_i(J) is a superset of proj_i(U) = R_i; and proj_i(J) is always a subset of R_i. Hence
 *
 *   globally consistent  <=>  proj_i(natural join) = R_i for every i
 *
 * which is decidable by computing one join. Deciding it in general is NP-complete (Honeyman,
 * Ladner & Yannakakis 1980) - which is why the enumeration here is explicitly bounded and refuses
 * rather than silently truncating.
 *
 * Pure and total. Ordinal comparison only; no `localeCompare`.
 *
 * Work item: 081M0AH5TQQ087G0R003CNFRAF
 */

import { ordinalCompare, type Cover } from "./gyo";

/** Attribute values. Kept to primitives so tuples serialize to a canonical key. */
export type Value = string | number | boolean;

/** A tuple: a total assignment over some attribute set. */
export type Tuple = Readonly<Record<string, Value>>;

/** A relation: a SET of tuples over a fixed attribute set (duplicate-free by construction). */
export type Relation = readonly Tuple[];

/** An instance: one relation per cover-element name. */
export type Instance = Readonly<Record<string, Relation>>;

// === Canonical tuple keys ===================================================

/**
 * Key for a tuple over an attribute list ALREADY ordinal-sorted. Internal: the sort is hoisted out
 * of the per-tuple loop because the exhaustive search calls this millions of times, and sorting
 * once per tuple made the biconditional check take ~55s instead of ~4s.
 */
function keyOfSorted(t: Tuple, sortedAttributes: readonly string[]): string {
  let out = "";
  for (const a of sortedAttributes) {
    const v = t[a];
    // The type tag keeps `1` and `"1"` and `true` distinct without paying for JSON on numbers.
    out +=
      v === undefined
        // Absent attribute: no type tag. Cannot collide with a present value, because every
        // present value carries one (`s`, `n`, `b`). This marker used to be a raw NUL byte,
        // which works at runtime and makes the whole file read as BINARY to grep/rg, so every
        // text audit skips it silently. Caught by audit-no-raw-nul-in-source.ts in CI.
        ? `${a}=|`
        : typeof v === "string"
          ? `${a}=s${JSON.stringify(v)}|`
          : `${a}=${typeof v === "number" ? "n" : "b"}${String(v)}|`;
  }
  return out;
}

/**
 * Canonical key for a tuple, over an explicit attribute list. Attributes are ordinal-sorted and
 * values are type-tagged, so the key is stable across insertion orders and machines and never
 * conflates `1` with `"1"`.
 */
export function tupleKey(t: Tuple, attributes: readonly string[]): string {
  return keyOfSorted(t, [...attributes].sort(ordinalCompare));
}

/** Set-semantics deduplication of a relation over a known attribute set. */
export function dedupe(rel: Relation, attributes: readonly string[]): Relation {
  const sorted = [...attributes].sort(ordinalCompare);
  const seen = new Set<string>();
  const out: Tuple[] = [];
  for (const t of rel) {
    const k = keyOfSorted(t, sorted);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

/** Projection of a relation onto a subset of its attributes (set semantics). */
export function project(rel: Relation, attributes: readonly string[]): Relation {
  const sorted = [...attributes].sort(ordinalCompare);
  const seen = new Set<string>();
  const out: Tuple[] = [];
  for (const t of rel) {
    const p: Record<string, Value> = {};
    for (const a of attributes) {
      const v = t[a];
      if (v !== undefined) p[a] = v;
    }
    const k = keyOfSorted(p, sorted);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}

/** Set equality of two relations over a common attribute set. */
export function relationsEqual(
  a: Relation,
  b: Relation,
  attributes: readonly string[],
): boolean {
  const sorted = [...attributes].sort(ordinalCompare);
  const ka = new Set(a.map((t) => keyOfSorted(t, sorted)));
  const kb = new Set(b.map((t) => keyOfSorted(t, sorted)));
  if (ka.size !== kb.size) return false;
  for (const k of ka) if (!kb.has(k)) return false;
  return true;
}

// === Local (pairwise) consistency ===========================================

/** A failed pair, with the attributes on which the two relations disagree. */
export interface PairwiseDefect {
  readonly left: string;
  readonly right: string;
  readonly sharedAttributes: readonly string[];
}

/**
 * Pairwise consistency: every pair of relations agrees on the projection onto their shared
 * attributes.
 *
 * NOTE the disjoint case is NOT trivially consistent, and skipping it silently breaks the BFMY
 * biconditional. Projection onto the EMPTY attribute set yields one empty tuple for a nonempty
 * relation and nothing for an empty one - so two relations sharing no attributes are consistent
 * iff both are empty or both nonempty. Without this, the ACYCLIC cover `{A}, {B}` with
 * `R1 = {(0)}, R2 = {}` would count as locally consistent while having no universal relation,
 * and the theorem would read as false. The convention is load-bearing, not decorative.
 */
export function pairwiseDefects(cover: Cover, instance: Instance): readonly PairwiseDefect[] {
  const defects: PairwiseDefect[] = [];
  for (const pair of overlapPairs(cover)) {
    if (!pairAgrees(pair, instance)) {
      defects.push({ left: pair.left, right: pair.right, sharedAttributes: pair.shared });
    }
  }
  return defects;
}

/** A pair of cover elements with their (ordinal-sorted) shared attributes, computed once. */
interface OverlapPair {
  readonly left: string;
  readonly right: string;
  readonly shared: readonly string[];
}

/** All unordered pairs of a cover, with shared attributes precomputed. */
function overlapPairs(cover: Cover): readonly OverlapPair[] {
  const pairs: OverlapPair[] = [];
  for (let i = 0; i < cover.length; i++) {
    for (let j = i + 1; j < cover.length; j++) {
      const ei = cover[i]!;
      const ej = cover[j]!;
      const rightSet = new Set(ej.attributes);
      pairs.push({
        left: ei.name,
        right: ej.name,
        shared: ei.attributes.filter((a) => rightSet.has(a)).sort(ordinalCompare),
      });
    }
  }
  return pairs;
}

function pairAgrees(pair: OverlapPair, instance: Instance): boolean {
  const li = project(instance[pair.left] ?? [], pair.shared);
  const lj = project(instance[pair.right] ?? [], pair.shared);
  return relationsEqual(li, lj, pair.shared);
}

/** Convenience predicate over `pairwiseDefects`. */
export function isPairwiseConsistent(cover: Cover, instance: Instance): boolean {
  return pairwiseDefects(cover, instance).length === 0;
}

// === Natural join / global consistency ======================================

/**
 * The natural join of every relation in the instance, in cover order. Tuples agree on all shared
 * attributes by construction.
 */
export function naturalJoin(cover: Cover, instance: Instance): Relation {
  if (cover.length === 0) return [{}];
  let acc: Tuple[] = [{}];
  let accAttrs: string[] = [];
  for (const e of cover) {
    const rel = instance[e.name] ?? [];
    const next: Tuple[] = [];
    const shared = e.attributes.filter((a) => accAttrs.includes(a));
    for (const left of acc) {
      for (const right of rel) {
        let ok = true;
        for (const a of shared) {
          if (left[a] !== right[a]) {
            ok = false;
            break;
          }
        }
        if (ok) next.push({ ...left, ...right });
      }
    }
    acc = next;
    accAttrs = [...new Set([...accAttrs, ...e.attributes])];
  }
  return dedupe(acc, accAttrs);
}

/**
 * Global consistency: the natural join projects back onto every relation exactly. Sound and
 * complete for "a universal relation exists" - see the header.
 */
export function isGloballyConsistent(cover: Cover, instance: Instance): boolean {
  const joined = naturalJoin(cover, instance);
  for (const e of cover) {
    const back = project(joined, e.attributes);
    if (!relationsEqual(back, instance[e.name] ?? [], e.attributes)) return false;
  }
  return true;
}

// === Bounded exhaustive witness search ======================================

/**
 * A witness that the cover does NOT have the local-implies-global property: an instance that is
 * pairwise consistent and has no universal relation.
 */
export interface GluingWitness {
  readonly instance: Instance;
  /** The natural join, exhibited so a reader can see WHERE the gluing fails. */
  readonly join: Relation;
}

export type WitnessSearchResult =
  | { readonly kind: "witness-found"; readonly witness: GluingWitness; readonly searched: number }
  | { readonly kind: "no-witness"; readonly searched: number }
  | { readonly kind: "refused"; readonly reason: string; readonly wouldSearch: number };

/**
 * Search EVERY instance over a finite domain for a locally-consistent, globally-inconsistent one.
 *
 * This is a brute-force decision, not a heuristic: within the bound, `no-witness` means every
 * instance was examined and none was a witness. It REFUSES rather than truncating when the space
 * exceeds `maxInstances` - a partial search reported as "none found" is exactly the vacuity class
 * this repo keeps catching, so it is not available as an outcome.
 */
export function searchGluingWitness(
  cover: Cover,
  domain: readonly Value[],
  maxInstances = 1_000_000,
): WitnessSearchResult {
  // Every tuple over each edge's attributes, then every relation as a bitmask over those tuples.
  const tuplesPerEdge = cover.map((e) => allTuples(e.attributes, domain));
  let total = 1;
  for (const ts of tuplesPerEdge) {
    if (ts.length > 24) {
      return {
        kind: "refused",
        reason: `edge with ${ts.length} possible tuples exceeds the 24-tuple bitmask limit`,
        wouldSearch: Number.POSITIVE_INFINITY,
      };
    }
    total *= 2 ** ts.length;
    if (total > maxInstances) {
      return {
        kind: "refused",
        reason: `instance space exceeds maxInstances=${maxInstances}`,
        wouldSearch: total,
      };
    }
  }

  let searched = 0;
  const masks = cover.map(() => 0);
  const pairs = overlapPairs(cover); // hoisted: the shared-attribute sets do not vary per instance
  for (;;) {
    const instance: Record<string, Relation> = {};
    for (let i = 0; i < cover.length; i++) {
      const ts = tuplesPerEdge[i]!;
      const mask = masks[i]!;
      const rel: Tuple[] = [];
      for (let b = 0; b < ts.length; b++) {
        if ((mask & (1 << b)) !== 0) rel.push(ts[b]!);
      }
      instance[cover[i]!.name] = rel;
    }
    searched++;
    let locallyConsistent = true;
    for (const p of pairs) {
      if (!pairAgrees(p, instance)) {
        locallyConsistent = false;
        break;
      }
    }
    if (locallyConsistent && !isGloballyConsistent(cover, instance)) {
      return {
        kind: "witness-found",
        witness: { instance, join: naturalJoin(cover, instance) },
        searched,
      };
    }
    // odometer increment over the per-edge bitmasks
    let carry = 0;
    while (carry < cover.length) {
      const limit = 2 ** tuplesPerEdge[carry]!.length;
      masks[carry] = masks[carry]! + 1;
      if (masks[carry]! < limit) break;
      masks[carry] = 0;
      carry++;
    }
    if (carry === cover.length) break;
  }
  return { kind: "no-witness", searched };
}

/** Every tuple over `attributes` with values drawn from `domain`, in a deterministic order. */
export function allTuples(attributes: readonly string[], domain: readonly Value[]): Relation {
  const attrs = [...attributes].sort(ordinalCompare);
  let acc: Tuple[] = [{}];
  for (const a of attrs) {
    const next: Tuple[] = [];
    for (const t of acc) {
      for (const v of domain) next.push({ ...t, [a]: v });
    }
    acc = next;
  }
  return acc;
}
