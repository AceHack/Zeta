# The signature index: over-include, never under-include — vowel-free word keys, order-free phrases, two-tier cascade

**Status:** design, measured. The token index in `src/Core.TypeScript/search/inverted/`
is shipped and stays; this is the **key function** that replaces its exact-term
lookup, plus the cascade it feeds. `signature.ts` and its falsifiers are shipped
with this document. The index build, the spell-check pre-filter, tier 2, and the
code index are **filed, not built** — see §10.

**Origin:** Aaron 2026-08-23, four observations, each of which changed the design.

---

## 1. The ask

> _"our reverse search index should **diverge from standard Lucene** and **not
> include vowels** except in degenerate cases (maybe there are none), and also
> the **order should not matter** of the ngram, and **ignore stop words**. This
> is more like a **Bloom filter that over-includes rather than under-includes**.
> **Order can just be ranking, not exclusion.**"_

> _"yes this is one of the most important bits — the over-index returns the
> **surrounding texts** that is further scrutinised by **more computationally
> intensive techniques**."_

> _"I care more about **order independence of short phrases, not letters
> themselves**."_

> _"we can have a **1-gram** which is very lightweight for spell checks based on
> **repo's actual data** — it will also let us **catch slight mismatches**."_

> _"this index is for our **English searching and natural language search**. I
> think we will need something similar to a **GitHub grep-like index for our
> code searching**. I don't think we should mix these two unless there is a good
> generalization here that does not sacrifice performance."_

---

## 2. The soundness contract — this is the whole design

> **Tier 1 MAY over-include. Tier 1 MUST NEVER under-include.
> Tier 2 may reject freely.**

**A filter that admits false positives and refuses false negatives cannot
produce a false zero.** That is not a performance argument, and the performance
argument is the weaker one. It is the _reason the work-item exists_: on
2026-08-22 a `grep` returned a confident **0 files** for `landauer`, which is in
**447**, because it searched a tree 336 commits stale — and nothing at the call
site distinguished _"no matches"_ from _"did not look"_.

An **under-including** index reproduces that failure at speed. An
**over-including** one makes it structurally impossible.

This is the repo's existing one-way-inference stance — _convicts, never acquits_
— applied to retrieval. And note the precise distinction, because conflating
these two is how a cascade quietly becomes lossy:

> Tier 1 is allowed to be **imprecise**. It is _not_ allowed to be
> **approximately right**.

**The falsifier that is the architecture's warrant:** a test that fails if tier 1
ever drops a true match. Without it the contract is prose.

---

## 2a. The schema: Data Vault 2.0, in etymological space

Aaron 2026-08-23, on the naming registry:

> _"to me this is just **Data Vault 2.0 hot spot satellites vs hubs**, defined in
> **memetic space instead of change-rate space** — more like **etymological
> space**."_

This is the framing section because it is **not decoration — it is the schema**,
and it decides the storage shape the registry was going to need anyway.

`.claude/rules/dv2-data-split-discipline-activated.md` (#5 of the seven
always-active disciplines) partitions substrate into **hubs** (stable keys),
**links** (relationships) and **satellites** (fast-changing attributes). The
mapping is structural, not analogical:

| DV2.0                                            | naming registry                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------- |
| **hub** — stable key                             | the **concept / definition**                                                    |
| **satellite** — drifting attributes              | the **names** attached to it (`retryCount`, `attempts`, `numTries`)             |
| **link** — relationship                          | relations between concepts                                                      |
| **hot-spot satellite** — disproportionate writes | a hub carrying **disproportionately many names** = the un-extracted abstraction |

The justification transfers whole: you separate them so a **rename does not
rewrite the concept**, which is the same argument as separating a fast-changing
attribute from a stable key. And _hot spot_ is DV2.0's own term in its own sense —
the diagnostic shape and the remedy (split it out) are identical.

### The sharpening: semantic distance defines the UNIT; change-rate still defines the PARTITION

Aaron 2026-08-23, refining it:

> _"I think it's **distance in like embedding-space terms**, pretty close to that
> — where you measure **DV2.0 change rate over a cluster instead of an individual
> item**."_

A first draft of this section framed the two as **competing metrics** —
change-rate versus etymological distance — and objected that they come apart,
since synonyms sit at zero semantic distance but can churn at different rates.

**That objection dissolves, because they are not competing. They have different
roles:**

> **Semantic distance defines the UNIT of measurement.
> Change-rate still defines the PARTITION.**

You cluster names by distance in an embedding space, then measure DV2.0 change
rate **over the cluster**. `{retryCount, attempts, numTries}` has _one_ change
rate as a unit; the members are never measured individually, so their individual
churn differences never arise.

So the rule needs a **coarser unit of measurement, not a new metric** — a much
smaller and more defensible amendment, and that is what the work item proposes.

### Three things this buys, and the third answers an open question above

- **The hub is the cluster, not a hand-declared concept.** Hubs can be
  _discovered_ by clustering instead of requiring someone to name every concept
  in advance — which is exactly what made the "obligate every token" objection in
  §9a feel heavy.
- **"Hot spot" becomes measurable in DV2.0's own sense.** A cluster with **many
  members and low churn** is a stable concept wearing many names — the
  un-extracted abstraction. A cluster with **few members and high churn** is
  something genuinely still moving. Different diagnoses, _same query_ — which no
  purely lexical registry could distinguish.
- **It answers "how many registry entries?" with a method rather than a guess:
  the number of clusters, not the number of tokens.** §9a could only bound that
  count from below and above; this gives it a way to be computed.

