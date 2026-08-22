/**
 * dht-discovery.erasure.test.ts — the law pack for the k-bucket eviction site.
 *
 * Same machinery as `tests/Tests.FSharp/Formal/Erasure.Representation.Laws.Tests.fs`, in the
 * language the representation is written in: a class DECLARED beside the operation, MEASURED by
 * sweep, required to agree in BOTH directions, with a drift guard so a new table-producing
 * function fails rather than passes silently.
 *
 * WHAT CANNOT BE SWEPT HERE, said out loud. A DHT routing table has no enumerable domain: node ids
 * are destination hashes over a 160-bit space, `k` is a deployment parameter, and `nowMs` is a real
 * clock. So the evidence is a BOUNDED MODEL SWEEP — the real functions run over every point of a
 * domain whose id space and `k` are pinned small — and the model string names the pinning. What it
 * does not cover: production `k`, collisions at full id width, and any bucket-splitting policy a
 * later revision adds. An honest small sweep beats a confident large claim.
 *
 * WHY THE POOL IS BOUND (2026-08-22). Every node here is a real `(destinationHash(zid), zid)`
 * pair. It used to be a short literal (`{dest: "10", zid: "zid-10"}`), and that pool is now
 * REFUSED by `classifyDhtNode` — a sweep over records the code cannot accept measures nothing.
 * The four original numbers were re-derived over the bound pool and three came back identical;
 * the reason is in `dhtErasureProfiles`' header and it is structural, not luck. A fifth sweep is
 * new: it runs the domain that now contains refusals, and it is the guard's own falsifier.
 *
 * WHY THE TIMESTAMP IS PINNED. If each observation carried a distinct `nowMs`, every table would
 * be distinguishable by its timestamps and the sweep would report fibre 1 — a REVERSIBLE eviction,
 * which is false. The bucket would still have dropped a node; the clock would merely have made the
 * survivors look unique. Pinning the clock removes an artefact of the probe, not evidence.
 */

import { describe, expect, test } from "bun:test";
import {
  bitsErasedPpm,
  bitsPpmOfLargestFibre,
  classOfLargestFibre,
  inconsistencies,
  isSwept,
  largestFibre,
  measureLargestFibre,
  profileKey,
  type ErasureProfile,
} from "../algebra/erasure-class";
import {
  bucketIndex,
  dhtErasureProfiles,
  emptyTable,
  expireNodes,
  isAddressBound,
  observeNode,
  type DhtNode,
  type RoutingTable,
} from "./dht-discovery";
import { destinationHash } from "./reticulum-transport";

// ── the pinned model ──────────────────────────────────────────────────────────────────────────
// The ids are no longer choosable: a node's `dest` must be `destinationHash(zid)` or the fold
// refuses it. So the universe is FOUND rather than written — the first four zids of the form
// `dht-peer-<i>` whose destination hash lands in the same bucket as each other relative to self.
// One shared bucket at k = 2 is what makes eviction fire, and it is the property the old literal
// ids ("10".."13" all in bucket 3 of self "00") were chosen to have. The search is deterministic
// (no rng), so it is DST-replayable, and its answer is pinned below so a change in
// `destinationHash` shows up as a failing expectation rather than a silently different model.

const SELF_ZID = "dht-self";
const SELF = destinationHash(SELF_ZID);
const K = 2;
const PINNED_NOW = 100;
const PINNED_TTL = 50;
const SHARED_BUCKET = 3;

function peersInSharedBucket(count: number): DhtNode[] {
  const out: DhtNode[] = [];
  for (let i = 0; out.length < count; i++) {
    const zid = `dht-peer-${i}`;
    const dest = destinationHash(zid);
    if (bucketIndex(SELF, dest) === SHARED_BUCKET) out.push({ dest, zid, lastSeenMs: 0 });
  }
  return out;
}

const universe: readonly DhtNode[] = peersInSharedBucket(4);

/**
 * The forgeries. Each carries a real universe node's `dest` under a DIFFERENT universe node's
 * `zid` — an identity placed at an id it does not hash to, which is precisely what `observeNode`
 * could not previously tell apart from a genuine record. They are the input domain of the fifth
 * sweep, and every one of them must be refused.
 */
