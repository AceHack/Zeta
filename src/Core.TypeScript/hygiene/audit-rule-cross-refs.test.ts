// audit-rule-cross-refs.test.ts — basic correctness tests for the rule cross-ref auditor.
//
// Tests the pure pull/exists/render functions. The audit() integration
// is exercised end-to-end via CLI run in the shard PR's verify step.

import { describe, expect, test } from "bun:test";
import {
  audit,
  displayTargetMismatch,
  pullRefs,
  refExists,
  renderReport,
  resolveRef,
} from "./audit-rule-cross-refs.ts";

// Fixture pair for the three-state positive control. A live rules dir and its
// archive, planted with one reference of each class the auditor claims to tell
// apart. Kept OUT of `.claude/rules/` deliberately: the real cold-start surface is
// a moving target (PR #10863 repoints nine of its references), and an instrument
// whose control lives in its own subject drifts with the subject.
const FIXTURE_RULES = "src/Core.TypeScript/hygiene/fixtures/rule-xrefs/rules";
const FIXTURE_ARCHIVE = "src/Core.TypeScript/hygiene/fixtures/rule-xrefs/rules-archive";

describe("pullRefs", () => {
  test("pulls backtick'd .md path references", () => {
    const content = "See `memory/feedback_example.md` for details.";
    const refs = pullRefs(content, "test.md");
    expect(refs).toHaveLength(1);
    expect(refs[0]!.raw).toBe("memory/feedback_example.md");
    expect(refs[0]!.kind).toBe("path");
  });

  test("pulls backtick'd .ts path references", () => {
    const content = "Wire via `tools/peer-call/claude.ts`";
    const refs = pullRefs(content, "test.md");
    expect(refs).toHaveLength(1);
    expect(refs[0]!.raw).toBe("tools/peer-call/claude.ts");
  });

  test("pulls zetaid backlog ID references", () => {
    const content = "Composes with 081KQR4HQ0008QG0R001GAD29A and 081KRHWGX0008QG0R002DPG02X.";
    const refs = pullRefs(content, "test.md");
    expect(refs).toHaveLength(2);
    expect(refs.map((r) => r.raw).sort()).toEqual(["081KQR4HQ0008QG0R001GAD29A", "081KRHWGX0008QG0R002DPG02X"]);
    expect(refs.every((r) => r.kind === "backlog-id")).toBe(true);
  });

  test("skips placeholders containing < or $", () => {
    const content = "Use `<name>.md` template or `$VAR.ts`";
    const refs = pullRefs(content, "test.md");
    expect(refs).toHaveLength(0);
  });

  test("dedups repeated references in same file", () => {
    const content =
      "See `foo.md` ... then `foo.md` again and 081KPYCJH0008QG0R003MDS51N twice: 081KPYCJH0008QG0R003MDS51N";
    const refs = pullRefs(content, "test.md");
    expect(refs).toHaveLength(2);
    expect(refs.map((r) => r.raw).sort()).toEqual(["081KPYCJH0008QG0R003MDS51N", "foo.md"]);
  });
});

