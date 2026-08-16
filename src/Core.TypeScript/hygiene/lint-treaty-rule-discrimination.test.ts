import { describe, expect, test } from "bun:test";
import { checkAlternative, citesWorkItem } from "./lint-treaty-rule-discrimination";
import { TREATY_DECLARATIONS, utf8Compare, utf16Compare, type TreatyDeclaration } from "./treaty-rule-alternatives";
import { readFileSync } from "node:fs";

// A synthetic treaty so the harness is tested on data whose answers are known by
// construction, rather than on the real seeds it is meant to police.
const toySeed = { vectors: [1, 2, 3, 4] };
const toy = (alt: TreatyDeclaration["alternatives"][number]): TreatyDeclaration => ({
  treaty: "toy",
  claimSource: "toy",
  claim: "toy",
  vectorCount: () => toySeed.vectors.length,
  alternatives: [alt],
});

describe("the instrument discriminates", () => {
  // The trap this whole PR is about: a check that cannot fail is not a check. These two
  // tests exist so the harness is known to answer BOTH ways before it is trusted.
  test("an `excluded` alternative that changes nothing FAILS", () => {
    const d = toy({ name: "a", expect: "excluded", evaluate: () => 0 });
    const r = checkAlternative(d, d.alternatives[0]!, toySeed);
    expect(r.ok).toBe(false);
    expect(r.changed).toBe(0);
    expect(r.failure).toContain("pin a POINT");
  });

  test("an `excluded` alternative that changes something PASSES", () => {
    const d = toy({ name: "a", expect: "excluded", evaluate: () => 2 });
    const r = checkAlternative(d, d.alternatives[0]!, toySeed);
    expect(r.ok).toBe(true);
    expect(r.changed).toBe(2);
  });
});

describe("not-excluded declarations must explain themselves", () => {
  test("a missing `kind` fails", () => {
    const d = toy({ name: "a", expect: "not-excluded", reason: "because", evaluate: () => 0 });
    expect(checkAlternative(d, d.alternatives[0]!, toySeed).ok).toBe(false);
  });

  test("a missing `reason` fails", () => {
    const d = toy({ name: "a", expect: "not-excluded", kind: "equivalent", evaluate: () => 0 });
    expect(checkAlternative(d, d.alternatives[0]!, toySeed).ok).toBe(false);
  });

  test("a `gap` without a filed work-item fails", () => {
    const d = toy({ name: "a", expect: "not-excluded", kind: "gap", reason: "no vector covers it", evaluate: () => 0 });
    const r = checkAlternative(d, d.alternatives[0]!, toySeed);
    expect(r.ok).toBe(false);
    expect(r.failure).toContain("work-item");
  });

  test("a `gap` citing a work-item passes", () => {
    const d = toy({
      name: "a",
      expect: "not-excluded",
      kind: "gap",
      reason: "filed as 081M02RX1PN087G0R003WK66GV",
      evaluate: () => 0,
    });
    expect(checkAlternative(d, d.alternatives[0]!, toySeed).ok).toBe(true);
  });

  test("a not-excluded row that STARTS discriminating fails, so it gets promoted", () => {
    const d = toy({
      name: "a",
      expect: "not-excluded",
      kind: "equivalent",
      reason: "same function",
      evaluate: () => 1,
    });
    const r = checkAlternative(d, d.alternatives[0]!, toySeed);
    expect(r.ok).toBe(false);
    expect(r.failure).toContain("PROMOTE");
  });
});

describe("citesWorkItem", () => {
  test("accepts a real 26-character ZetaId", () => {
    expect(citesWorkItem("see workitems/081M02RX1PN087G0R003WK66GV-slug.md")).toBe(true);
  });
  test("rejects prose with no id", () => {
    expect(citesWorkItem("we should file this some day")).toBe(false);
  });
  test("rejects a truncated id", () => {
    expect(citesWorkItem("081M02RX1PN087G0R003WK66")).toBe(false);
  });
});

describe("comparators", () => {
  test("utf8Compare puts uppercase before lowercase (ordinal, not linguistic)", () => {
    expect(utf8Compare("Z", "a")).toBeLessThan(0);
    expect(new Intl.Collator("en").compare("Z", "a")).toBeGreaterThan(0);
  });
  test("utf8Compare and utf16Compare agree on BMP and disagree outside it", () => {
    // U+FF3A (BMP) vs U+10000 (astral): UTF-8/codepoint order says FF3A first;
    // UTF-16 code units say the astral pair (0xD800 0xDC00) first. This is the
    // divergence the z-set-merkle `blocked` row records.
    const bmp = "Ｚ";
    const astral = "\u{10000}";
    expect(utf8Compare(bmp, astral)).toBeLessThan(0);
    expect(utf16Compare(bmp, astral)).toBeGreaterThan(0);
    // ...and they agree everywhere inside the BMP, which is why no BMP-only seed can
    // discriminate them (the theorem behind the `equivalent`/`blocked` rows).
    for (const [a, b] of [
      ["a", "b"],
      ["e", "é"],
      ["é", "Ω"],
      ["Ω", "中"],
      ["Z", "a"],
    ] as const) {
      expect(`${a}<${b}:${Math.sign(utf8Compare(a, b))}`).toBe(`${a}<${b}:${Math.sign(utf16Compare(a, b))}`);
    }
  });
});

describe("the registered declarations hold on the real seeds", () => {
  for (const decl of TREATY_DECLARATIONS) {
    test(decl.treaty, () => {
      const seed = JSON.parse(readFileSync(decl.treaty, "utf8"));
      for (const alt of decl.alternatives) {
        const r = checkAlternative(decl, alt, seed);
        expect(`${decl.treaty} :: ${alt.name} :: ${r.failure ?? "ok"}`).toBe(`${decl.treaty} :: ${alt.name} :: ok`);
      }
    });
  }
});

describe("the z-set-merkle finding, stated as an executable assertion", () => {
  // The headline result, pinned so it cannot silently change: the vector NAMED
  // `non-ascii-ordinal-bytes` is reordered by no collation we can find, while its
  // sibling ladder treaties ARE reordered.
  const zsmKeys = ["e", "é", "Ω", "中"];
  const ladderKeys = ["b-005-ASCII", "Кириллица", "漢字", "áéíóú"];
  const locales = ["en", "de", "sv", "da", "tr", "fr", "cs", "lt", "et"];

  test("no tested collation reorders the z-set-merkle non-ASCII key set", () => {
    const bytes = zsmKeys.slice().sort(utf8Compare).join(" ");
    for (const loc of locales) {
      expect(`${loc}:${zsmKeys.slice().sort(new Intl.Collator(loc).compare).join(" ")}`).toBe(`${loc}:${bytes}`);
    }
  });

  test("every tested collation DOES reorder the bag/z-set key set", () => {
    const bytes = ladderKeys.slice().sort(utf8Compare).join(" ");
    for (const loc of locales) {
      expect(`${loc}:${ladderKeys.slice().sort(new Intl.Collator(loc).compare).join(" ")}`).not.toBe(`${loc}:${bytes}`);
    }
  });
});
