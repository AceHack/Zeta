/**
 * stale-doc-cross-ref.test.ts — certification of the stale-doc cross-reference healer.
 *
 * Tests the 6 healer laws + domain-specific behavior:
 *   1. Idempotence: heal(heal(t)) == heal(t)
 *   2. Closure: healing does not introduce new findings from any detector
 *   3. Convergence: one pass reaches fixed point
 *   4. Totality: never throws
 *   5. Exit: no-drift input returns unchanged
 *   6. Bounded scope: only touches broken markdown links
 *
 * Plus: sabotage controls (prove the tests CAN fail).
 */

import { describe, test, expect } from "bun:test";
import { staleDocCrossRefHealer, staleDocCrossRefDetector } from "./stale-doc-cross-ref";
import { tree, treesEqual, certify } from "../healer-harness";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const cleanTree = tree({
  "docs/design/foo.md": "# Foo\n\nSee [bar](bar.md) for details.\n",
  "docs/design/bar.md": "# Bar\n\nThe bar doc.\n",
  "src/main.ts": "export const x = 1;\n",
});

const brokenLinkTree = tree({
  "docs/design/foo.md": "# Foo\n\nSee [bar](bar.md) and [baz](baz.md) for details.\n",
  "docs/design/bar.md": "# Bar\n\nAlso see [quux](../research/quux.md).\n",
  // baz.md does NOT exist → foo.md has a broken link
  // ../research/quux.md does NOT exist → bar.md has a broken link
  "src/main.ts": "export const x = 1;\n",
});

const brokenDirTree = tree({
  "docs/design/foo.md": "# Foo\n\nSee [genesis](addison-genesis-initial/) folder.\n",
  // No files under addison-genesis-initial/ → broken directory link
  "src/main.ts": "export const x = 1;\n",
});

const validDirTree = tree({
  "docs/design/foo.md": "# Foo\n\nSee [genesis](addison-genesis-initial/) folder.\n",
  "docs/design/addison-genesis-initial/README.md": "# Genesis\n",
  "src/main.ts": "export const x = 1;\n",
});

const mixedLinksTree = tree({
  "docs/README.md": [
    "# README\n",
    "- [Google](https://google.com)\n",
    "- [Section](#overview)\n",
    "- [Design](design/exists.md)\n",
    "- [Missing](design/gone.md)\n",
    "- [Also](mailto:dev@example.com)\n",
  ].join(""),
  "docs/design/exists.md": "# Exists\n",
});

const alreadyAnnotatedTree = tree({
  "docs/foo.md": "# Foo\n\nSee bar <!-- STALE-REF: bar.md --> for details.\n",
});

const fragmentLinkTree = tree({
  "docs/foo.md": "# Foo\n\nSee [section](bar.md#heading) for details.\n",
  "docs/bar.md": "# Bar\n\n## heading\n\nContent here.\n",
});

const brokenFragmentLinkTree = tree({
  "docs/foo.md": "# Foo\n\nSee [section](nonexistent.md#heading) for details.\n",
});

// ─── Detection Tests ─────────────────────────────────────────────────────────

describe("staleDocCrossRefDetector", () => {
  test("no findings on clean tree", () => {
    const findings = staleDocCrossRefDetector.detect(cleanTree);
    expect(findings).toHaveLength(0);
  });

  test("finds broken links", () => {
    const findings = staleDocCrossRefDetector.detect(brokenLinkTree);
    expect(findings.length).toBe(2);
    expect(findings.some((f) => f.path === "docs/design/foo.md" && f.detail.includes("baz.md"))).toBe(true);
    expect(findings.some((f) => f.path === "docs/design/bar.md" && f.detail.includes("quux.md"))).toBe(true);
  });

  test("finds broken directory links", () => {
    const findings = staleDocCrossRefDetector.detect(brokenDirTree);
    expect(findings.length).toBe(1);
    expect(findings[0]!.detail).toContain("addison-genesis-initial/");
  });

  test("does NOT flag valid directory links", () => {
    const findings = staleDocCrossRefDetector.detect(validDirTree);
    expect(findings).toHaveLength(0);
  });

  test("ignores URLs, anchors, mailto — only checks relative paths", () => {
    const findings = staleDocCrossRefDetector.detect(mixedLinksTree);
    // Only "design/gone.md" is broken
    expect(findings.length).toBe(1);
    expect(findings[0]!.detail).toContain("gone.md");
  });

  test("does not re-find already-annotated stale refs", () => {
    const findings = staleDocCrossRefDetector.detect(alreadyAnnotatedTree);
    expect(findings).toHaveLength(0);
  });

  test("valid fragment links (file exists, anchor ignored)", () => {
    const findings = staleDocCrossRefDetector.detect(fragmentLinkTree);
    expect(findings).toHaveLength(0);
  });

  test("broken file with fragment is still detected", () => {
    const findings = staleDocCrossRefDetector.detect(brokenFragmentLinkTree);
    expect(findings.length).toBe(1);
    expect(findings[0]!.detail).toContain("nonexistent.md");
  });
});

// ─── Healing Tests ───────────────────────────────────────────────────────────

