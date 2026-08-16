import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LINT_CONFIG, healable, isIgnored, loadIgnores, parseIgnores } from "./md-heal-scope";

// The healer rewrote 414 preserved PR-review archives because it never consulted the ignore list
// that already excluded them. These tests defend the connection between the two, not the list.

const CONFIG = `// Zeta markdown lint config.
{
  "ignores": [
    ".git/**",
    // Verbatim preservation — see "docs/history/pr-reviews/README.md" for the rule.
    "docs/history/pr-reviews/**",
    "docs/recovered-orphan-branches-2026-05/**",
    "**/.claude/**",
    "workitems/081*.md",
  ],
  "config": { "MD013": false },
}
`;

describe("reading the ignore list the LINTER uses — one source of truth", () => {
  test("JSONC parses despite comments and a trailing comma", () => {
    // A strict JSON.parse rejects this file outright ("Illegal trailing comma"), so the healer
    // silently having no scope was one bad parse away either direction.
    const ig = parseIgnores(CONFIG);
    expect(ig).toContain("docs/history/pr-reviews/**");
    expect(ig).toContain("workitems/081*.md");
  });

  test("comment lines are not mistaken for patterns", () => {
    // The comment above that entry cites a PATH IN QUOTES. A naive quote-scrape would lift it in
    // as a 6th glob — and `docs/history/pr-reviews/README.md` as a pattern would still "work" by
    // accident, which is why this asserts the COUNT rather than just the contents.
    const ig = parseIgnores(CONFIG);
    expect(ig).toHaveLength(5);
    expect(ig).not.toContain("docs/history/pr-reviews/README.md");
  });

  test("a missing config THROWS rather than healing everything", () => {
    // The whole defect class: a guard that cannot be read must not degrade into "no guard".
    // Returning [] here would restore exactly the behaviour that rewrote 414 archives.
    expect(() => loadIgnores(mkdtempSync(join(tmpdir(), "no-config-")))).toThrow(/refusing to heal/);
  });

  test("loadIgnores reads the real file from a root", () => {
    const root = mkdtempSync(join(tmpdir(), "scope-"));
    writeFileSync(join(root, LINT_CONFIG), CONFIG);
    expect(loadIgnores(root)).toContain("docs/history/pr-reviews/**");
  });
});

describe("the archives are withheld — the case that actually happened", () => {
  const ignores = parseIgnores(CONFIG);

  test("a PR-review archive is ignored", () => {
    expect(isIgnored("docs/history/pr-reviews/PR-10000-fix-setup.md", ignores)).toBe(true);
  });

  test("ordinary prose is NOT ignored — the filter is not vacuous", () => {
    // Without this, an over-broad pattern could withhold everything and every other test here
    // would still pass while the healer silently stopped working.
    expect(isIgnored("docs/VISION.md", ignores)).toBe(false);
    expect(isIgnored("README.md", ignores)).toBe(false);
  });

  test("healable() drops exactly the ignored paths and keeps the rest", () => {
    const files = [
      "README.md",
      "docs/history/pr-reviews/PR-1-a.md",
      "docs/history/pr-reviews/PR-2-b.md",
      "docs/VISION.md",
      "workitems/081ABC-thing.md",
      "sub/.claude/notes.md",
    ];
    expect(healable(files, ignores)).toEqual(["README.md", "docs/VISION.md"]);
  });

  test("blank lines in the worklist are dropped, not passed to the fixer as ''", () => {
    expect(healable(["", "  ", "README.md"], ignores)).toEqual(["README.md"]);
  });

  test("every glob shape in the real config works: dir/**, **/x/**, and a * stem", () => {
    expect(isIgnored("docs/recovered-orphan-branches-2026-05/deep/x.md", ignores)).toBe(true);
    expect(isIgnored("a/b/.claude/x.md", ignores)).toBe(true);
    expect(isIgnored("workitems/081KZ-item.md", ignores)).toBe(true);
    // NOT a legacy B-NNNN id: `lint-b-refs-resolve.ts` requires every such reference to
    // resolve to a real row, and an invented fixture id would not. Any non-`081*` stem
    // exercises the same discrimination without owing a resolution.
    expect(isIgnored("workitems/zzz-not-a-zetaid.md", ignores)).toBe(false); // stem must still discriminate
  });
});
