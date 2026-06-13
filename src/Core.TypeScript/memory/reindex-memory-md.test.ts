import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  collectEntries,
  MAX_STACK_ENTRIES,
  parseFrontmatter,
  PREAMBLE_END,
  PREAMBLE_MARKER,
  renderIndex,
} from "./reindex-memory-md.ts";

const TESTDATA = join(import.meta.dir, "testdata");

describe("parseFrontmatter", () => {
  test("parses simple key: value frontmatter", () => {
    const content = `---
name: hello
description: world
type: feedback
created: 2026-05-12
---

body`;
    const fm = parseFrontmatter(content);
    expect(fm).not.toBeNull();
    expect(fm?.name).toBe("hello");
    expect(fm?.description).toBe("world");
    expect(fm?.type).toBe("feedback");
    expect(fm?.created).toBe("2026-05-12");
  });

  test("parses folded scalar (description: >-)", () => {
    const content = `---
name: example
description: >-
  This is a folded
  scalar value
  spanning multiple lines
type: feedback
---

body`;
    const fm = parseFrontmatter(content);
    expect(fm?.description).toBe("This is a folded scalar value spanning multiple lines");
  });

  test("returns null for content without frontmatter", () => {
    expect(parseFrontmatter("no frontmatter here")).toBeNull();
  });

  test("strips quotes from string values", () => {
    const content = `---
name: "quoted name"
description: 'single-quoted desc'
---
body`;
    const fm = parseFrontmatter(content);
    expect(fm?.name).toBe("quoted name");
    expect(fm?.description).toBe("single-quoted desc");
  });
});

describe("collectEntries", () => {
  test("collects files with valid frontmatter", async () => {
    const entries = await collectEntries(TESTDATA);
    const names = entries.map((e) => e.fm.name);
    expect(names).toContain("alpha-entry");
    expect(names).toContain("beta-entry");
  });

  test("excludes MEMORY.md and README.md", async () => {
    const entries = await collectEntries(TESTDATA);
    const filenames = entries.map((e) => e.filename);
    expect(filenames).not.toContain("MEMORY.md");
    expect(filenames).not.toContain("README.md");
  });

  test("excludes CURRENT-* files", async () => {
    const entries = await collectEntries(TESTDATA);
    const filenames = entries.map((e) => e.filename);
    expect(filenames.some((f) => f.startsWith("CURRENT-"))).toBe(false);
  });

  test("excludes files without frontmatter", async () => {
    const entries = await collectEntries(TESTDATA);
    const filenames = entries.map((e) => e.filename);
    expect(filenames).not.toContain("no_frontmatter.md");
  });

  test("sorts newest-first by created date", async () => {
    const entries = await collectEntries(TESTDATA);
    // beta (2026-05-10) is newer than alpha (2026-05-01)
    const betaIdx = entries.findIndex((e) => e.fm.name === "beta-entry");
    const alphaIdx = entries.findIndex((e) => e.fm.name === "alpha-entry");
    expect(betaIdx).toBeGreaterThanOrEqual(0);
    expect(alphaIdx).toBeGreaterThanOrEqual(0);
    expect(betaIdx).toBeLessThan(alphaIdx);
  });

  test("exposes date field from created frontmatter key", async () => {
    const entries = await collectEntries(TESTDATA);
    const alpha = entries.find((e) => e.fm.name === "alpha-entry");
    expect(alpha?.date).toBe("2026-05-01");
  });

  test("scans subdirectories recursively", async () => {
    const entries = await collectEntries(TESTDATA);
    const gamma = entries.find((e) => e.fm.name === "gamma-entry");
    expect(gamma).not.toBeUndefined();
  });

  test("uses subdir-relative path for subdirectory entries", async () => {
    const entries = await collectEntries(TESTDATA);
    const gamma = entries.find((e) => e.fm.name === "gamma-entry");
    expect(gamma?.filename).toBe("subdir/gamma_2026_05_14.md");
  });
});

describe("renderIndex", () => {
  const makeEntry = (name: string, description: string, created: string) => ({
    filename: `${name}.md`,
    fm: { name, description, type: "feedback" as const, created },
    date: created,
    mtime: 0,
  });

  test("includes PREAMBLE_MARKER and PREAMBLE_END delimiters", () => {
    const output = renderIndex([makeEntry("x", "desc", "2026-05-01")]);
    expect(output).toContain(PREAMBLE_MARKER);
    expect(output).toContain(PREAMBLE_END);
    expect(output.indexOf(PREAMBLE_MARKER)).toBeLessThan(output.indexOf(PREAMBLE_END));
  });

  test("includes last reindex date matching today", () => {
    const today = new Date().toISOString().slice(0, 10);
    const output = renderIndex([makeEntry("x", "desc", "2026-05-01")]);
    expect(output).toContain(`Last reindex: ${today}`);
  });

  test("truncates description at 240 characters", () => {
    const longDesc = "a".repeat(300);
    const output = renderIndex([makeEntry("long", longDesc, "2026-05-01")]);
    // Entry line format: - [**long**](long.md) — <desc>
    const match = output.match(/^- \[.*?\]\(long\.md\) — ([^\n]+)/m);
    expect(match).not.toBeNull();
    const rendered = match![1]!;
    expect(rendered.endsWith("…")).toBe(true);
    expect(rendered.length).toBeLessThanOrEqual(240);
  });

  test("renders all entries when count <= MAX_STACK_ENTRIES", () => {
    const entries = Array.from({ length: 5 }, (_, i) =>
      makeEntry(`entry-${i}`, `desc-${i}`, `2026-05-0${i + 1}`),
    );
    const output = renderIndex(entries);
    for (const e of entries) {
      expect(output).toContain(e.fm.name);
    }
    expect(output).not.toContain("Stack truncated");
  });

  test("truncates stack at MAX_STACK_ENTRIES and appends overflow note", () => {
    const entries = Array.from({ length: MAX_STACK_ENTRIES + 5 }, (_, i) =>
      makeEntry(`entry-${i}`, `desc-${i}`, `2026-05-01`),
    );
    const output = renderIndex(entries);
    expect(output).toContain(`Stack truncated at ${MAX_STACK_ENTRIES} most-recent entries`);
    expect(output).toContain("5 additional memory files in heap");
  });

  test("preserves supplied autoDreamMarker verbatim", () => {
    const marker = "[AutoDream last run: 2026-05-13]";
    const output = renderIndex([makeEntry("x", "desc", "2026-05-01")], marker);
    expect(output).toContain(marker);
    expect(output).not.toContain("[AutoDream last run: 2026-04-23]");
  });

  test("falls back to hardcoded marker when autoDreamMarker is omitted", () => {
    const output = renderIndex([makeEntry("x", "desc", "2026-05-01")]);
    expect(output).toContain("[AutoDream last run: 2026-04-23]");
  });

  test("uses filename stem as name when fm.name is absent", () => {
    const entry = {
      filename: "no_name_entry.md",
      fm: { description: "no name" },
      date: "2026-05-01",
      mtime: 0,
    };
    const output = renderIndex([entry]);
    expect(output).toContain("no_name_entry");
  });
});
