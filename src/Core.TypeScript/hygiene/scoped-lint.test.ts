import { describe, expect, test } from "bun:test";

import {
  classifyLines,
  findingPath,
  normalizePath,
  parseChangedFiles,
  scopedReport,
} from "./scoped-lint";

// Workitem 081KX3KA3ES — a PR reports drift only in files it touches.
// Proofs:
//   1. findingPath recognizes the gate's real linter formats and rejects prose.
//   2. In-scope findings fail (exit 1); out-of-scope findings are informational.
//   3. knownPaths guard: path-shaped prose is passthrough, not out-of-scope.
//   4. All-clean and only-out-of-scope both exit 0 — the priority-inversion fix.

describe("findingPath — real linter formats", () => {
  test.each([
    ["docs/a.md:19 MD022/blanks-around-headings Headings…", "docs/a.md"],
    ["docs/a.md:194:1046 error MD009/no-trailing-spaces", "docs/a.md"],
    ["src/x/y.ts(122,3): error TS2322: Type…", "src/x/y.ts"],
    ["tools/setup/common/a.sh:35:10: note: Not following… [SC1091]", "tools/setup/common/a.sh"],
    ["./src/b.ts:1:1: something", "src/b.ts"],
  ])("extracts from %s", (line, expected) => {
    const p = findingPath(line);
    expect(p === null ? null : normalizePath(p)).toBe(expected);
  });

  test.each([
    "Build succeeded.",
    "  Restored /tmp/x.csproj (in 2.38 sec).",
    "Summary: 150 resources found in 105 files",
    "",
  ])("prose passes through: %s", (line) => {
    // either no path extracted, or (with knownPaths) filtered as passthrough
    const classified = classifyLines([line], new Set(), new Set());
    expect(classified[0]!.kind).toBe("passthrough");
  });
});

describe("parseChangedFiles", () => {
  test("one path per line, normalized, blanks dropped", () => {
    const s = parseChangedFiles("a.md\n./src/b.ts\n\n  \nsrc\\c.ts\n");
    expect([...s].sort()).toEqual(["a.md", "src/b.ts", "src/c.ts"]);
  });
});

describe("scopedReport — the priority-inversion fix", () => {
  const changed = parseChangedFiles("global.json\ndocs/letters/mine.md");
  const known = parseChangedFiles("global.json\ndocs/letters/mine.md\ndocs/other.md\nsrc/theirs.ts");

  test("in-scope finding fails the step", () => {
    const r = scopedReport("docs/letters/mine.md:3 MD022 heading", changed, known);
    expect(r.exitCode).toBe(1);
    expect(r.inScope).toHaveLength(1);
  });

  test("out-of-scope finding is informational — exit 0", () => {
    const r = scopedReport(
      ["docs/other.md:5 MD032 list", "src/theirs.ts(1,1): error TS6133: unused"].join("\n"),
      changed,
      known,
    );
    expect(r.exitCode).toBe(0);
    expect(r.outOfScope).toHaveLength(2);
    expect(r.inScope).toHaveLength(0);
  });

  test("mixed: only the in-scope finding drives the verdict", () => {
    const r = scopedReport(
      ["docs/other.md:5 MD032 list", "docs/letters/mine.md:9 MD009 trailing"].join("\n"),
      changed,
      known,
    );
    expect(r.exitCode).toBe(1);
    expect(r.inScope).toHaveLength(1);
    expect(r.outOfScope).toHaveLength(1);
  });

  test("path-shaped prose outside knownPaths is passthrough, not a finding", () => {
    const r = scopedReport("https://example.com: connection ok", changed, known);
    expect(r.exitCode).toBe(0);
    expect(r.outOfScope).toHaveLength(0);
  });

  test("clean output exits 0 with a zero summary", () => {
    const r = scopedReport("All checks passed.\n", changed, known);
    expect(r.exitCode).toBe(0);
    expect(r.summary).toContain("0 finding(s) in the PR's diff");
  });
});
