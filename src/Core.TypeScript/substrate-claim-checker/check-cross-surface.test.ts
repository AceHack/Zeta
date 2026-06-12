import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseFrontmatter,
  extractClaims,
  checkFile,
} from "./check-cross-surface.ts";

// ── parseFrontmatter ──────────────────────────────────────────────────────────

describe("parseFrontmatter", () => {
  test("returns null for files without frontmatter", () => {
    expect(parseFrontmatter("# Just a header\n\nSome text.")).toBeNull();
  });

  test("returns null when closing --- is missing", () => {
    expect(parseFrontmatter("---\nname: foo\n")).toBeNull();
  });

  test("parses well-formed frontmatter", () => {
    const content = "---\nname: test\ndescription: 20 drift instances catalogued\ntype: feedback\n---\n\n# Body";
    const fm = parseFrontmatter(content);
    expect(fm).not.toBeNull();
    expect(fm!.fields["name"]).toBe("test");
    expect(fm!.fields["description"]).toBe("20 drift instances catalogued");
    expect(fm!.fields["type"]).toBe("feedback");
  });

  test("strips surrounding quotes from field values", () => {
    const content = "---\ndescription: \"quoted value\"\n---\n# Body";
    const fm = parseFrontmatter(content);
    expect(fm!.fields["description"]).toBe("quoted value");
  });

  test("bodyStart points past the closing ---", () => {
    const content = "---\nname: test\n---\nbody line";
    const fm = parseFrontmatter(content);
    // bodyStart lands on the "\n" that follows the closing "---"; splitting
    // on "\n" produces an empty first element then the actual body lines
    expect(content.slice(fm!.bodyStart).trimStart()).toBe("body line");
  });
});

// ── extractClaims ─────────────────────────────────────────────────────────────

describe("extractClaims", () => {
  test("finds 'N drift instances' claim", () => {
    const claims = extractClaims("caught 20 drift instances this session");
    expect(claims).toHaveLength(1);
    expect(claims[0]!.n).toBe(20);
    expect(claims[0]!.isMinimum).toBe(false);
    expect(claims[0]!.noun).toBe("drift instances");
  });

  test("finds 'N+ drift instances' minimum claim", () => {
    const claims = extractClaims("caught 18+ drift instances across 9+ PRs");
    expect(claims.some((c) => c.n === 18 && c.isMinimum && c.noun === "drift instances")).toBe(true);
  });

  test("finds hyphenated form '20-row table'", () => {
    const claims = extractClaims("the 20-row table is the eval set");
    expect(claims).toHaveLength(1);
    expect(claims[0]!.n).toBe(20);
    expect(claims[0]!.noun).toBe("row");
  });

  test("finds 'N rows' claim", () => {
    const claims = extractClaims("catalogues 15 rows of evidence");
    expect(claims[0]!.n).toBe(15);
    expect(claims[0]!.noun).toBe("rows");
  });

  test("returns empty for strings with no count claims", () => {
    expect(extractClaims("no numbers here")).toHaveLength(0);
  });

  test("ignores count claims for unknown nouns", () => {
    expect(extractClaims("runs 5 tests, covers 3 files")).toHaveLength(0);
  });
});

// ── checkFile — helper ────────────────────────────────────────────────────────

