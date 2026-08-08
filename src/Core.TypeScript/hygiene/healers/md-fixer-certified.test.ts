import { describe, expect, test } from "bun:test";

import { fixMarkdownText } from "../fix-markdown-md032-md026";
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