describe("refExists", () => {
  test("returns true for an existing file", () => {
    // CLAUDE.md is at the repo root and exists in any healthy checkout.
    expect(refExists({ fromRule: "test.md", raw: "CLAUDE.md", kind: "path" })).toBe(true);
  });

  test("returns false for a missing file", () => {
    expect(refExists({ fromRule: "test.md", raw: "definitely-does-not-exist-xyz.md", kind: "path" })).toBe(false);
  });

  test("resolves a real backlog ID via dir scan", () => {
    // 081KRHWGX0008QG0R002DPG02X was filed earlier today; should resolve.
    expect(refExists({ fromRule: "test.md", raw: "081KRHWGX0008QG0R002DPG02X", kind: "backlog-id" })).toBe(true);
  });

  test("returns false for a non-existent backlog ID", () => {
    expect(refExists({ fromRule: "test.md", raw: "081KED9T0X008QG0R003SZN0FB", kind: "backlog-id" })).toBe(false);
  });

  test("resolves a glob pattern when at least one match exists", () => {
    // memory/feedback_*.md will match many files.
    expect(refExists({ fromRule: "test.md", raw: "memory/feedback_*.md", kind: "path" })).toBe(true);
  });

  test("resolves a glob with wildcard in a directory segment (Codex P2 catch on PR #3202)", () => {
    // docs/backlog/P*/*.md is referenced from backlog-item-start-gate.md.
    // Earlier implementation treated the substring before the last "/" as a
    // literal directory; this regression test covers the directory-segment wildcard.
    expect(refExists({ fromRule: "test.md", raw: "docs/backlog/P*/*.md", kind: "path" })).toBe(true);
  });

  test("returns false for a glob that matches no files in any segment", () => {
    expect(refExists({ fromRule: "test.md", raw: "no-such-dir-*/nothing-*.md", kind: "path" })).toBe(false);
  });

  test("resolves brace-expansion patterns (Codex P2 re-review on PR #3202)", () => {
    // lost-files-surface.md references feedback_rule_number_{one,two,three,...}_*aaron_*.md.
    // Brace globs should expand to alternatives, each tested as a star-glob.
    expect(
      refExists({
        fromRule: "test.md",
        raw: "memory/feedback_rule_number_{one,two,three,four,five,six,seven}_*aaron_2026_05_05.md",
        kind: "path",
      }),
    ).toBe(true);
  });

  test("returns false for brace pattern where no alternative matches", () => {
    expect(
      refExists({
        fromRule: "test.md",
        raw: "no-such-dir/{alpha,beta,gamma}-no-match.md",
        kind: "path",
      }),
    ).toBe(false);
  });

  // 081KS923C0008QG0R00035KSQA resolver improvements (2026-05-23): false-positive class fixes
  // for template-paths, command-snippets, sibling-rule references, and
  // tools/* directory fallbacks.

  test("resolves template-placeholder paths with `...` ellipsis as healthy-FP", () => {
    expect(refExists({ fromRule: "test.md", raw: "docs/.../0603Z.md", kind: "path" })).toBe(true);
    expect(
      refExists({ fromRule: "test.md", raw: "docs/backlog/P3/081KRSKQ20008QG0R002TH55X6-...md", kind: "path" }),
    ).toBe(true);
  });

  test("resolves template-placeholder paths with `YYYY` date-template as healthy-FP", () => {
    expect(
      refExists({
        fromRule: "test.md",
        raw: "docs/hygiene-history/ticks/YYYY/MM/DD/HHMMZ.md",
        kind: "path",
      }),
    ).toBe(true);
  });

  test("resolves command-snippet with embedded existing path", () => {
    // `bun tools/hygiene/audit-rule-cross-refs.ts` — the .ts path exists
    expect(
      refExists({
        fromRule: "test.md",
        raw: "bun src/Core.TypeScript/hygiene/audit-rule-cross-refs.ts",
        kind: "path",
      }),
    ).toBe(true);
  });

  test("resolves sibling-rule reference (bare `<name>.md` in .claude/rules/)", () => {
    // no-directives.md is a real rule file
    expect(refExists({ fromRule: "test.md", raw: "no-directives.md", kind: "path" })).toBe(true);
  });

  test("resolves bare MEMORY.md via memory/ fallback", () => {
    expect(refExists({ fromRule: "test.md", raw: "MEMORY.md", kind: "path" })).toBe(true);
  });
});

// --------------------------------------------------------------------------
// Three-state resolution + markdown-link parsing (2026-08-15, after PR #10863).
//
// POSITIVE CONTROL. Every lane below is planted: the fixture contains a known
// live, a known archived, a known dead, and a known shorthand reference, so a
// resolver that has quietly stopped discriminating fails here rather than
// reporting a comfortable number.
// --------------------------------------------------------------------------

