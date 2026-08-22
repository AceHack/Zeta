/**
 * anchor-entailment.test.ts — does the cited human anchor ENTAIL the committed ops?
 *
 * WHAT THIS ANSWERS THAT NOTHING ELSE DOES
 * ----------------------------------------
 * `ir-vs-handwritten.test.ts` proves the IR computes what the hand-written ports
 * compute. `nway-diff` proves the lanes agree with the canonical vectors. Both
 * are questions about ARITHMETIC, and both can be fully green while a generator
 * is NAMED for an algorithm it does not implement — because nothing in either
 * check ever reads the name.
 *
 * `.claude/rules/anchor-to-human-prior-art.md` requires an anchor to be CHECKED,
 * not cited: the named source must ENTAIL the code. This file is that check, run
 * rather than asserted, for the four generators that carry a human anchor in
 * their name. It is deliberately written to state the honest result in both
 * directions — the two anchors that hold are pinned as holding, and the two that
 * do NOT hold are pinned as not holding, with the divergent values named.
 *
 * WHY PIN A KNOWN-BAD ANCHOR AS AN ASSERTION RATHER THAN A COMMENT
 * ---------------------------------------------------------------
 * The two defects below were already written down, in prose, in a comment on
 * `ir-vs-handwritten.ts`. Prose in a comment is precisely the register that let
 * them sit: nothing runs it, nothing fails when it goes stale, and a later
 * reader cannot tell a live finding from a fossil. Encoded here, each finding
 * has a falsifier. If someone renames `rng.lcg32_glibc` and re-derives it as
 * real glibc, the corresponding row turns red and tells them to update the
 * record — which is the correct behaviour, not a nuisance. A finding that
 * nothing can contradict is the same vacuity class as a check that cannot fail.
 *
 * NOTHING HERE IS TAKEN FROM THE IR. Every reference implementation below was
 * written from its primary source (quoted at the call site) and compared against
 * the COMMITTED artifacts. That is what makes agreement, or disagreement, an
 * observation.
 *
 * PRIMARY SOURCES CONSULTED (2026-08-15)
 *   * glibc `stdlib/random_r.c` (`__random_r`, TYPE_0 branch) and
 *     `stdlib/random.c` (`unsafe_state.rand_type = TYPE_3`), current GNU C
 *     Library source.
 *   * Austin Appleby, `smhasher/src/MurmurHash3.cpp`, `MurmurHash3_x86_32`,
 *     the sections the file itself labels `// body` and `// tail`.
 *   * Press et al., *Numerical Recipes in C* 2nd ed. §7.1 (`ranqd1`).
 *   * The Knuth-MMIX LCG parameter pair as catalogued in the literature.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { CROSS_VERIFICATION_ROOT } from "./ir-vs-handwritten.ts";

// ─── committed artifacts (the things under question) ─────────────────────────

/** The canonical `vectors.yaml` for a primitive, as id -> expected decimal string. */
function committedVectors(primitive: string): Map<string, string> {
  const path = join(CROSS_VERIFICATION_ROOT, primitive, "vectors.yaml");
  const parsed = Bun.YAML.parse(readFileSync(path, "utf-8")) as {
    vectors: Record<string, unknown>[];
  };
  const out = new Map<string, string>();
  for (const v of parsed.vectors) {
    const id = v.id;
    const expected = v.expected ?? v.result;
    if (typeof id !== "string") throw new Error(`${primitive}: vector without a string id`);
    if (expected === undefined) throw new Error(`${primitive}: vector ${id} has no expected/result`);
    out.set(id, String(expected));
  }
  if (out.size === 0) throw new Error(`${primitive}: zero canonical vectors — refusing to pass on an empty surface`);
  return out;
}

/** The committed generated lane, as id -> value string (`_source` stripped). */
function committedTsLane(primitive: string): Map<string, string> {
  const path = join(CROSS_VERIFICATION_ROOT, primitive, "ts-output.json");
  const table = JSON.parse(readFileSync(path, "utf-8")) as Record<string, string>;
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(table)) {
    if (k === "_source") continue;
    out.set(k, String(v));
  }
  return out;
}

