#!/usr/bin/env bun
// audit-concept-registry-drift.ts — keeps `docs/CONCEPT-REGISTRY.md` and the published
// Genesis Concepts page from drifting apart.
//
// WHY THIS FILE EXISTS
// --------------------
// Addison Cooper wrote the Genesis concept vocabulary (2026-06-20). It was published as
// `docs/design/root-site-iris/site/concepts.html` and hand-copied to the
// `lucent-financial-group.github.io` repository — a DIFFERENT repository, with no build step
// and no CI (see `docs/design/root-site-iris/HANDOFF.md`).
//
// Then the repo kept going. Four more society-identity terms landed in `docs/GLOSSARY.md`
// on 2026-07-31 (PR #9829) and never reached the page. Nothing noticed, because nothing was
// looking: the page's only relationship to the repo's vocabulary was that a human once
// copied one into the other.
//
// Aaron, 2026-08-16: "we recently added some more termonology i guess it didn't make it back
// to that webpage ... we should keep a list of addions and the few news ones somewhere we can
// update easily."
//
// `docs/CONCEPT-REGISTRY.md` is that list. This audit is the reason it will still be true in
// a month. A registry with no checker is a second surface to drift, not a fix.
//
// WHAT IT CHECKS
// --------------
//   1. PAGE ⊆ REGISTRY   — every concept on the published page has a registry row.
//   2. REGISTRY ⊆ PAGE   — every row marked `On page: yes` is actually on the page.
//   3. DEFINITIONS MATCH — for those rows, the registry's text equals the page's summary
//                          line EXACTLY. This is the check that catches a reworded
//                          definition, which is the failure mode a term-name-only check
//                          would sail straight past.
//   4. `no` MEANS NO     — a row marked `On page: no` must not appear on the page. Otherwise
//                          the registry silently understates what is published.
//   5. VARIANTS AGREE    — the design-tool authoring originals (`Genesis Concepts.dc.html`
//                          and `sources/Genesis Concepts.dc.html`) carry the same concept
//                          set as the deployed page. Three files, one vocabulary.
//   6. ATTRIBUTION       — every row names an author and a date. A concept with no human
//                          behind it is a debt (`.claude/rules/anchor-to-human-prior-art.md`),
//                          and Addison's authorship is the specific thing this registry
//                          exists to keep legible.
//
// NO THRESHOLDS. Every quantity this audit uses is derived from the two files it reads —
// there is no expected-count constant to go stale, and nothing to attribute on the record.
//
// Scope note: this reads the IN-REPO copy of the page, which was byte-identical to the live
// `https://lucent-financial-group.github.io/concepts.html` when this audit was written
// (sha256 8860c8e75eacb5cc21fd7d3ce756c984ade289f63012bf3c042fe50a3a3359ec). It deliberately
// makes no network call: CI must not depend on a third-party host being up, and the in-repo
// file is the artifact a PR can actually change.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "..", "..", "..");

export const REGISTRY = "docs/CONCEPT-REGISTRY.md";
export const PUBLISHED_PAGE = "docs/design/root-site-iris/site/concepts.html";
export const PAGE_VARIANTS = [
  "docs/design/root-site-iris/Genesis Concepts.dc.html",
  "docs/design/root-site-iris/sources/Genesis Concepts.dc.html",
];

