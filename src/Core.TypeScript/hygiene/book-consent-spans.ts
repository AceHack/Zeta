#!/usr/bin/env bun
// book-consent-spans.ts — the marker vocabulary shared by the named index and the
// consent sign-off verifier.
//
// WHY THIS FILE EXISTS AS A SEPARATE MODULE.
//
// Two tools need the same three things: where the `consent:begin` / `consent:end`
// markers are, what canonical form a passage takes, and who is on the roster.
//
//   * `audit-consent-signoff.ts` (PR #15619) — "is this marked passage claimed by a
//     consent event whose cited GitHub review still exists and still matches?"
//   * `book-named-index.ts` / `audit-book-named-index.ts` (here) — "where does this
//     person appear, is that list complete, and what changed since they approved?"
//
// Those are complementary questions and neither subsumes the other. What they must
// NOT have is two marker vocabularies: a span the index can see and the consent
// verifier cannot (or the reverse) is a silent under-report on a surface whose whole
// job is to not under-report. `.claude/rules/anti-babel-preserve-reconcilability.md`
// names that failure exactly — divergence is fine while it stays reconcilable, and
// two independently-drifting parsers of the same syntax is where it stops being.
//
// #15619 was open and unmerged when this landed, so this module could not import
// from it, and it does not silently re-implement it either. Three things keep the
// two honest:
//
//   1. `book-consent-spans.golden.json` — hex-in-JSON byte-locks of the canonical
//      form and sha256 of fixture passages, including the exact example printed in
//      CONSENT-SIGNOFF-DESIGN.md section 4. Either implementation drifting breaks it.
//   2. `audit-book-named-index.ts --parser-conformance` — when
//      `audit-consent-signoff.ts` is present in the tree it is imported and its
//      `collectSpans` is compared against this one over the real corpus. When it is
//      absent the check exits **3 (UNCHECKED), never 0**.
//   3. NAMED-INDEX-DESIGN.md section "Integration point" — the exact edit that
//      collapses the two parsers into one once both have landed.
//
// Culture-invariance: every comparison here is ordinal, every sort is ordinal by
// code unit, and the one case fold is `toLowerCase()` — the Unicode
// default-case-conversion one, NOT `toLocaleLowerCase()`, which is locale-dependent
// (`.claude/rules/culture-invariant-by-default.md`).

