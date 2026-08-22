/**
 * announce-metric-chain.test.ts — the falsifiers for the one-sided hop metric.
 *
 * BOTH DIRECTIONS, and the accept side is the one that decides this. A mechanism that refuses
 * every metric passes every deflation test and is useless — worse, it looks like a control. The
 * genuine case here is not "one valid value": it is an EIGHT-HOP HONEST RELAY CHAIN, because the
 * fix this mechanism replaces (sign `hops`) fails exactly there, and "we had to turn it off to
 * ship" is how a control becomes decoration. `refuse-everything` must fail this file loudly, and
 * the accept-side count is asserted below so that it does.
 *
 * WHAT IS MEASURED, not asserted:
 *   - deflation by every distance from every hop, over a full chain — refused;
 *   - inflation — ADMITTED, deliberately, because inflation is self-harm and no mechanism can
 *     prevent a relay from being a bad path;
 *   - the relay's cost — one `advanceMetric` call per hop, and the eight-hop chain verifies;
 *   - permutation invariance of the epoch floor (the local-time rule's own litmus);
 *   - the composition order — an unverified signature can never move the floor.
 */

import { describe, expect, it } from "bun:test";
import {
  admitEpoch,
  admitMetric,
  advanceMetric,
  deriveSeed,
  emptyFloor,
  MAX_CHAIN,
  metricEpoch,
  raiseFloor,
  verifyMetric,
  type EpochFloor,
  type MetricEpoch,
} from "./announce-metric-chain.ts";

const SECRET = "node-local-secret-never-on-the-wire";
const ZID = "081KZZZ000008QG0R000TESTZID";
const MAX_HOPS = 8;

function epochAt(seq: number, maxHops = MAX_HOPS) {
  return metricEpoch(deriveSeed(SECRET, ZID, seq), seq, maxHops);
}

/** The honest mesh, replayed: hop 0 is emitted by the origin, each relay hashes once. */
function honestRelayChain(seed: string, hops: number): string {
  let v = advanceMetric(seed); // value_0 — the origin's own emission
  for (let i = 0; i < hops; i++) v = advanceMetric(v);
  return v;
}

describe("the genuine case — an honest relay must keep working (the accept side)", () => {
  it("an eight-hop honest relay chain verifies at every hop", () => {
    const { epoch, values } = epochAt(1);
    for (let k = 0; k <= MAX_HOPS; k++) {
      expect(verifyMetric(epoch, k, values[k]!)).toEqual({ ok: true });
    }
  });

  it("a relay reproduces the next value with ONE hash — the cost claim, run rather than stated", () => {
    const { values } = epochAt(1);
    for (let k = 0; k < MAX_HOPS; k++) {
      expect(advanceMetric(values[k]!)).toBe(values[k + 1]!);
    }
  });

  it("a mesh that only ever relays — never re-derives — still verifies at the far end", () => {
    // The relay holds no seed, no key, and no epoch state: it hashes what it was handed. This is
    // the property the per-hop-signature alternative cannot offer at this price.
    const seed = deriveSeed(SECRET, ZID, 1);
    const { epoch } = epochAt(1);
    expect(verifyMetric(epoch, MAX_HOPS, honestRelayChain(seed, MAX_HOPS))).toEqual({ ok: true });
    expect(verifyMetric(epoch, 3, honestRelayChain(seed, 3))).toEqual({ ok: true });
  });

  it("the same epoch re-heard over many paths is admitted every time (equal seq is NOT stale)", () => {
    // The path table learns the BEST route by hearing one epoch over several paths at different
    // hop counts. A gate that refused `seq === floor` would break route discovery while passing
    // every attack test — the exact failure this file exists to catch.
    const { epoch, values } = epochAt(7);
    let floor: EpochFloor = raiseFloor(emptyFloor, ZID, 7);
    for (const k of [5, 2, 8, 2, 0]) {
      const out = admitMetric(floor, ZID, epoch, k, values[k]!, true);
      expect(out.verdict).toEqual({ ok: true });
      floor = out.floor;
    }
  });

  it("a fresher epoch is admitted and raises the floor", () => {
    const e1 = epochAt(1);
    const e2 = epochAt(2);
    const a1 = admitMetric(emptyFloor, ZID, e1.epoch, 0, e1.values[0]!, true);
    expect(a1.verdict).toEqual({ ok: true });
    const a2 = admitMetric(a1.floor, ZID, e2.epoch, 0, e2.values[0]!, true);
    expect(a2.verdict).toEqual({ ok: true });
    expect(a2.floor.get(ZID)).toBe(2);
  });

  it("a different identity's floor is untouched — the floor is per-identity", () => {
    const other = "081KZZZ000008QG0R000OTHERZID";
    const floor = raiseFloor(emptyFloor, ZID, 99);
    expect(admitEpoch(floor, other, 0)).toBe(true);
  });
});