/** The committed IR document for a primitive, parsed as plain JSON. */
function committedIr(primitive: string): { generator: string; width: number; ops: { op: string }[] } {
  const path = join(CROSS_VERIFICATION_ROOT, primitive, "_gen", `${primitive}.ir.json`);
  return JSON.parse(readFileSync(path, "utf-8")) as { generator: string; width: number; ops: { op: string }[] };
}

/**
 * Vector id -> input value. Every id in these four lanes encodes its own input,
 * either literally (`x-1337`) or by a name whose value depends on the word width
 * (`x-golden` is 0x9e3779b9 at 32 bits and 0x9e3779b97f4a7c15 at 64).
 */
function inputOf(id: string, width: number): bigint {
  const m = /^x-(\d+)$/.exec(id);
  if (m?.[1] !== undefined) return BigInt(m[1]);
  const named32: Record<string, bigint> = {
    "x-u32max": 4294967295n,
    "x-2pow31": 2147483648n,
    "x-1e9": 1000000000n,
    "x-golden": 2654435769n,
  };
  const named64: Record<string, bigint> = {
    "x-u64max": 18446744073709551615n,
    "x-2pow63": 9223372036854775808n,
    "x-1e18": 1000000000000000000n,
    "x-golden": 11400714819323198485n,
  };
  const v = (width === 32 ? named32 : named64)[id];
  if (v === undefined) {
    throw new Error(`anchor-entailment: cannot decode a width-${String(width)} input from vector id \`${id}\``);
  }
  return v;
}

/** Compare a reference implementation against a primitive's committed vectors. */
function disagreementsWith(primitive: string, f: (x: bigint) => bigint): string[] {
  const committed = committedVectors(primitive);
  const { width } = committedIr(primitive);
  const out: string[] = [];
  for (const [id, expected] of committed) {
    const got = f(inputOf(id, width)).toString();
    if (got !== expected) out.push(id);
  }
  return out.sort();
}

// ─── reference implementations, each from its primary source ─────────────────

const M32 = (1n << 32n) - 1n;
const M31 = (1n << 31n) - 1n;
const M64 = (1n << 64n) - 1n;

/**
 * glibc `stdlib/random_r.c`, `__random_r`, TYPE_0 branch, verbatim:
 *
 *     int32_t val = ((read_state(state, 0) * 1103515245U) + 12345U)
 *                    & 0x7fffffff;
 *     write_state (state, 0, val);
 *     *result = val;
 *
 * Both facts matter: the reduction is mod 2^31, and the MASKED value is written
 * back into the state, so the recurrence itself is mod 2^31 — this is not a
 * full-width state with a truncated output.
 */
const glibcType0 = (x: bigint): bigint => (x * 1103515245n + 12345n) & M31;

/** The full-word 32-bit LCG the committed IR actually implements. */
const lcg32FullWord = (x: bigint): bigint => (x * 1103515245n + 12345n) & M32;

const rotl32 = (x: bigint, r: bigint): bigint =>
  r % 32n === 0n ? x & M32 : ((x << (r % 32n)) | (x >> (32n - (r % 32n)))) & M32;

/**
 * MurmurHash3_x86_32, the section Appleby labels `// body`, last two lines of
 * the per-block loop:
 *
 *     h1 = ROTL32(h1,13);
 *     h1 = h1*5+0xe6546b64;
 */
const murmurBodyCombine = (h1: bigint): bigint => (rotl32(h1, 13n) * 5n + 0xe6546b64n) & M32;

/**
 * MurmurHash3_x86_32, the section Appleby labels `// tail` — the leftover 1..3
 * bytes after the last whole block, for the maximal `len & 3 == 3` case:
 *
 *     k1 ^= tail[2] << 16;  k1 ^= tail[1] << 8;  k1 ^= tail[0];
 *     k1 *= c1;  k1 = ROTL32(k1,15);  k1 *= c2;  h1 ^= k1;
 *
 * Note what it does NOT contain: no rotl-13, no multiply-by-5, no 0xe6546b64.
 */
