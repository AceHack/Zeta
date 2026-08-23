// tokenize.ts — the analysis chain for the git-native inverted index.
// 081M0QTXTR3087G0R002R439FH
//
// EVERY choice here is pinned to be machine-independent, because the index is a
// git artifact: two hosts that tokenize differently produce two different
// indexes from the same rev, and the byte-identical-rebuild property
// (discipline #6, idempotency) dies silently. So:
//
//   - Case folding is ASCII-ONLY, done by codepoint arithmetic. Not
//     `toLowerCase()`: that is locale-independent but *Unicode-version*
//     dependent, so a runtime upgrade could re-fold some codepoint and change
//     the artifact under a rev that never changed. `toLocaleLowerCase` is
//     forbidden outright (`.claude/rules/culture-invariant-by-default.md`).
//   - Term ORDER is the repo's collation treaty (`collation.ts` stringCompare,
//     Unicode code-point order === UTF-8 byte order), never `localeCompare`.
//   - Token boundaries are a fixed codepoint class, not a Unicode property
//     lookup, for the same version-stability reason.
//
// Beacon anchors: Salton's SMART system (1960s-70s) for the analysis→postings
// pipeline; Manning, Raghavan & Schütze, *Introduction to Information
// Retrieval* (CUP 2008) ch. 2 for tokenisation and stop-word treatment; Apache
// Lucene (Doug Cutting, 1999-) for the Analyzer/TokenStream shape this is a
// deliberately-thin version of. See `docs/PRIOR-ART-LIST.md`.

/** Bumped whenever a change here would alter the artifact for an unchanged rev. */
export const TOKENIZER_VERSION = 3;

/** Shortest indexed term. 1-char tokens are ~all noise and ~all of the postings. */
export const MIN_TOKEN_LENGTH = 2;

/**
 * Longest indexed term. Base64 blobs, minified bundles and hex dumps produce
 * enormous single "words" that are never queried and dominate the index.
 * 64 admits every real identifier in this repo (a ZetaId is 26 characters).
 */
export const MAX_TOKEN_LENGTH = 64;

/**
 * The stop list. Aaron 2026-08-22: *"for this index we will ignore stop words,
 * stop words need a completely different kind of indexing."*
 *
 * He is right, and the reason belongs where the list lives: dropping these
 * makes PHRASE queries impossible, because a phrase like "the end of error" is
 * almost entirely stop words and its meaning is carried by their POSITIONS. A
 * term index stores no positions, so it could not answer that query even if the
 * stop words were kept. Phrase and proximity search need a positional or n-gram
 * index — a different structure, deliberately out of scope here and filed
 * rather than half-built. See this directory's README §"What this cannot do".
 *
 * The list is deliberately SMALL and English-only. Large published stop lists
 * eat real query terms: `no`, `on`, `if`, `for` and `in` are all stop words in
 * some lists and all load-bearing tokens in this repo's YAML and F#. Kept to
 * words that are both extremely high-frequency and never a useful search on
 * their own. Anchor: MRS 2008 §2.2.2, trimmed hard.
 */
export const STOP_WORDS: readonly string[] = Object.freeze([
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "can",
  "do",
  "does",
  "from",
  "had",
  "has",
  "have",
  "into",
  "is",
  "it",
  "its",
  "of",
  "or",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "to",
  "was",
  "were",
  "will",
  "with",
  "would",
]);

const STOP_SET: ReadonlySet<string> = new Set(STOP_WORDS);

export function isStopWord(term: string): boolean {
  return STOP_SET.has(term);
}

/**
 * ASCII-only case fold, by codepoint arithmetic.
 *
 * Deliberately NOT `String.prototype.toLowerCase()`. That method is
 * locale-INdependent (so it does not violate the culture rule) but it IS
 * Unicode-version dependent: a runtime that ships a newer Unicode table can
 * fold a codepoint differently, which would change the committed artifact for a
 * rev whose content never moved. Idempotency here has to hold across TIME and
 * across HOSTS, not just within one process.
 *
 * Cost of the choice, stated: `Ünicode` folds to `Ünicode`, not `ünicode`, so a
 * query for `ünicode` will not match `Ünicode`. Accepted for v1 and recorded in
 * the README; the fix is a pinned case-folding table, not `toLowerCase()`.
 */
export function asciiFold(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    out += c >= 0x41 && c <= 0x5a ? String.fromCharCode(c + 32) : text[i];
  }
  return out;
}

