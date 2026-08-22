import { describe, expect, test } from "bun:test";
import { type Chunk, type Ctm, entryChunk, probabilisticMatch, rankByDisposition, tournament } from "./ctm";
import { aggregation, type Ladder, levelLaws, worldLaws } from "./levels";
import type { Address, Addressed, Reading, Society } from "./society";

// ── Why these tests exist ─────────────────────────────────────────────────────────────────────
//
// `ctm.ts` and `levels.ts` are mostly declarations, but two things in them are real behaviour that
// can diverge from the F# oracle SILENTLY, with both languages looking correct:
//
//   1. the draw convention  — `draw < p(left)` picks `left`
//   2. the bracket order    — submissions are sorted through the collation treaty before folding,
//                             and the draws are consumed positionally, so a different sort is a
//                             different winner
//
// The fixture in "THE CROSS-ORACLE FIXTURE" is duplicated byte-for-byte in
// `tests/Tests.FSharp/Ctm.Tests.fs`. If the two ever disagree, one of those two things moved.
//
// Under `toy-is-free-metered-must-be-earned`: this is a falsifier for `probabilisticMatch`,
// `tournament` and the closure predicate. It says nothing about `Ctm` or `Society` as contracts.

// ── Witnesses (object literals; no classes, no state) ─────────────────────────────────────────

interface TestView {
  readonly roll: readonly Address[];
  readonly wires: ReadonlyMap<Address, readonly Address[]>;
}

const rank = (chunk: Chunk<string>): number => rankByDisposition(0, chunk); // f = intensity

const machine: Ctm<TestView, string, Address> = {
  processors: (v) => v.roll,
  submit: (v, tick) => entryChunk(v.roll[0] ?? "", tick, "gist", 1),
  rank,
  match: (l, r, draw) => probabilisticMatch(rank, l, r, draw),
  // The Down-Tree broadcasts FROM the machine itself, so every envelope is self-attributed.
  broadcast: (v, _winner): readonly Addressed<Address>[] =>
    v.roll.map((p) => ({ from: v.roll[0] ?? "", to: p, body: p })),
  links: (v, processor) => v.wires.get(processor) ?? [],
  address: (v) => v.roll[0] ?? "",
  deliver: (v, _m) => [v, []] as const,
  merge: (l, _r) => l,
  peers: (v) => v.roll,
};

/** A society whose `deliver` addresses the message itself, so an outsider message is the escape. */
const society: Society<TestView, Address> = {
  members: (v) => v.roll,
  admit: (): Reading => ({ kind: "unmeasured" }),
  routes: (v) => v.roll,
  address: (v) => v.roll[0] ?? "",
  deliver: (v, m) => [v, [{ from: v.roll[0] ?? "", to: m, body: m }]] as const,
  merge: (l, _r) => l,
  peers: (v) => v.roll,
};

const alpha = entryChunk<string>("alpha", 1, "a", 3);
const beta = entryChunk<string>("beta", 1, "b", -1);
const gamma = entryChunk<string>("gamma", 1, "c", 2);

const view: TestView = { roll: ["alpha", "beta", "gamma"], wires: new Map() };

// ── Tests ─────────────────────────────────────────────────────────────────────────────────────

describe("the winner-take-all match (Blum and Blum, PNAS 2022; arXiv:2403.17101 §6.2)", () => {
  test("selects a competitor and carries the SUMMED aux", () => {
    // f(alpha) = 3, f(beta) = 1, so p(alpha) = 0.75. draw 0.9 is above it: beta wins.
    const w = probabilisticMatch(rank, alpha, beta, 0.9);
    expect(w.address).toBe("beta");
    expect(w.intensity).toBeCloseTo(4, 12);
    expect(w.mood).toBeCloseTo(2, 12);

    // draw 0.1 is below 0.75: alpha wins. Same aux either way — winner-take-all decides WHOSE
    // address and gist survive, never how much mass is carried.
    const w2 = probabilisticMatch(rank, alpha, beta, 0.1);
    expect(w2.address).toBe("alpha");
    expect(w2.intensity).toBeCloseTo(4, 12);
  });

  test("rank is ADDITIVE — the property the location-independence theorem rests on", () => {
    const w = probabilisticMatch(rank, alpha, beta, 0.9);
    expect(rank(w)).toBeCloseTo(rank(alpha) + rank(beta), 12);
    // And the aux invariant |mood| <= intensity survives, which is what keeps every disposition's
    // rank non-negative as the paper requires of f.
    expect(Math.abs(w.mood)).toBeLessThanOrEqual(w.intensity);
    for (const d of [-1, -0.5, 0, 0.5, 1]) expect(rankByDisposition(d, w)).toBeGreaterThanOrEqual(0);
  });

  test("mirror symmetry: match(a,b,d) and match(b,a,1-d) pick the same winner", () => {
    expect(probabilisticMatch(rank, alpha, gamma, 0.3).address).toBe(
      probabilisticMatch(rank, gamma, alpha, 0.7).address,
    );
  });
});

