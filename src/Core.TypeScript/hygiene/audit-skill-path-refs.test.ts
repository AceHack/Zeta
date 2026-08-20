// audit-skill-path-refs.test.ts — falsifiers for the skill path-reference auditor.
//
// The auditor's whole value is its FRAME: which references it is fair to resolve.
// Its first pass reported 447 stale because it tried to resolve bare filenames and
// prose placeholders. So the frame is what these tests pin, not just the classifier.

import { describe, expect, test } from "bun:test";
import { classify, isRepoAnchored } from "./audit-skill-path-refs.ts";

const TOP = new Set(["src", "docs", "tools", ".claude", "tests"]);

describe("isRepoAnchored — the frame", () => {
    test("accepts a repo-root-anchored path under a real top-level dir", () => {
        expect(isRepoAnchored("src/Core.TypeScript/alignment/concept_registry.ts", TOP)).toBe(true);
        expect(isRepoAnchored("docs/GLOSSARY.md", TOP)).toBe(true);
    });

    test("EXCLUDES bare filenames — no frame to resolve them in", () => {
        // These were 228 of the naive pass's 447 'stale'. They are relative or
        // illustrative; resolving them repo-root is a category error.
        // Rejected by the top-level-dir check: a bare filename's first segment carries
        // an extension, so it never names a directory. (A dedicated bare-filename guard
        // was removed — the mutation run proved no test could detect its absence.)
        expect(isRepoAnchored("SKILL.md", TOP)).toBe(false);
        expect(isRepoAnchored("install.sh", TOP)).toBe(false);
        expect(isRepoAnchored("MEMORY.md", TOP)).toBe(false);
    });

    test("EXCLUDES paths not anchored at a real top-level dir", () => {
        expect(isRepoAnchored("nonexistent-toplevel/thing.ts", TOP)).toBe(false);
    });

    test("EXCLUDES user-scope and remote references", () => {
        expect(isRepoAnchored("~/.claude/projects/x/memory/a.md", TOP)).toBe(false);
        expect(isRepoAnchored("https://example.com/a.md", TOP)).toBe(false);
    });

    test("EXCLUDES glob and template forms", () => {
        expect(isRepoAnchored("docs/backlog/P2/*.md", TOP)).toBe(false);
        expect(isRepoAnchored("docs/ticks/YYYY/MM/DD.md", TOP)).toBe(false);
        expect(isRepoAnchored("docs/<name>.md", TOP)).toBe(false);
    });

    test("EXCLUDES prose placeholders — illustrating a shape is not citing an artifact", () => {
        expect(isRepoAnchored("docs/FOO.md", TOP)).toBe(false);
        expect(isRepoAnchored("src/Core.CSharp/X.cs", TOP)).toBe(false);
        expect(isRepoAnchored("tools/lean4/Lean4/MyProof.lean", TOP)).toBe(false);
        expect(isRepoAnchored("tools/alignment/out/rounds/roundN.json", TOP)).toBe(false);
        expect(isRepoAnchored(".claude/rules/higher-kinded-kindness-...md", TOP)).toBe(false);
    });

    test("a placeholder-looking name that IS a real anchored path still counts", () => {
        // Guard against the exclusion list swallowing real references.
        expect(isRepoAnchored("src/Core/Xml.cs", TOP)).toBe(true);
    });
});

describe("classify — three states", () => {
    const exists = (p: string) =>
        p === "src/Core/Real.fs" || p === ".claude/rules.bak/archived-rule.md";

    test("live when the path resolves as written", () => {
        expect(classify("src/Core/Real.fs", [".claude/rules.bak"], exists)).toEqual({ state: "live" });
    });

    test("archived when the basename resolves under an archive dir", () => {
        // The #6676 sweep moved 96 rules to rules.bak; skills citing them were never
        // updated. Misleading, not missing — and a distinct remedy (repoint, not delete).
        expect(classify(".claude/rules/archived-rule.md", [".claude/rules.bak"], exists)).toEqual({
            state: "archived",
            foundAt: ".claude/rules.bak/archived-rule.md",
        });
    });

    test("stale when it resolves nowhere", () => {
        expect(classify("docs/gone.md", [".claude/rules.bak"], exists)).toEqual({ state: "stale" });
    });

    test("archive lookup is by BASENAME, not by suffix match", () => {
        // A path that merely ends with an archived name must not be laundered as archived.
        expect(classify("some/other/dir/archived-rule.md", [".claude/rules.bak"], exists).state)
            .toBe("archived");
        expect(classify("archived-rule-extra.md", [".claude/rules.bak"], exists).state).toBe("stale");
    });
});