/**
 * Non-ASCII codepoint ranges that are SEPARATORS, not token characters.
 *
 * WHY THIS TABLE EXISTS — a second miss found by checking the index against
 * `git grep` rather than by reasoning about it. v1 of this file said "ASCII
 * word characters, plus everything at or above U+0080, so non-Latin scripts
 * produce runs rather than vanishing". That is right about scripts and wrong
 * about PUNCTUATION, and this repo's prose is full of typographic punctuation:
 *
 *     "Landauer–Bennett"   <- U+2013 EN DASH, welded into ONE token
 *
 * so `docs/trajectories/sim-mea-cut-soft-substrate-shaders/RESUME.md` contained
 * "Landauer" and the index could not find it. A clean, confident, wrong "not
 * here" — the exact defect this work-item exists to remove, reproduced inside
 * the fix for it. Found because the coverage of the index was DIFFED against
 * `git grep` and every missing file was accounted for, instead of the totals
 * being close enough to accept.
 *
 * The ranges are written out rather than looked up from a Unicode property, for
 * the same reason the case fold is hand-rolled: a property table can change
 * under a runtime upgrade and silently re-tokenize a corpus that never moved.
 * Explicit, pinned, and version-proof beats complete.
 */
const NON_ASCII_SEPARATOR_RANGES: readonly (readonly [number, number])[] = Object.freeze([
  [0x00a0, 0x00a0], // NO-BREAK SPACE
  [0x00ab, 0x00ab], // «
  [0x00b7, 0x00b7], // ·
  [0x00bb, 0x00bb], // »
  [0x00d7, 0x00d7], // ×
  [0x00f7, 0x00f7], // ÷
  [0x2000, 0x206f], // General Punctuation: en/em dash, curly quotes, bullets, ellipsis, thin spaces
  [0x2070, 0x209f], // super/subscripts
  [0x20a0, 0x20cf], // currency symbols
  [0x2100, 0x214f], // letterlike symbols
  [0x2190, 0x21ff], // arrows  (-> is everywhere in this repo)
  [0x2200, 0x22ff], // mathematical operators
  [0x2300, 0x23ff], // miscellaneous technical
  [0x2500, 0x257f], // box drawing
  [0x2580, 0x259f], // block elements
  [0x25a0, 0x25ff], // geometric shapes
  [0x2600, 0x27bf], // misc symbols + dingbats (checkmarks, crosses)
  [0x2e00, 0x2e7f], // supplemental punctuation
  [0x3000, 0x303f], // CJK symbols and punctuation
  [0xfe30, 0xfe4f], // CJK compatibility forms
  [0xff00, 0xff0f], // fullwidth punctuation
  [0xff1a, 0xff20],
  [0xff3b, 0xff40],
  [0xff5b, 0xff65],
]);

function isNonAsciiSeparator(code: number): boolean {
  for (const [lo, hi] of NON_ASCII_SEPARATOR_RANGES) {
    if (code < lo) return false; // ranges are ascending
    if (code <= hi) return true;
  }
  return false;
}

/**
 * True when a codepoint is part of a token rather than a separator.
 *
 * The class is fixed by hand rather than looked up from Unicode properties, so
 * it cannot drift with a runtime upgrade:
 *   - ASCII `0-9 A-Z a-z _` — identifiers, words, versions, ZetaIds.
 *   - codepoints >= U+0080 that are not in the separator table above.
 *
 * Honest limit, unchanged: treating all remaining >= U+0080 codepoints as token
 * characters means CJK text indexes as one token per run, which is useless for
 * CJK search. That needs a segmenter, a different job. Named here so a future
 * "why does Japanese search not work" has an answer instead of a bug report.
 */
export function isTokenChar(code: number): boolean {
  if (code >= 0x80) return !isNonAsciiSeparator(code);
  if (code >= 0x30 && code <= 0x39) return true; // 0-9
  if (code >= 0x41 && code <= 0x5a) return true; // A-Z
  if (code >= 0x61 && code <= 0x7a) return true; // a-z
  return code === 0x5f; // _
}

/**
 * Longest run of token characters that is treated as a word at all. A longer
 * run is a base64 blob, a hex dump or a minified line, not a word; decomposing
 * it would emit hundreds of junk sub-terms rather than dropping one junk term.
 */
export const MAX_RUN_LENGTH = 128;

