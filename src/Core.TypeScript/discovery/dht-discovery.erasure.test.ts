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
  dhtErasureProfiles,
  emptyTable,
  expireNodes,
  observeNode,
  type DhtNode,
  type RoutingTable,
} from "./dht-discovery";

// ── the pinned model ──────────────────────────────────────────────────────────────────────────
// Self is "00"; the four universe nodes all share bucket 3, so k = 2 forces eviction as soon as a
// third distinct node is observed. That is the smallest model in which the operation under test
// actually fires.

const SELF = "00";
const K = 2;
const PINNED_NOW = 100;
const PINNED_TTL = 50;

const universe: readonly DhtNode[] = ["10", "11", "12", "13"].map((dest) => ({
  dest,
  zid: `zid-${dest}`,
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
  const out: DhtNode[][] = [[]];
  for (const a of universe) {
    out.push([a]);
    for (const b of universe) {
      out.push([a, b]);
      for (const c of universe) out.push([a, b, c]);
    }
  }
  return out;
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

/** A routing table rendered exactly — bucket order is MRU and therefore load-bearing. */
function render(t: RoutingTable): string {
  const parts: string[] = [`self=${t.self}`, `k=${t.k}`];
  for (const idx of [...t.buckets.keys()].sort((a, b) => a - b)) {
    const bucket = t.buckets.get(idx) ?? [];
    parts.push(`${idx}:[${bucket.map((n) => `${n.dest}@${n.lastSeenMs}`).join(",")}]`);
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