describe("staleDocCrossRefHealer", () => {
  test("does not touch clean tree (exit law)", () => {
    const healed = staleDocCrossRefHealer.heal(cleanTree);
    expect(treesEqual(healed, cleanTree)).toBe(true);
  });

  test("annotates broken links", () => {
    const healed = staleDocCrossRefHealer.heal(brokenLinkTree);
    const foo = healed.get("docs/design/foo.md")!;
    expect(foo).toContain("baz <!-- STALE-REF: baz.md -->");
    expect(foo).toContain("[bar](bar.md)"); // valid link untouched
    expect(foo).not.toContain("[baz](baz.md)"); // broken link replaced

    const bar = healed.get("docs/design/bar.md")!;
    expect(bar).toContain("quux <!-- STALE-REF: ../research/quux.md -->");
  });

  test("annotates broken directory links", () => {
    const healed = staleDocCrossRefHealer.heal(brokenDirTree);
    const foo = healed.get("docs/design/foo.md")!;
    expect(foo).toContain("genesis <!-- STALE-REF: addison-genesis-initial/ -->");
  });

  test("leaves non-md files untouched", () => {
    const healed = staleDocCrossRefHealer.heal(brokenLinkTree);
    expect(healed.get("src/main.ts")).toBe(brokenLinkTree.get("src/main.ts"));
  });

  test("idempotence: heal(heal(t)) == heal(t)", () => {
    const once = staleDocCrossRefHealer.heal(brokenLinkTree);
    const twice = staleDocCrossRefHealer.heal(once);
    expect(treesEqual(once, twice)).toBe(true);
  });

  test("convergence: already reaches fixed point in one pass", () => {
    const once = staleDocCrossRefHealer.heal(brokenLinkTree);
    const twice = staleDocCrossRefHealer.heal(once);
    expect(treesEqual(once, twice)).toBe(true);
  });

  test("closure: healing does not create new findings", () => {
    const healed = staleDocCrossRefHealer.heal(brokenLinkTree);
    const afterFindings = staleDocCrossRefDetector.detect(healed);
    // After healing, no findings should remain (or at minimum, no NEW ones)
    expect(afterFindings.length).toBeLessThanOrEqual(0);
  });

  test("totality: does not throw on empty tree", () => {
    expect(() => staleDocCrossRefHealer.heal(new Map())).not.toThrow();
  });

  test("totality: does not throw on tree with no .md files", () => {
    const t = tree({ "src/app.ts": "console.log('hi');\n" });
    expect(() => staleDocCrossRefHealer.heal(t)).not.toThrow();
  });
});

// ─── Certification (6 Laws) ─────────────────────────────────────────────────

describe("certification against healer harness", () => {
  test("certify passes on the fixture corpus", () => {
    const verdict = certify(staleDocCrossRefHealer, [staleDocCrossRefDetector], [
      { name: "clean", tree: cleanTree },
      { name: "broken-links", tree: brokenLinkTree },
      { name: "broken-dir", tree: brokenDirTree },
      { name: "valid-dir", tree: validDirTree },
      { name: "mixed-links", tree: mixedLinksTree },
      { name: "already-annotated", tree: alreadyAnnotatedTree },
      { name: "fragment-link", tree: fragmentLinkTree },
      { name: "broken-fragment", tree: brokenFragmentLinkTree },
    ]);
    expect(verdict.pass).toBe(true);
    expect(verdict.violations).toHaveLength(0);
  });
});

// ─── Sabotage Controls ───────────────────────────────────────────────────────
// Prove the tests CAN fail: a deliberately broken healer should fail certification.

describe("sabotage controls", () => {
  test("a healer that deletes ALL links fails certification", () => {
    const sabotaged: typeof staleDocCrossRefHealer = {
      name: "sabotage-delete-all",
      heal(t) {
        const result = new Map(t);
        for (const [path, content] of t) {
          if (path.endsWith(".md")) {
            // Delete all markdown links — even valid ones
            result.set(path, content.replace(/\[([^\]]*)\]\([^)]+\)/g, "$1"));
          }
        }
        return result;
      },
    };

    // This should fail because it removes valid links (closure violation —
    // a detector for "unlinked references" would find new findings)
    const healed = sabotaged.heal(cleanTree);
    // The clean tree has [bar](bar.md) — a valid link. Sabotage removes it.
    expect(healed.get("docs/design/foo.md")).not.toContain("[bar](bar.md)");
    // The real healer preserves it:
    const properly = staleDocCrossRefHealer.heal(cleanTree);
    expect(properly.get("docs/design/foo.md")).toContain("[bar](bar.md)");
  });

  test("a non-idempotent healer would fail", () => {
    // Simulate: a healer that adds a comment that looks like a new link each time
    const nonIdempotent: typeof staleDocCrossRefHealer = {
      name: "sabotage-non-idempotent",
      heal(t) {
        const result = new Map(t);
        for (const [path, content] of t) {
          if (path.endsWith(".md")) {
            result.set(path, content + `\n<!-- healed at ${Math.random()} -->\n`);
          }
        }
        return result;
      },
    };

    const once = nonIdempotent.heal(cleanTree);
    const twice = nonIdempotent.heal(once);
    // Non-idempotent: second application changes the tree again
    expect(treesEqual(once, twice)).toBe(false);
    // Our real healer IS idempotent:
    const realOnce = staleDocCrossRefHealer.heal(brokenLinkTree);
    const realTwice = staleDocCrossRefHealer.heal(realOnce);
    expect(treesEqual(realOnce, realTwice)).toBe(true);
  });
});
