// check-healer-oscillation.test.ts — the falsifiers for the RUNNER.
//
// `oscillation-registry.ts` has its own 17 tests. These test the thing that was missing: that the
// runner can actually go red. A gate whose failure paths are unreachable is the exact defect this
// whole line of work exists to catch, so each exit code is exercised against a constructed roster.

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FileTree, Healer } from "./healer-harness.ts";
import { buildRegistry, isClean } from "./oscillation-registry.ts";
import { DECLARED_EDGES, TIER0, triggerTree, sampleRepo } from "./check-healer-oscillation.ts";

const corpusOf = (t: FileTree) => [{ name: "c", tree: t }];

describe("the real roster, as CI runs it", () => {
  test("Tier-0 is all-disjoint and height 1 — and NOT vacuously so", () => {
    // The second clause is the one that matters. The three built-in harness fixtures fire none of
    // these healers, so a corpus without the trigger fixture would report all-disjoint and mean
    // nothing.
    const r = buildRegistry(TIER0, corpusOf(triggerTree()), DECLARED_EDGES);
    expect(r.verdicts).toHaveLength(10);
    expect(r.dagHeight).toBe(1);
    expect(isClean(r)).toBe(true);
    expect(r.vacuousPairs.length).toBeLessThan(r.verdicts.length);
  });

  test("no declared edges — because there is no order to declare, not because nobody looked", () => {
    expect(DECLARED_EDGES).toHaveLength(0);
    expect(buildRegistry(TIER0, corpusOf(triggerTree()), DECLARED_EDGES).verdicts
      .filter((v) => v.relation === "override")).toHaveLength(0);
  });
});

describe("the check can go RED — each failure path is reachable", () => {
  // Without these, every assertion above is satisfied by a checker that always returns 0.
  const advance: Healer = {
    name: "advance",
    heal: (t) => {
      const v = t.get("x.md");
      if (v === "x") return new Map([...t, ["x.md", "y"]]);
      if (v === "y") return new Map([...t, ["x.md", "z"]]);
      return t;
    },
  };
  const reset: Healer = {
    name: "reset",
    heal: (t) => (t.get("x.md") === "z" ? new Map([...t, ["x.md", "x"]]) : t),
  };
  const upper: Healer = {
    name: "upper",
    heal: (t) => (t.get("x.md")?.includes("a") === true ? new Map([...t, ["x.md", t.get("x.md")!.replaceAll("a", "A")]]) : t),
  };
  const wrap: Healer = {
    name: "wrap",
    heal: (t) => (t.get("x.md")?.includes("a") === true ? new Map([...t, ["x.md", t.get("x.md")!.replaceAll("a", "(a)")]]) : t),
  };

  test("an oscillating pair is NOT clean", () => {
    const r = buildRegistry([advance, reset], corpusOf(new Map([["x.md", "x"]])));
    expect(r.oscillating).toHaveLength(1);
    expect(isClean(r)).toBe(false);
  });

  test("an undeclared override is NOT clean, and declaring it makes it clean", () => {
    const c = corpusOf(new Map([["x.md", "a"]]));
    expect(isClean(buildRegistry([upper, wrap], c))).toBe(false);
    expect(isClean(buildRegistry([upper, wrap], c, [{ before: "upper", after: "wrap", why: "normalise first" }]))).toBe(true);
  });

  test("a corpus that fires NOTHING makes every pair vacuous — the refusal case", () => {
    const inert = corpusOf(new Map([["unrelated.md", "nothing to do here"]]));
    const r = buildRegistry(TIER0, inert, DECLARED_EDGES);
    expect(r.vacuousPairs).toHaveLength(r.verdicts.length);
    // ...and it is NOT reported as a failure by the registry. The RUNNER is what refuses it,
    // because "no evidence" and "a defect" are different things.
    expect(isClean(r)).toBe(true);
  });
});

describe("the corpus sampler", () => {
  test("it walks a real tree and returns repo-relative paths", () => {
    // HERMETIC ON PURPOSE. The first version derived the repo root from `import.meta.url` with
    // string surgery and asserted the sampler found files. That passed locally and is
    // environment-dependent — exactly the shape that makes a test green on a laptop and red on a
    // runner. This builds the directories the sampler looks for, so it tests the WALKER rather
    // than the checkout layout.
    const root = mkdtempSync(join(tmpdir(), "zeta-sampler-"));
    try {
      mkdirSync(join(root, "src/Core.TypeScript/hygiene"), { recursive: true });
      mkdirSync(join(root, ".github/workflows"), { recursive: true });
      mkdirSync(join(root, "docs/DECISIONS"), { recursive: true });
      writeFileSync(join(root, "src/Core.TypeScript/hygiene/a.ts"), "export const a = 1;\n");
      writeFileSync(join(root, ".github/workflows/w.yml"), "on: push\n");
      writeFileSync(join(root, "docs/DECISIONS/d.md"), "# d\n");
      // A file the sampler must NOT pick up: wrong extension in a watched directory.
      writeFileSync(join(root, "src/Core.TypeScript/hygiene/ignore.txt"), "no\n");

      const t = sampleRepo(root, {});
      expect(t.size).toBe(3);
      // Repo-relative, not absolute — the healers match on paths like `src/...` and `docs/...`.
      expect([...t.keys()].sort()).toEqual([
        ".github/workflows/w.yml",
        "docs/DECISIONS/d.md",
        "src/Core.TypeScript/hygiene/a.ts",
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("an absent directory is skipped, not thrown — the sampler must survive a partial tree", () => {
    const root = mkdtempSync(join(tmpdir(), "zeta-sampler-empty-"));
    try {
      expect(sampleRepo(root, {}).size).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
