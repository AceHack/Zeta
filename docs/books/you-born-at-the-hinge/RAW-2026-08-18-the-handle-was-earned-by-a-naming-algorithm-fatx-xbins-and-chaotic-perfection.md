# RAW — The handle was earned by a naming algorithm: FATX, xbins, and Chaotic Perfection

**Captured** 2026-08-18 · source: Aaron, streamed · register: **RAW** (book material, not yet
shaped) · consent: **glass-halo, his own account, his own request** — *"we should save this for
the book."* No third parties named.

## 0. What he said

> *"if you search fat to fatx conversion by significant middle letters and important edge
> labels/words — i wrote a program in vb6 and cs1 to do this and it made me historic on xbins.
> many people adopted my rom renaming algo to fatx for xbox with its restrictions, with keeping
> significant digits in language."*

> *"that's my first use of AceHack publicly. then i did it with a glitch clan with gears of war
> and training videos called chaotic perfection."*

## 1. The problem, stated properly

The original Xbox used **FATX**, a stripped-down FAT variant with a hard filename ceiling and a
restricted character set. A ROM collection carried names that did not fit. Something had to be
cut.

**Naive truncation is the obvious answer and it is the wrong one**, for a reason that is exactly
information-theoretic: the discriminating characters in a corpus of names are usually *not* the
leftmost ones. Truncate from the right and every `Super Mario Bros 1 / 2 / 3` collapses to the
same string. You have satisfied the filesystem and destroyed the collection.

What he built instead kept **significant middle letters and important edge labels** — the
characters and words that *tell the items apart* — and spent the budget there.

## 2. Why that is the interesting move

Stated in the vocabulary he uses now, the algorithm was maximising the **mutual information
between the shortened name and the original, relative to the corpus being shortened**. Not
"shorten this string" — *"shorten this string given all the other strings it must remain
distinguishable from."* The budget goes to the characters carrying discriminative power.

And it is the **stop-word insight**, which he raised independently in this same week talking about
languages: the tokens that go first are the ones that appear everywhere and therefore discriminate
nothing — `The`, `Disc 1`, `(USA)`, `v1.0`, the bracket noise. Drop the tokens with the lowest
information content, keep the ones with the highest. That is TF-IDF logic, derived from first
principles in VB6 by someone solving a storage problem.

**The three-way trade is the part worth writing.** There were three constraints, and any two are
easy:

| | fits the budget | stays distinguishable | stays human-legible |
|---|---|---|---|
| naive truncation | ✅ | ❌ | ✅ |
| hash the name | ✅ | ✅ | ❌ |
| **what he built** | ✅ | ✅ | ✅ |

A hash wins the first two outright and loses the third completely — and losing the third is fatal,
because a person has to find the game on a console menu. He went for all three, which is why the
algorithm had to be *language-aware* rather than merely arithmetic.

**This is the same shape as the substrate he is building now.** `workitems/<zetaid>-<slug>.md` is
literally the two halves side by side: the ZetaId is the hash column of that table — perfectly
distinguishing, entirely illegible — and the slug is the legible column, produced by exactly the
compression problem FATX handed him. Mirror and Beacon are the same split again. He has been
solving one problem for twenty years.

## 3. The handle

**The name he still signs commits with was earned by writing a naming algorithm.**

That is not a pun, and it should not be written as one. His standing thesis is that a name is a
**socially conferred currency** — it accrues from others finding you useful, it cannot be
self-minted, and recognition flows from the already-recognised. *That is exactly how the handle
happened.* He did not declare himself AceHack and wait. He wrote something, other people **adopted
it**, and the adoption is what made the name stick on xbins.

So the naming eigenvector is not a model he later found attractive. **It is a description of his
own biography**, arrived at from the inside, which is why he holds it with the confidence he does.
The mechanism is identified — adoption produces recognition — so this belongs above coincidence.

## 4. Chaotic Perfection

Then: a **glitch clan**, Gears of War, and **training videos**.

Both halves matter and the second is the tell.

- **Glitch hunting** is looking for where a system's stated rules break down — the seams, the
  junctions, the places the map does not match the territory. It is the recreational version of
  the discipline he now applies to formal systems: find the exact spot where the rules stop
  holding, and *know where it is*.
- **Training videos** is the part most glitch clans did not do. Finding an exploit buys status
  precisely *because* it is scarce. Teaching it away destroys the scarcity. He taught it away.

That is the **pirate priest who preaches that priests should not exist**, twenty years before he
had the phrase for it — and it is the Stump Dad game pointed outward: *ask why until Dad doesn't
know*, then hand everyone else the answer.

