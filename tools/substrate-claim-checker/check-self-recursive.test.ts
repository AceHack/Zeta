/**
 * Unit tests for substrate-claim-checker / check-self-recursive.ts.
 *
 * Run with `bun test tools/substrate-claim-checker/check-self-recursive.test.ts`.
 *
 * Covers:
 *   - parseDirective: bare token, array form, unknown topics, quotes
 *   - checkFile: no frontmatter, no directive, drift case, clean case,
 *     missing file, array directive dispatch
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { checkFile, parseDirective } from "./check-self-recursive.ts";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "self-recursive-test-"));
}

function write(dir: string, name: string, content: string): string {
  const p = join(dir, name);
  writeFileSync(p, content);
  return p;
}

describe("parseDirective", () => {
  let origErr: typeof console.error;

  beforeEach(() => {
    // Suppress unsupported-topic warnings during these tests.
    origErr = console.error;
    console.error = () => {};
  });

  afterEach(() => {
    console.error = origErr;
  });

  test("parses bare topic", () => {
    expect(parseDirective("count")).toEqual(["count"]);
  });

  test("parses single-element array", () => {
    expect(parseDirective("[count]")).toEqual(["count"]);
  });

  test("parses array preserving order and duplicates", () => {
    expect(parseDirective("[count, count]")).toEqual(["count", "count"]);
  });

  test("drops unknown topics", () => {
    expect(parseDirective("[count, future-topic]")).toEqual(["count"]);
  });

  test("handles empty / whitespace directive", () => {
    expect(parseDirective("")).toEqual([]);
    expect(parseDirective("   ")).toEqual([]);
    expect(parseDirective("[]")).toEqual([]);
  });

  test("strips surrounding quotes around each token", () => {
    expect(parseDirective(`"count"`)).toEqual(["count"]);
    expect(parseDirective(`["count"]`)).toEqual(["count"]);
  });

  test("strips YAML inline comments from bare-token directive", () => {
    // Regression for the false-negative where `self-check: count # note`
    // was parsed as topic `count # note` and silently no-op'd.
    expect(parseDirective("count # enable for this memo")).toEqual(["count"]);
    expect(parseDirective("count   #trailing")).toEqual(["count"]);
  });

  test("strips YAML inline comments after array form", () => {
    expect(parseDirective("[count] # outer note")).toEqual(["count"]);
    expect(parseDirective("[count, count] #dup-with-note")).toEqual([
      "count",
      "count",
    ]);
  });

  test("preserves `#` inside a quoted token (no preceding whitespace)", () => {
    // `#` not preceded by whitespace is not a comment marker in YAML.
    // After quote-strip the literal "count#x" is rejected as unknown topic,
    // which is the substrate-honest outcome (we don't invent a new topic).
    expect(parseDirective("count#x")).toEqual([]);
  });
});

describe("checkFile", () => {
  test("no frontmatter -> no findings", () => {
    const dir = tmp();
    try {
      const f = write(dir, "no-fm.md", "# No frontmatter\n\nbody\n");
      const result = checkFile(f);
      expect(result.ok).toBe(true);
      expect(result.findings).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("frontmatter without self-check -> no findings", () => {
    const dir = tmp();
    try {
      const body =
        "---\ntitle: a memo\n---\n\n# Body\n\nClaims 5 rows below.\n\n| a | b |\n|---|---|\n| 1 | 2 |\n";
      const f = write(dir, "no-directive.md", body);
      const result = checkFile(f);
      expect(result.ok).toBe(true);
      expect(result.findings).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("detects self-recursive count drift (claim 5 vs actual 2)", () => {
    const dir = tmp();
    try {
      const content = `---
self-check: count
---

# Count-drift memo

The taxonomy below covers 5 sub-classes.

| name | what |
|---|---|
| one | a |
| two | b |
`;
      const f = write(dir, "self-recursive.md", content);
      const result = checkFile(f);
      expect(result.ok).toBe(true);
      expect(result.findings.length).toBeGreaterThan(0);
      expect(result.findings[0]!.topic).toBe("count");
      expect(result.findings[0]!.reason).toContain("5");
      expect(result.findings[0]!.reason).toContain("2");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("clean self-check file passes (claim 2 vs actual 2)", () => {
    const dir = tmp();
    try {
      const content = `---
self-check: count
---

# Clean memo

The taxonomy below covers 2 sub-classes.

| name | what |
|---|---|
| one | a |
| two | b |
`;
      const f = write(dir, "clean.md", content);
      const result = checkFile(f);
      expect(result.ok).toBe(true);
      expect(result.findings).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("array directive dispatches to count checker", () => {
    const dir = tmp();
    try {
      const content = `---
self-check: [count]
---

# Memo

Body has 10 rows.

| a | b |
|---|---|
| 1 | 2 |
`;
      const f = write(dir, "array.md", content);
      const result = checkFile(f);
      expect(result.ok).toBe(true);
      expect(result.findings.length).toBeGreaterThan(0);
      expect(result.findings[0]!.topic).toBe("count");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("unknown-only directive treated as no-op", () => {
    const dir = tmp();
    const origErr = console.error;
    console.error = () => {};
    try {
      const content = `---
self-check: future-topic
---

# Body

Claims 99 rows.

| a |
|---|
| 1 |
`;
      const f = write(dir, "unknown.md", content);
      const result = checkFile(f);
      expect(result.ok).toBe(true);
      expect(result.findings).toEqual([]);
    } finally {
      console.error = origErr;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("missing file returns ok:false", () => {
    const origErr = console.error;
    console.error = () => {};
    try {
      const result = checkFile("/nonexistent/path/file.md");
      expect(result.ok).toBe(false);
      expect(result.findings).toEqual([]);
    } finally {
      console.error = origErr;
    }
  });

  test("directory path returns ok:false", () => {
    const dir = tmp();
    const origErr = console.error;
    console.error = () => {};
    try {
      const result = checkFile(dir);
      expect(result.ok).toBe(false);
    } finally {
      console.error = origErr;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("dispatches a repeated topic only once (no finding amplification)", () => {
    const dir = tmp();
    try {
      const content = `---
self-check: [count, count]
---

# Body claims 5 sub-classes.

| a | b |
|---|---|
| 1 | 2 |
`;
      const f = write(dir, "dupe-dispatch.md", content);
      const result = checkFile(f);
      expect(result.ok).toBe(true);
      // Without the dispatch-level dedup, the count checker would
      // fire twice and emit each drift finding twice.
      expect(result.findings.length).toBe(1);
      expect(result.findings[0]!.topic).toBe("count");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
