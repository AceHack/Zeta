import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  auditSurface,
  findEdgesInFile,
  isDangling,
  runAudit,
} from "./audit-dangling-memory-refs";

function setupFixtureRepo(): { root: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), "audit-dangling-memory-refs-test-"));
  return {
    root,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

describe("findEdgesInFile", () => {
  test("extracts memory/feedback_*.md references from markdown", () => {
    const { root, cleanup } = setupFixtureRepo();
    try {
      const file = join(root, "test.md");
      writeFileSync(
        file,
        "header\n" +
          "see `memory/feedback_one.md` for details\n" +
          "also `memory/feedback_two.md` and `memory/feedback_three.md`\n" +
          "no ref here\n",
        "utf8",
      );
      process.env["REPO_ROOT"] = root;
      const edges = findEdgesInFile(file);
      expect(edges).toHaveLength(3);
      expect(edges[0]?.line).toBe(2);
      expect(edges[0]?.ref).toBe("memory/feedback_one.md");
      expect(edges[1]?.line).toBe(3);
      expect(edges[1]?.ref).toBe("memory/feedback_two.md");
      expect(edges[2]?.line).toBe(3);
      expect(edges[2]?.ref).toBe("memory/feedback_three.md");
    } finally {
      delete process.env["REPO_ROOT"];
      cleanup();
    }
  });

  test("returns empty for file with no memory/feedback_ refs", () => {
    const { root, cleanup } = setupFixtureRepo();
    try {
      const file = join(root, "test.md");
      writeFileSync(file, "# Header\n\nNo refs here.\n", "utf8");
      process.env["REPO_ROOT"] = root;
      expect(findEdgesInFile(file)).toEqual([]);
    } finally {
      delete process.env["REPO_ROOT"];
      cleanup();
    }
  });

  test("matches memory/feedback_*.md anywhere in prose (intentional — dangling check is the filter)", () => {
    // The regex intentionally matches the path shape anywhere in markdown
    // (prose, list items, link targets, code blocks). The dangling check
    // in isDangling() / auditSurface() is the safety net that distinguishes
    // real-but-missing refs from incidental string matches.
    const { root, cleanup } = setupFixtureRepo();
    try {
      const file = join(root, "test.md");
      writeFileSync(file, "see memory/feedback_x.md for context\n", "utf8");
      process.env["REPO_ROOT"] = root;
      const edges = findEdgesInFile(file);
      expect(edges).toHaveLength(1);
      expect(edges[0]?.ref).toBe("memory/feedback_x.md");
    } finally {
      delete process.env["REPO_ROOT"];
      cleanup();
    }
  });
});

describe("isDangling", () => {
  // The lazy `repoRoot()` function reads `REPO_ROOT` on each call, so
  // these tests fully exercise the env-var override path against a
  // tmpdir fixture rather than depending on the real repo layout.

  test("returns true when the file does not exist under REPO_ROOT", () => {
    const { root, cleanup } = setupFixtureRepo();
    try {
      process.env["REPO_ROOT"] = root;
      expect(isDangling("memory/feedback_does-not-exist.md")).toBe(true);
    } finally {
      delete process.env["REPO_ROOT"];
      cleanup();
    }
  });

  test("returns false when the file exists under REPO_ROOT", () => {
    const { root, cleanup } = setupFixtureRepo();
    try {
      // Create the fixture memory file inside the tmpdir and verify the
      // lazy repoRoot() picks it up.
      mkdirSync(join(root, "memory"), { recursive: true });
      writeFileSync(join(root, "memory", "feedback_exists.md"), "x\n", "utf8");
      process.env["REPO_ROOT"] = root;
      expect(isDangling("memory/feedback_exists.md")).toBe(false);
    } finally {
      delete process.env["REPO_ROOT"];
      cleanup();
    }
  });
});

describe("auditSurface", () => {
  test("returns empty report for nonexistent surface (fixture)", () => {
    // Use a tmpdir fixture so the test does NOT depend on the real repo
    // layout (otherwise it would start failing if a real surface ever got
    // a name colliding with the placeholder).
    const { root, cleanup } = setupFixtureRepo();
    try {
      process.env["REPO_ROOT"] = root;
      const r = auditSurface("some/missing/surface");
      expect(r.scanned).toBe(0);
      expect(r.edges).toEqual([]);
      expect(r.uniqueRefs).toBe(0);
      expect(r.uniqueDanglingRefs).toBe(0);
    } finally {
      delete process.env["REPO_ROOT"];
      cleanup();
    }
  });

  test("returns empty edges when scanned files have no memory/feedback_ refs", () => {
    const { root, cleanup } = setupFixtureRepo();
    try {
      mkdirSync(join(root, "clean"), { recursive: true });
      writeFileSync(join(root, "clean", "a.md"), "# header\nno refs\n", "utf8");
      writeFileSync(join(root, "clean", "b.md"), "more prose\n", "utf8");
      process.env["REPO_ROOT"] = root;
      const r = auditSurface("clean");
      expect(r.scanned).toBe(2);
      expect(r.edges).toEqual([]);
      expect(r.uniqueDanglingRefs).toBe(0);
    } finally {
      delete process.env["REPO_ROOT"];
      cleanup();
    }
  });

  test("reports dangling edges when ref target is absent under REPO_ROOT", () => {
    const { root, cleanup } = setupFixtureRepo();
    try {
      mkdirSync(join(root, "surface"), { recursive: true });
      writeFileSync(
        join(root, "surface", "citing.md"),
        "see memory/feedback_missing.md\n",
        "utf8",
      );
      process.env["REPO_ROOT"] = root;
      const r = auditSurface("surface");
      expect(r.scanned).toBe(1);
      expect(r.edges).toHaveLength(1);
      expect(r.edges[0]?.ref).toBe("memory/feedback_missing.md");
      expect(r.uniqueDanglingRefs).toBe(1);
    } finally {
      delete process.env["REPO_ROOT"];
      cleanup();
    }
  });
});

describe("runAudit", () => {
  // Real-tree scans can exceed bun:test's default 5s timeout when crossing
  // multiple substrate surfaces (1000+ files). 30s gives comfortable
  // headroom for CI runners.
  test(
    "aggregates across multiple surfaces",
    () => {
      const out = runAudit([".claude/agents", ".claude/skills"]);
      expect(out.surfaces).toHaveLength(2);
      expect(out.totals.surfacesScanned).toBe(2);
    },
    30000,
  );

  test(
    "produces a totals.danglingEdges field that matches summed surfaces",
    () => {
      const out = runAudit([".claude/agents", ".claude/skills"]);
      const summed = out.surfaces.reduce((acc, s) => acc + s.edges.length, 0);
      expect(out.totals.danglingEdges).toBe(summed);
    },
    30000,
  );
});