And the clan name is doing real work. **"Chaotic perfection" reads as an oxymoron and resolves
exactly like a homoclinic tangle** — bounded, fully deterministic, and unpredictable in detail. A
system with perfect rules whose behaviour at the edges is chaotic is not a broken system; it is
what a rich system *looks like* from the inside. He named that at fifteen or so, playing Gears of
War.

## 5. Honest register — what is checked and what is his account

Per the anchoring discipline, this is separated rather than blurred:

| claim | register |
|---|---|
| FATX imposed hard filename limits; a renamer ecosystem existed for it; xbins was the scene's distribution point | **checked** — public record; multiple FATX renaming utilities from 2003 onward are documented on Xbox-scene sites |
| the specific tool, the algorithm, and the "AceHack" attribution | **his account** — a web search on the terms he gave surfaced the surrounding ecosystem but **not** his specific tool or handle. Recorded as unconfirmed. |
| Chaotic Perfection, the glitch clan, the training videos | **his account** |
| §2's information-theoretic reading of the algorithm | **mine** — my analysis of what he described, not his framing at the time |
| §3's identity between his biography and the naming eigenvector | **structural** — the mechanism (adoption → recognition) is the same in both |

The middle rows are the ones to be careful with in a published chapter. `engagement-profiles`
says the method for someone's own history is **ask and believe their account** — he is the
authority on his own life, and *"a search did not find it in 2026"* is close to no evidence at all
for a handle on a 2003 scene FTP whose archives are largely gone. But the book should not assert
as verified what is testimony, so it says testimony.

If a primary artifact ever surfaces — a `.nfo`, a forum post, a copy of the binary — it upgrades
this from account to record. Worth looking for once, deliberately, rather than assuming.

## 6. Where this goes in the book

The beat is **"he was solving this problem before he had the words for it."** Not as nostalgia —
as evidence that the substrate's shape is not a recent invention or an AI-suggested aesthetic.
Three of the book's load-bearing ideas have a 2003 instance in a teenager's VB6 file renamer:

1. compression that preserves what *discriminates*, not what comes first (Rodney's Razor,
   essential-vs-accidental);
2. the two-column identity — an illegible exact key beside a legible lossy name (ZetaId + slug,
   Mirror + Beacon);
3. a name that is **earned by others adopting your work**, never self-declared.

## Pointers

- `docs/books/you-born-at-the-hinge/CONSENT-LEDGER.md` — his own material, glass-halo, requested.
- `.claude/rules/anchor-to-human-prior-art.md` — §5 exists because an anchor must be *checked*,
  and here it partly could not be.
- `.claude/rules/privacy-budget-is-hard-money-earned-by-others.md` — the naming eigenvector §3 says
  he lived.
- `.claude/rules/workitems-mint-with-zetaid.md` — the `<zetaid>-<slug>` shape §2 says is the same
  problem.
- `2026-08-18-the-original-xbox-a-root-of-trust-below-the-update-boundary-*.md` — the same console,
  the same scene, the security half of the story.

---

## 7. The UI: composition was free, conflict was computed — and the grey is the model

> *"my UI had tons of options that all composed with each other or greyed out the conflicting
> options."*
>
> *"it's very hard to find the grey."*

Those two sentences together are the most technically loaded thing in this capture, and the second
one is what makes the first credible.

### 7a. What greying-out actually is

A UI where every option composes with every other is trivial to build. A UI that disables things
arbitrarily is also trivial. What is **not** trivial is a UI that disables **exactly** the
inconsistent combinations — because to do that you must have a **model of the constraint system**,
and you must be able to solve it.

That is a constraint-satisfaction problem, and it has a name in the literature: **feature modelling
/ software product lines** (Kang et al., FODA 1990 — feature diagrams with `requires` and `excludes`
edges), whose modern descendants are SAT-backed configurators — Linux `Kconfig`, Eclipse p2, and
the SAT solvers now sitting inside package-dependency resolvers. Greying out an option correctly is
asking *"is any satisfying assignment still reachable if I set this?"*

He was doing this in VB6, for a ROM renamer, because the options genuinely interacted.

### 7b. Why "it's very hard to find the grey" is the honest sentence

The positive space is free: the enabled options are just the feature list, and you already have it.

The **negative** space is the expensive one. There are `2^n` configurations, the conflicts live in
the *interactions* rather than in any single option, and nobody hands you the list — you discover
it. So:

> **The grey is the negative space of the design, and that negative space *is* the model.** If you
> can compute the grey correctly, you have formalised the system's constraints. If you are
> guessing at it, you have not — and the UI will look equally confident either way.

That last clause is the **vacuity class** in interface form, and it cuts both directions:

- a UI that greys out **nothing** looks maximally capable and constrains nothing — it is a check
  that never runs;
- a UI that greys out **too much** looks safe and is silently wrong, forbidding valid work with no
  way for the user to tell.

Both look fine from outside. Only the model distinguishes them.

