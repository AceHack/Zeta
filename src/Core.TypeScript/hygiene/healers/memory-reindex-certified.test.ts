import { describe, expect, test } from "bun:test";

import {
  certifyMemoryReindex,
  collectFromTree,
  MEMORY_FIXTURES,
  memoryIndexRealDetector,
  memoryReindexHealer,
} from "./memory-reindex-certified";

// Gyroscope axis 3 — the second named subject of the healer workitem.
// The staleness detector derives from the generator (gen(gen) == gen), so
// heal-then-detect is clean by construction; the laws + independent
// detectors are what certification actually earns.

describe("certification — the write gate's verdict", () => {
  test("reindexer passes idempotence + closure + convergence over real-shaped fixtures", () => {
    const v = certifyMemoryReindex();
    expect(v.violations).toEqual([]);
    expect(v.pass).toBe(true);
  });
});

describe("gen(gen) == gen — regeneration is the correction", () => {
  const stale = MEMORY_FIXTURES[0]!.tree;

  test("stale index detected, healed index clean, heal is byte-idempotent", () => {
    expect(memoryIndexRealDetector.detect(stale)).toHaveLength(1);
    const once = memoryReindexHealer.heal(stale);
    expect(memoryIndexRealDetector.detect(once)).toHaveLength(0);
    const twice = memoryReindexHealer.heal(once);
    expect(twice.get("memory/MEMORY.md")).toBe(once.get("memory/MEMORY.md"));
  });

  test("AutoDream marker is preserved from the existing index", () => {
    const healed = memoryReindexHealer.heal(stale);
    expect(healed.get("memory/MEMORY.md")!.startsWith("[AutoDream last run: 2026-04-23]")).toBe(true);
  });

  test("collection walk: date-desc then filename-asc; CURRENT-*/README/MEMORY excluded; frontmatter required", () => {
    const entries = collectFromTree(stale);
    expect(entries.map((e) => e.fm.name)).toEqual(["beta", "alpha"]);
    const withNoise = new Map(stale);
    withNoise.set("memory/CURRENT-otto.md", "---\nname: c\n---\nx");
    withNoise.set("memory/README.md", "readme");
    withNoise.set("memory/no-frontmatter.md", "plain");
    expect(collectFromTree(withNoise)).toHaveLength(2);
  });

  test("a tree without memory/ is untouched (closure begins at the boundary)", () => {
    const t = MEMORY_FIXTURES[1]!.tree;
    const healed = memoryReindexHealer.heal(t);
    expect([...healed.entries()]).toEqual([...t.entries()]);
    expect(memoryIndexRealDetector.detect(t)).toEqual([]);
  });
});