describe("deflation — the attack, refused", () => {
  it("every deflation from every hop over a full chain is refused", () => {
    const { epoch, values } = epochAt(1);
    let refusals = 0;
    for (let held = 1; held <= MAX_HOPS; held++) {
      for (let claimed = 0; claimed < held; claimed++) {
        // The attacker holds `values[held]` (its true distance) and claims to be closer.
        expect(verifyMetric(epoch, claimed, values[held]!)).toEqual({ ok: false, reason: "metric-unverifiable" });
        refusals += 1;
      }
    }
    expect(refusals).toBe((MAX_HOPS * (MAX_HOPS + 1)) / 2); // 36 — every (held, claimed<held) pair
  });

  it("the headline case: a captured genuine announce replayed at hops 0 is refused", () => {
    const { epoch, values } = epochAt(1);
    expect(verifyMetric(epoch, MAX_HOPS, values[MAX_HOPS]!)).toEqual({ ok: true }); // genuine, far
    expect(verifyMetric(epoch, 0, values[MAX_HOPS]!)).toEqual({ ok: false, reason: "metric-unverifiable" });
  });

  it("an attacker cannot mint a value for a hop it never reached (no chain without the seed)", () => {
    const { epoch } = epochAt(1);
    const forged = deriveSeed("attacker-secret", ZID, 1);
    for (let k = 0; k <= MAX_HOPS; k++) {
      expect(verifyMetric(epoch, k, forged).ok).toBe(false);
    }
  });

  it("a value from ANOTHER epoch does not verify against this epoch's anchor", () => {
    const e1 = epochAt(1);
    const e2 = epochAt(2);
    expect(verifyMetric(e2.epoch, 0, e1.values[0]!).ok).toBe(false);
  });

  it("a value from another IDENTITY does not verify", () => {
    const { epoch } = epochAt(1);
    const other = metricEpoch(deriveSeed(SECRET, "081KZZZ000008QG0R000OTHERZID", 1), 1, MAX_HOPS);
    expect(verifyMetric(epoch, 0, other.values[0]!).ok).toBe(false);
  });
});

describe("inflation — admitted on purpose, and the reason is in the assertion", () => {
  it("a relay that over-counts its own distance is ACCEPTED", () => {
    // Inflation is indistinguishable from a slow link or from declining to relay, and no mechanism
    // prevents a node from being a bad path. The requirement is one-sided by construction: a hop
    // count may never be LOWER than the path actually held. Refusing inflation here would be a
    // check that cannot be satisfied by an honest relay on a lossy mesh.
    const { epoch, values } = epochAt(1);
    for (let held = 0; held < MAX_HOPS; held++) {
      for (let claimed = held + 1; claimed <= MAX_HOPS; claimed++) {
        let v = values[held]!;
        for (let i = held; i < claimed; i++) v = advanceMetric(v);
        expect(verifyMetric(epoch, claimed, v)).toEqual({ ok: true });
      }
    }
  });
});

