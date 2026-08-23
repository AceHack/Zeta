import { describe, expect, test } from "bun:test";

import { canInterruptParagraph, fixMarkdownText } from "../fix-markdown-md032-md026";
import {
  certify,
  orderedListPrefixDetector,
  REFERENCE_DETECTORS,
  resplitterHealer,
  tree,
} from "../healer-harness";
import { certifyMdFixer, MD_FIXER_FIXTURES, mdFixerHealer } from "./md-fixer-certified";

// Workitem 081KX3KA3F0 final scope: the PRODUCTION MD032/MD026 fixer goes
// through the harness, and write access is gated on the verdict.
// Proofs:
//   1. The production transform passes all three laws over the incident
//      corpus + md fixtures (this is the certification the CLI gate runs).
//   2. The 2026-07-08 incident class is dead IN THE PRODUCTION FIXER: a
//      code span wrapped across a line that begins with "- " is untouched
//      (first certification run caught the live closure violation; the
//      span-parity guard in classifyLines is the fix).
//   3. The healer only ever touches .md paths.

describe("certifyMdFixer — the write-access gate's verdict", () => {
  test("production fixer passes idempotence + closure + convergence", () => {
    const verdict = certifyMdFixer();
    expect(verdict.violations).toEqual([]);
    expect(verdict.pass).toBe(true);
  });
});

describe("the 2026-07-08 incident class in the production transform", () => {
  test("wrapped code span above a list-looking line is untouched", () => {
    const before = [
      "# Lemma",
      "",
      "Consider the identity `Hadamard(uniform-over-C) =",
      "- uniform-over-C`, so the fixed point holds",
      "- **Q2:** does collapse give G>0?",
      "",
      "Trailing text.",
    ].join("\n");
    expect(fixMarkdownText(before)).toBe(before);
  });

  test("a REAL list after a normal paragraph still gets its blank (the heal still heals)", () => {
    const before = "Intro line\n- item one\n- item two\nOutro line\n";
    const after = fixMarkdownText(before);
    expect(after).toBe("Intro line\n\n- item one\n- item two\n\nOutro line\n");
  });

  test("span-open suppression is conservative, not destructive: unclosed stray backtick suppresses only that boundary", () => {
    const before = "Odd `tick paragraph\n- next line\n\nNormal paragraph\n- real item\n";
    const after = fixMarkdownText(before);
    // First boundary suppressed (span may be open); second boundary healed.
    expect(after).toBe("Odd `tick paragraph\n- next line\n\nNormal paragraph\n\n- real item\n");
  });
});

describe("mdFixerHealer — tree adapter", () => {
  test("non-md paths are byte-identical through the healer", () => {
    for (const fixture of MD_FIXER_FIXTURES) {
      const healed = mdFixerHealer.heal(fixture.tree);
      for (const [path, content] of fixture.tree) {
        if (!path.endsWith(".md")) expect(healed.get(path)).toBe(content);
      }
    }
  });

  test("md026 strips heading punctuation outside fences only", () => {
    const healed = mdFixerHealer.heal(
      new Map([["docs/h.md", "# Bad heading.\n\n```text\n# not a heading.\n```\n"]]),
    );
    expect(healed.get("docs/h.md")).toBe("# Bad heading\n\n```text\n# not a heading.\n```\n");
  });
});

describe("MD022 extension (081KZQ3234608QG0R003D5V4B4)", () => {
  test("the 15-tick survivor's exact shape now heals: blanks appear around headings", () => {
    const healed = mdFixerHealer.heal(
      tree({ "docs/t.md": "Body text.\n## The \"Saint of Time Travel\" (Doctor Who)\nNext paragraph.\n" }),
    );
    expect(healed.get("docs/t.md")).toBe(
      "Body text.\n\n## The \"Saint of Time Travel\" (Doctor Who)\n\nNext paragraph.\n",
    );
  });

  test("headings inside fences stay untouched (span/fence mask carries over)", () => {
    const doc = "# Ok\n\n```text\n# not a real heading\n```\n\nDone.\n";
    expect(mdFixerHealer.heal(tree({ "docs/f.md": doc })).get("docs/f.md")).toBe(doc);
  });

  test("certification (all three laws) holds with the MD022 fixture in the corpus", () => {
    expect(certifyMdFixer().pass).toBe(true);
  });
});