const impostors: readonly DhtNode[] = universe.map((n, i) => ({
  dest: n.dest,
  zid: universe[(i + 1) % universe.length]!.zid,
  lastSeenMs: 0,
}));

/**
 * The two-node sub-universe. With k = 2 a bucket holding at most two nodes NEVER fills, so no
 * eviction can fire — which isolates the OTHER erasure in `observeNode`: the idempotent refresh.
 * A re-heard node is moved rather than duplicated, so two different histories land on one table
 * whether or not anything was ever evicted.
 */
const nonEvictingUniverse = universe.slice(0, 2);

/** Every observation sequence of length 0..3 over the four-node universe — 85 states. */
function sequences(): DhtNode[][] {
  return sequencesOver(universe);
}

function sequencesOver(pool: readonly DhtNode[]): DhtNode[][] {
  const out: DhtNode[][] = [[]];
  for (const a of pool) {
    out.push([a]);
    for (const b of pool) {
      out.push([a, b]);
      for (const c of pool) out.push([a, b, c]);
    }
  }
  return out;
}

function fold(seq: readonly DhtNode[]): RoutingTable {
  let t = emptyTable(SELF, K);
  for (const n of seq) t = observeNode(t, n, PINNED_NOW);
  return t;
}

/**
 * A routing table rendered exactly — bucket order is MRU and therefore load-bearing.
 *
 * `zid` is part of the render, which it was not before, because the declared observation is "the
 * routing table" and `zid` is in the table. On the four bound-pool sweeps this changes nothing —
 * there `zid` is a function of `dest` — so the added field can only sharpen the observation.
 *
 * It is NOT what makes the fifth row a falsifier, and the first version of this comment said it
 * was. Measured rather than assumed: dropping `zid` from the render alone leaves every test
 * passing, and dropping it TOGETHER with the `observeNode` guard still fails the row (fibre 44
 * against a declared 85, where the guard-only removal gives 11). The row catches the guard's
 * removal either way; `zid` only changes by how much. Recorded because a surviving mutant that is
 * re-aimed and then found harmless is worth more written down than quietly dropped.
 */
function render(t: RoutingTable): string {
  const parts: string[] = [`self=${t.self}`, `k=${t.k}`];
  for (const idx of [...t.buckets.keys()].sort((a, b) => a - b)) {
    const bucket = t.buckets.get(idx) ?? [];
    parts.push(`${idx}:[${bucket.map((n) => `${n.dest}/${n.zid}@${n.lastSeenMs}`).join(",")}]`);
  }
  return parts.join("|");
}

// ── the sweep table ───────────────────────────────────────────────────────────────────────────

interface Sweep {
  readonly representation: string;
  readonly operation: string;
  readonly observation: string;
  readonly measure: () => number;
}

const REPRESENTATION = "dht-discovery routing table (k-bucket, MRU)";