const C1 = 0xcc9e2d51n;
const C2 = 0x1b873593n;
const murmurTail = (h1: bigint): bigint => {
  // The tail mixes the leftover BYTES into h1; modelled here with the low three
  // bytes of the input standing in for tail[0..2], which is enough to establish
  // that the tail path is a different function of its argument.
  let k1 = h1 & 0xffffffn;
  k1 = (k1 * C1) & M32;
  k1 = rotl32(k1, 15n);
  k1 = (k1 * C2) & M32;
  return (h1 ^ k1) & M32;
};

/** Numerical Recipes 2nd ed. §7.1 `ranqd1`: idum = 1664525*idum + 1013904223, m = 2^32. */
const nrRanqd1 = (x: bigint): bigint => (x * 1664525n + 1013904223n) & M32;

/** The widely-cited Knuth-MMIX pair: a = 6364136223846793005, c = 1442695040888963407, m = 2^64. */
const mmixCited = (x: bigint): bigint => (x * 6364136223846793005n + 1442695040888963407n) & M64;

/** The MMIX increment Wikipedia's parameter table attributes to `rsixfour.c`. */
const mmixAltIncrement = (x: bigint): bigint => (x * 6364136223846793005n + 9754186451795953191n) & M64;

// ─── the checks ──────────────────────────────────────────────────────────────

describe("anchor entailment — the committed vectors are read at all", () => {
  test("each anchored primitive exposes canonical vectors that match its committed generated lane", () => {
    for (const p of ["lcg32_glibc", "lcg32_numerical_recipes", "lcg64_mmix", "murmur3_32_tail"]) {
      const vectors = committedVectors(p);
      const lane = committedTsLane(p);
      expect(vectors.size).toBe(10);
      // If these two ever disagreed, every row below would be checking the wrong bytes.
      expect([...vectors].sort()).toEqual([...lane].sort());
    }
  });
});

describe("anchor entailment — anchors that HOLD", () => {
  test("rng.lcg32_numerical_recipes IS Numerical Recipes ranqd1 (a=1664525, c=1013904223, m=2^32)", () => {
    expect(committedIr("lcg32_numerical_recipes").generator).toBe("rng.lcg32_numerical_recipes");
    expect(disagreementsWith("lcg32_numerical_recipes", nrRanqd1)).toEqual([]);
  });

  test("hash.murmur3_32_tail's ARITHMETIC is MurmurHash3_x86_32's body-block combine", () => {
    expect(disagreementsWith("murmur3_32_tail", murmurBodyCombine)).toEqual([]);
  });

  test("rng.lcg64_mmix matches the widely-cited Knuth-MMIX parameter pair", () => {
    expect(disagreementsWith("lcg64_mmix", mmixCited)).toEqual([]);
  });
});