/** Ordinal compare. `localeCompare` is culture-sensitive and is a live tripwire here. */
export function ordinal(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Cell access on a possibly-short row, without an index-access assertion. */
function at(cells: readonly string[], i: number): string {
  return cells[i] ?? "";
}

export interface RegistryRow {
  readonly term: string;
  readonly definition: string;
  readonly author: string;
  readonly added: string;
  readonly onPage: boolean;
  readonly line: number;
}

export interface PageConcept {
  readonly term: string;
  readonly definition: string;
}

/**
 * Parse the `## 1. The registry` table. Scoped to that section on purpose — the file holds
 * other tables (Addison's own §4 ontology, the surface map) that are documentation, not the
 * registry, and must not be read as rows.
 */
export function parseRegistry(markdown: string): RegistryRow[] {
  const lines = markdown.split("\n");
  const start = lines.findIndex((l) => l.startsWith("## 1. The registry"));
  if (start < 0) throw new Error(`${REGISTRY}: no "## 1. The registry" section found`);
  const end = lines.findIndex((l, i) => i > start && l.startsWith("### "));
  const body = lines.slice(start, end < 0 ? lines.length : end);

  const rows: RegistryRow[] = [];
  for (let i = 0; i < body.length; i++) {
    const raw = body[i] ?? "";
    if (!raw.startsWith("|")) continue;
    const cells = raw
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length !== 5) continue;
    const term = at(cells, 0);
    const onPageCell = at(cells, 4);
    const line = start + i + 1;
    if (term === "Term") continue; // header
    if (/^-+$/.test(term.replace(/[: ]/g, "-"))) continue; // separator
    if (onPageCell !== "yes" && onPageCell !== "no") {
      throw new Error(
        `${REGISTRY}:${String(line)}: "${term}" — ` +
          `"On page" must be exactly "yes" or "no", got "${onPageCell}"`,
      );
    }
    rows.push({
      term,
      definition: at(cells, 1),
      author: at(cells, 2),
      added: at(cells, 3),
      onPage: onPageCell === "yes",
      line,
    });
  }
  return rows;
}

/**
 * Pull the concepts out of the page. Each is a `<details>` whose `<summary>` carries the
 * term and its one-line definition in adjacent spans; the chevron span ("+") is chrome.
 */
export function parsePage(html: string): PageConcept[] {
  const out: PageConcept[] = [];
  for (const block of html.split("<details").slice(1)) {
    const close = block.indexOf("</summary>");
    if (close < 0) continue;
    const spans = spanTexts(block.slice(0, close)).filter((s) => s.length > 0 && s !== "+");
    const [term, definition] = spans;
    if (term === undefined || definition === undefined) continue;
    out.push({ term, definition });
  }
  return out;
}

/**
 * Inner text of each `<span>` in a fragment.
 *
 * Split-based rather than a `<span[^>]*>([\s\S]*?)</span>` match: that pattern pairs a lazy
 * any-character run with an unbounded attribute run, which is the super-linear-backtracking
 * shape (`sonarjs/slow-regex`). These spans carry long inline `style="…"` attributes, so the
 * risk is not hypothetical. Splitting is linear and needs no catastrophic-input reasoning.
 */
function spanTexts(fragment: string): string[] {
  const out: string[] = [];
  for (const part of fragment.split("</span>")) {
    const open = part.lastIndexOf("<span");
    if (open < 0) continue;
    const gt = part.indexOf(">", open);
    if (gt < 0) continue;
    out.push(stripTags(part.slice(gt + 1)).trim());
  }
  return out;
}

/**
 * Drop any nested markup (`<b>`, `<i>`) from a text run.
 *
 * A scanner rather than `replace(/<[^>]*>/g, "")` for the same reason as above: the linter
 * refuses unbounded runs inside tag patterns on untrusted-length input, and a suppression
 * comment would be a claim about safety instead of a demonstration of it. This loop is
 * obviously linear.
 */
function stripTags(text: string): string {
  let out = "";
  let depth = 0;
  for (const ch of text) {
    if (ch === "<") depth++;
    else if (ch === ">") {
      if (depth > 0) depth--;
    } else if (depth === 0) out += ch;
  }
  return out;
}

/** Check 1 (+ duplicate terms): everything published must be registered, exactly once. */
function checkPageIsRegistered(rows: RegistryRow[], page: PageConcept[]): string[] {
  const failures: string[] = [];
  const registered = new Set(rows.map((r) => r.term));
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.term)) {
      failures.push(`${REGISTRY}:${String(r.line)}: duplicate term "${r.term}"`);
    }
    seen.add(r.term);
  }
  for (const c of page) {
    if (registered.has(c.term)) continue;
    failures.push(
      `"${c.term}" is published on the page but has no row in ${REGISTRY}. ` +
        `Add: | ${c.term} | ${c.definition} | <author> | <date> | yes |`,
    );
  }
  return failures;
}

