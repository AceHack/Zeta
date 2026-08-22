import { expect, test, describe } from "bun:test";
import { scanSource, summarize } from "./falsifier-density";

// Every positive below is paired with a negative computed by the SAME function, so a
// passing assertion cannot be passing vacuously. That is the discipline this file
// measures, applied to the measurer.

describe("falsifier-density: assertion-shape detection", () => {
  test("a file with an expected-throw is negative-bearing", () => {
    const v = scanSource("x.test.ts", `test("does a thing", () => { expect(f).toThrow(); });`);
    expect(v.negativeBearing).toBe(true);
    expect(v.negativeAssertions).toBeGreaterThan(0);
  });

  test("PAIRED NEGATIVE: a file of only happy-path assertions is NOT negative-bearing", () => {
    const v = scanSource("x.test.ts", `test("adds", () => { expect(1 + 1).toBe(2); });`);
    expect(v.negativeBearing).toBe(false);
    expect(v.negativeAssertions).toBe(0);
    expect(v.negativeNames).toBe(0);
    // and it is still counted as a file WITH tests -- barrenness must not be
    // achieved by the scanner failing to see the tests at all
    expect(v.tests).toBe(1);
  });

  test("a refusal-shaped test NAME counts even with a positive assertion", () => {
    const v = scanSource("x.test.ts", `test("refuses an unsigned commit", () => { expect(r.ok).toBe(true); });`);
    expect(v.negativeNames).toBe(1);
    expect(v.negativeBearing).toBe(true);
  });

  test("PAIRED NEGATIVE: an ordinary name does not count", () => {
    const v = scanSource("x.test.ts", `test("accepts a signed commit", () => { expect(r.ok).toBe(true); });`);
    expect(v.negativeNames).toBe(0);
    expect(v.negativeBearing).toBe(false);
  });
});

describe("falsifier-density: summarize", () => {
  const bearing = scanSource("a.test.ts", `test("rejects nulls", () => { expect(f).toThrow(); });`);
  const barren = scanSource("b.test.ts", `test("adds", () => { expect(1).toBe(1); });`);
  const noTests = scanSource("c.ts", `export const x = 1;`);

  test("density is bearing/withTests and barren files are listed", () => {
    const d = summarize([bearing, barren]);
    expect(d.files).toBe(2);
    expect(d.negativeBearing).toBe(1);
    expect(d.density).toBe(0.5);
    expect(d.barren.map((b) => b.path)).toEqual(["b.test.ts"]);
  });

  test("files with NO tests are excluded from the denominator", () => {
    // otherwise a repo could raise its score by adding files that assert nothing,
    // which would invert the metric's meaning
    const d = summarize([bearing, barren, noTests]);
    expect(d.files).toBe(2);
    expect(d.density).toBe(0.5);
  });

  test("PAIRED NEGATIVE: an empty scan is 0, never 1 — absence must not read as perfection", () => {
    const d = summarize([]);
    expect(d.files).toBe(0);
    expect(d.density).toBe(0);
    expect(d.negativeBearing).toBe(0);
    expect(d.barren).toEqual([]);
  });

  test("barren list is ordered by test count so the work-list leads with the biggest gaps", () => {
    const small = scanSource("s.test.ts", `test("adds one", () => { expect(1).toBe(1); });`);
    const big = scanSource(
      "b.test.ts",
      `test("adds one", () => { expect(1).toBe(1); });\ntest("adds two", () => { expect(2).toBe(2); });`,
    );
    expect(summarize([small, big]).barren.map((b) => b.path)).toEqual(["b.test.ts", "s.test.ts"]);
  });
});

describe("falsifier-density: scanner boundaries", () => {
  test("test names shorter than 3 chars are not counted as tests (noise floor)", () => {
    // Found by this suite catching its own author: the first draft of the ordering
    // test used test("a")/test("b") and measured tests: 0. The floor is deliberate --
    // one-character string literals are overwhelmingly not test names -- so it is
    // pinned here rather than left as a surprise.
    expect(scanSource("x.test.ts", `test("a", () => { expect(1).toBe(1); });`).tests).toBe(0);
    expect(scanSource("x.test.ts", `test("abc", () => { expect(1).toBe(1); });`).tests).toBe(1);
  });
});

describe("falsifier-density: the limit it must not overclaim", () => {
  test("a test that is negative-SHAPED but unfalsifiable still scores as bearing", () => {
    // This is the honest limit, pinned as a test so it cannot be forgotten: the
    // scanner reads SHAPE, not soundness. `expect(true).not.toBe(false)` can never
    // fail, and this meter counts it. mutation-runner.ts is the stronger check.
    const v = scanSource("x.test.ts", `test("t", () => { expect(true).not.toBe(false); });`);
    expect(v.negativeBearing).toBe(true);
  });
});