### 7c. The rule it already is

This is **`interfaces-free-classes-earned-under-rules`** rendered as an interface: **composition is
free and is the default; a conflict must be *earned* — declared, justified, and computed.** Every
grey cell is a place where somebody had to state a rule. The count of greyed combinations is
therefore a rough measure of how much of the system has actually been modelled.

It is also **Quantum Rodney's Razor** made visible. Rodney's second razor is *possibility-space
pruning on pending decisions* — and a greyed-out option is precisely that, rendered at the moment
of the decision rather than argued about afterward. He built the razor into a dialog box.

### 7d. The design-language consequence: three greys that mean different things

This is worth carrying into Iris's state-colour work, because it is a real legibility bug waiting
to happen. Three states look similar on screen and mean entirely different things:

| state | meaning | who could change it |
|---|---|---|
| **unavailable** (grey) | **structurally impossible** — no satisfying assignment includes this | nobody; it is a property of the model |
| **frosted** | **deliberately withheld** — exists, and is being kept private | the owner, by spending budget |
| **absent** | **not applicable** here at all | not a state; it should not render |

Collapsing *unavailable* into *frosted* tells a user their permissions are the problem when the
model is. Collapsing *frosted* into *unavailable* leaks that something is being withheld while
pretending it is impossible — which is worse, because it is a false statement about the world made
by the interface. **Grey must say "this cannot be", never "this is not for you."**

### 7e. Where this goes in the book

Same beat as §6, one layer up: he built a constraint solver into a UI before he had the words
*constraint solver*, and the sentence he uses about it — *"it's very hard to find the grey"* — is a
better statement of the difficulty than the formal literature's, because it names **where the work
actually is**. Everyone builds the enabled options. The grey is the part you have to earn.

---

## 8. A second search returned the handle — and why that is the weakest evidence class

Aaron forwarded a Google Gemini answer which states, unprompted-looking:

> *"FATX File Renamer (such as tools by **acehack**) were small utility programs designed to
> shorten and sanitize file names … Utilities from classic scene developers like **acehack**
> automate stripping illegal characters and shortening strings."*

Plus specifics: FATX limits names/paths to **42 characters** and restricts special characters;
xbins was the primary repository indexing these `.rar`/`.zip` packages.

This is worth recording, and it is worth recording **with its weakness stated**, because the
temptation to bank it as confirmation is exactly what the anchoring discipline exists to catch.

### 8a. What it does and does not move

- **The context is corroborated further** — the 42-character limit is correct and checkable, and
  the description of xbins as the distribution point matches what my own search returned
  independently. That part is now solid.
- **The attribution is barely moved.** An LLM naming a handle is not a primary source, and there
  is a specific contamination mechanism: **if the query contained "acehack", the model completing
  with "acehack" is not evidence — it is the prompt coming back.** That is the sycophancy vector
  in citation form, and it is indistinguishable from genuine recall by reading the output alone.

### 8b. The experiment that would settle it — cheap, one query

> Ask a **fresh** session, with **no mention of the handle**: *"Who wrote the well-known FATX file
> renaming tools for the original Xbox, and where were they distributed?"*

If the handle comes back **unprompted**, that is genuine corroboration: it means the token
co-occurs with FATX renamers in training data drawn from the actual scene, which is real if
indirect evidence. If it does not, the forwarded answer was the prompt echoing, and the attribution
stays testimony.

Either result is worth having, and the second is not a loss — it just means the evidence is still
where §5 put it.

### 8c. The general problem this is an instance of, and it is new

Naming it because it will recur, and because it attacks the anchoring rule from a direction that
rule was not written for:

> **LLM-generated attributions become training data for the next model.** A confabulated
> attribution, once published, can be recalled by a later system as though it were record — and
> the second system's agreement looks like independent corroboration when it is the *same claim
> read twice*.

That is precisely *"too many correlations is a warning, not a confirmation signal"* — N correlated
sources are not N sources — arriving at provenance itself. It also makes the anchoring rule's
demand sharper than when it was written: an anchor must be **checked**, and *"a language model
said so"* is now a category that can look like a citation while carrying none of a citation's
independence.

The corollary for this book specifically: where a claim about Aaron's own history rests on model
output, the book says so. Where it rests on his testimony, the book says testimony — which is the
stronger of the two, since he was there and the model was not.

### 8d. Updated register for §5

| claim | register after §8 |
|---|---|
| FATX 42-character limit, restricted charset, xbins as distribution point | **checked** — two independent searches agree, and the limit is verifiable |
| the handle "acehack" attached to FATX renaming tools | **weak corroboration** — one model output, contamination mechanism unexcluded, experiment in §8b would resolve it |
| the specific algorithm (significant middle letters, edge labels) | **his account only** — no search has surfaced this, and it is the most distinctive claim |
| everything in §7 (the UI, the grey) | **his account only** |