import { createHash } from "node:crypto";
import { type Dirent, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

// ---------------------------------------------------------------------------
// Configuration — shared with audit-consent-signoff.ts, deliberately identical
// ---------------------------------------------------------------------------

/** Lazy so `REPO_ROOT` can be overridden per call (tests use tmpdir fixtures). */
export function repoRoot(): string {
  return resolve(process.env["REPO_ROOT"] ?? process.cwd());
}

export const BOOK_DIR = "docs/books/you-born-at-the-hinge";
export const DEFAULT_LEDGER = `${BOOK_DIR}/consent-events.json`;
export const DEFAULT_CORPUS = [BOOK_DIR] as const;
export const DEFAULT_INDEX_MD = `${BOOK_DIR}/NAMED-INDEX.md`;
export const DEFAULT_INDEX_JSON = `${BOOK_DIR}/named-index.json`;

/**
 * Files inside the book directory that are book MACHINERY rather than book PROSE.
 *
 * They are excluded from the unmarked-appearance scan, and the exclusion is
 * dangerous enough to be worth stating out loud: an exclusion nobody can see is how
 * a coverage check goes quietly vacuous. So the list is
 *
 *   - exactly these basenames, never a glob that could swallow a chapter,
 *   - PRINTED in every report the audit emits, and
 *   - pinned by a test, so widening it silently fails.
 *
 * Each entry earns its place by being a file whose JOB is to carry names:
 *   CONSENT-LEDGER.md          the permissions record — it is a list of subjects
 *   consent-events.json        the machine roster (not markdown, listed for the reader)
 *   CONSENT-SIGNOFF-DESIGN.md  documents the marker syntax, with named examples
 *   NAMED-INDEX-DESIGN.md      this mechanism's own design doc, same reason
 *   NAMED-INDEX.md             GENERATED from the roster; it is the index, not prose
 *
 * `INTAKE-LOG.md` and every `RAW-*.md` are deliberately NOT here. They are book
 * material, a name in them is a real appearance, and a subject asking "what does
 * this say about me" means those too.
 */
export const MACHINERY_BASENAMES: readonly string[] = [
  "CONSENT-LEDGER.md",
  "CONSENT-SIGNOFF-DESIGN.md",
  "NAMED-INDEX-DESIGN.md",
  "NAMED-INDEX.md",
];

// ---------------------------------------------------------------------------
// Span extraction — byte-compatible with audit-consent-signoff.ts
// ---------------------------------------------------------------------------

const BEGIN_RE = /^<!--\s*consent:begin\s+(.*?)\s*-->\s*$/;
const END_RE = /^<!--\s*consent:end\s+(.*?)\s*-->\s*$/;
const FENCE_RE = /^\s*(```|~~~)/;
const ATTR_RE = /([A-Za-z][A-Za-z0-9_-]*)=(?:"([^"]*)"|([^\s"]+))/g;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export type SpanMode = "named" | "deidentified";

export interface SpanRecord {
  spanId: string;
  person: string;
  mode: SpanMode;
  /** repo-relative, posix separators */
  file: string;
  /** 1-based */
  beginLine: number;
  endLine: number;
  /** canonicalized passage */
  text: string;
  sha256: string;
}

export class SpanError extends Error {}

export function parseAttrs(s: string): Map<string, string> {
  const out = new Map<string, string>();
  ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTR_RE.exec(s)) !== null) {
    out.set(m[1] as string, (m[2] ?? m[3] ?? "") as string);
  }
  return out;
}

/**
 * Canonical passage form. Deliberately MINIMAL — every normalization is a place a
 * change can hide, so only the three that are pure noise are applied: CRLF -> LF,
 * trailing whitespace per line, leading/trailing blank lines.
 */
export function canonicalizePassage(lines: readonly string[]): string {
  const trimmed = lines.map((l) => l.replace(/\r$/, "").replace(/[ \t]+$/, ""));
  let start = 0;
  let end = trimmed.length;
  while (start < end && trimmed[start] === "") start += 1;
  while (end > start && trimmed[end - 1] === "") end -= 1;
  if (start >= end) return "";
  return `${trimmed.slice(start, end).join("\n")}\n`;
}

export function hashPassage(canonical: string): string {
  return createHash("sha256").update(Buffer.from(canonical, "utf8")).digest("hex");
}

/**
 * Extract consent spans from one markdown file.
 *
 * Fenced code blocks are SKIPPED — the design docs show the marker syntax inside a
 * fence, and without this the documentation of the mechanism would register as a
 * live consent span. An example must never be an assertion.
 */
export function extractSpans(text: string, file: string): SpanRecord[] {
  const lines = text.split("\n");
  const spans: SpanRecord[] = [];
  let inFence = false;
  let open: { id: string; person: string; mode: SpanMode; line: number; body: string[] } | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] ?? "";
    if (FENCE_RE.test(raw)) {
      inFence = !inFence;
      if (open) open.body.push(raw);
      continue;
    }
    if (inFence) {
      if (open) open.body.push(raw);
      continue;
    }

    const begin = BEGIN_RE.exec(raw);
    if (begin) {
      const at = `${file}:${i + 1}`;
      const attrs = parseAttrs(begin[1] as string);
      const id = attrs.get("id");
      const person = attrs.get("person");
      const modeRaw = attrs.get("mode") ?? "named";
      if (!id || !ID_RE.test(id)) {
        throw new SpanError(`${at}: consent:begin needs id=<slug>, got ${JSON.stringify(id ?? null)}.`);
      }
      if (!person) {
        throw new SpanError(
          `${at}: consent:begin id=${id} needs person="Full Name". A span with no subject cannot be checked against a roster.`,
        );
      }
      if (modeRaw !== "named" && modeRaw !== "deidentified") {
        throw new SpanError(`${at}: consent:begin id=${id} has mode=${modeRaw}; must be "named" or "deidentified".`);
      }
      if (open) {
        throw new SpanError(
          `${at}: consent:begin id=${id} nested inside still-open id=${open.id} (opened at line ${open.line}). Spans may not nest.`,
        );
      }
      open = { id, person, mode: modeRaw, line: i + 1, body: [] };
      continue;
    }

    const end = END_RE.exec(raw);
    if (end) {
      const at = `${file}:${i + 1}`;
      const endId = parseAttrs(end[1] as string).get("id");
      if (!open) throw new SpanError(`${at}: consent:end id=${endId ?? "?"} with no matching consent:begin.`);
      if (endId !== open.id) {
        throw new SpanError(
          `${at}: consent:end id=${endId ?? "?"} closes a span opened as id=${open.id} at line ${open.line}.`,
        );
      }
      const canonical = canonicalizePassage(open.body);
      if (canonical === "") {
        throw new SpanError(
          `${file}:${open.line}: consent span id=${open.id} is empty. An empty passage cannot be consented to.`,
        );
      }
      spans.push({
        spanId: open.id,
        person: open.person,
        mode: open.mode,
        file,
        beginLine: open.line,
        endLine: i + 1,
        text: canonical,
        sha256: hashPassage(canonical),
      });
      open = null;
      continue;
    }

    if (open) open.body.push(raw);
  }

  if (open) throw new SpanError(`${file}:${open.line}: consent:begin id=${open.id} is never closed.`);
  return spans;
}

function normalizeToPosix(p: string): string {
  return p.replaceAll("\\", "/");
}

export function walkMarkdown(dir: string, out: string[]): void {
  // `withFileTypes` so the entry's KIND arrives with the listing. A readdir followed
  // by a stat asks the filesystem twice and races itself in between
  // (`lint-check-then-use-file-races.ts`); the Dirent already knows.
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const name = entry.name;
    if (name === "node_modules" || name === ".git" || name === "dist") continue;
    const full = join(dir, name);
    if (entry.isDirectory()) walkMarkdown(full, out);
    else if (entry.isFile() && name.endsWith(".md")) out.push(full);
  }
}

/**
 * Read a file, or `null` when it does not exist.
 *
 * One syscall, one answer. An `existsSync` gate in front of a `readFileSync` is a
 * check whose result is already stale by the time the read runs, and it reads as
 * defensive while preventing nothing — the class
 * `lint-check-then-use-file-races.ts` exists to refuse. Every "is the roster there?"
 * / "is the committed index there?" question in this mechanism goes through here.
 */
export function readTextOrNull(abs: string): string | null {
  try {
    return readFileSync(abs, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

/** Every markdown file in the corpus, repo-relative posix, ordinal-sorted. */
export function corpusFiles(corpusDirs: readonly string[]): string[] {
  const root = repoRoot();
  const files: string[] = [];
  for (const d of corpusDirs) walkMarkdown(resolve(root, d), files);
  return files
    .map((f) => normalizeToPosix(relative(root, f)))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Collect every span in the corpus, keyed by spanId. Duplicate ids are fatal. */
export function collectSpans(corpusDirs: readonly string[]): { spans: Map<string, SpanRecord>; filesScanned: number } {
  const root = repoRoot();
  const rels = corpusFiles(corpusDirs);
  const spans = new Map<string, SpanRecord>();
  for (const rel of rels) {
    for (const span of extractSpans(readFileSync(resolve(root, rel), "utf8"), rel)) {
      const prior = spans.get(span.spanId);
      if (prior) {
        throw new SpanError(
          `duplicate consent span id=${span.spanId}: ${prior.file}:${prior.beginLine} and ${span.file}:${span.beginLine}. The span id is the key a consent event cites; two of them make the citation ambiguous.`,
        );
      }
      spans.set(span.spanId, span);
    }
  }
  return { spans, filesScanned: rels.length };
}

/**
 * A person's FOOTPRINT hash — every span that names them, folded into one value.
 *
 * Order is ordinal by spanId, never file order, so the value is identical on every
 * machine. Byte-compatible with `footprintOf` in `audit-consent-signoff.ts`; the
 * golden vector pins it.
 */
export function footprintOf(
  person: string,
  spans: ReadonlyMap<string, SpanRecord>,
): { sha256: string; members: SpanRecord[] } {
  const members = [...spans.values()]
    .filter((s) => s.person === person)
    .sort((a, b) => (a.spanId < b.spanId ? -1 : a.spanId > b.spanId ? 1 : 0));
  const body = members.map((s) => `${s.spanId} ${s.sha256}\n`).join("");
  return { sha256: hashPassage(body === "" ? "\n" : body), members };
}

// ---------------------------------------------------------------------------
// The roster — read from consent-events.json, EXTENDED with indexState
// ---------------------------------------------------------------------------

/**
 * The four states a subject's index entry can be in.
 *
 * Three are DECLARED on the roster; `revoked` is DERIVED from the consent event
 * fold and may not be declared, because a state that can be both asserted and
 * computed is a state that can disagree with itself.
 *
 *   named      may be named. Every appearance must be inside a consent span.
 *   role-only  a settled disposition that the name is not used. No alias may
 *              appear anywhere in the prose corpus.
 *   pending    asked, no answer yet. Identical CONTENT constraint to role-only.
 *   revoked    derived; see `deriveRevoked` in audit-book-named-index.ts.
 *
 * `pending` and `role-only` enforce the SAME constraint on purpose. They differ
 * only in what they predict about the next event, never in what they permit —
 * a pending subject who is treated as "probably fine" is the failure this whole
 * mechanism exists to prevent. The live precedent is the ledger's former-spouse
 * row: asked, answered with a denial for employer confidentiality, carried by
 * role and not by name.
 */
export const DECLARABLE_INDEX_STATES = ["named", "role-only", "pending"] as const;
export type DeclarableIndexState = (typeof DECLARABLE_INDEX_STATES)[number];
export type IndexState = DeclarableIndexState | "revoked";

export interface IndexPersonRecord {
  person: string;
  /**
   * Absent on the roster means `named`. That default is stated rather than
   * implied: `audit-consent-signoff.ts` (#15619) whitelists the person fields it
   * reads and ignores unknown ones, so `indexState` is additive and does not break
   * it — but a roster written before this field existed must still mean something,
   * and `named` is the reading that makes the coverage audit STRICTER rather than
   * more permissive. A default that relaxes a check is how a check goes quiet.
   */
  indexState: DeclarableIndexState;
  githubLogin?: string;
  githubUserId?: number;
  /**
   * The strings that identify this person in prose.
   *
   * Two consumers, one list:
   *   - #15619 uses it as "what a `mode=deidentified` span may not contain";
   *   - the coverage audit uses it as "what to search the prose for".
   *
   * Those are the same list because they are the same question. Include nicknames,
   * handles, and ROLE PHRASES ("my UX-research mentor") — a role phrase is what a
   * pure name scan cannot see, and declaring it is the only way this audit reaches
   * it at all. See NAMED-INDEX-DESIGN.md section "What this audit cannot catch".
   */
  aliases: string[];
}

export class RosterError extends Error {}

/**
 * Parse the roster out of consent-events.json.
 *
 * Deliberately NOT a re-parse of the whole ledger: events are #15619's business and
 * are read here only through `rawEvents`, untyped, so that this module never becomes
 * a second authority on what a consent event means.
 */
export function parseRoster(json: string, source: string): {
  people: Map<string, IndexPersonRecord>;
  rawEvents: readonly Record<string, unknown>[];
} {
  let doc: unknown;
  try {
    doc = JSON.parse(json);
  } catch (e) {
    throw new RosterError(`${source}: not valid JSON — ${(e as Error).message}`);
  }
  if (typeof doc !== "object" || doc === null) throw new RosterError(`${source}: top level must be an object.`);
  const rec = doc as Record<string, unknown>;
  if (rec["schemaVersion"] !== 1) {
    throw new RosterError(`${source}: schemaVersion must be 1, got ${JSON.stringify(rec["schemaVersion"])}.`);
  }

  const peopleRaw = rec["people"];
  if (!Array.isArray(peopleRaw)) throw new RosterError(`${source}: "people" must be an array.`);
  const people = new Map<string, IndexPersonRecord>();
  for (let i = 0; i < peopleRaw.length; i += 1) {
    const p = peopleRaw[i] as Record<string, unknown>;
    const at = `${source}: people[${i}]`;
    const name = p["person"];
    if (typeof name !== "string" || name === "") throw new RosterError(`${at}: "person" must be a non-empty string.`);
    if (people.has(name)) throw new RosterError(`${at}: duplicate person "${name}".`);

    const aliasesRaw = p["aliases"];
    if (!Array.isArray(aliasesRaw) || aliasesRaw.some((a) => typeof a !== "string" || a === "")) {
      throw new RosterError(`${at}: "aliases" must be an array of non-empty strings.`);
    }

    const stateRaw = p["indexState"] ?? "named";
    if (!(DECLARABLE_INDEX_STATES as readonly unknown[]).includes(stateRaw)) {
      throw new RosterError(
        `${at}: "indexState" must be one of ${DECLARABLE_INDEX_STATES.join(", ")}, got ${JSON.stringify(stateRaw)}. "revoked" is DERIVED from the consent event fold and may not be declared — a state that can be both asserted and computed can disagree with itself.`,
      );
    }

    const person: IndexPersonRecord = {
      person: name,
      indexState: stateRaw as DeclarableIndexState,
      aliases: aliasesRaw as string[],
    };
    if (typeof p["githubLogin"] === "string") person.githubLogin = p["githubLogin"];
    if (typeof p["githubUserId"] === "number") person.githubUserId = p["githubUserId"];
    people.set(name, person);
  }

  const eventsRaw = rec["events"];
  if (!Array.isArray(eventsRaw)) throw new RosterError(`${source}: "events" must be an array.`);

  return { people, rawEvents: eventsRaw as Record<string, unknown>[] };
}

// ---------------------------------------------------------------------------
// Alias occurrence scanning — the coverage half
// ---------------------------------------------------------------------------

export interface AliasHit {
  person: string;
  alias: string;
  file: string;
  /** 1-based */
  line: number;
  /** the whole source line, for the finding message */
  lineText: string;
  /** the span containing this hit, or null when the appearance is UNMARKED */
  spanId: string | null;
}

/**
 * Escape a literal for use inside a RegExp. Aliases are operator-supplied strings,
 * not patterns — a surname containing `.` must not become a wildcard.
 */
export function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Match an alias on WORD BOUNDARIES, case-insensitively.
 *
 * Case-insensitive is the safer direction: it over-reports rather than
 * under-reports, and under-reporting is the failure this audit exists to catch.
 * `toLowerCase()` is Unicode default case conversion, not the locale-sensitive
 * `toLocaleLowerCase()` (`.claude/rules/culture-invariant-by-default.md`).
 *
 * The boundary is `\b`-equivalent but written out because `\b` is ASCII-only in
 * JavaScript without the `u` flag and an alias may legitimately begin or end with a
 * non-ASCII letter: a hit must not be preceded or followed by a letter, digit, or
 * underscore. So "Chris" does not match inside "Christopher", and "Ann" does not
 * match inside "Anna" — but "Chris," and "(Chris)" and "Chris's" all do.
 */
export function aliasRegExp(alias: string): RegExp {
  const body = escapeRegExp(alias.toLowerCase());
  return new RegExp(`(?<![\\p{L}\\p{N}_])${body}(?![\\p{L}\\p{N}_])`, "gu");
}

/**
 * Find every alias occurrence in one file, tagged with the consent span that
 * contains it (or `null` when it is outside every span).
 *
 * Fenced code blocks are skipped, for exactly the reason `extractSpans` skips them:
 * the design docs print `person="Jordan Rivera"` inside a fence, and an example must
 * never register as an assertion about a real person.
 */
export function scanAliases(
  text: string,
  file: string,
  people: ReadonlyMap<string, IndexPersonRecord>,
  spansInFile: readonly SpanRecord[],
): AliasHit[] {
  const hits: AliasHit[] = [];
  const lines = text.split("\n");

  // (alias, person) pairs, longest alias first so the most specific one is reported.
  const needles: { person: string; alias: string; re: RegExp }[] = [];
  for (const p of people.values()) {
    for (const alias of p.aliases) needles.push({ person: p.person, alias, re: aliasRegExp(alias) });
  }
  needles.sort((a, b) =>
    b.alias.length - a.alias.length || (a.alias < b.alias ? -1 : a.alias > b.alias ? 1 : 0),
  );
  if (needles.length === 0) return hits;

  let inFence = false;
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] ?? "";
    if (FENCE_RE.test(raw)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (BEGIN_RE.test(raw) || END_RE.test(raw)) continue; // the marker names the person by construction

    const lower = raw.toLowerCase();
    const lineNo = i + 1;
    const containing = spansInFile.find((s) => lineNo > s.beginLine && lineNo < s.endLine);
    for (const n of needles) {
      n.re.lastIndex = 0;
      if (!n.re.test(lower)) continue;
      hits.push({
        person: n.person,
        alias: n.alias,
        file,
        line: lineNo,
        lineText: raw.trim(),
        spanId: containing ? containing.spanId : null,
      });
    }
  }
  return hits;
}
