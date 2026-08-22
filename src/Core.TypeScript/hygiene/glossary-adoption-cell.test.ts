import { expect, test, describe } from "bun:test";
import {
  glossaryTerms,
  countTerms,
  cell,
  PLUMBING,
  TERM_RE,
  documentFrequency,
  concentration,
  ordinalCompare,
} from "./glossary-adoption-cell";

// Per BP-29: every positive is paired with a negative computed by the SAME function.

describe("term extraction is structural, not a stop-word judgement", () => {
  test("hyphenated lowercase compounds are terms", () => {
    expect("weight-free scale-free byte-lock".match(TERM_RE)).toEqual(["weight-free", "scale-free", "byte-lock"]);
  });

  test("PAIRED NEGATIVE: ordinary single words are NOT terms — no stop-word list is consulted", () => {
    // This is the design claim: the filter is SHAPE, so "the", "system", "and"
    // are excluded without anyone deciding they are unimportant.
    expect("the system and a value".match(TERM_RE)).toBeNull();
  });

  test("a trailing or leading hyphen does not manufacture a term", () => {
    expect("-lonely lonely-".match(TERM_RE)).toBeNull();
  });
});

describe("glossary heading parsing", () => {
  test("reads hyphenated terms out of headings", () => {
    expect(glossaryTerms("### Weight-free\ntext\n## Byte-lock").has("weight-free")).toBe(true);
  });

  test("a two-word heading is also accepted in hyphenated form", () => {
    expect(glossaryTerms("### Glass Halo").has("glass-halo")).toBe(true);
  });

  test("PAIRED NEGATIVE: body prose is not a heading — mentioning a term does not define it", () => {
    // The live finding this pins: load-bearing appears 8 times in GLOSSARY BODY
    // and has no entry. A meter that counted body mentions would score it defined.
    const g = glossaryTerms("### Something else\nwe use load-bearing everywhere in this paragraph");
    expect(g.has("load-bearing")).toBe(false);
  });
});

describe("the two halves of the cell", () => {
  const counts = countTerms(["alpha-beta ".repeat(100) + "gamma-delta " + "plumb-key ".repeat(100)]);

  test("COINED-NOT-ADOPTED: a glossary term the corpus barely uses", () => {
    const c = cell(new Set(["gamma-delta"]), counts, { quietBelow: 1, loudAbove: 50 });
    expect(c.coinedNotAdopted).toEqual([["gamma-delta", 1]]);
  });

  test("PAIRED NEGATIVE: a well-used glossary term is NOT flagged as un-adopted", () => {
    const c = cell(new Set(["alpha-beta"]), counts, { quietBelow: 1, loudAbove: 50 });
    expect(c.coinedNotAdopted).toEqual([]);
  });

  test("USED-NOT-DEFINED: a loud term with no entry is flagged", () => {
    const c = cell(new Set(), counts, { quietBelow: 1, loudAbove: 50 });
    expect(c.usedNotDefined.map(([t]) => t)).toContain("alpha-beta");
  });

  test("PAIRED NEGATIVE: defining it removes it from that half", () => {
    const c = cell(new Set(["alpha-beta"]), counts, { quietBelow: 1, loudAbove: 50 });
    expect(c.usedNotDefined.map(([t]) => t)).not.toContain("alpha-beta");
  });

  test("plumbing is EXCLUDED but REPORTED, never silently dropped", () => {
    const withPlumb = countTerms(["pr-review ".repeat(200)]);
    const c = cell(new Set(), withPlumb, { quietBelow: 1, loudAbove: 50 });
    expect(PLUMBING.has("pr-review")).toBe(true);
    expect(c.usedNotDefined.map(([t]) => t)).not.toContain("pr-review");
    // the negative that makes the exclusion auditable rather than a thumb on the scale
    expect(c.plumbingExcluded.map(([t]) => t)).toContain("pr-review");
  });

  test("an empty corpus yields empty halves, never a clean bill of health", () => {
    const c = cell(new Set(["orphan-term"]), new Map(), { quietBelow: 1, loudAbove: 50 });
    expect(c.usedNotDefined).toEqual([]);
    // and the glossary term IS flagged as un-adopted, because zero use is the
    // strongest form of not-adopted -- absence must not read as adoption
    expect(c.coinedNotAdopted).toEqual([["orphan-term", 0]]);
  });
});

describe("breadth — the 'by others' axis that separates a tic from substrate", () => {
  test("document frequency counts DOCUMENTS, not occurrences", () => {
    const df = documentFrequency(["alpha-beta alpha-beta alpha-beta", "alpha-beta"]);
    expect(df.get("alpha-beta")).toBe(2);
  });

  test("PAIRED NEGATIVE: raw count cannot make that distinction — which is why breadth exists", () => {
    // 4 uses either way; only breadth tells the two corpora apart.
    const oneDoc = ["alpha-beta alpha-beta alpha-beta alpha-beta"];
    const fourDocs = ["alpha-beta", "alpha-beta", "alpha-beta", "alpha-beta"];
    expect(countTerms(oneDoc).get("alpha-beta")).toBe(countTerms(fourDocs).get("alpha-beta"));
    expect(documentFrequency(oneDoc).get("alpha-beta")).not.toBe(documentFrequency(fourDocs).get("alpha-beta"));
  });

  test("concentration is the tic signature: many uses, few documents", () => {
    // the live case: sub-target measured 416 uses across 31 docs = 13.4/doc
    expect(concentration(416, 31)).toBeCloseTo(13.4, 1);
    // against genuinely broad adoption
    expect(concentration(1208, 1097)).toBeLessThan(1.2);
  });

  test("PAIRED NEGATIVE: a term in zero documents is 0, never Infinity", () => {
    // division by df must not produce a number that would sort to the top of a
    // "most concentrated" list purely because nothing uses the term
    expect(concentration(5, 0)).toBe(0);
  });
});

describe("collation is ordinal, never locale-sensitive", () => {
  test("ordinalCompare orders by UTF-16 code unit", () => {
    // uppercase sorts before lowercase in code-unit order; a locale collator
    // typically does the opposite, which is exactly the machine-dependence banned
    expect(ordinalCompare("Z-a", "a-z")).toBe(-1);
    expect(ordinalCompare("a-z", "Z-a")).toBe(1);
    expect(ordinalCompare("a-z", "a-z")).toBe(0);
  });

  test("PAIRED NEGATIVE: it disagrees with localeCompare — so the choice is load-bearing", () => {
    // If these agreed, swapping one for the other would be invisible and this
    // test would be pinning nothing. They do not agree, which is the point.
    expect(ordinalCompare("Z-a", "a-z")).not.toBe("Z-a".localeCompare("a-z"));
  });
});