// ─── 081M0QZF4QY087G0R000WKDYFZ — the healer must not MANUFACTURE the list ───
//
// Both cases below are the real ones, copied from the documents the sweep
// edited on 2026-08-23, not paraphrases:
//   docs/books/you-born-at-the-hinge/RAW-2026-08-18-*.md:686   `2007.`
//   docs/design/2026-08-23-clifford-gpu-theory-brief-*.md:87   `2016.`
// In both, MD032 inserted a blank before a hard-wrapped numeral, which is what
// TURNED the sentence into an ordered list — markdownlint then failed
// MD029 (`Expected: 1; Actual: 2007` / `Actual: 2016`) on the healer's own edit.
//
// The predicate is CommonMark's, not ours (0.31.2 §Lists: "we allow only lists
// starting with `1` to interrupt paragraphs"), so these tests double as
// conformance tests against the parser markdownlint actually runs.
describe("hard-wrapped numerals are prose, not lists (CommonMark interruption rule)", () => {
  test("case 1 — the book RAW file's `2007.` continuation is left byte-identical", () => {
    const before = [
      "## Provenance",
      "",
      "chosen as the headline property of an installer in",
      "2007. It rhymes with two other things in this record:",
      "",
    ].join("\n");
    expect(fixMarkdownText(before)).toBe(before);
  });

  test("case 2 — the design brief's `2016.` continuation is left byte-identical", () => {
    const before = [
      "# Clifford GPU theory brief",
      "",
      "the geometric-algebra formulation of that pipeline was published in",
      "2016. The measured consequence is the one that matters here.",
      "",
    ].join("\n");
    expect(fixMarkdownText(before)).toBe(before);
  });

  test("the class, not the two instances: dates, versions and RFC numbers too", () => {
    for (const numeral of ["1970.", "2119.", "14.", "3.", "20260823."]) {
      const before = `Some prose that wraps just before the\n${numeral} And it keeps going.\n`;
      expect(fixMarkdownText(before)).toBe(before);
    }
  });

  test("the AFTER-pass is fixed too — a trailing prose line is not split off either", () => {
    // Without the same guard in insertBlanksAfter, the before-pass suppression
    // is only half a fix: the blank simply moves to the other side of the
    // numeral line and the author's paragraph is still cut in two.
    const before = "chosen as the headline property of an installer in\n2007. It rhymes with:\nand the next clause continues.\n";
    expect(fixMarkdownText(before)).toBe(before);
  });

  test("an empty list item cannot interrupt a paragraph either (§List items)", () => {
    const before = "prose that wraps to\n- \n";
    expect(fixMarkdownText(before)).toBe(before);
  });

  // THE OTHER HALF OF THE FALSIFIER. The easy wrong fix is to stop inserting
  // blank lines at all; these pin that the feature still works.
  test("STILL HEALS: a genuine bullet list after prose gets its blanks", () => {
    expect(fixMarkdownText("Intro line\n- item one\n- item two\nOutro line\n")).toBe(
      "Intro line\n\n- item one\n- item two\n\nOutro line\n",
    );
  });

  test("STILL HEALS: an ordered list starting at 1 DOES interrupt a paragraph", () => {
    expect(fixMarkdownText("Intro line\n1. item one\n2. item two\nOutro line\n")).toBe(
      "Intro line\n\n1. item one\n2. item two\n\nOutro line\n",
    );
  });

  test("STILL HEALS: a list under a heading is surrounded, whatever it starts at", () => {
    // A heading closes its block, so `2007.` after one really is a list start —
    // CommonMark's restriction is about interrupting a PARAGRAPH. The blank
    // arrives via the MD022 pass, and the composed output is unchanged from
    // before this fix.
    expect(fixMarkdownText("## Head\n2007. item\nOutro\n")).toBe(
      "## Head\n\n2007. item\n\nOutro\n",
    );
  });

  test("STILL HEALS: a sibling marker joins an open list (2. under 1. is an item)", () => {
    expect(fixMarkdownText("Intro\n1. one\n2. two\n3. three\nOutro\n")).toBe(
      "Intro\n\n1. one\n2. two\n3. three\n\nOutro\n",
    );
  });

  test("the predicate itself, stated against the spec's own example", () => {
    // CommonMark 0.31.2 §Lists, verbatim example:
    //   The number of windows in my house is
    //   14.  The number of doors is 6.
    // renders as ONE paragraph.
    expect(canInterruptParagraph("14.  The number of doors is 6.")).toBe(false);
    expect(canInterruptParagraph("1.  The number of doors is 6.")).toBe(true);
    expect(canInterruptParagraph("- a bullet")).toBe(true);
    expect(canInterruptParagraph("- ")).toBe(false);
    expect(canInterruptParagraph("1. ")).toBe(false);
    // 1--9 digits is the marker; ten digits is prose (§List items).
    expect(canInterruptParagraph("1234567890. not a marker")).toBe(false);
    expect(canInterruptParagraph("not a list line at all")).toBe(false);
  });

  test("certification (all three laws) still holds with the fix in place", () => {
    expect(certifyMdFixer().pass).toBe(true);
  });
});

