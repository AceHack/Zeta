# `search/inverted/` — a git-native inverted index that refuses to answer from a stale corpus

```bash
# Query. Default target rev is origin/main; the index is repaired against it.
bun src/Core.TypeScript/search/inverted/query.ts landauer
bun src/Core.TypeScript/search/inverted/query.ts landauer bennett   # AND
bun src/Core.TypeScript/search/inverted/query.ts landauer --files --limit 0

# Rebuild (also runs on a ~6h cadence — .github/workflows/search-index-cadence.yml)
bun src/Core.TypeScript/search/inverted/build.ts --rev origin/main
```

Exit codes, deliberately the same four as the sibling `../search.ts`:
`0` matches · `1` no matches · `2` usage · **`3` refused**.

**`1` and `3` are different answers and must never be confused.** `1` is
"I read the corpus and it is not there." `3` is "I cannot tell you." Collapsing
them is this repo's vacuity class, and it is what produced the bug below.

## Why it exists

On **2026-08-22** an agent searched for `landauer` and reported **0 files**. The
true answer was **447** files at `origin/main`, one of them a rule mentioning it
**32 times**. Aaron:

> _"i know it's in here over and over lol… not sure why your greps are missing
> the information, this is why we need our own tools to close over the OS, the
> built-in ones are unreliable"_

The tool was not unreliable. `grep -r` searched the **working tree** of a shared
checkout that was **336 commits behind `origin/main`**, and answered correctly
about the corpus it was handed. The defect is that a stale answer and a true
answer are **indistinguishable at the call site**.

An index makes that worse, not better, unless it is guarded — an index is stale
by construction between rebuilds. So:

- the index is built from an **explicit git rev**, read through `git ls-tree` /
  `git cat-file`, never from a checkout;
- the rev is **recorded in the artifact** (`manifest.json` → `rev`);
- the query **classifies freshness against the rev you are asking about**, and
  repairs or refuses rather than answering.

| index rev vs. queried rev                       | what happens                                                                                                                                                                 |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| equal                                           | answer from the index                                                                                                                                                        |
| ancestor, **no indexable file changed**         | answer from the index (effectively fresh)                                                                                                                                    |
| ancestor, files changed                         | the **changed set is re-read from git at the target rev** and merged, in both directions — new hits added, superseded hits **withdrawn**. The answer is exact, not caveated. |
| ancestor, changed set > `VERIFY_FILE_BUDGET`    | **REFUSED (3)**                                                                                                                                                              |
| not an ancestor (diverged)                      | **REFUSED (3)**                                                                                                                                                              |
| rev absent from the object store                | **REFUSED (3)**                                                                                                                                                              |
| `--no-verify` and the result would be **empty** | **REFUSED (3)** — see below                                                                                                                                                  |

That last row is the whole point. With `--no-verify` a _non-empty_ stale answer
is returned (incomplete, and you can see what you got), but an _empty_ one is
refused, because an empty result is a **confident claim of absence** about files
this run never read. That is the 2026-08-22 failure exactly.

## Measured, against the case that motivated it

Rev `6426eacf`, 32,936 indexed files, this laptop:

|                               | result    | wall                                                              |
| ----------------------------- | --------- | ----------------------------------------------------------------- |
| `git grep -il landauer <rev>` | 447 files | **0.77–0.98 s**                                                   |
| `query.ts landauer`           | 421 files | **0.07 s** (20 ms of it in the index; the rest is `bun` start-up) |

**~11x faster, and the 26-file difference is fully accounted for** — not
"close enough". Every one of them is corpus policy that the manifest declares
and the CLI prints on stderr with every answer:

- **21** in `docs/github/prs/` (excluded tree)
- **4** extensions not in the allowlist
- **1** blob over the 512 KiB size cap
- **0 unexplained**

The index returns **no file that `git grep` does not**. The accounting is how
the two tokenizer defects below were found; the totals alone looked fine.

## Four defects this index has had — every one found by checking output, not code

Recorded together because the method is the point. Two were caught before merge by **diffing the index's coverage against `git grep` and accounting for every missing file**; two were caught after merge by **reading the first query on `main`**. None was visible in the totals, and none would have been found by re-reading the source.

The first two were the _same failure this index exists to remove_ — a clean, confident, wrong "not here" — reproduced inside the fix for it.

