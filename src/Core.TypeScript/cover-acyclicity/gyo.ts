/**
 * gyo.ts - alpha-acyclicity of an attribute cover, by GYO reduction, with certificates.
 *
 * ---------------------------------------------------------------------------------------------
 * WHAT THIS DECIDES (a database-theory statement, and nothing more)
 *
 * A COVER is a finite family of attribute sets - a database schema, a set of shard boundaries, a
 * set of local views. Read as a hypergraph: attributes are vertices, each set is a hyperedge.
 *
 * The criterion:
 *
 *   > Whether LOCAL agreement forces GLOBAL agreement is a property of the SHAPE OF THE COVER,
 *   > not of the merge operator.
 *
 * Precisely (Beeri, Fagin, Maier & Yannakakis, "On the desirability of acyclic database schemes,"
 * JACM 30(3):479-513, 1983): a schema is alpha-acyclic IFF every PAIRWISE CONSISTENT instance over
 * it is GLOBALLY CONSISTENT - i.e. has a universal relation whose projections are exactly the
 * given relations. Alpha-acyclicity is decided by the GYO reduction (Graham 1979; Yu & Ozsoyoglu
 * 1979), which is what this file implements.
 *
 * So: on an acyclic cover, local consistency is enough - no coordination protocol, no cleverer
 * merge operator. On a cyclic one NO merge operator rescues you, because the counterexample is an
 * INSTANCE, not an algorithm. `witness.ts` exhibits one and checks it by exhaustion.
 *
 * WHAT THIS DOES NOT DECIDE - see docs/research/2026-08-18-the-shape-of-the-cover-decides-*.md:
 *   - Nothing about CRDTs, Bell inequalities, or our merge algebra. The companion doc
 *     `2026-08-17-path-independence-is-four-properties-refuting-...` REFUTED that identification.
 *     This criterion survives on its own database-theoretic footing and is presented that way.
 *   - The Vorob'ev-condition <=> acyclicity equivalence (Vorob'ev 1962; attributed to Rui Soares
 *     Barbosa in Abramsky 2013 section 7) is CITED, NOT checked. Nothing here depends on it: every
 *     property this module claims is checked against the BFMY/database statement directly, by
 *     exhibiting instances.
 *
 * REGISTER: `metered` for the GYO decision - it has falsifiers (mutation-checked) and both
 * verdicts carry certificates validated by checkers that never call GYO. `unmetered` for any
 * reading of it beyond relational covers.
 *
 * ---------------------------------------------------------------------------------------------
 * THE ALGORITHM (GYO). Repeat until neither rule fires:
 *   (E) EAR / isolated-vertex removal - delete an attribute occurring in exactly one edge.
 *   (C) CONTAINMENT removal           - delete an edge contained in some other surviving edge.
 * The cover is alpha-acyclic IFF this reduces it to nothing. GYO is confluent - the verdict does
 * not depend on the order the rules fire - which is asserted as a property test, never assumed.
 *
 * CERTIFICATES. A boolean is not reviewable, so both verdicts carry one:
 *   - acyclic -> a JOIN TREE, validated by `validateJoinTree` (running-intersection property),
 *                which never calls GYO.
 *   - cyclic  -> the CYCLIC CORE, the irreducible residue, validated by `validateCyclicCore`:
 *                nonempty, a sub-cover of the input, and a fixed point of BOTH rules.
 *
 * Pure and total: no I/O, no clock, no randomness. Ordinal (`<`) string comparison only - never
 * `localeCompare` (`.claude/rules/culture-invariant-by-default.md`).
 *
 * Work item: 081M0AH5TQQ087G0R003CNFRAF
 */

// === Cover ==================================================================

/** One element of a cover: a named set of attributes (a table, a shard, a local view). */
export interface CoverEdge {
  /** Stable identifier, unique within the cover. */
  readonly name: string;
  /** The attribute set. Duplicates are collapsed; order is irrelevant. */
  readonly attributes: readonly string[];
}

/** A cover: a finite family of attribute sets over a finite attribute universe. */
export type Cover = readonly CoverEdge[];

/** An edge of the join tree: the two cover-element names it connects. */
export interface JoinTreeEdge {
  readonly parent: string;
  readonly child: string;
}

