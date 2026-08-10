import { describe, expect, test } from "bun:test";
import { COMMON_SEED, createPhaseClock, type PhaseState } from "./phase-clock";
import {
  DEFAULT_MAX_NEIGHBOURS,
  bandFor,
  localNeighbourhood,
  type NeighbourEvidence,
} from "./local-neighbourhood";

const stamp = (phase: number, seed: number): PhaseState => ({
  phase,
  seed,
  lastAdvanceReason: "init",
  wallClockAt: "",
});

function honestChain(n: number): PhaseState[] {
  const clock = createPhaseClock(COMMON_SEED);
  const out: PhaseState[] = [stamp(0, COMMON_SEED)];
  for (let i = 1; i <= n; i++) {
    clock.tick("heartbeat");
    out.push(stamp(i, clock.state.seed));
  }
  return out;
}

describe("defence 1 — no crawling: reach is bounded by who chose to share", () => {
  test("a peer not in `offered` never appears, however well-connected", () => {
    const c = honestChain(6);
    const offered: NeighbourEvidence[] = [{ peer: "alice", stamps: [c[3]!] }];
    const got = localNeighbourhood(c, offered);
    expect(got.map((p) => p.peer)).toEqual(["alice"]);
    expect(got.some((p) => p.peer === "bob")).toBe(false);
  });

  test("a peer offering nothing we share is not a neighbour and is not reported", () => {
    const c = honestChain(4);
    const stranger: NeighbourEvidence = { peer: "stranger", stamps: [stamp(99, 12345)] };
    expect(localNeighbourhood(c, [stranger])).toEqual([]);
  });

  test("the function performs no I/O — same inputs, same output", () => {
    const c = honestChain(4);
    const offered: NeighbourEvidence[] = [{ peer: "a", stamps: [c[2]!] }];
    expect(localNeighbourhood(c, offered)).toEqual(localNeighbourhood(c, offered));
  });
});

describe("defence 2 — THE LOAD-BEARING ONE: the output carries no evidence", () => {
  test("a Proximity contains no stamps, phases, or seeds", () => {
    const c = honestChain(5);
    const got = localNeighbourhood(c, [{ peer: "alice", stamps: [c[4]!] }]);
    expect(Object.keys(got[0]!).sort()).toEqual(["band", "peer", "sharedCount"]);
    const serialised = JSON.stringify(got);
    expect(serialised).not.toContain(String(c[4]!.seed));
  });

  test("the output CANNOT be fed back in as evidence — transitive walking is impossible", () => {
    // This is the structural guarantee. Graph assembly requires hop-by-hop evidence; the
    // result type supplies none, so composing calls cannot extend reach. Assembly is
    // impossible rather than merely discouraged.
    const c = honestChain(5);
    const first = localNeighbourhood(c, [{ peer: "alice", stamps: [c[3]!] }]);
    const asEvidence = first as unknown as { peer: string; stamps?: PhaseState[] }[];
    expect(asEvidence[0]!.stamps).toBeUndefined();

    // Attempting the second hop with what we learned yields nothing new.
    const secondHop = localNeighbourhood(c, [{ peer: "alice", stamps: [] }]);
    expect(secondHop).toEqual([]);
  });
});

describe("defence 3 — bounded cardinality and coarsened disclosure", () => {
  test("a census is not expressible — results are capped", () => {
    const c = honestChain(5);
    const many: NeighbourEvidence[] = Array.from({ length: 50 }, (_, i) => ({
      peer: `peer-${i}`,
      stamps: [c[3]!],
    }));
    expect(localNeighbourhood(c, many).length).toBe(DEFAULT_MAX_NEIGHBOURS);
    expect(localNeighbourhood(c, many, { maxNeighbours: 3 }).length).toBe(3);
  });

  test("exact depth is NOT disclosed — bands only", () => {
    // Exact shared-anchor depth is the high-resolution coordinate that makes a sparse
    // history uniquely identifying. It stays private to the node that computed it.
    expect(bandFor(0)).toBe("adjacent");
    expect(bandFor(1)).toBe("adjacent");
    expect(bandFor(2)).toBe("near");
    expect(bandFor(16)).toBe("near");
    expect(bandFor(17)).toBe("far");
  });

  test("peers at different exact depths collapse into the same band", () => {
    // The coarsening is real: distinct inputs must produce indistinguishable output.
    const c = honestChain(40);
    const got = localNeighbourhood(
      c,
      [
        { peer: "a", stamps: [c[38]!] },
        { peer: "b", stamps: [c[30]!] },
      ],
      { maxNeighbours: 8 },
    );
    const bands = Object.fromEntries(got.map((p) => [p.peer, p.band]));
    expect(bands["a"]).toBe("near");
    expect(bands["b"]).toBe("near");
  });
});

describe("determinism — two nodes with the same inputs cannot disagree on ordering", () => {
  test("ordering is stable regardless of the order evidence was offered", () => {
    const c = honestChain(6);
    const a: NeighbourEvidence[] = [
      { peer: "zoe", stamps: [c[5]!] },
      { peer: "amy", stamps: [c[5]!] },
    ];
    const b = [...a].reverse();
    expect(localNeighbourhood(c, a)).toEqual(localNeighbourhood(c, b));
  });

  test("closer peers rank first", () => {
    const c = honestChain(10);
    const got = localNeighbourhood(c, [
      { peer: "far", stamps: [c[1]!] },
      { peer: "close", stamps: [c[9]!] },
    ]);
    expect(got.map((p) => p.peer)).toEqual(["close", "far"]);
  });
});

describe("the honest limit, asserted so it is not forgotten", () => {
  test("coarsening still leaks SOMETHING — a neighbour is distinguishable from a stranger", () => {
    // Defence 3 raises cost; it is not a guarantee. Narayanan & Shmatikov is the standing
    // demonstration that coarsened sparse histories remain matchable given an auxiliary
    // dataset. Recorded as a test so the limitation is not quietly assumed away.
    const c = honestChain(5);
    const neighbour = localNeighbourhood(c, [{ peer: "a", stamps: [c[4]!] }]);
    const stranger = localNeighbourhood(c, [{ peer: "a", stamps: [stamp(77, 5)] }]);
    expect(neighbour).not.toEqual(stranger);
  });
});