function withTmpFile(content: string, cb: (path: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "check-cross-surface-"));
  const path = join(dir, "test.md");
  try {
    writeFileSync(path, content);
    cb(path);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── checkFile — clean cases ───────────────────────────────────────────────────

describe("checkFile — clean", () => {
  test("no drift when frontmatter count matches body table row count", () => {
    withTmpFile(
      [
        "---",
        "name: test",
        "description: caught 3 drift instances this session",
        "type: feedback",
        "---",
        "",
        "| A | B |",
        "| --- | --- |",
        "| r1 | v1 |",
        "| r2 | v2 |",
        "| r3 | v3 |",
      ].join("\n"),
      (path) => {
        const { findings, ok } = checkFile(path);
        expect(ok).toBe(true);
        expect(findings).toHaveLength(0);
      },
    );
  });

  test("no drift when frontmatter minimum claim is satisfied", () => {
    // "9+ drift instances" and body has 15 rows — satisfies >=9
    withTmpFile(
      [
        "---",
        "name: test",
        "description: 9+ drift instances catalogued",
        "type: feedback",
        "---",
        "",
        "| A | B |",
        "| --- | --- |",
        "| 1 | a |",
        "| 2 | b |",
        "| 3 | c |",
        "| 4 | d |",
        "| 5 | e |",
        "| 6 | f |",
        "| 7 | g |",
        "| 8 | h |",
        "| 9 | i |",
        "| 10 | j |",
        "| 11 | k |",
        "| 12 | l |",
        "| 13 | m |",
        "| 14 | n |",
        "| 15 | o |",
      ].join("\n"),
      (path) => {
        const { findings } = checkFile(path);
        expect(findings).toHaveLength(0);
      },
    );
  });

  test("no drift when description has no count claims", () => {
    withTmpFile(
      [
        "---",
        "name: test",
        "description: a self-grading memo about failures",
        "type: feedback",
        "---",
        "",
        "# Body",
        "",
        "| A | B |",
        "| --- | --- |",
        "| 1 | x |",
      ].join("\n"),
      (path) => {
        const { findings } = checkFile(path);
        expect(findings).toHaveLength(0);
      },
    );
  });

  test("no drift for file with no frontmatter", () => {
    withTmpFile("# Just a header\n\nSome text.", (path) => {
      const { findings } = checkFile(path);
      expect(findings).toHaveLength(0);
    });
  });

  test("no drift when body has multiple tables and one matches", () => {
    // frontmatter says "3 drift instances"; body has a 2-row sub-classes
    // table AND a 3-row drift-instances table — any-table semantics → no drift
    withTmpFile(
      [
        "---",
        "name: test",
        "description: caught 3 drift instances",
        "type: feedback",
        "---",
        "",
        "## Sub-classes",
        "",
        "| Sub-class | Done |",
        "| --- | --- |",
        "| count | yes |",
        "| existence | yes |",
        "",
        "## Instances",
        "",
        "| # | Description |",
        "| --- | --- |",
        "| 1 | foo |",
        "| 2 | bar |",
        "| 3 | baz |",
      ].join("\n"),
      (path) => {
        const { findings } = checkFile(path);
        expect(findings).toHaveLength(0);
      },
    );
  });

  test("no drift for frontmatter with no body tables", () => {
    // Cannot check claims without tables — treat as clean (not a drift finding)
    withTmpFile(
      [
        "---",
        "name: test",
        "description: caught 5 drift instances",
        "type: feedback",
        "---",
        "",
        "No tables here, just prose.",
      ].join("\n"),
      (path) => {
        const { findings } = checkFile(path);
        expect(findings).toHaveLength(0);
      },
    );
  });
});

// ── checkFile — drift cases ───────────────────────────────────────────────────

describe("checkFile — drift", () => {
  test("instance #19 regression: description says '9 drift instances', body has 15 rows", () => {
    const rows = Array.from(
      { length: 15 },
      (_, i) => `| ${i + 1} | instance ${i + 1} |`,
    );
    withTmpFile(
      [
        "---",
        "name: verify-then-claim",
        "description: caught 9 drift instances across 9+ PRs",
        "type: feedback",
        "---",
        "",
        "| # | Description |",
        "| --- | --- |",
        ...rows,
      ].join("\n"),
      (path) => {
        const { findings, ok } = checkFile(path);
        expect(ok).toBe(true);
        expect(findings).toHaveLength(1);
        expect(findings[0]!.claimedCount).toBe(9);
        expect(findings[0]!.claimIsMinimum).toBe(false);
        expect(findings[0]!.actualCounts).toContain(15);
        expect(findings[0]!.field).toBe("description");
      },
    );
  });

  test("instance #20 regression: description says '18+', body has only 15 rows (undercount)", () => {
    const rows = Array.from(
      { length: 15 },
      (_, i) => `| ${i + 1} | instance ${i + 1} |`,
    );
    withTmpFile(
      [
        "---",
        "name: verify-then-claim",
        "description: 18+ drift instances catalogued",
        "type: feedback",
        "---",
        "",
        "| # | Description |",
        "| --- | --- |",
        ...rows,
      ].join("\n"),
      (path) => {
        const { findings, ok } = checkFile(path);
        expect(ok).toBe(true);
        expect(findings).toHaveLength(1);
        expect(findings[0]!.claimedCount).toBe(18);
        expect(findings[0]!.claimIsMinimum).toBe(true);
        expect(findings[0]!.actualCounts).toContain(15);
      },
    );
  });

  test("exact-count claim drift fires when no table matches", () => {
    withTmpFile(
      [
        "---",
        "description: covers 7 sub-classes",
        "type: feedback",
        "---",
        "",
        "| Sub-class | Done |",
        "| --- | --- |",
        "| count | yes |",
        "| existence | yes |",
        "| path-form | yes |",
        // only 3 rows, description claims 7
      ].join("\n"),
      (path) => {
        const { findings } = checkFile(path);
        expect(findings).toHaveLength(1);
        expect(findings[0]!.claimedCount).toBe(7);
        expect(findings[0]!.actualCounts).toContain(3);
      },
    );
  });

  test("multiple count claims in description — each checked independently", () => {
    // description claims "20 drift instances" and "7 sub-classes"
    // body: one table with 20 rows (drift), no table with 7 rows
    const rows = Array.from({ length: 20 }, (_, i) => `| ${i + 1} | d${i + 1} |`);
    withTmpFile(
      [
        "---",
        "description: 20 drift instances across 7 sub-classes",
        "type: feedback",
        "---",
        "",
        "| # | Desc |",
        "| --- | --- |",
        ...rows,
      ].join("\n"),
      (path) => {
        const { findings } = checkFile(path);
        // "20 drift instances" is satisfied; "7 sub-classes" is not
        expect(findings).toHaveLength(1);
        expect(findings[0]!.claimedCount).toBe(7);
      },
    );
  });
});

// ── checkFile — error handling ────────────────────────────────────────────────

describe("checkFile — errors", () => {
  test("returns ok: false for missing file", () => {
    const { ok } = checkFile("/tmp/definitely-does-not-exist-abcxyz.md");
    expect(ok).toBe(false);
  });
});