/**
 * A join tree over a cover - the certificate of alpha-acyclicity. `nodes` is every cover-element
 * name; `edges` has exactly `nodes.length - 1` entries (0 when the cover is empty).
 */
export interface JoinTree {
  readonly nodes: readonly string[];
  readonly edges: readonly JoinTreeEdge[];
}

/** The verdict - always with a certificate. */
export type GyoVerdict =
  | { readonly acyclic: true; readonly joinTree: JoinTree }
  | { readonly acyclic: false; readonly cyclicCore: Cover };

// === Ordinal helpers (culture-invariant by construction) =====================

/** Ordinal (code-unit) string ordering. NEVER `localeCompare`. */
export function ordinalCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Deduplicate + ordinal-sort an attribute list, so an edge has one canonical form. */
function canonicalAttributes(attrs: readonly string[]): readonly string[] {
  return [...new Set(attrs)].sort(ordinalCompare);
}

/** `a` is a subset of `b`, over attribute sets. */
export function isSubsetOf(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

// === Normalization ==========================================================

/**
 * Canonical form of a cover: attributes deduplicated and ordinal-sorted, edges kept in the
 * caller's order (GYO is confluent, so order cannot change the verdict - but keeping it makes the
 * certificate reproducible).
 *
 * Throws on duplicate edge NAMES: two cover elements sharing a name make the join-tree
 * certificate ambiguous, and silently merging them would misreport the cover.
 */
export function canonicalizeCover(cover: Cover): Cover {
  const seen = new Set<string>();
  for (const e of cover) {
    if (seen.has(e.name)) {
      throw new Error(`canonicalizeCover: duplicate cover-element name "${e.name}"`);
    }
    seen.add(e.name);
  }
  return cover.map((e) => ({ name: e.name, attributes: canonicalAttributes(e.attributes) }));
}

// === The GYO reduction ======================================================

interface LiveEdge {
  readonly name: string;
  /** Attributes still present after ear removals; mutated during the reduction. */
  readonly attrs: Set<string>;
  alive: boolean;
}

/**
 * Decide alpha-acyclicity of a cover by GYO reduction, returning a certificate.
 *
 * Total: every rule application strictly decreases (surviving edges, surviving
 * attribute-occurrences), a pair bounded below - so the loop terminates.
 * Cost: O(|E|^2 * |V|) worst case, which is nothing at schema scale.
 */
export function gyoReduce(cover: Cover): GyoVerdict {
  const canonical = canonicalizeCover(cover);
  const live: LiveEdge[] = canonical.map((e) => ({
    name: e.name,
    attrs: new Set(e.attributes),
    alive: true,
  }));

  // Join-tree edges accumulate as containment removals fire: an edge absorbed into another is
  // attached to its absorber. Ear removals attach nothing - they delete attributes.
  const treeEdges: JoinTreeEdge[] = [];

  let progressed = true;
  while (progressed) {
    progressed = false;

    // -- Rule (E): remove attributes occurring in exactly one surviving edge --
    const occurrences = new Map<string, number>();
    for (const e of live) {
      if (!e.alive) continue;
      for (const a of e.attrs) occurrences.set(a, (occurrences.get(a) ?? 0) + 1);
    }
    for (const e of live) {
      if (!e.alive) continue;
      for (const a of [...e.attrs].sort(ordinalCompare)) {
        if (occurrences.get(a) === 1) {
          e.attrs.delete(a);
          progressed = true;
        }
      }
    }

    // -- Rule (C): remove an edge contained in another surviving edge --
    // Deterministic tie-break: for EQUAL attribute sets the lower index survives, so two
    // identical edges cannot delete each other.
    for (let i = 0; i < live.length; i++) {
      const ei = live[i]!;
      if (!ei.alive) continue;
      for (let j = 0; j < live.length; j++) {
        if (i === j) continue;
        const ej = live[j]!;
        if (!ej.alive) continue;
        if (!isSubsetOf(ei.attrs, ej.attrs)) continue;
        if (ei.attrs.size === ej.attrs.size && j > i) continue; // equal sets: keep lower index
        ei.alive = false;
        treeEdges.push({ parent: ej.name, child: ei.name });
        progressed = true;
        break;
      }
    }

    // An edge whose attributes are all gone is contained in every edge; when it is the LAST one
    // standing rule (C) has no partner to absorb it, so retire it here. This is the accepting
    // termination state, and it is the ONLY place an edge dies without a tree edge - which is why
    // the join tree comes out with exactly |nodes| - 1 edges.
    const survivors = live.filter((e) => e.alive);
    if (survivors.length === 1 && survivors[0]!.attrs.size === 0) {
      survivors[0]!.alive = false;
      progressed = true;
    }
  }

  const residue = live.filter((e) => e.alive);
  if (residue.length === 0) {
    return {
      acyclic: true,
      joinTree: { nodes: canonical.map((e) => e.name), edges: treeEdges },
    };
  }

  // Cyclic: report the irreducible core - the elements that survived, carrying the attributes
  // that survived EAR REMOVAL, because that is the hypergraph the reduction actually got stuck
  // on. Reporting their original attributes instead (tried first, and wrong) yields something
  // that is not a fixed point: a once-occurring attribute stripped during the reduction reappears
  // and rule (E) fires on the "irreducible" core. Element NAMES still map back to the input, so a
  // reader can find these tables in their schema.
  return {
    acyclic: false,
    cyclicCore: residue.map((e) => ({
      name: e.name,
      attributes: [...e.attrs].sort(ordinalCompare),
    })),
  };
}

/** Convenience: the boolean, when the certificate is not wanted. */
export function isAlphaAcyclic(cover: Cover): boolean {
  return gyoReduce(cover).acyclic;
}

// === Independent certificate validation =====================================
//
// These NEVER call gyoReduce. That is the whole point: a certificate checked by the procedure
// that produced it certifies nothing.

/** Why a join tree failed validation - a reason, not a bare `false`. */
export type JoinTreeDefect =
  | { readonly kind: "unknown-node"; readonly node: string }
  | { readonly kind: "missing-node"; readonly node: string }
  | { readonly kind: "wrong-edge-count"; readonly expected: number; readonly actual: number }
  | { readonly kind: "disconnected"; readonly reachable: number; readonly total: number }
  | {
      readonly kind: "running-intersection-violated";
      readonly attribute: string;
      readonly from: string;
      readonly to: string;
      readonly missingAt: string;
    };

/**
 * Validate a join tree against a cover, independently of GYO.
 *
 * A join tree is a tree whose nodes are the cover elements such that for every attribute `a` the
 * set of nodes containing `a` is CONNECTED in the tree (the running-intersection property, BFMY
 * 1983). Equivalently: for every pair u,v and every `a` in u-intersect-v, every node on the u-v
 * path contains `a`.
 *
 * Returns `[]` when the tree is valid, otherwise the defects found.
 */
export function validateJoinTree(cover: Cover, tree: JoinTree): readonly JoinTreeDefect[] {
  const defects: JoinTreeDefect[] = [];
  const attrsOf = new Map<string, ReadonlySet<string>>();
  for (const e of cover) attrsOf.set(e.name, new Set(e.attributes));

  for (const n of tree.nodes) {
    if (!attrsOf.has(n)) defects.push({ kind: "unknown-node", node: n });
  }
  const nodeSet = new Set(tree.nodes);
  for (const e of cover) {
    if (!nodeSet.has(e.name)) defects.push({ kind: "missing-node", node: e.name });
  }
  if (defects.length > 0) return defects;

  const expectedEdges = tree.nodes.length === 0 ? 0 : tree.nodes.length - 1;
  if (tree.edges.length !== expectedEdges) {
    defects.push({ kind: "wrong-edge-count", expected: expectedEdges, actual: tree.edges.length });
    return defects;
  }

  // Adjacency + connectivity. With exactly |V| - 1 edges, connected <=> tree.
  const adj = new Map<string, string[]>();
  for (const n of tree.nodes) adj.set(n, []);
  for (const { parent, child } of tree.edges) {
    if (!adj.has(parent)) return [{ kind: "unknown-node", node: parent }];
    if (!adj.has(child)) return [{ kind: "unknown-node", node: child }];
    adj.get(parent)!.push(child);
    adj.get(child)!.push(parent);
  }
  if (tree.nodes.length > 0) {
    const seen = new Set<string>([tree.nodes[0]!]);
    const stack = [tree.nodes[0]!];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      for (const nb of adj.get(cur)!) {
        if (!seen.has(nb)) {
          seen.add(nb);
          stack.push(nb);
        }
      }
    }
    if (seen.size !== tree.nodes.length) {
      defects.push({ kind: "disconnected", reachable: seen.size, total: tree.nodes.length });
      return defects;
    }
  }

  // Running intersection: for each unordered pair, walk the unique path and check membership.
  const sortedNodes = [...tree.nodes].sort(ordinalCompare);
  for (const u of sortedNodes) {
    const parentOf = bfsParents(adj, u);
    for (const v of sortedNodes) {
      if (ordinalCompare(u, v) >= 0) continue;
      const shared = [...attrsOf.get(u)!]
        .filter((a) => attrsOf.get(v)!.has(a))
        .sort(ordinalCompare);
      if (shared.length === 0) continue;
      const path = pathFrom(parentOf, v);
      for (const a of shared) {
        for (const w of path) {
          if (!attrsOf.get(w)!.has(a)) {
            defects.push({
              kind: "running-intersection-violated",
              attribute: a,
              from: u,
              to: v,
              missingAt: w,
            });
          }
        }
      }
    }
  }
  return defects;
}