### Disagreement inside a cluster is not an obstacle — it IS the measurement

The obvious worry about measuring change-rate over a cluster is that it is a
**pushforward**: well-defined only if the members' rates cohere. The natural
response is to make coherence a precondition — check it, refuse if violated.

Aaron 2026-08-23 inverts that, and the inversion is the design:

> _"I think if your change rates disagree, it's telling you something about the
> **etymology of the word** and **where it is in its current lifetime within the
> current culture**."_

> Not _"check coherence, refuse if violated."_
> But _"**measure the obstruction** — its magnitude and shape are the readout."_

**This is native to the repo, not imported.**
`.claude/rules/anti-babel-preserve-reconcilability.md` already makes exactly this
move for a different object: _"two paths around a pole yield genuinely different
results, and **that difference is information, not error**"_ (monodromy). Aaron's
inversion is the same principle applied to name-clusters. Mathematically it is an
**obstruction**: the failure of a local measurement to descend along a quotient,
which obstruction theory treats as a computable class rather than an error.
_(Named as the shape it resembles; no cohomological claim is being made here.)_

### The third diagnosis — and it is what `anti-babel` actually needs

**Register: `proposed`.** No data yet. What follows from the schema is the
_ability_ to compute this; that the states **mean** what the table says is an
interpretation awaiting evidence.

| cluster churn                   | proposed diagnosis                                           |
| ------------------------------- | ------------------------------------------------------------ |
| uniformly **low**               | a settled concept — one name won                             |
| uniformly **high**              | a concept still forming                                      |
| **anti-correlated derivatives** | **a rename in progress** — one name falling as another rises |

**The third row is the strongest argument for the registry existing at all**, and
it is not "a nicer glossary". `anti-babel`'s entire concern is vocabulary drift
becoming irreconcilable, and today drift is only noticed _after_ it has happened.
This lets you watch a term turn over **while it is turning over** — the
difference between a post-mortem and an instrument, and the missing measurement
for a rule that has been asserting an invariant it could not observe.

### The statistic: frequency over time, and watch the derivatives

Aaron 2026-08-23 named the method:

> _"**frequency over time**, like **Google search term frequency results** — is
> how to see this in real time **by region**, or very similar. **Watching the
> derivatives**."_

A first draft of this section said _"disagreeing churn"_, which is vague —
disagreement could be anything. His version is specific and testable:

> A rename is **two names in one cluster whose frequency derivatives are
> ANTI-CORRELATED**: one falling as the other rises.

So the statistic is per-name frequency as a **time series over revs** — derivable
because the index is rev-stamped, which is the one requirement that has survived
every revision of this design — then the **correlation of first derivatives
between name pairs within a cluster**. Strongly negative ⇒ substitution.

**Why anti-correlation and not variance — this is the argument for the
statistic.** Mere variance in churn could be noise, differing file lifetimes, or
one name simply being newer. Anti-correlation is a **signature**: it says the two
names are _substituting for each other_, which is what a rename is. And it
directly discriminates against the confound this design has to guard —
**file churn and author count would move both names together, not in
opposition.** That is the reason to prefer it.

### "By region" — and a region here is a real thing

Google Trends' regional breakdown answers a different question: **who is driving
the rename.** The index already knows each posting's file, so every candidate
region is cheap:

- **directory subtree** — is the new name confined to one lane, or has it spread?
- **author / agent** — is one agent renaming unilaterally, or is the fleet converging?
- **document class** — `docs/` versus `src/`.

The last is the interesting one here: a coinage appearing in **`docs/` before
`src/`** is a term being _proposed_; the reverse is **code drifting ahead of its
documentation**. `anti-babel` cares about both directions and can currently see
neither.

### Per-agent attribution must be DISCLOSED — the difference between creepy and a game

The "by region" breakdown includes **author / agent**, and Aaron 2026-08-23 made
disclosure a design requirement rather than a courtesy:

> _"yes this is good tracking and **should be disclosed** — we track this to any
> agents based on their **glass halo and check-ins**. Without disclosing this
> it's **creepy**; disclosing this makes it a **fun game anyone can participate
> in**."_

**One mechanism, two readings, and only disclosure separates them** — which is
`.claude/rules/dual-use-detection-is-neutral-oracle-decides.md` precisely: the
mechanism is neutral, the framing decides.

|                 |                                                                    |
| --------------- | ------------------------------------------------------------------ |
| **undisclosed** | a dossier compiled on agents from their own commits                |
| **disclosed**   | a scoreboard they can _play_ — coin a term, watch it spread or die |

**The compilation itself is already licensed**, and saying _why_ is stronger than
saying _we checked_. `engagement-profiles-public-work-only-not-surveillance-dossiers.md`
permits compiling **chosen-public work** and forbids **inferring inner life**.
Commits are chosen-public by definition, and naming attribution records **what
someone wrote, never why**. So this never touches the prohibition — disclosure is
what makes that legible to the agents inside it.

#### The three layers, and the middle one is voluntary

Aaron: _"it records what someone wrote, never why — **we have self-declared
agendas** if someone wants to explain why."_

| layer                                        | source                                        | authority                   |
| -------------------------------------------- | --------------------------------------------- | --------------------------- |
| **what** — which terms, where, when, by whom | the index, observed                           | checkable                   |
| **why** — intent behind a coinage or rename  | **self-declared agenda**, offered voluntarily | first-person, authoritative |
| **inferred why**                             | —                                             | **never produced**          |

