/**
 * stale-doc-cross-ref healer — Tier 0 (zero intelligence).
 *
 * Detects: broken relative-path cross-references in markdown files.
 *   - `[text](relative/path.md)` where the target does not exist in the tree
 *   - `[text](../../some/dir/)` where the target directory does not exist
 *   - Only checks relative paths (not URLs, not anchors, not absolute paths)
 *
 * Fixes: comments out the broken link with a `<!-- STALE-REF: ... -->` annotation,
 * converting `[text](broken-path)` → `text <!-- STALE-REF: broken-path -->`
 *
 * This preserves the link text (the human-readable part) while making the breakage
 * visible and grep-able. A human or higher-tier healer can then decide whether to
 * update the path, remove the reference, or restore it when the target reappears.
 *
 * WHY THIS MATTERS: cross-references between design docs, handoffs, and research
 * papers rot silently as files move or get renamed. A reader following a link to
 * understand context hits a 404 (GitHub) or a broken relative path (local). The
 * broken link provides NEGATIVE value — it promises context and delivers nothing,
 * wasting the reader's time and eroding trust in the documentation.
 *
 * SCOPE: markdown files only (*.md). Checks `[text](path)` syntax — not bare URLs,
 * not `<img src>`, not HTML links. Ignores:
 *   - URLs (http://, https://, mailto:, etc.)
 *   - Anchor-only links (#section)
 *   - Absolute paths (/root/...)
 *   - Empty hrefs
 *
 * Laws:
 * - Idempotence: an already-annotated stale ref stays annotated ✓
 * - Closure: annotating a broken link cannot introduce new findings ✓
 *   (the annotation is a comment, not a new link)
 * - Convergence: one pass (no cycles — a commented link is no longer a link) ✓
 * - Totality: never throws ✓
 * - Exit: if no stale refs found, returns unchanged ✓
 * - Bounded scope: one drift class (broken markdown cross-references) ✓
 */

import type { Healer, Detector, Finding, FileTree } from "../healer-harness";
import { dirname, join, normalize } from "node:path";

/**
 * Markdown link regex: matches `[text](href)` where href is the relative path.
 * Does NOT match image links `![alt](src)` — those are a different concern.
 * Captures: group 1 = full match text, group 2 = link text, group 3 = href
 */
const MD_LINK_RE = /(?<!!)\[([^\]]*)\]\(([^)]+)\)/g;

/** Things we do NOT check: URLs, anchors, absolute paths, empty. */
function isCheckable(href: string): boolean {
  if (href.length === 0) return false;
  if (href.startsWith("#")) return false; // anchor-only
  if (href.startsWith("/")) return false; // absolute path
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return false; // URL scheme (http:, mailto:, etc.)
  return true;
}

/** Strip fragment (#...) from href to get the path portion. */
function hrefPath(href: string): string {
  const hashIdx = href.indexOf("#");
  return hashIdx >= 0 ? href.slice(0, hashIdx) : href;
}

/**
 * Resolve a relative path from a markdown file's location against the file tree.
 * Returns true if the target exists (as a file or as a directory prefix).
 */
function targetExists(fromFile: string, href: string, tree: FileTree): boolean {
  const pathPart = hrefPath(href);
  if (pathPart.length === 0) return true; // pure anchor after stripping — valid

  const dir = dirname(fromFile);
  const resolved = normalize(join(dir, pathPart));

  // Exact file match
  if (tree.has(resolved)) return true;

  // Directory match: if href ends with `/`, check if any file starts with that prefix
  if (pathPart.endsWith("/")) {
    const prefix = resolved.endsWith("/") ? resolved : resolved + "/";
    for (const path of tree.keys()) {
      if (path.startsWith(prefix)) return true;
    }
    return false;
  }

  // Also try as directory (href without trailing slash might be a dir)
  const asDir = resolved + "/";
  for (const path of tree.keys()) {
    if (path.startsWith(asDir)) return true;
  }

  return false;
}

/** The annotation marker — grep-able, XML-comment so markdown renderers ignore it. */
const STALE_MARKER = "STALE-REF";

export const staleDocCrossRefDetector: Detector = {
  name: "stale-doc-cross-ref",
  detect(tree: FileTree): readonly Finding[] {
    const findings: Finding[] = [];
    for (const [path, content] of tree) {
      if (!path.endsWith(".md")) continue;

      // Skip files that are themselves stale (e.g., in a .git or node_modules — but those
      // are already excluded by the tier-0 runner's collectFiles, so this is belt-and-suspenders)
      let match: RegExpExecArray | null;
      const re = new RegExp(MD_LINK_RE.source, MD_LINK_RE.flags);
      while ((match = re.exec(content)) !== null) {
        const href = match[2]!;
        if (!isCheckable(href)) continue;

        // Already annotated? Skip (idempotence)
        if (content.includes(`<!-- ${STALE_MARKER}: ${href} -->`)) continue;

        if (!targetExists(path, href, tree)) {
          findings.push({
            path,
            rule: "STALE-DOC-XREF",
            detail: `broken link [${match[1]}](${href}) — target does not exist`,
          });
        }
      }
    }
    return findings;
  },
};

export const staleDocCrossRefHealer: Healer = {
  name: "stale-doc-cross-ref",
  heal(tree: FileTree): FileTree {
    const result = new Map(tree);

    for (const [path, content] of tree) {
      if (!path.endsWith(".md")) continue;

      let healed = content;
      let changed = false;

      // Process all links in the file
      const re = new RegExp(MD_LINK_RE.source, MD_LINK_RE.flags);
      // We need to process from end to start to avoid offset shifts
      const matches: { start: number; end: number; text: string; href: string }[] = [];
      let match: RegExpExecArray | null;
      while ((match = re.exec(content)) !== null) {
        const href = match[2]!;
        if (!isCheckable(href)) continue;
        // Already annotated? Skip
        if (content.includes(`<!-- ${STALE_MARKER}: ${href} -->`)) continue;

        if (!targetExists(path, href, tree)) {
          matches.push({
            start: match.index,
            end: match.index + match[0].length,
            text: match[1]!,
            href,
          });
        }
      }

      // Apply replacements from end to start (preserves indices)
      for (let i = matches.length - 1; i >= 0; i--) {
        const m = matches[i]!;
        const replacement = `${m.text} <!-- ${STALE_MARKER}: ${m.href} -->`;
        healed = healed.slice(0, m.start) + replacement + healed.slice(m.end);
        changed = true;
      }

      if (changed) {
        result.set(path, healed);
      }
    }

    return result;
  },
};
