import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "bun:test";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const CYCLE = "tests/cross-verification/experience/fixtures/tree1/subdir1/link_to_parent";

describe("Cursor / rg ignore files keep the fixture cycle out of search", () => {
  test(".cursorignore names the link_to_parent cycle", () => {
    const text = readFileSync(resolve(REPO_ROOT, ".cursorignore"), "utf8");
    expect(text).toContain(CYCLE);
    expect(text).toContain("references/prior-art/");
    expect(text).toContain(".lake/");
    expect(text).toContain("lake-packages/");
  });

  test(".rgignore names the same cycle so terminal rg does not abort", () => {
    const text = readFileSync(resolve(REPO_ROOT, ".rgignore"), "utf8");
    expect(text).toContain(CYCLE);
    expect(text).toContain("references/prior-art/");
  });

  test(".cursorindexingignore excludes archive dumps, not memory or backlog", () => {
    const text = readFileSync(resolve(REPO_ROOT, ".cursorindexingignore"), "utf8");
    const patterns = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));
    expect(patterns).toContain("docs/github/");
    expect(patterns).toContain("docs/history/");
    expect(patterns).toContain("docs/observe-events/");
    expect(patterns).toContain("data/tick-shards/");
    expect(patterns).toContain("references/prior-art/");
    expect(patterns).toContain(".lake/");
    expect(patterns).toContain("lake-packages/");
    expect(patterns).not.toContain("memory/");
    expect(patterns).not.toContain("docs/backlog/");
    expect(patterns).not.toContain("docs/research/");
  });
});
