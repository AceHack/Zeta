/**
 * The TS mirror of tests/Tests.FSharp/Formal/WSet.FourCornerTrace.Laws.Tests.fs, plus the treaty
 * byte-lock the F# side conforms to (tests/Tests.FSharp/WSetFourCornerTraceTreaty.Tests.fs).
 *
 * What is proved here — the same five laws, same numbering as the F# pack:
 *   (L1) retraction cancels the superseded output — after ANY step the cumulative emission equals
 *        the CURRENT reading of the history; the superseded key's weight goes to 0 and it leaves.
 *   (L2) replaying the same feedback is idempotent — an EMPTY delta, and the loop state untouched.
 *   (L3) mass bookkeeping — Σ(delta) = ε(after) − ε(before); a pure relabelling has Σ delta = 0.
 *   (L4) path-independence — the emission is a function of the FINAL interpretation.
 *   (L5) the C₄ corner witness over ℂ — retraction = i². ALGEBRAIC identity in the ring; NOT a
 *        claim the substrate is physically quantum.
 * plus the two properties that only exist once turns are RECORDED:
 *   (R1) empty deltas are still recorded — a no-op turn occupies a sequence number and a line.
 *   (R2) append-only — a recorded turn cannot be rewritten, at runtime, not merely by `readonly`.
 *
 * HONESTY (restated because a test file is read on its own): this is PSEUDO-retrocausality. The
 * stored history is never mutated. Feedback moves only the generator's INTERPRETATION; the same
 * history is re-read and the stale emission is retracted. No physical time travel is claimed.
 *
 * Randomness: F# uses FsCheck. There is no FsCheck here, so the generators are a seeded LCG —
 * DETERMINISTIC by construction (discipline #4, DST), which is strictly better for replay than an
 * ambient RNG would be. No clock is read anywhere in this file.
 */

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stringCompare } from "../collation/collation.ts";
import { complexRing, type Complex } from "./star-ring.ts";
import { consolidateWSet, discardWSet, type WElement, type WSet } from "./wset.ts";
import {
  IntegerTraceRing,
  appendCorrection,
  captureHistory,
  delta,
  fold,
  foldRecorded,
  foldWitnessed,
  inverseDelta,
  interpretationToText,
  negateWSet,
  numericCompareKeys,
  ordinalCompareKeys,
  replay,
  rereadRelabelled,
  rewind,
  start,
  step,
  stringKeyIntegerOps,
  toFourCorner,
  traceStateToLine,
  traceTurnToLine,
  updateRelabel,
  wsetToText,
  type Generator,
  type Relabel,
  type TraceOps,
  type Traced,
} from "./wset-four-corner-trace.ts";

// ── the worked loop, number-keyed, mirroring the F# pack exactly ────────────────────────────
type Interp = ReadonlyMap<number, number>;

const numOps: TraceOps<number, bigint> = {
  ring: IntegerTraceRing,
  isZero: (w) => w === 0n,
  keyToString: (k) => k.toString(),
  compareKeys: numericCompareKeys,
};

/** re-read the whole history under the current labels (named `reread`, as in the F# pack) */
const reread: Generator<readonly number[], Interp, number, bigint> = (interp, history) =>
  history.map((x): WElement<number, bigint> => ({ key: interp.get(x) ?? x, weight: 1n }));

const update = (interp: Interp, [raw, label]: readonly [number, number]): Interp => new Map(interp).set(raw, label);

const startT = (history: readonly number[]) =>
  start(numOps, reread, history, new Map<number, number>() as Interp).state;
const stepT = (history: readonly number[], fb: readonly [number, number], st: Traced<Interp, number, bigint>) =>
  step(numOps, reread, update, history, fb, st);
const foldT = (
  history: readonly number[],
  fbs: readonly (readonly [number, number])[],
  st: Traced<Interp, number, bigint>,
) => fold(numOps, reread, update, history, fbs, st);

const pairs = (s: WSet<number, bigint>): [number, bigint][] => s.map((e) => [e.key, e.weight]);