describe("stale-epoch replay — the OTHER half, and the half a chain alone cannot do", () => {
  it("an old epoch is refused once a newer one has been seen", () => {
    const e1 = epochAt(1);
    const e5 = epochAt(5);
    const seen = admitMetric(emptyFloor, ZID, e5.epoch, 4, e5.values[4]!, true);
    expect(seen.verdict).toEqual({ ok: true });
    const replay = admitMetric(seen.floor, ZID, e1.epoch, 0, e1.values[0]!, true);
    expect(replay.verdict).toEqual({ ok: false, reason: "stale-epoch" });
    expect(replay.floor).toBe(seen.floor); // byte-identical: a refusal leaves no trace
  });

  it("a chain alone does NOT refuse a stale epoch — the two mechanisms are not alternatives", () => {
    // This is the measurement behind the design's central correction: the BUGS entry offered
    // "per-link auth OR a signed monotonic sequence". A stale epoch's metric verifies perfectly
    // against its OWN anchor, so `verifyMetric` admits it and only the floor catches it.
    const e1 = epochAt(1);
    expect(verifyMetric(e1.epoch, 0, e1.values[0]!)).toEqual({ ok: true });
  });

  it("and a floor alone does NOT refuse deflation within the live epoch — the converse", () => {
    // The other direction of the same correction: the replayed copy carries the CURRENT seq, so
    // the floor sees nothing wrong. Only the chain catches it. Neither half is sufficient.
    const { epoch, values } = epochAt(9);
    const floor = raiseFloor(emptyFloor, ZID, 9);
    expect(admitEpoch(floor, ZID, epoch.seq)).toBe(true); // the floor is satisfied…
    expect(verifyMetric(epoch, 0, values[MAX_HOPS]!).ok).toBe(false); // …and the chain is not
  });
});

describe("the composition order — encoded, because reversing it is a censorship primitive", () => {
  it("an unverified signature can NEVER raise the floor", () => {
    const huge = metricEpoch(deriveSeed("attacker", ZID, 2 ** 31), 2 ** 31, MAX_HOPS);
    const out = admitMetric(emptyFloor, ZID, huge.epoch, 0, huge.values[0]!, false);
    expect(out.verdict.ok).toBe(false);
    expect(out.floor).toBe(emptyFloor); // same reference — the attack leaves no trace at all
    expect(out.floor.get(ZID)).toBeUndefined();
  });

  it("and the identity stays announceable afterwards — the DoS is measured, not assumed", () => {
    const huge = metricEpoch(deriveSeed("attacker", ZID, 2 ** 31), 2 ** 31, MAX_HOPS);
    const poisoned = admitMetric(emptyFloor, ZID, huge.epoch, 0, huge.values[0]!, false).floor;
    const genuine = epochAt(3);
    expect(admitMetric(poisoned, ZID, genuine.epoch, 0, genuine.values[0]!, true).verdict).toEqual({ ok: true });
  });
});

describe("the epoch floor is a CRDT, not a clock (the local-time rule's litmus)", () => {
  const seqs = [1, 2, 3, 4];

  function permutations<T>(xs: readonly T[]): T[][] {
    if (xs.length <= 1) return [[...xs]];
    const out: T[][] = [];
    for (let i = 0; i < xs.length; i++) {
      const rest = [...xs.slice(0, i), ...xs.slice(i + 1)];
      for (const p of permutations(rest)) out.push([xs[i]!, ...p]);
    }
    return out;
  }

  it("every permutation of the same evidence set reaches the SAME floor", () => {
    const perms = permutations(seqs);
    expect(perms.length).toBe(24);
    for (const order of perms) {
      let floor: EpochFloor = emptyFloor;
      for (const s of order) floor = raiseFloor(floor, ZID, s);
      expect(floor.get(ZID)).toBe(4);
    }
  });

  it("max-join laws: idempotent, commutative, associative", () => {
    const a = raiseFloor(emptyFloor, ZID, 3);
    expect(raiseFloor(a, ZID, 3)).toBe(a); // idempotent AND byte-identical (same reference)
    const ab = raiseFloor(raiseFloor(emptyFloor, ZID, 3), ZID, 5);
    const ba = raiseFloor(raiseFloor(emptyFloor, ZID, 5), ZID, 3);
    expect(ab.get(ZID)).toBe(ba.get(ZID));
  });

  it("a LOST epoch degrades to an older floor, never to a divergent one", () => {
    let a: EpochFloor = emptyFloor;
    for (const s of [1, 2, 3]) a = raiseFloor(a, ZID, s);
    let b: EpochFloor = emptyFloor;
    for (const s of [1, 3]) b = raiseFloor(b, ZID, s); // 2 lost in transit
    expect(a.get(ZID)).toBe(b.get(ZID));
  });

  it("nothing here reads a clock — the verdict is a function of the evidence alone", () => {
    // Re-running the identical fold at any 'time' is byte-identical because there is no time in it.
    const { epoch, values } = epochAt(1);
    const first = admitMetric(emptyFloor, ZID, epoch, 2, values[2]!, true);
    const second = admitMetric(emptyFloor, ZID, epoch, 2, values[2]!, true);
    expect(first.verdict).toEqual(second.verdict);
    expect([...first.floor]).toEqual([...second.floor]);
  });
});

