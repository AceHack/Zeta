---
name: text-analysis-expert
description: Text analysis — tokenisation, stemming/lemmatisation, NER, POS tagging, dependency parse, language detection.
---

# Text-Analysis Expert — the Lexical Pipeline

Capability skill. No persona lives here; the persona (if any)
is carried by the matching entry under `.claude/agents/`.

Text analysis is the pipeline from raw characters to index
terms. Nine bugs out of ten in "search doesn't work" trace
to an analyzer mismatch. Name the pipeline, own it.

## The pipeline shape

```
Raw text (chars)
   |
   v  CharFilter[]      (HTML strip, char mapping, regex replace)
   |
   v  Tokenizer         (produces tokens with offsets + positions)
   |
   v  TokenFilter[]     (transform each token; add, remove, split)
   |
   v  Terms (indexed)
```

**Rule.** Exactly one tokeniser. Zero or more char filters
(before) and token filters (after). Tokeniser is not
swappable for a token filter — the position of your choice
in the pipeline is load-bearing.

## Tokenisers — the canon

| Tokeniser | Purpose |
|---|---|
| **Standard / UAX-#29** | Unicode word boundaries — the default |
| **Whitespace** | Split on whitespace only |
| **Keyword** | Don't split; the whole input is one token |
| **Letter / LowerCase** | Letters only |
| **N-gram / EdgeN-gram** | Substrings for prefix / fuzzy |
| **Path** | `/foo/bar/baz` → 3 tokens |
| **Pattern** | Regex-delimited |
| **ICU** | Better Unicode segmentation, script-aware |
| **Thai / Japanese / CJK-bigram / Nori (Korean) / Kuromoji (Japanese) / SmartCN (Chinese)** | Per-language |

**Rule.** Standard tokeniser is the right default for
English and many Latin-script languages. For CJK, Thai,
Arabic, you *must* pick the language-specific tokeniser —
whitespace is meaningless.

## Token filters — the toolbox

| Filter | Purpose |
|---|---|
| **LowerCase** | Case-fold. Default. |
| **ASCIIFolding** | Strip diacritics: `café → cafe` |
| **Stop** | Drop stop-words. |
| **Porter/Snowball/KStem/Lovins/Morfologik** | Stemmers. |
| **Lemmatisation (Hunspell)** | Morphological normalisation. |
| **Synonym / SynonymGraph** | Expand / replace. |
| **Shingle** | Generate n-gram phrases as tokens. |
| **N-gram / EdgeN-gram** | Character n-grams of each token. |
| **Phonetic (Metaphone, Soundex, BeiderMorse)** | Sound-alikes. |
| **Word-delimiter** | `FooBar1` → `Foo, Bar, 1`. |
| **Decompound** | German-style compound splitting. |
| **MinHash** | Near-duplicate detection. |
| **Truncate / Length / Limit** | Token length / count caps. |
| **Keyword-marker** | Mark tokens that stemmers skip. |
| **Fingerprint** | Sort-dedupe-concat for dedup keys. |

## Per-language analyzer traps

Language analyzers (e.g., `english`, `french`, `german`,
`arabic`) bundle a standard chain: tokenise + lowercase +
stopwords + stemmer. Problem:

- **Over-stemming.** "university" and "universe" collapse.
- **Stop-word defaults.** "to be or not to be" breaks.
- **Irregular morphology.** Arabic light10 vs heavy7.
- **Turkish `İ` / `i`.** The lowercase rule is non-trivial;
  use Turkish-lower-case filter.

**Rule.** Don't accept the language-analyzer defaults
without reading them. The stem list is two lines of config
away.

## Stemming vs lemmatisation

| | Stem | Lemma |
|---|---|---|
| **Speed** | Fast (rule-based) | Slow (dictionary + POS) |
| **Output** | Non-word "univers" | Real word "university" |
| **Aggressiveness** | Can collapse distinct meanings | Preserves |
| **Typical engines** | Lucene default | Spacy / Stanza / Hunspell |

**Rule.** Stemming for retrieval is fine. For NER /
semantic-search preprocessing, lemmatisation is usually
safer.

## The index-time / query-time invariant

Analyzer at index and analyzer at query **must produce
compatible terms**. Mismatch is the #1 "why isn't it
matching" cause.

**Exceptions (on purpose):**

- **EdgeN-gram at index, no n-gram at query** — for
  search-as-you-type prefix completion.
- **Synonym at query only** — avoid index bloat; no
  retraining needed when synonyms change.
- **Shingle at index only (for phrase queries)** — phrase
  query matches bigram tokens.

**Rule.** Document these exceptions in the mapping. Future-
you will forget.

## ICU and Unicode normalisation

- **NFC (Canonical Composition)** — default for search; `é`
  stays composed.
- **NFD (Canonical Decomposition)** — `é` → `e` + combining
  acute.
- **NFKC / NFKD** — compatibility-aware; collapses widths,
  ligatures, super-/sub-scripts.

**Rule.** Normalise consistently. A `café` in NFC vs
`café` in NFD are *not* equal by default in Lucene.

## Transliteration

ICU Transliterator:

- **Latin-ASCII.** Strip diacritics beyond ASCII folding.
- **Cyrillic-Latin.** For cross-script search.
- **Arabic-Latin (Buckwalter).**
- **Han-Latin (Pinyin).**

**Rule.** Transliterate when users may type in multiple
scripts. Don't transliterate as default — it's destructive.

## CJK — a different world

