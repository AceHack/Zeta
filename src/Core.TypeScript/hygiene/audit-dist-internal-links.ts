#!/usr/bin/env bun
// audit-dist-internal-links.ts — every internal href/src in the built Pages artifact resolves.
//
// Why: 2026-08-14 the hall's parent-relative cards (../data/monitor.html, ../demo/,
// ../genesis/, ../inventory/) were reported as 404. They are NOT broken on Zeta's own site —
// all four return 200 under https://lucent-financial-group.github.io/Zeta/. The 404s came from
// a STALE COPY of hall/ committed into the separate org-root repo
// (Lucent-Financial-Group/lucent-financial-group.github.io), which has no demo/, genesis/ or
// inventory/ to point at. The correct fix lives in that repo; the correct action HERE was to
// change nothing and pin the invariant so nobody "repairs" the working links by repointing them.
//
// That is what this guard is for. It does NOT detect the org-root breakage (Zeta never builds
// that site — see LIMITS); it fails when a link inside OUR artifact dangles, and it fails loudly
// if someone edits hall/index.html to point at a target that does not exist.
//
// Base path matters: the artifact is served at /Zeta/, not at /. So a root-absolute href
// "/Zeta/genesis/auth-config.js" maps to dist/genesis/auth-config.js, and a bare "/foo" escapes
// the project site entirely (it would resolve against the ORG ROOT — a different repo). Those
// are reported, because that confusion is precisely the bug class in the report above.
//
// LIMITS (stated so this is not read as more than it is):
//   - Same-repo only. A copy of our HTML deployed to another origin is out of scope.
//   - Existence only. It does not verify fragments (#anchor) or that a page renders.
//   - Source-not-served subtrees are skipped (see NOT_SERVED) — templates that are COPIED to
//     their real location at deploy time legitimately dangle where they sit.
//
// Usage: bun audit-dist-internal-links.ts [--dist <dir>] [--base <path>]
// Exit 0 = every internal link resolves · 1 = lists the danglers.

import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";

/** Subtrees present in the artifact that are NOT served from where they sit. */
const NOT_SERVED: readonly RegExp[] = [
  // Design-tool exports (*.dc.html + sources/) — mockups, carry {{ }} placeholders.
  /^docs\/design\//,
  // Vite dev sources shipped alongside a built app (genesis/_src/main.jsx et al).
  /(^|\/)_src\//,
  // Book language templates: pages-deploy.yml COPIES these to books/<lang>/index.html,
  // where their ../<lang>/ switcher links resolve. In situ they cannot.
  /^docs\/books\/[^/]+\/site\//,
];

export interface Dangler {
  readonly page: string;
  readonly href: string;
  readonly reason: string;
}

export interface AuditResult {
  readonly pages: number;
  readonly checked: number;
  readonly danglers: readonly Dangler[];
}

interface Options {
  readonly dist: string;
  readonly base: string;
}

export function parseArgs(argv: readonly string[]): Options {
  let dist = "dist";
  let base = "/Zeta/";
  for (let i = 0; i < argv.length; i += 1) {
    const next = argv[i + 1];
    if (argv[i] === "--dist" && next !== undefined) {
      dist = next;
      i += 1;
    } else if (argv[i] === "--base" && next !== undefined) {
      base = next;
      i += 1;
    }
  }
  const withLead = base.startsWith("/") ? base : `/${base}`;
  return { dist, base: withLead.endsWith("/") ? withLead : `${withLead}/` };
}

function htmlFilesUnder(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir).sort()) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (entry.endsWith(".html")) out.push(p);
    }
  };
  walk(root);
  return out;
}

// Strip <script> bodies — their contents are code, not markup, and they really do carry
// href=/src= text (document.write('<a href="...">'), template literals). <style> is NOT
// stripped: CSS references links as url(...), which this attribute regex never matches, so
// stripping it would be an untestable branch. Widen both together if the regex ever grows.
function withoutScriptBodies(html: string): string {
  // The end tag is `</script` + a word boundary + anything up to ">" — HTML accepts
  // `</script >` and even `</script\t\n bar>`, and browsers end the script there. Matching
  // only `</script>` leaves the body unstripped, and its href= text is then read as links
  // (false danglers, or a false green). `\b` keeps `</scriptfoo>` from matching.
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script\b[^>]*>/gi, " ");
}

/** True when the href is not an internal path we can resolve against the artifact. */
function isNotAnInternalPath(raw: string): boolean {
  if (raw === "" || raw.startsWith("#")) return true;
  // Absolute URL (https:, mailto:, data:, …) or protocol-relative — not ours to resolve.
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw) || raw.startsWith("//")) return true;
  // Unsubstituted template expressions are not links.
  return raw.includes("${") || raw.includes("{{") || raw.includes("<");
}

/** Drop the query/fragment and percent-decode; "" means "nothing left to resolve". */
function toPathname(raw: string): string {
  const [beforeHash = ""] = raw.split("#");
  const [pathname = ""] = beforeHash.split("?");
  if (pathname === "") return "";
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

/** `undefined` = resolves fine; a string = why it dangles. */
function danglingReason(target: string, root: string): string | undefined {
  if (!existsSync(target)) {
    return `no such file in the artifact (${relative(root, target)})`;
  }
  if (statSync(target).isDirectory() && !existsSync(join(target, "index.html"))) {
    return `directory has no index.html (${relative(root, target)})`;
  }
  return undefined;
}

function checkLink(raw: string, file: string, root: string, basePath: string): string | undefined {
  const pathname = toPathname(raw);
  if (!pathname.startsWith("/")) {
    return danglingReason(resolve(dirname(file), pathname), root);
  }
  if (!pathname.startsWith(basePath)) {
    // Resolves against the ORG ROOT, not this project site — the reported bug class.
    return `root-absolute link escapes the ${basePath} base path`;
  }
  return danglingReason(join(root, pathname.slice(basePath.length)), root);
}

export function auditDistInternalLinks(distDir: string, basePath: string): AuditResult {
  const root = resolve(distDir);
  const danglers: Dangler[] = [];
  let checked = 0;
  let pages = 0;

  for (const file of htmlFilesUnder(root)) {
    const page = relative(root, file).split("\\").join("/");
    if (NOT_SERVED.some((re) => re.test(page))) continue;
    pages += 1;

    const markup = withoutScriptBodies(readFileSync(file, "utf8"));
    for (const match of markup.matchAll(/(?:href|src)\s*=\s*"([^"]*)"/g)) {
      const raw = (match[1] ?? "").trim();
      if (isNotAnInternalPath(raw) || toPathname(raw) === "") continue;
      checked += 1;
      const reason = checkLink(raw, file, root, basePath);
      if (reason !== undefined) danglers.push({ page, href: raw, reason });
    }
  }

  return { pages, checked, danglers };
}

if (import.meta.main) {
  const { dist, base } = parseArgs(Bun.argv.slice(2));
  if (!existsSync(dist)) {
    console.error(`audit-dist-internal-links: no artifact at '${dist}' — run \`bun run pages:build\` first`);
    process.exit(1);
  }
  const { pages, checked, danglers } = auditDistInternalLinks(dist, base);
  if (danglers.length > 0) {
    console.error(`FAIL: ${String(danglers.length)} dangling internal link(s) in '${dist}' (base ${base}):`);
    for (const d of danglers) console.error(`  ${d.page} -> ${d.href}   [${d.reason}]`);
    process.exit(1);
  }
  console.log(
    `ok: ${String(checked)} internal link(s) across ${String(pages)} served page(s) all resolve (base ${base})`,
  );
}