describe("hostile input gets a verdict, never a throw", () => {
  const { epoch, values } = epochAt(1);

  it("a malformed carried value is refused by shape", () => {
    for (const bad of ["", "zz", "ABCDEF", values[0]!.slice(0, 63), `${values[0]!}0`]) {
      expect(verifyMetric(epoch, 0, bad)).toEqual({ ok: false, reason: "malformed-metric" });
    }
  });

  it("a hop count outside the chain is refused before any hashing", () => {
    expect(verifyMetric(epoch, -1, values[0]!)).toEqual({ ok: false, reason: "hops-out-of-chain" });
    expect(verifyMetric(epoch, MAX_HOPS + 1, values[0]!)).toEqual({ ok: false, reason: "hops-out-of-chain" });
    expect(verifyMetric(epoch, 1.5, values[0]!)).toEqual({ ok: false, reason: "hops-out-of-chain" });
  });

  it("a malformed epoch declaration is refused, including an unbounded chain length", () => {
    const bad = (e: unknown) => verifyMetric(e as MetricEpoch, 0, values[0]!);
    expect(bad(null)).toEqual({ ok: false, reason: "malformed-epoch" });
    expect(bad({ seq: 1, anchor: "nothex", maxHops: 8 })).toEqual({ ok: false, reason: "malformed-epoch" });
    expect(bad({ seq: -1, anchor: epoch.anchor, maxHops: 8 })).toEqual({ ok: false, reason: "malformed-epoch" });
    // The verifier's work is bounded by the DECLARED chain length, so an unbounded declaration is
    // a denial-of-service ask and is refused by shape rather than hashed.
    expect(bad({ seq: 1, anchor: epoch.anchor, maxHops: MAX_CHAIN + 1 })).toEqual({ ok: false, reason: "malformed-epoch" });
  });

  it("the seed is never the wire value — value_0 is one hash beyond it", () => {
    const seed = deriveSeed(SECRET, ZID, 1);
    expect(values[0]).not.toBe(seed);
    expect(values[0]).toBe(advanceMetric(seed));
  });

  it("a zero-length chain is legal and degenerate: only hop 0 verifies", () => {
    const { epoch: e0, values: v0 } = epochAt(1, 0);
    expect(verifyMetric(e0, 0, v0[0]!)).toEqual({ ok: true });
    expect(verifyMetric(e0, 1, v0[0]!)).toEqual({ ok: false, reason: "hops-out-of-chain" });
  });

  it("epoch construction refuses an out-of-range declaration at the SEND path", () => {
    expect(() => metricEpoch("seed", 1, MAX_CHAIN + 1)).toThrow();
    expect(() => metricEpoch("seed", -1, 4)).toThrow();
  });
});

describe("the honest limit, carried as a passing test so it cannot be forgotten", () => {
  it("ONE-HOP SHAVE: a node at distance d CAN still claim d-1, and that is the residual", () => {
    // The guarantee is "no closer than your closest genuine informant", not "correct". A node at
    // true distance 4 heard `values[3]` from its upstream and may re-announce at 3, impersonating
    // its informant's distance. It cannot claim 2. Closing the last hop needs per-link
    // authentication (O(hops) signatures — see the design doc's cost table); this is the measured
    // boundary of what a one-way chain buys.
    const { epoch, values } = epochAt(1);
    expect(verifyMetric(epoch, 3, values[3]!)).toEqual({ ok: true }); // the shave succeeds …
    expect(verifyMetric(epoch, 2, values[3]!).ok).toBe(false); // … and stops there.
  });

  it("FRESH-EPOCH REPLAY: a node that has not yet seen epoch n accepts a replay of it", () => {
    // Refusing this needs a clock, and a clock is refused by
    // `.claude/rules/local-time-never-enters-the-shared-fold.md`. Named, not hidden.
    const e = epochAt(5);
    expect(admitMetric(emptyFloor, ZID, e.epoch, 0, e.values[0]!, true).verdict).toEqual({ ok: true });
  });
});