/**
 * Decompose a compound identifier the way Lucene's WordDelimiterGraphFilter
 * does, and emit the parts ALONGSIDE the original (`preserveOriginal`).
 *
 * WHY THIS EXISTS — a miss found by checking, not by reasoning. The first
 * version of this tokenizer emitted only maximal runs of `[A-Za-z0-9_]`, and
 * a query for `landauer` returned 401 files where `git grep -il` returned 447.
 * 20 of the 46 missing files were missing for this reason: they contain
 * `verifyLandauer`, or a memory filename like
 * `feedback_..._landauer_bounded_..._2026_05_28`, which the run scanner keeps
 * as ONE token. `git grep` finds them because it matches substrings; a term
 * index does not, unless it is told that a compound is also its parts.
 *
 * That gap is precisely the failure this work-item exists to remove — a
 * confident, clean, wrong "not here" — so it is fixed rather than documented.
 * Splitting on:
 *   - `_`                     `landauer_bounded` -> landauer, bounded
 *   - lower -> upper          `verifyLandauer`   -> verify, landauer
 *   - letter <-> digit        `chip8`            -> chip, 8
 *
 * The original is kept so an exact search for `verifylandauer` still works.
 * Cost is measured in the README, not assumed: it is what the index pays to
 * stop being wrong.
 */
export function decompose(run: string): string[] {
  const parts: string[] = [];
  let cur = "";
  const isUpper = (c: number) => c >= 0x41 && c <= 0x5a;
  const isLower = (c: number) => c >= 0x61 && c <= 0x7a;
  const isDigit = (c: number) => c >= 0x30 && c <= 0x39;
  for (let i = 0; i < run.length; i++) {
    const c = run.charCodeAt(i);
    if (c === 0x5f) {
      if (cur) parts.push(cur);
      cur = "";
      continue;
    }
    if (cur.length > 0) {
      const prev = cur.charCodeAt(cur.length - 1);
      const caseBreak = isLower(prev) && isUpper(c);
      const digitBreak =
        (isDigit(prev) && (isUpper(c) || isLower(c))) ||
        (!isDigit(prev) && isDigit(c) && (isUpper(prev) || isLower(prev)));
      if (caseBreak || digitBreak) {
        parts.push(cur);
        cur = "";
      }
    }
    cur += run[i];
  }
  if (cur) parts.push(cur);
  return parts;
}

function admit(term: string, out: string[], seen: Set<string>): void {
  if (term.length < MIN_TOKEN_LENGTH) return;
  if (term.length > MAX_TOKEN_LENGTH) return;
  if (STOP_SET.has(term)) return;
  if (seen.has(term)) return;
  seen.add(term);
  out.push(term);
}

/**
 * Split text into indexable terms. Returns every occurrence, in order, so the
 * caller can count term frequency. Within ONE run the emitted terms are
 * deduplicated (so `landauerLandauer` does not count `landauer` twice for one
 * word), but across runs they repeat and the caller counts them.
 *
 * Stop words are dropped HERE, not at query time, because the whole point of
 * dropping them is that their postings are never written.
 */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  let start = -1;
  const seen = new Set<string>();
  for (let i = 0; i <= text.length; i++) {
    const code = i < text.length ? text.charCodeAt(i) : -1;
    if (code >= 0 && isTokenChar(code)) {
      if (start < 0) start = i;
      continue;
    }
    if (start < 0) continue;
    const run = text.slice(start, i);
    start = -1;
    if (run.length > MAX_RUN_LENGTH) continue;
    seen.clear();
    admit(asciiFold(run), out, seen);
    const parts = decompose(run);
    if (parts.length > 1) {
      for (const part of parts) admit(asciiFold(part), out, seen);
    }
  }
  return out;
}

/**
 * Analyse one query term the same way the corpus was analysed.
 * Returns `null` when the term can never appear in the index, so the CLI can
 * say WHY it found nothing — "you searched a stop word" is a different answer
 * from "no document contains it", and collapsing them is the vacuity class.
 */
export function analyzeQueryTerm(raw: string): { term: string } | { rejected: string } {
  const folded = asciiFold(raw);
  for (let i = 0; i < folded.length; i++) {
    if (!isTokenChar(folded.charCodeAt(i))) {
      return {
        rejected: `"${raw}" is not a single term (contains a separator at offset ${i}). This index is term -> files; it has no positions, so it cannot answer phrases. Pass terms separately for AND semantics.`,
      };
    }
  }
  if (folded.length < MIN_TOKEN_LENGTH) {
    return { rejected: `"${raw}" is shorter than the minimum indexed term length (${MIN_TOKEN_LENGTH}).` };
  }
  if (folded.length > MAX_TOKEN_LENGTH) {
    return { rejected: `"${raw}" is longer than the maximum indexed term length (${MAX_TOKEN_LENGTH}).` };
  }
  if (STOP_SET.has(folded)) {
    return {
      rejected: `"${folded}" is a stop word and is deliberately not indexed. Stop words need positional indexing, which this index does not have; use \`bun src/Core.TypeScript/search/search.ts\` for a literal scan.`,
    };
  }
  return { term: folded };
}
