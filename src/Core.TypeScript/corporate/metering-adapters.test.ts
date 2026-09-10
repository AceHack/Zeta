/**
 * metering-adapters.test.ts — the three parsers between a real tool and an honest number.
 *
 * Each one turns text a command printed into a figure a portal shows, which is exactly where an
 * invented number gets in. The shared property under test is that a line they cannot fully
 * understand yields NOTHING rather than a partial reading: an under-count is worse than an
 * absence, because the absence is visible in a total's denominator and the under-count is not.
 */

import { describe, expect, test } from "bun:test";

import { parseNumstat, parseUsageLine } from "./adapters";
import { pricingFrom } from "./run-org";
import { priceOf } from "./meter";

describe("parseNumstat — what a change actually touched", () => {
  test("an ordinary diff yields per-file counts", () => {
    const files = parseNumstat("37\t8\tsrc/a.ts\n11\t2\tsrc/b.ts\n");
    expect(files).toEqual([
      { path: "src/a.ts", added: 37, removed: 8 },
      { path: "src/b.ts", added: 11, removed: 2 },
    ]);
  });

  test("a BINARY file is listed with zero counts, never dropped", () => {
    // git prints `-` because "lines" is meaningless for a png. Dropping the row would make a
    // commit that replaced an image look like a commit that changed nothing.
    expect(parseNumstat("-\t-\tassets/logo.png")).toEqual([
      { path: "assets/logo.png", added: 0, removed: 0 },
    ]);
  });

  test("a path containing a tab survives, because git does not quote it here", () => {
    expect(parseNumstat("1\t0\tsrc/od\td.ts")[0]?.path).toBe("src/od\td.ts");
  });

  test("an unparseable row is dropped rather than counted as zero", () => {
    // Zero is a measurement — "this file changed by nothing". An unreadable row measured nothing.
    expect(parseNumstat("x\ty\tsrc/a.ts")).toEqual([]);
    expect(parseNumstat("3\t1\t")).toEqual([]);
    expect(parseNumstat("only-one-field")).toEqual([]);
  });

  test("empty output is no files, and does not throw", () => {
    expect(parseNumstat("")).toEqual([]);
    expect(parseNumstat("\n\n")).toEqual([]);
  });
});

describe("parseUsageLine — a producer declaring what it spent", () => {
  test("a complete line yields the model and both token counts", () => {
    expect(parseUsageLine("usage: model=claude-opus-5 in=1200 out=800")).toEqual({
      model: "claude-opus-5",
      tokensIn: 1200,
      tokensOut: 800,
    });
  });

  test("one direction reported is enough — the other is absent, not zero", () => {
    expect(parseUsageLine("usage: model=m out=800")).toEqual({ model: "m", tokensOut: 800 });
  });

  test("no model means nothing can be priced, so nothing is returned", () => {
    expect(parseUsageLine("usage: in=100 out=100")).toBeUndefined();
    expect(parseUsageLine("usage: model= in=100")).toBeUndefined();
  });

  test("a model with no tokens is not a free call — it is an unmeasured one", () => {
    expect(parseUsageLine("usage: model=m")).toBeUndefined();
  });

  test("a negative or non-numeric count is refused rather than coerced", () => {
    expect(parseUsageLine("usage: model=m in=-5")).toBeUndefined();
    expect(parseUsageLine("usage: model=m in=lots")).toBeUndefined();
  });

  test("no line at all is undefined, which is the ordinary case", () => {
    expect(parseUsageLine(undefined)).toBeUndefined();
  });
});

describe("pricingFrom — prices are supplied, and a bad one is refused", () => {
  test("a well-formed entry becomes a price", () => {
    expect(pricingFrom(["claude-opus-5=15,75"])).toEqual({
      "claude-opus-5": { inPerMillion: 15, outPerMillion: 75 },
    });
  });

  test("several entries, and whitespace is tolerated", () => {
    expect(Object.keys(pricingFrom(["a=1,2", " b = 3 , 4 "])).sort()).toEqual(["a", "b"]);
  });

  test("a malformed entry is DROPPED, never defaulted to zero", () => {
    // A zero price renders as free work, which is the figure `meter.ts` exists to keep off screen.
    expect(pricingFrom(["broken"])).toEqual({});
    expect(pricingFrom(["m=1"])).toEqual({});
    expect(pricingFrom(["m=a,b"])).toEqual({});
    expect(pricingFrom(["=1,2"])).toEqual({});
    expect(pricingFrom(["m=-1,2"])).toEqual({});
  });

  test("no --price at all is an empty table, and an empty table prices nothing", () => {
    const none = pricingFrom([]);
    expect(none).toEqual({});
    expect(priceOf({ model: "m", tokensIn: 10, tokensOut: 10 }, none)).toBeUndefined();
  });

  test("a dropped entry leaves that model unpriced rather than mispriced", () => {
    const table = pricingFrom(["good=1,2", "bad=oops"]);
    expect(priceOf({ model: "good", tokensIn: 1_000_000, tokensOut: 0 }, table)).toBeCloseTo(1, 6);
    expect(priceOf({ model: "bad", tokensIn: 1_000_000, tokensOut: 0 }, table)).toBeUndefined();
  });
});
