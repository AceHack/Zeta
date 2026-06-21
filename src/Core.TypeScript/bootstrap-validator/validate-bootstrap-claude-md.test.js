import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkClaudeMdExists, checkConciseness, checkReferencedPointers, checkRulesAutoLoad, checkSixStepProcess, DEFAULT_MAX_LINES, extractReferencedPointers, REQUIRED_STEP_NUMBERS, runValidation, } from "./validate-bootstrap-claude-md";
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
describe("extractReferencedPointers", () => {
    test("extracts concrete .claude/rules/<name>.md references", () => {
        const md = "See `.claude/rules/backlog-item-start-gate.md` and .claude/rules/never-be-idle.md.";
        const refs = extractReferencedPointers(md);
        expect(refs).toContain(".claude/rules/backlog-item-start-gate.md");
        expect(refs).toContain(".claude/rules/never-be-idle.md");
    });
    test("extracts repo-relative markdown-link targets", () => {
        const md = "Read [`AGENTS.md`](AGENTS.md) then [GLOSSARY](docs/GLOSSARY.md).";
        const refs = extractReferencedPointers(md);
        expect(refs).toContain("AGENTS.md");
        expect(refs).toContain("docs/GLOSSARY.md");
    });
    test("strips a trailing #anchor from link targets", () => {
        const refs = extractReferencedPointers("See [§11](GOVERNANCE.md#section-11).");
        expect(refs).toContain("GOVERNANCE.md");
        expect(refs).not.toContain("GOVERNANCE.md#section-11");
    });
    test("skips URLs, pure anchors, globs/templates, and home/absolute paths", () => {
        const md = [
            "[site](https://example.com)", // URL
            "[top](#orient)", // pure anchor
            "`memory/CURRENT-*.md`", // glob (inline, not a link anyway)
            "[resume](docs/trajectories/*/RESUME.md)", // glob in a link target
            "[slug](~/.claude/projects/<slug>/memory/x.md)", // home + template
            "[abs](/etc/passwd)", // absolute
            "[mail](mailto:x@y.z)", // mailto scheme
        ].join("\n");
        const refs = extractReferencedPointers(md);
        expect(refs).toEqual([]); // nothing concrete + repo-relative survives
    });
    test("de-duplicates a pointer that appears in both rule-path and link form", () => {
        const md = "`.claude/rules/x.md` then [x](.claude/rules/x.md)";
        const refs = extractReferencedPointers(md);
        expect(refs.filter((r) => r === ".claude/rules/x.md").length).toBe(1);
    });
    test("extracts bare inline-code repo paths not in a link or rules dir", () => {
        const md = "Spec: `docs/research/foo.md` §10. Refresh: `tools/setup/common/sync.sh`.";
        const refs = extractReferencedPointers(md);
        expect(refs).toContain("docs/research/foo.md");
        expect(refs).toContain("tools/setup/common/sync.sh");
    });
    test("inline-code skips bare identifiers and extension-less tokens", () => {
        const md = "`Result<_, DbspError>` and `git log` and `BACKLOG` are not pointers.";
        const refs = extractReferencedPointers(md);
        expect(refs).toEqual([]);
    });
    test("a multi-line backtick command span does not mis-pair into a false path", () => {
        // The open backtick on line 1 closes on line 2 (a wrapped command). Single-line
        // span matching must skip it AND must not let backtick-parity drift swallow the
        // genuine path on line 3.
        const md = [
            "Audit via `bun tools/x.ts",
            "  --since DATE`. Spec: per",
            "`docs/research/bar.md` §10.",
        ].join("\n");
        const refs = extractReferencedPointers(md);
        expect(refs).toContain("docs/research/bar.md");
        expect(refs).not.toContain("bun tools/x.ts");
    });
});
describe("checkReferencedPointers", () => {
    test("pass when every concrete pointer resolves", () => {
        const refs = ["AGENTS.md", ".claude/rules/x.md"];
        const r = checkReferencedPointers(refs, () => true);
        expect(r.status).toBe("pass");
        expect(r.detail).toContain("2");
    });
    test("fail (not warn) when any pointer dangles — a critical rule lost in extraction", () => {
        const refs = ["AGENTS.md", ".claude/rules/gone.md"];
        const present = new Set(["AGENTS.md"]);
        const r = checkReferencedPointers(refs, (p) => present.has(p));
        expect(r.status).toBe("fail");
        expect(r.detail).toContain(".claude/rules/gone.md");
        expect(r.detail).not.toContain("AGENTS.md,"); // only the dangling one is listed
    });
    test("vacuous pass when there are no concrete pointers", () => {
        expect(checkReferencedPointers([], () => false).status).toBe("pass");
    });
});
describe("runValidation against the live repo root", () => {
    // Resolve repo root from this test file's location:
    // tools/bootstrap-validator/<file> -> repo root is two dirs up.
    const here = fileURLToPath(import.meta.url);
    const repoRoot = join(here, "..", "..", "..", "..");
    test("the live bootstrap CLAUDE.md passes all hard checks", () => {
        const report = runValidation(repoRoot, DEFAULT_MAX_LINES);
        // Self-validating: this slice ships only when the repo it ships into
        // already satisfies the structural gate.
        expect(report.ok).toBe(true);
        expect(report.checks.find((c) => c.id === "claude-md-exists")?.status).toBe("pass");
        expect(report.checks.find((c) => c.id === "six-step-process")?.status).toBe("pass");
        expect(report.checks.find((c) => c.id === "rules-auto-load")?.status).toBe("pass");
        // B-0354.2 — every concrete pointer the live CLAUDE.md hands a fresh
        // instance must resolve (no critical rule/doc lost in the extraction).
        expect(report.checks.find((c) => c.id === "referenced-pointers-resolve")?.status).toBe("pass");
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
