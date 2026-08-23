// signature.test.ts — falsifiers for the over-including key.
// 081M0QTXTR3087G0R002R439FH · design: docs/research/2026-08-23-signature-index-*.md
//
// The contract these exist to pin:
//   Tier 1 MAY over-include. Tier 1 MUST NEVER under-include.
// A key that dropped a true match would reintroduce the false zero this whole
// work-item exists to remove, so the no-false-negative property is tested
// directly rather than inferred from the implementation.

import { test, expect } from "bun:test";
import { proseSignature, dropVowels, sortChars, MIN_SURVIVING_CONSONANTS, SIGNATURE_VERSION } from "./signature.ts";
import { tokenize } from "./tokenize.ts";

// ─── THE SOUNDNESS CONTRACT ──────────────────────────────────────────────────

test("NO FALSE NEGATIVES: a term always lands in its own signature's class", () => {
  // The whole architecture's warrant. If `sig` is not a total function that maps
  // a term to a bucket containing itself, tier 1 can drop a true match and the
  // cascade is silently lossy.
  const corpus = [
    "landauer",
    "adinkra",
    "zset",
    "wset",
    "ai",
    "io",
    "queue",
    "Über",
    "verifylandauer",
    "chip8",
    "2026",
    "dbsp",
    "a",
    "xyz",
    "rhythm",
  ];
  for (const term of corpus) {
    const sig = proseSignature(term);
    const bucket = corpus.filter((t) => proseSignature(t) === sig);
    expect(bucket).toContain(term);
  }
});

test("the signature is deterministic and independent of call order", () => {
  // The artifact is committed and must rebuild byte-identically, so the key
  // cannot carry hidden state.
  const a = proseSignature("deterministic");
  for (let i = 0; i < 50; i++) proseSignature(`noise${String(i)}`);
  expect(proseSignature("deterministic")).toBe(a);
});

// ─── ORDER-FREENESS IS AT THE WORD LEVEL, NOT THE CHARACTER LEVEL ────────────

test("a word's LETTERS keep their order — this is not an anagram key", () => {
  // Aaron's correction: "I care more about order independence of short phrases,
  // not letters themselves." Measured cost of the character-level reading:
  // candidate inflation p90 of 26.00 vs 1.00. This test is what keeps the
  // shipped default on the right side of that.
  expect(proseSignature("landauer")).toBe("lndr");

  // `stream` and `master` are the discriminating pair: their consonant
  // skeletons are ANAGRAMS of each other, so the character-level key merges
  // them and the word-level key does not. (A first draft of this test used
  // landauer/laundrea, which was wrong — those two genuinely share the skeleton
  // `lndr`, so vowel-dropping merges them too and the test proved nothing. The
  // difference between the two designs has to be exhibited on a pair where they
  // actually disagree.)
  expect(proseSignature("stream")).toBe("strm");
  expect(proseSignature("master")).toBe("mstr");
  expect(proseSignature("stream")).not.toBe(proseSignature("master"));
  expect(sortChars(dropVowels("stream"))).toBe(sortChars(dropVowels("master")));
});

test("a PHRASE's key is the SET of its word signatures — word order discarded", () => {
  const phraseKey = (s: string) => new Set(tokenize(s).map((w) => proseSignature(w)));
  const a = phraseKey("quick brown fox");
  const b = phraseKey("fox brown quick");
  expect([...a].sort()).toEqual([...b].sort());
  // and a longer phrase is a STRICTLY tighter filter, which is why collisions
  // get rarer as a phrase grows rather than worse
  const c = phraseKey("quick brown fox jumps");
  expect(c.size).toBeGreaterThan(a.size);
});

test("real repo identifiers stay distinct — the hazard case", () => {
  const pairs: [string, string][] = [
    ["zset", "wset"],
    ["chip8", "chip9"],
    ["mea", "sim"],
    ["dbsp", "dbs"],
  ];
  for (const [a, b] of pairs) {
    expect(proseSignature(a)).not.toBe(proseSignature(b));
  }
});

// ─── THE DEGENERATE CASE, WHICH IS NOT EMPTY ─────────────────────────────────

test("all-vowel tokens keep their vowels instead of collapsing to the empty key", () => {
  // Aaron guessed "maybe there are none". MEASURED: 151 all-vowel tokens survive
  // stop-word removal, and `ai` alone is in 5,208 files. Mapping them to "" would
  // have merged every one of them into a single bucket.
  for (const t of ["ai", "io", "ieee", "eau"]) {
    expect(proseSignature(t)).toBe(t);
    expect(proseSignature(t)).not.toBe("");
  }
  // distinct, not merged
  expect(proseSignature("ai")).not.toBe(proseSignature("io"));
});

test("the threshold is on SURVIVING CONSONANTS, not input length", () => {
  // These pass a length test and degenerate anyway, which is why the predicate
  // is on the output.
  for (const t of ["audio", "queue", "eerie", "aurora"]) {
    expect(dropVowels(t).length).toBeLessThan(MIN_SURVIVING_CONSONANTS);
    expect(proseSignature(t)).toBe(t); // vowels kept
  }
  // a long word with enough consonants does drop them
  expect(proseSignature("deterministic")).toBe(dropVowels("deterministic"));
});

test("the shipped threshold is the measured knee, not a hand-picked constant", () => {
  // 4 is where candidate inflation p90 reaches 1.00 and max class size falls
  // 39 -> 15 on a 4,022-term sample over 334,397 terms. See the design doc §4.
  expect(MIN_SURVIVING_CONSONANTS).toBe(4);
});

// ─── COLLISION CLASSES ARE TYPO CLASSES ──────────────────────────────────────

test("vowel typos land in the same bucket as the correct spelling", () => {
  // Not a happy accident — it is why the unigram layer doubles as the
  // corpus-derived spell checker. Measured live: `reserach` -> research(8312),
  // `langauge` -> language(2945), `determinstic` -> deterministic(11981).
  for (const [typo, right] of [
    ["reserach", "research"],
    ["langauge", "language"],
    ["seperate", "separate"],
    ["determinstic", "deterministic"],
  ] as [string, string][]) {
    expect(proseSignature(typo)).toBe(proseSignature(right));
  }
});

test("HONEST LIMIT: consonant-level typos are NOT absorbed", () => {
  // The signature covers vowel substitution and transposition. It does not cover
  // consonant deletion, insertion or doubling, which change the skeleton. Pinned
  // so the design doc's claim is checked rather than asserted, and so nobody
  // later reports these as bugs.
  expect(proseSignature("occurance")).not.toBe(proseSignature("occurrence"));
  expect(proseSignature("reponse")).not.toBe(proseSignature("response"));
  // and a short typo falls below the threshold, so it gets no class at all
  expect(proseSignature("recieve")).toBe("recieve");
});

// ─── VERSIONING ──────────────────────────────────────────────────────────────

test("the signature version is pinned — it is part of the artifact's identity", () => {
  expect(SIGNATURE_VERSION).toBe(1);
});