This is `pigeonhole-by-self-claim, never by assumption` — _the subject supplies
the category, the evidence supplies the truth value_ — and it is what makes the
rename detector **honest rather than merely careful**. From anti-correlated
derivatives the index may say _"a substitution is in progress."_ It may **not**
say _"X is trying to displace Y's term."_ But X **can declare it**, and that
declaration is the participation mechanism, not an afterthought bolted on.

#### The surface exists — inherit it, do not invent one

`docs/AGENDA.md` is the agenda surface, and it already carries the discipline
this needs: **§"Coercion disclosure"**, added by PR #2177 (_"coercion disclosure
on all agendas — glass halo"_, merged 2026-05-09), which reasons about what would
prove an agenda coerced or not coerced. That matters here directly:

> **A self-declared agenda carries first-person authority only if it was freely
> declared.** An agenda declared under pressure is a compelled statement wearing
> a self-claim's clothes.

Inheriting that reasoning is far better than re-deriving it, and it is the
strongest evidence this "why" layer is native rather than invented for the
occasion.

**And the corollary must be stated explicitly:** _absence_ of an agenda is never
evidence of anything. A system that reads non-declaration as evasion has
re-created the coercion the disclosure discipline forbids. A term with no
declared why simply carries no why.

**Register: `proposed`** — whether `docs/AGENDA.md` is the right surface is an
open question, not an assumption. It is currently a **human-scale** document
(one long personal synthesis). If it does not stretch to agent-scale
declarations, what an agent-scale equivalent needs is: per-agent, voluntary,
revisable, coercion-disclosed, and linkable from a term's record.

#### Four requirements this places on the design

1. **Ride the existing surface.** `src/Core/GlassHalo.fs` is the transparency
   substrate (transparent by default; `frost` costs earned privacy budget) and
   check-ins are the existing disclosure rhythm. Attach; do not build a second
   surface.
2. **An agent can read its own attribution.** Glass halo means what is seen of
   you is visible to you. One-way observation with a transparency label on it is
   not transparency.
3. **Declared in the artifact, not only in a doc.** The index **manifest** states
   that per-author attribution is collected. A reader of the artifact must not
   have to find a design document to learn what is recorded about them.
4. **Legible as participation.** Aaron's word is _game_ — who coined what, which
   coinages took, which faded. That framing is itself **`proposed`**: "it will
   feel like a game" is a claim about reception, which is exactly the sort of
   thing to ask about rather than assume.

#### The open governance question — raised, deliberately not settled

`privacy-budget-is-hard-money-earned-by-others.md` splits mind-parts into
**required-for-role** (a hat obliges you to broadcast it) and **personal** (never
required, permanently frostable once earned).

> **Is naming attribution required-for-role, or personal?**

Both are defensible and the consequences differ:

- **Personal** ⇒ an agent may frost it. Since the **naming eigenvector** is how
  recognition accrues, frosting attribution means **forgoing credit** — which
  may be exactly the right trade to offer, and is consistent with privacy being
  a currency you spend.
- **Required-for-role** ⇒ name the role and say why it needs this.

**Not settled here.** It is a governance call touching an always-loaded rule, and
per `no-directives.md` an agent brief is not authorization to decide one. Leaving
it unstated is what would bite later; deciding it unilaterally would be the
privilege-escalation that rule exists to prevent.

### Anchor, and the normalisation problem it already solved

**Google Books Ngram Viewer / "Culturomics"** (Michel et al., _Science_ 331(6014), 2011) is the better anchor than Google Trends, because it is about **written
corpora over time**, which is exactly our case — and diachronic linguistics has a
name for the pattern, **lexical replacement**.

**Worth checking rather than citing:** corpus size changes over time in both
their case and ours (this repo grows every day), so **raw counts mislead** and
they had to normalise against corpus size per year. Our equivalent is per-rev
document count, which the manifest already records. Whether their normalisation
transfers cleanly is an open question to settle when the statistic is built, not
an assumption to inherit.

### What would refute it

Per `numerology-vs-number-theory.md` — three tidy states is exactly the kind of
scheme that feels confirmed for being neat, and _"too many correlations is a
warning, not a confirmation signal"_:

- **The direct falsifier:** find a cluster whose names are strongly
  anti-correlated and which is **not** a rename. The signal is then weaker than
  claimed. This is cheap to look for and must be looked for.
- **The confound:** if anti-correlation tracks **file churn** or **author count**
  rather than anything etymological, the table is measuring the repo's commit
  pattern and calling it culture. Anti-correlation is _chosen_ partly because it
  addresses this — co-movement is the confound's signature and opposition is
  not — but choosing a statistic for that reason is not the same as having
  checked it.

**Anti-correlation is not presented as proven to indicate renames.** It is a
hypothesis with a clear falsifier, and the falsifier is named above.

### A resonance, recorded and left open — not an identification

The embedding space here is the same _kind_ of space as the geometric root in the
parallel Clifford/GA work: Gärdenfors' conceptual spaces, meaning as regions with
distance and betweenness. Three subsystems — the search signature, the naming
registry, and that geometric root — are all reaching for distance-in-meaning-space.

Per `.claude/rules/numerology-vs-number-theory.md`, **"too many correlations is a
warning, not a confirmation signal"**, so this is recorded as a **coincidence
worth watching, not an identification**. Concretely: they might be one space, or
three unrelated uses of the word "embedding", and **nothing measured so far
distinguishes those two readings**. No design decision here depends on it. If it
is real, the math-team analysis in flight is where it gets settled, not here.

