/**
 * Falsifiers for the network trust boundary in `f3-hat-choice-run.ts`.
 *
 * Two claims are under test and both would be easy to assert and never check:
 *
 *   1. The checks REFUSE things. A validator that accepts everything is the
 *      vacuity class — it looks like a check and constrains nothing — so every
 *      clause below has a case that fails without it.
 *   2. The checks are a NO-OP ON THE COMMITTED DATA. This is the load-bearing
 *      claim: the numbers in `docs/research/2026-08-26-*` were computed from
 *      `data/f3-hat-choice/`, and a boundary that would have rejected any of it
 *      would mean the runner can no longer reproduce its own experiment. That is
 *      checked against the real files, not asserted in a comment.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { storableCount, storableText } from "./f3-hat-choice-run";

const DATA_DIR = join(import.meta.dir, "..", "..", "..", "data", "f3-hat-choice");

describe("storableText — what the experiment will store", () => {
  test("accepts ordinary model output", () => {
    expect(storableText("Fact Checker", "f")).toBe("Fact Checker");
    expect(storableText("", "f")).toBe("");
    expect(storableText("1. Devil's Advocate\n2. Historian", "f")).toBe("1. Devil's Advocate\n2. Historian");
  });

  test("accepts the non-ASCII that is actually in the data — CJK, emoji, ZWJ, VS16", () => {
    // Every one of these appears in `data/f3-hat-choice/`. An ASCII allowlist
    // would silently rewrite real model output, which is why there isn't one.
    expect(storableText("我是阿里云自主研发的超大规模语言模型", "f")).toContain("阿里");
    expect(storableText("🤖 AI Assistant", "f")).toContain("🤖");
    expect(storableText("\u{1F9D9}\u200D\u2642\uFE0F Wizard", "f")).toContain("\u200D");
    expect(storableText("Résumé Reviewer", "f")).toContain("é");
  });

  test("REFUSES C0/C1 control characters and DEL", () => {
    expect(() => storableText("role\u0000name", "f")).toThrow(RangeError);
    expect(() => storableText("role\u001Bname", "f")).toThrow(RangeError);
    expect(() => storableText("role\u007Fname", "f")).toThrow(RangeError);
    expect(() => storableText("role\u0085name", "f")).toThrow(RangeError);
  });

  test("REFUSES U+2028/U+2029 — this format is line-delimited", () => {
    expect(() => storableText("role\u2028name", "f")).toThrow(RangeError);
    expect(() => storableText("role\u2029name", "f")).toThrow(RangeError);
  });

  test("REFUSES bidirectional overrides — Trojan Source (CVE-2021-42574)", () => {
    // A committed data file is read by humans. A right-to-left override renders
    // one thing and stores another, which is exactly the attack.
    expect(() => storableText("Auditor\u202E rotidua", "f")).toThrow(RangeError);
    expect(() => storableText("\u202Dsomething", "f")).toThrow(RangeError);
    expect(() => storableText("\u2066isolate\u2069", "f")).toThrow(RangeError);
  });

  test("REFUSES a lone surrogate — it would not survive the UTF-8 round trip", () => {
    expect(() => storableText("role\uD800name", "f")).toThrow(RangeError);
  });

  test("REFUSES an unbounded response", () => {
    expect(storableText("x".repeat(8192), "f")).toHaveLength(8192);
    expect(() => storableText("x".repeat(8193), "f")).toThrow(RangeError);
  });

  test("REFUSES a non-string where the cast claimed a string", () => {
    // `generate` casts the JSON body with `as`, which checks nothing at runtime.
    expect(() => storableText(42, "f")).toThrow(TypeError);
    expect(() => storableText({ nested: "object" }, "f")).toThrow(TypeError);
    expect(() => storableText(["a"], "f")).toThrow(TypeError);
    expect(() => storableText(null, "f")).toThrow(TypeError);
  });

  test("the message names the field, so a failure mid-run is diagnosable", () => {
    expect(() => storableText(42, "prompt_eval_count")).toThrow(/prompt_eval_count/u);
  });
});

describe("storableCount — token counts the FLOP proxy can trust", () => {
  test("accepts counts the experiment produces", () => {
    expect(storableCount(0, "f")).toBe(0);
    expect(storableCount(157, "f")).toBe(157);
    expect(storableCount(1_000_000, "f")).toBe(1_000_000);
  });

  test("absent stays 0 — the behaviour `?? 0` already had", () => {
    expect(storableCount(undefined, "f")).toBe(0);
    expect(storableCount(null, "f")).toBe(0);
  });

  test("REFUSES what `as number` would have let through into flopProxy", () => {
    // Each of these is a value the unchecked cast accepted while claiming `number`.
    // NaN is the one that matters: it propagates silently through every sum.
    expect(() => storableCount(Number.NaN, "f")).toThrow(RangeError);
    expect(() => storableCount("not a number", "f")).toThrow(RangeError);
    expect(() => storableCount({ eval_count: 5 }, "f")).toThrow(RangeError);
    expect(() => storableCount(Number.POSITIVE_INFINITY, "f")).toThrow(RangeError);
  });

  test("REFUSES out-of-range and non-integer counts", () => {
    expect(() => storableCount(-1, "f")).toThrow(RangeError);
    expect(() => storableCount(1.5, "f")).toThrow(RangeError);
    expect(() => storableCount(1_000_001, "f")).toThrow(RangeError);
  });

  test("coerces a numeric string rather than refusing it — stated, so it is checked", () => {
    // Lenient on purpose: JSON number-vs-string is a serialiser detail, and the
    // range check is what carries the guarantee. Written down because an
    // undocumented coercion is how a validator quietly stops meaning what it says.
    expect(storableCount("157", "f")).toBe(157);
  });
});

describe("THE NO-OP CLAIM — the boundary admits every row already committed", () => {
  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".jsonl"));

  test("the data this guards is actually present", () => {
    // Without this, an empty directory would make the sweep below pass vacuously.
    expect(files.length).toBeGreaterThan(0);
  });

  test("every string and every token count in data/f3-hat-choice/ is accepted", () => {
    const strings: string[] = [];
    const counts: unknown[] = [];
    const walk = (v: unknown): void => {
      if (typeof v === "string") strings.push(v);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v !== null && typeof v === "object") Object.values(v).forEach(walk);
    };

    for (const f of files) {
      for (const line of readFileSync(join(DATA_DIR, f), "utf8").split("\n")) {
        if (line.length === 0) continue;
        const row = JSON.parse(line) as Record<string, unknown>;
        walk(row);
        for (const k of ["promptTokens", "evalTokens"]) {
          if (k in row) counts.push(row[k]);
        }
      }
    }

    // The sweep must have found the corpus the research doc reports on.
    expect(strings.length).toBeGreaterThan(30_000);
    expect(counts.length).toBeGreaterThan(10_000);

    const rejected = strings.filter((s) => {
      try {
        storableText(s, "sweep");
        return false;
      } catch {
        return true;
      }
    });
    expect(rejected).toEqual([]);

    for (const c of counts) expect(() => storableCount(c, "sweep")).not.toThrow();
  });
});
