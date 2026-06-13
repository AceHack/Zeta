import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  auditRowFiles,
  extractId,
  findDuplicates,
} from "./audit-duplicate-row-ids.ts";

let TEST_DIR: string;

beforeEach(() => {
  TEST_DIR = mkdtempSync(join(tmpdir(), "zeta-dup-id-audit-test-"));
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

function makeRow(filename: string, frontmatter: string, body = "row body"): string {
  const path = join(TEST_DIR, filename);
  mkdirSync(join(TEST_DIR, "P1"), { recursive: true });
  mkdirSync(join(TEST_DIR, "P2"), { recursive: true });
  writeFileSync(path, `---\n${frontmatter}\n---\n\n${body}\n`);
  return path;
}

describe("extractId", () => {
  test("extracts ID from well-formed frontmatter", () => {
    const content = `---
id: B-0100
priority: P1
status: open
---

# B-0100 — Example`;
    expect(extractId(content)).toBe("B-0100");
  });

  test("handles sub-row IDs like B-0055.1", () => {
    const content = `---
id: B-0055.1
status: open
---`;
    expect(extractId(content)).toBe("B-0055.1");
  });

  test("returns undefined when frontmatter missing", () => {
    expect(extractId("no frontmatter here")).toBeUndefined();
  });

  test("returns undefined when id field missing", () => {
    const content = `---
priority: P1
status: open
---`;
    expect(extractId(content)).toBeUndefined();
  });

  test("CRLF line endings handled", () => {
    const content = "---\r\nid: B-0200\r\npriority: P2\r\n---\r\n";
    expect(extractId(content)).toBe("B-0200");
  });
});

describe("findDuplicates", () => {
  test("returns empty array when no IDs duplicated", () => {
    const m = new Map<string, string[]>();
    m.set("B-0100", ["a.md"]);
    m.set("B-0101", ["b.md"]);
    expect(findDuplicates(m)).toEqual([]);
  });

  test("groups duplicates with sorted file lists", () => {
    const m = new Map<string, string[]>();
    m.set("B-0100", ["zzz.md", "aaa.md"]);
    m.set("B-0101", ["unique.md"]);
    m.set("B-0200", ["c.md", "b.md", "a.md"]);
    const dups = findDuplicates(m);
    expect(dups).toHaveLength(2);
    expect(dups[0]).toEqual({ id: "B-0100", files: ["aaa.md", "zzz.md"] });
    expect(dups[1]).toEqual({ id: "B-0200", files: ["a.md", "b.md", "c.md"] });
  });

  test("output sorted by ID for determinism", () => {
    const m = new Map<string, string[]>();
    m.set("B-0500", ["x.md", "y.md"]);
    m.set("B-0100", ["a.md", "b.md"]);
    m.set("B-0300", ["m.md", "n.md"]);
    const dups = findDuplicates(m);
    expect(dups.map((d) => d.id)).toEqual(["B-0100", "B-0300", "B-0500"]);
  });
});

describe("auditRowFiles", () => {
  test("clean substrate returns no duplicates", () => {
    const files = [
      makeRow("P1/B-0100-foo.md", "id: B-0100\npriority: P1\nstatus: open"),
      makeRow("P1/B-0101-bar.md", "id: B-0101\npriority: P1\nstatus: open"),
      makeRow("P2/B-0200-baz.md", "id: B-0200\npriority: P2\nstatus: open"),
    ];
    const result = auditRowFiles(files);
    expect(result.duplicates).toEqual([]);
    expect(result.rowsWithId).toBe(3);
  });

  test("flags simple duplicate-ID pair", () => {
    const files = [
      makeRow("P1/B-0100-first.md", "id: B-0100\npriority: P1\nstatus: open"),
      makeRow("P2/B-0100-second.md", "id: B-0100\npriority: P2\nstatus: open"),
    ];
    const result = auditRowFiles(files);
    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0]?.id).toBe("B-0100");
    expect(result.duplicates[0]?.files).toHaveLength(2);
  });

  test("flags triple-collision (B-0409 real-world pattern)", () => {
    const files = [
      makeRow("P1/B-0409-a.md", "id: B-0409\npriority: P1\nstatus: open"),
      makeRow("P2/B-0409-b.md", "id: B-0409\npriority: P2\nstatus: open"),
      makeRow("P2/B-0409-c.md", "id: B-0409\npriority: P2\nstatus: open"),
    ];
    const result = auditRowFiles(files);
    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0]?.files).toHaveLength(3);
  });

  test("rows without id field are skipped, not crashed", () => {
    const files = [
      makeRow("P1/B-0100.md", "id: B-0100\npriority: P1\nstatus: open"),
      makeRow("P1/no-id.md", "priority: P1\nstatus: open"),
      makeRow("P2/B-0100-dup.md", "id: B-0100\npriority: P2\nstatus: open"),
    ];
    const result = auditRowFiles(files);
    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0]?.id).toBe("B-0100");
    expect(result.rowsWithId).toBe(2);
  });

  test("sub-row IDs participate in collision detection", () => {
    const files = [
      makeRow("P2/B-0090.1-a.md", "id: B-0090.1\npriority: P2\nstatus: open"),
      makeRow("P2/B-0090.1-b.md", "id: B-0090.1\npriority: P2\nstatus: open"),
    ];
    const result = auditRowFiles(files);
    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0]?.id).toBe("B-0090.1");
  });

  test("unreadable files surface as readErrors (Codex P2: don't silently skip)", () => {
    const missing = "/nonexistent/path/that/does/not/exist.md";
    const files = [
      makeRow("P1/B-0100.md", "id: B-0100\npriority: P1\nstatus: open"),
      missing,
    ];
    const result = auditRowFiles(files);
    expect(result.duplicates).toEqual([]);
    expect(result.rowsWithId).toBe(1);
    expect(result.readErrors).toHaveLength(1);
    expect(result.readErrors[0]?.file).toBe(missing);
    expect(result.readErrors[0]?.reason.length).toBeGreaterThan(0);
  });

  test("readErrors is empty when all files readable", () => {
    const files = [
      makeRow("P1/B-0100.md", "id: B-0100\npriority: P1\nstatus: open"),
      makeRow("P1/B-0101.md", "id: B-0101\npriority: P1\nstatus: open"),
    ];
    const result = auditRowFiles(files);
    expect(result.readErrors).toEqual([]);
  });
});