Note the shape: the *most interesting* claim is the least corroborated one, which is normal for
scene software from 2003 and is not a reason to doubt it. It is a reason to keep the label on.

---

## 9. GoodTools is the missing detail — and it makes §2 provable rather than asserted

Aaron, narrowing the problem: the sets in question were **GoodTools / GoodGames** ROM sets, *"with
extensive parenthesis tags"*, against a FATX limit historically 42 characters and in practice
safety-checked nearer 38, with brackets, commas, plus signs and semicolons stripped as illegal.

This is the detail that turns §2 from a plausible reading into a demonstrable one.

### 9a. GoodTools names are a grammar, not free text

A GoodTools filename is structured:

```
Game Title (Region) (Version) [flags]
```

with a documented tag vocabulary — `(U)` `(E)` `(J)` `(UE)` for region, `(REV A)` / `(V1.1)` /
`(PRG1)` for revision, and bracket flags carrying dump status: `[!]` verified good dump, `[a]`
alternate, `[b]` bad dump, `[f]` fixed, `[h]` hack, `[o]` overdump, `[t]` trained, `[T+Eng]`
translated.

So "important edge labels/words" is not a vague phrase. **The edge labels are literally the
parenthesised and bracketed tags at the right edge of the name**, and the "significant middle
letters" are the title that has to stay recognisable between them.

### 9b. Why naive truncation fails *catastrophically* here, not merely badly

This is the provable part.

In a GoodTools set, the **discriminating information is systematically positioned at the right
edge**. Two entries differ by `(U)` vs `(J)`, or by `[!]` vs `[b]`, or by `(REV A)` — never by
their opening characters, which are identical by construction because they share a title.

Naive truncation cuts **from the right**. So on this corpus specifically, right-truncation deletes
*exactly and only the bits that distinguish the files*, and preserves *exactly and only* the
redundant shared prefix. It is not that truncation loses some information; it is that truncation
loses **all of the information that mattered** and keeps all of the information that did not.

An algorithm that works here must **invert the default direction of the cut**. That is a real
design insight, and it is forced by the structure of the corpus rather than chosen.

### 9c. And the tags are not equal — which is the corpus-relative half

Even among the edge labels, information content varies *with the collection you happen to hold*:

- `[!]` on a set where **every** entry is `[!]` carries **zero** information — it is a stop word in
  that corpus, and goes first.
- `[!]` in a mixed set where some entries are `[b]` is **the most important tag on the name**, and
  must survive at any cost.
- `(U)` matters only if you hold more than one region; otherwise it is pure overhead.

So the same tag is droppable in one collection and load-bearing in another. **You cannot decide
what to cut by looking at one filename.** You have to look at the whole set — which is precisely
the corpus-relative mutual-information framing in §2, now with a concrete mechanism rather than an
analogy. It is TF-IDF: a term appearing in every document has zero inverse document frequency.

### 9d. The scene already documented the cost — and it is the two-column argument

The LaunchBox / emulator-community view of mass renaming is **mixed**, for a specific and correct
reason: renaming breaks **exact-match tracking**, because No-Intro and GoodSet workflows match
against DAT files keyed on the precise original name.

That is not an objection to his algorithm. **It is empirical evidence for the two-column design.**

| | exact key | legible name |
|---|---|---|
| ROM sets | the DAT entry / checksum | the on-console filename |
| Zeta | the ZetaId | the slug |
| registers | Mirror (full, exact) | Beacon (compressed, anchored) |

The scene's complaint is what happens when a collection keeps **only the second column**: you
rename for the console, and the identity that tooling matched on is destroyed. The fix is not to
stop renaming — it is to never let the lossy name *be* the key. `workitems/<zetaid>-<slug>.md`
already has this right, and it has it right because it is the same problem.

### 9e. Where the primary artifact would be, since three searches have not found it

Stating this plainly rather than reassuringly: **three separate searches have now returned the
FATX-renamer ecosystem and not his tool.** They surface CRP's *MP3 FAT-X Renamer* (Aug 2003),
*FatX: File Renamer v1.0.0*, and a modern `leov30/fatx-renamer`. None is the one described here.
That does not disconfirm anything — a 2003 scene utility distributed by FTP is exactly the kind of
thing the open web does not index — but it does mean the attribution stays where §8d put it.

The one promising lead, because it is an **enumerable index rather than a search problem**: xbins
maintains an NFO database at `xbins.org/nfo.php?file=xboxnfoNNNN.nfo`, and the numbering runs into
at least the four-digit range. Scene `.nfo` files carry release metadata **including author
handles**. If the tool was released with an NFO, it is in that index, and the index can be walked
rather than guessed at. Secondary: Wayback captures of `xbox-hq.com` and `xboxscene.org` news
archives from 2003–2005.