describe("three-state resolution (positive control on planted fixture)", () => {
  const result = audit(FIXTURE_RULES, FIXTURE_ARCHIVE);

  test("LIVE: a reference resolving in the live rules dir is resolved, not flagged", () => {
    expect(result.candidatesStale.map((r) => r.raw)).not.toContain("live-sibling.md");
    expect(result.archivedMisleading.map((r) => r.raw)).not.toContain("live-sibling.md");
    expect(result.resolvedCount).toBeGreaterThan(0);
  });

  test("ARCHIVED: a reference resolving only in rules.bak is reported as archived, NOT as dead", () => {
    const archived = result.archivedMisleading.filter((r) => r.raw === "archived-rule.md");
    // Both halves: the bare code span and the markdown link target.
    expect(archived.map((r) => r.origin).sort()).toEqual(["code-span", "link-target"]);
    expect(result.candidatesStale.map((r) => r.raw)).not.toContain("archived-rule.md");
    for (const a of archived) {
      expect(a.resolution.state).toBe("archived");
      expect(a.resolution.actualPath).toBe(`${FIXTURE_ARCHIVE}/archived-rule.md`);
    }
    // The suggested rewrite differs by form: a link must stay a working relative
    // link, a code span is written repo-root-relative.
    expect(archived.find((a) => a.origin === "link-target")!.resolution.shouldSay).toBe(
      "../rules-archive/archived-rule.md",
    );
    expect(archived.find((a) => a.origin === "code-span")!.resolution.shouldSay).toBe(
      `${FIXTURE_ARCHIVE}/archived-rule.md`,
    );
  });

  test("DEAD: a reference resolving nowhere is a stale-pointer candidate, not archived", () => {
    const dead = result.candidatesStale.filter((r) => r.raw === "no-such-rule-anywhere.md");
    expect(dead.map((r) => r.origin).sort()).toEqual(["code-span", "link-target"]);
    expect(result.archivedMisleading.map((r) => r.raw)).not.toContain("no-such-rule-anywhere.md");
  });

  test("SHORTHAND: a bare non-`.md` basename is never dragged into the rules-archive class", () => {
    // `shorthand-tool.ts` exists in the fixture ARCHIVE dir on purpose. The archive
    // fallback is `.md`-only, so this must stay `dead` — mislabelling shorthand as a
    // misleading rule pointer is what would push agents to pad the cold-start surface.
    expect(result.archivedMisleading.map((r) => r.raw)).not.toContain("shorthand-tool.ts");
    expect(result.candidatesStale.map((r) => r.raw)).toContain("shorthand-tool.ts");
  });

  test("counts partition the references: live + archived + dead == refsFound", () => {
    expect(result.resolvedCount + result.archivedMisleading.length + result.candidatesStale.length).toBe(
      result.refsFound,
    );
  });
});

describe("markdown link targets (the display-text blind spot)", () => {
  test("pullRefs reads the link TARGET, not the display text", () => {
    // The historical extractor saw `foo.md` here and never `bar.md` — so a link
    // whose display text is fine and whose target is dead read as healthy.
    const refs = pullRefs("See [`foo.md`](bar.md) for detail.", "test.md");
    const link = refs.find((r) => r.origin === "link-target");
    expect(link).toBeDefined();
    expect(link!.raw).toBe("bar.md");
    expect(link!.displayText).toBe("foo.md");
  });

  test("a link is ONE reference — the display half is not double-counted as a span", () => {
    const refs = pullRefs("- [`same.md`](same.md)", "test.md");
    expect(refs).toHaveLength(1);
    expect(refs[0]!.origin).toBe("link-target");
  });

  test("link targets resolve relative to the rule file, not the cwd", () => {
    // `../../docs/governance/MANIFESTO.md` from `.claude/rules/` is `docs/governance/`.
    const ref = {
      fromRule: "manifesto-13-specifications.md",
      raw: "../../docs/governance/MANIFESTO.md",
      kind: "path" as const,
      origin: "link-target" as const,
    };
    expect(resolveRef(ref).state).toBe("live");
  });

  test("a `#fragment` is stripped before the target is resolved", () => {
    const refs = pullRefs("[`x`](../../docs/governance/MANIFESTO.md#weight-free)", "test.md");
    expect(refs[0]!.raw).toBe("../../docs/governance/MANIFESTO.md");
  });

  test("non-local targets (http, mailto, in-document anchors) are not treated as paths", () => {
    const refs = pullRefs("[a](https://example.com/x.md) [b](mailto:x@y.md) [c](#section)", "test.md");
    expect(refs.filter((r) => r.origin === "link-target")).toHaveLength(0);
  });

  test("two links to one target with DIFFERENT display texts are both kept", () => {
    // Deduping on the target alone discards the second claim about where the file
    // is — which is precisely the claim the mismatch check exists to read.
    const refs = pullRefs("[`a/x.md`](x.md) and [`b/x.md`](x.md)", "test.md");
    expect(refs.filter((r) => r.origin === "link-target")).toHaveLength(2);
  });
});

