// signature.ts — the lossy, OVER-INCLUDING key function for the prose index.
// 081M0QTXTR3087G0R002R439FH
//
// Aaron 2026-08-23:
//
//   "our reverse search index should diverge from standard Lucene and not
//    include vowels except in degenerate cases (maybe there are none), and also
//    the order should not matter of the ngram, and ignore stop words. This is
//    more like a Bloom filter that over-includes rather than under-includes.
//    Order can just be ranking, not exclusion."
//
// ORDER-FREENESS IS AT THE WORD LEVEL, NOT THE CHARACTER LEVEL. Aaron
// 2026-08-23, correcting the first reading of the line above:
//
//   "I care more about order independence of SHORT PHRASES, not letters
//    themselves."
//
// So the unit whose order is discarded is the WORD: "quick brown fox" and "fox
// brown quick" must hit the same key. A word's own letters keep their order.
// Concretely:
//
//   word   -> signature      (vowels dropped above the short-word threshold)
//   phrase -> SET of word signatures, order discarded
//   order  -> survives for RANKING only, never for filtering
//
// This matters enormously and the difference is measured in the design doc:
// character-level order-freeness (an anagram key, `sortChars`) throws away far
// more discriminative bits than dropping vowels does, and it is not what was
// asked for. `sortChars` below is retained ONLY to measure the alternative that
// was rejected, so the rejection is a number rather than an opinion.
//
// THE SOUNDNESS CONTRACT, which is the whole point and not a performance story:
//
//   Tier 1 MAY over-include. Tier 1 MUST NEVER under-include.
//
// A filter that admits false positives and refuses false negatives CANNOT
// PRODUCE A FALSE ZERO. That is the exact defect this work-item exists to
// remove: a `grep` returned a confident "0 files" for a term that was in 447 of
// them, and nothing distinguished "no matches" from "did not look". An
// under-including index reproduces that failure at speed; an over-including one
// makes it structurally impossible.
//
// This is the repo's existing one-way-inference stance — "convicts, never
// acquits" — applied to retrieval. Tier 1 is allowed to be IMPRECISE. It is not
// allowed to be APPROXIMATELY RIGHT. Those differ, and conflating them is how a
// cascade quietly becomes lossy.
//
// NOT the inverted-file tradition. The anchor is SIGNATURE FILES:
// Faloutsos & Christodoulakis, "Signature Files: An Access Method for Documents
// and Its Analytical Performance Evaluation" (ACM TOIS 2(4), 1984) —
// superimposed coding, false drops permitted, resolved by a verification pass
// they named "false-drop resolution". Signature files LOST to inverted files
// historically on performance; why that verdict does not bind us is argued in
// the design doc, not assumed here.
//
// Vowel-dropping is old and principled rather than novel: Soundex (Russell &
// Odell, US patent 1,261,167, 1918) is a consonant-skeleton key, and the
// practice descends from abjad scripts (Hebrew, Arabic) and Semitic consonantal
// roots, where the consonant skeleton carries the lexeme and vowels inflect it.

import { compareTerms } from "./format.ts";

/** Bumped when a change here would alter the artifact for an unchanged rev. */
export const SIGNATURE_VERSION = 1;

const VOWELS = new Set(["a", "e", "i", "o", "u"]);

/**
 * Below this many SURVIVING consonants, the vowels are kept.
 *
 * MEASURED, not chosen — see `docs/research/2026-08-23-*-signature-index-*.md`
 * for the curve. The predicate is on the OUTPUT, not the input length, because
 * "short word" and "few consonants left" come apart badly: `audio`, `queue`,
 * `eerie` and `aurora` all pass a length test and degenerate anyway.
 */
export const MIN_SURVIVING_CONSONANTS = 4;

/** `y` is deliberately NOT a vowel here: dropping it costs more than it saves. */
export function dropVowels(term: string): string {
  let out = "";
  for (const ch of term) if (!VOWELS.has(ch)) out += ch;
  return out;
}

/**
 * Sort a word's characters — the anagram-class key.
 *
 * NOT PART OF THE DESIGN. This is the character-level misreading of "order
 * should not matter", kept solely so the design doc can report what it would
 * have cost instead of asserting that it was worse. Aaron's order-freeness is
 * over WORDS IN A PHRASE; a word's letters keep their order.
 */
export function sortChars(term: string): string {
  return [...term].sort(compareTerms).join("");
}

export interface SignatureOptions {
  /** keep vowels when fewer than this many consonants would survive */
  readonly minSurvivingConsonants?: number;
  /** Soundex's rule: keep the first character even when it is a vowel */
  readonly keepFirstChar?: boolean;
  /**
   * Character-level anagram key. Defaults to FALSE — it is the rejected
   * alternative, present only so its cost is measurable.
   */
  readonly sortCharacters?: boolean;
}

/**
 * The prose signature for ONE WORD: drop the vowels, keep the letter order,
 * with the degenerate-case exception below.
 *
 * A PHRASE's key is the SET of its words' signatures — that is where order is
 * discarded, and it is built by the caller, not here. Stop words are already
 * gone before this is called: the tokenizer drops them, because the point is
 * that their postings are never written.
 */
export function proseSignature(term: string, opts: SignatureOptions = {}): string {
  const minConsonants = opts.minSurvivingConsonants ?? MIN_SURVIVING_CONSONANTS;
  const orderFree = opts.sortCharacters ?? false;
  const stripped = dropVowels(term);

  // THE DEGENERATE CASE, and it is a length rule on the OUTPUT.
  // Aaron: "these are the degenerate cases that may need vowels — shorter words
  // past a certain minimum, likely." Too few consonants left and the key stops
  // discriminating, so the vowels are kept and the token indexes as itself.
  const body = stripped.length < minConsonants ? term : stripped;

  if (opts.keepFirstChar === true && body !== term) {
    // Soundex retains the initial letter regardless of class, because dropping
    // it proved too lossy. Whether that holds for THIS corpus — code and
    // technical prose, not English surnames — is measured, not imported.
    const first = term[0]!;
    const rest = orderFree ? sortChars(body) : body;
    return VOWELS.has(first) ? first + rest : rest;
  }
  return orderFree ? sortChars(body) : body;
}