1. **`verifyLandauer`** — the tokenizer emitted maximal runs of `[A-Za-z0-9_]`, so a camelCase identifier and an underscore-joined memory filename were each one token. **20 files went missing.** Fixed by decomposing compounds and emitting the parts _alongside_ the original — Lucene's `WordDelimiterGraphFilter` with `preserveOriginal`.
2. **`Landauer–Bennett`** — with a **U+2013 EN DASH**. The tokenizer treated every codepoint ≥ U+0080 as a word character, welding the two names into one token. Fixed with a pinned table of non-ASCII separator ranges.
3. **The index indexed itself.** Seven of the artifact's own files sit _under_ the 512 KiB blob cap (`high-df.jsonl` 57,366 B, `manifest.json` 10,165 B, `terms-{j,q,x,y,z}.jsonl` 173–339 KB), so the next rebuild would have indexed the previous one — every term in the index becoming a term _in_ the index, every path in `files.txt` a hit for itself. The large shards were excluded only by the size cap, which is **luck, not design**. `db/search-index/` is now an excluded tree.
4. **A repaired stale index could disagree with a fresh one** — the worst of the four. `isIndexablePath` answers from the **path** alone; the builder _also_ applies a **blob-size cap**. So the changed set admitted files the index would never contain, the verifier grepped them, and a stale query returned a hit a fresh query does not: the same question with two answers, decided by how stale the index happened to be. Now split in two — `changed` (wider, what to **withdraw**, since a fresh index would not list a deleted or newly-oversize file either) and `verifiable` (what to **read**, matching the builder's corpus exactly). A test asserts the two paths agree.

And one design error caught by measurement rather than by output: a **df cap of 100**, picked off the size table, **refused `landauer`** (447 files) — the very query this exists to answer. A cap tuned only against the size column has no opinion about what anyone searches for.

## What this index cannot do — say so, do not discover it later

**No phrase or proximity queries.** Aaron, filing this:

> _"for this index we will ignore stop words, **stop words need a completely
> different kind of indexing**."_

He is right, and the reason is the design: a term index stores **term → files**
with **no positions**. The phrase _"the end of error"_ is almost entirely stop
words and its meaning lives in their **order**, so this structure could not
answer it even if the stop words were kept. Phrase search needs a **positional
or n-gram index** — a different artifact, deliberately **not built** and filed
instead as `081M0QWDDDV087G0R003HM0KYX`. A multi-word query is **refused with
that explanation**, never silently ANDed and presented as a phrase match.

Also out of scope on purpose, and filed rather than half-built: **ranking**
(BM25/tf-idf — the counts are here, the scoring is not), **regex and prefix
queries** (needs a trigram accelerator), and **incremental updates** (full
rebuild is 30 s; incremental would be an optimisation, not a correctness fix) —
all three filed as `081M0QWDDF3087G0R000V7T6BV`.

Other honest limits:

- **Non-ASCII case is not folded.** `Über` indexes as `Über`. The fold is ASCII
  arithmetic on purpose — `toLowerCase()` is locale-independent but
  _Unicode-version_ dependent, so a runtime upgrade could re-fold a codepoint
  and change the artifact for a rev that never moved. Pinned by a test.
- **CJK indexes as one token per run.** That needs a segmenter.
- **Terms in more than 2% of files have no postings**, only a count. See below.

## The document-frequency cap, and the mistake it taught

Postings are not stored for a term appearing in more than **2% of indexed
files** (659 at this corpus, floor 250). Their **document frequency is kept** in
`high-df.jsonl`, and a query for one is **REFUSED with the count and the exact
`git grep` that answers it** — the term is _everywhere_, not _nowhere_, and
those must not look alike.

The first version used a flat cap of **100**, picked off the size table. It was
measured, defensible, and it **refused `landauer`** — the very query this
work-item exists to answer, because `landauer` is in 447 files. **A cap tuned
only against the size column has no opinion about what anyone searches for.**
The measurement that fixed it is in `format.ts`.

## Size, and the one that actually mattered

|                                         |                                                |
| --------------------------------------- | ---------------------------------------------- |
| raw JSONL                               | **54.7 MiB** (40 files, largest shard 5.8 MiB) |
| packed in git                           | **~18 MiB**                                    |
| full rebuild                            | **~30 s**                                      |
| **per cadence tick (6 h, 110 commits)** | **584 KiB**, diff `+13,654 / −11,168`          |

The last row is the number that decided the design, and it started out **8.7x
worse**. v0 identified documents by their **position** in the sorted path list.
That is smaller — and adding one file shifts every subsequent id, so every
posting after it is rewritten:

| doc id                        | artifact | one tick, diff        | one tick, pack |
| ----------------------------- | -------- | --------------------- | -------------- |
| positional                    | 18.6 MiB | `+281,464 / −278,978` | **5,088 KiB**  |
| **content-derived (shipped)** | 26.5 MiB | `+13,654 / −11,168`   | **584 KiB**    |

A **43% bigger artifact for a 8.7x cheaper tick and a 20x smaller diff** —
and the diff is the thing being paid for. A text index whose every line churns
every 6 hours has forfeited the only reason it is not binary.

_(Both rows measured at the flat-100 cap, so they compare like with like; the
shipped 2% cap raises both artifact and tick proportionally.)_

## Against Lucene — what we take and where we diverge

Apache **Lucene** (Doug Cutting, 1999–; the engine under **Solr** and
**Elasticsearch**) is the practice anchor here, and a paper is not a substitute
for it: a survey tells you the data structure, Lucene tells you which parts bite
at scale, because it has had to solve them for real.

| Lucene                                 | here                                                     | why                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| term dictionary separate from postings | **same** — `files.txt` + per-shard JSONL                 | a query reads one shard, not the index                                                                                                                                                                                                                                                                                                                                                           |
| immutable segments, stable placement   | **same** — a term's shard is a pure function of the term | a doc change perturbs only the shards of its terms, which keeps a 6-hourly diff reviewable                                                                                                                                                                                                                                                                                                       |
| tombstones instead of in-place delete  | **not needed**                                           | git already is that: a rebuild is a new commit and the previous index is its parent. The Z-set retraction Lucene implements internally is the substrate we already stand on                                                                                                                                                                                                                      |
| `WordDelimiterGraphFilter`             | **adopted**                                              | it is what fixed `verifyLandauer`                                                                                                                                                                                                                                                                                                                                                                |
| **binary segments + tiered merge**     | **diverged**                                             | Lucene optimises update latency and disk footprint on a continuously-changing corpus. We optimise **reviewability**, **byte-identical rebuild**, and **no daemon**, on a 6-hour cadence. A full rebuild is 30 s and is the only thing that makes idempotency _checkable_. If the corpus outgrows that, tiered merge is the known answer and this shard layout is deliberately compatible with it |

## Discipline compliance

- **Text, not binary.** `no-binary-in-proof-lineage.md` governs _verification_
  artifacts and this is derived data, so it does not strictly bind — but its
  reasons do, and they are why this is JSONL. Recorded as a decision with the
  measurements above, not taken as a default.
- **Idempotency (#6).** Rebuilding at a rev is **byte-identical**; the artifact
  contains **no timestamp**, and a test fails if one appears.
- **DV2.0 (#5).** Corpus is the hub, index is a satellite: fully derivable,
  regenerate-never-merge, and never the source of truth. **The index narrows;
  git is the corpus.**
- **Culture-invariant.** Terms and postings are ordered by the repo's collation
  treaty (`collation/collation.ts`, code-point ≡ UTF-8 byte order). A test
  asserts the order **diverges** from `localeCompare`, so it pins something.
- **Scale-free (#1).** One laptop or CI, file-backed, no daemon, no service.
- **Noninterference (#7).** The only entropy door is the git rev; nothing reads
  a clock, a hostname, or the working tree.

## The falsifiers

`inverted-index.test.ts` — 25 tests. Every guard below was proven to
discriminate by breaking it, watching the suite go red, and restoring it:

| mutation                                       | result            |
| ---------------------------------------------- | ----------------- |
| stale empty result answered instead of refused | **red**           |
| changed-set verification switched off          | **red**           |
| superseded hits not withdrawn                  | **red**           |
| timestamp added to the manifest                | **red** (2 tests) |
| doc ids reverted to positional                 | **red**           |
| every codepoint ≥ U+0080 a word char again     | **red**           |
| compound decomposition removed                 | **red**           |
| term order switched to `localeCompare`         | **red**           |

## Relationship to the rest of `search/`

Three layers, three jobs — this is the middle one, and none replaces another:

- `../concept-index.ts` + `../lookup.ts` — **curated** regex standing queries
  over a hand-picked corpus. Answers _"what touches Otto-357?"_. Gitignored
  host cache, built from the **working tree**.
- **this** — **corpus-wide** term → files, built from a **git rev**, committed.
  Answers _"which files mention landauer?"_.
- `../search.ts` — a scope-budgeted literal **scan** with no index. Answers
  anything, including phrases and stop words, at scan cost.

## Where this is going — the signature redesign

Aaron 2026-08-23 specified a **deliberate divergence from Lucene**: the key
becomes a **vowel-free word signature**, a **phrase** is the _set_ of its word
signatures (word order discarded, kept only for ranking), and the index becomes
a **two-tier cascade** whose tier 1 **over-includes and never under-includes** —
so it cannot produce a false zero, which is the defect this whole directory
exists to remove.

`signature.ts` (+ its falsifiers) ships that key function, measured. The index
build, the corpus-derived spell-check pre-filter, the naming registry and the
code index are **filed, not built**.

Full design, with every measurement:
`docs/research/2026-08-23-signature-index-over-includes-never-under-includes-vowel-free-word-keys-order-free-phrases-two-tier-cascade.md`

## Prior art (Beacon)

- **Gerard Salton**, SMART (1960s–70s) — the analysis → postings pipeline.
- **Zobel & Moffat**, _Inverted Files for Text Search Engines_, ACM Computing
  Surveys 38(2), 2006 — the canonical survey of exactly the postings and
  compression tradeoffs measured above.
- **Manning, Raghavan & Schütze**, _Introduction to Information Retrieval_, CUP
  2008 — §2.2 tokenisation and stop lists; §2.4 positional indexes, which is
  the structure this one deliberately is **not**.
- **Apache Lucene** — Doug Cutting, 1999–; Apache project since 2001; the engine
  under **Solr** and **Elasticsearch**.

Rows added to `docs/PRIOR-ART-LIST.md`.