// ─── THE GATE, NOT ONLY THE PREDICATE ───────────────────────────────────────
//
// The tests above pin the transform. These pin the WRITE GATE: certification
// is what grants the healer write access on every drift-sweep tick, and it
// granted it to the defective transform. Not because the closure law was
// wrong — `d(heal(t)) ⊆ d(t)` is exactly the right law — but because the
// detector set it quantifies over had no MD029 member, so "no detector saw new
// drift" was true and meaningless. `orderedListPrefixDetector` is that member.
describe("the closure law can now SEE the manufactured list (081M0QZF4QY087G0R000WKDYFZ)", () => {
  const incident = MD_FIXER_FIXTURES.find(
    (f) => f.name === "md029-hard-wrapped-numeral-is-prose-not-a-list",
  );

  test("the incident fixture is in the corpus the gate certifies over", () => {
    expect(incident).toBeDefined();
  });

  test("DISCRIMINATION: the pre-fix behaviour now FAILS the gate on ol-prefix", () => {
    // `resplitterHealer` is the harness's own named reproduction of the naive
    // MD032 fix — insert a blank above every list-shaped line following prose —
    // which is precisely what the production fixer did before this repair.
    // Against the incident fixture it mints the ordered list, and the closure
    // law now catches it.
    //
    // MEASURED, because "it would have caught it" is a claim: with the old
    // four-detector set, `certify(resplitterHealer, OLD, [incidentFixture])`
    // returns pass=TRUE. With `ol-prefix` in the set it returns pass=false
    // with 2 minted findings (docs/books/authored.md, docs/design/brief.md).
    // Over the FULL md corpus the re-splitter fails either way — on
    // `fenced-code-untouchable`, for the unrelated 2026-07-08 code-span
    // reason — so the fixture-scoped verdict above is the honest one to
    // quote, and it is the one this test asserts.
    const verdict = certify(resplitterHealer, REFERENCE_DETECTORS, MD_FIXER_FIXTURES);
    expect(verdict.pass).toBe(false);
    const olClosure = verdict.violations.filter(
      (v) => v.law === "closure" && v.detail.includes("ol-prefix"),
    );
    expect(olClosure.length).toBeGreaterThan(0);
    expect(olClosure.some((v) => v.fixture === "md029-hard-wrapped-numeral-is-prose-not-a-list")).toBe(true);
  });

  test("the DETECTOR is what discriminates, and it is not blind in the other direction", () => {
    // Authored prose: no finding — a hard-wrapped numeral inside a paragraph is
    // not a list, so there is nothing for the healer's output to be compared
    // against unless the healer creates it.
    const authored = tree({
      "docs/a.md": "chosen as the headline property of an installer in\n2007. It rhymes with:\n",
    });
    expect(orderedListPrefixDetector.detect(authored)).toEqual([]);

    // The healer's OLD output: the blank line is what makes it a list, and the
    // finding appears for the first time there.
    const manufactured = tree({
      "docs/a.md": "chosen as the headline property of an installer in\n\n2007. It rhymes with:\n",
    });
    expect(orderedListPrefixDetector.detect(manufactured).map((f) => f.rule)).toEqual(["ol-prefix"]);
  });

  test("the fixed production healer mints nothing the detector can see", () => {
    for (const fixture of MD_FIXER_FIXTURES) {
      const before = orderedListPrefixDetector.detect(fixture.tree);
      const after = orderedListPrefixDetector.detect(mdFixerHealer.heal(fixture.tree));
      expect(after.length).toBeLessThanOrEqual(before.length);
    }
    expect(certifyMdFixer().pass).toBe(true);
  });
});
