/**
 * The glossary/corpus cell — vocabulary drift as a number instead of a feeling.
 *
 * Aaron 2026-08-20: "i track goossary toucing too this is the implict control
 * structure" and "these glossary vs stop works expansion is our yinyang cell in
 * human language rather than computer langugage".
 *
 * TWO HALVES, and neither is the good direction -- health is the TENSION:
 *
 *   COINED-NOT-ADOPTED  a glossary entry the corpus barely uses. The coinage did
 *                       not take. Left alone it is private vocabulary, which is
 *                       the rho -> 0 / Babel edge.
 *   USED-NOT-DEFINED    a term the corpus leans on with no glossary entry. This
 *                       is the "stop words contain the culture" half: the words
 *                       carrying the most shared meaning are exactly the ones
 *                       nobody stopped to define.
 *
 * WHY NO STOP-WORD LIST. Classical IR would tokenize and discard high-frequency
 * words, which here would discard the culture itself. Instead the candidate set is
 * restricted to HYPHENATED LOWERCASE COMPOUNDS (weight-free, byte-lock,
 * glass-halo, scale-free). Repo jargon is overwhelmingly of that shape and
 * ordinary English is not, so the filter is structural rather than a judgement
 * about which words matter -- the same move as using a trigram index to avoid
 * tokenizing at all.
 *
 * Register: UNMETERED. The counts are exact. That they measure "vocabulary
 * health" is a proxy and unvalidated. There is deliberately NO threshold and NO
 * gate: a ratchet on either half is trivially gamed (define junk terms to raise
 * one, delete entries to raise the other).
 */

/** A term is a hyphenated lowercase compound: two or more segments. */
export const TERM_RE = /\b[a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)+\b/g;

/** Glossary headings, e.g. "### Weight-free" or "## Byte-lock". */
export function glossaryTerms(glossaryMd: string): Set<string> {
  const out = new Set<string>();
  for (const line of glossaryMd.split(/\r?\n/)) {
    const m = /^#{2,4}\s+(.+?)\s*$/.exec(line);
    if (!m?.[1]) continue;
    const heading = m[1].toLowerCase();
    for (const t of heading.match(TERM_RE) ?? []) out.add(t);
    // also accept a two-word heading joined by a space as its hyphenated form
    const spaced = heading
      .replace(/[^a-z0-9 ]/g, "")
      .trim()
      .split(/\s+/);
    if (spaced.length === 2 && spaced[0] && spaced[1]) out.add(`${spaced[0]}-${spaced[1]}`);
  }
  return out;
}

