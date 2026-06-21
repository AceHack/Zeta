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
id: 081KQB8J40008QG0R0023DKTFJ
priority: P1
status: open
---

# 081KQB8J40008QG0R0023DKTFJ — Example`;
    expect(extractId(content)).toBe("081KQB8J40008QG0R0023DKTFJ");
  });

  test("handles sub-row IDs like 081KR7JY10008QG0R0035HP11K", () => {
    const content = `---
id: 081KR7JY10008QG0R0035HP11K
status: open
---`;
    expect(extractId(content)).toBe("081KR7JY10008QG0R0035HP11K");
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
    const content = "---\r\nid: 081KQTPYE0008QG0R0009F20NN\r\npriority: P2\r\n---\r\n";
    expect(extractId(content)).toBe("081KQTPYE0008QG0R0009F20NN");
  });
});

describe("findDuplicates", () => {
  test("returns empty array when no IDs duplicated", () => {
    const m = new Map<string, string[]>();
    m.set("081KQB8J40008QG0R0023DKTFJ", ["a.md"]);
    m.set("081KQB8J40008QG0R002DNCSKR", ["b.md"]);
    expect(findDuplicates(m)).toEqual([]);
  });

  test("groups duplicates with sorted file lists", () => {
    const m = new Map<string, string[]>();
    m.set("081KQB8J40008QG0R0023DKTFJ", ["zzz.md", "aaa.md"]);
    m.set("081KQB8J40008QG0R002DNCSKR", ["unique.md"]);
    m.set("081KQTPYE0008QG0R0009F20NN", ["c.md", "b.md", "a.md"]);
    const dups = findDuplicates(m);
    expect(dups).toHaveLength(2);
    expect(dups[0]).toEqual({ id: "081KQB8J40008QG0R0023DKTFJ", files: ["aaa.md", "zzz.md"] });
    expect(dups[1]).toEqual({ id: "081KQTPYE0008QG0R0009F20NN", files: ["a.md", "b.md", "c.md"] });
  });

  test("output sorted by ID for determinism", () => {
    const m = new Map<string, string[]>();
    m.set("081KRHWGX0008QG0R0025PX5SZ", ["x.md", "y.md"]);
    m.set("081KQB8J40008QG0R0023DKTFJ", ["a.md", "b.md"]);
    m.set("081KR2E4K0008QG0R002MFK6AW", ["m.md", "n.md"]);
    const dups = findDuplicates(m);
    expect(dups.map((d) => d.id)).toEqual(["081KQB8J40008QG0R0023DKTFJ", "081KR2E4K0008QG0R002MFK6AW", "081KRHWGX0008QG0R0025PX5SZ"]);
  });
});

describe("auditRowFiles", () => {
  test("clean substrate returns no duplicates", () => {
    const files = [
      makeRow("P1/081KQB8J40008QG0R0023DKTFJ-foo.md", "id: 081KQB8J40008QG0R0023DKTFJ\npriority: P1\nstatus: open"),
      makeRow("P1/081KQB8J40008QG0R002DNCSKR-bar.md", "id: 081KQB8J40008QG0R002DNCSKR\npriority: P1\nstatus: open"),
      makeRow("P2/081KQTPYE0008QG0R0009F20NN-baz.md", "id: 081KQTPYE0008QG0R0009F20NN\npriority: P2\nstatus: open"),
    ];
    const result = auditRowFiles(files);
    expect(result.duplicates).toEqual([]);
    expect(result.rowsWithId).toBe(3);
  });

  test("flags simple duplicate-ID pair", () => {
    const files = [
      makeRow("P1/081KQB8J40008QG0R0023DKTFJ-first.md", "id: 081KQB8J40008QG0R0023DKTFJ\npriority: P1\nstatus: open"),
      makeRow("P2/081KQB8J40008QG0R0023DKTFJ-second.md", "id: 081KQB8J40008QG0R0023DKTFJ\npriority: P2\nstatus: open"),
    ];
    const result = auditRowFiles(files);
    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0]?.id).toBe("081KQB8J40008QG0R0023DKTFJ");
    expect(result.duplicates[0]?.files).toHaveLength(2);
  });

  test("flags triple-collision (081KRA5AR0008QG0R000Y6102S real-world pattern)", () => {
    const files = [
      makeRow("P1/081KRA5AR0008QG0R000Y6102S-a.md", "id: 081KRA5AR0008QG0R000Y6102S\npriority: P1\nstatus: open"),
      makeRow("P2/081KRA5AR0008QG0R000Y6102S-b.md", "id: 081KRA5AR0008QG0R000Y6102S\npriority: P2\nstatus: open"),
      makeRow("P2/081KRA5AR0008QG0R000Y6102S-c.md", "id: 081KRA5AR0008QG0R000Y6102S\npriority: P2\nstatus: open"),
    ];
    const result = auditRowFiles(files);
    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0]?.files).toHaveLength(3);
  });

  test("rows without id field are skipped, not crashed", () => {
    const files = [
      makeRow("P1/081KQB8J40008QG0R0023DKTFJ.md", "id: 081KQB8J40008QG0R0023DKTFJ\npriority: P1\nstatus: open"),
      makeRow("P1/no-id.md", "priority: P1\nstatus: open"),
      makeRow("P2/081KQB8J40008QG0R0023DKTFJ-dup.md", "id: 081KQB8J40008QG0R0023DKTFJ\npriority: P2\nstatus: open"),
    ];
    const result = auditRowFiles(files);
    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0]?.id).toBe("081KQB8J40008QG0R0023DKTFJ");
    expect(result.rowsWithId).toBe(2);
  });

  test("sub-row IDs participate in collision detection", () => {
    const files = [
      makeRow("P2/081KDVJT3E008QG0R003GV8BHV-a.md", "id: 081KDVJT3E008QG0R003GV8BHV\npriority: P2\nstatus: open"),
      makeRow("P2/081KDVJT3E008QG0R003GV8BHV-b.md", "id: 081KDVJT3E008QG0R003GV8BHV\npriority: P2\nstatus: open"),
    ];
    const result = auditRowFiles(files);
    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0]?.id).toBe("081KDVJT3E008QG0R003GV8BHV");
  });

  test("unreadable files surface as readErrors (Codex P2: don't silently skip)", () => {
    const missing = "/nonexistent/path/that/does/not/exist.md";
    const files = [
      makeRow("P1/081KQB8J40008QG0R0023DKTFJ.md", "id: 081KQB8J40008QG0R0023DKTFJ\npriority: P1\nstatus: open"),
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
      makeRow("P1/081KQB8J40008QG0R0023DKTFJ.md", "id: 081KQB8J40008QG0R0023DKTFJ\npriority: P1\nstatus: open"),
      makeRow("P1/081KQB8J40008QG0R002DNCSKR.md", "id: 081KQB8J40008QG0R002DNCSKR\npriority: P1\nstatus: open"),
    ];
    const result = auditRowFiles(files);
    expect(result.readErrors).toEqual([]);
  });
});
