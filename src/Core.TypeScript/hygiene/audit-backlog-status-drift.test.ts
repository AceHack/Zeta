import { test, expect, describe } from "bun:test";
import {
    extractPrimaryArtifacts,
    parseFrontmatter,
    findDriftCandidates,
    detectRepoRoot,
    type BacklogRow,
} from "./audit-backlog-status-drift";
import { existsSync } from "node:fs";
import { join } from "node:path";

describe("parseFrontmatter", () => {
    test("reads status field from YAML frontmatter", () => {
        const body = `---
id: B-0001
status: open
priority: P3
---

# Body
`;
        const fm = parseFrontmatter(body);
        expect(fm.status).toBe("open");
        expect(fm.id).toBe("B-0001");
    });

    test("returns empty object when no frontmatter", () => {
        expect(parseFrontmatter("# Just a heading\n")).toEqual({});
    });

    test("handles colon-in-value correctly", () => {
        const body = `---
title: "foo: bar"
status: open
---
`;
        const fm = parseFrontmatter(body);
        expect(fm.title).toBe('"foo: bar"');
        expect(fm.status).toBe("open");
    });
});

describe("extractPrimaryArtifacts", () => {
    test("extracts tools/ paths from Acceptance section", () => {
        const body = `---
id: B-0001
---

# Title

## Source

Some context.

## Acceptance

- New \`tools/hygiene/foo.ts\`
- Tests at \`tools/hygiene/foo.test.ts\`

## Composes with

- \`tools/orchestrator-checks/verify-branch.ts\` (sibling)
`;
        const paths = extractPrimaryArtifacts(body);
        expect(paths).toContain("tools/hygiene/foo.ts");
        expect(paths).toContain("tools/hygiene/foo.test.ts");
        expect(paths).not.toContain("tools/orchestrator-checks/verify-branch.ts");
    });

    test("skips Composes with section paths (load-bearing false-positive defence)", () => {
        const body = `---
id: B-0002
---

# T

## Composes with

- \`tools/foo.ts\`
- \`.claude/rules/bar.md\`
`;
        expect(extractPrimaryArtifacts(body)).toEqual([]);
    });

    test("skips Origin, Source, Non-goals, and Resolution sections", () => {
        const body = `---
id: B-0003
---

## Origin

Per \`tools/old.ts\` — old reference, NOT primary.

## Non-goals

Refactoring \`tools/scope-creep.ts\` — explicitly out-of-scope.

## Resolution

Closed via \`tools/done.ts\`.

## Acceptance

- \`tools/new.ts\`
`;
        const paths = extractPrimaryArtifacts(body);
        expect(paths).toEqual(["tools/new.ts"]);
        expect(paths).not.toContain("tools/old.ts");
        expect(paths).not.toContain("tools/scope-creep.ts");
        expect(paths).not.toContain("tools/done.ts");
    });

    test("skips backlog cross-refs", () => {
        const body = `## Acceptance

- See \`docs/backlog/P3/B-0001-foo.md\` for context.
- Add \`tools/x.ts\`.
`;
        const paths = extractPrimaryArtifacts(body);
        expect(paths).toEqual(["tools/x.ts"]);
        expect(paths).not.toContain("docs/backlog/P3/B-0001-foo.md");
    });

    test("extracts paths from Proposed mechanization section", () => {
        const body = `## Proposed mechanization

Add \`tools/hygiene/audit-foo.ts\` that does X.
Also wire \`.claude/rules/foo-rule.md\`.

## Composes with

- \`tools/sibling.ts\`
`;
        const paths = extractPrimaryArtifacts(body);
        expect(paths).toContain("tools/hygiene/audit-foo.ts");
        expect(paths).toContain(".claude/rules/foo-rule.md");
        expect(paths).not.toContain("tools/sibling.ts");
    });

    test("extracts paths from Scope section", () => {
        const body = `## Scope

Add \`tools/scope-target.ts\`.
`;
        expect(extractPrimaryArtifacts(body)).toEqual(["tools/scope-target.ts"]);
    });

    test("INLINE_CROSSREF: 'Composes with X' bullet inside Acceptance section is NOT a deliverable", () => {
        // Empirical case from B-0518 (Sharpening 4): an Acceptance sub-section
        // contains "Composes with `.claude/rules/encoding-rules-without-mechanizing.md`"
        // as a bullet — that's a sibling reference, not a deliverable.
        const body = `## Acceptance

- [ ] New \`tools/foo.ts\`
- [ ] Composes with \`.claude/rules/bar.md\`
`;
        const paths = extractPrimaryArtifacts(body);
        expect(paths).toEqual(["tools/foo.ts"]);
        expect(paths).not.toContain(".claude/rules/bar.md");
    });

    test("INLINE_CROSSREF: 'sister mechanism' references skip", () => {
        const body = `## Proposed mechanization

- New \`tools/audit.ts\`
- Sister mechanism: \`tools/orchestrator-checks/verify-branch.ts\`
`;
        expect(extractPrimaryArtifacts(body)).toEqual(["tools/audit.ts"]);
    });

    test("INLINE_CROSSREF: 'see also' / 'per' / 'references' patterns skip", () => {
        const body = `## Acceptance

- New \`tools/x.ts\`
- See also \`tools/sibling-a.ts\` for shape
- Per \`.claude/rules/some-rule.md\` discipline
- References \`docs/some-doc.md\` for background
`;
        const paths = extractPrimaryArtifacts(body);
        expect(paths).toEqual(["tools/x.ts"]);
    });

    test("MIXED_BULLET: deliverable BEFORE inline cross-ref token is extracted", () => {
        // B-0557 slice 4: mixed bullets where a path appears before a
        // cross-ref token should still extract the path. The previous behaviour
        // skipped the WHOLE line when any cross-ref keyword matched, dropping
        // the deliverable along with the citation.
        const body = `## Acceptance

- Add \`tools/deliverable.ts\` per [B-0123] convention
- Wire \`tools/foo.ts\` (see also \`tools/sibling.ts\` for shape)
`;
        const paths = extractPrimaryArtifacts(body);
        expect(paths).toContain("tools/deliverable.ts");
        expect(paths).toContain("tools/foo.ts");
        // The post-cross-ref paths are siblings, NOT deliverables.
        expect(paths).not.toContain("tools/sibling.ts");
    });

    test("MIXED_BULLET: pure cross-ref bullets still skip (regression check)", () => {
        // Sanity: bullets that LEAD with a cross-ref keyword still produce no
        // extraction — the pre-cutoff segment is just the bullet marker.
        const body = `## Acceptance

- New \`tools/primary.ts\`
- Composes with \`.claude/rules/bar.md\`
- See also \`tools/legacy.ts\` for prior art
- Per \`tools/older.ts\` convention
`;
        const paths = extractPrimaryArtifacts(body);
        expect(paths).toEqual(["tools/primary.ts"]);
        expect(paths).not.toContain(".claude/rules/bar.md");
        expect(paths).not.toContain("tools/legacy.ts");
        expect(paths).not.toContain("tools/older.ts");
    });

    test("Empirical case from B-0553: composes_with paths NOT in primary sections must be skipped", () => {
        const body = `---
id: B-0116
status: open
composes_with:
  - tools/github/poll-pr-gate.ts
---

# B-0116 — tools/gh-jq-safe.sh wrapper

## Source

Deepseek peer review 2026-04-30 etc.

## What

Add a small wrapper script.

## Composes with

- \`tools/github/poll-pr-gate.ts\` — cross-ref

## Acceptance criteria

- New \`tools/gh-jq-safe.sh\` wrapper script
`;
        const paths = extractPrimaryArtifacts(body);
        expect(paths).toEqual(["tools/gh-jq-safe.sh"]);
        expect(paths).not.toContain("tools/github/poll-pr-gate.ts");
    });
});