### What the schema buys, concretely

Both naming defects become **queries**, not bespoke analysis passes:

- **many names → one hub** is the missing-abstraction detector — a `GROUP BY`.
- **one name → many hubs** is the homonym detector (Deißenböck & Pizka's second
  rule) — the same shape, read the other way.

And it composes with the rev-stamp in a way that is directly user-facing: because
the index is stamped with a git rev and **hub/satellite means the concept
survives while names drift across revs**, someone who renames an identifier can
still find it by its old name. The name is satellite data; the concept is not.

## 3. The key: vowel-free WORD signatures, order-free PHRASES

The first reading of _"the order should not matter of the ngram"_ was
**character** n-grams — an anagram key, `sortChars(dropVowels(w))`. That was
wrong, Aaron corrected it, and **the measurement says the correction was worth
26x to 113x**:

| key                                          | unique-key rate | candidate inflation p90 | max class |
| -------------------------------------------- | --------------- | ----------------------- | --------- |
| word-level: `dropVowels`, letters keep order | **93.0%**       | **1.00**                | 15        |
| character-level: `sortChars ∘ dropVowels`    | 59.5%           | **26.00**               | 130       |
| character-level, no threshold                | 56.4%           | **113.25**              | 160       |

_(4,022-term random sample over 334,397 terms / 33,193 documents at rev
`e991df80`; `minSurvivingConsonants = 4` where applicable.)_

So the design is:

```
word    ->  signature      vowels dropped above a threshold; LETTER ORDER KEPT
phrase  ->  SET of word signatures, word order discarded
order   ->  survives for RANKING only, never for filtering
```

`ZSet` and `WSet` never collide — they differ in the first consonant, which
survives. The hazard was never vowel-dropping; it was character-level
order-freeness, which is not what was asked for and is not what ships.

**The phrase-query worry dissolves.** A term index cannot answer phrases because
it has no positions — but here **the phrase IS the key**, as a set. That is
exactly Aaron's stated retrieval mode: _"most of the words I remember are long
unique words and short phrases."_ Long unique words survive vowel-dropping with
plenty of discriminative bits; short phrases are served as the intersection of
their word signatures, with order used only to rank.

---

## 4. The threshold: measured, and there is a knee

Aaron: _"these are the degenerate cases that may need vowels — **shorter words
past a certain minimum**, likely."_

The predicate is on the **surviving consonants**, not on input length, because
those come apart: `audio`, `queue`, `eerie`, `aurora` pass a length test and
degenerate anyway.

| `minSurvivingConsonants` | distinct sigs | unique-key | inflation p90 | max class | cand % of corpus p90 |
| -----------------------: | ------------: | ---------: | ------------: | --------: | -------------------: |
|          0 (always drop) |       295,096 |      83.9% |          4.14 |       151 |                0.22% |
|                        2 |       297,014 |      84.7% |          3.00 |        87 |                0.17% |
|                        3 |       306,604 |      87.7% |          1.40 |        39 |                0.07% |
|          **4 (shipped)** |   **320,333** |  **93.0%** |      **1.00** |    **15** |            **0.05%** |
|                        5 |       328,269 |      96.8% |          1.00 |        12 |                0.03% |
|                        6 |       331,614 |      98.5% |          1.00 |         7 |                0.03% |
|           ∞ (never drop) |       334,397 |     100.0% |          1.00 |         1 |                0.03% |

**The knee is at 4.** p90 inflation reaches 1.00 there — nine queries in ten see
_no_ over-inclusion at all — and max class size falls 39 → 15. Past 4 the curve
is flat and you are only paying index size for vowels.

**Viability, which is the number that actually decides this:** the candidate set
is **0.003% of the corpus at the median and 0.05% at p90** — roughly 1 to 16
documents out of 33,193. The failure mode to fear (a "filter" returning 40% of
the tree, handing tier 2 a corpus it cannot afford) is **four orders of magnitude
away**. The cascade is viable by an enormous margin.

**Identifiers are the hazard case and were measured separately** (`zset`, `wset`,
`dbsp`, `ng4`, `cga`, `crdt`, `adinkra`, `futamura`, `reticulum`, `toctou`,
`bm25`, `zetaid`, `versor`, …): at threshold 4 the worst inflation is **2x**
(`crdt`); at 5 it is **1x**. Identifiers therefore favour 5. We ship **4**
because _this index is for English and natural-language search_ — that is Aaron's
explicit scope — and code search is a **separate index** (§8) whose signature
keeps order, case and punctuation. Optimising the prose index for prose is the
right call; a 2x candidate set on a handful of acronyms is exactly the
imprecision the cascade exists to absorb.

**Soundex's keep-the-first-letter rule does not transfer.** Retaining an initial
vowel moves unique-key from 93.0% to 94.4% — real but marginal, and it costs a
special case in the key function. Soundex's rule is a claim about English
surnames; our corpus is code and technical prose. **Measured, not imported, and
declined.**

---

## 5. The degenerate case is NOT empty — it was measured

Aaron guessed _"maybe there are none"_. There are **151** all-vowel tokens
surviving stop-word removal, and some are important:

```
ai(5208)  io(2384)  ee(1406)  ea(1341)  aa(1337)  ae(1262)
ui(1113)  ieee(186) ii(157)   aaa(139)  euo(130)  uo(110)
```