const sweeps: readonly Sweep[] = [
  {
    representation: REPRESENTATION,
    operation: "observeNode",
    observation: "the routing table returned by observeNode",
    measure: () => measureLargestFibre(sequences(), (seq) => render(fold(seq))),
  },
  {
    representation: REPRESENTATION,
    operation: "observeNode",
    observation: "the routing table returned by observeNode, over histories in which no bucket ever fills",
    // The decomposition. Restricted to two nodes a bucket of size 2 never overflows, so nothing is
    // evicted — and the map is STILL non-injective, because an idempotent refresh collapses two
    // histories onto one table. Measured against the row above, this says how much of the erasure
    // the eviction actually accounts for and how much was already in the ordinary fold. That split
    // is the whole correction this pack exists to carry, reproduced at a site nobody expected it.
    measure: () => measureLargestFibre(sequencesOver(nonEvictingUniverse), (seq) => render(fold(seq))),
  },
  {
    representation: REPRESENTATION,
    operation: "observeNode",
    observation:
      "the routing table returned by observeNode, over histories that include records whose dest does not commit to their zid",
    // The address-integrity guard, measured as the erasure it is. 585 histories over the bound
    // universe UNION its four impostors; the 85 that consist only of impostors all land on the
    // empty table, because a refused record leaves the table byte-identical and the guard keeps no
    // trace that it fired. 85 is derived, not fitted: it is the count of sequences of length 0-3
    // over 4 elements (1 + 4 + 16 + 64). Delete the guard and this measures 11.
    measure: () => measureLargestFibre(sequencesOver([...universe, ...impostors]), (seq) => render(fold(seq))),
  },
  {
    representation: REPRESENTATION,
    operation: "expireNodes",
    observation: "the routing table returned by expireNodes",
    // Observations are stamped at PINNED_NOW; expiring at PINNED_NOW + 2*TTL drops every entry,
    // which is the maximal-erasure case and the analogue of the F# pack's pinned truncation point.
    measure: () =>
      measureLargestFibre(sequences(), (seq) =>
        render(expireNodes(fold(seq), PINNED_NOW + 2 * PINNED_TTL, PINNED_TTL)),
      ),
  },
  {
    representation: REPRESENTATION,
    operation: "emptyTable",
    observation: "the routing table returned by emptyTable",
    // The constructor. Non-vacuous despite being obvious: stop recording `k` on the table and this
    // collapses from fibre 1 to fibre 3 immediately.
    measure: () =>
      measureLargestFibre(
        ["00", "01", "ff"].flatMap((self) => [1, 2, 20].map((k) => ({ self, k }))),
        ({ self, k }) => render(emptyTable(self, k)),
      ),
  },
];

const declared = new Map(dhtErasureProfiles.map((p) => [profileKey(p), p] as const));

function sweepKey(s: Sweep): string {
  return `${s.representation}::${s.operation}::${s.observation}`;
}