export function countTerms(sources: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const src of sources) {
    for (const t of src.toLowerCase().match(TERM_RE) ?? []) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * BREADTH -- in how many distinct documents does the term appear?
 *
 * Aaron 2026-08-20: "the most repeated words over time by other[s] makes what the
 * future builds on as stable." Raw count cannot tell a TIC from SUBSTRATE: 1749
 * uses across three files is one author's habit; 400 uses across two hundred files
 * is something the corpus actually leans on. Breadth is the "by others" axis, and
 * it is the one that separates them.
 *
 * This is ordinary document frequency, and it is deliberately NOT inverted. Classical
 * IR uses IDF to DISCOUNT high-DF terms as uninformative; here the high-DF terms are
 * the culture, so the head is the signal rather than the noise.
 */
export function documentFrequency(sources: readonly string[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const src of sources) {
    const seen = new Set(src.toLowerCase().match(TERM_RE) ?? []);
    for (const t of seen) df.set(t, (df.get(t) ?? 0) + 1);
  }
  return df;
}

/**
 * A term's concentration: total uses per document that contains it. High
 * concentration with low breadth is the tic signature.
 *
 * NOT IMPLEMENTED, and named here rather than left silent: the TIME axis Aaron's
 * sentence also asks for ("over time"). Persistence -- first use to last use --
 * needs per-term git archaeology, which is a full-history pickaxe scan per term and
 * too expensive to run over 51k candidates. Breadth is the cheap half and the half
 * that separates tic from substrate; span would separate a burst from a habit.
 * Until it exists, this meter cannot tell a term adopted broadly LAST WEEK from one
 * adopted broadly FOR A YEAR.
 */
export function concentration(count: number, df: number): number {
  return df === 0 ? 0 : count / df;
}

/**
 * Repo PLUMBING, not vocabulary: AgencySignature trailer keys and CI/forge nouns.
 * These dominate the frequency head for a boring reason -- every commit repeats
 * them -- and counting them as "culture nobody defined" would be a false positive.
 * Excluded EXPLICITLY and reported separately rather than silently dropped, so the
 * filter is auditable instead of being a thumb on the scale.
 */
export const PLUMBING = new Set([
  "agency-signature-version",
  "agent-runtime",
  "action-mode",
  "human-review",
  "human-review-evidence",
  "credential-identity",
  "credential-mode",
  "co-authored-by",
  "pr-review",
  "pr-reviews",
  "archive-pr-reviews",
  "github-actions",
  "lucent-financial-group",
  "re-runs",
  "re-reviewed",
  "post-fix",
  // Added 2026-08-20 after the breadth axis exposed them: each is an
  // AgencySignature field VALUE or a CI noun appearing ~1.0 times in each of
  // several hundred commit-derived documents. The signature is structural --
  // per-doc ~= 1.0 with a very high document count means "emitted once per
  // commit", which is plumbing by construction. They are listed rather than
  // filtered by that heuristic, because a heuristic would also catch genuine
  // vocabulary that happens to be used once per document.
  "not-implied-by-credential",
  "autonomous-fail-open",
  "autonomous-fail-closed",
  "agent-model",
  "claude-code",
  "pr-archive-on-merge",
]);

/**
 * ORDINAL tie-break. Not `localeCompare`, which consults a runtime locale (and an
 * ICU version) that differs between machines -- so the same corpus would sort
 * differently on two hosts and the emitted work-list would not be byte-identical.
 * `<`/`>` on JS strings compares UTF-16 code units, which is machine-independent.
 *
 * This file shipped with two `localeCompare` calls and
 * `lint-no-culture-sensitive-collation` caught them. Recorded here rather than
 * quietly patched, because that lint's own docstring predicted exactly this: the
 * rule is a build error in C# (CA1310) and was unguarded in TypeScript, so "these
 * keep reappearing" is a property of the asymmetry, not of carelessness.
 */
export function ordinalCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export interface Cell {
  /** glossary terms the corpus uses at most `quietBelow` times */
  readonly coinedNotAdopted: ReadonlyArray<readonly [string, number]>;
  /** corpus terms used at least `loudAbove` times with no glossary entry */
  readonly usedNotDefined: ReadonlyArray<readonly [string, number]>;
  readonly glossarySize: number;
  readonly corpusTerms: number;
  /** loud terms excluded as plumbing — reported, never silently dropped */
  readonly plumbingExcluded: ReadonlyArray<readonly [string, number]>;
}

export function cell(
  glossary: Set<string>,
  counts: Map<string, number>,
  opts: { quietBelow: number; loudAbove: number },
): Cell {
  const coined: Array<readonly [string, number]> = [];
  for (const t of glossary) {
    const n = counts.get(t) ?? 0;
    if (n <= opts.quietBelow) coined.push([t, n]);
  }
  const used: Array<readonly [string, number]> = [];
  const plumbing: Array<readonly [string, number]> = [];
  for (const [t, n] of counts) {
    if (n < opts.loudAbove || glossary.has(t)) continue;
    (PLUMBING.has(t) ? plumbing : used).push([t, n]);
  }
  plumbing.sort((a, b) => b[1] - a[1]);
  coined.sort((a, b) => a[1] - b[1] || ordinalCompare(a[0], b[0]));
  used.sort((a, b) => b[1] - a[1] || ordinalCompare(a[0], b[0]));
  return {
    coinedNotAdopted: coined,
    usedNotDefined: used,
    glossarySize: glossary.size,
    corpusTerms: counts.size,
    plumbingExcluded: plumbing,
  };
}

if (import.meta.main) {
  const { readFileSync } = await import("node:fs");
  const [glossaryPath, ...corpus] = process.argv.slice(2);
  if (!glossaryPath || corpus.length === 0) {
    console.error("usage: bun glossary-adoption-cell.ts <GLOSSARY.md> <corpus-file>...");
    process.exit(2);
  }
  const g = glossaryTerms(readFileSync(glossaryPath, "utf8"));
  const sources: string[] = [];
  for (const p of corpus) {
    if (p === glossaryPath) continue; // never count the glossary as its own adoption
    try {
      sources.push(readFileSync(p, "utf8"));
    } catch {
      /* unreadable file contributes nothing; it must not read as adoption */
    }
  }
  const counts = countTerms(sources);
  const df = documentFrequency(sources);
  const c = cell(g, counts, { quietBelow: 1, loudAbove: 60 });
  const withBreadth = (rows: ReadonlyArray<readonly [string, number]>) =>
    rows.map(([t, n]) => ({
      term: t,
      uses: n,
      docs: df.get(t) ?? 0,
      perDoc: Number(concentration(n, df.get(t) ?? 0).toFixed(1)),
    }));
  console.log(
    JSON.stringify(
      {
        glossarySize: c.glossarySize,
        corpusTerms: c.corpusTerms,
        coinedNotAdoptedCount: c.coinedNotAdopted.length,
        usedNotDefinedCount: c.usedNotDefined.length,
        plumbingExcludedCount: c.plumbingExcluded.length,
        documents: sources.length,
        coinedNotAdopted: c.coinedNotAdopted.slice(0, 15),
        usedNotDefined: withBreadth(c.usedNotDefined.slice(0, 20)),
        plumbingExcluded: c.plumbingExcluded.slice(0, 10),
      },
      null,
      2,
    ),
  );
}