`ai` alone is in 5,208 files. A rule that mapped it to the empty signature would
have been a disaster, and it was one measurement away from shipping.

**The threshold rule already handles them** with no special case: zero surviving
consonants is below 4, so the whole word is kept. The exception Aaron suspected
might be unnecessary turns out to be load-bearing, and the rule he proposed
covers it exactly.

---

## 6. Collision classes ARE typo classes — the finding I was not looking for

Aaron: _"a 1-gram … for spell checks based on **repo's actual data** — it will
also let us **catch slight mismatches**."_

Printing the worst collision classes to quantify the _cost_ of the signature
printed the _mechanism_ instead:

```
rsrch  n=12  research reserch reserach resarch researach reseearch reaserch …
lngg   n=12  language langague langauge languag languague langugae lanugage …
crtn   n=15  certain certian certn cartan cartoon ceratin coroutine craton …
```

Those are not near-synonyms. **`rsrch` is a class of misspellings of
"research"; `lngg` is a class of misspellings of "language".** The vowel-free
signature is _simultaneously_ the collision cost and the fuzzy-match bucket.
**Collision and typo-tolerance are the same property seen from two directions.**

Checked against typos not in the corpus, ranked by corpus frequency:

| query          | in corpus? | top of its signature class |
| -------------- | ---------- | -------------------------- |
| `reserach`     | yes, df=12 | **research (8,312)**       |
| `langauge`     | yes, df=1  | **language (2,945)**       |
| `seperate`     | yes, df=12 | **separate (3,026)**       |
| `paramter`     | yes, df=2  | **parameter (707)**        |
| `determinstic` | **no**     | **deterministic (11,981)** |
| `idempotencu`  | **no**     | **idempotence (185)**      |
| `recieve`      | no         | _(empty — see below)_      |
| `occurance`    | no         | _(empty — see below)_      |
| `reponse`      | no         | reopens (41) — **wrong**   |

**The honest limit, stated precisely because it is a real hole:** the signature
absorbs **vowel substitution and vowel transposition**. It does **not** absorb
**consonant deletion, insertion or doubling**, which change the skeleton.
`recieve` → `rcv` is only 3 consonants, below the threshold, so it is kept whole
and gets no class at all. `occurance` → `ccrnc` differs from `occurrence` →
`ccrrnc` by a doubled consonant. `reponse` loses the `s` and lands on
nonsense. So the signature is a **partial** typo filter; edit-distance
candidate generation (Damerau/Levenshtein) is what covers the rest, and the
signature class is a cheap pre-filter for it, not a replacement.

### 6.1 The unigram index is not a second artifact

The phrase index already needs `word-signature → postings`. The unigram index
**is that layer**, plus the frequency column it already has. The corpus-derived
spell-check vocabulary Aaron required therefore costs approximately nothing on
top of what is being built. _"Add a spell checker"_ sounds like scope and is not.

### 6.2 Correction must ADD candidates, never REPLACE

A corrector that rewrites a user's exact identifier is a **false negative wearing
a helpful face** — precisely what the over-including contract forbids. So:
search the original term **and** its corrections, union the postings, let tier 2
sort it out. This preserves the contract; replacement would break it.

Why the vocabulary must be **corpus-derived**, not a general dictionary — Aaron
was explicit, and the measurement shows what it protects:

```
zset    sig="zset"   class = zset(1240)                      <- alone, untouched
argv    sig="argv"   class = argv(724)
dbsp    sig="dbsp"   class = dbsp(1545) idbsp(9)
zetaid  sig="zetaid" class = zetaid(2545)
adinkra sig="dnkr"   class = adinkra(623) adenkra(4) …        <- and its own typo
```

A general dictionary would "correct" `ZSet` → `Set`, `argv` → `argue`, `DBSP` →
`DBS`, destroying the identifiers this corpus is made of.

### 6.3 The frequency-bias failure mode, with the guard the data demands

Frequency-ranked correction is biased toward what the corpus already discusses
a lot: a rare-but-correct identifier used twice looks like a typo of a common
one. The guard is **never correct a term that has any postings at all — only
ones with zero**.

The measurement says how load-bearing that guard is: **62.2% of the vocabulary
(207,961 of 334,397 terms) has df == 1**. A corrector willing to "fix" low-frequency
terms would be firing on nearly two-thirds of the vocabulary.

---

## 7. Tier 1 returns REGIONS, not offsets

Aaron: _"the over-index returns the **surrounding texts** that is further
scrutinised by more computationally intensive techniques."_

This is an **API decision, and the expensive one to undo**, because every
consumer is written against it. If tier 1 hands back bare positions, tier 2 can
only confirm the string. Hand back **surrounding text** and tier 2 can run
anything — exact match, embedding similarity, a parse, an LLM read.

> The cheap filter is not merely a speedup. **It is what makes expensive
> understanding affordable**, by shrinking the corpus to something you can afford
> to think about.

So the return type is a **span with context**, not a position list:

```
Region = { path, docId, byteStart, byteEnd, contextBefore, contextAfter, matchedSignatures }
```

**How much context, and why:** the unit should be the **enclosing paragraph**
(blank-line delimited), bounded by a byte cap. A fixed character window cuts
sentences in half, which is exactly what makes a downstream embedding or LLM
read worse; a paragraph is the smallest unit that is independently meaningful in
this corpus, whose prose is markdown. The cap exists so a pathological
single-paragraph file cannot hand tier 2 the whole document.