describe("anchor entailment — anchors that DO NOT hold (pinned, with the divergent values)", () => {
  /**
   * `rng.lcg32_glibc` computes mod 2^32; glibc TYPE_0 computes mod 2^31. Six of
   * the ten committed vectors agree anyway — the six whose product stays below
   * 2^31, where the mask is a no-op — which is exactly how a wrong anchor
   * survives a spot check. The four that disagree are named.
   */
  test("rng.lcg32_glibc is NOT glibc TYPE_0: exactly x-2, x-3, x-6, x-7 disagree", () => {
    expect(disagreementsWith("lcg32_glibc", glibcType0)).toEqual(["x-2", "x-3", "x-6", "x-7"]);
  });

  test("the four divergent glibc values are these, precisely", () => {
    const committed = committedVectors("lcg32_glibc");
    for (const [id, glibcValue, committedValue] of [
      ["x-2", "59559187", "2207042835"],
      ["x-3", "1163074432", "3310558080"],
      ["x-6", "178652871", "2326136519"],
      ["x-7", "1282168116", "3429651764"],
    ] as const) {
      expect(committed.get(id)).toBe(committedValue);
      expect(glibcType0(inputOf(id, 32)).toString()).toBe(glibcValue);
    }
  });

  test("what rng.lcg32_glibc DOES compute is the full-word 32-bit LCG (all ten vectors)", () => {
    expect(disagreementsWith("lcg32_glibc", lcg32FullWord)).toEqual([]);
  });

  /**
   * The name says `tail`; the ops are the body-block combine. Asserting the tail
   * path DISAGREES is what makes "the name is wrong" a checked claim rather than
   * an opinion — it is not enough to show the body matches, since some function
   * had to.
   */
  test("hash.murmur3_32_tail is NOT MurmurHash3's tail path — the tail disagrees on every vector", () => {
    const disagreements = disagreementsWith("murmur3_32_tail", murmurTail);
    expect(disagreements.length).toBe(committedVectors("murmur3_32_tail").size);
  });

  test("the committed IR carries exactly the three body-loop ops, in body-loop order", () => {
    // rotl-13, multiply-by-5 and +0xe6546b64 appear in the `// body` loop only.
    // The `// tail` switch mixes leftover bytes with c1 / ROTL32(_,15) / c2 and a
    // final XOR into h1 — a different rotation, different constants, and an XOR
    // rather than an add. This row pins the op list so a later edit that changed
    // WHICH murmur3 step this is would have to face the name question again.
    expect(committedIr("murmur3_32_tail").ops).toEqual([
      { op: "rotl", r: 13 },
      { op: "mul", k: 5 },
      { op: "add", k: 3864292196 },
    ] as unknown as { op: string }[]);
    expect(3864292196n).toBe(0xe6546b64n);
  });
});

describe("anchor entailment — an anchor that is UNRESOLVED, recorded as unresolved", () => {
  /**
   * The multiplier 6364136223846793005 is uncontested. The increment is not:
   * the pairing committed here is the one overwhelmingly cited as "Knuth MMIX",
   * while Wikipedia's LCG parameter table gives the MMIX row as
   * c = 9754186451795953191 sourced to `rsixfour.c`. We have not resolved which
   * Knuth's own MMIX source uses. Both facts are pinned so the ambiguity is
   * visible rather than implied by silence — `numerology-vs-number-theory.md`:
   * a matching multiplier does not identify a generator.
   */
  test("the alternative MMIX increment does NOT reproduce the committed vectors", () => {
    const disagreements = disagreementsWith("lcg64_mmix", mmixAltIncrement);
    expect(disagreements.length).toBe(committedVectors("lcg64_mmix").size);
  });
});

describe("anchor entailment — this file discriminates (a check that cannot fail is not a check)", () => {
  test("a one-bit change to a reference constant turns a HOLDS row red", () => {
    const nrOffByOne = (x: bigint): bigint => (x * 1664525n + 1013904224n) & M32;
    expect(disagreementsWith("lcg32_numerical_recipes", nrOffByOne).length).toBeGreaterThan(0);
  });

  test("a one-bit change turns the murmur body-combine row red", () => {
    const bodyOffByOne = (h1: bigint): bigint => (rotl32(h1, 13n) * 5n + 0xe6546b65n) & M32;
    expect(disagreementsWith("murmur3_32_tail", bodyOffByOne).length).toBeGreaterThan(0);
  });

  test("the glibc row is sensitive to the modulus, which is the whole finding", () => {
    // Same constants, mod 2^32 instead of mod 2^31: zero disagreements, i.e. the
    // ONLY difference between "is glibc" and "is not glibc" here is the mask.
    expect(disagreementsWith("lcg32_glibc", lcg32FullWord)).toEqual([]);
    expect(disagreementsWith("lcg32_glibc", glibcType0).length).toBe(4);
  });
});