/** Checks 2, 3, 4 and 6, for one registry row. */
function checkRow(row: RegistryRow, onPage: PageConcept | undefined): string[] {
  const failures: string[] = [];
  const where = `${REGISTRY}:${String(row.line)}`;
  if (row.onPage && onPage === undefined) {
    failures.push(
      `${where}: "${row.term}" is marked "On page: yes" but is not on ${PUBLISHED_PAGE}. ` +
        `Either publish it or set "On page" to "no".`,
    );
  }
  if (!row.onPage && onPage !== undefined) {
    failures.push(
      `${where}: "${row.term}" is marked "On page: no" but IS on ${PUBLISHED_PAGE}. ` +
        `Set "On page" to "yes".`,
    );
  }
  if (row.onPage && onPage !== undefined && row.definition !== onPage.definition) {
    failures.push(
      `${where}: "${row.term}" definition disagrees with ${PUBLISHED_PAGE}.\n` +
        `    registry: ${row.definition}\n` +
        `    page:     ${onPage.definition}`,
    );
  }
  if (row.author.length === 0) {
    failures.push(`${where}: "${row.term}" has no author (see anchor-to-human-prior-art.md)`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.added)) {
    failures.push(
      `${where}: "${row.term}" has no valid "Added" date (want YYYY-MM-DD, got "${row.added}")`,
    );
  }
  return failures;
}

/** Check 5: the design-tool originals carry the same concept set as the deployed page. */
function checkVariants(publishedTerms: string[]): string[] {
  const failures: string[] = [];
  for (const variant of PAGE_VARIANTS) {
    let variantText: string;
    try {
      variantText = readFileSync(join(repoRoot, variant), "utf8");
    } catch {
      failures.push(`${variant}: missing — the page variants must stay together`);
      continue;
    }
    const variantTerms = parsePage(variantText)
      .map((c) => c.term)
      .sort(ordinal);
    if (variantTerms.join(" ") === publishedTerms.join(" ")) continue;
    const onlyVariant = variantTerms.filter((t) => !publishedTerms.includes(t));
    const onlyPage = publishedTerms.filter((t) => !variantTerms.includes(t));
    const detail =
      (onlyVariant.length > 0 ? `\n    only in variant: ${onlyVariant.join(", ")}` : "") +
      (onlyPage.length > 0 ? `\n    only on page:    ${onlyPage.join(", ")}` : "");
    failures.push(`${variant} and ${PUBLISHED_PAGE} carry different concept sets.${detail}`);
  }
  return failures;
}

export function main(): number {
  const rows = parseRegistry(readFileSync(join(repoRoot, REGISTRY), "utf8"));
  const page = parsePage(readFileSync(join(repoRoot, PUBLISHED_PAGE), "utf8"));

  const failures: string[] = [];
  if (rows.length === 0) failures.push(`${REGISTRY}: the registry table is empty`);
  if (page.length === 0) failures.push(`${PUBLISHED_PAGE}: no concepts parsed`);

  const pageByTerm = new Map(page.map((c) => [c.term, c]));
  failures.push(...checkPageIsRegistered(rows, page));
  for (const row of rows) failures.push(...checkRow(row, pageByTerm.get(row.term)));
  failures.push(...checkVariants(page.map((c) => c.term).sort(ordinal)));

  if (failures.length > 0) {
    console.error("Concept registry drift — the registry and the published page disagree:\n");
    for (const f of failures) console.error(`  ✗ ${f}`);
    console.error(
      `\n${String(failures.length)} problem(s). ` +
        `The registry is ${REGISTRY}; the page is ${PUBLISHED_PAGE}.`,
    );
    return 1;
  }

  const published = rows.filter((r) => r.onPage).length;
  console.log(
    `Concept registry OK — ${String(rows.length)} concepts registered, ` +
      `${String(published)} published and matching, ` +
      `${String(rows.length - published)} awaiting publication; ` +
      `${String(PAGE_VARIANTS.length)} page variant(s) agree.`,
  );
  return 0;
}

// Guarded so the unit test can import the parsers without the audit running (and exiting)
// on import. Executed directly, it behaves exactly as before.
if (import.meta.main) process.exit(main());