function bfsParents(adj: ReadonlyMap<string, string[]>, root: string): Map<string, string | null> {
  const parent = new Map<string, string | null>([[root, null]]);
  const queue: string[] = [root];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++]!;
    for (const nb of adj.get(cur) ?? []) {
      if (!parent.has(nb)) {
        parent.set(nb, cur);
        queue.push(nb);
      }
    }
  }
  return parent;
}

/** The path root..target, inclusive of both ends. */
function pathFrom(parentOf: ReadonlyMap<string, string | null>, target: string): readonly string[] {
  const out: string[] = [];
  let cur: string | null | undefined = target;
  while (cur !== null && cur !== undefined) {
    out.push(cur);
    cur = parentOf.get(cur) ?? null;
  }
  return out.reverse();
}

/**
 * Validate a cyclic-core certificate: the core must be NONEMPTY, name only elements of the input,
 * carry only attributes those elements actually have, and be a FIXED POINT of both GYO rules.
 * This re-implements the two RULES, not the driver loop - so a bug in the loop cannot certify
 * itself.
 *
 * HONEST SCOPE, and it is an asymmetry worth stating rather than papering over: an ACYCLIC
 * verdict has a genuinely independent certificate (the join tree is checkable against the cover
 * with no reference to how it was found). A CYCLIC verdict does not. This check confirms the
 * reduction stopped somewhere it legitimately could stop; it does not re-derive that the stopping
 * point was forced. The independent check for a cyclic verdict is SEMANTIC - `searchGluingWitness`
 * in `witness.ts` produces an actual locally-consistent, globally-inconsistent instance - and that
 * is what the test suite uses.
 */
export function validateCyclicCore(cover: Cover, core: Cover): boolean {
  if (core.length === 0) return false;
  const byName = new Map(canonicalizeCover(cover).map((e) => [e.name, e.attributes] as const));
  for (const e of core) {
    const original = byName.get(e.name);
    if (original === undefined) return false;
    const originalSet = new Set(original);
    for (const a of e.attributes) if (!originalSet.has(a)) return false;
  }
  const sets = core.map((e) => new Set(e.attributes));
  // Rule (E) must not fire: no attribute occurs in exactly one core edge.
  const occ = new Map<string, number>();
  for (const s of sets) for (const a of s) occ.set(a, (occ.get(a) ?? 0) + 1);
  for (const n of occ.values()) if (n === 1) return false;
  // Rule (C) must not fire: no core edge is contained in another.
  for (let i = 0; i < sets.length; i++) {
    for (let j = 0; j < sets.length; j++) {
      if (i === j) continue;
      if (isSubsetOf(sets[i]!, sets[j]!)) return false;
    }
  }
  return true;
}
