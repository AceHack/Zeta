// collect-lint-roster.test.ts — the collector folds an injected roster.
//
// A test that grepped lint-*.ts and counted matches would be a scraper wearing
// a collector's clothes. These tests feed seeds. The five-row fixture is named
// data, not a live tree walk.

import { describe, expect, test } from "bun:test";
import { labelsFor } from "./labelled-observation.ts";
import { present, teaching } from "./correction-zset.ts";
import {
  collectLintRoster,
  TEACHING_LINT_SEEDS,
} from "./collect-lint-roster.ts";
import type { LintFindingSeed } from "./from-lint-finding.ts";

describe("the five teaching seeds are (violation, repair) pairs", () => {
  test("every teaching seed carries a non-empty fix", () => {
    expect(TEACHING_LINT_SEEDS).toHaveLength(5);
    for (const s of TEACHING_LINT_SEEDS) {
      expect((s.fix ?? "").trim().length).toBeGreaterThan(0);
    }
  });

  test("collecting them yields five teaching rows, zero refusals", () => {
    const { log, refused, labelRefused } = collectLintRoster({
      findings: TEACHING_LINT_SEEDS,
      assertedBy: "census-otto-2026-08-27",
      at: 4,
    });
    expect(refused).toEqual([]);
    expect(labelRefused).toEqual([]);
    expect(present(log)).toHaveLength(5);
    expect(teaching(log)).toHaveLength(5);
  });
});

describe("failure-only seeds do not grow a repair", () => {
  const failureOnly: LintFindingSeed = {
    rule: "ascii-clean",
    file: "src/Core.TypeScript/hygiene/lint-ascii-clean.ts",
    signature: "U+200B",
    detail: "invisible codepoint in source",
  };

  test("a roster of one failure-only finding is present and not teaching", () => {
    const { log, refused } = collectLintRoster({
      findings: [failureOnly],
      assertedBy: "lint-ascii-clean",
      at: 0,
    });
    expect(refused).toEqual([]);
    expect(present(log)).toHaveLength(1);
    expect(teaching(log)).toHaveLength(0);
    expect(labelsFor(present(log)[0]!, { namespace: "lint", name: "repair" })).toHaveLength(0);
  });

  test("mixing teaching and failure-only does not copy a fix onto the latter", () => {
    const { log } = collectLintRoster({
      findings: [TEACHING_LINT_SEEDS[0]!, failureOnly],
      assertedBy: "mixed",
      at: 1,
    });
    expect(present(log)).toHaveLength(2);
    expect(teaching(log)).toHaveLength(1);
  });
});

describe("a refused hub does not enter the log", () => {
  test("empty detail is refused, not stored", () => {
    const { log, refused } = collectLintRoster({
      findings: [
        {
          rule: "r",
          file: "a.ts",
          signature: "s",
          detail: "",
        },
      ],
      assertedBy: "t",
      at: 0,
    });
    expect(present(log)).toHaveLength(0);
    expect(refused).toHaveLength(1);
  });
});
