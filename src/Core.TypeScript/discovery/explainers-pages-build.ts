#!/usr/bin/env bun
// explainers-pages-build -- render docs/explainers/*.md into the Pages artifact as HTML.
//
// Why this exists. `llmtv-pages-static-export` copies the whole `docs/` root into the
// artifact verbatim, so `docs/explainers/riemann-two-thirds-visual.html` is already
// published as a page. Its companion write-up is Markdown, and GitHub Pages serves a
// `.md` as `text/markdown` -- a browser downloads it or shows raw source. That is a
// dead end for the reader the write-up was written for (someone with no background in
// the subject), so the link out of the visual page would have been a link to a file
// download. Rendering it here makes the write-up a page.
//
// The audit (`audit-dist-internal-links.ts`) is the spec, not the obstacle: the visual
// page links to `riemann-two-thirds-for-max.html`, and this script is what makes that
// href resolve inside `dist/`. Run it AFTER the static export -- it writes into the
// tree the export creates.
//
// Deliberately no Markdown dependency. The repo declares none (`markdown-it` and
// `micromark` exist in node_modules only as transitive deps of markdownlint-cli2, and
// reaching into an undeclared transitive is how a build breaks silently), and
// `clone-at-tag-stays-sufficient` argues against adding one for two files. What is
// implemented here is the block/inline subset the explainers actually use, and that
// subset is pinned by tests -- a construct outside it renders as literal text rather
// than as wrong HTML.
//
// Usage: bun explainers-pages-build.ts [--source-dir <repo>] [--out-dir <dist>]

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";

export const EXPLAINERS_PAGES_GENERATED_BY = "explainers-pages-build";

/** Where the sources live in the repo, and where they land in the artifact. */
export const EXPLAINERS_SOURCE_SUBDIR = join("docs", "explainers");

export interface ExplainerPageIo {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

export interface ExplainersBuildOptions {
  readonly sourceDir: string;
  readonly outDir: string;
}

export interface ExplainersBuildSummary {
  readonly sourceDir: string;
  readonly outDir: string;
  readonly rendered: readonly string[];
}

// ---------------------------------------------------------------------------
// inline rendering
// ---------------------------------------------------------------------------

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Stable, ordinal, ASCII-only anchor slug. Same input, same id, every run. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]/)
    .filter((part) => part.length > 0)
    .join("-");
}

/**
 * Sentinel wrapping a stashed inline slot. Plain ASCII on purpose: it has to survive
 * `escapeHtml` untouched, and a control character in a source file is unreadable in a
 * diff. Nothing in the explainer corpus contains this token.
 */
const SLOT = "zZsLoTz";

/**
 * `[text](href)`.
 *
 * sonarjs flags this as a slow-regex security hotspot because it holds two unbounded
 * classes. The input is Markdown committed to this repo and read at build time -- not
 * attacker-controlled, not served at request time -- so the denial-of-service the rule
 * is about cannot occur here. Both classes are also negated (`[^\]]`, `[^)\s]`) and
 * therefore cannot overlap with the literals that follow them, which is what would
 * make the backtracking super-linear in the first place.
 */
// eslint-disable-next-line sonarjs/slow-regex -- build-time input, negated classes; see comment above
const LINK_PATTERN = /\[([^\]]+)\]\(([^)\s]+)\)/g;

/** Where a repo-relative Markdown link is actually readable by a stranger. */
export const REPO_BLOB_BASE = "https://github.com/Lucent-Financial-Group/Zeta/blob/main/";

function isAbsoluteUrl(href: string): boolean {
  return href.startsWith("https://") || href.startsWith("http://") || href.startsWith("mailto:");
}

/** Normalise `a/b/../c` without touching the filesystem. */
function normalizeSegments(segments: readonly string[]): string[] {
  const out: string[] = [];
  for (const segment of segments) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      out.pop();
      continue;
    }
    out.push(segment);
  }
  return out;
}

/**
 * Where a link in an explainer should point once the page is on the site.
 *
 * A relative `.md` link is the one case that silently fails: the file may well be in
 * the artifact -- `docs/` is copied verbatim -- but GitHub Pages serves it as
 * `text/markdown`, so the reader gets a download instead of a document, and a link
 * that climbs above `docs/` (`../../.claude/rules/...`) is not in the artifact at all
 * and dangles outright. Both are answered the same way: send the reader to the file on
 * GitHub, which renders Markdown and is where that material actually lives. Anchors,
 * absolute URLs, and links to real pages (`.html`) are left exactly as written.
 *
 * Note what this is NOT: it is not a way to make `audit-dist-internal-links.ts` quiet.
 * The audit skips absolute URLs, but the target here is a real, public, readable
 * document -- the link is repaired, not hidden.
 */