describe("dht-discovery erasure classification", () => {
  test("every declared thermodynamic class matches the measured class", () => {
    const mismatches: string[] = [];
    for (const sweep of sweeps) {
      const key = sweepKey(sweep);
      const profile = declared.get(key);
      if (!profile) {
        mismatches.push(`${key}: swept, but no representation declares it`);
        continue;
      }
      const fibre = sweep.measure();
      const measured = classOfLargestFibre(fibre);
      if (measured !== profile.classification) {
        mismatches.push(
          `${key}: declared ${profile.classification} but measured ${measured} (largest fibre ${fibre}, ${bitsPpmOfLargestFibre(fibre)} bits-ppm)`,
        );
      }
    }
    expect(mismatches).toEqual([]);
  });

  test("every declared fibre and bit count matches the measured one", () => {
    const mismatches: string[] = [];
    for (const sweep of sweeps) {
      const key = sweepKey(sweep);
      const profile = declared.get(key)!;
      const fibre = sweep.measure();
      const ppm = bitsPpmOfLargestFibre(fibre);
      if (largestFibre(profile) !== fibre || bitsErasedPpm(profile) !== ppm) {
        mismatches.push(
          `${key}: declared fibre ${largestFibre(profile)} / ${bitsErasedPpm(profile)} ppm, measured fibre ${fibre} / ${ppm} ppm`,
        );
      }
    }
    expect(mismatches).toEqual([]);
  });

  test("every declaration is internally consistent with its own evidence", () => {
    const violations = dhtErasureProfiles.flatMap((p) => [...inconsistencies(p)]);
    expect(violations).toEqual([]);
  });

  test("every swept declaration is measured here and every measurement has a declaration", () => {
    const sweptKeys = new Set(sweeps.map(sweepKey));
    const claimingSweep = new Set(dhtErasureProfiles.filter(isSwept).map(profileKey));

    const claimedButUnmeasured = [...claimingSweep].filter((k) => !sweptKeys.has(k));
    const measuredButUndeclared = [...sweptKeys].filter((k) => !claimingSweep.has(k));

    // A declaration claiming a sweep that nobody runs is a golden vector nobody reads.
    expect(claimedButUnmeasured).toEqual([]);
    expect(measuredButUndeclared).toEqual([]);
  });

  test("drift guard: every exported function returning a RoutingTable is classified", async () => {
    // TypeScript erases types at runtime, so the mechanical criterion is applied to the SOURCE:
    // any exported function whose declared return type is `RoutingTable` is a state transition and
    // must be declared. Add one without classifying it and this fails.
    const source = await Bun.file(new URL("./dht-discovery.ts", import.meta.url)).text();
    const producers = new Set<string>();
    const pattern = /export function (\w+)\([^)]*\)\s*:\s*RoutingTable\b/g;
    for (const match of source.matchAll(pattern)) producers.add(match[1]!);

    // Non-empty, or the criterion has stopped matching anything and the guard is decorative.
    expect(producers.size).toBeGreaterThan(0);

    const classified = new Set(dhtErasureProfiles.map((p) => p.operation));
    expect([...producers].filter((n) => !classified.has(n)).sort()).toEqual([]);
    expect([...classified].filter((n) => !producers.has(n)).sort()).toEqual([]);
  });

  test("the evicted node is unrecoverable — the erasure, exhibited", () => {
    // The fibre measurement is the general statement. This is the particular one, checkable by
    // hand: two different observation histories, one table, and no channel back to the difference.
    const [a, b, c] = universe as readonly [DhtNode, DhtNode, DhtNode, DhtNode];

    const withEviction = fold([a, b, c]);
    const withoutEviction = fold([b, c]);

    expect(render(withEviction)).toBe(render(withoutEviction));

    // …and `a` is genuinely absent, not merely reordered.
    const bucket = [...withEviction.buckets.values()].flat();
    expect(bucket.some((n) => n.dest === a.dest)).toBe(false);
    expect(bucket.length).toBe(K);
  });

  test("the model is pinned — the bound universe and its impostors are what the sweeps claim", () => {
    // The universe is FOUND by a deterministic search, so the search's answer is pinned here.
    // Change `destinationHash` or the search and this fails loudly instead of silently sweeping a
    // different model than the declarations describe.
    expect(SELF).toBe("80e2ed443b84b9f8132e0584c2ab7de7");
    expect(universe.map((n) => n.zid)).toEqual(["dht-peer-3", "dht-peer-62", "dht-peer-71", "dht-peer-72"]);
    expect(new Set(universe.map((n) => bucketIndex(SELF, n.dest))).size).toBe(1);
    expect(universe.length).toBeGreaterThan(K); // or eviction never fires and the sweep is decorative

    // BOTH DIRECTIONS, on the domain the fifth sweep runs: every genuine record is admitted and
    // every impostor is refused. A guard that refused everything would satisfy the second line
    // and fail the first.
    for (const n of universe) expect(isAddressBound(n)).toBe(true);
    for (const n of impostors) expect(isAddressBound(n)).toBe(false);
    // …and the impostors are a real forgery, not junk: each carries a genuine node's dest.
    const genuineDests = new Set(universe.map((n) => n.dest));
    for (const n of impostors) expect(genuineDests.has(n.dest)).toBe(true);
  });

  test("the refused record is unrecoverable — the guard's erasure, exhibited", () => {
    // The particular statement behind the fifth sweep's 85: a history of nothing but forgeries is
    // indistinguishable from a history of nothing at all.
    const allRefused = fold([...impostors].slice(0, 3));
    expect(render(allRefused)).toBe(render(emptyTable(SELF, K)));

    // …and a forgery cannot displace the genuine record it impersonates.
    const genuine = universe[0]!;
    const forged = impostors[0]!;
    expect(forged.dest).toBe(genuine.dest); // same address, different identity
    const t = fold([genuine, forged]);
    const held = [...t.buckets.values()].flat().find((n) => n.dest === genuine.dest)!;
    expect(held.zid).toBe(genuine.zid);
  });

  test("no declaration reads as free by default", () => {
    // The class this vocabulary exists to prevent: an unmeasured operation recorded as zero bits.
    for (const p of dhtErasureProfiles) {
      if (p.classification === "unmeasured") {
        expect(bitsErasedPpm(p)).toBeUndefined();
        expect(largestFibre(p)).toBeUndefined();
      } else {
        expect(bitsErasedPpm(p)).not.toBeUndefined();
      }
    }
  });
});

// A compile-time reminder that the declared shape is the shared one, not a local look-alike.
const _typeCheck: readonly ErasureProfile[] = dhtErasureProfiles;
void _typeCheck;