describe("display/target mismatch (heuristic)", () => {
  const mk = (displayText: string, raw: string) => ({
    fromRule: "test.md",
    raw,
    kind: "path" as const,
    origin: "link-target" as const,
    displayText,
  });

  test("fires when the display text names a different directory than the target resolves to", () => {
    const m = displayTargetMismatch(mk(".claude/rules/dont-ask-permission.md", "../rules.bak/dont-ask-permission.md"));
    expect(m).not.toBeNull();
    expect(m!.displayImpliedDir).toBe(".claude/rules");
    expect(m!.targetDir).toBe(".claude/rules.bak");
  });

  test("does NOT fire on a display text with no directory (sibling shorthand)", () => {
    expect(displayTargetMismatch(mk("dont-ask-permission.md", "dont-ask-permission.md"))).toBeNull();
  });

  test("does NOT fire on a repo-root-relative display agreeing with a file-relative target", () => {
    // The real form used throughout `.claude/rules/`.
    expect(displayTargetMismatch(mk("docs/governance/MANIFESTO.md", "../../docs/governance/MANIFESTO.md"))).toBeNull();
  });

  test("does NOT fire on a file-relative display agreeing with its target", () => {
    expect(
      displayTargetMismatch(mk("../rules.bak/dont-ask-permission.md", "../rules.bak/dont-ask-permission.md")),
    ).toBeNull();
  });

  test("does not apply to code spans, which have no target half", () => {
    expect(displayTargetMismatch({ fromRule: "t.md", raw: "a/b.md", kind: "path", origin: "code-span" })).toBeNull();
  });

  test("the planted mismatch in the fixture is reported", () => {
    const result = audit(FIXTURE_RULES, FIXTURE_ARCHIVE);
    expect(result.displayMismatches).toHaveLength(1);
    expect(result.displayMismatches[0]!.displayImpliedDir).toBe("some-other-dir");
  });
});

describe("rules.bak fallback against the real tree", () => {
  test("a rule name that lives in BOTH dirs resolves live, archive never shadows live", () => {
    // `no-directives.md` exists in `.claude/rules/` and `.claude/rules.bak/`.
    expect(resolveRef({ fromRule: "t.md", raw: "no-directives.md", kind: "path" }).state).toBe("live");
  });

  test("an explicit `.claude/rules.bak/` reference is live, not a finding", () => {
    // Saying where the file actually is IS the fix; it must not be re-flagged.
    expect(resolveRef({ fromRule: "t.md", raw: ".claude/rules.bak/no-directives.md", kind: "path" }).state).toBe(
      "live",
    );
  });

  test("a name in neither dir is dead", () => {
    expect(resolveRef({ fromRule: "t.md", raw: "no-such-rule-anywhere-xyz.md", kind: "path" }).state).toBe("dead");
  });
});

describe("renderReport", () => {
  const empty = { archivedMisleading: [], displayMismatches: [] };

  test("renders a no-candidates report", () => {
    const fixed = new Date("2026-05-14T00:00:00Z");
    const md = renderReport(
      { rulesScanned: 10, refsFound: 50, candidatesStale: [], resolvedCount: 50, ...empty },
      fixed,
    );
    expect(md).toContain("Rules scanned: 10");
    expect(md).toContain("Resolved: 50");
    expect(md).toContain("Stale-pointer candidates: 0");
    expect(md).toContain("_None — all references resolve._");
  });

  test("renders a candidates table", () => {
    const fixed = new Date("2026-05-14T00:00:00Z");
    const md = renderReport(
      {
        rulesScanned: 1,
        refsFound: 1,
        resolvedCount: 0,
        candidatesStale: [{ fromRule: "rule.md", raw: "missing.md", kind: "path" }],
        ...empty,
      },
      fixed,
    );
    expect(md).toContain("| Rule | Kind | Origin | Reference |");
    expect(md).toContain("| `rule.md` | path | code-span | `missing.md` |");
  });

  test("reports archived and dead under separate headings", () => {
    const fixed = new Date("2026-05-14T00:00:00Z");
    const md = renderReport(
      {
        rulesScanned: 1,
        refsFound: 2,
        resolvedCount: 0,
        candidatesStale: [{ fromRule: "rule.md", raw: "gone.md", kind: "path" }],
        archivedMisleading: [
          {
            fromRule: "rule.md",
            raw: "moved.md",
            kind: "path",
            origin: "code-span",
            resolution: {
              state: "archived",
              via: "rules.bak fallback",
              actualPath: ".claude/rules.bak/moved.md",
              shouldSay: ".claude/rules.bak/moved.md",
            },
          },
        ],
        displayMismatches: [],
      },
      fixed,
    );
    expect(md).toContain("Archived-in-`rules.bak` (misleading location): 1");
    expect(md).toContain("Stale-pointer candidates: 1");
    expect(md).toContain("| `rule.md` | code-span | `moved.md` | `.claude/rules.bak/moved.md` |");
  });
});
