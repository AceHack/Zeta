import { describe, expect, test } from "bun:test";
import { DrawError, drawAt, drawSheet, mscCorpus, uniformIndex, type Corpus } from "./draw";
import { MSC2020_TOP_LEVEL } from "./msc2020-corpus";

/** Index/find accessor that refuses `undefined` loudly — a missing element is a failed test, not a silent `!`. */
function must<T>(x: T | undefined): T {
  if (x === undefined) throw new Error("expected a value, got undefined");
  return x;
}


const corpus = mscCorpus(MSC2020_TOP_LEVEL);

describe("draw — DST replay", () => {
  test("same seed produces the same sequence", () => {
    const a = drawSheet(corpus, 20260817n, 40);
    const b = drawSheet(corpus, 20260817n, 40);
    expect(a).toEqual(b);
  });

  test("a different seed produces a different sequence", () => {
    const a = drawSheet(corpus, 20260817n, 40).map((d) => d.code);
    const b = drawSheet(corpus, 20260818n, 40).map((d) => d.code);
    expect(a).not.toEqual(b);
  });

  // The append-only property that matters for an indefinitely-iterated game: extending a campaign
  // must not renumber the draws already answered.
  test("extending a campaign leaves the earlier draws untouched", () => {
    const short = drawSheet(corpus, 7n, 12);
    const long = drawSheet(corpus, 7n, 200);
    expect(long.slice(0, 12)).toEqual([...short]);
  });

  test("one iteration replays without replaying its prefix", () => {
    expect(drawAt(corpus, 7n, 137)).toEqual(must(drawSheet(corpus, 7n, 1, 137)[0]));
  });

  test("the demo sheet is the one this PR reports", () => {
    expect(drawSheet(corpus, 20260817n, 14).map((d) => d.code)).toEqual([
      "13",
      "43",
      "30",
      "46",
      "22",
      "37",
      "76",
      "80",
      "68",
      "90",
      "55",
      "06",
      "70",
      "68",
    ]);
  });
});

describe("draw — selection", () => {
  test("indices stay in range and every class is reachable", () => {
    const seen = new Set<string>();
    for (const d of drawSheet(corpus, 99n, 2000)) seen.add(d.code);
    // With 2000 draws over 63 classes, a class missing would indicate a selection defect rather
    // than bad luck (expected misses under uniform draw are ~63 * (62/63)^2000, i.e. astronomically
    // small). This asserts reachability, not uniformity.
    expect(seen.size).toBe(63);
  });

  test("uniformIndex never leaves [0, n)", () => {
    for (let i = 0; i < 500; i++) {
      const k = uniformIndex(1234567n, i, 63);
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThan(63);
    }
  });

  test("a one-entry corpus always draws that entry", () => {
    const one: Corpus = { name: "t", version: "v", entries: [{ code: "00", title: "only" }] };
    for (let i = 0; i < 20; i++) expect(drawAt(one, 5n, i).code).toBe("00");
  });

  test("draws carry the corpus identity and the seed", () => {
    const d = drawAt(corpus, 42n, 3);
    expect(d.corpus).toBe("msc2020-top-level");
    expect(d.corpusVersion).toBe("MSC2020");
    expect(d.seed).toBe("42");
    expect(d.iteration).toBe(3);
  });
});

describe("draw — guards", () => {
  test("a negative or fractional iteration has no substream", () => {
    expect(() => drawAt(corpus, 1n, -1)).toThrow(DrawError);
    expect(() => drawAt(corpus, 1n, 1.5)).toThrow(DrawError);
  });

  test("an empty corpus is refused rather than silently drawing nothing", () => {
    expect(() => drawAt({ name: "e", version: "v", entries: [] }, 1n, 0)).toThrow(DrawError);
  });

  test("a non-positive cardinality is refused", () => {
    expect(() => uniformIndex(1n, 0, 0)).toThrow(DrawError);
  });

  // `uniformIndex` is exported, so it is reachable without passing `drawAt`'s guard. Without
  // its own, each of these reaches `BigInt(NaN)` and throws a RangeError naming BigInt rather
  // than DrawError naming the caller -- and `undefined`, which the TYPE forbids and the runtime
  // does not, produces that same NaN with nothing said about where it came from. The type
  // annotation is erased before any of these calls happen; only this guard survives to run.
  test("an exported entry point guards its own iteration, not just drawAt's", () => {
    expect(() => uniformIndex(1n, -1, 63)).toThrow(DrawError);
    expect(() => uniformIndex(1n, 1.5, 63)).toThrow(DrawError);
    expect(() => uniformIndex(1n, Number.NaN, 63)).toThrow(DrawError);
    // The untyped caller this surface will actually meet: a JSON-parsed sheet with the field absent.
    expect(() => uniformIndex(1n, (JSON.parse("{}") as { iteration: number }).iteration, 63)).toThrow(DrawError);
  });
});