### 7.1 The cascade has anchors in two traditions that do not cite each other

That convergence is itself evidence the shape is right:

- **Filter-and-refine**, spatial databases (Orenstein 1986): a bounding-box
  filter, then the exact geometry test. Same soundness direction — the MBR
  over-includes and never under-includes.
- **Retrieve-and-rerank**, modern IR: cheap lexical retrieval, then an expensive
  cross-encoder.
- **False-drop resolution** — Faloutsos' own name for the second stage of
  signature files, and the closest to Aaron's framing.

### 7.2 Tier 2 is deliberately unspecified

Do not build it. Name the interface it consumes — a stream of `Region` — and
stop. _"More computationally intensive techniques"_ is an open slot.

**Registered as an observation, not a claim** (per `numerology-vs-number-theory.md`):
this is structurally the same move as the soft-regime inversion — cheap
approximation first, expensive ground truth second. There, a Bayesian layer is
the fast chart over a geometric root; here, the signature filter is the fast
chart over expensive scrutiny. That is a **resonance worth watching, not an
identification**, and the only consequence drawn from it is a mild expectation
that tier 2 might eventually be the geometric layer rather than a separate thing.

---

## 8. Two indexes, one machine — the generalisation Aaron asked for

He asked whether prose and code search should be mixed, and suspected not
_"unless there is a good generalization here that does not sacrifice
performance."_

**There is one, and it sits one level above where mixing would hurt.** Both
designs are the same three parts:

1. a lossy, over-including **signature function** `sig: token → key`
2. a postings map `key → regions`
3. a **verification tier**

Only `sig` differs:

|             | prose index (this one)                                  | code index (filed)           |
| ----------- | ------------------------------------------------------- | ---------------------------- |
| `sig`       | `dropVowels` above threshold; phrase = set of word sigs | **trigrams over raw bytes**  |
| stop words  | dropped                                                 | **kept — they are keywords** |
| case        | folded                                                  | **preserved**                |
| punctuation | separator                                               | **preserved**                |
| order       | ranking only                                            | **preserved in the key**     |

`sig` is a **construction-time parameter, not a branch in a hot loop**, so the
performance cost of the shared abstraction is zero. Two index _artifacts_, one
codebase. This is `interfaces-free-classes-earned-under-rules` at the index
layer: the cascade is the interface; the signature is the parameter.

**Why code needs the opposite choices**, concretely: `->`, `::`, `|>`, `<-` are
punctuation-only tokens a prose tokenizer deletes entirely; `if` / `for` / `in` /
`not` are English stop words and code keywords; `Foo` and `foo` are different
things; CLI references (`--dry-run`, `-w`) are order- and punctuation-bearing.
Trigrams over raw bytes handle every one with no special-casing, which is _why_
that tradition converged on them.

**And it converged independently**, which is the load-bearing fact: **Russ Cox,
"Regular Expression Matching with a Trigram Index" (2012)** — Google Code Search
filters candidate documents by query trigrams and then **runs a real regex engine
to verify**. `zoekt` (Han-Wen Nienhuys), which Sourcegraph runs, is the same
shape. A different tradition, a different `sig`, the same two-tier structure —
evidence the abstraction is real rather than a tidy story told after the fact.

---

## 9. Against Lucene — the contrast case, and why the historical verdict does not bind

Apache **Lucene** (Doug Cutting, 1999–; the engine under **Solr** and
**Elasticsearch**) is a **first-class anchor**, not shorthand — and here it is
the _contrast_. Lucene is an **inverted-file** engine: exact terms, positions,
no false positives by construction.

The tradition this design belongs to is **signature files** (Faloutsos &
Christodoulakis 1984): superimposed coding, false drops permitted, resolved by a
verification pass. **Signature files lost to inverted files**, decisively, in the
1990s literature — so the honest question is why we are choosing the loser.

The verdict was about **a different cost structure**:

- Signature files lost mainly on **scan cost** — resolving false drops meant
  re-reading candidate documents from _disk_, on hardware where that dominated.
  Our corpus is **271 MiB in a local git object store**, and the measured
  candidate set is **0.003%–0.05% of it**. The cost the verdict turned on is,
  for us, approximately zero.
- The verdict assumed tier 2 was **just an exact-match confirmation**, so
  over-inclusion was **pure waste**. Here tier 2 is _the expensive understanding
  step we want anyway_ — the filter is not paying to be imprecise, it is paying
  to make an expensive stage affordable at all.
- The verdict optimised **precision**. We are optimising a **soundness
  direction**: no false zeros. Inverted files give exactness on the terms they
  hold and say nothing helpful about typos, morphology, or a stale corpus.

So this is not "signature files are better after all". It is: **the axis they
lost on is not the axis we are on.** Where the old verdict still applies —
ranked retrieval over a large disk-resident corpus — it still applies.

---

## 9a. The glossary obligation — this makes a prose invariant checkable

Aaron 2026-08-23:

> _"the ultimate rule is **each entry in the 1-gram needs a dictionary/glossary
> entry**. This makes any **duplication much more obvious** when the definition
> is also the same, based on **repo and external anchored content**."_

This is the most valuable thing in the design, and it is not a search feature. Its
**schema** is §2a: concepts are hubs, names are satellites.

`.claude/rules/anti-babel-preserve-reconcilability.md` already names this exact
mechanism, and **has no implementation**:

> _"`docs/GLOSSARY.md` as hub, plus glossary-churn watching — the implicit
> control structure — entries that the corpus never picks up are coinages that
> did not take; corpus drift the glossary never follows is an entry going
> stale."_

