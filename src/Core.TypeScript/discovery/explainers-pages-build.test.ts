import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildExplainerPages,
  escapeHtml,
  extractTitle,
  renderExplainerPage,
  renderInline,
  renderMarkdownBlocks,
  REPO_BLOB_BASE,
  runExplainersPagesBuildCli,
  siteHref,
  slugify,
  type ExplainerPageIo,
} from "./explainers-pages-build";

const tempRoots: string[] = [];

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "zeta-explainers-"));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root !== undefined) rmSync(root, { recursive: true, force: true });
  }
});

describe("escaping", () => {
  it("neutralises the four characters that could inject markup", () => {
    expect(escapeHtml(`<script>&"`)).toBe("&lt;script&gt;&amp;&quot;");
  });

  it("escapes prose before emphasis runs, so a literal tag stays literal", () => {
    expect(renderInline("a <b> tag")).toBe("a &lt;b&gt; tag");
  });
});

describe("slugify", () => {
  it("is ordinal and ASCII-only", () => {
    expect(slugify("9. What this is NOT -- and the ceiling")).toBe("9-what-this-is-not-and-the-ceiling");
  });

  it("is stable: the same heading yields the same id", () => {
    expect(slugify("Two thirds")).toBe(slugify("Two thirds"));
  });
});

describe("inline rendering", () => {
  it("renders a link whose text is a code span -- the case the explainer actually uses", () => {
    expect(renderInline("see [`riemann-two-thirds-visual.html`](riemann-two-thirds-visual.html) now")).toBe(
      'see <a href="riemann-two-thirds-visual.html"><code>riemann-two-thirds-visual.html</code></a> now',
    );
  });

  it("does not let emphasis reach inside a code span", () => {
    expect(renderInline("`a*b*c`")).toBe("<code>a*b*c</code>");
  });

  it("does not let emphasis corrupt an href", () => {
    expect(renderInline("[x](a_b_c.html)")).toBe('<a href="a_b_c.html">x</a>');
  });

  it("marks external links noopener and leaves internal ones alone", () => {
    expect(renderInline("[a](https://example.com/x)")).toBe(
      '<a href="https://example.com/x" target="_blank" rel="noopener">a</a>',
    );
    expect(renderInline("[a](./x.html)")).toBe('<a href="./x.html">a</a>');
  });

  it("renders bare autolinks", () => {
    expect(renderInline("<https://example.com/repo>")).toBe(
      '<a href="https://example.com/repo" target="_blank" rel="noopener">https://example.com/repo</a>',
    );
  });

  it("renders strong and em", () => {
    expect(renderInline("**bold** and *italic*")).toBe("<strong>bold</strong> and <em>italic</em>");
  });
});

describe("siteHref -- where a repo-relative link should point on the site", () => {
  it("sends a .md that climbs above docs/ to the file on GitHub", () => {
    expect(siteHref("../../.claude/rules/anchor-to-human-prior-art.md")).toBe(
      `${REPO_BLOB_BASE}.claude/rules/anchor-to-human-prior-art.md`,
    );
  });

  it("sends a .md that IS in the artifact to GitHub too -- Pages serves it as a download", () => {
    expect(siteHref("../ip-questionable/a-ferry.md")).toBe(`${REPO_BLOB_BASE}docs/ip-questionable/a-ferry.md`);
  });

  it("keeps the fragment", () => {
    expect(siteHref("../x.md#section-3")).toBe(`${REPO_BLOB_BASE}docs/x.md#section-3`);
  });

  it("leaves a real page alone -- this is the sibling the reader is meant to reach", () => {
    expect(siteHref("riemann-two-thirds-visual.html")).toBe("riemann-two-thirds-visual.html");
  });

  it("leaves absolute URLs and anchors alone", () => {
    expect(siteHref("https://example.com/x.md")).toBe("https://example.com/x.md");
    expect(siteHref("#a-heading")).toBe("#a-heading");
  });

  it("marks the rewritten link external in the rendered output", () => {
    expect(renderInline("[rule](../../.claude/rules/x.md)")).toBe(
      `<a href="${REPO_BLOB_BASE}.claude/rules/x.md" target="_blank" rel="noopener">rule</a>`,
    );
  });
});

describe("block rendering", () => {
  it("renders headings with anchor ids", () => {
    expect(renderMarkdownBlocks("## The scatter")).toBe('<h2 id="the-scatter">The scatter</h2>');
  });

  it("joins a wrapped paragraph into one <p>", () => {
    expect(renderMarkdownBlocks("one\ntwo\n\nthree")).toBe("<p>one two</p>\n<p>three</p>");
  });

  it("renders a fenced block verbatim, escaped, never as markup", () => {
    expect(renderMarkdownBlocks("```text\n1 < 2 & 3\n```")).toBe(
      '<pre><code class="lang-text">1 &lt; 2 &amp; 3</code></pre>',
    );
  });

  it("does not treat a list dash as a thematic break", () => {
    expect(renderMarkdownBlocks("- a\n- b")).toBe("<ul><li>a</li><li>b</li></ul>");
    expect(renderMarkdownBlocks("---")).toBe("<hr />");
  });

  it("folds a two-space continuation line into its list item", () => {
    expect(renderMarkdownBlocks("- first\n  continued\n- second")).toBe(
      "<ul><li>first continued</li><li>second</li></ul>",
    );
  });

  it("renders an ordered list as <ol>", () => {
    expect(renderMarkdownBlocks("1. a\n2. b")).toBe("<ol><li>a</li><li>b</li></ol>");
  });

  it("renders a blockquote by parsing its contents as blocks", () => {
    expect(renderMarkdownBlocks("> **Every one** sits on the line.")).toBe(
      "<blockquote><p><strong>Every one</strong> sits on the line.</p></blockquote>",
    );
  });

  it("renders a pipe table with a head and a body", () => {
    const html = renderMarkdownBlocks("| year | who |\n|---|---|\n| 1942 | Selberg |");
    expect(html).toContain("<th>year</th><th>who</th>");
    expect(html).toContain("<td>1942</td><td>Selberg</td>");
  });

  it("is deterministic: the same input renders byte-identically", () => {
    const md = "# t\n\n- a\n\n> q\n\n| a |\n|---|\n| b |\n";
    expect(renderMarkdownBlocks(md)).toBe(renderMarkdownBlocks(md));
  });

  it("leaves an unsupported construct as literal text rather than wrong HTML", () => {
    // Nested lists are outside the supported subset. The honest failure is a flat
    // list, not silently-dropped content -- the words still reach the reader.
    expect(renderMarkdownBlocks("- a\n  - b")).toContain("b");
  });
});