describe("the tournament", () => {
  test("THE CROSS-ORACLE FIXTURE — same submissions, same draws, same winner as Ctm.Tests.fs", () => {
    // Submitted deliberately out of order; the canonical bracket is alpha, beta, gamma.
    const w = tournament(machine, [0.9, 0.1], [gamma, alpha, beta]);
    expect(w).toBeDefined();
    expect(w?.address).toBe("beta");
    expect(w?.intensity).toBeCloseTo(6, 12); // 3 + 1 + 2
    expect(w?.mood).toBeCloseTo(4, 12); // 3 + (-1) + 2
  });

  test("conserves rank mass and never invents a chunk", () => {
    const submissions = [alpha, beta, gamma];
    const w = tournament(machine, [0.9, 0.1], submissions);
    expect(w).toBeDefined();
    const total = submissions.reduce((sum, c) => sum + rank(c), 0);
    expect(rank(w as Chunk<string>)).toBeCloseTo(total, 12);
    expect(submissions.some((c) => c.address === w?.address && c.tick === w?.tick)).toBe(true);
  });

  test("running out of entropy REFUSES — it does not reach for Math.random()", () => {
    expect(tournament(machine, [0.5], [alpha, beta, gamma])).toBeUndefined();
    expect(tournament(machine, [], [])).toBeUndefined();
  });
});

describe("a newborn CTM has no exit — the paper's own construction, stated not patched", () => {
  test("links are empty at birth and earned by broadcasting", () => {
    expect(machine.links(view, "alpha")).toHaveLength(0);

    const grown: TestView = {
      roll: view.roll,
      wires: new Map([
        ["alpha", ["beta"]],
        ["beta", ["alpha"]],
      ]),
    };
    expect(machine.links(grown, "alpha")).toEqual(["beta"]);
    // Bi-directional, in the paper's word.
    expect(machine.links(grown, "beta")).toEqual(["alpha"]);
  });
});

describe("WORLD = CLOSED SOCIETY — one predicate, and no third interface", () => {
  const insiders: readonly Address[] = ["alpha", "beta"];

  test("closed traffic makes the level a world; one escaping message does not", () => {
    expect(worldLaws.isWorld(society, view, insiders, insiders)).toBe(true);
    expect(worldLaws.isWorld(society, view, ["delta", ...insiders], insiders)).toBe(false);
  });

  test("openness is reported as EVIDENCE, not as a bare false", () => {
    expect(worldLaws.openWitnesses(society, view, ["delta", ...insiders])).toEqual(["delta"]);
  });

  test("an empty ladder is not a world — a check that cannot fail is not a check", () => {
    expect(worldLaws.ladderTerminatesInAWorld([], [], [])).toBe(false);
  });
});

describe("the level-generic lift", () => {
  const ladder: Ladder<TestView, Address> = [
    [society, view],
    [society, view],
  ];

  test("one predicate, every rung", () => {
    expect(levelLaws.exitAtEveryLevel(3, "alpha", ladder)).toBe(true);
    expect(levelLaws.exitAtEveryLevel(4, "alpha", ladder)).toBe(false);
  });

  test("failing rungs are NAMED — a law that fails at rung 1 of 2 is a different fact", () => {
    const thin: TestView = { roll: ["alpha"], wires: new Map() };
    const mixed: Ladder<TestView, Address> = [
      [society, view],
      [society, thin],
    ];
    expect(levelLaws.failingLevels((level, v) => level.members(v).length >= 3, mixed)).toEqual([1]);
  });
});

describe("the Dominance Lift HYPOTHESIS (sibling PR #10945) — a law about the RULE, not the level", () => {
  const submissions = [alpha, beta, gamma];
  const draws = [0.9, 0.1];
  const rule = (chunks: readonly Chunk<string>[]): string | undefined => tournament(machine, draws, chunks)?.address;
  const project = (c: Chunk<string>): string | undefined => c.address;
  const eq = (a: string | undefined, b: string | undefined): boolean => a === b;

  test("the CTM tournament can imitate every projection — the witness is mass concentration", () => {
    const witnesses = submissions.map((c) => aggregation.concentrateMassOn(c.address, submissions));
    expect(aggregation.canImitateEveryProjection(eq, rule, project, witnesses)).toBe(true);
  });

  test("it is a falsifier, not a label: unconcentrated inputs fail, and an empty list is not a discharge", () => {
    expect(
      aggregation.canImitateEveryProjection(
        eq,
        rule,
        project,
        submissions.map(() => submissions),
      ),
    ).toBe(false);
    expect(aggregation.canImitateEveryProjection(eq, rule, project, [])).toBe(false);
  });
});