export function siteHref(href: string): string {
  if (isAbsoluteUrl(href) || href.startsWith("#") || href.startsWith("/")) return href;
  const [path = "", ...rest] = href.split("#");
  if (!path.endsWith(".md")) return href;
  const fragment = rest.length > 0 ? `#${rest.join("#")}` : "";
  const segments = normalizeSegments([...EXPLAINERS_SOURCE_SUBDIR.split("/"), ...path.split("/")]);
  return `${REPO_BLOB_BASE}${segments.join("/")}${fragment}`;
}

/**
 * Inline Markdown to HTML.
 *
 * Code spans and links are lifted into slots BEFORE emphasis runs, so emphasis can
 * never reach inside a code span or corrupt an `href`. Slots are restored last, and
 * repeatedly, because a link's text may itself contain a code span -- which the
 * explainer actually does: [`riemann-two-thirds-visual.html`](...).
 */
export function renderInline(text: string): string {
  const slots: string[] = [];
  const stash = (html: string): string => {
    slots.push(html);
    return `${SLOT}${(slots.length - 1).toString()}${SLOT}`;
  };

  // 1. code spans, raw content preserved
  let work = text.replace(/`([^`]+)`/g, (_match, code: string) => stash(`<code>${escapeHtml(code)}</code>`));

  // 2. everything left is prose
  work = escapeHtml(work);

  // 3. autolinks: <https://example.com>, which step 2 turned into &lt;...&gt;
  work = work.replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, (_match, href: string) =>
    stash(`<a href="${href}" target="_blank" rel="noopener">${href}</a>`),
  );

  // 4. links. `label` may hold code slots; restore happens later.
  work = work.replace(LINK_PATTERN, (_match, label: string, href: string) => {
    const resolved = siteHref(href);
    const rel = isAbsoluteUrl(resolved) ? ' target="_blank" rel="noopener"' : "";
    return stash(`<a href="${resolved}"${rel}>${label}</a>`);
  });

  // 5. emphasis, now that no href or code span is exposed to it
  work = work.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  work = work.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  work = work.replace(/([^A-Za-z0-9]|^)_([^_]+)_(?![A-Za-z0-9])/g, "$1<em>$2</em>");

  // 6. restore, repeatedly: a link slot can contain a code slot
  const slotPattern = new RegExp(`${SLOT}(\\d+)${SLOT}`, "g");
  for (let pass = 0; pass <= slots.length && work.includes(SLOT); pass += 1) {
    work = work.replace(slotPattern, (match, index: string) => slots[Number(index)] ?? match);
  }
  return work;
}

// ---------------------------------------------------------------------------
// block rendering
// ---------------------------------------------------------------------------

/** A recognised block, and the line index parsing should resume at. */
interface Block {
  readonly html: string;
  readonly next: number;
}

type BlockTaker = (lines: readonly string[], start: number) => Block | null;

function at(lines: readonly string[], index: number): string {
  return lines[index] ?? "";
}

function takeFence(lines: readonly string[], start: number): Block | null {
  const opened = /^```(\w*)$/.exec(at(lines, start).trimEnd());
  if (opened === null) return null;
  const body: string[] = [];
  let i = start + 1;
  while (i < lines.length && at(lines, i).trimEnd() !== "```") {
    body.push(at(lines, i));
    i += 1;
  }
  const lang = opened[1] ?? "";
  const cls = lang.length > 0 ? ` class="lang-${escapeHtml(lang)}"` : "";
  return { html: `<pre><code${cls}>${escapeHtml(body.join("\n"))}</code></pre>`, next: i + 1 };
}

function takeThematicBreak(lines: readonly string[], start: number): Block | null {
  const line = at(lines, start).trim();
  const dashes = line.length >= 3 && line.split("").every((ch) => ch === "-");
  const stars = line.length >= 3 && line.split("").every((ch) => ch === "*");
  if (!dashes && !stars) return null;
  return { html: "<hr />", next: start + 1 };
}

function takeHeading(lines: readonly string[], start: number): Block | null {
  const heading = /^(#{1,6})\s(.*)$/.exec(at(lines, start));
  if (heading === null) return null;
  const level = (heading[1] ?? "#").length.toString();
  const raw = (heading[2] ?? "").trim();
  return { html: `<h${level} id="${slugify(raw)}">${renderInline(raw)}</h${level}>`, next: start + 1 };
}

/** `|---|:--:|` and friends: every cell is dashes, optionally colon-anchored. */
function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return false;
  const cells = tableCells(trimmed);
  if (cells.length === 0) return false;
  return cells.every((cell) => {
    const core = cell.replace(/^:/, "").replace(/:$/, "");
    return core.length > 0 && core.split("").every((ch) => ch === "-");
  });
}

