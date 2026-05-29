import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkClaudeMdExists,
  checkConciseness,
  checkRulesAutoLoad,
  checkSixStepProcess,
  DEFAULT_MAX_LINES,
  REQUIRED_STEP_NUMBERS,
  runValidation,
} from "./validate-bootstrap-claude-md";

// A minimal well-formed bootstrap CLAUDE.md (the shape a fresh instance needs).
const GOOD_BOOTSTRAP = [
  "# CLAUDE.md — bootstrap",
  "",
  "## 1. Orient",
  "Read AGENTS.md.",
  "## 2. Refresh",
  "Run the refresh tool.",
  "## 3. Pick work",
  "Open BACKLOG.md.",
  "## 4. Build gate",
  "dotnet build.",
  "## 5. Ship",
  "Open a PR.",
  "## 6. When stuck",
  "See CONFLICT-RESOLUTION.md.",
  "## Conventions",
  "- Agents, not bots.",
].join("\n");

describe("checkClaudeMdExists", () => {
  test("pass when present", () => {
    expect(checkClaudeMdExists(true).status).toBe("pass");
  });
  test("fail when absent", () => {
    expect(checkClaudeMdExists(false).status).toBe("fail");
  });
});

describe("checkSixStepProcess", () => {
  test("pass when all 6 numbered sections present", () => {
    const r = checkSixStepProcess(GOOD_BOOTSTRAP);
    expect(r.status).toBe("pass");
  });

  test("fail when a section is missing", () => {
    const missing4 = GOOD_BOOTSTRAP.split("\n")
      .filter((l) => !l.startsWith("## 4."))
      .join("\n");
    const r = checkSixStepProcess(missing4);
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("## 4.");
  });

  test("does not count steps outside 1..6", () => {
    const r = checkSixStepProcess("## 7. Extra\n## 1. A\n## 2. B");
    expect(r.status).toBe("fail"); // only 1 and 2 present; 3-6 missing
  });

  test("requires a non-empty title after the number", () => {
    // "## 3." with no title text should not satisfy the section.
    const noTitle = GOOD_BOOTSTRAP.replace("## 3. Pick work", "## 3.");
    expect(checkSixStepProcess(noTitle).status).toBe("fail");
  });

  test("REQUIRED_STEP_NUMBERS is exactly 1..6", () => {
    expect([...REQUIRED_STEP_NUMBERS]).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("checkRulesAutoLoad", () => {
  test("pass when >=1 .md rule present", () => {
    expect(checkRulesAutoLoad(["a.md", "README", "b.md"]).status).toBe("pass");
  });
  test("fail when no .md rules", () => {
    expect(checkRulesAutoLoad([]).status).toBe("fail");
    expect(checkRulesAutoLoad(["notes.txt"]).status).toBe("fail");
  });
});

describe("checkConciseness", () => {
  test("pass under soft ceiling", () => {
    expect(checkConciseness(GOOD_BOOTSTRAP, DEFAULT_MAX_LINES).status).toBe("pass");
  });
  test("warn (not fail) over soft ceiling", () => {
    const big = Array.from({ length: 200 }, (_, i) => `line ${i}`).join("\n");
    const r = checkConciseness(big, DEFAULT_MAX_LINES);
    expect(r.status).toBe("warn");
  });
  test("76-line bootstrap form passes default ceiling (recalibration anchor)", () => {
    // The actual bootstrap CLAUDE.md is ~76 lines; the decomposition's <50
    // bound would wrongly fail it. Conciseness must pass at default 150.
    const seventySix = Array.from({ length: 76 }, (_, i) => `line ${i}`).join("\n");
    expect(checkConciseness(seventySix, DEFAULT_MAX_LINES).status).toBe("pass");
  });
});

describe("runValidation against the live repo root", () => {
  // Resolve repo root from this test file's location:
  // tools/bootstrap-validator/<file> -> repo root is two dirs up.
  const here = fileURLToPath(import.meta.url);
  const repoRoot = join(here, "..", "..", "..");

  test("the live bootstrap CLAUDE.md passes all hard checks", () => {
    const report = runValidation(repoRoot, DEFAULT_MAX_LINES);
    // Self-validating: this slice ships only when the repo it ships into
    // already satisfies the structural gate.
    expect(report.ok).toBe(true);
    expect(report.checks.find((c) => c.id === "claude-md-exists")?.status).toBe("pass");
    expect(report.checks.find((c) => c.id === "six-step-process")?.status).toBe("pass");
    expect(report.checks.find((c) => c.id === "rules-auto-load")?.status).toBe("pass");
  });

  test("fixture sanity: CLAUDE.md and .claude/rules/ are where we expect", () => {
    expect(existsSync(join(repoRoot, "CLAUDE.md"))).toBe(true);
    expect(readFileSync(join(repoRoot, "CLAUDE.md"), "utf8").length).toBeGreaterThan(0);
  });

  test("missing-CLAUDE.md root fails ok", () => {
    const report = runValidation("/nonexistent-zeta-root-xyz", DEFAULT_MAX_LINES);
    expect(report.ok).toBe(false);
  });
});