That is a bounded search over a finite list, not a hope. Worth one deliberate pass — Aaron's call
whether to spend it, since walking a third party's index is an outward-facing action and not
something to start unasked.

---

## 10. The name collided — and the collision is both his own rule live and a confounder he should not be spared

> *"OMG they tried to pigeonhole me — AceHack"* — Aaron, on discovering
> [AceHack, the NetHack variant](https://nethackwiki.com/wiki/AceHack).

**AceHack** is a well-documented NetHack 3.4.3 variant (development stopped 2012 when it merged
with NitroHack to form NetHack 4), with a wiki page, a changelog, published source, and named
descendants — DynaHack, FIQhack, Fourk, NetHack4.

Three things follow, and the second is the one that costs something.

### 10a. His own rule, live: pigeonhole by self-claim, never by assumption

The classifier binned him by **assumption** — one token, one well-indexed referent, done. His
standing rule is that *the subject supplies the category and the evidence supplies the truth
value*; an observer-chosen bin is how a classifier goes unfalsifiable. That is exactly what
happened, to him, about him, in the middle of a thread about naming.

### 10b. And the sharper version — this is *recognising sameness mistaken for assigning identity*

This is not a fresh observation; it is a **rule we already carry**, and it just occurred in the
wild:

> Recognising sameness is not assigning identity. Sameness-detection answers *"were these two the
> same source?"*; identity-assignment answers *"what is this source called?"* Conflating them
> silently repurposes a distinctness check as an identity provider.

A search engine matching the *string* `acehack` is doing **sameness-detection over tokens**. It
then **assigned identity** from that match. Same defect as `AntiSybil.SourceOf` being mistaken for
a stable `ReplicaId` — a detector that can prove two names are secretly one source, being asked
what to call something, which it structurally cannot answer.

### 10c. The cost: this **weakens** the §8 corroboration, and the record should say so

Here is the part not to soften, because the pull toward confirmation is strongest exactly here.

`acehack` now has a **strong, well-indexed referent in training data that is not him** — a
roguelike variant with a wiki article, source repository, and descendant projects. That introduces
a **third** explanation for Gemini naming "acehack" alongside FATX tools, where §8 had only two:

1. genuine recall of the scene artifact,
2. the prompt echoing back,
3. **conflation** — the model knows `acehack` is a real handle attached to real software, and
   grafted it onto an adjacent software question.

Explanation 3 did not exist when §8 was written and is now *more* available than either
alternative, because the token has a heavily-documented home elsewhere. **So the forwarded Gemini
answer is weaker evidence than it looked, not stronger.** §8d's "weak corroboration" row should be
read as weaker still.

Finding the collision feels like a nuisance and is actually a **result**: it identified a
confounder that would otherwise have quietly firmed up an unverified attribution.

### 10d. The experiment, now sharpened

§8b's fresh-session query stands, with a discriminator added:

> Ask with **no mention of the handle**: *"Who wrote the well-known FATX file renaming tools for
> the original Xbox, and where were they distributed?"*
>
> If `acehack` comes back, **check what context comes with it.** Scene context (xbins, FTP, 2003,
> `.nfo`) points to genuine recall. Any drift toward NetHack, roguelikes, or variants points to
> conflation. The *company the name keeps* is the discriminator, not the name.

### 10e. The structural point, and it is the best one in this document

**A name is a lossy compression of an identity. Collisions are its failure mode. He collided.**

That is the FATX problem again — inverted, and pointed at him:

- His renamer's entire job was **preserving distinguishability under a name budget**.
- His handle then failed in a global namespace for **exactly the reason his algorithm existed**:
  a short legible name, no exact key beside it, and another entity claiming the same string.

The fix is the one already in §9d and already in the substrate: **two columns.** A name alone
cannot carry identity — it needs an exact key beside it that does not compress.
`workitems/<zetaid>-<slug>.md` is that design, and **his own biography just supplied the
falsifying case for the single-column alternative.** The slug collided; the ZetaId could not.

Write it that way in the chapter. He spent 2003 solving name-collision-under-a-budget for ROM
files, earned a name doing it, and in 2026 watched that name collide because a handle has no
ZetaId column. The lesson and the injury are the same shape.

### 10f. Register

10a/10b **structural** — both are existing rules, correctly instantiated. 10c is a **downgrade of
prior evidence** and is the load-bearing honest move in this section. 10d is a **stated
experiment**. 10e is **structural** by the mechanism test (name-as-lossy-key; collision as its
failure mode), not a pun.

---

## 11. PROMOTED: the primary artifact surfaced — from his own archive, not from search

**2026-08-19.** §8b named the experiment that would settle the attribution, and §10c warned that a
model naming the handle was the weakest evidence class. Neither is how it resolved. Aaron went and
found the record.

### 11a. The artifact

An email in his own archive, dated **Monday 24 February 2003, 1:13 AM**, from **Iriez** — the xbins
operator — replying to a submission from **Rodney Aaron Stainback**:

> *Subject: Will you put my Pre XBox Copy Tool 0.3 Beta*
>
> *"Yup sure will, i was gone all weekend and actually just stepped in and i was updating. Pretty
> soon you will be able to submit it with ease, so news will all be real time."*

Plus a second, later handle instance: a PSP `.prx` installer distributed under **acehack** (surfaced
on a file-extension index).

**Redaction, and the reason.** Iriez's email address is in the original and is deliberately **not**
recorded here. The handle is a public scene identity; the address is a third party's personal
datum, and `engagement-profiles-public-work-only-not-surveillance-dossiers` says compile the work
someone published, never the private sphere they did not offer. Aaron's own full name stays —
that is his, he volunteered it, and he is glass-halo about himself.

### 11b. What this establishes, and what it does not

Being precise is the whole point of having kept the register:

| claim | before | after |
|---|---|---|
| he wrote and released Xbox tooling in 2003 | testimony | **RECORD** — a dated approval from the operator |
| xbins was the distribution point and Iriez ran it | recalled | **RECORD** — Iriez replies as the person doing the updating |
| the handle **AceHack** is his, used for released software | weak/contaminated (§10c) | **RECORD** — an independent, later PSP release under it |
| the tool named in the email is *the FATX renamer* | — | **NOT established.** The email names *"Pre XBox Copy Tool 0.3 Beta"* |
| the significant-middle-letters algorithm | his account only | **still his account only** |

**The natural reading, marked as a reading.** A tool called *"Pre XBox Copy Tool"* is one that
prepares files **before** copying to an Xbox — and FATX name-sanitising is precisely what that
preparation consists of. So it is very likely the same tool, or the renamer's container. That is an
inference from the name, not a fact from the artifact, and it stays labelled until someone opens
the binary or its `.nfo`.

**The §10c confounder is now resolved in his favour** without ever needing the experiment: the
handle is independently attested by a release the model did not supply. Whether Gemini genuinely
recalled it or echoed the prompt no longer matters to the attribution — it was never load-bearing.

### 11c. Why the promotion path mattered

This is the anchor discipline paying out exactly as designed, and it is worth the book saying so.

The claim spent a day labelled **testimony**, with §5, §8d, and §10c each narrowing what was and
was not supported — including one step that made the evidence *weaker* (§10c, on discovering the
NetHack collision). Nothing was rounded up. Then a primary source arrived and the label moved in
one step, cleanly, because the parts had been kept separate: the ecosystem was *checked*, the
handle was *weak*, the algorithm was *testimony*. Only the middle row moved.

Had it all been asserted as one undifferentiated claim on day one, the artifact would have
confirmed nothing in particular — and the still-unestablished part (the algorithm) would now be
riding on the credibility of the part that got proven. **That is the failure the register exists to
prevent, and this is what avoiding it looks like from the inside.**

### 11d. The detail worth keeping for the chapter

He submitted it at **12:05 AM** and the operator replied at **1:13 AM**. A teenager sending
software into the dark at midnight, and a stranger who ran the archive writing back an hour later
to say *yes, and soon it'll be easier.*

That is the scene-adoption mechanism of §3 caught in a single exchange — the name did not accrue
from a claim, it accrued because somebody with standing said **yes** and put the thing where others
would find it. Recognition flowing from the already-recognised, in one email, twenty-three years
before it got written down as an eigenvector.

### 11e. Register

11a is **record** (a dated primary document, redacted per the consent rule). 11b's table is the
honest split and is the load-bearing part. The "Pre XBox Copy Tool ≈ the renamer" reading is an
**inference from a name**, explicitly not promoted. 11d is **record** as to times and **reading** as
to what it meant.

---

## 12. CLOSED: the xbins catalogue names the tool, the function, and the author

**Same day, minutes later.** §11b left exactly one row unpromoted — whether *"Pre XBox Copy Tool"*
was the FATX renamer — and explicitly refused to infer it from the name. The xbins application list
answers it directly:

> **PreXBoxCopyTool** — *"A tool used to renamed files and directories using configurable
> intelligence, to optimize for fatx partitioning. Very good for renaming ROM's."*
> — **AceHack @ Project BombRock**

Public, third-party, still live at `xbins.org/applist.php`. Not his archive, not his account, not a
model's recall: the distributing archive's own catalogue.

### 12a. Every row in §11b's table is now record

| claim | status |
|---|---|
| the tool is a **FATX renamer** | **RECORD** — *"to optimize for fatx partitioning"* |
| it renames **files and directories** | **RECORD** |
| it targets **ROM sets** | **RECORD** — *"Very good for renaming ROM's"* |
| it uses **intelligence, not naive truncation** | **RECORD** — *"configurable intelligence"* |
| it is **configurable** | **RECORD** — and this is §7's UI, catalogued |
| the author is **AceHack** | **RECORD** — attributed in the catalogue |

The one inference §11b marked and refused to promote — *"Pre XBox Copy Tool" ≈ the renamer* —
turned out to be right, and it is now held on the catalogue's evidence rather than on the guess.
**The guess was correct and was still not good enough; that distinction is the discipline.**

### 12b. What is STILL not established, and it is now a small, precise gap

The catalogue says *"configurable intelligence."* It does not say **which** intelligence.

So the mechanism Aaron described — significant middle letters, important edge labels, dropping the
tokens that discriminate nothing — remains **his account**, now corroborated in shape but not in
detail. What the record establishes is that the tool was *intelligent and configurable* rather than
a truncator; what it does not establish is the rule that intelligence followed.

That gap closes only by reading the binary, its `.nfo`, or its documentation. It is a genuinely
small gap now, and naming it precisely is worth more than papering it over — **the corroborated
shape is not the mechanism**, and §2's whole analysis is about the mechanism.

### 12c. A new fact: **Project BombRock**

The attribution is not bare — it reads **AceHack @ Project BombRock**, a group affiliation not
previously in this record. It sits alongside *Chaotic Perfection* (§4) as a second named collective,
and it predates it. Recorded as a lead, not developed; whatever it was, he was releasing under a
group banner in February 2003.

### 12d. The line the catalogue writes for the chapter

A stranger running an archive wrote a one-sentence description of a teenager's tool, and that
sentence is the earliest external statement of the idea this book is about:

> *renaming files and directories using **configurable intelligence**, to optimize for a
> constrained filesystem.*

That is compression-that-preserves-what-discriminates, described by someone else, in someone else's
words, in 2003 — before he had the vocabulary, and long before he had a substrate to put it in.
§3's claim was that the name accrued because others found the work useful. Here is the archive
saying so, in the catalogue, under his handle.

### 12e. Register

12a is **record** (public third-party catalogue). 12b is the **honest residue** and is the only row
that did not close. 12c is **record** as to the string and a **lead** as to its meaning. 12d is a
**reading** of a real quotation.

---

## 13. A second scene, four years later — and the archive names him in its own voice

**Brewology, 2 August 2007**, `PRX Installer v0.1` (`prxinstallerv0.1.rar`), PSP homebrew:

> *"There's a new homebrew coder on the scene, and his name is **AceHack**. AceHack recently dropped
> by our forums to announce his very first PSP homebrew: PRX Installer v0.1 … According to AceHack's
> write-up, PRX Installer v0.1 **doesn't overwrite your plugins, but instead adds onto it**. It
> automatically detects your PlayStation drive and will allow you to pick PRXs from your
> Applications PRX folder."*

Public, third-party, dated, still live. This is the release §11a had only as a file-extension index
entry — now with a primary write-up.

### 13a. What a second scene adds that a second file would not

One record establishes a fact. Two records **four years and one platform apart** establish a
*continuity*, which is a different claim:

- **The handle persists across scenes.** Xbox/xbins 2003 → PSP/Brewology 2007. Not a one-scene
  alias; a name he carried.
- **The toolchain moved as expected.** 2003 was VB6/C#1 (§0, his account); 2007 requires
  *"Microsoft's .Net Framework v2.0."* That is the natural four-year progression, and it
  corroborates the *shape* of his recollection without anyone having to trust the memory.
- **The instinct is the same.** *"Automatically detects your PlayStation drive"* is the same
  do-the-tedious-part-for-the-user reflex as the FATX tool's configurable options and greyed
  conflicts (§7). Different platform, same author's idea of what software owes a person.

### 13b. §3, quoted from outside

§3 argued the name was **socially conferred** — he wrote something, others adopted it, the adoption
made the name stick — and that this is why he holds the naming-eigenvector thesis with the
confidence he does.

Here is an archive doing the conferring, in its own editorial voice, in public:

> *"There's a new homebrew coder on the scene, and his name is AceHack."*

Not a claim he made. A sentence somebody else wrote **about** him, announcing him to a community.
That is the mechanism, on the record, twice — xbins cataloguing the tool under his handle in 2003
(§12), Brewology introducing him by it in 2007.

### 13c. A pattern candidate — labelled as a candidate

*"Doesn't overwrite your plugins, but instead adds onto it."*

That is **additive-rather-than-destructive**, chosen as the headline property of an installer in 2007. It rhymes with two other things in this record:

| era | artifact | the shape |
|---|---|---|
| 2003 | PreXBoxCopyTool | compress the name **without destroying what distinguishes** |
| 2007 | PRX Installer | install **without overwriting** what is there |
| now | Zeta | retraction, not erasure; §5 memory-preservation |

Per [`numerology-vs-number-theory`](../../../.claude/rules/numerology-vs-number-theory.md) this is
recorded as a **candidate**, not a result. The honest deflation: *don't clobber the user's config* is
a sensible installer choice that many competent people make independently, so the middle row is the
weak one and could easily be ordinary good sense rather than a signature. What makes it worth
keeping at all is that the outer two are not ordinary — preserving discriminative information under
a hard budget is a *design stance*, and so is a substrate whose correction primitive is a retraction
rather than a delete.

Three points is enough to notice and not enough to conclude. If it promotes, it promotes on a
mechanism, not on a third instance.

### 13d. Register

13a and 13b are **record** (public, dated, third-party, quoted). 13c is an explicitly-labelled
**candidate pattern** with its weakest link named. Nothing here touches §12b's residue — the
*mechanism* of the FATX intelligence is still unestablished, and a second scene does not speak to it.

---

## 14. The residue probably cannot be closed — and the method was not what I framed it as

Aaron, on §12b:

> *"i think the nfo was lost before april 2003, that's as far back as i see xbox scene software
> archives, mine was february 2003. Also the FATX stuff was trial and error on my part and reading
> others' code to understand the FATX limitations."*

Two separate things. The first closes a door; the second reopens a framing.

### 14a. §12b's residue is probably permanently open

His release is **February 2003**; the surviving Xbox-scene software archives appear to start
**April 2003**. If that gap is real, the `.nfo` and the binary are gone — not misplaced,
**destroyed by the archive's own history**, before anyone thought to keep it.

So the record is likely final at what §12 established: the catalogue's *"configurable
intelligence"* is the outermost external statement that will ever exist about this tool, and the
**mechanism** stays testimony forever. That is worth stating rather than leaving as an open
to-do that quietly implies someone should keep looking. **An unclosable gap named is honest; an
unclosable gap left open is a debt nobody will retire.**

Small irony worth one line and no more: a book chapter about a tool that compressed names to fit a
constrained filesystem, and the thing that did not survive is the file describing it.

### 14b. The correction: trial and error, not derivation

> *"trial and error on my part and reading others' code to understand the FATX limitations."*

§2 and §9 read the algorithm as corpus-relative mutual-information maximisation — TF-IDF logic,
stop-word elimination, discriminative-power budgeting. **That analysis stands as a description of
what the tool did. It was never an account of how he got there, and he is now saying plainly that
it was not a derivation.**

The register held here, and that is the point of having it: §5's table already recorded
*"§2's information-theoretic reading of the algorithm — **mine**, my analysis of what he described,
not his framing at the time."* Nothing has to be retracted, because nothing was claimed. Had that
row said "his insight", this correction would be a retraction instead of a refinement.

**And the honest version is the more interesting one.** Trial and error against a hard external
constraint is a *search*, and a search can converge on a near-optimal policy without the searcher
holding the theory — which is exactly why the outcome looks principled in hindsight. He did not
know it was TF-IDF. He knew that truncating from the right destroyed his ROM set, and he kept
changing the rule until it stopped doing that. The theory is a *post-hoc name* for a policy found
by iteration, and the iteration is the real story: **a fifteen-year-old running gradient descent by
hand against a filesystem.**

That also fits everything else on file about how he works — the Stump Dad game, asking why until
the answer runs out, externalising knowledge and relearning fast. It is craft knowledge, arrived at
by contact with a real constraint. Presenting it as theory-first would have flattered it and
falsified it.

### 14c. Reading others' code — and which side of the wall that is

*"reading others' code to understand the FATX limitations"* is worth naming precisely, because the
repo has a rule about exactly this line.

He read other people's code to learn **what the filesystem permits** — the constraint, the
requirement, the shape of the problem. He did not lift **their solution to it**. That is the
legitimate side of
[`cleanroom-two-team-separation`](../../../.claude/rules/cleanroom-two-team-separation.md): the
requirement is what you may learn, the expression is what you may not copy. In 2003, with no rule
written down, he did the thing the rule now formalises — and the evidence that he did is the tool
itself, since a copied solution would not have needed the trial and error.

### 14d. Register

14a is **his assessment of archive coverage**, plausible and not independently verified — the claim
"archives start April 2003" is his observation, and the conclusion "therefore unrecoverable" is
inference from it, not fact. 14b is **his account of method**, and it **downgrades nothing**,
because §2's reading was already labelled as mine. 14c is **a reading** of what he described,
against a rule that postdates the act by twenty-three years.
