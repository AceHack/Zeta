import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { auditDistInternalLinks, type Dangler } from "./audit-dist-internal-links";

/** Narrow to exactly one dangler without a non-null assertion. */
function onlyDangler(danglers: readonly Dangler[]): Dangler {
  expect(danglers).toHaveLength(1);
  const [first] = danglers;
  if (first === undefined) throw new Error("expected exactly one dangler");
  return first;
}

/** INTACT minus one entry — the "target disappeared" mutants. */
function without(files: Readonly<Record<string, string>>, drop: string): Record<string, string> {
  return Object.fromEntries(Object.entries(files).filter(([k]) => k !== drop));
}

function fixture(files: Readonly<Record<string, string>>): { dist: string; cleanup: () => void } {
  const dist = mkdtempSync(join(tmpdir(), "audit-dist-internal-links-test-"));
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(dist, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  return { dist, cleanup: (): void => { rmSync(dist, { recursive: true, force: true }); } };
}

/** The real hall shape: four parent-relative cards + four sibling cards. */
const HALL = `<!doctype html><html><body>
<a href="../data/monitor.html">monitor</a>
<a href="../demo/index.html">demo</a>
<a href="../genesis/index.html">genesis</a>
<a href="../inventory/index.html">inventory</a>
<a href="./gallery/">gallery</a>
<a href="./room/">room</a>
<a href="./tv/">tv</a>
<a href="./vault/">vault</a>
<a href="https://github.com/Lucent-Financial-Group/Zeta">source</a>
</body></html>`;

const INTACT: Readonly<Record<string, string>> = {
  "hall/index.html": HALL,
  "data/monitor.html": "<html></html>",
  "demo/index.html": "<html></html>",
  "genesis/index.html": "<html></html>",
  "inventory/index.html": "<html></html>",
  "hall/gallery/index.html": "<html></html>",
  "hall/room/index.html": "<html></html>",
  "hall/tv/index.html": "<html></html>",
  "hall/vault/index.html": "<html></html>",
};

describe("auditDistInternalLinks — the hall link shape", () => {
  test("BASELINE: the hall's real links all resolve; repointing them would be the bug", () => {
    const { dist, cleanup } = fixture(INTACT);
    try {
      const r = auditDistInternalLinks(dist, "/Zeta/");
      expect(r.danglers).toEqual([]);
      // Non-vacuity: the check must actually have looked at all eight internal links.
      expect(r.checked).toBe(8);
    } finally { cleanup(); }
  });

  // MUTANT 1 — the exact mistake this guard exists to prevent: "fixing" a working
  // parent-relative card by repointing it at a target that does not exist.
  test("MUTANT: repointing ../demo/index.html at a nonexistent target fails", () => {
    const { dist, cleanup } = fixture({
      ...INTACT,
      "hall/index.html": HALL.replace("../demo/index.html", "../demo-nope/index.html"),
    });
    try {
      const d = onlyDangler(auditDistInternalLinks(dist, "/Zeta/").danglers);
      expect(d.href).toBe("../demo-nope/index.html");
      expect(d.page).toBe("hall/index.html");
    } finally { cleanup(); }
  });

  // MUTANT 2 — the origin confusion behind the 2026-08-14 report: a root-absolute
  // link resolves against the ORG ROOT, not the /Zeta/ project site.
  test("MUTANT: a root-absolute link escaping the /Zeta/ base path fails", () => {
    const { dist, cleanup } = fixture({
      ...INTACT,
      "hall/index.html": HALL.replace("../demo/index.html", "/demo/index.html"),
    });
    try {
      const d = onlyDangler(auditDistInternalLinks(dist, "/Zeta/").danglers);
      expect(d.reason).toContain("escapes the /Zeta/ base path");
    } finally { cleanup(); }
  });

  // MUTANT 3 — the target disappears from the artifact (a build/copy regression).
  test("MUTANT: deleting a link target fails", () => {
    const { dist, cleanup } = fixture(without(INTACT, "data/monitor.html"));
    try {
      const d = onlyDangler(auditDistInternalLinks(dist, "/Zeta/").danglers);
      expect(d.href).toBe("../data/monitor.html");
    } finally { cleanup(); }
  });

  // MUTANT 4 — a directory link with no index.html serves a 404 on Pages.
  test("MUTANT: a directory link with no index.html fails", () => {
    const { dist, cleanup } = fixture({ ...without(INTACT, "hall/gallery/index.html"), "hall/gallery/notes.txt": "x" });
    try {
      const d = onlyDangler(auditDistInternalLinks(dist, "/Zeta/").danglers);
      expect(d.href).toBe("./gallery/");
      expect(d.reason).toContain("no index.html");
    } finally { cleanup(); }
  });
});

describe("auditDistInternalLinks — resolution rules", () => {
  test("root-absolute links under the base path resolve to the artifact root", () => {
    const { dist, cleanup } = fixture({
      "genesis/index.html": `<script src="/Zeta/genesis/auth-config.js"></script><a href="/Zeta/genesis/auth-config.js">c</a>`,
      "genesis/auth-config.js": "//",
    });
    try {
      expect(auditDistInternalLinks(dist, "/Zeta/").danglers).toEqual([]);
    } finally { cleanup(); }
  });

  test("external, fragment, and template-expression hrefs are not treated as links", () => {
    const { dist, cleanup } = fixture({
      "p/index.html": `<a href="https://example.com/x">a</a><a href="//cdn/x">b</a>
        <a href="mailto:x@y.z">c</a><a href="#top">d</a><a href="">e</a>
        <a href="{{ sceneHref }}">f</a>`,
    });
    try {
      const r = auditDistInternalLinks(dist, "/Zeta/");
      expect(r.danglers).toEqual([]);
      expect(r.checked).toBe(0);
    } finally { cleanup(); }
  });

  // Each end-tag form CodeQL's js/bad-tag-filter names is exercised: two rounds of that
  // query drove this regex (`</script>` -> `</script\s*>` -> `</script\b[^>]*>`), so the
  // forms are pinned here rather than rediscovered.
  // Uses a PLAIN dangling href inside the script — not a template expression — so this test
  // pins the stripping itself rather than leaning on the ${...} guard. (A surviving mutant
  // caught the weaker version: with a template-expression payload, removing the strip passed.)
  test.each([
    ["plain", "</script>"],
    ["space before >", "</script >"],
    ["whitespace + junk", "</script\t\n bar>"],
  ])("script bodies are not scanned — end tag %s", (_label, endTag) => {
    const { dist, cleanup } = fixture({
      "p/index.html": `<script>document.write('<a href="./ghost.html">x</a>');${endTag}
        <style>@import url("./ghost.css"); a{background:url("./ghost.png")}</style>
        <a href="./real.html">real</a>`,
      "p/real.html": "<html></html>",
    });
    try {
      const r = auditDistInternalLinks(dist, "/Zeta/");
      expect(r.danglers).toEqual([]);
      // Only the one real markup link is counted; the script's href is not a link.
      expect(r.checked).toBe(1);
    } finally { cleanup(); }
  });

  // Each suffix appears ALONE as well as combined — a combined-only fixture let a mutant
  // that stopped stripping "#" survive, because the "?" split still salvaged the path.
  // `</scriptfoo>` is NOT an end tag — the `\b` is what stops the regex ending the script
  // there and scanning the rest of the body. Without it this fixture reports a dangler.
  test("a lookalike end tag does not terminate the script body", () => {
    const { dist, cleanup } = fixture({
      "p/index.html": `<script>var a = "</scriptfoo>"; document.write('<a href="./ghost.html">x</a>');</script>
        <a href="./real.html">real</a>`,
      "p/real.html": "<html></html>",
    });
    try {
      const r = auditDistInternalLinks(dist, "/Zeta/");
      expect(r.danglers).toEqual([]);
      expect(r.checked).toBe(1);
    } finally { cleanup(); }
  });

  test.each([
    ["query only", "../t/index.html?v=2"],
    ["fragment only", "../t/index.html#frag"],
    ["both", "../t/index.html?v=2#frag"],
    ["fragment on a directory link", "../t/#frag"],
  ])("query/fragment stripped before resolving: %s", (_label, href) => {
    const { dist, cleanup } = fixture({
      "p/index.html": `<a href="${href}">t</a>`,
      "t/index.html": "<html></html>",
    });
    try {
      const r = auditDistInternalLinks(dist, "/Zeta/");
      expect(r.danglers).toEqual([]);
      expect(r.checked).toBe(1);
    } finally { cleanup(); }
  });

  test("source-not-served subtrees are skipped, and skipping is scoped", () => {
    const { dist, cleanup } = fixture({
      // Template copied elsewhere at deploy time — dangles in situ, legitimately skipped.
      "docs/books/you-born-at-the-hinge/site/index.en.html": `<a href="../ko/">ko</a>`,
      "docs/design/root-site-iris/Dark Hall.dc.html": `<a href="hall/index.html">h</a>`,
      "genesis/_src/index.html": `<script src="/src/main.jsx"></script><a href="/src/main.jsx">m</a>`,
      // A normal page under docs/ is still checked — the skip must not swallow the tree.
      "docs/notes/index.html": `<a href="./missing.html">m</a>`,
    });
    try {
      const d = onlyDangler(auditDistInternalLinks(dist, "/Zeta/").danglers);
      expect(d.page).toBe("docs/notes/index.html");
    } finally { cleanup(); }
  });
});