function tableCells(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function tableRowHtml(cells: readonly string[], tag: "th" | "td"): string {
  const rendered = cells.map((cell) => `<${tag}>${renderInline(cell)}</${tag}>`).join("");
  return `<tr>${rendered}</tr>`;
}

function takeTable(lines: readonly string[], start: number): Block | null {
  if (!at(lines, start).trim().startsWith("|")) return null;
  if (!isTableSeparator(at(lines, start + 1))) return null;
  const head = tableRowHtml(tableCells(at(lines, start)), "th");
  let i = start + 2;
  const bodyRows: string[] = [];
  while (i < lines.length && at(lines, i).trim().startsWith("|")) {
    bodyRows.push(tableRowHtml(tableCells(at(lines, i)), "td"));
    i += 1;
  }
  const table = `<table><thead>${head}</thead><tbody>${bodyRows.join("")}</tbody></table>`;
  return { html: `<div class="tablewrap">${table}</div>`, next: i };
}

function takeBlockquote(lines: readonly string[], start: number): Block | null {
  if (!at(lines, start).startsWith(">")) return null;
  const body: string[] = [];
  let i = start;
  while (i < lines.length && at(lines, i).startsWith(">")) {
    body.push(at(lines, i).replace(/^>\s?/, ""));
    i += 1;
  }
  return { html: `<blockquote>${renderMarkdownBlocks(body.join("\n"))}</blockquote>`, next: i };
}

/** `- text` / `* text`, or null when the line is not a bullet. */
function bulletContent(line: string): string | null {
  const marker = line.slice(0, 1);
  if (marker !== "-" && marker !== "*") return null;
  if (line.slice(1, 2) !== " ") return null;
  return line.slice(2).trim();
}

/** `12. text`, or null when the line is not an ordered item. */
function orderedContent(line: string): string | null {
  const dot = line.indexOf(". ");
  if (dot <= 0) return null;
  const digits = line.slice(0, dot);
  if (!/^\d+$/.test(digits)) return null;
  return line.slice(dot + 2).trim();
}

function takeList(lines: readonly string[], start: number): Block | null {
  const isBullet = bulletContent(at(lines, start)) !== null;
  const isOrdered = orderedContent(at(lines, start)) !== null;
  if (!isBullet && !isOrdered) return null;

  const contentOf = isBullet ? bulletContent : orderedContent;
  const tag = isBullet ? "ul" : "ol";
  const items: string[] = [];
  let i = start;
  while (i < lines.length) {
    const head = contentOf(at(lines, i));
    if (head === null) break;
    const parts = [head];
    i += 1;
    // two-space lazy continuation: the rest of a wrapped list item
    while (i < lines.length && /^\s{2,}\S/.test(at(lines, i))) {
      parts.push(at(lines, i).trim());
      i += 1;
    }
    items.push(`<li>${renderInline(parts.join(" ").trim())}</li>`);
  }
  return { html: `<${tag}>${items.join("")}</${tag}>`, next: i };
}

/** Order matters: a fence's contents must not be read as any other block. */
const BLOCK_TAKERS: readonly BlockTaker[] = [
  takeFence,
  takeThematicBreak,
  takeHeading,
  takeTable,
  takeBlockquote,
  takeList,
];

/** The block grammar this renderer supports, and nothing beyond it. */
export function renderMarkdownBlocks(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  const paragraph: string[] = [];
  let i = 0;

  const flushParagraph = (): void => {
    if (paragraph.length === 0) return;
    out.push(`<p>${renderInline(paragraph.join(" ").trim())}</p>`);
    paragraph.length = 0;
  };

  while (i < lines.length) {
    const line = at(lines, i);
    if (line.trim().length === 0) {
      flushParagraph();
      i += 1;
      continue;
    }
    const block = BLOCK_TAKERS.reduce<Block | null>((found, take) => found ?? take(lines, i), null);
    if (block === null) {
      paragraph.push(line.trim());
      i += 1;
      continue;
    }
    flushParagraph();
    out.push(block.html);
    i = block.next;
  }

  flushParagraph();
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// page shell
// ---------------------------------------------------------------------------

/** First `# ` heading, or the supplied fallback when the document has none. */
export function extractTitle(markdown: string, fallback: string): string {
  for (const line of markdown.split("\n")) {
    const heading = /^#\s(.*)$/.exec(line);
    if (heading !== null) return (heading[1] ?? "").trim();
  }
  return fallback;
}

/**
 * The token block is copied from `riemann-two-thirds-visual.html` on purpose: the two
 * pages are one artifact and must not disagree about what "dark" means. The site ships
 * no global stylesheet -- `docs/` is copied verbatim into the artifact -- so nothing
 * outside this file can collide with these tokens, and this page restyles nothing of
 * the visual page's.
 */
const PAGE_STYLE = `
:root {
  color-scheme: light dark;
  --bg: #f2f5fb; --panel: #ffffff; --rule: #c3cee3; --rule-soft: #dde4f1;
  --fg: #141d2e; --muted: #5a6b8a; --line: #007e9c; --quote: #0d7f60;
  --shadow: 0 1px 2px rgba(20, 29, 46, 0.06), 0 8px 24px rgba(20, 29, 46, 0.06);
  --mono: ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace;
  --sans: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #060a13; --panel: #0b1121; --rule: #1e2c4c; --rule-soft: #16203a;
    --fg: #dbe4f4; --muted: #8195b6; --line: #63e9ff; --quote: #2ed6a3;
    --shadow: 0 1px 2px rgba(0, 0, 0, 0.5), 0 10px 30px rgba(0, 0, 0, 0.35);
  }
}
:root[data-theme="dark"] {
  --bg: #060a13; --panel: #0b1121; --rule: #1e2c4c; --rule-soft: #16203a;
  --fg: #dbe4f4; --muted: #8195b6; --line: #63e9ff; --quote: #2ed6a3;
  --shadow: 0 1px 2px rgba(0, 0, 0, 0.5), 0 10px 30px rgba(0, 0, 0, 0.35);
}
*, *::before, *::after { box-sizing: border-box; }
html, body { max-width: 100%; overflow-x: hidden; }
body {
  margin: 0; background: var(--bg); color: var(--fg);
  font-family: var(--sans); line-height: 1.62; -webkit-font-smoothing: antialiased;
}
.wrap { max-width: 46rem; margin: 0 auto; padding: 2rem 1.1rem 5rem; }
.crumb { font-size: 0.8rem; margin: 0 0 1.6rem; }
.crumb a { color: var(--line); text-decoration: none; }
.crumb a:hover { text-decoration: underline; }
h1 { font-size: clamp(1.45rem, 4vw, 2.2rem); line-height: 1.18; margin: 0 0 1.2rem; letter-spacing: -0.02em; }
h2 { font-size: clamp(1.1rem, 2.6vw, 1.4rem); margin: 2.4rem 0 0.7rem; letter-spacing: -0.01em; }
h3 { font-size: 1.02rem; margin: 1.8rem 0 0.5rem; }
p { margin: 0 0 1rem; }
a { color: var(--line); }
strong { font-weight: 650; }
hr { border: 0; border-top: 1px solid var(--rule); margin: 2.4rem 0; }
ul, ol { margin: 0 0 1rem; padding-left: 1.3rem; }
li { margin: 0 0 0.45rem; }
blockquote {
  margin: 1.4rem 0; padding: 0.9rem 1.1rem; border-left: 3px solid var(--quote);
  background: var(--panel); border-radius: 0 8px 8px 0; box-shadow: var(--shadow);
}
blockquote p:last-child { margin-bottom: 0; }
code {
  font-family: var(--mono); font-size: 0.88em; background: var(--rule-soft);
  padding: 0.12em 0.32em; border-radius: 4px;
}
pre {
  background: var(--panel); border: 1px solid var(--rule); border-radius: 8px;
  padding: 0.9rem 1rem; overflow-x: auto; margin: 0 0 1.2rem; box-shadow: var(--shadow);
}
pre code { background: none; padding: 0; font-size: 0.85rem; line-height: 1.5; }
.tablewrap { overflow-x: auto; margin: 0 0 1.4rem; }
table { border-collapse: collapse; width: 100%; font-size: 0.9rem; }
th, td { text-align: left; padding: 0.5rem 0.6rem; border-bottom: 1px solid var(--rule-soft); vertical-align: top; }
th {
  border-bottom: 1px solid var(--rule); font-size: 0.78rem; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--muted);
}
.foot {
  margin-top: 3rem; padding-top: 1.2rem; border-top: 1px solid var(--rule);
  font-size: 0.82rem; color: var(--muted);
}
@media (max-width: 30rem) { .wrap { padding: 1.4rem 0.9rem 3.5rem; } }
`.trim();

export interface ExplainerPageOptions {
  readonly title: string;
  readonly bodyHtml: string;
  /** Sibling page offered as the way back; omitted when no such sibling exists. */
  readonly companionHref?: string | undefined;
  readonly companionLabel?: string | undefined;
}

function crumbHtml(href: string | undefined, label: string | undefined): string {
  if (href === undefined) return "";
  const text = escapeHtml(label ?? "the visual");
  return `<p class="crumb"><a href="${href}">&larr; ${text}</a></p>\n`;
}

export function renderExplainerPage(options: ExplainerPageOptions): string {
  const crumb = crumbHtml(options.companionHref, options.companionLabel);
  const footer = `Rendered from the Markdown source in <code>docs/explainers/</code> by <code>${EXPLAINERS_PAGES_GENERATED_BY}</code>. Zeta verified nothing on this page; it is a reading of someone else's work.`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(options.title)}</title>
<meta name="generator" content="${EXPLAINERS_PAGES_GENERATED_BY}" />
<style>
${PAGE_STYLE}
</style>
</head>
<body>
<div class="wrap">
${crumb}${options.bodyHtml}
<p class="foot">${footer}</p>
</div>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// build
// ---------------------------------------------------------------------------

/** ENOENT is "no explainers here", which is a quiet success. Anything else is a fault. */
function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | null)?.code === "ENOENT";
}