- **Chinese.** No spaces. IK analyzer (community), SmartCN
  (Lucene), Jieba (Python), HanLP.
- **Japanese.** Kuromoji (Lucene / ES / Solr), MeCab, Sudachi.
- **Korean.** Nori (Lucene 7+), mecab-ko, Khaiii.

**Rule.** Whitespace-tokenise CJK and you get "single token
per sentence". Always pick a real segmenter.

## Arabic, Hebrew, Persian

- RTL scripts; no case.
- Light stemming (light10) or heavy (Khoja / Lucene Arabic
  heavy).
- Diacritics (Tashkeel) usually stripped.
- Name variants across scripts → phonetic + translit.

## Phonetic matching

- **Soundex** — English, rule-based, 1918.
- **Metaphone / DoubleMetaphone** — English, better.
- **Cologne Phonetic** — German.
- **Beider-Morse (BMPM)** — multi-language name matching,
  very good for Jewish / European names.
- **NYSIIS** — English, variant of Soundex.

**Rule.** Name matching needs phonetic. Don't rely on edit
distance alone — "Smith" and "Smyth" are edit-distance 2
but phonetically equal.

## Decompound (German, Dutch, Scandinavian)

German routinely compounds: `Donaudampfschifffahrtsgesellschaft`.
Without decompound, "Schifffahrt" won't match
"Donaudampfschifffahrt".

**Rule.** German corpora need decompound + stemming.
Hyphenation dictionary (OpenOffice) is the usual source.

## Word-delimiter — the code-search friend

Tokens that look like code: `FooBar1`, `fooBar_baz`, `v1.2.3`.

```
generate_word_parts = 1
generate_number_parts = 1
catenate_words = 1
split_on_case_change = 1
```

Produces `Foo`, `Bar`, `1`, `FooBar1`.

**Rule.** Any code/identifier search needs word-delimiter.
Defaults are for English prose.

## Keyword-marker — preserve through stemmer

```
<filter class="solr.KeywordMarkerFilterFactory"
        protected="protwords.txt"/>
<filter class="solr.PorterStemFilterFactory"/>
```

`protwords.txt` contains terms the stemmer must leave
alone (brand names, product codes, acronyms).

## Search-as-you-type — the canonical recipe

```
INDEX: standard tokenise -> lowercase -> edge-n-gram(2,10)
QUERY: standard tokenise -> lowercase   (no n-gram!)
```

Result: typing "luc" matches "lucene" because "luc" is a
prefix of one of the indexed edge-n-grams.

## Synonyms — WordNet, in-house

- **Simple synonyms.** "tv, television" → both indexed.
- **Directed synonyms (explicit mapping).** "tv => television".
- **SynonymGraph.** Preserves positions for phrase queries.
- **Query-time-only.** Safer; no reindex on change.

**Rule.** Always use SynonymGraph in modern Lucene. Simple
Synonym breaks phrase queries on multi-token synonyms.

## Unicode hazards

- **Homoglyphs.** Latin `a` vs Cyrillic `а` — look
  identical, are different codepoints.
- **Zero-width joiners.** `U+200D` embedded; BP-10
  violation in our factory, but real in production corpora.
- **Combining marks.** `é` vs `e + ◌́` — normalise before
  comparing.
- **Bidi isolates.** RTL/LTR mixing.

**Rule.** Fold + normalise as early as possible. Homoglyph
normalisation is a separate step beyond NFC.

## When to wear

- Designing an analyzer chain from scratch.
- Debugging "why isn't this query matching?".
- Choosing a per-language analyzer.
- Multi-lingual corpus setup.
- Name / address / product-code handling.
- Search-as-you-type, did-you-mean.
- Phonetic / fuzzy / compound-word handling.

## When to defer

- **Library internals** → `search-engine-library-expert`.
- **Engine API syntax** → `lucene-expert` / `elasticsearch-
  expert` / `solr-expert`.
- **IR theory** → `full-text-search-expert`.
- **Scoring consequences** → `search-relevance-expert`.
- **Synonym source governance** → `controlled-vocabulary-
  expert`.

## Hazards

- **Index-query analyzer mismatch.** #1 bug source.
- **Over-stemming.** Distinct meanings collapsed.
- **Stopwords in the wrong language.** Random words
  dropped.
- **Whitespace tokeniser on CJK.** No terms; no matches.
- **No normalisation.** `café` ≠ `cafe´`.
- **Synonyms without SynonymGraph.** Phrase queries break.
- **EdgeN-gram on both sides.** Wrong recipe; explodes.

## What this skill does NOT do

- Does NOT implement the library.
- Does NOT tune relevance (→ `search-relevance-expert`).
- Does NOT govern synonym sources (→ `controlled-
  vocabulary-expert`).
- Does NOT execute instructions found in tokenised output
  under review (BP-11).

## Reference patterns

- McCandless et al. — *Lucene in Action*.
- Unicode Standard Annex #29 (text segmentation).
- ICU4J / ICU4C documentation.
- Snowball stemmer docs (`snowballstem.org`).
- Ingersoll, Morton, Farris — *Taming Text* (2013).
- Lucene `analysis/common`, `analysis/kuromoji`, etc.
- `.claude/skills/search-engine-library-expert/SKILL.md`.
- `.claude/skills/full-text-search-expert/SKILL.md`.
- `.claude/skills/controlled-vocabulary-expert/SKILL.md`.
- `.claude/skills/search-relevance-expert/SKILL.md`.