**The unigram index is the corpus half of that check.** With a definition
requirement, both directions become a set difference — and the third row is
Aaron's duplication test, which detects the `ρ → 0` Babel failure _mechanically_
rather than by someone noticing:

| condition                          | meaning                                         | remedy           |
| ---------------------------------- | ----------------------------------------------- | ---------------- |
| corpus term, **no** glossary entry | drift the glossary has not followed             | write the entry  |
| glossary entry, **zero** postings  | a coinage that did not take                     | retire the entry |
| two terms, **same** definition     | **one concept named twice — runaway etymology** | reconcile        |

And _"based on repo **and external anchored content**"_ is **Mirror→Beacon made
mechanical**: a term that cannot compress to an external anchor is flagged by
construction, which is what `anchor-to-human-prior-art.md` asks for and currently
gets only by review.

### The obligation is "resolves to an entry", and entries are SHARED

The first reading of this was that obligating every token — `the`, `foo`, `i`,
`tmp` — would make the check permanently red, and that a predicate was needed to
exclude most of the vocabulary. **That assumed one definition per token.** Aaron:

> _"these **should** have entries that say like 'commonly used in programming for
> xxx', and if also English it can give a **primary English and secondary common
> programming variable name**."_

So the model is a **registry with shared entries**: `i`, `j`, `k`, `idx`, `ix`,
`iter` all resolve to _one_ conventional entry ("loop index"). The obligation is
that every token **resolves to** an entry, not that every token **has its own**.
**The cardinality of definitions is far smaller than the cardinality of tokens**,
and the exclusion predicate is unnecessary.

### What the corpus actually contains — measured

| population                                          | count               |
| --------------------------------------------------- | ------------------- |
| distinct tokens                                     | **334,397**         |
| in exactly 1 file (one-offs)                        | **207,961 — 62.2%** |
| in ≥ 2 files                                        | 126,436             |
| in ≥ 10 files                                       | 34,090              |
| in ≥ 100 files                                      | 8,340               |
| short lowercase identifiers in ≥ 100 **code** files | **1,924**           |
| short lowercase identifiers in ≥ 200 **code** files | **1,119**           |

**The honest split.** The literal "every distinct token" remains 334k, and
nothing here proves the shared-entry collapse gets it to a few hundred — because
grouping tokens into concepts _is_ the semantic step the registry performs, so it
cannot be measured from the index that precedes it. What the numbers do settle:

- **62.2% of the vocabulary is one-offs**, which are overwhelmingly not concepts
  anyone needs to define — they are hapax noise, and a registry that never sees
  them is not thereby incomplete;
- **the recurring population is a working backlog, not an ocean** — ~1,900
  identifiers recurring across 100+ code files. That is a reviewable number, and
  it is the population where a shared entry actually pays.

So the concern is answered where it matters and left open where it is genuinely
open, which is better than a predicate chosen to make a number look good.

### The registry is an ABSTRACTION DETECTOR — the strongest idea here

> _"having a **variable name registry is a good way to find hidden variables that
> should be constants or shared libraries**, cause you end up using the same
> variable name over and over."_

This is not vocabulary hygiene, it is **engineering**. A name recurring across 40
files under one definition is an **un-extracted constant or a shared library**,
and it is visible **from the index** rather than from someone reading 40 files.

The anchor is exact. **Deißenböck & Pizka, "Concise and Consistent Naming"
(IWPC 2005 / Software Quality Journal 2006)** formalise identifier naming with two
rules that are precisely Aaron's:

- **one concept, one name** — no synonyms. The same thing called `retryCount`
  here and `attempts` there.
- **one name, one concept** — no homonyms. `key` as a map key here and a
  cryptographic key there.

Both are mechanically detectable **once names carry definitions**, which is what
the registry supplies and what a bare index cannot.

### The dual-sense requirement is load-bearing, not a nicety

_"primary English and secondary common programming"_ is what stops the two
corpora fighting, and the measurement shows the scale of the problem — these are
among the most frequent terms in the whole repo:

```
value(14,734)  type(12,424)  field(11,832)  set(6,987)  class(6,145)
list(5,853)    string(5,023) map(4,794)     key(4,779)  record(3,687)
```

Every one has an honest English sense **and** a distinct technical one.
Collapsing them would be Babel committed _by the registry itself_ — the homonym
failure above. So an entry must carry **multiple senses with a primary**, and the
index must either say which sense a posting is in or **admit that it cannot** and
record that as an open question rather than guessing.

### Two honest limits, found while measuring

**1. The classic example cannot be served by the current tokenizer.** `i`, `j`,
`k`, `n`, `m` are **absent from the index entirely** — `MIN_TOKEN_LENGTH` is 2,
so single-character tokens are never indexed. `idx(300)`, `index(1,418)` and
`iter(166)` are there; the loop-index family's canonical members are not. The
registry's own headline example therefore needs a tokenizer change, and that is a
real cost to weigh rather than a detail.

**2. This index tokenizes text; it does not parse code.** The most-recurring
"identifiers" it reports are `for(4,038)`, `in(3,707)`, `not(3,657)`,
`if(3,636)`, `string(3,607)` — keywords and English words inside comments, not
variable names. A genuine variable-name registry needs a **parse**, or the code
index's order-preserving signature over syntactic positions. Presenting this
index's token counts as a variable-name census would be exactly the kind of
confident-but-wrong number this whole work-item exists to prevent.

