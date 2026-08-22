import { describe, expect, test } from "bun:test";
import { MSC2020_TOP_LEVEL, MSC2020_VERSION, titleOf } from "./msc2020-corpus";

describe("MSC2020 corpus — vendored whole, not curated", () => {
  // 63 is the cardinality of the published AMS/zbMATH list, not a tuning knob. Pinned so that
  // an edit that quietly drops a class (the exact selection bias this probe exists to defeat)
  // fails here rather than in the distribution.
  test("carries all 63 published top-level classes", () => {
    expect(MSC2020_TOP_LEVEL.length).toBe(63);
  });

  test("codes are unique", () => {
    expect(new Set(MSC2020_TOP_LEVEL.map((e) => e.code)).size).toBe(MSC2020_TOP_LEVEL.length);
  });

  test("codes are two-digit strings, published order preserved", () => {
    for (const e of MSC2020_TOP_LEVEL) expect(e.code).toMatch(/^\d{2}$/);
    const codes = MSC2020_TOP_LEVEL.map((e) => e.code);
    expect(codes[0]).toBe("00");
    expect(codes[codes.length - 1]).toBe("97");
  });

  test("every entry has a non-empty title", () => {
    for (const e of MSC2020_TOP_LEVEL) expect(e.title.trim().length).toBeGreaterThan(0);
  });

  test("titleOf resolves a known code and refuses an unknown one", () => {
    expect(titleOf("18")).toBe("Category theory; homological algebra");
    expect(titleOf("99")).toBeUndefined();
  });

  test("the revision travels with the corpus", () => {
    expect(MSC2020_VERSION).toBe("MSC2020");
  });
});
