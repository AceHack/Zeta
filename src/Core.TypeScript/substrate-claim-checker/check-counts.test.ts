/**
 * Unit tests for substrate-claim-checker / check-counts.ts.
 *
 * Run with `bun test tools/substrate-claim-checker/check-counts.test.ts`.
 *
 * Covers:
 *   - findTables: skips fenced code blocks; requires `-` in separator;
 *     handles missing rows; CommonMark fence-delimiter length matching
 *   - findClaims: catches plain + hyphenated + minimum-count forms;
 *     skips fenced code blocks + table cells
 *   - checkFile: returns ok:false for missing/dir; emits findings
 *     for narrative-vs-table count drift
 *
 * Focused check (2026-05-09): ran check-counts.ts on B-0170 backlog row;
 * detected expected count-drift on "100 rows" narrative claim (table had 8).
 * Tool correctly surfaced the drift instance that the memo's own doc exhibits.
 */

import { describe, expect, test } from "bun:test";
import { findTables, findClaims, checkFile } from "./check-counts.ts";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "substrate-claim-checker-"));
}

function write(dir: string, name: string, content: string): string {
  const p = join(dir, name);
  writeFileSync(p, content);
  return p;
}

describe("findTables", () => {
  test("counts data rows in a basic table", () => {
    const lines = [
      "before",
      "| a | b |",
      "|---|---|",
      "| 1 | 2 |",
      "| 3 | 4 |",
      "after",
    ];
    const tables = findTables(lines);
    expect(tables).toHaveLength(1);
    expect(tables[0]!.rowCount).toBe(2);
  });

  test("rejects separators without dashes", () => {
    const lines = ["| a | b |", "|   |   |", "| 1 | 2 |"];
    expect(findTables(lines)).toHaveLength(0);
  });

  test("skips tables inside fenced code blocks", () => {
    const lines = [
      "```",
      "| a | b |",
      "|---|---|",
      "| 1 | 2 |",
      "```",
      "| real | table |",
      "|------|-------|",
      "| x | y |",
    ];
    const tables = findTables(lines);
    expect(tables).toHaveLength(1);
    expect(tables[0]!.rowCount).toBe(1);
  });

  test("CommonMark fence-delimiter length: shorter inner backticks don't close longer fence", () => {
    const lines = [
      "````",
      "| a | b |",
      "|---|---|",
      "| 1 | 2 |",
      "```",
      "| 3 | 4 |",
      "````",
      "| real | table |",
      "|------|-------|",
      "| x | y |",
    ];
    const tables = findTables(lines);
    expect(tables).toHaveLength(1);
    expect(tables[0]!.rowCount).toBe(1);
  });

  test("table at end of file (no trailing newline) is counted", () => {
    const lines = ["| a | b |", "|---|---|", "| 1 | 2 |"];
    const tables = findTables(lines);
    expect(tables).toHaveLength(1);
    expect(tables[0]!.rowCount).toBe(1);
  });
});

describe("findClaims", () => {
  test("catches whitespace-separated form", () => {
    const claims = findClaims(["The catalogue has 5 drift instances."]);
    expect(claims).toHaveLength(1);
    expect(claims[0]!.n).toBe(5);
    expect(claims[0]!.isMinimum).toBe(false);
  });

  test("catches hyphenated form", () => {
    const claims = findClaims(["A 13-row table follows."]);
    expect(claims).toHaveLength(1);
    expect(claims[0]!.n).toBe(13);
    expect(claims[0]!.noun).toBe("row");
  });

  test("catches minimum-count form (N+)", () => {
    const claims = findClaims(["20+ drift instances catalogued."]);
    expect(claims).toHaveLength(1);
    expect(claims[0]!.n).toBe(20);
    expect(claims[0]!.isMinimum).toBe(true);
  });

  test("skips claims inside fenced code blocks", () => {
    const lines = [
      "```",
      "// 5 rows in this example",
      "```",
      "narrative claims 7 rows.",
    ];
    const claims = findClaims(lines);
    expect(claims).toHaveLength(1);
    expect(claims[0]!.n).toBe(7);
  });

  test("skips claims that look like table cells", () => {
    const lines = ["| 5 rows | example |", "narrative says 7 items."];
    const claims = findClaims(lines);
    expect(claims).toHaveLength(1);
    expect(claims[0]!.n).toBe(7);
    expect(claims[0]!.noun).toBe("items");
  });
});

describe("checkFile", () => {
  test("returns ok:false for missing file", () => {
    const result = checkFile("/no/such/path/does/not/exist.md");
    expect(result.ok).toBe(false);
    expect(result.findings).toHaveLength(0);
  });

  test("returns ok:false for directory input", () => {
    const dir = tmp();
    try {
      const result = checkFile(dir);
      expect(result.ok).toBe(false);
      expect(result.findings).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("emits drift finding when claim ≠ table row count", () => {
    const dir = tmp();
    try {
      const path = write(
        dir,
        "test.md",
        [
          "Claims 5 drift instances catalogued below.",
          "",
          "| # | desc |",
          "|---|------|",
          "| 1 | a |",
          "| 2 | b |",
          "| 3 | c |",
          "",
        ].join("\n"),
      );
      const result = checkFile(path);
      expect(result.ok).toBe(true);
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0]!.claimedCount).toBe(5);
      expect(result.findings[0]!.actualCount).toBe(3);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("no drift when claim matches table row count", () => {
    const dir = tmp();
    try {
      const path = write(
        dir,
        "test.md",
        [
          "Claims 3 drift instances catalogued below.",
          "",
          "| # | desc |",
          "|---|------|",
          "| 1 | a |",
          "| 2 | b |",
          "| 3 | c |",
          "",
        ].join("\n"),
      );
      const result = checkFile(path);
      expect(result.ok).toBe(true);
      expect(result.findings).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("minimum-count claim allows actual >= claimed", () => {
    const dir = tmp();
    try {
      const path = write(
        dir,
        "test.md",
        [
          "Claims 2+ drift instances catalogued below.",
          "",
          "| # | desc |",
          "|---|------|",
          "| 1 | a |",
          "| 2 | b |",
          "| 3 | c |",
          "",
        ].join("\n"),
      );
      const result = checkFile(path);
      expect(result.ok).toBe(true);
      // 2+ allows 3 — no drift
      expect(result.findings).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("minimum-count claim still fires when actual < claimed", () => {
    const dir = tmp();
    try {
      const path = write(
        dir,
        "test.md",
        [
          "Claims 5+ drift instances catalogued below.",
          "",
          "| # | desc |",
          "|---|------|",
          "| 1 | a |",
          "| 2 | b |",
          "| 3 | c |",
          "",
        ].join("\n"),
      );
      const result = checkFile(path);
      expect(result.ok).toBe(true);
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0]!.claimIsMinimum).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