describe("extractTitle", () => {
  it("takes the first h1", () => {
    expect(extractTitle("# Two thirds\n\n## later", "fallback")).toBe("Two thirds");
  });

  it("falls back when the document has no h1", () => {
    expect(extractTitle("## only an h2", "fallback")).toBe("fallback");
  });
});

describe("page shell", () => {
  it("is self-contained: no external stylesheet, script, or image", () => {
    const html = renderExplainerPage({ title: "t", bodyHtml: "<p>x</p>" });
    expect(html).not.toContain("<link");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
  });

  it("carries both theme mechanisms the visual page uses", () => {
    const html = renderExplainerPage({ title: "t", bodyHtml: "<p>x</p>" });
    expect(html).toContain("prefers-color-scheme: dark");
    expect(html).toContain(':root[data-theme="dark"]');
  });

  it("escapes the title", () => {
    expect(renderExplainerPage({ title: "a <b> c", bodyHtml: "" })).toContain("<title>a &lt;b&gt; c</title>");
  });

  it("omits the crumb when there is no companion", () => {
    expect(renderExplainerPage({ title: "t", bodyHtml: "" })).not.toContain('class="crumb"');
  });
});

describe("build", () => {
  it("renders each .md beside where the copied docs tree puts it", () => {
    const root = tempRoot();
    const out = tempRoot();
    mkdirSync(join(root, "docs", "explainers"), { recursive: true });
    writeFileSync(join(root, "docs", "explainers", "sample-for-max.md"), "# Sample\n\ntext\n", "utf8");
    writeFileSync(join(root, "docs", "explainers", "sample-visual.html"), "<p>v</p>", "utf8");

    const summary = buildExplainerPages({ sourceDir: root, outDir: out });

    expect(summary.rendered).toHaveLength(1);
    const page = join(out, "docs", "explainers", "sample-for-max.html");
    // Read it, do not first ask whether it is there: the read IS the existence
    // assertion, and an existsSync gate in front of it is a check-then-use race.
    const html = readFileSync(page, "utf8");
    expect(summary.rendered).toContain(page);
    expect(html).toContain("<title>Sample</title>");
    expect(html).toContain('href="sample-visual.html"');
  });

  it("omits the crumb when the companion visual does not exist", () => {
    const root = tempRoot();
    const out = tempRoot();
    mkdirSync(join(root, "docs", "explainers"), { recursive: true });
    writeFileSync(join(root, "docs", "explainers", "lonely-for-max.md"), "# L\n", "utf8");

    buildExplainerPages({ sourceDir: root, outDir: out });

    const html = readFileSync(join(out, "docs", "explainers", "lonely-for-max.html"), "utf8");
    expect(html).not.toContain('class="crumb"');
  });

  it("is idempotent: a second run leaves byte-identical output", () => {
    const root = tempRoot();
    const out = tempRoot();
    mkdirSync(join(root, "docs", "explainers"), { recursive: true });
    writeFileSync(join(root, "docs", "explainers", "x-for-max.md"), "# X\n\n- a\n", "utf8");

    buildExplainerPages({ sourceDir: root, outDir: out });
    const first = readFileSync(join(out, "docs", "explainers", "x-for-max.html"), "utf8");
    buildExplainerPages({ sourceDir: root, outDir: out });
    const second = readFileSync(join(out, "docs", "explainers", "x-for-max.html"), "utf8");

    expect(second).toBe(first);
  });

  it("is quiet and successful when there is no explainers directory", () => {
    const root = tempRoot();
    const out = tempRoot();
    const summary = buildExplainerPages({ sourceDir: root, outDir: out });
    expect(summary.rendered).toHaveLength(0);
  });
});

describe("cli", () => {
  it("reports what it rendered and exits 0", () => {
    const root = tempRoot();
    const out = tempRoot();
    mkdirSync(join(root, "docs", "explainers"), { recursive: true });
    writeFileSync(join(root, "docs", "explainers", "a-for-max.md"), "# A\n", "utf8");

    const stdout: string[] = [];
    const io: ExplainerPageIo = { stdout: (t) => stdout.push(t), stderr: () => undefined };
    const code = runExplainersPagesBuildCli(["--source-dir", root, "--out-dir", out], io);

    expect(code).toBe(0);
    expect(stdout.join("")).toContain("rendered=1");
  });

  it("prints usage for --help", () => {
    const stdout: string[] = [];
    const io: ExplainerPageIo = { stdout: (t) => stdout.push(t), stderr: () => undefined };
    expect(runExplainersPagesBuildCli(["--help"], io)).toBe(0);
    expect(stdout.join("")).toContain("Usage:");
  });
});