/**
 * Names in the source directory, or `null` when there is no such directory.
 *
 * One syscall, one answer: an `existsSync` gate in front of `readdirSync` is a
 * check-then-use race (`lint-check-then-use-file-races.ts`) -- the answer is stale
 * before the use runs, and the failure has to be interpreted anyway.
 */
function explainerSourceNames(sourceDir: string): readonly string[] | null {
  try {
    return readdirSync(sourceDir).sort();
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

/** The companion visual's markup, or `null` when this write-up has no companion. */
function readCompanion(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

export function buildExplainerPages(options: ExplainersBuildOptions): ExplainersBuildSummary {
  const sourceDir = join(options.sourceDir, EXPLAINERS_SOURCE_SUBDIR);
  const outDir = join(options.outDir, EXPLAINERS_SOURCE_SUBDIR);
  const names = explainerSourceNames(sourceDir);
  if (names === null) {
    return { sourceDir, outDir, rendered: [] };
  }
  mkdirSync(outDir, { recursive: true });

  const rendered: string[] = [];
  for (const name of names) {
    if (!name.endsWith(".md")) continue;
    const stem = basename(name, ".md");
    const markdown = readFileSync(join(sourceDir, name), "utf8");
    const companion = `${stem.replace(/-for-max$/, "")}-visual.html`;
    const hasCompanion = readCompanion(join(sourceDir, companion)) !== null;
    const html = renderExplainerPage({
      title: extractTitle(markdown, stem),
      bodyHtml: renderMarkdownBlocks(markdown),
      companionHref: hasCompanion ? companion : undefined,
      companionLabel: "the visual",
    });
    const outPath = join(outDir, `${stem}.html`);
    writeFileSync(outPath, html, "utf8");
    rendered.push(outPath);
  }
  return { sourceDir, outDir, rendered };
}

const USAGE = [
  "Usage:",
  "  bun src/Core.TypeScript/discovery/explainers-pages-build.ts [--source-dir <repo>] [--out-dir <dist>]",
  "",
  "Renders docs/explainers/*.md into <out-dir>/docs/explainers/*.html so the companion",
  "write-ups are pages rather than file downloads. Run AFTER the static export.",
].join("\n");

export function runExplainersPagesBuildCli(argv: readonly string[], io: ExplainerPageIo): number {
  let sourceDir = ".";
  let outDir = "dist";
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--help" || arg === "-h") {
      io.stdout(`${USAGE}\n`);
      return 0;
    }
    if (arg === "--source-dir" && next !== undefined) {
      sourceDir = next;
      i += 1;
    } else if (arg === "--out-dir" && next !== undefined) {
      outDir = next;
      i += 1;
    }
  }
  try {
    const summary = buildExplainerPages({ sourceDir, outDir });
    const where = relative(process.cwd(), summary.outDir) || ".";
    io.stdout(`${EXPLAINERS_PAGES_GENERATED_BY} out=${where} rendered=${summary.rendered.length.toString()}\n`);
    return 0;
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    io.stderr(`${EXPLAINERS_PAGES_GENERATED_BY} failed: ${text}\n`);
    return 1;
  }
}

const systemIo: ExplainerPageIo = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};

if (import.meta.main) {
  process.exit(runExplainersPagesBuildCli(process.argv.slice(2), systemIo));
}