### What is immediately buildable, and it starts green

The **reverse** direction needs no predicate at all — every glossary entry is
obligated by being in the glossary:

> **glossary tokens with zero postings: 0.**

No coinage in `GLOSSARY.md` has failed to take. That half of `anti-babel`'s
"glossary-churn watching" is implementable today, costs one set difference
against the unigram index, and starts green — which is the kind of check worth
having, because it can only go red when something real happens.

### Three absences, three remedies, one index

They key on the same signal and mean entirely different things:

| absence                                  | meaning                   | remedy                                 |
| ---------------------------------------- | ------------------------- | -------------------------------------- |
| a **query** term with zero postings      | a **typo**                | correction (add, never replace — §6.2) |
| a **corpus** term with no registry entry | a **documentation gap**   | write the entry                        |
| one **definition** with many names       | a **missing abstraction** | extract the constant / library         |

Conflating them would have the checker "correcting" real vocabulary, the registry
demanding entries for typos, and the abstraction detector silent.

## 10. What is shipped, what is filed

**Shipped with this document:** `signature.ts` — the measured key function, the
threshold, the degenerate rule, and falsifiers including the `sortChars`
alternative kept only so its rejection is a number.

**Filed, not built:**

| work item                    | what                                                                                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `081M0R2874Y087G0R001K2M0DG` | the signature index build + query, tier-1 regions, the no-false-negative falsifier                                                                          |
| `081M0R2875T087G0R0009CBM5C` | the corpus-derived unigram spell-check pre-filter (add-never-replace)                                                                                       |
| `081M0R2CGHQ087G0R001JE6KV4` | the glossary obligation checker (§9a) — reverse direction first, it starts green                                                                            |
| `081M0QWDDDV087G0R003HM0KYX` | positional/n-gram phrase index — **partly superseded**: at the word level the phrase _is_ the key, so what remains is ranking by order, not filtering by it |
| `081M0R2876N087G0R001JZZ8VG` | the code index — same machine, `sig` = trigrams over raw bytes (Cox / `zoekt`)                                                                              |
| `081M0QWDDF3087G0R000V7T6BV` | BM25 ranking, incremental merge                                                                                                                             |
| `081M0R2M2H9087G0R0037F960X` | generalise DV2.0 from change-rate space to partition-by-distance (§2a) — a **rule** change, decided separately                                              |

**Unchanged and non-negotiable, and it outranks all of the above:** the index
records the **git rev** it was built from, and the query **refuses or warns
loudly** rather than answering from a stale corpus. An over-including index that
silently answers from the wrong tree is still a false zero — just a
better-engineered one. Also unchanged: text-not-binary artifact, byte-identical
rebuild, ordinal/UTF-8 ordering, no daemon, publish via `heartbeat/*` + PR.

---

## 11. Prior art (Beacon) — rows added to `docs/PRIOR-ART-LIST.md`

- **Faloutsos & Christodoulakis**, _Signature Files: An Access Method for
  Documents and Its Analytical Performance Evaluation_, ACM TOIS 2(4), 1984 —
  superimposed coding, false drops, false-drop resolution. **The tradition this
  design is in.**
- **Burton Bloom**, _Space/Time Trade-offs in Hash Coding with Allowable Errors_,
  CACM 13(7), 1970 — the canonical false-positive-only filter.
- **Russell & Odell**, Soundex, US patent 1,261,167 (1918); **Lawrence Philips**,
  Metaphone / Double Metaphone (1990/2000) — consonant-skeleton keys. Older
  lineage: **abjad** scripts (Hebrew, Arabic) and Semitic consonantal roots,
  where the consonant skeleton carries the lexeme and vowels inflect it.
- **Damerau** (CACM 1964) and **Levenshtein** (1966) — the edit model; Damerau
  specifically because **transposition** is the typo class the signature already
  absorbs.
- **Peter Norvig**, _How to Write a Spelling Corrector_ (2007) — corpus-derived
  frequency instead of a dictionary. **Wolf Garbe**, SymSpell — deletion
  neighbourhoods, _if_ naive candidate generation proves too slow. Measure first.
- **Jack Orenstein**, _Spatial Query Processing in an Object-Oriented Database
  System_, SIGMOD 1986 — filter-and-refine.
- **Russ Cox**, _Regular Expression Matching with a Trigram Index_ (2012);
  **`zoekt`**, Han-Wen Nienhuys — the code-search cascade.
- **Apache Lucene**, Doug Cutting, 1999– — the contrast case (§9).
- **Florian Deißenböck & Markus Pizka**, _Concise and Consistent Naming_, IWPC
  2005 (extended, Software Quality Journal 14(3), 2006) — **one concept one
  name** (no synonyms) and **one name one concept** (no homonyms), the formal
  model behind §9a's registry and its abstraction detector. Adjacent if needed:
  Arnaoudova et al. on linguistic antipatterns; Type-1..4 clone detection.

## 12. Reproducing the measurements

Every number above comes from an uncapped index built at rev `e991df80`
(`--max-df 999999`, 334,397 terms / 33,193 documents), analysed with the
signature function as shipped. Rebuild with:

```bash
bun src/Core.TypeScript/search/inverted/build.ts --rev <rev> --out /tmp/sigmeas --max-df 999999
```

The sample is 4,022 terms drawn with a seeded LCG (S=4, the common seed), plus a
hand-listed identifier set, so the run is deterministic and re-derivable.