describe("findDriftCandidates", () => {
    test("returns rows where all primary artifacts exist on disk", () => {
        const rows: readonly BacklogRow[] = [
            {
                id: "B-0001",
                path: "docs/backlog/P3/fake.md",
                status: "open",
                primaryArtifacts: ["tools/hygiene/audit-backlog-status-drift.ts"], // exists
            },
            {
                id: "B-0002",
                path: "docs/backlog/P3/fake2.md",
                status: "open",
                primaryArtifacts: ["tools/hygiene/does-not-exist.ts"],
            },
        ];
        const candidates = findDriftCandidates(rows);
        expect(candidates.map((r) => r.id)).toEqual(["B-0001"]);
    });

    test("does NOT flag rows with empty primary-artifact lists", () => {
        const rows: readonly BacklogRow[] = [
            {
                id: "B-9999",
                path: "fake",
                status: "open",
                primaryArtifacts: [],
            },
        ];
        expect(findDriftCandidates(rows)).toEqual([]);
    });

    test("requires ALL primary artifacts to exist (mixed → not a candidate)", () => {
        const rows: readonly BacklogRow[] = [
            {
                id: "B-mixed",
                path: "fake",
                status: "open",
                primaryArtifacts: [
                    "tools/hygiene/audit-backlog-status-drift.ts", // exists
                    "tools/does/not/exist.ts",
                ],
            },
        ];
        expect(findDriftCandidates(rows)).toEqual([]);
    });
});

describe("detectRepoRoot", () => {
    test("returns a directory path containing the audit tool itself", () => {
        // The repo root should always contain tools/hygiene/audit-backlog-status-drift.ts
        // (this file). If detection works, that path resolves.
        const root = detectRepoRoot();
        expect(typeof root).toBe("string");
        expect(root.length).toBeGreaterThan(0);
        expect(existsSync(join(root, "tools/hygiene/audit-backlog-status-drift.ts"))).toBe(true);
    });

    test("returns repo root from cwd inside the repo (not just current cwd)", () => {
        // Verifies invariant: regardless of what cwd test runner uses, detectRepoRoot
        // returns the repo root (via git rev-parse). Confirms cwd-independence.
        const root = detectRepoRoot();
        // Repo root should contain canonical top-level files.
        expect(existsSync(join(root, "CLAUDE.md"))).toBe(true);
        expect(existsSync(join(root, "docs/backlog"))).toBe(true);
    });
});