// ── deterministic generators (the FsCheck stand-in) ─────────────────────────────────────────
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** 200 deterministic cases: histories over 0..4 (len 0..6), relabels into a disjoint 10..14 band. */
function* cases(): Generator2 {
  const rnd = lcg(20260816);
  const pick = (n: number) => Math.floor(rnd() * n);
  for (let i = 0; i < 200; i++) {
    const history = Array.from({ length: pick(7) }, () => pick(5));
    const fbs = Array.from({ length: pick(6) }, () => [pick(5), 10 + pick(5)] as readonly [number, number]);
    yield { history, fbs };
  }
}
type Generator2 = globalThis.Generator<{
  readonly history: readonly number[];
  readonly fbs: readonly (readonly [number, number])[];
}>;

// ════════════════════════════════════════════════════════════════════════════════════════════
// (L1) RETRACTION CANCELS THE SUPERSEDED OUTPUT
// ════════════════════════════════════════════════════════════════════════════════════════════

describe("L1 — retraction cancels the superseded output", () => {
  it("cumulative emission equals the current reading of the history (200 deterministic cases)", () => {
    for (const { history, fbs } of cases()) {
      const { state } = foldT(history, fbs, startT(history));
      const current = start(numOps, reread, history, state.interpretation).state.emitted;
      expect(pairs(state.emitted)).toEqual(pairs(current));
    }
  });

  it("witness: reinterpretation emits weight −2 and the old key's weight goes to 0", () => {
    const history = [3, 3, 5];
    const opened = start(numOps, reread, history, new Map<number, number>() as Interp);
    // the opening emission IS the first reading: two 3s and one 5
    expect(pairs(opened.delta)).toEqual([
      [3, 2n],
      [5, 1n],
    ]);
    const r1 = stepT(history, [7, 70], opened.state); // 7 ∉ history ⇒ a no-op reinterpretation
    expect(pairs(r1.delta)).toEqual([]); // nothing to retract, nothing new
    expect(pairs(r1.state.emitted)).toEqual([
      [3, 2n],
      [5, 1n],
    ]);
    // now relabel 3 ↦ 30: the old emission is RETRACTED (−2) and the new one emitted (+2)
    const r2 = stepT(history, [3, 30], r1.state);
    expect(pairs(r2.delta)).toEqual([
      [3, -2n],
      [30, 2n],
    ]);
    // the superseded key is GONE from the cumulative view (2 + (−2) = 0, dropped)
    expect(pairs(r2.state.emitted)).toEqual([
      [5, 1n],
      [30, 2n],
    ]);
    expect(r2.state.emitted.map((e) => e.key)).not.toContain(3);
  });

  it("witness: the stored history is untouched — only the reading moves", () => {
    const history = [3, 3, 5];
    const { state } = foldT(
      history,
      [
        [3, 30],
        [5, 50],
      ],
      startT(history),
    );
    expect(history).toEqual([3, 3, 5]);
    expect(pairs(state.emitted)).toEqual([
      [30, 2n],
      [50, 1n],
    ]);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
// (L2) REPLAYING THE SAME FEEDBACK IS IDEMPOTENT
// ════════════════════════════════════════════════════════════════════════════════════════════

describe("L2 — re-delivery is idempotent (safe replay, discipline #6)", () => {
  it("re-delivering a feedback emits an empty delta and moves nothing", () => {
    for (const { history, fbs } of cases()) {
      const fb = [history.length % 5, 11] as const;
      const st1 = foldT(history, fbs, startT(history)).state;
      const r2 = stepT(history, fb, st1);
      const r3 = stepT(history, fb, r2.state); // the replay
      expect(pairs(r3.delta)).toEqual([]);
      expect(pairs(r3.state.emitted)).toEqual(pairs(r2.state.emitted));
      expect([...r3.state.interpretation]).toEqual([...r2.state.interpretation]);
    }
  });

  it("folding the feedback stream twice equals folding it once", () => {
    for (const { history, fbs } of cases()) {
      const once = foldT(history, fbs, startT(history)).state;
      const twice = foldT(history, [...fbs, ...fbs], startT(history)).state;
      expect(pairs(once.emitted)).toEqual(pairs(twice.emitted));
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
// (L3) MASS BOOKKEEPING — the retraction pays for the new emission
// ════════════════════════════════════════════════════════════════════════════════════════════

describe("L3 — mass bookkeeping", () => {
  it("discarded mass of the delta is ε(after) − ε(before)", () => {
    for (const { history, fbs } of cases()) {
      const st = foldT(history, fbs, startT(history)).state;
      const fb = [history.length % 5, 12] as const;
      const before = st.interpretation;
      const after = update(before, fb);
      const d = delta(numOps, reread, history, before, after);
      expect(discardWSet(IntegerTraceRing, d)).toBe(
        discardWSet(IntegerTraceRing, reread(after, history)) - discardWSet(IntegerTraceRing, reread(before, history)),
      );
    }
  });

  it("a pure relabelling is mass-preserving (Σ delta = 0)", () => {
    for (const { history, fbs } of cases()) {
      const { deltas } = foldT(history, fbs, startT(history));
      for (const d of deltas) expect(discardWSet(IntegerTraceRing, d)).toBe(0n);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
// (L4) PATH-INDEPENDENCE — the conclusion is a function of the final reading
// ════════════════════════════════════════════════════════════════════════════════════════════

describe("L4 — path-independence and the four-corner packaging", () => {
  it("feedback order does not change the conclusion", () => {
    const history = [3, 3, 5, 5, 5];
    const a = foldT(
      history,
      [
        [3, 30],
        [5, 50],
      ],
      startT(history),
    );
    const b = foldT(
      history,
      [
        [5, 50],
        [3, 30],
      ],
      startT(history),
    );
    expect(pairs(a.state.emitted)).toEqual(pairs(b.state.emitted));
    expect(pairs(a.state.emitted)).toEqual([
      [30, 2n],
      [50, 3n],
    ]);
    // the PATHS genuinely differ — this is not a vacuous equality
    expect(a.deltas.map(pairs)).not.toEqual(b.deltas.map(pairs));
  });

  it("one turn packages as a FourCornerOwnership with feedback on the input channel", () => {
    const history = [3, 5];
    const r = stepT(history, [3, 30], startT(history));
    const corner = toFourCorner(history, [3, 30] as const, r.delta);
    expect(corner.tIn).toEqual(history);
    expect(corner.tOut).toEqual(r.delta);
    expect(corner.tInFeedback).toEqual([3, 30]);
    // `tOutFeedback` is F# `None`, encoded as an ABSENT property (exactOptionalPropertyTypes)
    expect("tOutFeedback" in corner).toBe(false);
    expect(pairs(r.state.emitted)).toEqual([
      [5, 1n],
      [30, 1n],
    ]);
  });

  it("later reinterpretation appends a correction without rewriting the past", () => {
    const history = [3];
    const first = foldRecorded(12n, numOps, reread, update, history, [[3, 30] as const], startT(history));

    const earlier = first.turns[0]!;
    expect(first.turns.length).toBe(1);
    expect(earlier.sequence).toBe(12n);
    expect(earlier.feedback).toEqual([3, 30]);
    expect(pairs(earlier.delta)).toEqual([
      [3, -1n],
      [30, 1n],
    ]);

    const later = foldRecorded(first.nextSequence, numOps, reread, update, history, [[3, 40] as const], first.state);

    // The old turn is immutable; the correction is a new turn in the only time direction.
    expect(first.turns[0]).toBe(earlier);
    expect(pairs(earlier.delta)).toEqual([
      [3, -1n],
      [30, 1n],
    ]);
    const correction = later.turns[0]!;
    expect(correction.sequence).toBe(13n);
    expect(pairs(correction.delta)).toEqual([
      [30, -1n],
      [40, 1n],
    ]);
    expect(later.nextSequence).toBe(14n);
    expect(pairs(later.state.emitted)).toEqual([[40, 1n]]);
    expect(history).toEqual([3]);
  });

  it("recorded turns preserve fold order including empty deltas", () => {
    for (const { history, fbs } of cases()) {
      const st0 = startT(history);
      const expected = foldT(history, fbs, st0);
      const recorded = foldRecorded(100n, numOps, reread, update, history, fbs, st0);
      expect(pairs(recorded.state.emitted)).toEqual(pairs(expected.state.emitted));
      expect(recorded.nextSequence).toBe(100n + BigInt(fbs.length));
      expect(recorded.turns.map((t) => t.sequence)).toEqual(fbs.map((_, i) => 100n + BigInt(i)));
      expect(recorded.turns.map((t) => t.feedback)).toEqual(fbs.map((f) => f));
      expect(recorded.turns.map((t) => pairs(t.delta))).toEqual(expected.deltas.map(pairs));
    }
  });

  it("a witnessed turn can be rewound and replayed exactly", () => {
    const history = [3];
    const initial = startT(history);
    const witnessed = foldWitnessed(
      20n,
      numOps,
      reread,
      update,
      history,
      [
        [3, 30],
        [3, 40],
      ] as const,
      initial,
    );

    const first = witnessed.turns[0]!;
    const second = witnessed.turns[1]!;
    expect(first.sequence).toBe(20n);
    expect(second.sequence).toBe(21n);
    expect(rewind(second)).toBe(first.after);
    expect(replay(second)).toBe(second.after);
    expect(rewind(first)).toBe(initial);
    expect(witnessed.state).toBe(second.after);
  });

  it("inverse deltas reconstruct every witnessed prior materialized view", () => {
    for (const { history, fbs } of cases()) {
      const witnessed = foldWitnessed(0n, numOps, reread, update, history, fbs, startT(history));

      for (const turn of witnessed.turns) {
        const inverse = inverseDelta(numOps, turn);
        const prior = [
          ...consolidateWSet(
            IntegerTraceRing,
            (w) => w === 0n,
            (key) => key.toString(),
            [...turn.after.emitted, ...inverse],
          ),
        ].sort((a, b) => numericCompareKeys(a.key, b.key));
        expect(pairs(prior)).toEqual(pairs(turn.before.emitted));
      }
    }
  });

  it("causal correction reinterprets earlier history as a later event", () => {
    const history = [3] as const;
    const before = startT(history);
    const snapshot = captureHistory(12n, history);
    const result = appendCorrection(13n, numOps, reread, update, snapshot, [3, 30] as const, before);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.correction.sequence).toBe(13n);
    expect(result.correction.reinterpretsThrough).toBe(12n);
    expect(result.correction.sequence > result.correction.reinterpretsThrough).toBe(true);
    expect(result.correction.before).toBe(before);
    expect(pairs(result.correction.delta)).toEqual([
      [3, -1n],
      [30, 1n],
    ]);
    expect(pairs(result.correction.after.emitted)).toEqual([[30, 1n]]);
    expect(history).toEqual([3]);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.correction)).toBe(true);
  });

  it("causal correction refuses equal or earlier sequence without executing", () => {
    let calls = 0;
    const guardedReread: Generator<readonly number[], Interp, number, bigint> = () => {
      calls += 1;
      return [];
    };
    const guardedUpdate = (interpretation: Interp): Interp => {
      calls += 1;
      return interpretation;
    };
    const snapshot = captureHistory(12n, [3] as const);
    const before: Traced<Interp, number, bigint> = {
      interpretation: new Map<number, number>(),
      emitted: [],
    };

    for (const correctionSequence of [11n, 12n]) {
      const result = appendCorrection(
        correctionSequence,
        numOps,
        guardedReread,
        guardedUpdate,
        snapshot,
        [3, 30] as const,
        before,
      );

      expect(result).toEqual({
        ok: false,
        error: {
          kind: "correction-does-not-follow-history",
          throughSequence: 12n,
          correctionSequence,
        },
      });
      expect(Object.isFrozen(result)).toBe(true);
      if (!result.ok) expect(Object.isFrozen(result.error)).toBe(true);
    }

    expect(calls).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
// (R1) EMPTY DELTAS ARE STILL RECORDED — the causal record, not the materialized view
// ════════════════════════════════════════════════════════════════════════════════════════════

describe("R1 — empty deltas are still recorded", () => {
  it("a no-op feedback occupies a turn and a sequence number", () => {
    const history = [3, 5];
    // (9,90) touches nothing in the history; (3,30) then (3,30) again is an idempotent replay.
    const fbs = [
      [9, 90],
      [3, 30],
      [3, 30],
    ] as const;
    const rec = foldRecorded(0n, numOps, reread, update, history, fbs, startT(history));

    // THREE turns for THREE feedbacks — two of them with an empty delta.
    expect(rec.turns.length).toBe(3);
    expect(rec.turns.map((t) => t.sequence)).toEqual([0n, 1n, 2n]);
    expect(rec.nextSequence).toBe(3n);
    expect(pairs(rec.turns[0]!.delta)).toEqual([]); // no-op reinterpretation
    expect(pairs(rec.turns[1]!.delta)).toEqual([
      [3, -1n],
      [30, 1n],
    ]);
    expect(pairs(rec.turns[2]!.delta)).toEqual([]); // idempotent replay
    // and the empty turns carry their feedback — the record says WHAT was received, not just what changed
    expect(rec.turns[0]!.feedback).toEqual([9, 90]);
    expect(rec.turns[2]!.feedback).toEqual([3, 30]);
  });

  it("the number of turns is the number of feedbacks, always (never the number of CHANGES)", () => {
    for (const { history, fbs } of cases()) {
      const rec = foldRecorded(5n, numOps, reread, update, history, fbs, startT(history));
      expect(rec.turns.length).toBe(fbs.length);
      expect(rec.nextSequence).toBe(5n + BigInt(fbs.length));
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
// (R2) APPEND-ONLY, ENFORCED AT RUNTIME
// ════════════════════════════════════════════════════════════════════════════════════════════

describe("R2 — a recorded turn cannot be rewritten", () => {
  const history = [3, 3, 5];
  const rec = foldRecorded(0n, numOps, reread, update, history, [[3, 30] as const], startT(history));

  it("the sequence is bigint, so it stays exact past 2^53 (where a double would collide)", () => {
    const huge = 2n ** 53n;
    const r = foldRecorded(
      huge,
      numOps,
      reread,
      update,
      history,
      [
        [3, 30],
        [5, 50],
      ] as const,
      startT(history),
    );
    expect(r.turns[0]!.sequence).toBe(huge);
    expect(r.turns[1]!.sequence).toBe(huge + 1n);
    expect(r.turns[0]!.sequence).not.toBe(r.turns[1]!.sequence);
    // the falsifier: as doubles these two ARE equal, so `number` would have silently merged them
    expect(Number(huge)).toBe(Number(huge + 1n));
  });

  it("rewriting a turn's sequence throws (frozen, not merely `readonly`)", () => {
    const turn = rec.turns[0]! as { sequence: bigint };
    expect(() => {
      turn.sequence = 99n;
    }).toThrow();
    expect(rec.turns[0]!.sequence).toBe(0n);
  });

  it("rewriting a turn's recorded delta throws", () => {
    const turn = rec.turns[0]! as { delta: WSet<number, bigint> };
    expect(() => {
      turn.delta = [];
    }).toThrow();
    const row = rec.turns[0]!.delta[0]! as { weight: bigint };
    expect(() => {
      row.weight = 0n;
    }).toThrow();
    expect(pairs(rec.turns[0]!.delta)).toEqual([
      [3, -2n],
      [30, 2n],
    ]);
  });

  it("appending to or truncating the recorded batch throws", () => {
    const turns = rec.turns as unknown as { push: (t: unknown) => number; length: number };
    expect(() => turns.push(rec.turns[0])).toThrow();
    expect(rec.turns.length).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════
// (L5) THE C₄ CORNER WITNESS over ℂ — retraction = i²
// ════════════════════════════════════════════════════════════════════════════════════════════
// FourCorner's 2×2 is {1, i, −1, −i} = C₄. Over the ℂ ring that compass is a literal ring
// identity: multiplying weights by i four times is the identity, and twice is exactly the
// retraction. ALGEBRA, not physics: nothing here claims the substrate is quantum.

describe("L5 — the ℂ corner", () => {
  const isZeroC = (z: Complex) => Math.abs(z.re) < 1e-12 && Math.abs(z.im) < 1e-12;
  const cOps: TraceOps<number, Complex> = {
    ring: complexRing,
    isZero: isZeroC,
    keyToString: (k) => k.toString(),
    compareKeys: numericCompareKeys,
  };
  const i: Complex = { re: 0, im: 1 };
  const rotI = (s: WSet<number, Complex>): WSet<number, Complex> =>
    s.map((e) => ({ key: e.key, weight: complexRing.mul(e.weight, i) }));
  const closeC = (a: WSet<number, Complex>, b: WSet<number, Complex>) =>
    a.length === b.length &&
    a.every((e, n) => e.key === b[n]!.key && isZeroC(complexRing.add(e.weight, complexRing.negate(b[n]!.weight))));

  const amp: Complex = { re: 1 / Math.sqrt(2), im: 0 };
  const s: WSet<number, Complex> = [
    { key: 0, weight: amp },
    { key: 1, weight: amp },
  ];

  it("i² = −1 — the retraction IS two quarter-turns of the four-corner phase", () => {
    expect(closeC(rotI(rotI(s)), negateWSet(complexRing, s))).toBe(true);
    expect(closeC(rotI(rotI(rotI(rotI(s)))), s)).toBe(true); // i⁴ = 1: C₄ closes
  });

  it("the trace instantiates at the ℂ corner — stale amplitude is retracted", () => {
    const genC: Generator<readonly number[], Interp, number, Complex> = (interp, history) =>
      history.map((x) => ({ key: interp.get(x) ?? x, weight: amp }));
    const history = [0, 1];
    const st0 = start(cOps, genC, history, new Map<number, number>() as Interp).state;
    const st1 = step(cOps, genC, update, history, [9, 90] as const, st0).state;
    const r2 = step(cOps, genC, update, history, [0, 7] as const, st1);
    // the delta retracts the amplitude on detector 0 and emits it on detector 7
    expect(
      closeC(r2.delta, [
        { key: 0, weight: complexRing.negate(amp) },
        { key: 7, weight: amp },
      ]),
    ).toBe(true);
    expect(r2.state.emitted.map((e) => e.key)).not.toContain(0);
  });

  it("inverse-free semirings are refused at the TYPE level, not at runtime", () => {
    // The tropical semiring has no `negate` — min-plus has no additive inverse, so the trace does
    // not instantiate there. Correcting a belief in that corner is re-normalisation, not
    // retraction. This is the TS analogue of F#'s `IStarRing` refusal, and it is a COMPILE error:
    // `@ts-expect-error` itself fails the build if this line ever starts typechecking.
    const _bad: TraceOps<number, number> = {
      // @ts-expect-error `negate` is missing in TropicalRingLike but required in TraceRing<number>
      ring: TropicalRingLike,
      isZero: (w: number) => w === Infinity,
      keyToString: (k: number) => k.toString(),
      compareKeys: numericCompareKeys,
    };
    expect(typeof _bad).toBe("object");
  });
});

/** a semiring with NO additive inverse — the negative control for the type-level refusal above */
const TropicalRingLike = {
  zero: Infinity,
  one: 0,
  add: (a: number, b: number) => Math.min(a, b),
  mul: (a: number, b: number) => a + b,
};

// ════════════════════════════════════════════════════════════════════════════════════════════
// THE TREATY BYTE-LOCK — the same lines the F# oracle emits
// ════════════════════════════════════════════════════════════════════════════════════════════

interface Scenario {
  readonly name: string;
  readonly history: readonly string[];
  readonly firstSequence: bigint;
  readonly feedbacks: readonly (readonly [string, string])[];
}

/**
 * The treaty scenarios. Keys are chosen so ORDINAL order differs from every locale order:
 * ordinal (UTF-16 code unit) is  B(0x42) < Z(0x5A) < _(0x5F) < a(0x61) < é(0xE9),
 * whereas `localeCompare` puts `_` first and interleaves case. A locale-sensitive sort therefore
 * makes this byte-lock go RED — the collation rule with a falsifier attached.
 */
const SCENARIOS: readonly Scenario[] = [
  { name: "opening-only", history: ["a", "B", "a", "\u00E9", "_", "Z"], firstSequence: 0n, feedbacks: [] },
  {
    name: "empty-delta-is-recorded",
    history: ["a", "B"],
    firstSequence: 12n,
    feedbacks: [
      ["q", "Q"],
      ["a", "Z"],
    ],
  },
  {
    name: "idempotent-replay",
    history: ["a", "a", "B"],
    firstSequence: 100n,
    feedbacks: [
      ["a", "\u00E9"],
      ["a", "\u00E9"],
    ],
  },
  {
    name: "correction-appends",
    history: ["a"],
    firstSequence: 7n,
    feedbacks: [
      ["a", "B"],
      ["a", "Z"],
    ],
  },
  {
    name: "escaping",
    history: ["k=1", "s;t"],
    firstSequence: 0n,
    feedbacks: [["k=1", "new\tline"]],
  },
];

/** Run every scenario and flatten to the canonical line list (turns then state, in order). */
export function treatyLines(): string[] {
  const out: string[] = [];
  for (const sc of SCENARIOS) {
    const st0 = start(stringKeyIntegerOps, rereadRelabelled, sc.history, new Map() as Relabel).state;
    const rec = foldRecorded(
      sc.firstSequence,
      stringKeyIntegerOps,
      rereadRelabelled,
      updateRelabel,
      sc.history,
      sc.feedbacks,
      st0,
    );
    for (const t of rec.turns) out.push(traceTurnToLine(t));
    out.push(traceStateToLine(rec.nextSequence, rec.state.interpretation, rec.state.emitted));
  }
  return out;
}

const GOLDEN_PATH = join(import.meta.dir, "wset-four-corner-trace-golden-vectors.lines");

function goldenLines(): string[] {
  return readFileSync(GOLDEN_PATH, "utf8")
    .split("\n")
    .filter((l) => l.length > 0 && !l.startsWith("#"));
}

describe("TREATY — byte-lock against the golden lines (the F# oracle conforms to the same file)", () => {
  it("every scenario serializes to its golden line exactly", () => {
    expect(treatyLines()).toEqual(goldenLines());
  });

  it("the golden file records the no-op turns — an empty delta is the '-' marker, not a missing line", () => {
    const golden = goldenLines();
    const emptyDeltaTurns = golden.filter((l) => l.startsWith("wsettrace/turn/1\t") && l.endsWith("\t-"));
    // scenario 2 turn 12 (feedback touches nothing) and scenario 3 turn 101 (idempotent replay)
    expect(emptyDeltaTurns.length).toBe(2);
    // total turn lines == total feedbacks across all scenarios (nothing was skipped)
    const turnLines = golden.filter((l) => l.startsWith("wsettrace/turn/1\t"));
    expect(turnLines.length).toBe(SCENARIOS.reduce((n, s) => n + s.feedbacks.length, 0));
  });

  it("ordinal collation is what the golden bytes encode — no linguistic order can produce it", () => {
    const keys = ["a", "B", "\u00E9", "_", "Z"];
    const ordinal = [...keys].sort(ordinalCompareKeys);
    expect(ordinal).toEqual(["B", "Z", "_", "a", "\u00E9"]);
    // The discriminator, stated WITHOUT calling a locale API — the collation lint forbids one here
    // and is right to: a negative control is still a culture-sensitive call, and the claim does not
    // need it. Ordinal puts EVERY uppercase letter before EVERY lowercase one, with `_` between.
    // No linguistic collation does that (they all sort "a" adjacent to "B", and punctuation first),
    // so no locale can reproduce the line below, whatever the machine's ICU version happens to be.
    expect(ordinalCompareKeys("B", "a")).toBeLessThan(0);
    expect(ordinalCompareKeys("Z", "_")).toBeLessThan(0);
    expect(ordinalCompareKeys("_", "a")).toBeLessThan(0);
    // and the first golden state line carries the ordinal order verbatim
    expect(goldenLines()[0]).toBe("wsettrace/state/1\t0\t-\t+B=1;Z=1;_=1;a=2;\u00E9=1");
  });

  // The gap, MEASURED rather than described. "Ordinal" here is UTF-16 CODE UNIT (F#'s
  // `String.CompareOrdinal`, which is what `WSet.consolidate`'s `List.sortBy fst` uses), while the
  // repo's CANONICAL collation is `collation.ts`'s `stringCompare` = code POINT. They agree across
  // the whole BMP — which is why the golden vectors are exact — and disagree above it.
  // 081M060AYN9087G0R0006E6FWZ carries it; the F# conformer asserts the identical fact, so neither
  // side can drift alone.
  it("KNOWN GAP: ordinal here is code-UNIT (matching F#), not the canonical code-POINT collation", () => {
    // every golden key is BMP, so the two collations agree on all of them — the byte-lock is exact
    const goldenKeys = ["a", "B", "é", "_", "Z", "q", "Q", "k=1", "s;t"];
    expect([...goldenKeys].sort(ordinalCompareKeys)).toEqual([...goldenKeys].sort(stringCompare));

    // above the BMP they genuinely part ways: the surrogate lead unit D83D sorts below FFFD
    const astral = String.fromCodePoint(0x1f600); // U+1F600
    const bmp = "�";
    expect(ordinalCompareKeys(astral, bmp)).toBeLessThan(0); // code UNIT — and what F# does
    expect(stringCompare(astral, bmp)).toBeGreaterThan(0); // code POINT — the canonical collation
    // Matching F# is what makes the byte-lock TRUE. Using `stringCompare` here would put the two
    // oracles silently out of order on astral keys while still calling itself parity.
  });

  it("the codec escapes the field separators (a key containing = or ; survives)", () => {
    expect(wsetToText([{ key: "k=1", weight: -1n }])).toBe("+k\\=1=-1");
    expect(wsetToText([])).toBe("-");
    expect(interpretationToText(new Map([["s;t", "x"]]))).toBe("+s\\;t=x");
    expect(interpretationToText(new Map())).toBe("-");
  });
});
